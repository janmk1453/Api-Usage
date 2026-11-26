/**
 * 统一仓库 — 单一历史的唯一 储存/调用/修改 入口
 * 已废弃多存档，所有数据归一至 state.history + 聚合字段
 */
import { state, getSelectedSave } from '../store/index';
import { saveHot, loadHot, loadHistoryCold, appendHistoryCold, getAllHistory, saveHistoryCold, clearHistoryCold } from '../store/persistence';
import { calcCost, isDeepSeekOfficialModel, normalizeModel } from '../services/pricing';
import { getWalletExchangeRate } from '../services/currency';
import { MAX_HISTORY, DETAIL_KEEP, PRICING } from '../constants/pricing';
import { emit, DataEvents } from './events';
import type { Snapshot } from './types';
import { defaultSettings } from '../types/settings';
import { isUnsafeKey, isValidDayKey, localDay } from '../utils/date';
import { isTruncatedFinish, isTruncatedOf } from '../utils/finish';
import { log, toast } from '../utils/logger';
import { turnFingerprint, usageFingerprint, messageDigest } from './fingerprint';
import { clearDetailStore, deleteDetail } from './detail-store';
import { mobileDeviceHint } from '../utils/device';
import { computeTokenRate, estimateTokenRate, measureTokenRate, normalizeTtft, sanitizeHistoryTiming, sanitizeRate, type RateEstimateSource } from './token-rate';
import { normalizeConnectionEndpoint, type HistoryConnection } from '../services/connection-identity';
import {
  createDeepSeekWallet,
  createWalletFromConnection,
  cloneWalletPriceRule,
  ensureDeepSeekWallet,
  findWalletForConnection,
  findWalletForHistory,
  findExactPricedModelMatch,
  findWalletModel,
  normalizeWalletPriceRule,
  normalizeWallets,
  observeCredential,
  observeModel,
  walletIdForEndpoint,
  isDeepSeekOfficialConnection,
} from './wallets';
import { DEEPSEEK_WALLET_ID, type WalletConfig } from '../types/wallet';
import { migrateLegacyWalletApiKey } from '../services/wallet-secrets';
import { historyRecordKey } from '../utils/history-key';
import type { AgentRunEntryInput } from '../types/agent';
import type { EntryMeta } from '../types/save';

function getCurrentChatId(): string | null {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.getCurrentChatId) {
      const v = ctx.getCurrentChatId();
      if (typeof v === 'string' && v) return v;
    }
    // 兼容：直接取 characters[this_chid]?.chat
    const chid = (globalThis as any).this_chid;
    const chars = (globalThis as any).characters;
    if (typeof chid === 'number' && Array.isArray(chars) && chars[chid]) {
      const c = chars[chid].chat;
      if (typeof c === 'string' && c) return c;
    }
  } catch {}
  return null;
}

function getCurrentChatName(): string | null {
  const id = getCurrentChatId();
  return id ? String(id) : null;
}

const recentUsageFingerprints = new Map<string, number>();
/**
 * 第二代去重：按「模型 + 四元 token + 接入」算内容指纹。
 *
 * 轮次指纹认的是 requestId，前提是「一次请求只会被解析一次」。当宿主把 fetch 换成多层包装、
 * 每一层都解析同一个响应时，每层都会生成自己的 requestId，轮次指纹各不相同（3.2.3 出现过
 * 一次请求写 12 条历史）。此时唯一还能对上号的就是用量本身，所以这里再做一层内容去重兜底。
 */
const recentContentFingerprints = new Map<string, number>();
/** 去重窗口：fetch 侧与 GENERATION_ENDED 可能相隔十几秒（尤其慢速流式），按 15s 计 */
const TURN_DEDUPE_WINDOW_MS = 15_000;
/**
 * 内容去重窗口：只覆盖「同一次响应被多层包装各解析一遍」这种毫秒级重复。
 *
 * 不能复用 15s：内容指纹抹掉了 requestId 与起始时间，窗口越长，越容易把两次真实请求并成一条。
 * 多层包装的重复总是在同一次响应解析后紧挨着发生（实测相邻两条相隔 15ms），给 3s 足够宽。
 */
const CONTENT_DEDUPE_WINDOW_MS = 3_000;
/** 指纹表保留时长：只需覆盖去重窗口，超出即回收 */
const TURN_FINGERPRINT_TTL_MS = 60_000;
let storageFailureNotified = false;

/**
 * 一轮记录的速率取值（单一来源）：能测就测，测不出（非流式 / 假流式 / 首字缺失）
 * 才用估算，并记下估算口径，UI 据此加「估算」标注。
 * 估算口径与实测一致：输出 Token（含思维链）÷（总耗时 − 首字延迟），首字不可信时首字记 0。
 */
function resolveTokenRate(params: {
  duration: number;
  ttft: number;
  completionTokens: number;
  streamed: boolean | null;
}): { rate: number; estimated: RateEstimateSource | null } {
  const measured = measureTokenRate({
    duration: params.duration,
    ttft: params.ttft,
    completion_tokens: params.completionTokens,
    streamed: params.streamed,
  });
  if (measured != null) return { rate: sanitizeRate(measured), estimated: null };
  const estimate = estimateTokenRate({
    duration: params.duration,
    completionTokens: params.completionTokens,
    ttft: params.ttft,
  });
  if (!estimate) return { rate: 0, estimated: null };
  return { rate: estimate.rate, estimated: estimate.source };
}

/** 把重算结果写回条目（r 为 null 表示这项已不可估算，保留原值） */
function applyRateTo(target: any, r: { rate: number; estimated: RateEstimateSource | null }): boolean {
  if (!target) return false;
  let changed = false;
  if (Number(target.tokenRate) !== r.rate) { target.tokenRate = r.rate; changed = true; }
  if (r.estimated) {
    if (target.rateEstimated !== r.estimated) { target.rateEstimated = r.estimated; changed = true; }
  } else if (target.rateEstimated !== undefined) {
    delete target.rateEstimated;
    changed = true;
  }
  return changed;
}

/**
 * 迁移：给「测不到真实速率」的历史条目补估算值 —— 明确非流式的记录，
 * 以及流式但首字延迟缺失/被清洗成 0 的记录（假流式、旧数据）。
 *
 * 旧版本把这类记录的速率一律写成 0，升级后它们应显示估算速率（UI 标「估算」）。
 * 幂等：已有速率或已标过估算口径的条目一律跳过，避免反复改写历史。
 */
function backfillEstimatedRates(list: any[]): boolean {
  let changed = false;
  for (const h of list || []) {
    if (!h || typeof h !== 'object') continue;
    if (Number(h.tokenRate) > 0) continue;
    if ((h as any).rateEstimated) continue;
    // Agent 记录的耗时是整个 run 的墙钟，不是单次生成的窗口，估出来没有意义
    if ((h as any).origin === 'agent') continue;
    // 只补测不到首字的条目；有可信 TTFT 却没速率的，多半是数据异常，不去猜
    const ttft = Number((h as any).ttft);
    if ((h as any).streamed !== false && Number.isFinite(ttft) && ttft > 0) continue;
    const duration = Number(h.duration) || 0;
    const comp = Number(h.completion_tokens) || 0;
    if (duration <= 0 || comp <= 0) continue;
    const estimate = estimateTokenRate({ duration, completionTokens: comp, ttft });
    if (!estimate) continue;
    h.tokenRate = estimate.rate;
    h.rateEstimated = estimate.source;
    changed = true;
  }
  return changed;
}

/** 同轮重复落库的判定窗口：多层包装各解析一次时，落库时间通常只差几毫秒 */
const DEDUPE_TURN_WINDOW_MS = 1500;

/** 重复条目备份键：清理是破坏性操作，先留一份可回溯的副本 */
const DEDUPE_BACKUP_KEY = 'aus_dedupe_backup_v1';
const DEDUPE_BACKUP_MAX = 200;

function backupDroppedTurns(rows: any[]): void {
  if (!rows.length) return;
  try {
    const prev = JSON.parse(localStorage.getItem(DEDUPE_BACKUP_KEY) || '[]');
    const list = Array.isArray(prev) ? prev : [];
    localStorage.setItem(DEDUPE_BACKUP_KEY, JSON.stringify(list.concat(rows).slice(-DEDUPE_BACKUP_MAX)));
  } catch {}
}

/**
 * 迁移：删掉「一次请求被多层 fetch 包装各写一遍」时期留下的同轮重复条目。
 *
 * 判据是「同一对话 + 同一模型 + 三段 Token 与缓存命中数完全相同 + 落库时间相差 <1.5s」——
 * 真实的两轮请求不可能连缓存命中数都分毫不差，所以这个组合足够安全；
 * 重复组里保留先遍历到的那条，其余进备份。
 */
export function dropDuplicateTurns(list: any[]): { kept: any[]; removed: any[] } {
  const kept: any[] = [];
  const removed: any[] = [];
  const seen = new Map<string, number>();
  for (const h of list || []) {
    if (!h || typeof h !== 'object') { kept.push(h); continue; }
    const ts = Number(h.timestamp) || 0;
    const total = Number(h.total_tokens) || 0;
    if (ts > 0 && total > 0) {
      const hit = Number((h as any).cache_hit_tokens ?? (h as any).prompt_cache_hit_tokens) || 0;
      const key = [String((h as any).chatId || ''), String(h.model || ''), Number(h.prompt_tokens) || 0, hit, Number(h.completion_tokens) || 0, total].join('|');
      const prev = seen.get(key);
      if (prev !== undefined && Math.abs(ts - prev) <= DEDUPE_TURN_WINDOW_MS) { removed.push(h); continue; }
      seen.set(key, ts);
    }
    kept.push(h);
  }
  return { kept, removed };
}

/** 只把已定义的元信息字段写到条目上，避免到处出现 undefined 键 */
function applyEntryMeta(target: any, meta: EntryMeta | null | undefined): void {
  if (!target || !meta || typeof meta !== 'object') return;
  const keys = [
    'usageSource',
    'interrupted',
    'interruptReason',
    'modelFallback',
    'estimateMethod',
    'estimateVersion',
    'promptChars',
    'outputChars',
    'estimateCacheUnknown',
    'costEstimated',
    'requestOrigin',
  ] as const;
  for (const key of keys) {
    const value = (meta as any)[key];
    if (value !== undefined) target[key] = value;
  }
}

/**
 * 估算条目升级为真实用量：token 与费用都要换掉，聚合值与钱包余额按差额修正。
 * 只由去重命中时调用，调用方负责 persist()。
 */
function replaceEstimatedEntry(
  head: any,
  params: {
    hit: number;
    miss: number;
    comp: number;
    total: number;
    usage: any;
    fr: string | null;
    connection: HistoryConnection | null;
    wallet: WalletConfig | null;
    model: string;
  },
): boolean {
  try {
    if (!head) return false;
    const prevTotal = Number(head.total_tokens) || 0;
    const prevHit = Number(head.cache_hit_tokens) || 0;
    const prevMiss = Number(head.cache_miss_tokens) || 0;
    const prevComp = Number(head.completion_tokens) || 0;
    const prevCost = Number(head.cost) || 0;
    const prevInputCost = Number(head.input_cost) || 0;
    const prevOutputCost = Number(head.output_cost) || 0;
    const cost: any = calcCost(
      {
        timestamp: Number(head.timestamp) || Date.now(),
        model: params.model,
        prompt_cache_hit_tokens: params.hit,
        prompt_cache_miss_tokens: params.miss,
        completion_tokens: params.comp,
      },
      state.settings as any,
      params.wallet as any,
    );
    head.prompt_tokens = params.hit + params.miss;
    head.cache_hit_tokens = params.hit;
    head.cache_miss_tokens = params.miss;
    head.completion_tokens = params.comp;
    head.total_tokens = params.total;
    head.cache_hit_rate = params.hit + params.miss > 0 ? (params.hit / (params.hit + params.miss)) * 100 : 0;
    head.cost = cost.total;
    head.input_cost = cost.input;
    head.output_cost = cost.output;
    head.priceType = cost.priceType;
    head.pricingSource = cost.source;
    head.usageSource = 'upstream';
    head.estimateMethod = null;
    head.estimateVersion = null;
    head.estimateCacheUnknown = false;
    head.costEstimated = false;
    if (params.usage) head.raw_usage = params.usage;
    if (params.fr) {
      head.finishReason = params.fr;
      head.isTruncated = isTruncatedOf({ finishReason: params.fr, interrupted: (head as any).interrupted });
    }
    if (params.wallet && !head.walletId) head.walletId = params.wallet.id;
    state.total_tokens += params.total - prevTotal;
    state.input_tokens += params.hit + params.miss - (prevHit + prevMiss);
    state.output_tokens += params.comp - prevComp;
    state.cache_hit_tokens += params.hit - prevHit;
    state.cache_miss_tokens += params.miss - prevMiss;
    state.total_cost += cost.total - prevCost;
    state.input_cost += cost.input - prevInputCost;
    state.output_cost += cost.output - prevOutputCost;
    // 余额此前只预扣了估算费用，这里把差额补回去（负差额即补扣）
    try {
      const wallet = params.wallet;
      if (wallet) {
        const current = wallet.balance.amount == null || wallet.balance.amount === ''
          ? NaN
          : parseFloat(String(wallet.balance.amount));
        if (Number.isFinite(current)) {
          const diff = prevCost - cost.total;
          const delta = wallet.balance.currency === 'USD' ? diff / getWalletExchangeRate() : diff;
          wallet.balance.amount = (current + delta).toFixed(4);
          wallet.updatedAt = Date.now();
        }
      }
    } catch {}
    return true;
  } catch {
    return false;
  }
}

