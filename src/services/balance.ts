import { state } from '../store/index';
import { decryptKey, encryptKey } from '../utils/crypto';
import { saveHot } from '../store/persistence';
import { log, toast } from '../utils/logger';
import { formatMoney, getDisplayCurrency } from './currency';

export function getApiKey(): string {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const ext = ctx?.extensionSettings?.['api_usage_stat'];
    if (ext?.apiKey) return decryptKey(ext.apiKey);
  } catch {}
  return '';
}

export function saveApiKey(key: string) {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.extensionSettings) {
      ctx.extensionSettings['api_usage_stat'] = ctx.extensionSettings['api_usage_stat'] || {};
      ctx.extensionSettings['api_usage_stat'].apiKey = encryptKey(key);
      ctx.saveSettingsDebounced?.();
    }
  } catch {}
}

let balanceInFlight = false;
export async function queryBalance(silent = false): Promise<any> {
  if (balanceInFlight) return null;
  balanceInFlight = true;
  try {
    const key = getApiKey();
    if (!key) { if (!silent) toast('error', '请先设置 API 密钥'); return null; }
    const ctrl = new AbortController();
    const to = setTimeout(() => { try { ctrl.abort(); } catch {} }, 15000);
    const r = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      signal: ctrl.signal as any,
    });
    clearTimeout(to);
    const d: any = await r.json();
    if (d.is_available && d.balance_infos?.length) {
      const i = d.balance_infos[0];
      const bal = { balance: i.total_balance, currency: i.currency, available: d.is_available, timestamp: Date.now() };
      state.balance = bal;
      saveHot({ balance: bal });
      try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
      if (!silent) { try {  toast('success', '余额已更新 ' + formatMoney(parseFloat(String(i.total_balance))||0, 2)); } catch { toast('success', '余额已更新 ¥' + i.total_balance); } }
      return bal;
    }
    if (!silent) toast('error', d.error?.message || '查询失败');
    return null;
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? '查询超时(15s)' : (e?.message || e);
    log.error('余额查询失败', e);
    if (!silent) toast('error', '网络错误: ' + msg);
    return null;
  } finally { balanceInFlight = false; }
}

let balanceTimer: any = null;
export function restartBalanceTimer() {
  if (balanceTimer) { try { clearInterval(balanceTimer); } catch {} balanceTimer = null; }
  const s: any = state.settings;
  if (!s.autoBalance) return;
  const min = Math.min(Math.max(parseInt(s.balanceInterval) || 10, 1), 1440);
  balanceTimer = setInterval(() => { queryBalance(true).catch(()=>{}); }, min * 60 * 1000);
}
export function stopBalanceTimer() {
  if (balanceTimer) { try { clearInterval(balanceTimer); } catch {} balanceTimer = null; }
}