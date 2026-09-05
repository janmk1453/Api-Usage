import { state } from '../store/index';
import { DEFAULT_EXCHANGE_RATE, EXCHANGE_RATE_FETCH_INTERVAL } from '../constants/pricing';
import { saveHot } from '../store/persistence';

export type DisplayCurrency = { code: 'CNY' | 'USD'; symbol: string; rate: number };

export function getEffectiveRate(): number {
  const ps: any = (state.settings as any)?.pricingSync;
  if (!ps?.enabled) return 1;
  const r = parseFloat(String(ps.exchangeRate));
  if (!isFinite(r) || r <= 0) return DEFAULT_EXCHANGE_RATE;
  return r;
}

export function getDisplayCurrency(): DisplayCurrency {
  const ps: any = (state.settings as any)?.pricingSync;
  if (ps?.enabled) {
    return { code: 'USD', symbol: '$', rate: getEffectiveRate() };
  }
  return { code: 'CNY', symbol: '¥', rate: 1 };
}

export function cnyToDisplay(cny: number): number {
  const cur = getDisplayCurrency();
  if (cur.code === 'USD') return cny / cur.rate;
  return cny;
}

export function displayToCny(display: number): number {
  const cur = getDisplayCurrency();
  if (cur.code === 'USD') return display * cur.rate;
  return display;
}

export function formatMoney(cny: number, digits = 4): string {
  const cur = getDisplayCurrency();
  const v = cnyToDisplay(cny);
  return `${cur.symbol}${v.toFixed(digits)} ${cur.code}`;
}

export function formatMoneyWithCode(cny: number, digits = 4, codeOverride?: 'CNY' | 'USD'): string {
  const cur = codeOverride ? { code: codeOverride, symbol: codeOverride === 'USD' ? '$' : '¥', rate: getEffectiveRate() } as any : getDisplayCurrency();
  const v = codeOverride === 'USD' ? cny / cur.rate : codeOverride === 'CNY' ? cny : cnyToDisplay(cny);
  const sym = codeOverride ? (codeOverride === 'USD' ? '$' : '¥') : cur.symbol;
  const code = codeOverride || cur.code;
  return `${sym}${v.toFixed(digits)} ${code}`;
}

export function formatRate(): string {
  const ps: any = (state.settings as any)?.pricingSync;
  const r = getEffectiveRate();
  const last = ps?.lastRateFetch ? new Date(ps.lastRateFetch).toLocaleString('zh-CN') : '—';
  return `1 USD ≈ ${r.toFixed(4)} CNY（更新于 ${last}）`;
}

let rateInFlight = false;
export async function fetchLiveRate(force = false): Promise<number | null> {
  const ps: any = (state.settings as any)?.pricingSync;
  if (!ps) return null;
  if (!force && ps.lastRateFetch && Date.now() - ps.lastRateFetch < EXCHANGE_RATE_FETCH_INTERVAL) {
    return ps.exchangeRate;
  }
  if (rateInFlight) return null;
  rateInFlight = true;
  const urls = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate-api.com/v4/latest/USD',
  ];
  for (const u of urls) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(u, { signal: ctrl.signal as any });
      clearTimeout(to);
      if (!r.ok) continue;
      const j: any = await r.json();
      const rate = j?.rates?.CNY ?? j?.rates?.['CNY'] ?? j?.conversion_rates?.CNY;
      const v = parseFloat(String(rate));
      if (isFinite(v) && v > 0) {
        ps.exchangeRate = Math.round(v * 10000) / 10000;
        ps.lastRateFetch = Date.now();
        saveHot({ settings: state.settings });
        rateInFlight = false;
        return ps.exchangeRate;
      }
    } catch {}
  }
  rateInFlight = false;
  return null;
}

let rateTimer: any = null;
export function restartRateTimer() {
  if (rateTimer) { try { clearInterval(rateTimer); } catch {} rateTimer = null; }
  const ps: any = (state.settings as any)?.pricingSync;
  if (!ps?.enabled || !ps?.useLiveRate) return;
  rateTimer = setInterval(() => { fetchLiveRate(false).catch(() => {}); }, EXCHANGE_RATE_FETCH_INTERVAL);
  // 首次若超时则立即尝试
  if (!ps.lastRateFetch || Date.now() - ps.lastRateFetch >= EXCHANGE_RATE_FETCH_INTERVAL) {
    fetchLiveRate(false).catch(() => {});
  }
}
export function stopRateTimer() {
  if (rateTimer) { try { clearInterval(rateTimer); } catch {} rateTimer = null; }
}
