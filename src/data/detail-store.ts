/**
 * 详情原文库：为最近几条历史记录保存「完整请求体 / 请求头（脱敏）/ 响应原文 / raw 用量」。
 *
 * 为什么单独一个库：
 * - 主库 api_usage_stat_db 固定 version=1，加 store 必须升版本，旧安装包 open(DB,1) 会抛 VersionError；
 * - 原文体积是热区 JSON 的几十倍，塞进 extensionSettings / cold_history 会把热设置撑爆。
 *
 * 口径：只留最近 DETAIL_KEEP 条（与热区详情裁剪同源），超量按时间淘汰，总量再受 DETAIL_TOTAL_CHARS 约束。
 * 任何失败都只记日志、不抛给调用方——原文归档绝不能影响记录入库与统计。
 */
import { DETAIL_KEEP } from '../constants/pricing';
import { log } from '../utils/logger';

export const DETAIL_DB_NAME = 'api_usage_detail_db';
export const DETAIL_STORE_NAME = 'detail_blobs';
const DETAIL_INDEX_TS = 'timestamp';
/** 单条原文（请求体 / 响应各算一份）最多保留的字符数 */
export const DETAIL_MAX_CHARS = 8_000_000;
/** 整个详情库的字符预算，超出从最旧开始淘汰 */
export const DETAIL_TOTAL_CHARS = 40_000_000;
/**
 * 写入时按 DETAIL_KEEP + 这个缓冲淘汰，而不是严格 5 条。
 *
 * 原文库用「请求开始时刻」排序，历史记录用「写入时刻」，一次十分钟的长流式请求会让两边
 * 的顺序错开；严格按 5 条淘汰时，缓冲外的这条虽然还在最近 5 条记录里，原文却已经被删掉。
 * 真正掉出窗口的记录由 repository.pruneDetails 按记录的 key 精确删除。
 */
export const DETAIL_KEEP_SLACK = 4;

export interface DetailSide {
  /** 原文（请求体 / 响应体 / 请求头 JSON 字符串） */
  body: string;
  /** 原始字符数（截断前）；UI 用来提示「共 N 字符，已截断」 */
  chars: number;
  truncated: boolean;
  /** 归档时刻 */
  at: number;
}

export interface DetailBlob {
  schema: 1;
  /** 同时写进 HistoryEntry.detailKey，是 UI 取原文的唯一入口 */
  key: string;
  timestamp: number;
  requestId: string | null;
  model: string | null;
  request: DetailSide | null;
  requestHeaders: DetailSide | null;
  response: DetailSide | null;
  /** 上游返回的 usage 原对象（含本地推算的 __think_tokens_est 等标记） */
  usage: unknown;
  limits: { maxChars: number };
}

export interface DetailIndexItem {
  key: string;
  timestamp: number;
  chars: number;
  model: string | null;
  hasRequest: boolean;
  hasHeaders: boolean;
  hasResponse: boolean;
}

export interface DetailStats {
  count: number;
  chars: number;
  newestAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let openFailed = false;

function openDetailDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('indexedDB 不可用'));
        return;
      }
      const req = indexedDB.open(DETAIL_DB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(DETAIL_STORE_NAME)) {
          const store = db.createObjectStore(DETAIL_STORE_NAME, { keyPath: 'key' });
          store.createIndex(DETAIL_INDEX_TS, 'timestamp');
        }
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result as IDBDatabase;
        db.onversionchange = () => {
          try { db.close(); } catch {}
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = (e: any) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}

function getDB(): Promise<IDBDatabase> {
  if (openFailed) return Promise.reject(new Error('详情原文库不可用'));
  if (!dbPromise) {
    dbPromise = openDetailDB().catch((error) => {
      dbPromise = null;
      openFailed = true;
      throw error;
    });
  }
  return dbPromise;
}

// 同一 key 的「先写请求、后补响应」是两次独立调用，串成队列避免读改写互相覆盖
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function readBlob(key: string): Promise<DetailBlob | null> {
  return new Promise((resolve, reject) => {
    getDB().then((db) => {
      const tx = db.transaction([DETAIL_STORE_NAME], 'readonly');
      const req = tx.objectStore(DETAIL_STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as DetailBlob) || null);
      req.onerror = () => reject(req.error);
    }, reject);
  });
}

function writeBlob(blob: DetailBlob): Promise<void> {
  return new Promise((resolve, reject) => {
    getDB().then((db) => {
      const tx = db.transaction([DETAIL_STORE_NAME], 'readwrite');
      tx.objectStore(DETAIL_STORE_NAME).put(blob);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    }, reject);
  });
}

function readAll(): Promise<DetailBlob[]> {
  return new Promise((resolve, reject) => {
    getDB().then((db) => {
      const tx = db.transaction([DETAIL_STORE_NAME], 'readonly');
      const req = tx.objectStore(DETAIL_STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as DetailBlob[]) || []);
      req.onerror = () => reject(req.error);
    }, reject);
  });
}

