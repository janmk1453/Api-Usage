/**
 * 请求日志上传体校验与归一（纯函数，无运行时依赖，便于单元测试）
 *
 * 与 payload.js 同一原则：只接受白名单字段，其余一律丢弃；字符串全部按上限截断，
 * 数值全部钳制。任何一项不合法都返回 { ok: false }，调用方直接拒绝、不写库。
 *
 * 这个接口是公开的（任何人都能 POST），所以这里同时是第一道防线：
 * 体积、条数、字段长度都在这里收口，D1 里只会有这一种形状的数据。
 */

export const LOG_SCHEMA = 5;
/**
 * 兼容的上报版本：
 * 1 = 只带单条记录（旧版）；
 * 2 = 记录 + 反馈说明 + 诊断摘要；
 * 3 = 额外带 report.target 与 diagnostics.evidence（点名单条异常）；
 * 4 = report.targets 逐条点名多条异常（当前）。
 */
export const LOG_SCHEMAS = [1, 2, 3, 4, 5];
/** 上报体最大字节数：正文本身允许 200000 字符，留出标头、逐条点名的现场证据与包装的余量 */
export const MAX_LOG_BODY_BYTES = 400000;
export const MAX_RECORD_BODY_CHARS = 200000;
export const MAX_HEADER_PAIRS = 80;
export const MAX_HEADER_NAME = 80;
export const MAX_HEADER_VALUE = 1000;
export const MAX_URL_CHARS = 2000;
export const MAX_ERROR_CHARS = 1000;
export const MAX_USAGE_KEYS = 40;
export const MAX_USAGE_INNER_KEYS = 12;
export const MAX_STATUS_TEXT = 120;
export const MAX_MODEL_CHARS = 120;
export const MAX_FINISH_CHARS = 80;

/** 诊断摘要上限：只留够定位问题的条目数，避免把整份历史搬上服务器 */
export const MAX_DIAG_HISTORY = 10;
export const MAX_DIAG_TAP = 20;
export const MAX_DIAG_CONSOLE = 40;
export const MAX_DIAG_EXTENSIONS = 60;
export const MAX_DIAG_KEYS = 40;
export const MAX_DIAG_CAPTURE = 24;
export const MAX_NOTE_CHARS = 2000;
/** 问题类型白名单，其余一律归 other */
export const PROBLEM_KEYS = ['not-recorded', 'wrong-data', 'other'];
/** 上传口径白名单：单条点名 / 逐条点名全部 / 只带最近一轮 */
export const FEEDBACK_SCOPES = ['single', 'all', 'recent'];
/** 健康信号类型白名单（与扩展 src/services/health-signals.ts 同步），未知一律归 other */
export const HEALTH_KINDS = ['zero-usage', 'estimated-usage', 'missing-usage', 'rate-anomaly', 'meta-missing', 'plugin-error'];
/** 逐条点名的目标上限：超出的只记进 targetTotal，不再逐条展开 */
export const MAX_REPORT_TARGETS = 8;
/** evidence 里每条目标的现场证据上限 */
export const MAX_EVIDENCE_ITEMS = 8;
export const MAX_EVIDENCE_TAP = 6;
export const MAX_EVIDENCE_CONSOLE = 20;
/** 最近三轮对话摘要的条数与单条正文字符上限 */
export const MAX_RECENT_TURNS = 6;
export const MAX_RECENT_TURN_TEXT = 400;

function fail(error) {
  return { ok: false, error };
}

function toStr(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function toInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const floored = Math.floor(num);
  if (floored < min) return min;
  if (floored > max) return max;
  return floored;
}

/** 版本号清洗：只保留数字、字母与 . + -，不含数字则视为无效 */
function toVersion(value, max) {
  const text = toStr(value, max).replace(/[^0-9A-Za-z.+-]/g, '');
  return /\d/.test(text) ? text : '';
}

