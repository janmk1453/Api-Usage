import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendMissingUsage,
  clearMissingUsage,
  getMissingUsageRecords,
  missingUsageId,
  noteMissingUsage,
  summarizeMissingUsage,
  MISSING_USAGE_DEDUPE_MS,
  type MissingUsageRecord,
} from './missing-usage';

function rec(over: Partial<MissingUsageRecord> = {}): MissingUsageRecord {
  const at = over.at ?? 1_000_000;
  const model = over.model ?? 'deepseek-flash/rewrite3-27B';
  const endpointLabel = over.endpointLabel ?? 'revnovel.org';
  return {
    id: missingUsageId(model, endpointLabel, at),
    at,
    model,
    endpointLabel,
    sourceType: 'custom',
    reason: 'no-usage',
    stream: true,
    status: 200,
    requestKey: null,
    ...over,
  };
}

describe('appendMissingUsage', () => {
  it('空列表直接接收第一条', () => {
    const list = appendMissingUsage([], rec());
    expect(list).toHaveLength(1);
  });

  it('同 requestKey 不重复记录（fetch 与生成结束事件各报一次）', () => {
    const first = appendMissingUsage([], rec({ requestKey: 'req:1' }));
    const second = appendMissingUsage(first, rec({ at: 1_000_000 + 2000, requestKey: 'req:1' }));
    expect(second).toHaveLength(1);
  });

  it('同模型同接入且在去重窗口内视为同一次请求', () => {
    const first = appendMissingUsage([], rec({ at: 1_000_000 }));
    const second = appendMissingUsage(first, rec({ at: 1_000_000 + MISSING_USAGE_DEDUPE_MS - 1 }));
    expect(second).toHaveLength(1);
  });

  it('超过去重窗口就是两次请求', () => {
    const first = appendMissingUsage([], rec({ at: 1_000_000 }));
    const second = appendMissingUsage(first, rec({ at: 1_000_000 + MISSING_USAGE_DEDUPE_MS }));
    expect(second).toHaveLength(2);
  });

  it('请求号不同即使模型与时间都相同也分别记录', () => {
    const first = appendMissingUsage([], rec({ at: 1_000_000, requestKey: 'req:1' }));
    const second = appendMissingUsage(first, rec({ at: 1_000_000, requestKey: 'req:2' }));
    expect(second).toHaveLength(2);
  });

  it('模型不同即使时间相同也分别记录', () => {
    const first = appendMissingUsage([], rec({ at: 1_000_000 }));
    const second = appendMissingUsage(first, rec({ at: 1_000_000, model: 'deepseek-flash' }));
    expect(second).toHaveLength(2);
  });

  it('接入不同分别记录', () => {
    const first = appendMissingUsage([], rec({ at: 1_000_000 }));
    const second = appendMissingUsage(first, rec({ at: 1_000_000, endpointLabel: 'api.deepseek.com' }));
    expect(second).toHaveLength(2);
  });

  it('超过上限时只保留最近的记录', () => {
    const rows: MissingUsageRecord[] = [];
    for (let i = 0; i < 5; i += 1) rows.push(rec({ at: 1_000_000 + i * 10_000, model: `m${i}` }));
    const capped = appendMissingUsage(rows, rec({ at: 1_000_000 + 99_000, model: 'last' }), 0, 3);
    expect(capped).toHaveLength(3);
    expect(capped[capped.length - 1].model).toBe('last');
  });

  it('返回新数组，不改动入参', () => {
    const rows = [rec({ at: 1_000_000 })];
    const next = appendMissingUsage(rows, rec({ at: 1_000_000, model: 'other' }));
    expect(rows).toHaveLength(1);
    expect(next).toHaveLength(2);
  });
});

