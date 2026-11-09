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

describe('设置页「关于」入口展示当前版本号', () => {
  it('版本号单源读取，并渲染在关于入口的标题后面', () => {
    expect(panelCode).toContain('function appVersionText(): string {');
    expect(panelCode).toContain("return typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '';");
    expect(panelCode).toContain("const version = e.view === 'about' && appVersionText()");
    expect(panelCode).toContain('aus-settings-entry-version');
    expect(panelCode).toContain('<span class="aus-settings-entry-label">${e.label}${version}</span>');
    // 侧栏品牌与关于页的版本号同样走这个函数，禁止各自再拼 typeof 判断
    expect(panelCode).toContain('v${appVersionText()}');
    expect(panelCode).toContain('当前 v${appVersionText()}');
  });

  it('版本号胶囊有独立样式，标题行内并排不换行', () => {
    expect(cssSrc).toContain('#aus-settings-entries .aus-settings-entry-version {');
    expect(cssSrc).toContain('#aus-settings-entries .aus-settings-entry-label {');
    expect(cssSrc).toContain('  display: inline-flex;\n  align-items: center;\n  gap: 6px;');
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
    expect(panelCode).toContain('const animateIn = view !== prevView;');
    expect(panelCode).toContain('if (animateIn && bottom) renderAfterPillStart(doc, renderTargetView);');
    // 桌面端同样不把动画起跑与建 DOM 挤在同一个任务里，否则首绘时动画已推进到中段
    expect(panelCode).toContain('requestAnimationFrame(renderTargetView);');
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

describe('安卓返回键：先关浮层 → 逐页回退 → 栈空才关面板', () => {
  it('切页时把上一页压进浏览栈，由返回键触发的回退不再入栈', () => {
    expect(panelCode).toContain('if (!opts?.back) pushViewTrail(viewTrail, prevView, view);');
    expect(panelCode).toContain('const viewTrail: AppView[] = [];');
  });

  it('返回键按 浮层 → 上一页 → 关面板 的次序消费，且每次消费后把哨兵缓冲补满', () => {
    expect(panelCode).toContain('if (closeTopOverlay() || goBackInPanel()) {');
    expect(panelCode).toContain('fillBackGuard();');
    // 关面板必须是最后一步，不能再像改造前那样「按一次就关」
    const pop = panelCode.indexOf('if (closeTopOverlay() || goBackInPanel()) {');
    const close = panelCode.indexOf('try { closePanel(); } catch {}', pop);
    expect(pop).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(pop);
  });

  it('浮层优先收掉展开的下拉与历史详情窗口', () => {
    expect(panelCode).toContain(`[data-aus-drop-open="1"]`);
    expect(panelCode).toContain('for (const el of open) closeDropdownInstant(el);');
    expect(panelCode).toContain('if (activeHistoryDetailTs !== null) {');
  });

  it('回退走 switchView(prev, { back: true })，不会把回退动作再压栈', () => {
    expect(panelCode).toContain('switchView(prev, { back: true });');
  });

  it('平板横屏等宽度超过 760 的移动设备同样接管返回键', () => {
    expect(panelCode).toContain('return mobileDeviceHint();');
  });

  it('预先压多条哨兵，连按返回才不会一步越过酒馆页面', () => {
    // 缓冲深度与纯逻辑都集中在 back-guard 模块，面板只管读写宿主历史
    expect(panelCode).toContain("from './back-guard';");
    expect(panelCode).toContain('guardFillPlan(readGuardDepth(w.history.state), BACK_GUARD_DEPTH)');
    expect(panelCode).toContain('nextGuardState(w.history.state, depth)');
    // 落在自己压的哨兵条目上也要照常消费一层（老实现直接 return，表现为「按了没反应」）
    expect(panelCode).not.toContain('if (ev?.state && ev.state[AUS_BACK_FLAG]) return;');
    expect(panelCode).toContain('if (closeTopOverlay() || goBackInPanel()) {');
  });

  it('关面板时按已知深度一次退干净，不留下一按没反应的哨兵', () => {
    const rel = panelCode.indexOf('function releaseBackGuard(stepBack = true): void {');
    const body = panelCode.slice(rel, rel + 1200);
    expect(rel).toBeGreaterThan(-1);
    expect(body).toContain('w.history.go(-depth);');
    expect(body).toContain('stripGuardState(w.history?.state)');
    // 清理性后退回来的那次 popstate 必须放行
    expect(body).toContain('backGuardSkipUntil = nowTs() + 400;');
  });

  it('打开与关闭面板都清空浏览栈，避免下次打开残留上次路径', () => {
    const open = panelCode.indexOf('export function openPanel() {');
    const close = panelCode.indexOf('export function closePanel() {');
    expect(panelCode.slice(open, close)).toContain('viewTrail.length = 0;');
    const next = panelCode.indexOf('export function togglePanel()');
    expect(panelCode.slice(close, next)).toContain('viewTrail.length = 0;');
  });
});
