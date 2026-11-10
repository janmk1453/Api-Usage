/**
 * 对话显隐偏好（纯展示偏好，localStorage）。
 *
 * 定位与 `filter-prefs.ts` / `chart-prefs.ts` 一致：不进 `settings`、不参与导出与
 * WebDAV 同步，也不影响任何统计口径——隐藏只是让该对话不出现在某个展示位置，
 * 热力图、统计页、历史页、趋势预测、能耗评分等全部照旧按全量历史计算。
 *
 * 两个互相独立的隐藏集合：
 * - `hidden`：概览「按对话统计」表格里不列出；
 * - `hiddenPickers`：统计页/历史页/趋势预测页的「对话」下拉胶囊里不列出。
 *   胶囊只是少一个可选项，数据统计口径不变（已选中的对话仍按全量计算）。
 *
 * 存储形态：`{ hidden: string[], hiddenPickers: string[] }`，元素是「对话键」而不是
 * chatId 原值：无 chatId 的记录（旧数据/未分组）统一用 `NULL_CHAT_KEY`，与
 * `data/computed.ts#computeChatStats` 内部的聚合键保持一致，这样没有 chatId 的
 * 那一行也能被单独隐藏。旧版只有 `{ hidden }` 的数据照常读取，缺的集合视为空。
 *
 * 读写全部包 try/catch：宿主禁用存储或隐私模式下静默退化为内存态
 * （本次会话有效，刷新后回到全部显示），不影响功能可用性。
 */
export const CHAT_VISIBILITY_KEY = 'aus_chat_visibility_v1';

/** 无 chatId 的记录（旧数据/未分组）在所有统计里共用的聚合键 */
export const NULL_CHAT_KEY = '__null__';

/** 隐藏生效的位置：按对话统计表格 / 各页「对话」下拉胶囊 */
export type ChatVisibilityTarget = 'table' | 'picker';

export type ChatVisibilityPrefs = {
  /** 被隐藏的对话键列表（见 chatVisibilityKey）：不出现在「按对话统计」表 */
  hidden: string[];
  /** 被隐藏的对话键列表：不出现在各页「对话」下拉胶囊 */
  hiddenPickers: string[];
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

/** 校验整份偏好：缺字段、脏字段一律回落为空数组（兼容旧版只有 hidden 的数据） */
export function normalizePrefs(value: unknown): ChatVisibilityPrefs {
  const raw = (value ?? {}) as any;
  return {
    hidden: normalizeHiddenKeys(raw.hidden),
    hiddenPickers: normalizeHiddenKeys(raw.hiddenPickers),
  };
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
let memoryPrefs: ChatVisibilityPrefs | null = null;

/** 读取整份偏好（每次返回新对象，调用方可安全修改） */
export function readPrefs(): ChatVisibilityPrefs {
  const store = storage();
  if (!store) return normalizePrefs(memoryPrefs ?? {});
  try {
    const raw = store.getItem(CHAT_VISIBILITY_KEY);
    if (!raw) return { hidden: [], hiddenPickers: [] };
    return normalizePrefs(JSON.parse(raw));
  } catch {
    return { hidden: [], hiddenPickers: [] };
  }
}

function writePrefs(prefs: ChatVisibilityPrefs): void {
  const clean = normalizePrefs(prefs);
  memoryPrefs = clean;
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CHAT_VISIBILITY_KEY, JSON.stringify(clean satisfies ChatVisibilityPrefs));
  } catch {}
}

function listOf(prefs: ChatVisibilityPrefs, target: ChatVisibilityTarget): string[] {
  return target === 'picker' ? prefs.hiddenPickers : prefs.hidden;
}

function writeList(target: ChatVisibilityTarget, keys: string[]): void {
  const prefs = readPrefs();
  if (target === 'picker') prefs.hiddenPickers = normalizeHiddenKeys(keys);
  else prefs.hidden = normalizeHiddenKeys(keys);
  writePrefs(prefs);
}

