/**
 * 「按对话统计」表格的对话显隐偏好（概览页专用）。
 *
 * 定位与 `filter-prefs.ts` / `chart-prefs.ts` 一致：纯展示偏好，放 localStorage，
 * 不进 `settings`、不参与导出与 WebDAV 同步，也不影响任何统计口径——隐藏只是让
 * 该对话不出现在概览「按对话统计」表里，热力图、统计页、历史页、趋势预测、
 * 能耗评分等全部照旧按全量历史计算。
 *
 * 存储形态：`{ hidden: string[] }`，元素是「对话键」而不是 chatId 原值：
 * 无 chatId 的记录（旧数据/未分组）统一用 `NULL_CHAT_KEY`，与
 * `data/computed.ts#computeChatStats` 内部的聚合键保持一致，
 * 这样没有 chatId 的那一行也能被单独隐藏。
 *
 * 读写全部包 try/catch：宿主禁用存储或隐私模式下静默退化为内存态
 * （本次会话有效，刷新后回到「全部显示」），不影响功能可用性。
 */
export const CHAT_VISIBILITY_KEY = 'aus_chat_visibility_v1';

/** 无 chatId 的记录（旧数据/未分组）在所有统计里共用的聚合键 */
export const NULL_CHAT_KEY = '__null__';

export type ChatVisibilityPrefs = {
  /** 被隐藏的对话键列表（见 chatVisibilityKey） */
  hidden: string[];
};

/** chatId → 存储键：空值统一落到 NULL_CHAT_KEY */
export function chatVisibilityKey(chatId: string | null | undefined): string {
  return chatId ? String(chatId) : NULL_CHAT_KEY;
}

/** 校验并去重：只保留非空字符串，非法输入一律丢弃 */
export function normalizeHiddenKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function storage(): Storage | null {
  try {
    const store = (globalThis as any).localStorage;
    if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return null;
    // 探针：隐私模式/宿主禁用存储时 getItem 会直接抛错，这里先试读一次，
    // 抛错就整体退回内存态，避免「写失败但读也不报错」导致开关看似无效。
    store.getItem(CHAT_VISIBILITY_KEY);
    return store as Storage;
  } catch {
    return null;
  }
}

/** 内存态兜底（localStorage 不可用时本次会话仍可切换） */
let memoryHidden: string[] | null = null;

/** 读取隐藏键列表（只读副本，调用方可安全排序/遍历） */
export function readHiddenKeys(): string[] {
  const store = storage();
  if (!store) return memoryHidden ? memoryHidden.slice() : [];
  try {
    const raw = store.getItem(CHAT_VISIBILITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeHiddenKeys(parsed?.hidden);
  } catch {
    return [];
  }
}

function writeHiddenKeys(keys: string[]): void {
  const clean = normalizeHiddenKeys(keys);
  memoryHidden = clean;
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CHAT_VISIBILITY_KEY, JSON.stringify({ hidden: clean } satisfies ChatVisibilityPrefs));
  } catch {}
}

/** 该对话当前是否被隐藏（入参是存储键） */
export function isHiddenKey(key: string): boolean {
  return readHiddenKeys().includes(key);
}

/** 设置某个对话键的显隐；hidden=true 表示从「按对话统计」表里隐藏 */
export function setHiddenKey(key: string, hidden: boolean): void {
  if (!key) return;
  const current = readHiddenKeys();
  const has = current.includes(key);
  if (hidden === has) return;
  writeHiddenKeys(hidden ? current.concat(key) : current.filter((k) => k !== key));
}

/** 全部恢复显示 */
export function clearHiddenKeys(): void {
  writeHiddenKeys([]);
}

/** 隐藏条目数 */
export function hiddenKeyCount(): number {
  return readHiddenKeys().length;
}

/**
 * 过滤出应当展示的行（纯函数，按入参顺序、不改变排序）。
 * 传 keyOf 便于测试与复用；默认按 ChatSummaryRow.chatId 取键。
 */
export function filterVisibleRows<T extends object>(
  rows: readonly T[],
  keyOf: (row: T) => string = (row) => chatVisibilityKey((row as any)?.chatId ?? null),
): T[] {
  const hidden = readHiddenKeys();
  if (!hidden.length) return rows.slice();
  const set = new Set(hidden);
  return rows.filter((row) => !set.has(keyOf(row)));
}
