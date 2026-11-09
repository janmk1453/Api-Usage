/**
 * 清除本扩展留下的全部数据。
 *
 * 唯一调用方是 `src/index.ts#onClean`——酒馆「管理扩展程序」里删除扩展时，
 * 若在确认框勾选「同时清理扩展数据」（或点该扩展的「清理数据」按钮），
 * 酒馆会在删目录之前调用 manifest.hooks.clean 指向的导出函数。
 *
 * 清理面（只动本扩展自己的东西）：
 *  1) settings.json 的 extensionSettings[api_usage_stat]：钱包配置与价格规则、
 *     加密的钱包校准密钥 walletSecrets、匿名统计标识 telemetry、热记录 50 条；
 *  2) IndexedDB api_usage_stat_db：冷历史、旧版迁移备份、写入失败时的降级副本；
 *  3) localStorage：全部 aus_ 前缀偏好键，以及旧版遗留的 ds_ 前缀行为开关。
 *
 * 硬约束：
 *  - 禁止 localStorage.clear()、禁止无差别删库，只按白名单与前缀判断；
 *  - 清理前先 flush 再关写闸门，避免 300ms 节流保存把设置写回去；
 *  - 删库前先关连接并处理 onblocked（另一个标签页开着酒馆时会挡住删除），
 *    酒馆给钩子的超时是 5s，这里最多等 2.5s，超时按失败返回但继续清其它面。
 */
import { DB_NAME, MODULE_NAME, blockPersistentWrites, closeDB, flushSaveHot } from '../store/persistence';

/** localStorage 里需要精确匹配删除的旧版键（aus_ 前缀另外统一扫描） */
export const WIPE_LOCAL_KEYS: readonly string[] = [
  'ds_ds_webdav_pass',
  'ds_ds_peak_dot_pos',
  'ds_debug_log',
  'ds_webdav_pass',
  'ds_include_usage',
];

/** localStorage 里需要按前缀清理的键（本扩展的 aus_ 系列偏好与降级副本） */
export const WIPE_LOCAL_PREFIXES: readonly string[] = ['aus_'];

/** 判断一个 localStorage 键是否属于本扩展 */
export function shouldWipeLocalKey(key: unknown): boolean {
  if (typeof key !== 'string' || !key) return false;
  if (WIPE_LOCAL_KEYS.includes(key)) return true;
  return WIPE_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export interface WipeReport {
  settingsCleared: boolean;
  databaseDeleted: boolean;
  databaseBlocked: boolean;
  localKeysRemoved: string[];
  errors: string[];
}

function errText(err: unknown): string {
  try {
    if (err instanceof Error) return err.message;
    return String(err);
  } catch {
    return 'unknown';
  }
}

function getStorage(): any {
  try {
    const ls = (globalThis as any).localStorage;
    if (ls && typeof ls.key === 'function') return ls;
  } catch {}
  try {
    const ls = (globalThis as any).window?.parent?.localStorage;
    if (ls && typeof ls.key === 'function') return ls;
  } catch {}
  return null;
}

/** 删库；被其它标签页的连接挡住时最多等 timeoutMs，避免拖过酒馆的钩子超时 */
function deleteDatabase(name: string, timeoutMs: number): Promise<{ deleted: boolean; blocked: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    let blocked = false;
    const finish = (deleted: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ deleted, blocked });
    };
    try {
      const idb = (globalThis as any).indexedDB;
      if (!idb || typeof idb.deleteDatabase !== 'function') {
        finish(false);
        return;
      }
      const req = idb.deleteDatabase(name);
      req.onsuccess = () => finish(true);
      req.onerror = () => finish(false);
      req.onblocked = () => { blocked = true; };
      setTimeout(() => finish(false), timeoutMs);
    } catch {
      finish(false);
    }
  });
}

/**
 * 清空本扩展的全部持久化数据。永不抛错，失败原因写进返回值供日志排查。
 * 返回时 IndexedDB 与 localStorage 部分已完成；settings.json 由随后的
 * saveSettings（酒馆在钩子返回后强制调用）落盘。
 */
export async function wipeAllExtensionData(options: { timeoutMs?: number } = {}): Promise<WipeReport> {
  const report: WipeReport = {
    settingsCleared: false,
    databaseDeleted: false,
    databaseBlocked: false,
    localKeysRemoved: [],
    errors: [],
  };

  // 1) 先把待写内容落盘，再关闸门，防止后面清掉的东西又被节流保存写回来
  try { flushSaveHot(); } catch (err) { report.errors.push('flush: ' + errText(err)); }
  blockPersistentWrites();

  // 2) IndexedDB：冷历史、迁移备份、降级副本
  try { await closeDB(); } catch (err) { report.errors.push('close: ' + errText(err)); }
  try {
    const res = await deleteDatabase(DB_NAME, Math.max(50, Number(options.timeoutMs) || 2500));
    report.databaseDeleted = res.deleted;
    report.databaseBlocked = res.blocked;
    if (!res.deleted) report.errors.push(res.blocked ? 'idb-blocked' : 'idb-failed');
  } catch (err) {
    report.errors.push('idb: ' + errText(err));
  }

  // 3) localStorage：先收集键名再删，避免边遍历边删导致漏项
  try {
    const ls = getStorage();
    if (ls) {
      const doomed: string[] = [];
      for (let i = 0; i < Number(ls.length || 0); i++) {
        const key = ls.key(i);
        if (shouldWipeLocalKey(key)) doomed.push(String(key));
      }
      for (const key of doomed) {
        try {
          ls.removeItem(key);
          report.localKeysRemoved.push(key);
        } catch {}
      }
    }
  } catch (err) {
    report.errors.push('ls: ' + errText(err));
  }

  // 4) settings.json：整个 api_usage_stat 块（钱包、密钥、匿名标识、热记录）
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const bag = ctx?.extensionSettings;
    if (bag && Object.prototype.hasOwnProperty.call(bag, MODULE_NAME)) {
      delete bag[MODULE_NAME];
      report.settingsCleared = true;
      try { ctx.saveSettingsDebounced?.(); } catch {}
    }
  } catch (err) {
    report.errors.push('settings: ' + errText(err));
  }

  return report;
}