function deleteKeys(keys: string[]): Promise<void> {
  if (!keys.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    getDB().then((db) => {
      const tx = db.transaction([DETAIL_STORE_NAME], 'readwrite');
      const store = tx.objectStore(DETAIL_STORE_NAME);
      for (const key of keys) store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    }, reject);
  });
}

// ---------------------------------------------------------------------------
// 脱敏：只处理「键名明确是凭据」的字段，正文内容（messages 等）原样保留
// ---------------------------------------------------------------------------
const SECRET_KEY_RE = /^(?:authorization|proxy-authorization|api[-_]?key|apikey|x-api-key|x-goog-api-key|password|passwd|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|cookie|set-cookie)$/i;
/** 快速探针：整段文本里没有这些键名就完全不必 parse + 深拷贝 */
const SECRET_NEEDLE_RE = /"(?:authorization|proxy-authorization|api[-_]?key|apikey|x-api-key|x-goog-api-key|password|passwd|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|cookie)"\s*:/i;

export function maskSecret(value: string): string {
  const text = String(value);
  if (text.length <= 8) return '****';
  return text.slice(0, 4) + '****' + text.slice(-4);
}

function maskSecrets(value: any, depth: number): any {
  if (depth > 12) return '[深度超限]';
  if (Array.isArray(value)) return value.map((item) => maskSecrets(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      const item = (value as any)[key];
      out[key] = SECRET_KEY_RE.test(key) && typeof item === 'string' ? maskSecret(item) : maskSecrets(item, depth + 1);
    }
    return out;
  }
  return value;
}

/** 请求体原文脱敏：非 JSON（multipart 等）原样返回，超长在落库时按上限截断 */
export function sanitizeDetailRequestText(text: string): string {
  const source = typeof text === 'string' ? text : '';
  if (!source) return '';
  const trimmed = source.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return source;
  if (!SECRET_NEEDLE_RE.test(source)) return source;
  try {
    return JSON.stringify(maskSecrets(JSON.parse(trimmed), 0));
  } catch {
    return source;
  }
}

/** 请求头归一化成普通对象再脱敏，返回 JSON 字符串；没有头时返回 null */
export function sanitizeDetailHeaders(headers: unknown): string | null {
  if (!headers) return null;
  const table: Record<string, string> = {};
  try {
    const raw: any = headers;
    if (typeof raw.forEach === 'function') {
      raw.forEach((value: any, key: any) => { table[String(key)] = String(value); });
    } else if (Array.isArray(raw)) {
      for (const pair of raw) {
        if (Array.isArray(pair) && pair.length >= 2) table[String(pair[0])] = String(pair[1]);
      }
    } else if (typeof raw === 'object') {
      for (const key of Object.keys(raw)) {
        if (raw[key] != null) table[key] = String(raw[key]);
      }
    }
  } catch {
    return null;
  }
  const keys = Object.keys(table);
  if (!keys.length) return null;
  for (const key of keys) {
    if (SECRET_KEY_RE.test(key)) table[key] = maskSecret(table[key]);
  }
  return JSON.stringify(table);
}

// ---------------------------------------------------------------------------
// 写入 / 读取 / 淘汰
// ---------------------------------------------------------------------------
function clampSide(text: string, at: number): DetailSide {
  const chars = text.length;
  if (chars <= DETAIL_MAX_CHARS) return { body: text, chars, truncated: false, at };
  return { body: text.slice(0, DETAIL_MAX_CHARS), chars, truncated: true, at };
}

export function detailKeyOf(requestId: string | null | undefined, timestamp: number): string {
  const id = typeof requestId === 'string' ? requestId.trim() : '';
  return id ? id : 'ts:' + String(Math.floor(timestamp || Date.now()));
}

export interface DetailRequestInput {
  requestId: string | null;
  timestamp: number;
  model?: string | null;
  body: string;
  headers?: unknown;
}

export interface DetailResponseInput {
  requestId: string | null;
  timestamp: number;
  model?: string | null;
  body: string;
  usage?: unknown;
}

function emptyBlob(input: { key: string; timestamp: number; requestId: string | null; model: string | null }): DetailBlob {
  return {
    schema: 1,
    key: input.key,
    timestamp: input.timestamp,
    requestId: input.requestId,
    model: input.model,
    request: null,
    requestHeaders: null,
    response: null,
    usage: null,
    limits: { maxChars: DETAIL_MAX_CHARS },
  };
}

