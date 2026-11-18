import { describe, it, expect } from 'vitest';
import {
  createFrameNormalizer,
  detectProtocol,
  geminiUsageIR,
  openaiUsageIR,
  anthropicUsageIR,
  responsesUsageIR,
  interactionsUsageIR,
} from './frame-normalizer';

/** 取出投影结果里的所有 data 帧 */
function framesOf(text: string): any[] {
  const out: any[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const p = t.slice(5).trim();
    if (!p || p === '[DONE]') continue;
    try { out.push(JSON.parse(p)); } catch { /* 忽略解析不了的帧 */ }
  }
  return out;
}

/** 模拟 intercept 的覆盖式取用量：只保留最后一个带 usage 的帧 */
function readUsage(text: string): any {
  let u: any = null;
  for (const f of framesOf(text)) if (f && f.usage) u = f.usage;
  return u;
}

/** 模拟 think-timing 的 delta 读取 */
function readDelta(text: string) {
  let content = '';
  let reasoning = '';
  let finish: string | null = null;
  for (const f of framesOf(text)) {
    const c = Array.isArray(f?.choices) ? f.choices[0] : null;
    if (!c) continue;
    const d = c.delta || c.message || {};
    if (typeof d.content === 'string') content += d.content;
    if (typeof d.reasoning_content === 'string') reasoning += d.reasoning_content;
    if (typeof c.finish_reason === 'string' && c.finish_reason) finish = c.finish_reason;
  }
  return { content, reasoning, finish };
}

describe('detectProtocol', () => {
  it('按首帧形状锁定协议', () => {
    expect(detectProtocol({ candidates: [] })).toBe('gemini');
    expect(detectProtocol({ usageMetadata: {} })).toBe('gemini');
    expect(detectProtocol({ type: 'message_start' })).toBe('anthropic');
    expect(detectProtocol({ type: 'response.output_text.delta' })).toBe('responses');
    expect(detectProtocol({ choices: [{ delta: {} }] })).toBe('openai');
    expect(detectProtocol(null)).toBe('unknown');
  });
});

describe('geminiUsageIR', () => {
  it('缓存是 prompt 的子集，toolUsePrompt 单独并入未命中，思维并入输出', () => {
    const ir = geminiUsageIR({
      promptTokenCount: 1000,
      cachedContentTokenCount: 400,
      toolUsePromptTokenCount: 50,
      candidatesTokenCount: 120,
      thoughtsTokenCount: 80,
      totalTokenCount: 1250,
    });
    expect(ir.prompt_tokens).toBe(1050);
    expect(ir.prompt_cache_hit_tokens).toBe(400);
    expect(ir.prompt_cache_miss_tokens).toBe(650); // 1000-400 再 +50
    expect(ir.completion_tokens).toBe(200); // 120 + 80，思维按输出计费
    expect(ir.completion_tokens_details.reasoning_tokens).toBe(80);
    expect(ir.total_tokens).toBe(1250);
  });

  it('cachedContentTokenCount 超过 prompt 时钳到 prompt，不产生负未命中', () => {
    const ir = geminiUsageIR({ promptTokenCount: 10, cachedContentTokenCount: 99, candidatesTokenCount: 1, totalTokenCount: 11 });
    expect(ir.prompt_cache_hit_tokens).toBe(10);
    expect(ir.prompt_cache_miss_tokens).toBe(0);
  });
});

describe('openaiUsageIR', () => {
  it('显式 reasoning_tokens 属已含思维口径，不再相加', () => {
    const ir = openaiUsageIR({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, completion_tokens_details: { reasoning_tokens: 8 } });
    expect(ir.completion_tokens).toBe(20);
    expect(ir.completion_tokens_details.reasoning_tokens).toBe(8);
    expect(ir.total_tokens).toBe(30);
  });

  it('Gemini 兼容层按 total 差值反推思维（completion 不含思维、total 含）', () => {
    const ir = openaiUsageIR({ prompt_tokens: 758, completion_tokens: 102, total_tokens: 1725 });
    expect(ir.completion_tokens_details.reasoning_tokens).toBe(865);
    expect(ir.completion_tokens).toBe(967);
    expect(ir.total_tokens).toBe(1725);
    expect(ir.prompt_tokens + ir.completion_tokens).toBe(ir.total_tokens);
  });

  it('差值恰好等于缓存或输入量时不误判为思维', () => {
    const ir = openaiUsageIR({ prompt_tokens: 100, completion_tokens: 10, total_tokens: 160, prompt_tokens_details: { cached_tokens: 50 } });
    expect(ir.completion_tokens_details.reasoning_tokens).toBe(0);
  });
});

