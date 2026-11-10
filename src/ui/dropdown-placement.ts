/**
 * 下拉浮层定位的纯几何计算（概览「余额口径」等需要按触发元素实测位置摆放的浮层）。
 *
 * 为什么不用 position: fixed + 视口坐标：fixed 的包含块会被任意带 transform /
 * filter / will-change 的祖先劫持（切页入场动画、宿主主题的变换都会触发），此时
 * 用 getBoundingClientRect 算出的视口坐标会被当成"相对祖先"的坐标写进去，浮层就
 * 整体错位——移动端尤其常见。这里统一改成：宿主（position: relative 的卡片）内
 * absolute 定位，坐标 = 视口坐标之差，与祖先变换无关，也不需要视口是固定的。
 */

export interface DropdownViewportRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface DropdownPlacementInput {
  /** 触发胶囊在视口中的矩形 */
  anchor: DropdownViewportRect;
  /** 定位宿主（position: relative 的卡片）左上角在视口中的坐标，结果以此处为原点 */
  host: { left: number; top: number };
  /** 允许展开的可见范围（视口矩形，通常是滚动容器或窗口） */
  bounds: DropdownViewportRect;
  /** 下拉内容估算高度 */
  estimatedHeight: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  /** 与触发胶囊之间的间距 */
  gap?: number;
  /** 与可见范围边缘的最小留白 */
  margin?: number;
}

export interface DropdownPlacementResult {
  /** 相对宿主的 left */
  left: number;
  /** 相对宿主的 top */
  top: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

export function placeDropdownRelativeToHost(input: DropdownPlacementInput): DropdownPlacementResult {
  const gap = input.gap ?? 6;
  const margin = input.margin ?? 8;
  const minWidth = input.minWidth ?? 160;
  const maxWidth = input.maxWidth ?? 280;
  const minHeight = input.minHeight ?? 120;

  const { anchor, host, bounds } = input;
  const boundsWidth = Math.max(0, bounds.right - bounds.left);
  const width = Math.min(maxWidth, Math.max(minWidth, boundsWidth - margin * 2));

  // 水平：默认右边缘对齐触发胶囊右边缘，再夹进可见范围（先让右边缘不越界，再保左边缘留白）
  let left = Math.round(anchor.right - width);
  left = Math.min(left, Math.round(bounds.right - margin - width));
  left = Math.max(left, Math.round(bounds.left + margin));

  // 垂直：优先贴在胶囊下方，下方放不下且上方更宽松时上翻
  const below = bounds.bottom - margin - (anchor.bottom + gap);
  const above = anchor.top - gap - (bounds.top + margin);
  const openUp = below < input.estimatedHeight && above > below;
  const room = openUp ? above : below;
  const height = Math.max(minHeight, Math.min(input.estimatedHeight, Math.floor(room)));
  const top = openUp
    ? Math.round(anchor.top - gap - height)
    : Math.round(anchor.bottom + gap);

  return {
    left: left - Math.round(host.left),
    top: top - Math.round(host.top),
    width: Math.round(width),
    maxHeight: Math.round(height),
    openUp,
  };
}
