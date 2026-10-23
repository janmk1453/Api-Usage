/**
 * 套餐额度（CodePlan 类）本地估算（纯函数）。
 *
 * 绝大多数厂商没有公开的套餐用量接口（Claude Code / Codex / OpenCode Zen 等），
 * 且浏览器受 CORS 限制无法直连，因此默认按本地历史聚合估算；
 * 只有智谱 GLM、MiniMax、new-api 等少数端点能取到远端真值。
 */
import type { WalletPlanWindow } from '../types/wallet';

export type PlanUsageEntry = {
  timestamp?: number;
  walletId?: string | null;
  total_tokens?: number;
  totalTokens?: number;
  cost?: number;
  total_cost?: number;
};

export type PlanWindowUsage = {
  window: WalletPlanWindow;
  used: number;
  limit: number;
  remaining: number;
  ratio: number;
  startAt: number;
  /** 整体重置时刻；滚动窗口没有整体重置，为 null */
  resetAt: number | null;
  unit: WalletPlanWindow['unit'];
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 窗口起点（滚动窗口回溯，自然月按本地时间月初） */
export function planWindowStart(window: WalletPlanWindow, now: number): number {
  if (window.resetMode === 'calendar') {
    const date = new Date(now);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  if (window.id === '5h') return now - 5 * HOUR;
  if (window.id === '7d') return now - 7 * DAY;
  if (window.id === '1m') return now - 30 * DAY;
  const hours = Number.isFinite(window.hours) && (window.hours as number) > 0 ? (window.hours as number) : 5;
  return now - hours * HOUR;
}

/** 窗口周期（毫秒） */
export function planWindowSpan(window: WalletPlanWindow): number {
  if (window.id === '5h') return 5 * HOUR;
  if (window.id === '7d') return 7 * DAY;
  if (window.id === '1m') return 30 * DAY;
  const hours = Number.isFinite(window.hours) && (window.hours as number) > 0 ? (window.hours as number) : 5;
  return hours * HOUR;
}

/** 整体重置时刻：只有自然月窗口才有（滚动窗口随记录滑出逐步恢复） */
export function planWindowResetAt(window: WalletPlanWindow, now: number): number | null {
  if (window.resetMode !== 'calendar') return null;
  const date = new Date(now);
  date.setMonth(date.getMonth() + 1, 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function entryTokens(entry: PlanUsageEntry): number {
  const value = entry.total_tokens ?? entry.totalTokens;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function entryCost(entry: PlanUsageEntry): number {
  const value = entry.cost ?? entry.total_cost;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function computePlanWindowUsage(
  window: WalletPlanWindow,
  entries: PlanUsageEntry[],
  walletId: string,
  now = Date.now(),
): PlanWindowUsage {
  const startAt = planWindowStart(window, now);
  const resetAt = planWindowResetAt(window, now);
  let used = 0;
  for (const entry of entries) {
    if (!entry) continue;
    if (entry.walletId !== walletId) continue;
    const ts = Number(entry.timestamp);
    if (!Number.isFinite(ts) || ts < startAt) continue;
    if (window.unit === 'token') used += entryTokens(entry);
    else if (window.unit === 'cost') used += entryCost(entry);
    else used += 1;
  }
  const limit = Number.isFinite(window.limit) && window.limit > 0 ? window.limit : 0;
  const remaining = limit > 0 ? Math.max(0, limit - used) : 0;
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  return { window, used, limit, remaining, ratio, startAt, resetAt, unit: window.unit };
}

export function computeAllPlanUsage(
  windows: WalletPlanWindow[],
  entries: PlanUsageEntry[],
  walletId: string,
  now = Date.now(),
): PlanWindowUsage[] {
  return (windows || []).map((window) => computePlanWindowUsage(window, entries, walletId, now));
}

/** 按近期速率估算耗尽时刻；数据不足返回 null */
export function estimateExhaustion(usage: PlanWindowUsage, now = Date.now()): number | null {
  if (!usage.limit || usage.remaining <= 0 || usage.used <= 0) return null;
  const elapsed = Math.max(1, now - usage.startAt);
  const rate = usage.used / elapsed;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const eta = now + usage.remaining / rate;
  if (eta <= now) return null;
  // 自然月窗口：撑到重置就不算「会耗尽」
  if (usage.resetAt != null && eta > usage.resetAt) return null;
  return eta;
}

export function formatPlanUnit(value: number, unit: WalletPlanWindow['unit'] | 'percent' | 'count'): string {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'cost') return value.toFixed(2);
  if (unit === 'percent') return Math.round(value) + '%';
  if (value >= 10000) return (value / 10000).toFixed(1) + ' 万';
  return String(Math.round(value));
}

/** 套餐预设：为常见 CodePlan 提供默认窗口，用户可改 */
export type PlanPreset = {
  id: string;
  label: string;
  windows: WalletPlanWindow[];
};

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: 'glm-coding',
    label: 'GLM Coding Plan（5 小时 + 每周）',
    windows: [
      { id: '5h', label: '5 小时额度', unit: 'token', limit: 0, resetMode: 'rolling' },
      { id: '7d', label: '每周额度', unit: 'token', limit: 0, resetMode: 'rolling' },
    ],
  },
  {
    id: 'minimax-plan',
    label: 'MiniMax 套餐（5 小时 + 每周）',
    windows: [
      { id: '5h', label: '5 小时额度', unit: 'request', limit: 0, resetMode: 'rolling' },
      { id: '7d', label: '每周额度', unit: 'request', limit: 0, resetMode: 'rolling' },
    ],
  },
  {
    id: 'kimi-coding',
    label: 'Kimi For Coding（5 小时 + 每周）',
    windows: [
      { id: '5h', label: '5 小时额度', unit: 'request', limit: 0, resetMode: 'rolling' },
      { id: '7d', label: '每周额度', unit: 'request', limit: 0, resetMode: 'rolling' },
    ],
  },
  {
    id: 'monthly-cost',
    label: '月度预算（按消费额）',
    windows: [
      { id: '1m', label: '本月预算', unit: 'cost', limit: 0, resetMode: 'calendar' },
    ],
  },
];

export function planPresetById(id: string): PlanPreset | null {
  return PLAN_PRESETS.find((preset) => preset.id === id) || null;
}

/**
 * 按适配器给出默认窗口：只按该供应商实际存在的额度窗口生成，
 * 不再让用户在多个供应商预设里挑。
 */
export function planWindowsForAdapter(adapterId: string | null | undefined): WalletPlanWindow[] {
  const id = String(adapterId || '').trim();
  if (id === 'zhipu') {
    return [
      { id: '5h', label: '5 小时额度', unit: 'token', limit: 0, resetMode: 'rolling' },
      { id: '7d', label: '每周额度', unit: 'token', limit: 0, resetMode: 'rolling' },
    ];
  }
  if (id === 'minimax') {
    return [
      { id: '5h', label: '5 小时额度', unit: 'request', limit: 0, resetMode: 'rolling' },
      { id: '7d', label: '每周额度', unit: 'request', limit: 0, resetMode: 'rolling' },
    ];
  }
  if (id === 'new-api') {
    return [{ id: '1m', label: '订阅额度', unit: 'cost', limit: 0, resetMode: 'calendar' }];
  }
  return [];
}

/** 展示用：窗口标题（含周期说明） */
export function describePlanWindow(window: WalletPlanWindow): string {
  if (window.label) return window.label;
  if (window.id === '5h') return '5 小时额度';
  if (window.id === '7d') return '每周额度';
  if (window.id === '1m') return window.resetMode === 'calendar' ? '本月额度' : '30 天额度';
  return (Number.isFinite(window.hours) ? window.hours : 5) + ' 小时额度';
}

export const PLAN_UNIT_LABEL: Record<WalletPlanWindow['unit'], string> = {
  token: 'tokens',
  cost: '金额',
  request: '次请求',
};
