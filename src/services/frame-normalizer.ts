/**
 * 帧归一化（统一出口）
 *
 * 职责：把各家 provider 的流式 / 非流式响应帧，投影成 OpenAI / DeepSeek Chat Completions 形状。
 * 下游（think-timing、interception 解析、repository、pricing）因此只认识一种形状，
 * 新增一家 provider 只需要在这里加一张映射表，不必再动三四处解析。
 *
 * 三条硬约束：
 * 1. **只投影，不解释业务**：投影失败原样返回，任何异常都不允许影响原始响应。
 * 2. **原始值单独留存**：上游原始 usage / finish_reason / model 单独保存，
 *    供「请求日志」页原样展示 —— 页面上看到的必须是未经转换的上游数据。
 * 3. **协议首帧锁定**：锁定后不再切换，避免 usage-only 末帧被误判成别的协议。
 *
 * 口径（与官方定义对齐）：
 *   prompt_tokens     = 命中 + 未命中（缓存命中已含在输入里）
 *   completion_tokens = 计费输出量 = 正文 + 思维（Gemini 的 candidates 不含 thoughts，必须相加）
 *   total_tokens      = 上游 total（若给）否则 hit + miss + completion
 */

export type FrameProtocol = 'gemini' | 'anthropic' | 'responses' | 'openai' | 'unknown';

/** Anthropic 流式事件名（error 不列入：两家都有，靠其他事件锁定） */
const ANTHROPIC_EVENTS = new Set([
  'message_start',
  'content_block_start',
  'content_block_delta',
  'content_block_stop',
  'message_delta',
  'message_stop',
  'ping',
]);

/** OpenAI Responses 流式事件名 */
const RESPONSES_EVENTS = new Set([
  'response.created',
  'response.in_progress',
  'response.queued',
  'response.output_item.added',
  'response.output_item.done',
  'response.content_part.added',
  'response.content_part.done',
  'response.output_text.delta',
  'response.output_text.done',
  'response.refusal.delta',
  'response.reasoning_summary_text.delta',
  'response.reasoning_summary_text.done',
  'response.completed',
  'response.failed',
  'response.incomplete',
]);

/** Gemini finishReason → OpenAI finish_reason */
const GEMINI_FINISH: Record<string, string> = {
  STOP: 'stop',
  MAX_TOKENS: 'length',
  SAFETY: 'content_filter',
  RECITATION: 'content_filter',
  LANGUAGE: 'content_filter',
  BLOCKLIST: 'content_filter',
  PROHIBITED_CONTENT: 'content_filter',
  SPII: 'content_filter',
  IMAGE_SAFETY: 'content_filter',
  MALFORMED_FUNCTION_CALL: 'tool_calls',
  UNEXPECTED_TOOL_CALL: 'tool_calls',
  TOO_MANY_TOOL_CALLS: 'tool_calls',
  OTHER: 'other',
};

/** Anthropic stop_reason → OpenAI finish_reason */
const ANTHROPIC_FINISH: Record<string, string> = {
  end_turn: 'stop',
  max_tokens: 'length',
  stop_sequence: 'stop',
  tool_use: 'tool_calls',
  refusal: 'content_filter',
  pause_turn: 'stop',
};

type State = {
  protocol: FrameProtocol;
  /** Anthropic：message_start 拿到的输入侧用量，等 message_delta 补输出 */
  anthropicStart: Record<string, any> | null;
  /** Anthropic：输出 token（message_delta 的累计值） */
  anthropicOutput: number | null;
  /** 上游原始 usage（键名照抄，不做任何换算），供请求日志展示 */
  rawUsage: Record<string, any> | null;
  /** 上游原始结束原因（MAX_TOKENS / end_turn / …），供请求日志展示 */
  rawFinish: string | null;
  /** 上游原始模型名（modelVersion / model / message.model / response.model） */
  rawModel: string | null;
};

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pos(value: number | null): number {
  return value != null && value > 0 ? value : 0;
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** 统一 usage 形状（下游只认这些键） */
type UsageIR = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  completion_tokens_details: { reasoning_tokens: number };
};

function makeUsage(hit: number, miss: number, completion: number, total: number, think: number): UsageIR {
  const prompt = hit + miss;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    // total 必须自洽：上游给的 total 若比三项之和小，以三项之和为准
    total_tokens: Math.max(total, prompt + completion),
    prompt_cache_hit_tokens: hit,
    prompt_cache_miss_tokens: miss,
    completion_tokens_details: { reasoning_tokens: think },
  };
}

