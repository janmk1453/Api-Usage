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
  if (!s) return { balanceText: '¥0.00 CNY', totalCost: 0, totalTokens: 0, hit: 0, miss: 0, output: 0, hitRate: 0, savings: 0, inputCost: 0, outputCost: 0, avgCost: 0, avgTokens: 0, avgDuration: 0, avgRate: 0, rounds: 0, remainingRounds: null, avgInputCost: 0, avgInputTokens: 0, avgOutputCost: 0, avgOutputTokens: 0, avgThinkTime: 0, avgThinkTokens: 0, avgHitRate: 0, latestHitRate: null, maxOutput: 0, maxInput: 0, maxTotal: 0 } as any;
  const totalCost = s.total_cost || 0;
  const totalTokens = s.total_tokens || 0;
  const hit = s.cache_hit_tokens || 0, miss = s.cache_miss_tokens || 0, output = s.output_tokens || 0;
  const hitRate = hit + miss > 0 ? (hit / (hit + miss) * 100) : 0;
  let savings = 0;
  try { for (const h of s.history || []) savings += calcSavings({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings as any); } catch {}
  const rounds = s.rounds || 0;
  const hist: any[] = s.history || [];
  const avgCost = rounds ? totalCost / rounds : 0;
  const avgTokens = rounds ? totalTokens / rounds : 0;
  const avgDuration = hist.length ? (hist.reduce((a: number, h: any) => a + (h.duration || 0), 0) / hist.length) / 1000 : 0;
  const avgRate = hist.length ? (hist.reduce((a: number, h: any) => a + (h.tokenRate || 0), 0) / hist.length) : 0;
  // 新增：输入/输出均摊
  const inputTokens = s.input_tokens || 0;
  const avgInputCost = rounds ? (s.input_cost || 0) / rounds : 0;
  const avgInputTokens = rounds ? inputTokens / rounds : 0;
  const avgOutputCost = rounds ? (s.output_cost || 0) / rounds : 0;
  const avgOutputTokens = rounds ? output / rounds : 0;
  // 思维链（剔除 0）
  const thinkTimes = hist.map((h: any) => h.thinkTime || 0).filter((v: number) => v > 0);
  const thinkTokensArr = hist.map((h: any) => h.thinkTokens || 0).filter((v: number) => v > 0);
  const avgThinkTime = thinkTimes.length ? (thinkTimes.reduce((a: number, b: number) => a + b, 0) / thinkTimes.length) / 1000 : 0;
  const avgThinkTokens = thinkTokensArr.length ? thinkTokensArr.reduce((a: number, b: number) => a + b, 0) / thinkTokensArr.length : 0;
  // 平均命中率（剔除 0）
  const hitRates = hist.map((h: any) => {
    const ch = h.cache_hit_tokens || 0, cm = h.cache_miss_tokens || 0, tot = ch + cm;
    return tot > 0 ? (ch / tot * 100) : 0;
  }).filter((v: number) => v > 0);
  const avgHitRate = hitRates.length ? hitRates.reduce((a: number, b: number) => a + b, 0) / hitRates.length : 0;
  // 最新一轮命中率（0 也显示，无数据则 null）
  let latestHitRate: number | null = null;
  if (hist.length) {
    const latest = [...hist].sort((a, b) => b.timestamp - a.timestamp)[0];
    const ch = latest.cache_hit_tokens || 0, cm = latest.cache_miss_tokens || 0, tot = ch + cm;
    latestHitRate = tot > 0 ? (ch / tot * 100) : 0;
  }
  // 历史单轮最大
  let maxOutput = 0, maxInput = 0, maxTotal = 0;
  for (const h of hist) {
    const out = h.completion_tokens || 0;
    const inp = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) || h.prompt_tokens || 0;
    const tot = h.total_tokens || 0;
    if (out > maxOutput) maxOutput = out;
    if (inp > maxInput) maxInput = inp;
    if (tot > maxTotal) maxTotal = tot;
  }
  const bal = state.customBalance || state.balance?.balance;
  // 余额预测：仅基于 DeepSeek 官方模型历史（deepseek*），EWMA alpha=0.3，与原脚本一致
  let remainingRounds: number | null = null;
  try {
    const balNum = bal != null && bal !== '' ? parseFloat(String(bal)) : NaN;
    if (!isNaN(balNum) && s.history?.length) {
      const dsHist = (s.history || []).filter((h: any) => typeof h.model === 'string' && h.model.toLowerCase().indexOf('deepseek') === 0);
      if (dsHist.length) {
        const alpha = 0.3;
        let ewma = dsHist[dsHist.length - 1].cost || 0;
        for (let i = dsHist.length - 2; i >= 0; i--) ewma = alpha * (dsHist[i].cost || 0) + (1 - alpha) * ewma;
        if (ewma > 0) remainingRounds = Math.floor(balNum / ewma);
      }
    }
  } catch {}
  return {
    balanceText: bal ? '¥' + bal + ' CNY' : '¥0.00 CNY',
    totalCost, totalTokens, hit, miss, output, hitRate, savings,
    inputCost: s.input_cost || 0, outputCost: s.output_cost || 0,
    avgCost, avgTokens, avgDuration, avgRate, rounds, remainingRounds,
    avgInputCost, avgInputTokens, avgOutputCost, avgOutputTokens, avgThinkTime, avgThinkTokens, avgHitRate, latestHitRate, maxOutput, maxInput, maxTotal,
  } as any;
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
