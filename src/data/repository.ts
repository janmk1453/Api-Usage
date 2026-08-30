/**
 * 统一仓库 — 单一历史的唯一 储存/调用/修改 入口
 * 已废弃多存档，所有数据归一至 state.history + 聚合字段
 */
import { state, getSelectedSave } from '../store/index';
import { saveHot, loadHot, loadHistoryCold, appendHistoryCold, getAllHistory } from '../store/persistence';
import { calcCost, isDeepSeekOfficialModel } from '../services/pricing';
import { MAX_HISTORY, DETAIL_KEEP } from '../constants/pricing';
import { emit, DataEvents } from './events';
import type { Snapshot } from './types';

function pruneDetails() {
  if (!state.history || state.history.length <= DETAIL_KEEP) return;
  const hs = [...state.history].sort((a: any, b: any) => b.timestamp - a.timestamp);
  for (let i = DETAIL_KEEP; i < hs.length; i++) {
    delete (hs[i] as any).messages;
    delete (hs[i] as any).fullRequest;
    delete (hs[i] as any).fullResponse;
  }
}

function persist() {
  pruneDetails();
  saveHot({
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
    settings: state.settings,
    balance: state.balance,
    customBalance: state.customBalance,
    messageCount: state.messageCount,
    lastUsage: state.lastUsage,
  });
  emit(DataEvents.UPDATED);
}