/** 标头：只接受 [name, value] 二元数组，超长截断，条数封顶 */
function normalizeHeaders(value) {
  const out = [];
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    if (out.length >= MAX_HEADER_PAIRS) break;
    if (!Array.isArray(item) || item.length < 2) continue;
    const name = toStr(item[0], MAX_HEADER_NAME).trim();
    if (!name) continue;
    out.push([name, toStr(item[1], MAX_HEADER_VALUE)]);
  }
  return out;
}

/** usage：只保留数字与一层嵌套的数字（cached_tokens / reasoning_tokens 等） */
function normalizeUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  let count = 0;
  for (const [key, item] of Object.entries(value)) {
    if (count >= MAX_USAGE_KEYS) break;
    const name = String(key).slice(0, 60);
    if (!name) continue;
    if (typeof item === 'number' && Number.isFinite(item)) {
      out[name] = item;
      count += 1;
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const inner = {};
      let innerCount = 0;
      for (const [innerKey, innerValue] of Object.entries(item)) {
        if (innerCount >= MAX_USAGE_INNER_KEYS) break;
        if (typeof innerValue !== 'number' || !Number.isFinite(innerValue)) continue;
        inner[String(innerKey).slice(0, 40)] = innerValue;
        innerCount += 1;
      }
      out[name] = inner;
      count += 1;
    }
  }
  return count ? out : null;
}

function normalizeResponse(value, now) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    status: toInt(value.status, 0, 599, 0),
    statusText: toStr(value.statusText, MAX_STATUS_TEXT),
    headers: normalizeHeaders(value.headers),
    firstByteMs: value.firstByteMs == null ? null : toInt(value.firstByteMs, 0, 86400000, null),
    durationMs: value.durationMs == null ? null : toInt(value.durationMs, 0, 86400000, null),
    streamed: typeof value.streamed === 'boolean' ? value.streamed : null,
    model: toStr(value.model, MAX_MODEL_CHARS),
    finishReason: toStr(value.finishReason, MAX_FINISH_CHARS),
    usage: normalizeUsage(value.usage),
    error: toStr(value.error, MAX_ERROR_CHARS),
  };
}

/** 单条记录的归一：缺失关键字段（method / url / at）直接判为无效 */
function normalizeRecord(value, now) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const method = toStr(value.method, 16).toUpperCase();
  const url = toStr(value.url, MAX_URL_CHARS);
  if (!method || !url) return null;
  // 时间允许 2 天前到 10 分钟后的时钟偏差，超出范围按服务端时间记账
  const at = toInt(value.at, 0, now + 600000, 0);
  return {
    at: at > 0 ? at : now,
    method,
    url,
    requestHeaders: normalizeHeaders(value.requestHeaders),
    requestBody: toStr(value.requestBody, MAX_RECORD_BODY_CHARS),
    requestBodyTruncated: value.requestBodyTruncated === true,
    response: normalizeResponse(value.response, now),
  };
}

function toBoolOrNull(value) {
  return typeof value === 'boolean' ? value : null;
}

function toNumberOr(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/** 泛型列表归一：逐项过映射函数，为 null 的项丢弃，条数封顶 */
function listOf(value, max, map) {
  const out = [];
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    if (out.length >= max) break;
    const row = map(item);
    if (row) out.push(row);
  }
  return out;
}

/** 时间戳归一：非正数或非数字一律 null，超过上限钳到上限 */
function toStamp(value, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(Math.floor(num), max);
}

/**
 * 反馈目标（点名的那一条异常）：只保留白名单字段。
 * 客户端在 schema 3/4 里用它指名道姓「哪一轮、什么信号」，缺了它服务端就只能看到一句笼统说明。
 */
function normalizeTarget(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = toStr(value.kind, 40);
  return {
    signalKey: toStr(value.signalKey, 240),
    kind: HEALTH_KINDS.includes(kind) ? kind : 'other',
    at: toStamp(value.at, now + 600000),
    detail: toStr(value.detail, 300),
    model: toStr(value.model, MAX_MODEL_CHARS),
    reason: toStr(value.reason, 200),
    signature: toStr(value.signature, 80),
    requestId: toStr(value.requestId, 120),
    tapId: toStr(value.tapId, 40),
    historyTimestamp: toStamp(value.historyTimestamp, 4102444800000),
  };
}