describe('anthropicUsageIR / responsesUsageIR', () => {
  it('Anthropic 的 input 不含缓存，cache_read 记为命中、cache_creation 记未命中', () => {
    const ir = anthropicUsageIR({ input_tokens: 50, cache_read_input_tokens: 30, cache_creation_input_tokens: 5 }, 77);
    expect(ir.prompt_tokens).toBe(85);
    expect(ir.prompt_cache_hit_tokens).toBe(30);
    expect(ir.prompt_cache_miss_tokens).toBe(55);
    expect(ir.completion_tokens).toBe(77);
  });

  it('Responses 的 output_tokens 已含 reasoning', () => {
    const ir = responsesUsageIR({ input_tokens: 200, input_tokens_details: { cached_tokens: 120 }, output_tokens: 80, output_tokens_details: { reasoning_tokens: 30 }, total_tokens: 280 });
    expect(ir.prompt_cache_hit_tokens).toBe(120);
    expect(ir.prompt_cache_miss_tokens).toBe(80);
    expect(ir.completion_tokens).toBe(80);
    expect(ir.total_tokens).toBe(280);
  });
});

describe('Gemini 原生流式', () => {
  const usageMetadata = {
    promptTokenCount: 100,
    cachedContentTokenCount: 40,
    candidatesTokenCount: 30,
    thoughtsTokenCount: 20,
    totalTokenCount: 150,
  };
  const sse = [
    'data: {"candidates":[{"content":{"parts":[{"text":"思考中","thought":true}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"你"}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"好"}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"世界"}]},"finishReason":"STOP"}],"usageMetadata":' + JSON.stringify(usageMetadata) + ',"modelVersion":"gemini-2.5-pro"}',
  ].join('\n');

  it('思维走 reasoning_content，正文拼全部非 thought parts', () => {
    const n = createFrameNormalizer();
    const out = n.projectSse(sse);
    const d = readDelta(out);
    expect(d.content).toBe('你好世界'); // 不能只取 parts[0]
    expect(d.reasoning).toBe('思考中');
    expect(d.finish).toBe('stop'); // STOP → stop
  });

  it('usageMetadata 换算成 hit/miss/comp/total 且思维按输出计费', () => {
    const n = createFrameNormalizer();
    const u = readUsage(n.projectSse(sse));
    expect(u.prompt_tokens).toBe(100);
    expect(u.prompt_cache_hit_tokens).toBe(40);
    expect(u.prompt_cache_miss_tokens).toBe(60);
    expect(u.completion_tokens).toBe(50); // 30 候选 + 20 思维
    expect(u.completion_tokens_details.reasoning_tokens).toBe(20);
    expect(u.total_tokens).toBe(150);
    expect(n.protocol()).toBe('gemini');
  });

  it('原始 usage / 模型名 / 结束原因原样留存给请求日志', () => {
    const n = createFrameNormalizer();
    n.projectSse(sse);
    expect(n.rawUsage()).toEqual(usageMetadata);
    expect(n.rawModel()).toBe('gemini-2.5-pro');
    expect(n.rawFinishReason()).toBe('STOP'); // 日志里保持上游原值
    expect(n.active()).toBe(true);
  });
});

