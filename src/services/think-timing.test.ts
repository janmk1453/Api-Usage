import { describe, expect, it } from 'vitest';
import {
  contentTextOf,
  createThinkClock,
  reasoningTextOf,
  resolveThinkTime,
  scanThinkChunk,
} from './think-timing';

/** 把若干 { at, payload } 组装成 SSE 文本块，模拟真实流式分帧 */
function sse(payloads: any[]): string {
  return payloads
    .map((p) => 'data: ' + JSON.stringify(p))
    .concat('data: [DONE]')
    .join('\n');
}

const deepseek = (delta: any) => ({ choices: [{ index: 0, delta, finish_reason: null }] });

describe('reasoningTextOf / contentTextOf', () => {
  it('思维链帧带 content:null 时只认思维链，不认正文', () => {
    const record = deepseek({ content: null, reasoning_content: '思考中' });
    expect(reasoningTextOf(record)).toBe('思考中');
    expect(contentTextOf(record)).toBe('');
  });

  it('兼容 reasoning / thinking / reasoning_text 等多种字段', () => {
    expect(reasoningTextOf(deepseek({ reasoning: 'a' }))).toBe('a');
    expect(reasoningTextOf(deepseek({ reasoning_text: 'b' }))).toBe('b');
    expect(reasoningTextOf(deepseek({ thinking: 'c' }))).toBe('c');
  });

  it('兼容非流式 message 与 Anthropic 风格 delta', () => {
    expect(reasoningTextOf({ choices: [{ message: { content: '正文', reasoning_content: '想' } }] })).toBe('想');
    expect(contentTextOf({ type: 'content_block_delta', delta: { type: 'text_delta', text: '输出' } })).toBe('输出');
  });

  it('空字符串视为尚无内容', () => {
    expect(reasoningTextOf(deepseek({ reasoning_content: '' }))).toBe('');
    expect(contentTextOf(deepseek({ content: '' }))).toBe('');
  });
});

describe('scanThinkChunk / resolveThinkTime', () => {
  it('DeepSeek 式流：思维链帧含 content:null 也能测出耗时', () => {
    const clock = createThinkClock();
    // 第 1 帧：role + 空思维链 + content:null
    scanThinkChunk(clock, sse([deepseek({ role: 'assistant', content: null, reasoning_content: '' })]), 100);
    // 第 2~3 帧：思维链正文
    scanThinkChunk(clock, sse([deepseek({ content: null, reasoning_content: '第一段' })]), 900);
    scanThinkChunk(clock, sse([deepseek({ content: null, reasoning_content: '第二段' })]), 2400);
    // 第 4 帧起：正文
    scanThinkChunk(clock, sse([deepseek({ content: '答案' })]), 3000);
    expect(resolveThinkTime(clock, 3200)).toBe(2100);
    expect(clock.contentFrames).toBe(1);
  });

  it('OpenRouter 式 reasoning 字段同样可测，多帧正文累加', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([deepseek({ reasoning: '想' })]), 500);
    scanThinkChunk(clock, sse([deepseek({ content: '答' })]), 1800);
    scanThinkChunk(clock, sse([deepseek({ content: '案' })]), 2000);
    expect(resolveThinkTime(clock, 2200)).toBe(1300);
    expect(clock.contentFrames).toBe(2);
  });

  it('只有思维链没有正文时回退到最后一帧思维链', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([deepseek({ reasoning_content: '想' })]), 400);
    scanThinkChunk(clock, sse([deepseek({ reasoning_content: '继续想' })]), 1600);
    expect(resolveThinkTime(clock, 5000)).toBe(1200);
  });

  it('无思维链时耗时为 0', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([deepseek({ content: '直接回答' })]), 800);
    expect(resolveThinkTime(clock, 900)).toBe(0);
  });

  it('起止落在同一帧时归 0，不产生假耗时', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([deepseek({ reasoning_content: '想', content: '答' })]), 1200);
    expect(resolveThinkTime(clock, 1300)).toBe(0);
  });

  it('非 data: 行、[DONE]、坏 JSON 一律忽略', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, 'event: ping\n: keep-alive\ndata: {broken\ndata: [DONE]', 300);
    expect(clock.startAt).toBeNull();
    expect(clock.contentFrames).toBe(0);
    expect(resolveThinkTime(clock, 400)).toBe(0);
  });
});
