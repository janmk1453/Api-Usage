/**
 * 对话展示管理页（`data-view="chat-manage"`）。
 *
 * 入口三处，都进同一个页面：概览「按对话统计」标题右侧、趋势预测页顶部、
 * 设置页的「对话展示」设置项。页面本身是扁平同级视图，不挂在任何导航 tab 下，
 * 底栏布局下由 `nav-model.ts#CHILD_PARENT` 归到「概览」tab（底栏高亮与顶栏返回
 * 都回到进入前的来源页，来源由 `panel.ts` 记录并注入 `initChatManageView`）。
 *
 * 页面管两件事，两套独立的隐藏集合（`chat-visibility.ts`）：
 * - 「表格展示」：该对话是否出现在概览「按对话统计」表里；
 * - 「下拉选项」：该对话是否出现在统计页/历史页/趋势预测页的「对话」下拉胶囊里。
 * 两者都只改展示，不删数据、不参与任何统计口径——热力图、统计、历史、趋势预测、
 * 能耗评分依旧按全量历史计算，与用户要求「不影响数据统计展示」一致。
 */
import { state } from '../store/index';
import { repository } from '../data/repository';
import { computeChatStats, type ChatSummaryRow } from '../data/computed';
import { esc } from '../utils/date';
import { formatMoney } from '../services/currency';
import { switchHTML } from './switch';
import { icon } from './icons';
import {
  chatVisibilityKey,
  clearHiddenFor,
  isHiddenFor,
  setAllHiddenFor,
  setHiddenFor,
  type ChatVisibilityTarget,
} from './chat-visibility';
import { paintChatManageBadge } from './chat-summary-table';

type Navigator = { go: () => void };

let navigator: Navigator | null = null;
/** 切页导航回调由 panel.ts 注册（避免 chat-manage 反向 import panel 造成循环依赖） */
export function initChatManageView(opts: Navigator): void {
  navigator = opts;
}

function getDoc(): Document { return (window.parent as any)?.document ?? document; }

/** 搜索关键词（只在本页内过滤显示，不进存储） */
let keyword = '';
/** 最近一次聚合结果，供搜索、模式切换与重绘复用 */
let rows: ChatSummaryRow[] = [];
/** 当前管理模式：表格展示 / 下拉选项（只在本次会话内记忆） */
let mode: ChatVisibilityTarget = 'table';
/** 渲染令牌：热数据先画、冷数据补全，快速切页时丢弃过期结果 */
let renderToken = 0;

const MODES: Array<{ key: ChatVisibilityTarget; label: string; title: string; desc: string }> = [
  {
    key: 'table',
    label: '表格展示',
    title: '控制哪些对话出现在概览「按对话统计」表格',
    desc: '只控制「按对话统计」表格里是否列出该对话：隐藏不会删除任何数据，热力图、用量统计、历史记录与趋势预测仍按全部历史计算。',
  },
  {
    key: 'picker',
    label: '下拉选项',
    title: '控制哪些对话出现在各页「对话」下拉胶囊',
    desc: '只控制统计页、历史页与趋势预测页的「对话」下拉胶囊里是否列出该对话：隐藏不会删除任何数据，各页统计口径不变。',
  },
];

function modeInfo(): { key: ChatVisibilityTarget; label: string; title: string; desc: string } {
  return MODES.find((m) => m.key === mode) || MODES[0];
}

function shellHTML(): string {
  // 模板只写结构：布局、内距、收缩规则全部放 style.css，避免内联宽度在窄屏撑宽整页。
  const info = modeInfo();
  return [
    '<div id="aus-chat-manage-head">',
    '<div class="aus-chat-manage-lead">',
    '<div class="aus-chat-manage-title">对话展示管理</div>',
    '<div class="aus-chat-manage-desc" id="aus-chat-manage-desc">' + esc(info.desc) + '</div>',
    '</div>',
    '<div id="aus-chat-manage-tools">',
    '<input id="aus-chat-manage-search" type="text" placeholder="搜索对话" value="' + esc(keyword) + '" />',
    '<button id="aus-chat-manage-reset" type="button" class="aus-chat-manage-btn">全部显示</button>',
    '<button id="aus-chat-manage-hide-all" type="button" class="aus-chat-manage-btn">全部隐藏</button>',
    '<button id="aus-chat-manage-back" type="button" class="aus-chat-manage-btn" title="回到进入本页之前的页面">' + icon('chevron-left', 14) + '返回</button>',
    '</div>',
    '</div>',
    '<div id="aus-chat-manage-modes" data-mode="' + mode + '" role="tablist" aria-label="管理模式">',
    '<span class="aus-chat-manage-mode-thumb" aria-hidden="true"></span>',
    MODES.map((m) => '<button type="button" class="aus-chat-manage-mode" role="tab" data-manage-mode="' + m.key + '" data-active="' + (m.key === mode ? '1' : '0') + '" aria-selected="' + (m.key === mode ? 'true' : 'false') + '" title="' + esc(m.title) + '">' + esc(m.label) + '</button>').join(''),
    '</div>',
    '<div class="ds-card aus-chat-manage-card">',
    '<div id="aus-chat-manage-list"></div>',
    '</div>',
    '<div id="aus-chat-manage-foot"></div>',
  ].join('');
}

