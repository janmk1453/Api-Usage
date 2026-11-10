import { describe, it, expect } from 'vitest';
import { placeDropdownRelativeToHost } from './dropdown-placement';

const anchor = (left: number, right: number, top: number, bottom: number) => ({ left, right, top, bottom });

const base = {
  host: { left: 20, top: 100 },
  bounds: { left: 0, right: 400, top: 60, bottom: 800 },
  estimatedHeight: 200,
};

describe('placeDropdownRelativeToHost 下拉定位几何', () => {
  it('默认右边缘对齐触发胶囊右边缘，宽度取 280 上限', () => {
    const r = placeDropdownRelativeToHost({ ...base, anchor: anchor(150, 360, 140, 170) });
    expect(r.width).toBe(280);
    expect(r.left).toBe(360 - 280 - 20); // 视口 80 → 相对宿主 60
    expect(r.top).toBe(170 + 6 - 100);
    expect(r.openUp).toBe(false);
  });

  it('右侧空间不足时整体左移，保证右边缘不越过留白', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      bounds: { left: 0, right: 300, top: 60, bottom: 800 },
      anchor: anchor(150, 295, 140, 170),
    });
    // 视口 right 300 - margin 8 - width 280 = 12，再换算成相对宿主（host.left = 20）
    expect(r.left).toBe(12 - 20);
  });

  it('窄视口下宽度被可见范围收窄到 bounds - 2*margin', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      bounds: { left: 0, right: 260, top: 60, bottom: 800 },
      anchor: anchor(120, 240, 140, 170),
    });
    expect(r.width).toBe(244);
    expect(r.left).toBe(8 - 20); // 左边缘贴留白（视口 8 相对宿主 -12）
  });

  it('极窄可见范围低于最小宽度时保持最小宽度而不是压成 0', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      bounds: { left: 0, right: 120, top: 60, bottom: 800 },
      anchor: anchor(20, 100, 140, 170),
    });
    expect(r.width).toBe(160);
  });

  it('下方空间不足且上方更宽松时向上翻，底边贴住胶囊上沿间距', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      bounds: { left: 0, right: 400, top: 60, bottom: 400 },
      anchor: anchor(150, 360, 300, 330),
    });
    expect(r.openUp).toBe(true);
    expect(r.maxHeight).toBe(200); // 上方空间充足，用估算高度
    expect(r.top).toBe(300 - 6 - 200 - 100);
  });

  it('上下都放不下时优先下方并压缩 maxHeight 到可用空间', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      bounds: { left: 0, right: 400, top: 60, bottom: 400 },
      anchor: anchor(150, 360, 100, 130),
    });
    // below = 400 - 8 - 136 = 256；above = 100 - 6 - 68 = 26 → 走下方
    expect(r.openUp).toBe(false);
    expect(r.maxHeight).toBe(200); // 256 > 200，不压缩
    const tight = placeDropdownRelativeToHost({
      ...base,
      bounds: { left: 0, right: 400, top: 60, bottom: 260 },
      anchor: anchor(150, 360, 100, 130),
    });
    expect(tight.openUp).toBe(false);
    expect(tight.maxHeight).toBe(120); // below = 260 - 8 - 136 = 116 → 低于最小高度，压到 120
  });

  it('可用空间低于最小高度时仍保留 120 的最小可视高度', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      bounds: { left: 0, right: 400, top: 60, bottom: 200 },
      anchor: anchor(150, 360, 100, 130),
    });
    expect(r.openUp).toBe(false);
    expect(r.maxHeight).toBe(120);
  });

  it('宿主不在视口原点时结果换算成相对宿主的坐标', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      host: { left: 100, top: 250 },
      anchor: anchor(150, 360, 300, 330),
    });
    expect(r.left).toBe(360 - 280 - 100);
    expect(r.top).toBe(336 - 250);
  });

  it('结果统一取整，避免半像素抖动', () => {
    const r = placeDropdownRelativeToHost({
      ...base,
      host: { left: 20.4, top: 100.6 },
      bounds: { left: 0, right: 400.7, top: 60, bottom: 800 },
      anchor: anchor(150.3, 359.6, 140.2, 170.9),
    });
    expect(Number.isInteger(r.left)).toBe(true);
    expect(Number.isInteger(r.top)).toBe(true);
    expect(Number.isInteger(r.width)).toBe(true);
    expect(Number.isInteger(r.maxHeight)).toBe(true);
  });
});
