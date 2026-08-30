/**
 * 统一仓库 — 所有对话数据的唯一 储存/调用/修改 入口
 * 过去（IndexedDB 冷数据）· 现在（extensionSettings 热数据 + 内存 state）· 未来（新增写入）
 * 任何直接读写 state.saves / saveHot / localStorage 的行为视为违规，应走本模块
 */
import { state, getSelectedSave } from '../store/index';
import { saveHot, loadHot, loadHistoryCold } from '../store/persistence';
import { calcCost, isDeepSeekOfficialModel } from '../services/pricing';
import { MAX_HISTORY, DETAIL_KEEP } from '../constants/pricing';
import { emit, DataEvents } from './events';
import type { Snapshot } from './types';

// 内部：裁剪详情（与 store/pruneHistoryDetails 同逻辑，但收敛于此）
function pruneDetails() {
  for (const k of Object.keys(state.saves)) {
    const s: any = state.saves[k];
    if (!s?.history || s.history.length <= DETAIL_KEEP) continue;
    const hs = [...s.history].sort((a: any, b: any) => b.timestamp - a.timestamp);
    for (let i = DETAIL_KEEP; i < hs.length; i++) {
      delete (hs[i] as any).messages;
      delete (hs[i] as any).fullRequest;
      delete (hs[i] as any).fullResponse;
    }
  }
}

function persist() {
  pruneDetails();
  saveHot({
    saves: state.saves,
    currentSave: state.currentSave,
    settings: state.settings,
    balance: state.balance,
    customBalance: state.customBalance,
    messageCount: state.messageCount,
    lastUsage: state.lastUsage,
  });
  emit(DataEvents.UPDATED);
}

export const repository = {
  // 读：快照（供导出/同步）
  snapshot(): Snapshot {
    return {
      saves: state.saves,
      currentSave: state.currentSave,
      settings: state.settings,
      balance: state.balance,
      customBalance: state.customBalance,
      messageCount: state.messageCount,
      lastUsage: state.lastUsage,
    };
  },

  // 读：聚合视图（用量概览/统计唯一调用）
  getAggregated() { return getSelectedSave(); },

  // 读：按时间过滤（用量统计）
  getHistoryByRange(range: { start: string; end: string }) {
    const s: any = getSelectedSave();
    if (!s?.history) return [];
    // localDay 已在 computed 中处理，此处仅按字符串比较（YYYY-MM-DD）
    const toDay = (ts: number) => new Date(ts + 8*3600*1000).toISOString().slice(0,10);
    return s.history.filter((h: any) => {
      const k = toDay(h.timestamp);
      return k >= range.start && k <= range.end;
    });
  },

  // 读：冷数据（按需）
  async getColdHistory(saveKey: string) { return loadHistoryCold(saveKey); },

  // 写：新增一条对话（未来数据的唯一入口，替代 interception 直接 push）
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

    let s: any = null;
    if (state.currentSave === '__all__') {
      let lt = 0, real: any = null;
      for (const k of Object.keys(state.saves)) { const sv: any = state.saves[k]; if (sv && sv.startTime > lt) { lt = sv.startTime; real = sv; } }
      s = real || state.saves[Object.keys(state.saves)[0]];
    } else s = state.saves[state.currentSave as string];
    if (!s) return null;

    const entry: any = {
      timestamp: lu.timestamp, model, prompt_tokens: hit + miss, cache_hit_tokens: hit, cache_miss_tokens: miss,
      completion_tokens: comp, total_tokens: total, input_cost: lu.input_cost, output_cost: lu.output_cost,
      cost: lu.cost, cache_hit_rate: (hit + miss) > 0 ? (hit / (hit + miss) * 100) : 0, priceType: lu.priceType,
      raw_usage: usage, messages, duration, ttft, thinkTime, thinkTokens, tokenRate: lu.tokenRate, fullRequest, fullResponse,
    };
    s.history.unshift(entry);
    s.total_tokens += total; s.total_cost += lu.cost; s.input_tokens += hit + miss; s.output_tokens += comp;
    s.cache_hit_tokens += hit; s.cache_miss_tokens += miss; s.input_cost += lu.input_cost; s.output_cost += lu.output_cost;
    if (isDeepSeekOfficialModel(model)) s.rounds += 1;
    if (s.history.length > MAX_HISTORY) s.history = s.history.slice(0, MAX_HISTORY);
    s._mtime = Date.now();
    persist();
    emit(DataEvents.HISTORY_ADDED, entry);
    return entry;
  },

  // 写：批量重算（定价变更后）
  recalcAll() {
    for (const k of Object.keys(state.saves)) {
      const s: any = state.saves[k];
      for (const h of s.history || []) {
        const c: any = calcCost({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings as any);
        h.input_cost = c.input; h.output_cost = c.output; h.cost = c.total; h.priceType = c.priceType;
        h.cache_hit_rate = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) > 0 ? ((h.cache_hit_tokens || 0) / ((h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0)) * 100) : 0;
      }
    }
    persist();
  },

  // 写：设置/余额/导入/同步等批量替换（受控）
  replaceAll(next: Partial<Snapshot>) {
    if (next.saves !== undefined) state.saves = next.saves as any;
    if (next.currentSave !== undefined) state.currentSave = next.currentSave as any;
    if (next.settings !== undefined) state.settings = next.settings as any;
    if (next.balance !== undefined) state.balance = next.balance;
    if (next.customBalance !== undefined) state.customBalance = next.customBalance as any;
    if (next.messageCount !== undefined) state.messageCount = next.messageCount as any;
    if (next.lastUsage !== undefined) state.lastUsage = next.lastUsage as any;
    persist();
    if (next.settings) emit(DataEvents.SETTINGS_CHANGED);
    if (next.balance !== undefined || next.customBalance !== undefined) emit(DataEvents.BALANCE_CHANGED);
  },

  // 读：初始化加载（过去数据的唯一入口）
  async hydrate() {
    const hot: any = await loadHot();
    if (hot) {
      if (hot.saves) state.saves = hot.saves;
      if (hot.currentSave) state.currentSave = hot.currentSave;
      if (hot.settings) state.settings = { ...state.settings, ...hot.settings };
      if (hot.balance) state.balance = hot.balance;
      if (hot.customBalance) state.customBalance = hot.customBalance;
      if (hot.messageCount) state.messageCount = hot.messageCount;
      if (hot.lastUsage) state.lastUsage = hot.lastUsage;
    }
    // 存档兜底由 store/createNewSave 保证，hydrate 不擅自创建以保持可预测
    emit(DataEvents.UPDATED);
    return this.snapshot();
  },
};
