import { describe, expect, it } from 'vitest';
import { esc, isPeakHour, isUnsafeKey, isWeekendDay, localDay } from './date';

function timestampForDayType(weekend: boolean, hour: number, minute = 0): number {
  let timestamp = new Date(2026, 8, 7, hour, minute, 0, 0).getTime();
  while (isWeekendDay(timestamp) !== weekend) timestamp += 24 * 60 * 60 * 1000;
  return timestamp;
}

describe('日期与峰谷工具', () => {
  it('区分工作日、周末和无效输入', () => {
    expect(isWeekendDay(timestampForDayType(false, 10))).toBe(false);
    expect(isWeekendDay(timestampForDayType(true, 10))).toBe(true);
    expect(isWeekendDay(null)).toBe(false);
  });

  it('普通峰段按开始包含、结束不包含判断', () => {
    const hours = [{ start: '09:00', end: '12:00' }];
    expect(isPeakHour(timestampForDayType(false, 9), hours)).toBe(true);
    expect(isPeakHour(timestampForDayType(false, 11, 59), hours)).toBe(true);
    expect(isPeakHour(timestampForDayType(false, 12), hours)).toBe(false);
  });

  it('支持跨天峰段且周末始终豁免', () => {
    const hours = [{ start: '22:00', end: '02:00' }];
    expect(isPeakHour(timestampForDayType(false, 23), hours)).toBe(true);
    expect(isPeakHour(timestampForDayType(false, 1), hours)).toBe(true);
    expect(isPeakHour(timestampForDayType(false, 12), hours)).toBe(false);
    expect(isPeakHour(timestampForDayType(true, 23), hours)).toBe(false);
  });

  it('按本地日期格式化并处理 HTML 转义', () => {
    expect(localDay(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02');
    expect(esc('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('识别危险对象键', () => {
    expect(isUnsafeKey('__proto__')).toBe(true);
    expect(isUnsafeKey('constructor')).toBe(true);
    expect(isUnsafeKey('prototype')).toBe(true);
    expect(isUnsafeKey('normal')).toBe(false);
  });
});
