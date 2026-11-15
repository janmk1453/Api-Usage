/**
 * 请求日志：只保留「最后一轮」对话请求的标头、正文与响应元数据。
 *
 * 定位：纯诊断用途，不参与统计、不进历史、不导出。每次请求开始时整体覆盖，
 * 因此本地永远只有一条记录（用户点「清空」后为空）。
 *
 * 隐私：请求头里的 Authorization / x-api-key / cookie 一律打码后再落盘，
 * 正文里可能包含对话内容，页面顶部有明确提示，可随时清空。
 */

export const LOG_STORAGE_KEY = 'aus_last_request_v1';
/** 请求正文上限（字符），超出截断并标记，避免撑爆 localStorage */
export const LOG_BODY_LIMIT = 200_000;
/** 单个字符串值在树里最多展示的字符数 */
export const LOG_VALUE_LIMIT = 2_000;

export type HeaderPair = [string, string];

export interface RequestLogResponse {
  status: number;
  statusText: string;
  headers: HeaderPair[];
  /** 首字节耗时（毫秒），未知为 null */
  firstByteMs: number | null;
  /** 整段响应读完的耗时（毫秒），未知为 null */
  durationMs: number | null;
  /** 是否真流式：true 流式 / false 假流式或非流式 / null 未知 */
  streamed: boolean | null;
  model: string | null;
  finishReason: string | null;
  /** 上游返回的 usage 原对象（可能含 details 子对象） */
  usage: Record<string, unknown> | null;
  /** 请求失败时的错误文案（网络错误、中断、非 2xx 也会记在这里） */
  error: string | null;
}

export interface RequestLogRecord {
  /** 记录时间（毫秒） */
  at: number;
  method: string;
  url: string;
  requestHeaders: HeaderPair[];
  requestBody: string;
  requestBodyTruncated: boolean;
  response: RequestLogResponse;
}

const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
];

function isSensitive(name: string): boolean {
  return SENSITIVE_HEADERS.includes(name.trim().toLowerCase());
}

/** 打码：保留 scheme 前缀与首尾少量字符，中间用 * 代替 */
export function redactValue(value: string): string {
  const text = String(value ?? '');
  const match = text.match(/^(\S+\s+)(.*)$/);
  const prefix = match ? match[1] : '';
  const secret = match ? match[2] : text;
  if (secret.length <= 12) return prefix + '*'.repeat(Math.max(secret.length, 4));
  return prefix + secret.slice(0, 6) + '*'.repeat(Math.min(10, secret.length - 10)) + secret.slice(-4);
}

export function redactHeader(name: string, value: string): string {
  return isSensitive(name) ? redactValue(value) : String(value ?? '');
}

/** 把 Headers / 数组 / 普通对象统一成有序键值对，敏感项打码 */
export function headersToPairs(input: unknown): HeaderPair[] {
  const pairs: HeaderPair[] = [];
  const push = (name: string, value: unknown) => {
    const key = String(name || '').trim();
    if (!key) return;
    pairs.push([key, redactHeader(key, String(value ?? ''))]);
  };
  if (!input) return pairs;
  const anyInput = input as any;
  if (typeof anyInput.forEach === 'function' && typeof anyInput.get === 'function') {
    anyInput.forEach((value: unknown, name: string) => push(name, value));
    return pairs.sort((a, b) => a[0].localeCompare(b[0]));
  }
  if (Array.isArray(anyInput)) {
    for (const item of anyInput) {
      if (Array.isArray(item) && item.length >= 2) push(item[0], item[1]);
    }
    return pairs;
  }
  if (typeof anyInput === 'object') {
    for (const [key, value] of Object.entries(anyInput)) {
      if (Array.isArray(value)) push(key, value.join(', '));
      else push(key, value);
    }
  }
  return pairs.sort((a, b) => a[0].localeCompare(b[0]));
}

/** 请求体原文 → 截断信息 */
export function clipBody(text: string, limit: number = LOG_BODY_LIMIT): { body: string; truncated: boolean } {
  const raw = typeof text === 'string' ? text : '';
  if (raw.length <= limit) return { body: raw, truncated: false };
  return { body: raw.slice(0, limit), truncated: true };
}

