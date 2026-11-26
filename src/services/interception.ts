import { state } from '../store/index';
import { repository } from '../data/repository';
import { log } from '../utils/logger';
import { initConnectionIdentity, resolveRuntimeConnectionContext, type HistoryConnection } from './connection-identity';
import { isInjectableApiFormat, mergeIncludeUsage } from './include-usage';
import { createThinkClock, scanThinkChunk, resolveThinkTime, reasoningTextOf, contentTextOf, judgeStreamedFromClock } from './think-timing';
import { createFrameNormalizer } from './frame-normalizer';
import { saveRequestStart, patchRequestLog, noteRecentTurns } from './request-log';
import { noteCaptureStage, isZeroUsage, usageNumbers } from './capture-digest';
import { fetchChainHas, fetchChainKind, describeFetchChain } from './fetch-chain';
import { decideTurnOutcome } from './turn-outcome';
import { API_ERROR_MAX_CHARS, detectApiErrorPayload, apiErrorPayloadTag } from './api-error-payload';
import { ESTIMATE_VERSION, estimatePromptTokens, estimateTextTokens } from './token-estimate';
import type { EntryMeta } from '../types/save';
import { detectRequestOrigin, type RequestOrigin } from './request-origin';
import { DETAIL_MAX_CHARS, putDetailRequest, putDetailResponse } from '../data/detail-store';

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
  /** 请求体字符数（消息 content 累计），诊断用：核对「抓到的 prompt 是不是这一轮的」 */
  promptChars: number;
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
  /** 响应读完的时刻；一个字节都没读到时保持 0。判定「刚结束的那一轮」用它 */
  endedAt: number;
  /**
   * 本轮「输出」其实是上游错误提示的识别结果（见 services/api-error-payload.ts）。
   *
   * 宿主把上游非 2xx 包装成 HTTP 200 + 正文时，响应里只有错误文案、没有任何模型内容；
   * 有值就说明这一轮既不该按输出估算，也不该计费。
   */
  errorPayload: string | null;
  /** 本轮是否已经落库（正常路径或估算路径都算） */
  settled: boolean;
  /** 落库来源：真实 usage / 本地估算 / 明确拒绝（上游错误载荷），决定结束事件还要不要覆盖 */
  settledBy: 'usage' | 'estimated' | 'rejected' | null;
  /**
   * 本轮自己在响应当里解析到的用量与结束原因。
   *
   * 之前这两个值只存在全局单槽 lastFetchUsage 里，而它是「最后发出那一轮」的快照：
   * 并发时刚结束的那一轮要取自己的用量，只能靠 requestId 猜。存进账本后，
   * 每一轮都握着属于自己的现场，GENERATION_ENDED 不再需要跨轮捞数据。
   */
  usage: any | null;
  finishReason: string | null;
  /**
   * 这一轮是谁打出去的（扩展 / iframe 脚本 / 酒馆主界面）。
   * 只在 fetch 包装的同步段抓一次栈——那时调用链还在，等响应回来再抓就只剩自己的帧。
   */
  requestOrigin: RequestOrigin | null;
};

/**
 * 本轮账本：按 requestId 保存每一轮请求的现场。
 *
 * 早期版本只有一个 lastTurn 单槽，GENERATION_ENDED 取到的是「最后发出的那一轮」。
 * 两轮并发（A 在途、B 后发）时，A 结束时会把 B 的 startedAt / promptMessages /
 * requestId / streamed 当成 A 的现场落库：历史里出现「duration 只有几秒、
 * requestId 却是别人的、输入 token 与那轮真实 prompt 差一截」的错账。
 * 因此这里改为按 requestId 记账，结束事件按模型名与「刚结束」时刻对号入座。
 */
const turnLedger = new Map<string, TurnContext>();
/** 账本容量与存活时间：只留最近的若干轮，长会话不会无限增长 */
const TURN_LEDGER_KEEP = 32;
const TURN_LEDGER_TTL_MS = 30 * 60 * 1000;
/** 生成结束事件与请求的配对窗口：一轮从发出到结束很少超过 10 分钟 */
const ENDED_MATCH_WINDOW_MS = 10 * 60 * 1000;
/** 用户点击「停止」的时刻；只在窗口期内有效，过期自动忽略 */
let pendingStopAt = 0;
let pendingStopTimer: any = null;
/** 停止信号与生成结束事件之间的等待窗口 */
const STOP_WINDOW_MS = 3000;
/** 收到停止信号后等这么久再兜底结算（等 GENERATION_ENDED 先到） */
const STOP_SETTLE_DELAY_MS = 1500;

function turnKeyOf(turn: TurnContext): string {
  return turn.requestId || 'start:' + turn.startTime;
}

/** 登记一轮请求现场；同一 requestId 覆盖旧记录（重试会拿到新 id，不会覆盖） */
function registerTurn(turn: TurnContext): TurnContext {
  try {
    turnLedger.set(turnKeyOf(turn), turn);
    pruneTurns();
  } catch {}
  return turn;
}

function pruneTurns(now = Date.now()): void {
  try {
    for (const [key, t] of turnLedger) {
      if (now - t.startTime > TURN_LEDGER_TTL_MS) turnLedger.delete(key);
    }
    let over = turnLedger.size - TURN_LEDGER_KEEP;
    if (over <= 0) return;
    // Map 按插入顺序迭代：先丢最旧的，但在途的一律不丢
    for (const [key, t] of turnLedger) {
      if (over <= 0) break;
      if (!t.settled) continue;
      turnLedger.delete(key);
      over -= 1;
    }
  } catch {}
}

/** 按 startTime 反查现场（fetch 闭包与主路径共用同一把尺子） */
function turnByStart(startTime: number): TurnContext | null {
  if (!(startTime > 0)) return null;
  for (const t of turnLedger.values()) {
    if (t.startTime === startTime) return t;
  }
  return null;
}

/**
 * 按 requestId 精确反查现场。并发时这是唯一可靠的键：
 * startTime 取的是 Date.now()，同一毫秒内连发两个请求就会撞在一起，
 * 而「这条记录是谁发的」必须跟着自己那一轮走，不能串到邻居身上。
 */
function turnByRequestId(requestId: string | null): TurnContext | null {
  if (!requestId) return null;
  return turnLedger.get(requestId) || null;
}

