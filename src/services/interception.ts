import { state } from '../store/index';
import { repository } from '../data/repository';
import { log } from '../utils/logger';

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
    if (!p || !p.fetch || (p.fetch as any).__aus_patched) {
      return;
    }
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
        try { lastMessages = msgs; lastStart = startTime; } catch {}
        return rawFetch.apply(p, args).then((res: Response) => {
          try {
            const clone = res.clone();
            const parseAndProcess = (text: string, ttftVal: number, thinkTimeVal: number) => {
            let data: any = null;
            try {
              const trimmed = text.trim();
              if (trimmed.startsWith('{')) {
                data = JSON.parse(trimmed);
              } else {
                text.split('\n').forEach((line: string) => {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const chunk = JSON.parse(line.substring(6));
                      if (chunk.usage) data = chunk;
                      if (!data && chunk.choices?.[0]?.usage) data = { usage: chunk.choices[0].usage, model: chunk.model };
                    } catch {}
                  }
                });
                if (!data || !data.usage) {
                  const m = text.match(/"usage"\s*:\s*(\{[^\}]+\})/);
                  if (m) { try { const u = JSON.parse(m[1]); if (u && typeof u === 'object') data = { usage: u, model: data?.model }; } catch {} }
                }
              }
            } catch (e) {
              log.debug('用量响应解析失败', (e as any)?.message || e);
              return;
            }
            if (data && data.usage) {
              const model = (data as any)?.model || reqBody?.model || fullReq?.model || lastFetchModel || 'deepseek-v4-flash';
              const usage = (data as any).usage;
              lastFetchUsage = { usage, model, msgs, startTime, fullReq, fullResponse: data, ttft: ttftVal, thinkTime: thinkTimeVal };
              lastFetchModel = typeof model === 'string' ? model : null;
              lastFetchTime = Date.now();
              log.debug('fetch 捕获 usage', { model, hasUsage: !!usage });
              try { processUsage(usage, model, msgs, startTime, fullReq, data, ttftVal, thinkTimeVal); } catch (e) { log.error('fetch 用量记录失败 ' + ((e as any)?.message || e)); }
            }
          };
          const ct = clone.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            clone.text().then(t => { parseAndProcess(t, 0, 0); }).catch(()=>{});
          } else {
            clone.text().then(t => { parseAndProcess(t, 0, 0); }).catch(()=>{});
          }
          } catch (e) {
            log.debug('fetch 克隆解析异常，不影响原请求', (e as any)?.message || e);
          }
          return res;
        }).catch((e: any) => { throw e; });
      }
      return rawFetch.apply(p, args);
    };
    patched.__aus_patched = true;
    p.fetch = patched;
    log.debug('fetch 捕获已安装 TARGET_API=' + TARGET_API);
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
    if (!es || !et) {
      return false;
    }
    if (interceptionInstalled) {
      return true;
    }
    try {
      const p: any = (window as any).parent || window;
      if (p?.fetch && !(p.fetch as any).__aus_patched) rawFetchRef = p.fetch.bind(p);
    } catch {}
    es.on(et.GENERATION_ENDED, onGenerationEnded);
    messageReceivedHandler = () => setTimeout(refresh, 400);
    es.on(et.MESSAGE_RECEIVED, messageReceivedHandler);
    (globalThis as any).ApiUsageStatInterceptor = (chat: any[], _ctxSize: number, _abort: any, _type: string) => {
      try { setLastRequest(chat?.slice(-10) || [], Date.now()); } catch {}
    };
    try { installFetchCapture(); } catch {}
    interceptionInstalled = true;
    return true;
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
    extra.data?.usage,
    extra.response?.usage,
  ];
  for (const c of candidates) {
    if (isValidUsage(c)) return c;
  }
  if (isValidUsage(extra)) return extra;
  return null;
}

function onGenerationEnded(...args: any[]) {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const chat: any[] = ctx?.chat || [];
    const tail = chat[chat.length - 1];
    const extra = tail?.extra || {};
    const tailModel = (tail as any)?.model || null;
    const extraModel = extra.model || tailModel || ctx?.model || 'deepseek-v4-flash';
    log.debug('onGenerationEnded 触发', { chatLen: chat.length, hasApiUsage: !!extra.api_usage });
    let usage = pickUsageFromExtra(extra);
    let model = extraModel;
    log.debug('pickUsageFromExtra 结果', { hasUsage: !!usage, isValid: usage ? isValidUsage(usage) : false });
    if (usage && isValidUsage(usage)) {
      log.debug('命中主路径 extra usage');
      processUsage(usage, model, lastMessages, lastStart);
      return;
    }
    if (tail?.swipe_info && typeof tail.swipe_info === 'object') {
      log.debug('尝试 swipe_info 路径');
      for (const v of Object.values(tail.swipe_info as any)) {
        const cand = (v as any)?.extra?.api_usage || (v as any)?.extra?.usage;
        if (isValidUsage(cand)) {
          usage = cand;
          model = (v as any)?.extra?.model || model;
          log.debug('swipe_info 命中', { model });
          processUsage(usage, model, lastMessages, lastStart);
          return;
        }
      }
      log.debug('swipe_info 未命中有效 usage');
    }
    const maybeUsage = args[0]?.usage || args[0]?.api_usage;
    log.debug('尝试 args 兜底', { hasMaybeUsage: !!maybeUsage, isValid: maybeUsage ? isValidUsage(maybeUsage) : false });
    if (isValidUsage(maybeUsage)) {
      const m = args[0]?.model || model;
      log.debug('args 命中', { model: m });
      processUsage(maybeUsage, m, lastMessages, lastStart);
      return;
    }
    {
      let fetchPack: any = lastFetchUsage as any;
      let fetchUsage = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
      if (fetchUsage && isValidUsage(fetchUsage) && Date.now() - lastFetchTime < 120000) {
        const fetchedModel = (fetchPack && fetchPack.model) || lastFetchModel || model;
        const fetchedMsgs = (fetchPack && fetchPack.msgs) || lastMessages;
        const fetchedStart = (fetchPack && fetchPack.startTime) || lastStart;
        const fetchedReq = (fetchPack && fetchPack.fullReq) || null;
        const fetchedRes = (fetchPack && fetchPack.fullResponse) || null;
        const fTtft = (fetchPack && fetchPack.ttft) || 0;
        const fThink = (fetchPack && fetchPack.thinkTime) || 0;
        log.debug('fetch 兜底命中', { model: fetchedModel });
        lastFetchUsage = null;
        processUsage(fetchUsage, fetchedModel, fetchedMsgs, fetchedStart, fetchedReq, fetchedRes, fTtft, fThink);
        return;
      } else if (lastFetchUsage) {
        const fu = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
        log.debug('fetch 有缓存但无效或超时', { has: !!lastFetchUsage, isValid: fu ? isValidUsage(fu) : false, age: Date.now() - lastFetchTime });
      }
    }
    if (extra.token_count != null && !usage) {
      log.debug('跳过无效 usage：仅有本地 token_count=' + extra.token_count + ' model=' + model);
      return;
    }
    log.debug('未找到任何有效 usage，丢弃本次记录');
  } catch (e) {
    log.error('onGenerationEnded 异常 ' + (e as any)?.message || e);
  }
}

function refresh() {
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
}

export function processUsage(usage: any, model: string, messages: any[], startTime: number, fullRequest: any = null, fullResponse: any = null, ttft = 0, thinkTime = 0) {
  repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime);
  refresh();
}

export function recalcAllCosts() {
  repository.recalcAll();
}
