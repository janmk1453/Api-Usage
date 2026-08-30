// 迁移自 DeepSeek使用预测.js:6-10，1:1 保留数值与语义
export const PRICING = {
  'deepseek-v4-flash': {
    usePeakPricing: true,
    offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
    peak: { hit: 0.10, miss: 3.0, output: 9.0 },
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

export const DEFAULT_PEAK_HOURS: Array<{ start: string; end: string }> = [
  { start: '09:00', end: '12:00' },
  { start: '14:00', end: '18:00' },
];

export const MAX_HISTORY = 500;
export const DETAIL_KEEP = 10;

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
