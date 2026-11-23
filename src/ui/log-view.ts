/**
 * 问题反馈 / 请求日志页（设置 → 问题反馈 / 请求日志）
 *
 * 展示最近一轮对话请求的标头、正文与响应元数据，并提供「上传反馈」入口；
 * 同时是历史记录页问题提示的开关所在（总开关 + 恢复已忽略的问题），
 * 也是「其他请求」探针验证页的入口（原在历史记录页工具栏）。
 *
 * 只读展示：数据由 services/request-log.ts 在 fetch 捕获层旁路写入，
 * 与本页无关——本页只负责渲染，绝不参与统计口径。
 */
import { icon } from './icons';
import { switchHTML } from './switch';
import { APP_VERSION } from '../constants/version';
import { openLogUploadDialog } from './log-upload-dialog';
import {
  clearIgnoredHealthKeys,
  ignoredHealthCount,
  isHealthBarEnabled,
  setHealthBarEnabled,
} from '../services/health-prefs';
import {
  clearRequestLog,
  readRequestLog,
  summarizeRequestLog,
  LOG_VALUE_LIMIT,
  type HeaderPair,
  type RequestLogRecord,
} from '../services/request-log';

function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** 毫秒展示：抹掉浮点尾巴（performance.now 差值会带一长串小数） */
function msText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Math.round(value) + 'ms';
}

/** 2026-11-15 12:39:44 */
export function logTimeText(at: number): string {
  if (!at || !isFinite(at)) return '—';
  const d = new Date(at);
  return (
    d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
    pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())
  );
}

function isOkStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/** 字符串值截断（只影响展示） */
export function clipValue(text: string, limit: number = LOG_VALUE_LIMIT): string {
  const raw = String(text ?? '');
  if (raw.length <= limit) return raw;
  return raw.slice(0, limit) + '…（共 ' + raw.length + ' 字符）';
}

function keyHTML(key: string | null, index: number | null): string {
  if (index != null) return '<span class="aus-log-index">' + index + '</span>';
  if (key == null) return '';
  return '<span class="aus-log-key">' + esc(key) + '</span><span class="aus-log-colon">:</span>';
}

/**
 * 把任意 JSON 值渲染成可折叠的树（纯函数，便于单测）。
 * depth 从 1 开始：顶层展开，第二层起折叠。
 */
export function jsonTreeHTML(value: unknown, key: string | null = null, index: number | null = null, depth = 1): string {
  const prefix = keyHTML(key, index);
  if (value === null || value === undefined) {
    return '<div class="aus-log-leaf">' + prefix + '<span class="aus-log-null">null</span></div>';
  }
  const type = typeof value;
  if (type === 'string') {
    return '<div class="aus-log-leaf">' + prefix + '<span class="aus-log-str">' + esc(clipValue(value as string)) + '</span></div>';
  }
  if (type === 'number') {
    return '<div class="aus-log-leaf">' + prefix + '<span class="aus-log-num">' + esc(value) + '</span></div>';
  }
  if (type === 'boolean') {
    return '<div class="aus-log-leaf">' + prefix + '<span class="aus-log-bool">' + String(value) + '</span></div>';
  }
  if (Array.isArray(value)) {
    if (!value.length) return '<div class="aus-log-leaf">' + prefix + '<span class="aus-log-brace">[]</span></div>';
    const inner = value
      .map((item, i) => jsonTreeHTML(item, null, i, depth + 1))
      .join('');
    const open = depth <= 1 ? ' open' : '';
    return (
      '<details class="aus-log-node"' + open + '><summary>' + prefix +
      '<span class="aus-log-brace">[]</span><span class="aus-log-count">' + value.length + ' 项</span>' +
      '</summary><div class="aus-log-children">' + inner + '</div></details>'
    );
  }
  if (type === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return '<div class="aus-log-leaf">' + prefix + '<span class="aus-log-brace">{}</span></div>';
    const inner = entries.map(([k, v]) => jsonTreeHTML(v, k, null, depth + 1)).join('');
    const open = depth <= 1 ? ' open' : '';
    return (
      '<details class="aus-log-node"' + open + '><summary>' + prefix +
      '<span class="aus-log-brace">{}</span><span class="aus-log-count">' + entries.length + ' 项</span>' +
      '</summary><div class="aus-log-children">' + inner + '</div></details>'
    );
  }
  return '<div class="aus-log-leaf">' + prefix + '<span class="aus-log-str">' + esc(clipValue(String(value))) + '</span></div>';
}

