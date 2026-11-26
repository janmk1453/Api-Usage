import { describe, it, expect } from 'vitest';
import panelSrc from './panel.ts?raw';
import cssSrc from '../../style.css?raw';

/** 去掉注释再断言：注释里提到旧写法不算违规 */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** 取某个位置最近的一条 at-rule 头（用来确认规则落在哪一段里） */
function enclosingAtRule(css: string, index: number): string {
  const before = css.slice(0, index);
  const at = Math.max(before.lastIndexOf('@media'), before.lastIndexOf('@container'));
  return before.slice(at).split('{')[0].trim();
}

const panel = stripComments(panelSrc);
const css = stripComments(cssSrc);

describe('宽表横滑：标题行留在卡片内，滚动只发生在表体容器里', () => {
  it('两张卡片的标题行与「管理…」按钮在滚动容器之外', () => {
    // 概览：按对话统计
    const chatCard = panel.indexOf('id="aus-chat-summary-overview"');
    const chatBtn = panel.indexOf('id="aus-chat-manage-btn"');
    const chatScroll = panel.indexOf('class="aus-table-scroll"', chatCard);
    const chatBody = panel.indexOf('id="aus-chat-summary-tbody"', chatCard);
    expect(chatCard).toBeGreaterThan(-1);
    expect(chatBtn).toBeGreaterThan(chatCard);
    expect(chatBtn).toBeLessThan(chatScroll);
    expect(chatScroll).toBeLessThan(chatBody);

    // 统计页：模型汇总
    const modelCard = panel.indexOf('id="aus-model-summary"');
    const modelBtn = panel.indexOf('id="aus-model-manage-btn"');
    const modelScroll = panel.indexOf('class="aus-table-scroll"', modelCard);
    const modelBody = panel.indexOf('id="aus-summary-tbody"', modelCard);
    expect(modelBtn).toBeGreaterThan(modelCard);
    expect(modelBtn).toBeLessThan(modelScroll);
    expect(modelScroll).toBeLessThan(modelBody);
  });

  it('卡片不再自己横滑：开标签没有内联 overflow:auto', () => {
    expect(panel).toContain('id="aus-chat-summary-overview" class="ds-card" style="margin-top:12px;"');
    expect(panel).toContain('id="aus-model-summary" class="ds-card" style="margin-top:12px;"');
    expect(panel).not.toMatch(/id="aus-chat-summary-overview" class="ds-card" style="[^"]*overflow/);
    expect(panel).not.toMatch(/id="aus-model-summary" class="ds-card" style="[^"]*overflow/);
    // 两个滚动容器都挂数据钩子，滚动条样式靠它命中
    expect(panel.match(/class="aus-table-scroll" data-scroll-x="1"/g)).toHaveLength(2);
  });

  it('表格收进容器后紧跟容器闭合，概览卡脚注也被留在容器外', () => {
    expect(panel).toContain('</table>\n              </div>\n              <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;">');
    expect(panel).toContain('</table>\n              </div>\n            </div>');
  });

  it('桌面规则：表体容器负责横滑，并允许收缩不被表格撑开', () => {
    const i = css.indexOf('#aus-panel .aus-table-scroll {');
    expect(i).toBeGreaterThan(-1);
    const rule = css.slice(i, css.indexOf('}', i));
    expect(rule).toContain('overflow-x: auto;');
    expect(rule).toContain('overflow-y: hidden;');
    expect(rule).toContain('min-width: 0;');
    expect(rule).toContain('max-width: 100%;');
  });

  it('窄屏规则：卡片 hidden、表体容器横滑（写在 760px 断点里）', () => {
    const i = css.indexOf('#aus-model-summary .aus-table-scroll,');
    expect(i).toBeGreaterThan(-1);
    expect(enclosingAtRule(css, i)).toBe('@media (max-width: 760px)');
    const cardIdx = css.indexOf('#aus-chat-summary-overview { overflow: hidden !important; }');
    expect(cardIdx).toBeGreaterThan(-1);
    expect(enclosingAtRule(css, cardIdx)).toBe('@media (max-width: 760px)');
    // 旧写法（卡片自己横滑）必须已经消失
    expect(css).not.toMatch(/#aus-model-summary \{ overflow-x: auto/);
    expect(css).not.toMatch(/#aus-chat-summary-overview \{ overflow-x: auto/);
  });

  it('表格最小宽度挂在容器后代上，桌面与窄屏都成立', () => {
    expect(css).toContain('#aus-model-summary .aus-table-scroll table { min-width: 720px !important; }');
    expect(css).toContain('#aus-chat-summary-overview .aus-table-scroll table { min-width: 720px !important; }');
    expect(css).not.toMatch(/#aus-model-summary table \{ min-width: 720px/);
    expect(css).not.toMatch(/#aus-chat-summary-overview table \{ min-width: 720px/);
  });

  it('细滚动条只作用在内层容器上', () => {
    expect(css).toContain('#aus-model-summary .aus-table-scroll::-webkit-scrollbar,');
    expect(css).toContain('#aus-chat-summary-overview .aus-table-scroll::-webkit-scrollbar,');
    expect(css).not.toMatch(/#aus-model-summary::-webkit-scrollbar/);
    expect(css).not.toMatch(/#aus-chat-summary-overview::-webkit-scrollbar/);
  });
});
