/**
 * 分页存储：extensionSettings(热) + IndexedDB + 旧 LS/TavernHelper 迁移
 * 已废弃多存档，迁移时将所有旧 saves 合并为单一历史
 */
import { STORAGE_KEYS } from '../constants/pricing';
import { historyRecordKey } from '../utils/history-key';
import { log } from '../utils/logger';

const MODULE = 'api_usage_stat';
export const HOT_KEEP = 50;
const DB_NAME = 'api_usage_stat_db';
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result as IDBDatabase;
        db.onversionchange = () => {
          try { db.close(); } catch {}
          if (dbPromise) dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = (e: any) => reject(e.target.error);
    } catch (err) { reject(err); }
  });
}

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDB().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}
async function dbGet(key: string): Promise<string | null> {
  try {
    const db = await getDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const r = tx.objectStore(STORE_NAME).get(key);
      r.onsuccess = (e: any) => res(e.target.result ?? null);
      r.onerror = (e: any) => rej(e.target.error);
    });
  } catch (dbError) {
    try {
      const fallback = localStorage.getItem('aus_' + key);
      if (fallback != null) return fallback;
    } catch {}
    log.warn('IndexedDB 读取失败且无本地降级数据', dbError);
    throw dbError;
  }
}
async function dbSet(key: string, value: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const r = tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => res();
      tx.onabort = () => rej(tx.error || r.error);
      tx.onerror = () => rej(tx.error || r.error);
      r.onerror = (e: any) => rej(e.target.error);
    });
    try { localStorage.removeItem('aus_' + key); } catch {}
  } catch (dbError) {
    try {
      localStorage.setItem('aus_' + key, value);
    } catch (storageError) {
      log.error('持久化写入失败', key, dbError, storageError);
      throw storageError;
    }
  }
}

async function dbDelete(key: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const r = tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => res();
      tx.onabort = () => rej(tx.error || r.error);
      tx.onerror = () => rej(tx.error || r.error);
      r.onerror = (e: any) => rej(e.target.error);
    });
    try { localStorage.removeItem('aus_' + key); } catch {}
  } catch (dbError) {
    try { localStorage.removeItem('aus_' + key); } catch {}
    log.warn('IndexedDB 删除失败，已尝试清理本地降级存储', dbError);
  }
}

/**
 * 旧版迁移备份的键名白名单。
 * 迁移时写入的键固定为 "migration_backup_" + 毫秒时间戳（见 migrateIfNeeded）。
 * 清理逻辑一律先过这道正则：只认这一种形态，冷历史（cold_history）、
 * 冷存档（cold_<name>）以及任何未知键都不会被匹配，杜绝误删。
 */
const MIGRATION_BACKUP_KEY_RE = /^migration_backup_\d+$/;

/** 是否为旧版迁移备份键（纯函数，供清理与统计共用） */
export function isMigrationBackupKey(key: unknown): boolean {
  return typeof key === 'string' && MIGRATION_BACKUP_KEY_RE.test(key);
}

/**
 * 列出可清理的旧版迁移备份键（只读扫描，不动任何数据）。
 * 额外要求值为字符串：dbSet 只写字符串，类型不符说明是异常数据，交由人工处理。
 */
export async function listMigrationBackupKeys(): Promise<string[]> {
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(STORE_NAME)) return [];
    return await new Promise<string[]>((resolve) => {
      const keys: string[] = [];
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(keys); } };
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const req = tx.objectStore(STORE_NAME).openCursor();
        req.onsuccess = (e: any) => {
          const cur = e.target.result;
          if (!cur) { done(); return; }
          const key = String(cur.key);
          if (isMigrationBackupKey(key) && typeof cur.value === 'string') keys.push(key);
          try { cur.continue(); } catch { done(); }
        };
        req.onerror = () => done();
        tx.onabort = () => done();
      } catch { done(); }
      setTimeout(done, 800);
    });
  } catch {
    return [];
  }
}

