import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import { PRICING, HIDDEN_PRICING_MODELS, PRICING_SYNC_SOURCE, PRICING_SYNC_FALLBACK, DEFAULT_EXCHANGE_RATE } from '../constants/pricing';
import { getWalletExchangeRate } from './currency';
import { isDeepSeekOfficialModel, normalizeModel } from './pricing';
import { log, toast } from '../utils/logger';
import { repository } from '../data/repository';
import { cloneWallet } from '../data/wallets';
import { MODEL_MATCH_ACCEPT, matchModelName } from './model-match';
import type { WalletConfig, WalletPriceTier } from '../types/wallet';

export type SyncMode = 'add-missing' | 'overwrite-unlocked' | 'overwrite-all';

type Tier = { hit: number; miss: number; output: number };

/** 目录中的一条价格（已换算为显示货币体系：以 CNY 为内部计价单位） */
export type CatalogPrice = {
  catalogModel: string;
  usePeakPricing: boolean;
  offpeak: Tier;
  peak: Tier;
};

export type SyncRowAction = 'write' | 'update' | 'skip-locked' | 'skip-same' | 'unmatched';

export type SyncPlanRow = {
  /** 稳定键：walletId|modelId，供预览浮层勾选 */
  key: string;
  walletId: string;
  walletName: string;
  provider: string;
  modelId: string;
  localModel: string;
  catalogModel: string | null;
  score: number;
  reason: string;
  ambiguous: boolean;
  locked: boolean;
  action: SyncRowAction;
  changed: boolean;
  usePeakPricing: boolean;
  current: Tier | null;
  next: Tier | null;
  nextPeak: Tier | null;
};

export type SyncPlanSummary = {
  wallets: number;
  catalogModels: number;
  matched: number;
  exact: number;
  fuzzy: number;
  ambiguous: number;
  unmatched: number;
  write: number;
  update: number;
  skipped: number;
};

export type SyncPlan = {
  provider: string;
  providerLabel: string;
  mode: SyncMode;
  rate: number;
  createdAt: number;
  rows: SyncPlanRow[];
  summary: SyncPlanSummary;
};

/** 同步模型标记迁移版本：2 = 只按已识别模型模糊匹配写价（不再全量灌入） */
export const SYNCED_MARK_VERSION = 2;

/** 目录缓存有效期（内存） */
const CATALOG_TTL = 10 * 60 * 1000;
/** 自动同步节流：60s 内不重复拉取目录 */
const AUTO_SYNC_THROTTLE = 60 * 1000;

let catalogCache: { at: number; data: any } | null = null;
let lastAutoSync = 0;

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

function sameTier(a: Tier | null, b: Tier | null): boolean {
  if (!a || !b) return false;
  return a.hit === b.hit && a.miss === b.miss && a.output === b.output;
}

function toCNY(usd: number, rate: number): number {
  return Math.round(usd * rate * 10000) / 10000;
}

