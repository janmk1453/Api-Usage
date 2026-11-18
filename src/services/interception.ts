import { state } from '../store/index';
import { repository } from '../data/repository';
import { log } from '../utils/logger';
import { initConnectionIdentity, resolveRuntimeConnectionContext, type HistoryConnection } from './connection-identity';
import { mergeIncludeUsage } from './include-usage';
import { createThinkClock, scanThinkChunk, resolveThinkTime, reasoningTextOf, contentTextOf } from './think-timing';
import { createFrameNormalizer } from './frame-normalizer';
import { saveRequestStart, patchRequestLog, noteRecentTurns } from './request-log';
import { noteCaptureStage, isZeroUsage, usageNumbers } from './capture-digest';
import { decideTurnOutcome } from './turn-outcome';
import { ESTIMATE_VERSION, estimatePromptTokens, estimateTextTokens } from './token-estimate';
import type { EntryMeta } from '../types/save';

let lastMessages: any[] = [];
/** 本轮请求的完整 messages：只给输入侧估算用，绝不写进历史（历史仍存 lastMessages 的最近 10 条摘要） */
let lastPromptMessages: any[] = [];
let lastStart = 0;
let lastFetchUsage: any = null;
let lastFetchModel: string | null = null;
let lastFetchTime = 0;
let lastFetchConnection: HistoryConnection | null = null;
let lastFetchConnectionTime = 0;
let requestSequence = 0;
let lastRequestId: string | null = null;
let lastRequestIdTime = 0;

/** 流式测量到的时序快照（TTFT / 思维链耗时 / 真假流式），与 usage 解耦：
 *  上游不回 usage 时 finish() 也会落一份，避免主路径明明测到了却拿不到。 */
let lastStreamTiming: { ttft: number; thinkTime: number; streamed: boolean | null; startTime: number; at: number } | null = null;

/**
 * 本轮请求的现场（fetch 侧填写，生成结束事件消费）。
 * 用途：上游不回 usage / 中途停止时，靠它判断「有没有输出、是不是中断」，
 * 再决定按估算补记还是静默丢弃。只存数字与请求原文，不额外采集隐私。
 */
type TurnContext = {
  startTime: number;
  requestId: string | null;
  model: string | null;
  /** 是否未能从请求/响应里拿到模型名，只能兜底 */
  modelFallback: boolean;
  status: number;
  streamError: string | null;
  /** 实测输出字符（正文 + 思维链） */
  outputChars: number;
  reasoningChars: number;
  /** 已读到的响应原文（SSE / JSON），用于估算输出 token */
  fullResponse: string | null;
  fullRequest: any;
  /** 最近 10 条消息摘要：历史详情展示用 */
  messages: any[];
  /** 完整上下文：输入侧估算用，保证估算口径与上游实际 prompt 一致 */
  promptMessages: any[];
  connection: HistoryConnection | null;
  ttft: number;
  thinkTime: number;
  streamed: boolean | null;
  /** 本轮是否已经落库（正常路径或估算路径都算） */
  settled: boolean;
};

let lastTurn: TurnContext | null = null;
/** 用户点击「停止」的时刻；只在窗口期内有效，过期自动忽略 */
let pendingStopAt = 0;
let pendingStopTimer: any = null;
/** 停止信号与生成结束事件之间的等待窗口 */
const STOP_WINDOW_MS = 3000;
/** 收到停止信号后等这么久再兜底结算（等 GENERATION_ENDED 先到） */
const STOP_SETTLE_DELAY_MS = 1500;

function currentTurn(startTime?: number): TurnContext | null {
  const turn = lastTurn;
  if (!turn) return null;
  if (typeof startTime === 'number' && startTime > 0 && turn.startTime !== startTime) return null;
  return turn;
}

function stopPending(): boolean {
  return pendingStopAt > 0 && Date.now() - pendingStopAt < STOP_WINDOW_MS;
}

/**
 * 正常路径（上游给了 usage）的中断标记：
 * 用户点了停止 → user；流读出过错 → upstream；都没有则不写 interrupted。
 * 估算路径的 meta 由 settleTurnWithoutUsage 自己构造。
 */
function turnMetaFor(startTime: number): EntryMeta | null {
  const turn = currentTurn(startTime);
  const interrupted = stopPending() ? 'user' : turn?.streamError ? 'upstream' : null;
  const modelFallback = turn?.modelFallback === true;
  if (!interrupted && !modelFallback) return null;
  const meta: EntryMeta = { usageSource: 'upstream' };
  meta.interrupted = interrupted;
  if (interrupted) meta.interruptReason = interrupted === 'user' ? 'user-stop' : String(turn?.streamError || 'stream-error').slice(0, 200);
  if (modelFallback) meta.modelFallback = true;
  return meta;
}

/** 从响应原文里抽出助手输出文本（正文 + 思维链），只用于本地估算 token */
function collectOutputText(raw: string): string {
  const text = String(raw || '');
  if (!text.trim()) return '';
  let out = '';
  const push = (record: any) => {
    const think = reasoningTextOf(record);
    if (think) out += think;
    const body = contentTextOf(record);
    if (body) out += body;
  };
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try { push(JSON.parse(trimmed)); } catch {}
    return out.slice(0, 200_000);
  }
  for (const rawLine of trimmed.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try { push(JSON.parse(payload)); } catch {}
  }
  return out.slice(0, 200_000);
}

