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

/** 图表实例 → 滑块句柄（用 WeakMap，实例销毁后自动回收） */
const chartHandles = new WeakMap<object, RangeZoomHandle>();

/** 各图表的视窗位置记忆（切换页面时保留；时间维度/筛选变化时整体清空） */
const storedRanges = new Map<string, { start: number; end: number }>();

export function getChartRange(key: string): { start: number; end: number } | null {
  return storedRanges.get(key) || null;
}

export function setChartRange(key: string, start: number, end: number): void {
  if (!key) return;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  storedRanges.set(key, { start, end });
}

export function clearChartRanges(): void {
  storedRanges.clear();
}

export type ChartZoomOptions = {
  doc: Document;
  chart: any;
  container: HTMLElement;
  left: number;
  right: number;
  bottom?: number;
  minSpan?: number;
  /** false 时不挂载（并清理旧滑块） */
  enabled?: boolean;
  /** 视窗位置记忆键：给了就按它保存/恢复 */
  rangeKey?: string;
};

/**
 * 给任意 ECharts 实例挂载视窗滑块，并与 inside dataZoom 双向同步。
 * 同一实例重复调用会先清理旧滑块，避免叠加。
 */
export function attachChartZoom(options: ChartZoomOptions): RangeZoomHandle | null {
  const { chart, container, enabled = true } = options;
  if (chart) detachChartZoom(chart);
  if (!chart || !enabled) return null;
  const rangeKey = options.rangeKey;
  const handle = attachRangeZoom({
    doc: options.doc,
    container,
    left: options.left,
    right: options.right,
    bottom: options.bottom,
    minSpan: options.minSpan,
    onChange: (start: number, end: number) => {
      if (rangeKey) setChartRange(rangeKey, start, end);
      try { chart.dispatchAction({ type: 'dataZoom', start, end }); } catch {}
    },
  });
  chartHandles.set(chart, handle);
  // 恢复上次视窗（切换页面回来时保持缩放任位置）
  const saved = rangeKey ? getChartRange(rangeKey) : null;
  if (saved) {
    handle.setRange(saved.start, saved.end);
    try { chart.dispatchAction({ type: 'dataZoom', start: saved.start, end: saved.end }); } catch {}
  }
  try {
    chart.off('datazoom');
    chart.on('datazoom', () => {
      try {
        const option = chart.getOption();
        const dataZoom = option && option.dataZoom && option.dataZoom[0];
        if (dataZoom) {
          handle.setRange(Number(dataZoom.start ?? 0), Number(dataZoom.end ?? 100));
          if (rangeKey) setChartRange(rangeKey, Number(dataZoom.start ?? 0), Number(dataZoom.end ?? 100));
        }
      } catch {}
    });
  } catch {}
  return handle;
}

export function detachChartZoom(chart: any): void {
  if (!chart) return;
  const handle = chartHandles.get(chart);
  if (!handle) return;
  try { handle.destroy(); } catch {}
  chartHandles.delete(chart);
}
