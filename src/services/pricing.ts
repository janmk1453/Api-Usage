import { PRICING, DEFAULT_PEAK_HOURS, PRICE_HISTORY } from '../constants/pricing';
import type { PriceSegment } from '../constants/pricing';
import type { Settings } from '../types/settings';
import { isPeakHour as isPeakHourRaw, isWeekendDay } from '../utils/date';
import { formatMoney as _formatMoney } from './currency';

export { isWeekendDay };

export function getModelList(settings: Settings): string[] {
  const set: Record<string, 1> = {};
  Object.keys(PRICING).forEach((k) => (set[k] = 1));
  (settings.customModels || []).forEach((m) => {
    if (m?.model) set[m.model] = 1;
  });
  return Object.keys(set);
}

function mergePrices(base: { hit: number; miss: number; output: number }, custom: any) {
  if (!custom) return base;
  return {
    hit: custom.hit !== undefined && custom.hit !== '' ? parseFloat(custom.hit) : base.hit,
    miss: custom.miss !== undefined && custom.miss !== '' ? parseFloat(custom.miss) : base.miss,
    output: custom.output !== undefined && custom.output !== '' ? parseFloat(custom.output) : base.output,
  };
}

const MODEL_ALIASES: Record<string,string> = {
  'deepseek-v4-flash-vision': 'deepseek-v4-flash-vision-exp',
};

function normalizeModel(model: string): string {
  if (!model) return 'deepseek-v4-flash';
  let m = String(model).trim().replace(/^\[[^\]]+\]/, '').trim();
  const low = m.toLowerCase();
  if ((MODEL_ALIASES as any)[low]) return (MODEL_ALIASES as any)[low];
  if (low === 'deepseek-v4-flash') return 'deepseek-v4-flash';
  if (low === 'deepseek-v4.1-flash') return 'deepseek-v4.1-flash';
  if (low === 'deepseek-v4-pro') return 'deepseek-v4-pro';
  if (low === 'deepseek-v4-flash-vision-exp') return 'deepseek-v4-flash-vision-exp';
  // 精确匹配后不再回落 deepseek -> flash，保持原名以便无价提示
  return m;
}

export function getPricing(model: string, settings: Settings) {
  const raw = model || 'deepseek-v4-flash';
  const m = normalizeModel(raw);
  const base: any = (PRICING as any)[m] || (PRICING as any)['deepseek-v4-flash'];
  for (const cm of settings.customModels || []) {
    if (cm?.model === raw || cm?.model === m) {
      return {
        usePeakPricing: cm.usePeakPricing !== false,
        offpeak: mergePrices(base.offpeak, cm.offpeak),
        peak: mergePrices(base.peak, cm.peak),
      };
    }
  }
  // 无自定义时返回当前时间命中段的价格（未来段不影响当前展示）
  const seg = findSegment(m, Date.now());
  if (seg) return { usePeakPricing: seg.usePeakPricing !== false, offpeak: seg.offpeak, peak: seg.peak };
  return base;
}

export function hasPriceForModel(model: string, settings: Settings): boolean {
  const raw = model || 'deepseek-v4-flash';
  const m = normalizeModel(raw);
  if ((PRICING as any)[m]) return true;
  for (const cm of settings.customModels || []) if (cm?.model === raw || cm?.model === m) return true;
  // 仅 deepseek 系有内置价，非 deepseek 若未自定义则无价
  return false;
}

export function isDeepSeekOfficialModel(m: unknown): boolean {
  if (typeof m !== 'string') return false;
  const norm = normalizeModel(m);
  return norm.toLowerCase().indexOf('deepseek') === 0 || String(m).toLowerCase().includes('deepseek');
}

export function isPeakHour(timestamp: number, settings: Settings): boolean {
  const hours = (settings && settings.peakHours) || (DEFAULT_PEAK_HOURS as any);
  return isPeakHourRaw(timestamp, hours);
}

