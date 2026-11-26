/**
 * 运行健康信号：历史记录页顶部提示条的数据来源（纯逻辑，无 DOM）
 *
 * 只在「用户能明显感觉到不对」的情况下给出信号：
 * - zero-usage      记下来的用量全 0（费用必然错）
 * - estimated-usage 上游没给用量，已按本地估算补记（黄色轻提示，不是故障；同一模型同一估算方法
 *                   累计到 ESTIMATED_CLUSTER_MIN 轮才聚成一条，偶发漏回一次不打扰）
 * - missing-usage   常规对话的用量没取到、这一轮没进历史（同类连续出现或探针聚簇才提示；
 *                   上游错误被宿主包装成 200 而拒绝入库的轮次也归在这里，但原因写成 api-error）
 * - rate-anomaly    速率离谱（极高 / 极低），多半是耗时或流式判定出错
 * - meta-missing    模型名或耗时缺失，只能用兜底值
 * - plugin-error    本扩展自身功能报错（网络/汇率/更新等无关报错不算）
 *
 * 这里只做判断与汇总，怎么展示、要不要上传由 UI 决定。
 */
import { listCaptureStages } from './capture-digest';
import { listConsoleEntries } from './console-ring';
import { classifyErrorText, errorSignature } from './error-classify';
import { interruptKindOf, isEstimatedEntry, isReliablePerformanceSample } from '../data/sample-quality';
import { measureTokenRate } from '../data/token-rate';
import { MIN_TAP_DURATION_MS, type TapRecord } from './request-tap/types';
import { stripModelTag } from './request-tap/match';
import type { FeedbackTarget } from './feedback-pack';

export type HealthSignalKind =
  | 'zero-usage'
  | 'estimated-usage'
  | 'missing-usage'
  | 'rate-anomaly'
  | 'meta-missing'
  | 'plugin-error';

/** info 只做轻提示（黄色），warn 才是真的出了问题 */
export type HealthSeverity = 'info' | 'warn';

export interface HealthSignal {
  kind: HealthSignalKind;
  at: number;
  /** 一行可读的说明（展示用，最长 120 字） */
  detail: string;
  /** 归属模型（用于「忽略同类问题」时区分对象，没有就留空） */
  model?: string;
  /** 细分原因：zero / estimated / missing / rate-high / rate-low / model-missing / duration-missing / entry-error / console */
  reason?: string;
  /** 同类归因（插件报错用归一化错误签名），「忽略」按它落盘 */
  signature?: string;
  severity?: HealthSeverity;
  /** 这条信号是否允许「忽略」：没有可靠归因的不允许（否则一点就静音一大片） */
  canIgnore?: boolean;
  /** 命中的历史记录时间戳（上传反馈时用来指名道姓定位那一条） */
  historyTimestamp?: number;
  /** 命中记录的请求 ID（有则优先用它定位，比时间戳精确） */
  requestId?: string;
  /** 命中的探针 ID（「这类请求没被记账」时指向最新那一条作样本） */
  tapId?: string;
  /**
   * 这条信号代表多少轮：估算补记是多轮聚成一条，其余信号恒为 1（缺省按 1 计）。
   * 只影响汇总条数（「本地估算补记 N 次」），不影响明细条数与忽略指纹。
   */
  count?: number;
}

/**
 * 信号的「问题指纹」：类型 + 归因 + 细分。
 * 用户点「忽略」时按它落盘 —— 同一个模型同一类问题不再反复弹，
 * 换了模型、换了问题类型（或速率方向）仍会重新提示。
 * 插件报错带上错误签名，因此忽略一条控制台报错不会静音其它报错。
 */
export function healthSignalKey(sig: HealthSignal): string {
  const attribution = sig.model || sig.signature || '-';
  const detail = sig.signature || sig.reason || '';
  return sig.kind + '|' + attribution + '|' + detail;
}

/** 这条信号能不能被「忽略」：插件报错必须有错误签名才允许 */
export function canIgnoreSignal(sig: HealthSignal): boolean {
  if (sig.canIgnore === false) return false;
  if (sig.kind === 'plugin-error') return !!sig.signature;
  return true;
}

/**
 * 从信号里取出「上传反馈时的指向」：把定位字段一并带上，
 * 让每条提示都能被指名道姓地指认（历史记录时间戳 / 请求 ID / 探针 ID）。
 */
