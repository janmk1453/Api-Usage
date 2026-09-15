import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { repository } from './repository';
import { state } from '../store/index';
import { defaultSettings } from '../types/settings';
import { createDeepSeekWallet, createWalletFromConnection } from './wallets';
import { DEEPSEEK_WALLET_ID } from '../types/wallet';
import {
  appendHistoryCold,
  clearHistoryCold,
  flushSaveHot,
  loadHistoryCold,
} from '../store/persistence';

function entry(timestamp: number, tokens: number, cost: number): any {
  return {
    timestamp,
    model: 'deepseek-flash',
    total_tokens: tokens,
    prompt_tokens: tokens,
    cache_hit_tokens: 0,
    cache_miss_tokens: tokens,
    completion_tokens: 0,
    input_cost: cost,
    output_cost: 0,
    cost,
  };
}

let context: any;

describe('仓库全量处理', () => {
  beforeEach(async () => {
    context = {
      extensionSettings: {},
      saveSettingsDebounced: vi.fn(),
    };
    (globalThis as any).SillyTavern = { getContext: () => context };
    state.history = [];
    state.total_tokens = 0;
    state.total_cost = 0;
    state.input_tokens = 0;
    state.output_tokens = 0;
    state.cache_hit_tokens = 0;
    state.cache_miss_tokens = 0;
    state.input_cost = 0;
    state.output_cost = 0;
    state.rounds = 0;
    state.settings = defaultSettings();
    state.wallets = [];
    state.walletIgnored = [];
    await clearHistoryCold();
  });

  afterEach(async () => {
    flushSaveHot();
    await clearHistoryCold();
    delete (globalThis as any).SillyTavern;
  });

  it('覆盖替换可以清空冷库', async () => {
    await appendHistoryCold([entry(1, 10, 1)]);
    await repository.replaceAll({ history: [entry(2, 20, 2)] }, { clearCold: true });

    expect(await loadHistoryCold()).toEqual([]);
    expect(state.history).toHaveLength(1);
  });

  it('累计值从热冷全量重建', async () => {
    state.history = [entry(2, 20, 2)];
    await appendHistoryCold([entry(1, 10, 1)]);
    await repository.rebuildAggregates();

    expect(state.total_tokens).toBe(30);
    expect(state.total_cost).toBe(3);
  });

  it('迁移旧 api.deepseek.com/v1 钱包并重新归属历史', async () => {
    const settings = defaultSettings();
    const official = createDeepSeekWallet(settings, 1000);
    const duplicate = createWalletFromConnection({
      sourceType: 'custom',
      endpointId: 'legacy-deepseek-endpoint',
      endpointLabel: 'relay.example/v1',
      credentialId: null,
      credentialLabel: null,
    }, settings, 1000)!;
    duplicate.endpointLabel = 'api.deepseek.com/v1';
    duplicate.endpointDisplay = 'api.deepseek.com/v1';
    duplicate.name = 'api.deepseek.com/v1';
    duplicate.balance.amount = '20';
    duplicate.credentials = [{ id: 'secret:api_key_deepseek:legacy', label: '官方密钥 •••abc', lastSeen: 2000 }];
    const legacyEntry = {
      ...entry(3000, 10, 1),
      sourceType: 'custom',
      endpointId: 'legacy-deepseek-endpoint',
      endpointLabel: 'api.deepseek.com/v1',
      walletId: duplicate.id,
    };
    context.extensionSettings['api_usage_stat'] = {
      _migrated: true,
      history: [legacyEntry],
      wallets: [official, duplicate],
      walletIgnored: [duplicate.id],
      settings,
    };

    await repository.hydrate();

    expect(state.wallets.some((wallet) => wallet.id === duplicate.id)).toBe(false);
    expect(state.history[0].walletId).toBe(DEEPSEEK_WALLET_ID);
    const merged = state.wallets.find((wallet) => wallet.id === DEEPSEEK_WALLET_ID)!;
    expect(merged.balance.amount).toBe('20');
    expect(merged.credentials.some((credential) => credential.id === 'secret:api_key_deepseek:legacy')).toBe(true);
    expect(state.walletIgnored).not.toContain(duplicate.id);
  });

  it('同一主机的不同路径归入同一个钱包', async () => {
    const settings = defaultSettings();
    const first = createWalletFromConnection({
      sourceType: 'custom',
      endpointId: 'youzi-v1',
      endpointLabel: 'relay.example/v1',
      credentialId: null,
      credentialLabel: null,
    }, settings, 1000)!;
    const second = createWalletFromConnection({
      sourceType: 'custom',
      endpointId: 'youzi-ababa',
      endpointLabel: 'relay.example/v2',
      credentialId: null,
      credentialLabel: null,
    }, settings, 1000)!;
    first.endpointLabel = 'youzi.today/v1';
    first.endpointDisplay = 'youzi.today/v1';
    first.name = 'youzi.today/v1';
    second.endpointLabel = 'youzi.today/ababa';
    second.endpointDisplay = 'youzi.today/ababa';
    second.name = 'youzi.today/ababa';
    const entries = [
      { ...entry(4000, 10, 1), sourceType: 'custom', endpointId: 'youzi-v1', endpointLabel: 'youzi.today/v1', walletId: first.id },
      { ...entry(5000, 20, 2), sourceType: 'custom', endpointId: 'youzi-ababa', endpointLabel: 'youzi.today/ababa', walletId: second.id },
    ];
    context.extensionSettings['api_usage_stat'] = {
      _migrated: true,
      history: entries,
      wallets: [createDeepSeekWallet(settings, 1000), first, second],
      settings,
    };

    await repository.hydrate();

    const relayWallets = state.wallets.filter((wallet) => wallet.id !== DEEPSEEK_WALLET_ID);
    expect(relayWallets).toHaveLength(1);
    expect(relayWallets[0].endpointLabel).toBe('youzi.today');
    expect(state.history.map((item) => item.walletId)).toEqual([relayWallets[0].id, relayWallets[0].id]);
  });
});
