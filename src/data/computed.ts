/**
 * 统一计算层 — 所有展示/统计的唯一来源
 * 禁止在 UI 中直接对 history 做过滤/求和，所有派生在此定义
 */
import { state, getSelectedSave } from '../store/index';
import { calcSavings } from '../services/pricing';
import { localDay } from '../utils/date';
import type { OverviewView, StatsView, TimeRange } from './types';

export function getFilteredHistory(range?: TimeRange): any[] {
  const s: any = getSelectedSave();
  const hist: any[] = s?.history || [];
  if (!range) return hist;
  return hist.filter((h: any) => {
    const k = localDay(h.timestamp);
    return k >= range.start && k <= range.end;
  });
}

export function computeOverview(): OverviewView {
  const s: any = getSelectedSave();
  if (!s) return { balanceText: '¥0.00 CNY', totalCost: 0, totalTokens: 0, hit: 0, miss: 0, output: 0, hitRate: 0, savings: 0, inputCost: 0, outputCost: 0, avgCost: 0, avgTokens: 0, avgDuration: 0, avgRate: 0, rounds: 0 } as any;
  const totalCost = s.total_cost || 0;
  const totalTokens = s.total_tokens || 0;
  const hit = s.cache_hit_tokens || 0, miss = s.cache_miss_tokens || 0, output = s.output_tokens || 0;
  const hitRate = hit + miss > 0 ? (hit / (hit + miss) * 100) : 0;
  let savings = 0;
  try { for (const h of s.history || []) savings += calcSavings({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings as any); } catch {}
  const rounds = s.rounds || 0;
  const avgCost = rounds ? totalCost / rounds : 0;
  const avgTokens = rounds ? totalTokens / rounds : 0;
  const avgDuration = s.history?.length ? (s.history.reduce((a: number, h: any) => a + (h.duration || 0), 0) / s.history.length) / 1000 : 0;
  const avgRate = s.history?.length ? (s.history.reduce((a: number, h: any) => a + (h.tokenRate || 0), 0) / s.history.length) : 0;
  const bal = state.customBalance || state.balance?.balance;
  return {
    balanceText: bal ? '¥' + bal + ' CNY' : '¥0.00 CNY',
    totalCost, totalTokens, hit, miss, output, hitRate, savings,
    inputCost: s.input_cost || 0, outputCost: s.output_cost || 0,
    avgCost, avgTokens, avgDuration, avgRate, rounds,
  };
}

export function computeStats(range: TimeRange): StatsView {
  const filtered = getFilteredHistory(range);
  let totalCost = 0, totalTokens = 0;
  const byDayMap: Record<string, { cost: number; tokens: number; byModel: Record<string, number> }> = {};
  const byModel: Record<string, { cost: number; count: number }> = {};
  for (const e of filtered) {
    const c = e.cost || 0, t = e.total_tokens || 0;
    totalCost += c; totalTokens += t;
    const k = localDay(e.timestamp);
    if (!byDayMap[k]) byDayMap[k] = { cost: 0, tokens: 0, byModel: {} };
    byDayMap[k].cost += c; byDayMap[k].tokens += t;
    const m = e.model || 'unknown';
    byDayMap[k].byModel[m] = (byDayMap[k].byModel[m] || 0) + c;
    if (!byModel[m]) byModel[m] = { cost: 0, count: 0 };
    byModel[m].cost += c; byModel[m].count += 1;
  }
  const days = Object.keys(byDayMap).sort();
  const byDay = days.map(day => ({ day: day.slice(5).replace('-','/'), cost: Number(byDayMap[day].cost.toFixed(4)), tokens: byDayMap[day].tokens, byModel: byDayMap[day].byModel }));
  return { range, totalCost, totalRequests: filtered.length, totalTokens, byDay, byModel };
}
