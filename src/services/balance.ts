import { state } from '../store/index';
import { repository } from '../data/repository';
import { log, toast } from '../utils/logger';
import { getWalletApiKey, saveWalletApiKey } from './wallet-secrets';
import { DEEPSEEK_WALLET_ID, type WalletConfig } from '../types/wallet';
import { probeWallet, resolveBalanceAdapter } from './balance-adapters';

export function getApiKey(): string {
  return getWalletApiKey(DEEPSEEK_WALLET_ID);
}

export function saveApiKey(key: string): void {
  saveWalletApiKey(DEEPSEEK_WALLET_ID, key);
}

/** 是否支持自动查询（余额或套餐任一） */
export function canAutoCalibrate(wallet: WalletConfig): boolean {
  return resolveBalanceAdapter(wallet) !== null;
}

function walletCurrencyLabel(wallet: WalletConfig): string {
  return (wallet.balance.currency === 'USD' ? '$' : '¥') + (wallet.balance.amount || '0') + ' ' + wallet.balance.currency;
}

const FAIL_REASON_LABEL: Record<string, string> = {
  cors: '该站点未开放浏览器跨域，请改用通用方式或手工填写',
  auth: '密钥/令牌无效或类型不符',
  http: '接口返回错误状态',
  network: '网络不可达',
  parse: '响应格式无法解析',
  'missing-key': '请先填写该钱包的查询密钥',
  'no-endpoint': '钱包没有可用接入地址',
};

const balanceInFlight = new Set<string>();

/**
 * 查询钱包余额与套餐额度。
 * 余额写入 wallet.balance；套餐快照写入 wallet.plan.remote（仅展示，不参与计费）。
 */
export async function queryWalletBalance(walletId: string, silent = false): Promise<WalletConfig | null> {
  const wallet = repository.getWallet(walletId);
  if (!wallet) {
    if (!silent) toast('error', '钱包不存在');
    return null;
  }
  const adapter = resolveBalanceAdapter(wallet);
  if (!adapter) {
    if (!silent) toast('warning', '当前接入没有可用的自动查询适配器，请使用手工余额');
    return null;
  }
  if (balanceInFlight.has(walletId)) return null;
  balanceInFlight.add(walletId);
  try {
    const key = getWalletApiKey(walletId);
    const probe = await probeWallet(wallet, key, { userId: (wallet.balance as any)?.userId || '' });
    if (!probe) return null;
    const now = Date.now();
    if (!probe.ok) {
      const message = FAIL_REASON_LABEL[probe.reason || 'network'] || probe.message || '查询失败';
      repository.updateWallet(walletId, (next) => {
        const plan = next.plan || { enabled: false, windows: [] };
        plan.remoteError = message;
        next.plan = plan;
      });
      if (!silent) toast('error', adapter.label + '：' + message + (probe.message && probe.reason === 'http' ? '（' + probe.message + '）' : ''));
      return null;
    }
    let updated: WalletConfig | null = wallet;
    if (probe.balance) {
      const amount = String(probe.balance.amount);
      const currency = probe.balance.currency;
      updated = repository.setWalletBalance(walletId, amount, currency, true);
      if (walletId === DEEPSEEK_WALLET_ID) {
        state.balance = { balance: amount, currency, available: true, timestamp: now };
      }
    }
    if (probe.quotas && probe.quotas.length) {
      updated = repository.updateWallet(walletId, (next) => {
        const plan = next.plan || { enabled: false, windows: [] };
        plan.remote = probe.quotas;
        plan.remoteAt = now;
        plan.remoteError = null;
        next.plan = plan;
      }) || updated;
    } else {
      repository.updateWallet(walletId, (next) => {
        if (!next.plan?.remoteError) return;
        const plan = next.plan;
        plan.remoteError = null;
        next.plan = plan;
      });
    }
    try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    if (!silent) {
      const parts: string[] = [];
      if (probe.balance) parts.push('余额 ' + (probe.balance.currency === 'USD' ? '$' : '¥') + probe.balance.amount);
      if (probe.quotas?.length) parts.push('套餐 ' + probe.quotas.length + ' 个窗口');
      toast('success', (updated || wallet).name + '：' + (parts.join(' · ') || '已更新'));
    }
    return updated || null;
  } catch (error: any) {
    log.error('余额查询失败', error);
    if (!silent) toast('error', '查询失败：' + (error?.message || error));
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
  const ignored = new Set(state.walletIgnored || []);
  // 勾了「自动校准」的钱包，或启用了本地套餐估算且有可用适配器的钱包
  const autoWallets = (state.wallets || []).filter((wallet) => {
    if (ignored.has(wallet.id)) return false;
    if (!canAutoCalibrate(wallet)) return false;
    return wallet.balance.mode === 'auto' || wallet.plan?.enabled === true;
  });
  if (!autoWallets.length) return;
  const minutes = Math.min(Math.max(parseInt(settings.balanceInterval) || 10, 1), 1440);
  balanceTimer = setInterval(() => {
    const currentIgnored = new Set(state.walletIgnored || []);
    for (const wallet of state.wallets || []) {
      if (currentIgnored.has(wallet.id) || !canAutoCalibrate(wallet)) continue;
      if (wallet.balance.mode !== 'auto' && wallet.plan?.enabled !== true) continue;
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
