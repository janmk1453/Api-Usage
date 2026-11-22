/**
 * 思维链耗时口径（单一来源）
 *
 * 背景：思维链耗时只能从流式增量里测——上游不会给出 reasoning 的起止时间，
 * 因此需要按帧判断「思维链开始」与「正文开始」两个时刻。
 *
 * 旧实现用整行 substring 匹配（"reasoning_content" / "content"），有两个致命缺陷：
 *   1. DeepSeek 官方流式在思维链帧里仍带 "content":null，
 *      于是第一个思维链帧就同时命中 content，起止落在同一帧 → 耗时恒为 0；
 *   2. 只认 reasoning_content，不认 reasoning / reasoning_text / thinking
 *      （OpenRouter、部分中转与 Anthropic 风格），思维链根本没被识别 → 耗时恒为 0。
 *
 * 现在按 JSON 解析增量，只认「非空」的思维链文本与「非空」的正文文本，
 * 并补一条兜底：整段回复只有思维链没有正文时，取最后一帧思维链时间作为结束点。
 */

/** 思维链字段名（按优先级）；Anthropic 风格另有 delta.type=thinking_delta */
const REASONING_KEYS = ['reasoning_content', 'reasoning', 'reasoning_text', 'thinking'];

export type ThinkClock = {
  /** 首帧非空思维链的相对时刻（ms） */
  startAt: number | null;
  /** 首帧非空正文的相对时刻（ms），即思维链结束时刻 */
  endAt: number | null;
  /** 最后一帧非空思维链的相对时刻（ms），用于无正文时兜底 */
  lastReasoningAt: number | null;
  /** 非空正文增量帧数（思维链结束锚点用） */
  contentFrames: number;
  /** 含真实增量的帧数：正文 / 思维链 / 工具调用任一非空即 +1（真假流式判定用） */
  deltaFrames?: number;
  /** 解析成功的 SSE 帧数（含只带 usage 的末帧）；为 0 说明响应体根本不是 SSE */
  sseFrames?: number;
  /** 累计正文增量字符数（上游不回 usage 时的输出估算依据；缺省视为 0） */
  contentChars?: number;
  /** 累计思维链增量字符数（同上） */
  reasoningChars?: number;
};

export function createThinkClock(): ThinkClock {
  return { startAt: null, endAt: null, lastReasoningAt: null, contentFrames: 0, deltaFrames: 0, sseFrames: 0 };
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function frameCarriers(record: any): any[] {
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const first = choices[0] || {};
  return [first.delta, first.message, record?.delta, record?.message];
}

/** 取一帧增量里的思维链文本（空字符串视为无思维链） */
export function reasoningTextOf(record: any): string {
  if (!record || typeof record !== 'object') return '';
  for (const carrier of frameCarriers(record)) {
    if (!carrier || typeof carrier !== 'object') continue;
    for (const key of REASONING_KEYS) {
      const text = textOf((carrier as any)[key]);
      if (text) return text;
    }
  }
  const topLevel = textOf((record as any).reasoning_content) || textOf((record as any).reasoning);
  return topLevel;
}

/** 取一帧增量里的正文文本（空字符串=尚无正文，例如仅带 content:null 的思维链帧） */
export function contentTextOf(record: any): string {
  if (!record || typeof record !== 'object') return '';
  for (const carrier of frameCarriers(record)) {
    if (!carrier || typeof carrier !== 'object') continue;
    const direct = textOf((carrier as any).content);
    if (direct) return direct;
    // Anthropic 风格：{ type: 'content_block_delta', delta: { type: 'text_delta', text } }
    if ((carrier as any).type === 'text_delta') {
      const text = textOf((carrier as any).text);
      if (text) return text;
    }
  }
  if ((record as any).type === 'text_delta') return textOf((record as any).text);
  return '';
}

/**
 * 一帧里是否有工具调用增量。
 * 工具调用响应里没有 delta.content，若只数正文帧就会把正常的一次流式调用判成「未知」。
 * 覆盖 OpenAI tool_calls、Anthropic input_json_delta / tool_use 起始块、Gemini functionCall。
 */
export function hasToolCallDelta(record: any): boolean {
  if (!record || typeof record !== 'object') return false;
  for (const carrier of frameCarriers(record)) {
    if (!carrier || typeof carrier !== 'object') continue;
    const calls = (carrier as any).tool_calls;
    if (Array.isArray(calls) && calls.length > 0) return true;
    const type = (carrier as any).type;
    if (type === 'input_json_delta' || type === 'tool_use_delta') return true;
    const block = (carrier as any).content_block;
    if (block && typeof block === 'object' && block.type === 'tool_use') return true;
  }
  const parts = (record as any)?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts) && parts.some((part: any) => part && typeof part === 'object' && part.functionCall)) return true;
  return false;
}

/**
 * 扫一段已是完整行的 SSE 文本（可含多行），更新时钟。
 * @param at 该段数据的相对时刻（ms）；同段内的帧共用同一时刻，粒度足够
 */
export function scanThinkChunk(clock: ThinkClock, chunk: string, at: number): void {
  for (const raw of String(chunk || '').split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let record: any;
    try { record = JSON.parse(payload); } catch { continue; }
    if (!record || typeof record !== 'object') continue;
    clock.sseFrames = (clock.sseFrames || 0) + 1;
    const reasoning = reasoningTextOf(record);
    if (reasoning) {
      if (clock.startAt == null) clock.startAt = at;
      clock.lastReasoningAt = at;
      clock.reasoningChars = (clock.reasoningChars || 0) + reasoning.length;
    }
    const content = contentTextOf(record);
    if (content) {
      clock.contentFrames += 1;
      clock.contentChars = (clock.contentChars || 0) + content.length;
      if (clock.startAt != null && clock.endAt == null) clock.endAt = at;
    }
    // 工具调用帧同样是「流在吐东西」，必须计入增量帧，否则整轮会被判成未知
    if (reasoning || content || hasToolCallDelta(record)) {
      clock.deltaFrames = (clock.deltaFrames || 0) + 1;
    }
  }
}

/** 真假流式判定结果：true 真流式 / false 非流式或一次性返回 / null 观测不足 */
export type StreamedVerdict = boolean | null;

/**
 * 真假流式判定（单一来源）。
 * - 未声明 stream：false
 * - 增量帧 > 1：true
 * - 增量帧 = 1：false（上游把全文塞进一帧，含单帧工具调用）
 * - 零增量帧且没有任何 SSE 帧：false（上游无视 stream:true，直接回整段 JSON）
 * - 零增量帧但收到过 SSE 帧：null（只有 usage / 心跳，观测不足，交给数值兜底）
 */
export function judgeStreamedFromClock(clock: ThinkClock | null | undefined, requestedStream: boolean): StreamedVerdict {
  if (!requestedStream) return false;
  const frames = clock?.deltaFrames || 0;
  if (frames > 1) return true;
  if (frames === 1) return false;
  if (!(clock?.sseFrames || 0)) return false;
  return null;
}

/**
 * 结算思维链耗时（ms）。
 * 结束点优先级：首帧正文 → 最后一帧思维链（整段只有思维链）→ 流结束时刻。
 */
export function resolveThinkTime(clock: ThinkClock, endedAt: number): number {
  if (!clock || clock.startAt == null) return 0;
  const end = clock.endAt ?? clock.lastReasoningAt ?? endedAt;
  if (!Number.isFinite(end) || !Number.isFinite(clock.startAt)) return 0;
  const ms = end - clock.startAt;
  if (!(ms > 0)) return 0;
  return Math.round(ms);
}
