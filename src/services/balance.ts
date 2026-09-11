import { state } from '../store/index';
import { repository } from '../data/repository';
import { log, toast } from '../utils/logger';
import { getWalletApiKey, saveWalletApiKey } from './wallet-secrets';
import { DEEPSEEK_WALLET_ID, type WalletConfig } from '../types/wallet';
import { DEEPSEEK_OFFICIAL_ENDPOINT_ID } from '../data/wallets';

export function getApiKey(): string {
  return getWalletApiKey(DEEPSEEK_WALLET_ID);
}

export function saveApiKey(key: string): void {
  saveWalletApiKey(DEEPSEEK_WALLET_ID, key);
}

function canAutoCalibrate(wallet: WalletConfig): boolean {
  return wallet.id === DEEPSEEK_WALLET_ID
    && wallet.sourceType === 'deepseek'
    && wallet.endpointId === DEEPSEEK_OFFICIAL_ENDPOINT_ID;
}

function walletCurrencyLabel(wallet: WalletConfig): string {
  return `${wallet.balance.currency === 'USD' ? '$' : '¥'}${wallet.balance.amount || '0'} ${wallet.balance.currency}`;
}

const balanceInFlight = new Set<string>();
export async function queryWalletBalance(walletId: string, silent = false): Promise<any> {
  const wallet = repository.getWallet(walletId);
  if (!wallet) {
    if (!silent) toast('error', '钱包不存在');
    return null;
  }
  if (!canAutoCalibrate(wallet)) {
    if (!silent) toast('warning', '当前接入不支持自动校准，请使用手工余额');
    return null;
  }
  if (balanceInFlight.has(walletId)) return null;
  balanceInFlight.add(walletId);
  try {
    const key = getWalletApiKey(walletId);
    if (!key) {
      if (!silent) toast('error', '请先在该钱包填写 API 密钥');
      return null;
    }
    const ctrl = new AbortController();
    const to = setTimeout(() => { try { ctrl.abort(); } catch {} }, 15000);
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      signal: ctrl.signal as any,
    });
    clearTimeout(to);
    const data: any = await response.json();
    if (data.is_available && data.balance_infos?.length) {
      const info = data.balance_infos[0];
      const amount = String(info.total_balance ?? '0');
      const currency = String(info.currency || '').toUpperCase() === 'USD' ? 'USD' : 'CNY';
      const updated = repository.setWalletBalance(walletId, amount, currency, true);
      if (walletId === DEEPSEEK_WALLET_ID) {
        state.balance = {
          balance: amount,
          currency,
          available: data.is_available,
          timestamp: Date.now(),
        };
        try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
      }
      if (!silent && updated) toast('success', '余额已更新 ' + walletCurrencyLabel(updated));
      return updated;
    }
    if (!silent) toast('error', data.error?.message || '查询失败');
    return null;
  } catch (error: any) {
    const message = error?.name === 'AbortError' ? '查询超时(15s)' : (error?.message || error);
    log.error('余额查询失败', error);
    if (!silent) toast('error', '网络错误: ' + message);
    return null;
  } finally {
    balanceInFlight.delete(walletId);
  }
}

/** 兼容旧调用：与概览选择器一致，默认校准 DeepSeek 官方钱包。 */
export async function queryBalance(silent = false): Promise<any> {
  const selected = String(state.settings.overviewWalletId || 'all');
  const walletId = selected === 'all' ? DEEPSEEK_WALLET_ID : selected;
  return queryWalletBalance(walletId, silent);
}

let balanceTimer: any = null;
export function restartBalanceTimer(): void {
  if (balanceTimer) {
    try { clearInterval(balanceTimer); } catch {}
    balanceTimer = null;
  }
  const settings: any = state.settings;
  if (!settings.autoBalance) return;
  const minutes = Math.min(Math.max(parseInt(settings.balanceInterval) || 10, 1), 1440);
  balanceTimer = setInterval(() => {
    const ignored = new Set(state.walletIgnored || []);
    for (const wallet of state.wallets || []) {
      if (ignored.has(wallet.id) || wallet.balance.mode !== 'auto') continue;
      queryWalletBalance(wallet.id, true).catch(() => {});
    }
  }, minutes * 60 * 1000);
}

export function stopBalanceTimer(): void {
  if (balanceTimer) {
    try { clearInterval(balanceTimer); } catch {}
    balanceTimer = null;
  }
}
