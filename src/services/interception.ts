import { state } from '../store/index';
import { repository } from '../data/repository';

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

function isValidUsage(u: any): boolean {
  if (!u || typeof u !== 'object' || Array.isArray(u)) return false;
  // 至少包含一个 token 字段才视为有效 usage
  return (
    typeof u.prompt_tokens === 'number' ||
    typeof u.completion_tokens === 'number' ||
    typeof u.total_tokens === 'number' ||
    typeof u.input_tokens === 'number' ||
    typeof u.output_tokens === 'number' ||
    typeof u.prompt_cache_hit_tokens === 'number' ||
    typeof u.cached_tokens === 'number' ||
    (u.prompt_tokens_details && typeof u.prompt_tokens_details.cached_tokens === 'number')
  );
}

function pickUsageFromExtra(extra: any): any {
  if (!extra || typeof extra !== 'object') return null;
  const candidates = [
    extra.api_usage,
    extra.usage,
    extra.openai_usage,
    extra.token_usage,
    // 兼容部分渠道把 usage 塞在 extra.data.usage
    extra.data?.usage,
    extra.response?.usage,
  ];
  for (const c of candidates) {
    if (isValidUsage(c)) return c;
  }
  // 额外兼容：extra 本身就是 usage（某些渠道直接把 prompt_tokens 放在 extra）
  if (isValidUsage(extra)) return extra;
  return null;
}

function onGenerationEnded(...args: any[]) {
  const TRACE = '[API用量统计][TRACE]';
  try {
    // ST 的 chat 尾条常带 extra.api_usage
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const chat: any[] = ctx?.chat || [];
    const tail = chat[chat.length - 1];
    const extra = tail?.extra || {};
    const tailModel = (tail as any)?.model || null;
    const extraModel = extra.model || tailModel || ctx?.model || 'deepseek-v4-flash';
    // 临时详细日志：打印 tail 的关键字段，帮助定位为何无记录
    try {
      console.log(TRACE + ' onGenerationEnded 触发', {
        chatLen: chat.length,
        tailIdx: chat.length - 1,
        tailExtraKeys: extra ? Object.keys(extra).slice(0, 20) : [],
        tailExtraStr: JSON.stringify(extra).slice(0, 2000),
        args0: args[0] ? JSON.stringify(args[0]).slice(0, 2000) : 'no args0',
        model: extraModel,
        hasApiUsage: !!extra.api_usage,
        hasUsage: !!extra.usage,
        hasTokenCount: extra.token_count,
      });
    } catch {}
    // 优先从 extra 严格校验的 usage 中取，避免把 token_count 数字误判为 usage
    let usage = pickUsageFromExtra(extra);
    let model = extraModel;
    try { console.log(TRACE + ' pickUsageFromExtra 结果', { hasUsage: !!usage, usageStr: usage ? JSON.stringify(usage).slice(0, 1500) : 'null', isValid: usage ? isValidUsage(usage) : false }); } catch {}
    if (usage && isValidUsage(usage)) {
      console.log(TRACE + ' 命中主路径 extra usage，准备 processUsage');
      processUsage(usage, model, lastMessages, lastStart);
      return;
    }
    // 兼容：部分渠道的 usage 藏在 message 的 swipe_info 或其他字段
    if (tail?.swipe_info && typeof tail.swipe_info === 'object') {
      console.log(TRACE + ' 尝试 swipe_info 兼容路径', { swipeKeys: Object.keys(tail.swipe_info as any).slice(0, 5) });
      for (const v of Object.values(tail.swipe_info as any)) {
        const cand = (v as any)?.extra?.api_usage || (v as any)?.extra?.usage;
        if (isValidUsage(cand)) {
          usage = cand;
          model = (v as any)?.extra?.model || model;
          console.log(TRACE + ' swipe_info 命中', { model, cand: JSON.stringify(cand).slice(0, 1000) });
          processUsage(usage, model, lastMessages, lastStart);
          return;
        }
      }
      console.log(TRACE + ' swipe_info 未命中有效 usage');
    }
    // 兜底：若未带 usage，尝试从 args 解析（需同样校验）
    const maybeUsage = args[0]?.usage || args[0]?.api_usage;
    try { console.log(TRACE + ' 尝试 args 兜底', { hasMaybeUsage: !!maybeUsage, maybeUsageStr: maybeUsage ? JSON.stringify(maybeUsage).slice(0, 1500) : 'null', isValid: maybeUsage ? isValidUsage(maybeUsage) : false }); } catch {}
    if (isValidUsage(maybeUsage)) {
      const m = args[0]?.model || model;
      console.log(TRACE + ' args 命中', { model: m });
      processUsage(maybeUsage, m, lastMessages, lastStart);
      return;
    }
    // 最后：若仅有 token_count 数字，说明 ST 本地估算而非 API 真实用量，禁止兜底产生假数据（如 7t 污染）
    // 之前尝试 token_count 兜底导致 [OR]minimax-m3 产生大量 0 in/7 out 假记录，现回退为严格丢弃
    if (extra.token_count != null && !usage) {
      try { console.warn('[API用量统计] 跳过无效 usage：仅有本地 token_count=' + extra.token_count + ' model=' + model + ' 未生成条目（非 API 真实用量，需完整 usage）'); } catch {}
      console.log(TRACE + ' 无有效 usage，仅有 token_count，已跳过不记录', { token_count: extra.token_count, model });
      return;
    }
    console.log(TRACE + ' 未找到任何有效 usage，丢弃本次记录', { extraKeys: extra ? Object.keys(extra).slice(0, 20) : [], argsKeys: args[0] ? Object.keys(args[0]).slice(0, 20) : [] });
  } catch (e) {
    try { console.error(TRACE + ' onGenerationEnded 异常', e); } catch {}
  }
}

function refresh() {
  // 触发面板刷新事件（由 ui 层监听）
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
}

export function processUsage(usage: any, model: string, messages: any[], startTime: number, fullRequest: any = null, fullResponse: any = null, ttft = 0, thinkTime = 0) {
  repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime);
  refresh();
}

export function recalcAllCosts() {
  repository.recalcAll();
}
