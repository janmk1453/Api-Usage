import { state } from '../store/index';

function isWeekend(ts: number) { const d = new Date(ts + 8 * 3600 * 1000).getUTCDay(); return d === 0 || d === 6; }
function isPeak(ts: number): boolean {
  if (isWeekend(ts)) return false;
  const d = new Date(ts);
  const mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440;
  for (const h of (state.settings as any).peakHours || []) {
    const sp = parseInt(h.start.split(':')[0]) * 60 + parseInt(h.start.split(':')[1] || '0');
    const ep = parseInt(h.end.split(':')[0]) * 60 + parseInt(h.end.split(':')[1] || '0');
    if (sp < ep) { if (mins >= sp && mins < ep) return true; } else if (mins >= sp || mins < ep) return true;
  }
  return false;
}

export function getPeakStatus(now = Date.now()) {
  if (isWeekend(now)) return { color: '#22c55e', label: '周末全天低谷' };
  if (isPeak(now)) return { color: '#ef4444', label: '高峰时段' };
  const d = new Date(now);
  const mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440;
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

export function createPeakDot() {
  const doc: any = (window.parent as any)?.document ?? document;
  if (doc.getElementById('aus-peak-dot-indicator')) return;
  const dot = doc.createElement('div');
  dot.id = 'aus-peak-dot-indicator';
  dot.style.cssText = 'position:fixed;width:18px;height:18px;border-radius:50%;z-index:3000;cursor:grab;opacity:0.85;border:2px solid rgba(0,0,0,0.25);transition:opacity 0.2s;user-select:none;touch-action:none;';
  let saved: any = null;
  try { const v = localStorage.getItem('ds_ds_peak_dot_pos'); if (v) saved = JSON.parse(v); } catch {}
  if (saved) { dot.style.left = saved.left + 'px'; dot.style.top = saved.top + 'px'; }
  else { dot.style.right = '16px'; dot.style.top = '60px'; }
  doc.body.appendChild(dot);
  updatePeakDot();
  setInterval(updatePeakDot, 30000);
  // 拖动
  let dragging = false;
  dot.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true; dot.style.cursor = 'grabbing';
    const rect = dot.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const onMove = (ev: MouseEvent) => {
      dot.style.left = (ev.clientX - sx) + 'px';
      dot.style.top = (ev.clientY - sy) + 'px';
      dot.style.right = 'auto';
    };
    const onUp = () => {
      dragging = false; dot.style.cursor = 'grab';
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      try { localStorage.setItem('ds_ds_peak_dot_pos', JSON.stringify({ left: parseInt(dot.style.left) || 0, top: parseInt(dot.style.top) || 0 })); } catch {}
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  });
}