/**
 * Gemini 原生 usageMetadata → UsageIR
 * - cachedContentTokenCount 是 promptTokenCount 的子集（不是额外量）
 * - toolUsePromptTokenCount 不在 promptTokenCount 内，必须并进未命中
 * - thoughtsTokenCount 不计入 candidatesTokenCount，计费上属于输出
 */
export function geminiUsageIR(um: Record<string, any>): UsageIR {
  const promptCount = pos(num(um.promptTokenCount));
  const cached = pos(num(um.cachedContentTokenCount));
  const tool = pos(num(um.toolUsePromptTokenCount));
  const candidates = pos(num(um.candidatesTokenCount));
  const thoughts = pos(num(um.thoughtsTokenCount));
  const hit = Math.min(cached, promptCount);
  const miss = Math.max(0, promptCount - hit) + tool;
  const completion = candidates + thoughts;
  const total = pos(num(um.totalTokenCount));
  return makeUsage(hit, miss, completion, total, thoughts);
}

/** OpenAI / DeepSeek / Gemini 兼容层 usage → UsageIR */
export function openaiUsageIR(u: Record<string, any>): UsageIR {
  const prompt = pos(num(u.prompt_tokens) ?? num(u.input_tokens));
  const completionRaw = pos(num(u.completion_tokens) ?? num(u.output_tokens));
  const hit = pos(num(u.prompt_cache_hit_tokens) ?? num(u.prompt_tokens_details?.cached_tokens)
    ?? num(u.input_tokens_details?.cached_tokens) ?? num(u.cached_tokens));
  const missRaw = num(u.prompt_cache_miss_tokens);
  const miss = missRaw != null && missRaw >= 0 ? missRaw : Math.max(0, prompt - hit);

  // 显式字段：OpenAI / DeepSeek 的 completion_tokens 已经包含思维，不能再加
  const explicitThink = num(u.completion_tokens_details?.reasoning_tokens)
    ?? num(u.output_tokens_details?.reasoning_tokens)
    ?? num(u.reasoning_tokens)
    ?? num(u.thinking_tokens);

  let think = pos(explicitThink);
  let completion = completionRaw;
  if (explicitThink == null) {
    // Gemini OpenAI 兼容层：completion 不含思维、total 含思维 → 用差值反推。
    // 只有差值既不是缓存量也不是输入量时才认定是思维，避免把「重复计数」误判成思维。
    const total = num(u.total_tokens);
    if (total != null && total > 0) {
      const diff = total - (prompt + completionRaw);
      if (diff > 0 && diff !== hit && diff !== prompt) {
        think = diff;
        completion = completionRaw + diff;
      }
    }
  }
  const totalRaw = pos(num(u.total_tokens));
  const total = totalRaw > 0 ? totalRaw : prompt + completion;
  return makeUsage(hit, miss, completion, total, think);
}

/** Anthropic usage → UsageIR（input_tokens 不含缓存，cache_read / cache_creation 单列） */
export function anthropicUsageIR(start: Record<string, any> | null, outputTokens: number | null): UsageIR {
  const s = start || {};
  const hit = pos(num(s.cache_read_input_tokens));
  const create = pos(num(s.cache_creation_input_tokens));
  const input = pos(num(s.input_tokens));
  const miss = input + create;
  const output = pos(outputTokens ?? num(s.output_tokens));
  return makeUsage(hit, miss, output, hit + miss + output, 0);
}

/** OpenAI Responses usage → UsageIR（output_tokens 已含 reasoning） */
export function responsesUsageIR(u: Record<string, any>): UsageIR {
  const prompt = pos(num(u.input_tokens));
  const hit = pos(num(u.input_tokens_details?.cached_tokens));
  const miss = Math.max(0, prompt - hit);
  const output = pos(num(u.output_tokens));
  const think = pos(num(u.output_tokens_details?.reasoning_tokens));
  const total = pos(num(u.total_tokens));
  return makeUsage(hit, miss, output, total, think);
}

/** 首帧协议判定（顺序有意义：Gemini 靠 candidates 锁定，不能等末帧的 usageMetadata） */
export function detectProtocol(frame: any): FrameProtocol {
  if (!isObject(frame)) return 'unknown';
  if (frame.candidates || frame.usageMetadata || frame.promptFeedback) return 'gemini';
  const type = frame.type;
  if (typeof type === 'string') {
    if (ANTHROPIC_EVENTS.has(type)) return 'anthropic';
    if (RESPONSES_EVENTS.has(type)) return 'responses';
    if (type === 'message' && Array.isArray(frame.content)) return 'anthropic';
  }
  if (frame.object === 'response' || Array.isArray(frame.output)) return 'responses';
  if (Array.isArray(frame.choices)) return 'openai';
  if (frame.usage) return 'openai';
  return 'unknown';
}