describe('Gemini 非流式', () => {
  it('JSON 数组形状合并成一条完整回复', () => {
    const n = createFrameNormalizer();
    const body = JSON.stringify([
      { candidates: [{ content: { parts: [{ text: '甲' }, { text: '乙' }] } }] },
      { candidates: [{ content: { parts: [{ text: '丙' }] }, finishReason: 'MAX_TOKENS' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } },
    ]);
    const out = n.projectWhole(body);
    const parsed = JSON.parse(out);
    expect(parsed.choices[0].message.content).toBe('甲乙丙');
    expect(parsed.choices[0].finish_reason).toBe('length');
    expect(parsed.usage.completion_tokens).toBe(5);
    expect(parsed.usage.total_tokens).toBe(15);
  });

  it('promptFeedback 被拒时给出 content_filter，避免被当成空回复丢弃', () => {
    const n = createFrameNormalizer();
    const out = n.projectWhole(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: { promptTokenCount: 10, totalTokenCount: 10 } }));
    const parsed = JSON.parse(out);
    expect(parsed.choices[0].finish_reason).toBe('content_filter');
    expect(parsed.usage.prompt_tokens).toBe(10);
    expect(n.rawFinishReason()).toBe('SAFETY');
  });
});

describe('Gemini OpenAI 兼容层', () => {
  it('每帧都带累计 usage 时只认末帧，不逐帧累加', () => {
    const n = createFrameNormalizer();
    const sse = [
      'data: {"choices":[{"delta":{"content":"a"}}],"usage":{"prompt_tokens":9,"completion_tokens":1,"total_tokens":103}}',
      'data: {"choices":[{"delta":{"content":"b"}}],"usage":{"prompt_tokens":9,"completion_tokens":3,"total_tokens":105}}',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}],"usage":{"prompt_tokens":9,"completion_tokens":3,"total_tokens":105}}',
    ].join('\n');
    const out = n.projectSse(sse);
    const u = readUsage(out);
    expect(u.total_tokens).toBe(105); // 取末帧而不是 103+105+...
    expect(u.prompt_tokens).toBe(9);
    expect(u.completion_tokens_details.reasoning_tokens).toBe(93); // 105-9-3
    expect(u.completion_tokens).toBe(96); // 3 + 93
    expect(readDelta(out).finish).toBe('length');
  });

  it('原始 usage 不被换算污染，请求日志展示上游原值', () => {
    const n = createFrameNormalizer();
    const raw = { prompt_tokens: 758, completion_tokens: 102, total_tokens: 1725 };
    n.projectSse('data: ' + JSON.stringify({ choices: [{ delta: {} }], usage: raw }));
    expect(n.rawUsage()).toEqual(raw);
  });
});

describe('Anthropic 流式', () => {
  const sse = [
    'event: message_start',
    'data: {"type":"message_start","message":{"model":"claude-sonnet-4","usage":{"input_tokens":50,"cache_read_input_tokens":30,"cache_creation_input_tokens":5,"output_tokens":1}}}',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"想一下"}}',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"答案"}}',
    'event: message_delta',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":77}}',
  ].join('\n');

  it('thinking_delta 进 reasoning、text_delta 进 content', () => {
    const n = createFrameNormalizer();
    const d = readDelta(n.projectSse(sse));
    expect(d.reasoning).toBe('想一下');
    expect(d.content).toBe('答案');
    expect(d.finish).toBe('stop');
  });

  it('输入来自 message_start、输出取 message_delta，两帧合并成一条完整用量', () => {
    const n = createFrameNormalizer();
    const u = readUsage(n.projectSse(sse));
    expect(u.prompt_cache_hit_tokens).toBe(30);
    expect(u.prompt_cache_miss_tokens).toBe(55); // 50 + 5
    expect(u.prompt_tokens).toBe(85);
    expect(u.completion_tokens).toBe(77); // 不是 message_start 里的 1
    expect(n.rawModel()).toBe('claude-sonnet-4');
    expect(n.rawFinishReason()).toBe('end_turn');
    expect(n.rawUsage()).toEqual({ input_tokens: 50, cache_read_input_tokens: 30, cache_creation_input_tokens: 5, output_tokens: 77 });
  });
});

