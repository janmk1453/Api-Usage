/**
 * 其他请求（技术验证页）
 *
 * 定位：只把探针采到的请求「摆出来给人看」，回答一个问题 ——
 * 酒馆里那些不走常规对话链路的请求长什么样、来自谁、和对账结果是否一致。
 * 这里读的数据全部来自 localStorage['aus_tap_log_v1']，不参与概览/统计/历史/趋势的任何计算，
 * 也不写回 state.history。页面本身不进底栏 tab，挂在「历史记录」下，从历史页工具栏进入。
 */
import { esc, localDay, localTimeHM } from '../utils/date';
import type { AppView } from './nav-model';
import { tapDiagnostics } from '../services/request-tap';
import { clearTapRecords, listTapRecords, subscribeTap, TAP_MAX_RECORDS } from '../services/request-tap/store';
import type { TapRecord } from '../services/request-tap/types';

type TapFilter = 'all' | 'orphan' | 'settled';

let filter: TapFilter = 'orphan';
let pendingClear = false;
let bound = false;
let go: ((view: AppView) => void) | null = null;
let subscribing = false;
let renderQueued = false;

/** 面板初始化时注入切页函数（与 chat-manage 的 init 同款） */
export function initTapView(deps: { go: (view: AppView) => void }): void {
  go = deps.go;
  if (subscribing) return;
  subscribing = true;
  // 探针写入 → 只在「本页正显示」时重绘，避免在别的页面上空转
  try {
    subscribeTap(() => {
      if (renderQueued) return;
      renderQueued = true;
      const flush = () => {
        renderQueued = false;
        const root = document.getElementById('aus-tap-root');
        const host = root?.closest('[data-view]') as HTMLElement | null;
        if (!root || !host || host.style.display === 'none') return;
        renderTapView();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
      else setTimeout(flush, 60);
    });
  } catch {}
}

function num(n: number): string {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

function tokensOf(records: TapRecord[]): number {
  let sum = 0;
  for (const r of records) sum += Number(r.usage?.total) || 0;
  return sum;
}

function stateText(r: TapRecord): string {
  if (r.state === 'settled') return '已入账';
  if (r.state === 'orphan') return '未入账';
  return '待对账';
}

function cardOf(key: string, rows: TapRecord[]): string {
  const label = rows[0]?.purposeLabel || '未分类';
  const tokens = tokensOf(rows);
  const latest = rows.reduce((max, r) => Math.max(max, r.at), 0);
  const shown = rows.slice(0, 8);
  const rest = rows.length - shown.length;
  const items = shown.map((r) => {
    const usage = r.usage
      ? '入 ' + num(r.usage.prompt) + ' · 出 ' + num(r.usage.completion)
      : '无 usage（该接口未返回用量）';
    const actor = r.actorLabel || '未知来源';
    const meta = [r.endpoint === 'chat' ? 'chat' : r.endpoint === 'text' ? 'text' : '其他', r.model || '未标模型', r.stream ? '流式' : '非流式']
      .filter(Boolean)
      .join(' · ');
    return (
      '<div class="aus-tap-row">' +
        '<div class="aus-tap-row-top">' +
          '<span class="aus-tap-time">' + esc(localDay(r.at) + ' ' + localTimeHM(r.at)) + '</span>' +
          '<span class="aus-tap-actor" title="' + esc(r.actorId || '') + '">' + esc(actor) + '</span>' +
          '<span class="aus-tap-state" data-state="' + esc(r.state) + '">' + esc(stateText(r)) + '</span>' +
        '</div>' +
        '<div class="aus-tap-row-meta">' + esc(meta) + '</div>' +
        '<div class="aus-tap-row-usage">' + esc(usage) +
          (r.durationMs ? '<span class="aus-tap-dur">' + esc((r.durationMs / 1000).toFixed(1) + 's') + '</span>' : '') +
        '</div>' +
        (r.promptHint ? '<div class="aus-tap-hint">' + esc(r.promptHint) + '</div>' : '') +
      '</div>'
    );
  }).join('');
  return (
    '<div class="ds-card aus-tap-group" data-key="' + esc(key) + '">' +
      '<div class="aus-tap-group-head">' +
        '<span class="aus-tap-group-label">' + esc(label) + '</span>' +
        '<span class="aus-tap-group-meta">' + rows.length + ' 次 · ' + num(tokens) + ' tokens · 最近 ' +
          esc(localDay(latest) + ' ' + localTimeHM(latest)) + '</span>' +
      '</div>' +
      items + (rest > 0 ? '<div class="aus-tap-more">其余 ' + rest + ' 条已省略</div>' : '') +
    '</div>'
  );
}

export interface TapViewInput {
  records: TapRecord[];
  filter: TapFilter;
  pendingClear: boolean;
  diag: { settlements: number; consumed: number };
}

/** 纯函数：给定记录与筛选，产出整页 HTML（无 DOM 依赖，可直接单测） */
export function tapViewHTML(input: TapViewInput): string {
  const all = input.records;
  const orphans = all.filter((r) => r.state === 'orphan');
  const settled = all.filter((r) => r.state === 'settled');
  const pending = all.filter((r) => r.state === 'pending');
  const noUsage = all.filter((r) => r.usageMissing).length;
  const diag = input.diag;

  const rows = input.filter === 'orphan' ? orphans : input.filter === 'settled' ? settled : all;
  const groups = new Map<string, TapRecord[]>();
  for (const r of rows) {
    const key = r.purposeKey || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const ordered = Array.from(groups.entries())
    .map(([key, list]) => ({ key, list: list.slice().sort((a, b) => b.at - a.at) }))
    .sort((a, b) => b.list.length - a.list.length || a.key.localeCompare(b.key));

  const block = (label: string, value: string, sub?: string) =>
    '<div class="aus-tap-block"><div class="aus-tap-block-label">' + esc(label) + '</div>' +
    '<div class="aus-tap-block-value">' + esc(value) + '</div>' +
    (sub ? '<div class="aus-tap-block-sub">' + esc(sub) + '</div>' : '') + '</div>';

  const pill = (key: TapFilter, text: string) =>
    '<button type="button" class="aus-pill aus-pill-sm" data-tap-filter="' + key + '"' +
      (input.filter === key ? ' data-on="1"' : '') + '>' + esc(text) + '</button>';

  return (
    '<div class="aus-tap-note">' +
      '技术验证页：这里只做原理验证 —— 旁路记录酒馆发出的后端请求，再用「现有逻辑有没有为它写过一条历史记录」' +
      '判断哪些属于非常规对话请求。<b>数据只存在本机 localStorage（<code>' + esc('aus_tap_log_v1') + '</code>）' +
      '，完全不进入概览、统计、历史、趋势的任何计算</b>，可随时一键清空。' +
      '上限 ' + TAP_MAX_RECORDS + ' 条；已采集 ' + all.length + ' 条，账本 ' + diag.settlements + ' 条。' +
    '</div>' +
    '<div class="aus-tap-sum">' +
      block('采集到的后端请求', String(all.length), '端点命中 /api/backends/*/generate') +
      block('未入账（疑似非常规）', String(orphans.length), '现有逻辑没写过记录') +
      block('已入账（常规对话）', String(settled.length), '与历史记录一一对上') +
      block('待对账 / 无用量', pending.length + ' / ' + noUsage, '结束后 12 秒判定') +
    '</div>' +
    '<div class="aus-tap-tools">' +
      pill('orphan', '未入账 ' + orphans.length) +
      pill('settled', '已入账 ' + settled.length) +
      pill('all', '全部 ' + all.length) +
      '<span class="aus-tap-tools-gap"></span>' +
      '<button type="button" class="aus-pill aus-pill-sm" id="aus-tap-export">导出 JSON</button>' +
      '<button type="button" class="aus-pill aus-pill-sm" id="aus-tap-clear"' +
        (input.pendingClear ? ' data-danger="1"' : '') + '>' + (input.pendingClear ? '确认清空？' : '清空') + '</button>' +
      '<button type="button" class="aus-pill aus-pill-sm" id="aus-tap-back">返回历史记录</button>' +
    '</div>' +
    (ordered.length
      ? '<div class="aus-tap-groups">' + ordered.map((g) => cardOf(g.key, g.list)).join('') + '</div>'
      : '<div class="ds-card aus-tap-empty">还没有符合条件的记录 —— 触发几次插件请求（比如 MVU 变量更新、填表）再回来看。</div>')
  );
}

export function renderTapView(): void {
  const root = document.getElementById('aus-tap-root') as HTMLElement | null;
  if (!root) return;
  root.innerHTML = tapViewHTML({ records: listTapRecords(), filter, pendingClear, diag: tapDiagnostics() });
  bindOnce(root);
}

function bindOnce(root: HTMLElement): void {
  if (bound) return;
  bound = true;
  root.addEventListener('click', (e: any) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const filterBtn = t.closest('[data-tap-filter]') as HTMLElement | null;
    if (filterBtn) {
      filter = (filterBtn.getAttribute('data-tap-filter') as TapFilter) || 'all';
      pendingClear = false;
      renderTapView();
      return;
    }
    if (t.closest('#aus-tap-export')) { exportAll(); return; }
    if (t.closest('#aus-tap-clear')) {
      if (!pendingClear) { pendingClear = true; renderTapView(); return; }
      pendingClear = false;
      try { clearTapRecords(); } catch {}
      renderTapView();
      return;
    }
    if (t.closest('#aus-tap-back')) {
      try { go?.('history'); } catch {}
    }
  });
}

function exportAll(): void {
  try {
    const data = JSON.stringify(listTapRecords(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aus-tap-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 4000);
  } catch {}
}
