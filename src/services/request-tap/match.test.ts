import { describe, expect, it } from 'vitest';
import {
  MATCH_WINDOW_MS,
  findEstimatedSettlement,
  findSettlement,
  modelLooseMatch,
  normalizeModel,
  probeKeyOf,
  stripModelTag,
} from './match';

/**
 * 探针对账（request-tap/match.ts）的判定规则。
 *
 * 这层唯一的职责是回答「这条请求有没有被现有链路写进历史」，
 * 判错的两个方向都会伤到用户：漏配 → 健康提示里冒出「疑似没记进历史」的假警报；
 * 错配 → 一条入账被两条请求共用，真实没记账的那条被掩盖。
 */

const settlement = (patch: Partial<Parameters<typeof findSettlement>[1][number]> = {}) => ({
  id: 's1',
  model: 'deepseek-v4-flash',
  prompt: 100,
  completion: 50,
  total: 150,
  ts: Date.now(),
  ...patch,
});

const probe = (patch: Partial<Parameters<typeof findSettlement>[0]> = {}) => ({
  model: 'deepseek-v4-flash',
  prompt: 100,
  completion: 50,
  total: 150,
  at: Date.now(),
  endedAt: Date.now(),
  ...patch,
});

describe('模型名归一化', () => {
  it('剥掉开头的方括号标签，保留名字里的其它方括号', () => {
    expect(stripModelTag('[A]gemini-3.8-flash')).toBe('gemini-3.8-flash');
    expect(stripModelTag('[Proxy] [anti-cut] deepseek-v4')).toBe('[anti-cut] deepseek-v4');
    expect(stripModelTag('  [AntiTrunc]deepseek-v4  ')).toBe('deepseek-v4');
    expect(stripModelTag('deepseek-v4[a]')).toBe('deepseek-v4[a]');
    expect(stripModelTag('')).toBe('');
  });

  it('比较时统一小写', () => {
    expect(normalizeModel('[A]Gemini-3.8-Flash')).toBe('gemini-3.8-flash');
  });

  it('宽松比较只容忍短横线后的档位后缀', () => {
    expect(modelLooseMatch('deepseek-v4-flash', 'deepseek-v4-flash-free')).toBe(true);
    expect(modelLooseMatch('deepseek-v4-flash', 'deepseek-v4-flash-thinking')).toBe(true);
    // 数字开头说明是另一个版本号，绝不能当成档位后缀
    expect(modelLooseMatch('deepseek-v4', 'deepseek-v4.1-flash')).toBe(false);
    expect(modelLooseMatch('deepseek-v4', 'deepseek-v4.1')).toBe(false);
    expect(modelLooseMatch('gemini-3.8', 'deepseek-v4-flash')).toBe(false);
    expect(modelLooseMatch('', 'deepseek-v4')).toBe(false);
    // 后缀过长（超过 24 字符）不认，避免把完全不同的模型名截断成同一个
    expect(modelLooseMatch('deepseek-v4', 'deepseek-v4-' + 'x'.repeat(30))).toBe(false);
  });
});

