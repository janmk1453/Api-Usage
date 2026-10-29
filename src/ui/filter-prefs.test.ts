import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FILTER_PREFS_KEY,
  normalizeDate,
  normalizeHistoryPrefs,
  normalizeRange,
  normalizeStatsPrefs,
  readFilterPrefs,
  writeFilterPrefs,
} from './filter-prefs';

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

describe('filter-prefs 筛选状态持久化', () => {
  it('空存储读出空分片，不抛错', () => {
    expect(readFilterPrefs()).toEqual({ stats: {}, history: {} });
  });

  it('统计页五维筛选写入后可原样读回', () => {
    const stats = {
      range: 'all' as const,
      customStart: '2026-01-01',
      customEnd: '2026-02-01',
      models: ['deepseek-v4-pro', 'deepseek-flash'],
      chat: '__all__',
      endpoint: 'https://api.deepseek.com',
      credential: 'secret-1',
    };
    writeFilterPrefs({ stats });
    expect(readFilterPrefs().stats).toEqual(stats);
  });

  it('分片合并：写历史页不清掉统计页，反之亦然', () => {
    writeFilterPrefs({ stats: { range: 'all', models: [] } });
    writeFilterPrefs({ history: { model: 'deepseek-flash', chat: '__null__' } });
    const prefs = readFilterPrefs();
    expect(prefs.stats.range).toBe('all');
    expect(prefs.stats.models).toEqual([]);
    expect(prefs.history).toEqual({ model: 'deepseek-flash', chat: '__null__' });
    writeFilterPrefs({ stats: { range: '7d' } });
    expect(readFilterPrefs().history.model).toBe('deepseek-flash');
    expect(readFilterPrefs().stats.range).toBe('7d');
  });

  it('时间维度白名单：非法值丢弃并保留默认，合法值原样通过', () => {
    expect(normalizeRange('all')).toBe('all');
    expect(normalizeRange('lastMonth')).toBe('lastMonth');
    expect(normalizeRange('90d')).toBeUndefined();
    expect(normalizeRange(30)).toBeUndefined();
    expect(normalizeStatsPrefs({ range: '90d', chat: '__all__' })).toEqual({ chat: '__all__' });
  });

  it('自定义日期只接受 YYYY-MM-DD 或空串', () => {
    expect(normalizeDate('2026-10-23')).toBe('2026-10-23');
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate('2026-1-5')).toBeUndefined();
    expect(normalizeDate('2026/10/23')).toBeUndefined();
    expect(normalizeDate(20261023)).toBeUndefined();
  });

  it('模型列表去重且剔除非法项，保留空数组语义（全部）', () => {
    expect(normalizeStatsPrefs({ models: ['a', 'a', 'b', '', 3 as any] }).models).toEqual(['a', 'b']);
    expect(normalizeStatsPrefs({ models: [] }).models).toEqual([]);
    expect(normalizeStatsPrefs({ models: 'a' }).models).toBeUndefined();
  });

  it('损坏 JSON 与不可用存储静默降级为空分片', () => {
    store.setItem(FILTER_PREFS_KEY, '{"stats":{');
    expect(readFilterPrefs()).toEqual({ stats: {}, history: {} });
    delete (globalThis as any).localStorage;
    expect(readFilterPrefs()).toEqual({ stats: {}, history: {} });
    expect(() => writeFilterPrefs({ stats: { range: 'all' } })).not.toThrow();
  });

  it('历史页四维筛选走同样的文本字段校验', () => {
    expect(normalizeHistoryPrefs({ model: 'm', chat: '', endpoint: 5 as any, credential: 'c' }))
      .toEqual({ model: 'm', credential: 'c' });
    expect(normalizeHistoryPrefs(null)).toEqual({});
  });

  it('内容无变化时不重写存储', () => {
    writeFilterPrefs({ stats: { range: 'all' } });
    const first = store.dump()[FILTER_PREFS_KEY];
    const rawSpy: string[] = [];
    const originalSet = store.setItem;
    (globalThis as any).localStorage = {
      ...store,
      setItem: (key: string, value: string) => { rawSpy.push(value); originalSet(key, value); },
    };
    writeFilterPrefs({ stats: { range: 'all' } });
    expect(rawSpy).toHaveLength(0);
    writeFilterPrefs({ stats: { range: '7d' } });
    expect(rawSpy).toHaveLength(1);
    expect(store.dump()[FILTER_PREFS_KEY]).not.toBe(first);
  });
});