function normalizeCost(c: any): Tier | null {
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

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // 不加 cache:no-store：目录约 6MB，交给浏览器 HTTP 缓存复用
    const r = await fetch(url, { signal: ctrl.signal as any });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

/** 拉取 models.dev 目录（10 分钟内存缓存，force 可绕过） */
export async function fetchModelsDevCatalog(opts: { force?: boolean } = {}): Promise<any> {
  if (!opts.force && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.data;
  const urls = [PRICING_SYNC_SOURCE, PRICING_SYNC_FALLBACK];
  let lastErr: any = null;
  for (const u of urls) {
    try {
      const data = await fetchJson(u);
      catalogCache = { at: Date.now(), data };
      return data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('fetch failed');
}

/** 目录 → 该供应商的价格表（USD/百万 → 内部计价单位） */
function buildProviderPrices(catalog: any, providerId: string, rate: number): CatalogPrice[] {
  const models = catalog?.[providerId]?.models;
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
      catalogModel: modelId,
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

function providerLabel(providerId: string): string {
  const map: Record<string, string> = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    mistral: 'Mistral',
    xai: 'xAI',
    moonshotai: 'Moonshot AI',
    zai: 'Z.AI',
    minimax: 'MiniMax',
    cohere: 'Cohere',
  };
  return map[providerId] || providerId;
}

/**
 * 构建同步计划：**只遍历钱包里已识别的模型**，用模糊匹配在供应商目录中找对应价格。
 * 不新增模型（历史 bug：add-missing 会把整个供应商目录灌进钱包）。
 */
export function buildSyncPlan(
  catalog: any,
  opts: { walletIds?: string[]; mode?: SyncMode; providerOverride?: string } = {},
): SyncPlan {
  const rate = getWalletExchangeRate() || DEFAULT_EXCHANGE_RATE;
  const settings: any = state.settings as any;
  const mode: SyncMode = opts.mode || (settings?.pricingSync?.mode as SyncMode) || 'add-missing';
  const ignored = new Set(state.walletIgnored || []);
  const only = opts.walletIds && opts.walletIds.length ? new Set(opts.walletIds) : null;
  const wallets = repository.getWallets().filter((wallet) => {
    if (ignored.has(wallet.id)) return false;
    if (only && !only.has(wallet.id)) return false;
    return true;
  });

  const rows: SyncPlanRow[] = [];
  const summary: SyncPlanSummary = {
    wallets: 0, catalogModels: 0, matched: 0, exact: 0, fuzzy: 0,
    ambiguous: 0, unmatched: 0, write: 0, update: 0, skipped: 0,
  };
  const providers = new Set<string>();

  for (const wallet of wallets) {
    const provider = opts.providerOverride || wallet.catalogProvider;
    if (!provider) continue;
    const prices = buildProviderPrices(catalog, provider, rate);
    if (!prices.length) continue;
    summary.wallets += 1;
    summary.catalogModels += prices.length;
    providers.add(provider);
    const catalogModels = prices.map((item) => item.catalogModel);
    const byModel = new Map(prices.map((item) => [item.catalogModel, item]));

    for (const model of wallet.models) {
      const localName = String(model.model || model.sourceModel || '').trim();
      if (!localName) continue;
      const matched = matchModelName(localName, catalogModels);
      const base = {
        key: wallet.id + '|' + model.id,
        walletId: wallet.id,
        walletName: wallet.name,
        provider,
        modelId: model.id,
        localModel: localName,
        locked: model.locked === true,
      };
      if (!matched.best) {
        summary.unmatched += 1;
        rows.push({
          ...base, catalogModel: null, score: 0, reason: 'none', ambiguous: false,
          action: 'unmatched', changed: false,
          usePeakPricing: model.price.usePeakPricing,
          current: model.price.priceConfigured ? model.price.offpeak : null,
          next: null, nextPeak: null,
        });
        continue;
      }
      const price = byModel.get(matched.best.model)!;
      const ambiguous = matched.ambiguous;
      const usePeakPricing = model.price.usePeakPricing === true;
      const next = { ...price.offpeak };
      const nextPeak = usePeakPricing
        ? {
            hit: Math.round(next.hit * 2 * 10000) / 10000,
            miss: Math.round(next.miss * 2 * 10000) / 10000,
            output: Math.round(next.output * 2 * 10000) / 10000,
          }
        : { ...next };

      summary.matched += 1;
      if (matched.best.reason === 'exact' || matched.best.reason === 'normalized' || matched.best.reason === 'alias') summary.exact += 1;
      else summary.fuzzy += 1;
      if (ambiguous) summary.ambiguous += 1;

      let action: SyncRowAction = 'update';
      if (!model.price.priceConfigured) action = 'write';
      else if (model.locked && mode !== 'overwrite-all') action = 'skip-locked';
      else if (mode === 'add-missing') action = 'skip-same';
      else if (sameTier(model.price.offpeak, next) && sameTier(model.price.peak, nextPeak)) action = 'skip-same';

      if (action === 'write') summary.write += 1;
      else if (action === 'update') summary.update += 1;
      else summary.skipped += 1;

      rows.push({
        ...base,
        catalogModel: price.catalogModel,
        score: matched.best.score,
        reason: matched.best.reason,
        ambiguous,
        action,
        changed: action === 'write' || action === 'update',
        usePeakPricing,
        current: model.price.priceConfigured ? { ...model.price.offpeak } : null,
        next,
        nextPeak,
      });
    }
  }

  const provider = Array.from(providers)[0] || '';
  return {
    provider,
    providerLabel: providers.size === 1 ? providerLabel(provider) : providers.size > 1 ? '多供应商' : '',
    mode,
    rate,
    createdAt: Date.now(),
    rows,
    summary,
  };
}

/**
 * 应用同步计划。默认**排除歧义行**（分差过小的匹配置信度不足），
 * 也排除 skip-locked / skip-same / unmatched；selectedKeys 明确给定时以它为准。
 */
export async function applySyncPlan(
  plan: SyncPlan,
  opts: { selectedKeys?: Iterable<string>; includeAmbiguous?: boolean } = {},
): Promise<{ applied: number; wallets: string[] }> {
  const selected = opts.selectedKeys ? new Set(opts.selectedKeys) : null;
  const targets = plan.rows.filter((row) => {
    if (row.action !== 'write' && row.action !== 'update') return false;
    if (!row.catalogModel || !row.next) return false;
    if (selected) return selected.has(row.key);
    return opts.includeAmbiguous ? true : !row.ambiguous;
  });
  if (!targets.length) return { applied: 0, wallets: [] };

  const nextWallets = repository.getWallets().map((wallet) => cloneWallet(wallet));
  const affected = new Set<string>();
  const now = Date.now();
  for (const row of targets) {
    const wallet = nextWallets.find((item) => item.id === row.walletId);
    if (!wallet) continue;
    const model = wallet.models.find((item) => item.id === row.modelId);
    if (!model) continue;
    const catalogModel = row.catalogModel;
    if (!catalogModel) continue;
    if (model.locked && plan.mode !== 'overwrite-all' && row.action === 'update') continue;
    model.price = {
      usePeakPricing: row.usePeakPricing,
      offpeak: { ...(row.next as Tier) },
      peak: { ...(row.nextPeak || row.next as Tier) },
      priceConfigured: true,
    };
    model.source = 'sync';
    model.hidden = false;
    model.priceMatch = {
      provider: row.provider,
      catalogModel,
      score: row.score,
      matchedAt: now,
    };
    model.updatedAt = now;
    affected.add(wallet.id);
  }
  if (!affected.size) return { applied: 0, wallets: [] };

  repository.replaceWallets(nextWallets);
  const ps: any = (state.settings as any).pricingSync;
  if (ps) {
    ps.lastSync = now;
    ps.lastMatchSummary = {
      matched: plan.summary.matched,
      fuzzy: plan.summary.fuzzy,
      unmatched: plan.summary.unmatched,
      at: now,
    };
  }
  try { saveHot({ settings: state.settings }); } catch {}
  if (ps?.recalcOnSync !== false) {
    for (const walletId of affected) {
      try { await repository.recalcWallet(walletId); } catch {}
    }
  }
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  log.debug('sync plan applied', { applied: targets.length, wallets: Array.from(affected) });
  return { applied: targets.length, wallets: Array.from(affected) };
}

/** 是否存在需要同步的钱包：未忽略且已在钱包页选定价格来源（catalogProvider）。没有就完全不联网 */
export function hasSyncableWallet(): boolean {
  const ignored = new Set<string>(state.walletIgnored || []);
  return repository.getWallets().some((wallet) => !ignored.has(wallet.id) && !!wallet.catalogProvider);
}

/** 按钱包同步价格：构建计划 → 自动应用（排除歧义行） */
export async function syncPricingFromModelsDev(opts: {
  silent?: boolean;
  force?: boolean;
  walletIds?: string[];
  mode?: SyncMode;
  autoApply?: boolean;
} = {}): Promise<SyncPlan | null> {
  const silent = !!opts.silent;
  const ps: any = (state.settings as any).pricingSync;
  if (!ps) return null;
  if (silent && !opts.force && Date.now() - lastAutoSync < AUTO_SYNC_THROTTLE) return null;
  // 同步的唯一开关是「钱包是否选了价格来源」，没有可同步钱包就不拉目录
  if (!hasSyncableWallet()) {
    if (!silent) toast('warning', '没有可用于比对的模型：请先在钱包页为钱包选择价格来源，并等待识别到模型');
    return null;
  }
  if (silent) lastAutoSync = Date.now();
  try {
    const catalog = await fetchModelsDevCatalog({ force: !!opts.force });
    const plan = buildSyncPlan(catalog, { walletIds: opts.walletIds, mode: opts.mode });
    if (!plan.rows.length) {
      if (!silent) toast('warning', '没有可用于比对的模型：请先为钱包选择价格来源，并等待识别到模型');
      return plan;
    }
    if (opts.autoApply === false) return plan;
    const result = await applySyncPlan(plan);
    if (!silent) {
      const s = plan.summary;
      toast(
        result.applied ? 'success' : 'warning',
        '价格同步：写入 ' + result.applied + ' 个模型（匹配 ' + s.matched + ' / 未匹配 ' + s.unmatched
          + (s.ambiguous ? ' / 歧义 ' + s.ambiguous : '') + '）',
      );
    }
    return plan;
  } catch (e: any) {
    log.error('pricing sync failed', e);
    if (!silent) toast('error', '同步失败：' + (e?.message || e));
    return null;
  }
}

/** 移除旧版本全量灌入留下的孤儿同步模型（有 priceMatch 的保留） */
export function removeSyncedModels(): number {
  const cms: any[] = (state.settings as any).customModels || [];
  const kept = cms.filter((c: any) => c?.synced !== true);
  let removed = cms.length - kept.length;
  (state.settings as any).customModels = kept;
  const nextWallets = repository.getWallets().map((wallet) => {
    const next = cloneWallet(wallet);
    const before = next.models.length;
    next.models = next.models.filter((model) => !(model.source === 'sync' && !model.locked && !model.priceMatch));
    removed += before - next.models.length;
    return next;
  });
  if (removed > 0) repository.replaceWallets(nextWallets);
  try { saveHot({ settings: state.settings }); } catch {}
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  log.debug('synced models removed', { removed });
  return removed;
}

let pricingTimer: any = null;
export function restartPricingSyncTimer() {
  if (pricingTimer) { try { clearInterval(pricingTimer); } catch {} pricingTimer = null; }
  const ps: any = (state.settings as any).pricingSync;
  const hours = parseInt(String(ps?.autoIntervalHours)) || 0;
  if (!hours || hours <= 0) return;
  // 定时器只按间隔跑；具体钱包是否参与由各自的价格来源决定（无可同步钱包时静默跳过，不联网）
  pricingTimer = setInterval(() => { syncPricingFromModelsDev({ silent: true }).catch(() => {}); }, hours * 60 * 60 * 1000);
}
export function stopPricingSyncTimer() {
  if (pricingTimer) { try { clearInterval(pricingTimer); } catch {} pricingTimer = null; }
}

/** 钱包卡上的同步状态摘要 */
export function walletSyncStatus(wallet: WalletConfig): { label: string; pending: number; synced: number } {
  const visible = (wallet.models || []).filter((model) => model.hidden !== true);
  const pending = visible.filter((model) => model.price.priceConfigured !== true).length;
  const synced = visible.filter((model) => model.priceMatch && model.price.priceConfigured === true).length;
  if (!wallet.catalogProvider) return { label: '未配置价格来源', pending, synced };
  return { label: providerLabel(wallet.catalogProvider) + (synced ? ' · 已同步 ' + synced : ''), pending, synced };
}

/**
 * 迁移：旧版本把供应商目录**全量**写进钱包（source=sync 且从未被任何请求命中）。
 * v2 起把这些孤儿条目置为 hidden（不删除，可手动清理），价格仍保留参与计价。
 */
export async function markLegacySyncedModels(opts?: { skipRerender?: boolean }): Promise<{ hidden: number; scanned: number } | null> {
  const ps: any = (state.settings as any).pricingSync;
  if (!ps) return null;
  if (Number(ps.syncedMarkVersion) >= SYNCED_MARK_VERSION) return { hidden: 0, scanned: 0 };

  let history: any[] = [];
  try { history = await repository.getAllHistory(); } catch { history = state.history || []; }
  const used = new Set<string>();
  for (const entry of history) {
    try { if (entry?.model) used.add(normalizeModel(entry.model).toLowerCase()); } catch {}
  }

  let hidden = 0;
  let scanned = 0;
  const nextWallets = repository.getWallets().map((wallet) => {
    const next = cloneWallet(wallet);
    for (const model of next.models) {
      if (model.source !== 'sync' || model.locked || model.priceMatch) continue;
      if (model.hidden === true) continue;
      scanned += 1;
      const name = String(model.model || model.sourceModel || '').toLowerCase();
      if (used.has(name)) continue;
      model.hidden = true;
      model.updatedAt = Date.now();
      hidden += 1;
    }
    return next;
  });

  // 旧 customModels 同步污染标记（仅首次）
  if (!(Number(ps.syncedMarkVersion) >= 1)) {
    const cms: any[] = (state.settings as any).customModels || [];
    const builtin = builtinModelKeys();
    for (const entry of cms) {
      if (!entry?.model || entry.synced === true) continue;
      if (builtin.has(entry.model)) continue;
      if (used.has(String(entry.model).toLowerCase())) continue;
      entry.synced = true;
    }
  }

  if (hidden > 0) repository.replaceWallets(nextWallets);
  ps.syncedMarkVersion = SYNCED_MARK_VERSION;
  try { saveHot({ settings: state.settings }); } catch {}
  if (hidden > 0) {
    try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    if (!opts?.skipRerender) {
      try {
        const { renderSettings } = await import('../ui/settings');
        const doc: any = (window.parent as any)?.document ?? document;
        if (doc?.getElementById('aus-settings')) renderSettings(doc);
      } catch {}
    }
  }
  log.debug('legacy synced models hidden', { hidden, scanned });
  return { hidden, scanned };
}
