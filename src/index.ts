/**
 * API用量统计 — 全屏独立面板 + 魔法棒入口
 * 入口：酒馆左下角魔法棒（#extensionsMenu） → 点击打开全屏用量页
 * 面板：独立于酒馆的 #aus-overlay + #aus-panel 全屏页面，DeepSeek 浅色风格
 */
import { state, createNewSave } from './store/index';
import { loadHot, saveHot } from './store/persistence';
import { installInterception } from './services/interception';
import { createPanel, openPanel, closePanel, togglePanel, refreshUI } from './ui/panel';
import { createPeakDot, updatePeakDot } from './ui/peak-dot';

const MODULE = 'api_usage_stat';

function getDoc(): Document { return (window.parent as any)?.document ?? document; }
function ensureStyleScope() { document.documentElement.setAttribute('data-extension', 'api-usage-stat'); }

async function initStore() {
  const hot = await loadHot();
  if (hot) {
    if (hot.saves) state.saves = hot.saves;
    if (hot.currentSave) state.currentSave = hot.currentSave;
    if (hot.settings) state.settings = { ...state.settings, ...hot.settings };
    if (hot.balance) state.balance = hot.balance;
    if (hot.customBalance) state.customBalance = hot.customBalance;
    if (hot.messageCount) state.messageCount = hot.messageCount;
  }
  if (!state.currentSave || !state.saves[state.currentSave as string]) {
    const keys = Object.keys(state.saves);
    if (keys.length) state.currentSave = keys[0];
    else createNewSave();
    saveHot({ saves: state.saves, currentSave: state.currentSave, settings: state.settings, balance: state.balance, customBalance: state.customBalance });
  }
}

function injectWandEntry() {
  const doc = getDoc();
  const menu = doc.getElementById('extensionsMenu') || doc.querySelector('#extensionsMenu, #extensions_menu') as HTMLElement | null;
  if (!menu) return;
  if (doc.getElementById('aus_wand_container')) return;
  const container = doc.createElement('div');
  container.id = 'aus_wand_container';
  container.className = 'extension_container';
  container.innerHTML = '<div id="aus_wand_entry" class="list-group-item flex-container flexGap5"><div class="fa-solid fa-chart-column extensionsMenuExtensionButton"></div>API用量统计</div>';
  menu.appendChild(container);
  const btn = doc.getElementById('aus_wand_entry');
  if (btn) btn.addEventListener('click', () => togglePanel());
}

export async function onInstall() { console.log('[API用量统计] installed'); try { const { loadHot } = await import('./store/persistence'); await loadHot(); } catch {} }
export async function onUpdate() { console.log('[API用量统计] updated'); }
export async function onDelete() {
  console.log('[API用量统计] deleted');
  try {
    const doc = getDoc();
    doc.getElementById('aus-overlay')?.remove();
    doc.getElementById('aus-panel')?.remove();
    doc.getElementById('aus_wand_container')?.remove();
    doc.getElementById('aus-peak-dot-indicator')?.remove();
  } catch {}
}
export function onEnable() { console.log('[API用量统计] enabled'); }
export function onDisable() { console.log('[API用量统计] disabled'); }
export async function onActivate() { ensureStyleScope(); }

async function init() {
  ensureStyleScope();
  await initStore();
  installInterception();
  const mount = () => {
    createPanel();
    injectWandEntry();
    createPeakDot();
    refreshUI();
  };
  if ((globalThis as any).SillyTavern?.getContext) mount();
  else window.setTimeout(mount, 1500);
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, () => { createPanel(); injectWandEntry(); refreshUI(); });
  } catch {}
  try { getDoc().addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); }); } catch {}
  (globalThis as any).ApiUsageStat = { MODULE, refreshUI, updatePeakDot, openPanel, closePanel, togglePanel, state };
}

init();