export function healthTargetOf(sig: HealthSignal): FeedbackTarget {
  return {
    signalKey: healthSignalKey(sig),
    kind: sig.kind,
    at: sig.at || null,
    detail: sig.detail || '',
    model: sig.model || '',
    reason: sig.reason || '',
    signature: sig.signature || null,
    requestId: sig.requestId || null,
    tapId: sig.tapId || null,
    historyTimestamp: sig.historyTimestamp || null,
  };
}

export interface HealthReport {
  total: number;
  counts: Record<HealthSignalKind, number>;
  items: HealthSignal[];
  shouldShow: boolean;
  /** 只有轻提示（估算补记）时为 true，UI 用黄色而不是红色呈现 */
  infoOnly: boolean;
}

/** 扫描最近多少条历史 */
export const HEALTH_HISTORY_SCAN = 30;
/** 展示/保留的信号条数上限 */
export const HEALTH_ITEM_LIMIT = 40;
/** 速率上限（token/s）：超过它基本不可能是真实生成速度 */
export const RATE_ANOMALY_HIGH = 5000;
/** 速率下限（token/s）：低于它且输出不算太小时视为异常 */
export const RATE_ANOMALY_LOW = 0.5;
/** 判「速率偏低」所需的最小输出量（token）：几个 token 的回复谈不上快慢 */
export const RATE_LOW_MIN_OUTPUT = 20;
/** 同类型信号在这个时间窗内视为同一次，避免重复计数 */
export const HEALTH_DEDUPE_MS = 90000;
/** 缺失用量聚簇窗口：同类丢弃在这个窗口内反复出现才算「多次未计入」 */
export const MISSING_CLUSTER_MS = 30 * 60 * 1000;
/** 缺失用量聚簇阈值：至少这么多轮才算「多次」 */
export const MISSING_CLUSTER_MIN = 2;
/**
 * 采集安装失败的告警门槛：失败不会让「某一轮」丢记录，而是让整段采集静默，
 * 所以不看时间窗口聚合，只按次数——偶发一次（宿主恰好重绑）不打扰，反复失败必须提示。
 */
export const INSTALL_FAIL_MIN = 3;
/** 元信息缺失只检查最近这段时间的记录，避免旧数据一直报警 */
export const META_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/**
 * 估算补记的提示门槛：上游偶尔漏回一次用量很常见（中途断网、代理丢字段、流式被截断），
 * 单轮就弹提示等于把正常波动当故障；同一模型、同一估算方法累计这么多轮才提示一次。
 */
export const ESTIMATED_CLUSTER_MIN = 5;

const KIND_TEXT: Record<HealthSignalKind, string> = {
  'zero-usage': '用量为 0',
  'estimated-usage': '本地估算补记',
  'missing-usage': '没有取到用量',
  'rate-anomaly': '速率异常',
  'meta-missing': '信息缺失',
  'plugin-error': '功能报错',
};

/** 展示优先级：真的问题在前，轻提示在后 */
export const HEALTH_KIND_ORDER: HealthSignalKind[] = [
  'missing-usage',
  'plugin-error',
  'zero-usage',
  'rate-anomaly',
  'meta-missing',
  'estimated-usage',
];

export function healthKindText(kind: HealthSignalKind): string {
  return KIND_TEXT[kind] || '异常';
}

