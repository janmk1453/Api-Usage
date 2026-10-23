/**
 * 图表悬浮窗（tooltip）统一外观（单一来源）
 *
 * 圆角直接对齐块（.ds-card）的圆角 —— style.css 里 `--ds-radius-card: 14px`，
 * 让 ECharts 浮层与页面卡片用同一套圆角语言；正文内边距同步放大一点，
 * 否则 14px 圆角会把默认 5px 内距里的文字切到弧线上。
 * 需要调整浮层外观时只改这里，禁止各图表自己写 borderRadius。
 */
export const CHART_TOOLTIP_SURFACE = {
  /** 与 .ds-card 的 --ds-radius-card 保持一致 */
  borderRadius: 14,
  /** 上/下 8、左/右 12：让 14px 圆角内部留出与卡片相近的呼吸感 */
  padding: [8, 12] as [number, number],
};
