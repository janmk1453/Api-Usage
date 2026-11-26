/*!
 * 模型显隐偏好（纯展示偏好，localStorage）。
 *
 * 与 `chat-visibility.ts` 同构：不进 `settings`、不参与导出与 WebDAV 同步，也不改变任何
 * 统计口径——隐藏只是让某个模型不出现在某个展示位置，历史记录、统计合计、趋势预测、
 * 能耗评分仍按全量历史计算。
 *
 * 两个互相独立的隐藏集合：
 * - `hidden`：统计页「模型汇总」表格里不列出该模型；
 * - `hiddenPickers`：统计页 / 历史页 / 趋势预测页的「模型」下拉里不列出该模型
 *   （胶囊只是少一个可选项，已选中的模型仍照旧参与计算）。
 *
 * 存储形态：`{ hidden: string[], hiddenPickers: string[] }`，元素是「模型键」——
 * `modelVisibilityKey` 对模型名做 trim，空值统一落 `UNKNOWN_MODEL_KEY`，与统计页模型
 * 汇总里 `model || 'unknown'` 的分组口径一致，这样没有模型名的旧记录也能被单独隐藏。
 * 旧版只有 `{ hidden }` 的数据照常读取，缺的集合视为空。
 *
 * 读写全部包 try/catch：宿主禁用存储或隐私模式下静默退化为内存态
 * （本次会话有效，刷新后回到全部显示），不影响功能可用性。
 */
export const MODEL_VISIBILITY_KEY = 'aus_model_visibility_v1';

/** 空模型名（旧数据/未识别）在统计里共用的键，与统计页模型汇总的 `model || 'unknown'` 一致 */
export const UNKNOWN_MODEL_KEY = 'unknown';

/** 隐藏生效的位置：统计页「模型汇总」表 / 各页「模型」下拉 */
export type ModelVisibilityTarget = 'table' | 'picker';

export type ModelVisibilityPrefs = {
  /** 被隐藏的模型键列表（见 modelVisibilityKey）：不出现在「模型汇总」表 */
  hidden: string[];
  /** 被隐藏的模型键列表：不出现在各页「模型」下拉 */
  hiddenPickers: string[];
};

/** 模型名 → 存储键：trim 后为空统一落到 UNKNOWN_MODEL_KEY */
export function modelVisibilityKey(model: unknown): string {
  const text = typeof model === 'string' ? model.trim() : String(model ?? '').trim();
  return text || UNKNOWN_MODEL_KEY;
}

/** 校验并去重：只保留非空字符串，非法输入一律丢弃 */
export function normalizeHiddenModels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const key = item.trim();
    if (!key) continue;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/** 校验整份偏好：缺字段、脏字段一律回落为空数组（兼容旧版只有 hidden 的数据） */
export function normalizeModelPrefs(value: unknown): ModelVisibilityPrefs {
  const raw = (value ?? {}) as any;
  return {
    hidden: normalizeHiddenModels(raw.hidden),
    hiddenPickers: normalizeHiddenModels(raw.hiddenPickers),
  };
}

function storage(): Storage | null {
  try {
    const store = (globalThis as any).localStorage;
    if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return null;
    // 探针：隐私模式/宿主禁用存储时 getItem 会直接抛错，这里先试读一次，
    // 抛错就整体退回内存态，避免「写失败但读也不报错」导致开关看似无效。
    store.getItem(MODEL_VISIBILITY_KEY);
    return store as Storage;
  } catch {
    return null;
  }
}

/** 内存态兜底（localStorage 不可用时本次会话仍可切换） */
let memoryPrefs: ModelVisibilityPrefs | null = null;

/** 读取整份偏好（每次返回新对象，调用方可安全修改） */
export function readModelPrefs(): ModelVisibilityPrefs {
  const store = storage();
  if (!store) return normalizeModelPrefs(memoryPrefs ?? {});
  try {
    const raw = store.getItem(MODEL_VISIBILITY_KEY);
    if (!raw) return { hidden: [], hiddenPickers: [] };
    return normalizeModelPrefs(JSON.parse(raw));
  } catch {
    return { hidden: [], hiddenPickers: [] };
  }
}

