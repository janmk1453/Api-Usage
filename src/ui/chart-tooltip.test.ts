import { describe, it, expect } from 'vitest';
import { placeChartTooltip, CHART_TOOLTIP_SURFACE } from './chart-tooltip';

// 视口 390×844（常见手机竖屏），悬浮窗 300×120
const VIEW_W = 390;
const VIEW_H = 844;
const TIP_W = 300;
const TIP_H = 120;

describe('placeChartTooltip 悬浮窗落点几何', () => {
  it('常规位置放在指针右下，留 12px 间距', () => {
    const [x, y] = placeChartTooltip(40, 300, TIP_W, TIP_H, VIEW_W, VIEW_H);
    expect(x).toBe(52);
    expect(y).toBe(312);
  });

  it('右侧放不下时翻到指针左侧，不越过右边留白', () => {
    // 指针 370：右侧只剩 20px，翻到左侧 370-12-300 = 58
    const [x] = placeChartTooltip(370, 300, TIP_W, TIP_H, VIEW_W, VIEW_H);
    expect(x).toBe(58);
    expect(x + TIP_W).toBeLessThanOrEqual(VIEW_W - 8);
  });

  it('贴左边缘时被夹回 8px，不会出现负坐标被屏幕裁掉', () => {
    // 指针 100、右侧放不下 → 翻到左侧得 100-12-300 = -212，再夹回 8
    const [x] = placeChartTooltip(100, 300, TIP_W, TIP_H, VIEW_W, VIEW_H);
    expect(x).toBe(8);
  });

  it('下方放不下时翻到指针上方', () => {
    const [x, y] = placeChartTooltip(40, 800, TIP_W, TIP_H, VIEW_W, VIEW_H);
    expect(y).toBe(800 - 12 - TIP_H);
    expect(x).toBe(52);
  });

  it('右下角同时放不下时翻到左上，且四边都不越界', () => {
    const [x, y] = placeChartTooltip(380, 830, TIP_W, TIP_H, VIEW_W, VIEW_H);
    // 380-12-300 = 68（仍在 8..82 之间），纵向 830-12-120 = 698
    expect(x).toBe(68);
    expect(x + TIP_W).toBeLessThanOrEqual(VIEW_W - 8);
    expect(y).toBe(830 - 12 - TIP_H);
  });

  it('贴近顶部但下方放得下时仍按右下放，不越过上边留白', () => {
    const [, y] = placeChartTooltip(40, 60, TIP_W, TIP_H, VIEW_W, VIEW_H);
    expect(y).toBe(72);
  });

  it('超高悬浮窗翻到上方仍越界时被夹回 8px', () => {
    // 指针 800、高 900：下方 32px 放不下 → 翻上得 800-12-900 = -112 → 夹回 8
    const [x, y] = placeChartTooltip(40, 800, TIP_W, 900, VIEW_W, VIEW_H);
    expect(y).toBe(8);
    expect(x).toBe(52);
  });

  it('悬浮窗比视口还宽时贴左上留白，不产生负坐标', () => {
    const [x, y] = placeChartTooltip(10, 10, 500, 900, VIEW_W, VIEW_H);
    expect(x).toBe(8);
    expect(y).toBe(8);
  });

  it('拿不到视口尺寸（传 0）时保持旧行为，不做任何夹取', () => {
    const [x, y] = placeChartTooltip(-50, -50, TIP_W, TIP_H, 0, 0);
    expect(x).toBe(-38);
    expect(y).toBe(-38);
  });

  it('尺寸非法时按 0 处理，落点仍是合法数字', () => {
    const [x, y] = placeChartTooltip(10, 10, Number.NaN, Number.NaN, VIEW_W, VIEW_H);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    expect(x).toBe(22);
    expect(y).toBe(22);
  });

  it('圆角与内距仍与卡片同源', () => {
    expect(CHART_TOOLTIP_SURFACE.borderRadius).toBe(14);
    expect(CHART_TOOLTIP_SURFACE.padding).toEqual([8, 12]);
  });
});
