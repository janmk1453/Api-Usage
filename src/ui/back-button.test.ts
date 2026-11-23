/**
 * 二级页返回按钮的唯一来源：三页（对话展示管理 / 请求日志 / 其他请求）必须同款。
 * 这里守两件事：HTML 结构与语义（含禁止写死目标页名）、样式表里只有一套 .aus-back-btn 规格。
 */
import { describe, it, expect } from 'vitest';
import { BACK_BUTTON_CLASS, backButtonHTML } from './back-button';
import cssSrc from '../../style.css?raw';
import chatManageSrc from './chat-manage.ts?raw';
import logViewSrc from './log-view.ts?raw';
import tapViewSrc from './tap-view.ts?raw';

describe('back-button：结构与语义', () => {
  it('默认形态：按钮本体 + 统一类 + 无障碍标签 + 左箭头 + 「返回」', () => {
    const html = backButtonHTML();
    expect(html.startsWith('<button ')).toBe(true);
    expect(html).toContain('type="button"');
    expect(html).toContain('class="' + BACK_BUTTON_CLASS + '"');
    expect(html).toContain('data-aus-back="1"');
    expect(html).toContain('aria-label="返回上一页"');
    expect(html).toContain('title="返回上一页"');
    expect(html).toContain('<svg');
    expect(html).toContain('返回</button>');
  });

  it('带 id 与自定义提示，不写目标页名（目标由 returnFromChild 决定）', () => {
    const html = backButtonHTML({ id: 'aus-log-back', title: '返回上一页' });
    expect(html).toContain('id="aus-log-back"');
    expect(html).toContain('title="返回上一页"');
    expect(html).not.toContain('返回请求日志');
    expect(html).not.toContain('返回设置');
  });

  it('额外 data-* 属性照原样带出（请求日志页的委托依赖 data-log-action）', () => {
    const html = backButtonHTML({ id: 'aus-log-back', data: { 'data-log-action': 'back' } });
    expect(html).toContain('data-log-action="back"');
  });

  it('属性值做 HTML 转义', () => {
    const html = backButtonHTML({ title: '"x"<y>' });
    expect(html).toContain('&quot;x&quot;&lt;y&gt;');
    expect(html).not.toContain('"x"<y>');
  });
});

describe('back-button：三页接线', () => {
  it('三页都由 backButtonHTML 生成，并各自保留原有绑定 id', () => {
    expect(chatManageSrc).toContain("backButtonHTML({ id: 'aus-chat-manage-back'");
    expect(logViewSrc).toContain("backButtonHTML({ id: 'aus-log-back'");
    expect(tapViewSrc).toContain("backButtonHTML({ id: 'aus-tap-back'");
  });

  it('三页都不再手写返回按钮的旧类与旧文案', () => {
    expect(chatManageSrc).not.toContain('class="aus-chat-manage-btn" title="回到');
    expect(logViewSrc).not.toContain('aus-log-link aus-log-back');
    expect(tapViewSrc).not.toContain('返回请求日志');
  });
});

describe('back-button：样式表只有一套规格', () => {
  it('存在 .aus-back-btn 规则，并靠 margin-left:auto 贴工具行最右', () => {
    expect(cssSrc).toContain('#aus-panel .aus-back-btn{');
    expect(cssSrc).toMatch(/#aus-panel \.aus-back-btn\{[^}]*margin-left:auto/);
    expect(cssSrc).toMatch(/#aus-panel \.aus-back-btn\{[^}]*border-radius:999px/);
    expect(cssSrc).toMatch(/#aus-panel \.aus-back-btn\{[^}]*font-size:var\(--aus-fs-sm\)/);
  });

  it('旧的 .aus-log-back 专属规则已删除（返回不再单独写样式/排位）', () => {
    expect(cssSrc).not.toContain('.aus-log-back');
  });
});
