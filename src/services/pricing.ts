import { PRICING, DEFAULT_PEAK_HOURS } from '../constants/pricing';
import type { Settings } from '../types/settings';
import { isPeakHour as isPeakHourRaw, isWeekendDay } from '../utils/date';

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

export function getPricing(model: string, settings: Settings) {
  const m = model || 'deepseek-v4-flash';
  const base: any = (PRICING as any)[m] || (PRICING as any)['deepseek-v4-flash'];
  for (const cm of settings.customModels || []) {
    if (cm?.model === m) {
      return {
        usePeakPricing: cm.usePeakPricing !== false,
        offpeak: mergePrices(base.offpeak, cm.offpeak),
        peak: mergePrices(base.peak, cm.peak),
      };
    }
  }
  return base;
}

export function hasPriceForModel(model: string, settings: Settings): boolean {
  const m = model || 'deepseek-v4-flash';
  if ((PRICING as any)[m]) return true;
  for (const cm of settings.customModels || []) if (cm?.model === m) return true;
  return false;
}

export function isDeepSeekOfficialModel(m: unknown): boolean {
  return typeof m === 'string' && m.toLowerCase().indexOf('deepseek') === 0;
}

export function isPeakHour(timestamp: number, settings: Settings): boolean {
  const hours = (settings && settings.peakHours) || (DEFAULT_PEAK_HOURS as any);
  return isPeakHourRaw(timestamp, hours);
}

// 1:1 calcCost（含周末豁免、仅 deepseek* 峰谷、useNewPricing/newPricingDate）
export function calcCost(
  u: { timestamp: number; model: string; prompt_cache_hit_tokens: number; prompt_cache_miss_tokens: number; completion_tokens: number },
  settings: Settings
): { input: number; output: number; total: number; priceType: string } {
  const model = u.model || 'deepseek-v4-flash';
  if (!hasPriceForModel(model, settings)) return { input: 0, output: 0, total: 0, priceType: 'old' };
  const pricing = getPricing(model, settings);
  const useNewPricing = settings.useNewPricing && u.timestamp >= settings.newPricingDate;
  let p: any;
  let priceType: string;
  if (useNewPricing && pricing.usePeakPricing !== false && isDeepSeekOfficialModel(model)) {
    const isPeak = isPeakHour(u.timestamp, settings);
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
  const pricing = getPricing(model, settings);
  const useNewPricing = settings.useNewPricing && u.timestamp >= settings.newPricingDate;
  let p: any;
  if (useNewPricing && pricing.usePeakPricing !== false && isDeepSeekOfficialModel(model)) {
    p = isPeakHour(u.timestamp, settings) ? pricing.peak : pricing.offpeak;
  } else p = pricing.offpeak;
  return ((u.prompt_cache_hit_tokens || 0) / 1e6) * (p.miss - p.hit);
}

export function fmtCost(model: string, cost: number, digits = 4, settings: Settings): string {
  return hasPriceForModel(model, settings) ? '¥' + (cost || 0).toFixed(digits) : '¥价格未设置';
}
