import { pn as __exportAll } from "./graphic-BAx7jeh4.js";
import { r as state } from "./store-UtA6O3mA.js";
import { a as HIDDEN_PRICING_MODELS, l as PRICING, p as WEBDAV_SYNC_FILE, r as DEFAULT_PEAK_HOURS } from "./pricing-Bc-qEvy8.js";
import { _ as saveHot, d as isMigrationBackupKey, h as saveExtensionSettings, s as deleteMigrationBackups, u as getExtensionSettings, v as historyRecordKey } from "./persistence-DeIFgZp8.js";
import { r as toast, t as log } from "./logger-8RGXnvfI.js";
import { a as decryptKey, d as getPricing$1, f as isDeepSeekOfficialModel, l as calcCost, o as encryptKey, t as repository, x as mergeWalletCollections } from "./repository-B7vP-cjv.js";
import { a as isUnsafeKey, o as isValidDayKey, t as esc, u as CN_HOLIDAY_COVERAGE_LABEL } from "./date-Dsu8hrMO.js";
import { i as getDisplayCurrency, n as fetchLiveRate } from "./currency-CJMNKSam.js";
import { r as recalcAllCosts } from "./interception-DzQ0MplD.js";
import { i as saveApiKey } from "./balance-BypvPIQk.js";
import { i as isSyncedCustomModel, n as buildSyncPlan, o as removeSyncedModels, r as fetchModelsDevCatalog, s as syncPricingFromModelsDev } from "./pricing-sync-DJgmC8rg.js";
//#region src/ui/icons.ts
var PATHS = {
	overview: "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"/>",
	stats: "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><path d=\"M18 17V9\"/><path d=\"M13 17V5\"/><path d=\"M8 17v-3\"/>",
	history: "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/><path d=\"M12 7v5l4 2\"/>",
	forecast: "<path d=\"M16 7h6v6\"/><path d=\"m22 7-8.5 8.5-5-5L2 17\"/>",
	wallet: "<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\"/><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\"/>",
	settings: "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
	help: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>",
	about: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>",
	"chevron-down": "<path d=\"m6 9 6 6 6-6\"/>",
	"chevron-up": "<path d=\"m18 15-6-6-6 6\"/>",
	"chevron-left": "<path d=\"m15 18-6-6 6-6\"/>",
	"chevron-right": "<path d=\"m9 18 6-6-6-6\"/>",
	refresh: "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/>",
	close: "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
	menu: "<path d=\"M4 6h16\"/><path d=\"M4 12h16\"/><path d=\"M4 18h16\"/>",
	brand: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"4\"/><path d=\"M8 15v-3\"/><path d=\"M12 15V9\"/><path d=\"M16 15v-2\"/>"
};
/**
* 生成内联 SVG；尺寸默认 20px、线宽 1.9，颜色继承 currentColor。
* 用 inline-block + vertical-align 保证既能进 flex 容器居中，也能跟在文字旁边不换行。
*/
function icon(name, size = 20, strokeWidth = 1.9) {
	return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${PATHS[name]}</svg>`;
}
//#endregion
//#region src/ui/switch.ts
function escAttr(value) {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function switchHTML(id, opts = {}) {
	const cls = ["aus-switch", opts.className || ""].filter(Boolean).join(" ");
	const checked = opts.checked ? " checked" : "";
	const disabled = opts.disabled ? " disabled" : "";
	const aria = opts.ariaLabel ? ` aria-label="${escAttr(opts.ariaLabel)}"` : "";
	return `<label class="${cls}"><input type="checkbox" id="${escAttr(id)}" role="switch"${checked}${disabled}${aria} /><span class="aus-switch-track" aria-hidden="true"></span><span class="aus-switch-thumb" aria-hidden="true"></span></label>`;
}
//#endregion
//#region src/services/sync.ts
function b64(s) {
	try {
		return btoa(unescape(encodeURIComponent(s)));
	} catch {
		return btoa(s);
	}
}
function rawFetch() {
	try {
		const p = window.parent;
		return p?.fetch?.bind(p) ?? fetch.bind(window);
	} catch {
		return fetch.bind(window);
	}
}
function authHeader() {
	const cfg = state.settings.webdav || {};
	let pass = "";
	try {
		pass = decryptKey(localStorage.getItem("ds_ds_webdav_pass") || "");
	} catch {}
	try {
		const v = globalThis.SillyTavern?.getContext?.().extensionSettings?.["api_usage_stat"]?.webdavPass;
		if (v) pass = decryptKey(v);
	} catch {}
	return "Basic " + b64((cfg.username || "") + ":" + pass);
}
function realUrl() {
	const cfg = state.settings.webdav || {};
	const base = (cfg.url || "").trim().replace(/\/+$/, "");
	const path = (cfg.path || "").trim().replace(/^\/+|\/+$/g, "");
	let u = base + "/";
	if (path) u += path + "/";
	u += WEBDAV_SYNC_FILE;
	return u;
}
function reqUrl(u) {
	const proxy = (state.settings.webdav?.proxy || "").trim();
	if (!proxy) return u;
	if (proxy.indexOf("?") !== -1) return proxy + encodeURIComponent(u);
	return proxy.replace(/\/+$/, "") + "/" + encodeURIComponent(u);
}
function dirs() {
	const cfg = state.settings.webdav || {};
	const base = (cfg.url || "").trim().replace(/\/+$/, "");
	const path = (cfg.path || "").trim().replace(/^\/+|\/+$/g, "");
	const out = [];
	if (path) {
		let acc = base;
		path.split("/").forEach((seg) => {
			if (seg) {
				acc += "/" + seg;
				out.push(acc);
			}
		});
	}
	return out;
}
async function webdavGet() {
	const url = reqUrl(realUrl());
	try {
		const r = await rawFetch()(url, {
			method: "GET",
			headers: {
				Authorization: authHeader(),
				Accept: "*/*"
			}
		});
		if (r.status === 404) return { exists: false };
		if (!r.ok) return {
			exists: true,
			error: true,
			status: r.status
		};
		return {
			exists: true,
			text: await r.text()
		};
	} catch (e) {
		return {
			exists: false,
			netError: true,
			errName: e?.name || "",
			errMsg: e?.message || String(e)
		};
	}
}
async function webdavMkcol(dir) {
	const url = reqUrl(dir);
	try {
		const r = await rawFetch()(url, {
			method: "MKCOL",
			headers: { Authorization: authHeader() }
		});
		if (r.status === 201 || r.status === 405 || r.status === 204) return true;
		if (r.status === 409) return false;
		return false;
	} catch {
		return false;
	}
}
async function webdavPut(text) {
	for (const d of dirs()) await webdavMkcol(d);
	const url = reqUrl(realUrl());
	const r = await rawFetch()(url, {
		method: "PUT",
		headers: {
			Authorization: authHeader(),
			"Content-Type": "application/json; charset=utf-8"
		},
		body: text
	});
	if (!r.ok) throw new Error("上传失败 HTTP " + r.status);
}
function stripHistory(history) {
	return history.filter((h) => h && h._debug !== true).map((h) => {
		const c = { ...h };
		delete c.messages;
		delete c.fullRequest;
		delete c.fullResponse;
		return c;
	});
}
async function buildLocalBundle() {
	const history = await repository.getAllHistory();
	const settings = JSON.parse(JSON.stringify(state.settings));
	if (settings.webdav) settings.webdav = {
		url: "",
		username: "",
		path: "",
		proxy: ""
	};
	return {
		format: "deepseek-stat-sync",
		version: 2,
		walletFormat: 2,
		syncedAt: Date.now(),
		data: {
			history: stripHistory(history),
			total_tokens: state.total_tokens,
			total_cost: state.total_cost,
			input_tokens: state.input_tokens,
			output_tokens: state.output_tokens,
			cache_hit_tokens: state.cache_hit_tokens,
			cache_miss_tokens: state.cache_miss_tokens,
			input_cost: state.input_cost,
			output_cost: state.output_cost,
			rounds: state.rounds,
			startTime: state.startTime,
			balance: state.balance,
			customBalance: state.customBalance,
			wallets: state.wallets,
			walletIgnored: state.walletIgnored,
			settings,
			messageCount: state.messageCount
		},
		_ts: {}
	};
}
function mergeBundles(remote, local) {
	const rd = remote.data || {}, ld = local.data || {};
	const toHistory = (d) => {
		if (Array.isArray(d.history)) return d.history;
		if (d.saves && typeof d.saves === "object") {
			let arr = [];
			for (const s of Object.values(d.saves)) arr = arr.concat(s.history || []);
			return arr;
		}
		return [];
	};
	const clean = (arr) => arr.map((e) => {
		if (e && typeof e === "object") {
			for (const k of Object.keys(e)) if (isUnsafeKey(k)) delete e[k];
		}
		return e;
	});
	const lh = clean(toHistory(ld)), rh = clean(toHistory(rd));
	const keyOf = historyRecordKey;
	const lseen = new Set(lh.map((h) => keyOf(h)));
	const rseen = new Set(rh.map((h) => keyOf(h)));
	let pulled = 0, pushed = 0;
	const merged = [
		...rh.filter((h) => {
			if (!lseen.has(keyOf(h))) {
				pulled++;
				return true;
			}
			return false;
		}),
		...lh.filter((h) => {
			if (!rseen.has(keyOf(h))) {
				pushed++;
				return true;
			}
			return false;
		}),
		...lh.filter((h) => rseen.has(keyOf(h)))
	];
	const dedup = /* @__PURE__ */ new Map();
	for (const h of merged) dedup.set(keyOf(h), h);
	let hist = Array.from(dedup.values()).sort((a, b) => b.timestamp - a.timestamp);
	return {
		mergedData: {
			history: hist,
			total_tokens: ld.total_tokens ?? rd.total_tokens ?? hist.reduce((a, h) => a + (h.total_tokens || 0), 0),
			total_cost: ld.total_cost ?? rd.total_cost ?? hist.reduce((a, h) => a + (h.cost || 0), 0),
			input_tokens: ld.input_tokens ?? rd.input_tokens ?? 0,
			output_tokens: ld.output_tokens ?? rd.output_tokens ?? 0,
			cache_hit_tokens: ld.cache_hit_tokens ?? rd.cache_hit_tokens ?? 0,
			cache_miss_tokens: ld.cache_miss_tokens ?? rd.cache_miss_tokens ?? 0,
			input_cost: ld.input_cost ?? rd.input_cost ?? 0,
			output_cost: ld.output_cost ?? rd.output_cost ?? 0,
			rounds: ld.rounds ?? rd.rounds ?? hist.length,
			startTime: ld.startTime ?? rd.startTime ?? Date.now(),
			balance: ld.balance ?? rd.balance,
			customBalance: ld.customBalance ?? rd.customBalance,
			wallets: mergeWalletCollections(ld.wallets || repository.getWallets(), rd.wallets || []),
			walletIgnored: Array.from(/* @__PURE__ */ new Set([...ld.walletIgnored || [], ...rd.walletIgnored || []])),
			messageCount: ld.messageCount ?? rd.messageCount,
			settings: ld.settings ?? rd.settings
		},
		pulled,
		pushed
	};
}
var syncing = false;
async function doSyncNow() {
	if (syncing) return alert("同步进行中");
	const cfg = state.settings.webdav || {};
	if (!cfg.url || !cfg.username) return alert("请先在设置中填写 WebDAV 地址与用户名");
	if (!/^https:\/\//i.test(cfg.url)) return alert("WebDAV 地址必须为 https");
	const proxy = (cfg.proxy || "").trim();
	if (proxy && !/^https:\/\//i.test(proxy)) {
		if (!confirm("CORS 代理非 https，WebDAV 用户名密码将以可被截获的方式经该代理传输。\n仍要继续？")) return;
	}
	syncing = true;
	const btn = window.parent?.document?.getElementById("aus-webdav-sync");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "同步中…";
	}
	try {
		const local = await buildLocalBundle();
		const res = await webdavGet();
		if (res.netError) {
			const isCors = res.errName === "TypeError" || /Failed to fetch|NetworkError|CORS/i.test(res.errMsg || "");
			throw new Error(isCors ? "CORS 被拦截，请配置 CORS 代理" : "网络错误: " + (res.errMsg || "未知"));
		}
		if (res.error) throw new Error("读取云端失败 HTTP " + res.status);
		let merged;
		if (!res.exists) merged = {
			mergedData: local.data,
			pulled: 0,
			pushed: 0
		};
		else {
			let remote;
			try {
				remote = JSON.parse(res.text);
			} catch {
				throw new Error("云端文件解析失败");
			}
			if (remote.format !== "deepseek-stat-sync") throw new Error("云端格式不符");
			if (remote.version > 2) throw new Error("云端版本过高，请升级扩展");
			merged = mergeBundles(remote, local);
		}
		await repository.replaceAll(merged.mergedData);
		await repository.recalcAll();
		await repository.rebuildAggregates();
		const uploaded = await buildLocalBundle();
		await webdavPut(JSON.stringify(uploaded));
		alert(`同步完成${merged.pulled ? `（拉取 ${merged.pulled} 条）` : ""}${merged.pushed ? `（上传 ${merged.pushed} 条）` : ""}`);
		try {
			globalThis.ApiUsageStat?.refreshUI?.();
		} catch {}
	} catch (e) {
		alert("同步失败: " + (e?.message || e));
	} finally {
		syncing = false;
		if (btn) {
			btn.disabled = false;
			btn.textContent = "☁️ 立即同步";
		}
	}
}
function saveWebdavPass(pass) {
	try {
		if (pass) localStorage.setItem("ds_ds_webdav_pass", encryptKey(pass));
		else localStorage.removeItem("ds_ds_webdav_pass");
		const ctx = globalThis.SillyTavern?.getContext?.();
		if (ctx?.extensionSettings) {
			ctx.extensionSettings["api_usage_stat"] = ctx.extensionSettings["api_usage_stat"] || {};
			if (pass) ctx.extensionSettings["api_usage_stat"].webdavPass = encryptKey(pass);
			else delete ctx.extensionSettings["api_usage_stat"].webdavPass;
			ctx.saveSettingsDebounced?.();
		}
	} catch {}
}
//#endregion
//#region src/services/theme.ts
var DARK_QUERY = "(prefers-color-scheme: dark)";
/** 归一化用户设置值，非法值一律视为 light（保持旧版本行为） */
function normalizeThemeMode(v) {
	return v === "dark" || v === "auto" ? v : "light";
}
/** 取宿主窗口：面板可能运行在 iframe 中，优先 parent */
function hostWindow() {
	try {
		const p = window?.parent;
		if (p && typeof p.matchMedia === "function") return p;
	} catch {}
	try {
		if (typeof window !== "undefined" && typeof window.matchMedia === "function") return window;
	} catch {}
	return null;
}
/** 系统是否处于深色（不支持 prefers-color-scheme 时返回 false） */
function systemPrefersDark(win) {
	const w = win ?? hostWindow();
	try {
		if (!w || typeof w.matchMedia !== "function") return false;
		return !!w.matchMedia(DARK_QUERY).matches;
	} catch {
		return false;
	}
}
/** 把设置值解析为真正生效的 light / dark */
function resolveTheme(mode, win) {
	const m = normalizeThemeMode(mode);
	if (m === "dark") return "dark";
	if (m === "auto") return systemPrefersDark(win) ? "dark" : "light";
	return "light";
}
function getDoc() {
	try {
		const parentDoc = window.parent?.document;
		if (parentDoc) return parentDoc;
	} catch {}
	try {
		return document;
	} catch {
		return {};
	}
}
/** 仅同步 DOM 属性，不读设置、不落盘 */
function paintTheme(mode, resolved) {
	const r = resolved ?? resolveTheme(mode);
	try {
		const doc = getDoc();
		const panel = doc.getElementById("aus-panel");
		if (panel) panel.setAttribute("data-ds-theme", r);
		const overlay = doc.getElementById("aus-overlay");
		if (overlay) {
			overlay.setAttribute("data-extension", "api-usage-stat");
			overlay.setAttribute("data-ds-theme", r);
		}
		try {
			document.documentElement.removeAttribute("data-ds-theme");
			document.documentElement.removeAttribute("data-extension");
		} catch {}
		try {
			doc.documentElement.removeAttribute("data-ds-theme");
			if (doc.documentElement.getAttribute("data-extension") === "api-usage-stat") {
				if (!!doc.getElementById("aus-panel")) doc.documentElement.removeAttribute("data-extension");
			}
		} catch {}
	} catch {}
}
function applyTheme(theme) {
	const t = normalizeThemeMode(theme ?? state.settings?.theme);
	paintTheme(t);
	if (t === "auto") try {
		watchSystemTheme();
	} catch {}
}
var boundWin = null;
var boundMql = null;
var boundHandler = null;
/**
* 主题实际变化后需要重绘的动态内容。
* ECharts 的配色在绘制时就已固化进 option，不随 CSS 变量更新，必须重建实例再重绘；
* 热力图等内联色值同理。refreshUI 会在面板打开时重绘 概览/统计/预测/钱包 四个视图。
*/
function repaintDynamic() {
	try {
		globalThis.ApiUsageStat?.refreshTheme?.();
	} catch {}
}
/**
* 监听系统配色变化：仅在 auto 模式下响应。
* 同一 window 只绑一次；宿主不支持 addEventListener 时静默降级（不抛错）。
*/
function watchSystemTheme(win) {
	const w = win ?? hostWindow();
	if (!w || typeof w.matchMedia !== "function") return;
	if (boundWin === w) return;
	unwatchSystemTheme();
	try {
		const mql = w.matchMedia(DARK_QUERY);
		if (!mql || typeof mql.addEventListener !== "function") return;
		boundHandler = (e) => {
			if (normalizeThemeMode(state.settings?.theme) !== "auto") return;
			paintTheme("auto", e?.matches ? "dark" : "light");
			let hasPanel = false;
			try {
				hasPanel = !!getDoc().getElementById("aus-panel");
			} catch {}
			if (hasPanel) repaintDynamic();
		};
		mql.addEventListener("change", boundHandler);
		boundWin = w;
		boundMql = mql;
	} catch {}
}
/** 解除监听（扩展禁用时调用，避免热重载后重复触发） */
function unwatchSystemTheme() {
	try {
		if (boundMql && boundHandler) boundMql.removeEventListener("change", boundHandler);
	} catch {}
	boundMql = null;
	boundWin = null;
	boundHandler = null;
}
/** 设置切换后调用：auto 时确保监听已建立 */
function syncThemeWatcher() {
	if (normalizeThemeMode(state.settings?.theme) === "auto") watchSystemTheme();
}
//#endregion
//#region src/services/storage-usage.ts
/**
* 存储占用统计：统计本扩展在各类存储中占用的空间。
*
* 本扩展的数据实际分布在四个地方（见 store/persistence.ts）：
*  1. SillyTavern 设置（extensionSettings.api_usage_stat）—— 热数据：最近 50 条历史 + 设置 + 汇总
*     注：由酒馆统一序列化进其 settings.json，浏览器端拿不到落盘字节数，只能按 UTF-8 估算
*  2. IndexedDB `api_usage_stat_db` / `kv` —— 冷历史、旧版迁移备份
*  3. localStorage —— 零星小项（WebDAV 密码密文、峰值圆点位置、调试开关、更新检查时间、预测页偏好）
*  4. 浏览器存储配额（navigator.storage.estimate）—— 全局参考，不是本扩展独占
*
* 兼容性要点：
*  - `navigator.storage.estimate` 仅在安全上下文（https / localhost）可用；http 局域网访问时缺失，
*    此时标记为“不可用”，不显示假数据。
*  - `navigator.storage.persisted` 在 Safari 早期版本缺失，按未知处理。
*  - 隐私模式 / 第三方 Cookie 被拦截时 IndexedDB 可能直接抛错，全部走 try/catch 降级。
*  - 统一用 UTF-8 字节数（TextEncoder），不用 .length（UTF-16 码元数会低估中文占用）。
*/
var DB_NAME = "api_usage_stat_db";
var STORE_NAME = "kv";
/** UTF-8 字节数（中文 3 字节，避免用 length 低估） */
function utf8Bytes(text) {
	if (!text) return 0;
	try {
		if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
	} catch {}
	let n = 0;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		if (c < 128) n += 1;
		else if (c < 2048) n += 2;
		else if (c >= 55296 && c <= 56319) {
			n += 4;
			i++;
		} else n += 3;
	}
	return n;
}
/** 人类可读的容量文本。始终用二进制单位（KB=1024），与系统/浏览器存储界面口径一致 */
function formatBytes(bytes) {
	if (bytes == null || !isFinite(bytes) || bytes < 0) return "—";
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	const units = [
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let v = bytes / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
	return `${parseFloat(v.toFixed(digits))} ${units[i]}`;
}
var LS_PREFIX_KEYS = [
	{
		key: "webdav_pass",
		label: "WebDAV 密码（XOR）",
		match: (k) => k === "ds_ds_webdav_pass"
	},
	{
		key: "peak_dot",
		label: "峰值圆点位置",
		match: (k) => k === "ds_ds_peak_dot_pos"
	},
	{
		key: "debug_log",
		label: "调试日志开关",
		match: (k) => k === "ds_debug_log"
	},
	{
		key: "update",
		label: "更新检查记录",
		match: (k) => k.startsWith("aus_update_")
	},
	{
		key: "forecast_prefs",
		label: "预测页偏好",
		match: (k) => k === "aus_forecast_prefs_v1"
	},
	{
		key: "idb_fallback",
		label: "本地存储降级副本",
		match: (k) => k.startsWith("aus_cold")
	}
];
function readLocalStorage(doc) {
	let ls = null;
	try {
		ls = doc.defaultView?.localStorage ?? null;
	} catch {
		ls = null;
	}
	if (!ls) return [];
	let keys = [];
	try {
		for (let i = 0; i < ls.length; i++) {
			const k = ls.key(i);
			if (k) keys.push(k);
		}
	} catch {
		return [];
	}
	const items = [];
	const used = /* @__PURE__ */ new Set();
	for (const def of LS_PREFIX_KEYS) {
		let bytes = 0;
		let count = 0;
		for (const k of keys) {
			if (used.has(k) || !def.match(k)) continue;
			try {
				bytes += utf8Bytes(ls.getItem(k)) + utf8Bytes(k);
			} catch {}
			used.add(k);
			count++;
		}
		if (count > 0) items.push({
			key: `ls-${def.key}`,
			label: def.label,
			bytes
		});
	}
	return items;
}
/**
* 打开本扩展的 IndexedDB。读不到返回 null（隐私模式、被拦截、从未写入过）。
* 用 openDatabase 时不会在全新浏览器上创建空库；但标准 indexedDB 只有 open()，
* 而 open() 在库不存在时会触发 upgradeneeded 并真的建一个空库 —— 为避免“看一眼就建库”，
* 先用 databases() 探测是否存在（Chrome 71+ / Safari 14+ / Firefox 126+），
* 不支持 databases() 的环境退回 open()，且不写入任何数据（空库 0 字节，无害）。
*/
function openDb(doc) {
	return new Promise((resolve) => {
		let idb = null;
		try {
			idb = doc.defaultView?.indexedDB ?? null;
		} catch {
			idb = null;
		}
		if (!idb) return resolve(null);
		let settled = false;
		const done = (db) => {
			if (settled) {
				try {
					db?.close();
				} catch {}
				return;
			}
			settled = true;
			resolve(db);
		};
		const doOpen = () => {
			try {
				const req = idb.open(DB_NAME, 1);
				req.onsuccess = (e) => done(e.target.result);
				req.onerror = () => done(null);
				req.onblocked = () => done(null);
				req.onupgradeneeded = () => {
					try {
						req.result.createObjectStore(STORE_NAME);
					} catch {}
				};
			} catch {
				done(null);
			}
		};
		const probe = idb.databases;
		if (typeof probe === "function") try {
			probe.call(idb).then((list) => {
				if (settled) return;
				if (Array.isArray(list) && list.some((d) => d && d.name === DB_NAME)) doOpen();
				else done(null);
			}).catch(() => done(null));
			return;
		} catch {}
		done(null);
	});
}
async function readIndexedDb(doc) {
	const db = await openDb(doc);
	if (!db) return [];
	try {
		if (!db.objectStoreNames.contains(STORE_NAME)) return [];
		const result = await new Promise((resolve) => {
			const out = [];
			try {
				const tx = db.transaction([STORE_NAME], "readonly");
				const req = tx.objectStore(STORE_NAME).openCursor();
				req.onsuccess = (e) => {
					const cur = e.target.result;
					if (!cur) {
						resolve(out);
						return;
					}
					const v = cur.value;
					out.push({
						k: String(cur.key),
						bytes: typeof v === "string" ? utf8Bytes(v) : utf8Bytes(JSON.stringify(v))
					});
					try {
						cur.continue();
					} catch {
						resolve(out);
					}
				};
				req.onerror = () => resolve(out);
				tx.onabort = () => resolve(out);
			} catch {
				resolve(out);
			}
			setTimeout(() => resolve(out), 800);
		});
		const items = [];
		let backupBytes = 0;
		let backupCount = 0;
		for (const r of result) {
			if (r.k === "cold_history") {
				items.push({
					key: "idb-cold",
					label: "历史记录（冷数据）",
					bytes: r.bytes
				});
				continue;
			}
			if (isMigrationBackupKey(r.k)) {
				backupBytes += r.bytes;
				backupCount += 1;
				continue;
			}
			items.push({
				key: "idb-" + r.k.replace(/[^\w-]/g, "_"),
				label: r.k,
				bytes: r.bytes
			});
		}
		if (backupCount > 0) items.push({
			key: "idb-backup",
			label: "旧版迁移备份",
			bytes: backupBytes,
			detail: backupCount > 1 ? `${backupCount} 份升级前快照，确认数据无误后可清理` : "升级前的一次性快照，确认数据无误后可清理",
			cleanable: "migration_backup",
			itemCount: backupCount
		});
		return items;
	} finally {
		try {
			db.close();
		} catch {}
	}
}
/** 热数据：酒馆 extensionSettings 中被序列化的 JSON 体积（UTF-8 估算） */
function estimateHotBytes(settings) {
	if (settings == null) return 0;
	try {
		return utf8Bytes(JSON.stringify(settings));
	} catch {
		return 0;
	}
}
/**
* 汇总存储占用。任何单项失败都只影响该项（标记为 null），不会让整块 UI 失败。
* 全程不使用 localStorage.clear / indexedDB.deleteDatabase 等破坏性操作。
*/
async function collectStorageReport(opts = {}) {
	const doc = opts.doc ?? (typeof document !== "undefined" ? document : {});
	const items = [];
	const hotBytes = estimateHotBytes(opts.hotSettings);
	items.push({
		key: "hot",
		label: "设置与近期记录",
		bytes: hotBytes,
		detail: "保存在酒馆设置文件中"
	});
	let idbItems = [];
	let idbTimer = null;
	try {
		const timeout = opts.idbTimeoutMs ?? 1e3;
		idbItems = await Promise.race([readIndexedDb(doc), new Promise((resolve) => {
			idbTimer = setTimeout(() => resolve([]), timeout);
		})]);
	} catch {
		idbItems = [];
	} finally {
		if (idbTimer) try {
			clearTimeout(idbTimer);
		} catch {}
	}
	items.push(...idbItems);
	try {
		items.push(...readLocalStorage(doc));
	} catch {}
	let quotaBytes = null;
	let usageBytes = null;
	let persisted = null;
	let globalAvailable = false;
	try {
		const storage = (doc.defaultView?.navigator ?? (typeof navigator !== "undefined" ? navigator : null))?.storage;
		if (storage && typeof storage.estimate === "function") {
			const est = await storage.estimate();
			if (est && typeof est.quota === "number") {
				quotaBytes = est.quota;
				usageBytes = typeof est.usage === "number" ? est.usage : null;
				globalAvailable = true;
			}
		}
		if (storage && typeof storage.persisted === "function") persisted = !!await storage.persisted();
	} catch {}
	return {
		items,
		totalBytes: items.reduce((sum, i) => sum + (i.bytes || 0), 0),
		quotaBytes,
		usageBytes,
		persisted,
		globalAvailable
	};
}
//#endregion
//#region src/ui/storage-usage-card.ts
/**
* 设置页「存储占用」卡片渲染。
*
* 结构：标题行（标题 + 刷新按钮） → 合计数字 → 细分条目列表 → 浏览器配额（可缺失）→ 说明。
* 细分行用 grid 两列（名称 / 数值），窄屏下名称自动换行，数值右对齐，不会撑破容器。
*/
var MODULE = "api_usage_stat";
/** 小于该体积的条目归入「其他」，避免十几个几十字节的小项把列表撑长 */
var SMALL_ITEM_BYTES = 1024;
/** 单项行：名称 + 数值，数值用等宽数字避免跳动 */
function row(item, total, opts = {}) {
	const pctRaw = total > 0 && item.bytes != null ? item.bytes / total * 100 : null;
	const pct = pctRaw != null && !opts.sub && pctRaw >= .5 ? Math.round(pctRaw) : null;
	const detailHtml = item.detail && opts.toggle ? `<span data-others-count>${esc(item.detail)}</span>` : esc(item.detail || "");
	const sub = item.detail ? `<div ${opts.toggle ? "data-others-hint" : ""} style="font-size:var(--aus-fs-xs);color:var(--ds-text-3);margin-top:2px;line-height:1.4;">${detailHtml}</div>` : "";
	const indent = opts.sub ? "padding-left:16px;background:color-mix(in srgb, var(--ds-text) 3%, transparent);" : "";
	const clickStyle = opts.toggle ? "cursor:pointer;user-select:none;" : "";
	return `<div class="aus-storage-row"${opts.toggle ? ` id="${opts.toggle.id}" role="button" tabindex="0" aria-expanded="${opts.toggle.expanded}"` : ""} style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--ds-border);${indent}${clickStyle}">
    <div style="min-width:0;flex:1 1 auto;">
      <div class="aus-storage-row-label" style="font-size:var(--aus-fs-base);color:var(--ds-text);line-height:1.5;overflow-wrap:anywhere;">${esc(item.label)}</div>
      ${sub}
    </div>
    <div style="flex:0 0 auto;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">
      <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">${formatBytes(item.bytes)}</div>
      ${pct != null ? `<div style="font-size:var(--aus-fs-xs);color:var(--ds-text-3);margin-top:2px;">${pct}%</div>` : ""}
      ${opts.action ? `<button id="${opts.action.id}" type="button" data-armed="0" title="${esc(opts.action.title || "")}" style="margin-top:5px;padding:3px 10px;border:1px solid var(--ds-red-border);border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-xs);cursor:pointer;line-height:1.5;white-space:nowrap;">${esc(opts.action.label)}</button>` : ""}
    </div>
  </div>`;
}
function renderStorageUsageCard(doc) {
	return `<div class="ds-card" id="aus-storage-card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">存储占用</span>
      <button id="aus-storage-refresh" title="重新统计" style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;line-height:1;">${icon("refresh", 13)}<span>刷新</span></button>
    </div>
    <div id="aus-storage-body" style="margin-top:6px;">
      <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);padding:10px 0;">正在统计…</div>
    </div>
  </div>`;
}
function bodyHtml(r) {
	const parts = [];
	parts.push(`<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding-bottom:10px;">
    <span class="ds-card-val" style="font-size:clamp(20px,4.2cqi,26px);">${formatBytes(r.totalBytes)}</span>
    <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">本扩展占用合计</span>
  </div>`);
	if (r.items.length === 0) parts.push(`<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);padding:6px 0;">暂无数据</div>`);
	else {
		const major = r.items.filter((i) => (i.bytes ?? 0) >= SMALL_ITEM_BYTES);
		const minor = r.items.filter((i) => (i.bytes ?? 0) < SMALL_ITEM_BYTES);
		const rows = major.map((i) => row(i, r.totalBytes, i.cleanable === "migration_backup" ? { action: {
			id: "aus-storage-clean-backup",
			label: "清理",
			title: "删除升级前的一次性备份快照"
		} } : {}));
		if (minor.length) {
			const minorTotal = minor.reduce((a, i) => a + (i.bytes || 0), 0);
			rows.push(row({
				label: "其他",
				bytes: minorTotal,
				detail: `${minor.length} 项小数据，点击展开`
			}, r.totalBytes, { toggle: {
				id: "aus-storage-others",
				expanded: false
			} }));
			rows.push(`<div id="aus-storage-others-detail" style="display:none;">${minor.map((i) => row(i, r.totalBytes, { sub: true })).join("")}</div>`);
		}
		parts.push(`<div>${rows.join("")}</div>`);
	}
	if (r.globalAvailable && r.quotaBytes != null) {
		const usagePct = r.usageBytes != null && r.quotaBytes > 0 ? Math.min(100, r.usageBytes / r.quotaBytes * 100) : null;
		const persistLabel = r.persisted == null ? "" : r.persisted ? "已启用持久化存储" : "未申请持久化存储";
		parts.push(`<div style="margin-top:10px;padding:9px 11px;border-radius:10px;background:var(--ds-card-inner);">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">浏览器站点用量</span>
        <span style="font-size:var(--aus-fs-sm);color:var(--ds-text);font-variant-numeric:tabular-nums;white-space:nowrap;">
          ${r.usageBytes != null ? formatBytes(r.usageBytes) : "—"} / ${formatBytes(r.quotaBytes)}
        </span>
      </div>
      ${usagePct != null ? `<div class="aus-storage-quota-bar" style="margin-top:7px;">
        <div class="aus-storage-quota-fill" style="width:${usagePct.toFixed(2)}%;"></div>
      </div>` : ""}
      <div style="font-size:var(--aus-fs-xs);color:var(--ds-text-3);margin-top:6px;line-height:1.5;">该数值由浏览器统计，包含酒馆与所有扩展的占用，本扩展只占其中一部分。${persistLabel ? `<span style="margin-left:4px;">${persistLabel}</span>` : ""}</div>
    </div>`);
	}
	parts.push(`<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:9px;line-height:1.6;">
    历史记录按最近 50 条保存在酒馆设置中，更早的进入浏览器 IndexedDB；设置为 UTF-8 估算体积，与实际落盘大小可能略有差异。旧版迁移备份是升级前的一次性快照，现有数据已迁移完成，确认无误后可点「清理」删除（不影响历史、设置与钱包）。
  </div>`);
	return parts.join("");
}
/** 统计并渲染到指定卡片。多次调用会取消上一次的过期结果 */
var renderSeq = 0;
async function refreshStorageUsage(doc) {
	const body = doc.getElementById("aus-storage-body");
	if (!body) return;
	const seq = ++renderSeq;
	const btn = doc.getElementById("aus-storage-refresh");
	if (btn) {
		btn.disabled = true;
		btn.style.opacity = "0.6";
	}
	try {
		const report = await collectStorageReport({
			doc,
			hotSettings: (globalThis.SillyTavern?.getContext?.())?.extensionSettings?.[MODULE] ?? getExtensionSettings()
		});
		if (seq !== renderSeq) return;
		body.innerHTML = bodyHtml(report);
		bindStorageUsageCard(doc);
	} catch (e) {
		if (seq === renderSeq) body.innerHTML = `<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);padding:8px 0;">统计失败：${esc(e?.message || "未知错误")}</div>`;
	} finally {
		if (seq === renderSeq && btn) {
			btn.disabled = false;
			btn.style.opacity = "";
		}
	}
}
/** 绑定刷新按钮 */
function bindStorageUsageCard(doc) {
	const btn = doc.getElementById("aus-storage-refresh");
	if (btn) btn.onclick = () => {
		refreshStorageUsage(doc);
	};
	const cleanBtn = doc.getElementById("aus-storage-clean-backup");
	if (cleanBtn) {
		const idleLabel = cleanBtn.textContent || "清理";
		let armTimer = null;
		const disarm = () => {
			cleanBtn.dataset.armed = "0";
			cleanBtn.textContent = idleLabel;
			if (armTimer) {
				clearTimeout(armTimer);
				armTimer = null;
			}
		};
		cleanBtn.onclick = async () => {
			if (cleanBtn.dataset.armed !== "1") {
				cleanBtn.dataset.armed = "1";
				cleanBtn.textContent = "确认清理？再点一次";
				if (armTimer) clearTimeout(armTimer);
				armTimer = setTimeout(disarm, 5e3);
				return;
			}
			disarm();
			cleanBtn.disabled = true;
			cleanBtn.textContent = "清理中…";
			try {
				const result = await deleteMigrationBackups();
				if (result.deleted > 0) toast("success", `已清理 ${result.deleted} 份旧版迁移备份`);
				else if (result.remaining > 0) toast("warning", "旧版迁移备份未能删除，请刷新后重试");
				else toast("info", "未找到可清理的旧版迁移备份");
				if (result.remaining > 0 && result.deleted > 0) toast("warning", `仍有 ${result.remaining} 份备份未删除，请刷新后重试`);
			} catch (e) {
				toast("error", "清理失败：" + (e?.message || e));
			} finally {
				await refreshStorageUsage(doc);
			}
		};
	}
	const toggle = doc.getElementById("aus-storage-others");
	const detail = doc.getElementById("aus-storage-others-detail");
	if (!toggle || !detail) return;
	const flip = () => {
		const open = detail.style.display !== "none";
		detail.style.display = open ? "none" : "block";
		toggle.setAttribute("aria-expanded", open ? "false" : "true");
		const hint = toggle.querySelector("[data-others-hint] [data-others-count]");
		if (hint) hint.textContent = hint.textContent.replace(open ? "点击收起" : "点击展开", open ? "点击展开" : "点击收起");
	};
	toggle.onclick = flip;
	toggle.onkeydown = (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			flip();
		}
	};
}
//#endregion
//#region src/services/debug.ts
function generateDebugBatch() {
	const startStr = state.settings.debugDateStart;
	const endStr = state.settings.debugDateEnd;
	if (!startStr || !endStr) return alert("请设置起始与结束日期");
	const startDate = /* @__PURE__ */ new Date(startStr + "T00:00:00");
	const endDate = /* @__PURE__ */ new Date(endStr + "T00:00:00");
	if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return alert("日期范围无效");
	const count = state.settings.debugBatchCount || 30;
	const model = state.settings.debugModel || "deepseek-v4-flash";
	const hit = state.settings.debugHit || 1e4;
	const miss = state.settings.debugMiss || 5e3;
	const output = state.settings.debugOutput || 2e3;
	const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 864e5) + 1;
	const perDay = Math.ceil(count / totalDays);
	let generated = 0;
	for (let d = 0; d < totalDays && generated < count; d++) {
		const curDate = new Date(startDate);
		curDate.setDate(startDate.getDate() + d);
		for (let i = 0; i < perDay && generated < count; i++) {
			const rv = (base) => Math.round(base * (.3 + Math.random() * 1.4));
			const h = rv(hit), m = rv(miss), o = rv(output);
			const total = h + m + o;
			const ts = new Date(curDate);
			ts.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
			const dur = Math.floor(Math.random() * 5e3) + 500;
			const ttft = Math.floor(Math.random() * 1e3) + 100;
			const c = calcCost({
				timestamp: ts.getTime(),
				model,
				prompt_cache_hit_tokens: h,
				prompt_cache_miss_tokens: m,
				completion_tokens: o
			}, state.settings);
			state.total_tokens += total;
			state.total_cost += c.total;
			state.input_tokens += h + m;
			state.output_tokens += o;
			state.cache_hit_tokens += h;
			state.cache_miss_tokens += m;
			state.input_cost += c.input;
			state.output_cost += c.output;
			if (isDeepSeekOfficialModel(model)) state.rounds += 1;
			const isTrunc = Math.random() < .08;
			const fr = isTrunc ? "length" : "stop";
			state.history.unshift({
				timestamp: ts.getTime(),
				model,
				prompt_tokens: h + m,
				cache_hit_tokens: h,
				cache_miss_tokens: m,
				completion_tokens: o,
				total_tokens: total,
				input_cost: c.input,
				output_cost: c.output,
				cost: c.total,
				cache_hit_rate: h + m > 0 ? h / (h + m) * 100 : 0,
				priceType: c.priceType,
				raw_usage: {
					prompt_cache_hit_tokens: h,
					prompt_cache_miss_tokens: m,
					completion_tokens: o,
					total_tokens: total,
					__finish_reason: fr
				},
				messages: [],
				duration: dur,
				ttft,
				thinkTime: 300,
				thinkTokens: Math.floor(o * .2),
				tokenRate: Math.round(o / (dur - ttft) * 1e3),
				fullRequest: null,
				fullResponse: null,
				finishReason: fr,
				isTruncated: isTrunc,
				_debug: true
			});
			generated++;
		}
	}
	state.history.sort((a, b) => b.timestamp - a.timestamp);
	repository.recalcAll();
	try {
		globalThis.ApiUsageStat?.refreshUI?.();
	} catch {}
	alert("已生成 " + generated + " 条模拟数据");
}
//#endregion
//#region src/ui/dropdown-close.ts
/**
* 胶囊下拉的「点选项 → 关闭 → 重绘」统一收口。
*
* 历史问题：选项处理器习惯写成
*   drop.style.display = 'none';
*   renderStatsView();          // 内部重建整页 + 重画 ECharts
* 两件事挤在同一个任务里，浏览器必须等整段 JS 跑完才首次绘制，于是下拉的关闭状态一直画不出来，
* 用户看到的是「点了没反应，等一下才突然消失」。反过来先只写 display 也不够：浮层是 90ms 的
* 淡出过渡，元素在过渡期间仍占着旧画面。所以这里拆成两步：
*   1) closeDropdownInstant：临时关掉过渡再把 display 写成 none，让浮层当场消失（不参与淡出）；
*   2) closeDropdownThenPaint：把重绘推到下一帧之后，先让屏幕把「已经关了」画出来，再付重绘的钱。
*
* 只给「选中某一项后要重绘」的路径使用；点外部关闭、按钮互斥关闭继续走 CSS 淡出（见 style.css
* 「胶囊下拉浮层：开 / 合过渡」的关闭态规则），不要换成瞬时关闭，否则失去淡出手感。
*/
/** 立即把浮层关掉，不参与 CSS 淡出（临时把 transition 置为 none，写完 display 再还原）。 */
function closeDropdownInstant(drop) {
	if (!drop) return;
	const style = drop.style;
	if (style.display === "none") return;
	const prev = style.transition;
	style.transition = "none";
	style.display = "none";
	drop.getBoundingClientRect().width;
	if (prev) style.transition = prev;
	else style.removeProperty("transition");
}
/** 下一帧（双 requestAnimationFrame）之后再执行，另带 120ms 兜底（后台标签页 rAF 会暂停）。只执行一次。 */
function afterNextPaint(run, schedule) {
	let done = false;
	const fire = () => {
		if (done) return;
		done = true;
		try {
			run();
		} catch (err) {
			console.error("[aus] 下拉关闭后的重绘失败", err);
		}
	};
	const sched = schedule || defaultSchedule;
	try {
		sched(fire);
	} catch {
		setTimeout(fire, 120);
	}
}
function defaultSchedule(run) {
	const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
	if (raf) raf(() => raf(run));
	else setTimeout(run, 0);
	setTimeout(run, 120);
}
/** 瞬时关闭浮层，再把重绘推到下一帧之后。 */
function closeDropdownThenPaint(drop, run, schedule) {
	closeDropdownInstant(drop);
	afterNextPaint(run, schedule);
}
var IDENTITY_KEY = "telemetry";
/** 关闭面板触发上报的最小间隔（吃掉反复开关面板造成的抖动） */
var CLOSE_FLUSH_GAP = 6e4;
/** 页面隐藏/卸载触发上报的最小间隔（合并间隔，避免同一次使用反复发送） */
var PASSIVE_FLUSH_GAP = 18e5;
/** 失败重试退避（首次发送 + 3 次重试） */
var RETRY_DELAYS = [
	1e3,
	5e3,
	3e4
];
/** 单次会话时长上限，超出按上限计入 */
var MAX_DURATION_MS = 432e5;
/** 单次上报可携带的酒馆运行时长上限（自页面加载起累加的墙钟时间） */
var MAX_RUNTIME_MS = 864e5;
/** 只有运行时长、没有任何面板计数时的最小上报间隔，避免空转请求 */
var RUNTIME_MIN_FLUSH_MS = 6e4;
var TELEMETRY_PAGE_KEYS = [
	"overview",
	"stats",
	"history",
	"forecast",
	"wallet",
	"settings",
	"help",
	"about"
];
function emptyPages() {
	const pages = {};
	for (const key of TELEMETRY_PAGE_KEYS) pages[key] = 0;
	return pages;
}
function emptyCounters() {
	return {
		opens: 0,
		dur_ms: 0,
		pages: emptyPages(),
		render: [
			0,
			0,
			0,
			0,
			0
		]
	};
}
function isTelemetryPageKey(value) {
	return typeof value === "string" && TELEMETRY_PAGE_KEYS.includes(value);
}
/** 面板可用宽度分桶 */
function widthBucket(width) {
	const w = Number.isFinite(width) ? Number(width) : 0;
	if (w > 1024) return "gt1024";
	if (w > 760) return "761-1024";
	if (w > 480) return "481-760";
	return "le480";
}
/** 面板首帧渲染耗时分桶下标：<100 / <300 / <800 / <2000 / ≥2000 毫秒 */
function renderBucketIndex(ms) {
	const value = Number.isFinite(ms) ? Math.max(0, Number(ms)) : 0;
	if (value < 100) return 0;
	if (value < 300) return 1;
	if (value < 800) return 2;
	if (value < 2e3) return 3;
	return 4;
}
/** 时区偏移按 0.5 小时取整并钳制到 [-12, 14] */
function roundTz(hours) {
	const value = Number.isFinite(hours) ? Number(hours) : 0;
	const rounded = Math.round(value * 2) / 2;
	const clamped = Math.min(14, Math.max(-12, rounded));
	return clamped === 0 ? 0 : clamped;
}
/** 本地日期（YYYY-MM-DD） */
function todayKey(now = Date.now()) {
	const d = new Date(now);
	const pad = (n) => n < 10 ? "0" + n : String(n);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/**
* 从 UA 解析浏览器名与主版本。UA-CH（userAgentData）在调用侧优先，这里只做字符串回退。
*/
function parseBrowser(ua) {
	const source = String(ua || "");
	const pick = (pattern) => {
		const m = source.match(pattern);
		if (!m) return "";
		return String(m[1] || "").split(".")[0];
	};
	const edge = pick(/\bEdg(?:e|A|iOS)?\/(\d+)/);
	if (edge) return {
		name: "Edge",
		major: edge
	};
	const opera = pick(/\b(?:OPR|OPT)\/(\d+)/);
	if (opera) return {
		name: "Opera",
		major: opera
	};
	const samsung = pick(/\bSamsungBrowser\/(\d+)/);
	if (samsung) return {
		name: "Samsung Internet",
		major: samsung
	};
	const firefox = pick(/\b(?:Firefox|FxiOS)\/(\d+)/);
	if (firefox) return {
		name: "Firefox",
		major: firefox
	};
	const chrome = pick(/\b(?:Chrome|CriOS|Chromium)\/(\d+)/);
	if (chrome) return {
		name: "Chrome",
		major: chrome
	};
	const safari = pick(/\bVersion\/(\d+)[.\d]*\s+Mobile\/\w+\s+Safari\//) || pick(/\bVersion\/(\d+)[.\d]*\s+Safari\//);
	if (safari) return {
		name: "Safari",
		major: safari
	};
	if (/\bSafari\//.test(source)) return {
		name: "Safari",
		major: ""
	};
	return {
		name: source ? "Other" : "",
		major: ""
	};
}
/** 从 UA 解析操作系统 */
function parseOs(ua) {
	const source = String(ua || "");
	if (/\bWindows NT\b/.test(source)) return "Windows";
	if (/\bAndroid\b/.test(source)) return "Android";
	if (/\b(?:iPhone|iPod)\b/.test(source)) return "iOS";
	if (/\biPad\b/.test(source)) return "iPadOS";
	if (/\bCrOS\b/.test(source)) return "ChromeOS";
	if (/\bMac OS X\b/.test(source)) return "macOS";
	if (/\bLinux\b/.test(source)) return "Linux";
	return source ? "Other" : "";
}
/** 合并两份计数（用于把上次发送失败的上报体与本次新数据合并成一条） */
function mergeCounters(a, b) {
	const pages = emptyPages();
	for (const key of TELEMETRY_PAGE_KEYS) pages[key] = Math.max(0, Number(a?.pages?.[key]) || 0) + Math.max(0, Number(b?.pages?.[key]) || 0);
	const render = [
		0,
		0,
		0,
		0,
		0
	];
	for (let i = 0; i < render.length; i++) render[i] = Math.max(0, Number(a?.render?.[i]) || 0) + Math.max(0, Number(b?.render?.[i]) || 0);
	return {
		opens: Math.max(0, Number(a?.opens) || 0) + Math.max(0, Number(b?.opens) || 0),
		dur_ms: Math.max(0, Number(a?.dur_ms) || 0) + Math.max(0, Number(b?.dur_ms) || 0),
		pages,
		render
	};
}
function countersAreEmpty(counters) {
	if ((counters?.opens || 0) > 0 || (counters?.dur_ms || 0) > 0) return false;
	for (const key of TELEMETRY_PAGE_KEYS) if ((counters?.pages?.[key] || 0) > 0) return false;
	for (const value of counters?.render || []) if ((value || 0) > 0) return false;
	return true;
}
/** 上报端点是否已配置（占位符视为未配置，此时只本地累加） */
function isEndpointConfigured(endpoint = currentEndpoint()) {
	const value = String(endpoint || "").trim();
	if (!/^https:\/\/[^\s<>]+$/i.test(value)) return false;
	return !value.includes("<") && !value.includes(">");
}
/** 测试用端点覆盖；生产环境始终使用 TELEMETRY_ENDPOINT */
var endpointOverride = null;
function currentEndpoint() {
	return endpointOverride ?? "https://stat.janmk.us.ci/collect";
}
/**
* 扩展内历史记录总条数（热区 state.history + 冷区 _coldCount）。
* 冷计数由 store/persistence 在各写入路径同步维护，因此这里可同步取到精确值。
*/
function historyRecordCount() {
	try {
		const hot = Array.isArray(state?.history) ? state.history.length : 0;
		const settings = getExtensionSettings() || {};
		const cold = Number(settings?._coldCount);
		return hot + (Number.isFinite(cold) && cold > 0 ? Math.floor(cold) : 0);
	} catch {
		return 0;
	}
}
var counters = emptyCounters();
var sessionStart = null;
/** 酒馆页面加载时刻：运行时长按「加载 → 上报」的墙钟增量累加，与面板是否打开无关 */
var runtimeStart = Date.now();
/** 已经计入上报体的运行时长水位，takeRuntimeDelta 只返回新增部分 */
var runtimeAccounted = 0;
var envCache = null;
var lastFlushAt = 0;
var inFlight = false;
var bound = false;
function appVersion() {
	try {
		return String("3.2.1");
	} catch {
		return "";
	}
}
function safeWindow() {
	try {
		return typeof window === "undefined" ? null : window;
	} catch {
		return null;
	}
}
function parentWindow() {
	try {
		const win = safeWindow();
		if (!win) return null;
		const parent = win.parent;
		return parent && parent !== win ? parent : null;
	} catch {
		return null;
	}
}
/** 面板宽度取自酒馆主窗口（面板渲染在主文档中），失败时退回当前窗口 */
function currentViewportWidth() {
	try {
		const parent = parentWindow();
		const parentWidth = Number(parent?.innerWidth);
		if (Number.isFinite(parentWidth) && parentWidth > 0) return parentWidth;
	} catch {}
	try {
		const width = Number(safeWindow()?.innerWidth);
		if (Number.isFinite(width) && width > 0) return width;
	} catch {}
	return 0;
}
function mediaMatches(query) {
	try {
		const win = safeWindow();
		if (typeof win?.matchMedia !== "function") return false;
		return !!win.matchMedia(query).matches;
	} catch {
		return false;
	}
}
/**
* 当前颜色模式（扩展设置里的 light / dark / auto）。
* 每次发送前重新读取，用户中途切换「跟随系统」也会在本次上报中体现。
*/
function currentThemeMode() {
	try {
		return normalizeThemeMode(state?.settings?.theme);
	} catch {
		return "light";
	}
}
function nav() {
	try {
		return typeof navigator === "undefined" ? null : navigator;
	} catch {
		return null;
	}
}
/** 探测浏览器环境（只保留分桶与主版本，不含任何可定位到个人的信息） */
function probeEnv() {
	const n = nav();
	const ua = String(n?.userAgent || "");
	let browser = parseBrowser(ua);
	try {
		const brands = Array.isArray(n?.userAgentData?.brands) ? n.userAgentData.brands : [];
		for (const [pattern, name] of [
			[/Microsoft Edge/i, "Edge"],
			[/Opera|OPR/i, "Opera"],
			[/Samsung/i, "Samsung Internet"],
			[/Google Chrome/i, "Chrome"],
			[/Chromium/i, "Chrome"],
			[/Firefox/i, "Firefox"],
			[/Safari/i, "Safari"]
		]) {
			const hit = brands.find((item) => pattern.test(String(item?.brand || "")));
			if (hit) {
				browser = {
					name,
					major: String(hit.version || "").split(".")[0] || browser.major
				};
				break;
			}
		}
	} catch {}
	const lang = String(n?.language || n?.languages?.[0] || "").slice(0, 12);
	return {
		b: browser.name,
		bv: browser.major,
		os: parseOs(ua),
		arch: "unknown",
		lang,
		w: widthBucket(currentViewportWidth()),
		dark: mediaMatches("(prefers-color-scheme: dark)"),
		standalone: mediaMatches("(display-mode: standalone)") || n?.standalone === true,
		touch: mediaMatches("(pointer: coarse)") || Number(n?.maxTouchPoints || 0) > 0,
		tm: currentThemeMode(),
		stv: tavernVersionFromContext(),
		ttv: ""
	};
}
/** 版本号清洗：只保留数字、字母与 . + -，最长 16 字符；不含数字视为无效 */
function sanitizeVersion(value) {
	if (typeof value !== "string" && typeof value !== "number") return "";
	const text = String(value).trim().replace(/[^0-9A-Za-z.+-]/g, "").slice(0, 16);
	return /\d/.test(text) ? text : "";
}
/** 从酒馆上下文/文档元信息同步读取版本号（取不到返回空字符串） */
function tavernVersionFromContext() {
	try {
		const g = globalThis;
		const st = g?.SillyTavern;
		const ctx = typeof st?.getContext === "function" ? st.getContext() : null;
		const candidates = [
			ctx?.version,
			ctx?.stVersion,
			st?.version,
			g?.__ST_VERSION__
		];
		for (const candidate of candidates) {
			const version = sanitizeVersion(candidate);
			if (version) return version;
		}
	} catch {}
	try {
		const meta = (typeof document === "undefined" ? null : document)?.querySelector?.("meta[name=\"version\"]");
		const version = sanitizeVersion(meta?.getAttribute?.("content"));
		if (version) return version;
	} catch {}
	return "";
}
/** 版本探测是否已经成功拿到需要的信息，成功前按下面的间隔重试 */
var tavernVersionSettled = false;
var tavernVersionAttempts = 0;
/** 首次失败后的重试间隔：覆盖酒馆/宿主启动较慢、路由尚未就绪的情况 */
var TAVERN_VERSION_RETRY_DELAYS_MS = [
	4e3,
	15e3,
	6e4,
	18e4
];
var MAX_TAVERN_VERSION_ATTEMPTS = TAVERN_VERSION_RETRY_DELAYS_MS.length + 1;
/**
* 解析 `/version` 的响应体。
*
* 上游 SillyTavern 与 TauriTavern 都返回 `pkgVersion`（**不是** `version`）：
* - SillyTavern：`{ agent, pkgVersion, gitRevision, gitBranch, commitDate, isLatest }`
* - TauriTavern：`{ agent, pkgVersion, tauriVersion, gitRevision, gitBranch, defaultUpdateChannel }`，
*   其中 `pkgVersion` 保持与内嵌前端基线一致以兼容上游扩展，`tauriVersion` 才是 TauriTavern 自身版本。
*
* 同时兼容 `version` 字段与纯文本响应（早期版本或第三方宿主）。
*/
function parseTavernVersionPayload(text) {
	const raw = String(text ?? "");
	const empty = {
		stv: "",
		ttv: ""
	};
	if (!raw.trim()) return empty;
	try {
		const data = JSON.parse(raw);
		if (!data || typeof data !== "object") return empty;
		return {
			stv: sanitizeVersion(data.pkgVersion) || sanitizeVersion(data.version) || sanitizeVersion(data.stVersion),
			ttv: sanitizeVersion(data.tauriVersion) || sanitizeVersion(data.ttVersion)
		};
	} catch {
		const trimmed = raw.trim();
		return {
			stv: trimmed.length <= 16 ? sanitizeVersion(trimmed) : "",
			ttv: ""
		};
	}
}
/**
* 异步读取酒馆同源 `/version` 接口补充版本号（只发这一个本地请求，不携带任何统计内容）。
* 首次失败后按退避重试，最多 MAX_TAVERN_VERSION_ATTEMPTS 次；成功一次即停止。
*/
async function refineTavernVersion(force = false) {
	if (!envCache) return;
	if (tavernVersionSettled && !force) return;
	if (!force && tavernVersionAttempts >= MAX_TAVERN_VERSION_ATTEMPTS) return;
	tavernVersionAttempts += 1;
	let ok = false;
	try {
		const ctx = globalThis?.SillyTavern?.getContext?.();
		const headers = typeof ctx?.getRequestHeaders === "function" ? ctx.getRequestHeaders() : void 0;
		const res = await fetch("/version", {
			headers,
			credentials: "same-origin"
		});
		if (res?.ok) {
			const parsed = parseTavernVersionPayload(await res.text());
			if (parsed.stv || parsed.ttv) {
				if (!envCache.stv && parsed.stv) envCache.stv = parsed.stv;
				if (!envCache.ttv && parsed.ttv) envCache.ttv = parsed.ttv;
				ok = true;
			}
		}
	} catch {}
	if (ok) {
		tavernVersionSettled = true;
		return;
	}
	const nextDelay = TAVERN_VERSION_RETRY_DELAYS_MS[tavernVersionAttempts - 1];
	if (!force && nextDelay != null) try {
		setTimeout(() => {
			refineTavernVersion();
		}, nextDelay);
	} catch {}
}
/** 尽力补充 CPU 架构（Chromium 高熵值，失败保持 unknown） */
function refineArch() {
	try {
		const uad = nav()?.userAgentData;
		if (!uad || typeof uad.getHighEntropyValues !== "function") return;
		uad.getHighEntropyValues(["architecture", "bitness"]).then((values) => {
			if (!envCache) return;
			const arch = String(values?.architecture || "").toLowerCase();
			const bitness = String(values?.bitness || "");
			let next = "unknown";
			if (arch.includes("arm")) next = arch.includes("32") || bitness === "32" ? "unknown" : "arm64";
			else if (arch === "x86" && bitness === "64") next = "x86_64";
			else if (arch === "x86") next = "x86";
			if (next !== "unknown") envCache.arch = next;
		}).catch(() => {});
	} catch {}
}
function randomId() {
	try {
		const buf = /* @__PURE__ */ new Uint8Array(16);
		const cryptoObj = globalThis?.crypto;
		if (cryptoObj && typeof cryptoObj.getRandomValues === "function") cryptoObj.getRandomValues(buf);
		else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
		return Array.from(buf, (byte) => byte.toString(16).padStart(2, "0")).join("");
	} catch {
		let fallback = "";
		for (let i = 0; i < 32; i++) fallback += Math.floor(Math.random() * 16).toString(16);
		return fallback;
	}
}
function isIdentityShape(value) {
	return !!value && typeof value === "object" && typeof value.id === "string" && /^[0-9a-f]{32}$/.test(value.id);
}
function readIdentity() {
	try {
		const stored = (getExtensionSettings() || {})[IDENTITY_KEY];
		if (isIdentityShape(stored)) return {
			id: stored.id,
			seq: Number.isFinite(Number(stored.seq)) ? Number(stored.seq) : 0,
			day: typeof stored.day === "string" ? stored.day : void 0,
			pending: stored.pending && typeof stored.pending === "object" ? stored.pending : null
		};
	} catch {}
	return {
		id: "",
		seq: 0
	};
}
function writeIdentity(identity) {
	try {
		const settings = getExtensionSettings() || {};
		saveExtensionSettings({
			...settings,
			[IDENTITY_KEY]: {
				id: identity.id,
				seq: identity.seq,
				day: identity.day,
				pending: identity.pending ?? null,
				updatedAt: Date.now()
			},
			_updated: Date.now()
		});
	} catch {}
}
function ensureIdentity() {
	const identity = readIdentity();
	if (identity.id) return identity;
	const created = {
		id: randomId(),
		seq: 0
	};
	writeIdentity(created);
	return created;
}
/** 重置匿名标识：下次上报会被计为一台新设备 */
function resetIdentity() {
	try {
		resetCounters();
		writeIdentity({
			id: randomId(),
			seq: 0
		});
	} catch {}
}
function isTelemetryEnabled() {
	try {
		const settings = state?.settings;
		if (!settings) return true;
		return settings.telemetryEnabled !== false;
	} catch {
		return true;
	}
}
function telemetryStatus() {
	const identity = readIdentity();
	return {
		enabled: isTelemetryEnabled(),
		configured: isEndpointConfigured(currentEndpoint()),
		id: identity.id,
		seq: identity.seq,
		hasPending: !!identity.pending
	};
}
function resetCounters() {
	counters = emptyCounters();
	sessionStart = null;
}
function touchActivity(now) {
	if (sessionStart === null) sessionStart = now;
}
function currentDuration(now) {
	if (sessionStart === null) return 0;
	return Math.max(0, Math.min(MAX_DURATION_MS, now - sessionStart));
}
/** 页面加载至今的墙钟时长（按上限截断，长时间挂机不会把累计值撑爆） */
function runtimeSinceLoad(now) {
	return Math.max(0, Math.min(MAX_RUNTIME_MS, now - runtimeStart));
}
/** 取尚未计入上报体的运行时长增量，并推进水位；重发同一个上报体不会重复累加 */
function takeRuntimeDelta(now) {
	const total = runtimeSinceLoad(now);
	const delta = total > runtimeAccounted ? total - runtimeAccounted : 0;
	if (total > runtimeAccounted) runtimeAccounted = total;
	return delta;
}
/** 打开面板：计一次打开，并开始一个使用时段 */
function trackOpen() {
	try {
		if (!isTelemetryEnabled()) return;
		const now = Date.now();
		counters.opens += 1;
		touchActivity(now);
		if (!envCache) envCache = probeEnv();
	} catch {}
}
/** 切换视图：对应页面计数 +1 */
function trackPage(view) {
	try {
		if (!isTelemetryEnabled()) return;
		if (!isTelemetryPageKey(view)) return;
		const now = Date.now();
		counters.pages[view] += 1;
		touchActivity(now);
		if (!envCache) envCache = probeEnv();
	} catch {}
}
/** 记录面板首帧渲染耗时（毫秒） */
function trackRender(ms) {
	try {
		if (!isTelemetryEnabled()) return;
		if (!Number.isFinite(ms)) return;
		counters.render[renderBucketIndex(ms)] += 1;
		if (!envCache) envCache = probeEnv();
	} catch {}
}
function buildPayload(identity, incoming, pending, now, final = false) {
	const day = todayKey(now);
	const pendingCounters = pending ? mergeCounters(emptyCounters(), {
		opens: pending?.s?.opens,
		dur_ms: pending?.s?.dur_ms,
		pages: pending?.s?.pages || {},
		render: Array.isArray(pending?.s?.render) ? pending.s.render : []
	}) : emptyCounters();
	const merged = pending ? mergeCounters(pendingCounters, incoming) : incoming;
	const runtimeDelta = takeRuntimeDelta(now);
	const pendingRuntime = Math.max(0, Number(pending?.s?.run_ms) || 0);
	const seq = pending && Number.isFinite(Number(pending.seq)) ? Number(pending.seq) : identity.seq + 1;
	const env = envCache ?? probeEnv();
	env.tm = currentThemeMode();
	env.dark = mediaMatches("(prefers-color-scheme: dark)");
	env.w = widthBucket(currentViewportWidth());
	if (!env.stv) env.stv = tavernVersionFromContext();
	return {
		v: 1,
		id: identity.id,
		seq: Math.max(1, seq),
		day,
		ts: now,
		tz: roundTz(-new Date(now).getTimezoneOffset() / 60),
		app: appVersion(),
		env,
		s: {
			opens: Math.max(0, Number(merged.opens) || 0),
			dur_ms: Math.max(0, Math.min(MAX_DURATION_MS, Number(merged.dur_ms) || 0)),
			pages: merged.pages,
			render: merged.render,
			run_ms: Math.max(0, Math.min(MAX_RUNTIME_MS, pendingRuntime + runtimeDelta))
		},
		daily: pending ? pending.daily === true : identity.day !== day,
		hc: historyRecordCount(),
		...final ? { off: true } : {}
	};
}
/**
* 发送前先把序号写盘：即使响应丢失导致本地状态未更新，下一次上报也会使用更大的 seq，
* 不会因为服务端已记录该序号而永久丢弃后续数据（同一 seq 的重复提交由服务端幂等丢弃）。
*/
function reserveSeq(payload) {
	try {
		const identity = ensureIdentity();
		if (identity.seq < payload.seq) {
			identity.seq = payload.seq;
			writeIdentity(identity);
		}
	} catch {}
}
function commitSuccess(payload) {
	lastFlushAt = Date.now();
	const identity = ensureIdentity();
	if (identity.seq < payload.seq) identity.seq = payload.seq;
	identity.day = payload.day;
	identity.pending = null;
	writeIdentity(identity);
	resetCounters();
}
function commitPending(payload) {
	try {
		const identity = ensureIdentity();
		identity.pending = payload;
		writeIdentity(identity);
	} catch {}
	resetCounters();
}
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
async function postPayload(body) {
	try {
		const res = await fetch(currentEndpoint(), {
			method: "POST",
			mode: "cors",
			keepalive: true,
			credentials: "omit",
			headers: { "Content-Type": "text/plain;charset=UTF-8" },
			body
		});
		return res.status === 204 || res.ok;
	} catch {
		return false;
	}
}
function sendBeaconOnce(body) {
	try {
		const n = nav();
		if (typeof n?.sendBeacon !== "function") return false;
		if (typeof Blob === "undefined") return false;
		return !!n.sendBeacon(currentEndpoint(), new Blob([body], { type: "text/plain;charset=UTF-8" }));
	} catch {
		return false;
	}
}
async function sendWithRetry(payload) {
	const body = JSON.stringify(payload);
	for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
		if (await postPayload(body)) {
			commitSuccess(payload);
			inFlight = false;
			return;
		}
		if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
	}
	commitPending(payload);
	inFlight = false;
}
/**
* 上报入口。数据为空且没有待发缓存时直接返回，不发请求。
* close：关闭面板触发（主要路径）；hide：页面隐藏/卸载触发；manual：设置页手动触发。
*/
function flushTelemetry(reason = "close", options) {
	try {
		const final = options?.final === true;
		if (!isTelemetryEnabled() && !final) {
			resetCounters();
			takeRuntimeDelta(Date.now());
			return;
		}
		if (!isEndpointConfigured(currentEndpoint())) return;
		if (inFlight) return;
		const now = Date.now();
		counters.dur_ms = currentDuration(now);
		const runtimePending = runtimeSinceLoad(now) - runtimeAccounted;
		const gap = reason === "hide" ? PASSIVE_FLUSH_GAP : CLOSE_FLUSH_GAP;
		if (!final && lastFlushAt && now - lastFlushAt < gap) return;
		const identity = ensureIdentity();
		const pending = identity.pending && typeof identity.pending === "object" ? identity.pending : null;
		if (!final && !pending && countersAreEmpty(counters) && runtimePending < RUNTIME_MIN_FLUSH_MS) return;
		const payload = buildPayload(identity, counters, pending, now, final);
		inFlight = true;
		reserveSeq(payload);
		if (reason === "hide") {
			if (sendBeaconOnce(JSON.stringify(payload))) {
				commitSuccess(payload);
				inFlight = false;
				return;
			}
		}
		sendWithRetry(payload).catch(() => {
			inFlight = false;
		});
	} catch (error) {
		inFlight = false;
		log.warn("匿名统计上报失败", error);
	}
}
/**
* 关闭匿名统计开关时的最后一次上报。
* 必须在把 telemetryEnabled 写为 false 之前调用：本次会带上关闭标记并立即发送。
*/
function flushTelemetryOnDisable() {
	flushTelemetry("manual", { final: true });
}
function bindLifecycle() {
	if (bound) return;
	const win = safeWindow();
	if (!win || typeof win.addEventListener !== "function") return;
	bound = true;
	const onHide = () => {
		try {
			flushTelemetry("hide");
		} catch {}
	};
	const onVisibility = (event) => {
		try {
			if ((event?.target ?? win.document)?.visibilityState === "hidden") onHide();
		} catch {}
	};
	const targets = [win];
	const parent = parentWindow();
	if (parent && typeof parent.addEventListener === "function") targets.push(parent);
	for (const target of targets) {
		try {
			target.addEventListener("pagehide", onHide);
		} catch {}
		try {
			target.addEventListener("visibilitychange", onVisibility);
		} catch {}
	}
}
/** 初始化：生成匿名标识、缓存环境、绑定生命周期上报时机（幂等） */
function initTelemetry() {
	try {
		if (!ensureIdentity().id) return;
		if (!envCache) envCache = probeEnv();
		refineArch();
		refineTavernVersion();
		bindLifecycle();
	} catch (error) {
		log.warn("匿名统计初始化失败", error);
	}
}
//#endregion
//#region src/ui/settings.ts
var settings_exports = /* @__PURE__ */ __exportAll({ renderSettings: () => renderSettings });
/** 刷新「匿名使用统计」卡片上的标识与状态文案 */
function renderTelemetryStatus(doc) {
	const idEl = doc.getElementById("aus-telemetry-id");
	const statusEl = doc.getElementById("aus-telemetry-status");
	let status = null;
	try {
		status = telemetryStatus();
	} catch {}
	if (idEl) idEl.textContent = status?.id ? `匿名标识：${String(status.id).slice(0, 8)}…` : "匿名标识：待生成";
	if (!statusEl) return;
	let hint = "";
	if (!status?.configured) hint = "未配置上报端点：仅本地累计，不会发送任何数据";
	else if (!status.enabled) hint = "已关闭：不再采集，也不再发送";
	statusEl.textContent = hint;
	statusEl.style.display = hint ? "block" : "none";
}
var docClickBound = false;
function bindSettingsOutsideClick(doc) {
	if (docClickBound) return;
	docClickBound = true;
	doc.addEventListener("click", (e) => {
		const t = e.target;
		const td = doc.getElementById("aus-theme-dropdown");
		if (td && td.style.display === "block" && !t.closest("#aus-theme-dropdown") && !t.closest("#aus-theme-btn")) td.style.display = "none";
		const sd = doc.getElementById("aus-history-scope-dropdown");
		if (sd && sd.style.display === "block" && !t.closest("#aus-history-scope-dropdown") && !t.closest("#aus-history-scope-btn")) sd.style.display = "none";
		const md = doc.getElementById("aus-pricing-sync-mode-dropdown");
		if (md && md.style.display === "block" && !t.closest("#aus-pricing-sync-mode-dropdown") && !t.closest("#aus-pricing-sync-mode-btn")) md.style.display = "none";
		const idd = doc.getElementById("aus-pricing-sync-interval-dropdown");
		if (idd && idd.style.display === "block" && !t.closest("#aus-pricing-sync-interval-dropdown") && !t.closest("#aus-pricing-sync-interval-btn")) idd.style.display = "none";
	});
}
function localDay(ts) {
	const d = new Date(ts);
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
async function recalcCostsAndRefresh() {
	try {
		await recalcAllCosts();
		await repository.rebuildAggregates();
		globalThis.ApiUsageStat?.refreshUI?.();
	} catch (error) {
		toast("error", "历史费用重算失败：" + (error?.message || error));
	}
}
function readHistoryDeleteFilter(doc) {
	const startEl = doc.getElementById("aus-delete-start");
	const endEl = doc.getElementById("aus-delete-end");
	const modelEl = doc.getElementById("aus-delete-model");
	const chatEl = doc.getElementById("aus-delete-chat");
	const start = String(startEl?.value || "").trim();
	const end = String(endEl?.value || "").trim();
	return {
		start: start && isValidDayKey(start) ? start : "",
		end: end && isValidDayKey(end) ? end : "",
		model: String(modelEl?.value || "").trim(),
		chat: String(chatEl?.value || "").trim()
	};
}
async function countHistoryDeleteMatches(filter) {
	return (await repository.getAllHistory() || []).filter((entry) => {
		if (filter.start || filter.end) {
			const day = localDay(entry.timestamp);
			if (filter.start && day < filter.start) return false;
			if (filter.end && day > filter.end) return false;
		}
		if (filter.model && String(entry.model || "") !== filter.model) return false;
		if (filter.chat) {
			const chatId = String(entry.chatId || "");
			const chatName = String(entry.chatName || "");
			if (chatId !== filter.chat && chatName !== filter.chat) return false;
		}
		return true;
	}).length;
}
function bindHistoryDelete(doc) {
	const previewBtn = doc.getElementById("aus-delete-preview");
	const deleteBtn = doc.getElementById("aus-delete-run");
	const status = doc.getElementById("aus-delete-status");
	if (!previewBtn || !deleteBtn) return;
	let armed = false;
	let armTimer = null;
	let armedFilter = null;
	const resetArmed = () => {
		armed = false;
		armedFilter = null;
		try {
			deleteBtn.textContent = "删除匹配记录";
		} catch {}
	};
	previewBtn.onclick = async () => {
		previewBtn.disabled = true;
		const old = previewBtn.textContent;
		previewBtn.textContent = "统计中…";
		try {
			const count = await countHistoryDeleteMatches(readHistoryDeleteFilter(doc));
			if (status) status.textContent = `匹配 ${count} 条记录${count ? "，点击“删除匹配记录”后会二次确认" : ""}`;
		} catch (error) {
			if (status) status.textContent = "统计失败：" + (error?.message || error);
		} finally {
			previewBtn.disabled = false;
			previewBtn.textContent = old || "统计匹配记录";
		}
	};
	deleteBtn.onclick = async () => {
		const filter = readHistoryDeleteFilter(doc);
		if (!armed) {
			const count = await countHistoryDeleteMatches(filter).catch(() => -1);
			if (count <= 0) {
				if (status) status.textContent = count === 0 ? "当前范围没有可删除记录" : "匹配数量检查失败，请重试";
				return;
			}
			armed = true;
			armedFilter = filter;
			deleteBtn.textContent = `确认删除 ${count} 条？再点一次`;
			if (status) status.textContent = `本次将删除 ${count} 条记录，再次点击执行`;
			if (armTimer) clearTimeout(armTimer);
			armTimer = setTimeout(() => {
				armTimer = null;
				resetArmed();
			}, 5e3);
			return;
		}
		if (armTimer) {
			clearTimeout(armTimer);
			armTimer = null;
		}
		const targetFilter = armedFilter || filter;
		resetArmed();
		deleteBtn.disabled = true;
		if (status) status.textContent = "正在删除并重算…";
		try {
			const removed = await repository.deleteHistoryByFilter(targetFilter);
			await recalcCostsAndRefresh();
			if (status) status.textContent = removed ? `已删除 ${removed} 条记录并完成重算` : "当前范围没有可删除记录";
			if (removed) toast("success", `已删除 ${removed} 条记录`);
		} catch (error) {
			if (status) status.textContent = "删除失败：" + (error?.message || error);
		} finally {
			deleteBtn.disabled = false;
		}
	};
}
function renderSettings(doc) {
	const host = doc.getElementById("aus-settings");
	if (!host) return;
	const s = state.settings;
	host.innerHTML = `
    <div style="display:grid;gap:12px;">
      <!-- 颜色模式（与用量统计·模型选择一致的胶囊下拉） -->
      <div class="ds-card" style="position:relative;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">颜色模式</span><div id="aus-theme-btn" class="aus-pill"><span style="color:var(--ds-text-2);">模式</span><span id="aus-theme-label" style="font-weight:600;color:var(--ds-text);">浅色</span>${icon("chevron-down", 14)}</div></div><div id="aus-theme-dropdown" style="display:none;position:absolute;top:44px;right:12px;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:140px;padding:8px;"></div><div id="aus-theme-hint" style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;">切换扩展颜色模式</div></div>

      <!-- 移动端兼容 UI：窄屏底栏（移动端默认） / 改造前的侧栏抽屉（桌面端默认） -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">移动端兼容UI</span>${switchHTML("aus-mobile-compat-ui", {
		checked: s.mobileCompatUi !== false,
		ariaLabel: "移动端兼容UI"
	})}</div>
        <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;line-height:1.6;">开启后使用类似 APP 的底栏模式，便于单手操作，多次点按底栏按钮可以返回上一页，关闭后使用旧版的左侧汉堡菜单，桌面端不受本开关控制</div>
      </div>

      <!-- 历史显示范围 -->
      <div class="ds-card" style="position:relative;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">历史显示范围</span><div id="aus-history-scope-btn" class="aus-pill"><span style="color:var(--ds-text-2);">范围</span><span id="aus-history-scope-label" style="font-weight:600;color:var(--ds-text);">全部历史</span>${icon("chevron-down", 14)}</div></div><div id="aus-history-scope-dropdown" style="display:none;position:absolute;top:44px;right:12px;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:160px;padding:8px;"></div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;">调整历史记录页的默认展示范围</div></div>

      <!-- 对话展示：控制按对话统计表与各页「对话」下拉胶囊里展示哪些对话（只影响显示） -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">对话展示</span><button id="aus-settings-chat-manage" type="button" class="aus-manage-chat-btn" title="管理对话在表格与下拉胶囊中的显示">${icon("menu", 14)}管理对话</button></div>
        <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;line-height:1.6;">管理哪些对话出现在概览列表与「对话」下拉胶囊中；只影响显示隐藏，不影响数据统计</div>
      </div>

      <!-- API 密钥 -->
      <div class="ds-card" style="display:none;"><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);font-weight:500;margin-bottom:6px;">API 密钥</div><div style="display:flex;gap:8px;"><input id="aus-api-key" type="password" placeholder="输入 DeepSeek API 密钥" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);outline:none;" /><button id="aus-save-key" class="ds-btn-pill" style="padding:8px 14px;">保存</button></div><div id="aus-key-status" style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;"></div></div>

      <!-- 余额 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">自动校准余额</span><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="font-size:var(--aus-fs-base);color:var(--ds-text);">校准间隔（分钟）</span>
          <input type="number" id="aus-balance-interval" min="1" max="1440" style="width:90px;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);text-align:center;" /></div></div>
        <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;">在钱包中勾选「自动校准」后按此间隔自动查询余额</div>
        <div style="display:none;margin-top:12px;"><input id="aus-custom-balance" /><button id="aus-save-balance"></button><button id="aus-clear-balance"></button><div id="aus-balance-status"></div></div>
      </div>

      <!-- 高峰时段 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">新钱包默认峰谷时段</span><button id="aus-btn-add-peak-hour" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">+ 添加</button></div><div id="aus-peak-hours-list" style="display:grid;gap:6px;margin-top:8px;"></div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;line-height:1.6;">支持跨天（如 22:00-02:00）；钱包页可分别覆盖时段和周末规则。<br />DeepSeek 官方规则：周一至周五（不含中国法定节假日）9:00-12:00、14:00-18:00 为高峰，其余时段（含周末和法定节假日全天）为空闲；调休上班的周末同样按空闲计费。</div><div style="margin-top:10px;"><div style="font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-text);">额外空闲日期</div><textarea id="aus-extra-off-days" rows="3" placeholder="每行一个日期，如 2027-01-01" style="width:100%;margin-top:6px;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);resize:vertical;box-sizing:border-box;"></textarea><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:4px;">内置法定节假日数据覆盖 ${CN_HOLIDAY_COVERAGE_LABEL}；超出范围的日期可按 YYYY-MM-DD 每行一条补充，全天按空闲计费。</div></div></div>

      <!-- 匿名使用统计（默认开启，可随时关闭） -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">匿名使用统计</span>${switchHTML("aus-telemetry-enabled", {
		checked: s.telemetryEnabled !== false,
		ariaLabel: "匿名使用统计"
	})}</div>
        <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;line-height:1.6;">仅匿名上报浏览器环境参数（浏览器版本、系统、架构、语言、屏幕等）、渲染性能等开发数据；<strong>不含对话内容、密钥等任何隐私信息，数据经过匿名化处理，仅用于开发与完善兼容性。</strong>关闭后立即停止采集与上报。<a href="https://janmk1453.github.io/Api-Usage/#privacy" target="_blank" rel="noreferrer" style="color:var(--ds-text);text-decoration:underline;">隐私声明</a></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap;"><span id="aus-telemetry-id" style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">匿名标识：待生成</span><button id="aus-telemetry-reset" style="padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">重置匿名标识</button></div>
        <div id="aus-telemetry-status" style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;"></div>
      </div>
      <!-- 模型与价格（可折叠，默认收起） -->
      <div class="ds-card" style="display:none;"><div id="aus-models-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">模型与价格（<span id="aus-model-price-unit">${getDisplayCurrency().code}/百万 tokens</span>）</span><div style="display:flex;align-items:center;gap:8px;"><button id="aus-btn-clear-custom-models" style="padding:6px 10px;border:1px solid var(--ds-red-border);border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">清空自定义模型</button><button id="aus-btn-add-model" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">+ 自定义模型</button><span id="aus-models-toggle" style="flex-shrink:0;padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;user-select:none;line-height:1;">${icon("chevron-down", 14)} 展开</span></div></div><div id="aus-models-sync-note" style="display:none;margin-top:8px;padding:8px 10px;border:1px dashed var(--ds-border);border-radius:10px;background:var(--ds-sidebar-bg);font-size:var(--aus-fs-sm);color:var(--ds-text-2);line-height:1.6;"></div><div id="aus-custom-models-list" style="display:grid;gap:8px;margin-top:8px;"></div></div>

      <!-- 汇率与价格同步（models.dev）：无总开关，同步与币种都由各钱包自己的设置决定 -->
      <div class="ds-card" style="position:relative;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">汇率与价格同步（models.dev）</span></div>
        <div id="aus-pricing-sync-panel" style="display:grid;margin-top:10px;gap:10px;">
          <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);line-height:1.6;"><b style="color:var(--ds-text);">价格同步没有总开关</b>：在钱包页为某个钱包选定「价格来源」后，该钱包里已识别的模型才会按 <a href="https://models.dev" target="_blank" style="color:var(--ds-text);text-decoration:underline;">models.dev</a> 价格同步；DeepSeek 峰价按谷价 2× 合成。<br /><b style="color:var(--ds-text);">显示币种同样由钱包决定</b>：未忽略的钱包全部为美元时全站按 $ 显示（按下方汇率换算），否则按 ¥ CNY；</div>
          <div style="display:flex;align-items:center;justify-content:space-between;position:relative;"><span style="font-size:var(--aus-fs-base);color:var(--ds-text);">同步模式</span><div id="aus-pricing-sync-mode-btn" class="aus-pill"><span id="aus-pricing-sync-mode-label" style="font-weight:600;color:var(--ds-text);">仅新增</span>${icon("chevron-down", 14)}</div><div id="aus-pricing-sync-mode-dropdown" style="display:none;position:absolute;top:40px;right:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:160px;padding:8px;"></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">汇率 USD→CNY</div><input id="aus-exchange-rate" type="number" step="0.0001" min="0" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /></div>
            <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">自动同步间隔</div><div id="aus-pricing-sync-interval-btn" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);cursor:pointer;"><span id="aus-pricing-sync-interval-label" style="font-weight:600;">仅手动</span>${icon("chevron-down", 14)}</div><div id="aus-pricing-sync-interval-dropdown" style="display:none;position:absolute;right:12px;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:140px;padding:8px;"></div></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;"><label style="display:flex;align-items:center;gap:6px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);cursor:pointer;"><input type="checkbox" id="aus-use-live-rate" class="aus-checkbox" /> 每24小时自动联网获取最新汇率</label><button id="aus-fetch-rate" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">立即获取</button></div>
          <div id="aus-rate-status" style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);"></div>
          <div style="display:flex;gap:8px;"><button id="aus-btn-sync-pricing" class="ds-btn-pill" style="flex:1;">立即同步</button><button id="aus-btn-preview-pricing" style="flex:1;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">预览</button></div>
          <div id="aus-pricing-sync-status" style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);"></div>
          <div id="aus-pricing-sync-preview" style="display:none;max-height:160px;overflow:auto;border-radius:8px;padding:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);"></div>
        </div>
      </div>

      <!-- 调试 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">调试模式（模拟数据，不计费）</span>${switchHTML("aus-debug-mode", {
		checked: !!s.debug,
		ariaLabel: "调试模式"
	})}</div>
        <div id="aus-debug-panel" style="display:${s.debug ? "grid" : "none"};margin-top:10px;gap:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">命中</div><input type="number" id="aus-debug-hit" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /></div><div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">未命中</div><input type="number" id="aus-debug-miss" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">输出</div><input type="number" id="aus-debug-output" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /></div><div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">模型</div><select id="aus-debug-model" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);"></select></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;"><input type="date" id="aus-debug-date-start" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /><input type="date" id="aus-debug-date-end" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /><input type="number" id="aus-debug-batch-count" min="1" placeholder="条数" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /></div>
          <button id="aus-btn-debug-batch" class="ds-btn-pill" style="width:100%;">生成模拟数据</button>
          <button id="aus-btn-debug-clear" style="width:100%;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">清除调试数据</button><div id="aus-debug-status" style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);"></div>
        </div>
      </div>

      <!-- 峰值圆点 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">峰值提示小圆点</span>${switchHTML("aus-peak-dot", {
		checked: state.settings.peakDot !== false,
		ariaLabel: "峰值提示小圆点"
	})}</div><button id="aus-reset-dot" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;">重置位置</button><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;">开启后在酒馆中显示一个小圆点，按颜色区分当前峰谷</div></div>

      <!-- 记录数据管理 -->
      <div class="ds-card">
        <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);margin-bottom:6px;">按范围删除记录</div>
        <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);line-height:1.7;margin-bottom:8px;">可删除全部记录，或按日期、模型、对话缩小范围。日期留空表示不限；模型与对话需完全匹配，留空表示不限。删除会同时处理热记录与冷记录，并立即重算统计。</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">开始日期</div><input type="date" id="aus-delete-start" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);box-sizing:border-box;" /></div>
          <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">结束日期</div><input type="date" id="aus-delete-end" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);box-sizing:border-box;" /></div>
          <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">模型</div><input id="aus-delete-model" placeholder="如 deepseek-flash" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);box-sizing:border-box;" /></div>
          <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">对话</div><input id="aus-delete-chat" placeholder="对话名称或 chatId" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);box-sizing:border-box;" /></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="aus-delete-preview" style="padding:7px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">统计匹配记录</button>
          <button id="aus-delete-run" style="padding:7px 12px;border:1px solid var(--ds-red-border);border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">删除匹配记录</button>
        </div>
        <div id="aus-delete-status" style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:8px;"></div>
      </div>

      <!-- 存储占用 -->
      ${renderStorageUsageCard(doc)}

      <!-- WebDAV（可折叠，默认收起） -->
      <div class="ds-card"><div id="aus-webdav-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:8px;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">WebDAV 云同步</span><span id="aus-webdav-toggle" style="flex-shrink:0;padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;user-select:none;line-height:1;">${icon("chevron-down", 14)} 展开</span></div>
        <div id="aus-webdav-body" style="display:none;">
          <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin:8px 0;">双向合并，仅同步统计/设置/余额，不含聊天内容与密钥。强制 https。</div>
          <div style="display:grid;gap:8px;">
            <input id="aus-webdav-url" placeholder="https://dav.jianguoyun.com/dav/" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" />
            <div style="display:flex;gap:8px;"><input id="aus-webdav-user" placeholder="用户名" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /><input id="aus-webdav-pass" type="password" placeholder="应用密码" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /><button id="aus-webdav-pass-clear" type="button" style="padding:8px 12px;border:1px solid var(--ds-red-border);border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">清除密码</button></div>
            <input id="aus-webdav-path" placeholder="远程子路径（可空）" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" />
            <input id="aus-webdav-proxy" placeholder="CORS 代理（可选，http://127.0.0.1:8000/proxy?url=）" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" />
            <button id="aus-webdav-sync" class="ds-btn-pill">☁️ 立即同步</button>
          </div>
        </div>
      </div>
    </div>
  `;
	const apiKeyEl = doc.getElementById("aus-api-key");
	try {
		if ((globalThis.SillyTavern?.getContext?.())?.extensionSettings?.["api_usage_stat"]?.apiKey && apiKeyEl) {
			apiKeyEl.value = "";
			apiKeyEl.placeholder = "已保存 ●●●●（留空不修改）";
			apiKeyEl.dataset.hasKey = "1";
		}
	} catch {}
	doc.getElementById("aus-custom-balance").value = state.customBalance || "";
	const telemetryCb = doc.getElementById("aus-telemetry-enabled");
	if (telemetryCb) telemetryCb.checked = s.telemetryEnabled !== false;
	const mobileUiCb = doc.getElementById("aus-mobile-compat-ui");
	if (mobileUiCb) mobileUiCb.checked = s.mobileCompatUi !== false;
	renderTelemetryStatus(doc);
	doc.getElementById("aus-peak-dot").checked = state.settings.peakDot !== false;
	doc.getElementById("aus-balance-interval").value = String(s.balanceInterval ?? 10);
	const dbgCb = doc.getElementById("aus-debug-mode");
	if (dbgCb) dbgCb.checked = !!s.debug;
	doc.getElementById("aus-debug-hit").value = String(s.debugHit ?? 1e4);
	doc.getElementById("aus-debug-miss").value = String(s.debugMiss ?? 5e3);
	doc.getElementById("aus-debug-output").value = String(s.debugOutput ?? 2e3);
	doc.getElementById("aus-debug-date-start").value = s.debugDateStart || "";
	doc.getElementById("aus-debug-date-end").value = s.debugDateEnd || "";
	doc.getElementById("aus-debug-batch-count").value = String(s.debugBatchCount ?? 30);
	doc.getElementById("aus-webdav-url").value = s.webdav?.url || "";
	doc.getElementById("aus-webdav-user").value = s.webdav?.username || "";
	doc.getElementById("aus-webdav-path").value = s.webdav?.path || "";
	doc.getElementById("aus-webdav-proxy").value = s.webdav?.proxy || "";
	try {
		const pass = localStorage.getItem("ds_ds_webdav_pass") || "";
		const el = doc.getElementById("aus-webdav-pass");
		if (pass && el) {
			el.value = "";
			el.placeholder = "已保存 ●●●●（留空不修改）";
			el.dataset.hasKey = "1";
		} else if ((globalThis.SillyTavern?.getContext?.())?.extensionSettings?.["api_usage_stat"]?.webdavPass && el) {
			el.value = "";
			el.placeholder = "已保存 ●●●●（留空不修改）";
			el.dataset.hasKey = "1";
		}
	} catch {}
	function renderThemePicker() {
		const dropdown = doc.getElementById("aus-theme-dropdown");
		const label = doc.getElementById("aus-theme-label");
		if (!label) return;
		const cur = state.settings.theme || "light";
		label.textContent = cur === "dark" ? "深色" : cur === "auto" ? "跟随系统" : "浅色";
		const hint = doc.getElementById("aus-theme-hint");
		if (hint) hint.textContent = "切换扩展颜色模式";
		if (!dropdown) return;
		dropdown.innerHTML = [
			{
				v: "light",
				l: "浅色"
			},
			{
				v: "dark",
				l: "深色"
			},
			{
				v: "auto",
				l: "跟随系统"
			}
		].map((o) => {
			const active = o.v === cur ? "background:var(--ds-card);font-weight:600;" : "";
			return `<div data-theme="${o.v}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active}">${o.l}</div>`;
		}).join("");
		dropdown.querySelectorAll("[data-theme]").forEach((el) => {
			el.onclick = () => {
				const v = el.getAttribute("data-theme");
				state.settings.theme = v;
				saveHot({ settings: state.settings });
				closeDropdownInstant(dropdown);
				applyTheme(v);
				syncThemeWatcher();
				renderThemePicker();
				afterNextPaint(() => {
					try {
						globalThis.ApiUsageStat?.refreshUI?.();
					} catch {}
				});
			};
		});
	}
	renderThemePicker();
	const themeBtn = doc.getElementById("aus-theme-btn");
	const themeDropdown = doc.getElementById("aus-theme-dropdown");
	if (themeBtn && themeDropdown) themeBtn.onclick = () => {
		const open = themeDropdown.style.display === "block";
		themeDropdown.style.display = open ? "none" : "block";
		if (!open) renderThemePicker();
	};
	bindSettingsOutsideClick(doc);
	function renderScopePicker() {
		const dropdown = doc.getElementById("aus-history-scope-dropdown");
		const label = doc.getElementById("aus-history-scope-label");
		if (!label) return;
		const cur = state.settings.historyScope || "all";
		label.textContent = cur === "current" ? "当前对话" : "全部历史";
		if (!dropdown) return;
		dropdown.innerHTML = [{
			v: "all",
			l: "全部历史"
		}, {
			v: "current",
			l: "当前对话"
		}].map((o) => {
			const active = o.v === cur ? "background:var(--ds-card);font-weight:600;" : "";
			return `<div data-scope="${o.v}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active}">${o.l}</div>`;
		}).join("");
		dropdown.querySelectorAll("[data-scope]").forEach((el) => {
			el.onclick = () => {
				const v = el.getAttribute("data-scope");
				state.settings.historyScope = v;
				saveHot({ settings: state.settings });
				closeDropdownInstant(dropdown);
				renderScopePicker();
				afterNextPaint(() => {
					try {
						globalThis.ApiUsageStat?.refreshUI?.();
					} catch {}
				});
			};
		});
	}
	renderScopePicker();
	bindStorageUsageCard(doc);
	refreshStorageUsage(doc);
	const scopeBtn = doc.getElementById("aus-history-scope-btn");
	const scopeDropdown = doc.getElementById("aus-history-scope-dropdown");
	if (scopeBtn && scopeDropdown) scopeBtn.onclick = () => {
		const open = scopeDropdown.style.display === "block";
		scopeDropdown.style.display = open ? "none" : "block";
		if (!open) renderScopePicker();
	};
	doc.getElementById("aus-save-key").onclick = () => {
		const el = doc.getElementById("aus-api-key");
		const v = el.value.trim();
		if (!v && el.dataset.hasKey === "1") {
			const sEl = doc.getElementById("aus-key-status");
			sEl.textContent = "未修改，已保留原密钥";
			return;
		}
		saveApiKey(v);
		const sEl = doc.getElementById("aus-key-status");
		sEl.textContent = v ? "已保存" : "已清空";
		if (v) {
			el.value = "";
			el.placeholder = "已保存 ●●●●（留空不修改）";
			el.dataset.hasKey = "1";
		} else {
			el.placeholder = "输入 DeepSeek API 密钥";
			el.dataset.hasKey = "";
		}
	};
	doc.getElementById("aus-save-balance").onclick = () => {
		const v = doc.getElementById("aus-custom-balance").value.trim();
		if (v && isNaN(parseFloat(v))) return alert("请输入有效金额");
		state.customBalance = v || null;
		saveHot({ customBalance: state.customBalance });
		try {
			globalThis.ApiUsageStat?.refreshUI?.();
		} catch {}
		doc.getElementById("aus-balance-status").textContent = v ? "已保存" : "已清除";
	};
	doc.getElementById("aus-clear-balance").onclick = () => {
		state.customBalance = null;
		saveHot({ customBalance: null });
		doc.getElementById("aus-custom-balance").value = "";
		doc.getElementById("aus-balance-status").textContent = "已清除";
		try {
			globalThis.ApiUsageStat?.refreshUI?.();
		} catch {}
	};
	doc.getElementById("aus-balance-interval").onchange = (e) => {
		state.settings.balanceInterval = parseInt(e.target.value) || 10;
		saveHot({ settings: state.settings });
		try {
			import("./balance-BypvPIQk.js").then((n) => n.t).then((m) => m.restartBalanceTimer?.());
		} catch {}
	};
	if (dbgCb) dbgCb.onchange = () => {
		state.settings.debug = dbgCb.checked;
		doc.getElementById("aus-debug-panel").style.display = dbgCb.checked ? "grid" : "none";
		const st = doc.getElementById("aus-debug-status");
		if (st) st.textContent = dbgCb.checked ? "调试模式已开启，下次对话将使用模拟参数，不计费" : "";
		saveHot({ settings: state.settings });
	};
	doc.getElementById("aus-debug-hit").onchange = (e) => {
		state.settings.debugHit = parseInt(e.target.value) || 0;
		saveHot({ settings: state.settings });
	};
	doc.getElementById("aus-debug-miss").onchange = (e) => {
		state.settings.debugMiss = parseInt(e.target.value) || 0;
		saveHot({ settings: state.settings });
	};
	doc.getElementById("aus-debug-output").onchange = (e) => {
		state.settings.debugOutput = parseInt(e.target.value) || 0;
		saveHot({ settings: state.settings });
	};
	const dbgModel = doc.getElementById("aus-debug-model");
	if (dbgModel) dbgModel.onchange = (e) => {
		state.settings.debugModel = e.target.value;
		saveHot({ settings: state.settings });
	};
	doc.getElementById("aus-debug-date-start").onchange = (e) => {
		state.settings.debugDateStart = e.target.value;
		saveHot({ settings: state.settings });
	};
	doc.getElementById("aus-debug-date-end").onchange = (e) => {
		state.settings.debugDateEnd = e.target.value;
		saveHot({ settings: state.settings });
	};
	doc.getElementById("aus-debug-batch-count").onchange = (e) => {
		state.settings.debugBatchCount = parseInt(e.target.value) || 1;
		saveHot({ settings: state.settings });
	};
	doc.getElementById("aus-btn-debug-batch").onclick = () => generateDebugBatch();
	try {
		const clearBtn = doc.getElementById("aus-btn-debug-clear");
		if (clearBtn) clearBtn.onclick = async () => {
			try {
				const { repository } = await import("./repository-B7vP-cjv.js").then((n) => n.n);
				const { state: st } = await import("./store-UtA6O3mA.js").then((n) => n.i);
				await repository.replaceAll({ history: (st.history || []).filter((h) => h._debug !== true) });
				await repository.recalcAll();
				await repository.rebuildAggregates();
				try {
					globalThis.ApiUsageStat?.refreshUI?.();
				} catch {}
				const el = doc.getElementById("aus-debug-status");
				if (el) el.textContent = "已清除调试数据";
			} catch {}
		};
	} catch {}
	doc.getElementById("aus-peak-dot").onchange = (e) => {
		state.settings.peakDot = e.target.checked;
		saveHot({ settings: state.settings });
		try {
			globalThis.ApiUsageStat?.updatePeakDot?.();
		} catch {}
	};
	doc.getElementById("aus-reset-dot").onclick = () => {
		try {
			localStorage.removeItem("ds_ds_peak_dot_pos");
			const dot = window.parent?.document?.getElementById("aus-peak-dot-indicator");
			if (dot) {
				dot.style.left = "";
				dot.style.top = "60px";
				dot.style.right = "16px";
			}
		} catch {}
		alert("已重置");
	};
	const telemetryToggle = doc.getElementById("aus-telemetry-enabled");
	if (telemetryToggle) telemetryToggle.onchange = (e) => {
		const enabled = !!e.target.checked;
		if (!enabled) try {
			flushTelemetryOnDisable();
		} catch {}
		state.settings.telemetryEnabled = enabled;
		saveHot({ settings: state.settings });
		renderTelemetryStatus(doc);
	};
	const mobileUiToggle = doc.getElementById("aus-mobile-compat-ui");
	if (mobileUiToggle) mobileUiToggle.onchange = (e) => {
		const enabled = !!e.target.checked;
		state.settings.mobileCompatUi = enabled;
		saveHot({ settings: state.settings });
		try {
			import("./index.js").then((n) => n.t).then((m) => m.applyMobileNavMode()).catch(() => {});
		} catch {}
	};
	const telemetryReset = doc.getElementById("aus-telemetry-reset");
	if (telemetryReset) telemetryReset.onclick = () => {
		try {
			resetIdentity();
		} catch {}
		renderTelemetryStatus(doc);
		toast("info", "已重置匿名标识，后续上报将按新设备计入");
	};
	bindHistoryDelete(doc);
	const wUrl = doc.getElementById("aus-webdav-url");
	const wUser = doc.getElementById("aus-webdav-user");
	const wPath = doc.getElementById("aus-webdav-path");
	const wProxy = doc.getElementById("aus-webdav-proxy");
	const wPass = doc.getElementById("aus-webdav-pass");
	if (wUrl) wUrl.onchange = () => {
		state.settings.webdav.url = wUrl.value.trim();
		saveHot({ settings: state.settings });
	};
	if (wUser) wUser.onchange = () => {
		state.settings.webdav.username = wUser.value.trim();
		saveHot({ settings: state.settings });
	};
	if (wPath) wPath.onchange = () => {
		state.settings.webdav.path = wPath.value.trim();
		saveHot({ settings: state.settings });
	};
	if (wProxy) wProxy.onchange = () => {
		state.settings.webdav.proxy = wProxy.value.trim();
		saveHot({ settings: state.settings });
	};
	if (wPass) wPass.onchange = () => {
		const vv = wPass.value.trim();
		if (!vv && wPass.dataset.hasKey === "1") return;
		saveWebdavPass(wPass.value);
		if (vv) {
			wPass.value = "";
			wPass.placeholder = "已保存 ●●●●（留空不修改）";
			wPass.dataset.hasKey = "1";
		}
	};
	const wPassClear = doc.getElementById("aus-webdav-pass-clear");
	if (wPassClear && wPass) wPassClear.onclick = () => {
		saveWebdavPass("");
		wPass.value = "";
		wPass.placeholder = "应用密码";
		wPass.dataset.hasKey = "";
	};
	doc.getElementById("aus-webdav-sync").onclick = () => doSyncNow();
	try {
		const ps = state.settings.pricingSync || {};
		const modeBtn = doc.getElementById("aus-pricing-sync-mode-btn");
		const modeLabel = doc.getElementById("aus-pricing-sync-mode-label");
		const modeDrop = doc.getElementById("aus-pricing-sync-mode-dropdown");
		const modeMap = {
			"add-missing": "只补未定价",
			"overwrite-unlocked": "覆盖未锁定",
			"overwrite-all": "全部覆盖"
		};
		if (modeLabel) modeLabel.textContent = modeMap[ps.mode] || "只补未定价";
		if (modeDrop) {
			modeDrop.innerHTML = Object.entries(modeMap).map(([k, l]) => `<div data-mode="${k}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${ps.mode === k ? "background:var(--ds-card);font-weight:600;" : ""}">${l}</div>`).join("");
			modeDrop.querySelectorAll("[data-mode]").forEach((el) => {
				el.onclick = () => {
					state.settings.pricingSync.mode = el.getAttribute("data-mode");
					saveHot({ settings: state.settings });
					closeDropdownInstant(modeDrop);
					if (modeLabel) modeLabel.textContent = modeMap[state.settings.pricingSync.mode] || el.getAttribute("data-mode");
					modeDrop.innerHTML = Object.entries(modeMap).map(([k, l]) => `<div data-mode="${k}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${state.settings.pricingSync.mode === k ? "background:var(--ds-card);font-weight:600;" : ""}">${l}</div>`).join("");
				};
			});
		}
		if (modeBtn && modeDrop) modeBtn.onclick = () => {
			modeDrop.style.display = modeDrop.style.display === "block" ? "none" : "block";
		};
		const rateEl = doc.getElementById("aus-exchange-rate");
		if (rateEl) rateEl.value = String(ps.exchangeRate ?? 7.2);
		const liveEl = doc.getElementById("aus-use-live-rate");
		if (liveEl) liveEl.checked = !!ps.useLiveRate;
		const intervalBtn = doc.getElementById("aus-pricing-sync-interval-btn");
		const intervalLabel = doc.getElementById("aus-pricing-sync-interval-label");
		const intervalDrop = doc.getElementById("aus-pricing-sync-interval-dropdown");
		const intervalMap = {
			"0": "仅手动",
			"24": "每天",
			"168": "每周"
		};
		if (intervalLabel) intervalLabel.textContent = intervalMap[String(ps.autoIntervalHours ?? 0)] || "仅手动";
		if (intervalDrop) {
			intervalDrop.innerHTML = Object.entries(intervalMap).map(([k, l]) => `<div data-interval="${k}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${String(ps.autoIntervalHours) === k ? "background:var(--ds-card);font-weight:600;" : ""}">${l}</div>`).join("");
			intervalDrop.querySelectorAll("[data-interval]").forEach((el) => {
				el.onclick = () => {
					state.settings.pricingSync.autoIntervalHours = parseInt(el.getAttribute("data-interval")) || 0;
					saveHot({ settings: state.settings });
					closeDropdownInstant(intervalDrop);
					if (intervalLabel) intervalLabel.textContent = intervalMap[el.getAttribute("data-interval")] || el.getAttribute("data-interval");
					try {
						import("./pricing-sync-DJgmC8rg.js").then((n) => n.a).then((m) => m.restartPricingSyncTimer?.());
						import("./currency-CJMNKSam.js").then((n) => n.t).then((m) => m.restartRateTimer?.());
					} catch {}
				};
			});
		}
		if (intervalBtn && intervalDrop) intervalBtn.onclick = () => {
			intervalDrop.style.display = intervalDrop.style.display === "block" ? "none" : "block";
		};
		const rateStatus = doc.getElementById("aus-rate-status");
		if (rateStatus) {
			const last = ps.lastRateFetch ? new Date(ps.lastRateFetch).toLocaleString("zh-CN") : "—";
			rateStatus.textContent = `1 USD ≈ ${Number(ps.exchangeRate || 7.2).toFixed(4)} CNY（更新于 ${last}）`;
		}
		const syncStatus = doc.getElementById("aus-pricing-sync-status");
		if (syncStatus) syncStatus.textContent = `上次同步：${ps.lastSync ? new Date(ps.lastSync).toLocaleString("zh-CN") : "未同步"} · 模式：${modeMap[ps.mode] || ps.mode}`;
		if (rateEl) rateEl.onchange = () => {
			const v = parseFloat(rateEl.value);
			if (!isFinite(v) || v <= 0) return;
			state.settings.pricingSync.exchangeRate = Math.round(v * 1e4) / 1e4;
			saveHot({ settings: state.settings });
			if (rateStatus) rateStatus.textContent = `1 USD ≈ ${v.toFixed(4)} CNY（更新于 ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}）`;
			try {
				globalThis.ApiUsageStat?.refreshUI?.();
			} catch {}
		};
		if (liveEl) liveEl.onchange = () => {
			state.settings.pricingSync.useLiveRate = liveEl.checked;
			saveHot({ settings: state.settings });
			try {
				import("./currency-CJMNKSam.js").then((n) => n.t).then((m) => m.restartRateTimer?.());
			} catch {}
		};
		const fetchBtn = doc.getElementById("aus-fetch-rate");
		if (fetchBtn) fetchBtn.onclick = async () => {
			fetchBtn.textContent = "获取中…";
			fetchBtn.disabled = true;
			try {
				const r = await fetchLiveRate(true);
				if (r && rateEl) {
					rateEl.value = String(r);
					if (rateStatus) rateStatus.textContent = `1 USD ≈ ${Number(r).toFixed(4)} CNY（更新于 ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}）`;
					try {
						globalThis.ApiUsageStat?.refreshUI?.();
					} catch {}
				}
			} finally {
				fetchBtn.textContent = "立即获取";
				fetchBtn.disabled = false;
			}
		};
		const syncBtn = doc.getElementById("aus-btn-sync-pricing");
		if (syncBtn) syncBtn.onclick = async () => {
			syncBtn.textContent = "同步中…";
			syncBtn.disabled = true;
			try {
				await syncPricingFromModelsDev({ silent: false });
				if (syncStatus) {
					const ps2 = state.settings.pricingSync;
					syncStatus.textContent = `上次同步：${new Date(ps2.lastSync).toLocaleString("zh-CN")} · 模式：${modeMap[ps2.mode] || ps2.mode}`;
				}
				try {
					globalThis.ApiUsageStat?.refreshUI?.();
					renderModelsEditor(doc);
				} catch {}
			} finally {
				syncBtn.textContent = "立即同步";
				syncBtn.disabled = false;
			}
		};
		const previewBtn = doc.getElementById("aus-btn-preview-pricing");
		const previewHost = doc.getElementById("aus-pricing-sync-preview");
		if (previewBtn && previewHost) previewBtn.onclick = async () => {
			previewBtn.textContent = "预览中…";
			previewBtn.disabled = true;
			try {
				const catalog = await fetchModelsDevCatalog();
				const plan = buildSyncPlan(catalog);
				const summary = plan.summary;
				const rows = plan.rows.filter((row) => row.catalogModel).slice(0, 8);
				previewHost.style.display = "block";
				previewHost.innerHTML = "<div style=\"font-weight:600;margin-bottom:6px;\">匹配 " + summary.matched + "（精确 " + summary.exact + " / 模糊 " + summary.fuzzy + (summary.ambiguous ? " / 歧义 " + summary.ambiguous : "") + "）· 未匹配 " + summary.unmatched + " · 将写入 " + summary.write + " · 将更新 " + summary.update + " · 跳过 " + summary.skipped + "</div>" + rows.map((row) => "<div style=\"display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--ds-border);padding:4px 0;\"><span style=\"overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;\" title=\"" + esc(row.localModel) + "\">" + esc(row.localModel) + "</span><span style=\"color:var(--ds-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;\" title=\"" + esc(row.catalogModel || "") + "\">" + esc(row.catalogModel || "") + "</span><span>" + Math.round(row.score * 100) + "%</span></div>").join("") + "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;\">按钱包已识别模型模糊匹配，只写价格不新增模型；到钱包页可逐条勾选后应用。</div>";
			} catch (e) {
				previewHost.style.display = "block";
				previewHost.textContent = "预览失败：" + (e?.message || e);
			} finally {
				previewBtn.textContent = "预览";
				previewBtn.disabled = false;
			}
		};
	} catch {}
	renderPeakHoursEditor(doc);
	renderModelsEditor(doc);
	fillDebugModelSelect(doc);
	try {
		const listEl = doc.getElementById("aus-custom-models-list");
		const toggleEl = doc.getElementById("aus-models-toggle");
		const headerEl = doc.getElementById("aus-models-header");
		const addBtn = doc.getElementById("aus-btn-add-model");
		const collapsed = s.modelsPricingCollapsed !== false;
		if (listEl) listEl.style.display = collapsed ? "none" : "grid";
		if (toggleEl) toggleEl.innerHTML = collapsed ? icon("chevron-down", 14) + " 展开" : icon("chevron-up", 14) + " 收起";
		const applyCollapsed = (next) => {
			state.settings.modelsPricingCollapsed = next;
			try {
				saveHot({ settings: state.settings });
			} catch {}
			if (listEl) listEl.style.display = next ? "none" : "grid";
			if (toggleEl) toggleEl.innerHTML = next ? icon("chevron-down", 14) + " 展开" : icon("chevron-up", 14) + " 收起";
		};
		if (toggleEl) toggleEl.onclick = (e) => {
			e.stopPropagation();
			applyCollapsed(listEl?.style.display !== "none" ? true : false);
		};
		if (headerEl) headerEl.onclick = (e) => {
			const target = e.target;
			if (target.closest("#aus-btn-add-model") || target.closest("#aus-btn-clear-custom-models") || target.closest("#aus-models-toggle")) return;
			applyCollapsed(listEl?.style.display !== "none" ? true : false);
		};
		const clearAllBtn = doc.getElementById("aus-btn-clear-custom-models");
		if (clearAllBtn) {
			let armed = false;
			let armTimer = null;
			const resetLabel = () => {
				armed = false;
				try {
					clearAllBtn.textContent = "清空自定义模型";
				} catch {}
			};
			clearAllBtn.onclick = () => {
				if (!armed) {
					armed = true;
					clearAllBtn.textContent = "确认清空？再点一次";
					armTimer = setTimeout(() => {
						armTimer = null;
						resetLabel();
					}, 4e3);
					return;
				}
				if (armTimer) {
					clearTimeout(armTimer);
					armTimer = null;
				}
				resetLabel();
				const n = clearAllCustomModels();
				renderModelsEditor(doc);
				fillDebugModelSelect(doc);
				recalcCostsAndRefresh();
				if (n) toast("success", `已清空 ${n} 项自定义模型与价格，内置模型计价规则保持不变`);
				else toast("info", "当前没有自定义模型可清空");
			};
		}
		if (addBtn) addBtn.addEventListener("click", () => {
			if (listEl?.style.display === "none") applyCollapsed(false);
			setTimeout(() => {
				const l = doc.getElementById("aus-custom-models-list");
				const t = doc.getElementById("aus-models-toggle");
				if (l) l.style.display = "grid";
				if (t) t.innerHTML = icon("chevron-up", 14) + " 收起";
			}, 30);
		});
	} catch {}
	try {
		const wdBody = doc.getElementById("aus-webdav-body");
		const wdToggle = doc.getElementById("aus-webdav-toggle");
		const wdHeader = doc.getElementById("aus-webdav-header");
		const setWdCollapsed = (next) => {
			if (wdBody) wdBody.style.display = next ? "none" : "block";
			if (wdToggle) wdToggle.innerHTML = next ? icon("chevron-down", 14) + " 展开" : icon("chevron-up", 14) + " 收起";
		};
		setWdCollapsed(true);
		const flipWd = () => setWdCollapsed(wdBody?.style.display !== "none");
		if (wdToggle) wdToggle.onclick = (e) => {
			e.stopPropagation();
			flipWd();
		};
		if (wdHeader) wdHeader.onclick = (e) => {
			if (e.target.closest("#aus-webdav-toggle")) return;
			flipWd();
		};
	} catch {}
}
function renderPeakHoursEditor(doc) {
	const list = doc.getElementById("aus-peak-hours-list");
	if (!list) return;
	list.innerHTML = (state.settings.peakHours || []).map((h, i) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="time" value="${esc(h.start || "")}" data-idx="${i}" data-field="start" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" />
      <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">至</span>
      <input type="time" value="${esc(h.end || "")}" data-idx="${i}" data-field="end" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" />
      <button data-del="${i}" style="padding:6px 8px;border:1px solid var(--ds-red-border);border-radius:8px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">删除</button>
    </div>
  `).join("");
	list.querySelectorAll("input[type=\"time\"]").forEach((el) => {
		el.onchange = () => {
			const idx = parseInt(el.getAttribute("data-idx"));
			const field = el.getAttribute("data-field");
			state.settings.peakHours[idx][field] = el.value;
			saveHot({ settings: state.settings });
			recalcCostsAndRefresh();
		};
	});
	list.querySelectorAll("button[data-del]").forEach((el) => {
		el.onclick = () => {
			const idx = parseInt(el.getAttribute("data-del"));
			state.settings.peakHours.splice(idx, 1);
			if (!state.settings.peakHours.length) state.settings.peakHours = JSON.parse(JSON.stringify(DEFAULT_PEAK_HOURS));
			saveHot({ settings: state.settings });
			renderPeakHoursEditor(doc);
			recalcCostsAndRefresh();
		};
	});
	const addBtn = doc.getElementById("aus-btn-add-peak-hour");
	if (addBtn) addBtn.onclick = () => {
		state.settings.peakHours.push({
			start: "09:00",
			end: "12:00"
		});
		saveHot({ settings: state.settings });
		renderPeakHoursEditor(doc);
	};
	bindExtraOffDays(doc);
}
function bindExtraOffDays(doc) {
	const el = doc.getElementById("aus-extra-off-days");
	if (!el) return;
	el.value = (state.settings.extraOffDays || []).join("\n");
	el.onchange = () => {
		const raw = String(el.value || "").split(/[\s,，;；]+/).filter(Boolean);
		const valid = [];
		const invalid = [];
		for (const day of raw) if (isValidDayKey(day)) {
			if (valid.indexOf(day) === -1) valid.push(day);
		} else invalid.push(day);
		valid.sort();
		state.settings.extraOffDays = valid;
		saveHot({ settings: state.settings });
		renderPeakHoursEditor(doc);
		recalcCostsAndRefresh();
		if (invalid.length) toast("warning", `已保存 ${valid.length} 个日期，忽略 ${invalid.length} 个非法日期：${invalid.slice(0, 3).join("、")}`);
		else toast("success", `已保存 ${valid.length} 个额外空闲日期`);
	};
}
function renderModelsEditor(doc) {
	const list = doc.getElementById("aus-custom-models-list");
	if (!list) return;
	const builtin = Object.keys(PRICING).filter((m) => HIDDEN_PRICING_MODELS.indexOf(m) === -1);
	const cms = state.settings.customModels || [];
	const showSynced = state.settings.pricingSync?.showSyncedModels === true;
	const syncedCount = cms.filter((c) => isSyncedCustomModel(c)).length;
	const rows = [];
	for (const m of builtin) {
		const p = getPricing(m);
		const usePeak = p.usePeakPricing !== false;
		rows.push(modelRow(m, p, true, usePeak));
	}
	for (const e of cms) {
		if (isSyncedCustomModel(e) && !showSynced) continue;
		if (e?.model && builtin.indexOf(e.model) === -1 && HIDDEN_PRICING_MODELS.indexOf(e.model) === -1) {
			const p = getPricing(e.model);
			rows.push(modelRow(e.model, p, false, p.usePeakPricing !== false, isSyncedCustomModel(e)));
		}
	}
	list.innerHTML = rows.join("");
	renderModelsSyncNote(doc, syncedCount, showSynced);
	list.querySelectorAll("input[type=\"checkbox\"].aus-cm-peak").forEach((el) => {
		el.onchange = () => {
			const model = el.closest("[data-model]").getAttribute("data-model") || "";
			const usePeak = el.checked;
			upsertCustom(model, { usePeakPricing: usePeak });
			saveHot({ settings: state.settings });
			renderModelsEditor(doc);
			recalcCostsAndRefresh();
		};
	});
	list.querySelectorAll("input[data-price]").forEach((el) => {
		el.onchange = () => {
			const row = el.closest("[data-model]");
			const model = row.getAttribute("data-model") || "";
			const isBuiltin = row.getAttribute("data-builtin") === "1";
			saveCustomRow(model, readRow(row), isBuiltin);
		};
	});
	list.querySelectorAll("button[data-del]").forEach((el) => {
		el.onclick = () => {
			const model = el.closest("[data-model]").getAttribute("data-model") || "";
			state.settings.customModels = state.settings.customModels.filter((c) => c.model !== model);
			saveHot({ settings: state.settings });
			renderModelsEditor(doc);
			fillDebugModelSelect(doc);
			recalcCostsAndRefresh();
		};
	});
	const addBtn = doc.getElementById("aus-btn-add-model");
	if (addBtn) addBtn.onclick = () => {
		const name = "custom-model-" + (state.settings.customModels.length + 1);
		state.settings.customModels.push({
			model: name,
			usePeakPricing: true,
			offpeak: {},
			peak: {}
		});
		saveHot({ settings: state.settings });
		renderModelsEditor(doc);
		fillDebugModelSelect(doc);
	};
}
/** 已同步模型提示条：说明隐藏原因，并提供展开查看 / 一次性移除入口 */
function renderModelsSyncNote(doc, syncedCount, showSynced) {
	const note = doc.getElementById("aus-models-sync-note");
	if (!note) return;
	if (!syncedCount) {
		note.style.display = "none";
		note.innerHTML = "";
		return;
	}
	note.style.display = "block";
	note.innerHTML = `已从 models.dev 同步 <b style="color:var(--ds-text);">${syncedCount}</b> 个模型价格，默认隐藏不显示（仍照常参与计费）。
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <button id="aus-toggle-synced-models" style="padding:5px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">${showSynced ? "隐藏同步模型" : "显示同步模型"}</button>
      <button id="aus-clear-synced-models" style="padding:5px 10px;border:1px solid var(--ds-red-border);border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">移除全部同步模型</button>
    </div>`;
	const toggleBtn = doc.getElementById("aus-toggle-synced-models");
	if (toggleBtn) toggleBtn.onclick = () => {
		state.settings.pricingSync.showSyncedModels = !showSynced;
		saveHot({ settings: state.settings });
		renderModelsEditor(doc);
	};
	const clearBtn = doc.getElementById("aus-clear-synced-models");
	if (clearBtn) {
		let armed = false;
		clearBtn.onclick = () => {
			if (!armed) {
				armed = true;
				clearBtn.textContent = "确认移除？再点一次";
				setTimeout(() => {
					armed = false;
					try {
						clearBtn.textContent = "移除全部同步模型";
					} catch {}
				}, 4e3);
				return;
			}
			const n = removeSyncedModels();
			renderModelsEditor(doc);
			fillDebugModelSelect(doc);
			recalcCostsAndRefresh();
			if (n) toast("success", `已移除 ${n} 个同步模型价格`);
		};
	}
}
function modelRow(model, p, isBuiltin, usePeak, synced = false) {
	const cur = (() => {
		try {
			return getDisplayCurrency();
		} catch {
			return {
				code: "CNY",
				symbol: "¥",
				rate: 1
			};
		}
	})();
	const toDisplay = (v) => {
		if (v === "" || v == null) return "";
		const num = parseFloat(String(v));
		if (!isFinite(num)) return String(v);
		const d = cur.code === "USD" ? num / cur.rate : num;
		return String(Math.round(d * 1e4) / 1e4);
	};
	const hit = (v) => v !== void 0 && v !== "" ? toDisplay(v) : "";
	return `<div data-model="${esc(model)}" data-builtin="${isBuiltin ? "1" : "0"}" data-synced="${synced ? "1" : "0"}" style="border-radius:10px;padding:10px;background:var(--ds-card-inner);display:grid;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <input value="${esc(model)}" ${isBuiltin ? "readonly" : ""} style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:${isBuiltin ? "var(--ds-sidebar-bg)" : "var(--ds-card-inner)"};font-size:var(--aus-fs-base);" />
      ${synced ? "<span title=\"来自 models.dev 自动同步\" style=\"flex-shrink:0;padding:2px 8px;border-radius:999px;background:var(--ds-green-bg);color:var(--ds-green);font-size:var(--aus-fs-sm);font-weight:600;\">已同步</span>" : ""}
      <label style="display:flex;align-items:center;gap:6px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);cursor:pointer;"><input type="checkbox" class="aus-cm-peak aus-checkbox" ${usePeak ? "checked" : ""} /> 峰谷</label>
      ${isBuiltin ? "" : "<button data-del=\"1\" style=\"padding:4px 8px;border:1px solid var(--ds-red-border);border-radius:6px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;\">删除</button>"}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:var(--ds-sidebar-bg);border-radius:8px;padding:8px;display:grid;gap:6px;">
        <div style="font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-green);">非峰</div>
        ${field("offpeak.hit", hit(p.offpeak.hit))}${field("offpeak.miss", hit(p.offpeak.miss))}${field("offpeak.output", hit(p.offpeak.output))}
      </div>
      <div style="background:var(--ds-card-inner);border-radius:8px;padding:8px;display:grid;gap:6px;${usePeak ? "" : "opacity:0.45;pointer-events:none;"}">
        <div style="font-size:var(--aus-fs-sm);font-weight:600;color:#D97706;">高峰</div>
        ${field("peak.hit", hit(p.peak.hit))}${field("peak.miss", hit(p.peak.miss))}${field("peak.output", hit(p.peak.output))}
      </div>
    </div>
    <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">单位：${cur.code}/百万 tokens（${cur.symbol}）· ${synced ? "同步模型：手动改价后转为自定义模型" : "内置模型不可删除，价格可覆盖"}</div>
  </div>`;
}
function field(key, val) {
	return `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);width:44px;">${key.endsWith(".hit") ? "命中" : key.endsWith(".miss") ? "未命中" : "输出"}</span><input type="number" step="0.001" min="0" data-price="${key}" value="${esc(val)}" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:var(--aus-fs-base);" /></div>`;
}
function readRow(row) {
	const out = {
		usePeakPricing: row.querySelector(".aus-cm-peak")?.checked ?? true,
		offpeak: {},
		peak: {}
	};
	const cur = (() => {
		try {
			return getDisplayCurrency();
		} catch {
			return {
				code: "CNY",
				rate: 1
			};
		}
	})();
	row.querySelectorAll("input[data-price]").forEach((el) => {
		const k = el.getAttribute("data-price");
		const v = el.value.trim();
		if (v === "") return;
		const num = parseFloat(v);
		if (isNaN(num)) return;
		const cny = cur.code === "USD" ? Math.round(num * cur.rate * 1e4) / 1e4 : num;
		const [zone, field] = k.split(".");
		out[zone][field] = cny;
	});
	return out;
}
function upsertCustom(model, patch) {
	const cms = state.settings.customModels;
	let found = cms.find((c) => c.model === model);
	if (found) {
		Object.assign(found, patch);
		delete found.synced;
	} else cms.push({
		model,
		usePeakPricing: patch.usePeakPricing,
		offpeak: {},
		peak: {}
	});
}
/**
* 清空全部自定义模型与覆盖价格（含 models.dev 同步项）。
* 仅清空 settings.customModels —— 脚本内置的 PRICING / PRICE_HISTORY 完全不动，
* 因此未外显模型（如已下架/旧键）以及过去/现在/未来的多段计价规则都照常生效。
*/
function clearAllCustomModels() {
	const n = (state.settings.customModels || []).length;
	state.settings.customModels = [];
	const ps = state.settings.pricingSync;
	if (ps) ps.showSyncedModels = false;
	saveHot({ settings: state.settings });
	return n;
}
function saveCustomRow(model, prices, isBuiltin) {
	const base = PRICING[model];
	let same = true;
	for (const f of [
		"hit",
		"miss",
		"output"
	]) {
		if (prices.offpeak[f] !== void 0 && prices.offpeak[f] !== base?.offpeak?.[f]) same = false;
		if (prices.peak[f] !== void 0 && prices.peak[f] !== base?.peak?.[f]) same = false;
	}
	const cms = state.settings.customModels;
	const idx = cms.findIndex((c) => c.model === model);
	if (isBuiltin && prices.usePeakPricing && same) {
		if (idx !== -1) cms.splice(idx, 1);
	} else {
		const entry = {
			model,
			usePeakPricing: prices.usePeakPricing,
			offpeak: prices.offpeak,
			peak: prices.peak
		};
		if (idx !== -1) cms[idx] = entry;
		else cms.push(entry);
	}
	saveHot({ settings: state.settings });
	recalcCostsAndRefresh();
}
function getPricing(model) {
	const m = model || "deepseek-flash";
	try {
		return getPricing$1(m, state.settings);
	} catch {
		return PRICING[m] || PRICING["deepseek-v4-flash"];
	}
}
function fillDebugModelSelect(doc) {
	const sel = doc.getElementById("aus-debug-model");
	if (!sel) return;
	const models = Object.keys(PRICING).concat((state.settings.customModels || []).filter((c) => !isSyncedCustomModel(c)).map((c) => c.model).filter(Boolean)).concat(repository.getWallets().flatMap((wallet) => wallet.models.map((model) => model.model)).filter(Boolean)).filter((m) => HIDDEN_PRICING_MODELS.indexOf(m) === -1);
	const uniq = Array.from(new Set(models));
	sel.innerHTML = uniq.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
	const cur = state.settings.debugModel;
	if (uniq.indexOf(cur) === -1) {
		state.settings.debugModel = uniq[0] || "deepseek-flash";
		try {
			saveHot({ settings: state.settings });
		} catch {}
	}
	sel.value = state.settings.debugModel;
}
//#endregion
export { trackOpen as a, afterNextPaint as c, applyTheme as d, unwatchSystemTheme as f, icon as h, initTelemetry as i, closeDropdownInstant as l, switchHTML as m, settings_exports as n, trackPage as o, watchSystemTheme as p, flushTelemetry as r, trackRender as s, renderSettings as t, closeDropdownThenPaint as u };
