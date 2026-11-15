/**
 * 请求日志上传：把「请求日志」页的反馈包发到接收端（本项目自带的 Cloudflare Worker）。
 *
 * 边界：
 * - 只有用户在弹窗里点「同意并上传」才发请求，取消什么都不做；
 * - 上传体由 services/feedback-pack.ts 组装并脱敏，这里只负责「发出去 + 报结果」；
 * - 地址记在 localStorage，用户可改成自己的接收端。
 */

export const LOG_UPLOAD_ADDRESS_KEY = 'aus_log_upload_address_v1';
/** 默认接收端：项目自带的 Worker（cloudflare/worker.js 的 POST /api/log） */
export const LOG_UPLOAD_DEFAULT_ADDRESS = 'https://stat.janmk.us.ci/api/log';
export const LOG_UPLOAD_TIMEOUT_MS = 20_000;

/** 地址只接受 http/https，其余一律判为不可上传 */
export function normalizeUploadAddress(input: unknown): string | null {
  const text = String(input ?? '').trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function readUploadAddress(): string {
  try {
    const saved = globalThis.localStorage?.getItem(LOG_UPLOAD_ADDRESS_KEY);
    if (typeof saved === 'string' && saved.trim()) return saved.trim();
  } catch {}
  return LOG_UPLOAD_DEFAULT_ADDRESS;
}

export function saveUploadAddress(address: string): void {
  try {
    const text = String(address ?? '').trim();
    if (!text) globalThis.localStorage?.removeItem(LOG_UPLOAD_ADDRESS_KEY);
    else globalThis.localStorage?.setItem(LOG_UPLOAD_ADDRESS_KEY, text);
  } catch {}
}

export interface LogUploadResult {
  ok: boolean;
  status: number;
  /** 服务端返回的正文（截断到 500 字符），失败时可能是网络错误文案 */
  message: string;
}

function clipMessage(text: string, limit = 500): string {
  const raw = String(text ?? '').trim();
  return raw.length <= limit ? raw : raw.slice(0, limit) + '…';
}

/** 真正发请求。失败不抛异常，统一用 ok=false 表达，交给界面展示 */
export async function uploadLogPayload(address: string, payload: unknown): Promise<LogUploadResult> {
  const target = normalizeUploadAddress(address);
  if (!target) return { ok: false, status: 0, message: '上传地址无效，请填写以 http:// 或 https:// 开头的地址' };
  const fetchImpl = (globalThis as any).fetch;
  if (typeof fetchImpl !== 'function') return { ok: false, status: 0, message: '当前环境不支持网络请求' };
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), LOG_UPLOAD_TIMEOUT_MS) : null;
  try {
    const res = await fetchImpl(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });
    let text = '';
    try {
      text = await res.text();
    } catch {}
    return { ok: res.ok, status: res.status, message: clipMessage(text) };
  } catch (error: any) {
    const aborted = error && (error.name === 'AbortError' || /abort/i.test(String(error.message || '')));
    return {
      ok: false,
      status: 0,
      message: aborted ? '上传超时，请检查网络后重试' : clipMessage(String(error?.message || error || '网络错误')),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
