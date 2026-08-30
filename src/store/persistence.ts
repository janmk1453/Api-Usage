/**
 * 分页存储：extensionSettings(热) + IndexedDB(localforage 风格，自实现) + 旧 LS/TavernHelper 迁移
 * 热 50 条存 extensionSettings，冷历史进 IndexedDB，XOR 保持兼容
 */
import { STORAGE_KEYS } from '../constants/pricing';

const MODULE = 'api_usage_stat';
const HOT_KEEP = 50;
const DB_NAME = 'api_usage_stat_db';
const STORE_NAME = 'kv';

// 简易 IndexedDB 封装（参考 ds-main）
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

// 旧存储读取（TavernHelper + LS）
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
function saveLegacy(key: string, value: string) {
  try {
    const gv: any = (globalThis as any).getAllVariables;
    const rv: any = (globalThis as any).replaceVariables;
    if (typeof gv === 'function' && typeof rv === 'function') {
      const v = gv(); v[key] = value; rv(v);
    }
  } catch {}
  try { localStorage.setItem('ds_' + key, value); } catch {}
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

// 热数据节流保存
let saveTimer: any = null;
export function saveHot(patch: Record<string, any>) {
  const cur = getExtensionSettings() || {};
  const next = { ...cur, ...patch, _updated: Date.now() };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveExtensionSettings(next), 300);
}

export async function migrateIfNeeded(): Promise<void> {
  const cur = getExtensionSettings();
  if (cur && cur._migrated) return;
  // 检测旧键
  const legacySaves = loadLegacy(STORAGE_KEYS.SAVES);
  if (!legacySaves && !cur) {
    saveExtensionSettings({ _migrated: true, _updated: Date.now() });
    return;
  }
  // 备份
  try {
    const backup: any = {};
    for (const k of Object.values(STORAGE_KEYS)) {
      const v = loadLegacy(k as string);
      if (v) backup[k] = v;
    }
    if (Object.keys(backup).length) await dbSet('migration_backup_' + Date.now(), JSON.stringify(backup));
  } catch {}
  // 搬运热数据
  try {
    const savesRaw = loadLegacy(STORAGE_KEYS.SAVES);
    const settingsRaw = loadLegacy(STORAGE_KEYS.SETTINGS);
    const curSave = loadLegacy(STORAGE_KEYS.CURRENT_SAVE);
    const balanceRaw = loadLegacy(STORAGE_KEYS.BALANCE);
    const customBal = loadLegacy(STORAGE_KEYS.CUSTOM_BALANCE);
    const msgCount = loadLegacy(STORAGE_KEYS.MESSAGE_COUNT);
    const next: any = { _migrated: true, _updated: Date.now() };
    if (savesRaw) {
      try {
        const saves = JSON.parse(savesRaw);
        // 冷热分离：每存档保留热 50 条于 extensionSettings，其余进 IDB
        const hotSaves: any = {};
        for (const [k, s] of Object.entries(saves as any)) {
          const hist: any[] = (s as any).history || [];
          const hot = hist.slice(0, HOT_KEEP);
          const cold = hist.slice(HOT_KEEP);
          hotSaves[k] = { ...(s as any), history: hot, _coldCount: cold.length };
          if (cold.length) await dbSet('cold_' + k, JSON.stringify(cold));
        }
        next.saves = hotSaves;
      } catch {}
    }
    if (settingsRaw) try { next.settings = JSON.parse(settingsRaw); } catch {}
    if (curSave) next.currentSave = curSave;
    if (balanceRaw) try { next.balance = JSON.parse(balanceRaw); } catch { next.balance = balanceRaw; }
    if (customBal) next.customBalance = customBal;
    if (msgCount) next.messageCount = parseInt(msgCount, 10) || 0;
    saveExtensionSettings({ ...(cur || {}), ...next });
  } catch {}
}

export async function loadHot(): Promise<any> {
  await migrateIfNeeded();
  return getExtensionSettings();
}

export async function loadHistoryCold(saveKey: string): Promise<any[]> {
  try {
    const raw = await dbGet('cold_' + saveKey);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function appendHistoryCold(saveKey: string, entries: any[]) {
  if (!entries.length) return;
  const cold = await loadHistoryCold(saveKey);
  const next = [...entries, ...cold];
  await dbSet('cold_' + saveKey, JSON.stringify(next));
}
