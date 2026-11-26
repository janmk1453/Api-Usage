import { describe, it, expect } from 'vitest';
// 直接读源码字符串（与 panel-history-pager.test.ts 同套路，避免引入 node 类型）
import panelSrc from './panel.ts?raw';

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

const panelCode = stripComments(panelSrc);

describe('历史页空态「清除筛选」能点动', () => {
  it('空态按钮用独立 id，并只在列表容器内查找', () => {
    expect(panelCode).toContain('id="aus-history-empty-reset"');
    expect(panelCode).toContain("const reset = host.querySelector('#aus-history-empty-reset') as HTMLButtonElement | null;");
    // 撞 id 时全局 getElementById 会命中文档里更靠前的工具栏那枚，空态按钮永远拿不到点击处理
    expect(panelCode).not.toContain("doc.getElementById('aus-history-filter-reset')");
  });

  it('工具栏「重置筛选」的查询限定在筛选栏内', () => {
    expect(panelCode).toContain("const historyResetBtn = doc.querySelector('#aus-history-filter-host #aus-history-filter-reset') as HTMLElement | null;");
  });

  it('工具栏与空态共用一个重置实现，逻辑不许分叉', () => {
    const start = panelCode.indexOf('function applyHistoryFilterReset(doc: Document): void {');
    expect(start).toBeGreaterThan(-1);
    const body = panelCode.slice(start, panelCode.indexOf('function bindHistoryFilters'));
    expect(body).toContain('resetHistoryFilters();');
    expect(body).toContain('closeHistoryFilterDropdowns();');
    expect(body).toContain('renderHistory(doc, getSelectedSave());');
    expect(panelCode).toContain('if (historyResetBtn) historyResetBtn.onclick = () => applyHistoryFilterReset(doc);');
    expect(panelCode).toContain('if (reset) reset.onclick = () => applyHistoryFilterReset(doc);');
  });

  it('面板模板里的静态 id 不得重复', () => {
    // 重复 id 会让 getElementById 拿到文档里第一个同名元素，绑定静默落到别人身上
    const ids = [...panelCode.matchAll(/id="([^"$]+)"/g)].map((m) => m[1]);
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
    const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    expect(dups).toEqual([]);
  });
});
