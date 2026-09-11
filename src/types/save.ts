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
  /** SSE 最后一个非 null 的 choices[0].finish_reason；非正常结束（length / content_filter / sensitive 等）视为截断 */
  finishReason?: string | null;
  isTruncated?: boolean;
  chatId?: string | null;
  chatName?: string | null;
  /** 酒馆接入类型，对应 chat_completion_source */
  sourceType?: string | null;
  /** 接入地址的本地短哈希；旧记录为空 */
  endpointId?: string | null;
  /** 规范化后的接入地址；官方接口使用明确名称 */
  endpointLabel?: string | null;
  /** 酒馆密钥条目的本地稳定标识；未识别时为空 */
  credentialId?: string | null;
  /** 不包含明文密钥的展示名称 */
  credentialLabel?: string | null;
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
