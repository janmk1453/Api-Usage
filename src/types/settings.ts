export type PeakHour = { start: string; end: string };
export type CustomModel = {
  model: string;
  usePeakPricing?: boolean;
  offpeak: { hit: string | number; miss: string | number; output: string | number };
  peak: { hit: string | number; miss: string | number; output: string | number };
};

export type WebdavSettings = {
  url: string;
  username: string;
  path: string;
  proxy: string;
};

export type ThemeMode = 'light' | 'dark';

export type HistoryScope = 'all' | 'current';
// 概览四块可自定义指标
export type OverviewFourKey =
  | 'avg_cost' | 'avg_tokens' | 'avg_duration' | 'avg_rate'
  | 'avg_input_cost' | 'avg_input_tokens' | 'avg_output_cost' | 'avg_output_tokens'
  | 'avg_think_time' | 'avg_think_tokens'
  | 'avg_hit_rate' | 'latest_hit_rate'
  | 'max_output' | 'max_input' | 'max_total';
export type Settings = {
  theme: ThemeMode;
  autoBalance: boolean;
  balanceInterval: number;
  debug: boolean;
  debugHit: number;
  debugMiss: number;
  debugOutput: number;
  debugModel: string;
  debugDateStart: string;
  debugDateEnd: string;
  debugBatchCount: number;
  useNewPricing: boolean;
  newPricingDate: number;
  customModels: CustomModel[];
  peakHours: PeakHour[];
  peakDot: boolean;
  webdav: WebdavSettings;
  historyScope: HistoryScope;
  overviewFour: OverviewFourKey[];
  modelsPricingCollapsed?: boolean;
};

export const defaultSettings = (): Settings => ({
  theme: 'light',
  autoBalance: false,
  balanceInterval: 10,
  debug: false,
  debugHit: 10000,
  debugMiss: 5000,
  debugOutput: 2000,
  debugModel: 'deepseek-v4-flash',
  debugDateStart: '',
  debugDateEnd: '',
  debugBatchCount: 30,
  useNewPricing: true,
  newPricingDate: new Date('2026-08-17T00:00:00+08:00').getTime(),
  customModels: [],
  peakHours: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
  peakDot: true,
  webdav: { url: 'https://dav.jianguoyun.com/dav/', username: '', path: '', proxy: '' },
  historyScope: 'all',
  overviewFour: ['avg_cost', 'avg_tokens', 'avg_duration', 'avg_rate', 'avg_input_tokens', 'avg_output_tokens', 'avg_hit_rate', 'max_total'],
  modelsPricingCollapsed: true,
});

export type Balance = {
  balance: string;
  currency: string;
  available: boolean;
  timestamp: number;
};

export type SyncMeta = Record<string, number>;