/**
 * 清理旧版迁移备份（升级前的数据快照）。
 *
 * 安全约束（缺一不可）：
 *  1. 键名必须完全匹配 migration_backup_<数字>，逐条二次校验，白名单外一律跳过；
 *  2. 只删值为字符串的条目（见 listMigrationBackupKeys），异常数据不动；
 *  3. 只按已知键名逐条 dbDelete，绝不使用 clear()/deleteDatabase()；
 *  4. 删除后再扫描一次确认，返回真实删除数与剩余数，不虚报；
 *  5. 同时清掉 localStorage 降级副本 aus_migration_backup_*（同一份数据的兜底副本），
 *     且只认 aus_ + 合法键名，不触碰 aus_cold*（那是冷历史降级副本，仍在用）。
 */
export async function deleteMigrationBackups(): Promise<{ deleted: number; remaining: number; skipped: string[] }> {
  const skipped: string[] = [];
  let targets: string[] = [];
  try {
    const listed = await listMigrationBackupKeys();
    targets = listed.filter((key) => isMigrationBackupKey(key));
  } catch {
    return { deleted: 0, remaining: 0, skipped };
  }

  for (const key of targets) {
    if (!isMigrationBackupKey(key)) { skipped.push(key); continue; }
    try {
      await dbDelete(key);
      try { localStorage.removeItem('aus_' + key); } catch {}
    } catch {
      skipped.push(key);
    }
  }

  // 兜底：清掉可能残留的 localStorage 降级副本（键名同样先过白名单）
  try {
    const ls: Storage | undefined = (globalThis as any)?.localStorage;
    if (ls && typeof ls.removeItem === 'function') {
      const doomed: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const raw = ls.key(i);
        if (!raw || !raw.startsWith('aus_')) continue;
        if (isMigrationBackupKey(raw.slice(4))) doomed.push(raw);
      }
      for (const raw of doomed) { try { ls.removeItem(raw); } catch {} }
    }
  } catch {}

  let remaining = 0;
  try { remaining = (await listMigrationBackupKeys()).length; } catch {}
  const deleted = Math.max(0, targets.length - Math.min(targets.length, remaining));
  return { deleted, remaining, skipped };
}

function loadLegacy(key: string): string | null {
  try {
    const gv: any = (globalThis as any).getAllVariables;
    if (typeof gv === 'function') {
      const v = gv();
      if (v && v[key] != null) return v[key];
    }
  } catch {}
  try { return localStorage.getItem('ds_' + key) ?? localStorage.getItem(key); } catch { return null; }
}

export function getExtensionSettings(): any {
  try { return (globalThis as any).SillyTavern?.getContext?.().extensionSettings?.[MODULE] ?? null; } catch { return null; }
}
export function saveExtensionSettings(data: any) {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (!ctx) return;
    ctx.extensionSettings[MODULE] = data;
    ctx.saveSettingsDebounced?.();
  } catch {}
}

let saveTimer: any = null;
let pendingPatch: Record<string, any> | null = null;
export function saveHot(patch: Record<string, any>) {
  pendingPatch = { ...(pendingPatch || {}), ...patch };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const latest = getExtensionSettings() || {};
    const merged = { ...latest, ...(pendingPatch || {}), _updated: Date.now() };
    pendingPatch = null;
    saveExtensionSettings(merged);
  }, 300);
}

export function flushSaveHot() {
  if (!saveTimer && !pendingPatch) return;
  if (saveTimer) { try { clearTimeout(saveTimer); } catch {} saveTimer = null; }
  if (pendingPatch) {
    const patch = pendingPatch;
    pendingPatch = null;
    saveExtensionSettings({ ...(getExtensionSettings() || {}), ...patch, _updated: Date.now() });
  }
}

