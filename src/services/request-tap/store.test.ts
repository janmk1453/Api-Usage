import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TapRecord } from './types';

/**
 * 探针账本（request-tap/store.ts）的内存与持久化行为。
 *
 * 这里最要紧的不是「能存能读」，而是两条会直接影响验证结论的规则：
 * ① 超过 500 条时先淘汰已结算的记录 —— pending 一丢就永远配不上账，验证页会凭空少记录；
 * ② 同 id 覆盖而不是追加 —— 一条请求从 pending 变 settled 是原地更新，不是第二条。
 */

const KEY = 'aus_tap_log_v1';

function memoryStorage(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  let failWrites = 0;
  return {
    map,
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => {
      if (failWrites > 0) { failWrites -= 1; throw new Error('QuotaExceededError'); }
      map.set(k, String(v));
    },
    removeItems: () => {},
    failNextWrites: (n: number) => { failWrites = n; },
  } as Storage & { map: Map<string, string>; failNextWrites: (n: number) => void };
}

function rec(patch: Partial<TapRecord> = {}): TapRecord {
  return {
    v: 2,
    id: 'tap:1:1',
    at: 1000,
    endedAt: 2000,
    url: '/api/backends/chat-completions/generate',
    endpoint: 'chat',
    actorKind: 'tavern',
    actorId: '',
    actorLabel: '酒馆主界面',
    stackTop: '',
    attribution: 'C',
    model: 'deepseek-v4-flash',
    requestType: 'normal',
    stream: true,
    messageCount: 1,
    promptChars: 20,
    structured: false,
    purposeKey: '',
    purposeLabel: '',
    promptHint: '',
    usage: null,
    usageMissing: false,
    durationMs: 1000,
    ttftMs: 0,
    status: 200,
    error: null,
    state: 'pending',
    settledBy: null,
    settledAt: null,
    ...patch,
  };
}

async function freshStore(seed?: TapRecord[]) {
  const storage = memoryStorage(seed ? { [KEY]: JSON.stringify(seed) } : {});
  vi.stubGlobal('window', { parent: { localStorage: storage } });
  vi.resetModules();
  const mod = await import('./store');
  return { mod, storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('写入与覆盖', () => {
  it('同 id 原地覆盖，不产生第二条记录', async () => {
    const { mod } = await freshStore();
    mod.upsertTapRecord(rec({ id: 'tap:1:1', state: 'pending' }));
    mod.upsertTapRecord(rec({ id: 'tap:1:1', state: 'settled', settledBy: 'tokens' }));

    const list = mod.listTapRecords();
    expect(list).toHaveLength(1);
    expect(list[0].state).toBe('settled');
    expect(list[0].settledBy).toBe('tokens');
  });

  it('读出来的数组是副本，外部增删不影响账本', async () => {
    const { mod } = await freshStore();
    mod.upsertTapRecord(rec());
    const list = mod.listTapRecords();
    list.push(rec({ id: 'injected' }));
    expect(mod.listTapRecords()).toHaveLength(1);
  });

  it('patch 只改存在的记录，未提到的字段保留', async () => {
    const { mod } = await freshStore();
    mod.upsertTapRecord(rec({ id: 'a', model: 'm1' }));
    expect(mod.patchTapRecord('missing', { state: 'settled' })).toBe(false);
    expect(mod.patchTapRecord('a', { state: 'settled' })).toBe(true);
    expect(mod.listTapRecords()[0]).toMatchObject({ id: 'a', model: 'm1', state: 'settled' });
  });

  it('updateTapRecords 只统计真正变化的记录，updater 抛错不影响其它记录', async () => {
    const { mod } = await freshStore([rec({ id: 'a' }), rec({ id: 'b' }), rec({ id: 'c' })]);
    const changed = mod.updateTapRecords((r) => {
      if (r.id === 'a') return { ...r, state: 'settled' as const };
      if (r.id === 'b') throw new Error('boom');
      return null;
    });

    expect(changed).toBe(1);
    expect(mod.listTapRecords().map(r => r.state)).toEqual(['settled', 'pending', 'pending']);
  });
});

describe('500 条上限的淘汰顺序', () => {
  it('先淘汰已结算的最旧记录，pending 一律保留', async () => {
    const seed = [rec({ id: 'settled-0', state: 'settled' }), ...Array.from({ length: 499 }, (_, i) => rec({ id: 'pending-' + i }))];
    const { mod } = await freshStore(seed);

    mod.upsertTapRecord(rec({ id: 'new', state: 'pending' }));
    const ids = mod.listTapRecords().map(r => r.id);

    expect(ids).toHaveLength(500);
    expect(ids).not.toContain('settled-0');
    expect(ids).toContain('pending-0');
    expect(ids).toContain('new');
  });

  it('全部 pending 的极端情况才退化为丢弃最旧', async () => {
    const seed = Array.from({ length: 500 }, (_, i) => rec({ id: 'p-' + i }));
    const { mod } = await freshStore(seed);

    mod.upsertTapRecord(rec({ id: 'new' }));
    const ids = mod.listTapRecords().map(r => r.id);

    expect(ids).toHaveLength(500);
    expect(ids).not.toContain('p-0');
    expect(ids).toContain('p-1');
    expect(ids).toContain('new');
  });
});

describe('持久化与订阅', () => {
  it('写入防抖 240ms 后落盘，重启（重新加载模块）能读回', async () => {
    vi.useFakeTimers();
    const { mod, storage } = await freshStore();
    mod.upsertTapRecord(rec({ id: 'persisted' }));

    expect(storage.getItem(KEY)).toBe(null);
    await vi.advanceTimersByTimeAsync(260);
    const raw = storage.getItem(KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);

    // 模拟刷新：模块重新加载，内存缓存清空，只能靠 localStorage
    vi.resetModules();
    const reloaded = await import('./store');
    expect(reloaded.listTapRecords().map(r => r.id)).toEqual(['persisted']);
  });

  it('超配额时丢弃最旧一半再写一次，避免整块丢失', async () => {
    vi.useFakeTimers();
    const seed = Array.from({ length: 500 }, (_, i) => rec({ id: 'p-' + i }));
    const { mod, storage } = await freshStore(seed);
    storage.failNextWrites(1);

    mod.upsertTapRecord(rec({ id: 'new' }));
    await vi.advanceTimersByTimeAsync(260);

    const raw = storage.getItem(KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!);
    expect(saved).toHaveLength(250);
    expect(saved[saved.length - 1].id).toBe('new');
  });

  it('订阅者在每次变更后收到通知，取消后不再收到', async () => {
    const { mod } = await freshStore();
    let hits = 0;
    const off = mod.subscribeTap(() => { hits += 1; });

    mod.upsertTapRecord(rec({ id: 'a' }));
    expect(hits).toBe(1);
    mod.patchTapRecord('a', { state: 'settled' });
    expect(hits).toBe(2);

    off();
    mod.upsertTapRecord(rec({ id: 'b' }));
    expect(hits).toBe(2);
  });

  it('清空后内存与存储都不留记录', async () => {
    const { mod, storage } = await freshStore([rec({ id: 'a' })]);
    mod.clearTapRecords();

    expect(mod.listTapRecords()).toEqual([]);
    expect(storage.getItem(KEY)).toBe(null);
  });
});
