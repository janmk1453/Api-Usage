import { describe, expect, it } from 'vitest';
import {
  CHART_TOOLTIP_CONFIG,
  CHART_TOOLTIP_SURFACE,
  TOOLTIP_GAP,
  chartTooltipPosition,
  placeChartTooltip,
} from './chart-tooltip';

// 手机窄屏下的一张图表：容器 340×220，悬浮窗 220×122
const W = 340;
const H = 220;
const TW = 220;
const TH = 122;

describe('placeChartTooltip', () => {
  it('空间够时放在指针右下（留 12px 间距）', () => {
    expect(placeChartTooltip(60, 40, TW, TH, W, H)).toEqual([60 + TOOLTIP_GAP, 40 + TOOLTIP_GAP]);
  });

  it('右下都放不下时翻到指针左上，且仍完整落在容器内', () => {
    const [x, y] = placeChartTooltip(300, 190, TW, TH, W, H);
    expect(x).toBe(300 - TOOLTIP_GAP - TW); // 68
    expect(y).toBe(190 - TOOLTIP_GAP - TH); // 56
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  });

  it('翻面也放不下时以指针为中心，而不是被推到容器角落', () => {
    const [x, y] = placeChartTooltip(170, 120, TW, TH, W, H);
    expect(x).toBe(170 - TW / 2); // 60，正好在容器内
    expect(y).toBe(120 - TH / 2); // 59
  });

  it('指针贴左上角时回到 0，不出现负坐标', () => {
    expect(placeChartTooltip(0, 0, TW, TH, W, H)).toEqual([TOOLTIP_GAP, TOOLTIP_GAP]);
  });

  it('指针贴右下角时夹在容器右下边界内', () => {
    const [x, y] = placeChartTooltip(W, H, TW, TH, W, H);
    expect(x).toBeLessThanOrEqual(W - TW);
    expect(y).toBeLessThanOrEqual(H - TH);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  });

  it('容器比悬浮窗还小时退化为左上角 0,0，不返回负数', () => {
    expect(placeChartTooltip(120, 90, 400, 300, W, H)).toEqual([0, 0]);
  });

  it('尺寸或容器传 0 / NaN 时不炸，按 0 处理', () => {
    expect(placeChartTooltip(Number.NaN, Number.NaN, 0, 0, W, H)).toEqual([12, 12]);
    expect(placeChartTooltip(10, 10, Number.NaN, Number.NaN, 0, 0)).toEqual([22, 22]);
  });

  it('不夹取模式（容器 0）保留旧行为：只做右下偏移', () => {
    expect(placeChartTooltip(40, 300, TW, TH, 0, 0)).toEqual([52, 312]);
  });
});

describe('chartTooltipPosition', () => {
  it('从 ECharts 的 point / size 里取坐标与尺寸', () => {
    const out = chartTooltipPosition([60, 40], undefined, undefined, undefined, {
      viewSize: [W, H],
      contentSize: [TW, TH],
    });
    expect(out).toEqual([72, 52]);
  });

  it('size 缺失时按 0 尺寸处理，只做偏移', () => {
    expect(chartTooltipPosition([10, 20])).toEqual([22, 32]);
  });
});

describe('CHART_TOOLTIP_CONFIG', () => {
  it('圆角内距与卡片一致', () => {
    expect(CHART_TOOLTIP_CONFIG.borderRadius).toBe(14);
    expect(CHART_TOOLTIP_CONFIG.padding).toEqual(CHART_TOOLTIP_SURFACE.padding);
  });

  it('开启 confine 并自带 position 回调', () => {
    expect(CHART_TOOLTIP_CONFIG.confine).toBe(true);
    expect(CHART_TOOLTIP_CONFIG.position).toBe(chartTooltipPosition);
  });

  it('宽高上限压到容器 100%，否则超尺寸浮层会被裁', () => {
    const css = CHART_TOOLTIP_CONFIG.extraCssText;
    expect(css).toContain('max-width:100%');
    expect(css).toContain('max-height:100%');
    expect(css).toContain('white-space:normal');
    expect(css).not.toContain('nowrap');
  });

  it('不再有 fixed 宿主的 appendTo（真机上是它把浮层搞乱的）', () => {
    expect(CHART_TOOLTIP_CONFIG).not.toHaveProperty('appendTo');
  });
});