/** 读取某个展示位置的隐藏键列表（只读副本） */
export function readHiddenFor(target: ChatVisibilityTarget): string[] {
  return listOf(readPrefs(), target).slice();
}

/** 「按对话统计」表格的隐藏键列表 */
export function readHiddenKeys(): string[] {
  return readHiddenFor('table');
}

/** 「对话」下拉胶囊的隐藏键列表 */
export function readHiddenPickerKeys(): string[] {
  return readHiddenFor('picker');
}

/** 该对话在该位置是否被隐藏（入参是存储键） */
export function isHiddenFor(target: ChatVisibilityTarget, key: string): boolean {
  return listOf(readPrefs(), target).includes(key);
}

/** 设置某个对话键在某位置的显隐 */
export function setHiddenFor(target: ChatVisibilityTarget, key: string, hidden: boolean): void {
  if (!key) return;
  const current = readHiddenFor(target);
  const has = current.includes(key);
  if (hidden === has) return;
  writeList(target, hidden ? current.concat(key) : current.filter((k) => k !== key));
}

/** 一次写入多个键的显隐（「全部隐藏 / 全部显示」用，避免逐条读写存储） */
export function setAllHiddenFor(target: ChatVisibilityTarget, keys: readonly string[], hidden: boolean): void {
  const clean = normalizeHiddenKeys(keys);
  const current = readHiddenFor(target);
  if (hidden) {
    const merged = current.slice();
    for (const key of clean) if (!merged.includes(key)) merged.push(key);
    writeList(target, merged);
  } else {
    const drop = new Set(clean);
    writeList(target, current.filter((key) => !drop.has(key)));
  }
}

/** 清空某个展示位置的隐藏项（全部恢复显示） */
export function clearHiddenFor(target: ChatVisibilityTarget): void {
  writeList(target, []);
}

/** 该展示位置的隐藏条目数 */
export function hiddenCountFor(target: ChatVisibilityTarget): number {
  return readHiddenFor(target).length;
}

/** 该对话是否从「按对话统计」表里隐藏 */
export function isHiddenKey(key: string): boolean {
  return isHiddenFor('table', key);
}

/** 设置某个对话键在「按对话统计」表里的显隐；hidden=true 表示隐藏 */
export function setHiddenKey(key: string, hidden: boolean): void {
  setHiddenFor('table', key, hidden);
}

/** 「按对话统计」表全部恢复显示 */
export function clearHiddenKeys(): void {
  clearHiddenFor('table');
}

/** 「按对话统计」表的隐藏条目数 */
export function hiddenKeyCount(): number {
  return hiddenCountFor('table');
}

function filterByHidden<T extends object>(
  rows: readonly T[],
  hidden: readonly string[],
  keyOf: (row: T) => string,
): T[] {
  if (!hidden.length) return rows.slice();
  const set = new Set(hidden);
  return rows.filter((row) => !set.has(keyOf(row)));
}

/**
 * 过滤出应当出现在「按对话统计」表中的行（纯函数，按入参顺序、不改变排序）。
 * 传 keyOf 便于测试与复用；默认按 ChatSummaryRow.chatId 取键。
 */
export function filterVisibleRows<T extends object>(
  rows: readonly T[],
  keyOf: (row: T) => string = (row) => chatVisibilityKey((row as any)?.chatId ?? null),
): T[] {
  return filterByHidden(rows, readHiddenFor('table'), keyOf);
}

/**
 * 过滤出应当出现在「对话」下拉胶囊里的选项（纯函数，按入参顺序）。
 * 默认按选项的 chatId 取键；历史页的选项自己带 `id`（已是对话键），传 keyOf 取它。
 */
export function filterPickerRows<T extends object>(
  rows: readonly T[],
  keyOf: (row: T) => string = (row) => chatVisibilityKey((row as any)?.chatId ?? null),
): T[] {
  return filterByHidden(rows, readHiddenFor('picker'), keyOf);
}
