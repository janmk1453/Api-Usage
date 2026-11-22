import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 币种换算（services/currency.ts）。
 *
 * 这里错了不会报错，只会把金额显示成另一个数 —— 例如把 CNY 金额按 7.2 再除一次，
 * 用户看到的就是差了七倍的钱。所以固定住「什么时候用 USD、汇率从哪来」两条规则。
 */

const { mockState } = vi.hoisted(() => ({
  mockState: {
    settings: { pricingSync: { exchangeRate: 7.2 } },
    wallets: [] as any[],
    walletIgnored: [] as string[],
  } as any,
}));

vi.mock('../store/index', () => ({ state: mockState }));
vi.mock('../store/persistence', () => ({ saveHot: vi.fn() }));

import {
  cnyToDisplay,
  displayToCny,
  formatMoney,
  formatMoneyWithCode,
  getDisplayCurrency,
  getEffectiveRate,
  walletDrivenCurrency,
} from './currency';

beforeEach(() => {
  mockState.settings = { pricingSync: { exchangeRate: 7.2 } };
  mockState.wallets = [];
  mockState.walletIgnored = [];
});

describe('展示币种由钱包决定', () => {
  it('没有钱包时按 CNY 展示', () => {
    expect(walletDrivenCurrency()).toBe('CNY');
    expect(getDisplayCurrency()).toEqual({ code: 'CNY', symbol: '¥', rate: 1 });
    expect(formatMoney(1.2)).toBe('¥1.2000 CNY');
  });

  it('未忽略的钱包全部是 USD 时才切美元，并按汇率换算', () => {
    mockState.wallets = [{ id: 'w1', balance: { currency: 'USD' } }, { id: 'w2', balance: { currency: 'usd' } }];
    expect(walletDrivenCurrency()).toBe('USD');
    expect(formatMoney(7.2)).toBe('$1.0000 USD');
  });

  it('只要有一个 CNY 钱包就整体按 CNY，避免同页混排两种币种', () => {
    mockState.wallets = [{ id: 'w1', balance: { currency: 'USD' } }, { id: 'w2', balance: { currency: 'CNY' } }];
    expect(walletDrivenCurrency()).toBe('CNY');
  });

  it('被忽略的钱包不参与判定', () => {
    mockState.wallets = [{ id: 'w1', balance: { currency: 'USD' } }, { id: 'w2', balance: { currency: 'CNY' } }];
    mockState.walletIgnored = ['w2'];
    expect(walletDrivenCurrency()).toBe('USD');
  });

  it('钱包没写币种时按 CNY 处理', () => {
    mockState.wallets = [{ id: 'w1' }, { id: 'w2', balance: {} }];
    expect(walletDrivenCurrency()).toBe('CNY');
  });
});

describe('汇率', () => {
  it('配置值非法时退回默认汇率', () => {
    mockState.settings.pricingSync.exchangeRate = 'abc';
    expect(getEffectiveRate()).toBe(7.2);
    mockState.settings.pricingSync.exchangeRate = 0;
    expect(getEffectiveRate()).toBe(7.2);
    mockState.settings.pricingSync.exchangeRate = -3;
    expect(getEffectiveRate()).toBe(7.2);
  });

  it('换算往返不丢精度', () => {
    mockState.wallets = [{ id: 'w1', balance: { currency: 'USD' } }];
    const cny = 12.34;
    expect(cnyToDisplay(cny)).toBeCloseTo(cny / 7.2, 10);
    expect(displayToCny(cnyToDisplay(cny))).toBeCloseTo(cny, 10);
  });

  it('formatMoneyWithCode 指定币种时不受钱包影响', () => {
    mockState.wallets = [{ id: 'w1', balance: { currency: 'USD' } }];
    expect(formatMoneyWithCode(7.2, 2, 'CNY')).toBe('¥7.20 CNY');
    expect(formatMoneyWithCode(7.2, 2, 'USD')).toBe('$1.00 USD');
  });
});
