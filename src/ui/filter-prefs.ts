/**
 * 统计页 / 历史记录页筛选状态的持久化（时间维度、模型、对话、接入类型、API 密钥）。
 *
 * 为什么放 localStorage 而不是 settings：与 `chart-prefs.ts`、`aus_forecast_prefs_v1`
 * 同一定位——纯展示偏好，不进导出、不参与 WebDAV 同步、不污染 `extensionSettings`。
 * 读写全部包在 try/catch 内，宿主禁用存储或隐私模式时静默退化为内存态，
 * 页面行为退回到「每次打开都是默认筛选」，不影响功能可用性。
 *
 * 只做「整段读、按分片合并写」：stats 与 history 各自一片，
 * 这样改统计页筛选不会覆盖历史页已保存的筛选。
 */
export const FILTER_PREFS_KEY = 'aus_filter_prefs_v1';

export type StatsRangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom' | 'all';

export const STATS_RANGE_KEYS: readonly StatsRangeKey[] = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'month',
  'lastMonth',
  'custom',
  'all',
];

export type StatsFilterPrefs = {
  /** 时间维度（全部/今天/…/自定义） */
  range: StatsRangeKey;
  /** 自定义时间维度的起止日期，YYYY-MM-DD（空串表示未填写） */
  customStart: string;
  customEnd: string;
  /** 选中的模型列表，空数组表示全部 */
  models: string[];
  chat: string;
  endpoint: string;
  credential: string;
};

export type HistoryFilterPrefs = {
  model: string;
  chat: string;
  endpoint: string;
  credential: string;
};

export type FilterPrefs = {
  stats: Partial<StatsFilterPrefs>;
  history: Partial<HistoryFilterPrefs>;
};

export type FilterPrefsPatch = {
  stats?: Partial<StatsFilterPrefs>;
  history?: Partial<HistoryFilterPrefs>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_KEYS = ['model', 'chat', 'endpoint', 'credential'] as const;

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storage(): Storage | null {
  try {
    const store = (globalThis as any).localStorage;
    return store && typeof store.getItem === 'function' && typeof store.setItem === 'function' ? store as Storage : null;
  } catch {
    return null;
  }
}

/** 时间维度白名单校验；非法值返回 undefined（调用方保留默认值） */
export function normalizeRange(value: unknown): StatsRangeKey | undefined {
  return typeof value === 'string' && (STATS_RANGE_KEYS as readonly string[]).includes(value)
    ? value as StatsRangeKey
    : undefined;
}

/** 自定义日期校验：空串合法（未填写），非空必须 YYYY-MM-DD */
export function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === '') return '';
  return DATE_RE.test(value) ? value : undefined;
}

function normalizeText(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function normalizeModels(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export function normalizeStatsPrefs(value: unknown): Partial<StatsFilterPrefs> {
  const out: Partial<StatsFilterPrefs> = {};
  if (!isPlainObject(value)) return out;
  const range = normalizeRange(value.range);
  if (range) out.range = range;
  const start = normalizeDate(value.customStart);
  if (start !== undefined) out.customStart = start;
  const end = normalizeDate(value.customEnd);
  if (end !== undefined) out.customEnd = end;
  const models = normalizeModels(value.models);
  if (models) out.models = models;
  const chat = normalizeText(value.chat);
  if (chat) out.chat = chat;
  const endpoint = normalizeText(value.endpoint);
  if (endpoint) out.endpoint = endpoint;
  const credential = normalizeText(value.credential);
  if (credential) out.credential = credential;
  return out;
}

export function normalizeHistoryPrefs(value: unknown): Partial<HistoryFilterPrefs> {
  const out: Partial<HistoryFilterPrefs> = {};
  if (!isPlainObject(value)) return out;
  for (const key of HISTORY_KEYS) {
    const text = normalizeText(value[key]);
    if (text) out[key] = text;
  }
  return out;
}

/** 读取全部筛选偏好；损坏数据或不可用存储统一回退为空对象（调用方按默认值处理） */
export function readFilterPrefs(): FilterPrefs {
  const store = storage();
  if (store) {
    try {
      const raw = store.getItem(FILTER_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPlainObject(parsed)) {
          return {
            stats: normalizeStatsPrefs(parsed.stats),
            history: normalizeHistoryPrefs(parsed.history),
          };
        }
      }
    } catch {}
  }
  return { stats: {}, history: {} };
}

/** 按分片合并写入（只覆盖 patch 里出现的字段与分片，其余保持不变；内容无变化时跳过写入） */
export function writeFilterPrefs(patch: FilterPrefsPatch): void {
  const store = storage();
  if (!store) return;
  try {
    const raw = store.getItem(FILTER_PREFS_KEY);
    const current = readFilterPrefs();
    const next: FilterPrefs = {
      stats: { ...current.stats, ...normalizeStatsPrefs(patch.stats) },
      history: { ...current.history, ...normalizeHistoryPrefs(patch.history) },
    };
    const serialized = JSON.stringify(next);
    if (raw === serialized) return;
    store.setItem(FILTER_PREFS_KEY, serialized);
  } catch {}
}
