/**
 * 概览 → 「按对话统计」表格的对话展示管理页（`data-view="chat-manage"`）。
 *
 * 入口只有一处：概览表格标题右侧的「管理对话」胶囊按钮。页面本身是扁平同级视图，
 * 不挂在任何导航 tab 下（桌面侧栏没有它的条目），底栏布局下由
 * `nav-model.ts#CHILD_PARENT` 把它归到「概览」tab，因此底栏仍高亮概览、
 * 顶栏出现返回箭头并回到概览。
 *
 * 这里只改「该对话在按对话统计表里是否出现」这一件事：
 * 勾掉只是写进 localStorage 的隐藏列表（`chat-visibility.ts`），
 * 既不删数据，也不参与任何统计口径——热力图、统计、历史、趋势预测、
 * 能耗评分依旧按全量历史计算，与用户要求「不影响其余地方的数据统计和展示」一致。
 */
import { state } from '../store/index';
import { repository } from '../data/repository';
import { computeChatStats, type ChatSummaryRow } from '../data/computed';
import { esc } from '../utils/date';
import { formatMoney } from '../services/currency';
import { switchHTML } from './switch';
import { chatVisibilityKey, clearHiddenKeys, isHiddenKey, setHiddenKey } from './chat-visibility';
import { paintChatManageBadge } from './chat-summary-table';

type Navigator = { go: (view: 'overview') => void };

let navigator: Navigator | null = null;
/** 切页导航回调由 panel.ts 注册（避免 chat-manage 反向 import panel 造成循环依赖） */
export function initChatManageView(opts: Navigator): void {
  navigator = opts;
}

function getDoc(): Document { return (window.parent as any)?.document ?? document; }

/** 搜索关键词（只在本页内过滤显示，不进存储） */
let keyword = '';
/** 最近一次聚合结果，供搜索与重绘复用 */
let rows: ChatSummaryRow[] = [];
/** 渲染令牌：热数据先画、冷数据补全，快速切页时丢弃过期结果 */
let renderToken = 0;

function btnStyle(): string {
  return 'padding:5px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;line-height:1.4;';
}

function shellHTML(): string {
  return [
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap;">',
    '<div style="min-width:0;flex:1;">',
    '<div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">对话展示管理</div>',
    '<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:4px;line-height:1.7;max-width:640px;">只控制「按对话统计」表格里是否列出该对话：隐藏不会删除任何数据，热力图、用量统计、历史记录与趋势预测仍按全部历史计算。</div>',
    '</div>',
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">',
    '<input id="aus-chat-manage-search" type="text" placeholder="搜索对话" value="' + esc(keyword) + '" style="width:150px;padding:5px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);outline:none;" />',
    '<button id="aus-chat-manage-reset" type="button" style="' + btnStyle() + '">全部显示</button>',
    '<button id="aus-chat-manage-back" type="button" style="' + btnStyle() + '">返回概览</button>',
    '</div>',
    '</div>',
    '<div class="ds-card" style="padding:0;overflow:hidden;">',
    '<div id="aus-chat-manage-list"></div>',
    '</div>',
    '<div id="aus-chat-manage-foot" style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:8px;"></div>',
  ].join('');
}

function rowHTML(row: ChatSummaryRow, index: number): string {
  const key = chatVisibilityKey(row.chatId);
  const hidden = isHiddenKey(key);
  let costTxt = '¥' + row.cost.toFixed(4);
  try { costTxt = formatMoney(row.cost, 4); } catch {}
  const meta = row.count + ' 轮 · ' + row.total.toLocaleString('zh-CN') + ' tokens · ' + costTxt;
  return [
    '<div class="aus-chat-manage-row" data-chat-row="' + esc(key) + '" data-chat-name="' + esc(row.displayName.toLowerCase()) + '" data-hidden="' + (hidden ? '1' : '0') + '">',
    '<div style="flex:1;min-width:0;">',
    '<div class="aus-chat-manage-name" title="' + esc(row.chatId || row.displayName) + '">' + esc(row.displayName) + '</div>',
    '<div class="aus-chat-manage-meta">' + meta + '</div>',
    '</div>',
    '<span class="aus-chat-manage-state" data-state>' + (hidden ? '已隐藏' : '展示中') + '</span>',
    switchHTML('aus-chat-sw-' + index, { checked: !hidden, ariaLabel: row.displayName + '：在按对话统计中展示' }),
    '</div>',
  ].join('');
}

function applyKeywordFilter(doc: Document): void {
  const list = doc.getElementById('aus-chat-manage-list');
  if (!list) return;
  const kw = keyword.trim().toLowerCase();
  list.querySelectorAll('[data-chat-row]').forEach((el: any) => {
    const name = el.getAttribute('data-chat-name') || '';
    el.style.display = !kw || name.includes(kw) ? 'flex' : 'none';
  });
}

function paintFoot(doc: Document): void {
  const foot = doc.getElementById('aus-chat-manage-foot');
  if (!foot) return;
  const total = rows.length;
  const hidden = rows.filter((r) => isHiddenKey(chatVisibilityKey(r.chatId))).length;
  foot.textContent = total
    ? '共 ' + total + ' 个对话 · 已隐藏 ' + hidden + ' 个' + (hidden ? '（隐藏项不会出现在「按对话统计」表中）' : '')
    : '暂无对话数据';
}

/** 重画列表（数据或显隐变更后调用） */
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

/** 绑定 shell 内的按钮与列表事件（幂等：只在首次构建 shell 时绑定一次） */
function bindShell(doc: Document): void {
  const list = doc.getElementById('aus-chat-manage-list');
  list?.addEventListener('change', (e: any) => {
    const input = e.target as HTMLInputElement;
    if (!input || input.type !== 'checkbox') return;
    const rowEl = input.closest('[data-chat-row]') as HTMLElement | null;
    const key = rowEl?.getAttribute('data-chat-row') || '';
    if (!key) return;
    setHiddenKey(key, !input.checked);
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
    clearHiddenKeys();
    paintList(doc);
  });
  doc.getElementById('aus-chat-manage-back')?.addEventListener('click', () => {
    try { navigator?.go('overview'); } catch {}
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
