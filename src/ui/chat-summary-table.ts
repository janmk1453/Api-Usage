/**
 * 用量概览「按对话统计」表：渲染 + 表头排序。
 *
 * 与「用量统计 → 模型汇总」共用 sort-header 的排序交互，
 * 默认顺序仍是 computeChatStats 的总 Tokens 倒序，用户点表头后才改。
 */
import { type ChatSummaryRow } from '../data/computed';
import { bindSortableHeaders, paintSortHeader, sortRows, type SortState } from './sort-header';
import { esc } from '../utils/date';
import { formatMoney } from '../services/currency';

type ChatSortKey = 'count' | 'hit' | 'miss' | 'out' | 'total' | 'cost' | 'avgTokens' | 'avgHitRate';

/** 排序状态：key 为 null 时保持数据源默认顺序（总 Tokens 倒序） */
const sortState: SortState<ChatSortKey> = { key: null, dir: 'desc' };
/** 最近一次渲染的数据，供点击表头时就地重排，避免重新聚合 */
let lastRows: ChatSummaryRow[] = [];

const TABLE_ID = 'aus-chat-summary-overview';
const TBODY_ID = 'aus-chat-summary-tbody';

/** 列 → 可比较数值（导出以便单测，保持与表头 data-sort-key 一一对应） */
export function pickChatSortValue(row: ChatSummaryRow, key: ChatSortKey): number {
  switch (key) {
    case 'count': return row.count;
    case 'hit': return row.hit;
    case 'miss': return row.miss;
    case 'out': return row.out;
    case 'total': return row.total;
    case 'cost': return row.cost;
    case 'avgTokens': return row.avgTokens;
    case 'avgHitRate': return row.avgHitRate;
    default: return 0;
  }
}

/** 绑定表头排序（幂等），点击后按最近一次数据重排重绘 */
export function bindChatSummarySort(doc: Document): void {
  bindSortableHeaders(doc, TABLE_ID, sortState, () => {
    renderChatSummaryTable(doc, lastRows);
  });
  paintSortHeader(doc, TABLE_ID, sortState);
}

/** 渲染表体：先按当前排序状态排序，未选列时保持入参顺序 */
export function renderChatSummaryTable(doc: Document, rows: ChatSummaryRow[]): void {
  const tbody = doc.getElementById(TBODY_ID) as HTMLElement | null;
  if (!tbody) return;
  lastRows = rows || [];
  try { bindChatSummarySort(doc); } catch {}
  if (!lastRows.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr>';
    return;
  }
  const sorted = sortRows(lastRows, sortState, pickChatSortValue, (row) => row.displayName);
  tbody.innerHTML = sorted.map((r) => {
    const avgRate = r.avgHitRate > 0 ? r.avgHitRate.toFixed(1) + '%' : '—';
    const colorRate = r.avgHitRate >= 50 ? 'var(--ds-green)' : r.avgHitRate > 0 ? 'var(--ds-text)' : 'var(--ds-text-3)';
    let costTxt = '¥' + r.cost.toFixed(4);
    try { costTxt = formatMoney(r.cost, 4); } catch {}
    return [
      '<tr style="border-bottom:1px solid var(--ds-card);">',
      '<td style="padding:6px 8px;text-align:left;color:var(--ds-text);font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;" title="' + esc(r.chatId || 'null') + '">' + esc(r.displayName) + '</td>',
      '<td style="padding:6px 8px;text-align:right;">' + r.count + '</td>',
      '<td style="padding:6px 8px;text-align:right;color:#0BA25E;">' + r.hit.toLocaleString('zh-CN') + '</td>',
      '<td style="padding:6px 8px;text-align:right;color:#DC2626;">' + r.miss.toLocaleString('zh-CN') + '</td>',
      '<td style="padding:6px 8px;text-align:right;color:#6366F1;">' + r.out.toLocaleString('zh-CN') + '</td>',
      '<td style="padding:6px 8px;text-align:right;font-weight:600;">' + r.total.toLocaleString('zh-CN') + '</td>',
      '<td style="padding:6px 8px;text-align:right;color:var(--ds-text);">' + costTxt + '</td>',
      '<td style="padding:6px 8px;text-align:right;">' + Math.round(r.avgTokens).toLocaleString('zh-CN') + '</td>',
      '<td style="padding:6px 8px;text-align:right;color:' + colorRate + ';">' + avgRate + '</td>',
      '</tr>',
    ].join('');
  }).join('');
}
