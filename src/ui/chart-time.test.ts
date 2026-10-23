import { describe, expect, it } from 'vitest';
import {
  bucketTip,
  chartClock,
  chartDate,
  chartDateTime,
  chartDateWeek,
  entryTip,
  isoWeekKey,
  rangeTip,
  roundTip,
} from './chart-time';

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/** 用本地时间构造，测试结果与运行机器时区无关 */
const ts = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s).getTime();

describe('图表悬浮窗时间格式', () => {
  it('日期 / 日期+时分 / 时钟 / 日期+星期', () => {
    const t = ts(2026, 10, 23, 19, 12, 33);
    expect(chartDate(t)).toBe('2026-10-23');
    expect(chartDateTime(t)).toBe('2026-10-23 19:12');
    expect(chartClock(t)).toBe('19:12:33');
    expect(chartDateWeek(t)).toBe('2026-10-23 ' + WEEKDAY[new Date(t).getDay()]);
  });

  it('记录条目与轮次标题带完整日期时间', () => {
    const t = ts(2026, 10, 23, 19, 12, 33);
    expect(entryTip({ timestamp: t })).toBe('2026-10-23 19:12:33');
    expect(roundTip(3, t)).toBe('#3 · 2026-10-23 19:12:33');
    expect(roundTip(3, 0)).toBe('#3');
    expect(entryTip({})).toBe('');
  });

  it('每小时桶给出整点区间', () => {
    const t = ts(2026, 10, 23, 14, 5, 0);
    expect(bucketTip('hour', t, t + 60000)).toBe('2026-10-23 ' + WEEKDAY[new Date(t).getDay()] + ' 14:00–15:00');
  });

  it('每日桶给出日期与星期', () => {
    const t = ts(2026, 10, 23, 9, 0, 0);
    expect(bucketTip('day', t, ts(2026, 10, 23, 22, 30, 0))).toBe('2026-10-23 ' + WEEKDAY[new Date(t).getDay()]);
  });

  it('每周桶给出一周区间的日期与 ISO 周号', () => {
    const monday = ts(2026, 10, 19, 9, 0, 0);
    const sunday = ts(2026, 10, 25, 21, 0, 0);
    const tip = bucketTip('week', monday, sunday);
    expect(tip).toBe('2026-10-19 ' + WEEKDAY[1] + ' ~ 2026-10-25 ' + WEEKDAY[0] + '（' + isoWeekKey(monday) + '）');
  });

  it('每月桶给出年月', () => {
    const t = ts(2026, 3, 8, 10, 0, 0);
    expect(bucketTip('month', t, ts(2026, 3, 30, 10, 0, 0))).toBe('2026 年 3 月');
  });

  it('缺少时间戳时不产生假标题', () => {
    expect(bucketTip('day', 0, 0)).toBe('');
    expect(bucketTip('hour', NaN, NaN)).toBe('');
  });

  it('范围标题取首末时间', () => {
    const a = ts(2026, 10, 1, 9, 12, 0);
    const b = ts(2026, 10, 23, 19, 20, 0);
    expect(rangeTip([{ timestamp: b }, { timestamp: a }])).toBe('2026-10-01 09:12 ~ 2026-10-23 19:20');
    expect(rangeTip([{ timestamp: a }])).toBe('2026-10-01 09:12');
    expect(rangeTip([])).toBe('');
  });
});
