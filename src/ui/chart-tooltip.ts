/**
 * 图表悬浮窗（tooltip）统一外观、定位与边界约束（单一来源）
 *
 * 圆角直接对齐块（.ds-card）的圆角 —— style.css 里 `--ds-radius-card: 14px`，
 * 让 ECharts 浮层与页面卡片用同一套圆角语言；正文内边距同步放大一点，
 * 否则 14px 圆角会把默认 5px 内距里的文字切到弧线上。
 * 需要调整浮层外观时只改这里，禁止各图表自己写 borderRadius。
 *
 * ## 为什么浮层必须留在图表容器内
 *
 * ECharts 默认把 tooltip 的 DOM 挂在图表容器里，外层的 `.ds-card` 又是
 * `overflow:hidden`，靠近边缘时浮层会被卡片直接切掉；贴左/上边缘时 ECharts 自带的
 * `refixTooltipPosition` 只翻面、不夹取坐标，翻过去还能跑到屏幕外。
 * 曾试过「`appendTo` 挂到铺满视口的 fixed 宿主 + 按视口翻面夹取」：桌面无头浏览器里
 * 指标很好，真机（安卓 WebView / VIA）上却更糟 —— 浮层偶尔唤不出、位置离指针很远、
 * 甚至钻到别的元素下面。根因是那条路要求「页面是一个干净的视口」：跨层叠上下文、
 * 带缩放的 WebView 里，zrender 靠四角标记算的坐标矩阵并不可靠，fixed 层还会跟底栏
 * 抢层级。所以现在改成**不出容器**，只做三件事：
 *
 *   1. `position` 自己算：图表容器坐标系内「指针右下优先 → 放不下翻面 → 还放不下就
 *      以指针为中心」再夹回容器（纯函数 `placeChartTooltip`，单测覆盖），
 *      不再依赖 ECharts 那套「只翻面不夹取」的逻辑；
 *   2. `confine` 兜底：ECharts 会按图表视口再夹一次，坐标已在上面的范围内时是空操作；
 *   3. CSS 把浮层宽高上限压到容器 100%，保证「浮层永不比容器大」——
 *      否则 confine 遇到超尺寸浮层只会把起点压到 0，照样溢出。
 *
 * 代价是浮层会压住部分图表内容，但换来的是：不被卡片裁掉、不出屏、不压到别的位置、
 * 不会被别的元素盖住，且完全不依赖浮层与视口的相对几何。
 */

/** 悬浮窗与指针的间距（px） */
export const TOOLTIP_GAP = 12;

export const CHART_TOOLTIP_SURFACE = {
  /** 与 .ds-card 的 --ds-radius-card 保持一致 */
  borderRadius: 14,
  /** 上/下 8、左/右 12：让 14px 圆角内部留出与卡片相近的呼吸感 */
  padding: [8, 12] as [number, number],
};

