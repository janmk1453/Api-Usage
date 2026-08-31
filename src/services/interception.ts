import { state } from '../store/index';
import { repository } from '../data/repository';

// 去 fetch 猴补，主路径 GENERATION_ENDED + MESSAGE_RECEIVED，辅以 generate_interceptor 记 messages
// 临时增加 fetch 兜底：直接捕获网络层 usage，确保 custom 渠道真实请求应记尽记
let lastMessages: any[] = [];
let lastStart = 0;
let lastFetchUsage: any = null;
let lastFetchModel: string | null = null;
let lastFetchTime = 0;

export function setLastRequest(messages: any[], start: number) {
  lastMessages = messages || [];
  lastStart = start || Date.now();
}

const TARGET_API = '/api/backends/chat-completions/generate';

function installFetchCapture() {
  try {
    const p: any = (window as any).parent || window;
    if (!p || !p.fetch || (p.fetch as any).__aus_patched) return;
    const rawFetch = p.fetch.bind(p);
    const patched: any = function(this: any) {
      const args: any = arguments;
      const url: string = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (typeof url === 'string' && url.indexOf(TARGET_API) !== -1) {
        let reqBody: any = null;
        try { reqBody = JSON.parse(args[1]?.body || 'null'); } catch {}
        const fullReq = reqBody ? JSON.parse(JSON.stringify(reqBody)) : null;
        let msgs: any[] = [];
        try { if (reqBody?.messages?.length) msgs = reqBody.messages.slice(-10); } catch {}
        const startTime = Date.now();
        // 记录 lastMessages 供 processUsage 使用
        try { lastMessages = msgs; lastStart = startTime; } catch {}
        // 直接走原生请求，不做 debug 模拟（扩展 debug 由设置单独控制）
        return rawFetch.apply(p, args).then((res: Response) => {
          // 关键：任何解析异常都不应影响原 res 返回，避免对话中断
          try {
            const clone = res.clone();
            const ttftRef: any = { value: 0 };
            const thinkRef: any = { value: 0 };
            const parseAndProcess = (text: string, ttftVal: number, thinkTimeVal: number) => {
            let data: any = null;
            try {
              const trimmed = text.trim();
              if (trimmed.startsWith('{')) {
                data = JSON.parse(trimmed);
              } else {
                // 流式 SSE：逐行解析 data: {...} 中的 usage
                text.split('\n').forEach((line: string) => {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const chunk = JSON.parse(line.substring(6));
                      if (chunk.usage) data = chunk;
                      // 兼容 usage 在 delta 中
                      if (!data && chunk.choices?.[0]?.usage) data = { usage: chunk.choices[0].usage, model: chunk.model };
                    } catch {}
                  }
                });
                // 兜底：正则提取 usage
                if (!data || !data.usage) {
                  const m = text.match(/"usage"\s*:\s*(\{[^\}]+\})/);
                  if (m) { try { const u = JSON.parse(m[1]); if (u && typeof u === 'object') data = { usage: u, model: data?.model }; } catch {} }
                }
              }
            } catch (e) {
              console.warn('[API用量统计][TRACE] 用量响应解析失败', (e as any)?.message || e);
              return;
            }
            if (data && data.usage) {
              const model = (data as any)?.model || reqBody?.model || fullReq?.model || lastFetchModel || 'deepseek-v4-flash';
              const usage = (data as any).usage;
              // 回退修复：fetch 恢复直接落账 + 缓存双保险，依赖 repository 指纹去重防双记账（避免 GENERATION_ENDED 未触发导致丢账）
              lastFetchUsage = { usage, model, msgs, startTime, fullReq, fullResponse: data, ttft: ttftVal, thinkTime: thinkTimeVal };
              lastFetchModel = typeof model === 'string' ? model : null;
              lastFetchTime = Date.now();
              try { console.log('[API用量统计][TRACE] fetch 捕获 usage', { url: String(url).slice(0, 80), usage: JSON.stringify(usage).slice(0, 1500), model }); } catch {}
              // 关键：恢复直接落账，但由 repository 5s指纹去重保证不翻倍
              try { processUsage(usage, model, msgs, startTime, fullReq, data, ttftVal, thinkTimeVal); } catch (e) { console.error('[API用量统计] fetch 用量记录失败', (e as any)?.message || e); }
            }
          };
          // 尝试根据 Content-Type 分发解析
          const ct = clone.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            clone.text().then(t => parseAndProcess(t, 0, 0)).catch(() => {});
          } else {
            // 流式：延迟解析，确保流已完整（原脚本在 res 克隆后异步解析）
            clone.text().then(t => parseAndProcess(t, 0, 0)).catch(() => {});
          }
          } catch (e) {
            console.warn('[API用量统计] fetch 克隆解析异常，不影响原请求', (e as any)?.message || e);
          }
          return res;
        }).catch((e: any) => { throw e; });
      }
      // 非目标 API，直接透传
      return rawFetch.apply(p, args);
    };
    patched.__aus_patched = true;
    p.fetch = patched;
    console.log('[API用量统计][TRACE] fetch 捕获已安装（原脚本 1:1 逻辑，TARGET_API=' + TARGET_API + '）');
  } catch {}
}

