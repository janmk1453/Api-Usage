import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CHAT_VISIBILITY_KEY,
  NULL_CHAT_KEY,
  chatVisibilityKey,
  clearHiddenKeys,
  filterVisibleRows,
  hiddenKeyCount,
  isHiddenKey,
  normalizeHiddenKeys,
  readHiddenKeys,
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
  clearHiddenKeys();
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

  it('readHiddenKeys：无数据返回空数组，脏 JSON 不抛错', () => {
    expect(readHiddenKeys()).toEqual([]);
    store.setItem(CHAT_VISIBILITY_KEY, '{ bad json');
    expect(readHiddenKeys()).toEqual([]);
    store.setItem(CHAT_VISIBILITY_KEY, JSON.stringify({ hidden: 'nope' }));
    expect(readHiddenKeys()).toEqual([]);
  });

  it('setHiddenKey 落盘为 { hidden: [...] }，可反复开关且不重复', () => {
    setHiddenKey('a', true);
    expect(JSON.parse(store.getItem(CHAT_VISIBILITY_KEY) as string)).toEqual({ hidden: ['a'] });
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
    expect(JSON.parse(store.getItem(CHAT_VISIBILITY_KEY) as string)).toEqual({ hidden: [] });
  });

  it('filterVisibleRows：按隐藏列表过滤且保持入参顺序与原型', () => {
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
    setHiddenKey('mem', false);
    expect(isHiddenKey('mem')).toBe(false);
  });
});
