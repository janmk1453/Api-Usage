/**
 * 统一数据类型 — 贯穿过去/现在/未来的所有对话数据
 * 任何新增字段必须在此定义，并提供默认值以兼容旧数据
 */
import type { HistoryEntry, Save } from '../types/save';
import type { Settings, Balance } from '../types/settings';

export type { HistoryEntry, Save, Settings, Balance };

// 聚合视图（用量概览/统计的统一输入）
export type Aggregated = {
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
  startTime: number;
};

// 时间维度
export type TimeRange = {
  key: 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';
  start: string; // YYYY-MM-DD
  end: string;
  label: string;
};

// 统一存储快照（过去+现在）
export type Snapshot = {
  saves: Record<string, Save>;
  currentSave: string | '__all__' | null;
  settings: Settings;
  balance: Balance | null;
  customBalance: string | null;
  messageCount: number;
  lastUsage: HistoryEntry | null;
};

// 派生视图（供展示层唯一消费）
// - overview: 当前聚合的扁平指标，不在此算样式
// - stats: 按 TimeRange 过滤后的聚合
export type OverviewView = {
  balanceText: string;
  totalCost: number;
  totalTokens: number;
  hit: number; miss: number; output: number;
  hitRate: number;
  savings: number;
  inputCost: number; outputCost: number;
  avgCost: number; avgTokens: number; avgDuration: number; avgRate: number;
  rounds: number;
};

export type StatsView = {
  range: TimeRange;
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  byDay: Array<{ day: string; cost: number; tokens: number; byModel: Record<string, number> }>;
  byModel: Record<string, { cost: number; count: number }>;
};
