/**
 * 运行健康信号：历史记录页顶部提示条的数据来源（纯逻辑，无 DOM）
 *
 * 只在「用户能明显感觉到不对」的几种情况下给出信号：
 * - zero-usage  常规对话记下来了，但用量全 0（费用必然错）
 * - missing-usage  常规对话的用量没取到，这一轮没进历史
 * - rate-anomaly  速率离谱（极高 / 极低），多半是耗时或流式判定出错
 * - plugin-error   扩展自身报错 / 入库失败 / 控制台异常
 *
 * 这里只做判断与汇总，怎么展示、要不要上传由 UI 决定。
 */
import { listCaptureStages } from './capture-digest';
import { listConsoleEntries } from './console-ring';

export type HealthSignalKind = 'zero-usage' | 'missing-usage' | 'rate-anomaly' | 'plugin-error';

export interface HealthSignal {
  kind: HealthSignalKind;
  at: number;
  /** 一行可读的说明（展示用，最长 120 字） */
  detail: string;
  /** 归属模型（用于「忽略同类问题」时区分对象，没有就留空） */
  model?: string;
  /** 细分原因：zero / missing / rate-high / rate-low / entry-error / console */
  reason?: string;
}

/**
 * 信号的「问题指纹」：类型 + 模型 + 细分原因。
 * 用户点「忽略」时按它落盘 —— 同一个模型同一类问题不再反复弹，
 * 换了模型、换了问题类型（或速率方向）仍会重新提示。
 */
export function healthSignalKey(sig: HealthSignal): string {
  return sig.kind + '|' + (sig.model || '') + '|' + (sig.reason || '');
}

export interface HealthReport {
  total: number;
  counts: Record<HealthSignalKind, number>;
  items: HealthSignal[];
  shouldShow: boolean;
}

/** 扫描最近多少条历史 */
export const HEALTH_HISTORY_SCAN = 30;
/** 展示/保留的信号条数上限 */
export const HEALTH_ITEM_LIMIT = 40;
/** 速率上限（token/s）：超过它基本不可能是真实生成速度 */
export const RATE_ANOMALY_HIGH = 5000;
/** 速率下限（token/s）：低于它且用量不算太小时视为异常 */
export const RATE_ANOMALY_LOW = 0.5;
/** 同类型信号在这个时间窗内视为同一次，避免重复计数 */
export const HEALTH_DEDUPE_MS = 90000;

const KIND_TEXT: Record<HealthSignalKind, string> = {
  'zero-usage': '用量为 0',
  'missing-usage': '没有取到用量',
  'rate-anomaly': '速率异常',
  'plugin-error': '功能报错',
};

export function healthKindText(kind: HealthSignalKind): string {
  return KIND_TEXT[kind] || '异常';
}

function rateOf(entry: any): number | null {
  try {
    const total = Number(entry?.total_tokens) || 0;
    const ms = Number(entry?.duration) || 0;
    if (!total || !ms) return null;
    // 非流式（含上游一次性返回）的耗时不含生成过程，速率不可信，直接跳过
    if (entry?.streamed === false) return null;
    return total / (ms / 1000);
  } catch {
    return null;
  }
}

function clipText(text: string, max = 120): string {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** 扫历史：用量全 0、速率离谱 */
export function scanHistoryHealth(history: any[], limit = HEALTH_HISTORY_SCAN): HealthSignal[] {
  const out: HealthSignal[] = [];
  if (!Array.isArray(history)) return out;
  const recent = history
    .slice()
    .sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0))
    .slice(0, Math.max(1, limit));
  for (const entry of recent) {
    const at = Number(entry?.timestamp) || 0;
    const model = String(entry?.model || '未知模型');
    const prompt = Number(entry?.prompt_tokens) || 0;
    const completion = Number(entry?.completion_tokens) || 0;
    const total = Number(entry?.total_tokens) || 0;
    if (prompt === 0 && completion === 0 && total === 0) {
      out.push({ kind: 'zero-usage', at, model, reason: 'zero', detail: clipText(model + ' 这一轮用量全为 0') });
      continue;
    }
    const rate = rateOf(entry);
    if (rate == null) continue;
    if (rate > RATE_ANOMALY_HIGH) {
      out.push({ kind: 'rate-anomaly', at, model, reason: 'rate-high', detail: clipText(model + ' 速率 ' + Math.round(rate) + ' token/s，明显偏高') });
    } else if (rate < RATE_ANOMALY_LOW && total >= 20) {
      out.push({ kind: 'rate-anomaly', at, model, reason: 'rate-low', detail: clipText(model + ' 速率 ' + rate.toFixed(2) + ' token/s，明显偏低') });
    }
  }
  return out;
}