function clipText(text: string, max = 120): string {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** 扫历史：估算补记、用量全 0、速率离谱、元信息缺失 */
export function scanHistoryHealth(history: any[], limit = HEALTH_HISTORY_SCAN, now = Date.now()): HealthSignal[] {
  const out: HealthSignal[] = [];
  if (!Array.isArray(history)) return out;
  // 估算补记先按「模型 + 估算方法」攒起来，扫完再决定要不要提示：
  // 断网、代理丢字段、流式被截断都会让上游漏回一次用量，这是正常波动而不是故障，
  // 单轮就弹提示等于每断一次网报一次警；攒够 ESTIMATED_CLUSTER_MIN 轮才聚成一条。
  const estimates = new Map<string, { at: number; model: string; method: string; historyTimestamp?: number; requestId?: string }[]>();
  const recent = history
    .slice()
    .sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0))
    .slice(0, Math.max(1, limit));
  for (const entry of recent) {
    // 用户主动点「停止」的那一轮：上游必然没给完整 usage、耗时也只到一个半截，
    // 估算补记是既定行为而不是故障，所以整条记录都不再报任何异常提示。
    if (interruptKindOf(entry) === 'user') continue;
    const at = Number(entry?.timestamp) || 0;
    const model = String(entry?.model || '未知模型');
    const prompt = Number(entry?.prompt_tokens) || 0;
    const completion = Number(entry?.completion_tokens) || 0;
    const total = Number(entry?.total_tokens) || 0;
    // 定位信息：上传反馈时用它对上「就是这一条」，不能只留模型名
    const loc = {
      historyTimestamp: at || undefined,
      requestId: String(entry?.requestId || '') || undefined,
    };
    // 估算补记：先只登记，扫完按「模型 + 估算方法」看累计轮数（轻提示，不改数据的可信度口径）
    if (isEstimatedEntry(entry)) {
      const method = String((entry as any)?.estimateMethod || '');
      const key = model + '|' + method;
      const list = estimates.get(key) || [];
      list.push({ at, model, method, ...loc });
      estimates.set(key, list);
      continue;
    }
    if ((entry as any)?.modelFallback) {
      out.push({
        kind: 'meta-missing',
        at,
        model,
        reason: 'model-missing',
        severity: 'warn',
        ...loc,
        detail: clipText(model + ' 这一轮没取到模型名，已用兜底值记录'),
      });
    }
    if (now - at < META_LOOKBACK_MS && total > 0 && !(Number(entry?.duration) > 0) && entry?.streamed !== false) {
      out.push({
        kind: 'meta-missing',
        at,
        model,
        reason: 'duration-missing',
        severity: 'warn',
        ...loc,
        detail: clipText(model + ' 这一轮没取到总耗时'),
      });
    }
    if (prompt === 0 && completion === 0 && total === 0) {
      out.push({ kind: 'zero-usage', at, model, reason: 'zero', severity: 'warn', ...loc, detail: clipText(model + ' 这一轮用量全为 0') });
      continue;
    }
    // 中断与估算记录不进速率口径，避免把「停止时的半截输出」当异常
    if (!isReliablePerformanceSample(entry)) continue;
    // 速率只认输出侧口径（输出 Token / 生成窗口），与入库的 tokenRate 同源：
    // 拿 total_tokens 除以总耗时会把「大 prompt + 极短回复」算成上万 t/s 的假告警
    const rate = measureTokenRate(entry);
    if (rate == null) continue;
    if (rate > RATE_ANOMALY_HIGH) {
      out.push({ kind: 'rate-anomaly', at, model, reason: 'rate-high', severity: 'warn', ...loc, detail: clipText(model + ' 速率 ' + Math.round(rate) + ' token/s，明显偏高') });
    } else if (rate < RATE_ANOMALY_LOW && completion >= RATE_LOW_MIN_OUTPUT) {
      out.push({ kind: 'rate-anomaly', at, model, reason: 'rate-low', severity: 'warn', ...loc, detail: clipText(model + ' 速率 ' + rate.toFixed(2) + ' token/s，明显偏低') });
    }
  }
  // 估算补记聚簇：同一模型、同一估算方法累计到门槛才提示一条，
  // 明细指向最近那一轮（「上传这一条」拿到的就是最新样本），轮数记在 count 里供汇总用。
  for (const list of estimates.values()) {
    if (list.length < ESTIMATED_CLUSTER_MIN) continue;
    const latest = list.reduce((a, b) => (b.at > a.at ? b : a));
    out.push({
      kind: 'estimated-usage',
      at: latest.at,
      model: latest.model,
      reason: 'estimated',
      signature: latest.method || undefined,
      severity: 'info',
      count: list.length,
      historyTimestamp: latest.historyTimestamp,
      requestId: latest.requestId,
      detail: clipText(
        latest.model + ' 有 ' + list.length + ' 轮上游未返回用量，已按本地估算补记'
        + (latest.method ? '（' + latest.method + '）' : ''),
      ),
    });
  }
  return out;
}

/** 事件层丢弃的 reason 前缀（去重后用于聚簇判断） */
function dropReasonOf(rec: any): string {
  return String(rec?.reason || 'missing').split(':')[0] || 'missing';
}

/**
 * 滑动窗口聚簇：同一条原因在 MISSING_CLUSTER_MS 内出现 MISSING_CLUSTER_MIN 次才算「多次」。
 * 偶发一次不打扰用户，返回第一个达标窗口的末条记录。
 */
function firstCluster(list: any[]): { latest: any } | null {
  const sorted = list.slice().sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
  let clusterStart = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    while (i - clusterStart + 1 > MISSING_CLUSTER_MIN && (Number(sorted[i].at) || 0) - (Number(sorted[clusterStart].at) || 0) > MISSING_CLUSTER_MS) {
      clusterStart += 1;
    }
    if (i - clusterStart + 1 === MISSING_CLUSTER_MIN) return { latest: sorted[i] };
  }
  return null;
}