describe('summarizeMissingUsage', () => {
  const now = 2_000_000_000;
  const windowMs = 7 * 24 * 60 * 60 * 1000;

  it('只统计窗口内的记录', () => {
    const rows = [rec({ at: now - 1000 }), rec({ at: now - windowMs - 1, model: 'old' })];
    const summary = summarizeMissingUsage(rows, now, windowMs);
    expect(summary.total).toBe(1);
    expect(summary.rows).toHaveLength(1);
  });

  it('按模型 + 接入聚合，计数与最近时间正确', () => {
    const rows = [
      rec({ at: now - 3000 }),
      rec({ at: now - 1000 }),
      rec({ at: now - 2000, endpointLabel: 'api.deepseek.com' }),
    ];
    const summary = summarizeMissingUsage(rows, now, windowMs);
    expect(summary.total).toBe(3);
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows[0].count).toBe(2);
    expect(summary.rows[0].lastAt).toBe(now - 1000);
    expect(summary.rows[0].endpointLabel).toBe('revnovel.org');
  });

  it('按次数降序排列', () => {
    const rows = [
      rec({ at: now - 10, model: 'a' }),
      rec({ at: now - 20, model: 'b' }),
      rec({ at: now - 30, model: 'b' }),
    ];
    const summary = summarizeMissingUsage(rows, now, windowMs);
    expect(summary.rows.map((r) => r.model)).toEqual(['b', 'a']);
  });

  it('记录原因去重合并', () => {
    const rows = [
      rec({ at: now - 100, reason: 'no-usage' }),
      rec({ at: now - 20_000, reason: 'zero-usage' }),
    ];
    const summary = summarizeMissingUsage(rows, now, windowMs);
    expect(summary.rows[0].reasons.sort()).toEqual(['no-usage', 'zero-usage']);
  });

  it('空输入返回空摘要', () => {
    const summary = summarizeMissingUsage([], now, windowMs);
    expect(summary.total).toBe(0);
    expect(summary.rows).toEqual([]);
  });
});

describe('noteMissingUsage（带存储的端到端行为）', () => {
  function mockStorage() {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
    vi.stubGlobal('localStorage', storage);
    return storage;
  }

  afterEach(() => {
    clearMissingUsage();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('写盘后可以读回，同 requestKey 的重复上报只记一条', async () => {
    mockStorage();
    vi.useFakeTimers();
    noteMissingUsage({ model: 'm', endpointLabel: 'e', reason: 'no-usage', requestKey: 'req:1' });
    await vi.advanceTimersByTimeAsync(300);
    expect(getMissingUsageRecords()).toHaveLength(1);
    noteMissingUsage({ model: 'm', endpointLabel: 'e', reason: 'no-usage', requestKey: 'req:1', at: Date.now() + 10 });
    await vi.advanceTimersByTimeAsync(300);
    expect(getMissingUsageRecords()).toHaveLength(1);
  });

  it('不同请求分别累计', async () => {
    mockStorage();
    vi.useFakeTimers();
    noteMissingUsage({ model: 'm', endpointLabel: 'e', reason: 'no-usage', requestKey: 'req:1' });
    noteMissingUsage({ model: 'm', endpointLabel: 'e', reason: 'no-usage', requestKey: 'req:2' });
    await vi.advanceTimersByTimeAsync(300);
    expect(getMissingUsageRecords()).toHaveLength(2);
  });

  it('缺省模型/接入时写入占位名，不会出现空串', async () => {
    mockStorage();
    vi.useFakeTimers();
    noteMissingUsage({ reason: 'no-usage' });
    await vi.advanceTimersByTimeAsync(300);
    const rows = getMissingUsageRecords();
    expect(rows[0].model).toBe('未知模型');
    expect(rows[0].endpointLabel).toBe('未记录接入');
  });

  it('clearMissingUsage 清空全部记录', async () => {
    mockStorage();
    vi.useFakeTimers();
    noteMissingUsage({ reason: 'no-usage', requestKey: 'a' });
    await vi.advanceTimersByTimeAsync(300);
    clearMissingUsage();
    expect(getMissingUsageRecords()).toEqual([]);
  });
});
