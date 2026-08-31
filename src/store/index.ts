import { defaultSettings, type Settings } from '../types/settings';
import type { HistoryEntry } from '../types/save';
import { MAX_HISTORY, DETAIL_KEEP } from '../constants/pricing';

export type State = {
  // 单一聚合（废弃多存档）
  history: HistoryEntry[];
  total_tokens: number;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  input_cost: number;
  output_cost: number;
  rounds: number;
  startTime: number;
  lastUsage: any;
  settings: Settings;
  balance: any;
  customBalance: string | null;
  messageCount: number;
  // 兼容旧多存档（仅迁移用，不再对外暴露）
  _legacySaves?: Record<string, any>;
  _legacyCurrentSave?: string | null;
};

export const state: State = {
  history: [],
  total_tokens: 0,
  total_cost: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_hit_tokens: 0,
  cache_miss_tokens: 0,
  input_cost: 0,
  output_cost: 0,
  rounds: 0,
  startTime: Date.now(),
  lastUsage: null,
  settings: defaultSettings(),
  balance: null,
  customBalance: null,
  messageCount: 0,
};

// 兼容旧调用：统一返回单一聚合，忽略存档概念
function getCurrentChatIdForStore(): string | null {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.getCurrentChatId) {
      const v = ctx.getCurrentChatId();
      if (typeof v === 'string' && v) return v;
    }
    const chid = (globalThis as any).this_chid;
    const chars = (globalThis as any).characters;
    if (typeof chid === 'number' && Array.isArray(chars) && chars[chid]) {
      const c = chars[chid].chat;
      if (typeof c === 'string' && c) return c;
    }
  } catch {}
  return null;
}

export function getSelectedSave(): any {
  const scope = (state.settings as any).historyScope || 'all';
  if (scope !== 'current') {
    return {
      history: state.history,
      total_tokens: state.total_tokens,
      total_cost: state.total_cost,
      input_tokens: state.input_tokens,
      output_tokens: state.output_tokens,
      cache_hit_tokens: state.cache_hit_tokens,
      cache_miss_tokens: state.cache_miss_tokens,
      input_cost: state.input_cost,
      output_cost: state.output_cost,
      rounds: state.rounds,
      startTime: state.startTime,
    };
  }
  const cur = getCurrentChatIdForStore();
  if (!cur) {
    return {
      history: state.history,
      total_tokens: state.total_tokens,
      total_cost: state.total_cost,
      input_tokens: state.input_tokens,
      output_tokens: state.output_tokens,
      cache_hit_tokens: state.cache_hit_tokens,
      cache_miss_tokens: state.cache_miss_tokens,
      input_cost: state.input_cost,
      output_cost: state.output_cost,
      rounds: state.rounds,
      startTime: state.startTime,
    };
  }
  const filtered = (state.history || []).filter((h: any) => h.chatId === cur);
  // 按当前对话重算聚合
  let total_tokens = 0, total_cost = 0, input_tokens = 0, output_tokens = 0, cache_hit_tokens = 0, cache_miss_tokens = 0, input_cost = 0, output_cost = 0, rounds = 0;
  for (const h of filtered) {
    total_tokens += h.total_tokens || 0;
    total_cost += h.cost || 0;
    input_tokens += (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0);
    output_tokens += h.completion_tokens || 0;
    cache_hit_tokens += h.cache_hit_tokens || 0;
    cache_miss_tokens += h.cache_miss_tokens || 0;
    input_cost += h.input_cost || 0;
    output_cost += h.output_cost || 0;
    // rounds 仅 deepseek 官方模型
    if (typeof h.model === 'string' && h.model.toLowerCase().includes('deepseek')) rounds += 1;
  }
  const startTime = filtered.length ? Math.min(...filtered.map((h: any) => h.timestamp)) : state.startTime;
  return {
    history: filtered,
    total_tokens,
    total_cost,
    input_tokens,
    output_tokens,
    cache_hit_tokens,
    cache_miss_tokens,
    input_cost,
    output_cost,
    rounds,
    startTime,
  };
}

export function getMergedStats() { return getSelectedSave(); }

export function pruneHistoryDetails() {
  if (!state.history || state.history.length <= DETAIL_KEEP) return;
  const hs = [...state.history].sort((a, b) => b.timestamp - a.timestamp);
  for (let i = DETAIL_KEEP; i < hs.length; i++) {
    delete (hs[i] as any).messages;
    delete (hs[i] as any).fullRequest;
    delete (hs[i] as any).fullResponse;
  }
}

// 废弃：保留空实现以兼容旧导入导出迁移路径，内部不再创建新存档
export function createNewSave(): string { return 'default'; }
export function deleteSave(_key: string) {}

export function calculateRemainingRounds(stats?: any): number | null {
  const bal = state.customBalance !== null && state.customBalance !== ''
    ? parseFloat(state.customBalance)
    : state.balance?.balance ? parseFloat(state.balance.balance) : null;
  if (bal === null || isNaN(bal)) return null;
  const s = stats || getSelectedSave();
  if (!s) return null;
  const history = (s.history || []).filter((h: any) => typeof h.model === 'string' && h.model.toLowerCase().indexOf('deepseek') === 0);
  if (!history.length) return null;
  const alpha = 0.3;
  let ewma = history[history.length - 1].cost || 0;
  for (let i = history.length - 2; i >= 0; i--) ewma = alpha * (history[i].cost || 0) + (1 - alpha) * ewma;
  if (ewma <= 0) return null;
  return Math.floor(bal / ewma);
}