function recentStreamTiming(maxAge = 60000): typeof lastStreamTiming {
  try {
    const st = lastStreamTiming;
    if (!st) return null;
    // 同一次请求（startTime 一致）或刚测完 60s 内有效
    if (st.startTime === lastStart || Date.now() - st.at < maxAge) return st;
  } catch {}
  return null;
}

export function setLastRequest(messages: any[], start: number) {
  lastMessages = messages || [];
  lastStart = start || Date.now();
}

const TARGET_API = '/api/backends/chat-completions/generate';
const STREAM_TEXT_LIMIT = 1_000_000;

// 多数上游在流式响应里默认不返回 usage，必须显式声明 stream_options.include_usage。
// 酒馆自身不发送该参数，服务端也只对 custom 源透传 custom_include_body（YAML 合并进上游请求体），
// 因此这里借该通道补上 include_usage，换取可计费的真实用量；
// 合并逻辑见 include-usage.ts：预设可能把参数写成 JSON，直接字符串追加会让整段 YAML 失效。

/** 应急逃生阀：控制台执行 localStorage.setItem('ds_include_usage','0') 可整体关闭该注入 */
function includeUsageSwitchOn(): boolean {
  try {
    return localStorage.getItem('ds_include_usage') !== '0';
  } catch {
    return true;
  }
}

/** 尝试让上游在流式响应里返回 usage，返回是否改动了请求体 */
function injectIncludeUsage(reqBody: any, source: string | null): boolean {
  try {
    if (!reqBody || typeof reqBody !== 'object') return false;
    if (reqBody.stream !== true) return false;
    if (!includeUsageSwitchOn()) return false;
    if (source !== 'custom') return false;
    const merged = mergeIncludeUsage(reqBody.custom_include_body);
    // 无法安全合并时保持原值：宁可拿不到 usage，也不能破坏预设的请求体参数
    if (!merged.changed) return false;
    reqBody.custom_include_body = merged.value;
    return true;
  } catch {
    return false;
  }
}

function safeRequestSnapshot(body: any, connection: HistoryConnection | null): any {
  if (!body || typeof body !== 'object') return null;
  const keep: any = {};
  for (const key of ['model', 'stream', 'temperature', 'max_tokens', 'top_p', 'stream_options', 'chat_completion_source']) {
    if (body[key] !== undefined) keep[key] = body[key];
  }
  if (connection?.endpointLabel) keep.endpoint = connection.endpointLabel;
  if (Array.isArray(body.messages)) keep.messages_length = body.messages.length;
  return keep;
}

function recentConnection(maxAge = 120000): HistoryConnection | null {
  try {
    if (lastFetchConnection && Date.now() - lastFetchConnectionTime < maxAge && lastFetchConnectionTime >= lastFetchTime) {
      return lastFetchConnection;
    }
    if (lastFetchUsage?.connection && Date.now() - lastFetchTime < maxAge) return lastFetchUsage.connection as HistoryConnection;
  } catch {}
  return null;
}

function recentRequestId(maxAge = 5000): string | null {
  if (lastRequestId && Date.now() - lastRequestIdTime < maxAge) return lastRequestId;
  return null;
}

// 部分厂商（如 GLM）usage 不返回 reasoning_tokens，但 SSE 含 reasoning_content；
// 按思维链/正文的字符占比从 completion_tokens 中估算思维链 token
function estimateThinkTokens(text: string, usage: any) {
  if (!usage || typeof usage !== 'object') return;
  const detail = usage.completion_tokens_details;
  if (detail && typeof detail.reasoning_tokens === 'number' && detail.reasoning_tokens > 0) return;
  let thinkChars = 0, contentChars = 0;
  const collect = (record: any) => {
    const think = reasoningTextOf(record);
    if (think) thinkChars += think.length;
    const body = contentTextOf(record);
    if (body) contentChars += body.length;
  };
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('{')) {
    // 非流式：整段 JSON，思维链在 choices[].message 里
    try { collect(JSON.parse(trimmed)); } catch {}
  } else {
    for (const raw of trimmed.split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try { collect(JSON.parse(payload)); } catch { continue; }
    }
  }
  if (thinkChars > 0) {
    const comp = usage.completion_tokens || usage.output_tokens || 0;
    const total = thinkChars + contentChars;
    usage.__think_tokens_est = total > 0 ? Math.round(comp * (thinkChars / total)) : 0;
  }
}