/** ECharts position 回调拿到的尺寸信息 */
export interface ChartTooltipSize {
  /** 图表视口尺寸 [宽, 高]（= 图表容器尺寸） */
  viewSize?: number[];
  /** 悬浮窗内容尺寸 [宽, 高] */
  contentSize?: number[];
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * 悬浮窗在**图表容器坐标系**里的落点（纯几何，单测覆盖）。
 *
 * 优先级：指针右下 → 翻到指针左上 → 两侧都放不下就以指针为中心；最后整体夹回容器，
 * 保证浮层完整落在图表内（因此不会被卡片的 overflow 裁掉，也不会跑出屏幕）。
 * 容器比浮层还小时（w > areaWidth）夹取退化为 0，浮层从容器左上开始，配合 CSS 的
 * `max-width:100%` 实际不会出现这种尺寸。
 *
 * @param pointerX 指针在图表容器内的横坐标
 * @param pointerY 指针在图表容器内的纵坐标
 * @param tipWidth 悬浮窗宽（含内距与描边）
 * @param tipHeight 悬浮窗高
 * @param areaWidth 图表容器宽（取不到时传 0，表示不夹取）
 * @param areaHeight 图表容器高（同上）
 */
export function placeChartTooltip(
  pointerX: number,
  pointerY: number,
  tipWidth: number,
  tipHeight: number,
  areaWidth: number,
  areaHeight: number,
): [number, number] {
  const width = Math.max(0, Number(tipWidth) || 0);
  const height = Math.max(0, Number(tipHeight) || 0);
  const px = Number.isFinite(pointerX) ? pointerX : 0;
  const py = Number.isFinite(pointerY) ? pointerY : 0;
  // 容器尺寸取不到（0 / NaN）时不做夹取：退化成旧的「只做右下偏移」，而不是把浮层压成 0,0
  const areaW = Number(areaWidth) > 0 ? Number(areaWidth) : Number.POSITIVE_INFINITY;
  const areaH = Number(areaHeight) > 0 ? Number(areaHeight) : Number.POSITIVE_INFINITY;
  const maxX = Math.max(0, areaW - width);
  const maxY = Math.max(0, areaH - height);

  let x = px + TOOLTIP_GAP;
  if (x > maxX) {
    const flipped = px - TOOLTIP_GAP - width;
    // 翻到左侧放得下就用翻面位置，否则退化为「以指针为中心」——避免浮层被推到离指针很远的角落
    x = flipped >= 0 ? flipped : px - width / 2;
  }

  let y = py + TOOLTIP_GAP;
  if (y > maxY) {
    const flipped = py - TOOLTIP_GAP - height;
    y = flipped >= 0 ? flipped : py - height / 2;
  }

  return [clampNumber(x, 0, maxX), clampNumber(y, 0, maxY)];
}

/**
 * ECharts `position` 回调：入参 `point` 已是图表容器内坐标，返回同坐标系落点。
 * 挂载点保持默认（图表容器内），因此这里不涉及任何跨容器坐标换算。
 */
export function chartTooltipPosition(
  point: number[],
  _params?: unknown,
  _dom?: HTMLElement,
  _rect?: unknown,
  size?: ChartTooltipSize,
): [number, number] {
  const viewSize = size?.viewSize || [0, 0];
  const contentSize = size?.contentSize || [0, 0];
  return placeChartTooltip(
    Number(point?.[0]) || 0,
    Number(point?.[1]) || 0,
    Math.max(0, Number(contentSize[0]) || 0),
    Math.max(0, Number(contentSize[1]) || 0),
    Math.max(0, Number(viewSize[0]) || 0),
    Math.max(0, Number(viewSize[1]) || 0),
  );
}

/**
 * 直接摊进 `tooltip` 配置：
 * ```ts
 * tooltip: { trigger: 'axis', ...CHART_TOOLTIP_CONFIG, formatter: ... }
 * ```
 *
 * `extraCssText` 里 `white-space:normal` 覆盖 ECharts 默认的 `nowrap`：长模型名换行，
 * 而不是把浮层撑到容器外面去。
 */
export const CHART_TOOLTIP_CONFIG = {
  ...CHART_TOOLTIP_SURFACE,
  confine: true,
  position: chartTooltipPosition,
  extraCssText:
    'max-width:100%;max-height:100%;box-sizing:border-box;white-space:normal;overflow-wrap:break-word;',
};

/* ------------------------------------------------------------------ *
 * 收起来：点别处 / 再点一下同一个点 / 滚页面 / 按 Esc / 切页
 *
 * 桌面端鼠标移开就会自己消失，移动端不会：触摸没有 mouseout，ECharts 的
 * hideLater 等不到 globalout，浮层一旦弹出就只能等下一次点击别的数据项时被替换，
 * 点空白、点别处、滚页面、切页面它都赖着不走。所以这里统一接管「收起」：
 *
 *   1. 点面板里任何地方 —— 先收掉**别的**图表的浮层（被点的那张留给 ECharts
 *      照常弹出或就地移动）；
 *   2. 触摸设备上「再点一下同一个点」—— 140ms 后比较浮层的位置与内容，
 *      没变化说明用户点的还是同一处数据（ECharts 没重画），这时才收起来；
 *      点到别的柱子时内容/位置会变，浮层跟着移动，不会被误关；
 *   3. 滚页面 / 按 Esc / 切页 —— 直接收起全部。
 * ------------------------------------------------------------------ */

/** 能收起悬浮窗的图表实例（只依赖这几个方法，测试里可传假对象） */
export interface TooltipDismissableChart {
  dispatchAction?: (payload: { type: string }) => void;
  getDom?: () => unknown;
  isDisposed?: () => boolean;
}

/** ECharts TooltipHTMLContent 给浮层写的固定 z-index，用来在容器里认出它 */
const TOOLTIP_Z_INDEX = 9999999;
/** 触摸设备上判断「还是原来那个提示」的回看延迟（要晚于 ECharts 处理 click） */
const TAP_TOGGLE_DELAY = 140;

const dismissableCharts = new Set<TooltipDismissableChart>();
let dismissListenersInstalled = false;

/** 当前设备是否没有 hover 能力（手机/平板 → 支持「再点一下收起」） */
function prefersTapDismiss(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: none)').matches
      : false;
  } catch {
    return false;
  }
}