describe('Responses API 流式', () => {
  it('delta 事件取正文与推理，completed 帧取用量', () => {
    const n = createFrameNormalizer();
    const sse = [
      'data: {"type":"response.created","response":{"model":"gpt-5"}}',
      'data: {"type":"response.reasoning_summary_text.delta","delta":"推理"}',
      'data: {"type":"response.output_text.delta","delta":"正文"}',
      'data: {"type":"response.completed","response":{"model":"gpt-5","usage":{"input_tokens":200,"input_tokens_details":{"cached_tokens":120},"output_tokens":80,"output_tokens_details":{"reasoning_tokens":30},"total_tokens":280}}}',
    ].join('\n');
    const out = n.projectSse(sse);
    const d = readDelta(out);
    expect(d.reasoning).toBe('推理');
    expect(d.content).toBe('正文');
    expect(d.finish).toBe('stop');
    const u = readUsage(out);
    expect(u.prompt_cache_hit_tokens).toBe(120);
    expect(u.completion_tokens).toBe(80);
    expect(u.completion_tokens_details.reasoning_tokens).toBe(30);
    expect(u.total_tokens).toBe(280);
    expect(n.rawModel()).toBe('gpt-5');
  });
});

describe('OpenAI / DeepSeek 旧链路零改动', () => {
  it('带显式 reasoning_tokens 的帧原样透传，一个字节都不改', () => {
    const n = createFrameNormalizer();
    const line = 'data: {"id":"x","model":"deepseek-chat","choices":[{"delta":{"content":"hi"},"finish_reason":null}],"usage":{"prompt_tokens":10,"prompt_tokens_details":{"cached_tokens":4},"completion_tokens":5,"completion_tokens_details":{"reasoning_tokens":2},"total_tokens":15}}';
    expect(n.projectSse(line)).toBe(line + '\n');
    expect(n.active()).toBe(false);
    expect(n.rawUsage()).toEqual({ prompt_tokens: 10, prompt_tokens_details: { cached_tokens: 4 }, completion_tokens: 5, completion_tokens_details: { reasoning_tokens: 2 }, total_tokens: 15 });
  });

  it('无 usage 的普通帧与 [DONE] 原样保留', () => {
    const n = createFrameNormalizer();
    const line = 'data: {"choices":[{"delta":{"content":"hi"}}]}';
    expect(n.projectSse(line)).toBe(line + '\n');
    expect(n.projectSse('data: [DONE]')).toBe('data: [DONE]\n');
  });
});


