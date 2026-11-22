/**
 * 消息 ↔ 用量记录配对（纯逻辑，可直接单测）
 *
 * 聊天页要在每条回复旁标「这一轮花了多少钱」，先得认出这条消息对应历史里的哪一条记录。
 * 锚点全部取自酒馆内核写进消息的字段，**不读请求体**（请求体会随扩展模板漂移）：
 *  - gen_started / gen_finished：一次生成的起止时刻（ST/TT 都写，毫秒精度）
 *  - extra.prompt_cache：TT 把上游 usage 的输入/命中量原样留在消息上，是与记录对齐的最强指纹
 *  - extra.model：非流式路径会写模型名
 *
 * 记录侧的 timestamp 是「入库时刻」（≈ 响应结束），必然落在 [gen_started, gen_finished + 容差] 内。
 * 判据分三层，宁缺勿错：
 *  L1 指纹：消息上的 prompt_cache.input_tokens / cached_tokens 与记录的 prompt_tokens / cache_hit_tokens 完全相等；
 *  L2 时间窗 + 来源：只认 requestOrigin.kind 为酒馆（或旧记录的空来源）的记录，取离 gen_finished 最近的一条；
 *  L3 兜底：没有 gen_finished 时，时间窗内只有唯一候选才采用。
 * 两条候选与锚点的距离差小于 MATCH_AMBIGUITY_MS 视为并发歧义（扩展请求和对话请求同时落地），直接放弃。
 */

/** L1 指纹命中 */
export const MATCH_FINGERPRINT = 'fingerprint';
/** L2 时间窗 + 来源命中 */
export const MATCH_TIME = 'time';
/** L3 时间窗内唯一候选 */
export const MATCH_LOOSE = 'loose';

export type MessageMatchConfidence = 'fingerprint' | 'time' | 'loose';

export type MessageAnchor = {
  chatId?: string | null;
  genStarted?: unknown;
  genFinished?: unknown;
  promptCache?: { input_tokens?: unknown; cached_tokens?: unknown } | null;
  model?: string | null;
};

export type MessageUsage = {
  timestamp: number;
  model: string;
  cost: number;
  costEstimated: boolean;
  pricingSource: string;
  promptTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
  ttft: number;
  tokenRate: number;
  cacheHitRate: number;
  confidence: MessageMatchConfidence;
};

/** 记录入库时刻只会略晚于 gen_started，给 1.5s 容差吸收时钟抖动 */
export const MATCH_WINDOW_BEFORE_MS = 1500;
/** 入库时刻 ≈ gen_finished，但流式收尾与 usage 解析可能晚到，给 5s */
export const MATCH_WINDOW_AFTER_MS = 5000;
/** 两条候选与锚点的距离差小于它视为并发歧义 */
export const MATCH_AMBIGUITY_MS = 300;

