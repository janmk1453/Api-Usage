import { describe, expect, it } from 'vitest';
import { probeWallet, resolveBalanceAdapter, walletSupportsAutoQuery } from './balance-adapters';
import type { WalletConfig } from '../types/wallet';
import { createDeepSeekWallet } from '../data/wallets';
import { defaultSettings } from '../types/settings';

function wallet(patch: Partial<WalletConfig> = {}): WalletConfig {
  return {
    id: 'wallet:relay',
    name: 'relay',
    kind: 'relay',
    sourceType: 'custom',
    endpointId: 'ep',
    endpointLabel: 'api.deepseek.com',
    endpointDisplay: 'https://api.deepseek.com',
    catalogProvider: 'deepseek',
    balance: { mode: 'manual', amount: null, currency: 'CNY', primaryCredentialId: null, lastCalibrated: null, adapter: null, userId: null },
    peakHours: [{ start: '09:00', end: '12:00' }],
    weekendOffpeak: true,
    credentials: [],
    models: [],
    collapsed: true,
    createdAt: 0,
    updatedAt: 0,
    lastUsedAt: null,
    ...patch,
  } as WalletConfig;
}

function jsonResponse(payload: any, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as any;
}

describe('resolveBalanceAdapter', () => {
  it('官方域名自动识别', () => {
    expect(resolveBalanceAdapter(wallet())?.id).toBe('deepseek');
    expect(resolveBalanceAdapter(wallet({ endpointDisplay: 'https://api.moonshot.cn' }))?.id).toBe('moonshot');
  });

  it('未知中转站不自动猜，显式指定后生效', () => {
    const relay = wallet({ endpointDisplay: 'https://relay.example.com', catalogProvider: null });
    expect(resolveBalanceAdapter(relay)).toBeNull();
    const explicit = wallet({ endpointDisplay: 'https://relay.example.com', balance: { ...relay.balance, adapter: 'new-api' } });
    expect(resolveBalanceAdapter(explicit)?.id).toBe('new-api');
    expect(walletSupportsAutoQuery(explicit)).toBe(true);
  });

  it('DeepSeek 官方钱包走内置适配器', () => {
    const official = createDeepSeekWallet(defaultSettings(), 1000);
    expect(resolveBalanceAdapter(official)?.id).toBe('deepseek');
  });
});

describe('probeWallet', () => {
  it('解析 DeepSeek 余额', async () => {
    const fetchImpl = async () => jsonResponse({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '12.34' }] });
    const result = await probeWallet(wallet(), 'sk-test', { fetchImpl: fetchImpl as any });
    expect(result?.ok).toBe(true);
    expect(result?.balance).toEqual({ amount: '12.34', currency: 'CNY' });
  });

  it('401 归类为鉴权失败', async () => {
    const fetchImpl = async () => jsonResponse({ error: 'bad key' }, 401);
    const result = await probeWallet(wallet(), 'sk-test', { fetchImpl: fetchImpl as any });
    expect(result?.ok).toBe(false);
    expect(result?.reason).toBe('auth');
  });

  it('浏览器跨域失败归类为 cors', async () => {
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
    const result = await probeWallet(wallet(), 'sk-test', { fetchImpl: fetchImpl as any });
    expect(result?.ok).toBe(false);
    expect(result?.reason).toBe('cors');
  });

  it('少 key 时直接提示', async () => {
    const result = await probeWallet(wallet(), '');
    expect(result?.reason).toBe('missing-key');
  });

  it('智谱 GLM 套餐：两个 TOKENS_LIMIT 按重置时间排序', async () => {
    const fetchImpl = async () => jsonResponse({
      success: true,
      data: {
        level: 'pro',
        limits: [
          { type: 'TOKENS_LIMIT', percentage: 42, nextResetTime: 2000 },
          { type: 'TOKENS_LIMIT', percentage: 12, nextResetTime: 1000 },
          { type: 'TIME_LIMIT', percentage: 5, nextResetTime: 3000 },
        ],
      },
    });
    const result = await probeWallet(wallet({ endpointDisplay: 'https://open.bigmodel.cn', catalogProvider: 'zai' }), 'key', { fetchImpl: fetchImpl as any });
    expect(result?.ok).toBe(true);
    expect(result?.quotas?.map((item) => item.id)).toEqual(['5h', '7d']);
    expect(result?.quotas?.[0].used).toBe(12);
    expect(result?.quotas?.[1].used).toBe(42);
  });

  it('MiniMax：usage_count 语义为剩余', async () => {
    const fetchImpl = async () => jsonResponse({
      data: {
        current_interval_total_count: 100,
        current_interval_usage_count: 30,
        current_interval_reset_at: 5000,
      },
    });
    const result = await probeWallet(wallet({ endpointDisplay: 'https://api.minimaxi.com', catalogProvider: 'minimax' }), 'key', { fetchImpl: fetchImpl as any });
    expect(result?.ok).toBe(true);
    const fiveHour = result?.quotas?.find((item) => item.id === '5h');
    expect(fiveHour?.limit).toBe(100);
    expect(fiveHour?.remaining).toBe(30);
    expect(fiveHour?.used).toBe(70);
  });

  it('new-api：订阅额度减已用', async () => {
    const fetchImpl = async (url: string) => {
      if (String(url).includes('subscription')) return jsonResponse({ hard_limit_usd: 10, access_until: 9000 });
      return jsonResponse({ total_usage: 250 });
    };
    const relay = wallet({ endpointDisplay: 'https://relay.example.com', balance: { ...wallet().balance, adapter: 'new-api', userId: '7' } });
    const result = await probeWallet(relay, 'token', { fetchImpl: fetchImpl as any });
    expect(result?.ok).toBe(true);
    expect(result?.balance).toEqual({ amount: '7.5000', currency: 'USD' });
    expect(result?.quotas?.[0]).toMatchObject({ unit: 'cost', used: 2.5, limit: 10 });
  });
});