/** 扫采集链路快照：事件层丢弃（没进历史）、入库失败 */
export function scanCaptureHealth(stages = listCaptureStages()): HealthSignal[] {
  const out: HealthSignal[] = [];
  for (const rec of stages) {
    if (!rec) continue;
    if (rec.stage === 'event-drop') {
      out.push({
        kind: 'missing-usage',
        at: rec.at,
        model: rec.model || '',
        reason: 'missing',
        detail: clipText((rec.model || '未知模型') + ' 的这一轮没有取到用量，未写入历史'),
      });
    } else if (rec.stage === 'entry-error') {
      out.push({
        kind: 'plugin-error',
        at: rec.at,
        model: rec.model || '',
        reason: 'entry-error',
        detail: clipText('写入历史失败：' + (rec.reason || '未知错误')),
      });
    } else if (rec.stage === 'fetch-parse' && rec.usageZero) {
      out.push({
        kind: 'zero-usage',
        at: rec.at,
        model: rec.model || '',
        reason: 'zero',
        detail: clipText((rec.model || '未知模型') + ' 上游返回的用量全为 0'),
      });
    }
  }
  return out;
}

/** 扫控制台环形缓冲：error / uncaught 视为功能报错 */
export function scanConsoleHealth(entries = listConsoleEntries()): HealthSignal[] {
  const out: HealthSignal[] = [];
  for (const item of entries) {
    if (!item) continue;
    if (item.level === 'error' || item.level === 'uncaught') {
      out.push({ kind: 'plugin-error', at: item.at || 0, reason: 'console', detail: clipText(item.text || '控制台错误') });
    }
  }
  return out;
}

/** 合并 + 按类型与时间去重 + 汇总 */
export function buildHealthReport(input: {
  history?: any[];
  stages?: ReturnType<typeof listCaptureStages>;
  consoleEntries?: ReturnType<typeof listConsoleEntries>;
  limit?: number;
  /** 已被用户「忽略」的问题指纹（healthSignalKey 的返回值），命中即不再提示 */
  ignored?: string[];
} = {}): HealthReport {
  const limit = Math.max(1, input.limit || HEALTH_ITEM_LIMIT);
  let items: HealthSignal[] = [];
  try {
    const stages = input.stages || listCaptureStages();
    items = items
      .concat(scanHistoryHealth(input.history || []))
      .concat(scanCaptureHealth(stages))
      .concat(scanConsoleHealth(input.consoleEntries || listConsoleEntries()));
  } catch {
    items = [];
  }
  // 同类型 + 时间接近 → 同一次，保留最早的一条
  const sorted = items.slice().sort((a, b) => a.at - b.at);
  const kept: HealthSignal[] = [];
  for (const sig of sorted) {
    const dup = kept.find((k) => k.kind === sig.kind && Math.abs(k.at - sig.at) < HEALTH_DEDUPE_MS);
    if (!dup) kept.push(sig);
  }
  const ignoredSet = new Set(input.ignored || []);
  const visible = ignoredSet.size ? kept.filter((sig) => !ignoredSet.has(healthSignalKey(sig))) : kept;
  visible.sort((a, b) => b.at - a.at);
  const counts: Record<HealthSignalKind, number> = {
    'zero-usage': 0,
    'missing-usage': 0,
    'rate-anomaly': 0,
    'plugin-error': 0,
  };
  for (const sig of visible) {
    if (counts[sig.kind] != null) counts[sig.kind] += 1;
  }
  const shown = visible.slice(0, limit);
  return {
    total: visible.length,
    counts,
    items: shown,
    shouldShow: visible.length > 0,
  };
}

/** 一句话摘要（标题行用） */
export function healthSummaryText(report: HealthReport): string {
  const parts: string[] = [];
  const order: HealthSignalKind[] = ['zero-usage', 'missing-usage', 'rate-anomaly', 'plugin-error'];
  for (const kind of order) {
    const n = report.counts[kind] || 0;
    if (n > 0) parts.push(healthKindText(kind) + ' ' + n + ' 次');
  }
  return parts.join(' · ');
}
