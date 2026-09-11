/**
 * 统一计算层 — 所有展示/统计的唯一来源
 * 禁止在 UI 中直接对 history 做过滤/求和，所有派生在此定义
 */
import { state, getSelectedSave } from '../store/index';
import { calcSavings } from '../services/pricing';
import { localDay } from '../utils/date';
import { isTruncatedFinish } from '../utils/finish';
import type { OverviewView, StatsView, TimeRange } from './types';
import { formatMoney, getDisplayCurrency, getWalletExchangeRate } from '../services/currency';
import { findWalletForHistory, walletBalanceToCny } from './wallets';

export const STATS_FILTER_ALL = '__all__';
export const STATS_FILTER_UNKNOWN = '__unknown__';
export const STATS_FILTER_NULL = '__null__';

export type StatsHistoryFilter = {
  start?: string;
  end?: string;
  model?: string;
  chat?: string;
  endpoint?: string;
  credential?: string;
};

export type StatsConnectionOption = {
  id: string;
  label: string;
  count: number;
  unknown?: boolean;
};

export function filterStatsHistory(entries: any[], filter: StatsHistoryFilter = {}): any[] {
  return (entries || []).filter((entry: any) => {
    if (!entry) return false;
    if (filter.start || filter.end) {
      const day = localDay(entry.timestamp);
      if (filter.start && day < filter.start) return false;
      if (filter.end && day > filter.end) return false;
    }
    if (filter.model && filter.model !== STATS_FILTER_ALL && entry.model !== filter.model) return false;
    if (filter.chat && filter.chat !== STATS_FILTER_ALL) {
      if (filter.chat === STATS_FILTER_NULL) {
        if (entry.chatId) return false;
      } else if ((entry.chatId ?? null) !== filter.chat) {
        return false;
      }
    }
    if (filter.endpoint && filter.endpoint !== STATS_FILTER_ALL) {
      if (filter.endpoint === STATS_FILTER_UNKNOWN) {
        if (entry.endpointId) return false;
      } else if (entry.endpointId !== filter.endpoint) {
        return false;
      }
    }
    if (filter.credential && filter.credential !== STATS_FILTER_ALL) {
      if (filter.credential === STATS_FILTER_UNKNOWN) {
        if (entry.credentialId) return false;
      } else if (entry.credentialId !== filter.credential) {
        return false;
      }
    }
    return true;
  });
}

function addLabelCollisionSuffix(options: StatsConnectionOption[]): StatsConnectionOption[] {
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.label, (counts.get(option.label) || 0) + 1);
  return options.map((option) => {
    if (option.unknown || (counts.get(option.label) || 0) < 2) return option;
    return { ...option, label: `${option.label} · ${option.id.slice(0, 4)}` };
  });
}

export function getEndpointFilterOptions(history: any[]): StatsConnectionOption[] {
  const map = new Map<string, StatsConnectionOption & { lastSeen: number }>();
  for (const entry of history || []) {
    const unknown = !entry?.endpointId;
    const id = unknown ? STATS_FILTER_UNKNOWN : entry.endpointId;
    const timestamp = Number(entry?.timestamp) || 0;
    const label = unknown
      ? '未记录接入'
      : (entry.endpointLabel || `接入 ${String(id).slice(0, 6)}`);
    const current = map.get(id);
    if (!current) {
      map.set(id, { id, label, count: 1, unknown, lastSeen: timestamp });
    } else {
      current.count++;
      if (timestamp >= current.lastSeen && label) {
        current.label = label;
        current.lastSeen = timestamp;
      }
    }
  }
  const options = Array.from(map.values()).map(({ id, label, count, unknown }) => ({ id, label, count, unknown }));
  options.sort((a, b) => Number(!!a.unknown) - Number(!!b.unknown) || a.label.localeCompare(b.label, 'zh-CN'));
  return addLabelCollisionSuffix(options);
}

