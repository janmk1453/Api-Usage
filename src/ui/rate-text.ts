/**
 * 速率展示口径（单一来源）
 *
 * 真实速率（能测到首字且确实是流式）直接显示；测不出来的记录走服务层估算，
 * 这里统一加「≈」并把口径写进 title，避免把估算值当成上游实测值。
 * 历史列表、详情、对比窗口都从这里取文案，别再各自拼字符串。
 */

/** 估算速率所用的口径：见 data/token-rate.ts#RateEstimateSource */
export type RateEstimateKind = 'prefill' | 'duration';

export interface RateLike {
  tokenRate?: number | null;
  rateEstimated?: RateEstimateKind | null;
  streamed?: boolean | null;
}

/** 有效速率（>0 的整数），没有则 0 */
export function rateValueOf(entry: RateLike | null | undefined): number {
  const value = Number(entry?.tokenRate);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}

/** 这个速率是不是估算出来的 */
export function isEstimatedRate(entry: RateLike | null | undefined): boolean {
  if (!rateValueOf(entry)) return false;
  return entry?.rateEstimated === 'prefill' || entry?.rateEstimated === 'duration';
}

/**
 * 速率的展示文本。
 * @param fallback 没有速率时显示什么（列表用「未测速」，详情非流式用「非流式」）
 */
export function rateText(
  entry: RateLike | null | undefined,
  fallback = '未测速',
): string {
  const value = rateValueOf(entry);
  if (!value) return fallback;
  return isEstimatedRate(entry) ? '≈' + value + ' t/s' : value + ' t/s';
}

/** 速率的悬浮说明：空字符串表示不需要 title */
export function rateTitle(entry: RateLike | null | undefined): string {
  if (!rateValueOf(entry)) {
    if (entry?.streamed === false) return '非流式请求没有可测的首字时间，若连耗时都缺失就无法估算';
    return '本轮没有测到输出速率';
  }
  if (!isEstimatedRate(entry)) return '实测速率：输出 Token ÷ 生成窗口（总耗时 − 首字延迟）';
  if (entry?.rateEstimated === 'prefill') {
    return '估算速率：非流式响应测不到首字延迟，已按同模型典型首字延迟扣除输入处理时间后计算';
  }
  return '估算速率：按整轮耗时计算，包含排队与输入处理，只能作为下限参考';
}

/** 历史详情里的小标签文本（估算时返回「估算」，否则空串） */
export function rateBadgeText(entry: RateLike | null | undefined): string {
  return isEstimatedRate(entry) ? '估算' : '';
}