/** evidence 里的「本次上传的那一轮请求」引用 */
function normalizeRequestRef(value) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    requestId: toStr(row.requestId, 120),
    logAt: toStamp(row.logAt, 4102444800000),
    // 最近一轮请求日志是否真的就是被点名那一轮（false 时 logAt 为 null，别当成同轮现场）
    matched: row.matched === true,
  };
}

/** evidence 里的历史现场：目标记录 + 前后各一条 */
function normalizeHistoryEvidence(value) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    target: normalizeHistoryRow(row.target),
    before: normalizeHistoryRow(row.before),
    after: normalizeHistoryRow(row.after),
  };
}

/** evidence 里的探针现场：目标探针 + 同簇几条 */
function normalizeTapEvidence(value) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    target: normalizeTapRow(row.target),
    cluster: listOf(row.cluster, MAX_EVIDENCE_TAP, normalizeTapRow),
  };
}

/** 一条目标的完整现场证据 */
function normalizeEvidenceItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    signal: normalizeTarget(value.signal),
    request: normalizeRequestRef(value.request),
    history: normalizeHistoryEvidence(value.history),
    tap: normalizeTapEvidence(value.tap),
    console: listOf(value.console, MAX_EVIDENCE_CONSOLE, normalizeConsoleRow),
    // true 表示窗口内没有条目，带的是「最近几条」，不是与目标同窗的证据
    consoleFallback: value.consoleFallback === true,
  };
}

/** 最近对话摘要（正文由用户勾选决定是否附带） */
function normalizeRecentTurn(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    at: toStamp(value.at, 4102444800000),
    role: toStr(value.role, 20),
    // dialogue=成对的对白轮；prompt-tail=只抓到尾部注入提示词
    kind: value.kind === 'prompt-tail' ? 'prompt-tail' : 'dialogue',
    chars: toInt(value.chars, 0, 1e9, 0),
    text: toStr(value.text, MAX_RECENT_TURN_TEXT),
  };
}

/**
 * 诊断现场（schema 3 起）：逐条点名的目标各自配一份「记录 + 探针 + 控制台」，
 * 顶层保留第一条，便于旧解析器按单条读。
 */
export function normalizeEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const items = listOf(value.items, MAX_EVIDENCE_ITEMS, normalizeEvidenceItem);
  const targetTotal = toInt(value.targetTotal, 0, 1e6, items.length);
  const scope = FEEDBACK_SCOPES.includes(value.scope)
    ? value.scope
    : targetTotal > 1 ? 'all' : targetTotal === 1 ? 'single' : 'recent';
  return {
    scope,
    targetTotal,
    sampleLimit: toInt(value.sampleLimit, 0, 1e6, MAX_REPORT_TARGETS),
    signal: normalizeTarget(value.signal),
    request: normalizeRequestRef(value.request),
    history: normalizeHistoryEvidence(value.history),
    tap: normalizeTapEvidence(value.tap),
    console: listOf(value.console, MAX_EVIDENCE_CONSOLE, normalizeConsoleRow),
    consoleFallback: value.consoleFallback === true,
    items,
    recentTurns: listOf(value.recentTurns, MAX_RECENT_TURNS, normalizeRecentTurn),
  };
}

function normalizeReport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const problem = typeof value.problem === 'string' && PROBLEM_KEYS.includes(value.problem) ? value.problem : 'other';
  const target = normalizeTarget(value.target);
  const targets = listOf(value.targets, MAX_REPORT_TARGETS, normalizeTarget);
  const targetTotal = toInt(value.targetTotal, 0, 1e6, targets.length);
  const scope = FEEDBACK_SCOPES.includes(value.scope)
    ? value.scope
    : targetTotal > 1 ? 'all' : targetTotal === 1 ? 'single' : 'recent';
  return { problem, note: toStr(value.note, MAX_NOTE_CHARS), scope, target, targets, targetTotal };
}

