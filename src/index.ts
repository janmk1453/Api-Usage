/**
 * API用量统计 — 全屏独立面板 + 魔法棒入口
 * 入口：酒馆左下角魔法棒（#extensionsMenu） → 点击打开全屏用量页
 * 面板：独立于酒馆的 #aus-overlay + #aus-panel 全屏页面，DeepSeek 浅色风格
 */
import { state } from './store/index';
import { repository } from './data/repository';
import { installInterception } from './services/interception';
import { createPanel, openPanel, closePanel, togglePanel, refreshUI } from './ui/panel';
import { createPeakDot, updatePeakDot } from './ui/peak-dot';
import { applyTheme } from './services/theme';
import { log } from './utils/logger';

const MODULE = 'api_usage_stat';

function getDoc(): Document { return (window.parent as any)?.document ?? document; }
function ensureStyleScope() {
  // 修复：禁止在宿主 html 根上设置 data-extension，避免 [data-extension]input 等选择器污染全站（如聊天输入框）
  // 隔离仅通过 #aus-panel[data-extension="api-usage-stat"] 实现
  try {
    document.documentElement.removeAttribute('data-extension');
    document.documentElement.removeAttribute('data-ds-theme');
    const doc = getDoc();
    doc.documentElement.removeAttribute('data-ds-theme');
    if (doc.documentElement.getAttribute('data-extension') === 'api-usage-stat' && doc.getElementById('aus-panel')) {
      doc.documentElement.removeAttribute('data-extension');
    }
  } catch {}
}

async function initStore() {
  await repository.hydrate();
}

function injectWandEntry() {
  const doc = getDoc();
  // 兼容多种 ST 版本：主菜单、扩展菜单、侧边栏
  const menu = doc.getElementById('extensionsMenu')
    || doc.getElementById('extensions_menu')
    || doc.querySelector('#extensionsMenu')
    || doc.querySelector('#extensions_menu')
    || doc.querySelector('.extensionsMenu')
    || doc.getElementById('extensions_settings')
    || doc.querySelector('#rm_extensions_block');
  if (!menu) return false;
  if (doc.getElementById('aus_wand_container')) return true;
  const container = doc.createElement('div');
  container.id = 'aus_wand_container';
  container.className = 'extension_container';
  container.innerHTML = '<div id="aus_wand_entry" class="list-group-item flex-container flexGap5" style="cursor:pointer;"><div class="fa-solid fa-chart-column extensionsMenuExtensionButton"></div>API用量统计</div>';
  try { menu.appendChild(container); } catch { return false; }
  const btn = doc.getElementById('aus_wand_entry');
  if (btn) btn.addEventListener('click', () => togglePanel());
  log.debug('魔法棒入口已注入');
  return true;
}

function ensureWandEntry() {
  if (injectWandEntry()) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (injectWandEntry() || tries > 20) clearInterval(timer);
  }, 500);
}