export const repository = {
  snapshot(): Snapshot {
    return {
      saves: {} as any,
      currentSave: null as any,
      settings: state.settings,
      balance: state.balance,
      customBalance: state.customBalance,
      messageCount: state.messageCount,
      lastUsage: state.lastUsage,
      history: state.history as any,
      total_tokens: state.total_tokens as any,
      total_cost: state.total_cost as any,
    } as any;
  },

  getAggregated() { return getSelectedSave(); },

  getHistoryByRange(range: { start: string; end: string }) {
    const s: any = getSelectedSave();
    if (!s?.history) return [];
    const toDay = (ts: number) => new Date(ts + 8*3600*1000).toISOString().slice(0,10);
    return s.history.filter((h: any) => {
      const k = toDay(h.timestamp);
      return k >= range.start && k <= range.end;
    });
  },

  async getColdHistory() { return loadHistoryCold(); },

  async getAllHistory() { return getAllHistory(); },

  addEntry(usage: any, model: string, messages: any[], startTime: number, fullRequest?: any, fullResponse?: any, ttft = 0, thinkTime = 0) {
    messages = messages || [];
    if (!model) try { model = (globalThis as any).SillyTavern?.getContext?.().model || 'deepseek-v4-flash'; } catch { model = 'deepseek-v4-flash'; }
    let hit = usage.prompt_cache_hit_tokens || 0;
    if (!hit && usage.prompt_tokens_details?.cached_tokens) hit = usage.prompt_tokens_details.cached_tokens;
    let miss = usage.prompt_cache_miss_tokens;
    if (miss === undefined || miss === null) { miss = (usage.prompt_tokens || usage.input_tokens || 0) - hit; if (miss < 0) miss = 0; }
    const comp = usage.completion_tokens || usage.output_tokens || 0;
    const total = usage.total_tokens || hit + miss + comp;
    const lu: any = { timestamp: Date.now(), model, prompt_tokens: hit + miss, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp, total_tokens: total };
    const duration = startTime ? Date.now() - startTime : 0;
    const thinkTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
    lu.duration = duration;
    lu.tokenRate = duration - (ttft || 0) > 50 && comp > 0 ? Math.round((comp / (duration - (ttft || 0))) * 1000) : 0;
    lu.ttft = ttft || 0; lu.thinkTime = thinkTime || 0; lu.thinkTokens = thinkTokens; lu.messages = messages;
    const c: any = calcCost({ timestamp: lu.timestamp, model, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp }, state.settings as any);
    lu.cost = c.total; lu.input_cost = c.input; lu.output_cost = c.output; lu.priceType = c.priceType;
    lu.raw_usage = usage; lu.fullRequest = fullRequest; lu.fullResponse = fullResponse;
    state.lastUsage = lu;

    const entry: any = {
      timestamp: lu.timestamp, model, prompt_tokens: hit + miss, cache_hit_tokens: hit, cache_miss_tokens: miss,
      completion_tokens: comp, total_tokens: total, input_cost: lu.input_cost, output_cost: lu.output_cost,
      cost: lu.cost, cache_hit_rate: (hit + miss) > 0 ? (hit / (hit + miss) * 100) : 0, priceType: lu.priceType,
      raw_usage: usage, messages, duration, ttft, thinkTime, thinkTokens, tokenRate: lu.tokenRate, fullRequest, fullResponse,
    };
    state.history.unshift(entry);
    state.total_tokens += total; state.total_cost += lu.cost; state.input_tokens += hit + miss; state.output_tokens += comp;
    state.cache_hit_tokens += hit; state.cache_miss_tokens += miss; state.input_cost += lu.input_cost; state.output_cost += lu.output_cost;
    if (isDeepSeekOfficialModel(model)) state.rounds += 1;
    if (state.history.length > MAX_HISTORY) {
      const overflow = state.history.slice(MAX_HISTORY);
      // 关键修复：溢出不再静默丢弃，转入冷存储（IndexedDB），fire-and-forget
      appendHistoryCold(overflow).catch(() => {});
      state.history = state.history.slice(0, MAX_HISTORY);
    }
    state.startTime = state.startTime || Date.now();
    persist();
    emit(DataEvents.HISTORY_ADDED, entry);
    return entry;
  },

  recalcAll() {
    for (const h of state.history || []) {
      const c: any = calcCost({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings as any);
      h.input_cost = c.input; h.output_cost = c.output; h.cost = c.total; h.priceType = c.priceType;
      h.cache_hit_rate = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) > 0 ? ((h.cache_hit_tokens || 0) / ((h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0)) * 100) : 0;
    }
    persist();
  },

  replaceAll(next: Partial<Snapshot> & any) {
    if (next.history !== undefined) {
      const h = next.history as any[];
      if (h.length > MAX_HISTORY) {
        const overflow = h.slice(MAX_HISTORY);
        appendHistoryCold(overflow).catch(() => {});
        state.history = h.slice(0, MAX_HISTORY);
      } else {
        state.history = h as any;
      }
    }
    if (next.total_tokens !== undefined) state.total_tokens = next.total_tokens as any;
    if (next.total_cost !== undefined) state.total_cost = next.total_cost as any;
    if (next.input_tokens !== undefined) state.input_tokens = next.input_tokens as any;
    if (next.output_tokens !== undefined) state.output_tokens = next.output_tokens as any;
    if (next.cache_hit_tokens !== undefined) state.cache_hit_tokens = next.cache_hit_tokens as any;
    if (next.cache_miss_tokens !== undefined) state.cache_miss_tokens = next.cache_miss_tokens as any;
    if (next.input_cost !== undefined) state.input_cost = next.input_cost as any;
    if (next.output_cost !== undefined) state.output_cost = next.output_cost as any;
    if (next.rounds !== undefined) state.rounds = next.rounds as any;
    if (next.startTime !== undefined) state.startTime = next.startTime as any;
    // 兼容旧 saves 导入：合并至单一历史
    if (next.saves) {
      let all: any[] = [...(state.history || [])];
      for (const s of Object.values(next.saves as any)) {
        const h = (s as any).history || [];
        all = all.concat(h);
        state.total_tokens += (s as any).total_tokens || 0;
        state.total_cost += (s as any).total_cost || 0;
        state.input_tokens += (s as any).input_tokens || 0;
        state.output_tokens += (s as any).output_tokens || 0;
        state.cache_hit_tokens += (s as any).cache_hit_tokens || 0;
        state.cache_miss_tokens += (s as any).cache_miss_tokens || 0;
        state.input_cost += (s as any).input_cost || 0;
        state.output_cost += (s as any).output_cost || 0;
        state.rounds += (s as any).rounds || 0;
      }
      all.sort((a: any, b: any) => b.timestamp - a.timestamp);
      const seen = new Set<number>();
      const dedup: any[] = [];
      for (const h of all) { if (!seen.has(h.timestamp)) { seen.add(h.timestamp); dedup.push(h); } }
      if (dedup.length > MAX_HISTORY) {
        const overflow = dedup.slice(MAX_HISTORY);
        appendHistoryCold(overflow).catch(() => {});
      }
      state.history = dedup.slice(0, MAX_HISTORY);
    }
    if (next.settings !== undefined) state.settings = next.settings as any;
    if (next.balance !== undefined) state.balance = next.balance;
    if (next.customBalance !== undefined) state.customBalance = next.customBalance as any;
    if (next.messageCount !== undefined) state.messageCount = next.messageCount as any;
    if (next.lastUsage !== undefined) state.lastUsage = next.lastUsage as any;
    persist();
    if (next.settings) emit(DataEvents.SETTINGS_CHANGED);
    if (next.balance !== undefined || next.customBalance !== undefined) emit(DataEvents.BALANCE_CHANGED);
  },

  async hydrate() {
    const hot: any = await loadHot();
    if (hot) {
      if (hot.history) state.history = hot.history;
      if (hot.total_tokens !== undefined) state.total_tokens = hot.total_tokens;
      if (hot.total_cost !== undefined) state.total_cost = hot.total_cost;
      if (hot.input_tokens !== undefined) state.input_tokens = hot.input_tokens;
      if (hot.output_tokens !== undefined) state.output_tokens = hot.output_tokens;
      if (hot.cache_hit_tokens !== undefined) state.cache_hit_tokens = hot.cache_hit_tokens;
      if (hot.cache_miss_tokens !== undefined) state.cache_miss_tokens = hot.cache_miss_tokens;
      if (hot.input_cost !== undefined) state.input_cost = hot.input_cost;
      if (hot.output_cost !== undefined) state.output_cost = hot.output_cost;
      if (hot.rounds !== undefined) state.rounds = hot.rounds;
      if (hot.startTime !== undefined) state.startTime = hot.startTime;
      if (hot.settings) state.settings = { ...state.settings, ...hot.settings };
      if (hot.balance) state.balance = hot.balance;
      if (hot.customBalance) state.customBalance = hot.customBalance;
      if (hot.messageCount) state.messageCount = hot.messageCount;
      if (hot.lastUsage) state.lastUsage = hot.lastUsage;
    }
    emit(DataEvents.UPDATED);
    return this.snapshot();
  },
};
