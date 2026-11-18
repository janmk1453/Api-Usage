import { describe, it, expect } from 'vitest';
import { pickPromptMessages, normalizeTiming } from './interception';
import { estimatePromptTokens } from './token-estimate';

/** 真机样本：35 条消息、25903 字符的完整上下文，对照被 slice(-10) 裁剪后的 1826 字符 */
function makeMessages(count: number, charsPerMessage: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i === 0 ? 'system' : 'user',
    content: '字'.repeat(charsPerMessage) + '#' + i,
  }));
}

describe('pickPromptMessages（估算输入口径）', () => {
  it('优先用完整上下文', () => {
    const full = makeMessages(35, 700);
    const truncated = full.slice(-10);
    const picked = pickPromptMessages(full, truncated);
    expect(picked).toBe(full);
    expect(picked.length).toBe(35);
  });

  it('完整上下文缺失时回退到最近 10 条摘要', () => {
    const truncated = makeMessages(10, 10);
    expect(pickPromptMessages(undefined, truncated)).toBe(truncated);
    expect(pickPromptMessages([], truncated)).toBe(truncated);
    expect(pickPromptMessages(null, null)).toEqual([]);
    expect(pickPromptMessages('not-an-array', {})).toEqual([]);
  });

  it('完整上下文让输入估算回到真实量级（不再只算最近 10 条）', async () => {
    const full = makeMessages(35, 700);
    const truncated = full.slice(-10);
    const fullEst = await estimatePromptTokens(pickPromptMessages(full, truncated));
    const cutEst = await estimatePromptTokens(truncated);
    expect(fullEst.method).toBe('char-heuristic');
    // 完整上下文必然显著多于裁剪后的摘要，且字符数就是完整上下文的字符数
    expect(fullEst.tokens).toBeGreaterThan(cutEst.tokens * 2);
    expect(fullEst.chars).toBeGreaterThan(24000);
    expect(cutEst.chars).toBeLessThan(8000);
  });
});

describe('normalizeTiming（首字与思维链耗时自洽）', () => {
  it('没有首字时思维链耗时归零', () => {
    expect(normalizeTiming(0, 64975)).toEqual({ ttft: 0, thinkTime: 0 });
    expect(normalizeTiming(null, 1234)).toEqual({ ttft: 0, thinkTime: 0 });
    expect(normalizeTiming(undefined, undefined)).toEqual({ ttft: 0, thinkTime: 0 });
    expect(normalizeTiming(-5, 900)).toEqual({ ttft: 0, thinkTime: 0 });
  });

  it('有首字时保留思维链耗时', () => {
    expect(normalizeTiming(1603, 12000)).toEqual({ ttft: 1603, thinkTime: 12000 });
    expect(normalizeTiming(500, -1)).toEqual({ ttft: 500, thinkTime: 0 });
    expect(normalizeTiming(500, Number.NaN)).toEqual({ ttft: 500, thinkTime: 0 });
  });
});
