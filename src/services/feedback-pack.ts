/**
 * 反馈诊断包：用户遇到「对话没被记录」或「记录数据不对」时，上传的不只是一条请求日志，
 * 而是一份能让开发者还原现场的最小诊断材料。
 *
 * 三条上传链路：
 * - 历史记录页健康提示点「上传这一条」：report.scope=single，report.target 指名道姓那一轮；
 * - 历史记录页点「上传反馈日志」：report.scope=all，report.targets 把提示条里列出的每一条都逐条点名
 *   （等价于把每条「上传这一条」并成一份包，最多 FEEDBACK_TARGET_LIMIT 条）；
 * - 设置页 / 请求日志页点「上传反馈」：report.scope=recent，上传最近一轮请求的详细数据 + 其他数据。
 * 只要带目标，evidence 里就为每条目标准备「记录 + 前后各一条历史」「探针 + 同簇几条」「±2 分钟控制台」。
 *
 * 收集范围（只挑与排查有关的）：
 * - record：请求日志页当前那条记录，含请求正文（已脱敏）；
 * - report：问题类型 + 目标信号 + 用户自己的文字描述（最先看这个）；
 * - diagnostics：最近历史记录摘要、探针「其他请求」摘要、控制台最近报错、扩展清单、
 *   设置与环境摘要、当前对话与角色名、最近三轮对话摘要（正文可关）。
 *
 * 不收集：钱包密钥、API Key、extensionSettings 原文、图片附件、脚本源码、Discord 身份。
 */
import { state } from '../store';
import { APP_VERSION } from '../constants/version';
import { captureDigest } from './capture-digest';
import { listTapRecords } from './request-tap/store';
import { sanitizeJson, sanitizeText, sanitizeLogForUpload } from './log-sanitize';
import { listConsoleEntries } from './console-ring';
import { mobileDeviceHint } from '../utils/device';
import { readRecentTurns, type RequestLogRecord } from './request-log';

/** 用户描述上限 */
export const FEEDBACK_NOTE_LIMIT = 2000;
/** 历史摘要条数 */
export const FEEDBACK_HISTORY_LIMIT = 10;
/** 探针摘要条数 */
export const FEEDBACK_TAP_LIMIT = 20;
/** 控制台摘要条数 */
export const FEEDBACK_CONSOLE_LIMIT = 40;
/** 反馈体版本：2 起带 report / diagnostics；3 起带 report.target 与 diagnostics.evidence；4 起支持 report.targets 多条点名 */
export const FEEDBACK_SCHEMA = 4;
/** 一次最多逐条点名几条异常（再多只计数，避免上传体膨胀） */
export const FEEDBACK_TARGET_LIMIT = 8;
/** 控制台证据的时间窗（前后各 2 分钟） */
export const EVIDENCE_CONSOLE_WINDOW_MS = 120_000;
/** 同簇探针最多带几条 */
export const EVIDENCE_TAP_LIMIT = 4;

export type FeedbackProblem = 'not-recorded' | 'wrong-data' | 'other';

/** 上传口径：single=指向某一条；all=指向提示条里的每一条；recent=最近一轮 + 全量诊断 */
export type FeedbackScope = 'single' | 'all' | 'recent';

export const FEEDBACK_PROBLEMS: Array<{ id: FeedbackProblem; label: string; hint: string }> = [
  {
    id: 'not-recorded',
    label: '对话没有被记录',
    hint: '酒馆里回复成功了，历史记录和统计里却没有这一轮',
  },
  {
    id: 'wrong-data',
    label: '记录的数据不对',
    hint: '有记录，但 token、费用或命中率明显不对',
  },
  {
    id: 'other',
    label: '其他问题',
    hint: '上面都不符合，我在下面说明',
  },
];

export function isFeedbackProblem(value: unknown): value is FeedbackProblem {
  return value === 'not-recorded' || value === 'wrong-data' || value === 'other';
}

/** 反馈指向的目标（来自历史页健康提示） */
export interface FeedbackTarget {
  signalKey?: string | null;
  kind?: string | null;
  at?: number | null;
  detail?: string | null;
  model?: string | null;
  reason?: string | null;
  /** 归因签名（插件报错用它区分是哪一种错误） */
  signature?: string | null;
  requestId?: string | null;
  tapId?: string | null;
  historyTimestamp?: number | null;
}

