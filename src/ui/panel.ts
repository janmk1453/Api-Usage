import { state, getSelectedSave, getHistoryForDisplay } from '../store/index';
import { esc, localDay, localTimeHM } from '../utils/date';
import { isTruncatedFinish } from '../utils/finish';
import { saveHot } from '../store/persistence';
import { queryBalance } from '../services/balance';
import { bindImportExport } from '../services/import-export';
import { renderSettings } from './settings';
import { bindHistoryCompare, renderUsageDetail } from './compare';
import { renderOverview } from './overview';
import { icon } from './icons';
import {
  MOBILE_TABS,
  SETTINGS_ENTRIES,
  childParentOf,
  isChildView,
  isSettingsChild,
  parentTabOf,
  resolveTabTap,
  viewTitle,
} from './nav-model';
import type { AppView } from './nav-model';
import { initStatsView, positionFilterDropdown, renderStatsView } from './stats-view';
import { initExtraCharts, renderExtraCharts, resetChartThemeCache } from './extra-charts';
import { renderForecastView, initForecastView } from './forecast-view';
import { disposeForecastCharts } from './forecast-chart';
import { renderWalletView } from './wallet-view';
import { initChatManageView, renderChatManageView } from './chat-manage';
import { helpViewHTML } from './help-view';
import { chartCardHTML } from './chart-picker';
import { filterPickerRows } from './chat-visibility';
import { backDebug } from './back-debug';
import { afterNextPaint, closeDropdownInstant } from './dropdown-close';
import { BACK_GUARD_DEPTH, nextGuardState, readGuardDepth, stripGuardState } from './back-guard';
import { mobileDeviceHint } from '../utils/device';
import { bindChangelog, renderChangelogCard } from './changelog';
import { readFilterPrefs, writeFilterPrefs } from './filter-prefs';
import { initPillState } from './pill';
import { applyTheme } from '../services/theme';
import { DataEvents, on as onDataEvent } from '../data/events';
import { formatMoney, getDisplayCurrency } from '../services/currency';
import { repository } from '../data/repository';
import { trackOpen, trackPage, trackRender, flushTelemetry } from '../services/telemetry';
import {
  STATS_FILTER_ALL,
  STATS_FILTER_UNKNOWN,
  filterStatsHistory,
  getCredentialFilterOptions,
  getEndpointFilterOptions,
} from '../data/computed';

/** 面板首帧渲染耗时的起点（用于匿名统计里的渲染耗时分桶） */
let panelOpenStartTs = 0;
function nowTs(): number {
  try { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); } catch { return Date.now(); }
}

declare const __APP_VERSION__: string;

/** 当前扩展版本号（构建时由 manifest.version 注入）：侧栏品牌、设置页「关于」入口与关于页共用 */
function appVersionText(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '';
}

function getDoc(): Document { return (window.parent as any)?.document ?? document; }

// 精简展示完整响应：SSE 流式合并增量内容，隐藏 id/created/object/choices/index/delta 等重复字段
function prettyFullResponse(resp: any): string {
  if (resp == null) return '（原文已清理）';
  if (typeof resp !== 'string') {
    try { return JSON.stringify(resp, null, 2); } catch { return String(resp); }
  }
  const text = resp.trim();
  if (text.indexOf('data:') === -1) {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
  }
  let id = '', model = '', finish: string | null = null, usage: any = null;
  let content = '', reasoning = '', chunks = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let chunk: any;
    try { chunk = JSON.parse(payload); } catch { continue; }
    chunks++;
    if (chunk.id) id = chunk.id;
    if (chunk.model) model = chunk.model;
    if (chunk.usage) usage = chunk.usage;
    const ch = Array.isArray(chunk.choices) ? chunk.choices[0] : null;
    if (ch) {
      const d = ch.delta || {};
      if (typeof d.reasoning_content === 'string') reasoning += d.reasoning_content;
      else if (typeof d.reasoning === 'string') reasoning += d.reasoning;
      if (typeof d.content === 'string') content += d.content;
      if (ch.finish_reason) finish = ch.finish_reason;
    }
  }
  const head: string[] = [];
  if (id) head.push(`id: ${id}`);
  if (model) head.push(`model: ${model}`);
  head.push(`chunks: ${chunks}`);
  head.push(`finish_reason: ${finish ?? '（无）'}`);
  if (usage) head.push(`usage: ${JSON.stringify(usage)}`);
  const body: string[] = [];
  if (reasoning) body.push(`【思维链】\n${reasoning}`);
  body.push(`【正文】\n${content || '（无内容）'}`);
  return `${head.join('\n')}\n\n${body.join('\n\n')}\n\n—— 已合并 SSE 增量并隐藏重复字段 ——`;
}

let panelCreated = false;
let panelOpen = false;
let currentView: AppView = 'overview';
/** 「设置」下最近打开的二级页（窄屏点回「设置」tab 时恢复到上次位置） */
let settingsChildView: AppView | null = null;
/** 「对话展示管理」的来源页：进入前记录的视图，页内「返回」与顶栏返回箭头都回到这里 */
let chatManageOrigin: AppView = 'overview';
/** 当前导航高亮键：窄屏二级页归到「设置」，桌面为视图本身 */
let currentNavKey: AppView = 'overview';
let collapsed = false;

export function refreshUI() {
  try {
    if (!panelOpen) return;
    const doc = getDoc();
    const s: any = getSelectedSave();
    if (!s) return;
    const bal = state.customBalance || state.balance?.balance;
    const balEl = doc.getElementById('aus-balance');
    if (balEl) {
      try {  const v = bal ? parseFloat(String(bal)) : NaN; balEl.textContent = !isNaN(v) ? formatMoney(v, 2) : formatMoney(0, 2); } catch { balEl.textContent = bal ? '¥' + bal + ' CNY' : '¥0.00 CNY'; }
    }
    const totalCostEl = doc.getElementById('aus-total-cost');
    if (totalCostEl) {
      try {  totalCostEl.textContent = formatMoney(s.total_cost || 0, 4); } catch { totalCostEl.textContent = '¥' + (s.total_cost || 0).toFixed(4) + ' CNY'; }
    }
    const tokEl = doc.getElementById('aus-total-tokens');
    if (tokEl) tokEl.textContent = (s.total_tokens || 0).toLocaleString('zh-CN') + ' tokens';
    renderHistory(doc, s);
    renderOverview();
    renderStatsView();
    try { renderForecastView(); } catch {}
    try { renderWalletView(); } catch {}
  } catch {}
}

/**
 * 主题切换后的整体重绘（跟随系统时由 prefers-color-scheme 变化触发）。
 * 面板关闭时无需处理：下次打开由 createPanel/refreshUI 重新取色。
 */
export function refreshTheme() {
  try {
    if (!panelOpen) return;
    try { resetChartThemeCache(); } catch {}
    try { disposeForecastCharts(); } catch {}
    refreshUI();
  } catch {}
}

let historyPage = 1;
const HISTORY_PAGE_SIZE = 30;
let historyFullCache: any[] | null = null;
let historyCacheScope = '';
let historyLoading = false;
const invalidateHistoryCache = () => {
  historyFullCache = null;
  historyCacheScope = '';
  historyPage = 1;
};
const historyFilters = {
  model: STATS_FILTER_ALL,
  chat: STATS_FILTER_ALL,
  endpoint: STATS_FILTER_ALL,
  credential: STATS_FILTER_ALL,
};

// 四维筛选跨刷新记忆（与统计页共用 aus_filter_prefs_v1，分片存储互不覆盖）；
// 记录里已不存在的选项仍由 renderHistoryFilters 的校验剔除。
const restoredHistoryPrefs = readFilterPrefs().history;
if (restoredHistoryPrefs.model) historyFilters.model = restoredHistoryPrefs.model;
if (restoredHistoryPrefs.chat) historyFilters.chat = restoredHistoryPrefs.chat;
if (restoredHistoryPrefs.endpoint) historyFilters.endpoint = restoredHistoryPrefs.endpoint;
if (restoredHistoryPrefs.credential) historyFilters.credential = restoredHistoryPrefs.credential;
let historyFilterBase: any[] = [];
try {
  onDataEvent(DataEvents.HISTORY_ADDED, invalidateHistoryCache);
  onDataEvent(DataEvents.UPDATED, invalidateHistoryCache);
} catch {}

type HistoryFilterKind = keyof typeof historyFilters;
type HistoryFilterOption = { id: string; label: string; title?: string; unknown?: boolean };

function historyFiltersActive(): boolean {
  return Object.values(historyFilters).some((value) => value !== STATS_FILTER_ALL);
}

function resetHistoryFilters() {
  historyFilters.model = STATS_FILTER_ALL;
  historyFilters.chat = STATS_FILTER_ALL;
  historyFilters.endpoint = STATS_FILTER_ALL;
  historyFilters.credential = STATS_FILTER_ALL;
  historyPage = 1;
}

