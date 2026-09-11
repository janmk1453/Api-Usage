import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { state } from '../store/index';
import { defaultSettings } from '../types/settings';
import { createWalletFromConnection } from '../data/wallets';
import { defaultCatalogProvider } from '../types/wallet';
import { previewSync, syncPricingFromModelsDev } from './pricing-sync';

function catalogWithPrice(input: number, miss = 1, output = 2) {
  return {
    deepseek: {
      models: {
        'relay-model': {
          cost: {
            input,
            output,
            cache_read: miss,
          },
        },
      },
    },
  };
}

describe('钱包价格同步', () => {
  beforeEach(() => {
    state.settings = defaultSettings();
    state.settings.pricingSync.enabled = true;
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
    state.wallets = [wallet];
    state.walletIgnored = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('预览时按钱包统计新增模型', () => {
    const preview = previewSync(catalogWithPrice(1, 0.2, 2));
    expect(preview).toMatchObject({ added: 1, total: 1 });
  });

  it('同步写入钱包并遵守仅新增模式', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => catalogWithPrice(1, 0.2, 2),
    }));

    const first = await syncPricingFromModelsDev({ silent: true });
    expect(first).toMatchObject({ added: 1, total: 1 });
    const syncedWallet = state.wallets.find((wallet) => wallet.endpointId === 'sync-endpoint')!;
    const syncedModel = syncedWallet.models.find((model) => model.sourceModel === 'relay-model')!;
    expect(syncedModel).toMatchObject({
      sourceModel: 'relay-model',
      source: 'sync',
    });
    expect(syncedModel.price.offpeak).toMatchObject({
      hit: 1.4,
      miss: 7,
      output: 14,
    });

    const second = await syncPricingFromModelsDev({ silent: true });
    expect(second).toMatchObject({ added: 1, skipped: 1, total: 2 });
  });
});
