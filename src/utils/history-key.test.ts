import { describe, expect, it } from 'vitest';
import { historyRecordKey } from './history-key';

const base = {
  timestamp: 1000,
  model: 'model-a',
  total_tokens: 100,
  cache_hit_tokens: 60,
  cache_miss_tokens: 20,
  completion_tokens: 20,
  endpointId: 'endpoint-a',
  walletId: 'wallet:a',
  credentialId: 'secret:a',
};

describe('历史记录去重键', () => {
  it('不同钱包、接入或密钥不会误判为同一条记录', () => {
    expect(historyRecordKey({ ...base, walletId: 'wallet:b', endpointId: 'endpoint-b' }))
      .not.toBe(historyRecordKey(base));
    expect(historyRecordKey({ ...base, credentialId: 'secret:b' }))
      .not.toBe(historyRecordKey(base));
  });

  it('迁移前后的同接入记录仍可去重', () => {
    const oldRecord = { ...base, walletId: undefined };
    expect(historyRecordKey(oldRecord)).toBe(historyRecordKey(base));
  });

  it('无接入记录使用钱包标识回退', () => {
    const first = { ...base, endpointId: undefined, walletId: 'wallet:a' };
    const second = { ...base, endpointId: undefined, walletId: 'wallet:b' };
    expect(historyRecordKey(first)).not.toBe(historyRecordKey(second));
  });

  it('Agent 记录只按 runId 去重，不受 token 变化影响', () => {
    const agentEntry = { ...base, agentRunId: 'run_1', origin: 'agent' };
    expect(historyRecordKey(agentEntry)).toBe(JSON.stringify(['agent', 'run_1']));
    // 同 Run 补采后 token 变化仍是同一条
    expect(historyRecordKey({ ...agentEntry, total_tokens: 999, cost: 1 }))
      .toBe(historyRecordKey(agentEntry));
    // 不同 Run 不会合并
    expect(historyRecordKey({ ...agentEntry, agentRunId: 'run_2' }))
      .not.toBe(historyRecordKey(agentEntry));
  });

  it('同毫秒同 token 的两条真实请求靠 requestId 区分', () => {
    const first = { ...base, requestId: 'req:1000:1' };
    const second = { ...base, requestId: 'req:1000:2' };
    expect(historyRecordKey(second)).not.toBe(historyRecordKey(first));
    // 同一条请求的热区副本与冷库副本必须仍然算出同一个键
    expect(historyRecordKey({ ...first })).toBe(historyRecordKey(first));
  });

  it('旧记录没有 requestId 时键完全不变（跨设备合并不受影响）', () => {
    expect(historyRecordKey({ ...base, requestId: '' })).toBe(historyRecordKey(base));
    expect(historyRecordKey({ ...base, requestId: null })).toBe(historyRecordKey(base));
    expect(historyRecordKey({ ...base, requestId: undefined })).toBe(historyRecordKey(base));
    expect(historyRecordKey({ ...base, requestId: '   ' })).toBe(historyRecordKey(base));
  });

  it('无 agentRunId 的常规记录保持原有键（行为不变）', () => {
    expect(historyRecordKey({ ...base, origin: 'chat' })).toBe(historyRecordKey(base));
    expect(historyRecordKey({ ...base, agentRunId: '' })).toBe(historyRecordKey(base));
    expect(historyRecordKey({ ...base, agentRunId: null })).toBe(historyRecordKey(base));
  });
});
