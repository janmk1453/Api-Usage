import { describe, expect, it } from 'vitest';
import { computeChatStats, computeStatsFour } from './computed';

describe('统计聚合', () => {
  it('按对话聚合、生成回退名称并按总 Token 排序', () => {
    const history = [
      {
        chatId: 'abcdefghijklmnopqrstuv',
        chatName: null,
        cache_hit_tokens: 80,
        cache_miss_tokens: 20,
        completion_tokens: 60,
        total_tokens: 160,
        cost: 1,
      },
      {
        chatId: 'abcdefghijklmnopqrstuv',
        chatName: null,
        cache_hit_tokens: 20,
        cache_miss_tokens: 80,
        completion_tokens: 40,
        total_tokens: 140,
        cost: 2,
      },
      {
        chatId: null,
        chatName: null,
        cache_hit_tokens: 0,
        cache_miss_tokens: 100,
        completion_tokens: 400,
        total_tokens: 500,
        cost: 3,
      },
    ];

    const rows = computeChatStats(history);
    expect(rows.map((row) => row.displayName)).toEqual(['未分组/旧数据', 'abcdefgh…stuv']);
    expect(rows[0]).toMatchObject({ count: 1, total: 500, avgTokens: 500, avgHitRate: 0 });
    expect(rows[1]).toMatchObject({ count: 2, total: 300, avgTokens: 150, avgHitRate: 50 });
  });

  it('计算四小块平均、最新、极值、思维链和截断率', () => {
    const history = [
      {
        timestamp: 1,
        cost: 1,
        total_tokens: 180,
        duration: 1_000,
        tokenRate: 10,
        cache_hit_tokens: 80,
        cache_miss_tokens: 20,
        completion_tokens: 80,
        input_cost: 0.5,
        output_cost: 0.5,
        thinkTime: 100,
        thinkTokens: 20,
        finishReason: 'stop',
      },
      {
        timestamp: 2,
        cost: 3,
        total_tokens: 200,
        duration: 3_000,
        tokenRate: 30,
        cache_hit_tokens: 0,
        cache_miss_tokens: 100,
        completion_tokens: 100,
        input_cost: 1.5,
        output_cost: 1.5,
        thinkTime: 300,
        thinkTokens: 30,
        finishReason: 'length',
      },
    ];

    const result = computeStatsFour(history);
    expect(result).toMatchObject({
      avgCost: 2,
      avgTokens: 190,
      avgDuration: 2,
      avgRate: 20,
      avgInputCost: 1,
      avgInputTokens: 100,
      avgOutputCost: 1,
      avgOutputTokens: 90,
      avgThinkTime: 0.2,
      avgThinkTokens: 25,
      avgHitRate: 40,
      latestHitRate: 0,
      maxOutput: 100,
      maxInput: 100,
      maxTotal: 200,
      truncationRate: 50,
      rounds: 2,
    });
    expect(result.avgThinkRatio).toBeCloseTo((50 / 180) * 100, 8);
  });

  it('空四小块返回零值', () => {
    expect(computeStatsFour([])).toMatchObject({
      rounds: 0,
      avgCost: 0,
      latestHitRate: null,
      truncationRate: 0,
    });
  });
});
