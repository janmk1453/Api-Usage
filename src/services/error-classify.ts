/**
 * 控制台错误的严重度分类（纯逻辑，单一来源）
 *
 * 历史记录页的提示条不该被「不影响核心功能的报错」刷屏：
 * 网络抖动、汇率更新失败、检查更新失败、余额校准失败、WebDAV 同步失败、
 * 其他扩展自己的报错，这些都不该算「本扩展功能报错」。
 *
 * 反过来，真正的功能异常（入库失败、读库失败、采集链路异常、本扩展抛出的
 * uncaught）必须提示，而且同类错误要能合并成同一个签名，避免点一次「忽略」
 * 就把整个控制台类别永久静音。
 */

export type ErrorSeverity = 'major' | 'minor';

export interface ClassifiedError {
  severity: ErrorSeverity;
  /** 归一化后的错误签名（8 位十六进制），用作「忽略同类」的归因 */
  signature: string;
  /** 判定依据，写进信号 detail 便于排查 */
  label: string;
}

/** 明显不代表本扩展功能损坏的来源：网络、汇率、更新、余额、价格同步、同步、上报 */
const MINOR_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EPIPE|socket hang up|fetch failed|network ?error|Failed to fetch|Load failed/i, label: '网络请求' },
  { re: /AbortError|aborted|The operation was aborted/i, label: '请求被中止' },
  { re: /\b(429|502|503|504)\b|too many requests|rate limit/i, label: '上游限流或网关错误' },
  { re: /exchange|汇率|open\.er-api|frankfurter|er-api/i, label: '汇率更新' },
  { re: /github|jsdelivr|ghproxy|gh-proxy|gitmirror|update-policy|check-?update|检查更新|一键更新/i, label: '检查或更新' },
  { re: /balance|余额|user\/balance/i, label: '余额校准' },
  { re: /models\.dev|pricing-?sync|价格同步/i, label: '价格同步' },
  { re: /webdav|nextcloud|owncloud/i, label: '云同步' },
  { re: /telemetry|\/collect|上报/i, label: '统计上报' },
];

/** 指向本扩展自身的证据：模块名、全局名、存储名 */
const MAJOR_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ApiUsageStat|api-usage-stat|api_usage_stat|aus[-_]|\/api-usage\//i, label: '本扩展代码' },
  { re: /addEntry|repository|interception|capture-digest|console-ring|health-signals|persist\b|saveHot|cold_history|IndexedDB|deleteDatabase|rebuildAggregates/i, label: '本扩展核心链路' },
];

/**
 * 网络层失败特征：请求根本没到达或没拿到响应，跟是谁发起的无关。
 * 本扩展包了 window.fetch，别的扩展（脚本运行器、宿主、第三方）的请求失败时，
 * 栈里同样会出现 interception-*.js，因此这类文本不能单独当作本扩展的证据。
 */
const NETWORK_TRANSPORT_RE = /Failed to fetch|Load failed|network ?error|net::ERR_|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EPIPE|socket hang up|fetch failed/i;

/** 本扩展自身痕迹：URL 段、全局名、存储名，以及透传层文件名 */
const OWN_EVIDENCE_RE = /api-usage|api_usage_stat|ApiUsageStat|interception/i;

/**
 * 本扩展业务帧证据：出现这些说明是本扩展自己的逻辑在跑，不做透传降级。
 * 刻意不含 interception——它是透传层，任何穿过来的外部请求错误都会带上它。
 */
const BUSINESS_FRAME_RE = /addEntry|repository|saveHot|persist\b|capture-digest|health-signals|rebuildAggregates|deleteDatabase|IndexedDB/i;

/** 折叠空白与数字，让同类错误归到同一签名 */
export function normalizeErrorText(text: unknown): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d+\b/g, '#')
    .replace(/0x[0-9a-f]+/gi, '0x#')
    .trim()
    .slice(0, 300);
}

/** 极简 32 位 FNV-1a 哈希，输出 8 位十六进制 */
export function errorSignature(text: unknown): string {
  const raw = normalizeErrorText(text);
  if (!raw) return '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return ('00000000' + hash.toString(16)).slice(-8);
}

/** 取错误文案：Error、对象或字符串都能吃 */
export function errorTextOf(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (input instanceof Error) return (input.name || 'Error') + ': ' + input.message;
  if (typeof input === 'object') {
    const anyInput = input as any;
    if (typeof anyInput.message === 'string' && anyInput.message) return String(anyInput.message);
    if (typeof anyInput.text === 'string' && anyInput.text) return String(anyInput.text);
    try { return JSON.stringify(input).slice(0, 300); } catch { return ''; }
  }
  return String(input);
}

/**
 * 分类一条控制台错误。
 * 默认判为 minor：宁可漏提示，也不拿无关报错去打扰用户。
 * 只有出现指向本扩展的证据时才升为 major。
 */
export function classifyErrorText(input: unknown): ClassifiedError {
  const text = errorTextOf(input);
  if (!text) return { severity: 'minor', signature: '', label: '空错误' };
  // 先认「网络层透传」，再谈本扩展证据。
  // 反过来的话（先跑 MAJOR_PATTERNS），外部请求失败会在栈里带出
  // third-party/Api-Usage/interception-*.js，被 /\/api-usage\//i 与 interception 命中，
  // detail 变成「功能报错（本扩展代码）」，历史上真机误报过一次（plugin-error|8bd68160）。
  // 门槛两条：文本里确实有本扩展痕迹（否则 MINOR_PATTERNS 的「网络请求」本来就给 minor），
  // 且没有任何本扩展业务帧——才认定是透传进来的外部失败。
  if (OWN_EVIDENCE_RE.test(text) && NETWORK_TRANSPORT_RE.test(text) && !BUSINESS_FRAME_RE.test(text)) {
    return { severity: 'minor', signature: errorSignature(text), label: '网络请求（透传）' };
  }
  for (const rule of MAJOR_PATTERNS) {
    if (rule.re.test(text)) {
      return { severity: 'major', signature: errorSignature(text), label: rule.label };
    }
  }
  for (const rule of MINOR_PATTERNS) {
    if (rule.re.test(text)) {
      return { severity: 'minor', signature: errorSignature(text), label: rule.label };
    }
  }
  return { severity: 'minor', signature: errorSignature(text), label: '未归因' };
}

/**
 * uncaught 错误的额外判断：栈或文件名指向本扩展目录时一律 major。
 * （纯前端拿不到可靠栈时只在文本里找证据。）
 */
export function classifyUncaught(text: unknown, filename?: string | null): ClassifiedError {
  const base = classifyErrorText(text);
  const file = String(filename || '');
  if (/api-usage|api_usage_stat|ApiUsageStat/i.test(file) || /api-usage/i.test(errorTextOf(text))) {
    return { severity: 'major', signature: errorSignature(text), label: '本扩展抛出' };
  }
  return base;
}
