import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import { PRICING_SYNC_SOURCE, PRICING_SYNC_FALLBACK, DEFAULT_EXCHANGE_RATE } from '../constants/pricing';
import { getEffectiveRate } from './currency';
import { isDeepSeekOfficialModel } from './pricing';
import { log, toast } from '../utils/logger';

export type SyncPreview = { added: number; updated: number; skipped: number; total: number; samples: Array<{ model: string; hit: number; miss: number; output: number }> };

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
        if (same) { skipped++; continue; }
        // 非 add-missing 则覆盖
        map.set(inc.model, inc);
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
    if (!silent) toast('success', `价格已同步：新增 ${added} 更新 ${updated} 跳过 ${skipped}（共 ${total} 模型）`);
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