function emptyResponse(): RequestLogResponse {
  return {
    status: 0,
    statusText: '',
    headers: [],
    firstByteMs: null,
    durationMs: null,
    streamed: null,
    model: null,
    finishReason: null,
    usage: null,
    error: null,
  };
}

/** 请求发出时调用：整体覆盖上一条记录 */
export function saveRequestStart(input: {
  at?: number;
  method?: string;
  url?: string;
  headers?: unknown;
  body?: string;
}): void {
  try {
    const clipped = clipBody(input.body || '');
    const record: RequestLogRecord = {
      at: typeof input.at === 'number' ? input.at : Date.now(),
      method: String(input.method || 'POST').toUpperCase(),
      url: String(input.url || ''),
      requestHeaders: headersToPairs(input.headers),
      requestBody: clipped.body,
      requestBodyTruncated: clipped.truncated,
      response: emptyResponse(),
    };
    const storage = globalThis.localStorage;
    storage?.setItem(LOG_STORAGE_KEY, JSON.stringify(record));
  } catch {}
}

function readRaw(): RequestLogRecord | null {
  try {
    const text = globalThis.localStorage?.getItem(LOG_STORAGE_KEY);
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      at: typeof parsed.at === 'number' ? parsed.at : 0,
      method: String(parsed.method || 'POST'),
      url: String(parsed.url || ''),
      requestHeaders: Array.isArray(parsed.requestHeaders)
        ? parsed.requestHeaders.filter((p: any) => Array.isArray(p) && p.length >= 2).map((p: any) => [String(p[0]), String(p[1])] as HeaderPair)
        : [],
      requestBody: typeof parsed.requestBody === 'string' ? parsed.requestBody : '',
      requestBodyTruncated: parsed.requestBodyTruncated === true,
      response: { ...emptyResponse(), ...(parsed.response && typeof parsed.response === 'object' ? parsed.response : {}) },
    };
  } catch {
    return null;
  }
}

/** 写入响应侧字段（合并到同一条记录） */
export function patchRequestLog(patch: {
  status?: number;
  statusText?: string;
  headers?: unknown;
  firstByteMs?: number | null;
  durationMs?: number | null;
  streamed?: boolean | null;
  model?: string | null;
  finishReason?: string | null;
  usage?: Record<string, unknown> | null;
  error?: string | null;
}): void {
  try {
    const record = readRaw();
    if (!record) return;
    const next = { ...record.response };
    if (typeof patch.status === 'number') next.status = patch.status;
    if (typeof patch.statusText === 'string') next.statusText = patch.statusText;
    if (patch.headers !== undefined) next.headers = headersToPairs(patch.headers);
    if (patch.firstByteMs !== undefined) next.firstByteMs = patch.firstByteMs;
    if (patch.durationMs !== undefined) next.durationMs = patch.durationMs;
    if (patch.streamed !== undefined) next.streamed = patch.streamed;
    if (patch.model !== undefined) next.model = patch.model;
    if (patch.finishReason !== undefined) next.finishReason = patch.finishReason;
    if (patch.usage !== undefined) next.usage = patch.usage;
    if (patch.error !== undefined) next.error = patch.error;
    globalThis.localStorage?.setItem(LOG_STORAGE_KEY, JSON.stringify({ ...record, response: next }));
  } catch {}
}

export function readRequestLog(): RequestLogRecord | null {
  return readRaw();
}

export function clearRequestLog(): void {
  try {
    globalThis.localStorage?.removeItem(LOG_STORAGE_KEY);
  } catch {}
}

/** 摘要：状态码 + 耗时一行文案，供页面顶部展示 */
export function summarizeRequestLog(record: RequestLogRecord | null): string {
  if (!record) return '暂无记录';
  const r = record.response;
  if (!r || !r.status) return '请求已发出，等待响应';
  const parts: string[] = [String(r.status)];
  if (r.durationMs != null) parts.push(r.durationMs + 'ms');
  else if (r.firstByteMs != null) parts.push('首字 ' + r.firstByteMs + 'ms');
  return parts.join(' · ');
}