/** 内核把 gen_started/gen_finished 写成 Date，structuredClone 后仍是 Date；老数据可能是数字或字符串 */
export function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  const getTime = (value as any)?.getTime;
  if (typeof getTime === 'function') {
    const t = Number(getTime.call(value));
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 只认「酒馆主流程」的记录：旧记录没有 requestOrigin，按空来源放行 */
function isTavernEntry(entry: any): boolean {
  const kind = entry?.requestOrigin?.kind;
  return kind == null || kind === 'tavern' || kind === 'unknown';
}

function toUsage(entry: any, confidence: MessageMatchConfidence): MessageUsage {
  const promptTokens = finiteNumber(entry?.prompt_tokens) ?? 0;
  const cacheHitTokens = finiteNumber(entry?.cache_hit_tokens) ?? 0;
  const cacheMissTokens = finiteNumber(entry?.cache_miss_tokens) ?? Math.max(0, promptTokens - cacheHitTokens);
  const hitRate = finiteNumber(entry?.cache_hit_rate)
    ?? (promptTokens > 0 ? (cacheHitTokens / promptTokens) * 100 : 0);
  return {
    timestamp: finiteNumber(entry?.timestamp) ?? 0,
    model: String(entry?.model || ''),
    cost: finiteNumber(entry?.cost) ?? 0,
    costEstimated: entry?.costEstimated === true || entry?.usageSource === 'estimated',
    pricingSource: String(entry?.pricingSource || ''),
    promptTokens,
    cacheHitTokens,
    cacheMissTokens,
    completionTokens: finiteNumber(entry?.completion_tokens) ?? 0,
    ttft: finiteNumber(entry?.ttft) ?? 0,
    tokenRate: finiteNumber(entry?.tokenRate) ?? 0,
    cacheHitRate: hitRate,
    confidence,
  };
}

/**
 * 在 entries（通常是 state.history，最近的在前）里找出这条消息对应的记录。
 * 认不出返回 null —— 调用方不显示任何东西，绝不猜一条。
 */
export function matchMessageUsage(anchor: MessageAnchor | null | undefined, entries: readonly any[] | null | undefined): MessageUsage | null {
  if (!anchor || !Array.isArray(entries) || !entries.length) return null;
  const start = toMs(anchor.genStarted);
  const end = toMs(anchor.genFinished);
  const chatId = anchor.chatId ? String(anchor.chatId) : null;
  const wantInput = finiteNumber(anchor.promptCache?.input_tokens);
  const wantCached = finiteNumber(anchor.promptCache?.cached_tokens);

  const inWindow: any[] = [];
  for (const entry of entries) {
    const ts = finiteNumber(entry?.timestamp);
    if (ts == null) continue;
    if (chatId && entry.chatId && String(entry.chatId) !== chatId) continue;
    if (start != null && ts < start - MATCH_WINDOW_BEFORE_MS) continue;
    if (end != null) {
      if (ts > end + MATCH_WINDOW_AFTER_MS) continue;
    } else if (start != null && ts < start) {
      continue;
    }
    inWindow.push(entry);
  }
  if (!inWindow.length) return null;

  // L1：消息上的缓存用量是上游 usage 的副本，与记录里的两份数字完全相等才算同一次生成
  if (wantInput != null && wantCached != null) {
    const byFingerprint = inWindow.filter(entry => finiteNumber(entry.prompt_tokens) === wantInput
      && (finiteNumber(entry.cache_hit_tokens) ?? 0) === wantCached);
    if (byFingerprint.length) {
      const best = pickNearest(byFingerprint, end ?? start);
      if (best) return toUsage(best, 'fingerprint');
    }
  }

  // L2：扩展直连与 iframe 脚本的请求不算这一轮对话
  const tavern = inWindow.filter(isTavernEntry);
  if (!tavern.length) return null;

  const ref = end ?? start;
  const ranked = ref == null
    ? tavern.slice().sort((a, b) => (finiteNumber(b.timestamp) ?? 0) - (finiteNumber(a.timestamp) ?? 0))
    : pickNearest(tavern, ref) ? sortByDistance(tavern, ref) : tavern.slice();

  const chosen = ranked[0];
  if (!chosen) return null;
  if (end != null && ranked.length > 1) {
    const d0 = Math.abs((finiteNumber(ranked[0].timestamp) ?? 0) - end);
    const d1 = Math.abs((finiteNumber(ranked[1].timestamp) ?? 0) - end);
    // 两条一样近、Token 又不同：多半是并发请求混进来了，宁可这一条不显示
    if (Math.abs(d1 - d0) < MATCH_AMBIGUITY_MS
      && !(finiteNumber(ranked[0].prompt_tokens) === finiteNumber(ranked[1].prompt_tokens)
        && finiteNumber(ranked[0].completion_tokens) === finiteNumber(ranked[1].completion_tokens))) {
      return null;
    }
  }
  const confidence: MessageMatchConfidence = end != null ? 'time' : (ranked.length === 1 ? 'loose' : 'time');
  return toUsage(chosen, confidence);
}

function sortByDistance(entries: any[], ref: number): any[] {
  return entries.slice().sort((a, b) => {
    const da = Math.abs((finiteNumber(a.timestamp) ?? 0) - ref);
    const db = Math.abs((finiteNumber(b.timestamp) ?? 0) - ref);
    return da - db;
  });
}

function pickNearest(entries: any[], ref: number | null): any | null {
  if (!entries.length) return null;
  if (ref == null) return entries[0] || null;
  return sortByDistance(entries, ref)[0] || null;
}
