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
  /** 非空正文增量帧数（假流式判定用） */
  contentFrames: number;
};

export function createThinkClock(): ThinkClock {
  return { startAt: null, endAt: null, lastReasoningAt: null, contentFrames: 0 };
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
    if (reasoningTextOf(record)) {
      if (clock.startAt == null) clock.startAt = at;
      clock.lastReasoningAt = at;
    }
    if (contentTextOf(record)) {
      clock.contentFrames += 1;
      if (clock.startAt != null && clock.endAt == null) clock.endAt = at;
    }
  }
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
