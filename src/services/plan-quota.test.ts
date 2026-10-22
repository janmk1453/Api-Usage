import { describe, expect, it } from 'vitest';
import {
  computePlanWindowUsage,
  estimateExhaustion,
  planWindowResetAt,
  planWindowSpan,
  planWindowStart,
} from './plan-quota';
import type { PlanUsageEntry, } from './plan-quota';
import type { WalletPlanWindow } from '../types/wallet';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function entry(offsetMs: number, tokens: number, cost = 0): PlanUsageEntry {
  return { timestamp: Date.now() - offsetMs, walletId: 'w1', total_tokens: tokens, cost };
}

const rolling5h: WalletPlanWindow = { id: '5h', label: '5 小时', unit: 'token', limit: 1000, resetMode: 'rolling' };
const monthly: WalletPlanWindow = { id: '1m', label: '本月', unit: 'cost', limit: 10, resetMode: 'calendar' };

describe('plan-quota 窗口聚合', () => {
  it('滚动 5 小时只统计窗口内记录', () => {
    const now = Date.now();
    const usage = computePlanWindowUsage(rolling5h, [
      entry(1 * HOUR, 300),
      entry(4 * HOUR, 200),
      entry(6 * HOUR, 999),
    ], 'w1', now);
    expect(usage.used).toBe(500);
    expect(usage.remaining).toBe(500);
    expect(usage.ratio).toBeCloseTo(0.5, 5);
  });

  it('只统计指定钱包', () => {
    const now = Date.now();
    const usage = computePlanWindowUsage(rolling5h, [
      { timestamp: now - HOUR, walletId: 'w2', total_tokens: 900 },
      { timestamp: now - HOUR, walletId: 'w1', total_tokens: 100 },
    ], 'w1', now);
    expect(usage.used).toBe(100);
  });

  it('自然月窗口按本地月初起算', () => {
    const now = new Date(2026, 9, 22, 12, 0, 0).getTime();
    const start = planWindowStart(monthly, now);
    expect(new Date(start).getDate()).toBe(1);
    expect(new Date(start).getHours()).toBe(0);
    const reset = planWindowResetAt(monthly, now);
    expect(reset).not.toBeNull();
    expect(new Date(reset as number).getMonth()).toBe(10);
  });

  it('滚动窗口没有整体重置，周期按窗口类型计算', () => {
    const now = Date.now();
    expect(planWindowResetAt(rolling5h, now)).toBeNull();
    expect(planWindowSpan(rolling5h)).toBe(5 * HOUR);
    expect(planWindowSpan({ ...rolling5h, id: '7d' })).toBe(7 * DAY);
  });

  it('按请求数计数', () => {
    const now = Date.now();
    const requests: WalletPlanWindow = { id: '5h', label: '', unit: 'request', limit: 3, resetMode: 'rolling' };
    const usage = computePlanWindowUsage(requests, [entry(HOUR, 0), entry(HOUR, 0), entry(HOUR, 0)], 'w1', now);
    expect(usage.used).toBe(3);
    expect(usage.remaining).toBe(0);
  });
});

describe('estimateExhaustion', () => {
  it('按已用速率给出耗尽时刻', () => {
    const now = Date.now();
    const usage = computePlanWindowUsage(rolling5h, [entry(2 * HOUR, 800)], 'w1', now);
    const eta = estimateExhaustion(usage, now);
    expect(eta).not.toBeNull();
    expect(eta!).toBeGreaterThan(now);
    if (usage.resetAt != null) expect(eta!).toBeLessThanOrEqual(usage.resetAt);
  });

  it('已用为 0 时不预测', () => {
    const now = Date.now();
    const usage = computePlanWindowUsage(rolling5h, [], 'w1', now);
    expect(estimateExhaustion(usage, now)).toBeNull();
  });
});