export function getCredentialFilterOptions(history: any[], endpoint = STATS_FILTER_ALL): StatsConnectionOption[] {
  const map = new Map<string, StatsConnectionOption & { lastSeen: number }>();
  for (const entry of history || []) {
    if (endpoint === STATS_FILTER_UNKNOWN) {
      if (entry?.endpointId) continue;
    } else if (endpoint !== STATS_FILTER_ALL && entry?.endpointId !== endpoint) {
      continue;
    }
    const unknown = !entry?.credentialId;
    const id = unknown ? STATS_FILTER_UNKNOWN : entry.credentialId;
    const timestamp = Number(entry?.timestamp) || 0;
    const label = unknown
      ? '未识别密钥'
      : (entry.credentialLabel || `密钥 ${String(id).slice(0, 6)}`);
    const current = map.get(id);
    if (!current) {
      map.set(id, { id, label, count: 1, unknown, lastSeen: timestamp });
    } else {
      current.count++;
      if (timestamp >= current.lastSeen && label) {
        current.label = label;
        current.lastSeen = timestamp;
      }
    }
  }
  const options = Array.from(map.values()).map(({ id, label, count, unknown }) => ({ id, label, count, unknown }));
  options.sort((a, b) => Number(!!a.unknown) - Number(!!b.unknown) || a.label.localeCompare(b.label, 'zh-CN'));
  return addLabelCollisionSuffix(options);
}

export function getFilteredHistory(range?: TimeRange): any[] {
  const s: any = getSelectedSave();
  const hist: any[] = s?.history || [];
  if (!range) return hist;
  return hist.filter((h: any) => {
    const k = localDay(h.timestamp);
    return k >= range.start && k <= range.end;
  });
}

