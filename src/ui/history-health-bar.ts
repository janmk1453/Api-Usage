/**
 * 历史记录页顶部的运行健康提示条
 *
 * 只在真的出问题时出现：用量为 0、用量没取到导致没进历史、速率离谱、
 * 元信息缺失、重要功能报错；另外有一类「本地估算补记」的轻提示（黄色）。
 * 目的是把「用户感觉不对」变成「一键把诊断材料交给开发者」。
 *
 * 提示条本身不决定「要不要提示」：
 * - 总开关（问题反馈 / 请求日志 页）关掉后整条不再出现；
 * - 点「忽略」把当前这批问题按指纹记下来（services/health-prefs，逐条指纹、7 天过期），
 *   同类问题以后不再弹，换成别的问题仍会提示；
 * - 每条明细还能单独「上传这一条」，上传内容会指名道姓指向那条记录；
 *   上传成功（HTTP 200）后这几条会按 one 口径落盘并立即从提示条里消失，
 *   否则用户会以为「明明传上去了提示还在」。
 */
import { icon } from './icons';
import { APP_VERSION } from '../constants/version';
import {
  buildHealthReport,
  healthSignalKey,
  healthSummaryText,
  healthTargetOf,
  type HealthReport,
  type HealthSignal,
} from '../services/health-signals';
import {
  addIgnoredHealthKeys,
  isHealthBarEnabled,
  readIgnoredHealthKeys,
} from '../services/health-prefs';
import { listTapRecords } from '../services/request-tap/store';
import { openLogUploadDialog } from './log-upload-dialog';

export const HEALTH_HOST_ID = 'aus-history-health';
/** 明细最多列几条，再多就只看汇总 */
const DETAIL_LIMIT = 3;

/** 当前渲染出来的报告：点「忽略」时按它的指纹落盘 */
let currentReport: HealthReport | null = null;
/** 最近一次渲染用的历史：上传成功后要按同一份数据重算提示条 */
let lastHistory: any[] = [];