function kvRows(pairs: HeaderPair[]): string {
  if (!pairs.length) return '<div class="aus-log-empty-line">没有记录到标头</div>';
  return pairs
    .map(([k, v]) => '<div class="aus-log-kv-row"><span class="aus-log-kv-k">' + esc(k) + '</span><span class="aus-log-kv-v">' + esc(v) + '</span></div>')
    .join('');
}

function usageRows(usage: Record<string, unknown> | null): string {
  if (!usage) return '<div class="aus-log-empty-line">上游没有返回 usage</div>';
  const rows: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') return;
    rows.push('<div class="aus-log-kv-row"><span class="aus-log-kv-k">' + esc(label) + '</span><span class="aus-log-kv-v">' + esc(value) + '</span></div>');
  };
  push('prompt_tokens', usage.prompt_tokens);
  push('completion_tokens', usage.completion_tokens);
  push('total_tokens', usage.total_tokens);
  const promptDetails = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  push('cached_tokens', promptDetails?.cached_tokens);
  const completionDetails = usage.completion_tokens_details as Record<string, unknown> | undefined;
  push('reasoning_tokens', completionDetails?.reasoning_tokens);
  const known = new Set(['prompt_tokens', 'completion_tokens', 'total_tokens', 'prompt_tokens_details', 'completion_tokens_details']);
  for (const [k, v] of Object.entries(usage)) {
    if (known.has(k)) continue;
    if (k.startsWith('__')) continue;
    push(k, v);
  }
  return rows.length ? rows.join('') : '<div class="aus-log-empty-line">上游没有返回 usage</div>';
}

function section(title: string, meta: string, body: string, extraClass = ''): string {
  return (
    '<section class="aus-log-section ' + extraClass + '">' +
    '<div class="aus-log-section-head"><span class="aus-log-section-title">' + esc(title) + '</span>' +
    (meta ? '<span class="aus-log-section-meta">' + esc(meta) + '</span>' : '') +
    '</div>' + body + '</section>'
  );
}

function bodyBlock(record: RequestLogRecord): string {
  const raw = record.requestBody || '';
  let parsed: unknown = null;
  let isJson = false;
  try {
    parsed = JSON.parse(raw);
    isJson = true;
  } catch {}
  const tools =
    '<div class="aus-log-section-tools">' +
    '<button type="button" class="aus-log-link" data-log-action="expand-all">全部展开</button>' +
    '<button type="button" class="aus-log-link" data-log-action="collapse-all">全部折叠</button>' +
    '<button type="button" class="aus-log-link" data-log-action="copy">复制</button>' +
    '</div>';
  const meta = isJson ? 'JSON' : '原文';
  const tree = isJson
    ? '<div class="aus-log-tree">' + jsonTreeHTML(parsed) + '</div>'
    : '<pre class="aus-log-pre">' + esc(clipValue(raw, 20000)) + '</pre>';
  const notice = record.requestBodyTruncated
    ? '<div class="aus-log-empty-line">正文过长，已截断保存</div>'
    : '';
  return section('请求正文', meta, tools + notice + tree, 'aus-log-section-body');
}

