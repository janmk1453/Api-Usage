import { describe, it, expect } from 'vitest';
// 直接读源码字符串（与 panel-telemetry.test.ts 同套路，避免引入 node 类型）
import panelSrc from './panel.ts?raw';
import settingsSrc from './settings.ts?raw';
import cssSrc from '../../style.css?raw';
import typesSrc from '../types/settings.ts?raw';
import repoSrc from '../data/repository.ts?raw';

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

describe('底栏选中灰底可拖动切页', () => {
  it('拖动阈值与归位时长集中定义，纵向滑动不接管', () => {
    expect(panelCode).toContain('const DRAG_LOCK = 6;');
    expect(panelCode).toContain('const SNAP_MS = 420;');
    // 纵向为主的滑动留给页面滚动，只有明显偏横向才抓胶囊
    expect(panelCode).toContain('if (!(Math.abs(dx) > DRAG_LOCK && Math.abs(dx) > Math.abs(dy))) return;');
  });

  it('胶囊落位由 syncBottomNav 记下来，拖动起点据此换算', () => {
    expect(panelCode).toContain('let bottomPillX = 0;');
    expect(panelCode).toContain('let bottomPillY = 0;');
    // 一处是 syncBottomNav 落位、一处是拖动松手后的归位
    expect(panelCode).toContain('bottomPillX = x;');
    expect(panelCode).toContain('bottomPillX = Math.round(x);');
    expect(panelCode).toContain('baseX = bottomPillX;');
  });

it('只有按在选中胶囊上才能拖动，按在别的 tab 上不会拖', () => {
    // 胶囊是 pointer-events:none，只能按几何位置判定命中
    expect(panelCode).toContain('const hitPill = (x: number, y: number): boolean => {');
    expect(panelCode).toContain('const r = ind.getBoundingClientRect();');
    expect(panelCode).toContain('onPill = hitPill(e.clientX, e.clientY);');
    // pointermove 里必须先校验 onPill 再接管拖动
    expect(panelCode).toContain('if (!onPill) return;');
    const gate = panelCode.indexOf('if (!onPill) return;');
    const drag = panelCode.indexOf('if (!(Math.abs(dx) > DRAG_LOCK && Math.abs(dx) > Math.abs(dy))) return;');
    expect(gate).toBeGreaterThan(-1);
    expect(drag).toBeGreaterThan(gate);
    // 每次手势结束都要清标记
    expect(panelCode).toContain('onPill = false; };');
  });

  it('拖起加 is-dragging、松手加 is-snapping，只有落到别的 tab 才切页', () => {
    expect(panelCode).toContain('const startDrag = (id: number): boolean => {');
    expect(panelCode).toContain('const moveDrag = (clientX: number) => {');
    expect(panelCode).toContain('const endDrag = (commit: boolean) => {');
    expect(panelCode).toContain("pill.classList.add('is-dragging');");
    expect(panelCode).toContain("p.classList.add('is-snapping');");
    expect(panelCode).toContain('scale(1.06)');
    expect(panelCode).toContain("if (v && !slot.el.classList.contains('active')) handleBottomTabTap(v as AppView);");
    // 拖动结束也算一次已处理点按，防止随后补发的 click 二次切页
    expect(panelCode).toContain('lastBottomTapAt = Date.now();');
  });

  it('拖动与归位的样式走带轻微过冲的弹性曲线', () => {
    expect(cssSrc).toContain('#aus-bottom-indicator.is-dragging {');
    expect(cssSrc).toContain('#aus-bottom-indicator.is-snapping {');
    expect(cssSrc).toContain('transition: transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1) !important;');
    expect(cssSrc).toContain('#aus-panel #aus-bottom-nav .aus-bottom-item[data-pill-target="1"] { color: var(--ds-text); }');
    expect(cssSrc).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('「移动端兼容 UI」默认值按设备类型决定一次', () => {
  it('默认设置与设置归一化都取设备判定结果', () => {
    expect(typesSrc).toContain('mobileCompatUi: mobileDeviceHint(),');
    expect(typesSrc).not.toContain('mobileCompatUi: true,');
    expect(stripComments(repoSrc)).toContain('(merged as any).mobileCompatUi = mobileDeviceHint();');
    expect(stripComments(repoSrc)).not.toContain('mobileCompatUi = true;');
  });

  it('缺这个键时在 hydrate 里补上并立刻落盘，之后不再覆盖用户选择', () => {
    const code = stripComments(repoSrc);
    expect(code).toContain("if (typeof (state.settings as any).mobileCompatUi !== 'boolean') {");
    expect(code).toContain('(state.settings as any).mobileCompatUi = mobileDeviceHint();');
  });
});

describe('跨页长距离切换：胶囊先起跑再渲染', () => {
  it('胶囊先写 transform，目标页内容下一帧再渲染（避免长跳先愣一下）', () => {
    expect(panelCode).toContain('function renderAfterPillStart(doc: Document, run: () => void): void {');
    // 第一帧强制一次样式计算，让 transform 过渡真正起跑
    expect(panelCode).toContain('void ind.getBoundingClientRect();');
    expect(panelCode).toContain('if (bottom && view !== prevView) renderAfterPillStart(doc, renderTargetView);');
    // 快速连点只渲染最后停留的那页
    expect(panelCode).toContain('if (currentView !== view) return;');
    // 后台标签页里 rAF 会被暂停，必须有兜底计时器
    expect(panelCode).toContain('setTimeout(fire, 120);');
    // 顺序契约：先定位胶囊（paintNavState → syncBottomNav），再排队渲染
    const nav = panelCode.indexOf('paintNavState(doc, bottom, bottom);');
    const deferred = panelCode.indexOf('renderAfterPillStart(doc, renderTargetView);');
    expect(nav).toBeGreaterThan(-1);
    expect(deferred).toBeGreaterThan(nav);
  });

  it('指示胶囊单独提层，长跳时不被主线程抢帧', () => {
    const start = cssSrc.indexOf('#aus-bottom-indicator {');
    expect(start).toBeGreaterThan(-1);
    const block = cssSrc.slice(start, cssSrc.indexOf('}', start));
    expect(block).toContain('will-change: transform;');
  });
});