describe('findSettlement：有用量时的对账', () => {
  it('prompt 与 completion 全等时命中，依据是 tokens', () => {
    const hit = findSettlement(probe(), [settlement()], new Set());
    expect(hit?.by).toBe('tokens');
    expect(hit?.settlement.id).toBe('s1');
  });

  it('上游只给总数时用 total 兜底', () => {
    const hit = findSettlement(probe({ prompt: 0, completion: 0 }), [settlement()], new Set());
    expect(hit?.by).toBe('total');
  });

  it('已经消费过的入账不再参与匹配（一对一）', () => {
    const used = new Set(['s1']);
    expect(findSettlement(probe(), [settlement()], used)).toBe(null);
  });

  it('两条探针不会共用同一条入账', () => {
    const used = new Set<string>();
    const first = findSettlement(probe(), [settlement()], used);
    expect(first?.settlement.id).toBe('s1');
    if (first) used.add(first.settlement.id);
    const second = findSettlement(probe(), [settlement()], used);
    expect(second).toBe(null);
  });

  it('时间窗外的入账不配，窗内边界值仍算命中', () => {
    const now = Date.now();
    const p = probe({ at: now, endedAt: now });
    expect(MATCH_WINDOW_MS).toBe(60000);
    const inside = settlement({ ts: now - MATCH_WINDOW_MS });
    const outside = settlement({ ts: now - MATCH_WINDOW_MS - 1 });
    expect(findSettlement(p, [inside], new Set())?.settlement.id).toBe('s1');
    expect(findSettlement(p, [outside], new Set())).toBe(null);
  });

  it('结束时刻之后按 endedAt 起算窗口，长请求不会被判成过期', () => {
    const now = Date.now();
    const p = probe({ at: now - 120000, endedAt: now });
    expect(findSettlement(p, [settlement({ ts: now + 1000 })], new Set())?.settlement.id).toBe('s1');
  });

  it('前缀标签不影响对账：探针抓原名，入账已归一', () => {
    const hit = findSettlement(
      probe({ model: '[A]deepseek-v4-flash' }),
      [settlement({ model: 'deepseek-v4-flash' })],
      new Set(),
    );
    expect(hit?.by).toBe('tokens');
  });

  it('名字对不上但用量全等：宽松名匹配成立才配，否则宁可漏配', () => {
    const loose = findSettlement(
      probe({ model: 'deepseek-v4-flash-free' }),
      [settlement({ model: 'deepseek-v4-flash' })],
      new Set(),
    );
    expect(loose?.by).toBe('model');
    expect(loose?.settlement.id).toBe('s1');

    const unrelated = findSettlement(
      probe({ model: 'gemini-3.8-flash' }),
      [settlement({ model: 'deepseek-v4-flash' })],
      new Set(),
    );
    expect(unrelated).toBe(null);
  });

  it('名字不同且用量不全等时不配', () => {
    const hit = findSettlement(
      probe({ model: 'gemini-3.8-flash', prompt: 1, completion: 1 }),
      [settlement()],
      new Set(),
    );
    expect(hit).toBe(null);
  });
});

describe('findEstimatedSettlement：探针没拿到用量时的弱对账', () => {
  const estimated = (patch: Partial<ReturnType<typeof settlement>> = {}) =>
    settlement({ id: 'e1', estimated: true, prompt: 0, completion: 0, total: 0, ...patch });

  it('只认模型一致、时间窗内的估算条目，并取最近的一条', () => {
    const now = Date.now();
    const near = estimated({ id: 'near', ts: now - 1000 });
    const far = estimated({ id: 'far', ts: now - 40000 });
    const hit = findEstimatedSettlement(probe({ prompt: 0, completion: 0, total: 0, at: now, endedAt: now }), [far, near], new Set());
    expect(hit?.id).toBe('near');
  });

  it('探针自己拿到了用量就不走弱对账（交给 findSettlement）', () => {
    expect(findEstimatedSettlement(probe(), [estimated()], new Set())).toBe(null);
  });

  it('非估算条目不算「确认记过账」', () => {
    const hit = findEstimatedSettlement(
      probe({ prompt: 0, completion: 0, total: 0 }),
      [settlement({ estimated: false })],
      new Set(),
    );
    expect(hit).toBe(null);
  });

  it('模型对不上或已被消费时不配', () => {
    const p = probe({ prompt: 0, completion: 0, total: 0, model: 'gemini-3.8-flash' });
    expect(findEstimatedSettlement(p, [estimated()], new Set())).toBe(null);
    expect(findEstimatedSettlement(probe({ prompt: 0, completion: 0, total: 0 }), [estimated()], new Set(['e1']))).toBe(null);
  });
});

describe('probeKeyOf', () => {
  it('有用量时原样带入，没有用量时补 0', () => {
    expect(probeKeyOf({ model: 'm', usage: { prompt: 1, completion: 2, total: 3 }, at: 10, endedAt: 20 }))
      .toEqual({ model: 'm', prompt: 1, completion: 2, total: 3, at: 10, endedAt: 20 });
    expect(probeKeyOf({ model: 'm', usage: null, at: 10, endedAt: 0 }))
      .toEqual({ model: 'm', prompt: 0, completion: 0, total: 0, at: 10, endedAt: 0 });
  });
});