export function logBodyHTML(record: RequestLogRecord | null): string {
  if (!record) {
    return (
      '<div class="aus-log-section aus-log-empty">' +
      '<div class="aus-log-empty-title">还没有记录到请求</div>' +
      '<div class="aus-log-empty-desc">在酒馆里发一条消息后回到这里，就能看到那一轮对话向模型服务发出的请求标头、正文与响应元数据。<br />只保留最近一轮，不参与任何统计。</div>' +
      '</div>'
    );
  }
  const r = record.response;
  const statusClass = r.status ? (isOkStatus(r.status) ? 'is-ok' : 'is-bad') : 'is-pending';
  const statusText = r.status ? String(r.status) + (r.statusText ? ' ' + r.statusText : '') : '等待响应';
  const head =
    '<section class="aus-log-summary">' +
    '<div class="aus-log-summary-top">' +
    '<span class="aus-log-method">' + esc(record.method) + '</span>' +
    '<span class="aus-log-status ' + statusClass + '">' + esc(statusText) + '</span>' +
    '<span class="aus-log-summary-time">' + esc(logTimeText(record.at)) + '</span>' +
    '</div>' +
    '<div class="aus-log-url">' + esc(record.url) + '</div>' +
    '<div class="aus-log-metrics">' +
    '<span>首字节 ' + msText(r.firstByteMs) + '</span>' +
    '<span>总耗时 ' + msText(r.durationMs) + '</span>' +
    '<span>流式 ' + (r.streamed === true ? '是' : r.streamed === false ? '否' : '未知') + '</span>' +
    (r.model ? '<span>模型 ' + esc(r.model) + '</span>' : '') +
    '</div>' +
    (r.error ? '<div class="aus-log-error">' + esc(r.error) + '</div>' : '') +
    '</section>';
  return (
    head +
    section('请求标头', record.requestHeaders.length ? record.requestHeaders.length + ' 项' : '', '<div class="aus-log-kv">' + kvRows(record.requestHeaders) + '</div>') +
    bodyBlock(record) +
    section('响应状态', '', '<div class="aus-log-kv">' +
      '<div class="aus-log-kv-row"><span class="aus-log-kv-k">status</span><span class="aus-log-kv-v">' + esc(r.status ? String(r.status) : '—') + '</span></div>' +
      '<div class="aus-log-kv-row"><span class="aus-log-kv-k">finish_reason</span><span class="aus-log-kv-v">' + esc(r.finishReason || '—') + '</span></div>' +
      '<div class="aus-log-kv-row"><span class="aus-log-kv-k">model</span><span class="aus-log-kv-v">' + esc(r.model || '—') + '</span></div>' +
      '</div>') +
    section('用量（usage）', '', '<div class="aus-log-kv">' + usageRows(r.usage) + '</div>') +
    section('响应标头', r.headers.length ? r.headers.length + ' 项' : '', '<div class="aus-log-kv">' + kvRows(r.headers) + '</div>')
  );
}

/** 历史记录页问题提示的偏好区：总开关 + 已忽略数量/恢复入口 */
function healthPrefsHTML(): string {
  let enabled = true;
  let ignored = 0;
  try {
    enabled = isHealthBarEnabled();
    ignored = ignoredHealthCount();
  } catch {}
  const foot =
    ignored > 0
      ? '<div class="aus-log-pref-foot">已忽略 ' + ignored +
        ' 类问题，同类不再提示<button type="button" class="aus-log-link" data-log-action="clear-ignored">全部恢复</button></div>'
      : '';
  return (
    '<div class="aus-log-prefs">' +
    '<div class="aus-log-pref-main">' +
    '<div class="aus-log-pref-text">' +
    '<span class="aus-log-pref-title">历史记录页的问题提示</span>' +
    '<span class="aus-log-pref-hint">用量为 0、没取到用量、速率异常或扩展报错时，在历史记录页顶部给出提示，可一键上传反馈；关掉后不再显示。</span>' +
    '</div>' +
    switchHTML('aus-log-health-switch', { checked: enabled, ariaLabel: '历史记录页问题提示' }) +
    '</div>' +
    foot +
    '</div>'
  );
}

let goBack: (() => void) | null = null;
let goTap: (() => void) | null = null;

/**
 * 顶部工具条（纯函数，便于单测）：返回 / 说明 / 上传反馈 / 其他请求 / 刷新 / 清空。
 * 「其他请求」是探针账本的技术验证页，原先挂在历史记录页工具栏，现在并到这一页 ——
 * 两者都是「出了问题当场看的现场证据」，放一起比散在两个页面里好找。
 */
