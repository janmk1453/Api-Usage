/**
 * 返回键诊断日志（临时排查用）。
 *
 * 为什么要有这个文件：安卓返回键在真机上「从二级页返回后再按一次就退出酒馆」的现象
 * 没法在桌面无头浏览器里复现（`input keyevent`/`input swipe` 的手势序列与真手指不同），
 * 只能把扩展内部的关键事件现场记下来，事后再读。
 *
 * 记录方式（两条互相独立、互为兜底）：
 *   1. `localStorage[aus_back_debug_v1]`：环形缓冲最多 {@link BACK_DEBUG_MAX} 条，
 *      页面被卸载/重载后依然能读到（同源持久化）；
 *   2. `console.log('[aus-back]', json)`：可用 DevTools / chrome://inspect 实时观察。
 *
 * 读取方式：`window.__ausBackDebug.dump()` 取全部记录，`clear()` 清空。
 * 关闭记录：`localStorage.setItem('aus_back_debug_off', '1')`，刷新后不再写。
 *
 * 本模块只做记录，不参与任何业务判断；所有操作都包在 try/catch 里，出错绝不外溢。
 */

export const BACK_DEBUG_KEY = 'aus_back_debug_v1';
export const BACK_DEBUG_OFF_KEY = 'aus_back_debug_off';
export const BACK_DEBUG_MAX = 300;

export interface BackDebugRecord {
  /** 本地时间 HH:MM:SS.mmm */
  t: string;
  /** 距模块加载的毫秒数 */
  ms: number;
  /** 事件名，见 panel.ts 各处插桩 */
  k: string;
  /** history.length */
  len?: number;
  /** history.state 的短 JSON */
  st?: string | null;
  /** #aus-panel 的 inline display */
  panel?: string;
  /** 当前可见视图的 data-view */
  view?: string;
  /** document.visibilityState */
  vis?: string;
  [key: string]: unknown;
}

let ring: BackDebugRecord[] = [];
let loaded = false;
let installed = false;
let flushTimer: any = null;
const bootTs = Date.now();

function storage(): any {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function stamp(): string {
  const d = new Date();
  return (
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3)
  );
}

function shortState(state: unknown): string | null {
  if (state === null || state === undefined) return null;
  try {
    const text = JSON.stringify(state);
    if (typeof text !== 'string') return null;
    return text.length > 160 ? text.slice(0, 160) + '…' : text;
  } catch {
    return null;
  }
}

/** 首次调用时把上次会话残留的日志读回环形缓冲（页面重载不丢） */
function loadOnce(): void {
  if (loaded) return;
  loaded = true;
  const ls = storage();
  if (!ls) return;
  try {
    const raw = ls.getItem(BACK_DEBUG_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr)) ring = arr.slice(-BACK_DEBUG_MAX);
  } catch {
    ring = [];
  }
}

function flushNow(): void {
  flushTimer = null;
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(BACK_DEBUG_KEY, JSON.stringify(ring));
  } catch {
    // 配额满/被禁用：忽略，内存里的记录仍可用 dump() 读到
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  try {
    flushTimer = setTimeout(flushNow, 120);
  } catch {
    flushTimer = null;
  }
}

function debugDisabled(): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    return ls.getItem(BACK_DEBUG_OFF_KEY) === '1';
  } catch {
    return false;
  }
}

function snapshot(): Partial<BackDebugRecord> {
  const out: Partial<BackDebugRecord> = {};
  try {
    if (typeof history !== 'undefined') {
      out.len = history.length;
      out.st = shortState(history.state);
    }
  } catch {}
  try {
    const doc = typeof document !== 'undefined' ? document : null;
    const panel = doc?.getElementById('aus-panel');
    if (panel) {
      out.panel = (panel as HTMLElement).style.display || 'shown';
      const active = panel.querySelector('[data-view]:not([style*="display: none"])');
      const view = active?.getAttribute('data-view');
      if (view) out.view = view;
    }
    if (doc) out.vis = doc.visibilityState;
  } catch {}
  return out;
}

/** 记一条诊断日志（不出错、不阻塞） */
export function backDebug(kind: string, extra?: Record<string, unknown>): void {
  try {
    if (debugDisabled()) return;
    loadOnce();
    const rec: BackDebugRecord = { t: stamp(), ms: Date.now() - bootTs, k: kind, ...snapshot(), ...(extra || {}) };
    ring.push(rec);
    if (ring.length > BACK_DEBUG_MAX) ring.splice(0, ring.length - BACK_DEBUG_MAX);
    scheduleFlush();
    try {
      console.log('[aus-back]', JSON.stringify(rec));
    } catch {}
  } catch {
    // 诊断日志永远不能影响业务
  }
}

/** 取全部记录（副本） */
export function backDebugDump(): BackDebugRecord[] {
  try {
    loadOnce();
    return ring.slice();
  } catch {
    return [];
  }
}

/** 清空记录（内存 + localStorage） */
export function backDebugClear(): string {
  ring = [];
  loaded = true;
  flushNow();
  return 'cleared';
}

/**
 * 注册页面级监听并挂出读取入口。幂等；由 index.ts 在入口尽早调用，
 * 保证面板还没打开时的返回事件也会被记上。
 */
export function installBackDebug(target?: any): void {
  if (installed) return;
  installed = true;
  loadOnce();
  const w: any = target || (typeof window !== 'undefined' ? window : null);
  if (!w) return;
  try {
    w.__ausBackDebug = { dump: backDebugDump, clear: backDebugClear, log: backDebug, key: BACK_DEBUG_KEY };
  } catch {}
  try {
    // 这个监听注册得最早：能记下「扩展自己的 popstate 处理器动手之前」的历史现场
    w.addEventListener('popstate', (ev: any) => {
      backDebug('pop-raw', { evSt: shortState(ev?.state), evLen: w.history?.length });
    });
  } catch {}
  try {
    w.addEventListener('pagehide', () => backDebug('pagehide'));
  } catch {}
  try {
    w.addEventListener('pageshow', () => backDebug('pageshow'));
  } catch {}
  try {
    w.document?.addEventListener?.('visibilitychange', () => backDebug('visibility', { vis: w.document.visibilityState }));
  } catch {}
  backDebug('init', { href: String(w.location?.href || '') });
}
