/**
 * 消息 ↔ 用量记录配对 —— 纯逻辑单测
 *
 * 真实锚点取自酒馆内核写进消息的字段（gen_started / gen_finished / extra.prompt_cache / extra.model），
 * 这里只验证判定规则；DOM 注入交给真机。
 */
import { describe, it, expect } from 'vitest';
import { matchMessageUsage, toMs } from './match';

const T0 = Date.parse('2026-11-22T06:00:00.000Z');

function entry(overrides: Record<string, any> = {}) {
  return {
    timestamp: T0 + 3000,
    model: 'hy4-flash',
    cost: 0.0123,
    pricingSource: 'wallet',
    prompt_tokens: 18427,
    cache_hit_tokens: 0,
    cache_miss_tokens: 18427,
    completion_tokens: 11213,
    ttft: 820,
    tokenRate: 123,
    cache_hit_rate: 0,
    chatId: 'chat-1',
    requestOrigin: { kind: 'tavern', id: null, label: '酒馆主界面' },
    ...overrides,
  };
}

describe('toMs', () => {
  it('接受 Date / 数字 / ISO 字符串，其余返回 null', () => {
    expect(toMs(new Date(T0))).toBe(T0);
    expect(toMs(T0)).toBe(T0);
    expect(toMs('2026-11-22T06:00:00.000Z')).toBe(T0);
    expect(toMs(null)).toBeNull();
    expect(toMs(undefined)).toBeNull();
    expect(toMs('不是时间')).toBeNull();
  });
});

describe('matchMessageUsage', () => {
  it('没有锚点或没有记录时返回 null', () => {
    expect(matchMessageUsage(null, [entry()])).toBeNull();
    expect(matchMessageUsage({ genStarted: new Date(T0), genFinished: new Date(T0 + 3000) }, [])).toBeNull();
  });

  it('消息上的缓存用量与记录完全相等时按指纹命中', () => {
    const usage = matchMessageUsage({
      chatId: 'chat-1',
      genStarted: new Date(T0),
      genFinished: new Date(T0 + 3000),
      promptCache: { input_tokens: 18427, cached_tokens: 0 },
    }, [entry()]);
    expect(usage?.confidence).toBe('fingerprint');
    expect(usage?.cost).toBe(0.0123);
    expect(usage?.completionTokens).toBe(11213);
  });

  it('指纹对不上时退到时间窗，取离 gen_finished 最近的一条', () => {
    const far = entry({ timestamp: T0 + 1000, prompt_tokens: 111 });
    const near = entry({ timestamp: T0 + 2900, prompt_tokens: 222 });
    const usage = matchMessageUsage({
      chatId: 'chat-1',
      genStarted: new Date(T0),
      genFinished: new Date(T0 + 3000),
      promptCache: { input_tokens: 18427, cached_tokens: 0 },
    }, [far, near]);
    expect(usage?.confidence).toBe('time');
    expect(usage?.promptTokens).toBe(222);
  });

  it('扩展直连与 iframe 脚本的记录不算这一轮对话', () => {
    const usage = matchMessageUsage({
      chatId: 'chat-1',
      genStarted: new Date(T0),
      genFinished: new Date(T0 + 3000),
    }, [entry({ requestOrigin: { kind: 'extension', id: 'ST-BaiBai-Image', label: '扩展 · ST-BaiBai-Image' } })]);
    expect(usage).toBeNull();
  });

  it('旧记录没有来源字段时按酒馆自身放行', () => {
    const legacy = entry();
    delete (legacy as any).requestOrigin;
    expect(matchMessageUsage({ chatId: 'chat-1', genStarted: new Date(T0), genFinished: new Date(T0 + 3000) }, [legacy])?.cost).toBe(0.0123);
  });

  it('窗口外的记录不会被认领', () => {
    const usage = matchMessageUsage({
      chatId: 'chat-1',
      genStarted: new Date(T0),
      genFinished: new Date(T0 + 3000),
    }, [entry({ timestamp: T0 + 60000 })]);
    expect(usage).toBeNull();
  });

  it('另一条聊天的记录不参与配对', () => {
    const usage = matchMessageUsage({
      chatId: 'chat-2',
      genStarted: new Date(T0),
      genFinished: new Date(T0 + 3000),
    }, [entry({ chatId: 'chat-1' })]);
    expect(usage).toBeNull();
  });

  it('没有 gen_finished 时，窗口内唯一候选才采用（弱兜底）', () => {
    const usage = matchMessageUsage({ chatId: 'chat-1', genStarted: new Date(T0) }, [entry()]);
    expect(usage?.confidence).toBe('loose');
    const ambiguous = matchMessageUsage({ chatId: 'chat-1', genStarted: new Date(T0) }, [entry(), entry({ timestamp: T0 + 1000, prompt_tokens: 999 })]);
    expect(ambiguous?.confidence).toBe('time');
  });

  it('两条候选一样近且 Token 不同：并发歧义，宁可不显示', () => {
    const a = entry({ timestamp: T0 + 3000 });
    const b = entry({ timestamp: T0 + 3100, prompt_tokens: 30000, completion_tokens: 4000 });
    expect(matchMessageUsage({
      chatId: 'chat-1',
      genStarted: new Date(T0),
      genFinished: new Date(T0 + 3000),
    }, [a, b])).toBeNull();
  });

  it('用量字段缺失时补 0，命中率按命中/输入回算', () => {
    const usage = matchMessageUsage({
      chatId: 'chat-1',
      genStarted: new Date(T0),
      genFinished: new Date(T0 + 3000),
    }, [entry({ cache_hit_tokens: 10000, prompt_tokens: 20000, cache_miss_tokens: undefined, cache_hit_rate: undefined })]);
    expect(usage?.cacheHitRate).toBe(50);
    expect(usage?.cacheMissTokens).toBe(10000);
  });
});