function getHistoryChatOptions(history: any[]): HistoryFilterOption[] {
  const map = new Map<string, { id: string; label: string; title: string; lastSeen: number }>();
  for (const entry of history || []) {
    const chatId = entry?.chatId ?? null;
    const id = chatId ?? '__null__';
    const chatName = String(entry?.chatName || '').trim();
    const label = chatName || (chatId
      ? (String(chatId).length > 18 ? `${String(chatId).slice(0, 8)}…${String(chatId).slice(-4)}` : String(chatId))
      : '未分组/旧数据');
    const timestamp = Number(entry?.timestamp) || 0;
    const current = map.get(id);
    if (!current) {
      map.set(id, { id, label, title: String(chatId || label), lastSeen: timestamp });
    } else {
      if (timestamp >= current.lastSeen && chatName) {
        current.label = chatName;
        current.title = String(chatId || chatName);
      }
      if (timestamp > current.lastSeen) current.lastSeen = timestamp;
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.lastSeen - a.lastSeen || a.label.localeCompare(b.label, 'zh-CN'))
    .map(({ id, label, title }) => ({ id, label, title }));
}

function closeHistoryFilterDropdowns() {
  const doc = getDoc();
  for (const kind of ['model', 'chat', 'endpoint', 'credential'] as HistoryFilterKind[]) {
    const dropdown = doc.getElementById(`aus-history-${kind}-dropdown`);
    if (dropdown) (dropdown as HTMLElement).style.display = 'none';
  }
}

/** 选中某一项后要重建列表时用：先把四个浮层瞬时收掉，重绘留到下一帧。 */
function closeHistoryFilterDropdownsInstant() {
  const doc = getDoc();
  for (const kind of ['model', 'chat', 'endpoint', 'credential'] as HistoryFilterKind[]) {
    closeDropdownInstant(doc.getElementById(`aus-history-${kind}-dropdown`) as HTMLElement | null);
  }
}

function renderHistoryFilterDropdown(
  kind: HistoryFilterKind,
  selected: string,
  options: HistoryFilterOption[],
  emptyText: string,
  onSelect: (value: string) => void,
) {
  const doc = getDoc();
  const dropdown = doc.getElementById(`aus-history-${kind}-dropdown`);
  if (!dropdown) return;
  const item = (id: string, label: string, title = label) => {
    const active = id === selected ? 'background:var(--ds-card);font-weight:600;' : '';
    return `<div data-history-value="${esc(id)}" title="${esc(title)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active}">${esc(label)}</div>`;
  };
  let html = item(STATS_FILTER_ALL, '全部');
  for (const option of options) html += item(option.id, option.label, option.title || option.label);
  if (!options.length) html += `<div style="padding:8px 10px;color:var(--ds-text-3);font-size:var(--aus-fs-base);">${esc(emptyText)}</div>`;
  dropdown.innerHTML = html;
  dropdown.querySelectorAll('[data-history-value]').forEach((element: any) => {
    element.onclick = () => onSelect(element.getAttribute('data-history-value') || STATS_FILTER_ALL);
  });
}

function renderHistoryFilters(history: any[]) {
  historyFilterBase = history || [];
  const doc = getDoc();
  const models = Array.from(new Set(historyFilterBase.map((entry) => String(entry?.model || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((id) => ({ id, label: id }));
  if (historyFilters.model !== STATS_FILTER_ALL && !models.some((option) => option.id === historyFilters.model)) {
    historyFilters.model = STATS_FILTER_ALL;
  }
  // 全量对话选项用于取值校验与名称回显；下拉里只列未被隐藏的（「对话展示管理」的「下拉选项」集合）
  const chatOptions = getHistoryChatOptions(historyFilterBase);
  if (historyFilters.chat !== STATS_FILTER_ALL && !chatOptions.some((option) => option.id === historyFilters.chat)) {
    historyFilters.chat = STATS_FILTER_ALL;
  }
  const chats = filterPickerRows(chatOptions, (option) => option.id);
  const endpoints = getEndpointFilterOptions(historyFilterBase);
  if (historyFilters.endpoint !== STATS_FILTER_ALL && !endpoints.some((option) => option.id === historyFilters.endpoint)) {
    historyFilters.endpoint = STATS_FILTER_ALL;
    historyFilters.credential = STATS_FILTER_ALL;
  }
  const credentials = getCredentialFilterOptions(historyFilterBase, historyFilters.endpoint);
  if (historyFilters.credential !== STATS_FILTER_ALL && !credentials.some((option) => option.id === historyFilters.credential)) {
    historyFilters.credential = STATS_FILTER_ALL;
  }

  const labelMap: Record<HistoryFilterKind, string> = {
    model: historyFilters.model === STATS_FILTER_ALL ? '全部' : historyFilters.model,
    chat: historyFilters.chat === STATS_FILTER_ALL
      ? '全部'
      : chatOptions.find((option) => option.id === historyFilters.chat)?.label || historyFilters.chat,
    endpoint: historyFilters.endpoint === STATS_FILTER_ALL
      ? '全部'
      : historyFilters.endpoint === STATS_FILTER_UNKNOWN
        ? '未记录接入'
        : endpoints.find((option) => option.id === historyFilters.endpoint)?.label || historyFilters.endpoint,
    credential: historyFilters.credential === STATS_FILTER_ALL
      ? '全部'
      : historyFilters.credential === STATS_FILTER_UNKNOWN
        ? '未识别密钥'
        : credentials.find((option) => option.id === historyFilters.credential)?.label || historyFilters.credential,
  };
  for (const kind of ['model', 'chat', 'endpoint', 'credential'] as HistoryFilterKind[]) {
    const label = doc.getElementById(`aus-history-${kind}-label`);
    if (label) {
      label.textContent = labelMap[kind];
      label.title = labelMap[kind];
    }
  }
  renderHistoryFilterDropdown('model', historyFilters.model, models, '暂无模型', (value) => {
    historyFilters.model = value;
    historyPage = 1;
    closeHistoryFilterDropdownsInstant();
    afterNextPaint(() => renderHistory(doc, getSelectedSave()));
  });
  renderHistoryFilterDropdown('chat', historyFilters.chat, chats, chatOptions.length ? '对话已全部隐藏（可在「对话展示管理」中恢复）' : '暂无对话', (value) => {
    historyFilters.chat = value;
    historyPage = 1;
    closeHistoryFilterDropdownsInstant();
    afterNextPaint(() => renderHistory(doc, getSelectedSave()));
  });
  renderHistoryFilterDropdown('endpoint', historyFilters.endpoint, endpoints, '暂无接入记录', (value) => {
    historyFilters.endpoint = value;
    historyFilters.credential = STATS_FILTER_ALL;
    historyPage = 1;
    closeHistoryFilterDropdownsInstant();
    afterNextPaint(() => renderHistory(doc, getSelectedSave()));
  });
  renderHistoryFilterDropdown('credential', historyFilters.credential, credentials, '暂无密钥记录', (value) => {
    historyFilters.credential = value;
    historyPage = 1;
    closeHistoryFilterDropdownsInstant();
    afterNextPaint(() => renderHistory(doc, getSelectedSave()));
  });
  // 纯展示偏好：每次渲染筛选器后落盘（含校验剔除后的值），供下次打开还原
  writeFilterPrefs({
    history: {
      model: historyFilters.model,
      chat: historyFilters.chat,
      endpoint: historyFilters.endpoint,
      credential: historyFilters.credential,
    },
  });
}

function filteredHistoryForDisplay(history: any[]): any[] {
  return filterStatsHistory(history, {
    model: historyFilters.model,
    chat: historyFilters.chat,
    endpoint: historyFilters.endpoint,
    credential: historyFilters.credential,
  });
}

function bindHistoryFilters(doc: Document) {
  const controls: Array<[HistoryFilterKind, string]> = [
    ['model', '#aus-history-model-btn'],
    ['chat', '#aus-history-chat-btn'],
    ['endpoint', '#aus-history-endpoint-btn'],
    ['credential', '#aus-history-credential-btn'],
  ];
  for (const [kind, selector] of controls) {
    const button = doc.querySelector(selector) as HTMLElement | null;
    const dropdown = doc.getElementById(`aus-history-${kind}-dropdown`) as HTMLElement | null;
    if (!button || !dropdown) continue;
    button.onclick = () => {
      const willOpen = dropdown.style.display !== 'block';
      closeHistoryFilterDropdowns();
      if (!willOpen) return;
      renderHistoryFilters(historyFilterBase);
      dropdown.style.display = 'block';
      positionFilterDropdown(button, dropdown);
    };
  }
  // 顶部筛选「重置筛选」：四维恢复为全部、分页回第一页，并随 renderHistoryFilters 落盘
  const historyResetBtn = doc.getElementById('aus-history-filter-reset');
  if (historyResetBtn) {
    historyResetBtn.onclick = () => {
      resetHistoryFilters();
      closeHistoryFilterDropdowns();
      renderHistory(doc, getSelectedSave());
    };
  }
  doc.addEventListener('click', (event: any) => {
    const target = event.target as HTMLElement;
    if (!target.closest('#aus-history-filter-host')) closeHistoryFilterDropdowns();
  });
}

let activeHistoryDetailTs: string | null = null;
let activeHistoryDetailPanel: HTMLElement | null = null;
let activeHistoryDetailHost: HTMLElement | null = null;
let activeHistoryDetailBtn: HTMLElement | null = null;

function resetHistoryDetailState(doc: Document, clearBody = false) {
  try {
    const body = doc.getElementById('aus-history-detail-body') as HTMLElement | null;
    if (body && clearBody) body.innerHTML = '';
    const drawer = doc.getElementById('aus-history-detail') as HTMLElement | null;
    if (drawer) drawer.style.display = 'none';
    const content = doc.getElementById('aus-content-body') as HTMLElement | null;
    if (content) content.classList.remove('has-history-detail');
  } catch {}
  activeHistoryDetailTs = null;
  activeHistoryDetailPanel = null;
  activeHistoryDetailHost = null;
  activeHistoryDetailBtn = null;
}

function closeHistoryDetail(doc: Document) {
  const panel = activeHistoryDetailPanel;
  const host = activeHistoryDetailHost;
  if (panel) {
    try {
      if (panel.parentElement && panel.parentElement.id === 'aus-history-detail-body' && host) host.appendChild(panel);
    } catch {}
    panel.style.display = 'none';
    panel.style.flexDirection = 'column';
    panel.style.maxHeight = 'min(520px,60vh)';
    panel.style.overflowY = 'auto';
    panel.style.overflowX = 'hidden';
    panel.style.marginTop = '8px';
    panel.style.borderTop = '1px solid var(--ds-border)';
    panel.style.paddingTop = '8px';
  }
  const btn = activeHistoryDetailBtn;
  if (btn && btn.isConnected) {
    btn.textContent = '详情';
    btn.style.background = 'var(--ds-black)';
    btn.style.color = 'var(--ds-black-text)';
    btn.style.borderColor = 'var(--ds-black)';
  }
  resetHistoryDetailState(doc);
}

function openHistoryDetail(doc: Document, panel: HTMLElement, btn: HTMLElement) {
  const ts = btn.getAttribute('data-ts') || '';
  if (activeHistoryDetailTs === ts && activeHistoryDetailPanel === panel) { closeHistoryDetail(doc); return; }
  if (activeHistoryDetailPanel && activeHistoryDetailPanel !== panel) closeHistoryDetail(doc);
  const body = doc.getElementById('aus-history-detail-body') as HTMLElement | null;
  const drawer = doc.getElementById('aus-history-detail') as HTMLElement | null;
  const title = doc.getElementById('aus-history-detail-title') as HTMLElement | null;
  if (!body || !drawer) return;
  activeHistoryDetailHost = panel.parentElement as HTMLElement | null;
  activeHistoryDetailTs = ts;
  activeHistoryDetailPanel = panel;
  activeHistoryDetailBtn = btn;
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.maxHeight = 'none';
  panel.style.overflow = 'visible';
  panel.style.marginTop = '0';
  panel.style.borderTop = 'none';
  panel.style.paddingTop = '0';
  try { body.appendChild(panel); } catch {}
  // 标题两行：第一行模型名（过长省略），第二行记录时间，省掉「模型 · 时间」挤成一行后互相抢宽度
  const sub = doc.getElementById('aus-history-detail-sub') as HTMLElement | null;
  const modelName = btn.getAttribute('data-model') || '记录详情';
  const recordTime = btn.getAttribute('data-time') || '';
  if (title) title.textContent = modelName;
  if (sub) {
    sub.textContent = recordTime;
    sub.style.display = recordTime ? '' : 'none';
  }
  btn.textContent = '收起';
  btn.style.background = 'var(--ds-card-inner)';
  btn.style.color = 'var(--ds-text)';
  btn.style.borderColor = 'var(--ds-black)';
  drawer.style.display = 'flex';
  const content = doc.getElementById('aus-content-body') as HTMLElement | null;
  if (content) content.classList.add('has-history-detail');
}

/**
 * 在重绘列表期间保持 #aus-main 的滚动位置不变：翻页、异步补齐全量数据都只换内容，
 * 不允许把页面滚到别处（旧实现用 scrollIntoView 把列表拽回顶部）。
 */
function keepMainScrollPosition(doc: Document, fn: () => void): void {
  const scroller = doc.getElementById('aus-main') as HTMLElement | null;
  const top = scroller ? scroller.scrollTop : 0;
  const left = scroller ? scroller.scrollLeft : 0;
  fn();
  if (!scroller) return;
  const restore = () => { try { scroller.scrollTop = top; scroller.scrollLeft = left; } catch {} };
  restore();
  // 列表重绘可能触发浏览器的滚动锚定，等布局稳定后再钉一次位置
  try {
    const view = doc.defaultView;
    if (view && view.requestAnimationFrame) view.requestAnimationFrame(restore);
    else setTimeout(restore, 0);
  } catch { setTimeout(restore, 0); }
}

function renderHistoryInner(doc: Document, fullHist: any[]) {
  const host = doc.getElementById('aus-history');
  if (!host) return;
  const reopenDetailTs = activeHistoryDetailTs;
  resetHistoryDetailState(doc, true);
  const total = fullHist.length;
  if (!total) {
    host.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ds-text-3);font-size:var(--aus-fs-base);line-height:1.8;">当前筛选无记录<br/><button id="aus-history-filter-reset" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">清除筛选</button></div>`;
    const reset = doc.getElementById('aus-history-filter-reset') as HTMLButtonElement | null;
    if (reset) reset.onclick = () => {
      resetHistoryFilters();
      closeHistoryFilterDropdowns();
      renderHistory(doc, getSelectedSave());
    };
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  if (historyPage > totalPages) historyPage = totalPages;
  if (historyPage < 1) historyPage = 1;
  const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
  const pageHist = fullHist.slice(start, start + HISTORY_PAGE_SIZE);
  const pagerTop = total > HISTORY_PAGE_SIZE ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);">
      <span>共 ${total} 条 · 第 ${historyPage}/${totalPages} 页</span>
      <span style="display:flex;gap:6px;">
        <button id="aus-history-prev" ${historyPage<=1?'disabled':''} style="padding:4px 10px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage<=1?'var(--ds-card)':'var(--ds-card-inner)'};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage<=1?'not-allowed':'pointer'};opacity:${historyPage<=1?'0.5':'1'};display:inline-flex;align-items:center;gap:4px;">${icon('chevron-left', 14)} 上一页</button>
        <button id="aus-history-next" ${historyPage>=totalPages?'disabled':''} style="padding:4px 10px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage>=totalPages?'var(--ds-card)':'var(--ds-card-inner)'};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage>=totalPages?'not-allowed':'pointer'};opacity:${historyPage>=totalPages?'0.5':'1'};display:inline-flex;align-items:center;gap:4px;">下一页 ${icon('chevron-right', 14)}</button>
      </span>
    </div>` : '';
  const pagerBottom = total > HISTORY_PAGE_SIZE ? `<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:10px;font-size:var(--aus-fs-sm);">
      <button id="aus-history-prev-b" ${historyPage<=1?'disabled':''} style="padding:4px 12px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage<=1?'var(--ds-card)':'var(--ds-card-inner)'};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage<=1?'not-allowed':'pointer'};opacity:${historyPage<=1?'0.5':'1'};display:inline-flex;align-items:center;gap:4px;">${icon('chevron-left', 14)} 上一页</button>
      <span style="color:var(--ds-text-2);">第 ${historyPage}/${totalPages} 页</span>
      <button id="aus-history-next-b" ${historyPage>=totalPages?'disabled':''} style="padding:4px 12px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage>=totalPages?'var(--ds-card)':'var(--ds-card-inner)'};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage>=totalPages?'not-allowed':'pointer'};opacity:${historyPage>=totalPages?'0.5':'1'};display:inline-flex;align-items:center;gap:4px;">下一页 ${icon('chevron-right', 14)}</button>
    </div>` : '';
  host.innerHTML = pagerTop + pageHist.map((h: any) => {
    const total = h.total_tokens || 1;
    const hp = ((h.cache_hit_tokens || 0) / total * 100);
    const mp = ((h.cache_miss_tokens || 0) / total * 100);
    const op = ((h.completion_tokens || 0) / total * 100);
    const hps = hp.toFixed(1), mps = mp.toFixed(1), ops = op.toFixed(1);
    const fmtMoney = (v:number,d=4)=>{ try{  return formatMoney(v||0,d);} catch{ return '¥'+(v||0).toFixed(d)+' CNY'; } };
    const c4 = fmtMoney(h.cost||0,4); const c6 = fmtMoney(h.cost||0,6); const in6 = fmtMoney(h.input_cost||0,6); const out6 = fmtMoney(h.output_cost||0,6);
    // 记录来源徽标：Agent 模式 / 常规对话（旧记录无 origin 视为常规）
    const isAgentRecord = String((h as any).origin || '') === 'agent';
    const agentTurnCount = Number((h as any).agentModelTurns) || 0;
    const agentStatusKey = String((h as any).agentStatus || '');
    const agentStatusLabels: Record<string, string> = { completed: '已完成', partial_success: '部分完成', cancelled: '已取消', failed: '失败' };
    const originTitle = isAgentRecord
      ? ['Agent 模式', agentTurnCount > 0 ? agentTurnCount + ' 个模型回合' : '', agentStatusLabels[agentStatusKey] || ''].filter(Boolean).join(' · ')
      : '常规对话';
    const originBadge = isAgentRecord
      ? `<span class="aus-origin-badge" title="${esc(originTitle)}" style="flex-shrink:0;display:inline-block;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600;line-height:16px;background:var(--ds-green-bg);color:var(--ds-green);">Agent</span>`
      : `<span class="aus-origin-badge" title="${esc(originTitle)}" style="flex-shrink:0;display:inline-block;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600;line-height:16px;background:var(--ds-card-inner);color:var(--ds-text-3);">常规</span>`;
    const recordDate = new Date(h.timestamp);
    const recordDateText = recordDate.toLocaleDateString('zh-CN');
    const recordTimeText = recordDate.toLocaleTimeString('zh-CN', { hour12: false });
    return `
    <div style="padding:10px 12px;background:var(--ds-card);border-radius:10px;margin-bottom:8px;font-size:var(--aus-fs-base);">
      <div class="aus-history-card-head" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="aus-history-card-main" style="min-width:0;flex:1;">
          <div class="aus-history-card-title" style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--ds-text);white-space:nowrap;overflow:hidden;">${originBadge}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(h.model)} · ${esc(localTimeHM(h.timestamp))}</span></div>
          <div style="color:var(--ds-text-2);margin-top:2px;">${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${(h.tokenRate||0)>0 ? h.tokenRate+' t/s' : '未测速'}</div>
        </div>
        <div class="aus-history-card-actions" style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;gap:6px;align-items:center;">
          <div class="aus-history-card-cost">
            <div style="font-weight:700;color:var(--ds-text);">${c4}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="aus-compare-old" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">旧</button>
            <button class="aus-compare-new" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">新</button>
            <button class="aus-detail-toggle" data-ts="${h.timestamp}" data-model="${esc(h.model || '')}" data-time="${esc(recordDateText + ' ' + recordTimeText)}" style="padding:4px 8px;border:1px solid var(--ds-black);border-radius:6px;background:var(--ds-black);color:var(--ds-black-text);font-size:var(--aus-fs-sm);cursor:pointer;">详情</button>
          </div>
        </div>
      </div>
      <div style="background:var(--ds-border);border-radius:999px;height:6px;overflow:hidden;margin-top:8px;display:flex;">
        <div style="background:var(--aus-token-hit);width:${hp}%;height:100%;"></div>
        <div style="background:var(--aus-token-miss);width:${mp}%;height:100%;"></div>
        <div style="background:var(--aus-token-output);width:${op}%;height:100%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:var(--aus-fs-sm);margin-top:4px;">
        <div style="display:flex;gap:10px;align-items:center;color:var(--ds-text-2);">
          <span style="display:inline-flex;align-items:center;gap:4px;"><span class="aus-token-dot" style="background:var(--aus-token-hit);"></span><b style="color:var(--ds-text);font-weight:600;">${hps}%</b> 命中</span>
          <span style="display:inline-flex;align-items:center;gap:4px;"><span class="aus-token-dot" style="background:var(--aus-token-miss);"></span><b style="color:var(--ds-text);font-weight:600;">${mps}%</b> 未命中</span>
          <span style="display:inline-flex;align-items:center;gap:4px;"><span class="aus-token-dot" style="background:var(--aus-token-output);"></span><b style="color:var(--ds-text);font-weight:600;">${ops}%</b> 输出</span>
        </div>
        <span style="color:var(--ds-text-2);">${total.toLocaleString()}t</span>
      </div>
      <div class="aus-detail-panel" data-detail="${h.timestamp}" style="display:none;">
              <div class="aus-dt-row">
                <section class="aus-dt-block">
                  <div class="aus-dt-head">基础信息</div>
                  <div class="aus-dt-grid">
                    <div class="aus-dt-item is-wide"><span class="aus-dt-label">模型</span><span class="aus-dt-val">${esc(h.model||'—')}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">时段</span><span class="aus-dt-val">${h.priceType==='new-peak'||h.priceType==='wallet-peak'?'高峰':h.priceType==='new-offpeak'||h.priceType==='wallet-offpeak'?'非高峰':h.priceType==='unpriced'?'待定价':'旧价格'}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">计价来源</span><span class="aus-dt-val">${h.pricingSource==='wallet'?'钱包规则':h.pricingSource==='builtin'?'DeepSeek 内置':h.pricingSource==='unpriced'?'待定价':h.pricingSource==='legacy-match'?'旧数据同名价':h.pricingSource==='legacy'?'旧全局规则':'旧记录兜底'}</span></div>
                    <div class="aus-dt-item is-wide"><span class="aus-dt-label">钱包</span><span class="aus-dt-val">${esc(repository.getWallet(String(h.walletId||''))?.name || h.endpointLabel || '未归属钱包')}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">日期</span><span class="aus-dt-val">${esc(recordDateText)}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">时间</span><span class="aus-dt-val">${esc(recordTimeText)}</span></div>
                  </div>
                </section>
                <section class="aus-dt-block">
                  <div class="aus-dt-head">性能</div>
                  <div class="aus-dt-grid">
                    <div class="aus-dt-item"><span class="aus-dt-label">耗时</span><span class="aus-dt-val">${((h.duration||0)/1000).toFixed(1)}s</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">首字延迟</span><span class="aus-dt-val">${(h.ttft||0)>0?((h.ttft||0)/1000).toFixed(1)+'s':'—'}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">速率</span><span class="aus-dt-val" style="color:${(h.tokenRate||0)>0?'var(--ds-green)':'var(--ds-text-3)'};">${(h.tokenRate||0)>0?h.tokenRate+' t/s':(h.streamed===false?'非流式':'—')}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">思维链耗时</span><span class="aus-dt-val">${(h.thinkTime||0)>0?((h.thinkTime||0)/1000).toFixed(1)+'s':'—'}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">思维链占比</span><span class="aus-dt-val">${(()=>{ const comp=h.completion_tokens||0, th=h.thinkTokens||0; if(!comp||!th) return '—'; return (th/comp*100).toFixed(1)+'%';})()}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">是否截断</span><span class="aus-dt-val" style="color:${(isTruncatedFinish(h.finishReason)||h.isTruncated)?'var(--ds-red)':'var(--ds-text)'};">${(isTruncatedFinish(h.finishReason)||h.isTruncated)?'是 ('+(esc(h.finishReason||'length'))+')':'否'}</span></div>
                  </div>
                </section>
              </div>
              <div class="aus-dt-row">
                <section class="aus-dt-block">
                  <div class="aus-dt-head">Token 消耗</div>
                  <div class="aus-dt-bar" title="命中 ${hps}% · 未命中 ${mps}% · 输出 ${ops}%">
                    <div style="width:${hp}%;background:var(--aus-token-hit);"></div>
                    <div style="width:${mp}%;background:var(--aus-token-miss);"></div>
                    <div style="width:${op}%;background:var(--aus-token-output);"></div>
                  </div>
                  <div class="aus-dt-grid">
                    <div class="aus-dt-item"><span class="aus-dt-label"><span class="aus-token-dot" style="background:var(--aus-token-hit);"></span>缓存命中</span><span class="aus-dt-val">${(h.cache_hit_tokens||0).toLocaleString()}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label"><span class="aus-token-dot" style="background:var(--aus-token-miss);"></span>缓存未命中</span><span class="aus-dt-val">${(h.cache_miss_tokens||0).toLocaleString()}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label"><span class="aus-token-dot" style="background:var(--aus-token-output);"></span>输出 Token</span><span class="aus-dt-val">${(h.completion_tokens||0).toLocaleString()}</span></div>
                    <div class="aus-dt-item"><span class="aus-dt-label">总 Token</span><span class="aus-dt-val is-strong">${(h.total_tokens||0).toLocaleString()}</span></div>
                    <div class="aus-dt-item is-wide"><span class="aus-dt-label">思维链 Token</span><span class="aus-dt-val">${h.thinkTokens||0}</span></div>
                  </div>
                </section>
                <section class="aus-dt-block">
                  <div class="aus-dt-head">费用明细</div>
                  <div class="aus-dt-cost">
                    <div class="aus-dt-cost-row"><span class="aus-dt-label">输入费用</span><span class="aus-dt-cost-val">${in6}</span></div>
                    <div class="aus-dt-cost-row"><span class="aus-dt-label">输出费用</span><span class="aus-dt-cost-val">${out6}</span></div>
                    <div class="aus-dt-cost-row is-total"><span>总费用</span><span class="aus-dt-cost-val">${c6}</span></div>
                  </div>
                </section>
              </div>
              <div class="aus-dt-tabs" role="tablist">
                <button class="aus-tab-btn" data-tab="req" data-ts="${h.timestamp}" data-active="1" role="tab">请求参数</button>
                <button class="aus-tab-btn" data-tab="res" data-ts="${h.timestamp}" role="tab">完整响应</button>
                <button class="aus-tab-btn" data-tab="raw" data-ts="${h.timestamp}" role="tab">Raw 用量</button>
                <button class="aus-tab-btn" data-tab="msg" data-ts="${h.timestamp}" role="tab">消息内容</button>
              </div>
              <pre class="aus-tab-content aus-dt-pre" data-content="req-${h.timestamp}" style="display:block;">${esc(h.fullRequest ? JSON.stringify(h.fullRequest, null, 2) : (h.raw_usage ? JSON.stringify(h.raw_usage, null, 2) : '（原文已清理，仅保留统计）'))}</pre>
              <div class="aus-tab-content" data-content="res-${h.timestamp}" style="display:none;">
                <pre class="aus-dt-pre">${esc(prettyFullResponse(h.fullResponse))}</pre>
                ${h.fullResponse ? `<div class="aus-dt-rawbar"><button class="aus-res-raw-btn" data-ts="${h.timestamp}">查看原始完整数据</button></div><pre class="aus-res-raw aus-dt-pre aus-dt-pre-raw" data-ts="${h.timestamp}" style="display:none;">${esc(typeof h.fullResponse === 'string' ? h.fullResponse : JSON.stringify(h.fullResponse, null, 2))}</pre>` : ''}
              </div>
              <pre class="aus-tab-content aus-dt-pre" data-content="raw-${h.timestamp}" style="display:none;">${esc(JSON.stringify(h.raw_usage || {}, null, 2))}</pre>
              <pre class="aus-tab-content aus-dt-pre" data-content="msg-${h.timestamp}" style="display:none;">${esc(h.messages && (h as any).messages.length ? JSON.stringify(h.messages, null, 2) : '（原文已清理——仅最近 5 条保留，其余仅统计可用）')}</pre>
      </div>
    </div>
  `;
  }).join('') + pagerBottom;
  // 分页按钮：翻页只替换列表内容，不允许移动页面滚动位置
  const bindPager = (id: string) => {
    const b = doc.getElementById(id) as HTMLButtonElement | null;
    if (!b) return;
    b.onclick = () => {
      const totalPages = Math.max(1, Math.ceil(fullHist.length / HISTORY_PAGE_SIZE));
      const nextPage = historyPage + (id.includes('prev') ? -1 : 1);
      if (nextPage < 1 || nextPage > totalPages) return;
      historyPage = nextPage;
      keepMainScrollPosition(doc, () => renderHistoryInner(doc, fullHist));
    };
  };
  bindPager('aus-history-prev'); bindPager('aus-history-next'); bindPager('aus-history-prev-b'); bindPager('aus-history-next-b');
  host.querySelectorAll('.aus-detail-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ts = (btn as HTMLElement).getAttribute('data-ts');
      if (activeHistoryDetailBtn === btn && activeHistoryDetailPanel) { closeHistoryDetail(doc); return; }
      const panel = host.querySelector(`[data-detail="${ts}"]`) as HTMLElement | null;
      if (!panel) return;
      openHistoryDetail(doc, panel, btn as HTMLElement);
    });
  });
  host.querySelectorAll('.aus-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ts = (btn as HTMLElement).getAttribute('data-ts');
      const tab = (btn as HTMLElement).getAttribute('data-tab');
      const root = (btn as HTMLElement).closest('.aus-detail-panel') as HTMLElement | null;
      if (!root) return;
      // 选中态交给 CSS（[data-active="1"]），颜色过渡与内容淡入都由样式表负责
      root.querySelectorAll('.aus-tab-btn').forEach((b: any) => b.removeAttribute('data-active'));
      (btn as HTMLElement).setAttribute('data-active', '1');
      root.querySelectorAll('.aus-tab-content').forEach((c: any) => { c.style.display = 'none'; });
      const target = root.querySelector(`[data-content="${tab}-${ts}"]`) as HTMLElement | null;
      if (target) target.style.display = 'block';
    });
  });
  host.querySelectorAll('.aus-res-raw-btn').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      const ts = btn.getAttribute('data-ts');
      const root = btn.closest('.aus-detail-panel') as HTMLElement | null;
      const pre = root?.querySelector(`.aus-res-raw[data-ts="${ts}"]`) as HTMLElement | null;
      if (!pre) return;
      const show = pre.style.display === 'none';
      pre.style.display = show ? 'block' : 'none';
      btn.textContent = show ? '隐藏原始完整数据' : '查看原始完整数据';
    });
  });
  if (reopenDetailTs) {
    const panel = host.querySelector(`[data-detail="${reopenDetailTs}"]`) as HTMLElement | null;
    const btn = host.querySelector(`.aus-detail-toggle[data-ts="${reopenDetailTs}"]`) as HTMLElement | null;
    if (panel && btn) openHistoryDetail(doc, panel, btn as HTMLElement);
  }
}