function deltaFrame(content?: string, reasoning?: string): any {
  const delta: any = {};
  if (typeof content === 'string' && content) delta.content = content;
  if (typeof reasoning === 'string' && reasoning) delta.reasoning_content = reasoning;
  return { choices: [{ delta }] };
}

function finishFrame(reason: string): any {
  return { choices: [{ delta: {}, finish_reason: reason }] };
}

function usageFrame(usage: UsageIR, model?: string | null): any {
  const out: any = { choices: [], usage };
  if (model) out.model = model;
  return out;
}

export type FrameNormalizer = {
  /** 投影一段 SSE 文本（可含多行），返回 OpenAI 形状的等价 SSE 文本 */
  projectSse(text: string): string;
  /** 投影整段非流式响应（单对象 / JSON 数组 / SSE 全文） */
  projectWhole(text: string): string;
  /** 当前锁定的协议 */
  protocol(): FrameProtocol;
  /** 上游原始 usage（原样，未换算），供请求日志展示 */
  rawUsage(): Record<string, any> | null;
  /** 上游原始结束原因（原样，未映射） */
  rawFinishReason(): string | null;
  /** 上游原始模型名（原样） */
  rawModel(): string | null;
  /** 是否发生过实际投影（协议不是 openai / unknown） */
  active(): boolean;
};

