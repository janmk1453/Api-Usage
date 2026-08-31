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
  try {
    // ST 的 chat 尾条常带 extra.api_usage
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const chat: any[] = ctx?.chat || [];
    const tail = chat[chat.length - 1];
    const extra = tail?.extra || {};
    // 优先从 extra 严格校验的 usage 中取，避免把 token_count 数字误判为 usage
    let usage = pickUsageFromExtra(extra);
    let model = extra.model || (tail as any)?.model || ctx?.model || 'deepseek-v4-flash';
    if (usage && isValidUsage(usage)) {
      processUsage(usage, model, lastMessages, lastStart);
      return;
    }
    // 兼容：部分渠道的 usage 藏在 message 的 swipe_info 或其他字段
    if (tail?.swipe_info && typeof tail.swipe_info === 'object') {
      for (const v of Object.values(tail.swipe_info as any)) {
        const cand = (v as any)?.extra?.api_usage || (v as any)?.extra?.usage;
        if (isValidUsage(cand)) {
          usage = cand;
          model = (v as any)?.extra?.model || model;
          processUsage(usage, model, lastMessages, lastStart);
          return;
        }
      }
    }
    // 兜底：若未带 usage，尝试从 args 解析（需同样校验）
    const maybeUsage = args[0]?.usage || args[0]?.api_usage;
    if (isValidUsage(maybeUsage)) {
      const m = args[0]?.model || model;
      processUsage(maybeUsage, m, lastMessages, lastStart);
      return;
    }
    // 最后：若仅有 token_count 数字，不产生 0 token 条目，仅记录调试日志
    if (extra.token_count != null && !usage) {
      try { console.warn('[API用量统计] 跳过无效 usage：仅有 token_count=' + extra.token_count + ' model=' + model + ' 未生成条目避免污染'); } catch {}
    }
  } catch {}
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
