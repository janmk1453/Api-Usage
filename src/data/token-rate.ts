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
 * 速率估算口径（非流式 / 假流式 / 测不到首字时使用）：
 * - prefill：先用同模型典型首字延迟估掉输入处理时间，再按剩余生成窗口算；
 * - duration：连首字延迟都估不出来时，直接按整轮耗时算（保守下限，含排队与输入处理）。
 */
export type RateEstimateSource = 'prefill' | 'duration';

export interface RateEstimate {
  rate: number;
  source: RateEstimateSource;
}

/** 估算参考样本：至少这么多条同模型流式记录才敢用来推首字延迟 */
export const MIN_PREFILL_SAMPLES = 3;

/** 估算时扣掉首字后至少还要有这么久，否则退回整轮耗时口径 */
export const MIN_ESTIMATE_WINDOW_MS = MIN_OUTPUT_WINDOW_MS;

/** 历史里的一条速率参考样本（只用到这几个字段） */
export interface PrefillSample {
  model?: string | null;
  ttft?: number | null;
  duration?: number | null;
  streamed?: boolean | null;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 从历史里取「典型首字延迟」（ms），用作非流式请求的输入处理耗时估计。
 *
 * 优先同模型的真实流式样本；样本不够才退到全部模型。只认可信样本：
 * 真实流式、TTFT > 0、耗时存在、且 TTFT 没有塌到总耗时上（假流式的典型症状）。
 * 拿不到就返回 null，调用方退回整轮耗时口径。
 */
export function prefillReferenceMs(
  history: PrefillSample[] | null | undefined,
  model?: string | null,
): number | null {
  if (!Array.isArray(history) || !history.length) return null;
  const usable = history.filter((h) => {
    if (!h || h.streamed === false) return false;
    const first = Number(h.ttft);
    const dur = Number(h.duration);
    if (!Number.isFinite(first) || first <= 0) return false;
    if (!Number.isFinite(dur) || dur <= 0) return false;
    // 首字与全文几乎同时到达：TTFT 不是真的首字延迟
    if (first >= dur * 0.98) return false;
    return true;
  });
  if (!usable.length) return null;
  const sameModel = model ? usable.filter((h) => String(h.model || '') === String(model)) : [];
  if (sameModel.length >= MIN_PREFILL_SAMPLES) {
    return Math.round(median(sameModel.map((h) => Number(h.ttft))));
  }
  if (usable.length >= MIN_PREFILL_SAMPLES) {
    return Math.round(median(usable.map((h) => Number(h.ttft))));
  }
  return null;
}

/**
 * 估算输出速率（t/s），只用于「测不出真实速率」的记录：
 * 非流式、上游一次性返回全文（假流式）、首字时间缺失或与总耗时重合。
 *
 * 先扣掉估计的输入处理时间（prefillMs），剩余窗口不足下限就退回整轮耗时口径——
 * 后者会把排队与输入处理算进分母，因此只能当保守下限，UI 必须标「估算」。
 * 与真实速率一样按 MAX_PLAUSIBLE_RATE 封顶，避免短耗时刷出离谱读数。
 */
export function estimateTokenRate(opts: {
  duration: number;
  completionTokens: number;
  prefillMs?: number | null;
}): RateEstimate | null {
  const dur = Number(opts.duration);
  const comp = Number(opts.completionTokens);
  if (!Number.isFinite(dur) || dur <= 0) return null;
  if (!Number.isFinite(comp) || comp <= 0) return null;
  const cap = (rate: number): number => Math.min(MAX_PLAUSIBLE_RATE, Math.round(rate));
  const prefill = Number(opts.prefillMs);
  const window = Number.isFinite(prefill) && prefill > 0
    ? dur - Math.min(prefill, dur * 0.9)
    : 0;
  if (window >= MIN_ESTIMATE_WINDOW_MS) {
    return { rate: cap((comp / window) * 1000), source: 'prefill' };
  }
  return { rate: cap((comp / dur) * 1000), source: 'duration' };
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