export function createFrameNormalizer(): FrameNormalizer {
  const st: State = {
    protocol: 'unknown',
    anthropicStart: null,
    anthropicOutput: null,
    rawUsage: null,
    rawFinish: null,
    rawModel: null,
  };

  function projectGemini(frame: any): any[] {
    const out: any[] = [];
    if (typeof frame.modelVersion === 'string' && frame.modelVersion) st.rawModel = frame.modelVersion;
    const cand = Array.isArray(frame.candidates) ? frame.candidates[0] : null;

    const parts = cand?.content?.parts;
    if (Array.isArray(parts)) {
      let text = '';
      let think = '';
      for (const part of parts) {
        if (!isObject(part) || typeof part.text !== 'string' || !part.text) continue;
        // 思维内容靠布尔标记区分，不是独立字段
        if (part.thought === true) think += part.text;
        else text += part.text;
      }
      if (think) out.push(deltaFrame(undefined, think));
      if (text) out.push(deltaFrame(text));
    }

    const blockReason = frame?.promptFeedback?.blockReason;
    if (blockReason) {
      // 整条被拒：通常没有 candidates，必须给出结束原因，否则会被当成「空回复」丢弃
      st.rawFinish = String(blockReason);
      out.push(finishFrame('content_filter'));
    }

    const fr = cand?.finishReason;
    if (typeof fr === 'string' && fr) {
      st.rawFinish = fr;
      out.push(finishFrame(GEMINI_FINISH[fr] || 'other'));
    }

    const um = frame.usageMetadata;
    if (isObject(um)) {
      st.rawUsage = um;
      out.push(usageFrame(geminiUsageIR(um), typeof frame.modelVersion === 'string' ? frame.modelVersion : null));
    }
    return out;
  }

  function projectAnthropic(frame: any): any[] {
    const out: any[] = [];
    const type = frame.type;

    if (type === 'message_start') {
      const msg = frame.message || {};
      if (typeof msg.model === 'string' && msg.model) st.rawModel = msg.model;
      if (isObject(msg.usage)) st.anthropicStart = { ...msg.usage };
      const u = anthropicUsageIR(st.anthropicStart, st.anthropicOutput);
      st.rawUsage = { ...(st.anthropicStart || {}) };
      out.push(usageFrame(u, st.rawModel));
      return out;
    }

    if (type === 'content_block_delta') {
      const delta = frame.delta || {};
      // Anthropic 的思维是 thinking_delta.thinking，正文是 text_delta.text
      if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string' && delta.thinking) {
        out.push(deltaFrame(undefined, delta.thinking));
      } else if (delta.type === 'text_delta' && typeof delta.text === 'string' && delta.text) {
        out.push(deltaFrame(delta.text));
      }
      return out;
    }

    if (type === 'message_delta') {
      if (isObject(frame.usage) && typeof frame.usage.output_tokens === 'number') {
        st.anthropicOutput = frame.usage.output_tokens;
      }
      st.rawUsage = { ...(st.anthropicStart || {}), ...(isObject(frame.usage) ? frame.usage : {}) };
      const stop = frame?.delta?.stop_reason;
      if (typeof stop === 'string' && stop) {
        st.rawFinish = stop;
        out.push(finishFrame(ANTHROPIC_FINISH[stop] || 'other'));
      }
      out.push(usageFrame(anthropicUsageIR(st.anthropicStart, st.anthropicOutput), st.rawModel));
      return out;
    }

    // 非流式整体响应：{ type:'message', content:[...], usage, stop_reason }
    if (type === 'message') {
      if (typeof frame.model === 'string' && frame.model) st.rawModel = frame.model;
      if (Array.isArray(frame.content)) {
        let text = '';
        let think = '';
        for (const block of frame.content) {
          if (!isObject(block) || typeof block.text !== 'string' || !block.text) continue;
          if (block.type === 'thinking') think += block.text;
          else if (block.type === 'text') text += block.text;
        }
        if (think) out.push(deltaFrame(undefined, think));
        if (text) out.push(deltaFrame(text));
      }
      if (isObject(frame.usage)) {
        st.rawUsage = frame.usage;
        st.anthropicStart = { ...frame.usage };
        out.push(usageFrame(anthropicUsageIR(st.anthropicStart, null), st.rawModel));
      }
      if (typeof frame.stop_reason === 'string' && frame.stop_reason) {
        st.rawFinish = frame.stop_reason;
        out.push(finishFrame(ANTHROPIC_FINISH[frame.stop_reason] || 'other'));
      }
      return out;
    }

    return [];
  }

  function projectResponses(frame: any): any[] {
    const out: any[] = [];
    const type = frame.type;

    if (type === 'response.created' || type === 'response.in_progress') {
      const model = frame?.response?.model;
      if (typeof model === 'string' && model) st.rawModel = model;
      return out;
    }

    if (type === 'response.output_text.delta') {
      if (typeof frame.delta === 'string' && frame.delta) out.push(deltaFrame(frame.delta));
      return out;
    }

    if (type === 'response.reasoning_summary_text.delta') {
      if (typeof frame.delta === 'string' && frame.delta) out.push(deltaFrame(undefined, frame.delta));
      return out;
    }

    if (type === 'response.completed' || type === 'response.incomplete' || type === 'response.failed') {
      const resp = frame.response || {};
      if (typeof resp.model === 'string' && resp.model) st.rawModel = resp.model;
      if (isObject(resp.usage)) {
        st.rawUsage = resp.usage;
        out.push(usageFrame(responsesUsageIR(resp.usage), st.rawModel));
      }
      if (type === 'response.incomplete') {
        const reason = resp?.incomplete_details?.reason;
        st.rawFinish = typeof reason === 'string' ? reason : 'incomplete';
        out.push(finishFrame(reason === 'content_filter' ? 'content_filter' : 'length'));
      } else if (type === 'response.failed') {
        st.rawFinish = 'failed';
        out.push(finishFrame('other'));
      } else {
        out.push(finishFrame('stop'));
      }
      return out;
    }

    // 非流式整体响应：{ object:'response', output:[...], usage }
    if (frame.object === 'response') {
      if (typeof frame.model === 'string' && frame.model) st.rawModel = frame.model;
      if (Array.isArray(frame.output)) {
        let text = '';
        let think = '';
        for (const item of frame.output) {
          if (!isObject(item) || !Array.isArray(item.content)) continue;
          for (const part of item.content) {
            if (!isObject(part) || typeof part.text !== 'string' || !part.text) continue;
            if (part.type === 'output_text' || part.type === 'text') text += part.text;
            else if (part.type === 'reasoning_text' || part.type === 'summary_text') think += part.text;
          }
        }
        if (think) out.push(deltaFrame(undefined, think));
        if (text) out.push(deltaFrame(text));
      }
      if (isObject(frame.usage)) {
        st.rawUsage = frame.usage;
        out.push(usageFrame(responsesUsageIR(frame.usage), st.rawModel));
      }
      if (frame.status === 'incomplete') out.push(finishFrame('length'));
      else if (frame.status === 'failed') out.push(finishFrame('other'));
      else out.push(finishFrame('stop'));
      return out;
    }

    return [];
  }

  function projectOpenAI(frame: any): any[] {
    const raw = isObject(frame.usage) ? frame.usage
      : (isObject(frame?.choices?.[0]?.usage) ? frame.choices[0].usage : null);
    const fr = frame?.choices?.[0]?.finish_reason;
    if (typeof fr === 'string' && fr) st.rawFinish = fr;
    if (typeof frame.model === 'string' && frame.model) st.rawModel = frame.model;
    if (!raw) return [frame];
    st.rawUsage = raw;
    // 显式给了思维 token（OpenAI / DeepSeek 都属此类）→ 原帧完全不动，
    // 保证既有链路字节级零改动，投影只作用于真正需要换算的形状
    const explicitThink = num(raw.completion_tokens_details?.reasoning_tokens)
      ?? num(raw.output_tokens_details?.reasoning_tokens)
      ?? num(raw.reasoning_tokens)
      ?? num(raw.thinking_tokens);
    if (explicitThink != null) return [frame];
    const usage = openaiUsageIR(raw);
    const completionRaw = pos(num(raw.completion_tokens) ?? num(raw.output_tokens));
    // 没有思维字段、总量也没多出来 → 同样不动
    if (usage.completion_tokens === completionRaw) return [frame];
    // 只有 Gemini OpenAI 兼容层这类「completion 不含思维、total 含思维」才改写
    return [{ ...frame, usage }];
  }

  function projectFrame(frame: any): any[] {
    if (st.protocol === 'unknown') st.protocol = detectProtocol(frame);
    switch (st.protocol) {
      case 'gemini': return projectGemini(frame);
      case 'anthropic': return projectAnthropic(frame);
      case 'responses': return projectResponses(frame);
      case 'openai': return projectOpenAI(frame);
      default: return [frame];
    }
  }

  function projectLine(line: string): string {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return '';
    const payload = trimmed.slice(5).trim();
    if (!payload) return '';
    if (payload === '[DONE]') return 'data: [DONE]\n';
    let frame: any;
    try { frame = JSON.parse(payload); } catch { return line + '\n'; }
    try {
      if (st.protocol === 'unknown') st.protocol = detectProtocol(frame);
      // OpenAI / 未识别：原样透传，保证任何今天能用的中转明天照旧能用
      if (st.protocol === 'openai' || st.protocol === 'unknown') {
        const out = projectFrame(frame);
        if (out.length === 1 && out[0] === frame) return line + '\n';
        return out.map((f) => 'data: ' + JSON.stringify(f) + '\n').join('');
      }
      const frames = projectFrame(frame);
      if (!frames.length) return '';
      return frames.map((f) => 'data: ' + JSON.stringify(f) + '\n').join('');
    } catch {
      return line + '\n';
    }
  }

  function mergeProjected(frames: any[]): any {
    let content = '';
    let reasoning = '';
    let finish: string | null = null;
    let usage: any = null;
    let model: string | null = null;
    for (const f of frames) {
      if (typeof f?.model === 'string' && f.model) model = f.model;
      if (isObject(f?.usage)) usage = f.usage;
      const c = Array.isArray(f?.choices) ? f.choices[0] : null;
      if (!c) continue;
      const d = c.delta || c.message || {};
      if (typeof d.content === 'string') content += d.content;
      if (typeof d.reasoning_content === 'string') reasoning += d.reasoning_content;
      if (typeof c.finish_reason === 'string' && c.finish_reason) finish = c.finish_reason;
    }
    const message: any = {};
    if (content) message.content = content;
    if (reasoning) message.reasoning_content = reasoning;
    const out: any = { choices: [{ message, finish_reason: finish }] };
    if (usage) out.usage = usage;
    if (model) out.model = model;
    return out;
  }

  function projectSseText(text: string): string {
    if (!text) return text;
    try {
      let out = '';
      for (const line of text.split('\n')) out += projectLine(line);
      return out || text;
    } catch {
      return text;
    }
  }

  return {
    projectSse(text: string): string {
      return projectSseText(text);
    },
    projectWhole(text: string): string {
      const trimmed = (text || '').trim();
      if (!trimmed) return text;
      try {
        if (trimmed.startsWith('{')) {
          const frame = JSON.parse(trimmed);
          const frames = projectFrame(frame);
          if (frames.length === 1 && frames[0] === frame) return text;
          return JSON.stringify(mergeProjected(frames));
        }
        if (trimmed.startsWith('[')) {
          const list = JSON.parse(trimmed);
          if (!Array.isArray(list)) return text;
          const frames: any[] = [];
          for (const item of list) frames.push(...projectFrame(item));
          if (!frames.length) return text;
          return JSON.stringify(mergeProjected(frames));
        }
      } catch {
        return text;
      }
      return projectSseText(text);
    },
    protocol(): FrameProtocol {
      return st.protocol;
    },
    rawUsage(): Record<string, any> | null {
      return st.rawUsage;
    },
    rawFinishReason(): string | null {
      return st.rawFinish;
    },
    rawModel(): string | null {
      return st.rawModel;
    },
    active(): boolean {
      return st.protocol !== 'openai' && st.protocol !== 'unknown';
    },
  };
}
