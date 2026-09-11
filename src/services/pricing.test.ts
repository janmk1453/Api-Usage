import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../types/settings';
import {
  calcCost,
  calcSavings,
  hasPriceForModel,
  isDeepSeekOfficialModel,
  normalizeModel,
} from './pricing';
import type { WalletConfig } from '../types/wallet';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...overrides };
}

function usage(timestamp: number, model: string, miss = 1_000_000) {
  return {
    timestamp,
    model,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: miss,
    completion_tokens: 0,
  };
}

function localTimestamp(year: number, month: number, day: number, hour: number): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

function makeWallet(overrides: Partial<WalletConfig> = {}): WalletConfig {
  return {
    id: 'wallet:test',
    name: '测试钱包',
    kind: 'relay',
    sourceType: 'custom',
    endpointId: 'endpoint-test',
    endpointLabel: 'relay.test/v1',
    endpointDisplay: 'relay.test/v1',
    catalogProvider: 'deepseek',
    balance: {
      mode: 'manual',
      amount: null,
      currency: 'CNY',
      primaryCredentialId: null,
      lastCalibrated: null,
    },
    peakHours: [{ start: '09:00', end: '12:00' }],
    weekendOffpeak: false,
    credentials: [],
    models: [],
    collapsed: true,
    createdAt: 0,
    updatedAt: 0,
    lastUsedAt: null,
    ...overrides,
  };
}