// 1:1 calcCost（含周末豁免、仅 deepseek* 峰谷、useNewPricing/newPricingDate）
// 多段价格：按记录 timestamp 命中 PRICE_HISTORY 中 timestamp >= since 的最后一段；
// 自定义价格优先不回退；段自带 peakHours 优先于用户当前设置（历史峰谷规则不随当前设置漂移）
// 未来段（since 为未来时间）预置后自动生效，当前记录不受影响
function findSegment(normalizedModel: string, uTs: number): PriceSegment | null {
  const segs = (PRICE_HISTORY as any)[normalizedModel] as PriceSegment[] | undefined;
  if (!segs || !segs.length) return null;
  let hit: PriceSegment | null = null;
  for (const s of segs) {
    if (uTs >= s.since) hit = s;
    else break;
  }
  return hit;
}
function peakHoursFor(seg: PriceSegment | null, settings: Settings): any {
  if (seg?.peakHours?.length) return seg.peakHours;
  return (settings && (settings as any).peakHours) || (DEFAULT_PEAK_HOURS as any);
}
function hasCustomForModel(model: string, settings: Settings): boolean {
  const raw = model || 'deepseek-v4-flash';
  const m = normalizeModel(raw);
  for (const cm of (settings as any).customModels || []) if (cm?.model === raw || cm?.model === m) return true;
  return false;
}
function effectivePricingFor(model: string, uTs: number, settings: Settings, base: any) {
  const m = normalizeModel(model || 'deepseek-v4-flash');
  if (hasCustomForModel(model, settings)) return base;
  const seg = findSegment(m, uTs);
  if (seg) {
    return { usePeakPricing: seg.usePeakPricing !== false, offpeak: seg.offpeak, peak: seg.peak } as any;
  }
  return base;
}

export function calcCost(
  u: { timestamp: number; model: string; prompt_cache_hit_tokens: number; prompt_cache_miss_tokens: number; completion_tokens: number },
  settings: Settings
): { input: number; output: number; total: number; priceType: string } {
  const model = u.model || 'deepseek-v4-flash';
  if (!hasPriceForModel(model, settings)) return { input: 0, output: 0, total: 0, priceType: 'old' };
  const basePricing = getPricing(model, settings);
  const pricing = effectivePricingFor(model, u.timestamp, settings, basePricing);
  const segForHours = hasCustomForModel(model, settings) ? null : findSegment(normalizeModel(model), u.timestamp);
  const hours = peakHoursFor(segForHours, settings);
  const useNewPricing = settings.useNewPricing && u.timestamp >= settings.newPricingDate;
  let p: any;
  let priceType: string;
  if (useNewPricing && pricing.usePeakPricing !== false && isDeepSeekOfficialModel(model)) {
    const isPeak = isPeakHourRaw(u.timestamp, hours);
    p = isPeak ? pricing.peak : pricing.offpeak;
    priceType = isPeak ? 'new-peak' : 'new-offpeak';
  } else {
    p = pricing.offpeak;
    priceType = useNewPricing ? 'new-offpeak' : 'old';
  }
  const ih = (u.prompt_cache_hit_tokens / 1e6) * p.hit;
  const im = (u.prompt_cache_miss_tokens / 1e6) * p.miss;
  const o = (u.completion_tokens / 1e6) * p.output;
  return { input: ih + im, output: o, total: ih + im + o, priceType };
}

export function calcSavings(
  u: { prompt_cache_hit_tokens: number; timestamp: number; model: string; prompt_cache_miss_tokens: number; completion_tokens: number },
  settings: Settings
): number {
  const model = u.model || 'deepseek-v4-flash';
  if (!hasPriceForModel(model, settings)) return 0;
  const basePricing = getPricing(model, settings);
  const pricing = effectivePricingFor(model, u.timestamp, settings, basePricing);
  const segForHours = hasCustomForModel(model, settings) ? null : findSegment(normalizeModel(model), u.timestamp);
  const hours = peakHoursFor(segForHours, settings);
  const useNewPricing = settings.useNewPricing && u.timestamp >= settings.newPricingDate;
  let p: any;
  if (useNewPricing && pricing.usePeakPricing !== false && isDeepSeekOfficialModel(model)) {
    p = isPeakHourRaw(u.timestamp, hours) ? pricing.peak : pricing.offpeak;
  } else p = pricing.offpeak;
  return ((u.prompt_cache_hit_tokens || 0) / 1e6) * (p.miss - p.hit);
}

export function fmtCost(model: string, cost: number, digits = 4, settings: Settings): string {
  if (!hasPriceForModel(model, settings)) return '¥价格未设置';
  try { return _formatMoney(cost || 0, digits); } catch { return '¥' + (cost || 0).toFixed(digits) + ' CNY'; }
}