export async function onInstall() { log.debug('installed'); try { const { loadHot } = await import('./store/persistence'); await loadHot(); } catch {} }
export async function onUpdate() { log.debug('updated'); }
export async function onDelete() {
  log.debug('deleted');
  try { const { flushSaveHot } = await import('./store/persistence'); flushSaveHot(); } catch {}
  try {
    const doc = getDoc();
    doc.getElementById('aus-overlay')?.remove();
    doc.getElementById('aus-panel')?.remove();
    doc.getElementById('aus_wand_container')?.remove();
    doc.getElementById('aus-peak-dot-indicator')?.remove();
  } catch {}
  try { const m = await import('./ui/panel'); (m as any).resetPanelState?.(); } catch {}
  try { const m = await import('./ui/peak-dot'); (m as any).stopPeakDot?.(); } catch {}
  try { const m2 = await import('./services/balance'); (m2 as any).stopBalanceTimer?.(); } catch {}
  // 清理卸载残留
  try { localStorage.removeItem('ds_ds_webdav_pass'); } catch {}
  try { localStorage.removeItem('ds_ds_peak_dot_pos'); } catch {}
  try { localStorage.removeItem('ds_debug_log'); } catch {}
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.extensionSettings) { delete ctx.extensionSettings['api_usage_stat']; ctx.saveSettingsDebounced?.(); }
  } catch {}
  try { delete (globalThis as any).ApiUsageStat; delete (globalThis as any).ApiUsageStatInterceptor; } catch {}
}
export function onEnable() { log.debug('enabled'); try { import('./services/interception').then(m=>m.installInterception()); } catch {} try { import('./services/balance').then(m=> (m as any).restartBalanceTimer?.()); } catch {} }
export async function onDisable() {
  log.debug('disabled');
  try { const { flushSaveHot } = await import('./store/persistence'); flushSaveHot(); } catch {}
  try { import('./services/interception').then(m=> (m as any).uninstallInterception?.()); } catch {}
  try {
    const doc = getDoc();
    doc.getElementById('aus-overlay')?.remove();
    doc.getElementById('aus-panel')?.remove();
    doc.getElementById('aus_wand_container')?.remove();
    doc.getElementById('aus-peak-dot-indicator')?.remove();
  } catch {}
  try { const m = await import('./ui/panel'); (m as any).resetPanelState?.(); } catch {}
  try { const m = await import('./ui/peak-dot'); (m as any).stopPeakDot?.(); } catch {}
  try { const m2 = await import('./services/balance'); (m2 as any).stopBalanceTimer?.(); } catch {}
}
export async function onActivate() { ensureStyleScope(); try { injectWandEntry(); ensureWandEntry(); } catch {} }

async function init() {
  ensureStyleScope();
  try { applyTheme((state.settings as any).theme); } catch {}
  // 隔离数据初始化错误，不影响入口注入
  try { await initStore(); } catch (e) { console.error('[API用量统计] initStore 失败', e); }
  try { const m = await import('./services/balance'); (m as any).restartBalanceTimer?.(); } catch {}
  try { installInterception(); } catch {}
  const mount = () => {
    try { applyTheme((state.settings as any).theme); } catch {}
    try { createPanel(); } catch {}
    try { ensureWandEntry(); } catch {}
    try { createPeakDot(); } catch {}
    try { refreshUI(); } catch {}
  };
  if ((globalThis as any).SillyTavern?.getContext) mount();
  else window.setTimeout(mount, 1500);
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, () => { try { createPanel(); } catch {} try { ensureWandEntry(); } catch {} try { refreshUI(); } catch {} try { import('./services/interception').then(m=>m.installInterception()); } catch {} });
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_INITIALIZED, () => { try { ensureWandEntry(); } catch {} try { import('./services/interception').then(m=>m.installInterception()); } catch {} });
    ctx?.eventSource?.on?.(ctx?.event_types?.CHAT_CHANGED, () => { try { if ((state.settings as any).historyScope === 'current') refreshUI(); } catch {} });
    // ST 未就绪时轮询重试安装拦截（最多 6 次，间隔 1.5s，避免生成期间频繁打扰）
    let retry = 0;
    const timer = setInterval(() => {
      retry++;
      try {
        const ok = (globalThis as any).SillyTavern?.getContext?.()?.eventSource;
        if (ok) { try { if (installInterception()) clearInterval(timer); } catch {} }
      } catch {}
      if (retry > 6) clearInterval(timer);
    }, 1500);
  } catch {}
  try { getDoc().addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); }); } catch {}
  try { window.addEventListener('pagehide', () => { try { import('./store/persistence').then(m => (m as any).flushSaveHot?.()); } catch {} }); } catch {}
  // 扩展加载后延迟自动检查更新（6 小时节流）
  setTimeout(() => { try { import('./services/update').then(m => m.maybeAutoCheck()); } catch {} }, 3000);
  (globalThis as any).ApiUsageStat = { MODULE, refreshUI, updatePeakDot, openPanel, closePanel, togglePanel, state, injectWandEntry: ensureWandEntry };
}

init();
