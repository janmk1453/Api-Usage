/**
 * 探针对账：流式请求不能按「响应头到达」就下结论
 *
 * 背景：流式请求一拿到响应头就先落一条 pending，那时的 durationMs 只是首字节耗时（几十毫秒）。
 * 旧逻辑过了 12 秒宽限期就用这个假时长判 too-short，于是长输出的流式扩展请求永远停在
 * orphan/too-short，探针页的孤儿数因此虚高。现在要等响应体读完（bodyDone）再对账。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const records: any[] = [];
const patches: Array<{ id: string; patch: any }> = [];

vi.mock('./store', () => ({
  listTapRecords: () => records.slice(),
  patchTapRecord: (id: string, patch: any) => { patches.push({ id, patch }); },
  updateTapRecords: () => 0,
  clearTapRecords: () => {},
}));
vi.mock('./capture', () => ({
  installTapCapture: () => {},
  uninstallTapCapture: () => {},
  tapDebugRecord: () => {},
}));
vi.mock('../../data/events', () => ({ DataEvents: {}, on: () => () => {} }));

const { reconcilePending, RECONCILE_DELAY_MS } = await import('./index');

function tap(over: Record<string, any> = {}): any {
  const at = 1_000_000;
  return {
    id: 'tap:1',
    at,
    endedAt: at + 25,
    url: '/api/backends/chat-completions/generate',
    endpoint: 'chat',
    actorKind: 'plugin',
    actorId: 'main',
    actorLabel: 'ST-BaiBai-Image',
    stackTop: 'at go (http://h/scripts/extensions/third-party/ST-BaiBai-Image/dist/index.js:3:21)',
    attribution: 'B',
    model: 'hy4-flash',
    requestType: '',
    stream: true,
    messageCount: 6,
    promptChars: 32555,
    structured: false,
    purposeKey: 'k',
    purposeLabel: '长上下文请求',
    promptHint: '...',
    usage: null,
    usageMissing: false,
    durationMs: 25,
    ttftMs: 23,
    status: 200,
    error: '',
    state: 'pending',
    settledBy: null,
    settledAt: null,
    v: 2,
    ...over,
  };
}

describe('探针对账：流式请求等响应体读完', () => {
  beforeEach(() => {
    records.length = 0;
    patches.length = 0;
  });

  it('响应体还没读完时不判 too-short', () => {
    records.push(tap({ bodyDone: false }));
    reconcilePending(1_000_000 + RECONCILE_DELAY_MS + 1000);
    expect(patches).toEqual([]);
  });

  it('响应体读完后仍然很短，才判 too-short', () => {
    records.push(tap({ bodyDone: true }));
    reconcilePending(1_000_000 + RECONCILE_DELAY_MS + 1000);
    expect(patches.length).toBe(1);
    expect(patches[0].patch).toMatchObject({ state: 'orphan', settledBy: 'too-short' });
  });

  it('非流式请求不受等待影响，照常按真实时长判定', () => {
    records.push(tap({ stream: false, bodyDone: undefined }));
    reconcilePending(1_000_000 + RECONCILE_DELAY_MS + 1000);
    expect(patches[0].patch).toMatchObject({ state: 'orphan', settledBy: 'too-short' });
  });

  it('流读完且时长正常的请求不会被标 too-short', () => {
    records.push(tap({ bodyDone: true, durationMs: 57_256, endedAt: 1_057_256, usage: { prompt: 21658, completion: 8973, total: 30631, hit: 0, miss: 21658 } }));
    reconcilePending(1_000_000 + 57_256 + RECONCILE_DELAY_MS + 1000);
    expect(patches[0].patch.state).toBe('orphan');
    expect(patches[0].patch.settledBy).toBe(null);
  });
});
