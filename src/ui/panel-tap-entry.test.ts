/**
 * 「其他请求」入口迁移的契约守护：
 * 入口从历史记录页工具栏挪到「问题反馈 / 请求日志」页，返回与底栏高亮都要跟着新入口走。
 * 这类跨页接线（哪个函数调哪个、底栏高亮取哪条链路）没有 DOM 级行为测试，只能读源码断言。
 */
import { describe, it, expect } from 'vitest';
import panelSrc from './panel.ts?raw';
import logViewSrc from './log-view.ts?raw';
import tapViewSrc from './tap-view.ts?raw';
import navModelSrc from './nav-model.ts?raw';

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

const panelCode = stripComments(panelSrc);
const logCode = stripComments(logViewSrc);
const tapCode = stripComments(tapViewSrc);
const navCode = stripComments(navModelSrc);

describe('「其他请求」入口从历史记录页挪到请求日志页', () => {
  it('历史记录页工具栏不再有「其他请求」按钮', () => {
    expect(panelCode).not.toContain('aus-history-tap-btn');
    // 「请求日志」按钮保留，历史页仍是它的入口之一
    expect(panelCode).toContain('aus-history-log-btn');
  });

  it('请求日志页工具条上挂着「其他请求」，点击走注入的 goTap', () => {
    expect(logCode).toContain('data-log-action="tap"');
    expect(logCode).toContain('其他请求');
    expect(logCode).toContain("if (action === 'tap') {");
    expect(logCode).toContain('if (goTap) goTap();');
    expect(logCode).toContain('goTap?: () => void');
  });

  it('面板把按钮接到 openTap(\'log\')，返回与归属都按 tapOrigin 算', () => {
    expect(panelCode).toContain("goTap: () => openTap('log')");
    expect(panelCode).toContain('function openTap(from: AppView): void {');
    expect(panelCode).toContain("let tapOrigin: AppView = 'log';");
    expect(panelCode).toContain("if (currentView === 'tap') return tapOrigin;");
    expect(panelCode).toContain("if (view === 'tap') return tapOrigin;");
  });

  it('其他请求页的返回按钮走统一组件，回日志页且不再写死目标页名', () => {
    expect(tapCode).toContain("backButtonHTML({ id: 'aus-tap-back' })");
    expect(tapCode).not.toContain('返回请求日志');
    expect(tapCode).not.toContain("go?.('history')");
  });

  it('底栏高亮与重复点当前 tab 走来源链解析，不再单层 parentTabOf', () => {
    // 其他请求 ← 请求日志 ← 历史/设置 是两级嵌套：单层 parentTabOf 会停在日志页、恒算成「设置」
    expect(panelCode).toContain('currentNavKey = bottom || !isSettingsChild(currentView) ? tabOf(currentView) : navSource;');
    expect(panelCode).toContain('const currentTab = tabOf(currentView);');
    expect(panelCode).toContain('function tabOf(view: AppView): AppView {');
    expect(panelCode).toContain('return tabOfView(view, viewSourceOf);');
    expect(navCode).toContain('export function tabOfView(');
  });
});
