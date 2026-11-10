import { describe, it, expect } from 'vitest';
// 用 Vite 的 ?raw 直接把源码当字符串读入（避免引入 node 类型）
import panelSrc from './panel.ts?raw';
import indexSrc from '../index.ts?raw';

// 这些断言守的是「埋点时机」而不是渲染：面板在扩展加载时就被 createPanel() 建好，
// 若把初始化切换当成一次真实浏览，就会在库里写入 opens=0、render=0 但带 1 次概览浏览和
// 一段挂机时长的稀疏记录（曾占 device_daily 约六成行）。因此直接固定该契约。
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

const panelCode = stripComments(panelSrc);

describe('匿名统计：页面浏览只在真正打开面板/切换页面时计数', () => {
  it('switchView 支持跳过计数，且默认仍然计数', () => {
    expect(panelCode).toContain('function switchView(view: AppView, opts?: { track?: boolean; back?: boolean })');
    expect(panelCode).toContain('if (opts?.track !== false) { try { trackPage(view); } catch {} }');
    // 回归防线：不能再出现无条件 trackPage(view)
    expect(panelCode).not.toMatch(/\n\s*try \{ trackPage\(view\); \} catch \{\}/);
  });

  it('createPanel 的初始化切换跳过计数（否则每次页面加载凭空记一次概览浏览）', () => {
    expect(panelCode).toContain("switchView('overview', { track: false });");
    expect(panelCode).not.toMatch(/switchView\('overview'\)/);
  });

  it('openPanel 打开面板时补记一次落地页浏览', () => {
    expect(panelCode).toMatch(/try \{ trackPage\(currentView\); \} catch \{\}/);
  });

  it('加载期入口只建面板，不直接累加任何浏览/打开计数', () => {
    expect(indexSrc).toContain('createPanel()');
    expect(indexSrc).not.toMatch(/\btrackPage\(/);
    expect(indexSrc).not.toMatch(/\btrackOpen\(/);
  });
});
