import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CHAT_VISIBILITY_KEY,
  NULL_CHAT_KEY,
  chatVisibilityKey,
  clearHiddenFor,
  clearHiddenKeys,
  filterPickerRows,
  filterVisibleRows,
  hiddenCountFor,
  hiddenKeyCount,
  isHiddenFor,
  isHiddenKey,
  normalizeHiddenKeys,
  normalizePrefs,
  readHiddenFor,
  readHiddenKeys,
  readHiddenPickerKeys,
  setAllHiddenFor,
  setHiddenFor,
  setHiddenKey,
} from './chat-visibility';

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
  clearHiddenFor('table');
  clearHiddenFor('picker');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chat-visibility', () => {
  it('chatVisibilityKey：空 chatId 统一落到 NULL_CHAT_KEY', () => {
    expect(chatVisibilityKey(null)).toBe(NULL_CHAT_KEY);
    expect(chatVisibilityKey(undefined)).toBe(NULL_CHAT_KEY);
    expect(chatVisibilityKey('')).toBe(NULL_CHAT_KEY);
    expect(chatVisibilityKey('chat-42')).toBe('chat-42');
    expect(NULL_CHAT_KEY).toBe('__null__');
  });

  it('normalizeHiddenKeys：丢弃非法项、去重、保序', () => {
    expect(normalizeHiddenKeys(null)).toEqual([]);
    expect(normalizeHiddenKeys('oops')).toEqual([]);
    expect(normalizeHiddenKeys([1, 'a', '', 'b', 'a', null, {}, 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('normalizePrefs：缺字段回落空数组，兼容旧版只有 hidden 的数据', () => {
    expect(normalizePrefs(null)).toEqual({ hidden: [], hiddenPickers: [] });
    expect(normalizePrefs({ hidden: ['a'] })).toEqual({ hidden: ['a'], hiddenPickers: [] });
    expect(normalizePrefs({ hiddenPickers: ['b'] })).toEqual({ hidden: [], hiddenPickers: ['b'] });
    expect(normalizePrefs({ hidden: ['a'], hiddenPickers: ['b'] })).toEqual({ hidden: ['a'], hiddenPickers: ['b'] });
  });

  it('readHiddenKeys：无数据返回空数组，脏 JSON 不抛错，旧格式照常读', () => {
    expect(readHiddenKeys()).toEqual([]);
    store.setItem(CHAT_VISIBILITY_KEY, '{ bad json');
    expect(readHiddenKeys()).toEqual([]);
    store.setItem(CHAT_VISIBILITY_KEY, JSON.stringify({ hidden: 'nope' }));
    expect(readHiddenKeys()).toEqual([]);
    store.setItem(CHAT_VISIBILITY_KEY, JSON.stringify({ hidden: ['old'] }));
    expect(readHiddenKeys()).toEqual(['old']);
    expect(readHiddenPickerKeys()).toEqual([]);
  });

  it('setHiddenKey 落盘为 { hidden, hiddenPickers } 双字段，可反复开关且不重复', () => {
    setHiddenKey('a', true);
    expect(JSON.parse(store.getItem(CHAT_VISIBILITY_KEY) as string)).toEqual({ hidden: ['a'], hiddenPickers: [] });
    setHiddenKey('a', true);
    expect(readHiddenKeys()).toEqual(['a']);
    setHiddenKey('b', true);
    expect(readHiddenKeys()).toEqual(['a', 'b']);
    expect(hiddenKeyCount()).toBe(2);
    setHiddenKey('a', false);
    expect(readHiddenKeys()).toEqual(['b']);
    expect(isHiddenKey('b')).toBe(true);
    expect(isHiddenKey('a')).toBe(false);
  });

  it('setHiddenKey 忽略空键；clearHiddenKeys 全部恢复', () => {
    setHiddenKey('', true);
    expect(readHiddenKeys()).toEqual([]);
    setHiddenKey('a', true);
    setHiddenKey(NULL_CHAT_KEY, true);
    clearHiddenKeys();
    expect(readHiddenKeys()).toEqual([]);
    expect(JSON.parse(store.getItem(CHAT_VISIBILITY_KEY) as string)).toEqual({ hidden: [], hiddenPickers: [] });
  });

  it('两套集合互不影响：表格隐藏不动下拉，反之亦然', () => {
    setHiddenFor('table', 'a', true);
    expect(readHiddenKeys()).toEqual(['a']);
    expect(readHiddenPickerKeys()).toEqual([]);
    expect(isHiddenFor('table', 'a')).toBe(true);
    expect(isHiddenFor('picker', 'a')).toBe(false);

    setHiddenFor('picker', 'b', true);
    expect(readHiddenKeys()).toEqual(['a']);
    expect(readHiddenPickerKeys()).toEqual(['b']);
    expect(hiddenCountFor('table')).toBe(1);
    expect(hiddenCountFor('picker')).toBe(1);

    // 只清其中一个位置，另一个保持
    clearHiddenFor('picker');
    expect(readHiddenKeys()).toEqual(['a']);
    expect(readHiddenPickerKeys()).toEqual([]);
  });

  it('setAllHiddenFor：批量隐藏与批量恢复，保留未涉及项', () => {
    setHiddenFor('picker', 'keep', true);
    setAllHiddenFor('picker', ['a', 'b', 'a', ''], true);
    expect(readHiddenPickerKeys()).toEqual(['keep', 'a', 'b']);
    setAllHiddenFor('picker', ['a', 'b'], false);
    expect(readHiddenPickerKeys()).toEqual(['keep']);
    // 表格集合未被牵连
    expect(readHiddenKeys()).toEqual([]);
  });

  it('readHiddenFor：返回副本，外部修改不影响存储', () => {
    setHiddenFor('table', 'a', true);
    const list = readHiddenFor('table');
    list.push('b');
    expect(readHiddenFor('table')).toEqual(['a']);
  });

  it('filterVisibleRows：按表格隐藏列表过滤且保持入参顺序与原型', () => {
    const rows = [
      { chatId: 'a', total: 3 },
      { chatId: 'b', total: 2 },
      { chatId: null, total: 1 },
    ];
    expect(filterVisibleRows(rows).map((r) => r.chatId)).toEqual(['a', 'b', null]);
    setHiddenKey('b', true);
    expect(filterVisibleRows(rows).map((r) => r.chatId)).toEqual(['a', null]);
    setHiddenKey(NULL_CHAT_KEY, true);
    expect(filterVisibleRows(rows).map((r) => r.chatId)).toEqual(['a']);
    clearHiddenKeys();
    // 返回副本，改它不影响入参
    const copy = filterVisibleRows(rows);
    copy.pop();
    expect(rows.length).toBe(3);
  });

  it('filterVisibleRows：可自定义取键函数', () => {
    setHiddenKey('x', true);
    const rows = [{ id: 'x' }, { id: 'y' }];
    expect(filterVisibleRows(rows, (r) => r.id).map((r) => r.id)).toEqual(['y']);
  });

  it('filterPickerRows：只认下拉集合，默认取 row.chatId', () => {
    const rows = [{ chatId: 'a' }, { chatId: 'b' }, { chatId: null }];
    setHiddenFor('table', 'a', true);
    // 表格集合不影响下拉
    expect(filterPickerRows(rows).map((r) => r.chatId)).toEqual(['a', 'b', null]);
    setHiddenFor('picker', 'a', true);
    setHiddenFor('picker', NULL_CHAT_KEY, true);
    expect(filterPickerRows(rows).map((r) => r.chatId)).toEqual(['b']);
  });

  it('filterPickerRows：可自定义取键函数（历史页选项自带 id）', () => {
    setHiddenFor('picker', 'chat-1', true);
    const options = [{ id: 'chat-1' }, { id: 'chat-2' }];
    expect(filterPickerRows(options, (o) => o.id).map((o) => o.id)).toEqual(['chat-2']);
  });

  it('localStorage 不可用时退化为内存态且不抛错', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } },
      configurable: true,
      writable: true,
    });
    expect(readHiddenKeys()).toEqual([]);
    expect(hiddenKeyCount()).toBe(0);
    // 探针失败 → 整体退化为内存态，本次会话内开关依旧有效
    setHiddenKey('mem', true);
    expect(isHiddenKey('mem')).toBe(true);
    setHiddenFor('picker', 'mem', true);
    expect(isHiddenFor('picker', 'mem')).toBe(true);
    expect(isHiddenKey('mem')).toBe(true);
    setHiddenKey('mem', false);
    expect(isHiddenKey('mem')).toBe(false);
  });
});