/** entry-rejected 的 reason 形如 api-error-payload:<锚点>:<字符数>:status=<状态码> */
function rejectedPartsOf(rec: any): { marker: string; status: string } {
  const reason = String(rec?.reason || '');
  return {
    marker: reason.split(':')[1] || 'unknown',
    status: (reason.match(/status=(\d+)/) || [])[1] || '',
  };
}

/**
 * 扫采集链路快照：
 * - 事件层丢弃：同类（模型 + 原因）在窗口内出现至少 MISSING_CLUSTER_MIN 次才算「多次未计入」，
 *   偶发单次不打扰用户；
 * - 上游错误被宿主包装成 200：历史刻意不留记录（那一轮没有模型内容），但同类连续出现
 *   要按「上游返回错误」提示，避免用户误以为是扩展把数据弄丢了；
 * - 入库失败：功能报错，带错误签名用于「忽略同类」。
 * （fetch-parse 的全 0、turn-estimated / turn-interrupted 都会在历史里体现，这里不重复报。）
 */
export function scanCaptureHealth(stages = listCaptureStages()): HealthSignal[] {
  const out: HealthSignal[] = [];
  // 同一轮请求后来又正常入库（fetch 解析完成 / 估算补记）时，先写下的 event-drop 只是
  // 「GENERATION_ENDED 抢在 fetch 的 clone 流结束之前触发」造成的假信号：那一刻还没有输出文本，
  // 事件层判了「无用量无输出」，但真正落库走的是 fetch 侧解析。按 requestId 交叉校验排除，
  // 也顺带自愈 localStorage 里已经存在的旧脏快照，不需要用户手动清理。
  const settledRequests = new Set<string>();
  for (const rec of stages) {
    if (!rec) continue;
    if (rec.stage !== 'entry-added' && rec.stage !== 'turn-estimated' && rec.stage !== 'turn-interrupted') continue;
    const id = String(rec.requestId || '');
    if (id) settledRequests.add(id);
  }
  const drops = new Map<string, any[]>();
  // 上游错误被包装成 200 而拒绝入库的轮次：历史里刻意不留记录（正确，那一轮确实没有模型内容），
  // 但用户需要知道「这是上游报错」而不是扩展丢数据，所以单独聚簇提示。
  const rejects = new Map<string, any[]>();
  for (const rec of stages) {
    if (!rec) continue;
    if (rec.stage === 'entry-rejected') {
      // 同一请求后来又正常入库（宿主重试成功）就不该再提示上游报错
      const reqId = String(rec.requestId || '');
      if (reqId && settledRequests.has(reqId)) continue;
      const { marker, status } = rejectedPartsOf(rec);
      const key = (rec.model || '') + '|' + status + '|' + marker;
      const list = rejects.get(key) || [];
      list.push(rec);
      rejects.set(key, list);
    } else if (rec.stage === 'event-drop') {
      // 用户主动停止造成的空轮次不是故障（与历史记录层「用户中断不产生健康提示」同一口径），
      // 这类丢弃连估算都无从下手，本来就不该写历史，更不该弹告警
      if (dropReasonOf(rec) === 'user-stop-no-output') continue;
      const reqId = String(rec.requestId || '');
      if (reqId && settledRequests.has(reqId)) continue;
      const key = (rec.model || '') + '|' + dropReasonOf(rec);
      const list = drops.get(key) || [];
      list.push(rec);
      drops.set(key, list);
    } else if (rec.stage === 'entry-error') {
      const reason = String(rec.reason || '未知错误');
      out.push({
        kind: 'plugin-error',
        at: rec.at,
        model: rec.model || '',
        reason: 'entry-error',
        signature: errorSignature(reason),
        severity: 'warn',
        detail: clipText('写入历史失败：' + reason),
      });
    }
  }
  // 采集包装安装失败：症状是「整段没有记录」，历史里看不出来，只能靠这里报出来
  const installFails = stages.filter((rec) => rec && rec.stage === 'install-failed');
  if (installFails.length >= INSTALL_FAIL_MIN) {
    const reasons = [...new Set(installFails.map((rec) => String(rec.reason || 'unknown').split(':')[0]))].sort();
    const lastAt = installFails.reduce((max, rec) => Math.max(max, Number(rec.at) || 0), 0);
    out.push({
      kind: 'plugin-error',
      at: lastAt,
      model: '',
      reason: 'install-failed',
      signature: errorSignature(reasons.join(',')),
      severity: 'warn',
      detail: clipText(
        '采集包装安装失败 ' + installFails.length + ' 次（' + reasons.join(' / ') + '），可能出现整段对话没有写入历史',
      ),
    });
  }
  for (const [key, list] of drops) {
    const hit = firstCluster(list);
    if (!hit) continue;
    const [model, reason] = key.split('|');
    out.push({
      kind: 'missing-usage',
      at: Number(hit.latest.at) || 0,
      model,
      reason: 'missing',
      signature: reason,
      severity: 'warn',
      detail: clipText((model || '未知模型') + ' 连续 ' + MISSING_CLUSTER_MIN + ' 轮没有取到用量，这些对话未写入历史'),
    });
  }
  for (const [key, list] of rejects) {
    const hit = firstCluster(list);
    if (!hit) continue;
    const [model, status, marker] = key.split('|');
    out.push({
      kind: 'missing-usage',
      at: Number(hit.latest.at) || 0,
      model,
      reason: 'api-error',
      signature: status ? 'http-' + status : marker,
      severity: 'warn',
      detail: clipText(
        (model || '未知模型') + ' 连续 ' + MISSING_CLUSTER_MIN + ' 轮上游返回错误'
        + (status ? '（HTTP ' + status + '）' : '')
        + '，这些轮次没有模型内容、未计入历史',
      ),
    });
  }
  return out;
}

