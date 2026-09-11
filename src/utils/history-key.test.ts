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
});