describe('Gemini Interactions', () => {
  it('usage 口径：thought 独立于 output、cached 是 input 子集、tool_use 单独并入未命中', () => {
    const ir = interactionsUsageIR({
      total_input_tokens: 1000,
      total_cached_tokens: 700,
      total_tool_use_tokens: 40,
      total_output_tokens: 90,
      total_thought_tokens: 245,
      total_tokens: 1375,
    });
    expect(ir.prompt_cache_hit_tokens).toBe(700);
    expect(ir.prompt_cache_miss_tokens).toBe(340); // 1000-700 再 +40
    expect(ir.prompt_tokens).toBe(1040);
    expect(ir.completion_tokens).toBe(335); // 90 + 245，思维按输出计费
    expect(ir.completion_tokens_details.reasoning_tokens).toBe(245);
    expect(ir.total_tokens).toBe(1375);
  });

  it('流式：thought 步骤进思维链、model_output 进正文、annotation 等事件不污染正文', () => {
    const n = createFrameNormalizer();
    const sse = [
      'event: interaction.created',
      'data: {"event_type":"interaction.created","interaction":{"id":"i1","status":"in_progress","model":"gemini-3-flash"}}',
      '',
      'data: {"event_type":"step.start","index":0,"step":{"type":"thought","summary":[{"type":"text","text":"想一想"}]}}',
      'data: {"event_type":"step.delta","index":0,"delta":{"type":"thought_summary","content":{"type":"text","text":"再想"}}}',
      'data: {"event_type":"step.delta","index":0,"delta":{"type":"thought_signature","signature":""}}',
      'data: {"event_type":"step.stop","index":0}',
      'data: {"event_type":"step.start","index":1,"step":{"type":"model_output","content":[{"type":"text","text":"你好"}]}}',
      'data: {"event_type":"step.delta","index":1,"delta":{"type":"text","text":"，世界"}}',
      'data: {"event_type":"step.delta","index":1,"delta":{"type":"text_annotation_delta","annotations":[]}}',
      'data: {"event_type":"step.stop","index":1}',
      'data: {"event_type":"interaction.completed","interaction":{"id":"i1","status":"completed","usage":{"total_input_tokens":1000,"total_cached_tokens":700,"total_output_tokens":90,"total_thought_tokens":245,"total_tokens":1335}}}',
      'data: [DONE]',
    ].join('\n');
    const out = n.projectSse(sse);
    const d = readDelta(out);
    expect(d.reasoning).toBe('想一想再想');
    expect(d.content).toBe('你好，世界');
    expect(d.finish).toBe('stop');
    const u = readUsage(out);
    expect(u.prompt_tokens).toBe(1000);
    expect(u.prompt_cache_hit_tokens).toBe(700);
    expect(u.completion_tokens).toBe(335);
    expect(u.completion_tokens_details.reasoning_tokens).toBe(245);
    expect(u.total_tokens).toBe(1335);
    expect(n.protocol()).toBe('interactions');
    expect(n.rawFinishReason()).toBe('completed');
    expect(n.rawUsage()?.total_thought_tokens).toBe(245);
    expect(out).toContain('data: [DONE]');
  });

  it('流式：status=incomplete 映射成 length，failed 映射成 other', () => {
    const a = createFrameNormalizer();
    expect(readDelta(a.projectSse('data: {"event_type":"interaction.completed","interaction":{"status":"incomplete","usage":{"total_input_tokens":5,"total_output_tokens":2,"total_thought_tokens":0,"total_tokens":7}}}')).finish).toBe('length');
    const b = createFrameNormalizer();
    expect(readDelta(b.projectSse('data: {"event_type":"interaction.failed","interaction":{"status":"failed"}}')).finish).toBe('other');
  });

  it('非流式整包：steps 拆思维与正文，usage 换算，status=incomplete 记 length', () => {
    const n = createFrameNormalizer();
    const whole = JSON.stringify({
      object: 'interaction',
      id: 'i1',
      status: 'incomplete',
      model: 'gemini-3-flash',
      steps: [
        { type: 'thought', summary: [{ type: 'text', text: '思考' }] },
        { type: 'google_search_call', id: 's1' },
        { type: 'model_output', content: [{ type: 'text', text: '正文' }] },
      ],
      usage: { total_input_tokens: 11, total_cached_tokens: 0, total_output_tokens: 90, total_thought_tokens: 245, total_tokens: 346 },
    });
    const out = JSON.parse(n.projectWhole(whole));
    expect(out.choices[0].message.content).toBe('正文');
    expect(out.choices[0].message.reasoning_content).toBe('思考');
    expect(out.choices[0].finish_reason).toBe('length');
    expect(out.usage.prompt_tokens).toBe(11);
    expect(out.usage.completion_tokens).toBe(335);
    expect(out.usage.total_tokens).toBe(346);
    expect(out.usage.completion_tokens_details.reasoning_tokens).toBe(245);
    expect(n.rawModel()).toBe('gemini-3-flash');
  });

  it('TauriTavern 已归一化的 OpenAI 形状（completion 已含思维、无 reasoning 字段）原样透传', () => {
    const n = createFrameNormalizer();
    const chunk = { id: 'gemini-interactions-stream', object: 'chat.completion.chunk', created: 1, model: 'gemini-3.6-flash', choices: [{ index: 0, delta: { content: '好' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 6, total_tokens: 9, prompt_tokens_details: { cached_tokens: 2 } } };
    const line = 'data: ' + JSON.stringify(chunk);
    expect(n.projectSse(line)).toBe(line + '\n');
    expect(n.protocol()).toBe('openai');
  });
});