/** 扫控制台环形缓冲：只收「本扩展功能真的报错」的条目 */
export function scanConsoleHealth(entries = listConsoleEntries()): HealthSignal[] {
  const out: HealthSignal[] = [];
  for (const item of entries) {
    if (!item) continue;
    if (item.level !== 'error' && item.level !== 'uncaught') continue;
    const classified = classifyErrorText(item.text);
    if (classified.severity !== 'major') continue;
    out.push({
      kind: 'plugin-error',
      at: item.at || 0,
      reason: 'console',
      signature: classified.signature || undefined,
      severity: 'warn',
      detail: clipText('功能报错（' + classified.label + '）：' + (item.text || '')),
    });
  }
  return out;
}

/**
 * 探针聚簇的展示后缀：用途 + 发起方 + 上下文规模。
 * 同一 purposeLabel（例如「结构化输出」）可能来自不同发起方、不同上下文规模，
 * 只写用途会让并列的多条提示长得一模一样，用户无法分辨指的是哪一类请求。
 */
function tapClusterLabel(tap: any): string {
  const parts: string[] = [String(tap?.purposeLabel || '') || '未归类'];
  const actor = String(tap?.actorLabel || '');
  if (actor) parts.push(actor);
  if (String(tap?.requestType || '') === 'quiet') parts.push('静默请求');
  const msgs = Number(tap?.messageCount) || 0;
  if (msgs > 0) parts.push(msgs + ' 条消息');
  return parts.join(' · ');
}

/**
 * 扫请求探针：orphan（发出去但一直没被历史收尾）且「看起来就是一次正常对话」的记录，
 * 同一归因在窗口内出现多次 → 说明这类对话一直没被记录，值得提示。
 */
export function scanTapHealth(taps: TapRecord[] = []): HealthSignal[] {
  const out: HealthSignal[] = [];
  if (!Array.isArray(taps)) return out;
  const groups = new Map<string, TapRecord[]>();
  for (const tap of taps) {
    if (!tap || tap.state !== 'orphan') continue;
    if (String((tap as any).endpoint || '') !== 'chat') continue;
    // 过短请求（几百毫秒就结束）不可能是正常对话，不参与聚簇
    if (String((tap as any).settledBy || '') === 'too-short') continue;
    // 旧版本遗留、已按新规则重判但仍无法复核的记录：留在验证页，不再制造提示
    if (String((tap as any).settledBy || '') === 'legacy') continue;
    const durationMs = Number((tap as any).durationMs) || 0;
    if (durationMs > 0 && durationMs < MIN_TAP_DURATION_MS) continue;
    const messageCount = Number((tap as any).messageCount) || 0;
    const promptChars = Number((tap as any).promptChars) || 0;
    if (messageCount < 3 || promptChars < 400) continue;
    const status = Number((tap as any).status) || 0;
    if (status && (status < 200 || status >= 300)) continue;
    const usage = (tap as any).usage;
    if (!usage || typeof usage !== 'object') continue;
    const key = String((tap as any).purposeKey || '') + '|' + String((tap as any).actorLabel || '');
    const list = groups.get(key) || [];
    list.push(tap);
    groups.set(key, list);
  }
  for (const [key, list] of groups) {
    const sorted = list.slice().sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    let clusterStart = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      while (i - clusterStart + 1 > MISSING_CLUSTER_MIN && (Number(sorted[i].at) || 0) - (Number(sorted[clusterStart].at) || 0) > MISSING_CLUSTER_MS) {
        clusterStart += 1;
      }
      if (i - clusterStart + 1 === MISSING_CLUSTER_MIN) {
        const count = i - clusterStart + 1;
        const latest = sorted[i];
        out.push({
          kind: 'missing-usage',
          at: Number(latest.at) || 0,
          model: stripModelTag(String((latest as any).model || '')),
          reason: 'missing',
          signature: 'tap:' + key,
          severity: 'warn',
          tapId: String((latest as any).id || '') || undefined,
          detail: clipText('有 ' + count + ' 次疑似正常对话的请求没有被记进历史（' + tapClusterLabel(latest) + '）'),
        });
        break;
      }
    }
  }
  return out;
}