function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeText(at: number): string {
  try {
    const d = new Date(at || 0);
    if (!at) return '';
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function severityOf(sig: HealthSignal): "info" | "warn" {
  return sig.severity === "info" ? "info" : "warn";
}

function headTitle(report: HealthReport): string {
  if (report.infoOnly) return `最近有 ${report.total} 次记录是本地估算补记`;
  return `最近有 ${report.total} 次对话记录异常`;
}

export function healthBarHTML(report: HealthReport): string {
  const items = report.items.slice(0, DETAIL_LIMIT);
  const more =
    report.total > items.length
      ? `<div class="aus-health-more">还有 ${report.total - items.length} 条未列出</div>`
      : '';
  const list = items
    .map((sig) => {
      const t = timeText(sig.at);
      const key = healthSignalKey(sig);
      const sev = severityOf(sig);
      return (
        `<div class="aus-health-item is-${sev}" data-health-key="${esc(key)}">` +
        `<span class="aus-health-dot"></span>` +
        `<span class="aus-health-item-text">${esc(sig.detail)}</span>` +
        (t ? `<span class="aus-health-item-time">${esc(t)}</span>` : "") +
        `<button type="button" class="aus-health-item-up" data-health-action="upload" data-health-key="${esc(key)}" title="上传这一条的诊断材料">上传这一条</button>` +
        "</div>"
      );
    })
    .join("");
  const tip = report.infoOnly
    ? "这些记录是上游没有返回用量、由本地估算补记的，只作提示；上传成功后会从提示条消失。"
    : "「上传反馈日志」会把下面每条异常逐条点名一起上传，上传成功的条目会立即从提示条消失；「上传这一条」只指认它自己（密钥会自动打码）。";
  const ignoreText = report.infoOnly ? "不再提示" : "忽略";
  return `
    <div class="aus-health${report.infoOnly ? " is-info-only" : ""}" role="status">
      <div class="aus-health-head">
        <span class="aus-health-title">${esc(headTitle(report))}</span>
        <span class="aus-health-summary">${esc(healthSummaryText(report))}</span>
      </div>
      <div class="aus-health-body">
        <div class="aus-health-list">${list}${more}</div>
        <div class="aus-health-tip">${esc(tip)}</div>
      </div>
      <div class="aus-health-actions">
        <button type="button" class="aus-health-btn is-primary" data-health-action="upload" title="逐条点名本次列出的 ${report.items.length} 条异常，一起上传">上传反馈日志</button>
        <button type="button" class="aus-health-btn" data-health-action="ignore" title="这些提示 7 天内不再出现">${esc(ignoreText)}</button>
        <button type="button" class="aus-health-close" data-health-action="ignore" aria-label="忽略">${icon("close", 14)}</button>
      </div>
    </div>`;
}

/**
 * 上传成功后的收尾：把交出去的条目按 one 口径落盘（7 天后若再犯仍会提示），
 * 然后立刻按同一份历史重算提示条——已经报给开发者的问题不该继续挂着。
 */
function dropUploaded(host: HTMLElement, keys: string[]): void {
  const list = (Array.isArray(keys) ? keys : []).filter(Boolean);
  if (list.length) {
    try { addIgnoredHealthKeys(list, Date.now(), "one"); } catch {}
  }
  currentReport = null;
  renderHistoryHealthBar(host, { history: lastHistory });
}

function hide(host: HTMLElement): void {
  host.innerHTML = '';
  host.style.display = "none";
}

function signalOf(key: string): { signal: HealthSignal; index: number } | null {
  const items = currentReport?.items || [];
  for (let i = 0; i < items.length; i += 1) {
    if (healthSignalKey(items[i]) === key) return { signal: items[i], index: i };
  }
  return null;
}

function bind(host: HTMLElement): void {
  host.addEventListener("click", (event: any) => {
    const btn = (event.target as HTMLElement | null)?.closest?.("[data-health-action]") as HTMLElement | null;
    if (!btn) return;
    const action = btn.getAttribute("data-health-action");
    const key = btn.getAttribute("data-health-key") || "";
    if (action === "upload") {
      if (key) {
        // 「上传这一条」：只指认这一条
        const hit = signalOf(key);
        openLogUploadDialog({
          appVersion: APP_VERSION,
          targets: hit ? [healthTargetOf(hit.signal)] : [],
          onUploaded: (keys) => dropUploaded(host, keys),
        });
        return;
      }
      // 「上传反馈日志」：把提示条里列出的每一条都指名道姓
      // （等价于把每条「上传这一条」并成一份包，弹窗里逐条列出）
      const targets = (currentReport?.items || []).map(healthTargetOf);
      openLogUploadDialog({ appVersion: APP_VERSION, targets, onUploaded: (keys) => dropUploaded(host, keys) });
      return;
    }
    if (action === "ignore") {
      // 逐条指纹落盘（7 天过期）：同类不再弹，别的问题照旧提示，不会永久静音
      try {
        const keys = (currentReport?.items || []).map(healthSignalKey);
        addIgnoredHealthKeys(keys);
      } catch {}
      currentReport = null;
      renderHistoryHealthBar(host);
    }
  });
}

/**
 * 渲染提示条（容器由历史页提供；没有异常、总开关关闭、问题已被忽略时清空并隐藏）
 * @param input.history 历史记录（取最近若干条判断用量与速率）
 */
export function renderHistoryHealthBar(host: HTMLElement | null, input?: { history?: any[] }): void {
  if (!host) return;
  if (Array.isArray(input?.history)) lastHistory = input.history;
  if (!isHealthBarEnabled()) {
    currentReport = null;
    hide(host);
    return;
  }
  let report: HealthReport;
  try {
    report = buildHealthReport({
      history: input?.history || [],
      taps: listTapRecords(),
      ignored: readIgnoredHealthKeys(),
    });
  } catch {
    currentReport = null;
    hide(host);
    return;
  }
  if (!report.shouldShow) {
    currentReport = null;
    hide(host);
    return;
  }
  currentReport = report;
  host.style.display = "block";
  host.innerHTML = healthBarHTML(report);
  if (!(host as any).__ausHealthBound) {
    (host as any).__ausHealthBound = true;
    bind(host);
  }
}
