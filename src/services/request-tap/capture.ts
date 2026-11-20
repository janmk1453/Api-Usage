/**
 * 请求探针 —— 采集（技术验证版）
 *
 * 只做三件事：装上监听 → 记录「谁用什么参数发了什么请求」→ 记下响应里的 usage。
 * 绝不做：不改 URL、不改 body、不注入参数、不拦响应流（只读 clone）。
 * 因此它和 src/services/interception.ts 的采集链路完全并行，不改变任何现有行为。
 */
import { TAP_SCHEMA_VERSION, type TapEndpointKind, type TapRecord, type TapUsage } from './types';
import { classifyPurpose, actorFromLocation, actorFromStack, stackTopFrame, promptHintOf, fingerprint, type TapActor } from './classify';
import { upsertTapRecord, patchTapRecord, listTapRecords } from './store';

/** 只关心酒馆后端转发端点；其余请求（汇率、更新检查、WebDAV、遥测）一律不碰 */
export const TAP_API_PREFIX = '/api/backends/';
const PATCH_FLAG = '__ausTapPatched';
const WIN_STATE = '__ausTapState';
const RESCAN_INTERVAL_MS = 4000;

/**
 * 每个 window 上记住「我们当前装上去的包装函数是哪一只」。
 * 早期版本只用一个布尔 PATCH_FLAG 当闸门，含义是「装过一次」而不是「现在还在岗」：
 * 宿主（ST / TauriTavern）换掉 window.fetch、或其它补丁在我们的包装外面又包了一层之后，
 * 探针就再也装不回去，直到刷新页面——3.2.3 里 13:12:38 / 13:12:44 两轮请求在探针账本里
 * 零记录（而采集日志照常，因为采集另有 4s 自愈守卫）就是这么来的。
 */
interface WinState {
  fetch: any;
  prevFetch: any;
  /** 当前装上去的 XHR 补丁（用于「是否还在岗」判定） */
  xhrOpen?: any;
  xhrSend?: any;
  /** 最初的 XHR 原生方法：代际更替时一路继承下来，卸载时才还原得干净 */
  xhrRawOpen?: any;
  xhrRawSend?: any;
}

/**
 * 每个 window 只挂一个还原闭包。
 * fetch 可能被宿主反复替换、我们每 4s 重装一次，若每次都 push 一个闭包，
 * restores 会随时间无限增长（并一直持有旧 fetch 的引用），长时间开着页面就是内存泄漏。
 */
const restoreHooked = new WeakSet<object>();

let seq = 0;
let installed = false;
let rescanTimer: any = null;
let observer: MutationObserver | null = null;
const restores: (() => void)[] = [];

function hostWindow(): any {
  try { return (window as any).parent || window; } catch { return window; }
}
function hostDoc(): Document | null {
  try { return hostWindow()?.document ?? document; } catch { return null; }
}

/** 命中的端点类型；不命中返回 null（不采集） */
export function endpointOf(url: string): TapEndpointKind | null {
  const u = String(url || '');
  if (u.indexOf(TAP_API_PREFIX) === -1) return null;
  if (u.indexOf('/generate') === -1) return null;
  if (u.indexOf('text-completions') !== -1) return 'text';
  if (u.indexOf('chat-completions') !== -1) return 'chat';
  return 'other';
}

/** 从 JSON / SSE 文本里取 usage（不依赖 interception 内部实现，保持两边独立） */
export function readUsageFromText(text: string): TapUsage | null {
  const raw = String(text || '');
  if (!raw) return null;
  const pick = (u: any): TapUsage | null => {
    if (!u || typeof u !== 'object') return null;
    const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
    const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
    const total = Number(u.total_tokens ?? 0) || prompt + completion;
    const hit = Number(
      u.prompt_cache_hit_tokens ?? u.cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0,
    ) || 0;
    if (!prompt && !completion && !total) return null;
    return { prompt, completion, total, hit, miss: Math.max(0, prompt - hit) };
  };
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const direct = pick(data?.usage) || pick(data?.data?.usage) || pick(data);
      if (direct) return direct;
    } catch {}
  }
  let found: TapUsage | null = null;
  for (const line of raw.split('\n')) {
    if (line.indexOf('data:') !== 0) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const chunk = JSON.parse(payload);
      const u = pick(chunk?.usage) || pick(chunk?.choices?.[0]?.usage);
      if (u) found = u;
    } catch {}
  }
  return found;
}