/**
 * 历史记录摘要：除金额与 token 外，还要带上「记录状态」——
 * usageSource/interrupted/estimateMethod 是判断「估算还是真用量」的关键，
 * 少了它们，服务端看到的一条记录跟正常记录长得一模一样。
 */
function normalizeHistoryRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    timestamp: toInt(value.timestamp, 0, 4102444800000, 0),
    model: toStr(value.model, MAX_MODEL_CHARS),
    rawModel: toStr(value.rawModel, MAX_MODEL_CHARS),
    prompt_tokens: toInt(value.prompt_tokens, 0, 1e9, 0),
    completion_tokens: toInt(value.completion_tokens, 0, 1e9, 0),
    total_tokens: toInt(value.total_tokens, 0, 1e9, 0),
    cache_hit_tokens: toInt(value.cache_hit_tokens, 0, 1e9, 0),
    cache_miss_tokens: toInt(value.cache_miss_tokens, 0, 1e9, 0),
    cost: toNumberOr(value.cost, 0),
    sourceType: toStr(value.sourceType, 40),
    endpointLabel: toStr(value.endpointLabel, MAX_MODEL_CHARS),
    credentialLabel: toStr(value.credentialLabel, MAX_MODEL_CHARS),
    chatId: toStr(value.chatId, 200),
    duration: toInt(value.duration, 0, 86400000, 0),
    tokenRate: toNumberOr(value.tokenRate, 0),
    ttft: toInt(value.ttft, 0, 3600000, 0),
    thinkTime: toInt(value.thinkTime, 0, 3600000, 0),
    thinkTokens: toInt(value.thinkTokens, 0, 1e9, 0),
    streamed: toBoolOrNull(value.streamed),
    finishReason: toStr(value.finishReason, MAX_FINISH_CHARS),
    isTruncated: value.isTruncated === true,
    pricingSource: toStr(value.pricingSource, 40),
    // 空字符串没有意义，缺省一律 null，避免摘要里出现一堆 ""
    usageSource: toStr(value.usageSource, 20) || null,
    interrupted: toStr(value.interrupted, 20) || null,
    interruptReason: toStr(value.interruptReason, 200) || null,
    modelFallback: value.modelFallback === true,
    estimateMethod: toStr(value.estimateMethod, 60) || null,
    // 速率是实测还是估算（prefill / duration）：缺了它，估算值看起来和真实测量一模一样
    rateEstimated: value.rateEstimated === 'prefill' || value.rateEstimated === 'duration'
      ? value.rateEstimated
      : null,
    estimateVersion: toInt(value.estimateVersion, 0, 1e6, 0),
    promptChars: toInt(value.promptChars, 0, 1e9, 0),
    outputChars: toInt(value.outputChars, 0, 1e9, 0),
    estimateCacheUnknown: value.estimateCacheUnknown === true,
    costEstimated: value.costEstimated === true,
    raw_usage: normalizeUsage(value.raw_usage),
  };
}

function normalizeTapRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const usage = value.usage && typeof value.usage === 'object' && !Array.isArray(value.usage) ? value.usage : null;
  return {
    id: toStr(value.id, 60),
    at: toInt(value.at, 0, 4102444800000, 0),
    endedAt: toInt(value.endedAt, 0, 4102444800000, 0),
    purposeKey: toStr(value.purposeKey, 80),
    promptChars: toInt(value.promptChars, 0, 1e9, 0),
    usageMissing: value.usageMissing === true,
    endpoint: toStr(value.endpoint, 200),
    model: toStr(value.model, MAX_MODEL_CHARS),
    requestType: toStr(value.requestType, 40),
    actorKind: toStr(value.actorKind, 20),
    actorLabel: toStr(value.actorLabel, MAX_MODEL_CHARS),
    state: toStr(value.state, 20),
    settledBy: toStr(value.settledBy, 40) || null,
    status: toInt(value.status, 0, 599, 0),
    error: toStr(value.error, MAX_ERROR_CHARS),
    durationMs: toInt(value.durationMs, 0, 86400000, 0),
    messageCount: toInt(value.messageCount, 0, 100000, 0),
    usage: usage
      ? {
          prompt: toInt(usage.prompt, 0, 1e9, 0),
          completion: toInt(usage.completion, 0, 1e9, 0),
          total: toInt(usage.total, 0, 1e9, 0),
          hit: toInt(usage.hit, 0, 1e9, 0),
          miss: toInt(usage.miss, 0, 1e9, 0),
        }
      : null,
  };
}

function normalizeConsoleRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const level = value.level === 'warn' || value.level === 'uncaught' ? value.level : 'error';
  const row = { level, text: toStr(value.text, 600) };
  // evidence 里的控制台按目标时刻取窗口，带 at 才能对齐时间轴；摘要列表不带就保持原样
  const at = toStamp(value.at, 4102444800000);
  if (at) row.at = at;
  return row;
}

function normalizeExtensionRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    name: toStr(value.name, 80),
    version: toVersion(value.version, 40),
    type: toStr(value.type, 40),
    enabled: value.enabled === true,
  };
}

function normalizeStringList(value, max, itemMax) {
  const out = [];
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    if (out.length >= max) break;
    const text = toStr(item, itemMax).trim();
    if (text) out.push(text);
  }
  return out;
}


/** 采集链路快照：阶段白名单 + 数字型用量字段 */
const CAPTURE_STAGES = [
  'fetch-start',
  'fetch-parse',
  'event-drop',
  'entry-added',
  'entry-error',
  'turn-interrupted',
  'turn-estimated',
  // 采集失聪的两种现场：生成结束事件对不上请求轮次、包装安装失败。
  // 客户端 capture-digest 会记，这里不同步就会被整行丢弃，反馈包里只剩「一切正常」。
  'turn-unmatched',
  'install-failed',
];
const CAPTURE_USAGE_KEYS = [
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'cached_tokens',
  'prompt_cache_hit_tokens',
  'prompt_cache_miss_tokens',
];

function normalizeCaptureUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  let any = false;
  for (const key of CAPTURE_USAGE_KEYS) {
    const num = value[key];
    if (typeof num === 'number' && Number.isFinite(num)) {
      out[key] = Math.max(0, Math.floor(num));
      any = true;
    }
  }
  return any ? out : null;
}

function normalizeCaptureRow(value) {
  if (!value || typeof value !== 'object') return null;
  const stage = toStr(value.stage, 40);
  if (!CAPTURE_STAGES.includes(stage)) return null;
  const row = { at: toInt(value.at, 0, 1e15, 0), stage };
  const model = toStr(value.model, MAX_MODEL_CHARS);
  if (model) row.model = model;
  const requestId = toStr(value.requestId, 120);
  if (requestId) row.requestId = requestId;
  const url = toStr(value.url, 300);
  if (url) row.url = url;
  const streamed = toBoolOrNull(value.streamed);
  if (streamed !== null) row.streamed = streamed;
  if (typeof value.usageFound === 'boolean') row.usageFound = value.usageFound;
  if (typeof value.usageZero === 'boolean') row.usageZero = value.usageZero;
  const usage = normalizeCaptureUsage(value.usage);
  if (usage) row.usage = usage;
  const finishReason = toStr(value.finishReason, MAX_FINISH_CHARS);
  if (finishReason) row.finishReason = finishReason;
  const reason = toStr(value.reason, 300);
  if (reason) row.reason = reason;
  return row;
}

