/**
 * 输出速率口径（单一来源）
 *
 * 速率 = 输出 Token / 生成阶段耗时（duration - ttft）。
 * 非流式或假流式请求（上游一次性返回全文）会让 duration - ttft 塌缩到几百毫秒，
 * 从而算出上千 t/s 的假速率，因此这里统一做两道防护：
 *   1. streamed === false 直接判定不可测，速率与 TTFT 均不参与统计；
 *   2. 数值兜底：生成阶段窗口过短，或结果超过 MAX_PLAUSIBLE_RATE，一律归 0。
 */

/** 速率上限（t/s）；超过视为异常数据 */
export const MAX_PLAUSIBLE_RATE = 1000;

/** 生成阶段最小窗口（ms）；低于此值无法得到有意义的速率 */
export const MIN_OUTPUT_WINDOW_MS = 200;

/**
 * 清洗历史遗留的速率：非有限值或超过上限一律归 0。
 * 用于 hydrate 迁移与导入数据清洗。
 */
export function sanitizeRate(rate: unknown): number {
  const value = typeof rate === 'number' ? rate : parseFloat(String(rate));
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > MAX_PLAUSIBLE_RATE) return 0;
  return Math.round(value);
}

/** 速率测量所需字段：历史记录与请求快照都满足，其余字段忽略 */
export interface RateSample {
  duration?: number | null;
  ttft?: number | null;
  completion_tokens?: number | null;
  streamed?: boolean | null;
}

/**
 * 测量输出速率（t/s），不可测时返回 null。
 *
 * 与 computeTokenRate 同源同口径，区别只在「不可测」怎么表达：
 * - computeTokenRate 面向入库，不可测与超上限都写成 0；
 * - 这里保留未取整、未截断的真实测量值，供健康扫描判断「耗时/流式判定是不是坏了」——
 *   真离谱的速率要能被看见，不能在入库那一步就被抹平。
 * 不可测的判定：非流式 / 无输出 / 无耗时 / TTFT 缺失 / TTFT≈总耗时 / 生成窗口过短。
 */
export function measureTokenRate(sample: RateSample | null | undefined): number | null {
  if (!sample) return null;
  // 非流式（含上游一次性返回）的耗时不含生成过程，速率不可信
  if (sample.streamed === false) return null;
  const dur = Number(sample.duration);
  const first = Number(sample.ttft);
  const comp = Number(sample.completion_tokens);
  if (!Number.isFinite(dur) || dur <= 0) return null;
  if (!Number.isFinite(comp) || comp <= 0) return null;
  // TTFT 不可信（非流式/未知）时不参与速率统计
  if (!Number.isFinite(first) || first <= 0) return null;
  // 首字与全文几乎同时到达：TTFT 无意义，速率也不可信（与 sanitizeHistoryTiming 同口径）
  if (first >= dur * 0.98) return null;
  const window = dur - first;
  if (window < MIN_OUTPUT_WINDOW_MS) return null;
  const rate = (comp / window) * 1000;
  if (!Number.isFinite(rate) || rate < 0) return null;
  // 不在这里取整：健康扫描要按小数位区分「0.1 t/s」和「完全测不出来」
  return rate;
}

/**
 * 计算输出速率（t/s），入库形态：不可测或超过上限一律记 0。
 * @param duration 整轮耗时（ms）
 * @param ttft 首字延迟（ms）
 * @param completionTokens 输出 Token 数
 * @param streamed 是否为真实流式；false 表示非流式/假流式，速率不可测
 */
export function computeTokenRate(opts: {
  duration: number;
  ttft: number;
  completionTokens: number;
  streamed?: boolean | null;
}): number {
  const rate = measureTokenRate({
    duration: opts.duration,
    ttft: opts.ttft,
    completion_tokens: opts.completionTokens,
    streamed: opts.streamed,
  });
  return rate == null ? 0 : sanitizeRate(rate);
}

/**
 * 迁移清洗：把一次性返回造成的异常速率与失真 TTFT 归零。
 * @returns 是否有条目被修改
 */
export function sanitizeHistoryTiming(entry: any): boolean {
  if (!entry || typeof entry !== 'object') return false;
  let changed = false;
  const rate = entry.tokenRate;
  if (typeof rate === 'number' && Number.isFinite(rate) && (rate > MAX_PLAUSIBLE_RATE || rate < 0)) {
    entry.tokenRate = 0;
    changed = true;
  }
  const dur = typeof entry.duration === 'number' ? entry.duration : 0;
  const first = typeof entry.ttft === 'number' ? entry.ttft : 0;
  // TTFT 几乎等于总耗时：说明首字与全文同时到达，TTFT 无意义
  if (dur > 0 && first > 0 && first >= dur * 0.98) {
    entry.ttft = 0;
    entry.tokenRate = 0;
    changed = true;
  }
  return changed;
}