interface Ctx {
  id: string;
  at: number;
  url: string;
  endpoint: TapEndpointKind;
  actor: TapActor;
  attribution: 'A' | 'B' | 'C';
  stackTop: string;
  body: any;
  promptChars: number;
}

function bodyOf(init: any, input: any): any {
  try {
    const raw = init?.body;
    if (typeof raw === 'string') return JSON.parse(raw);
    if (raw && typeof raw === 'object' && !(raw instanceof FormData)) return raw;
    const b = input?.body;
    if (typeof b === 'string') return JSON.parse(b);
  } catch {}
  return null;
}

function promptCharsOf(body: any): number {
  try {
    const msgs = body?.messages;
    if (Array.isArray(msgs)) {
      let n = 0;
      for (const m of msgs) if (typeof m?.content === 'string') n += m.content.length;
      return n;
    }
    if (typeof body?.prompt === 'string') return body.prompt.length;
  } catch {}
  return 0;
}

function begin(url: string, endpoint: TapEndpointKind, ctxActor: TapActor, body: any): Ctx {
  let stack = '';
  try { stack = String(new Error().stack || ''); } catch {}
  const stackActor = actorFromStack(stack);
  const actor = stackActor || ctxActor;
  const attribution: 'A' | 'B' | 'C' = stackActor && ctxActor.kind !== 'unknown' ? 'A' : stackActor ? 'B' : 'C';
  const hint = promptHintOf(body);
  const purpose = classifyPurpose({
    actorLabel: actor.label,
    requestType: String(body?.type || ''),
    structured: !!(body?.json_schema || body?.response_format || body?.tools),
    messageCount: Array.isArray(body?.messages) ? body.messages.length : 0,
    promptHint: hint,
    endpoint,
  });
  return {
    id: 'tap:' + Date.now() + ':' + (++seq),
    at: Date.now(),
    url,
    endpoint,
    actor,
    attribution,
    stackTop: stackTopFrame(stack),
    body,
    promptChars: promptCharsOf(body),
    ...({ __purpose: purpose } as any),
  } as Ctx;
}

function toRecord(ctx: Ctx, endedAt: number, status: number | null, error: string | null): TapRecord {
  const body = ctx.body;
  const hint = promptHintOf(body);
  const purpose = (ctx as any).__purpose;
  return {
    v: TAP_SCHEMA_VERSION,
    id: ctx.id,
    at: ctx.at,
    endedAt,
    url: ctx.url,
    endpoint: ctx.endpoint,
    actorKind: ctx.actor.kind,
    actorId: ctx.actor.id.slice(0, 240),
    actorLabel: ctx.actor.label,
    stackTop: ctx.stackTop,
    attribution: ctx.attribution,
    model: String(body?.model || ''),
    requestType: String(body?.type || ''),
    stream: body?.stream === true,
    messageCount: Array.isArray(body?.messages) ? body.messages.length : 0,
    promptChars: ctx.promptChars,
    structured: !!(body?.json_schema || body?.response_format || body?.tools),
    purposeKey: purpose.key,
    purposeLabel: purpose.label,
    promptHint: hint,
    usage: null,
    usageMissing: false,
    durationMs: Math.max(0, endedAt - ctx.at),
    ttftMs: 0,
    status,
    error,
    state: 'pending',
    settledBy: null,
    settledAt: null,
  };
}

type Reader = () => Promise<{ usage: TapUsage | null; ttft: number }>;

function finalize(ctx: Ctx, status: number | null, reader?: Reader, error: string | null = null): void {
  const endedAt = Date.now();
  const rec = toRecord(ctx, endedAt, status, error);
  upsertTapRecord(rec);
  if (!reader) return;
  reader()
    .then((r) => {
      // 流式响应的真正结束在读完整个 body 之后：用此刻补正 endedAt / durationMs，
      // 否则 endedAt 会停在「响应头到达」，对账窗口按它算会把长输出请求全判成超窗。
      const settledAt = Date.now();
      const patch: any = {
        endedAt: settledAt,
        durationMs: Math.max(0, settledAt - ctx.at),
        usage: r.usage,
        usageMissing: !r.usage,
        ttftMs: r.ttft,
      };
      // usage 迟到：先前按「没用量」判成孤儿的，usage 到手后重新排队，让对账再判一次
      if (r.usage) {
        try {
          const cur = listTapRecords().find((x) => x.id === rec.id);
          if (cur && cur.state === 'orphan' && (cur.settledBy === 'no-usage' || cur.settledBy === 'too-short')) {
            patch.state = 'pending';
            patch.settledBy = null;
            patch.settledAt = null;
          }
        } catch {}
      }
      patchTapRecord(rec.id, patch);
    })
    .catch(() => { patchTapRecord(rec.id, { usageMissing: true }); });
}

