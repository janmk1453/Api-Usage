import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACK_DEBUG_KEY,
  BACK_DEBUG_MAX,
  BACK_DEBUG_OFF_KEY,
  backDebug,
  backDebugClear,
  backDebugDump,
  installBackDebug,
} from './back-debug';

function fakeStorage(initial: Record<string, string> = {}): any {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    dump: () => Object.fromEntries(map.entries()),
  };
}

function setStorage(value: any): void {
  try {
    if (value === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = value;
  } catch {
    /* 忽略 */
  }
}

describe('返回键诊断日志', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    setStorage(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setStorage(undefined);
  });

  it('没有 localStorage 时也不抛错，记录只留在内存', () => {
    expect(() => backDebug('unit', { a: 1 })).not.toThrow();
    const all = backDebugDump();
    expect(all.length).toBeGreaterThan(0);
    expect(all[all.length - 1].k).toBe('unit');
    expect(all[all.length - 1].a).toBe(1);
  });

  it('记录带时间与事件名，额外字段原样保留', () => {
    backDebugClear();
    backDebug('fill', { pushed: 2, live: 2 });
    const all = backDebugDump();
    expect(all).toHaveLength(1);
    expect(all[0].t).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    expect(typeof all[0].ms).toBe('number');
    expect(all[0].k).toBe('fill');
    expect(all[0].pushed).toBe(2);
    expect(all[0].live).toBe(2);
  });

  it('环形缓冲不超过上限，只保留最新的记录', () => {
    backDebugClear();
    for (let i = 0; i < BACK_DEBUG_MAX + 40; i++) backDebug('n' + i);
    const all = backDebugDump();
    expect(all).toHaveLength(BACK_DEBUG_MAX);
    expect(all[all.length - 1].k).toBe('n' + (BACK_DEBUG_MAX + 39));
    expect(all[0].k).toBe('n40');
  });

  it('清空后 dump 为空', () => {
    backDebug('x');
    expect(backDebugClear()).toBe('cleared');
    expect(backDebugDump()).toHaveLength(0);
  });

  it('写入 localStorage 可跨重载读回', async () => {
    const ls = fakeStorage();
    setStorage(ls);
    backDebugClear();
    backDebug('persist-me');
    await new Promise(r => setTimeout(r, 200));
    const raw = ls.getItem(BACK_DEBUG_KEY);
    expect(typeof raw).toBe('string');
    const arr = JSON.parse(raw as string);
    expect(arr[arr.length - 1].k).toBe('persist-me');
  });

  it('aus_back_debug_off 置 1 后不再记录', () => {
    setStorage(fakeStorage({ [BACK_DEBUG_OFF_KEY]: '1' }));
    backDebugClear();
    backDebug('should-be-dropped');
    expect(backDebugDump()).toHaveLength(0);
  });

  it('installBackDebug 幂等，并挂出读取入口', () => {
    const listeners: string[] = [];
    const win: any = {
      location: { href: 'http://127.0.0.1:8000/' },
      history: { length: 4, state: { __ausBackGuard: 3 } },
      addEventListener: (type: string) => { listeners.push(type); },
      document: { addEventListener: () => {}, visibilityState: 'visible' },
    };
    installBackDebug(win);
    installBackDebug(win);
    expect(listeners.filter(t => t === 'popstate')).toHaveLength(1);
    expect(typeof win.__ausBackDebug?.dump).toBe('function');
    expect(typeof win.__ausBackDebug?.clear).toBe('function');
    const all = backDebugDump();
    expect(all.some(r => r.k === 'init')).toBe(true);
  });
});
