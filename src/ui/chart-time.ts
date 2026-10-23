/**
 * 图表悬浮窗（tooltip）时间口径（单一来源）
 *
 * 图表 X 轴为了不挤压绘图区，标签一律用短格式（10/23、14:00、2026-W43、#3）；
 * 悬浮窗必须给出完整的「日期 + 时间」，因此这里统一生成 tooltip 标题，
 * 各图表（统计首图、统计额外 6 图、趋势预测三图）只引用本模块，禁止各自拼字符串。
 */

export type ChartXKey = 'round' | 'hour' | 'day' | 'week' | 'month';

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const pad = (n: number) => String(n).padStart(2, '0');
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** 2026-10-23 */
export function chartDate(ts: number): string {
  const t = num(ts);
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 2026-10-23 周五 */
export function chartDateWeek(ts: number): string {
  const t = num(ts);
  if (!t) return '';
  return chartDate(t) + ' ' + WEEKDAY[new Date(t).getDay()];
}

/** 2026-10-23 19:12 */
export function chartDateTime(ts: number): string {
  const t = num(ts);
  if (!t) return '';
  const d = new Date(t);
  return chartDate(t) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/** 19:12:33 */
export function chartClock(ts: number): string {
  const t = num(ts);
  if (!t) return '';
  const d = new Date(t);
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

/** ISO 周键：2026-W43 */
export function isoWeekKey(ts: number): string {
  const t = num(ts);
  if (!t) return '';
  const d = new Date(t);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return tmp.getUTCFullYear() + '-W' + pad(weekNo);
}

/** 单条记录的悬浮标题：2026-10-23 19:12:33 */
export function entryTip(entry: any): string {
  const ts = num(entry?.timestamp);
  if (!ts) return '';
  return chartDate(ts) + ' ' + chartClock(ts);
}

/** 轮次图（X = 轮次）的悬浮标题：#3 · 2026-10-23 19:12:33 */
export function roundTip(round: number, timestamp: unknown): string {
  const head = '#' + (Number(round) || 1);
  const time = entryTip({ timestamp });
  return time ? head + ' · ' + time : head;
}

/**
 * 分桶图（X = 每小时/每日/每周/每月）的悬浮标题，带上日期与时间：
 * - 每小时：2026-10-23 周五 14:00–15:00
 * - 每日：2026-10-23 周五
 * - 每周：2026-10-19 周一 ~ 2026-10-25 周日（2026-W43）
 * - 每月：2026 年 10 月
 */
export function bucketTip(x: ChartXKey, firstTs: number, lastTs: number): string {
  const first = num(firstTs);
  if (!first) return '';
  const last = num(lastTs) || first;
  if (x === 'hour') {
    const d = new Date(first);
    const from = pad(d.getHours()) + ':00';
    const to = pad((d.getHours() + 1) % 24) + ':00';
    return chartDateWeek(first) + ' ' + from + '–' + to;
  }
  if (x === 'day') return chartDateWeek(first);
  if (x === 'week') {
    const from = chartDateWeek(first);
    const to = chartDateWeek(last);
    const week = isoWeekKey(first);
    return (from === to ? from : from + ' ~ ' + to) + (week ? '（' + week + '）' : '');
  }
  if (x === 'month') {
    const d = new Date(first);
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
  }
  return chartDate(first) + ' ' + chartClock(first);
}

/** 汇总类图表（如模型占比）的悬浮时间范围：2026-10-01 09:12 ~ 2026-10-23 19:20 */
export function rangeTip(entries: any[]): string {
  let min = 0;
  let max = 0;
  for (const e of entries || []) {
    const ts = num(e?.timestamp);
    if (!ts) continue;
    if (!min || ts < min) min = ts;
    if (!max || ts > max) max = ts;
  }
  if (!min) return '';
  if (min === max) return chartDateTime(min);
  return chartDateTime(min) + ' ~ ' + chartDateTime(max);
}
