import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import { PRICING, HIDDEN_PRICING_MODELS, PRICING_SYNC_SOURCE, PRICING_SYNC_FALLBACK, DEFAULT_EXCHANGE_RATE } from '../constants/pricing';
import { getWalletExchangeRate } from './currency';
import { isDeepSeekOfficialModel, normalizeModel } from './pricing';
import { log, toast } from '../utils/logger';
import { repository } from '../data/repository';
import { cloneWallet, findWalletModel } from '../data/wallets';
import type { WalletConfig, WalletModel } from '../types/wallet';

export type SyncPreview = { added: number; updated: number; skipped: number; total: number; samples: Array<{ model: string; hit: number; miss: number; output: number }> };

/** 同步模型标记迁移版本：递增可让更早版本污染的数据重新识别 */
export const SYNCED_MARK_VERSION = 1;

/** 是否为 models.dev 同步写入的价格条目（默认不在“模型与价格”列表显示） */
export function isSyncedCustomModel(entry: any): boolean {
  return !!entry && entry.synced === true;
}

/** 内置模型键（含隐藏内置），这些模型不参与同步模型判定 */
function builtinModelKeys(): Set<string> {
  return new Set<string>([...Object.keys(PRICING), ...(HIDDEN_PRICING_MODELS || [])]);
}

/** 两套价格是否基本一致（同步时汇率/实时汇率可能变化，给 5% 容差） */
function priceClose(a: any, b: any, tol = 0.05): boolean {
  for (const f of ['hit', 'miss', 'output']) {
    const x = parseFloat(String(a?.[f]));
    const y = parseFloat(String(b?.[f]));
    if (!isFinite(x) || !isFinite(y)) return false;
    const base = Math.max(Math.abs(x), Math.abs(y));
    if (base === 0) continue;
    if (Math.abs(x - y) / base > tol) return false;
  }
  return true;
}

/** 移除全部 models.dev 同步条目（关闭自动同步时调用），返回移除数量 */
export function removeSyncedModels(): number {
  const cms: any[] = (state.settings as any).customModels || [];
  const kept = cms.filter((c: any) => c?.synced !== true);
  let removed = cms.length - kept.length;
  (state.settings as any).customModels = kept;
  const nextWallets = repository.getWallets().map((wallet) => {
    const next = cloneWallet(wallet);
    const before = next.models.length;
    next.models = next.models.filter((model) => !(model.source === 'sync' && !model.locked));
    removed += before - next.models.length;
    return next;
  });
  if (removed > 0) repository.replaceWallets(nextWallets);
  try { saveHot({ settings: state.settings }); } catch {}
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  log.debug('synced models removed', { removed });
  return removed;
}

function toCNY(usd: number, rate: number): number {
  return Math.round(usd * rate * 10000) / 10000;
}

function normalizeCost(c: any): { hit: number; miss: number; output: number } | null {
  if (!c || typeof c !== 'object') return null;
  const hitRaw = c.cache_read ?? c.cacheRead ?? c.cached_tokens;
  const missRaw = c.input;
  const outRaw = c.output ?? c.reasoning;
  const hit = hitRaw != null ? parseFloat(String(hitRaw)) : NaN;
  const miss = missRaw != null ? parseFloat(String(missRaw)) : NaN;
  const out = outRaw != null ? parseFloat(String(outRaw)) : NaN;
  if (!isFinite(miss) || !isFinite(out)) return null;
  const h = isFinite(hit) ? hit : miss;
  return { hit: h, miss, output: out };
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal as any, cache: 'no-store' as any });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(to); }
}