function renderHistory(doc: Document, s: any) {
  const host = doc.getElementById('aus-history');
  if (!host) return;
  let hist: any[] = s.history || [];
  let scope = 'all';
  try {
    scope = (state.settings as any).historyScope || 'all';
    if (scope === 'current') hist = getHistoryForDisplay();
  } catch {}
  if (!hist.length) {
    historyPage = 1;
    historyFullCache = null;
    historyCacheScope = '';
    const tip = scope === 'current'
      ? '<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:var(--aus-fs-base);line-height:1.8;">当前对话暂无记录<br/><span style="font-size:var(--aus-fs-sm);">已按“当前对话”过滤，旧记录（未关联对话）仅在“全部历史”中可见</span><br/><button id="aus-history-scope-switch" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">切换为全部历史</button></div>'
      : '<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:var(--aus-fs-base);">暂无历史记录</div>';
    host.innerHTML = tip;
    const btn = doc.getElementById('aus-history-scope-switch') as HTMLButtonElement | null;
    if (btn) btn.onclick = () => {
      (state.settings as any).historyScope = 'all';
      try { (saveHot as any)({ settings: state.settings }); } catch {}
      historyPage = 1;
      try { refreshUI(); } catch {}
    };
    return;
  }
  // 页码越界/对话切换保护：scope 或 currentChatId 变化重置首页，避免跨对话页码错位
  let curChatId: string | null = null;
  try { curChatId = (globalThis as any).SillyTavern?.getContext?.()?.getCurrentChatId?.() || (globalThis as any).SillyTavern?.getContext?.().getCurrentChatId?.call?.(null) || null; } catch {}
  try { if (!curChatId) curChatId = (globalThis as any).SillyTavern?.getContext?.().getCurrentChatId?.() || null; } catch {}
  const scopeKey = scope === 'current' ? `current:${curChatId||''}` : 'all';
  if (historyCacheScope !== scopeKey) { historyPage = 1; historyCacheScope = scopeKey; historyFullCache = null; }
  // 同步先渲染：若已有全量缓存则直接用缓存分页，否则用热数据分页（30条），避免一次渲染2000条
  let fullForRender: any[] = hist;
  if (historyFullCache && historyFullCache.length > hist.length) fullForRender = historyFullCache;
  renderHistoryFilters(fullForRender);
  renderHistoryInner(doc, filteredHistoryForDisplay(fullForRender));
  // 异步加载全量（热+冷）以支持 2000 条翻页，加载后若更多数据则二次渲染；统计已用聚合 totals，不受此展示分页影响
  if (historyLoading) return;
  const needFull = hist.length >= HISTORY_PAGE_SIZE || historyFullCache !== null || fullForRender.length >= HISTORY_PAGE_SIZE;
  if (!needFull && hist.length < HISTORY_PAGE_SIZE) return;
  historyLoading = true;
  (async () => {
    try {
      const mod: any = await import('../store/persistence');
      if (!mod.getAllHistory) return;
      const all: any[] = await mod.getAllHistory();
      if (!all || !all.length) return;
      let full = all;
      try {
        if (scope === 'current' && curChatId) {
          full = all.filter((h:any)=> h.chatId === curChatId);
        }
      } catch {}
      if (full.length <= hist.length) return;
      historyFullCache = full;
      // 若当前页仍指向热数据页，需保持页码但更新总数；筛选栏与列表一起重绘，页面位置不许动
      keepMainScrollPosition(doc, () => {
        renderHistoryFilters(full);
        renderHistoryInner(doc, filteredHistoryForDisplay(full));
      });
    } catch {} finally { historyLoading = false; }
  })();
}

// 顶栏毛玻璃：内容从顶栏底部穿过，滚到顶部之外时才补一条分隔线。
// 只写 data-scrolled 属性，滚动回调走 rAF 节流，避免每帧重排/重绘模糊层。
function syncTopbarState(doc: Document): void {
  try {
    const main = doc.getElementById('aus-main') as HTMLElement | null;
    if (!main) return;
    const on = main.scrollTop > 4 ? '1' : '0';
    for (const id of ['aus-page-header', 'aus-mobile-header']) {
      const bar = doc.getElementById(id);
      if (bar && bar.getAttribute('data-scrolled') !== on) bar.setAttribute('data-scrolled', on);
    }
  } catch {}
}

function bindTopbarScroll(doc: Document): void {
  try {
    const main = doc.getElementById('aus-main') as HTMLElement | null;
    if (!main || main.getAttribute('data-topbar-bound') === '1') return;
    main.setAttribute('data-topbar-bound', '1');
    let raf = 0;
    main.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; syncTopbarState(doc); });
    }, { passive: true });
    syncTopbarState(doc);
  } catch {}
}

// 触屏按压反馈：触屏没有 hover，反馈只能靠 pointerdown 在同一帧打上 data-pressed，
// 松手时移除，CSS 侧 120ms 回弹。窄屏的底栏 tab、返回箭头与设置页二级入口都复用这一套。
function bindPressFeedback(doc: Document): void {
  try {
    const sel = '#aus-hamburger-btn, #aus-mobile-back, #aus-bottom-nav .aus-bottom-item, #aus-settings-entries .aus-settings-entry';
    doc.querySelectorAll(sel).forEach((el: any) => {
      const node = el as HTMLElement;
      if (node.getAttribute('data-press-bound') === '1') return;
      node.setAttribute('data-press-bound', '1');
      const press = (on: boolean) => {
        if (on) node.setAttribute('data-pressed', '1');
        else node.removeAttribute('data-pressed');
      };
      node.addEventListener('pointerdown', () => press(true), { passive: true });
      node.addEventListener('pointerup', () => press(false), { passive: true });
      node.addEventListener('pointercancel', () => press(false), { passive: true });
      node.addEventListener('pointerleave', () => press(false), { passive: true });
      // 键盘触发与旧内核兜底：保证点击结束后不残留按压态
      node.addEventListener('click', () => press(false));
      node.addEventListener('blur', () => press(false));
    });
  } catch {}
}

