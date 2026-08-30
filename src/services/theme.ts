import { state } from '../store/index';
import { saveHot } from '../store/persistence';

export function applyTheme(theme?: string) {
  const t = (theme || (state.settings as any).theme || 'light') as string;
  const mode = t === 'dark' ? 'dark' : 'light';
  try {
    const doc = (window.parent as any)?.document ?? document;
    const panel = doc.getElementById('aus-panel') as HTMLElement | null;
    if (panel) panel.setAttribute('data-ds-theme', mode);
    // 同时在宿主根上标记，便于调试
    document.documentElement.setAttribute('data-ds-theme', mode);
    doc.documentElement.setAttribute('data-ds-theme', mode);
  } catch {}
}

export function setTheme(mode: 'light' | 'dark') {
  (state.settings as any).theme = mode;
  try { saveHot({ settings: state.settings }); } catch {}
  applyTheme(mode);
}
