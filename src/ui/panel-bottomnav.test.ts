import { describe, it, expect } from 'vitest';
// 直接读源码字符串（与 panel-telemetry.test.ts 同套路，避免引入 node 类型）
import panelSrc from './panel.ts?raw';
import settingsSrc from './settings.ts?raw';
import cssSrc from '../../style.css?raw';

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

const panelCode = stripComments(panelSrc);

describe('底栏点按：滑动期间也能稳定响应', () => {
  it('底栏改为在 pointerup 里按位移与时长判定点按', () => {
    expect(panelCode).toContain('function bindBottomNavTap(doc: Document): void {');
    expect(panelCode).toContain("bar.addEventListener('pointerup'");
    expect(panelCode).toContain("bar.addEventListener('pointermove'");
    // 位移阈值与长按阈值必须存在，否则滑动手势会被当成点按
    expect(panelCode).toContain('const TAP_SLOP = 12;');
    expect(panelCode).toContain('const TAP_MAX_MS = 800;');
    expect(panelCode).toContain('if (!hit || wasMoved || elapsed > TAP_MAX_MS) return;');
  });

  it('bindPanel 会挂上点按接管（幂等）', () => {
    expect(panelCode).toContain('bindBottomNavTap(doc);');
    expect(panelCode).toContain("bar.getAttribute('data-tap-bound') === '1'");
  });

  it('click 只作键盘/读屏兜底，避免与 pointerup 重复触发', () => {
    expect(panelCode).toContain('let lastBottomTapAt = 0;');
    expect(panelCode).toContain('if (Date.now() - lastBottomTapAt < 600) return;');
  });
});

describe('底栏模式下顶栏左侧文字与内容区对齐', () => {
  it('去掉汉堡按钮遗留的 12px 缩进，二级页恢复间距', () => {
    expect(cssSrc).toContain('#aus-panel[data-mobile-nav="bottom"] #aus-mobile-header { padding: 0 12px !important; }');
    expect(cssSrc).toContain('#aus-panel[data-mobile-nav="bottom"] #aus-mobile-header #aus-mobile-brand { margin-left: 0 !important; }');
    expect(cssSrc).toContain('#aus-panel[data-mobile-nav="bottom"] #aus-mobile-header:has(#aus-mobile-back[style*="flex"]) #aus-mobile-brand');
  });
});

describe('设置页卡片顺序', () => {
  it('匿名使用统计排在「新钱包默认峰谷时段」下面', () => {
    const peak = settingsSrc.indexOf('<!-- 高峰时段');
    const telemetry = settingsSrc.indexOf('<!-- 匿名使用统计');
    const models = settingsSrc.indexOf('<!-- 模型与价格');
    expect(peak).toBeGreaterThan(-1);
    expect(telemetry).toBeGreaterThan(peak);
    expect(telemetry).toBeLessThan(models);
  });
});