export function logTopHTML(summary: string): string {
  return (
    '<div class="aus-log-top">' +
    '<button type="button" class="aus-log-link aus-log-back" data-log-action="back" aria-label="返回上一页">' + icon('chevron-left', 14) + '返回</button>' +
    '<div class="aus-log-desc">只保留最近一轮对话请求，默认只在当前浏览器本地保存。密钥已打码。<span class="aus-log-desc-state" id="aus-log-state">' + esc(summary) + '</span></div>' +
    '<div class="aus-log-actions">' +
    '<button type="button" class="aus-log-link is-upload" data-log-action="upload">' + icon('menu', 14) + '上传反馈</button>' +
    '<button type="button" class="aus-log-link" data-log-action="tap" title="查看探针采到的非常规对话请求（技术验证，数据隔离、不进统计）">' + icon('chevron-right', 14) + '其他请求</button>' +
    '<button type="button" class="aus-log-link" data-log-action="refresh">' + icon('refresh', 14) + '刷新</button>' +
    '<button type="button" class="aus-log-link" data-log-action="clear">' + icon('close', 14) + '清空</button>' +
    '</div>' +
    '</div>'
  );
}

export function renderLogView(): void {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('aus-log-body');
  if (!host) return;
  const record = readRequestLog();
  const summary = summarizeRequestLog(record);
  host.innerHTML = logTopHTML(summary) +
    '<div class="aus-log-advice">遇到对话没被记录、token 或费用明显不对时，建议在问题刚复现、还没进行下一轮对话时就点「上传反馈」——日志只保留最近一轮请求，继续聊下去会把出问题的那一轮覆盖掉。</div>' +
    healthPrefsHTML() +
    '<div id="aus-log-content">' + logBodyHTML(record) + '</div>';
  bind(host);
}

let clearArmed = false;
let clearTimer: number | null = null;

function resetClear(): void {
  clearArmed = false;
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}

function bind(host: HTMLElement): void {
  if ((host as any).__ausLogBound) return;
  (host as any).__ausLogBound = true;
  host.addEventListener('click', (event: any) => {
    const btn = (event.target as HTMLElement | null)?.closest?.('[data-log-action]') as HTMLElement | null;
    if (!btn) return;
    const action = btn.getAttribute('data-log-action');
    if (action === 'clear-ignored') {
      clearIgnoredHealthKeys();
      renderLogView();
      return;
    }
    if (action === 'back') {
      resetClear();
      if (goBack) goBack();
      return;
    }
    if (action === 'tap') {
      resetClear();
      if (goTap) goTap();
      return;
    }
    if (action === 'upload') {
      resetClear();
      openLogUploadDialog({ appVersion: APP_VERSION });
      return;
    }
    if (action === 'refresh') {
      resetClear();
      renderLogView();
      return;
    }
    if (action === 'clear') {
      if (!clearArmed) {
        clearArmed = true;
        btn.textContent = '确认清空';
        clearTimer = window.setTimeout(() => {
          resetClear();
          renderLogView();
        }, 4000);
        return;
      }
      resetClear();
      clearRequestLog();
      renderLogView();
      return;
    }
    if (action === 'expand-all' || action === 'collapse-all') {
      const open = action === 'expand-all';
      host.querySelectorAll('#aus-log-content details').forEach((el: any) => { el.open = open; });
      return;
    }
    if (action === 'copy') {
      const record = readRequestLog();
      const text = record?.requestBody || '';
      const clip = (globalThis as any).navigator?.clipboard;
      if (clip?.writeText) {
        clip.writeText(text).then(() => {
          btn.textContent = '已复制';
          setTimeout(() => { btn.textContent = '复制'; }, 1500);
        }).catch(() => {});
      }
      return;
    }
  });
  // 开关：写盘即可，历史页每次渲染都会重新读偏好
  host.addEventListener('change', (event: any) => {
    const el = event?.target as HTMLInputElement | null;
    if (!el || el.id !== 'aus-log-health-switch') return;
    try {
      setHealthBarEnabled(!!el.checked);
    } catch {}
  });
}

export function initLogView(options?: { go?: () => void; goTap?: () => void }): void {
  if (options?.go) goBack = options.go;
  if (options?.goTap) goTap = options.goTap;
}
