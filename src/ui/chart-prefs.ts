/**
 * 用量统计页图表配置的持久化（Y 轴多选、X 轴维度、展示方式、轴标签、占比模式）。
 *
 * 为什么放 localStorage 而不是 settings：这些是纯展示偏好，
 * 与趋势预测的 aus_forecast_prefs_v1 同一定位——不进导出、不参与 WebDAV 同步、
 * 不污染 `extensionSettings`。读写全部包在 try/catch 内，
 * 宿主禁用存储或隐私模式时静默退化为内存态，不影响图表本身。
 *
 * 只做「整段读、按块合并写」：main 是自定义图表，extra 按图表 id 分片，
 * 这样改其中一张图不会覆盖另一张图已保存的配置。
 */
export const CHART_PREFS_KEY = 'aus_stats_chart_prefs_v1';

export type ChartPrefsSection = Record<string, unknown>;
export type ChartPrefsExtra = Record<string, ChartPrefsSection>;

export type ChartPrefsPatch = {
  main?: ChartPrefsSection;
  extra?: ChartPrefsExtra;
  pie?: ChartPrefsSection;
};

export type ChartPrefs = {
  main: ChartPrefsSection;
  extra: ChartPrefsExtra;
  pie: ChartPrefsSection;
};

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

function normalizeExtra(value: unknown): ChartPrefsExtra {
  const out: ChartPrefsExtra = {};
  if (!isPlainObject(value)) return out;
  for (const [id, section] of Object.entries(value)) {
    if (isPlainObject(section)) out[id] = section;
  }
  return out;
}

/** 读取全部图表配置；损坏数据或不可用存储统一回退为空对象（调用方按默认值处理） */
export function readChartPrefs(): ChartPrefs {
  const store = storage();
  if (store) {
    try {
      const raw = store.getItem(CHART_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPlainObject(parsed)) {
          return {
            main: isPlainObject(parsed.main) ? parsed.main : {},
            extra: normalizeExtra(parsed.extra),
            pie: isPlainObject(parsed.pie) ? parsed.pie : {},
          };
        }
      }
    } catch {}
  }
  return { main: {}, extra: {}, pie: {} };
}

/** 按块合并写入（只覆盖 patch 里出现的字段与图表，其余保持不变） */
export function writeChartPrefs(patch: ChartPrefsPatch): void {
  const store = storage();
  if (!store) return;
  try {
    const current = readChartPrefs();
    const next: ChartPrefs = {
      main: { ...current.main, ...(patch.main || {}) },
      extra: { ...current.extra },
      pie: { ...current.pie, ...(patch.pie || {}) },
    };
    for (const [id, section] of Object.entries(patch.extra || {})) {
      if (!isPlainObject(section)) continue;
      next.extra[id] = { ...(next.extra[id] || {}), ...section };
    }
    store.setItem(CHART_PREFS_KEY, JSON.stringify(next));
  } catch {}
}