/** 合并 + 按类型/归因/时间去重 + 汇总 */
export function buildHealthReport(input: {
  history?: any[];
  stages?: ReturnType<typeof listCaptureStages>;
  consoleEntries?: ReturnType<typeof listConsoleEntries>;
  taps?: TapRecord[];
  limit?: number;
  /** 已被用户「忽略」的问题指纹（healthSignalKey 的返回值），命中即不再提示 */
  ignored?: string[];
  now?: number;
} = {}): HealthReport {
  const limit = Math.max(1, input.limit || HEALTH_ITEM_LIMIT);
  const now = typeof input.now === 'number' ? input.now : Date.now();
  let items: HealthSignal[] = [];
  try {
    const stages = input.stages || listCaptureStages();
    items = items
      .concat(scanHistoryHealth(input.history || [], HEALTH_HISTORY_SCAN, now))
      .concat(scanCaptureHealth(stages))
      .concat(scanTapHealth(input.taps || []))
      .concat(scanConsoleHealth(input.consoleEntries || listConsoleEntries()));
  } catch {
    items = [];
  }
  // 同类 + 同归因 + 时间接近 → 同一次，保留最早的一条
  const sorted = items.slice().sort((a, b) => a.at - b.at);
  const kept: HealthSignal[] = [];
  for (const sig of sorted) {
    const key = healthSignalKey(sig);
    const dup = kept.find((k) => healthSignalKey(k) === key && Math.abs(k.at - sig.at) < HEALTH_DEDUPE_MS);
    if (!dup) kept.push(sig);
  }
  const ignoredSet = new Set(input.ignored || []);
  const visible = ignoredSet.size ? kept.filter((sig) => !ignoredSet.has(healthSignalKey(sig))) : kept;
  // 真的问题在前，轻提示排在后面，同类按时间倒序
  visible.sort((a, b) => {
    const orderA = HEALTH_KIND_ORDER.indexOf(a.kind);
    const orderB = HEALTH_KIND_ORDER.indexOf(b.kind);
    if (orderA !== orderB) return orderA - orderB;
    return b.at - a.at;
  });
  const counts: Record<HealthSignalKind, number> = {
    'zero-usage': 0,
    'estimated-usage': 0,
    'missing-usage': 0,
    'rate-anomaly': 0,
    'meta-missing': 0,
    'plugin-error': 0,
  };
  for (const sig of visible) {
    // 估算补记是多轮聚成一条：汇总里报「本地估算补记 5 次」才对得上用户看到的轮数，
    // 明细条数仍按信号条数（total / items）算。
    if (counts[sig.kind] != null) counts[sig.kind] += Math.max(1, Number(sig.count) || 1);
  }
  const shown = visible.slice(0, limit);
  const warnCount = visible.filter((sig) => sig.severity !== 'info').length;
  return {
    total: visible.length,
    counts,
    items: shown,
    shouldShow: visible.length > 0,
    infoOnly: visible.length > 0 && warnCount === 0,
  };
}

/** 一句话摘要（标题行用） */
export function healthSummaryText(report: HealthReport): string {
  const parts: string[] = [];
  for (const kind of HEALTH_KIND_ORDER) {
    const n = report.counts[kind] || 0;
    if (n > 0) parts.push(healthKindText(kind) + ' ' + n + ' 次');
  }
  return parts.join(' · ');
}
