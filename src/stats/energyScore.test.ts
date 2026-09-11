import { describe, expect, it } from 'vitest';
import { energyScore, gradeFromScore, topPowerChats } from './energyScore';

function historyFor(chatId: string, startPrompt: number, delta: number, output: number, finishReason = 'stop') {
  return Array.from({ length: 6 }, (_, index) => ({
    chatId,
    timestamp: 1_700_000_000_000 + index * 60_000,
    prompt_tokens: startPrompt + index * delta,
    cache_hit_tokens: finishReason === 'stop' ? 900 : 0,
    cache_miss_tokens: finishReason === 'stop' ? 100 : 1_000,
    completion_tokens: output,
    total_tokens: startPrompt + index * delta + output,
    thinkTokens: finishReason === 'stop' ? 10 : output,
    finishReason,
  }));
}

describe('能耗评分', () => {
  it('等级阈值边界稳定', () => {
    expect(gradeFromScore(85)).toBe('A');
    expect(gradeFromScore(84.99)).toBe('B');
    expect(gradeFromScore(75)).toBe('B');
    expect(gradeFromScore(65)).toBe('C');
    expect(gradeFromScore(55)).toBe('D');
    expect(gradeFromScore(45)).toBe('E');
    expect(gradeFromScore(35)).toBe('F');
    expect(gradeFromScore(34.99)).toBe('G');
  });

  it('空历史返回低样本默认值', () => {
    const result = energyScore([], null);
    expect(result.metrics).toMatchObject({ hitRate: 0.5, truncRate: 0, thinkRatio: 0 });
    expect(result.grade).toBe(gradeFromScore(result.score));
  });

  it('低增长高命中样本优于高增长截断样本', () => {
    const good = historyFor('good', 1_000, 0, 100);
    const poor = historyFor('poor', 1_000, 1_500, 2_000, 'length');
    expect(energyScore(good, 'good').score).toBeGreaterThan(energyScore(poor, 'poor').score);
  });

  it('最耗对话按增长量倒序返回', () => {
    const history = [
      ...historyFor('low', 1_000, 0, 100),
      ...historyFor('high', 1_000, 2_000, 1_000),
    ];
    const rows = topPowerChats(history, 2);
    expect(rows.map((row) => row.chatId)).toEqual(['high', 'low']);
  });
});
