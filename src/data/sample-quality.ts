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

/**
 * 是否「对话本身」发起的请求。
 *
 * 趋势预测看的是同一串上下文怎么长、每轮花多少：只有酒馆主流程的对话请求共享这条上下文。
 * 扩展 / 脚本直连的请求（摘要、向量、翻译、脚本调用……）各自独立、随时并发，
 * 塞进序列会把上下文增长曲线、压缩点和每轮成本全算歪，所以一律不进趋势统计。
 *
 * 旧记录没有 requestOrigin（null / undefined / kind:'unknown'）按对话放行——
 * 否则升级后历史数据会凭空消失。
 */
export function isConversationEntry(entry: AnyEntry): boolean {
  if (!entry) return false;
  const kind = (entry as any)?.requestOrigin?.kind;
  return kind !== 'extension' && kind !== 'script';
}

/** 请求类型筛选的值域（历史页与统计页共用） */
export type RequestTypeKey = 'conversation' | 'extension' | 'script' | 'interrupted' | 'estimated' | 'agent';

export const REQUEST_TYPE_KEYS: readonly RequestTypeKey[] = [
  'conversation',
  'extension',
  'script',
  'interrupted',
  'estimated',
  'agent',
];

/**
 * 一条记录命中的请求类型。
 *
 * 这里并存两条正交的轴：
 * - 来源轴：对话（酒馆主流程或未识别）/ 扩展 / 脚本；
 * - 状态轴：中断 / 估算 / Agent。
 * 所以一条记录可能同时命中多个键——筛选时用「包含」而非互斥，
 * 选「扩展」也能看到那几条被中断的扩展请求，选「中断」也能看到中断的对话请求。
 */
export function requestTypeKeysOf(entry: AnyEntry): RequestTypeKey[] {
  if (!entry) return [];
  const keys: RequestTypeKey[] = [];
  const kind = String((entry as any)?.requestOrigin?.kind || '');
  if (kind === 'extension') keys.push('extension');
  else if (kind === 'script') keys.push('script');
  else keys.push('conversation');
  if (isInterruptedEntry(entry)) keys.push('interrupted');
  if (isEstimatedEntry(entry)) keys.push('estimated');
  if (String((entry as any)?.origin || '') === 'agent') keys.push('agent');
  return keys;
}

/** 是否属于某个请求类型（调用方负责先把「全部」这种哨兵值排除掉） */
export function matchesRequestType(entry: AnyEntry, type: string | null | undefined): boolean {
  if (!type) return true;
  return requestTypeKeysOf(entry).includes(type as RequestTypeKey);
}
