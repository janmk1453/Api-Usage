import { state } from '../store/index';
import { saveHot } from '../store/persistence';

export function applyTheme(theme?: string) {
  const t = (theme || (state.settings as any).theme || 'light') as string;
  const mode = t === 'dark' ? 'dark' : 'light';
  try {
    const doc = (window.parent as any)?.document ?? document;
    const panel = doc.getElementById('aus-panel') as HTMLElement | null;
    if (panel) panel.setAttribute('data-ds-theme', mode);
    // 修复：严禁在宿主 documentElement 上设置 data-ds-theme / data-extension，避免全局样式污染（如 #send_textarea 跟随主题变白）
    // 之前 document.documentElement.setAttribute('data-ds-theme', ...) 会使 [data-extension]input 选择器命中全站输入框
    try {
      document.documentElement.removeAttribute('data-ds-theme');
      document.documentElement.removeAttribute('data-extension');
    } catch {}
    try {
      doc.documentElement.removeAttribute('data-ds-theme');
      // 仅当宿主根意外被污染时才移除，不影响面板本身的 data-extension
      if (doc.documentElement.getAttribute('data-extension') === 'api-usage-stat') {
        // 保留面板的隔离，宿主根不应有此属性
        const hasPanel = !!doc.getElementById('aus-panel');
        if (hasPanel) doc.documentElement.removeAttribute('data-extension');
      }
    } catch {}
  } catch {}
}

export function setTheme(mode: 'light' | 'dark') {
  (state.settings as any).theme = mode;
  try { saveHot({ settings: state.settings }); } catch {}
  applyTheme(mode);
}