/**
 * 最近一次由 pointerup 接管处理的底栏点按时间戳。
 * 触屏上 click 有两个坑：滑动惯性期间浏览器把这一下点按当成「停止滚动」不再派发 click；
 * 手指在按下与抬起之间挪动几个像素，click 也会落到共同祖先上而不再命中 tab。
 * 因此底栏改为在 pointerup 里按「位移 + 时长」判定点按并直接切页，click 只作为键盘/读屏兜底。
 */
let lastBottomTapAt = 0;

/**
 * 底栏指示胶囊最近一次落位的 x / y（syncBottomNav 写入）。
 * 拖动起点直接从这两个数换算，不去解析 transform 字符串，省掉一个易碎的解析步骤。
 */
let bottomPillX = 0;
let bottomPillY = 0;

/**
 * 底栏点按 + 拖动选中胶囊接管（幂等）：整条底栏只绑一次，用事件委托覆盖内部所有 tab。
 * - 点按：pointerup 里按「位移 + 时长」判定后直接切页，click 只作键盘/读屏兜底；
 * - 拖动：按住选中灰底横向拖动，胶囊跟手移动并预览落点，松手用弹性曲线归位并切到最近的 tab
 *   （纵向为主的滑动不接管，仍然交给页面滚动）。
 */
function bindBottomNavTap(doc: Document): void {
  try {
    const bar = doc.getElementById('aus-bottom-nav') as HTMLElement | null;
    if (!bar || bar.getAttribute('data-tap-bound') === '1') return;
    bar.setAttribute('data-tap-bound', '1');
    // 位移超过 12px 视为滑动，不当作点按；按下超过 800ms 视为长按
    const TAP_SLOP = 12;
    const TAP_MAX_MS = 800;
    // 拖动锁定阈值：横向位移超过 6px 且明显偏横向就抓起胶囊（比点按阈值更松，轻轻一划就能拖）
    const DRAG_LOCK = 6;
    // 松手弹性归位时长，必须与 style.css 里 #aus-bottom-indicator.is-snapping 的过渡时长一致
    const SNAP_MS = 420;
    let item: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let moved = false;
    let pointerId: number | null = null;
    // 按下点是否落在选中胶囊上：只有从这里按下才允许拖胶囊（按在别的 tab 上一律当普通点按）
    let onPill = false;
    // —— 拖动状态：pill 非空即表示正在拖胶囊 ——
    let pill: HTMLElement | null = null;
    let pillW = BOTTOM_PILL_W;
    let trackW = 0;
    let baseX = 0;
    let slots: Array<{ el: HTMLElement; cx: number }> = [];
    let dropEl: HTMLElement | null = null;
    let snapTimer: any = null;
    const reset = () => { item = null; moved = false; pointerId = null; onPill = false; };

    /** 量一遍底栏与每个 tab 的中心：只在拖动开始与尺寸变化时做，拖动过程中不再触发布局 */
    const measure = (): boolean => {
      const barRect = bar.getBoundingClientRect();
      trackW = barRect.width;
      slots = [];
      bar.querySelectorAll('[data-bottom-nav]').forEach((el: any) => {
        const node = el as HTMLElement;
        const r = node.getBoundingClientRect();
        slots.push({ el: node, cx: r.left - barRect.left + r.width / 2 });
      });
      return !!(trackW && slots.length);
    };
    /** 落点预览：只给非当前 tab 打标记（当前 tab 本身就是选中态，不必再高亮） */
    const paintDrop = (next: HTMLElement | null) => {
      if (dropEl === next) return;
      const prev = dropEl;
      if (prev) prev.removeAttribute('data-pill-target');
      dropEl = next;
      const cur = dropEl;
      if (cur && !cur.classList.contains('active')) cur.setAttribute('data-pill-target', '1');
    };
    /**
     * 按下点是否落在选中胶囊上。胶囊自身是 pointer-events:none（好让点击穿透到 tab），
     * 所以只能按几何位置判断；留 4px 容差，手指按在边缘也能抓住。拿不到尺寸时判 false。
     */
    const hitPill = (x: number, y: number): boolean => {
      const ind = doc.getElementById('aus-bottom-indicator') as HTMLElement | null;
      if (!ind) return false;
      const r = ind.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const pad = 4;
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    };

    /** 胶囊 x 夹在底栏内，避免拖出边界 */
    const clampX = (x: number) => Math.max(0, Math.min(Math.max(0, trackW - pillW), x));
    const startDrag = (id: number): boolean => {
      // 底栏不在用（桌面 / 移动端兼容 UI 关闭）时不接管拖动
      if (!bottomNavActive(doc)) return false;
      pill = doc.getElementById('aus-bottom-indicator') as HTMLElement | null;
      if (!pill || !measure()) { pill = null; return false; }
      pillW = pill.offsetWidth || BOTTOM_PILL_W;
      baseX = bottomPillX;
      if (snapTimer) { clearTimeout(snapTimer); snapTimer = null; }
      pill.classList.remove('is-snapping');
      pill.classList.add('is-dragging');
      try { if (bar.setPointerCapture) bar.setPointerCapture(id); } catch {}
      return true;
    };
    const moveDrag = (clientX: number) => {
      if (!pill) return;
      const x = clampX(baseX + (clientX - startX));
      // 缩放写进同一个 transform：拖起来时轻微放大，跟手感更明显
      pill.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(bottomPillY) + 'px,0) scale(1.06)';
      const center = x + pillW / 2;
      let best: HTMLElement | null = null;
      let bestGap = Infinity;
      for (const slot of slots) {
        const gap = Math.abs(slot.cx - center);
        if (gap < bestGap) { bestGap = gap; best = slot.el; }
      }
      paintDrop(best);
    };
    const endDrag = (commit: boolean) => {
      const p = pill;
      const target = dropEl;
      pill = null;
      paintDrop(null);
      if (pointerId !== null) {
        try { if (bar.releasePointerCapture) bar.releasePointerCapture(pointerId); } catch {}
      }
      if (!p) return;
      p.classList.remove('is-dragging');
      const slot = target ? slots.find((s) => s.el === target) : undefined;
      // 弹性归位：落到目标 tab 的中心（没有目标就回原位），再交回默认过渡
      const x = clampX(slot ? slot.cx - pillW / 2 : baseX);
      p.classList.add('is-snapping');
      p.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(bottomPillY) + 'px,0)';
      bottomPillX = Math.round(x);
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        snapTimer = null;
        try { p.classList.remove('is-snapping'); } catch {}
      }, SNAP_MS + 40);
      // 松手即算一次「已处理的点按」，压掉随后可能补发的 click，避免二次切页
      lastBottomTapAt = Date.now();
      if (!commit || !slot) return;
      const v = slot.el.getAttribute('data-bottom-nav');
      // 拖到别的 tab 才切页；落回当前 tab 只归位，不触发「重复点 tab 回到顶部」
      if (v && !slot.el.classList.contains('active')) handleBottomTabTap(v as AppView);
    };

    bar.addEventListener('pointerdown', (e: any) => {
      if (e.pointerType === 'mouse' && e.button !== 0) { reset(); return; }
      const target = e.target as HTMLElement | null;
      const hit = target && target.closest ? (target.closest('.aus-bottom-item') as HTMLElement | null) : null;
      if (!hit) { reset(); return; }
      item = hit; startX = e.clientX; startY = e.clientY; startAt = Date.now(); moved = false;
      onPill = hitPill(e.clientX, e.clientY);
      pointerId = typeof e.pointerId === 'number' ? e.pointerId : null;
    }, { passive: true });
    bar.addEventListener('pointermove', (e: any) => {
      if (!item) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved = true;
      if (!pill) {
        // 必须是从胶囊上按下去的才拖；按在别的 tab 上横向划动什么都不做
        if (!onPill) return;
        // 纵向为主的滑动留给页面滚动，只有明显偏横向才接管成「拖胶囊」
        if (!(Math.abs(dx) > DRAG_LOCK && Math.abs(dx) > Math.abs(dy))) return;
        if (!startDrag(pointerId === null ? 0 : pointerId)) return;
      }
      moveDrag(e.clientX);
    }, { passive: true });
    bar.addEventListener('pointercancel', () => {
      if (pill) endDrag(false);
      reset();
    }, { passive: true });
    bar.addEventListener('pointerup', () => {
      if (pill) { endDrag(true); reset(); return; }
      const hit = item;
      const wasMoved = moved;
      const elapsed = Date.now() - startAt;
      reset();
      if (!hit || wasMoved || elapsed > TAP_MAX_MS) return;
      lastBottomTapAt = Date.now();
      const v = hit.getAttribute('data-bottom-nav');
      if (v) handleBottomTabTap(v as AppView);
    }, { passive: true });
  } catch {}
}

export function bindPanel(doc: Document) {
  const q = doc.getElementById('aus-btn-query-balance') as HTMLButtonElement | null;
  if (q) q.onclick = () => queryBalance();
  // 胶囊下拉的打开状态（箭头旋转 / 开合时长）统一由 pill.ts 跟随 DOM 变化标注
  try { initPillState(doc); } catch {}
  // 顶栏毛玻璃的滚动联动（幂等，重复调用只补一次监听）
  bindTopbarScroll(doc);
  // 移动端菜单按钮的按压反馈（幂等）
  bindPressFeedback(doc);
  // 底栏点按接管：滑动期间也能稳定响应（幂等）
  bindBottomNavTap(doc);
}

/** 「移动端兼容 UI」关闭时窄屏回到改造前的侧栏抽屉（含汉堡按钮与遮罩） */
let mobileOpen = false;
/** 由 createPanel 注入：切换「移动端兼容 UI」后立即按新布局重排导航 */
let applyMobileNavModeImpl: (() => void) | null = null;

/** 移动端兼容 UI 开关：true（默认）窄屏用底栏；false 回到改造前的侧栏抽屉 */
function mobileNavMode(): 'bottom' | 'sidebar' {
  try { return (state.settings as any).mobileCompatUi === false ? 'sidebar' : 'bottom'; } catch { return 'bottom'; }
}

/** 窄屏且开启底栏布局时才走底栏语义（指示胶囊 / 返回箭头 / 重复点 tab / 入场动画） */
function bottomNavActive(doc: Document): boolean {
  return isNarrowPanel(doc) && mobileNavMode() === 'bottom';
}

/** 设置页开关调用：把当前选择写到 #aus-panel[data-mobile-nav] 并重排导航，无需刷新页面 */
export function applyMobileNavMode(): void {
  try { applyMobileNavModeImpl?.(); } catch {}
}

/**
 * 面板当前是否按窄屏（底栏）布局渲染。
 * 用 #aus-panel-body 的实际宽度判定；面板未显示（clientWidth 为 0）时回退到窗口宽度。
 */
function isNarrowPanel(doc?: Document): boolean {
  try {
    const d = doc || getDoc();
    const body = d.getElementById('aus-panel-body') as HTMLElement | null;
    if (body && body.clientWidth > 0) return body.clientWidth <= 760;
    return ((window.parent as any)?.innerWidth ?? window.innerWidth) <= 760;
  } catch { return true; }
}