let interceptionInstalled = false;
let rawFetchRef: any = null;
let messageReceivedHandler: any = null;

export function installInterception() {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    if (!es || !et) return false;
    if (interceptionInstalled) return true;
    // 记录原始 fetch 引用以便 disable 时还原
    try {
      const p: any = (window as any).parent || window;
      if (p?.fetch && !(p.fetch as any).__aus_patched) rawFetchRef = p.fetch.bind(p);
    } catch {}
    es.on(et.GENERATION_ENDED, onGenerationEnded);
    messageReceivedHandler = () => setTimeout(refresh, 400);
    es.on(et.MESSAGE_RECEIVED, messageReceivedHandler);
    // generate_interceptor 记录请求 messages（若 ST 支持）
    (globalThis as any).ApiUsageStatInterceptor = (chat: any[], _ctxSize: number, _abort: any, _type: string) => {
      try { setLastRequest(chat?.slice(-10) || [], Date.now()); } catch {}
    };
    // 安装 fetch 兜底捕获
    try { installFetchCapture(); } catch {}
    interceptionInstalled = true;
    return true;
    // manifest 若需，可由用户手动加 generate_interceptor 指向 ApiUsageStatInterceptor
  } catch { return false; }
}

export function uninstallInterception() {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    if (es && et && messageReceivedHandler) {
      try { es.off?.(et.GENERATION_ENDED, onGenerationEnded); } catch {}
      try { es.off?.(et.MESSAGE_RECEIVED, messageReceivedHandler); } catch {}
    }
    // 还原 fetch
    try {
      const p: any = (window as any).parent || window;
      if (p && rawFetchRef && (p.fetch as any).__aus_patched) {
        p.fetch = rawFetchRef;
      }
    } catch {}
    interceptionInstalled = false;
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
    // 兜底：尝试 fetch 捕获的 usage（覆盖 ST 未写入 extra 的 custom 渠道）
    {
      let fetchPack: any = lastFetchUsage as any;
      // 兼容旧缓存结构（直接是 usage 对象）与新结构（包裹对象）
      let fetchUsage = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
      if (fetchUsage && isValidUsage(fetchUsage) && Date.now() - lastFetchTime < 120000) {
        const fetchedModel = (fetchPack && fetchPack.model) || lastFetchModel || model;
        const fetchedMsgs = (fetchPack && fetchPack.msgs) || lastMessages;
        const fetchedStart = (fetchPack && fetchPack.startTime) || lastStart;
        const fetchedReq = (fetchPack && fetchPack.fullReq) || null;
        const fetchedRes = (fetchPack && fetchPack.fullResponse) || null;
        const fTtft = (fetchPack && fetchPack.ttft) || 0;
        const fThink = (fetchPack && fetchPack.thinkTime) || 0;
        console.log(TRACE + ' fetch 兜底命中', { model: fetchedModel, usage: JSON.stringify(fetchUsage).slice(0, 1500) });
        lastFetchUsage = null; // 消费后清空，避免重复
        processUsage(fetchUsage, fetchedModel, fetchedMsgs, fetchedStart, fetchedReq, fetchedRes, fTtft, fThink);
        return;
      } else if (lastFetchUsage) {
        const fu = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
        console.log(TRACE + ' fetch 有缓存但无效或超时', { has: !!lastFetchUsage, isValid: fu ? isValidUsage(fu) : false, age: Date.now() - lastFetchTime });
      }
    }
    // 最后：若仅有 token_count 数字，说明 ST 本地估算而非 API 真实用量，禁止兜底产生假数据（如 7t 污染）
    // 之前尝试 token_count 兜底导致 [OR]minimax-m3 产生大量 0 in/7 out 假记录，现回退为严格丢弃
    if (extra.token_count != null && !usage) {
      try { console.warn('[API用量统计] 跳过无效 usage：仅有本地 token_count=' + extra.token_count + ' model=' + model + ' 未生成条目（非 API 真实用量，需完整 usage）。若确为真实请求，请检查网络 fetch 捕获是否命中，或查看 TRACE 中 fetch 日志'); } catch {}
      console.log(TRACE + ' 无有效 usage，仅有 token_count，已跳过不记录', { token_count: extra.token_count, model, hasFetch: !!lastFetchUsage });
      return;
    }
    console.log(TRACE + ' 未找到任何有效 usage，丢弃本次记录', { extraKeys: extra ? Object.keys(extra).slice(0, 20) : [], argsKeys: args[0] ? Object.keys(args[0]).slice(0, 20) : [], hasFetch: !!lastFetchUsage });
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
