import type { PeakHour } from './settings';

export type WalletCurrency = 'CNY' | 'USD';
export type WalletKind = 'official' | 'relay';
export type WalletBalanceMode = 'manual' | 'auto';
export type WalletModelSource = 'builtin' | 'manual' | 'sync' | 'discovered';
export type WalletPriceTier = {
  hit: number;
  miss: number;
  output: number;
};
export type WalletPriceRule = {
  usePeakPricing: boolean;
  offpeak: WalletPriceTier;
  peak: WalletPriceTier;
  priceConfigured: boolean;
};
export type WalletBalance = {
  mode: WalletBalanceMode;
  amount: string | null;
  currency: WalletCurrency;
  primaryCredentialId: string | null;
  lastCalibrated: number | null;
};
export type WalletCredentialObservation = {
  id: string;
  label: string;
  lastSeen: number;
};
/** 价格同步时命中的供应商目录模型（用于审计「这条价格是哪来的」） */
export type WalletPriceMatch = {
  provider: string;
  catalogModel: string;
  /** 模糊匹配置信度 0–1，1 表示归一化后完全相等 */
  score: number;
  matchedAt: number;
};

export type WalletModel = {
  id: string;
  sourceModel: string;
  model: string;
  aliases: string[];
  /** 模型上下文上限；未配置时由内置能力表推断 */
  contextLimit?: number | null;
  /** 上下文上限是否为用户手动设置；false/缺省表示自动推断 */
  contextLimitManual?: boolean;
  price: WalletPriceRule;
  source: WalletModelSource;
  locked: boolean;
  /** 最近一次价格同步的匹配信息；无则为 null */
  priceMatch?: WalletPriceMatch | null;
  /** 旧版本「全量灌入」遗留的同步条目：默认不在列表中显示，可直接删除 */
  hidden?: boolean;
  discoveredAt: number;
  lastSeen: number;
  updatedAt: number;
};
export type WalletConfig = {
  id: string;
  name: string;
  kind: WalletKind;
  sourceType: string | null;
  endpointId: string | null;
  endpointLabel: string | null;
  endpointDisplay: string | null;
  catalogProvider: string | null;
  balance: WalletBalance;
  peakHours: PeakHour[];
  weekendOffpeak: boolean;
  credentials: WalletCredentialObservation[];
  models: WalletModel[];
  collapsed: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  legacyPricingImported?: boolean;
};

export const DEEPSEEK_WALLET_ID = 'wallet:deepseek-official';

export const WALLET_CATALOG_PROVIDERS: Array<{ id: string; label: string }> = [
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'xai', label: 'xAI' },
  { id: 'moonshotai', label: 'Moonshot AI' },
  { id: 'zai', label: 'Z.AI' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'cohere', label: 'Cohere' },
];

export function isFirstPartyCatalogProvider(value: unknown): boolean {
  const id = String(value || '').trim().toLowerCase();
  return WALLET_CATALOG_PROVIDERS.some((provider) => provider.id === id);
}

export function defaultCatalogProvider(sourceType: string | null | undefined): string | null {
  const key = String(sourceType || '').trim().toLowerCase();
  const map: Record<string, string> = {
    deepseek: 'deepseek',
    openai: 'openai',
    claude: 'anthropic',
    makersuite: 'google',
    vertexai: 'google',
    mistralai: 'mistral',
    xai: 'xai',
    moonshot: 'moonshotai',
    zai: 'zai',
    minimax: 'minimax',
    cohere: 'cohere',
  };
  return map[key] || null;
}

export function walletCurrencyOrDefault(value: unknown): WalletCurrency {
  return String(value || '').trim().toUpperCase() === 'USD' ? 'USD' : 'CNY';
}

// 自动识别出的模型（source='discovered'）默认不启用峰谷计价：
// 中转/第三方接入通常只有一个价格，勾上峰谷会让价格只按低谷时段命中。
// 只影响新建的规则；已有钱包里的模型走 normalizeWalletPriceRule，保留用户原有设置。
export function emptyWalletPriceRule(): WalletPriceRule {
  return {
    usePeakPricing: false,
    offpeak: { hit: 0, miss: 0, output: 0 },
    peak: { hit: 0, miss: 0, output: 0 },
    priceConfigured: false,
  };
}
