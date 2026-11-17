import { describe, expect, it } from 'vitest';
import {
  MAX_PLAUSIBLE_RATE,
  computeTokenRate,
  measureTokenRate,
  sanitizeHistoryTiming,
  sanitizeRate,
} from './token-rate';

describe('输出速率口径', () => {
  it('流式请求按生成阶段窗口计算速率', () => {
    // 耗时 10s、首字 2s、输出 400 token → 400 / 8s = 50 t/s
    expect(computeTokenRate({ duration: 10_000, ttft: 2_000, completionTokens: 400, streamed: true })).toBe(50);
  });

  it('非流式请求速率归零', () => {
    expect(computeTokenRate({ duration: 43_200, ttft: 42_800, completionTokens: 3_427, streamed: false })).toBe(0);
  });

  it('TTFT 缺失或非正数时不计速率', () => {
    expect(computeTokenRate({ duration: 10_000, ttft: 0, completionTokens: 400 })).toBe(0);
  });

  it('生成阶段窗口过短时归零', () => {
    // 3427 / 0.1s = 34270 t/s，窗口 100ms 低于下限
    expect(computeTokenRate({ duration: 43_000, ttft: 42_900, completionTokens: 3_427 })).toBe(0);
  });

  it('超过上限的速率归零', () => {
    // 3427 / 0.35s ≈ 9791 t/s
    expect(computeTokenRate({ duration: 43_200, ttft: 42_850, completionTokens: 3_427 })).toBe(0);
    expect(MAX_PLAUSIBLE_RATE).toBe(1000);
  });

  it('无输出或无耗时归零', () => {
    expect(computeTokenRate({ duration: 10_000, ttft: 2_000, completionTokens: 0 })).toBe(0);
    expect(computeTokenRate({ duration: 0, ttft: 0, completionTokens: 400 })).toBe(0);
  });

  it('测量口径：不可测时返回 null，而不是写成 0', () => {
    expect(measureTokenRate(null)).toBeNull();
    // 非流式
    expect(measureTokenRate({ duration: 43_200, ttft: 42_800, completion_tokens: 3_427, streamed: false })).toBeNull();
    // TTFT 缺失
    expect(measureTokenRate({ duration: 10_000, ttft: 0, completion_tokens: 400 })).toBeNull();
    // 没有输出
    expect(measureTokenRate({ duration: 10_000, ttft: 2_000, completion_tokens: 0 })).toBeNull();
    // 生成窗口过短
    expect(measureTokenRate({ duration: 43_000, ttft: 42_900, completion_tokens: 3_427 })).toBeNull();
  });

  it('测量口径：首字即全文（假流式）不产生速率', () => {
    // 真机样本：输入 25438、输出 2、耗时 1700ms、首字 1697ms
    expect(measureTokenRate({ duration: 1_700, ttft: 1_697, completion_tokens: 2, streamed: null })).toBeNull();
  });

  it('测量口径：保留未截断的真实速率，只在入库时收敛', () => {
    const sample = { duration: 4_000, ttft: 500, completion_tokens: 6_000, streamed: true };
    // 6000 token / 3.5s ≈ 1714.29 t/s：超过入库上限，但健康扫描要看得见
    expect(measureTokenRate(sample)).toBeCloseTo(1714.29, 1);
    // 入库按上限归 0，历史列表里显示为未测速
    expect(computeTokenRate({ duration: sample.duration, ttft: sample.ttft, completionTokens: sample.completion_tokens, streamed: true })).toBe(0);
  });

  it('清洗历史速率：超上限与非法值归零', () => {
    expect(sanitizeRate(8_064)).toBe(0);
    expect(sanitizeRate(-5)).toBe(0);
    expect(sanitizeRate(NaN)).toBe(0);
    expect(sanitizeRate('42.4')).toBe(42);
  });

  it('迁移清洗：TTFT 接近总耗时则速率与 TTFT 一并归零', () => {
    const bad = { duration: 43_200, ttft: 42_800, tokenRate: 8_064 };
    expect(sanitizeHistoryTiming(bad)).toBe(true);
    expect(bad).toMatchObject({ tokenRate: 0, ttft: 0 });

    const good = { duration: 43_200, ttft: 2_000, tokenRate: 50 };
    expect(sanitizeHistoryTiming(good)).toBe(false);
    expect(good).toMatchObject({ tokenRate: 50, ttft: 2_000 });
  });
});