/** 归档请求体与请求头；返回 detailKey（供 addEntry 写进 HistoryEntry.detailKey），失败返回 null */
export function putDetailRequest(input: DetailRequestInput): Promise<string | null> {
  return enqueue(async () => {
    const key = detailKeyOf(input.requestId, input.timestamp);
    const at = Date.now();
    const body = sanitizeDetailRequestText(typeof input.body === 'string' ? input.body : '');
    const headers = sanitizeDetailHeaders(input.headers);
    if (!body && !headers) return key;
    const existing = await readBlob(key);
    const blob = existing || emptyBlob({ key, timestamp: input.timestamp, requestId: input.requestId, model: input.model ?? null });
    if (body) blob.request = clampSide(body, at);
    if (headers) blob.requestHeaders = clampSide(headers, at);
    if (input.model) blob.model = input.model;
    blob.timestamp = input.timestamp || blob.timestamp;
    await writeBlob(blob);
    await pruneInner(DETAIL_KEEP + DETAIL_KEEP_SLACK);
    return key;
  }).catch((error) => {
    log.warn('详情原文写入失败（请求）', error);
    return null;
  });
}

/** 归档响应原文与 usage；返回 detailKey，失败返回 null */
export function putDetailResponse(input: DetailResponseInput): Promise<string | null> {
  return enqueue(async () => {
    const key = detailKeyOf(input.requestId, input.timestamp);
    const at = Date.now();
    const body = typeof input.body === 'string' ? input.body : '';
    const existing = await readBlob(key);
    const blob = existing || emptyBlob({ key, timestamp: input.timestamp, requestId: input.requestId, model: input.model ?? null });
    if (body) blob.response = clampSide(body, at);
    if (input.usage) blob.usage = input.usage;
    if (input.model) blob.model = input.model;
    blob.timestamp = input.timestamp || blob.timestamp;
    await writeBlob(blob);
    await pruneInner(DETAIL_KEEP + DETAIL_KEEP_SLACK);
    return key;
  }).catch((error) => {
    log.warn('详情原文写入失败（响应）', error);
    return null;
  });
}

export async function getDetail(key: string | null | undefined): Promise<DetailBlob | null> {
  if (!key) return null;
  try {
    return await readBlob(String(key));
  } catch (error) {
    log.warn('详情原文读取失败', error);
    return null;
  }
}

function blobChars(blob: DetailBlob): number {
  let chars = (blob.request?.chars || 0) + (blob.requestHeaders?.chars || 0) + (blob.response?.chars || 0);
  try {
    if (blob.usage) chars += JSON.stringify(blob.usage).length;
  } catch {}
  return chars;
}

/** 只读索引：给存储占用卡与调试用，不含原文 */
export async function listDetailIndex(): Promise<DetailIndexItem[]> {
  try {
    const all = await readAll();
    return all
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .map((blob) => ({
        key: blob.key,
        timestamp: blob.timestamp,
        chars: blobChars(blob),
        model: blob.model ?? null,
        hasRequest: !!blob.request,
        hasHeaders: !!blob.requestHeaders,
        hasResponse: !!blob.response,
      }));
  } catch (error) {
    log.warn('详情原文索引读取失败', error);
    return [];
  }
}

/** 淘汰：先按条数（最近 DETAIL_KEEP 条），再按总字符预算从最旧裁 */
async function pruneInner(keep: number = DETAIL_KEEP): Promise<{ removed: number; kept: number; chars: number }> {
  const all = await readAll();
  const sorted = all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const keepKeys = new Set<string>();
  let chars = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i >= Math.max(1, keep)) break;
    const size = blobChars(sorted[i]);
    if (chars + size > DETAIL_TOTAL_CHARS) break;
    chars += size;
    keepKeys.add(sorted[i].key);
  }
  const remove = sorted.filter((blob) => !keepKeys.has(blob.key)).map((blob) => blob.key);
  await deleteKeys(remove);
  return { removed: remove.length, kept: keepKeys.size, chars };
}

export async function pruneDetailStore(keep: number = DETAIL_KEEP): Promise<{ removed: number; kept: number; chars: number }> {
  try {
    return await enqueue(() => pruneInner(keep));
  } catch (error) {
    log.warn('详情原文淘汰失败', error);
    return { removed: 0, kept: 0, chars: 0 };
  }
}

export async function deleteDetail(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await enqueue(() => deleteKeys([String(key)]));
  } catch (error) {
    log.warn('详情原文删除失败', error);
  }
}

export async function clearDetailStore(): Promise<{ removed: number }> {
  try {
    const all = await enqueue(() => readAll());
    await enqueue(() => deleteKeys(all.map((blob) => blob.key)));
    return { removed: all.length };
  } catch (error) {
    log.warn('详情原文清空失败', error);
    return { removed: 0 };
  }
}

export async function detailStorageStats(): Promise<DetailStats> {
  try {
    const all = await readAll();
    let chars = 0;
    let newestAt = 0;
    for (const blob of all) {
      chars += blobChars(blob);
      if ((blob.timestamp || 0) > newestAt) newestAt = blob.timestamp || 0;
    }
    return { count: all.length, chars, newestAt };
  } catch (error) {
    log.warn('详情原文统计失败', error);
    return { count: 0, chars: 0, newestAt: 0 };
  }
}

export function closeDetailDB(): Promise<void> {
  return (async () => {
    const current = dbPromise;
    dbPromise = null;
    openFailed = false;
    try {
      const db = await current;
      db?.close();
    } catch {}
  })();
}