function clip(value: unknown, limit: number): string {
  const text = String(value ?? '');
  return text.length <= limit ? text : text.slice(0, limit);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** 最近若干条历史记录的摘要：只给排查要用的数字与标签，不含消息正文 */
export function historyDigest(limit: number = FEEDBACK_HISTORY_LIMIT): Array<Record<string, unknown>> {
  let list: any[] = [];
  try {
    list = Array.isArray(state.history) ? state.history : [];
  } catch {
    return [];
  }
  return list
    .slice()
    .sort((a, b) => num(b?.timestamp) - num(a?.timestamp))
    .slice(0, limit)
    .map((entry) => entryDigest(entry));
}

function usageNumbersOf(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, number> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 24) break;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    out[clip(key, 40)] = n;
    count += 1;
  }
  return count ? out : null;
}

/**
 * 单条历史记录的详细摘要：除常规数字外，还带本轮「记录状态」相关字段
 * （估算 / 中断 / 模型名兜底 / 估算方法），这是排查记录问题的核心证据。
 */
export function entryDigest(entry: any): Record<string, unknown> {
  return {
    timestamp: num(entry?.timestamp),
    model: clip(entry?.model, 120),
    rawModel: clip(entry?.rawModel, 120),
    prompt_tokens: num(entry?.prompt_tokens),
    cache_hit_tokens: num(entry?.cache_hit_tokens),
    cache_miss_tokens: num(entry?.cache_miss_tokens),
    completion_tokens: num(entry?.completion_tokens),
    total_tokens: num(entry?.total_tokens),
    cost: num(entry?.cost),
    duration: num(entry?.duration),
    tokenRate: num(entry?.tokenRate),
    ttft: num(entry?.ttft),
    thinkTime: num(entry?.thinkTime),
    thinkTokens: num(entry?.thinkTokens),
    streamed: entry?.streamed === null || entry?.streamed === undefined ? null : bool(entry.streamed),
    finishReason: clip(entry?.finishReason, 60) || null,
    isTruncated: bool(entry?.isTruncated),
    chatId: clip(entry?.chatId, 120),
    sourceType: clip(entry?.sourceType, 40),
    endpointLabel: clip(entry?.endpointLabel, 120),
    credentialLabel: clip(entry?.credentialLabel, 80),
    pricingSource: clip(entry?.pricingSource, 40),
    usageSource: clip(entry?.usageSource, 20) || null,
    interrupted: clip(entry?.interrupted, 20) || null,
    interruptReason: clip(entry?.interruptReason, 200) || null,
    modelFallback: bool(entry?.modelFallback) || undefined,
    estimateMethod: clip(entry?.estimateMethod, 60) || null,
    estimateVersion: entry?.estimateVersion == null ? null : num(entry.estimateVersion),
    promptChars: entry?.promptChars == null ? null : num(entry.promptChars),
    outputChars: entry?.outputChars == null ? null : num(entry.outputChars),
    estimateCacheUnknown: bool(entry?.estimateCacheUnknown) || undefined,
    costEstimated: bool(entry?.costEstimated) || undefined,
    raw_usage: usageNumbersOf(entry?.raw_usage),
  };
}

/** 在热历史里定位目标记录：优先 historyTimestamp，其次时间戳最接近的 ±5 秒内一条 */
function findTargetEntry(target: FeedbackTarget | null): { entry: any; index: number } | null {
  let list: any[] = [];
  try {
    list = Array.isArray(state.history) ? state.history : [];
  } catch {
    return null;
  }
  if (!list.length) return null;
  if (target?.historyTimestamp) {
    const hit = list.findIndex((entry) => num(entry?.timestamp) === num(target.historyTimestamp));
    if (hit >= 0) return { entry: list[hit], index: hit };
  }
  if (target?.at) {
    let best = -1;
    let bestGap = Number.POSITIVE_INFINITY;
    for (let i = 0; i < list.length; i += 1) {
      const gap = Math.abs(num(list[i]?.timestamp) - num(target.at));
      if (gap < bestGap) { bestGap = gap; best = i; }
    }
    if (best >= 0 && bestGap <= 5000) return { entry: list[best], index: best };
  }
  return null;
}

