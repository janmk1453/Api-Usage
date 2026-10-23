/**
 * 表头排序：点击带 data-sort-key 的表头切换排序（同列切换升/降序，换列回到降序）。
 *
 * 用量统计的「模型汇总」与用量概览的「按对话统计」共用这一份实现，
 * 保证交互、指示箭头与悬停高亮完全一致；排序本身由各表自己按业务字段映射。
 */
import { icon } from './icons';

export type SortDir = 'asc' | 'desc';
export type SortState<K extends string = string> = { key: K | null; dir: SortDir };

/** 表头容器：只认表头里带 data-sort-key 的列（首列名称列保持不可排序） */
function sortableHeaders(doc: Document, tableId: string): HTMLElement[] {
  try {
    const table = doc.getElementById(tableId);
    if (!table) return [];
    return Array.from(table.querySelectorAll('thead th[data-sort-key]')) as HTMLElement[];
  } catch {
    return [];
  }
}

/** 重绘排序指示（当前排序列加粗 + 箭头，其余列复原） */
export function paintSortHeader(doc: Document, tableId: string, state: SortState): void {
  const ths = sortableHeaders(doc, tableId);
  for (const th of ths) {
    th.style.color = '';
    th.style.fontWeight = '';
    const ind = th.querySelector('.aus-sort-ind');
    if (ind) ind.textContent = '';
  }
  if (!state.key) return;
  const cur = ths.find((th) => th.getAttribute('data-sort-key') === state.key);
  if (!cur) return;
  cur.style.color = 'var(--ds-text)';
  cur.style.fontWeight = '600';
  const ind = cur.querySelector('.aus-sort-ind');
  if (ind) ind.innerHTML = state.dir === 'asc' ? icon('chevron-up', 14) : icon('chevron-down', 14);
}

/**
 * 绑定表头点击排序（幂等：同一张表只绑一次，表头由首屏模板渲染、不会被重绘）。
 * @param onChange 状态变化后触发重绘，由调用方用最近一次数据重新渲染表体
 */
export function bindSortableHeaders(doc: Document, tableId: string, state: SortState, onChange: () => void): void {
  const table = doc.getElementById(tableId) as any;
  if (!table || table._ausSortBound) return;
  const ths = sortableHeaders(doc, tableId);
  if (!ths.length) return;
  table._ausSortBound = true;
  for (const th of ths) {
    const key = th.getAttribute('data-sort-key');
    if (!key) continue;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.addEventListener('click', () => {
      if (state.key === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.key = key; state.dir = 'desc'; }
      paintSortHeader(doc, tableId, state);
      try { onChange(); } catch {}
    });
    th.addEventListener('mouseenter', () => { if (key !== state.key) th.style.color = 'var(--ds-text)'; });
    th.addEventListener('mouseleave', () => { if (key !== state.key) th.style.color = ''; });
  }
}

/**
 * 按状态排序：未选列时原样返回；相等值按 tie 文本升序稳定兜底，避免顺序抖动。
 * @param pick 从行里取该列的可比较数值
 */
export function sortRows<K extends string, R>(rows: R[], state: SortState<K>, pick: (row: R, key: K) => number, tie: (row: R) => string): R[] {
  const key = state.key;
  if (!key) return rows;
  const dir = state.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = Number(pick(a, key)) || 0;
    const bv = Number(pick(b, key)) || 0;
    if (av === bv) return tie(a).localeCompare(tie(b));
    return (av - bv) * dir;
  });
}
