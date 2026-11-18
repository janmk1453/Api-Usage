// 统一截断判定：正常结束的 finish_reason 白名单之外均视为非正常结束（截断）
// 覆盖 length（达 max_tokens）、content_filter / sensitive（安全策略截断）及厂商自定义值
const NORMAL_FINISH = new Set([
  'stop',
  'eos',
  'end_turn',
  'stop_sequence',
  'tool_calls',
  'function_call',
  'tool_use',
]);

export function isTruncatedFinish(fr: string | null | undefined): boolean {
  if (!fr) return false;
  return !NORMAL_FINISH.has(String(fr).toLowerCase());
}

/** 用户自己点了停止：这一轮本来就该停在这里，不是模型侧截断 */
export function isUserStoppedFinish(entry: { interrupted?: string | null } | null | undefined): boolean {
  return String((entry as any)?.interrupted || '') === 'user';
}

/**
 * 单条记录是否算「截断」的唯一口径。
 * 除了 finish_reason 白名单，还要看中断来源：用户手动停止不计入截断（否则详情会显示
 * 「是 (interrupted)」、截断率与能耗评分也会把用户自己的操作算成模型的问题）。
 * 上游断流、达 max_tokens、安全策略拦截仍然算截断。
 * 展示与统计一律走这里，不要各自拼 isTruncatedFinish(h.finishReason) || h.isTruncated。
 */
export function isTruncatedOf(
  entry: { finishReason?: string | null; isTruncated?: boolean; interrupted?: string | null } | null | undefined,
): boolean {
  if (!entry) return false;
  if (isUserStoppedFinish(entry)) return false;
  return entry.isTruncated === true || isTruncatedFinish(entry.finishReason);
}
