/**
 * 图表悬浮窗（tooltip）统一定位与外观（单一来源）
 *
 * 圆角直接对齐块（.ds-card）的圆角 —— style.css 里 `--ds-radius-card: 14px`，
 * 让 ECharts 浮层与页面卡片用同一套圆角语言；正文内边距同步放大一点，
 * 否则 14px 圆角会把默认 5px 内距里的文字切到弧线上。
 * 需要调整浮层外观时只改这里，禁止各图表自己写 borderRadius。
 *
 * 定位同样收在这里：ECharts 默认把 tooltip 的 DOM 挂在**图表容器自身**里，
 * 于是卡片/图表的 `overflow:hidden` 会把它按边缘切掉；靠近容器左/上边缘时
 * `refixTooltipPosition` 只翻面、不把坐标夹回 0，还会直接跑出屏幕（手机上尤其明显）。
 * 现在统一做两件事：
 *   1. `appendTo` → 每个 `[data-view]` 容器里一个铺满视口的 fixed 宿主，悬浮窗脱离所有
 *      overflow 裁剪，同时仍留在面板 DOM 内（formatter 里的 `var(--ds-*)` 主题变量才有效）；
 *   2. `position` → 按**视口**而不是图表盒子翻面 + 夹取，四周永远留 `8px`。
 * 也因此不要开 `confine`（它会按图表盒子再夹一次，把上面算好的视口位置顶回去）。
 */

export const CHART_TOOLTIP_SURFACE = {
  /** 与 .ds-card 的 --ds-radius-card 保持一致 */
  borderRadius: 14,
  /** 上/下 8、左/右 12：让 14px 圆角内部留出与卡片相近的呼吸感 */
  padding: [8, 12] as [number, number],
};

/** 悬浮窗与指针的间距（px） */
const TOOLTIP_GAP = 12;
/** 悬浮窗与视口四边的最小留白（px） */
const TOOLTIP_VIEWPORT_MARGIN = 8;
/** 悬浮窗最大宽度（px），窄屏再按视口宽度收一档 */
const TOOLTIP_MAX_WIDTH = 340;
/** 悬浮窗宿主标记，便于调试时定位 */
export const TOOLTIP_HOST_ATTR = 'data-aus-tooltip-host';

/** 每个视图容器一个宿主（WeakMap 跟着 DOM 走，容器没了自动回收） */
const tooltipHosts = new WeakMap<HTMLElement, HTMLElement>();

/**
 * 取（必要时创建）图表所在视图的悬浮窗宿主。
 *
 * 宿主是「铺满视口的 fixed 层」：既不会给 #aus-main 这类滚动容器制造溢出，
 * 也正好让 ECharts 的坐标换算（图表本地坐标 → 宿主本地坐标）等价于视口坐标。
 *
 * 注意**尺寸不能是 0**：zrender 会往宿主里插 4 个 left/right/top/bottom 标记 div，
 * 用它们的屏幕坐标建四角变换矩阵；宿主 0×0 时四个标记重合、矩阵行列式为 0，
 * 换算直接失败（tooltip 被画到 translate(0,0)，也就是视口左上角）。
 */
