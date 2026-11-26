import { describe, expect, it } from 'vitest';
import { createFrameNormalizer } from './frame-normalizer';
import {
  contentTextOf,
  createThinkClock,
  hasToolCallDelta,
  judgeStreamedFromClock,
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
    expect(clock.sseFrames).toBe(0);
    expect(resolveThinkTime(clock, 400)).toBe(0);
  });
});

describe('真假流式判定（judgeStreamedFromClock）', () => {
  const toolCall = (index: number, args = '') => ({ index, type: 'function', function: { name: 'get_weather', arguments: args } });

  it('纯工具调用流：没有正文帧也能判成真流式', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([
      deepseek({ role: 'assistant', content: null, tool_calls: [toolCall(0)] }),
      deepseek({ tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] }),
      deepseek({ tool_calls: [{ index: 0, function: { arguments: '"杭州"}' } }] }),
    ]), 500);
    expect(clock.contentFrames).toBe(0);
    expect(clock.deltaFrames).toBe(3);
    expect(judgeStreamedFromClock(clock, true)).toBe(true);
  });

  it('工具调用被一次性塞进一帧：判为非流式', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([deepseek({ content: null, tool_calls: [toolCall(0, '{"city":"杭州"}')] })]), 800);
    expect(clock.deltaFrames).toBe(1);
    expect(judgeStreamedFromClock(clock, true)).toBe(false);
  });

  it('只有 usage 末帧的 SSE：判为未知，交给数值兜底', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([{ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }]), 900);
    expect(clock.sseFrames).toBe(1);
    expect(clock.deltaFrames).toBe(0);
    expect(judgeStreamedFromClock(clock, true)).toBeNull();
  });

  it('请求声明流式但上游回了整段 JSON：没有任何 SSE 帧，判为非流式', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, '{"choices":[{"message":{"content":"一次性返回"}}]}', 900);
    expect(clock.sseFrames).toBe(0);
    expect(judgeStreamedFromClock(clock, true)).toBe(false);
  });

  it('请求未声明流式：直接判为非流式', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([deepseek({ content: '一' }), deepseek({ content: '二' })]), 300);
    expect(judgeStreamedFromClock(clock, false)).toBe(false);
  });

  it('多帧思维链同样算流式增量', () => {
    const clock = createThinkClock();
    scanThinkChunk(clock, sse([deepseek({ reasoning_content: '想' })]), 400);
    scanThinkChunk(clock, sse([deepseek({ reasoning_content: '继续想' })]), 900);
    expect(clock.deltaFrames).toBe(2);
    expect(judgeStreamedFromClock(clock, true)).toBe(true);
  });

  it('经过帧归一化投影后，工具调用帧既不丢失也不被误判', () => {
    const sseText = [
      'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '' } }] } }] }),
      'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":"杭州"}' } }] } }] }),
      'data: ' + JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }),
      'data: ' + JSON.stringify({ choices: [], usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 } }),
      'data: [DONE]',
    ].join('\n');
    const projected = createFrameNormalizer().projectSse(sseText);
    const clock = createThinkClock();
    scanThinkChunk(clock, projected, 600);
    expect(clock.deltaFrames).toBe(2);
    expect(clock.contentFrames).toBe(0);
    expect(judgeStreamedFromClock(clock, true)).toBe(true);
  });

  it('Anthropic input_json_delta 与 Gemini functionCall 都算工具增量', () => {
    expect(hasToolCallDelta({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{' } })).toBe(true);
    expect(hasToolCallDelta({ candidates: [{ content: { parts: [{ functionCall: { name: 'f' } }] } }] })).toBe(true);
    expect(hasToolCallDelta(deepseek({ content: '正文' }))).toBe(false);
    expect(hasToolCallDelta({ choices: [{ delta: { tool_calls: [] } }] })).toBe(false);
  });
});
