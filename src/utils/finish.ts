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
