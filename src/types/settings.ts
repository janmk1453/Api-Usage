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
});

export type Balance = {
  balance: string;
  currency: string;
  available: boolean;
  timestamp: number;
};

export type SyncMeta = Record<string, number>;