export async function fetchModelsDevCatalog(): Promise<any> {
  const urls = [PRICING_SYNC_SOURCE, PRICING_SYNC_FALLBACK, 'https://models.dev/catalog.json'];
  let lastErr: any = null;
  for (const u of urls) {
    try { return await fetchJson(u); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('fetch failed');
}

function buildCustomModelsFromCatalog(catalog: any, rate: number): Array<{ model: string; usePeakPricing: boolean; offpeak: { hit: number; miss: number; output: number }; peak: { hit: number; miss: number; output: number } }> {
  const out: any[] = [];
  if (!catalog || typeof catalog !== 'object') return out;
  for (const providerId of Object.keys(catalog)) {
    const provider = catalog[providerId];
    const models = provider?.models;
    if (!models || typeof models !== 'object') continue;
    for (const modelId of Object.keys(models)) {
      const m = models[modelId];
      const cost = m?.cost;
      const norm = normalizeCost(cost);
      if (!norm) continue;
      const cnHit = toCNY(norm.hit, rate);
      const cnMiss = toCNY(norm.miss, rate);
      const cnOut = toCNY(norm.output, rate);
      const usePeak = isDeepSeekOfficialModel(modelId);
      const entry: any = {
        model: modelId,
        usePeakPricing: usePeak,
        offpeak: { hit: cnHit, miss: cnMiss, output: cnOut },
        peak: usePeak ? { hit: toCNY(norm.hit * 2, 1) ? cnHit * 2 : cnHit * 2, miss: cnMiss * 2, output: cnOut * 2 } : { hit: cnHit, miss: cnMiss, output: cnOut },
        // 标记来源：默认在“模型与价格”列表中隐藏，仅参与计价
        synced: true,
      };
      // 峰谷合成按 2× 谷，与常量一致
      if (usePeak) {
        entry.peak.hit = Math.round(cnHit * 2 * 10000) / 10000;
        entry.peak.miss = Math.round(cnMiss * 2 * 10000) / 10000;
        entry.peak.output = Math.round(cnOut * 2 * 10000) / 10000;
      }
      out.push(entry);
    }
  }
  return out;
}

type CatalogPrice = {
  model: string;
  usePeakPricing: boolean;
  offpeak: { hit: number; miss: number; output: number };
  peak: { hit: number; miss: number; output: number };
};

function buildProviderModelsFromCatalog(catalog: any, providerId: string, rate: number): CatalogPrice[] {
  const provider = catalog?.[providerId];
  const models = provider?.models;
  if (!models || typeof models !== 'object') return [];
  const out: CatalogPrice[] = [];
  for (const modelId of Object.keys(models)) {
    const cost = normalizeCost((models as any)[modelId]?.cost);
    if (!cost) continue;
    const hit = toCNY(cost.hit, rate);
    const miss = toCNY(cost.miss, rate);
    const output = toCNY(cost.output, rate);
    const usePeak = isDeepSeekOfficialModel(modelId);
    out.push({
      model: modelId,
      usePeakPricing: usePeak,
      offpeak: { hit, miss, output },
      peak: usePeak
        ? {
            hit: Math.round(hit * 2 * 10000) / 10000,
            miss: Math.round(miss * 2 * 10000) / 10000,
            output: Math.round(output * 2 * 10000) / 10000,
          }
        : { hit, miss, output },
    });
  }
  return out;
}

function sameCatalogPrice(model: WalletModel, incoming: CatalogPrice): boolean {
  return model.price.usePeakPricing === incoming.usePeakPricing
    && model.price.offpeak.hit === incoming.offpeak.hit
    && model.price.offpeak.miss === incoming.offpeak.miss
    && model.price.offpeak.output === incoming.offpeak.output
    && model.price.peak.hit === incoming.peak.hit
    && model.price.peak.miss === incoming.peak.miss
    && model.price.peak.output === incoming.peak.output;
}

function applyCatalogToWallet(
  wallet: WalletConfig,
  incoming: CatalogPrice[],
  mode: string,
  counts: { added: number; updated: number; skipped: number },
  samples: SyncPreview['samples'],
  affected: Set<string>,
): WalletConfig {
  if (!wallet.catalogProvider || !incoming.length) return wallet;
  const next = cloneWallet(wallet);
  const now = Date.now();
  for (const price of incoming) {
    const existing = findWalletModel(next, price.model);
    if (!existing) {
      next.models.push({
        id: `sync:${wallet.id}:${price.model}`,
        sourceModel: price.model,
        model: price.model,
        aliases: [],
        price: {
          usePeakPricing: price.usePeakPricing,
          offpeak: { ...price.offpeak },
          peak: { ...price.peak },
          priceConfigured: true,
        },
        source: 'sync',
        locked: false,
        discoveredAt: now,
        lastSeen: now,
        updatedAt: now,
      });
      counts.added++;
      affected.add(wallet.id);
      if (samples.length < 6) samples.push({ model: price.model, ...price.offpeak });
      continue;
    }
    if (mode === 'add-missing') {
      counts.skipped++;
      continue;
    }
    if (existing.locked && mode !== 'overwrite-all') {
      counts.skipped++;
      continue;
    }
    if (sameCatalogPrice(existing, price)) {
      if (existing.source !== 'sync') {
        existing.source = 'sync';
        existing.updatedAt = now;
        affected.add(wallet.id);
      }
      counts.skipped++;
      continue;
    }
    existing.price = {
      usePeakPricing: price.usePeakPricing,
      offpeak: { ...price.offpeak },
      peak: { ...price.peak },
      priceConfigured: true,
    };
    existing.source = 'sync';
    existing.updatedAt = now;
    counts.updated++;
    affected.add(wallet.id);
    if (samples.length < 6) samples.push({ model: price.model, ...price.offpeak });
  }
  return next;
}

export function previewSync(catalog: any): SyncPreview {
  const rate = getWalletExchangeRate() || DEFAULT_EXCHANGE_RATE;
  const mode: string = (state.settings as any).pricingSync?.mode || 'add-missing';
  const samples: any[] = [];
  const counts = { added: 0, updated: 0, skipped: 0 };
  let total = 0;
  const ignored = new Set(state.walletIgnored || []);
  for (const wallet of state.wallets || []) {
    if (ignored.has(wallet.id) || !wallet.catalogProvider) continue;
    const incoming = buildProviderModelsFromCatalog(catalog, wallet.catalogProvider, rate);
    total += incoming.length;
    applyCatalogToWallet(
      wallet,
      incoming,
      mode,
      counts,
      samples,
      new Set(),
    );
  }
  return { added: counts.added, updated: counts.updated, skipped: counts.skipped, total, samples };
}

export async function syncPricingFromModelsDev(opts?: { silent?: boolean; force?: boolean }): Promise<SyncPreview | null> {
  const silent = !!opts?.silent;
  const ps: any = (state.settings as any).pricingSync;
  if (!ps) return null;
  try {
    const catalog = await fetchModelsDevCatalog();
    const rate = getWalletExchangeRate() || DEFAULT_EXCHANGE_RATE;
    const ignored = new Set(state.walletIgnored || []);
    const counts = { added: 0, updated: 0, skipped: 0 };
    const samples: SyncPreview['samples'] = [];
    const affected = new Set<string>();
    let total = 0;
    const nextWallets = repository.getWallets().map((wallet) => {
      if (ignored.has(wallet.id) || !wallet.catalogProvider) return wallet;
      const incoming = buildProviderModelsFromCatalog(catalog, wallet.catalogProvider, rate);
      total += incoming.length;
      return applyCatalogToWallet(wallet, incoming, ps.mode || 'add-missing', counts, samples, affected);
    });
    if (!total) {
      if (!silent) toast('warning', 'models.dev 未返回可用价格');
      return null;
    }
    repository.replaceWallets(nextWallets);
    ps.lastSync = Date.now();
    saveHot({ settings: state.settings });
    if (ps.recalcOnSync) {
      for (const walletId of affected) {
        try { await repository.recalcWallet(walletId); } catch {}
      }
    }
    try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    const preview: SyncPreview = { ...counts, total, samples };
    if (!silent) toast('success', `价格已同步：新增 ${counts.added} 更新 ${counts.updated} 跳过 ${counts.skipped}（共 ${total} 个钱包模型）`);
    log.debug('pricing sync done', preview);
    return preview;
  } catch (e: any) {
    log.error('pricing sync failed', e);
    if (!silent) toast('error', '同步失败：' + (e?.message || e));
    return null;
  }
}

let pricingTimer: any = null;
export function restartPricingSyncTimer() {
  if (pricingTimer) { try { clearInterval(pricingTimer); } catch {} pricingTimer = null; }
  const ps: any = (state.settings as any).pricingSync;
  if (!ps?.enabled) return;
  const hours = parseInt(String(ps.autoIntervalHours)) || 0;
  if (!hours || hours <= 0) return;
  pricingTimer = setInterval(() => { syncPricingFromModelsDev({ silent: true }).catch(() => {}); }, hours * 60 * 60 * 1000);
}
export function stopPricingSyncTimer() {
  if (pricingTimer) { try { clearInterval(pricingTimer); } catch {} pricingTimer = null; }
}

/**
 * 迁移：早期版本把 models.dev 全量模型直接写进 customModels 且未加标记，
 * 导致设置页“模型与价格”列表被同步模型刷屏。
 * 这里按 models.dev 目录 + 汇率比对补上 synced 标记，使其从列表中隐藏（价格仍照常参与计价）。
 * 返回 null 表示本次未能完成（网络不可用等），下次启动会重试。
 */
export async function markLegacySyncedModels(opts?: { skipRerender?: boolean }): Promise<{ marked: number; scanned: number } | null> {
  const ps: any = (state.settings as any).pricingSync;
  if (!ps) return null;
  if (Number(ps.syncedMarkVersion) >= SYNCED_MARK_VERSION) return { marked: 0, scanned: 0 };
  // 从未同步过的用户不可能存在同步污染：直接落版本号，避免多打一次网络请求
  if (!ps.enabled && !ps.lastSync) {
    ps.syncedMarkVersion = SYNCED_MARK_VERSION;
    try { saveHot({ settings: state.settings }); } catch {}
    return { marked: 0, scanned: 0 };
  }
  const cms: any[] = (state.settings as any).customModels || [];
  if (!cms.length) {
    ps.syncedMarkVersion = SYNCED_MARK_VERSION;
    try { saveHot({ settings: state.settings }); } catch {}
    return { marked: 0, scanned: 0 };
  }
  const builtin = builtinModelKeys();
  const pending = cms.filter((c: any) => c?.model && c.synced !== true && !builtin.has(c.model));
  if (!pending.length) {
    ps.syncedMarkVersion = SYNCED_MARK_VERSION;
    try { saveHot({ settings: state.settings }); } catch {}
    return { marked: 0, scanned: 0 };
  }
  const used = new Set<string>();
  for (const h of (state.history || []) as any[]) {
    try { if (h?.model) used.add(normalizeModel(h.model)); } catch {}
  }
  let catalog: any = null;
  try { catalog = await fetchModelsDevCatalog(); } catch { catalog = null; }
  let marked = 0;
  if (catalog) {
    const rate = getWalletExchangeRate() || DEFAULT_EXCHANGE_RATE;
    const catalogEntries = buildCustomModelsFromCatalog(catalog, rate);
    const byName = new Map<string, any>(catalogEntries.map((e: any) => [e.model, e]));
    for (const c of pending) {
      const inc = byName.get(c.model);
      if (inc && priceClose(c.offpeak, inc.offpeak)) { c.synced = true; marked++; }
    }
    const nextWallets = repository.getWallets().map((wallet) => cloneWallet(wallet));
    let walletMarked = false;
    for (const wallet of nextWallets) {
      for (const model of wallet.models) {
        if (model.source === 'builtin' || model.locked || model.source === 'sync') continue;
        const inc = byName.get(model.sourceModel) || byName.get(model.model);
        if (inc && priceClose(model.price.offpeak, inc.offpeak)) {
          model.source = 'sync';
          model.updatedAt = Date.now();
          walletMarked = true;
        }
      }
    }
    if (walletMarked) repository.replaceWallets(nextWallets);
  } else if (pending.length >= 40) {
    // 离线兜底：出现大量额外模型即同步全量污染特征，仅保留历史使用过的模型
    for (const c of pending) {
      try { if (used.has(normalizeModel(c.model))) continue; } catch {}
      c.synced = true;
      marked++;
    }
  } else {
    // 网络不可用且无污染特征，保持原状等待下次重试
    return null;
  }
  // 联网比对成功才落版本号；离线兜底不落，便于后续联网精确复核剩余条目
  if (catalog) ps.syncedMarkVersion = SYNCED_MARK_VERSION;
  if (marked) {
    try { saveHot({ settings: state.settings }); } catch {}
    try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    if (!opts?.skipRerender) {
      try {
        const { renderSettings } = await import('../ui/settings');
        const doc: any = (window.parent as any)?.document ?? document;
        if (doc?.getElementById('aus-settings')) renderSettings(doc);
      } catch {}
    }
  } else if (catalog) {
    try { saveHot({ settings: state.settings }); } catch {}
  }
  log.debug('synced model markers migrated', { marked, scanned: pending.length });
  return { marked, scanned: pending.length };
}