/** 读 fetch 响应 clone：顺带量首字延迟；只读，不消费原响应 */
async function consumeClone(res: Response): Promise<{ usage: TapUsage | null; ttft: number }> {
  const body: any = (res as any)?.body;
  const t0 = Date.now();
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const dec = new TextDecoder();
    let text = '';
    let first = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) {
        if (!first) first = Date.now() - t0;
        text += dec.decode(value, { stream: true });
        if (text.length > 400000) text = text.slice(-400000);
      }
    }
    return { usage: readUsageFromText(text), ttft: first };
  }
  const text = await res.text();
  return { usage: readUsageFromText(text), ttft: Date.now() - t0 };
}

function patchWindow(w: any): void {
  try {
    if (!w || typeof w.fetch !== 'function') return;
    const prevState: WinState | undefined = w[WIN_STATE];
    // 在位判定：当前 fetch 必须仍然是我们装上去的那一只，否则重装
    if (prevState && prevState.fetch === w.fetch) return;

    const actor = actorFromLocation({
      frameSrc: (() => { try { return w.frameElement?.getAttribute?.('src') || ''; } catch { return ''; } })(),
      href: (() => { try { return w.location?.href || ''; } catch { return ''; } })(),
      isTop: (() => { try { return w === w.parent; } catch { return true; } })(),
    });

    const prevFetch = w.fetch.bind(w);
    const tapFetch = function (input: any, init?: any) {
      // 已被更新的一代包装取代：只做直通，绝不再记一次（否则会重复入账、也会让包装层层叠加）
      const st: WinState | undefined = w[WIN_STATE];
      if (!st || st.fetch !== tapFetch) return prevFetch(input, init);
      // 探针是旁路，任何自身的异常都不允许打断宿主的请求
      let ctx: Ctx | null = null;
      try {
        const url = String(typeof input === 'string' ? input : input?.url || '');
        const endpoint = endpointOf(url);
        if (endpoint) ctx = begin(url, endpoint, actor, bodyOf(init, input));
      } catch {
        ctx = null;
      }
      if (!ctx) return prevFetch(input, init);
      const record = ctx;
      return prevFetch(input, init).then(
        (res: any) => {
          try {
            let status: number | null = null;
            try { status = typeof res?.status === 'number' ? res.status : null; } catch {}
            let reader: Reader | undefined;
            try {
              const clone = res?.clone?.();
              if (clone) reader = () => consumeClone(clone);
            } catch {}
            finalize(record, status, reader);
          } catch {}
          return res;
        },
        (err: any) => {
          try { finalize(record, null, undefined, String(err?.message || err || '请求异常').slice(0, 200)); } catch {}
          throw err;
        },
      );
    };
    // 标记角色：自己是探针，同时把「里面已经包过采集」的事实一并透传，
    // 免得采集守卫（isAusFetchPatch）把探针包装当成没装过、再包一层，两边无限对套。
    (tapFetch as any)[PATCH_FLAG] = true;
    if ((prevFetch as any).__aus_patched === true) (tapFetch as any).__aus_patched = true;
    w.fetch = tapFetch;
    // 状态跨代继承：XHR 只在第一次安装时补，原始函数一路带下去，卸载时才能还原干净
    const state: WinState = {
      fetch: tapFetch,
      prevFetch,
      xhrOpen: prevState?.xhrOpen,
      xhrSend: prevState?.xhrSend,
      xhrRawOpen: prevState?.xhrRawOpen,
      xhrRawSend: prevState?.xhrRawSend,
    };
    w[WIN_STATE] = state;

    const XP = w.XMLHttpRequest?.prototype;
    // XHR 同样按「当前函数是不是我们装的那一只」判定，而不是「装过一次」的布尔
    const xhrInPlace = !!(prevState && XP && prevState.xhrOpen === XP.open && prevState.xhrSend === XP.send);
    if (XP && !xhrInPlace) {
      const prevOpen = XP.open;
      const prevSend = XP.send;
      XP.open = function (this: any, method: string, url: string) {
        try { this.__ausTapUrl = String(url || ''); } catch {}
        return prevOpen.apply(this, arguments as any);
      };
      XP.send = function (this: any, body?: any) {
        try {
          const url = String(this.__ausTapUrl || '');
          const endpoint = endpointOf(url);
          if (endpoint) {
            const ctx = begin(url, endpoint, actor, bodyOf({ body }, null));
            this.addEventListener('loadend', () => {
              const status = typeof this.status === 'number' ? this.status : null;
              const ok = status !== null && status >= 200 && status < 400;
              finalize(ctx, status, async () => ({ usage: readUsageFromText(String(this.responseText || '')), ttft: 0 }), ok ? null : 'HTTP ' + status);
            });
          }
        } catch {}
        return prevSend.apply(this, arguments as any);
      };
      state.xhrOpen = XP.open;
      state.xhrSend = XP.send;
      if (!state.xhrRawOpen) state.xhrRawOpen = prevOpen;
      if (!state.xhrRawSend) state.xhrRawSend = prevSend;
    }

    // 每个 window 只挂一个还原闭包：它按「当前这一代」还原，代际更替不会撑大 restores
    if (!restoreHooked.has(w)) {
      restoreHooked.add(w);
      restores.push(() => {
        try {
          const cur: WinState | undefined = w[WIN_STATE];
          w[WIN_STATE] = null;
          if (!cur) return;
          if (w.fetch === cur.fetch) w.fetch = cur.prevFetch;
          const P = w.XMLHttpRequest?.prototype;
          if (P) {
            if (cur.xhrOpen && P.open === cur.xhrOpen && cur.xhrRawOpen) P.open = cur.xhrRawOpen;
            if (cur.xhrSend && P.send === cur.xhrSend && cur.xhrRawSend) P.send = cur.xhrRawSend;
          }
        } catch {}
      });
    }
  } catch {}
}