/** 目标记录 + 前后各一条（判断是否单点问题，还是整段都记错） */
export function historyEvidence(target: FeedbackTarget | null): Record<string, unknown> {
  const hit = findTargetEntry(target);
  if (!hit) return { target: null, before: null, after: null };
  const list = state.history as any[];
  return {
    target: entryDigest(hit.entry),
    before: hit.index > 0 ? entryDigest(list[hit.index - 1]) : null,
    after: hit.index + 1 < list.length ? entryDigest(list[hit.index + 1]) : null,
  };
}

/** 目标探针 + 同簇（同 purposeKey/actorLabel）几条：判断「整类请求都没记账」 */
export function tapEvidence(target: FeedbackTarget | null): {
  target: Record<string, unknown> | null;
  cluster: Array<Record<string, unknown>>;
} {
  let list: any[] = [];
  try {
    list = listTapRecords();
  } catch {
    return { target: null, cluster: [] };
  }
  if (!list.length) return { target: null, cluster: [] };
  let hit: any = null;
  if (target?.tapId) hit = list.find((rec) => rec?.id === target.tapId) || null;
  if (!hit && target?.at) {
    let best: any = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const rec of list) {
      const gap = Math.abs(num(rec?.at) - num(target.at));
      if (gap < bestGap) { bestGap = gap; best = rec; }
    }
    if (best && bestGap <= 60_000) hit = best;
  }
  const clusterKey = hit ? clip(hit.purposeKey, 80) + "|" + clip(hit.actorLabel, 80) : "";
  const cluster = clusterKey
    ? list
        .filter((rec) => clip(rec?.purposeKey, 80) + "|" + clip(rec?.actorLabel, 80) === clusterKey)
        .sort((a, b) => num(b?.at) - num(a?.at))
        .slice(0, EVIDENCE_TAP_LIMIT)
        .map((rec) => ({
          id: clip(rec?.id, 40),
          at: num(rec?.at),
          settledBy: clip(rec?.settledBy, 60),
          status: num(rec?.status),
          usage: rec?.usage
            ? {
                prompt: num(rec.usage.prompt),
                completion: num(rec.usage.completion),
                total: num(rec.usage.total),
                hit: num(rec.usage.hit),
                miss: num(rec.usage.miss),
              }
            : null,
          error: clip(rec?.error, 200),
        }))
    : [];
  return {
    target: hit
      ? {
          id: clip(hit.id, 40),
          at: num(hit.at),
          endpoint: clip(hit.endpoint, 200),
          model: clip(hit.model, 120),
          purposeKey: clip(hit.purposeKey, 80),
          actorLabel: clip(hit.actorLabel, 120),
          state: clip(hit.state, 20),
          settledBy: clip(hit.settledBy, 60),
          messageCount: num(hit.messageCount),
          promptChars: num(hit.promptChars),
          usageMissing: bool(hit.usageMissing),
          error: clip(hit.error, 200),
        }
      : null,
    cluster,
  };
}

/** 目标时刻前后各 2 分钟的控制台条目（已脱敏） */
export function consoleEvidence(centerAt: number | null | undefined): Array<Record<string, unknown>> {
  let list: Array<{ at: number; level: string; text: string }> = [];
  try {
    list = listConsoleEntries(80);
  } catch {
    return [];
  }
  const center = num(centerAt) || 0;
  const rows = center
    ? list.filter((entry) => Math.abs(num(entry?.at) - center) <= EVIDENCE_CONSOLE_WINDOW_MS)
    : list;
  return rows.slice(0, 20).map((entry) => ({
    at: num(entry?.at),
    level: clip(entry?.level, 20),
    text: sanitizeText(clip(entry?.text, 600)),
  }));
}

/** 最近三轮对话摘要（正文可关）：快速看懂「当时在聊什么」 */
export function recentTurnsDigest(includeText: boolean): Array<Record<string, unknown>> {
  let list: Array<{ at: number; role: string; text: string; chars: number }> = [];
  try {
    list = readRecentTurns();
  } catch {
    return [];
  }
  return list.map((turn) => ({
    at: num(turn?.at),
    role: clip(turn?.role, 20),
    chars: num(turn?.chars),
    text: includeText ? clip(turn?.text, 400) : "",
  }));
}

