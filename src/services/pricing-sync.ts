import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import { PRICING, HIDDEN_PRICING_MODELS, PRICING_SYNC_SOURCE, PRICING_SYNC_FALLBACK, DEFAULT_EXCHANGE_RATE } from '../constants/pricing';
import { getEffectiveRate } from './currency';
import { isDeepSeekOfficialModel, normalizeModel } from './pricing';
import { log, toast } from '../utils/logger';

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
  const removed = cms.length - kept.length;
  if (removed <= 0) return 0;
  (state.settings as any).customModels = kept;
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

export function previewSync(catalog: any): SyncPreview {
  const rate = getEffectiveRate() || DEFAULT_EXCHANGE_RATE;
  const incoming = buildCustomModelsFromCatalog(catalog, rate);
  const existing = new Map<string, any>(((state.settings as any).customModels || []).map((c: any) => [c.model, c]));
  const mode: string = (state.settings as any).pricingSync?.mode || 'add-missing';
  let added = 0, updated = 0, skipped = 0;
  const samples: any[] = [];
  for (const inc of incoming) {
    const ex = existing.get(inc.model);
    if (!ex) { added++; if (samples.length < 6) samples.push(inc); }
    else {
      const same = ex.offpeak?.hit === inc.offpeak.hit && ex.offpeak?.miss === inc.offpeak.miss && ex.offpeak?.output === inc.offpeak.output;
      if (mode === 'add-missing') skipped++;
      else if (mode === 'overwrite-all') { if (!same) updated++; else skipped++; }
      else { // overwrite-unlocked 默认：内置价格被覆盖视为更新，未锁定则更新
        if (!same) updated++; else skipped++;
      }
    }
  }
  return { added, updated, skipped, total: incoming.length, samples };
}

export async function syncPricingFromModelsDev(opts?: { silent?: boolean; force?: boolean }): Promise<SyncPreview | null> {
  const silent = !!opts?.silent;
  const ps: any = (state.settings as any).pricingSync;
  if (!ps) return null;
  try {
    const catalog = await fetchModelsDevCatalog();
    const rate = getEffectiveRate() || DEFAULT_EXCHANGE_RATE;
    const incoming = buildCustomModelsFromCatalog(catalog, rate);
    if (!incoming.length) {
      if (!silent) toast('warning', 'models.dev 未返回可用价格');
      return null;
    }
    const mode: string = ps.mode || 'add-missing';
    const map = new Map<string, any>(((state.settings as any).customModels || []).map((c: any) => [c.model, c]));
    let added = 0, updated = 0, skipped = 0;
    for (const inc of incoming) {
      const ex = map.get(inc.model);
      if (!ex) {
        map.set(inc.model, inc);
        added++;
      } else {
        if (mode === 'add-missing') { skipped++; continue; }
        const same = ex.offpeak?.hit === inc.offpeak.hit && ex.offpeak?.miss === inc.offpeak.miss && ex.offpeak?.output === inc.offpeak.output && ex.peak?.hit === inc.peak.hit;
        if (same) {
          // 价格与目录一致：补上同步标记（兼容早期版本写入的无标记污染数据）
          if (ex.synced !== true) ex.synced = true;
          skipped++;
          continue;
        }
        // 非 add-missing 则覆盖；用户自己维护的条目仍保留“非同步”身份，不被隐藏
        map.set(inc.model, { ...inc, synced: ex.synced === true });
        updated++;
      }
    }
    (state.settings as any).customModels = Array.from(map.values());
    ps.lastSync = Date.now();
    saveHot({ settings: state.settings });
    try { const { repository } = await import('../data/repository'); if (ps.recalcOnSync) repository.recalcAll(); } catch {}
    try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    const total = incoming.length;
    const preview: SyncPreview = { added, updated, skipped, total, samples: incoming.slice(0, 6).map(c => ({ model: c.model, hit: c.offpeak.hit, miss: c.offpeak.miss, output: c.offpeak.output })) };
    if (!silent) toast('success', `价格已同步：新增 ${added}（已隐藏不显示）更新 ${updated} 跳过 ${skipped}（共 ${total} 模型）`);
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
    const rate = getEffectiveRate() || DEFAULT_EXCHANGE_RATE;
    const byName = new Map<string, any>(buildCustomModelsFromCatalog(catalog, rate).map((e: any) => [e.model, e]));
    for (const c of pending) {
      const inc = byName.get(c.model);
      if (inc && priceClose(c.offpeak, inc.offpeak)) { c.synced = true; marked++; }
    }
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
