/**
 * API用量统计 — 全屏独立面板 + 魔法棒入口
 * 入口：酒馆左下角魔法棒（#extensionsMenu） → 点击打开全屏用量页
 * 面板：独立于酒馆的 #aus-overlay + #aus-panel 全屏页面，DeepSeek 浅色风格
 */
import { state } from './store/index';
import { repository } from './data/repository';
import { installInterception } from './services/interception';
import { createPanel, openPanel, closePanel, togglePanel, refreshUI, refreshTheme, resetPanelState } from './ui/panel';
import { createPeakDot, updatePeakDot, stopPeakDot } from './ui/peak-dot';
import { applyTheme, watchSystemTheme, unwatchSystemTheme } from './services/theme';
import { initTelemetry } from './services/telemetry';
import { log } from './utils/logger';
import { installBackDebug } from './ui/back-debug';

// 返回键诊断日志（临时排查用）：入口尽早安装，面板打开之前的返回事件也要记上
try { installBackDebug(); } catch {}

const MODULE = 'api_usage_stat';
let wandRetryTimer: any = null;
let mountRetryTimer: any = null;
let interceptionRetryTimer: any = null;

function onEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closePanel();
}

function onPageHide() {
  try {
    import('./store/persistence').then(m => m.flushSaveHot()).catch(() => {});
  } catch {}
}

function cleanupRuntimeBindings() {
  if (wandRetryTimer) { try { clearInterval(wandRetryTimer); } catch {} wandRetryTimer = null; }
  if (mountRetryTimer) { try { clearTimeout(mountRetryTimer); } catch {} mountRetryTimer = null; }
  if (interceptionRetryTimer) { try { clearInterval(interceptionRetryTimer); } catch {} interceptionRetryTimer = null; }
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.eventSource?.off) {
      ctx.eventSource.off(ctx.event_types?.APP_READY, onAppReady);
      ctx.eventSource.off(ctx.event_types?.APP_INITIALIZED, onAppInitialized);
      ctx.eventSource.off(ctx.event_types?.CHAT_CHANGED, onChatChanged);
    }
  } catch {}
  try { getDoc().removeEventListener('keydown', onEscapeKey); } catch {}
  try { window.removeEventListener('pagehide', onPageHide); } catch {}
}

function onAppReady() {
  try { createPanel(); } catch {}
  try { ensureWandEntry(); } catch {}
  try { refreshUI(); } catch {}
  try { import('./services/interception').then(m=>m.installInterception()).catch(() => {}); } catch {}
  try { import('./services/agent-usage/collector').then(m => m.initAgentUsage()).catch(() => {}); } catch {}
}

function onAppInitialized() {
  try { ensureWandEntry(); } catch {}
  try { import('./services/interception').then(m=>m.installInterception()).catch(() => {}); } catch {}
  try { import('./services/agent-usage/collector').then(m => m.initAgentUsage()).catch(() => {}); } catch {}
}

function onChatChanged() {
  try { if ((state.settings as any).historyScope === 'current') refreshUI(); } catch {}
}

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
  if (injectWandEntry()) {
    if (wandRetryTimer) {
      clearInterval(wandRetryTimer);
      wandRetryTimer = null;
    }
    return;
  }
  if (wandRetryTimer) clearInterval(wandRetryTimer);
  let tries = 0;
  wandRetryTimer = setInterval(() => {
    tries++;
    if (injectWandEntry() || tries > 20) {
      clearInterval(wandRetryTimer);
      wandRetryTimer = null;
    }
  }, 500);
}

/** 运行时收尾：卸载拦截器与采集、拆掉面板 DOM、停全部定时器与事件监听（数据一律不动） */
async function teardownRuntime(): Promise<void> {
  try { import('./services/interception').then(m => (m as any).uninstallInterception?.()); } catch {}
  try { import('./services/agent-usage/collector').then(m => (m as any).uninstallAgentUsage?.()).catch(() => {}); } catch {}
  try {
    const doc = getDoc();
    doc.getElementById('aus-overlay')?.remove();
    doc.getElementById('aus-panel')?.remove();
    doc.getElementById('aus_wand_container')?.remove();
    doc.getElementById('aus-peak-dot-indicator')?.remove();
  } catch {}
  try { resetPanelState(); } catch {}
  try { stopPeakDot(); } catch {}
  try { const m2 = await import('./services/balance'); (m2 as any).stopBalanceTimer?.(); } catch {}
  try { const m3 = await import('./services/currency'); (m3 as any).stopRateTimer?.(); } catch {}
  try { const m4 = await import('./services/pricing-sync'); (m4 as any).stopPricingSyncTimer?.(); } catch {}
  cleanupRuntimeBindings();
}

export async function onInstall() { log.debug('installed'); try { const { loadHot } = await import('./store/persistence'); await loadHot(); } catch {} }
export async function onUpdate() { log.debug('updated'); }
export async function onDelete() {
  log.debug('deleted');
  // 只清运行时，数据一律保留：重装后历史、钱包配置与偏好都还在。
  // 想连数据一起删，需在酒馆「删除扩展」的确认框里勾选「同时清理扩展数据」（走 onClean 钩子）。
  try { const { flushSaveHot } = await import('./store/persistence'); flushSaveHot(); } catch {}
  await teardownRuntime();
  try { delete (globalThis as any).ApiUsageStat; delete (globalThis as any).ApiUsageStatInterceptor; } catch {}
}