function installFetchCapture() {
  try {
    const p: any = (window as any).parent || window;
    if (!p || !p.fetch || isAusFetchPatch(p.fetch)) {
      return;
    }
    const rawFetch = p.fetch.bind(p);
    const patched: any = function(this: any) {
      const args: any = arguments;
      const url: string = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (typeof url === 'string' && url.indexOf(TARGET_API) !== -1) {
        let reqBody: any = null;
        try { reqBody = JSON.parse(args[1]?.body || 'null'); } catch {}
        const requestConnection = resolveRuntimeConnectionContext(reqBody || {});
        const fullReq = safeRequestSnapshot(reqBody, requestConnection);
        const requestId = `req:${Date.now()}:${++requestSequence}`;
        try {
          lastFetchConnection = requestConnection;
          lastFetchConnectionTime = Date.now();
          lastRequestId = requestId;
          lastRequestIdTime = Date.now();
        } catch {}
        let msgs: any[] = [];
        // 展示用只留最近 10 条；估算必须用完整上下文，否则会按裁剪后的上下文少算输入
        let promptMessages: any[] = [];
        try {
          if (reqBody?.messages?.length) {
            msgs = reqBody.messages.slice(-10);
            promptMessages = reqBody.messages;
          }
        } catch {}
        const startTime = Date.now();
        // 反馈排查用：留一份「最近三轮在聊什么」（角色 + 前 400 字 + 字数），不进历史、不导出
        try { if (reqBody?.messages?.length) noteRecentTurns(reqBody.messages, startTime); } catch {}
        try { lastMessages = msgs; lastPromptMessages = promptMessages; lastStart = startTime; } catch {}
        // 本轮现场：模型名先按请求体判断是否只能兜底，响应带回真实模型名后再清掉标记
        try {
          const requestModel = (reqBody as any)?.model;
          lastTurn = {
            startTime,
            requestId,
            model: typeof requestModel === 'string' && requestModel ? requestModel : null,
            modelFallback: !(typeof requestModel === 'string' && requestModel),
            status: 0,
            streamError: null,
            outputChars: 0,
            reasoningChars: 0,
            fullResponse: null,
            fullRequest: fullReq,
            messages: msgs,
            promptMessages,
            connection: requestConnection,
            ttft: 0,
            thinkTime: 0,
            streamed: null,
            settled: false,
          };
        } catch {}
        // 通过 custom_include_body 让上游返回流式 usage；上游若不认这个参数则原样重试
        const injected = injectIncludeUsage(reqBody, (reqBody as any)?.chat_completion_source ?? null);
        const performFetch = (init: any) => rawFetch.apply(p, init);
        const fetchArgs = injected
          ? [args[0], { ...(args[1] as any), body: JSON.stringify(reqBody) }]
          : args;
        // 请求日志：不管这轮最终有没有算出用量、有没有入库，先把实际发出的标头与正文留下（只保留最近一轮）
        try {
          const sentInit: any = (fetchArgs as any)[1] || {};
          const sentBody = typeof sentInit.body === 'string' ? sentInit.body : '';
          saveRequestStart({ at: startTime, method: sentInit.method || 'POST', url, headers: sentInit.headers, body: sentBody });
        } catch {}
        // 采集链路快照：只记录「请求已发出」，与后续是否入库无关
        try {
          noteCaptureStage('fetch-start', {
            model: (reqBody as any)?.model,
            requestId,
            url,
            streamed: (reqBody as any)?.stream === true,
          });
        } catch {}
        return performFetch(fetchArgs).then((firstRes: Response) => {
          if (injected && !firstRes.ok && (firstRes.status === 400 || firstRes.status === 422)) {
            log.debug('上游不接受 include_usage，按原请求重试');
            try { return performFetch(args); } catch { return firstRes; }
          }
          return firstRes;
        }).then((res: Response) => {
          // 响应一到达就记下状态与标头（首字节耗时按请求发出时刻算）
          try { patchRequestLog({ status: res.status, statusText: res.statusText, headers: res.headers, firstByteMs: Date.now() - startTime }); } catch {}
          try { const t = currentTurn(startTime); if (t) t.status = res.status; } catch {}
          try {
            const clone = res.clone();
            // 请求体未声明流式 → 明确非流式，全程不测速
            const requestedStream = reqBody?.stream === true;
            // 帧归一化：把任意 provider 的形状投影成 OpenAI/DeepSeek 形状，下游解析不再认识各家字段。
            // 每个请求一份状态（协议首帧锁定），只在这条 clone 旁路上起作用，原始响应照常透传。
            const frameNormalizer = createFrameNormalizer();
            const parseAndProcess = (text: string, ttftVal: number, thinkTimeVal: number, streamed: boolean | null = null, rawText: string | null = null) => {
            let data: any = null;
            let finishReason: string | null = null;
            try {
              const trimmed = text.trim();
              if (trimmed.startsWith('{')) {
                data = JSON.parse(trimmed);
                try { finishReason = (data as any)?.choices?.[0]?.finish_reason ?? null; } catch {}
              } else {
                text.split('\n').forEach((line: string) => {
                  if (line.startsWith('data:')) {
                    const payload = line.slice(5).trim();
                    if (!payload || payload === '[DONE]') return;
                    try {
                      const chunk = JSON.parse(payload);
                      if (chunk.usage) data = chunk;
                      if (!data && chunk.choices?.[0]?.usage) data = { usage: chunk.choices[0].usage, model: chunk.model };
                      const fr = chunk?.choices?.[0]?.finish_reason;
                      if (fr != null) finishReason = fr;
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
            // 无论有没有 usage，都把这次解析到的模型 / 结束原因 / 用量记进日志。
            // 请求日志页展示的必须是上游原始数据：这三项优先取归一化前留存的原值，
            // 只有拿不到原值时才退回投影后的形状，保证页面看到的是「未经转换的响应」。
            try {
              patchRequestLog({
                model: frameNormalizer.rawModel() || (data as any)?.model || reqBody?.model || null,
                finishReason: frameNormalizer.rawFinishReason() ?? finishReason ?? null,
                usage: frameNormalizer.rawUsage() || (data as any)?.usage || null,
              });
            } catch {}
            // 响应带回真实模型名 → 不再算「模型缺失兜底」
            try {
              const t = currentTurn(startTime);
              const resModel = (data as any)?.model;
              if (t && typeof resModel === 'string' && resModel) { t.model = resModel; t.modelFallback = false; }
            } catch {}
            // 采集链路快照：响应解析完成，是否解析到用量、用量是否全 0
            try {
              const parsedUsage = (data as any)?.usage || null;
              noteCaptureStage('fetch-parse', {
                model: (data as any)?.model || (reqBody as any)?.model,
                requestId,
                streamed,
                usageFound: !!parsedUsage,
                usageZero: isZeroUsage(parsedUsage),
                usage: usageNumbers(parsedUsage),
                finishReason: finishReason ?? null,
              });
            } catch {}
            if (data && data.usage) {
              const model = (data as any)?.model || reqBody?.model || fullReq?.model || lastFetchModel || 'deepseek-v4-flash';
              const usage = (data as any).usage;
              // 将 finish_reason 挂到 usage 以便 repository 统一处理
              try { if (finishReason) (usage as any).__finish_reason = finishReason; } catch {}
              try { estimateThinkTokens(text, usage); } catch {}
              // 完整响应文本（非流式为完整 JSON，流式为 SSE 原文）供历史详情展示
              // fullResponse 只用于历史详情展示，必须是上游原文（未经帧归一化投影）
              lastFetchUsage = { usage, model, msgs, startTime, fullReq, fullResponse: rawText ?? text, ttft: ttftVal, thinkTime: thinkTimeVal, finishReason, streamed, connection: requestConnection, requestId };
              lastFetchModel = typeof model === 'string' ? model : null;
              lastFetchTime = Date.now();
              log.debug('fetch 捕获 usage', { model, hasUsage: !!usage, finishReason, streamed });
              try { processUsage(usage, model, msgs, startTime, fullReq, text, ttftVal, thinkTimeVal, finishReason, requestConnection, requestId, streamed); } catch (e) { log.error('fetch 用量记录失败 ' + ((e as any)?.message || e)); }
            }
          };
          // 流式测量 TTFT 与思维链耗时：后台消费 clone 的 body 流，不阻塞原始响应透传
          try {
            const t0 = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
            const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
            let ttft = 0;
            let fullText = '';
            // 思维链时钟：按 JSON 增量识别「首个非空思维链帧」与「首个非空正文帧」
            // （口径见 services/think-timing.ts，禁止再用整行 substring 判断）
            const thinkClock = createThinkClock();
            // 归一化后的 SSE 文本：与 fullText 一一对应，只用于解析 usage / 结束原因；
            // fullText 始终保持上游原文，历史详情与请求日志展示的都必须是它
            let normText = '';
            // 假流式检测：统计承载正文的增量帧数
            const judgeStreamed = (): boolean | null => {
              // 请求未声明流式：明确非流式
              if (!requestedStream) return false;
              // 未观测到正文帧（可能是纯 usage 帧或异常响应）：未知，交给数值兜底
              if (!thinkClock.contentFrames) return null;
              // 真正的流式会持续吐出多帧正文；只有一帧说明上游一次性返回全文
              return thinkClock.contentFrames > 1;
            };
            const finish = () => {
              try {
                const endedAt = nowMs() - t0;
                const thinkTime = resolveThinkTime(thinkClock, endedAt);
                // 时序自洽：思维链耗时以首字为锚，ttft 没测到（<=0）时一律不写，避免「首字 0ms、思维链 65s」的矛盾读数
                const safeThinkTime = ttft > 0 ? thinkTime || 0 : 0;
                const streamed = judgeStreamed();
                // 现场留档：输出字符数决定「能不能按估算补记」
                try {
                  const t = currentTurn(startTime);
                  if (t) {
                    t.ttft = ttft || 0;
                    t.thinkTime = safeThinkTime;
                    t.streamed = streamed;
                    t.outputChars = thinkClock.contentChars || 0;
                    t.reasoningChars = thinkClock.reasoningChars || 0;
                    t.fullResponse = fullText || null;
                  }
                } catch {}
                if (safeThinkTime > 0) log.debug('思维链耗时已测量 ' + safeThinkTime + 'ms');
                try { lastStreamTiming = { ttft, thinkTime: safeThinkTime, streamed, startTime, at: Date.now() }; } catch {}
                try { patchRequestLog({ durationMs: endedAt, streamed }); } catch {}
                // 优先解析归一化后的文本（能认 Gemini / Anthropic / Responses），
                // 投影为空时退回原文；原文作为第 5 参传入，只用于展示
                parseAndProcess(normText || fullText, ttft, safeThinkTime, streamed, fullText);
              } catch {}
            };
            const scanThink = (chunk: string) => {
              // 思维链与正文的识别也走归一化结果：投影后的 delta.content / delta.reasoning_content
              // 正是 think-timing 认的形状，因此不需要为任何新格式改 think-timing
              const projected = frameNormalizer.projectSse(chunk);
              if (projected) {
                normText += projected;
                if (normText.length > STREAM_TEXT_LIMIT) normText = normText.slice(-STREAM_TEXT_LIMIT);
              }
              scanThinkChunk(thinkClock, projected || chunk, nowMs() - t0);
            };
            const readStream = async (body: ReadableStream<Uint8Array>) => {
              const reader = body.getReader();
              const dec = new TextDecoder();
              let first = true, buf = '';
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                // 首字延迟：相对请求发出时刻（startTime），而非 clone 流开始读取时刻
                if (first && value && value.byteLength) { ttft = Date.now() - startTime; first = false; }
                const piece = dec.decode(value, { stream: true });
                fullText += piece; buf += piece;
                if (fullText.length > STREAM_TEXT_LIMIT) fullText = fullText.slice(-STREAM_TEXT_LIMIT);
                const nl = buf.lastIndexOf('\n');
                if (nl !== -1) {
                  const lines = buf.slice(0, nl); buf = buf.slice(nl + 1);
                  scanThink(lines);
                }
              }
              if (buf) scanThink(buf);
              finish();
            };
            const streamBody = (clone.body as ReadableStream<Uint8Array> | null);
            if (streamBody && typeof (streamBody as any).getReader === 'function') {
              readStream(streamBody).catch((streamErr: any) => {
                // 上游断流 / 网络中断 / 用户停止导致的 reader 失败：记下来供中断判定
                try {
                  const t = currentTurn(startTime);
                  if (t) t.streamError = String((streamErr && (streamErr.message || streamErr.name)) || 'stream-error');
                } catch {}
                try { finish(); } catch {}
              });
            } else {
              // 无流式 body：整段文本一次性读取，明确非流式
              clone.text().then((t) => { ttft = Date.now() - startTime; parseAndProcess(frameNormalizer.projectWhole(t), ttft, 0, false, t); }).catch(()=>{});
            }
          } catch (innerErr) {
            log.debug('fetch 流式读取异常，不影响原请求', (innerErr as any)?.message || innerErr);
            try { clone.text().then((t) => { parseAndProcess(frameNormalizer.projectWhole(t), 0, 0, requestedStream ? null : false, t); }).catch(()=>{}); } catch {}
          }
          } catch (e) {
            log.debug('fetch 克隆解析异常，不影响原请求', (e as any)?.message || e);
          }
          return res;
        }).catch((e: any) => {
          const message = String((e && (e.message || e)) || '请求失败');
          try { patchRequestLog({ error: message }); } catch {}
          // 请求根本发不出去 / 响应未到就断开：同样算上游中断线索
          try {
            const t = currentTurn(startTime);
            if (t) t.streamError = message;
          } catch {}
          throw e;
        });
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

/**
 * 宿主可能在我们之后重装自己的 fetch 包装（TauriTavern 在后端就绪后会再 patchFetch 一次，
 * 把当前 fetch 当成 delegate 存起来再换成自己的）。一旦被换到内层，
 * /api/backends/chat-completions/generate 会被宿主自己的路由直接吃掉，我们就再也看不到响应。
 * 因此这里定期校验「最外层是不是我们」，不是就重新包一层。
 */
const FETCH_GUARD_MS = 4000;
let fetchGuardTimer: any = null;
let fetchGuardBootTimers: any[] = [];

function isAusFetchPatch(fn: any): boolean {
  return typeof fn === 'function' && (fn as any).__aus_patched === true;
}

function ensureFetchCapture() {
  try {
    const p: any = (window as any).parent || window;
    if (!p || !p.fetch || isAusFetchPatch(p.fetch)) return;
    installFetchCapture();
  } catch {}
}

function startFetchGuard() {
  if (fetchGuardTimer) return;
  try {
    fetchGuardTimer = setInterval(ensureFetchCapture, FETCH_GUARD_MS);
    // 启动期两次补挂：宿主后端就绪通常在几百毫秒到几秒之间
    fetchGuardBootTimers = [
      setTimeout(ensureFetchCapture, 1200),
      setTimeout(ensureFetchCapture, 3000),
    ];
  } catch {}
}

function stopFetchGuard() {
  try { if (fetchGuardTimer) clearInterval(fetchGuardTimer); } catch {}
  fetchGuardTimer = null;
  try { for (const t of fetchGuardBootTimers) clearTimeout(t); } catch {}
  fetchGuardBootTimers = [];
}

/**
 * 用户点「停止」：只置一个时间戳，先不结算。
 * 留 STOP_SETTLE_DELAY_MS 给 GENERATION_ENDED 先走正常路径；
 * 若那时仍没落库（上游没回 usage），再按中断补记一次。
 */
function onGenerationStopped() {
  pendingStopAt = Date.now();
  try { log.debug('收到停止信号，等待结算'); } catch {}
  if (pendingStopTimer) { try { clearTimeout(pendingStopTimer); } catch {} }
  pendingStopTimer = setTimeout(() => {
    pendingStopTimer = null;
    try { void settleTurnWithoutUsage('stop'); } catch {}
  }, STOP_SETTLE_DELAY_MS);
}

export function installInterception() {
  try {
    try { initConnectionIdentity(); } catch {}
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
    // GENERATION_STOPPED 只在酒馆支持时挂，用于区分「用户主动中断」与「上游故障」
    if (et.GENERATION_STOPPED) {
      try { es.on(et.GENERATION_STOPPED, onGenerationStopped); } catch {}
    }
    messageReceivedHandler = () => setTimeout(refresh, 400);
    es.on(et.MESSAGE_RECEIVED, messageReceivedHandler);
    (globalThis as any).ApiUsageStatInterceptor = (chat: any[], _ctxSize: number, _abort: any, _type: string) => {
      try { setLastRequest(chat?.slice(-10) || [], Date.now()); } catch {}
    };
    try { installFetchCapture(); } catch {}
    startFetchGuard();
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
      try { es.off?.(et.GENERATION_STOPPED, onGenerationStopped); } catch {}
      try { es.off?.(et.MESSAGE_RECEIVED, messageReceivedHandler); } catch {}
      if (pendingStopTimer) { try { clearTimeout(pendingStopTimer); } catch {} pendingStopTimer = null; }
      pendingStopAt = 0;
      lastTurn = null;
    }
    try {
      const p: any = (window as any).parent || window;
      if (p && rawFetchRef && (p.fetch as any).__aus_patched) {
        p.fetch = rawFetchRef;
      }
    } catch {}
    stopFetchGuard();
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
    // 全 0 / 空用量不算正常记录：交给估算路径判断能否按输出补记
    if (usage && isValidUsage(usage) && isZeroUsage(usage)) {
      log.debug('主路径 usage 全 0，转交估算判定');
      usage = null;
    }
    if (usage && isValidUsage(usage)) {
      log.debug('命中主路径 extra usage');
      // 主路径也尝试携带最近 fetch 的 TTFT/思维链/截断信息（fetch 已在后台流式测量）
      let ttft = 0, think = 0, streamed: boolean | null = null, fr: string | null = (usage as any)?.__finish_reason ?? (usage as any)?.finish_reason ?? null;
      try {
        const fp: any = lastFetchUsage;
        if (fp && Date.now() - lastFetchTime < 5000) {
          if (!ttft) ttft = fp.ttft || 0;
          if (!think) think = fp.thinkTime || 0;
          if (!fr) fr = fp.finishReason ?? null;
          if (fp.streamed != null) streamed = fp.streamed;
          // 尝试从 tail SSE 最后一个 chunk 补 finish_reason（若 usage 未带）
          if (!fr) {
            try {
              const extraFr = (extra as any)?.finish_reason ?? (tail as any)?.finish_reason ?? null;
              if (extraFr) fr = extraFr;
            } catch {}
          }
        }
      } catch {}
      processUsage(usage, model, lastMessages, lastStart, null, null, ttft, think, fr, recentConnection(5000), recentRequestId(), streamed);
      lastFetchUsage = null;
      return;
    }
    if (tail?.swipe_info && typeof tail.swipe_info === 'object') {
      log.debug('尝试 swipe_info 路径');
      for (const v of Object.values(tail.swipe_info as any)) {
        const cand = (v as any)?.extra?.api_usage || (v as any)?.extra?.usage;
        if (isValidUsage(cand) && !isZeroUsage(cand)) {
          usage = cand;
          model = (v as any)?.extra?.model || model;
          log.debug('swipe_info 命中', { model });
          let ttft = 0, think = 0, streamed: boolean | null = null, fr: string | null = (cand as any)?.__finish_reason ?? null;
          try { const fp:any=lastFetchUsage; if (fp && Date.now()-lastFetchTime<5000){ ttft=fp.ttft||0; think=fp.thinkTime||0; if(!fr) fr=fp.finishReason??null; if (fp.streamed != null) streamed = fp.streamed; } } catch {}
          processUsage(usage, model, lastMessages, lastStart, null, null, ttft, think, fr, recentConnection(5000), recentRequestId(), streamed);
          lastFetchUsage = null;
          return;
        }
      }
      log.debug('swipe_info 未命中有效 usage');
    }
    const maybeUsage = args[0]?.usage || args[0]?.api_usage;
    log.debug('尝试 args 兜底', { hasMaybeUsage: !!maybeUsage, isValid: maybeUsage ? isValidUsage(maybeUsage) : false });
    if (isValidUsage(maybeUsage) && !isZeroUsage(maybeUsage)) {
      const m = args[0]?.model || model;
      log.debug('args 命中', { model: m });
      let ttft = 0, think = 0, streamed: boolean | null = null, fr: string | null = (maybeUsage as any)?.__finish_reason ?? null;
      try { const fp:any=lastFetchUsage; if (fp && Date.now()-lastFetchTime<5000){ ttft=fp.ttft||0; think=fp.thinkTime||0; if(!fr) fr=fp.finishReason??null; if (fp.streamed != null) streamed = fp.streamed; } } catch {}
      processUsage(maybeUsage, m, lastMessages, lastStart, null, null, ttft, think, fr, recentConnection(5000), recentRequestId(), streamed);
      lastFetchUsage = null;
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
        const fFr = (fetchPack && fetchPack.finishReason) || (fetchUsage as any)?.__finish_reason || null;
        const fStreamed: boolean | null = fetchPack && fetchPack.streamed != null ? fetchPack.streamed : null;
        log.debug('fetch 兜底命中', { model: fetchedModel });
        lastFetchUsage = null;
        processUsage(fetchUsage, fetchedModel, fetchedMsgs, fetchedStart, fetchedReq, fetchedRes, fTtft, fThink, fFr, fetchPack?.connection || recentConnection(), fetchPack?.requestId || recentRequestId(120000), fStreamed);
        return;
      } else if (lastFetchUsage) {
        const fu = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
        log.debug('fetch 有缓存但无效或超时', { has: !!lastFetchUsage, isValid: fu ? isValidUsage(fu) : false, age: Date.now() - lastFetchTime });
      }
    }
    // 走到这里说明上游确实没给可用的 usage：不再直接丢弃，
    // 交给「估算 / 中断 / 静默」判定（有输出就补记，没输出才真的不记）。
    log.debug('未找到任何有效 usage，进入估算/中断判定', { localTokenCount: extra.token_count ?? null });
    void settleTurnWithoutUsage('generation-ended', {
      model,
      localTokenCount: typeof extra.token_count === 'number' ? extra.token_count : null,
    });
  } catch (e) {
    log.error('onGenerationEnded 异常 ' + (e as any)?.message || e);
  }
}

function refresh() {
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
}

/**
 * 输入侧估算用哪一份 messages：完整上下文优先，最近 10 条的展示摘要只做兜底。
 * 展示摘要曾因共用到估算里，把输入 token 少算到真实值的一成（裁剪掉了大部分上下文）。
 */
export function pickPromptMessages(complete: unknown, truncated: unknown): any[] {
  if (Array.isArray(complete) && complete.length) return complete;
  if (Array.isArray(truncated) && truncated.length) return truncated;
  return [];
}

/** 时序自洽：没有测到首字（ttft<=0）时，思维链耗时没有锚点，一并归零 */
export function normalizeTiming(ttft: unknown, thinkTime: unknown): { ttft: number; thinkTime: number } {
  const first = Math.max(0, Number(ttft) || 0);
  return { ttft: first, thinkTime: first > 0 ? Math.max(0, Number(thinkTime) || 0) : 0 };
}

/**
 * 上游没给可用 usage（或 usage 全 0）时的收尾：判定这一轮该估算补记、标中断、还是静默丢弃。
 * 依据只有两条硬证据——「实测到了输出」和「有没有中断线索」。
 * 静默的判定（无输出）不写历史、不产生健康信号，避免把空轮次灌进统计。
 */
async function settleTurnWithoutUsage(source: 'generation-ended' | 'stop', opts: { model?: string; localTokenCount?: number | null } = {}): Promise<void> {
  const turn = currentTurn();
  if (turn?.settled) return;
  const model = opts.model || turn?.model || lastFetchModel || 'deepseek-v4-flash';
  // 两个口径必须分开：展示/落库用最近 10 条摘要，输入估算用完整上下文
  const storeMessages = turn?.messages || lastMessages || [];
  const estimateMessages = pickPromptMessages(turn?.promptMessages || lastPromptMessages, storeMessages);
  const startedAt = turn?.startTime || lastStart || Date.now();
  const requestId = turn?.requestId || recentRequestId(120000) || null;
  // 响应原文以本轮现场为准，取不到时回退到最近一次 fetch 快照
  const rawResponse = turn?.fullResponse || (lastFetchUsage as any)?.fullResponse || '';
  const outputText = collectOutputText(rawResponse);
  const hasOutput = !!outputText.trim() || !!turn && (turn.outputChars > 0 || turn.reasoningChars > 0);
  const outcome = decideTurnOutcome({
    hasUsage: false,
    usageUsable: false,
    hasOutput,
    pendingStop: stopPending(),
    streamError: turn?.streamError || null,
  });
  if (outcome.kind === 'drop') {
    log.debug('本轮无输出，静默不记录', { source, reason: outcome.reason });
    // 用户自己点了停止、而模型还没吐出任何内容：这不是采集故障，也不是上游异常，
    // 只是这一轮本来就没有可统计的东西。用独立原因标记，健康提示里跳过它，
    // 否则「连点两次停止」会被报成「连续两轮没取到用量、这些对话未写入历史」。
    const reason = stopPending() ? 'user-stop-no-output' : outcome.reason;
    try {
      noteCaptureStage('event-drop', { model, requestId: requestId || '', reason });
    } catch {}
    return;
  }
  // 输入/输出分别估算：输入按 messages 原文，输出按实测正文+思维链
  let promptEst: { tokens: number; chars: number; method: string } = { tokens: 0, chars: 0, method: 'char-heuristic' };
  let outputEst: { tokens: number; chars: number; method: string } = { tokens: 0, chars: 0, method: 'char-heuristic' };
  try {
    promptEst = await estimatePromptTokens(estimateMessages);
    outputEst = await estimateTextTokens(outputText, { preferTokens: opts.localTokenCount ?? null });
  } catch {}
  const promptTokens = Math.max(0, Math.round(promptEst.tokens || 0));
  const completionTokens = Math.max(0, Math.round(outputEst.tokens || 0));
  if (!promptTokens && !completionTokens) {
    try {
      noteCaptureStage('event-drop', { model, requestId: requestId || '', reason: 'estimate-empty' });
    } catch {}
    return;
  }
  const usage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: promptTokens,
    __aus_estimated: true,
    __finish_reason: outcome.interrupted ? 'interrupted' : 'estimated',
  };
  const meta: EntryMeta = {
    usageSource: 'estimated',
    interrupted: outcome.interrupted ?? null,
    interruptReason: outcome.reason,
    estimateMethod: promptEst.method === outputEst.method ? promptEst.method : promptEst.method + '+' + outputEst.method,
    estimateVersion: ESTIMATE_VERSION,
    promptChars: promptEst.chars || 0,
    outputChars: outputEst.chars || 0,
    estimateCacheUnknown: true,
    costEstimated: true,
  };
  if (turn?.modelFallback) meta.modelFallback = true;
  const timing = normalizeTiming(turn?.ttft, turn?.thinkTime);
  try {
    repository.addEntry(
      usage, model, storeMessages, startedAt,
      turn?.fullRequest ?? null, rawResponse || null,
      timing.ttft, timing.thinkTime, null,
      turn?.connection || recentConnection(), requestId, turn?.streamed ?? null, meta,
    );
  } catch (e) {
    try {
      noteCaptureStage('entry-error', { model, requestId: requestId || '', reason: String((e as any)?.message || e) });
    } catch {}
    return;
  }
  if (turn) turn.settled = true;
  log.debug('本轮已按估算补记', { source, interrupted: outcome.interrupted || null, promptTokens, completionTokens, method: meta.estimateMethod });
  try {
    noteCaptureStage(outcome.kind === 'interrupted' ? 'turn-interrupted' : 'turn-estimated', {
      model,
      requestId: requestId || '',
      streamed: turn?.streamed ?? null,
      usageFound: false,
      usageZero: true,
      usage: usageNumbers(usage),
      finishReason: null,
      reason: outcome.reason + ':' + String(meta.estimateMethod || ''),
    });
  } catch {}
  refresh();
}

export function processUsage(usage: any, model: string, messages: any[], startTime: number, fullRequest: any = null, fullResponse: any = null, ttft = 0, thinkTime = 0, finishReason: string | null = null, connection: HistoryConnection | null = null, requestId: string | null = null, streamed: boolean | null = null, meta: EntryMeta | null = null) {
  // 主路径 usage 多来自 ST，可能缺 reasoning_tokens；从最近 fetch 的估算值补上
  try {
    const fp: any = lastFetchUsage;
    if (fp?.usage && Date.now() - lastFetchTime < 5000) {
      const est = (fp.usage as any).__think_tokens_est;
      const hasReal = usage?.completion_tokens_details && typeof usage.completion_tokens_details.reasoning_tokens === 'number' && usage.completion_tokens_details.reasoning_tokens > 0;
      if (est && !hasReal && !(usage as any)?.__think_tokens_est) (usage as any).__think_tokens_est = est;
    }
  } catch {}
  // 时序兜底：主路径（GENERATION_ENDED）通常先到，此时 clone 流可能刚结束但还没解析到 usage。
  // 用流式快照补 TTFT / 思维链耗时 / 真假流式，避免上游不回 usage 时明明测到了却丢失。
  try {
    const st = recentStreamTiming();
    if (st && st.startTime === startTime) {
      if (!ttft) ttft = st.ttft || 0;
      if (!thinkTime) thinkTime = st.thinkTime || 0;
      if (streamed == null) streamed = st.streamed;
    }
    // 补完还拿不到首字：思维链耗时同样没有锚点，不写
    if (!(ttft > 0)) thinkTime = 0;
  } catch {}
  // 中断标记：用户点停止或流读出过错时，这一轮照样入库但要标明来源（不进速率/预测口径）
  let resolvedMeta: EntryMeta | null = meta;
  if (!resolvedMeta) {
    try { resolvedMeta = turnMetaFor(startTime); } catch {}
  }
  try {
    const zeroUsage = isZeroUsage(usage);
    const added = repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime, finishReason, connection, requestId, streamed, resolvedMeta);
    try {
      const t = currentTurn(startTime);
      // 全 0 用量不算已入库：留给生成结束事件走估算补记
      if (t && (added || !zeroUsage)) t.settled = true;
    } catch {}
  } catch (e) {
    try {
      noteCaptureStage('entry-error', {
        model,
        requestId: requestId || '',
        reason: String((e as any)?.message || e),
      });
    } catch {}
    throw e;
  }
  try {
    noteCaptureStage('entry-added', {
      model,
      requestId: requestId || '',
      streamed,
      usageFound: !!usage,
      usageZero: isZeroUsage(usage),
      usage: usageNumbers(usage),
      finishReason: finishReason ?? null,
      reason: 'addEntry',
    });
  } catch {}
  refresh();
}

export function recalcAllCosts(): Promise<boolean> {
  return repository.recalcAll();
}
