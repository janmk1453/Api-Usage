import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CHART_PREFS_KEY, readChartPrefs, writeChartPrefs } from './chart-prefs';

/** node 环境没有 localStorage，这里用内存实现模拟同一套 getItem/setItem 语义 */
function makeStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed || {}));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
    dump: () => Object.fromEntries(map),
  };
}

let store: ReturnType<typeof makeStorage>;

beforeEach(() => {
  store = makeStorage();
  (globalThis as any).localStorage = store;
});

afterEach(() => {
  delete (globalThis as any).localStorage;
});

describe('chart-prefs 图表配置持久化', () => {
  it('空存储读出空结构，不抛错', () => {
    expect(readChartPrefs()).toEqual({ main: {}, extra: {}, pie: {} });
  });

  it('写入后可原样读回', () => {
    writeChartPrefs({ main: { y: ['total_cost'], x: 'day', type: 'bar', axisLabel: 'hide' } });
    expect(readChartPrefs().main).toEqual({ y: ['total_cost'], x: 'day', type: 'bar', axisLabel: 'hide' });
  });

  it('分块合并：改 main 不清掉 extra 与 pie', () => {
    writeChartPrefs({ extra: { token: { y: ['output_token'], x: 'week' } } });
    writeChartPrefs({ pie: { mode: 'count' } });
    writeChartPrefs({ main: { x: 'month' } });
    const prefs = readChartPrefs();
    expect(prefs.main).toEqual({ x: 'month' });
    expect(prefs.extra.token).toEqual({ y: ['output_token'], x: 'week' });
    expect(prefs.pie).toEqual({ mode: 'count' });
  });

  it('同一图表二次写入是覆盖合并，其他图表分片不受影响', () => {
    writeChartPrefs({ extra: { token: { y: ['output_token'], x: 'week' }, cost: { y: ['total_cost'], x: 'day' } } });
    writeChartPrefs({ extra: { token: { x: 'hour' } } });
    const prefs = readChartPrefs();
    expect(prefs.extra.token).toEqual({ y: ['output_token'], x: 'hour' });
    expect(prefs.extra.cost).toEqual({ y: ['total_cost'], x: 'day' });
  });

  it('损坏的 JSON 与非法分片不会抛出，读成空结构', () => {
    store.setItem(CHART_PREFS_KEY, '{not json');
    expect(readChartPrefs()).toEqual({ main: {}, extra: {}, pie: {} });
    store.setItem(CHART_PREFS_KEY, JSON.stringify({ main: 'x', extra: { bad: 1, ok: { x: 'day' } }, pie: [] }));
    expect(readChartPrefs()).toEqual({ main: {}, extra: { ok: { x: 'day' } }, pie: {} });
  });

  it('没有 localStorage 时读写都静默跳过', () => {
    delete (globalThis as any).localStorage;
    expect(() => writeChartPrefs({ main: { x: 'day' } })).not.toThrow();
    expect(readChartPrefs()).toEqual({ main: {}, extra: {}, pie: {} });
  });
});

describe('chart-config 与持久化的联动', () => {
  it('导入时按已保存配置恢复 Y/X/展示方式/轴标签', async () => {
    store.setItem(CHART_PREFS_KEY, JSON.stringify({
      main: { y: ['output_token', 'hit_rate'], x: 'week', type: 'area', axisLabel: 'all' },
    }));
    vi.resetModules();
    const cfg = await import('./chart-config');
    expect(cfg.getYSelected()).toEqual(['output_token', 'hit_rate']);
    expect(cfg.getXSelected()).toBe('week');
    expect(cfg.getChartType()).toBe('area');
    expect(cfg.getAxisLabelMode()).toBe('all');
  });

  it('非法配置项逐条忽略，未知 Y 键被丢弃', async () => {
    store.setItem(CHART_PREFS_KEY, JSON.stringify({
      main: { y: ['output_token', 'nope'], x: 'minute', type: 'pie', axisLabel: 'whatever' },
    }));
    vi.resetModules();
    const cfg = await import('./chart-config');
    expect(cfg.getYSelected()).toEqual(['output_token']);
    expect(cfg.getXSelected()).toBe(cfg.DEFAULT_X_KEY);
    expect(cfg.getChartType()).toBe(cfg.DEFAULT_CHART_TYPE);
    expect(cfg.getAxisLabelMode()).toBe(cfg.DEFAULT_AXIS_LABEL_MODE);
  });

  it('setter 改动立即落盘，下次导入沿用', async () => {
    vi.resetModules();
    const cfg = await import('./chart-config');
    cfg.setXSelected('month');
    cfg.setChartType('bar');
    cfg.setAxisLabelMode('hide');
    cfg.setYSelected(['total_cost', 'request_count']);
    const saved = readChartPrefs().main;
    expect(saved).toEqual({ y: ['total_cost', 'request_count'], x: 'month', type: 'bar', axisLabel: 'hide' });

    vi.resetModules();
    const again = await import('./chart-config');
    expect(again.getXSelected()).toBe('month');
    expect(again.getChartType()).toBe('bar');
    expect(again.getAxisLabelMode()).toBe('hide');
    expect(again.getYSelected()).toEqual(['total_cost', 'request_count']);
  });
});
