/**
 * 样本可信度（单一来源）
 *
 * 中断记录与估算记录的数值口径都不等同于上游真实用量：
 * - 中断：耗时只到中断那一刻，速率/TTFT 没有参考价值；
 * - 估算：token 是本地推的，命中量无法区分（一律记 0），不能拿去算命中率。
 *
 * 因此金额与 token 总额照常累计（用户要看「花了多少」），
 * 但均值、速率、命中率与趋势预测必须把这些样本剔除，否则预测越跑越偏。
 */

import type { HistoryEntry } from '../types/save';

type AnyEntry = Partial<HistoryEntry> | null | undefined;

export function isEstimatedEntry(entry: AnyEntry): boolean {
  return String((entry as any)?.usageSource || '') === 'estimated';
}

export function isInterruptedEntry(entry: AnyEntry): boolean {
  const value = (entry as any)?.interrupted;
  return value === 'user' || value === 'upstream';
}

export function interruptKindOf(entry: AnyEntry): 'user' | 'upstream' | null {
  const value = (entry as any)?.interrupted;
  return value === 'user' || value === 'upstream' ? value : null;
}

/** 速度/TTFT/平均耗时类指标是否可用 */
export function isReliablePerformanceSample(entry: AnyEntry): boolean {
  if (!entry) return false;
  if (isInterruptedEntry(entry)) return false;
  if (isEstimatedEntry(entry)) return false;
  const duration = Number((entry as any).duration) || 0;
  return duration > 0;
}

/** 命中率类指标是否可用 */
export function isReliableCacheSample(entry: AnyEntry): boolean {
  if (!entry) return false;
  if (isInterruptedEntry(entry)) return false;
  if (isEstimatedEntry(entry)) return false;
  if ((entry as any).estimateCacheUnknown === true) return false;
  return true;
}

/** 趋势预测的序列样本是否可用（token 结构与成本模拟都要求上游真实用量） */
export function isReliableForecastSample(entry: AnyEntry): boolean {
  if (!entry) return false;
  if (isInterruptedEntry(entry)) return false;
  if (isEstimatedEntry(entry)) return false;
  return true;
}
