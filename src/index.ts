/**
 * API用量统计 — 阶段 1 入口
 * 样式：DeepSeek 官方浅色隔离；内容 1:1 保留脚本，阶段 1 打通定价/存储/拦截/余额与最小面板
 */
import { state, createNewSave } from './store/index';
import { loadHot, saveHot } from './store/persistence';
import { installInterception } from './services/interception';
import { injectPanel, refreshUI } from './ui/panel';
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

async function renderPlaceholder() {
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.renderExtensionTemplateAsync) {
      // 预留模板，当前走占位
    }
  } catch {}
  fallbackPlaceholder();
}

function fallbackPlaceholder() {
  const doc = getDoc();
  const host = doc.getElementById('extensions_settings2') ?? doc.getElementById('extensions_settings');
  if (!host) return;
  if (doc.getElementById('api-usage-stat-root')) return;
  const wrap = doc.createElement('div');
  wrap.id = 'api-usage-stat-root';
  wrap.setAttribute('data-extension', 'api-usage-stat');
  wrap.setAttribute('data-ds-theme', 'light');
  wrap.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header"><b>API用量统计</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
      <div class="inline-drawer-content" style="padding:12px;background:#fff;">
        <div data-extension="api-usage-stat" data-ds-theme="light">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">
            <div class="ds-card"><div class="ds-card-title">消费金额</div><div class="ds-card-val">¥0.00<small style="font-size:14px;color:#9CA3AF;margin-left:4px;">CNY</small></div></div>
            <div class="ds-card"><div class="ds-card-title">API 请求次数</div><div class="ds-card-val">0</div></div>
            <div class="ds-card"><div class="ds-card-title">Tokens</div><div class="ds-card-val">0</div></div>
          </div>
          <div style="font-size:11px;color:#9CA3AF;text-align:center;padding:6px;">样式已对齐 DeepSeek 官方 · 阶段 1 已接通定价/存储/拦截</div>
        </div>
      </div>
    </div>
  `;
  host.appendChild(wrap);
  setTimeout(() => injectPanel(), 100);
}

export async function onInstall() { console.log('[API用量统计] installed'); try { const { loadHot } = await import('./store/persistence'); await loadHot(); } catch {} }
export async function onUpdate() { console.log('[API用量统计] updated'); }
export async function onDelete() {
  console.log('[API用量统计] deleted');
  try {
    const doc = (window.parent as any)?.document ?? document;
    const root = doc.getElementById('api-usage-stat-root');
    if (root) root.remove();
    const dot = doc.getElementById('aus-peak-dot-indicator');
    if (dot) dot.remove();
  } catch {}
}
export function onEnable() { console.log('[API用量统计] enabled'); }
export function onDisable() { console.log('[API用量统计] disabled'); }
export async function onActivate() { ensureStyleScope(); }

async function init() {
  ensureStyleScope();
  await initStore();
  installInterception();
  const tryMount = () => { renderPlaceholder(); setTimeout(() => { injectPanel(); refreshUI(); createPeakDot(); }, 300); };
  if ((globalThis as any).SillyTavern?.getContext) tryMount(); else window.setTimeout(tryMount, 1500);
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, tryMount);
  } catch {}
  (globalThis as any).ApiUsageStat = { MODULE, refreshUI, updatePeakDot, state };
}

init();
