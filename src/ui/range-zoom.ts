/**
 * 自绘 X 轴视窗滑块（长条 + 两端圆点）。
 *
 * 为什么不用 ECharts 的 dataZoom.slider：它的手柄只监听 mousedown，
 * 触屏设备上抓不住；这里改成 Pointer Events + setPointerCapture，
 * 鼠标/触屏/手写笔一套逻辑，且可以自己控制尺寸与命中区域。
 */
export type RangeZoomHandle = {
  setRange(start: number, end: number): void;
  getRange(): { start: number; end: number };
  destroy(): void;
};

export type RangeZoomOptions = {
  doc: Document;
  /** 图表的定位容器（会被设为 position:relative） */
  container: HTMLElement;
  left: number;
  right: number;
  bottom?: number;
  /** 可视窗口最小占比（百分比） */
  minSpan?: number;
  onChange: (start: number, end: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function attachRangeZoom(options: RangeZoomOptions): RangeZoomHandle {
  const { doc, container, onChange } = options;
  const left = Math.max(0, options.left);
  const right = Math.max(0, options.right);
  const bottom = options.bottom ?? 4;
  const minSpan = Math.max(2, options.minSpan ?? 4);

  try { container.style.position = 'relative'; } catch {}

  const existing = container.querySelector('[data-range-zoom="1"]');
  if (existing) existing.remove();

  const root = doc.createElement('div');
  root.className = 'aus-range-zoom';
  root.setAttribute('data-range-zoom', '1');
  root.style.left = left + 'px';
  root.style.right = right + 'px';
  root.style.bottom = bottom + 'px';

  const track = doc.createElement('div');
  track.className = 'aus-range-zoom-track';
  const win = doc.createElement('div');
  win.className = 'aus-range-zoom-window';
  win.setAttribute('data-range-window', '1');
  const handleLeft = doc.createElement('div');
  handleLeft.className = 'aus-range-zoom-handle is-left';
  handleLeft.setAttribute('data-range-handle', 'left');
  const handleRight = doc.createElement('div');
  handleRight.className = 'aus-range-zoom-handle is-right';
  handleRight.setAttribute('data-range-handle', 'right');
  win.appendChild(handleLeft);
  win.appendChild(handleRight);
  root.appendChild(track);
  root.appendChild(win);
  container.appendChild(root);

  let start = 0;
  let end = 100;
  let dragging: 'move' | 'left' | 'right' | null = null;
  let dragStartX = 0;
  let dragStartValue = 0;
  let dragEndValue = 100;

  const paint = () => {
    win.style.left = start + '%';
    win.style.width = Math.max(0, end - start) + '%';
  };
  paint();

  const width = () => {
    const rect = root.getBoundingClientRect();
    return rect.width || 1;
  };

  const emit = () => {
    paint();
    onChange(start, end);
  };

  const onPointerDown = (event: any) => {
    const target = event.target as HTMLElement;
    const handle = target?.getAttribute?.('data-range-handle');
    const isWindow = !!target?.getAttribute?.('data-range-window');
    if (!handle && !isWindow) return;
    dragging = handle === 'left' ? 'left' : handle === 'right' ? 'right' : 'move';
    dragStartX = Number(event.clientX) || 0;
    dragStartValue = start;
    dragEndValue = end;
    root.classList.add('is-dragging');
    try { root.setPointerCapture(event.pointerId); } catch {}
    try { event.preventDefault(); } catch {}
    try { event.stopPropagation(); } catch {}
  };

  const onPointerMove = (event: any) => {
    if (!dragging) return;
    const delta = ((Number(event.clientX) || 0) - dragStartX) / width() * 100;
    if (dragging === 'move') {
      const span = dragEndValue - dragStartValue;
      start = clamp(dragStartValue + delta, 0, 100 - span);
      end = start + span;
    } else if (dragging === 'left') {
      start = clamp(dragStartValue + delta, 0, dragEndValue - minSpan);
      end = dragEndValue;
    } else {
      start = dragStartValue;
      end = clamp(dragEndValue + delta, dragStartValue + minSpan, 100);
    }
    emit();
    try { event.preventDefault(); } catch {}
  };

  const onPointerUp = (event: any) => {
    if (!dragging) return;
    dragging = null;
    root.classList.remove('is-dragging');
    try { root.releasePointerCapture(event.pointerId); } catch {}
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
  // 触屏上阻止长按选中与页面横向滚动（仅作用于滑块自身）
  root.addEventListener('touchstart', (event: any) => { try { event.preventDefault(); } catch {} }, { passive: false });

  return {
    setRange(nextStart: number, nextEnd: number) {
      const s = clamp(Number(nextStart) || 0, 0, 100);
      const e = clamp(Number(nextEnd) || 0, 0, 100);
      start = Math.min(s, e);
      end = Math.max(s, e);
      if (end - start < minSpan) end = Math.min(100, start + minSpan);
      paint();
    },
    getRange() { return { start, end }; },
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerUp);
      try { root.remove(); } catch {}
    },
  };
}