/**
 * 同一轮被写了两次时补回耗时：先写的那条可能没拿到本轮起点（duration 落成 0），
 * 后到的写者知道真实起点，就把它补上并按同一口径重算速率 —— 否则这条记录会永久显示
 * 耗时 0 秒、速率 0，还会在历史页被当成「没记录到耗时」提示出来。
 */
export function backfillEntryDuration(head: any, startTime: number | null, now = Date.now()): boolean {
  if (!head || !startTime) return false;
  if (Number(head.duration) > 0) return false;
  const measured = now - startTime;
  if (!(measured > 0)) return false;
  head.duration = measured;
  applyRateTo(head, resolveTokenRate({
    duration: measured,
    ttft: normalizeTtft(measured, head.ttft),
    completionTokens: Number(head.completion_tokens) || 0,
    streamed: head.streamed ?? null,
  }));
  return true;
}

function notifyStorageFailure(error: unknown): void {
  log.error('冷历史写入失败', error);
  if (storageFailureNotified) return;
  storageFailureNotified = true;
  toast('warning', '冷历史写入失败，统计可能不完整；请检查浏览器存储空间');
}

/** 冷库读取失败的提示节流：一次故障会被多个页面同时触发，别刷屏 */
const COLD_READ_NOTIFY_INTERVAL_MS = 10 * 60 * 1000;
let coldReadNotifiedAt = 0;

/**
 * 冷库（IndexedDB）读不出来时的兜底提示。
 * 失败会被上层 catch（概览 / 统计 / 导出各自有 fallback），所以这里先主动说一句，
 * 否则用户只会看到「更早的记录不见了」却没有任何解释；历史页另有常驻告警条与重试入口。
 */
function notifyColdReadFailure(error: unknown): void {
  log.error('全量历史读取失败（含冷库）', error);
  const now = Date.now();
  if (coldReadNotifiedAt && now - coldReadNotifiedAt < COLD_READ_NOTIFY_INTERVAL_MS) return;
  coldReadNotifiedAt = now;
  toast('warning', `更早的历史记录没能读出来：列表与统计只含最近 ${MAX_HISTORY} 条，可在历史记录页重试`);
}

