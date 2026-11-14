/**
 * 请求探针 —— 采集（技术验证版）
 *
 * 只做三件事：装上监听 → 记录「谁用什么参数发了什么请求」→ 记下响应里的 usage。
 * 绝不做：不改 URL、不改 body、不注入参数、不拦响应流（只读 clone）。
 * 因此它和 src/services/interception.ts 的采集链路完全并行，不改变任何现有行为。
 */
import type { TapEndpointKind, TapRecord, TapUsage } from './types';
import { classifyPurpose, actorFromLocation, actorFromStack, stackTopFrame, promptHintOf, fingerprint, type TapActor } from './classify';
import { upsertTapRecord, patchTapRecord } from './store';

/** 只关心酒馆后端转发端点；其余请求（汇率、更新检查、WebDAV、遥测）一律不碰 */
export const TAP_API_PREFIX = '/api/backends/';
const PATCH_FLAG = '__ausTapPatched';
const RESCAN_INTERVAL_MS = 4000;

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
    .then((r) => { patchTapRecord(rec.id, { usage: r.usage, usageMissing: !r.usage, ttftMs: r.ttft }); })
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
    if (!w || !w.fetch || w[PATCH_FLAG]) return;
    w[PATCH_FLAG] = true;

    const actor = actorFromLocation({
      frameSrc: (() => { try { return w.frameElement?.getAttribute?.('src') || ''; } catch { return ''; } })(),
      href: (() => { try { return w.location?.href || ''; } catch { return ''; } })(),
      isTop: (() => { try { return w === w.parent; } catch { return true; } })(),
    });

    const prevFetch = w.fetch.bind(w);
    const tapFetch = function (input: any, init?: any) {
      const url = String(typeof input === 'string' ? input : input?.url || '');
      const endpoint = endpointOf(url);
      if (!endpoint) return prevFetch(input, init);
      const ctx = begin(url, endpoint, actor, bodyOf(init, input));
      return prevFetch(input, init).then(
        (res: any) => {
          let status: number | null = null;
          try { status = typeof res?.status === 'number' ? res.status : null; } catch {}
          let reader: Reader | undefined;
          try {
            const clone = res?.clone?.();
            if (clone) reader = () => consumeClone(clone);
          } catch {}
          finalize(ctx, status, reader);
          return res;
        },
        (err: any) => {
          finalize(ctx, null, undefined, String(err?.message || err || '请求异常').slice(0, 200));
          throw err;
        },
      );
    };
    w.fetch = tapFetch;
    restores.push(() => { try { if (w.fetch === tapFetch) w.fetch = prevFetch; } catch {} });

    const XP = w.XMLHttpRequest?.prototype;
    if (XP && !XP[PATCH_FLAG]) {
      XP[PATCH_FLAG] = true;
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
      restores.push(() => { try { XP.open = prevOpen; XP.send = prevSend; } catch {} });
    }
  } catch {}
}

/** 补扫所有同源 iframe：插件在自己的 iframe 里 fetch 时，只有装到那个 window 上才看得见 */
function scanFrames(): void {
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
