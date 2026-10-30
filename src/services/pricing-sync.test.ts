import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { state } from '../store/index';
import { defaultSettings } from '../types/settings';
import { createWalletFromConnection, observeModel } from '../data/wallets';
import { defaultCatalogProvider } from '../types/wallet';
import { buildSyncPlan, syncPricingFromModelsDev } from './pricing-sync';

function catalogWithPrice(input: number, cacheRead = 0.2, output = 2) {
  return {
    deepseek: {
      models: {
        'relay-model': { cost: { input, output, cache_read: cacheRead } },
        'unused-model': { cost: { input: 9, output: 9, cache_read: 9 } },
      },
    },
  };
}

function currentWallet() {
  return state.wallets.find((wallet) => wallet.endpointId === 'sync-endpoint')!;
}

describe('钱包价格同步（模糊匹配写入）', () => {
  beforeEach(() => {
    state.settings = defaultSettings();
    state.settings.pricingSync.exchangeRate = 7;
    state.settings.pricingSync.mode = 'add-missing';
    const wallet = createWalletFromConnection({
      sourceType: 'custom',
      endpointId: 'sync-endpoint',
      endpointLabel: 'relay.sync/v1',
      credentialId: null,
      credentialLabel: null,
    }, state.settings, 1000)!;
    wallet.catalogProvider = defaultCatalogProvider('deepseek');
    observeModel(wallet, 'relay-model', 1000);
    state.wallets = [wallet];
    state.walletIgnored = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('只为已识别模型匹配价格，不遍历目录全集也不新增模型', () => {
    const plan = buildSyncPlan(catalogWithPrice(1));
    expect(plan.summary.catalogModels).toBe(2);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({
      localModel: 'relay-model',
      catalogModel: 'relay-model',
      action: 'write',
      changed: true,
    });
  });

  it('同步写入钱包价格并留下匹配元数据', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => catalogWithPrice(1),
    }));

    const first = await syncPricingFromModelsDev({ silent: true, force: true });
    expect(first?.rows[0]?.action).toBe('write');

    const wallet = currentWallet();
    // 目录里的 unused-model 不得被灌入钱包
    expect(wallet.models).toHaveLength(1);
    const synced = wallet.models[0];
    expect(synced.source).toBe('sync');
    expect(synced.price.priceConfigured).toBe(true);
    expect(synced.price.offpeak).toMatchObject({ hit: 1.4, miss: 7, output: 14 });
    expect(synced.priceMatch).toMatchObject({ provider: 'deepseek', catalogModel: 'relay-model', score: 1 });
  });

  it('只补未定价模式（add-missing）不覆盖已有价格', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => catalogWithPrice(1),
    }));
    await syncPricingFromModelsDev({ silent: true, force: true });

    const second = await syncPricingFromModelsDev({ silent: true, force: true });
    const row = second?.rows.find((item) => item.localModel === 'relay-model');
    expect(row?.action).toBe('skip-same');
    expect(row?.changed).toBe(false);
  });

  it('没有选择价格来源的钱包不参与同步，也不会联网拉目录', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    currentWallet().catalogProvider = null;

    const plan = await syncPricingFromModelsDev({ silent: true, force: true });
    expect(plan).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('只要钱包选了价格来源就同步，不再依赖任何全局开关', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => catalogWithPrice(1),
    }));
    const plan = await syncPricingFromModelsDev({ silent: true, force: true });
    expect(plan?.summary.matched).toBe(1);
    expect(currentWallet().models[0].price.priceConfigured).toBe(true);
  });

  it('覆盖未锁定模式且尊重 locked 保护', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => catalogWithPrice(1),
    }));
    await syncPricingFromModelsDev({ silent: true, force: true });
    const wallet = currentWallet();
    wallet.models[0].locked = true;

    const plan = buildSyncPlan(catalogWithPrice(3), { mode: 'overwrite-unlocked' });
    expect(plan.rows.find((item) => item.localModel === 'relay-model')?.action).toBe('skip-locked');

    const forced = buildSyncPlan(catalogWithPrice(3), { mode: 'overwrite-all' });
    expect(forced.rows.find((item) => item.localModel === 'relay-model')?.action).toBe('update');
  });
});
