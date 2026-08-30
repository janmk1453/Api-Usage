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

const MODULE = 'api_usage_stat';

function getDoc(): Document { return (window.parent as any)?.document ?? document; }
function ensureStyleScope() { document.documentElement.setAttribute('data-extension', 'api-usage-stat'); }

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
  console.log('[API用量统计] 魔法棒入口已注入');
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
export async function onActivate() { ensureStyleScope(); try { injectWandEntry(); ensureWandEntry(); } catch {} }

async function init() {
  ensureStyleScope();
  // 隔离数据初始化错误，不影响入口注入
  try { await initStore(); } catch (e) { console.error('[API用量统计] initStore 失败', e); }
  try { installInterception(); } catch {}
  const mount = () => {
    try { createPanel(); } catch {}
    try { ensureWandEntry(); } catch {}
    try { createPeakDot(); } catch {}
    try { refreshUI(); } catch {}
  };
  if ((globalThis as any).SillyTavern?.getContext) mount();
  else window.setTimeout(mount, 1500);
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, () => { try { createPanel(); } catch {} try { ensureWandEntry(); } catch {} try { refreshUI(); } catch {} });
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_INITIALIZED, () => { try { ensureWandEntry(); } catch {} });
  } catch {}
  try { getDoc().addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); }); } catch {}
  (globalThis as any).ApiUsageStat = { MODULE, refreshUI, updatePeakDot, openPanel, closePanel, togglePanel, state, injectWandEntry: ensureWandEntry };
}

init();
