/**
 * 面板文本默认不可选中：按钮、胶囊、下拉项、表格数字一拖就是蓝色选区，会与「选中项」的浅底混淆。
 * 这些用例守三件事：整棵面板禁选；输入控件与长正文（pre/code）仍可复制；聊天区消息头不被拖选。
 */
import { describe, it, expect } from 'vitest';
import cssSrc from '../../style.css?raw';

const START = '/* ===== 面板文本可选性（默认不可选中）=====';
const END = '/* ===== 胶囊触发器统一样式（.aus-pill）=====';

function region(): string {
  const a = cssSrc.indexOf(START);
  const b = cssSrc.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error('样式表里找不到「面板文本可选性」段');
  return cssSrc.slice(a, b);
}

function block(selector: string): string {
  const scope = region();
  const idx = scope.indexOf(selector);
  if (idx < 0) throw new Error('该段里找不到 ' + selector);
  const start = scope.indexOf('{', idx);
  const end = scope.indexOf('}', start);
  return scope.slice(start + 1, end);
}

describe('面板文本可选性', () => {
  it('面板整棵默认不可选中（含 -webkit 前缀，老 WebView 也生效）', () => {
    const rule = block('#aus-panel,\n#aus-panel * {');
    expect(rule).toContain('-webkit-user-select: none');
    expect(rule).toContain('user-select: none');
    expect(rule).not.toContain('user-select: text');
  });

  it('输入控件与长正文显式放行，仍然可以手动复制', () => {
    const scope = region();
    for (const sel of [
      '#aus-panel input,',
      '#aus-panel textarea,',
      '#aus-panel [contenteditable="true"],',
      '#aus-panel pre,',
      '#aus-panel code,',
      '#aus-panel .aus-selectable,',
      '#aus-panel .aus-cl-body,',
      '#aus-panel .aus-cl-body * {',
    ]) {
      expect(scope).toContain(sel);
    }
    const allow = block('#aus-panel input,');
    expect(allow).toContain('user-select: text');
    expect(allow).toContain('-webkit-user-select: text');
  });

  it('弹窗挂 body 时（is-page）正文同样可复制，不被禁选带走', () => {
    const rule = block('.aus-cl-mask.is-page .aus-cl-body,');
    expect(rule).toContain('user-select: text');
  });

  it('聊天区消息头（费用 / 首字 / 速率）不参与文本选择', () => {
    const idx = cssSrc.indexOf('#chat .mes .aus-mes-meta {');
    expect(idx).toBeGreaterThanOrEqual(0);
    const start = cssSrc.indexOf('{', idx);
    const rule = cssSrc.slice(start + 1, cssSrc.indexOf('}', start));
    expect(rule).toContain('-webkit-user-select: none');
    expect(rule).toContain('user-select: none');
  });
});