function prefersReducedMotion(): boolean {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

/**
 * 页面切换入场动画（桌面与窄屏共用，观感对齐遥测看板的 pageIn）。
 * 移除 class + 强制一次回流，保证连续切换（哪怕切回同一页）都能重新播放。
 * prefers-reduced-motion 由 style.css 的 `animation:none` 兜底，这里不做判断。
 */
function playViewEnter(el: HTMLElement | null): void {
  if (!el) return;
  try {
    el.classList.remove('aus-view-in');
    void el.offsetWidth;
    el.classList.add('aus-view-in');
  } catch {}
}

/**
 * 底栏指示胶囊的兜底尺寸：实际以 #aus-bottom-indicator 量到的 offsetWidth/Height 为准
 * （极短横屏会把胶囊压小），量不到时才回退这两个值，改动须与 style.css 同步。
 */
const BOTTOM_PILL_W = 64;
const BOTTOM_PILL_H = 48;

/**
 * 底栏布局下「先让胶囊起跑、再渲染目标页」。
 * 切换距离远时（概览 ↔ 设置）目标页要新建几十毫秒的 DOM，若和写 transform 落在同一个任务里，
 * 浏览器必须等这轮任务结束才做首次绘制——手感就是「点了先愣一下、胶囊才滑出去」，滑动途中还会被主线程抢帧。
 * 做法：第一帧只强制一次样式计算让过渡真正起跑（此时胶囊已是独立合成层，见 style.css 的 will-change），
 * 第二帧再渲染内容，只晚约 16ms，肉眼不可见。
 */
function renderAfterPillStart(doc: Document, run: () => void): void {
  const ind = doc.getElementById('aus-bottom-indicator') as HTMLElement | null;
  let done = false;
  const fire = (): void => {
    if (done) return;
    done = true;
    try { run(); } catch {}
  };
  const raf: (fn: () => void) => void = typeof requestAnimationFrame === 'function'
    ? (fn: () => void) => { requestAnimationFrame(fn); }
    : (fn: () => void) => { setTimeout(fn, 16); };
  raf(() => {
    // 第一帧只做一次样式计算：让 transform 过渡在本次绘制就起跑（画面此时已是胶囊的起点）
    try { if (ind) void ind.getBoundingClientRect(); } catch {}
    raf(fire);
  });
  // 页面切到后台时 rAF 会被暂停，兜底保证目标页最终一定渲染出来
  setTimeout(fire, 120);
}

/**
 * 底栏指示胶囊跟随当前 tab（切换动画的核心）。
 * 首次定位关掉过渡，避免面板一打开胶囊就从最左侧"飞过来"。
 */
function syncBottomNav(doc: Document, animate: boolean): void {
  try {
    const bar = doc.getElementById('aus-bottom-nav') as HTMLElement | null;
    if (!bar) return;
    let activeEl: HTMLElement | null = null;
    bar.querySelectorAll('[data-bottom-nav]').forEach((el: any) => {
      const on = el.getAttribute('data-bottom-nav') === currentNavKey;
      el.classList.toggle('active', on);
      if (on) activeEl = el as HTMLElement;
    });
    const ind = doc.getElementById('aus-bottom-indicator') as HTMLElement | null;
    if (!ind) return;
    const target = activeEl as HTMLElement | null;
    if (!target) { ind.style.opacity = '0'; return; }
    // 底栏在「移动端兼容 UI」关闭时整体隐藏（display:none），此时量不到位置，直接跳过
    if (!target.offsetWidth) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    // 胶囊对准整个 tab（图标 + 文字）的中心：只圈住图标会像个悬空的椭圆环，观感很怪
    const barRect = bar.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    if (!barRect.height || !itemRect.width) { ind.style.opacity = '0'; return; }
    const pillW = ind.offsetWidth || BOTTOM_PILL_W;
    const pillH = ind.offsetHeight || BOTTOM_PILL_H;
    const x = Math.round(itemRect.left - barRect.left + itemRect.width / 2 - pillW / 2);
    const y = Math.round(itemRect.top - barRect.top + itemRect.height / 2 - pillH / 2);
    // 记住落位：拖动起点从这里换算（见 bindBottomNavTap）
    bottomPillX = x;
    bottomPillY = y;
    const first = bar.getAttribute('data-ready') !== '1';
    const next = 'translate3d(' + x + 'px,' + y + 'px,0)';
    if (!animate || first) {
      const prev = ind.style.transition;
      ind.style.transition = 'none';
      ind.style.transform = next;
      void ind.offsetWidth;
      ind.style.transition = prev;
      bar.setAttribute('data-ready', '1');
    } else {
      ind.style.transform = next;
    }
  } catch {}
}

/**
 * 侧栏 / 底栏高亮 + 二级页返回箭头显隐：切页与窗口尺寸变化共用。
 * bottom=true 表示当前是底栏布局（窄屏 + 移动端兼容 UI 开启）：二级页的高亮归到「设置」并显示返回箭头；
 * bottom=false 是桌面侧栏或「移动端兼容 UI」关闭后的原侧栏抽屉，直接按当前视图高亮，也没有返回箭头。
 */
function paintNavState(doc: Document, bottom: boolean, animate: boolean): void {
  // 底栏布局：一律归父级 tab（设置二级页 → settings、对话展示管理 → overview）；
  // 桌面侧栏：设置二级页有自己的导航项（要高亮自身），对话展示管理没有导航项，归到父级「概览」。
  // 「对话展示管理」没有导航项：底栏高亮跟着进入前的来源页走（从设置进入就高亮「设置」）
  const navSource = currentView === 'chat-manage' ? chatManageOrigin : currentView;
  currentNavKey = bottom || !isSettingsChild(currentView) ? parentTabOf(navSource) : navSource;
  try {
    doc.querySelectorAll('#aus-sidebar [data-nav]').forEach((el: any) => {
      const v = el.getAttribute('data-nav');
      el.classList.toggle('active', v === currentNavKey);
    });
  } catch {}
  if (bottom) syncBottomNav(doc, animate);
  const backBtn = doc.getElementById('aus-mobile-back') as HTMLElement | null;
  if (backBtn) backBtn.style.display = bottom && isChildView(currentView) ? 'flex' : 'none';
}

/**
 * 底栏 tab 点击语义：
 * - 桌面端（底栏不显示）直接切页；
 * - 窄屏换 tab → 切页（回到「设置」时恢复上次的二级页）；
 * - 窄屏重复点当前 tab → 二级页回根页，已在根页则回到顶部。
 */
function handleBottomTabTap(target: AppView): void {
  const doc = getDoc();
  // 底栏不显示（桌面 / 移动端兼容 UI 关闭）时它就是普通切页
  if (!bottomNavActive(doc)) { switchView(target); return; }
  // 「对话展示管理」没有自己的 tab：归属要按进入前的来源页算（从趋势进 → 趋势、从设置进 → 设置），
  // 与 paintNavState 的底栏高亮保持同一口径；否则点「概览」会被误判成重复点当前 tab，只回上一页。
  const currentTab = currentView === 'chat-manage' ? parentTabOf(chatManageOrigin) : parentTabOf(currentView);
  const action = resolveTabTap(target, currentView, isChildView(currentView), currentTab);
  if (action === 'switch') {
    const to = target === 'settings' && settingsChildView ? settingsChildView : target;
    switchView(to);
    return;
  }
  // 二级页重复点当前 tab：回到自己的父级根页（设置二级页 → 设置、对话展示管理 → 概览）
  if (action === 'pop-root') { switchView(returnFromChild()); return; }
  try {
    const main = doc.getElementById('aus-main') as HTMLElement | null;
    if (main) main.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    const contentBody = doc.getElementById('aus-content-body') as HTMLElement | null;
    if (contentBody) contentBody.scrollTop = 0;
  } catch {}
}

/**
 * 侧栏抽屉显隐（仅「移动端兼容 UI」关闭时的窄屏：原侧栏抽屉 + 汉堡 + 遮罩，与改造前实现一致）。
 * 滑动/淡入淡出动画全部由 style.css 提供，这里只管 class 与遮罩可点性。
 */
function syncMobileSidebar(doc: Document): void {
  try {
    const sb = doc.getElementById('aus-sidebar') as HTMLElement | null;
    if (!sb) return;
    const ov = doc.getElementById('aus-sidebar-overlay') as HTMLElement | null;
    if (isNarrowPanel(doc) && mobileNavMode() === 'sidebar') {
      sb.classList.toggle('is-open', mobileOpen);
      if (ov) {
        ov.classList.toggle('is-open', mobileOpen);
        ov.style.display = '';
        ov.onclick = mobileOpen ? () => { mobileOpen = false; syncMobileSidebar(doc); } : null;
      }
      // 窄屏强制还原完整导航，避免宽屏折叠残留的 inline 隐藏
      const brand = doc.getElementById('aus-brand') as HTMLElement | null;
      if (brand) brand.style.removeProperty('display');
      doc.querySelectorAll('#aus-sidebar .aus-nav-label').forEach((el: any) => { (el as HTMLElement).style.removeProperty('display'); });
      doc.querySelectorAll('#aus-sidebar .aus-nav-item').forEach((el: any) => {
        const c = el as HTMLElement;
        c.style.removeProperty('justify-content');
        c.style.removeProperty('padding');
      });
      sb.style.removeProperty('width');
      sb.style.removeProperty('min-width');
      sb.style.removeProperty('max-width');
    } else {
      sb.classList.remove('is-open');
      if (ov) {
        ov.classList.remove('is-open');
        ov.style.display = 'none';
        ov.onclick = null;
      }
    }
  } catch {}
}

/** 二级页「返回」目标：对话展示管理回到进入前的来源页，其余回到自己的父级根页 */
function returnFromChild(): AppView {
  if (currentView === 'chat-manage') return chatManageOrigin;
  return childParentOf(currentView) ?? 'settings';
}

/** 进入对话展示管理页并记住来源（概览 / 趋势预测 / 设置三处入口共用） */
function openChatManage(from: AppView): void {
  chatManageOrigin = from;
  switchView('chat-manage');
}

function switchView(view: AppView, opts?: { track?: boolean; back?: boolean }) {
  const prevView = currentView;
  currentView = view;
  // 「设置」下的二级页记忆：点回设置 tab 时恢复到上次位置；主动切回设置根页（重复点 tab / 返回箭头）则清空
  if (isSettingsChild(view)) settingsChildView = view;
  else if (view === 'settings') settingsChildView = null;
  // 离开钱包页时收起所有已展开的钱包，下次进入保持默认收起
  if (prevView === 'wallet' && view !== 'wallet') {
    try { repository.collapseAllWallets(); } catch {}
  }
  // 匿名使用统计：页面使用率（仅本地累加，关闭面板时统一上报）
  // 只有「用户真的看到这个页面」才计数：构建面板时的初始化切换必须传 track:false，
  // 否则每次酒馆页面加载都会凭空记 1 次概览浏览并开始计时，上报后变成
  // 「opens=0 却有 1 次概览浏览 + 一段挂机时长」的稀疏记录（数据库里约六成 device_daily 行）。
  if (opts?.track !== false) { try { trackPage(view); } catch {} }
  const doc = getDoc();
  const bottom = bottomNavActive(doc);
  if (view !== 'history') closeHistoryDetail(doc);
  doc.querySelectorAll('[data-view]').forEach((el: any) => {
    const v = el.getAttribute('data-view');
    const on = v === view;
    el.style.display = on ? 'block' : 'none';
    // 瞬时切换：不再走"先透明再淡入"，避免点击后有一小段延迟感
    if (on) { el.style.transition = 'none'; el.style.opacity = '1'; }
    // 入场动画桌面与窄屏都播（原先只有底栏布局播，桌面是硬切）
    if (on && view !== prevView) playViewEnter(el as HTMLElement);
  });
  // 所有视图共用 #aus-main 作为滚动容器，切换页面时必须把滚动位置归零，
  // 否则会沿用上一页的 scrollTop，出现"切过去直接显示页面中部"的问题。
  try {
    for (const id of ['aus-main', 'aus-content-body']) {
      const scroller = doc.getElementById(id) as HTMLElement | null;
      if (!scroller) continue;
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    }
  } catch {}
  syncTopbarState(doc);
  // 侧栏/底栏高亮（底栏布局下二级页归到「设置」）+ 二级页返回箭头
  paintNavState(doc, bottom, bottom);
  const titleText = viewTitle(view);
  const titleEl = doc.getElementById('aus-page-title');
  const mobileTitleEl = doc.getElementById('aus-mobile-page-title');
  if (titleEl) titleEl.textContent = titleText;
  if (mobileTitleEl) mobileTitleEl.textContent = titleText;
  // 只渲染目标视图：原先每次点击都全量 refreshUI（历史/概览/统计/预测/钱包五页，其中两页要重建 ECharts），
  // 再叠加 60ms 定时器二次渲染，是点击卡顿与延迟的主要来源；数据变更仍由 refreshUI 统一刷新。
  const renderTargetView = () => {
    // 连点/快速切换时旧的延迟渲染作废，只渲染最后停留的那一页
    if (currentView !== view) return;
    try {
      if (view === 'overview') renderOverview();
      else if (view === 'stats') renderStatsView();
      else if (view === 'forecast') Promise.resolve(renderForecastView()).catch(() => {});
      else if (view === 'wallet') Promise.resolve(renderWalletView()).catch(() => {});
      else if (view === 'history') { const s = getSelectedSave(); if (s) renderHistory(doc, s); }
      else if (view === 'chat-manage') Promise.resolve(renderChatManageView()).catch(() => {});
    } catch {}
  };
  // 底栏布局下切到别的页时，先把指示胶囊送上轨道（原因见 renderAfterPillStart 注释）；
  // 桌面端同样不把「动画起跑」和「建 DOM / 建 ECharts」挤在同一个任务里——
  // 否则主线程被渲染占住，浏览器首次绘制时动画已推进到中段，看起来就是"内容直接出现"。
  const animateIn = view !== prevView;
  if (animateIn && bottom) renderAfterPillStart(doc, renderTargetView);
  else if (animateIn) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(renderTargetView);
    else renderTargetView();
  } else renderTargetView();
  // 图表容器宽度兜底：首次显示若尚未完成布局，下一帧补渲染一次（替代原先 60ms/80ms 定时器）
  if (view === 'stats' || view === 'forecast') {
    requestAnimationFrame(() => {
      try {
        const chartEl = doc.getElementById(view === 'stats' ? 'aus-stats-chart' : 'aus-forecast-main-chart');
        if (chartEl && (chartEl.clientWidth === 0 || chartEl.clientHeight === 0)) {
          if (view === 'stats') renderStatsView();
          else Promise.resolve(renderForecastView()).catch(() => {});
        }
      } catch {}
    });
  }
}

/**
 * 移动端浏览器的「浏览器工具栏」不占布局视口：Edge（安卓版把地址栏放底部）/ Chrome 的
 * 100vh 与 window.innerHeight 取的是「工具栏收起」的大视口，比真正可见的区域高出一个工具栏，
 * 于是面板底栏（position:absolute;bottom:0）正好落在工具栏背后——既看不见也点不到。
 * visualViewport.height 才是此刻真正可见的高度，面板按它收一下就能贴住可见底部。
 * 双指缩放（scale≠1）时不动，避免面板被反复裁切、内容重排。
 */
function visibleViewportHeight(): number | null {
  try {
    const vv = (getDoc().defaultView as any)?.visualViewport;
    if (!vv || !(vv.height > 0)) return null;
    const scale = typeof vv.scale === 'number' ? vv.scale : 1;
    if (Math.abs(scale - 1) > 0.01) return null;
    return vv.height;
  } catch { return null; }
}

/** 把 #aus-overlay / #aus-panel 的高度贴到当前可视视口（工具栏显隐、键盘弹出都会变） */
function syncViewportHeight() {
  const doc = getDoc();
  const h = visibleViewportHeight();
  const supportsDvh = (() => { try { return !!(window.CSS && CSS.supports && CSS.supports('height', '100dvh')); } catch { return false; } })();
  for (const id of ['aus-overlay', 'aus-panel']) {
    const node = doc.getElementById(id) as HTMLElement | null;
    if (!node) continue;
    // 拿不到可视视口（旧内核 / 缩放中）：退回整块视口高度，dvh 优先
    node.style.height = h == null ? (supportsDvh ? '100dvh' : '100vh') : `${Math.round(h)}px`;
  }
}

function positionPanel() {
  // 已改为 fixed，无需手动跟随滚动；保留空实现以兼容旧调用
  // 但浏览器工具栏（移动端底部地址栏）显隐会改可视视口高度，底栏必须始终贴在可见底部
  try { syncViewportHeight(); } catch {}
  try {
    const doc = getDoc();
    const charts: any[] = [];
    // 触发图表自适应（解决 resize 不重算）
    for (const id of ['aus-stats-chart','aus-chart-token','aus-chart-cost','aus-chart-hit','aus-chart-req','aus-chart-dur','aus-chart-pie','aus-chart-model-token','aus-chart-model-req','aus-forecast-main-chart','aus-forecast-hit-chart','aus-forecast-cost-chart']) {
      const el = doc.getElementById(id) as any;
      if (el && (el as any).__echarts_instance) try { (el as any).__echarts_instance.resize(); } catch {}
    }
  } catch {}
}

