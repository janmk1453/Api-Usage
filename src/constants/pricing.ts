// 2026-09-10 12:00+08:00 起 flash 新定价：空闲 0.02/1/4，高峰 2×（0.04/2/8）；该时间前沿用旧价
export const FLASH_PRICE_CUTOFF = new Date('2026-09-10T12:00:00+08:00').getTime();
export const FLASH_OLD_PRICING = {
  offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
  peak: { hit: 0.10, miss: 3.0, output: 9.0 },
} as const;

// 多段价格历史：按模型 + 生效时间戳命中段，支持过去/现在/未来任意多段
// 命中规则：timestamp >= since 的最后一段；since 为 0 表示该模型最早可追溯段
export type PriceSegment = {
  since: number;
  offpeak: PriceTier;
  peak: PriceTier;
  usePeakPricing?: boolean;
  peakHours?: Array<{ start: string; end: string }>;
  label?: string;
};
export const PRICING = {
  'deepseek-v4-flash': {
    usePeakPricing: true,
    offpeak: { hit: 0.02, miss: 1, output: 4 },
    peak: { hit: 0.04, miss: 2, output: 8 },
  },
  'deepseek-v4-pro': {
    usePeakPricing: true,
    offpeak: { hit: 0.15, miss: 4.5, output: 13.5 },
    peak: { hit: 0.30, miss: 9.0, output: 27.0 },
  },
  'deepseek-v4-flash-vision-exp': {
    usePeakPricing: true,
    offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
    peak: { hit: 0.10, miss: 3.0, output: 9.0 },
  },
} as const;

export type PriceTier = { hit: number; miss: number; output: number };
export type ModelPricing = { usePeakPricing: boolean; offpeak: PriceTier; peak: PriceTier };

// 迁移自 DeepSeek使用预测.js:6-10，1:1 保留数值与语义（flash 已按 2026-09-10 新政更新为 0.02/1/4 与 2×）

export const DEFAULT_PEAK_HOURS: Array<{ start: string; end: string }> = [
  { start: '09:00', end: '12:00' },
  { start: '14:00', end: '18:00' },
];

// 内置 DeepSeek 系列多段价格历史（按 since 升序，命中 timestamp >= since 的最后一段）
// 新增一段只需追加 { since: 新政生效时间戳, offpeak, peak, ... }，未来段（since 为未来时间）同样支持
export const PRICE_HISTORY: Record<string, PriceSegment[]> = {
  'deepseek-v4-flash': [
    {
      since: 0,
      offpeak: { ...FLASH_OLD_PRICING.offpeak },
      peak: { ...FLASH_OLD_PRICING.peak },
      usePeakPricing: true,
      label: '2026-09-10 12:00 前旧价',
    },
    {
      since: FLASH_PRICE_CUTOFF,
      offpeak: { ...PRICING['deepseek-v4-flash'].offpeak },
      peak: { ...PRICING['deepseek-v4-flash'].peak },
      usePeakPricing: true,
      label: '2026-09-10 12:00 起新价',
    },
  ],
  'deepseek-v4-pro': [
    {
      since: 0,
      offpeak: { ...PRICING['deepseek-v4-pro'].offpeak },
      peak: { ...PRICING['deepseek-v4-pro'].peak },
      usePeakPricing: true,
    },
  ],
  'deepseek-v4-flash-vision-exp': [
    {
      since: 0,
      offpeak: { ...PRICING['deepseek-v4-flash-vision-exp'].offpeak },
      peak: { ...PRICING['deepseek-v4-flash-vision-exp'].peak },
      usePeakPricing: true,
    },
  ],
};

export const MAX_HISTORY = 2000;
// 保留最近 5 条记录的完整数据（消息/请求体/完整响应原文）
export const DETAIL_KEEP = 5;

export const STORAGE_KEYS = {
  KEY: 'ds_api_key',
  BALANCE: 'ds_balance_data',
  SAVES: 'ds_saves',
  CURRENT_SAVE: 'ds_current_save',
  SETTINGS: 'ds_settings',
  MESSAGE_COUNT: 'ds_message_count',
  CUSTOM_BALANCE: 'ds_custom_balance',
  LAST_VERSION: 'ds_last_version',
  SYNC_META: 'ds_sync_meta',
  WEBDAV_PASS: 'ds_webdav_pass',
  PEAK_DOT_POS: 'ds_peak_dot_pos',
} as const;

export const EXPORT_FORMAT_VERSION = 1;
export const WEBDAV_SYNC_FILE = 'DeepSeekStatSync.json';
export const WEBDAV_REMOTE_VERSION = 1;

// models.dev 自动同步常量
export const PRICING_SYNC_SOURCE = 'https://models.dev/api.json';
export const PRICING_SYNC_FALLBACK = 'https://raw.githubusercontent.com/anomalyco/opencode/main/models.json';
// USD→CNY 汇率，默认兜底
export const DEFAULT_EXCHANGE_RATE = 7.2;
export const EXCHANGE_RATE_FETCH_INTERVAL = 24 * 60 * 60 * 1000;
export const PRICING_SYNC_INTERVAL_MIN = 0; // 0 仅手动
