import "./pricing-Bc-qEvy8.js";
import { t as log } from "./logger-8RGXnvfI.js";
//#region src/data/detail-store.ts
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
var DETAIL_DB_NAME = "api_usage_detail_db";
var DETAIL_STORE_NAME = "detail_blobs";
var DETAIL_INDEX_TS = "timestamp";
/** 单条原文（请求体 / 响应各算一份）最多保留的字符数 */
var DETAIL_MAX_CHARS = 8e6;
var dbPromise = null;
var openFailed = false;
function openDetailDB() {
	return new Promise((resolve, reject) => {
		try {
			if (typeof indexedDB === "undefined") {
				reject(/* @__PURE__ */ new Error("indexedDB 不可用"));
				return;
			}
			const req = indexedDB.open(DETAIL_DB_NAME, 1);
			req.onupgradeneeded = (e) => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains("detail_blobs")) db.createObjectStore(DETAIL_STORE_NAME, { keyPath: "key" }).createIndex(DETAIL_INDEX_TS, "timestamp");
			};
			req.onsuccess = (e) => {
				const db = e.target.result;
				db.onversionchange = () => {
					try {
						db.close();
					} catch {}
					dbPromise = null;
				};
				resolve(db);
			};
			req.onerror = (e) => reject(e.target.error);
		} catch (err) {
			reject(err);
		}
	});
}
function getDB() {
	if (openFailed) return Promise.reject(/* @__PURE__ */ new Error("详情原文库不可用"));
	if (!dbPromise) dbPromise = openDetailDB().catch((error) => {
		dbPromise = null;
		openFailed = true;
		throw error;
	});
	return dbPromise;
}
var queue = Promise.resolve();
function enqueue(task) {
	const run = queue.then(task, task);
	queue = run.then(() => void 0, () => void 0);
	return run;
}
function readBlob(key) {
	return new Promise((resolve, reject) => {
		getDB().then((db) => {
			const req = db.transaction([DETAIL_STORE_NAME], "readonly").objectStore(DETAIL_STORE_NAME).get(key);
			req.onsuccess = () => resolve(req.result || null);
			req.onerror = () => reject(req.error);
		}, reject);
	});
}
function writeBlob(blob) {
	return new Promise((resolve, reject) => {
		getDB().then((db) => {
			const tx = db.transaction([DETAIL_STORE_NAME], "readwrite");
			tx.objectStore(DETAIL_STORE_NAME).put(blob);
			tx.oncomplete = () => resolve();
			tx.onabort = () => reject(tx.error);
			tx.onerror = () => reject(tx.error);
		}, reject);
	});
}
function readAll() {
	return new Promise((resolve, reject) => {
		getDB().then((db) => {
			const req = db.transaction([DETAIL_STORE_NAME], "readonly").objectStore(DETAIL_STORE_NAME).getAll();
			req.onsuccess = () => resolve(req.result || []);
			req.onerror = () => reject(req.error);
		}, reject);
	});
}
function deleteKeys(keys) {
	if (!keys.length) return Promise.resolve();
	return new Promise((resolve, reject) => {
		getDB().then((db) => {
			const tx = db.transaction([DETAIL_STORE_NAME], "readwrite");
			const store = tx.objectStore(DETAIL_STORE_NAME);
			for (const key of keys) store.delete(key);
			tx.oncomplete = () => resolve();
			tx.onabort = () => reject(tx.error);
			tx.onerror = () => reject(tx.error);
		}, reject);
	});
}
var SECRET_KEY_RE = /^(?:authorization|proxy-authorization|api[-_]?key|apikey|x-api-key|x-goog-api-key|password|passwd|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|cookie|set-cookie)$/i;
/** 快速探针：整段文本里没有这些键名就完全不必 parse + 深拷贝 */
var SECRET_NEEDLE_RE = /"(?:authorization|proxy-authorization|api[-_]?key|apikey|x-api-key|x-goog-api-key|password|passwd|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|cookie)"\s*:/i;
function maskSecret(value) {
	const text = String(value);
	if (text.length <= 8) return "****";
	return text.slice(0, 4) + "****" + text.slice(-4);
}
function maskSecrets(value, depth) {
	if (depth > 12) return "[深度超限]";
	if (Array.isArray(value)) return value.map((item) => maskSecrets(item, depth + 1));
	if (value && typeof value === "object") {
		const out = {};
		for (const key of Object.keys(value)) {
			const item = value[key];
			out[key] = SECRET_KEY_RE.test(key) && typeof item === "string" ? maskSecret(item) : maskSecrets(item, depth + 1);
		}
		return out;
	}
	return value;
}
/** 请求体原文脱敏：非 JSON（multipart 等）原样返回，超长在落库时按上限截断 */
function sanitizeDetailRequestText(text) {
	const source = typeof text === "string" ? text : "";
	if (!source) return "";
	const trimmed = source.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return source;
	if (!SECRET_NEEDLE_RE.test(source)) return source;
	try {
		return JSON.stringify(maskSecrets(JSON.parse(trimmed), 0));
	} catch {
		return source;
	}
}
/** 请求头归一化成普通对象再脱敏，返回 JSON 字符串；没有头时返回 null */
function sanitizeDetailHeaders(headers) {
	if (!headers) return null;
	const table = {};
	try {
		const raw = headers;
		if (typeof raw.forEach === "function") raw.forEach((value, key) => {
			table[String(key)] = String(value);
		});
		else if (Array.isArray(raw)) {
			for (const pair of raw) if (Array.isArray(pair) && pair.length >= 2) table[String(pair[0])] = String(pair[1]);
		} else if (typeof raw === "object") {
			for (const key of Object.keys(raw)) if (raw[key] != null) table[key] = String(raw[key]);
		}
	} catch {
		return null;
	}
	const keys = Object.keys(table);
	if (!keys.length) return null;
	for (const key of keys) if (SECRET_KEY_RE.test(key)) table[key] = maskSecret(table[key]);
	return JSON.stringify(table);
}
function clampSide(text, at) {
	const chars = text.length;
	if (chars <= 8e6) return {
		body: text,
		chars,
		truncated: false,
		at
	};
	return {
		body: text.slice(0, DETAIL_MAX_CHARS),
		chars,
		truncated: true,
		at
	};
}
function detailKeyOf(requestId, timestamp) {
	const id = typeof requestId === "string" ? requestId.trim() : "";
	return id ? id : "ts:" + String(Math.floor(timestamp || Date.now()));
}
function emptyBlob(input) {
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
		limits: { maxChars: DETAIL_MAX_CHARS }
	};
}
/** 归档请求体与请求头；返回 detailKey（供 addEntry 写进 HistoryEntry.detailKey），失败返回 null */
function putDetailRequest(input) {
	return enqueue(async () => {
		const key = detailKeyOf(input.requestId, input.timestamp);
		const at = Date.now();
		const body = sanitizeDetailRequestText(typeof input.body === "string" ? input.body : "");
		const headers = sanitizeDetailHeaders(input.headers);
		if (!body && !headers) return key;
		const blob = await readBlob(key) || emptyBlob({
			key,
			timestamp: input.timestamp,
			requestId: input.requestId,
			model: input.model ?? null
		});
		if (body) blob.request = clampSide(body, at);
		if (headers) blob.requestHeaders = clampSide(headers, at);
		if (input.model) blob.model = input.model;
		blob.timestamp = input.timestamp || blob.timestamp;
		await writeBlob(blob);
		await pruneInner();
		return key;
	}).catch((error) => {
		log.warn("详情原文写入失败（请求）", error);
		return null;
	});
}
/** 归档响应原文与 usage；返回 detailKey，失败返回 null */
function putDetailResponse(input) {
	return enqueue(async () => {
		const key = detailKeyOf(input.requestId, input.timestamp);
		const at = Date.now();
		const body = typeof input.body === "string" ? input.body : "";
		const blob = await readBlob(key) || emptyBlob({
			key,
			timestamp: input.timestamp,
			requestId: input.requestId,
			model: input.model ?? null
		});
		if (body) blob.response = clampSide(body, at);
		if (input.usage) blob.usage = input.usage;
		if (input.model) blob.model = input.model;
		blob.timestamp = input.timestamp || blob.timestamp;
		await writeBlob(blob);
		await pruneInner();
		return key;
	}).catch((error) => {
		log.warn("详情原文写入失败（响应）", error);
		return null;
	});
}
async function getDetail(key) {
	if (!key) return null;
	try {
		return await readBlob(String(key));
	} catch (error) {
		log.warn("详情原文读取失败", error);
		return null;
	}
}
function blobChars(blob) {
	let chars = (blob.request?.chars || 0) + (blob.requestHeaders?.chars || 0) + (blob.response?.chars || 0);
	try {
		if (blob.usage) chars += JSON.stringify(blob.usage).length;
	} catch {}
	return chars;
}
/** 淘汰：先按条数（最近 DETAIL_KEEP 条），再按总字符预算从最旧裁 */
async function pruneInner(keep = 5) {
	const sorted = (await readAll()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
	const keepKeys = /* @__PURE__ */ new Set();
	let chars = 0;
	for (let i = 0; i < sorted.length; i++) {
		if (i >= Math.max(1, keep)) break;
		const size = blobChars(sorted[i]);
		if (chars + size > 4e7) break;
		chars += size;
		keepKeys.add(sorted[i].key);
	}
	const remove = sorted.filter((blob) => !keepKeys.has(blob.key)).map((blob) => blob.key);
	await deleteKeys(remove);
	return {
		removed: remove.length,
		kept: keepKeys.size,
		chars
	};
}
async function deleteDetail(key) {
	if (!key) return;
	try {
		await enqueue(() => deleteKeys([String(key)]));
	} catch (error) {
		log.warn("详情原文删除失败", error);
	}
}
async function clearDetailStore() {
	try {
		const all = await enqueue(() => readAll());
		await enqueue(() => deleteKeys(all.map((blob) => blob.key)));
		return { removed: all.length };
	} catch (error) {
		log.warn("详情原文清空失败", error);
		return { removed: 0 };
	}
}
async function detailStorageStats() {
	try {
		const all = await readAll();
		let chars = 0;
		let newestAt = 0;
		for (const blob of all) {
			chars += blobChars(blob);
			if ((blob.timestamp || 0) > newestAt) newestAt = blob.timestamp || 0;
		}
		return {
			count: all.length,
			chars,
			newestAt
		};
	} catch (error) {
		log.warn("详情原文统计失败", error);
		return {
			count: 0,
			chars: 0,
			newestAt: 0
		};
	}
}
function closeDetailDB() {
	return (async () => {
		const current = dbPromise;
		dbPromise = null;
		openFailed = false;
		try {
			(await current)?.close();
		} catch {}
	})();
}
//#endregion
export { deleteDetail as a, putDetailRequest as c, closeDetailDB as i, putDetailResponse as l, DETAIL_MAX_CHARS as n, detailStorageStats as o, clearDetailStore as r, getDetail as s, DETAIL_DB_NAME as t };