export function createPanel() {
  if (panelCreated) return;
  const doc = getDoc();
  if (doc.getElementById('aus-panel')) { panelCreated = true; return; }
  panelCreated = true;
  const theme = (state.settings as any).theme || 'light';
  const overlay = doc.createElement('div');
  overlay.id = 'aus-overlay';
  overlay.setAttribute('data-extension', 'api-usage-stat');
  overlay.setAttribute('data-ds-theme', theme);
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;background:var(--ds-overlay);z-index:100000;display:none;opacity:0;transition:opacity 0.2s;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
  const panel = doc.createElement('div');
  panel.id = 'aus-panel';
  panel.setAttribute('data-extension', 'api-usage-stat');
  panel.setAttribute('data-ds-theme', theme);
  // 窄屏布局二选一：bottom=底部标签栏（移动端兼容 UI 开启）/ sidebar=改造前的侧栏抽屉
  panel.setAttribute('data-mobile-nav', mobileNavMode());
  panel.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:100001;background:var(--ds-panel-bg);color:var(--ds-text);font-family:\'Microsoft YaHei\',\'微软雅黑\',system-ui,-apple-system,sans-serif;display:none;flex-direction:column;overflow:hidden;transform:none;filter:none;will-change:auto;';
  panel.innerHTML = `
    <div id="aus-mobile-header" style="display:none;height:56px;align-items:center;padding:0 16px;flex-shrink:0;">
      <button id="aus-hamburger-btn" title="菜单" style="display:none;width:28px;height:28px;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:var(--ds-text);padding:0;flex-shrink:0;">${icon('menu', 22)}</button>
      <button id="aus-mobile-back" title="返回" style="display:none;">${icon('chevron-left', 20)}</button>
      <span id="aus-mobile-brand" style="margin-left:12px;font-size:var(--aus-fs-base);font-weight:700;color:var(--ds-text);white-space:nowrap;flex-shrink:0;">API用量统计</span>
      <span id="aus-mobile-page-title" style="margin-left:10px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text-2);">用量概览</span>
      <button id="aus-mobile-panel-close" title="关闭" style="margin-left:auto;width:32px;height:32px;padding:0;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;font-size:var(--aus-fs-base);">${icon('close', 16)}</button>
    </div>
    <div id="aus-panel-body" style="flex:1;display:flex;flex-direction:row;overflow:hidden;min-height:0;">
    <div id="aus-sidebar" style="width:260px;flex-shrink:0;background:var(--ds-sidebar-bg);border-right:1px solid var(--ds-border);display:flex;flex-direction:column;overflow:hidden;">
      <div id="aus-brand-row" style="height:56px;display:flex;align-items:flex-start;justify-content:space-between;padding:0 14px;flex-shrink:0;">
        <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;margin-top:18px;" id="aus-brand">
          <span class="aus-brand-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--ds-orange);">${icon('brand', 18)}</span>
          <div style="display:flex;flex-direction:column;min-width:0;">
            <span style="font-size:15px;font-weight:700;line-height:20px;color:var(--ds-text);white-space:nowrap;">API用量统计</span>
            <span style="font-size:var(--aus-fs-sm);line-height:16px;color:var(--ds-text-2);white-space:nowrap;">v${appVersionText()}</span>
          </div>
        </div>
        <button id="aus-sidebar-toggle" style="width:30px;height:30px;margin-top:13px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;flex-shrink:0;font-size:var(--aus-fs-base);padding:0;line-height:1;">${icon('chevron-left', 14)}</button>
      </div>
      <div style="flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:4px;">
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:4px;">
          <div class="aus-nav-item active" data-nav="overview" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('overview')}</span><span class="aus-nav-label">用量概览</span></div>
          <div class="aus-nav-item" data-nav="stats" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('stats')}</span><span class="aus-nav-label">用量统计</span></div>
          <div class="aus-nav-item" data-nav="history" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('history')}</span><span class="aus-nav-label">历史记录</span></div>
          <div class="aus-nav-item" data-nav="forecast" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('forecast')}</span><span class="aus-nav-label">趋势预测</span></div>
          <div class="aus-nav-item" data-nav="wallet" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('wallet')}</span><span class="aus-nav-label">钱包</span></div>
        </div>
        <div style="flex:1;"></div>
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--ds-border);padding-top:10px;">
          <div class="aus-nav-item" data-nav="settings" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('settings')}</span><span class="aus-nav-label">设置</span></div>
          <div class="aus-nav-item" data-nav="help" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('help')}</span><span class="aus-nav-label">使用说明</span></div>
          <div class="aus-nav-item" data-nav="about" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon('about')}</span><span class="aus-nav-label">关于</span><span id="aus-nav-update-badge" data-update-badge="1" data-on="0" title="检测到新版本，点击查看关于页">新版本</span></div>
        </div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--ds-panel-bg);position:relative;">
      <div id="aus-page-header" style="flex-shrink:0;height:56px;display:flex;align-items:flex-start;justify-content:space-between;padding:0 20px;">
        <span id="aus-page-title" style="font-size:var(--aus-fs-base);font-weight:600;line-height:20px;margin-top:18px;color:var(--ds-text);">用量概览</span>
        <button id="aus-panel-close" style="width:32px;height:32px;margin-top:12px;padding:0;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;line-height:1;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;font-size:var(--aus-fs-base);">${icon('close', 16)}</button>
      </div>
      <div id="aus-content-body" style="flex:1;display:flex;flex-direction:row;overflow:hidden;min-height:0;position:relative;">
      <div id="aus-main" style="flex:1;min-width:0;overflow:auto;padding:20px;background:var(--ds-panel-bg);">
        <div style="max-width:1100px;margin:0 auto;display:grid;gap:16px;">
          <div data-view="overview">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="ds-card aus-overview-balance-card" style="position:relative;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div class="ds-card-title">充值余额</div><div id="aus-overview-wallet-btn" class="aus-pill aus-pill-sm"><span style="color:var(--ds-text-2);">余额口径</span><span id="aus-overview-wallet-label" style="font-weight:600;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部钱包合计</span>${icon('chevron-down', 14)}</div><div id="aus-overview-wallet-dropdown" style="display:none;position:absolute;top:44px;right:10px;z-index:20;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:190px;max-height:260px;overflow:auto;"></div></div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div id="aus-balance-remaining" style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;min-height:16px;"></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:var(--aus-fs-sm);">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">导出记录</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">导入记录</button></div></div>
              <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.0000<small>CNY</small></div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:2px;" id="aus-total-tokens">0 tokens</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div class="ds-card" id="aus-overview-history"></div>
              <div class="ds-card" id="aus-overview-spend"></div>
            </div>
            <div id="aus-overview-four" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;"></div>
            <div id="aus-heatmap-card-overview" class="ds-card" style="margin-top:12px;width:100%;max-width:100%;overflow:hidden;box-sizing:border-box;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">Token 使用量热力图</div>
                <div id="aus-heatmap-legend-overview" style="display:flex;align-items:center;gap:3px;font-size:var(--aus-fs-sm);color:var(--ds-text-3);"></div>
              </div>
              <div style="display:flex;gap:0;overflow:hidden;max-width:100%;box-sizing:border-box;">
                <div id="aus-heatmap-labels-overview" style="flex-shrink:0;padding:4px 0"></div>
                <div id="aus-heatmap-scroll-overview" style="overflow-x:auto;overflow-y:hidden;flex:1;min-width:0;max-width:100%;padding:4px 0;cursor:grab;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;">
                  <div id="aus-heatmap-container-overview" style="display:inline-block;min-width:max-content;"></div>
                </div>
              </div>
              <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;display:flex;justify-content:space-between;">
                <span>按日聚合 Token（深绿=高用量，展示近 2 年）</span>
                <span style="color:var(--ds-text-2);">悬停查看日期</span>
              </div>
            </div>
            <div id="aus-chat-summary-overview" class="ds-card" style="margin-top:12px;overflow:auto;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">按对话统计</div>
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <span id="aus-chat-manage-count" style="display:none;font-size:var(--aus-fs-xs);color:var(--ds-text-3);white-space:nowrap;"></span>
                  <button id="aus-chat-manage-btn" type="button" class="aus-manage-chat-btn" title="设置哪些对话出现在按对话统计表与各页「对话」下拉中（不影响数据统计）">${icon('menu', 14)}管理对话</button>
                </div>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:var(--aus-fs-sm);white-space:nowrap;min-width:720px;">
                <thead><tr style="color:var(--ds-text-2);border-bottom:1px solid var(--ds-border);text-align:right;"><th style="text-align:left;padding:6px 8px;">对话</th><th data-sort-key="count" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">轮次<span class="aus-sort-ind"></span></th><th data-sort-key="hit" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">命中<span class="aus-sort-ind"></span></th><th data-sort-key="miss" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">未命中<span class="aus-sort-ind"></span></th><th data-sort-key="out" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输出<span class="aus-sort-ind"></span></th><th data-sort-key="total" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总 Tokens<span class="aus-sort-ind"></span></th><th data-sort-key="cost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总费用<span class="aus-sort-ind"></span></th><th data-sort-key="avgTokens" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均 Token/轮<span class="aus-sort-ind"></span></th><th data-sort-key="avgHitRate" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均命中率<span class="aus-sort-ind"></span></th></tr></thead>
                <tbody id="aus-chat-summary-tbody"><tr><td colspan="9" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr></tbody>
              </table>
              <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;">默认按总 Tokens 倒序，点击表头可切换排序 · 数据来源为全部历史（不受统计页筛选影响）· 点「管理对话」可隐藏不常看的对话</div>
            </div>
            </div>
           <div data-view="chat-manage" style="display:none;">
             <div id="aus-chat-manage-body"></div>
           </div>
           <div data-view="stats" style="display:none;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:relative;flex-wrap:wrap;">
              <div class="aus-stats-filter">
                <div id="aus-range-btn" class="aus-pill"><span style="color:var(--ds-text-2);">时间维度</span><span id="aus-range-label" style="font-weight:600;color:var(--ds-text);">近 30 天</span>${icon('chevron-down', 14)}</div>
                <div id="aus-range-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);overflow:hidden;flex-direction:row;">
                  <div style="min-width:120px;border-right:1px solid var(--ds-card);padding:8px;display:grid;gap:2px;">
                    <div data-range="all" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">全部</div>
                    <div data-range="today" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">今天</div>
                    <div data-range="yesterday" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">昨天</div>
                    <div data-range="7d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">近 7 天</div>
                    <div data-range="30d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">近 30 天</div>
                    <div data-range="month" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">本月</div>
                    <div data-range="lastMonth" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">上月</div>
                    <div data-range="custom" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">自定义</div>
                  </div>
                  <div id="aus-date-calendar" style="padding:12px;display:none;"></div>
                </div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-model-btn" class="aus-pill"><span style="color:var(--ds-text-2);">模型</span><span id="aus-model-label" style="font-weight:600;color:var(--ds-text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-model-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-chat-btn" class="aus-pill"><span style="color:var(--ds-text-2);">对话</span><span id="aus-chat-label" style="font-weight:600;color:var(--ds-text);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-chat-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-endpoint-btn" class="aus-pill"><span style="color:var(--ds-text-2);">接入类型</span><span id="aus-endpoint-label" style="font-weight:600;color:var(--ds-text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-endpoint-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-credential-btn" class="aus-pill"><span style="color:var(--ds-text-2);">API 密钥</span><span id="aus-credential-label" style="font-weight:600;color:var(--ds-text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-credential-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div id="aus-stats-filter-reset" class="aus-filter-reset" title="重置筛选" aria-label="重置筛选" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:transparent;color:var(--ds-text-2);font-size:var(--aus-fs-base);cursor:pointer;margin-left:auto;">${icon('refresh', 14)}<span>重置筛选</span></div>
            </div>
            <div id="aus-stats-three" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
              <div class="ds-card"><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">消费金额</div><div id="aus-stats-cost" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">¥0.00 CNY</div></div>
              <div class="ds-card"><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">API 请求次数</div><div id="aus-stats-req" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
              <div class="ds-card"><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">Tokens</div><div id="aus-stats-tok" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
            </div>
            <div id="aus-stats-four" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;"></div>
            <div id="aus-model-summary" class="ds-card" style="margin-top:12px;overflow:auto;">
              <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);margin-bottom:8px;">模型汇总</div>
              <table style="width:100%;border-collapse:collapse;font-size:var(--aus-fs-sm);white-space:nowrap;">
                <thead><tr style="color:var(--ds-text-2);border-bottom:1px solid var(--ds-border);text-align:right;"><th style="text-align:left;padding:6px 8px;">模型</th><th data-sort-key="count" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">调用次数<span class="aus-sort-ind"></span></th><th data-sort-key="hit" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(命中)<span class="aus-sort-ind"></span></th><th data-sort-key="miss" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(未命中)<span class="aus-sort-ind"></span></th><th data-sort-key="out" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输出<span class="aus-sort-ind"></span></th><th data-sort-key="total" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总 Tokens<span class="aus-sort-ind"></span></th><th data-sort-key="cost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgCost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgDur" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均耗时<span class="aus-sort-ind"></span></th><th data-sort-key="avgRate" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均速率<span class="aus-sort-ind"></span></th></tr></thead>
                <tbody id="aus-summary-tbody"><tr><td colspan="10" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr></tbody>
              </table>
            </div>
            <div style="margin-top:12px;">
              ${chartCardHTML({ title: '自定义图表', chartId: 'aus-stats-chart', height: 300, pills: [
                { key: 'Y', btnId: 'aus-chart-y-btn', labelId: 'aus-chart-y-label', dropId: 'aus-chart-y-dropdown', label: '5 项' },
                { key: 'X', btnId: 'aus-chart-x-btn', labelId: 'aus-chart-x-label', dropId: 'aus-chart-x-dropdown', label: '轮次' },
              ] })}
            </div>
            <div id="aus-extra-charts" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;">
              ${chartCardHTML({ title: 'Token 趋势', chartId: 'aus-chart-token', pills: [
                { key: 'Y', btnId: 'aus-extra-y-btn-token', labelId: 'aus-extra-y-label-token', dropId: 'aus-extra-y-drop-token', label: '3 项' },
                { key: 'X', btnId: 'aus-extra-x-btn-token', labelId: 'aus-extra-x-label-token', dropId: 'aus-extra-x-drop-token', label: '轮次' },
              ] })}
              ${chartCardHTML({ title: '费用 趋势', chartId: 'aus-chart-cost', pills: [
                { key: 'Y', btnId: 'aus-extra-y-btn-cost', labelId: 'aus-extra-y-label-cost', dropId: 'aus-extra-y-drop-cost', label: '1 项' },
                { key: 'X', btnId: 'aus-extra-x-btn-cost', labelId: 'aus-extra-x-label-cost', dropId: 'aus-extra-x-drop-cost', label: '轮次' },
              ] })}
              ${chartCardHTML({ title: '缓存命中 趋势', chartId: 'aus-chart-hit', pills: [
                { key: 'X', btnId: 'aus-extra-x-btn-hit', labelId: 'aus-extra-x-label-hit', dropId: 'aus-extra-x-drop-hit', label: '轮次' },
              ] })}
              ${chartCardHTML({ title: 'API请求数 趋势', chartId: 'aus-chart-req', pills: [
                { key: 'X', btnId: 'aus-extra-x-btn-req', labelId: 'aus-extra-x-label-req', dropId: 'aus-extra-x-drop-req', label: '每日' },
              ] })}
              ${chartCardHTML({ title: '耗时与速率 趋势', chartId: 'aus-chart-dur', pills: [
                { key: 'X', btnId: 'aus-extra-x-btn-dur', labelId: 'aus-extra-x-label-dur', dropId: 'aus-extra-x-drop-dur', label: '轮次' },
              ] })}
              ${chartCardHTML({ title: '模型用量占比', chartId: 'aus-chart-pie', pills: [
                { key: '口径', btnId: 'aus-pie-toggle', labelId: 'aus-pie-toggle-val', dropId: '', label: 'Token', dropdown: false },
              ] })}
            </div>
            <div id="aus-model-trends" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;">
              ${chartCardHTML({ title: '模型 Token 趋势', chartId: 'aus-chart-model-token', pills: [
                { key: 'X', btnId: 'aus-modeltrends-x-btn-token', labelId: 'aus-modeltrends-x-label-token', dropId: 'aus-modeltrends-x-drop-token', label: '每日' },
              ] })}
              ${chartCardHTML({ title: '模型调用次数趋势', chartId: 'aus-chart-model-req', pills: [
                { key: 'X', btnId: 'aus-modeltrends-x-btn-req', labelId: 'aus-modeltrends-x-label-req', dropId: 'aus-modeltrends-x-drop-req', label: '每日' },
              ] })}
            </div>
          </div>
          <div data-view="forecast" style="display:none;">
            <div id="aus-forecast-root" class="aus-forecast-root">
              <div class="aus-forecast-toolbar">
                <div class="aus-forecast-toolbar-main">
                  <div class="aus-forecast-picker">
                    <div id="aus-forecast-chat-btn" class="aus-forecast-pill" title="选择要预测的对话">
                      <span class="aus-forecast-pill-label">对话</span><span id="aus-forecast-chat-label" class="aus-forecast-pill-value">当前对话</span>${icon('chevron-down', 14)}
                    </div>
                    <div id="aus-forecast-chat-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                  <div id="aus-forecast-model-wrap" class="aus-forecast-picker" style="display:none;">
                    <div id="aus-forecast-model-btn" class="aus-forecast-pill" title="选择计价模型">
                      <span class="aus-forecast-pill-label">计价模型</span><span id="aus-forecast-model-label" class="aus-forecast-pill-value">—</span>${icon('chevron-down', 14)}
                    </div>
                    <div id="aus-forecast-model-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                  <div class="aus-forecast-picker">
                    <div id="aus-forecast-horizon-btn" class="aus-forecast-pill" title="选择未来预测轮数">
                      <span class="aus-forecast-pill-label">视界</span><span id="aus-forecast-horizon-label" class="aus-forecast-pill-value">10 轮</span>${icon('chevron-down', 14)}
                    </div>
                    <div id="aus-forecast-horizon-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                  <div id="aus-forecast-hit-control" class="aus-forecast-hit-control"></div>
                  <label class="aus-forecast-toggle">
                    <input id="aus-forecast-compaction-toggle" type="checkbox" checked>
                    <span class="aus-forecast-checkbox" aria-hidden="true"></span>
                    <span id="aus-forecast-compaction-label">压缩情景</span>
                  </label>
                  <button id="aus-forecast-chat-manage-btn" type="button" class="aus-manage-chat-btn" title="设置哪些对话出现在「对话」下拉中（不影响数据统计）">${icon('menu', 14)}管理对话</button>
                </div>
                <div id="aus-forecast-sub" class="aus-forecast-sub"></div>
              </div>
              <div id="aus-forecast-kpis" class="aus-forecast-kpis"></div>
              <div class="ds-card aus-forecast-chart-card">
                <div class="aus-forecast-card-head">
                  <div>
                    <div class="aus-forecast-card-title">轮次趋势与预测</div>
                    <div id="aus-forecast-main-sub" class="aus-forecast-card-sub"></div>
                  </div>
                </div>
                <div id="aus-forecast-main-chart" class="aus-forecast-chart" style="height:300px;"></div>
              </div>
              <div class="aus-forecast-chart-grid">
                <div class="ds-card aus-forecast-chart-card">
                  <div class="aus-forecast-card-title">缓存命中率趋势</div>
                  <div id="aus-forecast-hit-chart" class="aus-forecast-chart" style="height:220px;"></div>
                </div>
                <div class="ds-card aus-forecast-chart-card">
                  <div class="aus-forecast-card-title">累计成本趋势</div>
                  <div id="aus-forecast-cost-chart" class="aus-forecast-chart" style="height:220px;"></div>
                </div>
              </div>
              <div class="aus-forecast-two-col">
                <div class="ds-card">
                  <div class="aus-forecast-card-title">对话健康</div>
                  <div id="aus-forecast-health"></div>
                </div>
                <div class="ds-card">
                  <div class="aus-forecast-card-title">上下文压缩</div>
                  <div id="aus-forecast-compaction"></div>
                </div>
              </div>
              <div class="ds-card" id="aus-forecast-efficiency-card">
                <div class="aus-forecast-card-head">
                  <div>
                    <div class="aus-forecast-card-title">模型效率对比</div>
                    <div id="aus-forecast-efficiency-sub" class="aus-forecast-card-sub"></div>
                  </div>
                  <div class="aus-forecast-picker">
                    <div id="aus-forecast-scope-btn" class="aus-forecast-pill">
                      <span class="aus-forecast-pill-label">范围</span><span class="aus-forecast-pill-value">全部历史</span>${icon('chevron-down', 14)}
                    </div>
                    <div id="aus-forecast-scope-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                </div>
                <div id="aus-forecast-efficiency"></div>
              </div>
              <div class="ds-card">
                <button id="aus-forecast-top-toggle" class="aus-forecast-top-toggle" type="button">▸ 最耗对话 Top</button>
                <div id="aus-forecast-top" style="display:none;"></div>
              </div>
            </div>
          </div>
          <div data-view="wallet" style="display:none;">
            <div id="aus-wallet"></div>
          </div>
          <div data-view="history" style="display:none;">
            <div id="aus-history-filter-host" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:relative;flex-wrap:wrap;">
              <div class="aus-stats-filter">
                <div id="aus-history-model-btn" class="aus-pill"><span style="color:var(--ds-text-2);">模型</span><span id="aus-history-model-label" style="font-weight:600;color:var(--ds-text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-history-model-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-history-chat-btn" class="aus-pill"><span style="color:var(--ds-text-2);">对话</span><span id="aus-history-chat-label" style="font-weight:600;color:var(--ds-text);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-history-chat-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-history-endpoint-btn" class="aus-pill"><span style="color:var(--ds-text-2);">接入类型</span><span id="aus-history-endpoint-label" style="font-weight:600;color:var(--ds-text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-history-endpoint-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-history-credential-btn" class="aus-pill"><span style="color:var(--ds-text-2);">API 密钥</span><span id="aus-history-credential-label" style="font-weight:600;color:var(--ds-text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon('chevron-down', 14)}</div>
                <div id="aus-history-credential-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div id="aus-history-filter-reset" class="aus-filter-reset" title="重置筛选" aria-label="重置筛选" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:transparent;color:var(--ds-text-2);font-size:var(--aus-fs-base);cursor:pointer;margin-left:auto;">${icon('refresh', 14)}<span>重置筛选</span></div>
            </div>
            <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">全屏</button></div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
            <div id="aus-history"></div>
          </div>
          <div data-view="settings" style="display:none;">
            <div id="aus-settings-entries" style="display:none;grid-template-columns:1fr;gap:8px;margin-bottom:12px;">${SETTINGS_ENTRIES.map((e) => {
              // 「关于」入口带上当前版本号：桌面端入口在侧栏、版本显示在品牌区，这里补上窄屏设置页的版本信息
              const version = e.view === 'about' && appVersionText() ? '<span class="aus-settings-entry-version" title="当前版本">v' + appVersionText() + '</span>' : '';
              return `
              <div class="aus-settings-entry" data-settings-entry="${e.view}" role="button" tabindex="0">
                <span class="aus-settings-entry-icon">${icon(e.icon, 20)}</span>
                <span class="aus-settings-entry-text">
                  <span class="aus-settings-entry-label">${e.label}${version}</span>
                  <span class="aus-settings-entry-desc">${e.desc}</span>
                </span>
                ${e.view === 'about' ? '<span class="aus-entry-badge" data-update-badge="1" data-on="0">新版本</span>' : ''}
                <span class="aus-settings-entry-arrow">${icon('chevron-right', 16)}</span>
              </div>`;
            }).join('')}
            </div>
            <div id="aus-settings"></div>
          </div>
          <div data-view="help" style="display:none;">${helpViewHTML()}</div>
          <div data-view="about" style="display:none;">
            <div style="display:grid;gap:12px;">
              <div class="ds-card" style="line-height:1.7;font-size:var(--aus-fs-base);color:var(--ds-text);">
                <div style="font-size:var(--aus-fs-base);font-weight:600;">关于<br/>API用量统计</div>
                <div style="margin-top:8px;color:var(--ds-text-2);">致力于实现最全面的用量可视化统计<br/><br/>仓库：<a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:var(--ds-text);">janmk1453/Api-Usage</a></div>
              </div>
              <div class="ds-card" style="display:grid;gap:8px;">
                <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">检查更新</div>
                <div id="aus-update-banner" style="display:none;padding:8px 10px;border-radius:8px;background:var(--ds-yellow-bg);border:1px solid var(--ds-yellow-border);font-size:var(--aus-fs-sm);color:var(--ds-text);"></div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <div style="position:relative;z-index:5;">
                    <button id="aus-update-branch-btn" class="ds-btn-pill" style="padding:6px 14px;font-size:var(--aus-fs-sm);">更新分支：<span id="aus-update-branch-label">main</span></button>
                    <div id="aus-update-branch-dropdown" style="display:none;position:absolute;top:calc(100% + 6px);left:0;min-width:150px;padding:6px;background:var(--ds-bg);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:60;flex-direction:column;gap:4px;">
                      <div data-update-branch="main" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);">main（稳定）</div>
                      <div data-update-branch="dev" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);">dev（测试）</div>
                    </div>
                  </div>
                  <button id="aus-check-update" class="ds-btn-pill" style="padding:6px 14px;font-size:var(--aus-fs-sm);">检查更新</button>
                  <button id="aus-run-update" class="ds-btn-pill" style="display:none;padding:6px 14px;font-size:var(--aus-fs-sm);">立即更新</button>
                  <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">当前 v${appVersionText()} · 每 1 小时自动检查</span>
                </div>
                <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">可选择 main（稳定）或 dev（测试）分支获取更新，默认 main；更新完成后自动刷新网页。</div>
              </div>
              ${renderChangelogCard()}
            </div>
          </div>
        </div>
      </div>
      <aside id="aus-history-detail" style="display:none;">
        <div id="aus-history-detail-head">
          <span id="aus-history-detail-grip" aria-hidden="true"></span>
          <div id="aus-history-detail-heading">
            <span id="aus-history-detail-title">记录详情</span>
            <span id="aus-history-detail-sub"></span>
          </div>
          <button id="aus-history-detail-close" title="关闭" aria-label="关闭详情">${icon('close', 16)}</button>
        </div>
        <div id="aus-history-detail-body"></div>
      </aside>
    </div>
    </div>
    </div>
    <div id="aus-bottom-nav" style="display:none;">
      <div id="aus-bottom-indicator" aria-hidden="true"></div>
      ${MOBILE_TABS.map((t) => `
        <div class="aus-bottom-item" data-bottom-nav="${t.view}" role="tab" title="${t.label}">
          <span class="aus-bottom-icon">${icon(t.icon, 22)}</span>
          <span class="aus-bottom-label">${t.label}</span>
          ${t.view === 'settings' ? '<span class="aus-bottom-badge" data-update-badge="1" data-on="0" title="检测到新版本，去「设置 → 关于」查看">新版本</span>' : ''}
        </div>`).join('')}
    </div>
  `;
  // 侧栏抽屉遮罩：仅「移动端兼容 UI」关闭 + 窄屏时出现，点遮罩关闭抽屉
  const sbOverlay = doc.createElement('div');
  sbOverlay.id = 'aus-sidebar-overlay';
  sbOverlay.style.cssText = 'display:none;';
  panel.appendChild(sbOverlay);
  doc.body.appendChild(overlay);
  doc.body.appendChild(panel);
  // 面板可能晚于更新检查创建：挂载后按当前（含持久化）更新状态同步徽标 + 横幅 + 「立即更新」按钮
  try { import('../services/update').then((mod: any) => mod.syncUpdateIndicators?.()); } catch {}
  try { applyTheme(theme); } catch {}
  try {
    const p = (window.parent as any) || window;
    p.addEventListener('resize', positionPanel, { passive: true } as any);
  } catch {}
  doc.getElementById('aus-panel-close')?.addEventListener('click', closePanel);
  doc.getElementById('aus-mobile-panel-close')?.addEventListener('click', closePanel);
  doc.getElementById('aus-history-detail-close')?.addEventListener('click', () => closeHistoryDetail(doc));
  // 侧栏（仅桌面显示）：直接切页，不做底栏的重复点语义
  doc.querySelectorAll('#aus-sidebar [data-nav]').forEach((el: any) => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-nav');
      if (v) switchView(v as AppView);
      // 原侧栏抽屉：窄屏点完导航自动收起（底栏布局下本就不会进这里）
      if (mobileOpen) { mobileOpen = false; syncMobileSidebar(doc); }
    });
  });
  // 底栏（仅窄屏显示）：走 tab 语义（换页 / 二级页回根 / 回顶部）
  doc.querySelectorAll('#aus-bottom-nav [data-bottom-nav]').forEach((el: any) => {
    el.addEventListener('click', () => {
      // 触屏点按已由 bindBottomNavTap 在 pointerup 处理，这里只服务键盘与读屏点击
      if (Date.now() - lastBottomTapAt < 600) return;
      const v = el.getAttribute('data-bottom-nav');
      if (v) handleBottomTabTap(v as AppView);
    });
  });
  // 设置页内的二级入口：钱包 / 使用说明 / 关于
  doc.querySelectorAll('#aus-settings-entries [data-settings-entry]').forEach((el: any) => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-settings-entry');
      if (v) switchView(v as AppView);
    });
    el.addEventListener('keydown', (e: any) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const v = el.getAttribute('data-settings-entry');
      if (v) switchView(v as AppView);
    });
  });
  // 窄屏二级页顶栏返回箭头：回到「设置」根页
  // 窄屏二级页顶栏返回箭头：回到当前二级页自己的父级（设置二级页 → 设置、对话展示管理 → 概览）
  doc.getElementById('aus-mobile-back')?.addEventListener('click', () => switchView(returnFromChild()));
  // 三处入口都进同一个「对话展示管理」页：概览表格标题右侧、趋势预测工具栏、设置页「对话展示」设置项
  // （设置页内容在 renderSettings 里生成，这里用委托绑定，避免依赖渲染顺序）
  doc.getElementById('aus-chat-manage-btn')?.addEventListener('click', () => openChatManage('overview'));
  doc.getElementById('aus-forecast-chat-manage-btn')?.addEventListener('click', () => openChatManage('forecast'));
  doc.getElementById('aus-panel')?.addEventListener('click', (e: any) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('#aus-settings-chat-manage')) openChatManage('settings');
  });
  // 页内「返回」按钮：回到进入前的来源页
  initChatManageView({ go: () => switchView(chatManageOrigin) });
  const applyCollapsed = (v: boolean) => {
    collapsed = v;
    const sb = doc.getElementById('aus-sidebar') as HTMLElement | null;
    const brand = doc.getElementById('aus-brand') as HTMLElement | null;
    const btn = doc.getElementById('aus-sidebar-toggle') as HTMLElement | null;
    if (!sb) return;
    // 窄屏：底栏布局下侧栏整体隐藏；兼容 UI 关闭时由抽屉开关（mobileOpen）控制显隐，都不做折叠
    if (isNarrowPanel(doc)) { if (mobileNavMode() === 'sidebar') syncMobileSidebar(doc); return; }
    // 折叠态隐藏「有新版本」徽标（60px 侧栏放不下），展开后按真实状态恢复
    sb.setAttribute('data-collapsed', collapsed ? '1' : '0');
    // 宽屏：保留 60/260 折叠
    sb.style.setProperty('width', collapsed ? '60px' : '260px', 'important');
    sb.style.setProperty('min-width', collapsed ? '60px' : '260px', 'important');
    sb.style.setProperty('max-width', collapsed ? '60px' : '260px', 'important');
    if (brand) brand.style.setProperty('display', collapsed ? 'none' : 'flex', 'important');
    if (btn) btn.innerHTML = collapsed ? icon('chevron-right', 14) : icon('chevron-left', 14);
    doc.querySelectorAll('#aus-sidebar .aus-nav-label').forEach((el: any) => { (el as HTMLElement).style.setProperty('display', collapsed ? 'none' : 'inline', 'important'); });
    doc.querySelectorAll('#aus-sidebar .aus-nav-item').forEach((el: any) => { (el as HTMLElement).style.justifyContent = collapsed ? 'center' : 'flex-start'; });
    doc.querySelectorAll('#aus-sidebar .aus-nav-item').forEach((el: any) => {
      (el as HTMLElement).style.padding = collapsed ? '10px 0' : '10px 12px';
    });
  };
  doc.getElementById('aus-sidebar-toggle')?.addEventListener('click', () => applyCollapsed(!collapsed));
  // 原侧栏抽屉：左上角菜单按钮开合
  doc.getElementById('aus-hamburger-btn')?.addEventListener('click', () => {
    mobileOpen = !mobileOpen;
    syncMobileSidebar(doc);
  });
  /**
   * 把「移动端兼容 UI」开关状态写到 #aus-panel[data-mobile-nav]（CSS 靠这个属性二选一），
   * 并立刻按新布局重排：关掉抽屉、必要时恢复宽屏折叠、重算底栏高亮与返回箭头。
   */
  const applyMobileNavModeLocal = () => {
    const pn = doc.getElementById('aus-panel') as HTMLElement | null;
    if (pn) pn.setAttribute('data-mobile-nav', mobileNavMode());
    mobileOpen = false;
    syncMobileSidebar(doc);
    if (!isNarrowPanel(doc)) applyCollapsed(collapsed);
    paintNavState(doc, bottomNavActive(doc), false);
  };
  applyMobileNavModeImpl = applyMobileNavModeLocal;
  applyMobileNavModeLocal();
  try {
    let rzT: any = null;
    const onResize = () => {
      if (rzT) return;
      rzT = setTimeout(() => {
        rzT = null;
        const narrow = isNarrowPanel(doc);
        if (!narrow) {
          mobileOpen = false;
          syncMobileSidebar(doc);
          applyCollapsed(collapsed);
        } else {
          syncMobileSidebar(doc);
        }
        // 底栏在尺寸变化后需重新量位置（宽度变了 tab 中线也变了），不播动画
        paintNavState(doc, bottomNavActive(doc), false);
        try { positionPanel(); } catch {}
      }, 150);
    };
    (window.parent as any)?.addEventListener('resize', onResize);
    window.addEventListener('resize', onResize);
  } catch {}
  try {
    // 移动端 Edge/Chrome 底部地址栏、虚拟键盘的显隐只发 visualViewport 事件、不发 window.resize，
    // 不听就会让底栏继续躺在工具栏背后。rAF 合并同一帧的多次触发，落地后再量一次底栏胶囊位置。
    const vv: any = (window as any).visualViewport;
    let vvRaf: any = null;
    const onViewportChange = () => {
      try { syncViewportHeight(); } catch {}
      if (vvRaf) return;
      const raf = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn: any) => setTimeout(fn, 16));
      vvRaf = raf(() => {
        vvRaf = null;
        try { syncViewportHeight(); } catch {}
        try { paintNavState(doc, bottomNavActive(doc), false); } catch {}
        try { positionPanel(); } catch {}
      });
    };
    vv?.addEventListener?.('resize', onViewportChange, { passive: true } as any);
    vv?.addEventListener?.('scroll', onViewportChange, { passive: true } as any);
  } catch {}
  bindPanel(doc);
  bindHistoryFilters(doc);
  bindImportExport(doc);
  renderSettings(doc);
  bindHistoryCompare();
  bindChangelog(doc);
  initStatsView();
  initExtraCharts();
  try { initForecastView(); } catch {}
  // 关于页检查更新按钮
  try {
    // 更新分支胶囊下拉，默认 main
    import('../services/update').then(m => {
      const branchBtn = doc.getElementById('aus-update-branch-btn') as HTMLButtonElement | null;
      const branchLabel = doc.getElementById('aus-update-branch-label') as HTMLElement | null;
      const branchDrop = doc.getElementById('aus-update-branch-dropdown') as HTMLElement | null;
      if (!branchBtn || !branchLabel || !branchDrop) return;
      const renderBranch = () => {
        const branch = m.getUpdateBranch();
        branchLabel.textContent = branch;
        branchDrop.querySelectorAll('[data-update-branch]').forEach((el: any) => {
          const active = el.getAttribute('data-update-branch') === branch;
          el.style.background = active ? 'var(--ds-card)' : 'transparent';
          el.style.fontWeight = active ? '600' : '400';
        });
      };
      renderBranch();
      branchBtn.onclick = (e) => {
        e.stopPropagation();
        branchDrop.style.display = branchDrop.style.display === 'flex' ? 'none' : 'flex';
      };
      branchDrop.querySelectorAll('[data-update-branch]').forEach((el: any) => {
        el.onclick = () => {
          const branch = el.getAttribute('data-update-branch');
          if (branch !== 'main' && branch !== 'dev') return;
          m.setUpdateBranch(branch);
          renderBranch();
          closeDropdownInstant(branchDrop);
          m.checkUpdate(true);
        };
      });
      doc.addEventListener('click', (ev: any) => {
        const drop = doc.getElementById('aus-update-branch-dropdown') as HTMLElement | null;
        if (!drop) return;
        if (!ev?.target?.closest?.('#aus-update-branch-dropdown') && !ev?.target?.closest?.('#aus-update-branch-btn')) {
          drop.style.display = 'none';
        }
      });
    }).catch(() => {});
    const updBtn = doc.getElementById('aus-check-update') as HTMLButtonElement | null;
    if (updBtn) {
      updBtn.onclick = () => {
        updBtn.textContent = '检查中…';
        updBtn.setAttribute('disabled', '');
        import('../services/update').then(m => m.checkUpdate(true).finally(() => {
          updBtn.textContent = '检查更新';
          updBtn.removeAttribute('disabled');
        }));
      };
    }
    const runUpdBtn = doc.getElementById('aus-run-update') as HTMLButtonElement | null;
    if (runUpdBtn) {
      runUpdBtn.onclick = () => {
        if (runUpdBtn.hasAttribute('disabled')) return;
        runUpdBtn.textContent = '更新中…';
        runUpdBtn.setAttribute('disabled', '');
        import('../services/update').then(m => m.updateSelf()).then(res => {
          if (res.ok && res.changed) {
            const bannerEl = doc.getElementById('aus-update-banner') as HTMLElement | null;
            if (bannerEl) {
              bannerEl.style.display = 'block';
              bannerEl.style.background = 'var(--ds-green-bg)';
              bannerEl.style.borderColor = 'var(--ds-green)';
              bannerEl.textContent = `已更新到 ${res.branch} 分支，正在刷新页面…`;
            }
            runUpdBtn.textContent = '即将刷新…';
            setTimeout(() => {
              try {
                (window.parent as any)?.location?.reload?.();
              } catch {
                try { location.reload(); } catch {}
              }
            }, 1500);
            return;
          }
          runUpdBtn.textContent = '立即更新';
          runUpdBtn.removeAttribute('disabled');
          if (res.ok && !res.changed) {
            const bannerEl = doc.getElementById('aus-update-banner') as HTMLElement | null;
            if (bannerEl) {
              bannerEl.style.display = 'block';
              bannerEl.style.background = 'var(--ds-green-bg)';
              bannerEl.style.borderColor = 'var(--ds-green)';
              bannerEl.textContent = `已是最新版本（${res.branch}），无需更新` + (res.commit ? '（' + res.commit + '）' : '');
            }
            runUpdBtn.style.display = 'none';
          }
        }).catch(() => {
          runUpdBtn.textContent = '立即更新';
          runUpdBtn.removeAttribute('disabled');
        });
      };
    }
  } catch {}
  // 仅初始化界面状态，不算一次浏览（用户还没打开面板）；真实浏览在 openPanel 里记。
  switchView('overview', { track: false });
  refreshUI();
}

