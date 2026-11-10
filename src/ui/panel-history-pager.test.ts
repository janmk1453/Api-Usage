import { describe, it, expect } from 'vitest';
// 直接读源码字符串（与 panel-telemetry.test.ts 同套路，避免引入 node 类型）
import panelSrc from './panel.ts?raw';

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

const panelCode = stripComments(panelSrc);

describe('历史记录翻页不改动页面滚动位置', () => {
  it('翻页只重绘列表，不再把 #aus-history 滚进视口', () => {
    expect(panelCode).not.toContain("doc.getElementById('aus-history')?.scrollIntoView");
    expect(panelCode).not.toContain("scrollIntoView({ behavior:'smooth', block:'start'})");
  });

  it('翻页前后钉住 #aus-main 的滚动位置，并在下一帧再钉一次抵消滚动锚定', () => {
    expect(panelCode).toContain('function keepMainScrollPosition(doc: Document, fn: () => void): void {');
    expect(panelCode).toContain("const scroller = doc.getElementById('aus-main') as HTMLElement | null;");
    expect(panelCode).toContain('const top = scroller ? scroller.scrollTop : 0;');
    expect(panelCode).toContain('view.requestAnimationFrame(restore);');
    expect(panelCode).toContain('keepMainScrollPosition(doc, () => renderHistoryInner(doc, fullHist));');
    // 异步补齐全量数据后的二次渲染（筛选栏 + 列表）同样不许移动页面
    const asyncRender = panelCode.slice(panelCode.indexOf('historyFullCache = full;'));
    expect(asyncRender.slice(0, 400)).toContain('keepMainScrollPosition(doc, () => {');
    expect(asyncRender.slice(0, 400)).toContain('renderHistoryInner(doc, filteredHistoryForDisplay(full));');
  });

  it('上一页 / 下一页共用同一套边界判定', () => {
    expect(panelCode).toContain('const nextPage = historyPage + (id.includes(\'prev\') ? -1 : 1);');
    expect(panelCode).toContain('if (nextPage < 1 || nextPage > totalPages) return;');
    expect(panelCode).toContain("bindPager('aus-history-prev'); bindPager('aus-history-next'); bindPager('aus-history-prev-b'); bindPager('aus-history-next-b');");
  });
});
