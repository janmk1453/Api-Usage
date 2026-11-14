import { log } from '../utils/logger';

/**
 * 「上游没给用量」诊断记录
 *
 * 为什么需要：有些接入（尤其是部分中转的流式接口）响应里完全没有 usage，
 * 既没有 token 也没有费用。扩展拿不到任何数字就无法写历史记录——
 * 以前这是**静默丢弃**，用户看到的就是「对话发生了，但历史页里没有」。
 * 这里把「丢弃了一次」这件事本身记下来，供统计页显式提示。
 *
 * 只做诊断，不进 settings、不参与导出、不参与任何统计口径。
 */

export type MissingUsageReason = 'no-usage' | 'zero-usage';

export interface MissingUsageInput {
  model?: string | null;
  endpointLabel?: string | null;
  sourceType?: string | null;
  reason: MissingUsageReason;
  stream?: boolean | null;
  status?: number | null;
  /** 请求唯一标识（扩展内部 requestId 或任意稳定键），用于精确去重 */
  requestKey?: string | null;
  at?: number;
}

export interface MissingUsageRecord {
  id: string;
  at: number;
  model: string;
  endpointLabel: string;
  sourceType: string;
  reason: MissingUsageReason;
  stream: boolean | null;
  status: number | null;
  requestKey: string | null;
}

export interface MissingUsageSummaryRow {
  model: string;
  endpointLabel: string;
  count: number;
  lastAt: number;
  reasons: MissingUsageReason[];
}

export interface MissingUsageSummary {
  total: number;
  rows: MissingUsageSummaryRow[];
}

export const MISSING_USAGE_KEY = 'aus_missing_usage_v1';
/** 环形缓冲上限：只保留最近这么多条，够说明问题又不至于把 localStorage 撑大 */
export const MISSING_USAGE_MAX = 120;
/** 同一次请求可能被 fetch 捕获与生成结束事件各记一次，这个窗口内视为同一条 */
export const MISSING_USAGE_DEDUPE_MS = 6000;
/** 提示只看最近 7 天，久到想不起来的老记录不再打扰 */
export const MISSING_USAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const MISSING_USAGE_UNKNOWN_MODEL = '未知模型';
export const MISSING_USAGE_UNKNOWN_ENDPOINT = '未记录接入';

function cleanText(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

export function missingUsageId(model: string, endpointLabel: string, at: number): string {
  return `${model}|${endpointLabel}|${Math.floor(at / MISSING_USAGE_DEDUPE_MS)}`;
}

/**
 * 追加一条诊断记录（纯函数，返回新数组）：
 * - 同一 requestKey 已存在 → 跳过
 * - 同模型 + 同接入且时间差在 dedupeMs 内 → 视为同一次请求，跳过
 */
export function appendMissingUsage(
  records: MissingUsageRecord[],
  record: MissingUsageRecord,
  dedupeMs: number = MISSING_USAGE_DEDUPE_MS,
  max: number = MISSING_USAGE_MAX,
): MissingUsageRecord[] {
  const list = Array.isArray(records) ? records : [];
  const duplicate = list.some((item) => {
    // 双方都有请求号时，请求号就是唯一身份：不同请求号即使同模型同时刻也算两条
    if (record.requestKey && item.requestKey) return item.requestKey === record.requestKey;
    // 否则退回「同模型 + 同接入 + 时间窗」的近似判定
    if (item.model !== record.model || item.endpointLabel !== record.endpointLabel) return false;
    return Math.abs(item.at - record.at) < dedupeMs;
  });
  if (duplicate) return list;
  const next = [...list, record].sort((a, b) => a.at - b.at);
  return next.length > max ? next.slice(next.length - max) : next;
}

/** 按模型 + 接入聚合成提示用的摘要（纯函数） */
export function summarizeMissingUsage(
  records: MissingUsageRecord[],
  now: number = Date.now(),
  windowMs: number = MISSING_USAGE_WINDOW_MS,
): MissingUsageSummary {
  const list = (Array.isArray(records) ? records : []).filter(
    (item) => item && typeof item.at === 'number' && now - item.at <= windowMs,
  );
  const map = new Map<string, MissingUsageSummaryRow>();
  for (const item of list) {
    const key = `${item.model}|${item.endpointLabel}`;
    const row = map.get(key);
    if (!row) {
      map.set(key, {
        model: item.model,
        endpointLabel: item.endpointLabel,
        count: 1,
        lastAt: item.at,
        reasons: [item.reason],
      });
      continue;
    }
    row.count += 1;
    if (item.at > row.lastAt) row.lastAt = item.at;
    if (!row.reasons.includes(item.reason)) row.reasons.push(item.reason);
  }
  const rows = [...map.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
  return { total: list.length, rows };
}

function readStore(): MissingUsageRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(MISSING_USAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: any) =>
        item && typeof item.at === 'number' && typeof item.model === 'string' && typeof item.endpointLabel === 'string',
    );
  } catch {
    return [];
  }
}

let writeTimer: any = null;
let pendingRecords: MissingUsageRecord[] | null = null;
function writeStore(records: MissingUsageRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MISSING_USAGE_KEY, JSON.stringify(records));
  } catch (e) {
    log.debug('写入未计量请求记录失败', (e as any)?.message || e);
  }
}

/** 内存缓存：节流写盘期间后续记录要接着累加，不能每次都从磁盘重读（否则会丢前一条） */
let cache: MissingUsageRecord[] | null = null;

function currentRecords(): MissingUsageRecord[] {
  if (!cache) cache = readStore();
  return cache;
}

export function getMissingUsageRecords(): MissingUsageRecord[] {
  return currentRecords();
}

/** 记录一次「上游没给用量」的请求；同一请求重复上报会被去重 */
export function noteMissingUsage(input: MissingUsageInput): void {
  try {
    const at = typeof input.at === 'number' ? input.at : Date.now();
    const model = cleanText(input.model, MISSING_USAGE_UNKNOWN_MODEL);
    const endpointLabel = cleanText(input.endpointLabel, MISSING_USAGE_UNKNOWN_ENDPOINT);
    const record: MissingUsageRecord = {
      id: missingUsageId(model, endpointLabel, at),
      at,
      model,
      endpointLabel,
      sourceType: cleanText(input.sourceType, ''),
      reason: input.reason === 'zero-usage' ? 'zero-usage' : 'no-usage',
      stream: typeof input.stream === 'boolean' ? input.stream : null,
      status: typeof input.status === 'number' ? input.status : null,
      requestKey: typeof input.requestKey === 'string' && input.requestKey ? input.requestKey : null,
    };
    cache = appendMissingUsage(currentRecords(), record);
    pendingRecords = cache;
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      const rows = pendingRecords;
      pendingRecords = null;
      if (rows) writeStore(rows);
    }, 240);
  } catch (e) {
    log.debug('记录未计量请求失败', (e as any)?.message || e);
  }
}

export function clearMissingUsage(): void {
  try {
    cache = [];
    pendingRecords = null;
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    if (typeof localStorage !== 'undefined') localStorage.removeItem(MISSING_USAGE_KEY);
  } catch (e) {
    log.debug('清空未计量请求记录失败', (e as any)?.message || e);
  }
}
