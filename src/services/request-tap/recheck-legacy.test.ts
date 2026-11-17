/**
 * 旧版本遗留探针的一次性重判
 *
 * 背景：v1 探针把模型名带着 [A] 前缀去对账、把几毫秒的假请求也记成「疑似对话」，
 * 于是升级后历史页仍在提示「疑似正常对话没被记进历史」。这里验证重判的三条分支：
 *  - 能对上已存历史 → settled（本来就是常规对话）
 *  - 几毫秒的假探针 → too-short
 *  - 仍对不上 → legacy（留在验证页，不再提示）
 * 以及：新版 v2 记录与已结算记录一律不动。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const histories: any[] = [];
vi.mock('../../store/persistence', () => ({
  getAllHistory: async () => histories.slice(),
}));

function installLocalStorage(): void {
  const map = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (map.has(k) ? String(map.get(k)) : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  (globalThis as any).localStorage = ls;
}

/** 造一条旧版本（v1）写下的孤儿探针 */
function legacyTap(over: Record<string, any> = {}): any {
  return {
    id: 'tap:1',
    at: 1000000,
    endedAt: 1000400,
    url: '/api/backends/chat-completions/generate',
    endpoint: 'chat',
    actorKind: 'tavern',
    actorId: 'main',
    actorLabel: '酒馆主窗',
    model: 'gemini-3.8-flash',
    requestType: 'normal',
    stream: true,
    messageCount: 30,
    promptChars: 5000,
    structured: true,
    purposeKey: 'k1',
    purposeLabel: '结构化输出',
    promptHint: '',
    usage: { prompt: 40, completion: 8, total: 48, hit: 0, miss: 40 },
    usageMissing: false,
    durationMs: 90000,
    ttftMs: 800,
    status: 200,
    error: '',
    state: 'orphan',
    settledBy: '',
    settledAt: 0,
    ...over,
  };
}

async function reloadModules() {
  vi.resetModules();
  const store = await import('./store');
  const index = await import('./index');
  return { store, index };
}

beforeEach(() => {
  histories.length = 0;
  installLocalStorage();
});

describe('旧版本孤儿探针重判', () => {
  it('能对上已存历史就标成 settled，不再算漏记', async () => {
    histories.push({ timestamp: 1000500, model: 'gemini-3.8-flash', prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 });
    const { store, index } = await reloadModules();
    store.upsertTapRecord(legacyTap());
    await index.hydrateLedgerFromHistory();
    expect(index.recheckLegacyOrphans()).toBe(1);
    const rec = store.listTapRecords()[0];
    expect(rec.state).toBe('settled');
    expect(rec.settledBy).toBe('tokens');
    expect(rec.v).toBe(2);
  });

  it('几毫秒的假探针标成 too-short', async () => {
    const { store, index } = await reloadModules();
    store.upsertTapRecord(legacyTap({ durationMs: 4 }));
    await index.hydrateLedgerFromHistory();
    expect(index.recheckLegacyOrphans()).toBe(1);
    expect(store.listTapRecords()[0].settledBy).toBe('too-short');
  });

  it('对不上账的旧记录标 legacy，并从健康提示里消失', async () => {
    const { store, index } = await reloadModules();
    store.upsertTapRecord(legacyTap());
    store.upsertTapRecord(legacyTap({ id: 'tap:2', at: 2000000, endedAt: 2000400 }));
    await index.hydrateLedgerFromHistory();
    expect(index.recheckLegacyOrphans()).toBe(2);
    const list = store.listTapRecords();
    expect(list.every((r: any) => r.settledBy === 'legacy')).toBe(true);
    const { scanTapHealth } = await import('../health-signals');
    expect(scanTapHealth(list as any)).toHaveLength(0);
  });

  it('新版记录（v2）与已结算记录一律不动', async () => {
    const { store, index } = await reloadModules();
    store.upsertTapRecord(legacyTap({ id: 'tap:new', v: 2 }));
    store.upsertTapRecord(legacyTap({ id: 'tap:done', state: 'settled', settledBy: 'total' }));
    await index.hydrateLedgerFromHistory();
    expect(index.recheckLegacyOrphans()).toBe(0);
    const list = store.listTapRecords();
    expect(list[0].state).toBe('orphan');
    expect(list[0].settledBy).toBe('');
    expect(list[1].settledBy).toBe('total');
  });

  it('重判可重复执行，不会反复改写', async () => {
    const { store, index } = await reloadModules();
    store.upsertTapRecord(legacyTap());
    await index.hydrateLedgerFromHistory();
    expect(index.recheckLegacyOrphans()).toBe(1);
    expect(index.recheckLegacyOrphans()).toBe(0);
  });
});