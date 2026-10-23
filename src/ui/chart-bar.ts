/**
 * 柱状图柱子形状（单一来源）
 *
 * 圆角口径按参考效果定：**圆角半径 ≈ 柱宽的 1/6**（截图实测柱宽 38px、圆角 6px，比例 0.16）。
 * 旧实现写死 `[4,4,0,0]`，柱宽只有 6-8px 时会被夹到半宽，顶部变成"子弹头"，
 * 与参考效果的「圆角矩形」手感差很多；改为按估算柱宽等比换算后，
 * 宽柱(16-18px)≈3px、窄柱(8px)≈2px，任意密度下都是同一个观感。
 * 只给最顶段加圆角，中间段与柱底保持直角（堆叠才无缝）。
 */
export const BAR_RADIUS_RATIO = 1 / 6;
/** 堆叠柱的中间段与柱底：直角 */
export const BAR_SQUARE: number[] = [0, 0, 0, 0];

/** 按柱宽换算顶部圆角 [左上, 右上, 右下, 左下] */
export function barTopRadius(barWidthPx: number): number[] {
  const width = Number.isFinite(barWidthPx) ? barWidthPx : 16;
  const radius = Math.max(2, Math.min(8, Math.round(width * BAR_RADIUS_RATIO)));
  return [radius, radius, 0, 0];
}

/**
 * 估算单根柱的实际宽度：绘图区宽 ÷ 类目数 × 0.8（ECharts 默认 barCategoryGap 20%），
 * 再与 barMaxWidth 取小。用于给 borderRadius 选一个跟视觉柱宽匹配的半径。
 */
export function estimateBarWidth(
  containerWidth: number,
  plotReservePx: number,
  categoryCount: number,
  maxBarWidth: number,
): number {
  const plotWidth = Math.max(120, containerWidth - plotReservePx);
  const band = plotWidth / Math.max(1, categoryCount);
  return Math.min(maxBarWidth, Math.max(2, band * 0.8));
}