/* ── 返回键接管 ─────────────────────────────────────────────────────────
 * 面板是覆盖全屏的浮层，移动端按系统返回键（安卓物理返回、浏览器后退手势）
 * 默认会直接退出酒馆页面。这里的做法很简单：窄屏打开面板时，往酒馆当前记录
 * 之上压**一条**哨兵记录，用户按一次系统返回就把面板关掉、留在酒馆页面上——
 * 按一次就回，不再「先退浮层 → 再退一级页面 → 才关面板」地逐层后退。
 *
 * 三条硬约束（都是真机日志换来的，别再改回去）：
 *   ① **popstate 处理里绝不碰历史**：不 pushState、不 go、不 replaceState。安卓侧滑
 *      手势触发的后退会被浏览器的「历史操纵干预」处理——页面在事件里插入的记录会被
 *      忽略，用户下一次手势就直接跳过哨兵退进旧文档，表现为整页重载（就是「退出酒馆」）；
 *   ② 哨兵只压一条（BACK_GUARD_DEPTH = 1）：一条就够隔开那一次返回；压得越多，
 *      关面板后留在历史里的空记录越多，用户回上一页要多按好几次；
 *   ③ 压哨兵前先把当前记录洗成干净基线（清掉上次会话残留的哨兵标记），否则刷新后
 *      历史里那片旧标记会让判定失真。
 * 点右上角关闭按钮（不是按返回）关面板时，照已知深度把那条哨兵退回去，
 * 免得「关掉面板后按返回第一下没反应」。
 * 桌面端不接管，保持「后退 = 回上一页」的原生语义。
 * ------------------------------------------------------------------- */
