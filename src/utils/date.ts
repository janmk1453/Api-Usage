// 迁移自 DeepSeek使用预测.js:16-23 - 已改为本地时区（原 UTC+8 硬编码）
export function isWeekendDay(timestamp: number | Date | unknown): boolean {
  const t =
    typeof timestamp === 'number'
      ? timestamp
      : timestamp && (timestamp as Date).getTime
        ? (timestamp as Date).getTime()
        : 0;
  const day = new Date(t).getDay();
  return day === 6 || day === 0;
}

export function isPeakHour(timestamp: number, peakHours: Array<{ start: string; end: string }>): boolean {
  if (isWeekendDay(timestamp)) return false;
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