/** 诊断摘要归一：只保留定位问题需要的字段，全部按上限截断 */
export function normalizeDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const settings = value.settings && typeof value.settings === 'object' ? value.settings : {};
  const env = value.env && typeof value.env === 'object' ? value.env : {};
  const conversation = value.conversation && typeof value.conversation === 'object' ? value.conversation : {};
  const summary = value.tapSummary && typeof value.tapSummary === 'object' ? value.tapSummary : {};
  return {
    history: listOf(value.history, MAX_DIAG_HISTORY, normalizeHistoryRow),
    capture: listOf(value.capture, MAX_DIAG_CAPTURE, normalizeCaptureRow),
    tap: listOf(value.tap, MAX_DIAG_TAP, normalizeTapRow),
    tapSummary: {
      total: toInt(summary.total, 0, 1e9, 0),
      orphan: toInt(summary.orphan, 0, 1e9, 0),
      settled: toInt(summary.settled, 0, 1e9, 0),
      pending: toInt(summary.pending, 0, 1e9, 0),
    },
    console: listOf(value.console, MAX_DIAG_CONSOLE, normalizeConsoleRow),
    settings: {
      appVersion: toVersion(settings.appVersion, 40),
      // 版本号相同、构建号不同的包行为可能不同：没有构建号就无法判断设备跑的是哪一版
      buildNo: toVersion(settings.buildNo, 20),
      buildTag: toStr(settings.buildTag, 40),
      mobileCompatUi: toBoolOrNull(settings.mobileCompatUi),
      theme: toStr(settings.theme, 20),
      historyScope: toStr(settings.historyScope, 20),
      historyCount: toInt(settings.historyCount, 0, 1e9, 0),
      walletCount: toInt(settings.walletCount, 0, 1000, 0),
    },
    env: {
      userAgent: toStr(env.userAgent, 300),
      platform: toStr(env.platform, 120),
      language: toStr(env.language, 40),
      timeZone: toStr(env.timeZone, 60),
      mobile: toBoolOrNull(env.mobile),
      screenWidth: toInt(env.screenWidth, 0, 100000, 0),
      screenHeight: toInt(env.screenHeight, 0, 100000, 0),
      viewportWidth: toInt(env.viewportWidth, 0, 100000, 0),
      viewportHeight: toInt(env.viewportHeight, 0, 100000, 0),
      devicePixelRatio: toNumberOr(env.devicePixelRatio, 0),
    },
    conversation: {
      chatId: toStr(conversation.chatId, 200),
      character: toStr(conversation.character, MAX_MODEL_CHARS),
      characterId: toStr(conversation.characterId, 40),
      isGroup: toBoolOrNull(conversation.isGroup),
      stVersion: toStr(conversation.stVersion, 60),
      extensionKeys: normalizeStringList(conversation.extensionKeys, MAX_DIAG_KEYS, 80),
    },
    extensions: listOf(value.extensions, MAX_DIAG_EXTENSIONS, normalizeExtensionRow),
    // schema 3 起：逐条点名的目标各自配一份现场证据（含最近三轮对话摘要）
    evidence: normalizeEvidence(value.evidence),
  };
}

/**
 * 整体校验。成功返回 { ok: true, value }，value 就是入库的形状：
 * { schema, appVersion, uploadedAt, client: { userAgent, timeZone, language }, record, report, diagnostics }。
 * schema 1 只带单条记录（旧版）；schema 2 起带反馈说明与诊断摘要，record 允许为空；
 * schema 3/4 再带点名目标与现场证据，历史页「上传这一条 / 上传反馈日志」靠它定位到具体轮次。
 */
export function normalizeLogUpload(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('bad_body');
  if (raw.kind !== 'aus_request_log') return fail('bad_kind');
  const schema = Number(raw.schema);
  if (!LOG_SCHEMAS.includes(schema)) return fail('bad_schema');
  const record = normalizeRecord(raw.record, now);
  if (!record && schema === 1) return fail('bad_record');
  const client = raw.client && typeof raw.client === 'object' ? raw.client : {};
  return {
    ok: true,
    value: {
      schema,
      appVersion: toVersion(raw.appVersion, 40),
      uploadedAt: toInt(raw.uploadedAt, 0, now + 600000, now) || now,
      client: {
        userAgent: toStr(client.userAgent, 300),
        timeZone: toStr(client.timeZone, 60),
        language: toStr(client.language, 20),
      },
      record,
      report: schema >= 2 ? normalizeReport(raw.report) : null,
      diagnostics: schema >= 2 ? normalizeDiagnostics(raw.diagnostics) : null,
    },
  };
}