const NARROW_VIEWPORT_MAX = 760;

let backGuardPushed = false;
let backGuardWin: any = null;

/** 历史记录属于宿主窗口（扩展通常跑在 iframe 里），跨源时回退到自身窗口 */
function backGuardHost(): any {
  try {
    const w: any = window.parent;
    if (w && w !== window && w.history) return w;
  } catch {}
  return window;
}

/**
 * 是否该接管返回键：窄屏（手机竖屏 / 小窗）或本身就是移动设备
 * （平板横屏、折叠屏展开后宽度会超过 760，但返回键行为与手机一致）。
 */
function isNarrowViewport(): boolean {
  try {
    const w = backGuardHost();
    const width = Number(w?.innerWidth || window.innerWidth || 0);
    if (width > 0 && width <= NARROW_VIEWPORT_MAX) return true;
    return mobileDeviceHint();
  } catch {
    return false;
  }
}

/** 关掉面板内最上面的一层浮层（展开的胶囊下拉 / 历史详情窗口），关掉了返回 true */
function closeTopOverlay(): boolean {
  const doc = getDoc();
  try {
    const open = Array.from(doc.querySelectorAll('[data-aus-drop-open="1"]')) as HTMLElement[];
    if (open.length) {
      // 同一时刻一般只有一个下拉是展开的，这里一并收掉
      for (const el of open) closeDropdownInstant(el);
      return true;
    }
  } catch {}
  if (activeHistoryDetailTs !== null) {
    try { closeHistoryDetail(doc); return true; } catch {}
  }
  return false;
}

/**
 * 打开面板时压入唯一一条哨兵：把「系统返回」从「退出酒馆」改成「关掉面板」。
 * 桌面端不接管，保持「后退 = 回上一页」的原生语义。
 */
function armBackGuard(): void {
  if (backGuardPushed) return;
  if (!isNarrowViewport()) { backDebug('arm-skip-wide'); return; }
  const w = backGuardHost();
  try {
    if (!w?.history?.pushState) return;
    backGuardWin = w;
    backGuardPushed = true;
    w.addEventListener('popstate', onBackGuardPop);
    // 基线先洗干净：上次会话留下的哨兵标记不该继续挂在酒馆那条记录上
    const base = stripGuardState(w.history.state);
    if (base) w.history.replaceState(base, '');
    w.history.pushState(nextGuardState(base ?? w.history.state, BACK_GUARD_DEPTH), '');
    backDebug('arm', { depth: BACK_GUARD_DEPTH, len: w.history.length });
  } catch (e) {
    backDebug('arm-error', { msg: String(e) });
    backGuardPushed = false;
    backGuardWin = null;
  }
}

/**
 * 系统返回：直接把面板关掉，回到酒馆页面。
 * 这里**不做任何历史操作**（约束①）——用户这一下已经退回酒馆那条记录了，
 * 剩下的收尾只是关 DOM，历史一动就可能在下次手势里被吃掉。
 */
function onBackGuardPop(ev: any): void {
  backDebug('pop-enter', { evDepth: readGuardDepth(ev?.state), open: panelOpen });
  if (!panelOpen) { releaseBackGuard(false); return; }
  const w = backGuardWin;
  backGuardWin = null;
  backGuardPushed = false;
  if (w) { try { w.removeEventListener('popstate', onBackGuardPop); } catch {} }
  backDebug('pop-close-panel');
  // 展开的下拉 / 历史详情跟着面板一起收掉，下次打开是干净的
  try { closeTopOverlay(); } catch {}
  try { closePanel(); } catch {}
}

/**
 * 解除接管。
 * stepBack=true（点关闭按钮 / 按 Esc）时把还压在上面的那条哨兵退回去，
 * 否则它会留在历史里，让「关掉面板后按返回」第一下什么都不发生；
 * 由返回键触发时传 false——那时用户这一下已经退到酒馆记录上了，绝不能再去 go。
 */
function releaseBackGuard(stepBack = true): void {
  const w = backGuardWin;
  const pushed = backGuardPushed;
  backGuardWin = null;
  backGuardPushed = false;
  backDebug('release', { stepBack, pushed });
  if (!w) return;
  try { w.removeEventListener('popstate', onBackGuardPop); } catch {}
  if (!stepBack || !pushed) return;
  let depth = 0;
  try { depth = readGuardDepth(w.history?.state); } catch {}
  if (depth <= 0) return;
  // 只退一条、退到酒馆记录就停手；挪到下一轮再动，别和用户的点击抢同一个任务
  setTimeout(() => {
    // 期间用户可能已经自己按了返回：那时指针已退回酒馆记录，再 go 就多退一步
    let left = 0;
    try { left = readGuardDepth(w.history?.state); } catch {}
    if (left <= 0) return;
    try { w.history.go(-left); } catch {}
  }, 250);
}

export function resetPanelState() {
  panelCreated = false;
  panelOpen = false;
  // 扩展被禁用/重载时面板 DOM 已被移除，等于关闭面板：把压入的历史记录一并弹掉
  try { releaseBackGuard(); } catch {}
}

export function openPanel() {
  const doc = getDoc();
  panelOpenStartTs = nowTs();
  try { trackOpen(); } catch {}
  let ov = doc.getElementById('aus-overlay') as HTMLElement | null;
  let pn = doc.getElementById('aus-panel') as HTMLElement | null;
  if (!ov || !pn) {
    createPanel();
    ov = doc.getElementById('aus-overlay') as HTMLElement | null;
    pn = doc.getElementById('aus-panel') as HTMLElement | null;
    if (!ov || !pn) return;
  }
  // 打开面板 = 一次落地页浏览：只在真正打开时记（面板构建时的初始化切换已跳过计数）
  try { trackPage(currentView); } catch {}
  ov.style.display = 'block';
  pn.style.display = 'flex';
  // 面板刚显示，此时才能量到底栏 tab 的真实位置：按当前兼容 UI 开关摆好导航，不播动画
  try { applyMobileNavModeImpl?.(); } catch {}
  positionPanel();
  requestAnimationFrame(() => {
    ov.style.opacity = '1';
    positionPanel();
    try { if (panelOpenStartTs) trackRender(nowTs() - panelOpenStartTs); } catch {}
  });
  panelOpen = true;
  backDebug('open-panel');
  try { armBackGuard(); } catch {}
  refreshUI();
  // Agent 模式用量对账（无 TauriTavern 时该模块立即返回，不产生任何 IPC）
  try { import('../services/agent-usage/collector').then(m => m.reconcileOnPanelOpen()).catch(() => {}); } catch {}
  // 先按持久化状态回填徽标/横幅（刷新后不再丢失），再按 1 小时节流做一次自动检查
  try {
    import('../services/update').then(m => {
      m.syncUpdateIndicators?.();
      m.maybeAutoCheck();
    });
  } catch {}
}
export function closePanel() {
  const doc = getDoc();
  const ov = doc.getElementById('aus-overlay') as HTMLElement | null;
  const pn = doc.getElementById('aus-panel') as HTMLElement | null;
  if (ov) { ov.style.opacity = '0'; setTimeout(() => { ov.style.display = 'none'; }, 200); }
  if (pn) pn.style.display = 'none';
  // 收起原侧栏抽屉，下次打开从关闭态开始
  mobileOpen = false;
  syncMobileSidebar(doc);
  panelOpen = false;
  backDebug('close-panel');
  // 关闭时把为返回键压入的那条哨兵退回去，避免下次返回多退一步
  try { releaseBackGuard(); } catch {}
  // 匿名使用统计：关闭面板时合并上报本次会话数据
  try { flushTelemetry('close'); } catch {}
}
export function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }
