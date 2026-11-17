import { describe, it, expect, afterEach } from 'vitest';
import {
  ESTIMATE_VERSION,
  charStats,
  estimatePromptTokens,
  estimateTextTokens,
  messagesText,
  tokensFromChars,
} from './token-estimate';

const HOST_KEY = '__ausTestHost';

function setTokenCounter(counter: any) {
  (globalThis as any).SillyTavern = { getContext: () => ({ getTokenCountAsync: counter }) };
}

afterEach(() => {
  delete (globalThis as any).SillyTavern;
  delete (globalThis as any)[HOST_KEY];
});

describe('token 估算', () => {
  it('统计字符数与 CJK 字符数', () => {
    expect(charStats('你好abc')).toEqual({ chars: 5, cjkChars: 2 });
    expect(charStats('')).toEqual({ chars: 0, cjkChars: 0 });
    expect(charStats(null)).toEqual({ chars: 0, cjkChars: 0 });
  });

  it('字符启发式：CJK 0.6/字、其余 3.5 字符/token', () => {
    expect(tokensFromChars({ chars: 0, cjkChars: 0 })).toBe(0);
    expect(tokensFromChars({ chars: 10, cjkChars: 10 })).toBe(6);
    expect(tokensFromChars({ chars: 7, cjkChars: 0 })).toBe(2);
    // cjkChars 超过 chars 时按 chars 钳制，不出现负数
    expect(tokensFromChars({ chars: 2, cjkChars: 99 })).toBe(2);
  });

  it('messages 拍平成带角色的文本，数组内容也能取到', () => {
    const text = messagesText([
      { role: 'system', content: '规则' },
      { role: 'user', content: [{ type: 'text', text: '你好' }, '世界'] },
      null,
    ]);
    expect(text).toContain('system: 规则');
    expect(text).toContain('user: 你好世界');
    expect(messagesText(undefined)).toBe('');
  });

  it('优先用酒馆已算好的 token_count', async () => {
    setTokenCounter(async () => 999);
    const result = await estimateTextTokens('随便什么内容', { preferTokens: 42 });
    expect(result).toEqual({ tokens: 42, method: 'tavern-token-count', chars: 6, cjkChars: 6 });
  });

  it('没有 preferTokens 时走酒馆 tokenizer', async () => {
    setTokenCounter(async (text: string) => text.length * 2);
    const result = await estimateTextTokens('abc');
    expect(result.method).toBe('tavern-tokenizer');
    expect(result.tokens).toBe(6);
  });

  it('tokenizer 抛错或返回 0 时退回字符启发式', async () => {
    setTokenCounter(async () => { throw new Error('boom'); });
    const failed = await estimateTextTokens('abcdefg');
    expect(failed.method).toBe('char-heuristic');
    expect(failed.tokens).toBe(2);

    setTokenCounter(async () => 0);
    const zero = await estimateTextTokens('abcdefg');
    expect(zero.method).toBe('char-heuristic');
  });

  it('没有酒馆环境时也能给出估算，且不抛出', async () => {
    const result = await estimateTextTokens('这是一段中文');
    expect(result.method).toBe('char-heuristic');
    expect(result.chars).toBe(6);
  });

  it('输入侧按整轮 messages 计数，空消息返回 0', async () => {
    const prompt = await estimatePromptTokens([{ role: 'user', content: 'hi' }]);
    expect(prompt.tokens).toBeGreaterThan(0);
    const empty = await estimatePromptTokens([]);
    expect(empty).toEqual({ tokens: 0, method: 'char-heuristic', chars: 0, cjkChars: 0 });
  });

  it('估算版本号是正整数常量', () => {
    expect(Number.isInteger(ESTIMATE_VERSION)).toBe(true);
    expect(ESTIMATE_VERSION).toBeGreaterThan(0);
  });
});
