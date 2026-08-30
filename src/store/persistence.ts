/**
 * 分页存储：extensionSettings(热) + IndexedDB + 旧 LS/TavernHelper 迁移
 * 已废弃多存档，迁移时将所有旧 saves 合并为单一历史
 */
import { STORAGE_KEYS } from '../constants/pricing';

const MODULE = 'api_usage_stat';
export const HOT_KEEP = 50;
const DB_NAME = 'api_usage_stat_db';
const STORE_NAME = 'kv';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = (e: any) => resolve(e.target.result);
      req.onerror = (e: any) => reject(e.target.error);
    } catch (err) { reject(err); }
  });
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
  } catch {
    try { return localStorage.getItem('aus_' + key); } catch { return null; }
  }
}
async function dbSet(key: string, value: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const r = tx.objectStore(STORE_NAME).put(value, key);
      r.onsuccess = () => res();
      r.onerror = (e: any) => rej(e.target.error);
    });
  } catch {
    try { localStorage.setItem('aus_' + key, value); } catch {}
  }
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
export function saveHot(patch: Record<string, any>) {
  const cur = getExtensionSettings() || {};
  const next = { ...cur, ...patch, _updated: Date.now() };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveExtensionSettings(next), 300);
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

export async function loadHistoryCold(): Promise<any[]> {
  try {
    const raw = await dbGet('cold_history');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function appendHistoryCold(entries: any[]) {
  if (!entries.length) return;
  const cold = await loadHistoryCold();
  // 去重：按 timestamp，已存在则跳过，避免重复写入
  const seen = new Set(cold.map((h: any) => h.timestamp));
  const toAdd = entries.filter((h: any) => !seen.has(h.timestamp));
  if (!toAdd.length) return;
  const next = [...toAdd, ...cold];
  await dbSet('cold_history', JSON.stringify(next));
  // 同步热中的 _coldCount，便于调试
  try {
    const cur = getExtensionSettings();
    if (cur) saveExtensionSettings({ ...cur, _coldCount: next.length, _updated: Date.now() });
  } catch {}
}

export async function getAllHistory(): Promise<any[]> {
  const hot = getExtensionSettings()?.history || [];
  const cold = await loadHistoryCold();
  const merged = [...hot, ...cold].sort((a: any, b: any) => b.timestamp - a.timestamp);
  const seen = new Set<number>();
  const dedup: any[] = [];
  for (const h of merged) { if (!seen.has(h.timestamp)) { seen.add(h.timestamp); dedup.push(h); } }
  return dedup;
}
