/**
 * 上游错误文案识别（纯逻辑，单一来源）
 *
 * 背景：TauriTavern 会把上游非 2xx 的失败包装成 HTTP 200 + content-type: text/event-stream
 * 返回页面，正文（content 增量）就是 "{provider} endpoint failed with status {code}: {上游 message}"。
 * 采集器若只看「有没有字符」，就会把这段错误提示当成模型输出，按本地估算入库、按全价计费、
 * 并按 estimated 判成「输出截断」——用户实际一个 token 的输出都没拿到。
 *
 * 判据只认客户端固定模板与界面文案，不做语义猜测：
 * - "endpoint failed with status 500"：TT 本地模板，唯一稳定锚点（首选）；
 * - "[API 错误]" / "[API Error]"：酒馆界面文案前缀（随语言变化，只作补充）；
 * - 整段就是上游错误 JSON（{"error":{"message":...}}）。
 *
 * 误伤防护（两层，缺一不可）：
 * 1) 只认「整段输出很短」（API_ERROR_MAX_CHARS 以内）的文本——错误提示只有一行；
 * 2) 模板必须落在**行首**——用户完全可能让模型解释这条报错，正文里出现同样的字样
 *    （"这个 500 是 Custom OpenAI endpoint failed with status 500 引起的…"）绝不能判成错误。
 * 命中即代表这一整段都不是模型内容。
 */

/** 错误文案的长度上限：正常错误提示几十到几百字符，超长一律不认，避免把长回复误判 */
export const API_ERROR_MAX_CHARS = 1200;

export type ApiErrorMarker = 'tauritavern-endpoint-status' | 'tavern-api-error-title' | 'upstream-error-json';

/**
 * 顺序即优先级：TT 模板最稳定，界面文案随语言变，上游 JSON 只在整段透传时出现。
 * 三条都锚在行首，句中引用一律不认；模板前的 provider 名只允许 ASCII 字母数字与常见分隔符
 * （"Custom OpenAI"、"Google AI Studio" 这类），中文句子开头因此不会误命中。
 */
const MARKERS: Array<{ id: ApiErrorMarker; test: RegExp }> = [
  { id: 'tauritavern-endpoint-status', test: /^[A-Za-z0-9 ._\-()]{0,80}?endpoint failed with status\s+\d{3}\b/i },
  { id: 'tavern-api-error-title', test: /^\[API\s*(?:错误|Error|錯誤)\]/i },
  { id: 'upstream-error-json', test: /^\{\s*"error"\s*:\s*\{[^}]*"message"/i },
];

export interface ApiErrorPayloadMatch {
  /** 命中的锚点标识（写进采集链路快照，便于区分是 TT 模板还是上游 JSON） */
  marker: ApiErrorMarker;
  /** 判定所用的文本长度（诊断用：与历史里的 outputChars 对齐） */
  chars: number;
}

/**
 * 这段文本是不是「上游错误提示被当成模型输出」。
 * 命中返回锚点与长度，不命中返回 null（空文本、超长文本一律不认）。
 */
export function detectApiErrorPayload(text: unknown): ApiErrorPayloadMatch | null {
  const t = String(text ?? '').trim();
  if (!t || t.length > API_ERROR_MAX_CHARS) return null;
  for (const marker of MARKERS) {
    if (marker.test.test(t)) return { marker: marker.id, chars: t.length };
  }
  return null;
}

/** 判定结果的稳定串（写进 capture 快照的 reason，供诊断包按锚点统计） */
export function apiErrorPayloadTag(match: ApiErrorPayloadMatch | null): string | null {
  return match ? match.marker + ':' + match.chars : null;
}
