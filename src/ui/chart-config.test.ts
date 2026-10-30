import { afterEach, describe, expect, it } from 'vitest';
import {
  aggregateForChart,
  getYValue,
  getChartType,
  setChartType,
  DEFAULT_Y_KEYS,
  Y_OPTIONS,
  TOKEN_SERIES_COLORS,
  tokenStackDrawOrder,
  sortTooltipParams,
} from './chart-config';

const entry = (over: any = {}) => ({
  timestamp: new Date(2026, 0, 1, 12, 0, 0).getTime(),
  model: 'm',
  prompt_tokens: 100,
  cache_hit_tokens: 60,
  cache_miss_tokens: 40,
  completion_tokens: 20,
  total_tokens: 120,
  input_cost: 0.01,
  output_cost: 0.02,
  cost: 0.03,
  cache_hit_rate: 60,
  duration: 2000,
  ttft: 500,
  tokenRate: 40,
  thinkTokens: 5,
  isTruncated: false,
  ...over,
});

afterEach(() => setChartType('auto'));

describe('自定义图表聚合', () => {
  it('round 维度按单条记录返回', () => {
    const es = [entry(), entry({ total_tokens: 80, cost: 0.01 })];
    const { labels, series } = aggregateForChart(es, ['total_token', 'total_cost'], 'round');
    expect(labels).toEqual(['#1', '#2']);
    expect(series[0].data).toEqual([120, 80]);
    expect(series[1].data).toEqual([0.03, 0.01]);
  });

  it('按日聚合 token/费用求和，请求数计数', () => {
    const es = [entry(), entry(), entry({ total_tokens: 30, cost: 0.01 })];
    const { labels, series } = aggregateForChart(es, ['total_token', 'total_cost', 'request_count'], 'day');
    expect(labels).toHaveLength(1);
    expect(series[0].data[0]).toBe(270);
    expect(series[1].data[0]).toBe(0.07);
    expect(series[2].data[0]).toBe(3);
  });

  it('命中率按桶内 token 加权，而不是百分比平均', () => {
    const es = [
      entry({ cache_hit_tokens: 90, cache_miss_tokens: 10 }),
      entry({ cache_hit_tokens: 10, cache_miss_tokens: 90 }),
    ];
    const { series } = aggregateForChart(es, ['hit_rate'], 'day');
    expect(series[0].data[0]).toBe(50);
  });

  it('平均耗时忽略 0/空值', () => {
    const es = [entry({ duration: 2000 }), entry({ duration: 0 }), entry({ duration: undefined })];
    const { series } = aggregateForChart(es, ['avg_duration'], 'day');
    expect(series[0].data[0]).toBe(2);
  });

  it('截断率按条数比例', () => {
    const es = [entry({ isTruncated: true }), entry(), entry(), entry()];
    const { series } = aggregateForChart(es, ['truncation_rate'], 'day');
    expect(series[0].data[0]).toBe(25);
  });

  it('单条比率返回 0-100', () => {
    expect(getYValue(entry({ cache_hit_tokens: 30, cache_miss_tokens: 70 }), 'hit_rate')).toBe(30);
    expect(getYValue(entry({ completion_tokens: 40, thinkTokens: 10 }), 'think_ratio')).toBe(25);
    expect(getYValue(entry({ isTruncated: true }), 'truncation_rate')).toBe(100);
    expect(getYValue(entry({ ttft: 1500 }), 'avg_ttft')).toBe(1.5);
  });

  it('展示方式状态可切换，非法值回退自动', () => {
    setChartType('area');
    expect(getChartType()).toBe('area');
    setChartType('xxx' as any);
    expect(getChartType()).toBe('auto');
  });

  it('默认 Y 只包含已定义维度', () => {
    const keys = new Set(Y_OPTIONS.map(o => o.key));
    for (const k of DEFAULT_Y_KEYS) expect(keys.has(k)).toBe(true);
  });

  it('悬浮窗标题带完整日期时间（轮次维度取记录时间）', () => {
    const es = [
      entry({ timestamp: new Date(2026, 9, 23, 19, 12, 33).getTime() }),
      entry({ timestamp: new Date(2026, 9, 23, 19, 20, 5).getTime() }),
    ];
    const { tips } = aggregateForChart(es, ['total_token'], 'round');
    expect(tips[0]).toBe('#1 · 2026-10-23 19:12:33');
    expect(tips[1]).toBe('#2 · 2026-10-23 19:20:05');
  });

  it('悬浮窗标题带完整日期时间（分桶维度带日期，不只有月日）', () => {
    const es = [
      entry({ timestamp: new Date(2026, 9, 23, 14, 5, 0).getTime() }),
      entry({ timestamp: new Date(2026, 9, 23, 14, 40, 0).getTime() }),
    ];
    const byHour = aggregateForChart(es, ['total_token'], 'hour');
    expect(byHour.tips[0]).toContain('2026-10-23');
    expect(byHour.tips[0]).toContain('14:00–15:00');
    const byDay = aggregateForChart(es, ['total_token'], 'day');
    expect(byDay.tips[0]).toContain('2026-10-23');
    expect(byDay.tips).toHaveLength(byDay.labels.length);
  });

  it('Token 三段配色取自设计稿的三档蓝', () => {
    expect(TOKEN_SERIES_COLORS).toEqual({ hit: '#A0DCFD', miss: '#60B3FE', output: '#0C70F3' });
    const byKey = new Map(Y_OPTIONS.map(o => [o.key, o.color]));
    expect(byKey.get('input_hit_token')).toBe(TOKEN_SERIES_COLORS.hit);
    expect(byKey.get('input_miss_token')).toBe(TOKEN_SERIES_COLORS.miss);
    expect(byKey.get('output_token')).toBe(TOKEN_SERIES_COLORS.output);
  });

  it('堆叠绘制顺序：输出压底、命中最浅置顶，其余系列位置不变', () => {
    const series = [
      { key: 'input_hit_token', name: 'hit' },
      { key: 'input_miss_token', name: 'miss' },
      { key: 'total_cost', name: 'cost' },
      { key: 'output_token', name: 'out' },
    ];
    const ordered = tokenStackDrawOrder(series).map(s => s.key);
    // 三个 Token 槽位（0/1/3）重排为 输出 → 未命中 → 命中，费用系列保持在第 3 位
    expect(ordered).toEqual(['output_token', 'input_miss_token', 'total_cost', 'input_hit_token']);
    // 不修改入参
    expect(series.map(s => s.key)).toEqual(['input_hit_token', 'input_miss_token', 'total_cost', 'output_token']);
  });

  it('堆叠绘制顺序：不足两段时原样返回', () => {
    const onlyOne = [{ key: 'output_token', name: 'out' }];
    expect(tokenStackDrawOrder(onlyOne)).toBe(onlyOne);
    const others = [{ key: 'total_cost', name: 'cost' }, { key: 'hit_rate', name: 'rate' }];
    expect(tokenStackDrawOrder(others)).toEqual(others);
  });

  it('悬浮窗条目按 Y 选项顺序排列（命中 → 未命中 → 输出 → 费用）', () => {
    const params = [
      { seriesName: '输出 token', value: 3 },
      { seriesName: '总费用', value: 4 },
      { seriesName: '输入(未命中) token', value: 2 },
      { seriesName: '输入(命中) token', value: 1 },
    ];
    expect(sortTooltipParams(params).map(p => p.seriesName)).toEqual([
      '输入(命中) token',
      '输入(未命中) token',
      '输出 token',
      '总费用',
    ]);
    // 不改动原数组
    expect(params[0].seriesName).toBe('输出 token');
  });
});
