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
import { defaultSettings } from '../types/settings';
import { isUnsafeKey } from '../utils/date';
import { log } from '../utils/logger';

function getCurrentChatId(): string | null {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.getCurrentChatId) {
      const v = ctx.getCurrentChatId();
      if (typeof v === 'string' && v) return v;
    }
    // 兼容：直接取 characters[this_chid]?.chat
    const chid = (globalThis as any).this_chid;
    const chars = (globalThis as any).characters;
    if (typeof chid === 'number' && Array.isArray(chars) && chars[chid]) {
      const c = chars[chid].chat;
      if (typeof c === 'string' && c) return c;
    }
  } catch {}
  return null;
}

function getCurrentChatName(): string | null {
  const id = getCurrentChatId();
  return id ? String(id) : null;
}

export function getFilteredHistoryForScope(): any[] {
  const scope = (state.settings as any).historyScope || 'all';
  if (scope !== 'current') return state.history || [];
  const cur = getCurrentChatId();
  if (!cur) return state.history || [];
  return (state.history || []).filter((h: any) => h.chatId === cur);
}

function sanitizeFullRequest(fr: any): any {
  if (!fr || typeof fr !== 'object') return fr;
  const keep: any = {};
  for (const k of ['model','stream','temperature','max_tokens','top_p','stream_options']) {
    if (fr[k] !== undefined) keep[k] = fr[k];
  }
  if (Array.isArray(fr.messages)) keep.messages_length = fr.messages.length;
  else if (typeof fr.messages === 'number') keep.messages_length = fr.messages;
  return keep;
}

function clampMessage(m: any): any {
  if (!m || typeof m !== 'object') return m;
  const c = typeof m.content === 'string'
    ? (m.content.length > 600 ? m.content.slice(0, 600) + '…[截断]' : m.content)
    : m.content;
  return { ...m, content: c };
}

function pruneDetails() {
  if (!state.history || !state.history.length) return;
  const hs = [...state.history].sort((a: any, b: any) => b.timestamp - a.timestamp);
  for (let i = 0; i < hs.length; i++) {
    const e: any = hs[i];
    // fullResponse 对统计/展示无必要，一律清除（响应统计已在 raw_usage）
    delete e.fullResponse;
    if (i >= DETAIL_KEEP) {
      delete e.messages;
      delete e.fullRequest;
    } else {
      // 保留条也裁剪 fullRequest 防止大 messages 落盘
      if (e.fullRequest && typeof e.fullRequest === 'object' && Array.isArray(e.fullRequest.messages)) {
        e.fullRequest = sanitizeFullRequest(e.fullRequest);
      }
    }
  }
}