/**
 * 取某一轮请求的来源（扩展 / 脚本 / 酒馆）。
 *
 * 并发下同一毫秒可能连发多个请求（对话 + 向量化 + 摘要一起打出去），
 * startTime 会撞、lastFetchUsage 只有单槽，只有 requestId 是唯一键；
 * 查不到 requestId 时才退回 startTime，两样都没有就返回 null（不猜）。
 */
export function requestOriginOfRequest(requestId: string | null, startTime: number): RequestOrigin | null {
  const turn = turnByRequestId(requestId) || currentTurn(startTime);
  return turn?.requestOrigin || null;
}

function currentTurn(startTime?: number): TurnContext | null {
  if (typeof startTime === 'number' && startTime > 0) return turnByStart(startTime);
  let latest: TurnContext | null = null;
  for (const t of turnLedger.values()) {
    if (!latest || t.startTime > latest.startTime) latest = t;
  }
  return latest;
}

function normalizeModel(name: unknown): string {
  return String(name ?? '').trim().toLowerCase();
}

/** 模型名比对：互为子串也算同一模型（宿主有时给模型名加前缀 / 后缀） */
function modelMatches(a: unknown, b: unknown): boolean {
  const x = normalizeModel(a);
  const y = normalizeModel(b);
  if (!x || !y) return false;
  return x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1;
}

/** 「刚结束」的先后：读完响应的轮次优先，其次比 endedAt / startTime 谁更晚 */
function endedRank(t: TurnContext): number {
  return (t.endedAt > 0 ? 1e15 : 0) + (t.endedAt || t.startTime);
}

/**
 * 找出生成结束事件对应的那一轮。
 *
 * 并发时账本里会有多轮在途，绝不能按「最后发出」取：先用模型名对号
 * （chat tail 的模型就是这一轮刚用的模型），同模型多轮时取最近结束的一轮；
 * 只有一轮候选时直接认领（无歧义，也容忍上游改写模型名）。
 * includeSettled=false 时只看还没落库的轮次。
 */
export function pickEndedTurn(model: string | null, includeSettled = true): TurnContext | null {
  const now = Date.now();
  const wanted = normalizeModel(model);
  // 先按窗口 / 结算状态筛出候选：账本里别的请求还在途时，候选会有多条
  const candidates: TurnContext[] = [];
  /** 模型名明确匹配的候选（严格优先） */
  const matched: TurnContext[] = [];
  /** 模型名缺失的候选（请求体没带 model，或上游没回模型名）：可以认领 */
  const unknownModel: TurnContext[] = [];
  /** 账本里是否存在同模型的轮次（含已结算）：存在就说明结束事件属于它，不能认别人的 */
  let sameModelAnywhere = false;
  for (const t of turnLedger.values()) {
    const inWindow = now - t.startTime <= ENDED_MATCH_WINDOW_MS;
    const tModel = normalizeModel(t.model);
    if (inWindow && wanted && tModel && modelMatches(model, t.model)) sameModelAnywhere = true;
    if (!inWindow) continue;
    if (!includeSettled && t.settled) continue;
    candidates.push(t);
  }
  if (!candidates.length) return null;
  const latestOf = (list: TurnContext[]): TurnContext | null => {
    let out: TurnContext | null = null;
    for (const t of list) if (!out || endedRank(t) > endedRank(out)) out = t;
    return out;
  };
  // 没有模型名可比时（用户点停止 / 宿主没给模型）只按「最近结束」取
  if (!wanted) return latestOf(candidates);
  for (const t of candidates) {
    const tModel = normalizeModel(t.model);
    if (!tModel) { unknownModel.push(t); continue; }
    if (modelMatches(model, t.model)) matched.push(t);
  }
  if (matched.length) return latestOf(matched);
  // 同模型的一轮已经结算 / 已出窗口：这一轮不该再被别的现场顶替
  if (sameModelAnywhere) return null;
  // 模型名缺失的一轮仍可认领（否则单请求场景会漏记）
  if (unknownModel.length) return latestOf(unknownModel);
  // 只有一轮候选：上游可能把模型名改写成完全不同的名字，此时没有任何歧义
  if (candidates.length === 1) return candidates[0];
  // 多轮并发且都名对不上：宁可这一轮漏记，也不要把别轮的开始时间 / 输入量搬过来
  return null;
}

/** 仅供单测：把一轮请求建进账本（并发竞态回归用，正式逻辑里由 fetch 包装调用） */
export function registerTurnForTest(patch: Partial<TurnContext>): TurnContext {
  const base: TurnContext = {
    startTime: Date.now(), requestId: null, model: null, modelFallback: false, status: 0,
    streamError: null, promptChars: 0, outputChars: 0, reasoningChars: 0, fullResponse: null, fullRequest: null,
    messages: [], promptMessages: [], connection: null, ttft: 0, thinkTime: 0, streamed: null,
    endedAt: 0, errorPayload: null, settled: false, settledBy: null, usage: null, finishReason: null,
    requestOrigin: null,
  };
  return registerTurn({ ...base, ...patch });
}

/** 仅供单测：清空账本 */
export function clearTurnLedgerForTest(): void {
  turnLedger.clear();
}

function stopPending(): boolean {
  return pendingStopAt > 0 && Date.now() - pendingStopAt < STOP_WINDOW_MS;
}

/**
 * 正常路径（上游给了 usage）的中断标记：
 * 用户点了停止 → user；流读出过错 → upstream；都没有则不写 interrupted。
 * 估算路径的 meta 由 settleTurnWithoutUsage 自己构造。
 */
function metaForTurn(turn: TurnContext | null): EntryMeta | null {
  const interrupted = stopPending() ? 'user' : turn?.streamError ? 'upstream' : null;
  const modelFallback = turn?.modelFallback === true;
  const requestOrigin = turn?.requestOrigin || null;
  // 字符数纯诊断用（核对「抓到的 prompt / 输出是不是这一轮的」），取不到就不写，不落一堆 0
  const promptChars = Number(turn?.promptChars) || 0;
  const outputChars = Number(turn?.outputChars) || 0;
  // 来源也要能单独把 meta 带出来：常规轮次没有中断标记，但来源照样要落库
  if (!interrupted && !modelFallback && !requestOrigin && !promptChars && !outputChars) return null;
  const meta: EntryMeta = { usageSource: 'upstream' };
  if (requestOrigin) meta.requestOrigin = requestOrigin;
  meta.interrupted = interrupted;
  if (interrupted) meta.interruptReason = interrupted === 'user' ? 'user-stop' : String(turn?.streamError || 'stream-error').slice(0, 200);
  if (modelFallback) meta.modelFallback = true;
  if (promptChars > 0) meta.promptChars = promptChars;
  if (outputChars > 0) meta.outputChars = outputChars;
  return meta;
}

