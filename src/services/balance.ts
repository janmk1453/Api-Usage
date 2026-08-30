import { state } from '../store/index';
import { decryptKey, encryptKey } from '../utils/crypto';
import { saveHot } from '../store/persistence';
import { log, toast } from '../utils/logger';

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

export async function queryBalance(apiKey?: string): Promise<any> {
  const key = apiKey || getApiKey();
  if (!key) { toast('error', '请先设置 API 密钥'); return null; }
  try {
    const r = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    });
    const d: any = await r.json();
    if (d.is_available && d.balance_infos?.length) {
      const i = d.balance_infos[0];
      const bal = { balance: i.total_balance, currency: i.currency, available: d.is_available, timestamp: Date.now() };
      state.balance = bal;
      saveHot({ balance: bal });
      toast('success', '余额已更新 ¥' + i.total_balance);
      return bal;
    }
    toast('error', d.error?.message || '查询失败');
    return null;
  } catch (e: any) {
    log.error('余额查询失败', e);
    toast('error', '网络错误: ' + (e?.message || e));
    return null;
  }
}
