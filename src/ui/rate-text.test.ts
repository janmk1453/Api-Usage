import { describe, expect, it } from 'vitest';
import { isEstimatedRate, rateBadgeText, rateText, rateTitle, rateValueOf } from './rate-text';

describe('速率展示口径', () => {
  it('实测速率直接显示', () => {
    expect(rateText({ tokenRate: 50 })).toBe('50 t/s');
    expect(rateText({ tokenRate: 49.6 })).toBe('50 t/s');
    expect(isEstimatedRate({ tokenRate: 50 })).toBe(false);
  });

  it('估算速率加 ≈ 前缀并给出「估算」徽标', () => {
    expect(rateText({ tokenRate: 180, rateEstimated: 'duration' })).toBe('≈180 t/s');
    expect(rateText({ tokenRate: 300, rateEstimated: 'prefill' })).toBe('≈300 t/s');
    expect(rateBadgeText({ tokenRate: 180, rateEstimated: 'duration' })).toBe('估算');
    expect(rateBadgeText({ tokenRate: 180 })).toBe('');
  });

  it('没有速率时用调用方给的兜底文案', () => {
    expect(rateText(null)).toBe('未测速');
    expect(rateText({ tokenRate: 0 }, '非流式')).toBe('非流式');
    // 只有口径没有数值：仍是没测到，不能凭空显示 ≈0
    expect(rateText({ tokenRate: 0, rateEstimated: 'duration' })).toBe('未测速');
    expect(rateValueOf({ tokenRate: -3 })).toBe(0);
  });

  it('悬浮说明区分实测与两种估算口径', () => {
    expect(rateTitle({ tokenRate: 50 })).toContain('实测');
    expect(rateTitle({ tokenRate: 180, rateEstimated: 'prefill' })).toContain('典型首字延迟');
    expect(rateTitle({ tokenRate: 180, rateEstimated: 'duration' })).toContain('下限');
    expect(rateTitle({ streamed: false })).toContain('非流式');
    expect(rateTitle({})).toContain('没有测到');
  });
});