/**
 * 补扫：主窗 + 所有同源 iframe。宿主随时可能换掉 window.fetch / XMLHttpRequest
 * （TauriTavern 重绑、ST 刷新、别的补丁再包一层），所以这里必须周期性重装，
 * 否则探针会静默失聪——3.2.3 里那两轮请求零记录就是缺了这一步。
 */
function scanFrames(): void {
  try {
    patchWindow(hostWindow());
    patchWindow(window);
  } catch {}
  try {
    const doc = hostDoc();
    if (!doc) return;
    doc.querySelectorAll('iframe').forEach((frame: any) => {
      try { if (frame.contentWindow) patchWindow(frame.contentWindow); } catch {}
    });
  } catch {}
}

/** 安装探针（幂等） */
export function installTapCapture(): void {
  if (installed) return;
  installed = true;
  try { patchWindow(hostWindow()); } catch {}
  try { patchWindow(window); } catch {}
  scanFrames();
  try {
    const doc = hostDoc();
    if (doc && typeof MutationObserver === 'function') {
      observer = new MutationObserver(() => { try { scanFrames(); } catch {} });
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    }
  } catch {}
  rescanTimer = setInterval(scanFrames, RESCAN_INTERVAL_MS);
}

/** 卸载探针（还原被包过的 fetch / XHR） */
export function uninstallTapCapture(): void {
  if (!installed) return;
  installed = false;
  try { if (rescanTimer) clearInterval(rescanTimer); } catch {}
  rescanTimer = null;
  try { observer?.disconnect(); } catch {}
  observer = null;
  for (const restore of restores.splice(0)) {
    try { restore(); } catch {}
  }
}

/** 供调试用：把一段请求手工记进来（不涉及网络） */
export function tapDebugRecord(input: { url: string; body?: any; actorLabel?: string }): TapRecord {
  const ctx = begin(input.url, endpointOf(input.url) || 'chat', { kind: 'unknown', id: '', label: input.actorLabel || '手工' }, input.body || null);
  const rec = toRecord(ctx, Date.now(), null, null);
  upsertTapRecord(rec);
  return rec;
}

export { fingerprint };