export async function migrateIfNeeded(): Promise<void> {
  const cur = getExtensionSettings();
  if (cur && cur._migrated) {
    // 兼容旧多存档迁移至单一历史
    if (cur.saves && !cur.history) {
      try {
        let allHistory: any[] = [];
        let agg: any = { total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0, startTime: Date.now() };
        let earliest = Date.now();
        for (const s of Object.values(cur.saves as any)) {
          const h = (s as any).history || [];
          allHistory = allHistory.concat(h);
          agg.total_tokens += (s as any).total_tokens || 0;
          agg.total_cost += (s as any).total_cost || 0;
          agg.input_tokens += (s as any).input_tokens || 0;
          agg.output_tokens += (s as any).output_tokens || 0;
          agg.cache_hit_tokens += (s as any).cache_hit_tokens || 0;
          agg.cache_miss_tokens += (s as any).cache_miss_tokens || 0;
          agg.input_cost += (s as any).input_cost || 0;
          agg.output_cost += (s as any).output_cost || 0;
          agg.rounds += (s as any).rounds || 0;
          if ((s as any).startTime && (s as any).startTime < earliest) earliest = (s as any).startTime;
          // 冷数据也合并
          try { const coldRaw = await dbGet('cold_' + (s as any).name); if (coldRaw) { const cold = JSON.parse(coldRaw); allHistory = allHistory.concat(cold); } } catch {}
        }
        allHistory.sort((a: any, b: any) => b.timestamp - a.timestamp);
        const hot = allHistory.slice(0, HOT_KEEP);
        const cold = allHistory.slice(HOT_KEEP);
        if (cold.length) await dbSet('cold_history', JSON.stringify(cold));
        const next: any = { history: hot, _coldCount: cold.length, total_tokens: agg.total_tokens, total_cost: agg.total_cost, input_tokens: agg.input_tokens, output_tokens: agg.output_tokens, cache_hit_tokens: agg.cache_hit_tokens, cache_miss_tokens: agg.cache_miss_tokens, input_cost: agg.input_cost, output_cost: agg.output_cost, rounds: agg.rounds, startTime: earliest, _migratedArchive: true };
        // 清理旧存档键
        delete next.saves; delete next.currentSave;
        saveExtensionSettings({ ...cur, ...next });
      } catch {}
    }
    return;
  }
  const legacySaves = loadLegacy(STORAGE_KEYS.SAVES);
  const hasNewHistory = cur?.history;
  if (!legacySaves && !cur) {
    saveExtensionSettings({ _migrated: true, _updated: Date.now(), history: [], total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0, startTime: Date.now() });
    return;
  }
  if (hasNewHistory) {
    // 已有新结构，仅标记迁移
    saveExtensionSettings({ ...cur, _migrated: true, _updated: Date.now() });
    return;
  }
  try {
    const backup: any = {};
    for (const k of Object.values(STORAGE_KEYS)) {
      const v = loadLegacy(k as string);
      if (v) backup[k] = v;
    }
    if (Object.keys(backup).length) await dbSet('migration_backup_' + Date.now(), JSON.stringify(backup));
  } catch {}
  try {
    const savesRaw = loadLegacy(STORAGE_KEYS.SAVES);
    const settingsRaw = loadLegacy(STORAGE_KEYS.SETTINGS);
    const balanceRaw = loadLegacy(STORAGE_KEYS.BALANCE);
    const customBal = loadLegacy(STORAGE_KEYS.CUSTOM_BALANCE);
    const msgCount = loadLegacy(STORAGE_KEYS.MESSAGE_COUNT);
    const next: any = { _migrated: true, _updated: Date.now() };
    if (savesRaw) {
      try {
        const saves = JSON.parse(savesRaw);
        let allHistory: any[] = [];
        let agg: any = { total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0, startTime: Date.now() };
        let earliest = Date.now();
        let count = 0;
        for (const s of Object.values(saves as any)) {
          const h = (s as any).history || [];
          allHistory = allHistory.concat(h);
          agg.total_tokens += (s as any).total_tokens || 0;
          agg.total_cost += (s as any).total_cost || 0;
          agg.input_tokens += (s as any).input_tokens || 0;
          agg.output_tokens += (s as any).output_tokens || 0;
          agg.cache_hit_tokens += (s as any).cache_hit_tokens || 0;
          agg.cache_miss_tokens += (s as any).cache_miss_tokens || 0;
          agg.input_cost += (s as any).input_cost || 0;
          agg.output_cost += (s as any).output_cost || 0;
          agg.rounds += (s as any).rounds || 0;
          if ((s as any).startTime && (s as any).startTime < earliest) earliest = (s as any).startTime;
          count++;
        }
        allHistory.sort((a: any, b: any) => b.timestamp - a.timestamp);
        const hot = allHistory.slice(0, HOT_KEEP);
        const cold = allHistory.slice(HOT_KEEP);
        if (cold.length) await dbSet('cold_history', JSON.stringify(cold));
        next.history = hot;
        next._coldCount = cold.length;
        next.total_tokens = agg.total_tokens; next.total_cost = agg.total_cost;
        next.input_tokens = agg.input_tokens; next.output_tokens = agg.output_tokens;
        next.cache_hit_tokens = agg.cache_hit_tokens; next.cache_miss_tokens = agg.cache_miss_tokens;
        next.input_cost = agg.input_cost; next.output_cost = agg.output_cost;
        next.rounds = agg.rounds;
        next.startTime = count ? earliest : Date.now();
      } catch {}
    } else {
      next.history = [];
      next.total_tokens = 0; next.total_cost = 0; next.input_tokens = 0; next.output_tokens = 0;
      next.cache_hit_tokens = 0; next.cache_miss_tokens = 0; next.input_cost = 0; next.output_cost = 0; next.rounds = 0;
      next.startTime = Date.now();
    }
    if (settingsRaw) try { next.settings = JSON.parse(settingsRaw); } catch {}
    if (balanceRaw) try { next.balance = JSON.parse(balanceRaw); } catch { next.balance = balanceRaw; }
    if (customBal) next.customBalance = customBal;
    if (msgCount) next.messageCount = parseInt(msgCount, 10) || 0;
    // 兼容已有的新结构直接合并
    saveExtensionSettings({ ...(cur || {}), ...next });
  } catch {}
}

