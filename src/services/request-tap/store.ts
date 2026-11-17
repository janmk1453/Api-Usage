/**
 * 请求探针 —— 隔离存储（技术验证用）
 *
 * 刻意不进 src/data：这些记录不参与概览/统计/历史/趋势的任何计算，
 * 只给验证页看。键名独立，可直接整块清空，卸载扩展时一并删除。
 */
import type { TapRecord } from './types';

export const TAP_STORAGE_KEY = 'aus_tap_log_v1';
/** 验证期上限：够看出规律，又不会把 localStorage 撑爆 */
export const TAP_MAX_RECORDS = 500;

let cache: TapRecord[] | null = null;
let writeTimer: any = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    const w: any = (window as any).parent || window;
    return w?.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  } catch {
    return null;
  }
}

function load(): TapRecord[] {
  if (cache) return cache;
  cache = [];
  try {
    const raw = storage()?.getItem(TAP_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) cache = arr.filter((r) => r && typeof r.id === 'string');
    }
  } catch {}
  return cache as TapRecord[];
}

function persist(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      storage()?.setItem(TAP_STORAGE_KEY, JSON.stringify(load()));
    } catch {
      // 超配额时丢弃最旧的一半再试一次，仍失败就只保留内存态
      try {
        cache = load().slice(-Math.floor(TAP_MAX_RECORDS / 2));
        storage()?.setItem(TAP_STORAGE_KEY, JSON.stringify(cache));
      } catch {}
    }
  }, 240);
}

function emit(): void {
  for (const fn of listeners) {
    try { fn(); } catch {}
  }
}

/** 当前全部探针记录（按时间升序） */
export function listTapRecords(): TapRecord[] {
  return load().slice();
}

/** 订阅探针记录变化（验证页刷新用） */
export function subscribeTap(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 写入或按 id 覆盖一条记录 */
export function upsertTapRecord(record: TapRecord): void {
  const list = load();
  const idx = list.findIndex((r) => r.id === record.id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  if (list.length > TAP_MAX_RECORDS) list.splice(0, list.length - TAP_MAX_RECORDS);
  persist();
  emit();
}

/** 按 id 局部更新（避免整条覆盖时丢字段） */
export function patchTapRecord(id: string, patch: Partial<TapRecord>): boolean {
  const list = load();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  list[idx] = { ...list[idx], ...patch };
  persist();
  emit();
  return true;
}

/**
 * 批量改写（一次性重判旧记录用）：updater 返回新记录才写回，返回 null 表示不动。
 * 只落盘、通知一次，避免逐条 patch 触发几十次 emit/persist。
 */
export function updateTapRecords(updater: (rec: TapRecord) => TapRecord | null): number {
  const list = load();
  let changed = 0;
  for (let i = 0; i < list.length; i += 1) {
    let next: TapRecord | null = null;
    try { next = updater(list[i]); } catch { next = null; }
    if (next && next !== list[i]) {
      list[i] = next;
      changed += 1;
    }
  }
  if (changed) {
    persist();
    emit();
  }
  return changed;
}

/** 清空验证数据 */
export function clearTapRecords(): void {
  cache = [];
  try { storage()?.removeItem(TAP_STORAGE_KEY); } catch {}
  emit();
}