function tooltipHost(chartEl: HTMLElement): HTMLElement | null {
  const doc = chartEl?.ownerDocument;
  if (!doc) return null;
  const anchor =
    (chartEl.closest?.('[data-view]') as HTMLElement | null) ||
    doc.getElementById('aus-panel');
  if (!anchor) return null;
  const cached = tooltipHosts.get(anchor);
  if (cached && cached.isConnected && cached.parentElement === anchor) return cached;
  const host = doc.createElement('div');
  host.setAttribute(TOOLTIP_HOST_ATTR, '1');
  host.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;overflow:visible;pointer-events:none;';
  anchor.appendChild(host);
  tooltipHosts.set(anchor, host);
  return host;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * 悬浮窗落点（纯几何，单测覆盖）：先按指针右下放，放不下翻到左/上侧，最后夹回视口。
 * 入参与返回值都是**视口坐标**（相对浏览器窗口左上角），不碰 DOM 也不读设备像素比。
 *
 * @param pointerX 指针在视口中的横坐标
 * @param pointerY 指针在视口中的纵坐标
 * @param tipWidth 悬浮窗宽（含内距与描边）
 * @param tipHeight 悬浮窗高
 * @param viewWidth 视口宽（取不到时传 0，表示不夹取）
 * @param viewHeight 视口高（同上）
 */
export function placeChartTooltip(
  pointerX: number,
  pointerY: number,
  tipWidth: number,
  tipHeight: number,
  viewWidth: number,
  viewHeight: number,
): [number, number] {
  const width = Math.max(0, Number(tipWidth) || 0);
  const height = Math.max(0, Number(tipHeight) || 0);
  let x = pointerX + TOOLTIP_GAP;
  let y = pointerY + TOOLTIP_GAP;
  // 右侧/下方放不下就翻到指针左/上侧（按视口判断，而不是按图表盒子）
  if (viewWidth > 0 && x + width > viewWidth - TOOLTIP_VIEWPORT_MARGIN) {
    x = pointerX - TOOLTIP_GAP - width;
  }
  if (viewHeight > 0 && y + height > viewHeight - TOOLTIP_VIEWPORT_MARGIN) {
    y = pointerY - TOOLTIP_GAP - height;
  }
  // 最后夹回视口：左上不再变负数，悬浮窗不会被屏幕边缘切掉
  if (viewWidth > 0) {
    x = clampNumber(x, TOOLTIP_VIEWPORT_MARGIN, Math.max(TOOLTIP_VIEWPORT_MARGIN, viewWidth - width - TOOLTIP_VIEWPORT_MARGIN));
  }
  if (viewHeight > 0) {
    y = clampNumber(y, TOOLTIP_VIEWPORT_MARGIN, Math.max(TOOLTIP_VIEWPORT_MARGIN, viewHeight - height - TOOLTIP_VIEWPORT_MARGIN));
  }
  return [x, y];
}

/** ECharts position 回调拿到的尺寸信息 */
export interface ChartTooltipSize {
  viewSize?: number[];
  contentSize?: number[];
}

export interface ChartTooltipPlacement {
  /** ECharts 会以 `appendTo(api.getDom())` 调用；返回 null 时退回默认（挂在图表容器内） */
  appendTo: () => HTMLElement | null;
  /** 视口感知定位：先按指针右下放，放不下翻面，最后夹回视口 */
  position: (point: number[], params: unknown, dom: HTMLElement, rect: unknown, size: ChartTooltipSize) => [number, number];
  /** 允许换行 + 限宽，避免长模型名把悬浮窗撑出屏幕 */
  extraCssText: string;
}

/**
 * 图表悬浮窗统一挂载点与定位（每个图表实例传入自己的容器元素）。
 *
 * 用法：
 * ```ts
 * tooltip: { trigger: 'axis', ...CHART_TOOLTIP_SURFACE, ...chartTooltipPlacement(el) }
 * ```
 */
export function chartTooltipPlacement(chartEl: HTMLElement): ChartTooltipPlacement {
  const position: ChartTooltipPlacement['position'] = (point, _params, _dom, _rect, size) => {
    const rect = chartEl.getBoundingClientRect();
    const win = chartEl.ownerDocument?.defaultView || null;
    const contentSize = size?.contentSize || [0, 0];
    const tipWidth = Math.max(0, Number(contentSize[0]) || 0);
    const tipHeight = Math.max(0, Number(contentSize[1]) || 0);
    // 视口尺寸优先取真实窗口；取不到就退回图表自身尺寸（等价旧行为，至少不会跑偏太多）
    const viewWidth = (win?.innerWidth || 0) || Math.round(rect.width) || 0;
    const viewHeight = (win?.innerHeight || 0) || Math.round(rect.height) || 0;
    const pointerX = rect.left + (Number(point?.[0]) || 0);
    const pointerY = rect.top + (Number(point?.[1]) || 0);
    const [x, y] = placeChartTooltip(pointerX, pointerY, tipWidth, tipHeight, viewWidth, viewHeight);
    // ECharts 的 position 返回值是**图表本地坐标**，由 zrender 按实测几何换算到宿主坐标，
    // 所以这里把视口落点减掉图表矩形原点即可；坐标换算与宿主的定位方式无关。
    return [x - rect.left, y - rect.top];
  };

  return {
    appendTo: () => tooltipHost(chartEl),
    position,
    extraCssText:
      'max-width:min(' + TOOLTIP_MAX_WIDTH + 'px, calc(100vw - ' + TOOLTIP_VIEWPORT_MARGIN * 2 + 'px));' +
      'box-sizing:border-box;white-space:normal;overflow-wrap:break-word;',
  };
}
