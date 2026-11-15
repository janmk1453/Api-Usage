/**
 * 历史记录页顶部的运行健康提示条
 *
 * 只在真的出问题时出现：用量为 0、用量没取到导致没进历史、速率离谱、扩展报错。
 * 目的是把「用户感觉不对」变成「一键把诊断材料交给开发者」。
 */
import { icon } from './icons';
import { APP_VERSION } from '../constants/version';
import { buildHealthReport, healthSummaryText, type HealthReport } from '../services/health-signals';
import { openLogUploadDialog } from './log-upload-dialog';

export const HEALTH_HOST_ID = 'aus-history-health';
/** 明细最多列几条，再多就只看汇总 */
const DETAIL_LIMIT = 3;

let dismissed = false;

/** 关闭只对本次会话生效（刷新后重新判断，问题还在就还会提示） */
export function dismissHistoryHealth(): void {
  dismissed = true;
}

export function isHistoryHealthDismissed(): boolean {
  return dismissed;
}

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
        <div class="aus-health-tip">可以把诊断材料上传给开发者，帮助定位问题（密钥会自动打码）。</div>
      </div>
      <div class="aus-health-actions">
        <button type="button" class="aus-health-btn is-primary" data-health-action="upload">上传反馈日志</button>
        <button type="button" class="aus-health-btn" data-health-action="dismiss">这次先不用</button>
        <button type="button" class="aus-health-close" data-health-action="dismiss" aria-label="关闭">${icon('close', 14)}</button>
      </div>
    </div>`;
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
    if (action === 'dismiss') {
      dismissHistoryHealth();
      renderHistoryHealthBar(host);
    }
  });
}

/** 渲染提示条（容器由历史页提供；没有异常时清空并隐藏） */
export function renderHistoryHealthBar(host: HTMLElement | null, report?: HealthReport): void {
  if (!host) return;
  if (dismissed) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  let data: HealthReport;
  try {
    data = report || buildHealthReport();
  } catch {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  if (!data.shouldShow) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  host.style.display = 'block';
  host.innerHTML = healthBarHTML(data);
  if (!(host as any).__ausHealthBound) {
    (host as any).__ausHealthBound = true;
    bind(host);
  }
}
