import { state } from '../store/index';
import { calcCost, calcSavings, isDeepSeekOfficialModel } from './pricing';

// 去 fetch 猴补，主路径 GENERATION_ENDED + MESSAGE_RECEIVED，辅以 generate_interceptor 记 messages
let lastMessages: any[] = [];
let lastStart = 0;

export function setLastRequest(messages: any[], start: number) {
  lastMessages = messages || [];
  lastStart = start || Date.now();
}

export function installInterception() {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    if (!es || !et) return;
    es.on(et.GENERATION_ENDED, onGenerationEnded);
    es.on(et.MESSAGE_RECEIVED, () => setTimeout(refresh, 400));
    // generate_interceptor 记录请求 messages（若 ST 支持）
    (globalThis as any).ApiUsageStatInterceptor = (chat: any[], _ctxSize: number, _abort: any, _type: string) => {
      try { setLastRequest(chat?.slice(-10) || [], Date.now()); } catch {}
    };
    // manifest 若需，可由用户手动加 generate_interceptor 指向 ApiUsageStatInterceptor
  } catch {}
}

function onGenerationEnded(...args: any[]) {
  try {
    // ST 的 chat 尾条常带 extra.api_usage
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const chat: any[] = ctx?.chat || [];
    const tail = chat[chat.length - 1];
    const extra = tail?.extra || {};
    const usage = extra.api_usage || extra.token_count || extra.usage;
    if (usage) {
      const model = extra.model || tail?.model || ctx?.model || 'deepseek-v4-flash';
      processUsage(usage, model, lastMessages, lastStart);
      return;
    }
    // 兜底：若未带 usage，尝试从 args 解析
    const maybeUsage = args[0]?.usage || args[0]?.token_count;
    if (maybeUsage) {
      const model = args[0]?.model || 'deepseek-v4-flash';
      processUsage(maybeUsage, model, lastMessages, lastStart);
    }
  } catch {}
}

function refresh() {
  // 触发面板刷新事件（由 ui 层监听）
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
}

export function processUsage(usage: any, model: string, messages: any[], startTime: number, fullRequest: any = null, fullResponse: any = null, ttft = 0, thinkTime = 0) {
  messages = messages || [];
  if (!model) {
    try { model = (globalThis as any).SillyTavern?.getContext?.().model || 'deepseek-v4-flash'; } catch { model = 'deepseek-v4-flash'; }
  }
  let hit = usage.prompt_cache_hit_tokens || 0;
  if (!hit && usage.prompt_tokens_details?.cached_tokens) hit = usage.prompt_tokens_details.cached_tokens;
  let miss = usage.prompt_cache_miss_tokens;
  if (miss === undefined || miss === null) {
    miss = (usage.prompt_tokens || usage.input_tokens || 0) - hit;
    if (miss < 0) miss = 0;
  }
  const comp = usage.completion_tokens || usage.output_tokens || 0;
  const total = usage.total_tokens || hit + miss + comp;
  const lu: any = {
    timestamp: Date.now(), model, prompt_tokens: hit + miss,
    prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss,
    completion_tokens: comp, total_tokens: total,
  };
  const duration = startTime ? Date.now() - startTime : 0;
  const thinkTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
  lu.duration = duration;
  lu.tokenRate = duration - (ttft || 0) > 50 && comp > 0 ? Math.round((comp / (duration - (ttft || 0))) * 1000) : 0;
  lu.ttft = ttft || 0;
  lu.thinkTime = thinkTime || 0;
  lu.thinkTokens = thinkTokens;
  lu.messages = messages;
  const c = calcCost({ timestamp: lu.timestamp, model, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp }, state.settings) as any;
  lu.cost = c.total; lu.input_cost = c.input; lu.output_cost = c.output; lu.priceType = c.priceType;
  lu.raw_usage = usage; lu.fullRequest = fullRequest; lu.fullResponse = fullResponse;
  state.lastUsage = lu;
  // 写入当前存档
  let s: any = null;
  if (state.currentSave === '__all__') {
    let lt = 0, real: any = null;
    for (const k of Object.keys(state.saves)) {
      const sv: any = state.saves[k];
      if (sv && sv.startTime > lt) { lt = sv.startTime; real = sv; }
    }
    s = real || state.saves[Object.keys(state.saves)[0]];
  } else s = state.saves[state.currentSave as string];
  if (!s) return;
  const priceType = lu.priceType;
  const entry: any = {
    timestamp: lu.timestamp, model, prompt_tokens: hit + miss, cache_hit_tokens: hit, cache_miss_tokens: miss,
    completion_tokens: comp, total_tokens: total, input_cost: lu.input_cost, output_cost: lu.output_cost,
    cost: lu.cost, cache_hit_rate: (hit + miss) > 0 ? (hit / (hit + miss) * 100) : 0, priceType,
    raw_usage: usage, messages, duration, ttft, thinkTime, thinkTokens, tokenRate: lu.tokenRate, fullRequest, fullResponse,
  };
  s.history.unshift(entry);
  s.total_tokens += total; s.total_cost += lu.cost; s.input_tokens += hit + miss; s.output_tokens += comp;
  s.cache_hit_tokens += hit; s.cache_miss_tokens += miss; s.input_cost += lu.input_cost; s.output_cost += lu.output_cost;
  if (isDeepSeekOfficialModel(model)) s.rounds += 1;
  // DETAIL_KEEP 裁剪
  if (s.history.length > 500) s.history = s.history.slice(0, 500);
  s._mtime = Date.now();
  refresh();
}

export function recalcAllCosts() {
  for (const k of Object.keys(state.saves)) {
    const s: any = state.saves[k];
    for (const h of s.history || []) {
      const c = calcCost({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings) as any;
      h.input_cost = c.input; h.output_cost = c.output; h.cost = c.total; h.priceType = c.priceType;
      h.cache_hit_rate = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) > 0 ? ((h.cache_hit_tokens || 0) / ((h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0)) * 100) : 0;
    }
  }
}
