/**
 * 上传前的二次脱敏：把请求日志里可能的密钥、令牌、口令抹掉。
 *
 * 为什么要有这一层：存储层（request-log.ts）只对「请求头里的已知敏感头」打码，
 * 正文是原样保存的（排查问题需要看真实 body）。而正文里可能出现
 * custom_include_body 注入的密钥、预设里写死的 token、URL 查询串里的 key 等，
 * 所以真正上传的那一刻必须再扫一遍，把能识别的密钥抹掉。
 *
 * 原则：宁可多抹不可漏抹——只保留排查所需的模型名、消息结构、参数名，
 * 值一旦像密钥就替换成 ***。
 */

/** 键名命中即整体抹除（归一化后比较：去分隔符、转小写） */
const SENSITIVE_KEY_PATTERNS = [
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'apikey',
  'xapikey',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authtoken',
  'sessionkey',
  'sessionid',
  'secret',
  'clientsecret',
  'password',
  'passwd',
  'pwd',
  'proxypassword',
  'credential',
  'credentials',
  'privatekey',
  'accesskey',
  'secretkey',
];

/** 值里出现这些字样，后面的内容按密钥处理 */
const INLINE_SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(sk-[A-Za-z0-9_-]{6,})/g, 'sk-***'],
  [/\b(gh[pousr]_[A-Za-z0-9]{10,})/g, 'ghp_***'],
  [/\b(Bearer\s+)([A-Za-z0-9._~+/=-]{8,})/gi, '$1***'],
  [/\b(Basic\s+)([A-Za-z0-9+/=]{8,})/gi, '$1***'],
  [/\b(x-api-key\s*[:=]\s*)(\S{6,})/gi, '$1***'],
];

/**  api_key=xxx / "token": "xxx" / password: xxx 这类键值对（允许键名被引号包住） */
const INLINE_KV_PATTERN =
  /\b(api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|client[_-]?secret|password|passwd|pwd|proxy[_-]?password)\b(["']?)(\s*[:=]\s*)(["']?)([^\s"',;}\]\[]+)/gi;

export const SECRET_MASK = '***';

/** 键名归一化：去掉分隔符与大小写差异，便于命中集合 */
export function normalizeKey(key: string): string {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSensitiveKey(key: string): boolean {
  const norm = normalizeKey(key);
  if (!norm) return false;
  if (SENSITIVE_KEY_PATTERNS.includes(norm)) return true;
  // 末尾带这些词的字段也当作敏感（如 my_api_key、deepseek_token）
  return /(?:apikey|token|secret|password|passwd|credential|authorization|cookie)$/.test(norm);
}

/** 一段文本里的密钥抹除 */
export function sanitizeText(text: string): string {
  let out = String(text ?? '');
  if (!out) return out;
  for (const [pattern, replacement] of INLINE_SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(INLINE_KV_PATTERN, (_match, key, closeQuote, sep, quote) => key + closeQuote + sep + quote + SECRET_MASK);
  return out;
}

/** URL 查询串里的密钥参数抹除 */
export function sanitizeUrl(url: string): string {
  const raw = String(url ?? '');
  if (!raw) return raw;
  const masked = sanitizeText(raw);
  try {
    const parsed = new URL(raw);
    let touched = false;
    const keys: string[] = [];
    parsed.searchParams.forEach((_value: string, key: string) => keys.push(key));
    for (const key of keys) {
      if (isSensitiveKey(key)) {
        parsed.searchParams.set(key, SECRET_MASK);
        touched = true;
      }
    }
    return touched ? parsed.toString() : masked;
  } catch {
    return masked;
  }
}

/** 任意 JSON 值递归清洗（返回新对象，不改原值） */
export function sanitizeJson(value: unknown, depth = 0): unknown {
  if (depth > 12) return value;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeJson(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = SECRET_MASK;
        continue;
      }
      out[key] = sanitizeJson(item, depth + 1);
    }
    return out;
  }
  return value;
}

/** 正文：JSON 就按结构洗，否则按文本洗 */
export function sanitizeBody(body: string): string {
  const raw = String(body ?? '');
  if (!raw.trim()) return raw;
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(sanitizeJson(parsed));
  } catch {
    return sanitizeText(raw);
  }
}

export type HeaderPairs = Array<[string, string]>;

/** 标头统一成二元数组：支持 Headers、[name, value] 数组与普通对象三种形态 */
function headerPairs(input: unknown): HeaderPairs {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .filter((item) => Array.isArray(item) && item.length >= 2)
      .map((item) => [String(item[0]), String(item[1] ?? '')] as [string, string]);
  }
  if (typeof Headers !== 'undefined' && input instanceof Headers) {
    const out: HeaderPairs = [];
    input.forEach((value, name) => out.push([name, value]));
    return out;
  }
  if (typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).map(
      ([name, value]) => [name, value == null ? '' : String(value)] as [string, string]
    );
  }
  return [];
}

/** 标头：敏感键整体替换，其余值过一遍文本清洗 */
export function sanitizeHeaders(pairs: unknown): HeaderPairs {
  return headerPairs(pairs).map(([name, value]) => [
    name,
    isSensitiveKey(name) ? SECRET_MASK : sanitizeText(value),
  ] as [string, string]);
}

export interface SanitizableLog {
  url?: string;
  requestHeaders?: unknown;
  requestBody?: string;
  response?: { headers?: unknown; [key: string]: unknown } | null;
  [key: string]: unknown;
}

/**
 * 上传前的整体清洗：URL、请求头、正文、响应头全部过一遍。
 * 其余字段（状态码、耗时、usage、模型名等）原样保留。
 */
export function sanitizeLogForUpload<T extends SanitizableLog>(record: T): T {
  const next: any = { ...record };
  if (typeof next.url === 'string') next.url = sanitizeUrl(next.url);
  next.requestHeaders = sanitizeHeaders(next.requestHeaders);
  if (typeof next.requestBody === 'string') next.requestBody = sanitizeBody(next.requestBody);
  if (next.response && typeof next.response === 'object') {
    next.response = { ...next.response, headers: sanitizeHeaders((next.response as any).headers) };
  }
  return next as T;
}