function numericPrice(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

function legacyCustomPriceRule(custom: any) {
  const normalized = normalizeModel(String(custom?.model || ''));
  const base: any = (PRICING as any)[normalized] || (PRICING as any)['deepseek-flash'];
  return normalizeWalletPriceRule({
    usePeakPricing: custom?.usePeakPricing !== false,
    offpeak: {
      hit: numericPrice(custom?.offpeak?.hit, base.offpeak.hit),
      miss: numericPrice(custom?.offpeak?.miss, base.offpeak.miss),
      output: numericPrice(custom?.offpeak?.output, base.offpeak.output),
    },
    peak: {
      hit: numericPrice(custom?.peak?.hit, base.peak.hit),
      miss: numericPrice(custom?.peak?.miss, base.peak.miss),
      output: numericPrice(custom?.peak?.output, base.peak.output),
    },
    priceConfigured: true,
  });
}

function migrateLegacyPricing(wallet: WalletConfig, customModels: any[]): boolean {
  if (wallet.legacyPricingImported) return false;
  const now = Date.now();
  for (const custom of customModels || []) {
    const sourceModel = String(custom?.model || '').trim();
    if (!sourceModel) continue;
    const existing = findWalletModel(wallet, sourceModel);
    const source = custom?.synced === true ? 'sync' as const : 'manual' as const;
    if (existing) {
      existing.price = legacyCustomPriceRule(custom);
      existing.source = source;
      existing.locked = false;
      existing.updatedAt = now;
    } else {
      wallet.models.push({
        id: `legacy:${sourceModel}`,
        sourceModel,
        model: sourceModel,
        aliases: [],
        price: legacyCustomPriceRule(custom),
        source,
        locked: false,
        discoveredAt: now,
        lastSeen: now,
        updatedAt: now,
      });
    }
  }
  wallet.legacyPricingImported = true;
  wallet.updatedAt = now;
  return true;
}

function migrateLegacyBalance(wallet: WalletConfig): boolean {
  if (wallet.balance.amount != null && String(wallet.balance.amount).trim() !== '') return false;
  const custom = state.customBalance != null && String(state.customBalance).trim() !== ''
    ? String(state.customBalance)
    : (state.balance?.balance != null ? String(state.balance.balance) : '');
  if (!custom) return false;
  wallet.balance.amount = custom;
  wallet.balance.currency = String(state.balance?.currency || '').toUpperCase() === 'USD' ? 'USD' : 'CNY';
  wallet.balance.mode = 'manual';
  wallet.balance.lastCalibrated = Number(state.balance?.timestamp) || null;
  wallet.updatedAt = Date.now();
  return true;
}

function historyConnection(entry: any): HistoryConnection | null {
  if (!entry || (!entry.endpointId && !entry.sourceType)) return null;
  return normalizeConnectionEndpoint({
    sourceType: entry.sourceType ?? null,
    endpointId: entry.endpointId ?? null,
    endpointLabel: entry.endpointLabel ?? null,
    credentialId: entry.credentialId ?? null,
    credentialLabel: entry.credentialLabel ?? null,
  });
}

function ensureWalletForConnection(
  wallets: WalletConfig[],
  ignored: Set<string>,
  connection: HistoryConnection | null,
  now = Date.now(),
): { wallet: WalletConfig | null; changed: boolean } {
  if (!connection || !connection.endpointId) return { wallet: null, changed: false };
  let wallet = findWalletForConnection(wallets, connection);
  let changed = false;
  if (!wallet) {
    const id = isDeepSeekOfficialConnection(connection)
      ? DEEPSEEK_WALLET_ID
      : walletIdForEndpoint(connection.endpointId);
    if (!id || ignored.has(id)) return { wallet: null, changed: false };
    const created = isDeepSeekOfficialConnection(connection)
      ? createDeepSeekWallet(state.settings, now)
      : createWalletFromConnection(connection, state.settings, now);
    if (!created) return { wallet: null, changed: false };
    wallets.push(created);
    wallet = created;
    changed = true;
  }
  // 只在钱包还没登记地址时补写：同一域名兜底匹配到的老钱包不能改写，
  // 否则同一个钱包的 endpointId 会随请求体在旧/新算法之间来回抖动，历史记录就对不上了。
  if (connection.endpointId && !wallet.endpointId && wallet.id !== DEEPSEEK_WALLET_ID) {
    wallet.endpointId = connection.endpointId;
    wallet.updatedAt = now;
    changed = true;
  }
  if (connection.endpointLabel) {
    const label = String(connection.endpointLabel).trim();
    if (label && (!wallet.endpointLabel || wallet.endpointLabel !== label)) {
      wallet.endpointLabel = label;
      wallet.endpointDisplay = label;
      if (!wallet.legacyPricingImported || wallet.name === wallet.endpointLabel) wallet.name = label;
      wallet.updatedAt = now;
      changed = true;
    }
  }
  if (observeCredential(wallet, connection.credentialId, connection.credentialLabel, now)) {
    wallet.updatedAt = now;
    changed = true;
  }
  return { wallet, changed };
}

function refreshBuiltinWalletModels(wallet: WalletConfig, now = Date.now()): boolean {
  if (wallet.id !== DEEPSEEK_WALLET_ID) return false;
  let changed = false;
  const defaults = createDeepSeekWallet(state.settings, wallet.createdAt || now);
  for (const builtin of defaults.models) {
    const existing = wallet.models.find((item) => item.sourceModel === builtin.sourceModel);
    if (!existing) {
      wallet.models.push(builtin);
      changed = true;
      continue;
    }
    if (existing.source !== 'builtin' || existing.locked) continue;
    if (JSON.stringify(existing.price) !== JSON.stringify(builtin.price)) {
      existing.price = builtin.price;
      existing.updatedAt = now;
      changed = true;
    }
  }
  return changed;
}

function migrateHistoryModels(entries: any[]): boolean {
  let changed = false;
  for (const entry of entries || []) {
    if (!entry || typeof entry.model !== 'string') continue;
    const normalized = normalizeModel(entry.model);
    if (normalized === entry.model) continue;
    if (entry.rawModel == null) entry.rawModel = entry.model;
    entry.model = normalized;
    changed = true;
  }
  return changed;
}

function mergeWalletConfiguration(
  duplicate: WalletConfig,
  target: WalletConfig,
  now = Date.now(),
): boolean {
  let changed = false;
  if ((target.balance.amount == null || String(target.balance.amount).trim() === '')
    && duplicate.balance.amount != null
    && String(duplicate.balance.amount).trim() !== '') {
    target.balance.amount = duplicate.balance.amount;
    target.balance.currency = duplicate.balance.currency;
    target.balance.mode = duplicate.balance.mode;
    target.balance.lastCalibrated = duplicate.balance.lastCalibrated;
    changed = true;
  }
  if (!target.balance.primaryCredentialId && duplicate.balance.primaryCredentialId) {
    target.balance.primaryCredentialId = duplicate.balance.primaryCredentialId;
    changed = true;
  }
  for (const credential of duplicate.credentials || []) {
    if (observeCredential(target, credential.id, credential.label, credential.lastSeen || now)) changed = true;
  }
  for (const model of duplicate.models || []) {
    if (!model.price?.priceConfigured || (model.source !== 'manual' && model.source !== 'sync')) continue;
    const existing = findWalletModel(target, model.sourceModel) || findWalletModel(target, model.model);
    if (!existing) {
      target.models.push({
        ...model,
        id: `legacy-official:${model.id}`,
        aliases: [...(model.aliases || [])],
        price: cloneWalletPriceRule(model.price),
      });
      changed = true;
      continue;
    }
    if (existing.source !== 'manual' || model.source === 'manual') {
      existing.price = cloneWalletPriceRule(model.price);
      existing.source = model.source;
      existing.locked = model.locked === true;
      existing.aliases = Array.from(new Set([...(existing.aliases || []), ...(model.aliases || [])]));
      existing.updatedAt = now;
      changed = true;
    }
  }
  if (!target.catalogProvider && duplicate.catalogProvider) {
    target.catalogProvider = duplicate.catalogProvider;
    changed = true;
  }
  if (!target.lastUsedAt || (duplicate.lastUsedAt || 0) > target.lastUsedAt) {
    target.lastUsedAt = duplicate.lastUsedAt || target.lastUsedAt;
    changed = true;
  }
  if (changed) target.updatedAt = now;
  return changed;
}

function migrateWalletEndpoints(ignored: Set<string>, now = Date.now()): boolean {
  const byEndpoint = new Map<string, WalletConfig>();
  const next: WalletConfig[] = [];
  const duplicateIds = new Set<string>();
  let changed = false;

  for (const wallet of state.wallets) {
    if (wallet.id === DEEPSEEK_WALLET_ID) {
      next.push(wallet);
      if (wallet.endpointId) byEndpoint.set(wallet.endpointId, wallet);
      continue;
    }
    const oldEndpointLabel = wallet.endpointLabel;
    const oldEndpointDisplay = wallet.endpointDisplay;
    const normalized = normalizeConnectionEndpoint({
      sourceType: wallet.sourceType,
      endpointId: wallet.endpointId,
      endpointLabel: wallet.endpointLabel,
      credentialId: null,
      credentialLabel: null,
    });
    if (!normalized?.endpointId) {
      next.push(wallet);
      continue;
    }
    if (wallet.endpointId !== normalized.endpointId || wallet.endpointLabel !== normalized.endpointLabel) {
      wallet.endpointId = normalized.endpointId;
      wallet.endpointLabel = normalized.endpointLabel ?? null;
      wallet.endpointDisplay = normalized.endpointLabel ?? null;
      if (wallet.name === oldEndpointLabel || wallet.name === oldEndpointDisplay) wallet.name = normalized.endpointLabel || wallet.name;
      wallet.updatedAt = now;
      changed = true;
    }
    const existing = byEndpoint.get(wallet.endpointId);
    if (!existing) {
      byEndpoint.set(wallet.endpointId, wallet);
      next.push(wallet);
      continue;
    }
    const preferCurrent = ignored.has(existing.id) && !ignored.has(wallet.id);
    const target = preferCurrent ? wallet : existing;
    const duplicate = preferCurrent ? existing : wallet;
    if (preferCurrent) {
      const index = next.indexOf(existing);
      if (index >= 0) next[index] = wallet;
      byEndpoint.set(wallet.endpointId, wallet);
    }
    if (mergeWalletConfiguration(duplicate, target, now)) changed = true;
    duplicateIds.add(duplicate.id);
    changed = true;
  }

  state.wallets = next;
  if (duplicateIds.size) {
    state.walletIgnored = state.walletIgnored.filter((id) => !duplicateIds.has(id));
    for (const id of duplicateIds) ignored.delete(id);
  }
  return changed;
}

/**
 * 把历史条目的接入身份与钱包归属归一：
 * - endpointId / endpointLabel 按当前算法重算（旧版本掺过 sourceType，同一域名会有两个 id）；
 * - 找不到钱包时按接入自动补一个，条目钱包 id 跟着钱包走。
 * 幂等：已是目标状态时逐条不动。hydrate 的接入身份迁移与 migrateWallets 共用这一份。
 */
function migrateHistoryWalletLinks(allHistory: any[], ignored: Set<string>, now = Date.now()): boolean {
  let changed = false;
  for (const entry of allHistory || []) {
    const connection = historyConnection(entry);
    if (!connection) continue;
    if (entry.endpointId !== connection.endpointId || entry.endpointLabel !== connection.endpointLabel) {
      entry.endpointId = connection.endpointId;
      entry.endpointLabel = connection.endpointLabel;
      changed = true;
    }
    const observed = ensureWalletForConnection(state.wallets, ignored, connection, Number(entry.timestamp) || now);
    if (observed.changed) changed = true;
    if (!observed.wallet) continue;
    if (observed.wallet.id !== entry.walletId) {
      entry.walletId = observed.wallet.id;
      changed = true;
    }
    if (shouldTrackWalletModel(observed.wallet, String(entry.model || ''))) {
      const model = observeModel(observed.wallet, String(entry.model || ''), Number(entry.timestamp) || now);
      if (model.model && model.model.price.priceConfigured !== true) {
        const legacy = (state.settings.customModels || []).find((custom: any) => {
          try {
            return normalizeModel(String(custom?.model || '')) === normalizeModel(String(entry.model || ''))
              || String(custom?.model || '') === String(entry.model || '');
          } catch {
            return false;
          }
        });
        if (legacy) {
          model.model.price = legacyCustomPriceRule(legacy);
          model.model.source = legacy.synced === true ? 'sync' : 'manual';
          model.model.updatedAt = Number(entry.timestamp) || now;
          model.changed = true;
        }
      }
      if (model.changed) {
        observed.wallet.updatedAt = now;
        changed = true;
      }
    }
    if (!observed.wallet.lastUsedAt || Number(entry.timestamp) > observed.wallet.lastUsedAt) {
      observed.wallet.lastUsedAt = Number(entry.timestamp) || now;
      changed = true;
    }
  }
  return changed;
}

function migrateWallets(hot: any, cold: any[] = []): boolean {
  const now = Date.now();
  const normalized = normalizeWallets(state.wallets, state.settings, now);
  let changed = normalized !== state.wallets;
  state.wallets = normalized;
  state.walletIgnored = Array.isArray(state.walletIgnored)
    ? Array.from(new Set(state.walletIgnored.map((id) => String(id || '').trim()).filter(Boolean)))
    : [];
  const ignored = new Set(state.walletIgnored);
  const official = state.wallets.find((wallet) => wallet.id === DEEPSEEK_WALLET_ID)
    || createDeepSeekWallet(state.settings, now);
  if (!state.wallets.some((wallet) => wallet.id === official.id)) state.wallets.unshift(official);
  changed = migrateLegacyPricing(official, state.settings.customModels || []) || changed;
  changed = migrateLegacyBalance(official) || changed;
  changed = refreshBuiltinWalletModels(official, now) || changed;
  migrateLegacyWalletApiKey(official.id);
  changed = migrateWalletEndpoints(ignored, now) || changed;
  const allHistory = [...(cold || []), ...(state.history || [])];
  changed = migrateHistoryModels(allHistory) || changed;
  changed = migrateHistoryWalletLinks(allHistory, ignored, now) || changed;
  const backfillDone = Number(hot?._walletPricingBackfillVersion || 0) >= WALLET_PRICING_BACKFILL_VERSION;
  if (!backfillDone) {
    changed = backfillLegacyExactPricing(allHistory) || changed;
    if (hot && typeof hot === 'object') hot._walletPricingBackfillVersion = WALLET_PRICING_BACKFILL_VERSION;
    changed = true;
  }
  if (hot && Array.isArray(hot.wallets) && state.wallets.length === 0) {
    state.wallets = normalizeWallets(hot.wallets, state.settings, now);
    changed = true;
  }
  return changed;
}

const WALLET_PRICING_BACKFILL_VERSION = 1;

/**
 * 接入身份算法版本：1 = 旧算法（endpointId 掺了 sourceType），2 = 只由接入地址决定。
 * 旧数据里同一个供应商会因 chat_completion_source 不同被拆成两个接入、两个钱包，
 * 扩展/脚本自己拼请求体触发的那次还会落到没配价的新钱包上，费用记 0。
 * 升级时借这个版本号强制走一次完整迁移（钱包合并 + 历史归位 + 整库重算），跑完落版本号。
 */
const ENDPOINT_IDENTITY_VERSION = 2;
const ENDPOINT_IDENTITY_KEY = '_endpointIdentityVersion';

/**
 * Agent 模式条目的重算：一次 Run 可能跨多个钱包、多个时段，
 * 因此按 raw_usage.agent.walletBreakdown 逐项计价后求和。
 * 返回 null 表示不是 Agent 条目（或缺少分项），调用方继续走原有单钱包逻辑。
 */
function recalcAgentRunCost(entry: any): ReturnType<typeof calcCost> | null {
  if (!entry || entry.origin !== 'agent') return null;
  const shares = entry?.raw_usage?.agent?.walletBreakdown;
  if (!Array.isArray(shares) || !shares.length) return null;
  let input = 0;
  let output = 0;
  let priceType = '';
  let source: ReturnType<typeof calcCost>['source'] = 'unpriced';
  for (const share of shares) {
    const shareWallet = share?.walletId
      ? (state.wallets || []).find((item) => item.id === share.walletId) || null
      : null;
    const c = calcCost({
      timestamp: Number(share?.timestamp) || entry.timestamp,
      model: typeof share?.model === 'string' && share.model ? share.model : entry.model,
      prompt_cache_hit_tokens: Number(share?.hit) || 0,
      prompt_cache_miss_tokens: Number(share?.miss) || 0,
      completion_tokens: Number(share?.comp) || 0,
    }, state.settings as any, shareWallet);
    input += c.input;
    output += c.output;
    if (shares.length === 1) { priceType = c.priceType; source = c.source; }
  }
  return { input, output, total: input + output, priceType: priceType || entry.priceType || 'old', source };
}

function recalcEntryCost(entry: any, wallet: WalletConfig | null) {
  const agentCost = recalcAgentRunCost(entry);
  if (agentCost) return agentCost;
  const legacyWallet = entry?.legacyPricingWalletId
    ? state.wallets.find((item) => item.id === entry.legacyPricingWalletId) || null
    : null;
  return calcCost({
    timestamp: entry.timestamp,
    model: entry.model,
    prompt_cache_hit_tokens: entry.cache_hit_tokens || 0,
    prompt_cache_miss_tokens: entry.cache_miss_tokens || 0,
    completion_tokens: entry.completion_tokens || 0,
  }, state.settings as any, legacyWallet || wallet);
}

/** 钱包余额增减（sign=-1 为回滚）；只调整已填写余额的钱包，与 addEntry 的预扣口径一致 */
function adjustWalletBalance(walletId: string | null | undefined, cost: number, sign: 1 | -1): void {
  if (!walletId) return;
  const amount = Number(cost);
  if (!Number.isFinite(amount) || amount === 0) return;
  const wallet = (state.wallets || []).find((item) => item.id === walletId);
  if (!wallet) return;
  const current = wallet.balance.amount == null || wallet.balance.amount === ''
    ? NaN
    : parseFloat(String(wallet.balance.amount));
  if (!Number.isFinite(current)) return;
  const delta = wallet.balance.currency === 'USD' ? amount / getWalletExchangeRate() : amount;
  wallet.balance.amount = (current - sign * delta).toFixed(4);
  wallet.updatedAt = Date.now();
}

/** 回滚一条 Agent 历史对聚合、轮次与钱包余额的贡献（用于同 Run 重采 upsert） */
function rollbackAgentRunEntry(entry: any): void {
  if (!entry) return;
  state.total_tokens -= Number(entry.total_tokens) || 0;
  state.total_cost -= Number(entry.cost) || 0;
  state.input_tokens -= Number(entry.prompt_tokens) || 0;
  state.output_tokens -= Number(entry.completion_tokens) || 0;
  state.cache_hit_tokens -= Number(entry.cache_hit_tokens) || 0;
  state.cache_miss_tokens -= Number(entry.cache_miss_tokens) || 0;
  state.input_cost -= Number(entry.input_cost) || 0;
  state.output_cost -= Number(entry.output_cost) || 0;
  const shares = entry?.raw_usage?.agent?.walletBreakdown;
  if (Array.isArray(shares) && shares.length) {
    for (const share of shares) adjustWalletBalance(share?.walletId ?? null, Number(share?.cost) || 0, -1);
  } else {
    adjustWalletBalance(entry.walletId ?? null, Number(entry.cost) || 0, -1);
  }
  if (isDeepSeekOfficialModel(entry.model) && state.rounds > 0) state.rounds -= 1;
}

function applyCostPatch(entry: any, cost: ReturnType<typeof calcCost>): void {
  entry.input_cost = cost.input;
  entry.output_cost = cost.output;
  entry.cost = cost.total;
  entry.priceType = cost.priceType;
  entry.pricingSource = entry.legacyPricingWalletId ? 'legacy-match' : cost.source;
}

/** 命中率（%）口径统一，热/冷重算共用 */
function hitRateOf(entry: any): number {
  const hit = Number(entry?.cache_hit_tokens) || 0;
  const miss = Number(entry?.cache_miss_tokens) || 0;
  return hit + miss > 0 ? (hit / (hit + miss) * 100) : 0;
}

/** 计价结果与记录现值是否有差异：无差异就不必回写整份冷库 */
function costPatchDiffers(entry: any, cost: { input: number; output: number; total: number; priceType: string; source: string }): boolean {
  const source = entry?.legacyPricingWalletId ? 'legacy-match' : cost.source;
  return (Number(entry?.input_cost) || 0) !== (cost.input || 0)
    || (Number(entry?.output_cost) || 0) !== (cost.output || 0)
    || (Number(entry?.cost) || 0) !== (cost.total || 0)
    || entry?.priceType !== cost.priceType
    || entry?.pricingSource !== source;
}

function applyTotalDelta(previous: { input: number; output: number; total: number }, next: { input: number; output: number; total: number }): void {
  state.input_cost += (next.input || 0) - (previous.input || 0);
  state.output_cost += (next.output || 0) - (previous.output || 0);
  state.total_cost += (next.total || 0) - (previous.total || 0);
}

function aggregateHistory(entries: any[]): {
  total_tokens: number;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  input_cost: number;
  output_cost: number;
  rounds: number;
} {
  const result = {
    total_tokens: 0,
    total_cost: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_hit_tokens: 0,
    cache_miss_tokens: 0,
    input_cost: 0,
    output_cost: 0,
    rounds: 0,
  };
  for (const entry of entries || []) {
    result.total_tokens += Number(entry?.total_tokens) || 0;
    result.total_cost += Number(entry?.cost) || 0;
    result.cache_hit_tokens += Number(entry?.cache_hit_tokens) || 0;
    result.cache_miss_tokens += Number(entry?.cache_miss_tokens) || 0;
    result.input_tokens += (Number(entry?.cache_hit_tokens) || 0) + (Number(entry?.cache_miss_tokens) || 0);
    result.output_tokens += Number(entry?.completion_tokens) || 0;
    result.input_cost += Number(entry?.input_cost) || 0;
    result.output_cost += Number(entry?.output_cost) || 0;
    if (isDeepSeekOfficialModel(entry?.model)) result.rounds += 1;
  }
  return result;
}

function applyAggregate(next: ReturnType<typeof aggregateHistory>): void {
  state.total_tokens = next.total_tokens;
  state.total_cost = next.total_cost;
  state.input_tokens = next.input_tokens;
  state.output_tokens = next.output_tokens;
  state.cache_hit_tokens = next.cache_hit_tokens;
  state.cache_miss_tokens = next.cache_miss_tokens;
  state.input_cost = next.input_cost;
  state.output_cost = next.output_cost;
  state.rounds = next.rounds;
}

/**
 * 启动重算指纹：只把「会改变历史计价结果」的输入压成短串——扩展版本号、钱包规则与
 * 忽略列表、峰谷/额外空闲日/旧自定义价。这些一变，历史金额就必须重算；一变不变，
 * 上次数值依然成立。刻意不包含历史条目本身，避免日常只是多了几条记录就整库重算。
 */
const CALC_FINGERPRINT_KEY = '_calcFingerprint';

function fnv1a(hash: number, text: string): number {
  let h = hash >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function safeAppVersion(): string {
  try {
    return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
  } catch {
    return '';
  }
}

function computeCalcFingerprint(): string {
  let h = 2166136261 >>> 0;
  h = fnv1a(h, 'v1|' + safeAppVersion());
  try {
    h = fnv1a(h, '|w|' + JSON.stringify(state.wallets || []));
    h = fnv1a(h, '|i|' + JSON.stringify(state.walletIgnored || []));
  } catch {
    h = fnv1a(h, '|w!');
  }
  try {
    const s: any = state.settings || {};
    h = fnv1a(h, '|p|' + JSON.stringify(s.peakHours || null) + '|' + JSON.stringify(s.extraOffDays || null) + '|' + JSON.stringify(s.customModels || null));
  } catch {
    h = fnv1a(h, '|p!');
  }
  return h.toString(36);
}

/** 把当前计价输入写入热设置，供下次启动比对（失败静默，下次启动只会多算一次） */
function refreshCalcFingerprint(): void {
  try { saveHot({ [CALC_FINGERPRINT_KEY]: computeCalcFingerprint() } as any); } catch {}
}

async function rebuildAggregates(preloadedCold?: any[]): Promise<void> {
  const cold = Array.isArray(preloadedCold) ? preloadedCold : await loadHistoryCold();
  const merged = [...(state.history || []), ...cold].sort((a: any, b: any) => b.timestamp - a.timestamp);
  const keyOf = historyRecordKey;
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const entry of merged) {
    const key = keyOf(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  applyAggregate(aggregateHistory(unique));
}

function shouldTrackWalletModel(wallet: WalletConfig, model: string): boolean {
  if (wallet.id !== DEEPSEEK_WALLET_ID) return true;
  try {
    return !(PRICING as any)[normalizeModel(model)];
  } catch {
    return true;
  }
}

function backfillLegacyExactPricing(allHistory: any[]): boolean {
  let changed = false;
  const ignored = new Set(state.walletIgnored || []);
  for (const entry of allHistory || []) {
    if (!entry || entry.legacyPricingWalletId) continue;
    const sourceWallet = findWalletForHistory(state.wallets, entry);
    if (!sourceWallet) continue;
    const current = calcCost({
      timestamp: entry.timestamp,
      model: entry.model,
      prompt_cache_hit_tokens: entry.cache_hit_tokens || 0,
      prompt_cache_miss_tokens: entry.cache_miss_tokens || 0,
      completion_tokens: entry.completion_tokens || 0,
    }, state.settings as any, sourceWallet);
    if (current.source !== 'unpriced') continue;
    const match = findExactPricedModelMatch(state.wallets, String(entry.model || ''), ignored);
    if (!match || match.walletId === sourceWallet.id) continue;
    entry.legacyPricingWalletId = match.walletId;
    entry.legacyPricingModel = match.model;
    const previous = {
      input: Number(entry.input_cost) || 0,
      output: Number(entry.output_cost) || 0,
      total: Number(entry.cost) || 0,
    };
    const matchedWallet = state.wallets.find((wallet) => wallet.id === match.walletId) || null;
    const cost = recalcEntryCost(entry, matchedWallet);
    applyCostPatch(entry, cost);
    applyTotalDelta(previous, cost);
    changed = true;
  }
  return changed;
}

export function getFilteredHistoryForScope(): any[] {
  const scope = (state.settings as any).historyScope || 'all';
  if (scope !== 'current') return state.history || [];
  const cur = getCurrentChatId();
  if (!cur) return state.history || [];
  return (state.history || []).filter((h: any) => h.chatId === cur);
}

export type HistoryDeleteFilter = {
  start?: string;
  end?: string;
  model?: string;
  chat?: string;
};

// 归一化设置：只接受已知设置键，防止历史/余额等字段污染（如误将整个 state 存入 settings），并清洗非法值
export function normalizeSettings(incoming: any): any {
  const def: any = defaultSettings();
  const src: any = (incoming && typeof incoming === 'object') ? incoming : {};
  const merged: any = { ...def };
  for (const k of Object.keys(def)) {
    if (src[k] !== undefined) merged[k] = src[k];
  }
  merged.webdav = { ...def.webdav, ...(src.webdav || {}) };
  merged.pricingSync = { ...def.pricingSync, ...(src.pricingSync || {}) };
  if (!isFinite(parseFloat(String(merged.pricingSync.exchangeRate))) || parseFloat(String(merged.pricingSync.exchangeRate)) <= 0) merged.pricingSync.exchangeRate = 7.2;
  if (typeof merged.pricingSync.showSyncedModels !== 'boolean') merged.pricingSync.showSyncedModels = false;
  // 旧的全局开关已移除：币种改由各钱包 currency 决定，同步改由各钱包 catalogProvider 决定
  if ('enabled' in merged.pricingSync) delete (merged.pricingSync as any).enabled;
  if (!isFinite(parseFloat(String(merged.pricingSync.syncedMarkVersion)))) merged.pricingSync.syncedMarkVersion = 0;
  if (!Array.isArray(merged.peakHours) || !merged.peakHours.length) merged.peakHours = def.peakHours;
  merged.extraOffDays = Array.isArray(merged.extraOffDays)
    ? Array.from(new Set(merged.extraOffDays.filter((day: any) => isValidDayKey(day)))).sort()
    : def.extraOffDays;
  if (!Array.isArray(merged.customModels)) merged.customModels = def.customModels;
  if (!merged.historyScope) merged.historyScope = def.historyScope;
  // Token 缩写开关：老数据没有这个键，缺省与默认值一致（false = 完整千分位），非布尔也纠正
  if (typeof merged.tokenUnitCompact !== 'boolean') merged.tokenUnitCompact = false;
  if (!merged.theme) merged.theme = def.theme;
  if (typeof merged.modelsPricingCollapsed !== 'boolean') merged.modelsPricingCollapsed = true;
  // 移动端兼容 UI：默认值只按设备类型决定一次（utils/device.ts）——移动端默认开启底栏，
  // 桌面端默认关闭、保持改造前的侧栏抽屉；字段一旦是布尔值（用户自己改过、或上一版已写入）就不再覆盖。
  if (typeof (merged as any).mobileCompatUi !== 'boolean') (merged as any).mobileCompatUi = mobileDeviceHint();
  // 峰值圆点默认值改为「关闭」只作用于全新安装（没有任何已存设置）：
  // 老版本持久化里根本没有这个键的用户，按旧行为迁移成开启，避免升级后圆点无声消失。
  if (src.peakDot === undefined && Object.keys(src).length > 0) merged.peakDot = true;
  if (!Array.isArray(merged.overviewFour) || (merged.overviewFour.length !== 8 && merged.overviewFour.length !== 4)) merged.overviewFour = def.overviewFour;
  if (Array.isArray(merged.overviewFour) && merged.overviewFour.length === 4) {
    merged.overviewFour = [...merged.overviewFour, ...def.overviewFour.slice(4)];
  }
  try {
    const valid = new Set(['avg_cost','avg_tokens','avg_duration','avg_rate','avg_ttft','avg_input_cost','avg_input_tokens','avg_output_cost','avg_output_tokens','avg_think_time','avg_think_tokens','avg_hit_rate','latest_hit_rate','max_output','max_input','max_total','avg_think_ratio','truncation_rate']);
    if (Array.isArray(merged.overviewFour)) merged.overviewFour = merged.overviewFour.map((k:any)=> valid.has(k)?k:'avg_cost');
    if (merged.overviewFour.length !== 8) merged.overviewFour = def.overviewFour;
    if (!Array.isArray(merged.statsFour) || merged.statsFour.length !== 4) merged.statsFour = def.statsFour;
    const validStats = new Set(['avg_cost','avg_tokens','avg_duration','avg_rate','avg_ttft','avg_input_cost','avg_input_tokens','avg_output_cost','avg_output_tokens','avg_think_time','avg_think_tokens','avg_think_ratio','truncation_rate','avg_hit_rate','latest_hit_rate','max_output','max_input','max_total']);
    if (Array.isArray(merged.statsFour)) merged.statsFour = merged.statsFour.map((k:any)=> validStats.has(k)?k:'avg_cost');
    if (merged.statsFour.length !== 4) merged.statsFour = def.statsFour;
  } catch {}
  return merged;
}

function sanitizeFullRequest(fr: any): any {
  if (!fr || typeof fr !== 'object') return fr;
  const keep: any = {};
  for (const k of ['model','stream','temperature','max_tokens','top_p','stream_options','chat_completion_source','endpoint']) {
    if (fr[k] !== undefined) keep[k] = fr[k];
  }
  if (Array.isArray(fr.messages)) keep.messages_length = fr.messages.length;
  else if (typeof fr.messages_length === 'number') keep.messages_length = fr.messages_length;
  else if (typeof fr.messages === 'number') keep.messages_length = fr.messages;
  return keep;
}

function clampMessage(m: any): any {
  if (!m || typeof m !== 'object') return m;
  const c = typeof m.content === 'string'
    ? (m.content.length > 600 ? m.content.slice(0, 600) + '…[截断]' : m.content)
    : m.content;
  return { ...m, content: c };
}

// 限制完整响应落盘大小，避免 settings.json 被超大 SSE 文本撑爆
const RESPONSE_KEEP = 200000;
function clampResponse(resp: any): any {
  if (resp == null) return null;
  if (typeof resp === 'string') {
    return resp.length > RESPONSE_KEEP ? resp.slice(0, RESPONSE_KEEP) + '\n…[响应过长已截断]' : resp;
  }
  try {
    const s = JSON.stringify(resp);
    if (s.length > RESPONSE_KEEP) return s.slice(0, RESPONSE_KEEP) + '\n…[响应过长已截断]';
  } catch {}
  return resp;
}

function pruneDetails() {
  if (!state.history || !state.history.length) return;
  const hs = [...state.history].sort((a: any, b: any) => b.timestamp - a.timestamp);
  for (let i = 0; i < hs.length; i++) {
    const e: any = hs[i];
    if (i >= DETAIL_KEEP) {
      delete e.messages;
      delete e.fullRequest;
      delete e.fullResponse;
      // 原文库只服务最近 DETAIL_KEEP 条：掉出窗口就同步删，避免占用偷偷留在库里
      if (e.detailKey) {
        deleteDetail(e.detailKey).catch(() => {});
        delete e.detailKey;
      }
    } else {
      // 保留前 DETAIL_KEEP 条的完整响应/请求；fullRequest 裁剪 messages 防止大对象落盘
      if (e.fullRequest && typeof e.fullRequest === 'object' && Array.isArray(e.fullRequest.messages)) {
        e.fullRequest = sanitizeFullRequest(e.fullRequest);
      }
    }
  }
}

function persist() {
  pruneDetails();
  // 剥离隐私大字段，防止对话全文落盘到 settings.json
  let safeLastUsage: any = state.lastUsage;
  if (safeLastUsage) {
    try {
      const c: any = { ...safeLastUsage };
      delete c.messages;
      delete c.fullRequest;
      delete c.fullResponse;
      // raw_usage 保留但去除可能的大对象
      safeLastUsage = c;
    } catch {}
  }
  saveHot({
    history: state.history,
    total_tokens: state.total_tokens,
    total_cost: state.total_cost,
    input_tokens: state.input_tokens,
    output_tokens: state.output_tokens,
    cache_hit_tokens: state.cache_hit_tokens,
    cache_miss_tokens: state.cache_miss_tokens,
    input_cost: state.input_cost,
    output_cost: state.output_cost,
    rounds: state.rounds,
    startTime: state.startTime,
    settings: state.settings,
    balance: state.balance,
    customBalance: state.customBalance,
    wallets: state.wallets,
    walletIgnored: state.walletIgnored,
    messageCount: state.messageCount,
    lastUsage: safeLastUsage,
  });
  emit(DataEvents.UPDATED);
}

export const repository = {
  snapshot(): Snapshot {
    return {
      saves: {} as any,
      currentSave: null as any,
      settings: state.settings,
      balance: state.balance,
      customBalance: state.customBalance,
      wallets: state.wallets,
      walletIgnored: state.walletIgnored,
      messageCount: state.messageCount,
      lastUsage: state.lastUsage,
      history: state.history as any,
      total_tokens: state.total_tokens as any,
      total_cost: state.total_cost as any,
    } as any;
  },

  getAggregated() { return getSelectedSave(); },

  getHistoryByRange(range: { start: string; end: string }) {
    const s: any = getSelectedSave();
    if (!s?.history) return [];
    const toDay = (ts: number) => { const d = new Date(ts); const pad=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
    return s.history.filter((h: any) => {
      const k = toDay(h.timestamp);
      return k >= range.start && k <= range.end;
    });
  },

  async getColdHistory() { return loadHistoryCold(); },

  /**
   * 按时间戳取单条记录（热区优先，没有再查冷库）。
   * 详情抽屉用它回退展示旧摘要：列表模板里只放得下稀疏字段，完整原文在详情库里，需要先找到 detailKey。
   */
  async getHistoryEntry(timestamp: number | string): Promise<any | null> {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return null;
    const hot = (state.history || []).find((entry: any) => Number(entry?.timestamp) === ts);
    if (hot) return hot;
    try {
      const cold = await loadHistoryCold();
      return (cold || []).find((entry: any) => Number(entry?.timestamp) === ts) || null;
    } catch (error) {
      notifyColdReadFailure(error);
      return null;
    }
  },

  async getAllHistory() {
    try {
      return await getAllHistory();
    } catch (error) {
      notifyColdReadFailure(error);
      throw error;
    }
  },

  async deleteHistoryByFilter(filter: HistoryDeleteFilter = {}): Promise<number> {
    const start = filter.start && isValidDayKey(filter.start) ? filter.start : '';
    const end = filter.end && isValidDayKey(filter.end) ? filter.end : '';
    const model = String(filter.model || '').trim();
    const chat = String(filter.chat || '').trim();
    const all = await getAllHistory();
    const remains = (all || []).filter((entry: any) => {
      if (!entry) return false;
      if (start || end) {
        const day = localDay(entry.timestamp);
        if (start && day < start) return true;
        if (end && day > end) return true;
      }
      if (model && String(entry.model || '') !== model) return true;
      if (chat) {
        const chatId = String(entry.chatId || '');
        const chatName = String(entry.chatName || '');
        if (chatId !== chat && chatName !== chat) return true;
      }
      return false;
    });
    const removed = Math.max(0, (all || []).length - remains.length);
    if (!removed) return 0;
    // 被删记录若还挂在原文库里，一起清掉（只删命中的 key，不碰别人的）
    for (const entry of all || []) {
      if (remains.indexOf(entry) !== -1) continue;
      const key = (entry as any)?.detailKey;
      if (key) deleteDetail(key).catch(() => {});
    }
    await this.replaceAll({ history: remains } as any, { clearCold: true });
    await this.recalcAll();
    await rebuildAggregates();
    persist();
    emit(DataEvents.UPDATED);
    return removed;
  },

  getWallets(): WalletConfig[] {
    return state.wallets || [];
  },

  getWallet(walletId: string): WalletConfig | null {
    return (state.wallets || []).find((wallet) => wallet.id === walletId) || null;
  },

  getIgnoredWalletIds(): string[] {
    return [...(state.walletIgnored || [])];
  },

  replaceWallets(next: WalletConfig[], ignored?: string[]): void {
    state.wallets = ensureDeepSeekWallet(normalizeWallets(next, state.settings, Date.now()), state.settings, Date.now());
    if (ignored !== undefined) {
      state.walletIgnored = Array.from(new Set(ignored.map((id) => String(id || '').trim()).filter((id) => id && id !== DEEPSEEK_WALLET_ID)));
    }
    persist();
    emit(DataEvents.SETTINGS_CHANGED);
  },

  updateWallet(walletId: string, updater: (wallet: WalletConfig) => void): WalletConfig | null {
    const wallet = (state.wallets || []).find((item) => item.id === walletId);
    if (!wallet) return null;
    updater(wallet);
    wallet.updatedAt = Date.now();
    persist();
    emit(DataEvents.SETTINGS_CHANGED);
    return wallet;
  },

  /** 收起所有已展开的钱包（离开钱包页时调用），一次落盘 */
  collapseAllWallets(): boolean {
    let changed = false;
    for (const wallet of state.wallets || []) {
      if (wallet.collapsed !== true) {
        wallet.collapsed = true;
        wallet.updatedAt = Date.now();
        changed = true;
      }
    }
    if (changed) {
      persist();
      emit(DataEvents.SETTINGS_CHANGED);
    }
    return changed;
  },

  setWalletIgnored(walletId: string, ignored: boolean): boolean {
    if (!walletId || walletId === DEEPSEEK_WALLET_ID) return false;
    if (ignored) {
      if (!state.walletIgnored.includes(walletId)) state.walletIgnored.push(walletId);
    } else {
      state.walletIgnored = state.walletIgnored.filter((id) => id !== walletId);
    }
    persist();
    emit(DataEvents.SETTINGS_CHANGED);
    return true;
  },

  setWalletBalance(walletId: string, amount: string | null, currency: 'CNY' | 'USD' = 'CNY', calibrated = false): WalletConfig | null {
    return this.updateWallet(walletId, (wallet) => {
      wallet.balance.amount = amount == null || String(amount).trim() === '' ? null : String(amount);
      wallet.balance.currency = currency === 'USD' ? 'USD' : 'CNY';
      wallet.balance.mode = calibrated ? 'auto' : 'manual';
      if (calibrated) wallet.balance.lastCalibrated = Date.now();
    });
  },

  recalcEntryWallet(entry: any): WalletConfig | null {
    return findWalletForHistory(state.wallets, entry);
  },

  addEntry(
    usage: any,
    model: string,
    messages: any[],
    /** 本轮起点；未知（无主轮次）时传 null，耗时记 0 而不是编一个值 */
    startTime: number | null,
    fullRequest?: any,
    fullResponse?: any,
    ttft = 0,
    thinkTime = 0,
    finishReason: string | null = null,
    connection: HistoryConnection | null = null,
    requestId: string | null = null,
    streamed: boolean | null = null,
    meta: EntryMeta | null = null,
  ) {
    messages = messages || [];
    if (!model) try { model = (globalThis as any).SillyTavern?.getContext?.().model || 'deepseek-v4-flash'; } catch { model = 'deepseek-v4-flash'; }
    const rawModel = String(model);
    model = normalizeModel(rawModel);
    log.debug('addEntry 收到', { model, hasMessages: !!messages?.length });
    // 容错：拒绝数字/空对象导致的 0 token 污染条目
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
      log.debug('addEntry 跳过：usage 非对象 model=' + model);
      return null as any;
    }
    const hasAnyTokenField =
      typeof usage.prompt_tokens === 'number' ||
      typeof usage.completion_tokens === 'number' ||
      typeof usage.total_tokens === 'number' ||
      typeof usage.input_tokens === 'number' ||
      typeof usage.output_tokens === 'number' ||
      typeof usage.prompt_cache_hit_tokens === 'number' ||
      (usage.prompt_tokens_details && typeof usage.prompt_tokens_details.cached_tokens === 'number');
    if (!hasAnyTokenField) {
      log.debug('addEntry 跳过：无 token 字段 model=' + model);
      return null as any;
    }
    let hit = usage.prompt_cache_hit_tokens || 0;
    if (!hit && usage.prompt_tokens_details?.cached_tokens) hit = usage.prompt_tokens_details.cached_tokens;
    let miss = usage.prompt_cache_miss_tokens;
    if (miss === undefined || miss === null) { miss = (usage.prompt_tokens || usage.input_tokens || 0) - hit; if (miss < 0) miss = 0; }
    const comp = usage.completion_tokens || usage.output_tokens || 0;
    const total = usage.total_tokens || hit + miss + comp;
    // 若解析后仍全 0，视为无效数据，不写入历史
    if (hit === 0 && miss === 0 && comp === 0 && total === 0) {
      log.debug('addEntry 跳过：全 0 token model=' + model);
      return null as any;
    }
    log.debug('addEntry 解析', { model, hit, miss, comp, total });
    const fr = finishReason ?? (usage as any)?.__finish_reason ?? (usage as any)?.finish_reason ?? null;
    const nowTs = Date.now();
    let wallet: WalletConfig | null = null;
    try {
      const observed = ensureWalletForConnection(
        state.wallets,
        new Set(state.walletIgnored || []),
        connection,
        nowTs,
      );
      wallet = observed.wallet;
      if (wallet) {
        if (shouldTrackWalletModel(wallet, model)) {
          const modelObservation = observeModel(wallet, model, nowTs);
          if (modelObservation.changed) wallet.updatedAt = nowTs;
          if (
            modelObservation.model?.source === 'discovered'
            && modelObservation.model.price.priceConfigured !== true
            // 是否同步只看该钱包有没有选价格来源，不再有全局总开关
            && !!wallet.catalogProvider
          ) {
            try {
              import('../services/pricing-sync')
                .then((module) => module.syncPricingFromModelsDev({ silent: true }))
                .then(() => this.recalcWallet(wallet!.id))
                .catch(() => {});
            } catch {}
          }
        }
        wallet.lastUsedAt = nowTs;
      }
    } catch {}
    // 记录跟着钱包走：域名兜底匹配到的老钱包可能还留着旧算法的 endpointId，
    // 这里以钱包登记的地址为准，免得同一供应商在统计里又冒出第二条「接入」。
    if (wallet && connection && wallet.endpointId && connection.endpointId && wallet.endpointId !== connection.endpointId) {
      connection = {
        ...connection,
        endpointId: wallet.endpointId,
        endpointLabel: wallet.endpointLabel || connection.endpointLabel,
      };
    }
    // 同一请求的 fetch 与 GENERATION_ENDED 双路径去重；无请求标识时不去重，避免误删合法重复请求。
    try {
      const now = Date.now();
      // 指纹不含 token 数：估算条目与随后到达的真实 usage 的 token 必然不同，
      // 含 token 会让两者都入库；这里用 requestId / 请求起始秒作为轮次标识。
      const fp = turnFingerprint({ requestId, model, startTime, connection, now });
      // 内容指纹：多层 fetch 包装各生成一个 requestId 时轮次指纹拦不住，只能靠「同模型 + 同四元 token + 同请求体」。
      // 不再拼「请求起始秒」——那是拿时间边界当身份：同一份响应被不同层解析时 startTime 可能跨秒
      // （差几毫秒就跨），漏并；而两次真实请求若恰巧落在同一秒也会被误并。改用 messages 摘要，
      // 它才是「是不是同一份请求」的稳定现场（见 src/data/fingerprint.ts#messageDigest）。
      // 取不到内容摘要（messages 为空或异常）时不做这层去重：此时指纹只剩「同模型 + 同 token」，
      // 在 3s 内足以把两次真实请求并成一条，宁可多记一条也不能少记。
      const digest = messageDigest(messages);
      const contentFp = total > 0 && digest
        ? usageFingerprint(model, total, hit, miss, comp, connection, null) + '|' + digest
        : '';
      const lastFpTime = recentUsageFingerprints.get(fp);
      const lastContentTime = contentFp ? recentContentFingerprints.get(contentFp) : 0;
      const dupByTurn = !!lastFpTime && now - lastFpTime < TURN_DEDUPE_WINDOW_MS;
      const dupByContent = !dupByTurn && !!lastContentTime && now - lastContentTime < CONTENT_DEDUPE_WINDOW_MS;
      if (dupByTurn || dupByContent) {
        // 重复记录：主路径先写入时缺完整响应/finish_reason，fetch 后解析到则回填
        try {
          // 同轮（requestId 相同）直接按 requestId 找；内容重复（requestId 不同）只能按用量找，
          // 绝不能退化成「回填历史第一条」，那会把别的轮次覆盖掉。
          const head: any = dupByTurn && requestId
            ? state.history.find((entry: any) => entry.requestId === requestId) || state.history[0]
            : state.history.find((entry: any) => (
                now - (Number(entry.timestamp) || 0) < CONTENT_DEDUPE_WINDOW_MS
                && Number(entry.total_tokens) === total
                && Number(entry.prompt_tokens) === hit + miss
                && Number(entry.completion_tokens) === comp
              )) || null; // 内容重复却找不到原条目：什么都不回填，绝不退化成「回填历史第一条」
          if (head) {
            let changed = false;
            // 估算条目被真实 usage 追上：整条换成真实值，别让估算 token 留在历史里
            const headEstimated = String(head.usageSource || '') === 'estimated';
            const incomingEstimated = String(meta?.usageSource || '') === 'estimated';
            if (headEstimated && !incomingEstimated) {
              changed =
                replaceEstimatedEntry(head, { hit, miss, comp, total, usage, fr, connection, wallet, model }) || changed;
            }
            // 先写的那条可能没拿到本轮起点 → 用这一次的真实起点补回耗时；下面补 TTFT 时会用到补好的时长
            if (backfillEntryDuration(head, startTime, now)) changed = true;
            if (fullResponse && !head.fullResponse) { head.fullResponse = clampResponse(fullResponse); changed = true; }
            if (fr && !head.finishReason) { head.finishReason = fr; head.isTruncated = isTruncatedFinish(fr); changed = true; }
            const estThink = usage?.completion_tokens_details?.reasoning_tokens || (usage as any)?.__think_tokens_est || 0;
            if (estThink && !head.thinkTokens) { head.thinkTokens = estThink; changed = true; }
            // 速率按「能测就测、测不出就估算」重算；TTFT 仍按流式判定归零
            const recalcHeadRate = (): boolean => applyRateTo(head, resolveTokenRate({
              duration: Number(head.duration) || 0,
              ttft: normalizeTtft(Number(head.duration) || 0, head.ttft),
              completionTokens: Number(head.completion_tokens) || 0,
              streamed: head.streamed ?? null,
            }));
            if (ttft && !head.ttft) {
              // 非流式/假流式：TTFT 不可信（等于总耗时）必须归零，速率交给估算
              if (streamed === false) {
                head.ttft = 0;
                head.streamed = false;
              } else {
                // 首字与总耗时重合（假流式）同样不可信，归一后为 0，界面显示「—」
                head.ttft = normalizeTtft(Number(head.duration) || 0, ttft);
                if (head.ttft > 0 && streamed != null) head.streamed = streamed;
              }
              recalcHeadRate();
              changed = true;
            } else if (streamed === false && !head.streamed) {
              head.ttft = 0;
              head.streamed = false;
              recalcHeadRate();
              changed = true;
            }
            if (thinkTime && !head.thinkTime) { head.thinkTime = thinkTime; changed = true; }
            if (connection) {
              for (const key of ['sourceType', 'endpointId', 'endpointLabel', 'credentialId', 'credentialLabel'] as const) {
                if (!head[key] && connection[key]) { head[key] = connection[key]; changed = true; }
              }
            }
            if (wallet && !head.walletId) {
              head.walletId = wallet.id;
              changed = true;
            }
            if (changed) {
              if ((state.lastUsage as any)?.timestamp === head.timestamp) {
                if (head.fullResponse) (state.lastUsage as any).fullResponse = head.fullResponse;
                if (head.finishReason) { (state.lastUsage as any).finishReason = head.finishReason; (state.lastUsage as any).isTruncated = head.isTruncated; }
                if (head.duration) (state.lastUsage as any).duration = head.duration;
                if (head.ttft || head.tokenRate) {
                  (state.lastUsage as any).ttft = head.ttft || 0;
                  (state.lastUsage as any).tokenRate = head.tokenRate;
                  (state.lastUsage as any).rateEstimated = head.rateEstimated ?? null;
                }
                if (head.thinkTime) (state.lastUsage as any).thinkTime = head.thinkTime;
                if (head.thinkTokens) (state.lastUsage as any).thinkTokens = head.thinkTokens;
                if (head.sourceType) (state.lastUsage as any).sourceType = head.sourceType;
                if (head.endpointId) (state.lastUsage as any).endpointId = head.endpointId;
                if (head.endpointLabel) (state.lastUsage as any).endpointLabel = head.endpointLabel;
                if (head.credentialId) (state.lastUsage as any).credentialId = head.credentialId;
                if (head.credentialLabel) (state.lastUsage as any).credentialLabel = head.credentialLabel;
              }
              persist();
            }
          }
        } catch {}
        log.debug('addEntry 去重跳过', { fp, by: dupByTurn ? 'turn' : 'content' });
        return null as any;
      }
      recentUsageFingerprints.set(fp, now);
      if (contentFp) recentContentFingerprints.set(contentFp, now);
      for (const [key, timestamp] of recentUsageFingerprints) {
        if (now - timestamp > TURN_FINGERPRINT_TTL_MS) recentUsageFingerprints.delete(key);
      }
      for (const [key, timestamp] of recentContentFingerprints) {
        if (now - timestamp > TURN_FINGERPRINT_TTL_MS) recentContentFingerprints.delete(key);
      }
    } catch {}
    const lu: any = { timestamp: Date.now(), model, rawModel: rawModel !== model ? rawModel : null, prompt_tokens: hit + miss, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp, total_tokens: total };
    const duration = startTime ? Date.now() - startTime : 0;
    const thinkTokens = usage.completion_tokens_details?.reasoning_tokens || (usage as any)?.__think_tokens_est || 0;
    lu.duration = duration;
    // 首字延迟只在「首字确实早于结尾」时才有意义：非流式与假流式（正文憋到最后一次性吐出）
    // 一律记 0，界面显示「—」；速率按同一口径「输出 Token ÷（总耗时 − 首字）」估算
    const nonStreamed = streamed === false;
    lu.streamed = streamed;
    const effectiveTtft = nonStreamed ? 0 : normalizeTtft(duration, ttft || 0);
    const rate = resolveTokenRate({ duration, ttft: effectiveTtft, completionTokens: comp, streamed });
    lu.tokenRate = rate.rate;
    if (rate.estimated) lu.rateEstimated = rate.estimated;
    lu.ttft = effectiveTtft; lu.thinkTime = thinkTime || 0; lu.thinkTokens = thinkTokens;
    // 截断检测：非正常 finish_reason（length / content_filter / sensitive 等）。
    // 用户自己点停止不算截断——这一轮本来就该停在那里，不是模型截不出来。
    const userStopped = String((meta as any)?.interrupted || '') === 'user';
    lu.finishReason = fr; (lu as any).isTruncated = !userStopped && isTruncatedFinish(fr);
    lu.messages = (messages || []).map(clampMessage);
    const c: any = calcCost({ timestamp: lu.timestamp, model, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp }, state.settings as any, wallet);
    lu.cost = c.total; lu.input_cost = c.input; lu.output_cost = c.output; lu.priceType = c.priceType;
    lu.walletId = wallet?.id ?? null;
    lu.pricingSource = c.source;
    const safeResponse = clampResponse(fullResponse);
    lu.raw_usage = usage; lu.fullRequest = fullRequest; lu.fullResponse = safeResponse;
    // 记录所属对话，便于按对话过滤
    const chatId = getCurrentChatId();
    const chatName = getCurrentChatName();
    (lu as any).chatId = chatId; (lu as any).chatName = chatName;
    lu.requestId = requestId;
    (lu as any).detailKey = requestId ? String(requestId) : null;
    if (connection) {
      lu.sourceType = connection.sourceType;
      lu.endpointId = connection.endpointId;
      lu.endpointLabel = connection.endpointLabel;
      lu.credentialId = connection.credentialId;
      lu.credentialLabel = connection.credentialLabel;
    }
    applyEntryMeta(lu, meta);
    state.lastUsage = lu;

    const fr2 = fr;
    const entry: any = {
      timestamp: lu.timestamp, model, rawModel: rawModel !== model ? rawModel : null, prompt_tokens: hit + miss, cache_hit_tokens: hit, cache_miss_tokens: miss,
      requestId,
      detailKey: requestId ? String(requestId) : null,
      completion_tokens: comp, total_tokens: total, input_cost: lu.input_cost, output_cost: lu.output_cost,
      cost: lu.cost, cache_hit_rate: (hit + miss) > 0 ? (hit / (hit + miss) * 100) : 0, priceType: lu.priceType,
      raw_usage: usage, messages: (messages || []).map(clampMessage), duration, ttft: lu.ttft, thinkTime, thinkTokens, tokenRate: lu.tokenRate, rateEstimated: lu.rateEstimated ?? null, fullRequest, fullResponse: safeResponse,
      finishReason: fr2, isTruncated: !userStopped && isTruncatedFinish(fr2),
      streamed,
      chatId, chatName,
      sourceType: connection?.sourceType ?? null,
      endpointId: connection?.endpointId ?? null,
      endpointLabel: connection?.endpointLabel ?? null,
      credentialId: connection?.credentialId ?? null,
      credentialLabel: connection?.credentialLabel ?? null,
      walletId: wallet?.id ?? null,
      pricingSource: c.source,
    };
    applyEntryMeta(entry, meta);
    log.debug('addEntry 即将写入', { model: entry.model, total: entry.total_tokens, usageSource: entry.usageSource || 'upstream' });
    state.history.unshift(entry);
    state.total_tokens += total; state.total_cost += lu.cost; state.input_tokens += hit + miss; state.output_tokens += comp;
    state.cache_hit_tokens += hit; state.cache_miss_tokens += miss; state.input_cost += lu.input_cost; state.output_cost += lu.output_cost;
    if (isDeepSeekOfficialModel(model)) state.rounds += 1;
    // 余额本地预扣；钱包存在时只扣钱包余额，未归属请求仍兼容旧全局余额。
    try {
      if (wallet) {
        const current = wallet.balance.amount == null || wallet.balance.amount === ''
          ? NaN
          : parseFloat(String(wallet.balance.amount));
        if (Number.isFinite(current)) {
          const cost = wallet.balance.currency === 'USD'
            ? lu.cost / getWalletExchangeRate()
            : lu.cost;
          wallet.balance.amount = (current - cost).toFixed(4);
          wallet.updatedAt = Date.now();
        }
      } else if (state.customBalance != null && String(state.customBalance).trim() !== '') {
        const cur = parseFloat(String(state.customBalance));
        if (!isNaN(cur)) state.customBalance = (cur - lu.cost).toFixed(4);
      } else if (state.balance && (state.balance as any).balance != null && String((state.balance as any).balance).trim() !== '') {
        const cur = parseFloat(String((state.balance as any).balance));
        if (!isNaN(cur)) {
          (state.balance as any).balance = (cur - lu.cost).toFixed(4);
          (state.balance as any).timestamp = Date.now();
        }
      }
    } catch {}
    if (state.history.length > MAX_HISTORY) {
      const overflow = state.history.slice(MAX_HISTORY);
      appendHistoryCold(overflow).catch(notifyStorageFailure);
      state.history = state.history.slice(0, MAX_HISTORY);
    }
    state.startTime = state.startTime || Date.now();
    persist();
    emit(DataEvents.HISTORY_ADDED, entry);
    return entry;
  },

  /**
   * Agent 模式写入：一次 Run = 一条历史，按 agentRunId 幂等 upsert（不追加）。
   * 终态才调用；重复调用会先回滚旧条目贡献再写入新值。
   * 与 addEntry 完全独立，常规对话链路不受影响。
   */
  async addAgentRunEntry(input: AgentRunEntryInput): Promise<any | null> {
    if (!input || typeof input !== 'object') return null;
    const runId = String(input.agentRunId || '').trim();
    if (!runId) return null;
    const hit = Number(input.hit) || 0;
    const miss = Number(input.miss) || 0;
    const comp = Number(input.comp) || 0;
    const total = Number(input.total) || hit + miss + comp;
    if (hit + miss + comp <= 0) {
      log.debug('addAgentRunEntry 跳过：全 0 token ' + runId);
      return null;
    }
    const shares = (Array.isArray(input.walletShares) && input.walletShares.length
      ? input.walletShares
      : [{
        walletId: input.walletId ?? null,
        timestamp: input.timestamp,
        model: input.model,
        hit,
        miss,
        comp,
        total,
        cost: Number(input.cost) || 0,
        inputCost: Number(input.inputCost) || 0,
        outputCost: Number(input.outputCost) || 0,
        priceType: input.priceType,
        pricingSource: input.pricingSource,
      }]) as any[];

    // 1) 同 Run 已存在于热历史 → 回滚后重建
    let existing = (state.history || []).findIndex((entry: any) => entry && entry.agentRunId === runId);
    if (existing >= 0) {
      rollbackAgentRunEntry(state.history[existing]);
      state.history.splice(existing, 1);
    } else {
      // 2) 也可能已溢流到冷历史
      try {
        const cold = await loadHistoryCold();
        const coldIndex = cold.findIndex((entry: any) => entry && entry.agentRunId === runId);
        if (coldIndex >= 0) {
          rollbackAgentRunEntry(cold[coldIndex]);
          cold.splice(coldIndex, 1);
          await saveHistoryCold(cold);
        }
      } catch {}
    }

    const connection = input.connection;
    const now = Date.now();
    const entry: any = {
      timestamp: Number(input.timestamp) || now,
      model: normalizeModel(String(input.model || 'unknown')),
      requestId: 'agent:' + runId,
      prompt_tokens: hit + miss,
      cache_hit_tokens: hit,
      cache_miss_tokens: miss,
      completion_tokens: comp,
      total_tokens: total,
      input_cost: Number(input.inputCost) || 0,
      output_cost: Number(input.outputCost) || 0,
      cost: Number(input.cost) || 0,
      cache_hit_rate: hit + miss > 0 ? (hit / (hit + miss)) * 100 : 0,
      priceType: input.priceType || 'old',
      raw_usage: {
        prompt_tokens: hit + miss,
        cache_hit_tokens: hit,
        cache_miss_tokens: miss,
        completion_tokens: comp,
        total_tokens: total,
        agent: {
          version: 1,
          runId,
          status: input.status,
          profileId: input.profileId ?? null,
          modelTurns: Number(input.modelTurns) || 0,
          invocationCount: Number(input.invocationCount) || 1,
          stableChatId: input.stableChatId ?? null,
          messageIndex: input.messageIndex ?? null,
          generationType: input.generationType ?? null,
          committed: !!input.committed,
          partial: !!input.partial,
          wallClockMs: Number(input.wallClockMs) || 0,
          turns: (input.turns || []).map((turn) => ({
            round: turn.round,
            invocationId: turn.invocationId,
            model: turn.model,
            source: turn.source ?? null,
            providerFormat: turn.providerFormat ?? null,
            usage: turn.rawUsage ?? null,
            durationMs: turn.durationMs,
            timestamp: turn.timestamp,
            cost: turn.cost,
          })),
          walletBreakdown: shares.map((share) => ({
            walletId: share.walletId ?? null,
            timestamp: share.timestamp,
            model: share.model,
            hit: share.hit,
            miss: share.miss,
            comp: share.comp,
            total: share.total,
            cost: share.cost,
            inputCost: share.inputCost,
            outputCost: share.outputCost,
            priceType: share.priceType,
            pricingSource: share.pricingSource,
          })),
        },
      },
      messages: [],
      duration: Number(input.duration) || 0,
      ttft: 0,
      thinkTime: 0,
      thinkTokens: Number(input.thinkTokens) || 0,
      tokenRate: 0,
      fullRequest: input.fullRequest ?? null,
      fullResponse: null,
      finishReason: null,
      isTruncated: false,
      streamed: null,
      chatId: input.chatId ?? getCurrentChatId(),
      chatName: input.chatName ?? getCurrentChatName(),
      sourceType: connection?.sourceType ?? null,
      endpointId: connection?.endpointId ?? null,
      endpointLabel: connection?.endpointLabel ?? null,
      credentialId: connection?.credentialId ?? null,
      credentialLabel: connection?.credentialLabel ?? null,
      walletId: input.walletId ?? shares[0]?.walletId ?? null,
      pricingSource: input.pricingSource || 'unpriced',
      origin: 'agent',
      agentRunId: runId,
      agentProfileId: input.profileId ?? null,
      agentStatus: input.status ?? null,
      agentModelTurns: Number(input.modelTurns) || 0,
      agentInvocationCount: Number(input.invocationCount) || 1,
      agentStableChatId: input.stableChatId ?? null,
      agentMessageIndex: input.messageIndex ?? null,
      agentGenerationType: input.generationType ?? null,
      agentCommitted: !!input.committed,
      agentPartial: !!input.partial,
      agentTimingSource: 'events',
    };

    state.history.unshift(entry);
    state.total_tokens += total;
    state.total_cost += entry.cost;
    state.input_tokens += hit + miss;
    state.output_tokens += comp;
    state.cache_hit_tokens += hit;
    state.cache_miss_tokens += miss;
    state.input_cost += entry.input_cost;
    state.output_cost += entry.output_cost;
    // 轮次口径与 aggregateHistory / rebuildAggregates 保持一致，避免刷新后 rounds 漂移
    if (isDeepSeekOfficialModel(entry.model)) state.rounds += 1;
    // 多钱包 Run 按分项分别预扣，避免只扣主钱包导致余额偏差
    for (const share of shares) adjustWalletBalance(share?.walletId ?? null, Number(share?.cost) || 0, 1);

    if (state.history.length > MAX_HISTORY) {
      const overflow = state.history.slice(MAX_HISTORY);
      appendHistoryCold(overflow).catch(notifyStorageFailure);
      state.history = state.history.slice(0, MAX_HISTORY);
    }
    state.startTime = state.startTime || Date.now();
    persist();
    emit(DataEvents.HISTORY_ADDED, entry);
    return entry;
  },

  async recalcAll(preloadedCold?: any[]): Promise<boolean> {
    let changed = false;
    for (const h of state.history || []) {
      const wallet = findWalletForHistory(state.wallets, h);
      const previous = {
        input: Number(h.input_cost) || 0,
        output: Number(h.output_cost) || 0,
        total: Number(h.cost) || 0,
      };
      const c = recalcEntryCost(h, wallet);
      if (costPatchDiffers(h, c)) changed = true;
      applyCostPatch(h, c);
      applyTotalDelta(previous, c);
      const rate = hitRateOf(h);
      if (h.cache_hit_rate !== rate) {
        h.cache_hit_rate = rate;
        changed = true;
      }
    }
    const providedCold = Array.isArray(preloadedCold);
    try {
      // 调用方已读过冷库就直接复用，避免同一轮启动反复 JSON.parse 整份冷历史
      const cold = providedCold ? (preloadedCold as any[]) : await loadHistoryCold();
      let coldChanged = false;
      for (const h of cold) {
        const wallet = findWalletForHistory(state.wallets, h);
        const previous = {
          input: Number(h.input_cost) || 0,
          output: Number(h.output_cost) || 0,
          total: Number(h.cost) || 0,
        };
        const c = recalcEntryCost(h, wallet);
        if (costPatchDiffers(h, c)) coldChanged = true;
        applyCostPatch(h, c);
        applyTotalDelta(previous, c);
        const rate = hitRateOf(h);
        if (h.cache_hit_rate !== rate) {
          h.cache_hit_rate = rate;
          coldChanged = true;
        }
      }
      if (coldChanged) {
        changed = true;
        // 传入冷库时由调用方统一落盘（可和清洗/迁移的改动合并成一次写）
        if (!providedCold) await saveHistoryCold(cold);
      }
    } catch (error) {
      log.error('冷历史重算失败', error);
    }
    persist();
    if (!providedCold) refreshCalcFingerprint();
    return changed;
  },

  async rebuildAggregates(): Promise<void> {
    await rebuildAggregates();
    persist();
  },

  async recalcWallet(walletId: string): Promise<number> {
    const wallet = state.wallets.find((item) => item.id === walletId) || null;
    if (!wallet) return 0;
    let changed = 0;
    for (const h of state.history || []) {
      const sourceWallet = findWalletForHistory(state.wallets, h);
      if (sourceWallet?.id !== wallet.id && h.legacyPricingWalletId !== wallet.id) continue;
      const previous = {
        input: Number(h.input_cost) || 0,
        output: Number(h.output_cost) || 0,
        total: Number(h.cost) || 0,
      };
      const c = recalcEntryCost(h, sourceWallet || wallet);
      applyCostPatch(h, c);
      applyTotalDelta(previous, c);
      h.cache_hit_rate = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) > 0 ? ((h.cache_hit_tokens || 0) / ((h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0)) * 100) : 0;
      changed++;
    }
    try {
      const cold = await loadHistoryCold();
      let coldChanged = false;
      for (const h of cold) {
        const sourceWallet = findWalletForHistory(state.wallets, h);
        if (sourceWallet?.id !== wallet.id && h.legacyPricingWalletId !== wallet.id) continue;
        const previous = {
          input: Number(h.input_cost) || 0,
          output: Number(h.output_cost) || 0,
          total: Number(h.cost) || 0,
        };
        const c = recalcEntryCost(h, sourceWallet || wallet);
        applyCostPatch(h, c);
        applyTotalDelta(previous, c);
        coldChanged = true;
        changed++;
      }
      if (coldChanged) await saveHistoryCold(cold);
    } catch {}
    persist();
    // 费用变了就得广播：历史页/统计页的缓存都挂在 UPDATED 上，否则重算完仍显示旧数字
    if (changed > 0) emit(DataEvents.UPDATED);
    return changed;
  },

  async replaceAll(next: Partial<Snapshot> & any, options: { clearCold?: boolean } = {}): Promise<void> {
    if (next.history !== undefined) {
      let h = next.history as any[];
      // 清洗原型污染键
      h = h.map((e: any) => {
        if (!e || typeof e !== 'object') return e;
        for (const k of Object.keys(e)) if (isUnsafeKey(k)) delete e[k];
        return e;
      });
      if (h.length > MAX_HISTORY) {
        const overflow = h.slice(MAX_HISTORY);
        if (options.clearCold) await saveHistoryCold(overflow);
        else await appendHistoryCold(overflow);
        state.history = h.slice(0, MAX_HISTORY);
      } else {
        if (options.clearCold) await clearHistoryCold();
        state.history = h as any;
      }
      // 全量替换成空历史（清空 / 导入空包）时，原文库也一起清，别留孤儿数据
      if (!h.length) clearDetailStore().catch(() => {});
    } else if (options.clearCold) {
      await clearHistoryCold();
    }
    if (next.total_tokens !== undefined) state.total_tokens = next.total_tokens as any;
    if (next.total_cost !== undefined) state.total_cost = next.total_cost as any;
    if (next.input_tokens !== undefined) state.input_tokens = next.input_tokens as any;
    if (next.output_tokens !== undefined) state.output_tokens = next.output_tokens as any;
    if (next.cache_hit_tokens !== undefined) state.cache_hit_tokens = next.cache_hit_tokens as any;
    if (next.cache_miss_tokens !== undefined) state.cache_miss_tokens = next.cache_miss_tokens as any;
    if (next.input_cost !== undefined) state.input_cost = next.input_cost as any;
    if (next.output_cost !== undefined) state.output_cost = next.output_cost as any;
    if (next.rounds !== undefined) state.rounds = next.rounds as any;
    if (next.startTime !== undefined) state.startTime = next.startTime as any;
    // 兼容旧 saves 导入：合并至单一历史（聚合仅在外部未提供时自算，避免重复累加）
    if (next.saves) {
      let all: any[] = [...(state.history || [])];
      for (const s of Object.values(next.saves as any)) {
        const h = (s as any).history || [];
        all = all.concat(h);
      }
      all.sort((a: any, b: any) => b.timestamp - a.timestamp);
      const keyOf = historyRecordKey;
      const seen = new Set<string>();
      const dedup: any[] = [];
      for (const h of all) { const k = keyOf(h); if (!seen.has(k)) { seen.add(k); dedup.push(h); } }
      if (dedup.length > MAX_HISTORY) {
        const overflow = dedup.slice(MAX_HISTORY);
        await appendHistoryCold(overflow);
      }
      state.history = dedup.slice(0, MAX_HISTORY);
      if (next.total_tokens === undefined) {
        let tt = 0, tc = 0, it = 0, ot = 0, ch = 0, cm = 0, ic = 0, oc = 0;
        for (const h of state.history) {
          tt += h.total_tokens || 0; tc += h.cost || 0;
          it += (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0); ot += h.completion_tokens || 0;
          ch += h.cache_hit_tokens || 0; cm += h.cache_miss_tokens || 0;
          ic += h.input_cost || 0; oc += h.output_cost || 0;
        }
        state.total_tokens = tt as any; state.total_cost = tc as any; state.input_tokens = it as any;
        state.output_tokens = ot as any; state.cache_hit_tokens = ch as any; state.cache_miss_tokens = cm as any;
        state.input_cost = ic as any; state.output_cost = oc as any; state.rounds = state.history.length as any;
      }
    }
    if (next.settings !== undefined) {
      state.settings = normalizeSettings(next.settings);
      // 旧历史补 finishReason 并重算 isTruncated（兼容 sensitive/content_filter 等非正常结束）
      try {
        let need = false;
        for (const h of state.history as any[]) {
          if ((h as any).finishReason === undefined) { (h as any).finishReason = (h as any).raw_usage?.__finish_reason ?? null; need = true; }
          const t = isTruncatedFinish((h as any).finishReason);
          if ((h as any).isTruncated !== t) { (h as any).isTruncated = t; need = true; }
        }
        if (need) saveHot({ history: state.history } as any);
      } catch {}
    }
    if (next.balance !== undefined) state.balance = next.balance;
    if (next.customBalance !== undefined) state.customBalance = next.customBalance as any;
    if (next.wallets !== undefined) state.wallets = normalizeWallets(next.wallets, state.settings, Date.now());
    if (next.walletIgnored !== undefined) {
      state.walletIgnored = Array.isArray(next.walletIgnored)
        ? Array.from(new Set(next.walletIgnored.map((id: unknown) => String(id || '').trim()).filter(Boolean)))
        : [];
    }
    if (next.messageCount !== undefined) state.messageCount = next.messageCount as any;
    if (next.lastUsage !== undefined) state.lastUsage = next.lastUsage as any;
    persist();
    if (next.settings) emit(DataEvents.SETTINGS_CHANGED);
    if (next.wallets !== undefined || next.walletIgnored !== undefined) emit(DataEvents.SETTINGS_CHANGED);
    if (next.balance !== undefined || next.customBalance !== undefined) emit(DataEvents.BALANCE_CHANGED);
  },

  pruneZeroEntries() {
    const before = (state.history || []).length;
    const filtered = (state.history || []).filter((h: any) => {
      const isZero = h.total_tokens === 0 && h.prompt_tokens === 0 && h.completion_tokens === 0 && h.cache_hit_tokens === 0 && h.cache_miss_tokens === 0;
      const isFakeTokenCount = !!(h.raw_usage && (h.raw_usage as any)._from_token_count);
      const isDebug = (h as any)._debug === true;
      return !(isZero || isFakeTokenCount || isDebug);
    });
    if (filtered.length !== before) {
      state.history = filtered as any;
      // 重算聚合，避免 totals 包含零条目影响
      let total_tokens = 0, total_cost = 0, input_tokens = 0, output_tokens = 0, cache_hit_tokens = 0, cache_miss_tokens = 0, input_cost = 0, output_cost = 0, rounds = 0;
      for (const h of filtered) {
        total_tokens += h.total_tokens || 0;
        total_cost += h.cost || 0;
        input_tokens += (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0);
        output_tokens += h.completion_tokens || 0;
        cache_hit_tokens += h.cache_hit_tokens || 0;
        cache_miss_tokens += h.cache_miss_tokens || 0;
        input_cost += h.input_cost || 0;
        output_cost += h.output_cost || 0;
        rounds += 1;
      }
      state.total_tokens = total_tokens as any;
      state.total_cost = total_cost as any;
      state.input_tokens = input_tokens as any;
      state.output_tokens = output_tokens as any;
      state.cache_hit_tokens = cache_hit_tokens as any;
      state.cache_miss_tokens = cache_miss_tokens as any;
      state.input_cost = input_cost as any;
      state.output_cost = output_cost as any;
      state.rounds = rounds as any;
      persist();
      log.debug('已自动清理 ' + (before - filtered.length) + ' 条全 0 污染条目');
    }
    return filtered.length;
  },

  async hydrate() {
    const hot: any = await loadHot();
    if (hot) {
      if (hot.history) state.history = hot.history;
      if (hot.total_tokens !== undefined) state.total_tokens = hot.total_tokens;
      if (hot.total_cost !== undefined) state.total_cost = hot.total_cost;
      if (hot.input_tokens !== undefined) state.input_tokens = hot.input_tokens;
      if (hot.output_tokens !== undefined) state.output_tokens = hot.output_tokens;
      if (hot.cache_hit_tokens !== undefined) state.cache_hit_tokens = hot.cache_hit_tokens;
      if (hot.cache_miss_tokens !== undefined) state.cache_miss_tokens = hot.cache_miss_tokens;
      if (hot.input_cost !== undefined) state.input_cost = hot.input_cost;
      if (hot.output_cost !== undefined) state.output_cost = hot.output_cost;
      if (hot.rounds !== undefined) state.rounds = hot.rounds;
      if (hot.startTime !== undefined) state.startTime = hot.startTime;
      if (hot.settings) state.settings = normalizeSettings(hot.settings);
      if (hot.balance) state.balance = hot.balance;
      if (hot.customBalance) state.customBalance = hot.customBalance;
      if (hot.wallets) state.wallets = normalizeWallets(hot.wallets, state.settings, Date.now());
      if (Array.isArray(hot.walletIgnored)) state.walletIgnored = hot.walletIgnored;
      if (hot.messageCount) state.messageCount = hot.messageCount;
      if (hot.lastUsage) state.lastUsage = hot.lastUsage;
    }
    // 迁移：旧设置无 historyScope 时补默认值 all
    if (!(state.settings as any).historyScope) {
      (state.settings as any).historyScope = 'all';
      try { saveHot({ settings: state.settings }); } catch {}
    }
    if (!(state.settings as any).overviewWalletId) {
      (state.settings as any).overviewWalletId = DEEPSEEK_WALLET_ID;
      (state.settings as any).overviewWalletManuallySet = false;
      try { saveHot({ settings: state.settings }); } catch {}
    }
    if ((state.settings as any).overviewWalletManuallySet !== true) {
      if ((state.settings as any).overviewWalletId === 'all') {
        (state.settings as any).overviewWalletId = DEEPSEEK_WALLET_ID;
      }
      (state.settings as any).overviewWalletManuallySet = true;
      try { saveHot({ settings: state.settings }); } catch {}
    }
    // 迁移：旧设置无 overviewFour 时补默认八块（兼容旧4块）
    if (!Array.isArray((state.settings as any).overviewFour) || ((state.settings as any).overviewFour.length !== 8 && (state.settings as any).overviewFour.length !== 4)) {
      (state.settings as any).overviewFour = ['avg_cost','avg_tokens','avg_duration','avg_rate','avg_input_tokens','avg_output_tokens','avg_hit_rate','max_total'];
      try { saveHot({ settings: state.settings }); } catch {}
    } else if ((state.settings as any).overviewFour.length === 4) {
      (state.settings as any).overviewFour = [...(state.settings as any).overviewFour, 'avg_input_tokens','avg_output_tokens','avg_hit_rate','max_total'];
      try { saveHot({ settings: state.settings }); } catch {}
    }
    if (typeof (state.settings as any).modelsPricingCollapsed !== 'boolean') {
      (state.settings as any).modelsPricingCollapsed = true;
      try { saveHot({ settings: state.settings }); } catch {}
    }
    // 迁移：「移动端兼容 UI」的初值只决定一次——老版本没有这个键时按设备类型补上
    // （移动端默认开启底栏，桌面端保持原样），随后立刻写进设置；以后再升级都以用户的选择为准。
    if (typeof (state.settings as any).mobileCompatUi !== 'boolean') {
      (state.settings as any).mobileCompatUi = mobileDeviceHint();
      try { saveHot({ settings: state.settings }); } catch {}
    }
    if (!Array.isArray((state.settings as any).statsFour) || (state.settings as any).statsFour.length !== 4) {
      (state.settings as any).statsFour = ['avg_cost','avg_tokens','avg_think_ratio','truncation_rate'];
      try { saveHot({ settings: state.settings }); } catch {}
    } else {
      try {
        const validStats = new Set(['avg_cost','avg_tokens','avg_duration','avg_rate','avg_ttft','avg_input_cost','avg_input_tokens','avg_output_cost','avg_output_tokens','avg_think_time','avg_think_tokens','avg_think_ratio','truncation_rate','avg_hit_rate','latest_hit_rate','max_output','max_input','max_total']);
        let cur: any[] = (state.settings as any).statsFour;
        if (cur.some((k:any)=> !validStats.has(k))) {
          (state.settings as any).statsFour = ['avg_cost','avg_tokens','avg_think_ratio','truncation_rate'];
          try { saveHot({ settings: state.settings }); } catch {}
        }
      } catch {}
    }
    // 迁移：pricingSync（无全局开关：币种由钱包 currency 决定，同步由钱包 catalogProvider 决定；汇率 7.2，自动同步仅手动）
    if (!(state.settings as any).pricingSync) {
      (state.settings as any).pricingSync = { mode: 'add-missing', exchangeRate: 7.2, useLiveRate: true, autoIntervalHours: 0, lastSync: null, lastRateFetch: null, showSyncedModels: false, syncedMarkVersion: 0 };
      try { saveHot({ settings: state.settings }); } catch {}
    } else {
      try {
        const def:any = { enabled:false, mode:'add-missing', exchangeRate:7.2, useLiveRate:true, autoIntervalHours:0, lastSync:null, lastRateFetch:null, showSyncedModels:false, syncedMarkVersion:0 };
        const ps:any=(state.settings as any).pricingSync;
        for(const k of Object.keys(def)) if(ps[k]===undefined) ps[k]=def[k];
        const r=parseFloat(String(ps.exchangeRate));
        if(!isFinite(r)||r<=0) ps.exchangeRate=7.2;
        if(typeof ps.showSyncedModels!=='boolean') ps.showSyncedModels=false;
        if(!isFinite(parseFloat(String(ps.syncedMarkVersion)))) ps.syncedMarkVersion=0;
        try{ saveHot({settings:state.settings}); }catch{}
      } catch {}
    }
    // 冷历史全程只读一次：清洗 / 钱包迁移 / 重算 / 聚合都复用这份数组，不再反复 JSON.parse 整份冷库
    let cold: any[] = [];
    try { cold = await loadHistoryCold(); } catch (error) { log.error('冷历史读取失败', error); }
    // 启动重算门控：拿「计价输入指纹」与上次落盘值比对。一致说明版本、钱包规则与峰谷都没动，
    // 老记录的金额依然有效，整段清洗/迁移/重算都可以跳过；不一致（首次升级、改价、改峰谷、
    // 指纹缺失）才走完整流程。日常只是历史变多不再触发整库重算与整份重写。
    const storedFingerprint = hot && typeof hot[CALC_FINGERPRINT_KEY] === 'string' ? String(hot[CALC_FINGERPRINT_KEY]) : '';
    // 接入身份换代（见 ENDPOINT_IDENTITY_VERSION）必须走一次完整迁移：钱包按新算法去重合并、
    // 历史条目改挂到合并后的钱包，再整库重算——不然只重发产物的同版本升级永远修不好 0 元记录。
    const identityDone = Number((hot as any)?.[ENDPOINT_IDENTITY_KEY] || 0) >= ENDPOINT_IDENTITY_VERSION;
    const needFullRecalc = storedFingerprint !== computeCalcFingerprint() || !identityDone;
    let coldDirty = false;
    if (needFullRecalc) {
      // 迁移：旧历史补 finishReason 并重算 isTruncated（兼容 sensitive/content_filter 等非正常结束）
      try {
        let need = false;
        for (const h of state.history as any[]) {
          if ((h as any).finishReason === undefined) { (h as any).finishReason = (h as any).raw_usage?.__finish_reason ?? null; need = true; }
          const t = isTruncatedFinish((h as any).finishReason);
          if ((h as any).isTruncated !== t) { (h as any).isTruncated = t; need = true; }
        }
        if (need) try { saveHot({ history: state.history } as any); } catch {}
      } catch {}
      // 迁移：旧历史无 chatId 时尝试回填（无法精确回溯则保留 null，按 all 展示）
      let needPersistChatId = false;
      for (const h of state.history || []) {
        if ((h as any).chatId === undefined) {
          (h as any).chatId = null;
          (h as any).chatName = null;
          needPersistChatId = true;
        }
      }
      if (needPersistChatId) try { saveHot({ history: state.history }); } catch {}
      // 迁移：清洗非流式/假流式造成的异常速率与失真 TTFT（>1000 t/s，或 TTFT≈总耗时）
      try {
        for (const h of state.history || []) sanitizeHistoryTiming(h);
        for (const h of cold) {
          if (sanitizeHistoryTiming(h)) coldDirty = true;
        }
      } catch {}
      if (migrateWallets(hot, cold)) {
        try { saveHot({ wallets: state.wallets, walletIgnored: state.walletIgnored }); } catch {}
        // 冷条目可能被补了 endpointId / walletId，稍后与重算结果合并写一次
        if (cold.length) coldDirty = true;
      }
      // 自动清理历史中的全 0 污染条目（由之前 token_count 误判产生）
      try { this.pruneZeroEntries(); } catch {}
      // 对历史成本按归一化模型重算，修复 [masa]/[OR] 前缀导致的 0 费用
      try { if (await this.recalcAll(cold)) coldDirty = true; } catch {}
      // 迁移全部跑完才落身份版本号：中途抛错下次启动还会再试一遍
      if (!identityDone) {
        try {
          saveHot({ [ENDPOINT_IDENTITY_KEY]: ENDPOINT_IDENTITY_VERSION } as any);
          if (hot && typeof hot === 'object') hot[ENDPOINT_IDENTITY_KEY] = ENDPOINT_IDENTITY_VERSION;
        } catch {}
      }
    }
    // 迁移：清掉「一次请求被多层包装各写一遍」留下的同轮重复条目（先备份再删，幂等）
    try {
      const hotDedup = dropDuplicateTurns(state.history);
      if (hotDedup.removed.length) {
        state.history = hotDedup.kept;
        backupDroppedTurns(hotDedup.removed);
        try { saveHot({ history: state.history }); } catch {}
      }
      const coldDedup = dropDuplicateTurns(cold);
      if (coldDedup.removed.length) {
        cold.splice(0, cold.length, ...coldDedup.kept);
        backupDroppedTurns(coldDedup.removed);
        coldDirty = true;
      }
    } catch {}
    // 迁移：非流式记录补估算速率（条目级幂等，不依赖上面的整库重算门控——
    // 只重发产物的同版本升级也要能看到估算值）
    try {
      if (backfillEstimatedRates(state.history)) { try { saveHot({ history: state.history }); } catch {} }
      if (backfillEstimatedRates(cold)) coldDirty = true;
    } catch {}
    // 冷库只在确有改动时写一次（原来无论是否变化都整份重写）
    if (coldDirty) { try { await saveHistoryCold(cold); } catch {} }
    // 热缓存聚合字段必须与热+冷全量历史一致，避免概览与统计页出现两套总额
    try { await rebuildAggregates(cold); } catch {}
    persist();
    // 计价输入全部处理完才落指纹，下次启动一致即整段跳过
    if (needFullRecalc) refreshCalcFingerprint();
    emit(DataEvents.UPDATED);
    return this.snapshot();
  },
};
