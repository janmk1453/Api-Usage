import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MODEL_VISIBILITY_KEY,
  UNKNOWN_MODEL_KEY,
  clearHiddenModelsFor,
  filterModelPickerRows,
  filterVisibleModelRows,
  hiddenModelCountFor,
  isModelHiddenFor,
  modelVisibilityKey,
  normalizeHiddenModels,
  normalizeModelPrefs,
  readHiddenModels,
  readHiddenModelsFor,
  readHiddenPickerModels,
  readModelPrefs,
  setAllModelsHiddenFor,
  setModelHiddenFor,
} from './model-visibility';

/** 最小 localStorage 替身：node 环境下没有 DOM，用它验证落盘形态 */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    raw: map,
  } as unknown as Storage & { raw: Map<string, string> };
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  // 模块内还有一份内存态兜底，每个用例先清空，避免上一例的残留泄漏进来
  clearHiddenModelsFor('table');
  clearHiddenModelsFor('picker');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('model-visibility', () => {
  it('modelVisibilityKey：trim 后为空统一落到 unknown（与统计页汇总分组一致）', () => {
    expect(modelVisibilityKey(null)).toBe(UNKNOWN_MODEL_KEY);
    expect(modelVisibilityKey(undefined)).toBe(UNKNOWN_MODEL_KEY);
    expect(modelVisibilityKey('')).toBe(UNKNOWN_MODEL_KEY);
    expect(modelVisibilityKey('   ')).toBe(UNKNOWN_MODEL_KEY);
    expect(modelVisibilityKey(' deepseek-chat ')).toBe('deepseek-chat');
    expect(UNKNOWN_MODEL_KEY).toBe('unknown');
  });

  it('normalizeHiddenModels：丢弃非法项、去重、保序', () => {
    expect(normalizeHiddenModels(null)).toEqual([]);
    expect(normalizeHiddenModels('oops')).toEqual([]);
    expect(normalizeHiddenModels([1, 'a', '', 'b', 'a', null, {}, 'c', '  '])).toEqual(['a', 'b', 'c']);
  });

  it('normalizeModelPrefs：缺字段回落空数组，兼容旧版只有 hidden 的数据', () => {
    expect(normalizeModelPrefs(null)).toEqual({ hidden: [], hiddenPickers: [] });
    expect(normalizeModelPrefs({ hidden: ['a'] })).toEqual({ hidden: ['a'], hiddenPickers: [] });
    expect(normalizeModelPrefs({ hiddenPickers: ['b'] })).toEqual({ hidden: [], hiddenPickers: ['b'] });
    expect(normalizeModelPrefs({ hidden: ['a'], hiddenPickers: ['b'] })).toEqual({ hidden: ['a'], hiddenPickers: ['b'] });
  });

  it('readModelPrefs：无数据返回空集合，脏 JSON 不抛错，旧格式照常读', () => {
    expect(readModelPrefs()).toEqual({ hidden: [], hiddenPickers: [] });
    store.setItem(MODEL_VISIBILITY_KEY, '{ bad json');
    expect(readModelPrefs()).toEqual({ hidden: [], hiddenPickers: [] });
    store.setItem(MODEL_VISIBILITY_KEY, JSON.stringify({ hidden: 'nope' }));
    expect(readHiddenModels()).toEqual([]);
    store.setItem(MODEL_VISIBILITY_KEY, JSON.stringify({ hidden: ['old-model'] }));
    expect(readHiddenModels()).toEqual(['old-model']);
    expect(readHiddenPickerModels()).toEqual([]);
  });

  it('setModelHiddenFor 落盘为 { hidden, hiddenPickers } 双字段，可反复开关且不重复', () => {
    setModelHiddenFor('table', 'a', true);
    expect(JSON.parse(store.getItem(MODEL_VISIBILITY_KEY) as string)).toEqual({ hidden: ['a'], hiddenPickers: [] });
    setModelHiddenFor('table', 'a', true);
    expect(readHiddenModels()).toEqual(['a']);
    setModelHiddenFor('table', 'b', true);
    expect(readHiddenModels()).toEqual(['a', 'b']);
    expect(hiddenModelCountFor('table')).toBe(2);
    setModelHiddenFor('table', 'a', false);
    expect(readHiddenModels()).toEqual(['b']);
    expect(isModelHiddenFor('table', 'b')).toBe(true);
    expect(isModelHiddenFor('table', 'a')).toBe(false);
  });

  it('setModelHiddenFor 忽略空键；clearHiddenModelsFor 只清目标位置', () => {
    setModelHiddenFor('table', '', true);
    expect(readHiddenModels()).toEqual([]);
    setModelHiddenFor('table', 'a', true);
    setModelHiddenFor('picker', 'b', true);
    clearHiddenModelsFor('table');
    expect(readHiddenModels()).toEqual([]);
    expect(readHiddenPickerModels()).toEqual(['b']);
    expect(JSON.parse(store.getItem(MODEL_VISIBILITY_KEY) as string)).toEqual({ hidden: [], hiddenPickers: ['b'] });
  });

  it('两套集合互不影响：表格隐藏不动下拉，反之亦然', () => {
    setModelHiddenFor('table', 'a', true);
    expect(readHiddenModels()).toEqual(['a']);
    expect(readHiddenPickerModels()).toEqual([]);
    expect(isModelHiddenFor('table', 'a')).toBe(true);
    expect(isModelHiddenFor('picker', 'a')).toBe(false);

    setModelHiddenFor('picker', 'b', true);
    expect(readHiddenModels()).toEqual(['a']);
    expect(readHiddenPickerModels()).toEqual(['b']);
    expect(hiddenModelCountFor('table')).toBe(1);
    expect(hiddenModelCountFor('picker')).toBe(1);

    clearHiddenModelsFor('picker');
    expect(readHiddenModels()).toEqual(['a']);
    expect(readHiddenPickerModels()).toEqual([]);
  });

  it('setAllModelsHiddenFor：批量隐藏与批量恢复，保留未涉及项', () => {
    setModelHiddenFor('picker', 'keep', true);
    setAllModelsHiddenFor('picker', ['a', 'b', 'a', ''], true);
    expect(readHiddenPickerModels()).toEqual(['keep', 'a', 'b']);
    setAllModelsHiddenFor('picker', ['a', 'b'], false);
    expect(readHiddenPickerModels()).toEqual(['keep']);
    expect(readHiddenModels()).toEqual([]);
  });

  it('readHiddenModelsFor：返回副本，外部修改不影响存储', () => {
    setModelHiddenFor('table', 'a', true);
    const list = readHiddenModelsFor('table');
    list.push('b');
    expect(readHiddenModelsFor('table')).toEqual(['a']);
  });

  it('filterVisibleModelRows：按表格集合过滤、保持入参顺序，默认认 row.model', () => {
    const rows = [{ model: 'a' }, { model: 'b' }, { model: '' }];
    expect(filterVisibleModelRows(rows).map((r) => r.model)).toEqual(['a', 'b', '']);
    setModelHiddenFor('table', 'b', true);
    expect(filterVisibleModelRows(rows).map((r) => r.model)).toEqual(['a', '']);
    setModelHiddenFor('table', UNKNOWN_MODEL_KEY, true);
    expect(filterVisibleModelRows(rows).map((r) => r.model)).toEqual(['a']);
    clearHiddenModelsFor('table');
    const copy = filterVisibleModelRows(rows);
    copy.pop();
    expect(rows.length).toBe(3);
  });

  it('filterVisibleModelRows：可自定义取键（模型汇总行是 m 字段）', () => {
    setModelHiddenFor('table', 'x', true);
    const rows = [{ m: 'x' }, { m: 'y' }];
    expect(filterVisibleModelRows(rows, (r) => r.m).map((r) => r.m)).toEqual(['y']);
  });

  it('filterModelPickerRows：只认下拉集合，字符串行直接当模型名', () => {
    const options = ['a', 'b', ''];
    setModelHiddenFor('table', 'a', true);
    // 表格集合不影响下拉
    expect(filterModelPickerRows(options)).toEqual(['a', 'b', '']);
    setModelHiddenFor('picker', 'a', true);
    setModelHiddenFor('picker', UNKNOWN_MODEL_KEY, true);
    expect(filterModelPickerRows(options)).toEqual(['b']);
  });

  it('filterModelPickerRows：可自定义取键（历史页选项与趋势页选项自带 id / model）', () => {
    setModelHiddenFor('picker', 'chat-1', true);
    const options = [{ id: 'chat-1' }, { id: 'chat-2' }];
    expect(filterModelPickerRows(options, (o) => o.id).map((o) => o.id)).toEqual(['chat-2']);
    setModelHiddenFor('picker', 'm-1', true);
    const forecast = [{ model: 'm-1' }, { model: 'm-2' }];
    expect(filterModelPickerRows(forecast, (o) => o.model).map((o) => o.model)).toEqual(['m-2']);
  });

  it('localStorage 不可用时退化为内存态且不抛错', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } },
      configurable: true,
      writable: true,
    });
    expect(readHiddenModels()).toEqual([]);
    expect(hiddenModelCountFor('table')).toBe(0);
    setModelHiddenFor('table', 'mem', true);
    expect(isModelHiddenFor('table', 'mem')).toBe(true);
    setModelHiddenFor('picker', 'mem', true);
    expect(isModelHiddenFor('picker', 'mem')).toBe(true);
    expect(isModelHiddenFor('table', 'mem')).toBe(true);
    setModelHiddenFor('table', 'mem', false);
    expect(isModelHiddenFor('table', 'mem')).toBe(false);
  });
});