function hideTipOf(chart: TooltipDismissableChart): void {
  try {
    chart.dispatchAction?.({ type: 'hideTip' });
  } catch {
    // 图表已 dispose / 容器已移除：忽略
  }
}

function pruneDisposed(): void {
  for (const chart of dismissableCharts) {
    try {
      if (chart.isDisposed?.()) dismissableCharts.delete(chart);
    } catch {
      dismissableCharts.delete(chart);
    }
  }
}

function domOf(chart: TooltipDismissableChart): Element | null {
  try {
    const dom = chart.getDom?.() as Element | null | undefined;
    return dom && typeof (dom as any).querySelector === 'function' ? dom : null;
  } catch {
    return null;
  }
}

function isInside(chart: TooltipDismissableChart, target: unknown): boolean {
  const dom = domOf(chart);
  if (!dom || !target) return false;
  if (dom === target) return true;
  try {
    return dom.contains(target as Node);
  } catch {
    return false;
  }
}

function tooltipNodeOf(chart: TooltipDismissableChart): HTMLElement | null {
  const dom = domOf(chart) as HTMLElement | null;
  if (!dom) return null;
  try {
    return dom.querySelector(`[style*="z-index: ${TOOLTIP_Z_INDEX}"]`) as HTMLElement | null;
  } catch {
    return null;
  }
}

/** 浮层位置 + 内容快照：变了说明用户点到了另一处数据，没变说明还是同一处 */
function tooltipSnapshot(chart: TooltipDismissableChart): string | null {
  const node = tooltipNodeOf(chart);
  if (!node || node.style.display === 'none') return null;
  return `${node.style.transform}|@{node.textContent || ''}`;
}

/**
 * 触摸设备：记下当前浮层快照，稍后比对。
 * 没变化 = 用户点的是同一处数据（ECharts 没有重画）→ 收起；
 * 变化了 = 点到别处、浮层已跟着移动 → 保持。
 */
function armTapToggle(chart: TooltipDismissableChart): void {
  const before = tooltipSnapshot(chart);
  if (!before) return; // 当前没显示：这一下交给 ECharts 正常弹出
  const timer = setTimeout(() => {
    if (tooltipSnapshot(chart) === before) hideTipOf(chart);
  }, TAP_TOGGLE_DELAY);
  (timer as unknown as { unref?: () => void })?.unref?.();
}

/** 收起全部图表的悬浮窗（切页、滚页面、Esc 用） */
export function hideAllChartTooltips(): void {
  pruneDisposed();
  for (const chart of dismissableCharts) hideTipOf(chart);
}

/**
 * 收起「不属于 target 所在图表」的悬浮窗：
 * target 在 A 图表里 → A 的浮层保留（ECharts 随后按新的点击位置重画或移动），收掉其它图表的；
 * target 为空（滚动 / 切页 / 面板外点击）→ 全部收起。
 */
export function dismissChartTooltipsFor(target: unknown): void {
  pruneDisposed();
  for (const chart of dismissableCharts) {
    if (isInside(chart, target)) continue;
    hideTipOf(chart);
  }
}

function installDismissListeners(): void {
  if (dismissListenersInstalled || typeof document === 'undefined') return;
  dismissListenersInstalled = true;
  const doc = document;
  const onPress = (event: Event): void => {
    const target = event.target;
    dismissChartTooltipsFor(target);
    if (!prefersTapDismiss()) return;
    for (const chart of dismissableCharts) {
      if (isInside(chart, target)) {
        armTapToggle(chart);
        break;
      }
    }
  };
  // 捕获阶段：先于 ECharts 自己的点击处理执行，收掉别的图表的旧浮层
  doc.addEventListener('pointerdown', onPress, true);
  // 老 WebView 可能不派发 pointerdown，touchstart 兜一层
  doc.addEventListener('touchstart', onPress, { capture: true, passive: true });
  // 滚动不冒泡，必须捕获阶段监听；滚页面就把浮层收掉，避免它“浮”在原地错位
  doc.addEventListener('scroll', () => hideAllChartTooltips(), true);
  doc.addEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideAllChartTooltips();
    },
    true,
  );
}

/**
 * 注册图表，让「点别处 / 再点一下 / 滚页面 / Esc / 切页」能收起它的悬浮窗。
 * 同一实例重复注册无副作用；已 dispose 的实例会在下次收尾时自动剔除。
 */
export function registerChartTooltipDismiss(chart: TooltipDismissableChart): void {
  if (!chart) return;
  dismissableCharts.add(chart);
  installDismissListeners();
}
