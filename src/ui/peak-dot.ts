import { state } from '../store/index';
import { isChinaHoliday, isExtraOffDay, isPeakHour, isWeekendDay } from '../utils/date';

function isPeak(ts: number): boolean {
  const hours = (state.settings as any).peakHours || [];
  return isPeakHour(ts, hours, (state.settings as any).extraOffDays);
}

export function getPeakStatus(now = Date.now()) {
  const extraOffDays = (state.settings as any).extraOffDays;
  if (isWeekendDay(now)) return { color: '#22c55e', label: '周末全天低谷' };
  if (isChinaHoliday(now)) return { color: '#22c55e', label: '法定节假日全天低谷' };
  if (isExtraOffDay(now, extraOffDays)) return { color: '#22c55e', label: '自定义空闲日全天低谷' };
  if (isPeak(now)) return { color: '#ef4444', label: '高峰时段' };
  const d = new Date(now);
  const mins = d.getHours() * 60 + d.getMinutes();
  let nearest = 1440;
  for (const h of (state.settings as any).peakHours || []) {
    const sp = parseInt(h.start.split(':')[0]) * 60 + parseInt(h.start.split(':')[1] || '0');
    let diff = sp - mins; if (diff < 0) diff += 1440; if (diff < nearest) nearest = diff;
  }
  if (nearest <= 10) return { color: '#eab308', label: `距高峰 ${nearest} 分` };
  return { color: '#22c55e', label: '非高峰' };
}

export function updatePeakDot() {
  const doc: any = (window.parent as any)?.document ?? document;
  const dot = doc.getElementById('aus-peak-dot-indicator') as HTMLElement | null;
  if (!dot) return;
  if (state.settings.peakDot === false) { dot.style.display = 'none'; return; }
  dot.style.display = 'block';
  const st = getPeakStatus();
  dot.style.background = st.color;
  dot.style.boxShadow = `0 0 8px ${st.color}`;
  dot.title = `API用量统计 · ${st.label}`;
}

let peakTimer: any = null;
function clampPos(left: number, top: number) {
  const w = (window.parent as any)?.innerWidth ?? window.innerWidth;
  const h = (window.parent as any)?.innerHeight ?? window.innerHeight;
  const cl = Math.min(Math.max(left, 0), w - 40);
  const ct = Math.min(Math.max(top, 0), h - 40);
  return { left: cl, top: ct };
}

export function stopPeakDot() {
  if (peakTimer) { try { clearInterval(peakTimer); } catch {} peakTimer = null; }
  try {
    const doc: any = (window.parent as any)?.document ?? document;
    doc.getElementById('aus-peak-dot-indicator')?.remove();
  } catch {}
}

export function createPeakDot() {
  const doc: any = (window.parent as any)?.document ?? document;
  if (doc.getElementById('aus-peak-dot-indicator')) return;
  const dot = doc.createElement('div');
  dot.id = 'aus-peak-dot-indicator';
  dot.style.cssText = 'position:fixed;width:18px;height:18px;border-radius:50%;z-index:3000;cursor:grab;opacity:0.85;border:2px solid rgba(0,0,0,0.25);transition:opacity 0.2s;user-select:none;touch-action:none;';
  let saved: any = null;
  try { const v = localStorage.getItem('ds_ds_peak_dot_pos'); if (v) saved = JSON.parse(v); } catch {}
  if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
    const c = clampPos(saved.left, saved.top);
    dot.style.left = c.left + 'px'; dot.style.top = c.top + 'px';
  } else { dot.style.right = '16px'; dot.style.top = '60px'; }
  doc.body.appendChild(dot);
  updatePeakDot();
  peakTimer = setInterval(updatePeakDot, 30000);
  // 拖动 - Pointer Events (鼠标+触摸)
  dot.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault();
    try { dot.setPointerCapture(e.pointerId); } catch {}
    dot.style.cursor = 'grabbing';
    const rect = dot.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const onMove = (ev: PointerEvent) => {
      dot.style.right = 'auto';
      dot.style.left = ev.clientX - sx + 'px';
      dot.style.top = ev.clientY - sy + 'px';
    };
    const onUp = (ev: PointerEvent) => {
      dot.style.cursor = 'grab';
      dot.removeEventListener('pointermove', onMove);
      dot.removeEventListener('pointerup', onUp);
      try { dot.releasePointerCapture(ev.pointerId); } catch {}
      const left = parseInt(dot.style.left) || 0;
      const top = parseInt(dot.style.top) || 0;
      const c = clampPos(left, top);
      dot.style.left = c.left + 'px'; dot.style.top = c.top + 'px';
      try { localStorage.setItem('ds_ds_peak_dot_pos', JSON.stringify({ left: c.left, top: c.top })); } catch {}
    };
    dot.addEventListener('pointermove', onMove);
    dot.addEventListener('pointerup', onUp);
  });
}