function rowHTML(row: ChatSummaryRow, index: number): string {
  const key = chatVisibilityKey(row.chatId);
  const hidden = isHiddenFor(mode, key);
  let costTxt = '¥' + row.cost.toFixed(4);
  try { costTxt = formatMoney(row.cost, 4); } catch {}
  const meta = row.count + ' 轮 · ' + row.total.toLocaleString('zh-CN') + ' tokens · ' + costTxt;
  const aria = row.displayName + '：' + (mode === 'picker' ? '在「对话」下拉胶囊中展示' : '在按对话统计中展示');
  return [
    '<div class="aus-chat-manage-row" data-chat-row="' + esc(key) + '" data-chat-name="' + esc(row.displayName.toLowerCase()) + '" data-hidden="' + (hidden ? '1' : '0') + '">',
    '<div class="aus-chat-manage-main">',
    '<div class="aus-chat-manage-name" title="' + esc(row.chatId || row.displayName) + '">' + esc(row.displayName) + '</div>',
    '<div class="aus-chat-manage-meta">' + meta + '</div>',
    '</div>',
    '<span class="aus-chat-manage-state" data-state>' + (hidden ? '已隐藏' : '展示中') + '</span>',
    switchHTML('aus-chat-sw-' + index, { checked: !hidden, ariaLabel: aria }),
    '</div>',
  ].join('');
}

function applyKeywordFilter(doc: Document): void {
  const list = doc.getElementById('aus-chat-manage-list');
  if (!list) return;
  const kw = keyword.trim().toLowerCase();
  list.querySelectorAll('[data-chat-row]').forEach((el: any) => {
    const name = el.getAttribute('data-chat-name') || '';
    el.style.display = !kw || name.includes(kw) ? '' : 'none';
  });
}

function paintFoot(doc: Document): void {
  const foot = doc.getElementById('aus-chat-manage-foot');
  if (!foot) return;
  const total = rows.length;
  const hidden = rows.filter((r) => isHiddenFor(mode, chatVisibilityKey(r.chatId))).length;
  const where = mode === 'picker' ? '「对话」下拉胶囊' : '「按对话统计」表';
  foot.textContent = total
    ? '共 ' + total + ' 个对话 · 已隐藏 ' + hidden + ' 个' + (hidden ? '（隐藏项不会出现在' + where + '中）' : '')
    : '暂无对话数据';
}

/** 重画列表（数据、模式或显隐变更后调用） */
function paintList(doc: Document): void {
  const list = doc.getElementById('aus-chat-manage-list');
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = '<div style="padding:20px 16px;text-align:center;color:var(--ds-text-3);font-size:var(--aus-fs-sm);">暂无可管理的对话，产生用量记录后即可在此设置</div>';
    paintFoot(doc);
    return;
  }
  list.innerHTML = rows.map((row, i) => rowHTML(row, i)).join('');
  applyKeywordFilter(doc);
  paintFoot(doc);
  try { paintChatManageBadge(doc); } catch {}
}

/**
 * 滑块定位：按当前选中按钮的实测几何写入 position/size（与底栏指示胶囊同一套思路）。
 * 不假设两项等宽、也不写死 50%，改文案、换字号、改内距都不会错位；首次定位关过渡，避免从左侧飞过来。
 */
function paintModeThumb(doc: Document): void {
  const wrap = doc.getElementById('aus-chat-manage-modes') as HTMLElement | null;
  if (!wrap) return;
  const btn = wrap.querySelector('[data-manage-mode="' + mode + '"]') as HTMLElement | null;
  const thumb = wrap.querySelector('.aus-chat-manage-mode-thumb') as HTMLElement | null;
  if (!btn || !thumb) return;
  const wr = wrap.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  // 页面还没显示（display:none）时量不到尺寸，等下次渲染再定位
  if (!wr.width || !br.width) { thumb.style.opacity = '0'; return; }
  thumb.style.opacity = '1';
  thumb.style.width = Math.round(br.width) + 'px';
  thumb.style.height = Math.round(br.height) + 'px';
  const next = 'translate3d(' + Math.round(br.left - wr.left) + 'px,' + Math.round(br.top - wr.top) + 'px,0)';
  const first = wrap.getAttribute('data-ready') !== '1';
  if (first) {
    const prev = thumb.style.transition;
    thumb.style.transition = 'none';
    thumb.style.transform = next;
    void thumb.offsetWidth;
    thumb.style.transition = prev;
    wrap.setAttribute('data-ready', '1');
  } else {
    thumb.style.transform = next;
  }
}

