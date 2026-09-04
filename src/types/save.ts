export type HistoryEntry = {
  timestamp: number;
  model: string;
  prompt_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  input_cost: number;
  output_cost: number;
  cost: number;
  cache_hit_rate: number;
  priceType: string;
  raw_usage?: unknown;
  messages?: unknown[];
  fullRequest?: unknown;
  fullResponse?: unknown;
  duration?: number;
  tokenRate?: number;
  ttft?: number;
  thinkTime?: number;
  thinkTokens?: number;
  /** SSE 最后一个非 null 的 choices[0].finish_reason，length 表示被 max_tokens 截断 */
  finishReason?: string | null;
  isTruncated?: boolean;
  chatId?: string | null;
  chatName?: string | null;
};

export type Save = {
  name: string;
  character: string;
  startTime: number;
  _mtime?: number;
  total_tokens: number;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  input_cost: number;
  output_cost: number;
  rounds: number;
  history: HistoryEntry[];
  customBalance?: string | null;
};
