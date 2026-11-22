import { describe, it, expect } from 'vitest';
import {
  interruptKindOf,
  isEstimatedEntry,
  isInterruptedEntry,
  isConversationEntry,
  isReliableCacheSample,
  isReliableForecastSample,
  isReliablePerformanceSample,
} from './sample-quality';

describe('统计样本质量', () => {
  it('识别估算与中断记录', () => {
    expect(isEstimatedEntry({ usageSource: 'estimated' })).toBe(true);
    expect(isEstimatedEntry({ usageSource: 'upstream' })).toBe(false);
    expect(isInterruptedEntry({ interrupted: 'user' })).toBe(true);
    expect(isInterruptedEntry({ interrupted: 'upstream' })).toBe(true);
    expect(isInterruptedEntry({})).toBe(false);
    expect(interruptKindOf({ interrupted: 'upstream' })).toBe('upstream');
    expect(interruptKindOf({ interrupted: 'oops' as any })).toBeNull();
  });

  it('性能样本要求有耗时且非估算非中断', () => {
    expect(isReliablePerformanceSample({ duration: 1500 })).toBe(true);
    expect(isReliablePerformanceSample({ duration: 0 })).toBe(false);
    expect(isReliablePerformanceSample({ duration: 1500, usageSource: 'estimated' })).toBe(false);
    expect(isReliablePerformanceSample({ duration: 1500, interrupted: 'user' })).toBe(false);
  });

  it('缓存样本额外排除「缓存未知」的估算', () => {
    expect(isReliableCacheSample({ duration: 1000 })).toBe(true);
    // 缓存未知（估算时命中数按 0 处理）：不能当命中率样本，否则会把全站命中率拉低
    expect(isReliableCacheSample({ duration: 1000, estimateCacheUnknown: true })).toBe(false);
    expect(isReliableCacheSample({ duration: 0, estimateCacheUnknown: true })).toBe(false);
  });

  it('预测样本只排除中断与估算，不要求耗时', () => {
    expect(isReliableForecastSample({ duration: 0 })).toBe(true);
    expect(isReliableForecastSample({ usageSource: 'estimated' })).toBe(false);
    expect(isReliableForecastSample({ interrupted: 'upstream' })).toBe(false);
  });

  it('只有对话本身发起的请求才算序列样本', () => {
    const origin = (kind: string) => ({ requestOrigin: { kind, id: null, label: '' } as any });
    expect(isConversationEntry(origin('tavern'))).toBe(true);
    expect(isConversationEntry(origin('unknown'))).toBe(true);
    expect(isConversationEntry(origin('extension'))).toBe(false);
    expect(isConversationEntry(origin('script'))).toBe(false);
    // 旧记录没有来源字段，不能因为升级就被丢掉
    expect(isConversationEntry({ requestOrigin: null })).toBe(true);
    expect(isConversationEntry({})).toBe(true);
    expect(isConversationEntry(null)).toBe(false);
  });
});