/** 探针里最近若干条「其他请求」：orphan（现有逻辑没记过账）最值得看 */
export function tapDigest(limit: number = FEEDBACK_TAP_LIMIT): Array<Record<string, unknown>> {
  let list: any[] = [];
  try {
    list = listTapRecords();
  } catch {
    return [];
  }
  return list
    .slice()
    .sort((a, b) => num(b?.at) - num(a?.at))
    .slice(0, limit)
    .map((rec) => ({
      at: num(rec?.at),
      endedAt: num(rec?.endedAt),
      endpoint: clip(rec?.endpoint, 200),
      model: clip(rec?.model, 120),
      requestType: clip(rec?.requestType, 40),
      actorKind: clip(rec?.actorKind, 20),
      actorLabel: clip(rec?.actorLabel, 120),
      state: clip(rec?.state, 20),
      settledBy: clip(rec?.settledBy, 40),
      status: num(rec?.status),
      error: clip(rec?.error, 300),
      durationMs: num(rec?.durationMs),
      messageCount: num(rec?.messageCount),
      usage: rec?.usage
        ? {
            prompt: num(rec.usage.prompt),
            completion: num(rec.usage.completion),
            total: num(rec.usage.total),
            hit: num(rec.usage.hit),
            miss: num(rec.usage.miss),
          }
        : null,
    }));
}

/** 探针总数与状态分布：判断是「整轮都没记」还是「个别没记」 */
export function tapSummary(): Record<string, unknown> {
  let list: any[] = [];
  try {
    list = listTapRecords();
  } catch {
    return { total: 0, orphan: 0, settled: 0, pending: 0 };
  }
  let orphan = 0;
  let settled = 0;
  let pending = 0;
  for (const rec of list) {
    if (rec?.state === "orphan") orphan += 1;
    else if (rec?.state === "settled") settled += 1;
    else pending += 1;
  }
  return { total: list.length, orphan, settled, pending };
}

/** 设置摘要：白名单字段，绝不带出密钥、钱包配置与忽略列表 */
export function settingsDigest(): Record<string, unknown> {
  let settings: any = {};
  try {
    settings = state.settings || {};
  } catch {}
  let historyCount = 0;
  try {
    historyCount = Array.isArray(state.history) ? state.history.length : 0;
  } catch {}
  let walletCount = 0;
  try {
    walletCount = Array.isArray(state.wallets) ? state.wallets.length : 0;
  } catch {}
  return {
    appVersion: clip(APP_VERSION, 40),
    mobileCompatUi: settings.mobileCompatUi === true,
    theme: clip(settings.theme, 20),
    historyScope: clip(settings.historyScope, 20),
    historyCount,
    walletCount,
  };
}

/** 环境摘要：设备与视口，帮开发者判断是不是窄屏/移动端特有 */
export function envDigest(): Record<string, unknown> {
  const nav: any = (globalThis as any).navigator || {};
  let timeZone = '';
  try {
    timeZone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
  } catch {}
  const win: any = (globalThis as any).window || {};
  let mobile = false;
  try {
    mobile = mobileDeviceHint();
  } catch {}
  return {
    userAgent: clip(nav.userAgent, 300),
    platform: clip(nav.platform, 60),
    language: clip(nav.language, 20),
    timeZone,
    mobile,
    screenWidth: num(win.screen?.width),
    screenHeight: num(win.screen?.height),
    viewportWidth: num(win.innerWidth),
    viewportHeight: num(win.innerHeight),
    devicePixelRatio: num(win.devicePixelRatio, 1),
  };
}

/** 当前对话与角色：只取名字，不取聊天内容 */
export function conversationDigest(): Record<string, unknown> {
  const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
  let chatId = '';
  let character = '';
  let stVersion = '';
  let characterId = '';
  // 对话标识：ctx.chatId 在部分客户端/未保存对话时为空，逐级兜底
  try {
    chatId = String(ctx?.chatId || ctx?.chatMetadata?.chatId || ctx?.getCurrentChatId?.() || '');
  } catch {}
  // 角色名：name2 在没有角色卡/扩展上下文里可能是默认系统名，回落到角色表
  try {
    characterId = ctx?.characterId == null ? '' : String(ctx.characterId);
    character = String(ctx?.name2 || '');
    if (!character || character === 'SillyTavern System') {
      const fromList = characterId ? ctx?.characters?.[Number(characterId)]?.name : '';
      if (fromList) character = String(fromList);
    }
    if (!character) character = String(ctx?.characters?.[ctx?.characterId]?.name || '');
  } catch {}
  // 酒馆版本：不同版本把版本放在对象或字符串上，逐级兜底
  try {
    const v = ctx?.version;
    stVersion = String(
      (v && typeof v === 'object' ? v.pkgVersion || v.commit || v.version : v) || '',
    );
  } catch {}
  let extensionKeys: string[] = [];
  try {
    extensionKeys = Object.keys(ctx?.extensionSettings || {}).slice(0, 40);
  } catch {}
  return {
    chatId: clip(chatId, 160),
    character: clip(character, 120),
    characterId: clip(characterId, 40),
    isGroup: ctx?.groupId != null || undefined,
    stVersion: clip(stVersion, 40),
    extensionKeys,
  };
}