export function computeOverview(balanceWalletId = 'all'): OverviewView {
  const s: any = getSelectedSave();
  if (!s) return { balanceText: '¥0.00 CNY', hasBalance: false, walletBalanceCount: 0, totalCost: 0, totalTokens: 0, hit: 0, miss: 0, output: 0, hitRate: 0, savings: 0, inputCost: 0, outputCost: 0, avgCost: 0, avgTokens: 0, avgDuration: 0, avgRate: 0, rounds: 0, remainingRounds: null, avgInputCost: 0, avgInputTokens: 0, avgOutputCost: 0, avgOutputTokens: 0, avgThinkTime: 0, avgThinkTokens: 0, avgHitRate: 0, latestHitRate: null, maxOutput: 0, maxInput: 0, maxTotal: 0, avgThinkRatio: 0, truncationRate: 0 } as any;
  const totalCost = s.total_cost || 0;
  const totalTokens = s.total_tokens || 0;
  const hit = s.cache_hit_tokens || 0, miss = s.cache_miss_tokens || 0, output = s.output_tokens || 0;
  const hitRate = hit + miss > 0 ? (hit / (hit + miss) * 100) : 0;
  let savings = 0;
  try {
    for (const h of s.history || []) {
      savings += calcSavings(
        { timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 },
        state.settings as any,
        findWalletForHistory(state.wallets, h),
      );
    }
  } catch {}
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
  // 思维链占比 = 全部 thinkTokens / 全部 completion_tokens
  let sumThink = 0, sumOut = 0;
  for (const h of hist) { sumThink += h.thinkTokens || 0; sumOut += h.completion_tokens || 0; }
  const avgThinkRatio = sumOut > 0 ? (sumThink / sumOut * 100) : 0;
  // 截断率 = 非正常 finish_reason（length / content_filter / sensitive 等）的占比
  const truncCnt = hist.filter((h: any) => (isTruncatedFinish(h.finishReason) || h.isTruncated)).length;
  const truncationRate = hist.length ? truncCnt / hist.length * 100 : 0;
  const ignored = new Set(state.walletIgnored || []);
  const activeWallets = (state.wallets || []).filter((wallet) => !ignored.has(wallet.id));
  const selectedWallet = balanceWalletId !== 'all'
    ? activeWallets.find((wallet) => wallet.id === balanceWalletId) || null
    : null;
  const balanceWallets = selectedWallet ? [selectedWallet] : activeWallets;
  let balanceCny: number | null = null;
  let walletBalanceCount = 0;
  for (const wallet of balanceWallets) {
    const value = walletBalanceToCny(wallet, getWalletExchangeRate());
    if (value == null) continue;
    walletBalanceCount++;
    balanceCny = (balanceCny ?? 0) + value;
  }
  if (balanceCny == null && !selectedWallet) {
    const legacy = state.customBalance || state.balance?.balance;
    const value = legacy != null && legacy !== '' ? parseFloat(String(legacy)) : NaN;
    if (Number.isFinite(value)) {
      balanceCny = value;
      walletBalanceCount = 1;
    }
  }
  // 余额预测：按当前余额口径过滤历史，EWMA alpha=0.3。
  let remainingRounds: number | null = null;
  try {
    const balNum = balanceCny == null ? NaN : balanceCny;
    if (!isNaN(balNum) && s.history?.length) {
      const scopedHist = (s.history || []).filter((h: any) => !selectedWallet || h.walletId === selectedWallet.id);
      if (scopedHist.length) {
        const alpha = 0.3;
        let ewma = scopedHist[scopedHist.length - 1].cost || 0;
        for (let i = scopedHist.length - 2; i >= 0; i--) ewma = alpha * (scopedHist[i].cost || 0) + (1 - alpha) * ewma;
        if (ewma > 0) remainingRounds = Math.floor(balNum / ewma);
      }
    }
  } catch {}
  const balanceText = (() => {
    try {
      return formatMoney(balanceCny == null ? 0 : balanceCny, 2);
    } catch { return '¥' + (balanceCny || 0).toFixed(2) + ' CNY'; }
  })();
  return {
    balanceText,
    hasBalance: balanceCny != null,
    walletBalanceCount,
    totalCost, totalTokens, hit, miss, output, hitRate, savings,
    inputCost: s.input_cost || 0, outputCost: s.output_cost || 0,
    avgCost, avgTokens, avgDuration, avgRate, rounds, remainingRounds,
    avgInputCost, avgInputTokens, avgOutputCost, avgOutputTokens, avgThinkTime, avgThinkTokens, avgHitRate, latestHitRate, maxOutput, maxInput, maxTotal,
    avgThinkRatio, truncationRate,
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

export type ChatSummaryRow = {
  chatId: string | null;
  chatName: string | null;
  displayName: string;
  count: number;
  hit: number; miss: number; out: number; total: number; cost: number;
  avgTokens: number;
  avgHitRate: number;
};

export function getRecordedChats(): Array<{ chatId: string | null; chatName: string | null; displayName: string }> {
  const s: any = getSelectedSave();
  const map = new Map<string, { chatId: string | null; chatName: string | null }>();
  for (const h of s?.history || []) {
    const cid = (h.chatId ?? null) as string | null;
    const cname = (h.chatName ?? null) as string | null;
    const key = cid ?? '__null__';
    if (!map.has(key)) map.set(key, { chatId: cid, chatName: cname });
    else if (cname && !map.get(key)!.chatName) map.get(key)!.chatName = cname;
  }
  return Array.from(map.values()).map(v => {
    let display = v.chatName || '';
    if (!display) {
      if (v.chatId) display = v.chatId.length > 18 ? v.chatId.slice(0, 8) + '…' + v.chatId.slice(-4) : v.chatId;
      else display = '未分组/旧数据';
    }
    return { chatId: v.chatId, chatName: v.chatName, displayName: display };
  }).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

export function computeChatStats(hist?: any[]): ChatSummaryRow[] {
  const s: any = getSelectedSave();
  const history: any[] = hist ?? (s?.history || []);
  if (!history.length) return [];
  const map = new Map<string, { chatId: string | null; chatName: string | null; count: number; hit: number; miss: number; out: number; total: number; cost: number }>();
  for (const h of history) {
    const cid = (h.chatId ?? null) as string | null;
    const cname = (h.chatName ?? null) as string | null;
    const key = cid ?? '__null__';
    if (!map.has(key)) map.set(key, { chatId: cid, chatName: cname, count: 0, hit: 0, miss: 0, out: 0, total: 0, cost: 0 });
    const e = map.get(key)!;
    if (cname && !e.chatName) e.chatName = cname;
    e.count++; e.hit += h.cache_hit_tokens || 0; e.miss += h.cache_miss_tokens || 0; e.out += h.completion_tokens || 0; e.total += h.total_tokens || 0; e.cost += h.cost || 0;
  }
  const rows: ChatSummaryRow[] = Array.from(map.values()).map(e => {
    let display = e.chatName || '';
    if (!display) {
      if (e.chatId) display = e.chatId.length > 18 ? e.chatId.slice(0, 8) + '…' + e.chatId.slice(-4) : e.chatId;
      else display = '未分组/旧数据';
    }
    const totIn = e.hit + e.miss;
    const avgHitRate = totIn > 0 ? (e.hit / totIn * 100) : 0;
    return { chatId: e.chatId, chatName: e.chatName, displayName: display, count: e.count, hit: e.hit, miss: e.miss, out: e.out, total: e.total, cost: e.cost, avgTokens: e.count ? e.total / e.count : 0, avgHitRate };
  });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

export function computeStatsFour(filtered: any[]): { avgCost:number; avgTokens:number; avgDuration:number; avgRate:number; avgInputCost:number; avgInputTokens:number; avgOutputCost:number; avgOutputTokens:number; avgThinkTime:number; avgThinkTokens:number; avgHitRate:number; latestHitRate:number|null; maxOutput:number; maxInput:number; maxTotal:number; avgThinkRatio:number; truncationRate:number; rounds:number } {
  if (!filtered || !filtered.length) {
    return { avgCost:0, avgTokens:0, avgDuration:0, avgRate:0, avgInputCost:0, avgInputTokens:0, avgOutputCost:0, avgOutputTokens:0, avgThinkTime:0, avgThinkTokens:0, avgHitRate:0, latestHitRate:null, maxOutput:0, maxInput:0, maxTotal:0, avgThinkRatio:0, truncationRate:0, rounds:0 };
  }
  const rounds = filtered.length;
  let totalCost = 0, totalTokens = 0, totalDur = 0, totalRate = 0, totalInputCost = 0, totalInputTokens = 0, totalOutputCost = 0, totalOutputTokens = 0;
  let thinkTimeSum = 0, thinkTokensSum = 0, thinkTimeCnt = 0, thinkTokensCnt = 0;
  let hitRateSum = 0, hitRateCnt = 0;
  let maxOutput = 0, maxInput = 0, maxTotal = 0;
  let sumThink = 0, sumOut = 0, truncCnt = 0;
  for (const h of filtered) {
    totalCost += h.cost || 0; totalTokens += h.total_tokens || 0; totalDur += h.duration || 0; totalRate += h.tokenRate || 0;
    totalInputCost += h.input_cost || 0; totalInputTokens += (h.cache_hit_tokens||0)+(h.cache_miss_tokens||0); totalOutputCost += h.output_cost||0; totalOutputTokens += h.completion_tokens||0;
    if ((h.thinkTime||0) > 0) { thinkTimeSum += h.thinkTime; thinkTimeCnt++; }
    if ((h.thinkTokens||0) > 0) { thinkTokensSum += h.thinkTokens; thinkTokensCnt++; }
    const ch = h.cache_hit_tokens||0, cm = h.cache_miss_tokens||0, tot = ch+cm;
    if (tot>0) { hitRateSum += ch/tot*100; hitRateCnt++; }
    const out = h.completion_tokens||0, inp = (h.cache_hit_tokens||0)+(h.cache_miss_tokens||0), totTok = h.total_tokens||0;
    if (out>maxOutput) maxOutput=out; if (inp>maxInput) maxInput=inp; if (totTok>maxTotal) maxTotal=totTok;
    sumThink += h.thinkTokens||0; sumOut += h.completion_tokens||0;
    if (isTruncatedFinish(h.finishReason) || h.isTruncated) truncCnt++;
  }
  return {
    avgCost: totalCost/rounds, avgTokens: totalTokens/rounds, avgDuration: totalDur/rounds/1000, avgRate: totalRate/rounds,
    avgInputCost: totalInputCost/rounds, avgInputTokens: totalInputTokens/rounds, avgOutputCost: totalOutputCost/rounds, avgOutputTokens: totalOutputTokens/rounds,
    avgThinkTime: thinkTimeCnt? thinkTimeSum/thinkTimeCnt/1000 : 0, avgThinkTokens: thinkTokensCnt? thinkTokensSum/thinkTokensCnt : 0,
    avgHitRate: hitRateCnt? hitRateSum/hitRateCnt : 0,
    latestHitRate: (()=>{ const latest=[...filtered].sort((a,b)=>b.timestamp-a.timestamp)[0]; const ch=latest.cache_hit_tokens||0, cm=latest.cache_miss_tokens||0, tot=ch+cm; return tot>0? ch/tot*100 : 0; })(),
    maxOutput, maxInput, maxTotal,
    avgThinkRatio: sumOut>0? sumThink/sumOut*100 : 0,
    truncationRate: truncCnt/rounds*100,
    rounds,
  };
}

export type WalletStats = {
  requests: number;
  tokens: number;
  cost: number;
};

export function computeWalletStats(walletId: string): WalletStats {
  let requests = 0;
  let tokens = 0;
  let cost = 0;
  for (const entry of state.history || []) {
    if (entry.walletId !== walletId) continue;
    requests++;
    tokens += entry.total_tokens || 0;
    cost += entry.cost || 0;
  }
  return { requests, tokens, cost };
}