function writeModelPrefs(prefs: ModelVisibilityPrefs): void {
  const clean = normalizeModelPrefs(prefs);
  memoryPrefs = clean;
  const store = storage();
  if (!store) return;
  try {
    store.setItem(MODEL_VISIBILITY_KEY, JSON.stringify(clean satisfies ModelVisibilityPrefs));
  } catch {}
}

function listOf(prefs: ModelVisibilityPrefs, target: ModelVisibilityTarget): string[] {
  return target === 'picker' ? prefs.hiddenPickers : prefs.hidden;
}

function writeList(target: ModelVisibilityTarget, keys: string[]): void {
  const prefs = readModelPrefs();
  if (target === 'picker') prefs.hiddenPickers = normalizeHiddenModels(keys);
  else prefs.hidden = normalizeHiddenModels(keys);
  writeModelPrefs(prefs);
}

/** 读取某个展示位置的隐藏键列表（只读副本） */
export function readHiddenModelsFor(target: ModelVisibilityTarget): string[] {
  return listOf(readModelPrefs(), target).slice();
}

/** 统计页「模型汇总」表的隐藏键列表 */
export function readHiddenModels(): string[] {
  return readHiddenModelsFor('table');
}

/** 各页「模型」下拉的隐藏键列表 */
export function readHiddenPickerModels(): string[] {
  return readHiddenModelsFor('picker');
}

/** 该模型在该位置是否被隐藏（入参是存储键） */
export function isModelHiddenFor(target: ModelVisibilityTarget, key: string): boolean {
  return listOf(readModelPrefs(), target).includes(key);
}

/** 设置某个模型键在某位置的显隐 */
export function setModelHiddenFor(target: ModelVisibilityTarget, key: string, hidden: boolean): void {
  if (!key) return;
  const current = readHiddenModelsFor(target);
  const has = current.includes(key);
  if (hidden === has) return;
  writeList(target, hidden ? current.concat(key) : current.filter((k) => k !== key));
}

/** 一次写入多个键的显隐（「全部隐藏 / 全部显示」用，避免逐条读写存储） */
export function setAllModelsHiddenFor(target: ModelVisibilityTarget, keys: readonly string[], hidden: boolean): void {
  const clean = normalizeHiddenModels(keys);
  const current = readHiddenModelsFor(target);
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
export function clearHiddenModelsFor(target: ModelVisibilityTarget): void {
  writeList(target, []);
}

/** 某个展示位置的隐藏条目数（可能包含已不存在的模型键，故仅用于徽标提示） */
export function hiddenModelCountFor(target: ModelVisibilityTarget): number {
  return readHiddenModelsFor(target).length;
}

function filterByHidden<T>(rows: readonly T[], hidden: readonly string[], keyOf: (row: T) => string): T[] {
  if (!hidden.length) return rows.slice();
  const set = new Set(hidden);
  return rows.filter((row) => !set.has(keyOf(row)));
}

/** 行 → 模型键的默认取值：认 `model` 字段，字符串行直接当模型名 */
function defaultModelKey(row: any): string {
  return modelVisibilityKey(row && typeof row === 'object' && 'model' in row ? row.model : row);
}

/**
 * 过滤出应当出现在统计页「模型汇总」表里的行（纯函数，按入参顺序、不改变排序）。
 * 传 keyOf 便于测试与复用；默认按行的 `model` 字段取键（汇总行是 `m`，调用方自行传）。
 */
export function filterVisibleModelRows<T>(rows: readonly T[], keyOf: (row: T) => string = defaultModelKey): T[] {
  return filterByHidden(rows, readHiddenModelsFor('table'), keyOf);
}

/**
 * 过滤出应当出现在各页「模型」下拉里的选项（纯函数，按入参顺序）。
 * 默认按选项的 `model` 字段取键；统计页下拉传的是字符串数组，历史页选项传 `(o) => o.id`。
 */
export function filterModelPickerRows<T>(rows: readonly T[], keyOf: (row: T) => string = defaultModelKey): T[] {
  return filterByHidden(rows, readHiddenModelsFor('picker'), keyOf);
}