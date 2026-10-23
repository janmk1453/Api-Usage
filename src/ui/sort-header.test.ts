import { describe, expect, it } from 'vitest';
import { bindSortableHeaders, paintSortHeader, sortRows, type SortState } from './sort-header';
import { pickChatSortValue } from './chat-summary-table';
import type { ChatSummaryRow } from '../data/computed';

/** 最小 DOM 桩：只实现排序用到的 getElementById / querySelectorAll / 表头属性 */
function stubHeader(key: string) {
  // 指示器桩：textContent 与 innerHTML 共用同一份内容，模拟真实 DOM 里
  // 「设置 textContent 会替换全部子节点」的行为，否则清空后再画箭头测不出来
  const store = { html: '' };
  const ind: any = {
    get innerHTML() { return store.html; },
    set innerHTML(v: string) { store.html = v; },
    get textContent() { return store.html.replace(/<[^>]*>/g, ''); },
    set textContent(v: string) { store.html = v; },
  };
  const listeners: Record<string, Array<() => void>> = {};
  const th: any = {
    style: {} as Record<string, string>,
    attrs: { 'data-sort-key': key } as Record<string, string>,
    getAttribute: (name: string) => th.attrs[name] ?? null,
    querySelector: (sel: string) => (sel === '.aus-sort-ind' ? ind : null),
    addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn); },
    emit: (type: string) => { for (const fn of listeners[type] || []) fn(); },
    ind,
  };
  return th;
}

function stubDoc(ths: any[]) {
  const table: any = {
    querySelectorAll: (sel: string) => (sel === 'thead th[data-sort-key]' ? ths : []),
  };
  return {
    doc: { getElementById: (id: string) => (id === 'aus-demo-table' ? table : null) } as any,
    table,
  };
}

describe('表头排序（sort-header）', () => {
  it('未选列时保持原顺序', () => {
    const state: SortState<'total'> = { key: null, dir: 'desc' };
    const rows = [{ total: 5 }, { total: 9 }];
    expect(sortRows(rows, state, (r, k) => r[k], () => '')).toEqual(rows);
  });

  it('按数值升降序排列，相等时按名称稳定兜底', () => {
    const rows = [
      { name: 'b', total: 5 },
      { name: 'a', total: 5 },
      { name: 'c', total: 9 },
    ];
    const desc: SortState<'total'> = { key: 'total', dir: 'desc' };
    expect(sortRows(rows, desc, (r) => r.total, (r) => r.name).map(r => r.name)).toEqual(['c', 'a', 'b']);
    const asc: SortState<'total'> = { key: 'total', dir: 'asc' };
    expect(sortRows(rows, asc, (r) => r.total, (r) => r.name).map(r => r.name)).toEqual(['a', 'b', 'c']);
  });

  it('不修改传入数组', () => {
    const rows = [{ total: 1 }, { total: 2 }];
    const state: SortState<'total'> = { key: 'total', dir: 'desc' };
    sortRows(rows, state, (r) => r.total, () => '');
    expect(rows[0].total).toBe(1);
  });

  it('点击同列切换方向，换列回到降序，并在表头画出箭头', () => {
    const ths = [stubHeader('count'), stubHeader('total')];
    const { doc } = stubDoc(ths);
    const state: SortState<'count' | 'total'> = { key: null, dir: 'desc' };
    let renders = 0;
    bindSortableHeaders(doc, 'aus-demo-table', state, () => { renders++; });

    ths[1].emit('click');
    expect(state).toMatchObject({ key: 'total', dir: 'desc' });
    expect(renders).toBe(1);
    ths[1].emit('click');
    expect(state).toMatchObject({ key: 'total', dir: 'asc' });
    ths[0].emit('click');
    expect(state).toMatchObject({ key: 'count', dir: 'desc' });

    paintSortHeader(doc, 'aus-demo-table', state);
    expect(ths[0].style.fontWeight).toBe('600');
    expect(ths[0].ind.innerHTML).toContain('svg');
    expect(ths[1].ind.innerHTML).toBe('');
  });

  it('重复绑定不会叠加监听（同一张表只绑一次）', () => {
    const ths = [stubHeader('total')];
    const { doc } = stubDoc(ths);
    const state: SortState<'total'> = { key: null, dir: 'desc' };
    let renders = 0;
    bindSortableHeaders(doc, 'aus-demo-table', state, () => { renders++; });
    bindSortableHeaders(doc, 'aus-demo-table', state, () => { renders++; });
    ths[0].emit('click');
    expect(renders).toBe(1);
  });
});

describe('按对话统计的列取值', () => {
  const row: ChatSummaryRow = {
    chatId: 'c1', chatName: '对话一', displayName: '对话一',
    count: 3, hit: 100, miss: 50, out: 20, total: 170, cost: 0.5,
    avgTokens: 56.67, avgHitRate: 66.67,
  };

  it('每个排序列都映射到对应字段', () => {
    expect(pickChatSortValue(row, 'count')).toBe(3);
    expect(pickChatSortValue(row, 'hit')).toBe(100);
    expect(pickChatSortValue(row, 'miss')).toBe(50);
    expect(pickChatSortValue(row, 'out')).toBe(20);
    expect(pickChatSortValue(row, 'total')).toBe(170);
    expect(pickChatSortValue(row, 'cost')).toBe(0.5);
    expect(pickChatSortValue(row, 'avgTokens')).toBeCloseTo(56.67);
    expect(pickChatSortValue(row, 'avgHitRate')).toBeCloseTo(66.67);
  });
});