export async function loadHot(): Promise<any> {
  await migrateIfNeeded();
  return getExtensionSettings();
}

async function readHistoryColdRaw(): Promise<any[]> {
  try {
    const raw = await dbGet('cold_history');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('冷历史格式无效');
    return parsed;
  } catch (error) {
    log.error('冷历史读取失败', error);
    throw error;
  }
}

let coldWriteChain: Promise<void> = Promise.resolve();

function enqueueColdWrite(task: () => Promise<void>): Promise<void> {
  const run = coldWriteChain.then(task, task);
  coldWriteChain = run.catch(() => {});
  return run;
}

export async function loadHistoryCold(): Promise<any[]> {
  await coldWriteChain;
  return readHistoryColdRaw();
}

export async function appendHistoryCold(entries: any[]): Promise<void> {
  if (!entries.length) return;
  return enqueueColdWrite(async () => {
    const cold = await readHistoryColdRaw();
    // 去重：按 timestamp+model+total 指纹，避免同毫秒双记账误删/重复写入
    const keyOf = historyRecordKey;
    const seen = new Set(cold.map((h: any) => keyOf(h)));
    const toAdd = entries.filter((h: any) => !seen.has(keyOf(h)));
    if (!toAdd.length) return;
    const next = [...toAdd, ...cold];
    await dbSet('cold_history', JSON.stringify(next));
    // 同步热中的 _coldCount，便于调试
    try {
      const cur = getExtensionSettings();
      if (cur) saveExtensionSettings({ ...cur, _coldCount: next.length, _updated: Date.now() });
    } catch {}
  });
}

export async function saveHistoryCold(entries: any[]): Promise<void> {
  const next = Array.isArray(entries) ? entries : [];
  return enqueueColdWrite(async () => {
    await dbSet('cold_history', JSON.stringify(next));
    try {
      const cur = getExtensionSettings();
      if (cur) saveExtensionSettings({ ...cur, _coldCount: next.length, _updated: Date.now() });
    } catch {}
  });
}

export async function clearHistoryCold(): Promise<void> {
  return enqueueColdWrite(async () => {
    await dbDelete('cold_history');
    try {
      const cur = getExtensionSettings();
      if (cur) saveExtensionSettings({ ...cur, _coldCount: 0, _updated: Date.now() });
    } catch {}
  });
}

export async function getAllHistory(): Promise<any[]> {
  const hot = getExtensionSettings()?.history || [];
  const cold = await loadHistoryCold();
  const merged = [...hot, ...cold].sort((a: any, b: any) => b.timestamp - a.timestamp);
  const keyOf = historyRecordKey;
  const seen = new Set<string>();
  const dedup: any[] = [];
  for (const h of merged) { const k = keyOf(h); if (!seen.has(k)) { seen.add(k); dedup.push(h); } }
  return dedup;
}