function persist() {
  pruneDetails();
  // 剥离隐私大字段，防止对话全文落盘到 settings.json
  let safeLastUsage: any = state.lastUsage;
  if (safeLastUsage) {
    try {
      const c: any = { ...safeLastUsage };
      delete c.messages;
      delete c.fullRequest;
      delete c.fullResponse;
      // raw_usage 保留但去除可能的大对象
      safeLastUsage = c;
    } catch {}
  }
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
    lastUsage: safeLastUsage,
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
    const toDay = (ts: number) => { const d = new Date(ts); const pad=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
    return s.history.filter((h: any) => {
      const k = toDay(h.timestamp);
      return k >= range.start && k <= range.end;
    });
  },

  async getColdHistory() { return loadHistoryCold(); },

  async getAllHistory() { return getAllHistory(); },

  addEntry(usage: any, model: string, messages: any[], startTime: number, fullRequest?: any, fullResponse?: any, ttft = 0, thinkTime = 0, finishReason: string | null = null) {
    messages = messages || [];
    if (!model) try { model = (globalThis as any).SillyTavern?.getContext?.().model || 'deepseek-v4-flash'; } catch { model = 'deepseek-v4-flash'; }
    log.debug('addEntry 收到', { model, hasMessages: !!messages?.length });
    // 容错：拒绝数字/空对象导致的 0 token 污染条目
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
      log.debug('addEntry 跳过：usage 非对象 model=' + model);
      return null as any;
    }
    const hasAnyTokenField =
      typeof usage.prompt_tokens === 'number' ||
      typeof usage.completion_tokens === 'number' ||
      typeof usage.total_tokens === 'number' ||
      typeof usage.input_tokens === 'number' ||
      typeof usage.output_tokens === 'number' ||
      typeof usage.prompt_cache_hit_tokens === 'number' ||
      (usage.prompt_tokens_details && typeof usage.prompt_tokens_details.cached_tokens === 'number');
    if (!hasAnyTokenField) {
      log.debug('addEntry 跳过：无 token 字段 model=' + model);
      return null as any;
    }
    let hit = usage.prompt_cache_hit_tokens || 0;
    if (!hit && usage.prompt_tokens_details?.cached_tokens) hit = usage.prompt_tokens_details.cached_tokens;
    let miss = usage.prompt_cache_miss_tokens;
    if (miss === undefined || miss === null) { miss = (usage.prompt_tokens || usage.input_tokens || 0) - hit; if (miss < 0) miss = 0; }
    const comp = usage.completion_tokens || usage.output_tokens || 0;
    const total = usage.total_tokens || hit + miss + comp;
    // 若解析后仍全 0，视为无效数据，不写入历史
    if (hit === 0 && miss === 0 && comp === 0 && total === 0) {
      log.debug('addEntry 跳过：全 0 token model=' + model);
      return null as any;
    }
    log.debug('addEntry 解析', { model, hit, miss, comp, total });
    // 指纹去重：5秒内同 model+total 防双记账（fetch 与 GENERATION_ENDED 并发）
    try {
      const now = Date.now();
      const fp = `${model}|${total}|${hit}|${miss}|${comp}`;
      const lastFp = (state as any)._lastFp as string | undefined;
      const lastFpTime = (state as any)._lastFpTime as number | undefined;
      if (lastFp === fp && lastFpTime && now - lastFpTime < 5000) {
        log.debug('addEntry 去重跳过(5s指纹)', { fp });
        return null as any;
      }
      (state as any)._lastFp = fp;
      (state as any)._lastFpTime = now;
    } catch {}
    const lu: any = { timestamp: Date.now(), model, prompt_tokens: hit + miss, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp, total_tokens: total };
    const duration = startTime ? Date.now() - startTime : 0;
    const thinkTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
    lu.duration = duration;
    lu.tokenRate = duration - (ttft || 0) > 50 && comp > 0 ? Math.round((comp / (duration - (ttft || 0))) * 1000) : 0;
    lu.ttft = ttft || 0; lu.thinkTime = thinkTime || 0; lu.thinkTokens = thinkTokens;
    // 截断检测：finish_reason === 'length'
    const fr = finishReason ?? (usage as any)?.__finish_reason ?? (usage as any)?.finish_reason ?? null;
    lu.finishReason = fr; (lu as any).isTruncated = fr === 'length';
    lu.messages = (messages || []).map(clampMessage);
    const c: any = calcCost({ timestamp: lu.timestamp, model, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp }, state.settings as any);
    lu.cost = c.total; lu.input_cost = c.input; lu.output_cost = c.output; lu.priceType = c.priceType;
    lu.raw_usage = usage; lu.fullRequest = fullRequest; lu.fullResponse = null;
    // 记录所属对话，便于按对话过滤
    const chatId = getCurrentChatId();
    const chatName = getCurrentChatName();
    (lu as any).chatId = chatId; (lu as any).chatName = chatName;
    state.lastUsage = lu;

    const fr2 = finishReason ?? (usage as any)?.__finish_reason ?? null;
    const entry: any = {
      timestamp: lu.timestamp, model, prompt_tokens: hit + miss, cache_hit_tokens: hit, cache_miss_tokens: miss,
      completion_tokens: comp, total_tokens: total, input_cost: lu.input_cost, output_cost: lu.output_cost,
      cost: lu.cost, cache_hit_rate: (hit + miss) > 0 ? (hit / (hit + miss) * 100) : 0, priceType: lu.priceType,
      raw_usage: usage, messages: (messages || []).map(clampMessage), duration, ttft, thinkTime, thinkTokens, tokenRate: lu.tokenRate, fullRequest, fullResponse: null,
      finishReason: fr2, isTruncated: fr2 === 'length',
      chatId, chatName,
    };
    log.debug('addEntry 即将写入', { model: entry.model, total: entry.total_tokens });
    state.history.unshift(entry);
    state.total_tokens += total; state.total_cost += lu.cost; state.input_tokens += hit + miss; state.output_tokens += comp;
    state.cache_hit_tokens += hit; state.cache_miss_tokens += miss; state.input_cost += lu.input_cost; state.output_cost += lu.output_cost;
    if (isDeepSeekOfficialModel(model)) state.rounds += 1;
    // 余额本地预扣（与原脚本一致，仅作本地估算，查询后校准）
    try {
      if (state.customBalance != null && String(state.customBalance).trim() !== '') {
        const cur = parseFloat(String(state.customBalance));
        if (!isNaN(cur)) state.customBalance = (cur - lu.cost).toFixed(4);
      } else if (state.balance && (state.balance as any).balance != null && String((state.balance as any).balance).trim() !== '') {
        const cur = parseFloat(String((state.balance as any).balance));
        if (!isNaN(cur)) {
          (state.balance as any).balance = (cur - lu.cost).toFixed(4);
          (state.balance as any).timestamp = Date.now();
        }
      }
    } catch {}
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
      let h = next.history as any[];
      // 清洗原型污染键
      h = h.map((e: any) => {
        if (!e || typeof e !== 'object') return e;
        for (const k of Object.keys(e)) if (isUnsafeKey(k)) delete e[k];
        return e;
      });
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
    // 兼容旧 saves 导入：合并至单一历史（聚合仅在外部未提供时自算，避免重复累加）
    if (next.saves) {
      let all: any[] = [...(state.history || [])];
      for (const s of Object.values(next.saves as any)) {
        const h = (s as any).history || [];
        all = all.concat(h);
      }
      all.sort((a: any, b: any) => b.timestamp - a.timestamp);
      const keyOf = (h: any) => `${h.timestamp}|${h.model||''}|${h.total_tokens||0}`;
      const seen = new Set<string>();
      const dedup: any[] = [];
      for (const h of all) { const k = keyOf(h); if (!seen.has(k)) { seen.add(k); dedup.push(h); } }
      if (dedup.length > MAX_HISTORY) {
        const overflow = dedup.slice(MAX_HISTORY);
        appendHistoryCold(overflow).catch(() => {});
      }
      state.history = dedup.slice(0, MAX_HISTORY);
      if (next.total_tokens === undefined) {
        let tt = 0, tc = 0, it = 0, ot = 0, ch = 0, cm = 0, ic = 0, oc = 0;
        for (const h of state.history) {
          tt += h.total_tokens || 0; tc += h.cost || 0;
          it += (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0); ot += h.completion_tokens || 0;
          ch += h.cache_hit_tokens || 0; cm += h.cache_miss_tokens || 0;
          ic += h.input_cost || 0; oc += h.output_cost || 0;
        }
        state.total_tokens = tt as any; state.total_cost = tc as any; state.input_tokens = it as any;
        state.output_tokens = ot as any; state.cache_hit_tokens = ch as any; state.cache_miss_tokens = cm as any;
        state.input_cost = ic as any; state.output_cost = oc as any; state.rounds = state.history.length as any;
      }
    }
    if (next.settings !== undefined) {
      const def: any = defaultSettings();
      const incoming: any = next.settings || {};
      // 深合并 webdav/peakHours/customModels，避免缺字段导致白屏
      const merged: any = { ...def, ...incoming };
      merged.webdav = { ...def.webdav, ...(incoming.webdav || {}) };
      merged.pricingSync = { ...def.pricingSync, ...(incoming.pricingSync || {}) };
      if (!isFinite(parseFloat(String(merged.pricingSync.exchangeRate))) || parseFloat(String(merged.pricingSync.exchangeRate)) <= 0) merged.pricingSync.exchangeRate = 7.2;
      if (!Array.isArray(merged.peakHours) || !merged.peakHours.length) merged.peakHours = def.peakHours;
      if (!Array.isArray(merged.customModels)) merged.customModels = def.customModels;
      if (!merged.historyScope) merged.historyScope = def.historyScope;
      if (!merged.theme) merged.theme = def.theme;
      if (typeof merged.modelsPricingCollapsed !== 'boolean') merged.modelsPricingCollapsed = true;
      if (!Array.isArray(merged.overviewFour) || (merged.overviewFour.length !== 8 && merged.overviewFour.length !== 4)) merged.overviewFour = def.overviewFour;
      if (Array.isArray(merged.overviewFour) && merged.overviewFour.length === 4) {
        merged.overviewFour = [...merged.overviewFour, ...def.overviewFour.slice(4)];
      }
      // 清洗 overviewFour / statsFour 非法 key
      try {
        const valid = new Set(['avg_cost','avg_tokens','avg_duration','avg_rate','avg_input_cost','avg_input_tokens','avg_output_cost','avg_output_tokens','avg_think_time','avg_think_tokens','avg_hit_rate','latest_hit_rate','max_output','max_input','max_total','avg_think_ratio','truncation_rate']);
        if (Array.isArray(merged.overviewFour)) merged.overviewFour = merged.overviewFour.map((k:any)=> valid.has(k)?k:'avg_cost');
        if (merged.overviewFour.length !== 8) merged.overviewFour = def.overviewFour;
        if (!Array.isArray(merged.statsFour) || merged.statsFour.length !== 4) merged.statsFour = def.statsFour;
        const validStats = new Set(['avg_cost','avg_tokens','avg_duration','avg_rate','avg_input_cost','avg_input_tokens','avg_output_cost','avg_output_tokens','avg_think_time','avg_think_tokens','avg_think_ratio','truncation_rate','avg_hit_rate','latest_hit_rate','max_output','max_input','max_total']);
        if (Array.isArray(merged.statsFour)) merged.statsFour = merged.statsFour.map((k:any)=> validStats.has(k)?k:'avg_cost');
        if (merged.statsFour.length !== 4) merged.statsFour = def.statsFour;
      } catch {}
      // 旧历史补 finishReason/isTruncated（旧数据无该字段，默认 null/false，避免统计 NaN）
      try {
        let need = false;
        for (const h of state.history as any[]) {
          if ((h as any).finishReason === undefined) { (h as any).finishReason = (h as any).raw_usage?.__finish_reason ?? null; need = true; }
          if ((h as any).isTruncated === undefined) { (h as any).isTruncated = (h as any).finishReason === 'length'; }
        }
        if (need) saveHot({ history: state.history } as any);
      } catch {}
      state.settings = merged as any;
    }
    if (next.balance !== undefined) state.balance = next.balance;
    if (next.customBalance !== undefined) state.customBalance = next.customBalance as any;
    if (next.messageCount !== undefined) state.messageCount = next.messageCount as any;
    if (next.lastUsage !== undefined) state.lastUsage = next.lastUsage as any;
    persist();
    if (next.settings) emit(DataEvents.SETTINGS_CHANGED);
    if (next.balance !== undefined || next.customBalance !== undefined) emit(DataEvents.BALANCE_CHANGED);
  },

  pruneZeroEntries() {
    const before = (state.history || []).length;
    const filtered = (state.history || []).filter((h: any) => {
      const isZero = h.total_tokens === 0 && h.prompt_tokens === 0 && h.completion_tokens === 0 && h.cache_hit_tokens === 0 && h.cache_miss_tokens === 0;
      const isFakeTokenCount = !!(h.raw_usage && (h.raw_usage as any)._from_token_count);
      const isDebug = (h as any)._debug === true;
      return !(isZero || isFakeTokenCount || isDebug);
    });
    if (filtered.length !== before) {
      state.history = filtered as any;
      // 重算聚合，避免 totals 包含零条目影响
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
        rounds += 1;
      }
      state.total_tokens = total_tokens as any;
      state.total_cost = total_cost as any;
      state.input_tokens = input_tokens as any;
      state.output_tokens = output_tokens as any;
      state.cache_hit_tokens = cache_hit_tokens as any;
      state.cache_miss_tokens = cache_miss_tokens as any;
      state.input_cost = input_cost as any;
      state.output_cost = output_cost as any;
      state.rounds = rounds as any;
      persist();
      log.debug('已自动清理 ' + (before - filtered.length) + ' 条全 0 污染条目');
    }
    return filtered.length;
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
    // 迁移：旧设置无 historyScope 时补默认值 all
    if (!(state.settings as any).historyScope) {
      (state.settings as any).historyScope = 'all';
      try { saveHot({ settings: state.settings }); } catch {}
    }
    // 迁移：旧设置无 overviewFour 时补默认八块（兼容旧4块）
    if (!Array.isArray((state.settings as any).overviewFour) || ((state.settings as any).overviewFour.length !== 8 && (state.settings as any).overviewFour.length !== 4)) {
      (state.settings as any).overviewFour = ['avg_cost','avg_tokens','avg_duration','avg_rate','avg_input_tokens','avg_output_tokens','avg_hit_rate','max_total'];
      try { saveHot({ settings: state.settings }); } catch {}
    } else if ((state.settings as any).overviewFour.length === 4) {
      (state.settings as any).overviewFour = [...(state.settings as any).overviewFour, 'avg_input_tokens','avg_output_tokens','avg_hit_rate','max_total'];
      try { saveHot({ settings: state.settings }); } catch {}
    }
    if (typeof (state.settings as any).modelsPricingCollapsed !== 'boolean') {
      (state.settings as any).modelsPricingCollapsed = true;
      try { saveHot({ settings: state.settings }); } catch {}
    }
    if (!Array.isArray((state.settings as any).statsFour) || (state.settings as any).statsFour.length !== 4) {
      (state.settings as any).statsFour = ['avg_cost','avg_tokens','avg_think_ratio','truncation_rate'];
      try { saveHot({ settings: state.settings }); } catch {}
    } else {
      try {
        const validStats = new Set(['avg_cost','avg_tokens','avg_duration','avg_rate','avg_input_cost','avg_input_tokens','avg_output_cost','avg_output_tokens','avg_think_time','avg_think_tokens','avg_think_ratio','truncation_rate','avg_hit_rate','latest_hit_rate','max_output','max_input','max_total']);
        let cur: any[] = (state.settings as any).statsFour;
        if (cur.some((k:any)=> !validStats.has(k))) {
          (state.settings as any).statsFour = ['avg_cost','avg_tokens','avg_think_ratio','truncation_rate'];
          try { saveHot({ settings: state.settings }); } catch {}
        }
      } catch {}
    }
    // 迁移：pricingSync（默认关闭，汇率 7.2，自动同步仅手动）
    if (!(state.settings as any).pricingSync) {
      (state.settings as any).pricingSync = { enabled: false, mode: 'add-missing', exchangeRate: 7.2, useLiveRate: true, autoIntervalHours: 0, lastSync: null, lastRateFetch: null, recalcOnSync: false };
      try { saveHot({ settings: state.settings }); } catch {}
    } else {
      try {
        const def:any = { enabled:false, mode:'add-missing', exchangeRate:7.2, useLiveRate:true, autoIntervalHours:0, lastSync:null, lastRateFetch:null, recalcOnSync:false };
        const ps:any=(state.settings as any).pricingSync;
        for(const k of Object.keys(def)) if(ps[k]===undefined) ps[k]=def[k];
        const r=parseFloat(String(ps.exchangeRate));
        if(!isFinite(r)||r<=0) ps.exchangeRate=7.2;
        try{ saveHot({settings:state.settings}); }catch{}
      } catch {}
    }
    // 迁移：旧历史补 finishReason/isTruncated
    try {
      let need = false;
      for (const h of state.history as any[]) {
        if ((h as any).finishReason === undefined) { (h as any).finishReason = (h as any).raw_usage?.__finish_reason ?? null; need = true; }
        if ((h as any).isTruncated === undefined) { (h as any).isTruncated = (h as any).finishReason === 'length'; }
      }
      if (need) try { saveHot({ history: state.history } as any); } catch {}
    } catch {}
    // 迁移：旧历史无 chatId 时尝试回填（无法精确回溯则保留 null，按 all 展示）
    let needPersistChatId = false;
    for (const h of state.history || []) {
      if ((h as any).chatId === undefined) {
        (h as any).chatId = null;
        (h as any).chatName = null;
        needPersistChatId = true;
      }
    }
    if (needPersistChatId) try { saveHot({ history: state.history }); } catch {}
    // 自动清理历史中的全 0 污染条目（由之前 token_count 误判产生）
    try { this.pruneZeroEntries(); } catch {}
    // 对历史成本按归一化模型重算，修复 [masa]/[OR] 前缀导致的 0 费用
    try { this.recalcAll(); } catch {}
    emit(DataEvents.UPDATED);
    return this.snapshot();
  },
};
