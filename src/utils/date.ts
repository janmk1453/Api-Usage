import { isChinaHolidayDate } from '../constants/holidays';

// 迁移自 DeepSeek使用预测.js:16-23 - 已改为本地时区（原 UTC+8 硬编码）
function toTimestamp(timestamp: number | Date | unknown): number | null {
  if (typeof timestamp === 'number') return Number.isFinite(timestamp) ? timestamp : null;
  if (timestamp && (timestamp as Date).getTime) return (timestamp as Date).getTime();
  return null;
}

export function isWeekendDay(timestamp: number | Date | unknown): boolean {
  const t = toTimestamp(timestamp);
  if (t === null) return false;
  const day = new Date(t).getDay();
  return day === 6 || day === 0;
}

// 中国法定节假日（放假安排，按本地日期判断；超出内置数据年份时返回 false）
export function isChinaHoliday(timestamp: number | Date | unknown): boolean {
  const t = toTimestamp(timestamp);
  if (t === null) return false;
  return isChinaHolidayDate(localDay(t));
}

// 用户补充的额外空闲日期（YYYY-MM-DD，按本地日期判断）
export function isExtraOffDay(timestamp: number | Date | unknown, extraOffDays?: string[] | null): boolean {
  if (!extraOffDays || !extraOffDays.length) return false;
  const t = toTimestamp(timestamp);
  if (t === null) return false;
  const day = localDay(t);
  return extraOffDays.indexOf(day) !== -1;
}

// DeepSeek 官方规则下「全天按空闲计费」的日期：周末 + 中国法定节假日 + 用户补充日期
export function isOffpeakDay(timestamp: number | Date | unknown, extraOffDays?: string[] | null): boolean {
  return isWeekendDay(timestamp) || isChinaHoliday(timestamp) || isExtraOffDay(timestamp, extraOffDays);
}

export function isPeakHour(
  timestamp: number,
  peakHours: Array<{ start: string; end: string }>,
  extraOffDays?: string[] | null,
): boolean {
  if (isOffpeakDay(timestamp, extraOffDays)) return false;
  const d = new Date(timestamp);
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  for (const h of peakHours) {
    if (!h || !h.start || !h.end) continue;
    const p = h.start.split(':');
    const q = h.end.split(':');
    const sp = parseInt(p[0]) * 60 + parseInt(p[1] || '0');
    const ep = parseInt(q[0]) * 60 + parseInt(q[1] || '0');
    if (sp < ep) {
      if (totalMinutes >= sp && totalMinutes < ep) return true;
    } else if (totalMinutes >= sp || totalMinutes < ep) {
      return true;
    }
  }
  return false;
}

// 校验 YYYY-MM-DD 形式的日期键（用于设置中的额外空闲日期）
export function isValidDayKey(key: unknown): key is string {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const parts = key.split('-').map((item) => parseInt(item, 10));
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export function localDay(ts: number | Date): string {
  const t = typeof ts === 'number' ? ts : ts.getTime();
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export function localTimeHM(ts: number | Date): string {
  const t = typeof ts === 'number' ? ts : ts.getTime();
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isUnsafeKey(k: string): boolean {
  return k === '__proto__' || k === 'constructor' || k === 'prototype';
}