/**
 * 请求体字符数：消息 content 累计（数组形态取 text 段），文本补全取 prompt。
 * 只用于诊断字段，不参与任何计价或估算口径。
 */
function countRequestChars(body: any): number {
  try {
    if (Array.isArray(body?.messages)) {
      let total = 0;
      for (const message of body.messages) {
        const content = message?.content;
        if (typeof content === 'string') total += content.length;
        else if (Array.isArray(content)) {
          for (const part of content) if (typeof part?.text === 'string') total += part.text.length;
        }
      }
      return total;
    }
    if (typeof body?.prompt === 'string') return body.prompt.length;
  } catch {}
  return 0;
}

function turnMetaFor(startTime: number): EntryMeta | null {
  return metaForTurn(currentTurn(startTime));
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

/**
 * 本轮输出是不是「上游错误提示被宿主包装成 200 正文」。
 *
 * 两个候选都试：投影后的正文（模型 content 的位置），以及上游原始响应
 * （错误 JSON / 带错误文案的 SSE 原文）。命中返回稳定串（锚点:字符数），供判定层与诊断快照共用。
 */
function detectTurnErrorPayload(text: string, raw: string | null): string | null {
  try {
    // 便宜预筛：错误正文只有几十到几百字符。超长的那一侧直接不解析——
    // 否则正常长回复每轮都要多跑一次 collectOutputText（长上下文下是几十万字符的 JSON 遍历）。
    const bodyLen = String(text || '').length;
    const rawLen = String(raw || '').length;
    if (bodyLen > API_ERROR_MAX_CHARS && rawLen > API_ERROR_MAX_CHARS) return null;
    if (bodyLen <= API_ERROR_MAX_CHARS) {
      const fromBody = detectApiErrorPayload(collectOutputText(text || ''));
      if (fromBody) return apiErrorPayloadTag(fromBody);
    }
    if (rawLen > 0 && rawLen <= API_ERROR_MAX_CHARS) {
      // 上游直接回 {"error":{...}}：整段原始响应就是错误体
      const fromRaw = detectApiErrorPayload(raw || '');
      if (fromRaw) return apiErrorPayloadTag(fromRaw);
    }
    return null;
  } catch {
    return null;
  }
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
    // 只有 OpenAI 兼容格式认 stream_options；TT 的 Gemini 原生 / Interactions / Claude / Responses 会拒收
    if (!isInjectableApiFormat(reqBody.custom_api_format)) return false;
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

/**
 * 采集包装的安装结果：成功返回 true，未装 / 装了但被抢先替换返回 false。
 * 返回值供自愈守卫判断要不要退避——以前安装失败被一个空 catch 吞掉，
 * 真机上表现为「采集整段静默、没有任何线索」，只能靠用户发现「没记录了」。
 */
function installFetchCapture(): boolean {
  try {
    const p: any = (window as any).parent || window;
    if (!p || typeof p.fetch !== 'function') return false;
    // 在岗判定必须顺着链验证到 activeCapture 本人，不能只看顶层的标记布尔：
    // 探针层把 __aus_patched 定义成「读内层」的 getter，内层采集代退役后它照样是 true。
    if (captureInPlace(p)) return true;
    // 记下被包住的原始函数：bind 产物不继承自定义属性，读标记必须读它
    const prevFetchFn: any = p.fetch;
    // 层深是硬约束：宿主反复重绑时我们每跟一次就 +1 层，只靠「旧代直通」不会重复记账，
    // 但层数会无限长。到上限就停下并报警，这是最后一道闸门。
    const depth = (Number((prevFetchFn as any).__ausCaptureDepth) || 0) + 1;
    if (depth > MAX_CAPTURE_DEPTH) {
      noteInstallProblem('depth-limit:' + depth, '采集包装层数已达上限，停止再包一层（宿主可能在反复重绑 fetch）', { depth });
      return false;
    }
    const rawFetch = prevFetchFn.bind(p);
    // 卸载时还原到「本次包装所用的下一层」，宿主重装过包装也不会还原成过期的一层
    rawFetchRef = rawFetch;
    const patched: any = function(this: any) {
      const args: any = arguments;
      // 旧代退役：只有当前在岗的那一代才解析响应。
      // 宿主重绑后我们会在外层再包一层，旧层仍留在链里；若旧层也解析，一次请求会被记 N 遍。
      if (activeCapture !== patched) {
        return rawFetch.apply(p, args);
      }
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
        // 本轮现场：模型名先按请求体判断是否只能兜底，响应带回真实模型名后再清掉标记。
        // 关键：这一轮之后的所有读写都走 turn 这个引用，不再回捞「最后发出的那一轮」
        const requestModel = (() => { try { return (reqBody as any)?.model; } catch { return null; } })();
        const turn: TurnContext = registerTurn({
          startTime,
          requestId,
          model: typeof requestModel === 'string' && requestModel ? requestModel : null,
          modelFallback: !(typeof requestModel === 'string' && requestModel),
          status: 0,
          streamError: null,
          promptChars: countRequestChars(reqBody),
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
          endedAt: 0,
          errorPayload: null,
          settled: false,
          settledBy: null,
          usage: null,
          finishReason: null,
          // 抓栈就在这一行：fetch 调用链唯一还在场的时刻
          requestOrigin: detectRequestOrigin(),
        });
        // 通过 custom_include_body 让上游返回流式 usage；上游若不认这个参数则原样重试
        const injected = injectIncludeUsage(reqBody, (reqBody as any)?.chat_completion_source ?? null);
        const performFetch = (init: any) => rawFetch.apply(p, init);
        const fetchArgs = injected
          ? [args[0], { ...(args[1] as any), body: JSON.stringify(reqBody) }]
          : args;
        // 请求日志：不管这轮最终有没有算出用量、有没有入库，先留下原文（只保留最近一轮）。
        // 存的是宿主交过来的**未经扩展修改**的请求，include_usage 注入只改实际发送、不进日志记录。
        try {
          const rawInit: any = (args as any)[1] || {};
          const rawBody = typeof rawInit.body === 'string' ? rawInit.body : '';
          saveRequestStart({ at: startTime, method: rawInit.method || 'POST', url, headers: rawInit.headers, body: rawBody });
          // 详情原文：最近 DETAIL_KEEP 条的完整请求体与脱敏后的请求头另存详情原文库，
          // 历史热区只留摘要。这里拿到的是宿主交过来的原始 init，与请求日志同源。
          try {
            putDetailRequest({
              requestId,
              timestamp: startTime,
              model: typeof requestModel === 'string' ? requestModel : null,
              body: rawBody,
              headers: rawInit.headers,
            }).catch(() => {});
          } catch {}
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
          try { turn.status = res.status; } catch {}
          try {
            const clone = res.clone();
            // 请求体未声明流式 → 明确非流式，全程不测速
            const requestedStream = reqBody?.stream === true;
            // 帧归一化：把任意 provider 的形状投影成 OpenAI/DeepSeek 形状，下游解析不再认识各家字段。
            // 每个请求一份状态（协议首帧锁定），只在这条 clone 旁路上起作用，原始响应照常透传。
            const frameNormalizer = createFrameNormalizer();
            // 详情原文库用的响应累积：fullText 会被 STREAM_TEXT_LIMIT 截到尾部，
            // 而详情页要的是完整原文，所以单独累积一份，按 DETAIL_MAX_CHARS 封顶。
            let archiveText = '';
            let archiveTruncated = false;
            let responseArchived = false;
            const pushArchive = (piece: string) => {
              if (!piece || archiveTruncated) return;
              const room = DETAIL_MAX_CHARS - archiveText.length;
              if (piece.length <= room) { archiveText += piece; return; }
              archiveText += piece.slice(0, Math.max(0, room));
              archiveTruncated = true;
            };
            const parseAndProcess = (text: string, ttftVal: number, thinkTimeVal: number, streamed: boolean | null = null, rawText: string | null = null, archiveRaw: string | null = null) => {
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
            // 响应带回真实模型名 → 不再算「模型缺失兜底」；顺手把这轮的响应原文与结束时刻挂上去
            try {
              const resModel = (data as any)?.model;
              if (typeof resModel === 'string' && resModel) { turn.model = resModel; turn.modelFallback = false; }
              if (!turn.fullResponse) turn.fullResponse = rawText ?? text;
              if (!turn.endedAt) turn.endedAt = Date.now();
              // 上游错误被包装成 200：正文里只有客户端拼的错误文案，记下来供判定层直接丢弃
              const errorTag = detectTurnErrorPayload(text, rawText);
              if (errorTag) turn.errorPayload = errorTag;
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
              // 本轮现场自己留一份用量：并发时 GENERATION_ENDED 只认账本，不再跨轮捞单槽
              try { turn.usage = usage; turn.finishReason = finishReason ?? null; } catch {}
              try { estimateThinkTokens(text, usage); } catch {}
              // 完整响应文本（非流式为完整 JSON，流式为 SSE 原文）供历史详情展示
              // fullResponse 只用于历史详情展示，必须是上游原文（未经帧归一化投影）
              lastFetchUsage = { usage, model, msgs, startTime, fullReq, fullResponse: rawText ?? text, ttft: ttftVal, thinkTime: thinkTimeVal, finishReason, streamed, connection: requestConnection, requestId };
              lastFetchModel = typeof model === 'string' ? model : null;
              lastFetchTime = Date.now();
              log.debug('fetch 捕获 usage', { model, hasUsage: !!usage, finishReason, streamed });
              try { processUsage(usage, model, msgs, startTime, fullReq, text, ttftVal, thinkTimeVal, finishReason, requestConnection, requestId, streamed); } catch (e) { log.error('fetch 用量记录失败 ' + ((e as any)?.message || e)); }
            }
            // 详情原文归档：每次请求只写一次（流式收尾路径可能被调用两次）。
            // 存上游原文而不是归一化投影；usage 解析不到时仍写响应，详情页至少能看到原始响应。
            if (!responseArchived) {
              responseArchived = true;
              const archiveBody = typeof archiveRaw === 'string' && archiveRaw ? archiveRaw : (rawText ?? text);
              try {
                putDetailResponse({
                  requestId,
                  timestamp: startTime,
                  model: (data as any)?.model || reqBody?.model || fullReq?.model || null,
                  body: archiveBody,
                  usage: (data as any)?.usage || null,
                }).catch(() => {});
              } catch {}
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
            // 假流式检测：口径见 think-timing.ts#judgeStreamedFromClock
            // （增量帧含正文 / 思维链 / 工具调用；工具调用响应没有 delta.content 也能判对）
            const judgeStreamed = (): boolean | null => judgeStreamedFromClock(thinkClock, requestedStream);
            const finish = () => {
              try {
                const endedAt = nowMs() - t0;
                const thinkTime = resolveThinkTime(thinkClock, endedAt);
                // 时序自洽：思维链耗时以首字为锚，ttft 没测到（<=0）时一律不写，避免「首字 0ms、思维链 65s」的矛盾读数
                const safeThinkTime = ttft > 0 ? thinkTime || 0 : 0;
                const streamed = judgeStreamed();
                // 现场留档：输出字符数决定「能不能按估算补记」，endedAt 决定这是「刚结束的那一轮」
                try {
                  turn.ttft = ttft || 0;
                  turn.thinkTime = safeThinkTime;
                  turn.streamed = streamed;
                  turn.outputChars = thinkClock.contentChars || 0;
                  turn.reasoningChars = thinkClock.reasoningChars || 0;
                  turn.fullResponse = fullText || null;
                  if (!turn.endedAt) turn.endedAt = Date.now();
                } catch {}
                if (safeThinkTime > 0) log.debug('思维链耗时已测量 ' + safeThinkTime + 'ms');
                try { lastStreamTiming = { ttft, thinkTime: safeThinkTime, streamed, startTime, at: Date.now() }; } catch {}
                try { patchRequestLog({ durationMs: endedAt, streamed }); } catch {}
                // 优先解析归一化后的文本（能认 Gemini / Anthropic / Responses），
                // 投影为空时退回原文；原文作为第 5 参传入，只用于展示
                parseAndProcess(normText || fullText, ttft, safeThinkTime, streamed, fullText, archiveText);
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
                fullText += piece; buf += piece; pushArchive(piece);
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
                  turn.streamError = String((streamErr && (streamErr.message || streamErr.name)) || 'stream-error');
                  if (!turn.endedAt) turn.endedAt = Date.now();
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
            turn.streamError = message;
            if (!turn.endedAt) turn.endedAt = Date.now();
          } catch {}
          throw e;
        });
      }
      return rawFetch.apply(p, args);
    };
    patched.__aus_patched = true;
    // 里面如果已经包了探针，把探针的身份标记透传上来：
    // 两边各有 4s 自愈守卫，互相把对方当成「没装过」就会一层套一层地无限对套。
    // 用 getter 动态读内层：安装时快照的布尔值会随宿主重绑过期，过期后就是对套。
    try {
      Object.defineProperty(patched, '__ausTapPatched', {
        configurable: true,
        get: () => (prevFetchFn as any).__ausTapPatched === true,
      });
    } catch {}
    // 安装期间顶层被别人换掉了：放弃这一代，免得把别人的新包装整个吃掉
    if (p.fetch !== prevFetchFn) {
      noteInstallProblem('replaced-during-install', '采集包装安装期间顶层被替换，放弃本次安装');
      return false;
    }
    patched.__ausCaptureDepth = depth;
    patched.__ausCaptureLayer = true;
    // 链上下一层：供自愈守卫逐层验证「在岗那一代是否真的还挂在这里」
    patched.__ausCaptureInner = prevFetchFn;
    // 还原目标是「链上的下一层本身」而不是它的 bind 产物：bind 会丢自定义属性，
    // 下一层若是探针，还原成 bind 产物等于把探针的在岗/内层记录全抹掉。
    // 只在确认这一代真的装上之后才记，放弃安装的分支不能污染还原目标。
    restoreTarget = prevFetchFn;
    activateCapture(patched);
    captureHealth.installed = true;
    captureHealth.generations += 1;
    captureHealth.depth = depth;
    captureHealth.lastInstallAt = Date.now();
    captureHealth.lastError = null;
    p.fetch = patched;
    log.debug('fetch 捕获已安装 TARGET_API=' + TARGET_API, { depth, generations: captureHealth.generations });
    return true;
  } catch (e) {
    noteInstallProblem('install-threw', String((e as any)?.message || e));
    return false;
  }
}

/** 安装期的所有异常都从这里出去：计数 + 首次/每 10 次告警 + 写进采集日志摘要 */
function noteInstallProblem(code: string, message: string, extra: Record<string, any> = {}): void {
  captureHealth.failures += 1;
  captureHealth.lastError = code;
  const first = captureHealth.failures === 1;
  const everyTen = captureHealth.failures % 10 === 0;
  try { if (first || everyTen) log.warn(message, { failures: captureHealth.failures, ...extra }); } catch {}
  try { noteCaptureStage('install-failed', { model: '', requestId: '', reason: code }); } catch {}
}

/**
 * 采集包装的健康快照：真机排查「为什么这一整段没记录」时先看它。
 * 暴露在 window.__ausCapture.diagnostics()，也随采集日志一起上报。
 */
export function captureDiagnostics() {
  // 链现状一起给出来：真机「没记录」时第一眼要看的就是「顶层是谁、往下还有没有我们那一代」，
  // 只有 installed/hasActive 两个布尔时，假在岗与「压根没装上」在诊断信息里长得一模一样。
  let fetchChain = 'unknown';
  try {
    const p: any = (window as any).parent || window;
    fetchChain = describeFetchChain(p?.fetch) + (activeCapture ? '>active' : '>active:none');
  } catch {}
  return {
    ...captureHealth,
    backoffMs: guardBackoff,
    hasActive: !!activeCapture,
    guardMs: FETCH_GUARD_MS,
    fetchChain,
  };
}

let interceptionInstalled = false;
let rawFetchRef: any = null;
/** 卸载还原目标：被包住的下一层原函数（不带 bind），保住它自己的标记与身份 */
let restoreTarget: any = null;
let messageReceivedHandler: any = null;

/**
 * 当前「在岗」的那一代采集包装。
 *
 * 为什么需要它：宿主（TauriTavern）会反复把自己的 patchedFetch 装到最外层，我们的 4s 自愈
 * 守卫每次都会把「当时的顶层」当 delegate 再包一层，旧层并不会从链上消失。旧层若继续解析
 * 响应，同一次请求就会被每一层各解析一次、各生成一个 requestId 各写一条历史——
 * 指纹按 requestId 计算，彼此不同，去重完全拦不住（3.2.3 出现过一次请求记 12 条）。
 * 所以只认「最新一代」干活，旧代一律纯直通。
 */
let activeCapture: any = null;

/** 让某一代成为「在岗的那一代」；其余旧代自动降级为直通 */
function activateCapture(fn: any): void {
  if (!fn) return;
  try {
    if (activeCapture && activeCapture !== fn) (activeCapture as any).__ausCaptureActive = false;
    (fn as any).__ausCaptureActive = true;
  } catch {}
  activeCapture = fn;
  // 能真正上岗说明链路已经稳了，把重装退避立刻收回正常节奏
  resetGuardBackoff();
}

/**
 * 宿主可能在我们之后重装自己的 fetch 包装（TauriTavern 在后端就绪后会再 patchFetch 一次，
 * 把当前 fetch 当成 delegate 存起来再换成自己的）。一旦被换到内层，
 * /api/backends/chat-completions/generate 会被宿主自己的路由直接吃掉，我们就再也看不到响应。
 * 因此这里定期校验「最外层是不是我们」，不是就重新包一层。
 */
const FETCH_GUARD_MS = 4000;
/** 重装退避上限：反复被替换时把 4s 拉长到 60s，避免和宿主互相刷层 */
const MAX_GUARD_BACKOFF_MS = 60_000;
/** 包装链的硬上限：旧代直通不记账，但层数不能无限长（每层都是一次函数调用） */
const MAX_CAPTURE_DEPTH = 6;
let fetchGuardTimer: any = null;
let fetchGuardBootTimers: any[] = [];
let guardBackoff = FETCH_GUARD_MS;
let nextInstallAllowedAt = 0;

/** 采集包装健康状态：安装次数 / 失败次数 / 层深 / 退避，用于真机定位「采集为什么静默」 */
const captureHealth = {
  installed: false,
  generations: 0,
  failures: 0,
  /** 检测到「顶层带标记但在岗代不在链上」的次数：不改判据的话这里永远是 0，采集却已失聪 */
  staleFlags: 0,
  depth: 0,
  lastError: null as string | null,
  lastInstallAt: 0,
};

/**
 * 采集包装「在岗」判定：顺着链验证，不认任何标记布尔。
 *
 * 3.2.3 真机事故的根因就在这里——探针层为了让两边守卫不互相对套，把 __aus_patched
 * 定义成「读内层」的 getter；宿主重载后内层采集代退役，这个 getter 恒为 true，
 * 而 __ausCaptureLayer 又不在探针层上。老判据两边都不满足就不会重装：4s 自愈守卫
 * 每轮都 early return，「没记录」持续几小时，而诊断包里既没有 install-failed 也没有 fetch-start。
 *
 * 现在只认一件事：链上还能不能摸到 activeCapture 本人。摸不到就必须重装。
 */
function captureInPlace(p: any): boolean {
  const top: any = p?.fetch;
  if (typeof top !== 'function') return false;
  // 顶层就是我们的某一代采集层（宿主可能把旧代装回来了）：就地复用，不新增层
  if ((top as any).__ausCaptureLayer === true) {
    activateCapture(top);
    return true;
  }
  // 没有在岗代（卸载后 / 从未装上）一律判不在岗，守卫必须重装
  return fetchChainHas(top, activeCapture);
}

/** 假在岗留痕节流：守卫 4s 一轮，快照缓冲只有 CAPTURE_MAX 条，不能每轮都写 */
const STALE_REPORT_MS = 60_000;
let lastStaleReportAt = 0;

/**
 * 假在岗留痕：顶层带着我们的标记，却摸不到在岗那一代。
 * 只写采集快照与计数，不写 install-failed——安装并没有失败，写那条会让健康信号误报成插件报错。
 */
function noteStaleCapture(top: any): void {
  captureHealth.staleFlags += 1;
  const now = Date.now();
  if (now - lastStaleReportAt < STALE_REPORT_MS) return;
  lastStaleReportAt = now;
  const chain = describeFetchChain(top) + (activeCapture ? '' : '>active:none');
  try { noteCaptureStage('guard-recovered', { model: '', requestId: '', reason: 'stale:' + chain }); } catch {}
}

function resetGuardBackoff(): void {
  guardBackoff = FETCH_GUARD_MS;
  nextInstallAllowedAt = 0;
}

function growGuardBackoff(): void {
  guardBackoff = Math.min(Math.max(guardBackoff * 2, FETCH_GUARD_MS), MAX_GUARD_BACKOFF_MS);
  nextInstallAllowedAt = Date.now() + guardBackoff;
  try { log.debug('采集包装重装退避', { backoffMs: guardBackoff, failures: captureHealth.failures }); } catch {}
}

function ensureFetchCapture() {
  try {
    const p: any = (window as any).parent || window;
    if (!p || typeof p.fetch !== 'function') return;
    // 在岗判定改为「顺着链摸到 activeCapture」，标记布尔不再作数
    if (captureInPlace(p)) return;
    // 顶层还带着我们的标记却摸不到在岗代 = 假在岗：这是以前完全静默的那种故障，必须先留痕
    if (fetchChainKind(p.fetch) !== 'other') noteStaleCapture(p.fetch);
    if (Date.now() < nextInstallAllowedAt) return;
    if (installFetchCapture()) resetGuardBackoff();
    else growGuardBackoff();
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
      // 只把「既不是采集层、也不是探针层」的原始 fetch 记为兜底还原目标。
      // 以前只看 __aus_patched，而探针层把这个标记透传成 true 的反面也有陷阱：
      // 顶层是探针时会拿探针的 bind 产物当还原目标，卸载后就留下半残的一层。
      if (p?.fetch && fetchChainKind(p.fetch) === 'other') {
        rawFetchRef = p.fetch.bind(p);
        restoreTarget = p.fetch;
      }
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
    // 真机自检口子：__ausCapture.diagnostics() 一次看全「装没装上 / 层数 / 失败次数 / 退避」
    try { (globalThis as any).__ausCapture = { diagnostics: captureDiagnostics }; } catch {}
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
      turnLedger.clear();
    }
    try {
      const p: any = (window as any).parent || window;
      // 只在「顶层确实是我们这一代采集层」时还原顶层。
      // 顶层若是探针或宿主包装，整层摘掉会连它们一起抹掉，留下「外面还带着采集标记、
      // 里面采集已经没了」的假在岗现场——这正是 3.2.3 那次几小时静默的成因。
      if (p && (p.fetch as any)?.__ausCaptureLayer === true && restoreTarget) {
        p.fetch = restoreTarget;
      }
    } catch {}
    // 卸载后不许任何残留层再记账
    activeCapture = null;
    captureHealth.installed = false;
    try { delete (globalThis as any).__ausCapture; } catch {}
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

/** fetch 快照是否属于这一轮：双方都有 requestId 时必须一致，否则别把别轮的时序证据串过来 */
function packMatches(turn: TurnContext | null, pack: any): boolean {
  if (!turn || !pack || !turn.requestId || !pack.requestId) return true;
  return turn.requestId === pack.requestId;
}

/**
 * 「上游真的给了用量」的统一落库出口：主路径 / swipe_info / args / fetch 兜底共用的那段收尾。
 *
 * 这四处原本各抄了一遍「从 lastFetchUsage 补 ttft / 思维链 / finishReason / streamed」，
 * 抄漏一处就会把别轮的时序证据串过来（lastFetchUsage 是「最后发出那一轮」的单槽）。
 * 现在只留一份实现，规则也只有一条：快照的 requestId 与本轮对不上时一律不补。
 */
function recordUpstreamUsage(params: {
  usage: any;
  model: string;
  ended: TurnContext | null;
  /** usage 自带或调用方确定的 finishReason */
  finishReason?: string | null;
  /** 另一个来源的 finishReason（如 chat tail），仅在前面都为空时使用 */
  fallbackFinishReason?: string | null;
  fullRequest?: any;
  fullResponse?: any;
  /** 兜底用的快照有效期：流式长输出可能晚到，默认 5s */
  packMaxAge?: number;
}): void {
  const ended = params.ended;
  const packMaxAge = params.packMaxAge ?? 5000;
  let ttft = ended?.ttft || 0;
  let think = ended?.thinkTime || 0;
  let streamed: boolean | null = ended?.streamed ?? null;
  let fr: string | null = params.finishReason ?? null;
  try {
    const fp: any = lastFetchUsage;
    if (fp && packMatches(ended, fp) && Date.now() - lastFetchTime < packMaxAge) {
      if (!ttft) ttft = fp.ttft || 0;
      if (!think) think = fp.thinkTime || 0;
      if (!fr) fr = fp.finishReason ?? null;
      if (fp.streamed != null && streamed == null) streamed = fp.streamed;
    }
  } catch {}
  if (!fr && params.fallbackFinishReason) fr = params.fallbackFinishReason;
  processUsage(
    params.usage,
    params.model,
    ended?.messages?.length ? ended.messages : lastMessages,
    ended?.startTime || lastStart,
    params.fullRequest ?? null,
    params.fullResponse ?? null,
    ttft,
    think,
    fr,
    ended?.connection || recentConnection(5000),
    ended?.requestId || recentRequestId(),
    streamed,
  );
  lastFetchUsage = null;
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

    /**
     * 解析「刚结束的那一轮」。并发时账本里有多轮在途，按 tail 模型对号入座；
     * 落库用的 messages / startTime / requestId / connection 一律取自这一轮，
     * 不再从 lastMessages / lastStart / recentRequestId() 这些「最后发出」的槽里取。
     */
    const endedTurn = (m: string | null = model): TurnContext | null => pickEndedTurn(m);
    /** 这一轮已经由 fetch 侧按真实 usage 落库 → 不重复记，也不要用估算覆盖 */
    const alreadyRecorded = (t: TurnContext | null): boolean => {
      if (!t || t.settledBy !== 'usage') return false;
      log.debug('这一轮已按真实用量落库，跳过结束事件', { requestId: t.requestId });
      lastFetchUsage = null;
      return true;
    };

    // 全 0 / 空用量不算正常记录：交给估算路径判断能否按输出补记
    if (usage && isValidUsage(usage) && isZeroUsage(usage)) {
      log.debug('主路径 usage 全 0，转交估算判定');
      usage = null;
    }
    if (usage && isValidUsage(usage)) {
      log.debug('命中主路径 extra usage');
      const ended = endedTurn();
      if (alreadyRecorded(ended)) return;
      recordUpstreamUsage({
        usage,
        model,
        ended,
        // usage 未带 finish_reason 时，退到 tail SSE 最后一个 chunk 里补
        fallbackFinishReason: (extra as any)?.finish_reason ?? (tail as any)?.finish_reason ?? null,
      });
      return;
    }
    if (tail?.swipe_info && typeof tail.swipe_info === 'object') {
      log.debug('尝试 swipe_info 路径');
      for (const v of Object.values(tail.swipe_info as any)) {
        const cand = (v as any)?.extra?.api_usage || (v as any)?.extra?.usage;
        if (isValidUsage(cand) && !isZeroUsage(cand)) {
          usage = cand;
          model = (v as any)?.extra?.model || model;
          const ended = endedTurn(model);
          if (alreadyRecorded(ended)) return;
          log.debug('swipe_info 命中', { model });
          recordUpstreamUsage({
            usage,
            model,
            ended,
            finishReason: (cand as any)?.__finish_reason ?? null,
          });
          return;
        }
      }
      log.debug('swipe_info 未命中有效 usage');
    }
    const maybeUsage = args[0]?.usage || args[0]?.api_usage;
    log.debug('尝试 args 兜底', { hasMaybeUsage: !!maybeUsage, isValid: maybeUsage ? isValidUsage(maybeUsage) : false });
    if (isValidUsage(maybeUsage) && !isZeroUsage(maybeUsage)) {
      const m = args[0]?.model || model;
      const ended = endedTurn(m);
      if (alreadyRecorded(ended)) return;
      log.debug('args 命中', { model: m });
      recordUpstreamUsage({
        usage: maybeUsage,
        model: m,
        ended,
        finishReason: (maybeUsage as any)?.__finish_reason ?? null,
      });
      return;
    }
    {
      const ended = endedTurn();
      const fetchPack: any = lastFetchUsage as any;
      const packUsage = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
      // 首选「刚结束那一轮」自己在响应当里解析到的用量：它属于这一轮，与并发无关。
      // lastFetchUsage 是单槽（最后发出的那一轮），只有在 requestId 对得上时才允许兜底。
      const usageFromTurn = ended?.usage && isValidUsage(ended.usage) ? ended.usage : null;
      const usableFromPack = !!packUsage && isValidUsage(packUsage) && Date.now() - lastFetchTime < 120000;
      // 并发保护：快照属于另一轮时不能拿来给这一轮记账，留着给那一轮自己的结束事件
      const belongs = packMatches(ended, fetchPack);
      const fetchUsage = usageFromTurn || (usableFromPack && belongs ? packUsage : null);
      if (fetchUsage) {
        if (alreadyRecorded(ended)) return;
        const fetchedModel = ended?.model || (fetchPack && fetchPack.model) || lastFetchModel || model;
        const fetchedMsgs = (ended?.messages?.length ? ended.messages : null) || (fetchPack && fetchPack.msgs) || lastMessages;
        const fetchedStart = ended?.startTime || (fetchPack && fetchPack.startTime) || lastStart;
        const fetchedReq = ended?.fullRequest || (fetchPack && fetchPack.fullReq) || null;
        const fetchedRes = ended?.fullResponse || (fetchPack && fetchPack.fullResponse) || null;
        const fTtft = ended?.ttft || (fetchPack && fetchPack.ttft) || 0;
        const fThink = ended?.thinkTime || (fetchPack && fetchPack.thinkTime) || 0;
        const fFr = ended?.finishReason || (fetchPack && fetchPack.finishReason) || (fetchUsage as any)?.__finish_reason || null;
        const fStreamed: boolean | null = (ended?.streamed ?? null) ?? (fetchPack && fetchPack.streamed != null ? fetchPack.streamed : null);
        log.debug('fetch 兜底命中', { model: fetchedModel, from: usageFromTurn ? 'turn' : 'pack' });
        if (!usageFromTurn) lastFetchUsage = null;
        processUsage(fetchUsage, fetchedModel, fetchedMsgs, fetchedStart, fetchedReq, fetchedRes, fTtft, fThink, fFr, ended?.connection || fetchPack?.connection || recentConnection(), ended?.requestId || fetchPack?.requestId || recentRequestId(120000), fStreamed);
        return;
      } else if (packUsage && isValidUsage(packUsage) && !belongs) {
        log.debug('fetch 快照属于另一轮请求，留给那一轮结算', { ended: ended?.requestId || null, pack: fetchPack?.requestId || null });
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
  // 只认「刚结束的那一轮」：账本里按模型名对号入座（取最新、未结算的那条）。
  // 并发时账本里还躺着别的在途请求，绝不能再拿 lastStart / lastMessages 这些
  // 「最后发出」的槽位去顶替——那正是 3.2.3 里时长/输入量/requestId 串到另一轮请求的根因。
  const turn = pickEndedTurn(opts.model ?? null, false);
  if (turn?.settled) return;
  /**
   * 对不上号（账本里没有这一轮）：尽量记上，但绝不借用别轮的现场。
   *
   * 上一版是「账本非空但对不上就整轮丢弃」，宁可漏记不串账；实际使用中漏记更难接受——
   * 一轮真实对话直接消失，统计里看不出来，只能靠探针孤儿提示间接发现。
   * 折中做法：照常估算补记，但把会被串坏的字段全部置空——
   * 开始时间留空（时长记 0，而不是编一个别的请求的时长）、requestId 留空（不冒名顶替）。
   * 输入内容仍取最近一次请求体（估算需要它），并在 meta 里标出来源不确定。
   */
  const orphan = !turn;
  if (orphan) {
    log.debug('生成结束事件对不上任何请求轮次，按无主轮次估算补记', { source, model: opts.model || null, ledger: turnLedger.size });
    try { noteCaptureStage('turn-unmatched', { model: opts.model || '', requestId: '', reason: 'turn-unmatched' }); } catch {}
  }
  const model = opts.model || turn?.model || lastFetchModel || 'deepseek-v4-flash';
  // 两个口径必须分开：展示/落库用最近 10 条摘要，输入估算用完整上下文
  const storeMessages = turn?.messages?.length ? turn.messages : lastMessages || [];
  const estimateMessages = pickPromptMessages(turn?.promptMessages, storeMessages);
  const startedAt = turn?.startTime || null;
  const requestId = turn?.requestId || null;
  // 响应原文只认本轮现场：lastFetchUsage 属于「最后发出」那一轮，借用会少算/串算输出
  const rawResponse = turn?.fullResponse || '';
  const outputText = collectOutputText(rawResponse);
  const hasOutput = !!outputText.trim() || !!turn && (turn.outputChars > 0 || turn.reasoningChars > 0);
  // 有输出也要先看「这输出是不是模型写的」：TT 把上游 500 包成 200，正文就是错误提示。
  // turn 上抓到的优先（fetch 解析时就判过），抓不到再按响应原文补判一次。
  const errorPayload = turn?.errorPayload || detectTurnErrorPayload(rawResponse, rawResponse);
  const outcome = decideTurnOutcome({
    hasUsage: false,
    usageUsable: false,
    hasOutput,
    pendingStop: stopPending(),
    streamError: turn?.streamError || null,
    errorPayload,
  });
  if (outcome.kind === 'drop') {
    // 上游错误被宿主包装成 200：这一轮没有任何模型内容，既不能按输出估算，也不能计费。
    // 用独立阶段 entry-rejected 记一条（不混进 event-drop「对话未写入历史」的统计口径），
    // 历史保持干净，而「撞了多少次上游错误、命中哪个锚点、状态码多少」在诊断包里仍查得到。
    if (outcome.reason === 'api-error-payload') {
      log.debug('本轮输出是上游错误提示，拒绝入库', { source, errorPayload, status: turn?.status ?? null });
      try {
        noteCaptureStage('entry-rejected', {
          model,
          requestId: requestId || '',
          streamed: turn?.streamed ?? null,
          usageFound: false,
          usageZero: false,
          reason: 'api-error-payload:' + String(errorPayload || 'unknown') + ':status=' + String(turn?.status ?? ''),
        });
      } catch {}
      if (turn) {
        turn.settled = true;
        turn.settledBy = 'rejected';
      }
      return;
    }
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
  if (turn?.requestOrigin) meta.requestOrigin = turn.requestOrigin;
  // 无主轮次：开始时间与 requestId 都是空的，明确标出来，别让「时长为 0」被当成真的很快
  if (orphan) meta.interruptReason = String(meta.interruptReason || '') + '|turn-unmatched';
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
  if (turn) {
    turn.settled = true;
    turn.settledBy = 'estimated';
  }
  log.debug('本轮已按估算补记', { source, turn: turn?.requestId || null, interrupted: outcome.interrupted || null, promptTokens, completionTokens, method: meta.estimateMethod });
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
  // 上游错误被宿主包装成 200：正文只有错误提示，这一轮没有任何模型内容。
  // 哪怕响应里带了 usage（比 4.1 节的组合更隐蔽）也拒绝入库，只留一条诊断快照。
  try {
    const errTurn = turnByRequestId(requestId) || currentTurn(startTime);
    // 兜底：事件路径先于 fetch 解析到达时 turn.errorPayload 还没写上，用原始响应再判一次
    // （超长响应在 detectTurnErrorPayload 的预筛里就直接返回 null，不产生遍历开销）
    const errTag = errTurn ? errTurn.errorPayload || detectTurnErrorPayload(errTurn.fullResponse || '', null) : null;
    if (errTurn && errTag) {
      errTurn.settled = true;
      errTurn.settledBy = 'rejected';
      log.debug('本轮输出是上游错误提示，拒绝入库', { requestId, errorPayload: errTag, status: errTurn.status });
      try {
        noteCaptureStage('entry-rejected', {
          model,
          requestId: requestId || '',
          streamed,
          usageFound: !!usage,
          usageZero: isZeroUsage(usage),
          usage: usageNumbers(usage),
          finishReason,
          reason: 'api-error-payload:' + errTag + ':status=' + String(errTurn.status ?? ''),
        });
      } catch {}
      return;
    }
  } catch {}
  // 主路径 usage 多来自 ST，可能缺 reasoning_tokens；从最近 fetch 的估算值补上
  try {
    const fp: any = lastFetchUsage;
    // 并发保护：快照必须属于同一轮请求，否则会把别轮的思维链估算搬到这一条上
    const sameTurn = !fp?.requestId || !requestId || fp.requestId === requestId;
    if (fp?.usage && sameTurn && Date.now() - lastFetchTime < 5000) {
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
    // 并发时 requestId 才是唯一键：startTime 同毫秒会撞，来源必须跟着自己那一轮
    try { resolvedMeta = metaForTurn(turnByRequestId(requestId) || currentTurn(startTime)); } catch {}
  }
  try {
    const zeroUsage = isZeroUsage(usage);
    const added = repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime, finishReason, connection, requestId, streamed, resolvedMeta);
    try {
      const t = turnByRequestId(requestId) || currentTurn(startTime);
      // 全 0 用量不算已入库：留给生成结束事件走估算补记
      if (t && (added || !zeroUsage)) {
        t.settled = true;
        t.settledBy = 'usage';
      }
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