/** 窗口尺寸变化（含窄屏断点切换内距）后重新贴合；同一容器只绑一次 */
function bindModeThumbResize(doc: Document): void {
  const wrap = doc.getElementById('aus-chat-manage-modes') as HTMLElement | null;
  if (!wrap || wrap.getAttribute('data-thumb-resize') === '1') return;
  wrap.setAttribute('data-thumb-resize', '1');
  try {
    (doc.defaultView as any)?.addEventListener('resize', () => {
      try { paintModeThumb(doc); } catch {}
    });
  } catch {}
}

/** 切换管理模式：重画描述、滑块与其选中态，再重画整张列表 */
function paintMode(doc: Document): void {
  const desc = doc.getElementById('aus-chat-manage-desc');
  if (desc) desc.textContent = modeInfo().desc;
  const wrap = doc.getElementById('aus-chat-manage-modes');
  if (wrap) wrap.setAttribute('data-mode', mode);
  doc.querySelectorAll('[data-manage-mode]').forEach((el: any) => {
    const on = el.getAttribute('data-manage-mode') === mode;
    el.setAttribute('data-active', on ? '1' : '0');
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  try { paintModeThumb(doc); } catch {}
  paintList(doc);
}

/** 绑定 shell 内的按钮与列表事件（幂等：只在首次构建 shell 时绑定一次） */
function bindShell(doc: Document): void {
  const list = doc.getElementById('aus-chat-manage-list');
  list?.addEventListener('change', (e: any) => {
    const input = e.target as HTMLInputElement;
    if (!input || input.type !== 'checkbox') return;
    const rowEl = input.closest('[data-chat-row]') as HTMLElement | null;
    const key = rowEl?.getAttribute('data-chat-row') || '';
    if (!key) return;
    setHiddenFor(mode, key, !input.checked);
    if (rowEl) {
      rowEl.setAttribute('data-hidden', input.checked ? '0' : '1');
      const stateEl = rowEl.querySelector('[data-state]') as HTMLElement | null;
      if (stateEl) stateEl.textContent = input.checked ? '展示中' : '已隐藏';
    }
    paintFoot(doc);
    try { paintChatManageBadge(doc); } catch {}
  });
  // 点行内空白也切换（触屏与鼠标都好用）；点开关本身走 label 原生行为，不重复处理
  list?.addEventListener('click', (e: any) => {
    const target = e.target as HTMLElement;
    if (!target || target.closest('label.aus-switch')) return;
    const rowEl = target.closest('[data-chat-row]') as HTMLElement | null;
    if (!rowEl) return;
    const input = rowEl.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (!input) return;
    input.checked = !input.checked;
    input.dispatchEvent(new (doc.defaultView as any).Event('change', { bubbles: true }));
  });
  const search = doc.getElementById('aus-chat-manage-search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    keyword = search.value || '';
    applyKeywordFilter(doc);
  });
  doc.getElementById('aus-chat-manage-reset')?.addEventListener('click', () => {
    clearHiddenFor(mode);
    paintList(doc);
  });
  doc.getElementById('aus-chat-manage-hide-all')?.addEventListener('click', () => {
    setAllHiddenFor(mode, rows.map((row) => chatVisibilityKey(row.chatId)), true);
    paintList(doc);
  });
  doc.getElementById('aus-chat-manage-back')?.addEventListener('click', () => {
    try { navigator?.go(); } catch {}
  });
  doc.querySelectorAll('[data-manage-mode]').forEach((el: any) => {
    el.addEventListener('click', () => {
      const next = el.getAttribute('data-manage-mode') as ChatVisibilityTarget;
      if (next !== 'table' && next !== 'picker') return;
      if (next === mode) return;
      mode = next;
      paintMode(doc);
    });
  });
}

/**
 * 渲染管理页：先用热数据（最近 50 条）立即出图，再异步用冷存储全量补全，
 * 避免打开页面时空白等待 IndexedDB（与概览「按对话统计」同一套补全思路）。
 */
export async function renderChatManageView(): Promise<void> {
  const doc = getDoc();
  const host = doc.getElementById('aus-chat-manage-body');
  if (!host) return;
  if (!host.firstChild) {
    host.innerHTML = shellHTML();
    try { bindShell(doc); } catch {}
    try { bindModeThumbResize(doc); } catch {}
    try { paintModeThumb(doc); } catch {}
  } else {
    paintMode(doc);
  }
  const token = ++renderToken;
  const hot = (state.history || []) as any[];
  rows = computeChatStats(hot);
  paintList(doc);
  try {
    const all = await repository.getAllHistory();
    if (token !== renderToken) return;
    if (!all || !all.length || all.length <= hot.length) return;
    rows = computeChatStats(all);
    paintList(doc);
  } catch {}
}
