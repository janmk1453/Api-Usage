import { describe, it, expect } from 'vitest';
import { pickPromptMessages, normalizeTiming, pickEndedTurn, registerTurnForTest, clearTurnLedgerForTest, requestOriginOfRequest } from './interception';
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

describe('pickEndedTurn（并发时「刚结束那一轮」的对号）', () => {
  /**
   * 线上回归样本（3.2.3，debug.md）：argon 与 hydrogen 两轮并发在途，
   * hydrogen 先发（later 又重新发了一次），argon 后结束。旧实现只有一个单槽，
   * 取的是「最后发出」的那一轮，于是 argon 的估算记录带上了 hydrogen 的
   * startTime / requestId / 输入量，时长被写成 6653ms、输入量少算 1.8 万 token。
   */
  const scenario = () => {
    clearTurnLedgerForTest();
    const now = Date.now();
    const argon = registerTurnForTest({
      startTime: now - 180000, requestId: 'req:12', model: 'gemini-4-argon',
      endedAt: now - 1000, streamed: true, promptMessages: new Array(40).fill({ role: 'user', content: 'x'.repeat(2000) }),
    });
    const hydrogen = registerTurnForTest({
      startTime: now - 5000, requestId: 'req:13', model: 'gemini-4-hydrogen', endedAt: 0, streamed: false,
      promptMessages: new Array(4).fill({ role: 'user', content: 'y'.repeat(500) }),
    });
    return { argon, hydrogen };
  };

  it('按 tail 模型对号，不会把「最后发出」的那一轮当成刚结束的', () => {
    const { argon, hydrogen } = scenario();
    expect(pickEndedTurn('gemini-4-argon')?.requestId).toBe('req:12');
    expect(pickEndedTurn('gemini-4-hydrogen')?.requestId).toBe('req:13');
    // 时长/输入量必须来自同一轮：argon 的现场不能被 hydrogen 顶替
    expect(pickEndedTurn('gemini-4-argon')?.startTime).toBe(argon.startTime);
    expect(pickEndedTurn('gemini-4-argon')?.promptMessages).toBe(argon.promptMessages);
    expect(hydrogen.endedAt).toBe(0);
  });

  it('模型名带前缀 / 大小写差异也能对上', () => {
    scenario();
    expect(pickEndedTurn('[A]gemini-4-argon')?.requestId).toBe('req:12');
    expect(pickEndedTurn('Gemini-4-Hydrogen')?.requestId).toBe('req:13');
  });

  it('给不出模型时退回最近结束的一轮（已结束优先于仍在途）', () => {
    scenario();
    expect(pickEndedTurn(null)?.requestId).toBe('req:12');
  });

  it('估算收尾只看还没落库的轮次（includeSettled=false）', () => {
    const { argon } = scenario();
    argon.settled = true;
    argon.settledBy = 'estimated';
    expect(pickEndedTurn('gemini-4-argon', false)).toBeNull();
  });

  it('窗口内只有一轮时无歧义，模型名被上游改写也照认', () => {
    clearTurnLedgerForTest();
    registerTurnForTest({ startTime: Date.now() - 3000, requestId: 'req:solo', model: 'proxy-renamed-model', endedAt: Date.now() - 500 });
    // 单请求场景不该因为模型名对不上就漏记
    expect(pickEndedTurn('gemini-4-argon')?.requestId).toBe('req:solo');
    expect(pickEndedTurn(null)?.requestId).toBe('req:solo');
  });

  it('多轮并发且模型名全对不上时不乱认领（宁可漏记也不串账）', () => {
    scenario();
    expect(pickEndedTurn('some-unknown-model')).toBeNull();
  });

  it('超过对账窗口的旧轮次不再参与', () => {
    clearTurnLedgerForTest();
    registerTurnForTest({ startTime: Date.now() - 60 * 60 * 1000, requestId: 'req:old', model: 'm', endedAt: Date.now() - 59 * 60 * 1000 });
    expect(pickEndedTurn('m')).toBeNull();
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

describe('requestOriginOfRequest（并发来源）', () => {
  it('同一毫秒连发：各取各的来源，谁也别串给谁', () => {
    clearTurnLedgerForTest();
    const now = Date.now();
    registerTurnForTest({
      startTime: now, requestId: 'req:origin-a',
      requestOrigin: { kind: 'extension', id: 'ST-BaiBai-Image', label: 'ST-BaiBai-Image' },
    });
    registerTurnForTest({
      startTime: now, requestId: 'req:origin-b',
      requestOrigin: { kind: 'tavern', id: 'tavern', label: '酒馆主界面' },
    });
    expect(requestOriginOfRequest('req:origin-a', now)?.label).toBe('ST-BaiBai-Image');
    expect(requestOriginOfRequest('req:origin-b', now)?.kind).toBe('tavern');
  });

  it('没有 requestId 时退回 startTime 反查', () => {
    clearTurnLedgerForTest();
    const now = Date.now();
    registerTurnForTest({
      startTime: now, requestId: 'req:origin-c',
      requestOrigin: { kind: 'script', id: 'about:srcdoc', label: 'iframe 脚本' },
    });
    expect(requestOriginOfRequest(null, now)?.kind).toBe('script');
  });

  it('查不到现场就返回 null，不编一个来源出来', () => {
    clearTurnLedgerForTest();
    expect(requestOriginOfRequest('req:none', 0)).toBeNull();
    expect(requestOriginOfRequest(null, 0)).toBeNull();
  });
});
