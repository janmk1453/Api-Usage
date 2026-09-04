/**
 * Q4 RP 能耗效率评分 — 基于 6 指标加权分档 A-G
 */
import { fitSegments } from './forecast';

type Metrics = {
  delta: number; // tok/轮
  out: number; // tok/轮
  efficiency: number; // 0-1 输出/总
  hitRate: number; // 0-1
  truncRate: number; // 0-1
  thinkRatio: number; // 0-1
};

function percentileAbs(value: number, thresholds: number[], reverse: boolean): number {
  // thresholds sorted asc for "越小越好" 的好阈值，返回 0-100 分（越高越省）
  // reverse=true 表示"越大越好"
  const n = thresholds.length;
  for (let i = 0; i < n; i++) {
    if (value <= thresholds[i]) {
      const score = 100 - (i / n) * 100;
      return reverse ? 100 - score : score;
    }
  }
  return reverse ? 100 : 0;
}

const ABS_THRESHOLDS = {
  delta: [800, 1500, 3000, 5000, 8000, 12000], // tok/轮
  out: [600, 900, 1300, 1800, 2400, 3200],
  efficiency: [0.4, 0.3, 0.25, 0.2, 0.15, 0.1], // 越大越好，阈值降序判断需反转
  hitRate: [0.9, 0.8, 0.65, 0.5, 0.35, 0.2], // 越大越好
  truncRate: [0.01, 0.03, 0.06, 0.1, 0.15, 0.25], // 越小越好
  thinkRatio: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], // 越小越好
};

const WEIGHTS = { delta: 0.25, out: 0.2, efficiency: 0.2, hitRate: 0.15, truncRate: 0.1, thinkRatio: 0.1 };

export function computeMetricsForChat(history: any[], chatId: string | null): Metrics {
  const filtered = chatId ? history.filter((h: any) => (h.chatId ?? null) === chatId) : history.slice();
  if (!filtered.length) return { delta: 0, out: 0, efficiency: 0, hitRate: 0.5, truncRate: 0, thinkRatio: 0 };
  const fit = fitSegments(history, chatId);
  const delta = fit?.delta ?? 0;
  const out = fit?.outEwma ?? filtered.reduce((a, b) => a + (b.completion_tokens || 0), 0) / filtered.length;
  const totalTok = filtered.reduce((a, b) => a + (b.total_tokens || 0), 0);
  const sumOut = filtered.reduce((a, b) => a + (b.completion_tokens || 0), 0);
  const efficiency = totalTok ? sumOut / totalTok : 0;
  const hitRates = filtered.map(h => { const ch = h.cache_hit_tokens || 0, cm = h.cache_miss_tokens || 0, tot = ch + cm; return tot ? ch / tot : 0.5; });
  const hitRate = hitRates.length ? hitRates.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, hitRates.length) : 0.5;
  const truncRate = filtered.filter(h => h.finishReason === 'length' || h.isTruncated).length / filtered.length;
  const thinkRatio = (() => {
    const sOut = filtered.reduce((a, b) => a + (b.completion_tokens || 0), 0);
    const sThink = filtered.reduce((a, b) => a + (b.thinkTokens || 0), 0);
    return sOut ? sThink / sOut : 0;
  })();
  return { delta, out, efficiency, hitRate, truncRate, thinkRatio };
}

function scoreFromMetrics(m: Metrics): number {
  const sDelta = percentileAbs(m.delta, ABS_THRESHOLDS.delta, false);
  const sOut = percentileAbs(m.out, ABS_THRESHOLDS.out, false);
  const sEff = 100 - percentileAbs(m.efficiency, [0.1, 0.15, 0.2, 0.25, 0.3, 0.4].reverse(), false); // 越大越好，需反转阈值顺序
  // 简化：efficiency 用阈值逆序
  //  hitRate 越大越好：阈值降序，perc 需反转
  const sHit = 100 - percentileAbs(m.hitRate, [0.2, 0.35, 0.5, 0.65, 0.8, 0.9], false);
  const sTrunc = percentileAbs(m.truncRate, ABS_THRESHOLDS.truncRate, false);
  const sThink = percentileAbs(m.thinkRatio, ABS_THRESHOLDS.thinkRatio, false);
  // 实际上 hit/efficiency 逻辑与其它相反：上面的 percentileAbs 已对"越小越好"适配， 对"越大越好" 需 100- 值
  // 调整：对越大越好的指标，用 100 - rev
  const hitScore = 100 - percentileAbs(m.hitRate, [0.2, 0.35, 0.5, 0.65, 0.8, 0.9], false); // placeholder 双重反转后近似
  // 更直观：直接按阈值线性插值
  function scoreLargerBetter(v: number, thr: number[]): number {
    // thr: [0.2,0.35,0.5,0.65,0.8,0.9] 越大越好，>=0.9 =>100, <0.2=>0
    for (let i = thr.length - 1; i >= 0; i--) if (v >= thr[i]) return ((i + 1) / thr.length) * 100;
    return 0;
  }
  const effScore = scoreLargerBetter(m.efficiency, [0.1, 0.15, 0.2, 0.25, 0.3, 0.4]);
  const hitScore2 = scoreLargerBetter(m.hitRate, [0.2, 0.35, 0.5, 0.65, 0.8, 0.9]);
  return WEIGHTS.delta * sDelta + WEIGHTS.out * sOut + WEIGHTS.efficiency * effScore + WEIGHTS.hitRate * hitScore2 + WEIGHTS.truncRate * sTrunc + WEIGHTS.thinkRatio * sThink;
}

export type EnergyGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export function gradeFromScore(score: number): EnergyGrade {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  if (score >= 45) return 'E';
  if (score >= 35) return 'F';
  return 'G';
}

export function energyScore(history: any[], chatId: string | null): { metrics: Metrics; score: number; grade: EnergyGrade } {
  const metrics = computeMetricsForChat(history, chatId);
  const score = scoreFromMetrics(metrics);
  const grade = gradeFromScore(score);
  return { metrics, score, grade };
}

export function topPowerChats(history: any[], limit = 10): Array<{ chatId: string | null; grade: EnergyGrade; score: number; delta: number }> {
  const ids = Array.from(new Set(history.map((h: any) => (h.chatId ?? null) as string | null)));
  const list = ids.map(id => {
    const r = energyScore(history, id);
    return { chatId: id, grade: r.grade, score: r.score, delta: r.metrics.delta };
  });
  list.sort((a, b) => b.delta - a.delta);
  return list.slice(0, limit);
}