describe('模型定价', () => {
  it('归一化空值、前缀和模型别名', () => {
    expect(normalizeModel('')).toBe('deepseek-v4-flash');
    expect(normalizeModel('[OR] deepseek-v4-pro')).toBe('deepseek-v4-pro');
    expect(normalizeModel('deepseek-v4.1-flash')).toBe('deepseek-flash');
    expect(normalizeModel('  DEEPSEEK-FLASH  ')).toBe('deepseek-flash');
  });

  it('识别 DeepSeek 官方模型', () => {
    expect(isDeepSeekOfficialModel('deepseek-v4-pro')).toBe(true);
    expect(isDeepSeekOfficialModel('vendor/deepseek-v4-pro')).toBe(true);
    expect(isDeepSeekOfficialModel('other-model')).toBe(false);
  });

  it('按记录时间命中 V4 Flash 新旧价格段', () => {
    const settings = makeSettings();
    const beforeCutoff = localTimestamp(2026, 9, 9, 13);
    const afterCutoff = localTimestamp(2026, 9, 11, 13);

    expect(calcCost(usage(beforeCutoff, 'deepseek-v4-flash'), settings).total).toBeCloseTo(1.5, 8);
    expect(calcCost(usage(afterCutoff, 'deepseek-v4-flash'), settings).total).toBeCloseTo(1, 8);
  });

  it('高峰双倍计价且周末回落为空闲价', () => {
    const settings = makeSettings();
    const peak = localTimestamp(2026, 9, 11, 10);
    const weekend = localTimestamp(2026, 9, 12, 10);

    expect(calcCost(usage(peak, 'deepseek-v4-flash'), settings)).toMatchObject({
      total: 2,
      priceType: 'new-peak',
    });
    expect(calcCost(usage(weekend, 'deepseek-v4-flash'), settings)).toMatchObject({
      total: 1,
      priceType: 'new-offpeak',
    });
  });

  it('自定义价格优先且支持关闭峰谷', () => {
    const settings = makeSettings({
      customModels: [{
        model: 'deepseek-v4-pro',
        usePeakPricing: false,
        offpeak: { hit: '0.5', miss: '2', output: '3' },
        peak: { hit: '1', miss: '4', output: '6' },
      }],
    });
    const peak = localTimestamp(2026, 9, 11, 10);

    expect(hasPriceForModel('deepseek-v4-pro', settings)).toBe(true);
    expect(calcCost(usage(peak, 'deepseek-v4-pro'), settings).total).toBe(2);
  });

  it('无价格模型返回零费用，添加自定义价后可计价', () => {
    const empty = makeSettings();
    const custom = makeSettings({
      customModels: [{
        model: 'third-party',
        offpeak: { hit: 0, miss: 1, output: 0 },
        peak: { hit: 0, miss: 2, output: 0 },
      }],
    });
    const timestamp = localTimestamp(2026, 9, 11, 13);

    expect(hasPriceForModel('third-party', empty)).toBe(false);
    expect(calcCost(usage(timestamp, 'third-party'), empty).total).toBe(0);
    expect(hasPriceForModel('third-party', custom)).toBe(true);
    expect(calcCost(usage(timestamp, 'third-party'), custom).total).toBe(1);
  });

  it('按钱包隔离同名模型价格', () => {
    const timestamp = localTimestamp(2026, 9, 11, 13);
    const settings = makeSettings();
    const first = makeWallet({
      id: 'wallet:first',
      models: [{
        id: 'model:first',
        sourceModel: 'shared-model',
        model: 'shared-model',
        aliases: [],
        price: {
          usePeakPricing: false,
          offpeak: { hit: 0, miss: 1, output: 0 },
          peak: { hit: 0, miss: 1, output: 0 },
          priceConfigured: true,
        },
        source: 'manual',
        locked: false,
        discoveredAt: 0,
        lastSeen: 0,
        updatedAt: 0,
      }],
    });
    const second = makeWallet({
      id: 'wallet:second',
      models: [{
        ...first.models[0],
        id: 'model:second',
        price: {
          usePeakPricing: false,
          offpeak: { hit: 0, miss: 2, output: 0 },
          peak: { hit: 0, miss: 2, output: 0 },
          priceConfigured: true,
        },
      }],
    });

    expect(calcCost(usage(timestamp, 'shared-model'), settings, first).total).toBe(1);
    expect(calcCost(usage(timestamp, 'shared-model'), settings, second).total).toBe(2);
  });

  it('非 DeepSeek 模型也可按钱包峰谷规则计费', () => {
    const settings = makeSettings();
    const wallet = makeWallet({
      models: [{
        id: 'model:peak',
        sourceModel: 'glm-5',
        model: 'glm-5',
        aliases: [],
        price: {
          usePeakPricing: true,
          offpeak: { hit: 0, miss: 1, output: 0 },
          peak: { hit: 0, miss: 3, output: 0 },
          priceConfigured: true,
        },
        source: 'manual',
        locked: false,
        discoveredAt: 0,
        lastSeen: 0,
        updatedAt: 0,
      }],
    });

    expect(calcCost(usage(localTimestamp(2026, 9, 11, 10), 'glm-5'), settings, wallet)).toMatchObject({
      total: 3,
      priceType: 'wallet-peak',
      source: 'wallet',
    });
    expect(calcCost(usage(localTimestamp(2026, 9, 11, 13), 'glm-5'), settings, wallet).total).toBe(1);
  });

  it('钱包待定价模型先返回零费用，配置后按钱包价计费', () => {
    const settings = makeSettings();
    const timestamp = localTimestamp(2026, 9, 11, 13);
    const wallet = makeWallet({
      id: 'wallet:pending',
      models: [{
        id: 'model:pending',
        sourceModel: 'relay-model',
        model: 'relay-model',
        aliases: [],
        price: {
          usePeakPricing: true,
          offpeak: { hit: 0, miss: 0, output: 0 },
          peak: { hit: 0, miss: 0, output: 0 },
          priceConfigured: false,
        },
        source: 'discovered',
        locked: false,
        discoveredAt: 0,
        lastSeen: 0,
        updatedAt: 0,
      }],
    });

    expect(calcCost(usage(timestamp, 'relay-model'), settings, wallet)).toMatchObject({
      total: 0,
      priceType: 'unpriced',
      source: 'unpriced',
    });
    wallet.models[0].price = {
      usePeakPricing: false,
      offpeak: { hit: 0, miss: 1.5, output: 0 },
      peak: { hit: 0, miss: 2, output: 0 },
      priceConfigured: true,
    };
    wallet.models[0].source = 'manual';
    expect(calcCost(usage(timestamp, 'relay-model'), settings, wallet).total).toBe(1.5);
  });

  it('V4 Pro 下线后按 V4 Flash 价格计费', () => {
    const settings = makeSettings();
    const retired = localTimestamp(2026, 9, 15, 13);
    expect(calcCost(usage(retired, 'deepseek-v4-pro'), settings).total).toBe(1);
  });

  it('节省金额按命中价与未命中价差额计算', () => {
    const settings = makeSettings();
    const afterCutoff = localTimestamp(2026, 9, 11, 13);
    const saved = calcSavings(usage(afterCutoff, 'deepseek-flash', 0), settings);
    expect(saved).toBeCloseTo(0, 8);

    const hitUsage = {
      ...usage(afterCutoff, 'deepseek-flash', 0),
      prompt_cache_hit_tokens: 1_000_000,
    };
    expect(calcSavings(hitUsage, settings)).toBeCloseTo(0.98, 8);
  });
});
