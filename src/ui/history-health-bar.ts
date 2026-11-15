/**
 * 历史记录页顶部的运行健康提示条
 *
 * 只在真的出问题时出现：用量为 0、用量没取到导致没进历史、速率离谱、扩展报错。
 * 目的是把「用户感觉不对」变成「一键把诊断材料交给开发者」。
 *
 * 提示条本身不决定「要不要提示」：
 * - 总开关（问题反馈 / 请求日志 页）关掉后整条不再出现；
 * - 点「忽略」把当前这批问题按指纹记下来（services/health-prefs），
 *   同类问题以后不再弹，换成别的问题仍会提示。
 */
import { icon } from './icons';
import { APP_VERSION } from '../constants/version';
import {
  buildHealthReport,
  healthSignalKey,
  healthSummaryText,
  type HealthReport,
} from '../services/health-signals';
import {
  addIgnoredHealthKeys,
  isHealthBarEnabled,
  readIgnoredHealthKeys,
} from '../services/health-prefs';
import { openLogUploadDialog } from './log-upload-dialog';

export const HEALTH_HOST_ID = 'aus-history-health';
/** 明细最多列几条，再多就只看汇总 */
const DETAIL_LIMIT = 3;

/** 当前渲染出来的报告：点「忽略」时按它的指纹落盘 */
let currentReport: HealthReport | null = null;

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
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function healthBarHTML(report: HealthReport): string {
  const items = report.items.slice(0, DETAIL_LIMIT);
  const more = report.total > items.length ? `<div class="aus-health-more">还有 ${report.total - items.length} 条未列出</div>` : '';
  const list = items
    .map((sig) => {
      const t = timeText(sig.at);
      return `<div class="aus-health-item"><span class="aus-health-dot"></span><span class="aus-health-item-text">${esc(sig.detail)}</span>${t ? `<span class="aus-health-item-time">${esc(t)}</span>` : ''}</div>`;
    })
    .join('');
  return `
    <div class="aus-health" role="status">
      <div class="aus-health-head">
        <span class="aus-health-title">最近有 ${report.total} 次对话记录异常</span>
        <span class="aus-health-summary">${esc(healthSummaryText(report))}</span>
      </div>
      <div class="aus-health-body">
        <div class="aus-health-list">${list}${more}</div>
        <div class="aus-health-tip">可以把诊断材料上传给开发者，帮助定位问题（密钥会自动打码）。点「忽略」后同类问题不再提示，可在「设置 → 问题反馈 / 请求日志」里恢复。</div>
      </div>
      <div class="aus-health-actions">
        <button type="button" class="aus-health-btn is-primary" data-health-action="upload">上传反馈日志</button>
        <button type="button" class="aus-health-btn" data-health-action="ignore" title="这一类问题以后不再提示">忽略</button>
        <button type="button" class="aus-health-close" data-health-action="ignore" aria-label="忽略">${icon('close', 14)}</button>
      </div>
    </div>`;
}

function hide(host: HTMLElement): void {
  host.innerHTML = '';
  host.style.display = 'none';
}

function bind(host: HTMLElement): void {
  host.addEventListener('click', (event: any) => {
    const btn = (event.target as HTMLElement | null)?.closest?.('[data-health-action]') as HTMLElement | null;
    if (!btn) return;
    const action = btn.getAttribute('data-health-action');
    if (action === 'upload') {
      openLogUploadDialog({ appVersion: APP_VERSION });
      return;
    }
    if (action === 'ignore') {
      // 把「当前这批问题」按指纹记下来：同类不再弹，别的问题照旧提示
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
  if (!isHealthBarEnabled()) {
    currentReport = null;
    hide(host);
    return;
  }
  let report: HealthReport;
  try {
    report = buildHealthReport({
      history: input?.history || [],
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
  host.style.display = 'block';
  host.innerHTML = healthBarHTML(report);
  if (!(host as any).__ausHealthBound) {
    (host as any).__ausHealthBound = true;
    bind(host);
  }
}