/**
 * 卸载前彻底清除本扩展留下的数据（memory/settings/IndexedDB/localStorage 全清）。
 * 触发条件：酒馆 > 扩展管理 > 删除扩展时勾选「同时清理扩展数据」，
 * 或点该扩展的「清理数据」按钮；两者都由酒馆前端在删目录前调用本钩子。
 * 注意：这是不可恢复的操作，酒馆给钩子的超时是 5 秒。
 */
export async function onClean() {
  log.debug('cleaning');
  try { const { flushSaveHot } = await import('./store/persistence'); flushSaveHot(); } catch {}
  await teardownRuntime();
  try {
    const { wipeAllExtensionData } = await import('./services/wipe-data');
    const report = await wipeAllExtensionData();
    log.debug('cleaned', report);
  } catch (err) {
    log.debug('clean failed', err);
  }
}

export function onEnable() { log.debug('enabled'); try { import('./services/interception').then(m=>m.installInterception()); } catch {} try { import('./services/agent-usage/collector').then(m=>m.initAgentUsage()).catch(() => {}); } catch {} try { import('./services/balance').then(m=> (m as any).restartBalanceTimer?.()); } catch {} try { import('./services/currency').then(m=> (m as any).restartRateTimer?.()); } catch {} try { import('./services/pricing-sync').then(m=> (m as any).restartPricingSyncTimer?.()); } catch {} }
export async function onDisable() {
  log.debug('disabled');
  try { const { flushSaveHot } = await import('./store/persistence'); flushSaveHot(); } catch {}
  await teardownRuntime();
  try { unwatchSystemTheme(); } catch {}
}

export async function onActivate() {
  ensureStyleScope();
  try { injectWandEntry(); ensureWandEntry(); } catch {}
  // 激活钩子是酒馆在扩展加载完成后一定会调用的时机，这里补一次拦截器安装，避免错过生成事件
  try { installInterception(); } catch {}
}

async function init() {
  ensureStyleScope();
  // 救援通道：在健康版本里预埋，未来某版本若坏到用户无法手动更新，可用远端 force 策略把人拉回来
  try { setTimeout(() => { import('./services/update').then(m => m.probeForcedUpdateAtStartup()).catch(() => {}); }, 3000); } catch {}
  try { applyTheme((state.settings as any).theme); } catch {}
  // 隔离数据初始化错误，不影响入口注入
  try { await initStore(); } catch (e) { console.error('[API用量统计] initStore 失败', e); }
  // 匿名使用统计：生成/读取匿名标识并绑定关闭面板、页面隐藏时的上报时机
  try { initTelemetry(); } catch {}
  try { const m = await import('./services/balance'); (m as any).restartBalanceTimer?.(); } catch {}
  try { const m = await import('./services/currency'); (m as any).restartRateTimer?.(); } catch {}
  try { const m = await import('./services/pricing-sync'); (m as any).restartPricingSyncTimer?.(); } catch {}
  try { installInterception(); } catch {}
  try { import('./services/agent-usage/collector').then(m => m.initAgentUsage()).catch(() => {}); } catch {}
  const mount = () => {
    try { applyTheme((state.settings as any).theme); } catch {}
    // 跟随系统：绑定 prefers-color-scheme 的 change 事件（仅 auto 模式生效）
    try { watchSystemTheme(); } catch {}
    try { createPanel(); } catch {}
    try { ensureWandEntry(); } catch {}
    try { createPeakDot(); } catch {}
    try { refreshUI(); } catch {}
    // 版本更新后自动清理历史遗留：早期版本把 models.dev 全量模型写进了“模型与价格”列表
    try { import('./services/pricing-sync').then((m: any) => m.markLegacySyncedModels?.()).catch(() => {}); } catch {}
  };
  if ((globalThis as any).SillyTavern?.getContext) mount();
  else mountRetryTimer = window.setTimeout(mount, 1500);
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, onAppReady);
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_INITIALIZED, onAppInitialized);
    ctx?.eventSource?.on?.(ctx?.event_types?.CHAT_CHANGED, onChatChanged);
    // ST 未就绪时轮询重试安装拦截（最多 6 次，间隔 1.5s，避免生成期间频繁打扰）
    let retry = 0;
    interceptionRetryTimer = setInterval(() => {
      retry++;
      try {
        const ok = (globalThis as any).SillyTavern?.getContext?.()?.eventSource;
        if (ok) {
          try {
            if (installInterception()) {
              clearInterval(interceptionRetryTimer);
              interceptionRetryTimer = null;
            }
          } catch {}
        }
      } catch {}
      if (retry > 6 && interceptionRetryTimer) {
        clearInterval(interceptionRetryTimer);
        interceptionRetryTimer = null;
      }
    }, 1500);
  } catch {}
  try { getDoc().addEventListener('keydown', onEscapeKey); } catch {}
  try { window.addEventListener('pagehide', onPageHide); } catch {}
  // 不在启动期做常规更新检查（外网不可达时会长时间挂起请求），改由用户打开面板时触发（openPanel → maybeAutoCheck）；
  // 唯一的例外是上面的强制更新探测：只问远端策略，读不到就当作没有要求，全程静默。
  (globalThis as any).ApiUsageStat = { MODULE, refreshUI, refreshTheme, updatePeakDot, openPanel, closePanel, togglePanel, state, injectWandEntry: ensureWandEntry };
}

init();
