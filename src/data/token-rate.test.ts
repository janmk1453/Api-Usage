import { describe, expect, it } from 'vitest';
import {
  MAX_PLAUSIBLE_RATE,
  MIN_PREFILL_SAMPLES,
  computeTokenRate,
  estimateTokenRate,
  measureTokenRate,
  prefillReferenceMs,
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

describe('速率估算（非流式 / 假流式 / 首字缺失）', () => {
  it('拿不到首字参考时按整轮耗时估算，并标记 duration 口径', () => {
    // 900 token / 5s = 180 t/s（分母含排队与输入处理，只能当下限）
    expect(estimateTokenRate({ duration: 5_000, completionTokens: 900 })).toEqual({ rate: 180, source: 'duration' });
    expect(estimateTokenRate({ duration: 5_000, completionTokens: 900, prefillMs: null })).toEqual({ rate: 180, source: 'duration' });
  });

  it('有首字参考时先扣掉输入处理时间，按生成窗口估算', () => {
    // 900 token / (5000 - 2000) = 300 t/s
    expect(estimateTokenRate({ duration: 5_000, completionTokens: 900, prefillMs: 2_000 })).toEqual({ rate: 300, source: 'prefill' });
  });

  it('首字参考吃掉几乎全部耗时时退回整轮耗时口径', () => {
    // 扣完只剩 100ms，低于最小窗口 → duration 口径 900 / 1s = 900 t/s
    expect(estimateTokenRate({ duration: 1_000, completionTokens: 900, prefillMs: 950 })).toEqual({ rate: 900, source: 'duration' });
  });

  it('估算值按上限封顶，不写成 0（否则短耗时干脆没有读数）', () => {
    expect(estimateTokenRate({ duration: 200, completionTokens: 5_000 })).toEqual({ rate: MAX_PLAUSIBLE_RATE, source: 'duration' });
  });

  it('无耗时或无输出时不估算', () => {
    expect(estimateTokenRate({ duration: 0, completionTokens: 900 })).toBeNull();
    expect(estimateTokenRate({ duration: 5_000, completionTokens: 0 })).toBeNull();
    expect(estimateTokenRate({ duration: NaN, completionTokens: 900 })).toBeNull();
  });

  it('首字参考优先同模型中位数，样本不足才退到全模型', () => {
    const sameModel = [
      { model: 'a', ttft: 1_000, duration: 10_000, streamed: true },
      { model: 'a', ttft: 3_000, duration: 10_000, streamed: true },
      { model: 'a', ttft: 2_000, duration: 10_000, streamed: true },
    ];
    expect(prefillReferenceMs(sameModel, 'a')).toBe(2_000);
    expect(MIN_PREFILL_SAMPLES).toBe(3);

    const mixed = [
      { model: 'a', ttft: 1_000, duration: 10_000, streamed: true },
      { model: 'a', ttft: 3_000, duration: 10_000, streamed: true },
      { model: 'b', ttft: 500, duration: 10_000, streamed: true },
      { model: 'b', ttft: 700, duration: 10_000, streamed: true },
      { model: 'b', ttft: 900, duration: 10_000, streamed: true },
    ];
    // a 只有 2 条（不足 MIN_PREFILL_SAMPLES）→ 五条合并取中位数 900
    expect(prefillReferenceMs(mixed, 'a')).toBe(900);
  });

  it('首字参考只认可信样本：非流式、无首字、首字即全文都剔除', () => {
    const noise = [
      { model: 'a', ttft: 5_000, duration: 10_000, streamed: false },
      { model: 'a', ttft: 0, duration: 10_000, streamed: true },
      { model: 'a', ttft: 9_900, duration: 10_000, streamed: true },
      { model: 'a', ttft: 0, duration: 0, streamed: true },
    ];
    expect(prefillReferenceMs(noise, 'a')).toBeNull();
    expect(prefillReferenceMs([], 'a')).toBeNull();
    expect(prefillReferenceMs(null, 'a')).toBeNull();
  });
});
