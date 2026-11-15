/**
 * 采集链路快照（反馈诊断用，旁路记录）
 *
 * 只回答一个问题：这一轮请求的用量，最后有没有变成一条历史记录；如果没有，
 * 卡在哪一步。它不参与任何业务判断，也不改变现有采集逻辑——所有调用点都包在
 * try/catch 里，只是把「发生了什么」记进一个环形缓冲，随诊断包上传。
 *
 * 阶段（按时间顺序）：
 * - fetch-start   命中对话接口，请求发出
 * - fetch-parse   响应解析完成（是否解析到 usage、usage 是否全 0）
 * - event-drop    GENERATION_ENDED 时没拿到任何有效 usage，本轮被丢弃
 * - entry-added   repository.addEntry 已调用（唯一落库点）
 * - entry-error   addEntry 抛错
 */
export type CaptureStage = 'fetch-start' | 'fetch-parse' | 'event-drop' | 'entry-added' | 'entry-error';

export interface CaptureRecord {
  at: number;
  stage: CaptureStage;
  model?: string;
  requestId?: string;
  url?: string;
  streamed?: boolean | null;
  usageFound?: boolean;
  usageZero?: boolean;
  usage?: Record<string, number> | null;
  finishReason?: string | null;
  reason?: string;
}

/** 环形缓冲上限：够还原最近几轮的链路，又不至于撑大诊断包 */
export const CAPTURE_MAX = 24;

const USAGE_KEYS = [
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'cached_tokens',
  'prompt_cache_hit_tokens',
  'prompt_cache_miss_tokens',
];

let buffer: CaptureRecord[] = [];

/** 只留下数字型用量字段，避免把整块 usage 塞进诊断包 */
export function usageNumbers(usage: any): Record<string, number> | null {
  if (!usage || typeof usage !== 'object') return null;
  const out: Record<string, number> = {};
  let any = false;
  for (const key of USAGE_KEYS) {
    const v = (usage as any)[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v;
      any = true;
    }
  }
  const cached = (usage as any)?.prompt_tokens_details?.cached_tokens;
  if (typeof cached === 'number' && Number.isFinite(cached)) {
    out.cached_tokens = cached;
    any = true;
  }
  return any ? out : null;
}

/** usage 是否存在但三项计数全为 0（上游不计量时的典型表现） */
export function isZeroUsage(usage: any): boolean {
  const n = usageNumbers(usage);
  if (!n) return false;
  const keys = ['prompt_tokens', 'completion_tokens', 'total_tokens', 'input_tokens', 'output_tokens'];
  const present = keys.filter((k) => typeof n[k] === 'number');
  if (!present.length) return false;
  return present.every((k) => n[k] === 0);
}

function clipText(v: any, max: number): string {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.length > max ? s.slice(0, max) : s;
}

/** 记一条链路快照（永不抛错） */
export function noteCaptureStage(stage: CaptureStage, data: Omit<CaptureRecord, 'stage' | 'at'> & { at?: number } = {}): void {
  try {
    const rec: CaptureRecord = {
      at: typeof data.at === 'number' ? data.at : Date.now(),
      stage,
      model: data.model ? clipText(data.model, 120) : undefined,
      requestId: data.requestId ? clipText(data.requestId, 80) : undefined,
      url: data.url ? clipText(data.url, 200) : undefined,
      streamed: data.streamed === undefined ? undefined : data.streamed,
      usageFound: data.usageFound,
      usageZero: data.usageZero,
      usage: data.usage || null,
      finishReason: data.finishReason === undefined ? undefined : data.finishReason,
      reason: data.reason ? clipText(data.reason, 300) : undefined,
    };
    buffer.push(rec);
    if (buffer.length > CAPTURE_MAX) buffer = buffer.slice(-CAPTURE_MAX);
  } catch {}
}

/** 最近的链路快照（按时间正序，最后一条最新） */
export function listCaptureStages(limit = CAPTURE_MAX): CaptureRecord[] {
  try {
    const n = Math.max(1, Math.min(CAPTURE_MAX, Math.floor(limit) || CAPTURE_MAX));
    return buffer.slice(-n).map((r) => ({ ...r }));
  } catch {
    return [];
  }
}

/** 诊断包里的 capture 段：最近若干条快照，已裁掉空字段 */
export function captureDigest(limit = CAPTURE_MAX): Array<Record<string, unknown>> {
  return listCaptureStages(limit).map((rec) => {
    const out: Record<string, unknown> = { at: rec.at, stage: rec.stage };
    if (rec.model) out.model = rec.model;
    if (rec.requestId) out.requestId = rec.requestId;
    if (rec.url) out.url = rec.url;
    if (rec.streamed !== undefined && rec.streamed !== null) out.streamed = rec.streamed;
    if (rec.usageFound !== undefined) out.usageFound = rec.usageFound;
    if (rec.usageZero !== undefined) out.usageZero = rec.usageZero;
    if (rec.usage) out.usage = rec.usage;
    if (rec.finishReason) out.finishReason = rec.finishReason;
    if (rec.reason) out.reason = rec.reason;
    return out;
  });
}

/** 清空快照（仅测试与调试用） */
export function clearCaptureStages(): void {
  buffer = [];
}
