/**
 * 反馈诊断包：用户遇到「对话没被记录」或「记录数据不对」时，上传的不只是一条请求日志，
 * 而是一份能让开发者还原现场的最小诊断材料。
 *
 * 收集范围（只挑与排查有关的）：
 * - record：请求日志页当前那条记录，含请求正文（已脱敏）；
 * - report：用户选的问题类型 + 自己的文字描述（最先看这个）；
 * - diagnostics：最近历史记录摘要（不含正文）、探针「其他请求」摘要、
 *   控制台最近报错、扩展清单、设置与环境摘要、当前对话与角色名。
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
import type { RequestLogRecord } from './request-log';

/** 用户描述上限 */
export const FEEDBACK_NOTE_LIMIT = 2000;
/** 历史摘要条数 */
export const FEEDBACK_HISTORY_LIMIT = 10;
/** 探针摘要条数 */
export const FEEDBACK_TAP_LIMIT = 20;
/** 控制台摘要条数 */
export const FEEDBACK_CONSOLE_LIMIT = 40;
/** 反馈体版本：2 起带 report / diagnostics */
export const FEEDBACK_SCHEMA = 2;

export type FeedbackProblem = 'not-recorded' | 'wrong-data' | 'other';

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

function clip(value: unknown, limit: number): string {
  const text = String(value ?? '');
  return text.length <= limit ? text : text.slice(0, limit);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    .map((entry) => ({
      timestamp: num(entry?.timestamp),
      model: clip(entry?.model, 120),
      prompt_tokens: num(entry?.prompt_tokens),
      completion_tokens: num(entry?.completion_tokens),
      total_tokens: num(entry?.total_tokens),
      cache_hit_tokens: num(entry?.cache_hit_tokens),
      cost: num(entry?.cost),
      sourceType: clip(entry?.sourceType, 40),
      endpointLabel: clip(entry?.endpointLabel, 120),
      credentialLabel: clip(entry?.credentialLabel, 80),
      chatId: clip(entry?.chatId, 120),
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
    if (rec?.state === 'orphan') orphan += 1;
    else if (rec?.state === 'settled') settled += 1;
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
    timeZone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
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
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(500, timeoutMs)) : null;
  try {
    let headers: Record<string, string> = {};
    try {
      headers = ctx?.getRequestHeaders?.() || {};
    } catch {}
    const res = await fetchImpl('/api/extensions/discover', {
      method: 'GET',
      headers,
      signal: controller ? controller.signal : undefined,
    });
    if (!res || !res.ok) return [];
    const data = await res.json();
    const rows: any[] = Array.isArray(data) ? data : Array.isArray(data?.extensions) ? data.extensions : [];
    const out: Array<Record<string, unknown>> = [];
    for (const item of rows.slice(0, 60)) {
      if (typeof item === 'string') {
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
  kind: 'aus_request_log';
  schema: number;
  appVersion: string;
  uploadedAt: number;
  report: { problem: FeedbackProblem; note: string };
  client: { userAgent: string; timeZone: string; language: string };
  record: Record<string, unknown> | null;
  diagnostics: Record<string, unknown>;
}

/**
 * 组装完整反馈包。record 允许为空（用户还没发过请求，但仍想反馈别的问题）。
 * 所有文本最后统一过一遍 sanitizeJson，防止控制台文本或扩展名里夹带密钥。
 */
export async function buildFeedbackPack(input: {
  problem: FeedbackProblem;
  note?: string;
  appVersion?: string;
  record?: RequestLogRecord | null;
  now?: number;
}): Promise<FeedbackPack> {
  const now = typeof input.now === 'number' ? input.now : Date.now();
  const nav: any = (globalThis as any).navigator || {};
  let timeZone = '';
  try {
    timeZone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  } catch {}
  const problem: FeedbackProblem = isFeedbackProblem(input.problem) ? input.problem : 'other';
  const note = clip(input.note, FEEDBACK_NOTE_LIMIT);
  const record = input.record ? sanitizeLogForUpload(input.record as any) : null;
  let extensions: Array<Record<string, unknown>> = [];
  try {
    extensions = await extensionDigest();
  } catch {}
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
  }) as Record<string, unknown>;
  return {
    kind: 'aus_request_log',
    schema: FEEDBACK_SCHEMA,
    appVersion: clip(input.appVersion || APP_VERSION, 40),
    uploadedAt: now,
    report: { problem, note },
    client: {
      userAgent: clip(nav.userAgent, 300),
      timeZone,
      language: clip(nav.language, 20),
    },
    record: (record as unknown as Record<string, unknown>) || null,
    diagnostics,
  };
}