/** 控制台最近报错（已脱敏），排查「没记录」时最直接的线索 */
export function consoleDigest(limit: number = FEEDBACK_CONSOLE_LIMIT): Array<Record<string, unknown>> {
  let list: Array<{ at: number; level: string; text: string }> = [];
  try {
    list = listConsoleEntries(limit);
  } catch {
    return [];
  }
  return list.map((entry) => ({
    at: num(entry?.at),
    level: clip(entry?.level, 20),
    text: sanitizeText(clip(entry?.text, 600)),
  }));
}

/**
 * 扩展清单：只取名称 / 版本 / 类型，用来判断是哪个扩展发的请求。
 * 走酒馆自己的发现接口，失败（离线、跨域、旧版本）就返回空数组，绝不影响上传。
 */
export async function extensionDigest(timeoutMs = 3000): Promise<Array<Record<string, unknown>>> {
  const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
  const fetchImpl = (globalThis as any).fetch;
  if (typeof fetchImpl !== 'function') return [];
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(500, timeoutMs)) : null;
  try {
    let headers: Record<string, string> = {};
    try {
      headers = ctx?.getRequestHeaders?.() || {};
    } catch {}
    const res = await fetchImpl("/api/extensions/discover", {
      method: "GET",
      headers,
      signal: controller ? controller.signal : undefined,
    });
    if (!res || !res.ok) return [];
    const data = await res.json();
    const rows: any[] = Array.isArray(data) ? data : Array.isArray(data?.extensions) ? data.extensions : [];
    const out: Array<Record<string, unknown>> = [];
    for (const item of rows.slice(0, 60)) {
      if (typeof item === "string") {
        out.push({ name: clip(item, 120), version: '', type: '' });
        continue;
      }
      const name = clip(item?.name || item?.display_name || '', 120);
      if (!name) continue;
      out.push({
        name,
        version: clip(item?.version || '', 40),
        type: clip(item?.type || '', 20),
        enabled: item?.enabled === false ? false : true,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface FeedbackPack {
  kind: "aus_request_log";
  schema: number;
  appVersion: string;
  uploadedAt: number;
  report: {
    problem: FeedbackProblem;
    note: string;
    scope: FeedbackScope;
    /** 只点名一条时的目标（scope=single），多条时为 null，保证旧解析器仍能读到单条场景 */
    target: FeedbackTarget | null;
    /** 逐条点名的目标列表（scope=single 时为一条，all 时为多条，recent 时为空数组） */
    targets: FeedbackTarget[];
    /** 实际想点名的条数（可能大于 targets.length，超出部分只计数） */
    targetTotal: number;
  };
  client: { userAgent: string; timeZone: string; language: string };
  record: Record<string, unknown> | null;
  diagnostics: Record<string, unknown>;
}

/**
 * 组装完整反馈包。record 允许为空（用户还没发过请求，但仍想反馈别的问题）。
 * - target：历史提示「上传这一条」指的那一轮；
 * - targets：历史提示「上传反馈日志」时提示条里列出的每一条，逐条点名；
 * 两者都传时以 targets 为准（target 作为单元素兜底）。
 * 所有文本最后统一过一遍 sanitizeJson，防止控制台文本或扩展名里夹带密钥。
 */
export async function buildFeedbackPack(input: {
  problem: FeedbackProblem;
  note?: string;
  appVersion?: string;
  record?: RequestLogRecord | null;
  target?: FeedbackTarget | null;
  targets?: FeedbackTarget[] | null;
  includeConversation?: boolean;
  now?: number;
}): Promise<FeedbackPack> {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const nav: any = (globalThis as any).navigator || {};
  let timeZone = '';
  try {
    timeZone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
  } catch {}
  const problem: FeedbackProblem = isFeedbackProblem(input.problem) ? input.problem : "other";
  const note = clip(input.note, FEEDBACK_NOTE_LIMIT);
  // 目标列表：targets 优先，单 target 兜底；去掉空值后限制条数，超出的只计数
  const incoming = Array.isArray(input.targets) && input.targets.length ? input.targets : input.target ? [input.target] : [];
  const normalized = incoming
    .map((item) => normalizeTarget(item))
    .filter((item): item is FeedbackTarget => !!item);
  const targetTotal = normalized.length;
  const targets = normalized.slice(0, FEEDBACK_TARGET_LIMIT);
  const single = targets.length === 1 ? targets[0] : null;
  const scope: FeedbackScope = targetTotal > 1 ? "all" : targetTotal === 1 ? "single" : "recent";
  const includeConversation = input.includeConversation !== false;
  const record = input.record ? sanitizeLogForUpload(input.record as any) : null;
  let extensions: Array<Record<string, unknown>> = [];
  try {
    extensions = await extensionDigest();
  } catch {}
  const logAt = record ? num((record as any).at) : null;
  // 每条目标各自配一份「现场证据」：目标记录 + 前后各一条历史、同簇探针、前后 2 分钟控制台
  const items = targets.map((item) => ({
    signal: item,
    request: { requestId: item.requestId || null, logAt },
    history: historyEvidence(item),
    tap: tapEvidence(item),
    console: consoleEvidence(item.at || now),
  }));
  const first = items[0] || {
    signal: null,
    request: { requestId: null, logAt },
    history: { target: null, before: null, after: null },
    tap: { target: null, cluster: [] },
    console: consoleEvidence(now),
  };
  const evidence = {
    scope,
    targetTotal,
    sampleLimit: FEEDBACK_TARGET_LIMIT,
    // 顶层字段保持单目标时的旧结构与含义（第一条），新增 items 存放全部目标
    signal: first.signal,
    request: first.request,
    history: first.history,
    tap: first.tap,
    console: first.console,
    items,
    recentTurns: recentTurnsDigest(includeConversation),
  };
  const diagnostics = sanitizeJson({
    history: historyDigest(),
    capture: captureDigest(),
    tap: tapDigest(),
    tapSummary: tapSummary(),
    console: consoleDigest(),
    settings: settingsDigest(),
    env: envDigest(),
    conversation: conversationDigest(),
    extensions,
    evidence,
  }) as Record<string, unknown>;
  return {
    kind: "aus_request_log",
    schema: FEEDBACK_SCHEMA,
    appVersion: clip(input.appVersion || APP_VERSION, 40),
    uploadedAt: now,
    report: { problem, note, scope, target: single, targets, targetTotal },
    client: {
      userAgent: clip(nav.userAgent, 300),
      timeZone,
      language: clip(nav.language, 20),
    },
    record: (record as unknown as Record<string, unknown>) || null,
    diagnostics,
  };
}

/** 只保留已知字段并裁掉空值，避免把 DOM 对象或事件对象整包塞进上报体 */
function normalizeTarget(target: FeedbackTarget | null | undefined): FeedbackTarget | null {
  if (!target || typeof target !== "object") return null;
  const out: FeedbackTarget = {};
  const put = (key: keyof FeedbackTarget, value: unknown, limit: number) => {
    if (value == null) return;
    const text = clip(value, limit).trim();
    if (!text) return;
    (out as any)[key] = text;
  };
  put("signalKey", (target as any).signalKey, 200);
  put("kind", (target as any).kind, 40);
  put("detail", (target as any).detail, 400);
  put("model", (target as any).model, 120);
  put("reason", (target as any).reason, 200);
  put("signature", (target as any).signature, 120);
  put("requestId", (target as any).requestId, 120);
  put("tapId", (target as any).tapId, 60);
  if (Number.isFinite(Number((target as any).at)) && Number((target as any).at) > 0) out.at = Number((target as any).at);
  if (Number.isFinite(Number((target as any).historyTimestamp)) && Number((target as any).historyTimestamp) > 0) {
    out.historyTimestamp = Number((target as any).historyTimestamp);
  }
  return Object.keys(out).length ? out : null;
}
