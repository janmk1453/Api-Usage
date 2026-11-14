import {
  clearMissingUsage,
  getMissingUsageRecords,
  summarizeMissingUsage,
  MISSING_USAGE_WINDOW_MS,
  type MissingUsageSummaryRow,
} from '../services/missing-usage';
import { log } from '../utils/logger';

/**
 * 统计页顶部「未计量请求」提示条
 *
 * 上游没返回 usage 的请求以前被静默丢弃，用户只看到「对话发生了但历史页没有」。
 * 这条提示把丢弃显性化：有多少次、哪个模型、哪个接入，并可清空。
 * 只做提示，不参与任何统计口径。
 */

const BAR_ID = 'aus-missing-bar';
const CONFIRM_WINDOW_MS = 4000;

function getDoc(): Document {
  return ((window as any).parent as any)?.document ?? document;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function reasonText(row: MissingUsageSummaryRow): string {
  return row.reasons.includes('zero-usage') ? '返回的用量全是 0' : '没有返回用量';
}

/** 静态骨架（放在统计页视图里，避免每次重绘整体重建） */
export function missingUsageBarHTML(): string {
  return `<div class="aus-missing-bar" id="${BAR_ID}" style="display:none;">
  <div class="aus-missing-head">
    <span class="aus-missing-dot" aria-hidden="true"></span>
    <span class="aus-missing-text" id="aus-missing-text"></span>
    <button type="button" class="aus-missing-link" id="aus-missing-toggle">详情</button>
    <button type="button" class="aus-missing-link" id="aus-missing-clear">清空</button>
  </div>
  <div class="aus-missing-body" id="aus-missing-body" style="display:none;"></div>
</div>`;
}

function bindBar(bar: HTMLElement, doc: Document): void {
  if ((bar as any).__ausBound) return;
  (bar as any).__ausBound = true;
  const toggle = bar.querySelector('#aus-missing-toggle') as HTMLElement | null;
  const body = bar.querySelector('#aus-missing-body') as HTMLElement | null;
  const clear = bar.querySelector('#aus-missing-clear') as HTMLElement | null;
  if (toggle && body) {
    toggle.onclick = () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      toggle.textContent = open ? '详情' : '收起';
      if (!open) paintBody(bar);
    };
  }
  if (clear) {
    let armedAt = 0;
    clear.onclick = () => {
      const now = Date.now();
      if (!armedAt || now - armedAt > CONFIRM_WINDOW_MS) {
        armedAt = now;
        clear.textContent = '确认清空';
        setTimeout(() => {
          if (Date.now() - armedAt >= CONFIRM_WINDOW_MS) {
            clear.textContent = '清空';
            armedAt = 0;
          }
        }, CONFIRM_WINDOW_MS);
        return;
      }
      armedAt = 0;
      clear.textContent = '清空';
      clearMissingUsage();
      renderMissingUsageBar(doc);
    };
  }
}

function paintBody(bar: HTMLElement): void {
  const body = bar.querySelector('#aus-missing-body') as HTMLElement | null;
  if (!body) return;
  const summary = summarizeMissingUsage(getMissingUsageRecords(), Date.now(), MISSING_USAGE_WINDOW_MS);
  body.innerHTML = summary.rows
    .map(
      (row) => `<div class="aus-missing-row">
        <span class="aus-missing-row-model">${escapeHtml(row.model)}</span>
        <span class="aus-missing-row-endpoint">${escapeHtml(row.endpointLabel)}</span>
        <span class="aus-missing-row-count">${row.count} 次</span>
        <span class="aus-missing-row-when">${escapeHtml(formatWhen(row.lastAt))}</span>
        <span class="aus-missing-row-reason">${reasonText(row)}</span>
      </div>`,
    )
    .join('');
}

export function renderMissingUsageBar(target?: Document): void {
  const doc = target ?? getDoc();
  let bar = doc.getElementById(BAR_ID) as HTMLElement | null;
  if (!bar) {
    const slot = doc.getElementById('aus-missing-slot');
    if (!slot) return;
    slot.innerHTML = missingUsageBarHTML();
    bar = doc.getElementById(BAR_ID) as HTMLElement | null;
    if (!bar) return;
  }
  try {
    bindBar(bar, doc);
    const summary = summarizeMissingUsage(getMissingUsageRecords(), Date.now(), MISSING_USAGE_WINDOW_MS);
    const text = bar.querySelector('#aus-missing-text') as HTMLElement | null;
    const body = bar.querySelector('#aus-missing-body') as HTMLElement | null;
    const toggle = bar.querySelector('#aus-missing-toggle') as HTMLElement | null;
    const clear = bar.querySelector('#aus-missing-clear') as HTMLElement | null;
    if (!summary.total) {
      bar.style.display = 'none';
      if (body) body.innerHTML = '';
      if (toggle) toggle.textContent = '详情';
      if (clear) clear.textContent = '清空';
      return;
    }
    bar.style.display = '';
    if (text) {
      text.textContent = `最近 7 天有 ${summary.total} 次请求未计入统计：上游没有返回 token 用量，费用无法得知`;
    }
    if (body && body.style.display !== 'none') paintBody(bar);
  } catch (e) {
    log.debug('渲染未计量请求提示失败', (e as any)?.message || e);
  }
}

