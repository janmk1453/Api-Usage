/**
 * 本地 token 估算（单一来源）
 *
 * 用途：上游没有返回 usage（或返回全 0）时，用本地数据把这一轮补进历史，
 * 让用户至少能看到「这一轮花了多少」。三个来源按可信度降序：
 *
 * 1. `tavern-token-count`：酒馆自己算好的 `extra.token_count`（消息级计数，最贴近上游口径）；
 * 2. `tavern-tokenizer`：酒馆的 `getTokenCountAsync` 按当前 tokenizer 现算；
 * 3. `char-heuristic`：纯字符启发式，CJK 每字 0.6 token、其余每 3.5 字符 1 token。
 *
 * 返回的 method 会写进历史条目（estimateMethod），排查时能一眼看出是哪种估算。
 */

/** 估算口径版本：算法调整时必须加一，便于区分新旧估算数据 */
export const ESTIMATE_VERSION = 2;

export type EstimateMethod = 'tavern-token-count' | 'tavern-tokenizer' | 'char-heuristic';

export interface CharStats {
  chars: number;
  cjkChars: number;
}

/** CJK 与全角标点：这些字符的 token 密度明显高于拉丁字母 */
const CJK_RE = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/g;

export function charStats(text: unknown): CharStats {
  const raw = typeof text === 'string' ? text : '';
  const chars = raw.length;
  if (!chars) return { chars: 0, cjkChars: 0 };
  const matched = raw.match(CJK_RE);
  return { chars, cjkChars: matched ? matched.length : 0 };
}

/** 字符 → token 的兜底口径：CJK 0.6/字，其余 3.5 字符/token */
export function tokensFromChars(stats: CharStats): number {
  const chars = Math.max(0, Math.floor(stats.chars || 0));
  const cjk = Math.min(chars, Math.max(0, Math.floor(stats.cjkChars || 0)));
  const ascii = Math.max(0, chars - cjk);
  const tokens = Math.ceil(cjk * 0.6 + ascii / 3.5);
  return Math.max(0, tokens);
}

function contentToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    let out = '';
    for (const part of value) {
      if (typeof part === 'string') { out += part; continue; }
      if (part && typeof part === 'object') {
        const text = (part as any).text;
        if (typeof text === 'string') out += text;
      }
    }
    return out;
  }
  if (value && typeof value === 'object' && typeof (value as any).text === 'string') return String((value as any).text);
  return '';
}

/** 把一轮请求的 messages 拍平成纯文本（只用于计数，不上传、不落盘） */
export function messagesText(messages: unknown): string {
  if (!Array.isArray(messages)) return '';
  let out = '';
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const role = typeof (message as any).role === 'string' ? (message as any).role : '';
    const text = contentToText((message as any).content);
    if (role) out += role + ': ';
    out += text + '\n';
  }
  return out;
}

export function messagesCharStats(messages: unknown): CharStats {
  return charStats(messagesText(messages));
}

/** 酒馆 tokenizer：拿不到（旧版本、未就绪、报错）一律返回 null，绝不抛出 */
async function tavernTokenCount(text: string): Promise<number | null> {
  if (!text) return 0;
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const counter = ctx?.getTokenCountAsync || (globalThis as any).getTokenCountAsync;
    if (typeof counter !== 'function') return null;
    const value = await counter.call(ctx || globalThis, text);
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
  } catch {
    return null;
  }
}

export interface EstimateResult {
  tokens: number;
  method: EstimateMethod;
  chars: number;
  cjkChars: number;
}

/**
 * 估算一段文本的 token 数。
 * preferTokens 适合「酒馆已经算好了」的场景（extra.token_count），优先级最高。
 */
export async function estimateTextTokens(
  text: unknown,
  options: { preferTokens?: number | null } = {},
): Promise<EstimateResult> {
  const stats = charStats(text);
  const prefer = Number(options.preferTokens);
  if (Number.isFinite(prefer) && prefer > 0) {
    return { tokens: Math.round(prefer), method: 'tavern-token-count', chars: stats.chars, cjkChars: stats.cjkChars };
  }
  if (stats.chars > 0) {
    const counted = await tavernTokenCount(typeof text === 'string' ? text : '');
    if (counted != null && counted > 0) {
      return { tokens: counted, method: 'tavern-tokenizer', chars: stats.chars, cjkChars: stats.cjkChars };
    }
  }
  return { tokens: tokensFromChars(stats), method: 'char-heuristic', chars: stats.chars, cjkChars: stats.cjkChars };
}

/** 输入侧估算：按整轮 messages 拍平后的文本计数 */
export async function estimatePromptTokens(messages: unknown): Promise<EstimateResult> {
  return estimateTextTokens(messagesText(messages));
}
