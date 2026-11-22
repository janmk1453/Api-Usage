import { t as esc } from "./date-Dsu8hrMO.js";
import { r as formatChangelogDate, s as APP_VERSION } from "./changelog-e06A3fQu.js";
import { t as icon } from "./icons-BBwmzRpr.js";
import { t as remoteSources } from "./update-BsrR54Lw.js";
//#region src/services/announcement.ts
/**
* 公告：作者在仓库根目录的 announcement.json 里写公告，客户端打开面板时若「有未读」就弹一次。
*
* 与更新日志的区别（也是它存在的理由）：
* - 更新日志跟构建号走，发一次版才能说一句话；公告是**仓库里的一个静态文件**，改完提交
*   就生效（读独立的 announce 分支，见下方 ANNOUNCEMENT_BRANCH），不用动版本号、不用重新打包、
*   可以随时撤回或加一条。
* - 更新日志按「构建/版本」记已读；公告按**条目 id** 记已读，一条一条地看过，同一条不会
*   再弹第二次，新发的公告照常弹。
*
* 三条硬约束：
* - **不碰设置、不写聊天**：已读与缓存都放 localStorage（aus_announcement_*），不进
*   extensionSettings，因此不参与导出 / 导入 / WebDAV 同步。
* - **失败一律静默**：拉不到、超时、JSON 坏了、被墙，全部当作「这次没有公告」，绝不影响
*   面板打开与任何统计功能；缓存里有上次成功的列表，断网时仍能弹未读公告。
* - **不打扰**：打开面板才检查，30 分钟最多拉一次；与「更新了什么」弹窗互斥（那一轮弹了
*   更新就不再弹公告，公告留到下次打开），一次弹窗列出全部未读条目，关掉即全部已读。
*
* 条目字段与清洗规则见 normalizeItem()：id 必填且全局唯一，title/body 必填，level 只认
* info / warning / critical，版本区间与 until 用于「只对某些版本、某段时间」投放。
*/
/** 公告分支根目录的公告文件（独立于版本，改完提交该分支即生效） */
var ANNOUNCEMENT_PATH = "announcement.json";
/**
* 公告读独立的 `announce` 分支，**不放 main**：
* - 检查更新是用 `compare/{localSha}...main` 的 `ahead_by > 0` 判定的，只看分支领先几个提交、
*   与改了哪些文件无关 —— 公告若提交到 main，已装 main 版本的用户每次都会收到一次
*   「发现新提交 main@xxxx」提示与「立即更新」横幅，等于用公告打扰了全部用户。
* - 放独立分支后只推那一支，main 的 head 不动，任何人都不会被提示。
* - dev 分支的用户也读同一支，避免公告只对测试分支可见。
*/
var ANNOUNCEMENT_BRANCH = "announce";
/** 已读 id 列表（localStorage，JSON 字符串数组） */
var ANNOUNCEMENT_SEEN_KEY = "aus_announcement_seen_v1";
/** 上次成功拉到的公告列表（localStorage，JSON），断网时兜底 */
var ANNOUNCEMENT_CACHE_KEY = "aus_announcement_cache_v1";
/** 上次发起拉取的时间戳（节流用） */
var ANNOUNCEMENT_CHECK_KEY = "aus_announcement_check_v1";
/** 同一会话 / 半小时内最多拉一次 */
var ANNOUNCEMENT_MIN_INTERVAL_MS = 18e5;
/** 单梯队超时：先实时源，全灭再退 CDN */
var ANNOUNCEMENT_SOURCE_TIMEOUT_MS = 3500;
var LEVELS = [
	"info",
	"warning",
	"critical"
];
var ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function storage() {
	try {
		const store = globalThis.localStorage;
		if (!store || typeof store.getItem !== "function" || typeof store.setItem !== "function") return null;
		store.getItem(ANNOUNCEMENT_SEEN_KEY);
		return store;
	} catch {
		return null;
	}
}
function readJson(key, fallback) {
	const store = storage();
	if (!store) return fallback;
	try {
		const raw = store.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}
function writeJson(key, value) {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(key, JSON.stringify(value));
	} catch {}
}
/** 单个字符串字段的清洗：去控制字符、压空白、截断；非字符串返回空串 */
function cleanAnnouncementText(value, limit = 600) {
	if (typeof value !== "string") return "";
	const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").trim();
	if (!text) return "";
	return text.length > limit ? text.slice(0, limit) + "…" : text;
}
function cleanBody(raw) {
	const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
	const out = [];
	for (const item of list) {
		const text = cleanAnnouncementText(item);
		if (text) out.push(text);
		if (out.length >= 6) break;
	}
	return out;
}
function cleanLevel(raw) {
	const value = String(raw ?? "").trim().toLowerCase();
	return LEVELS.includes(value) ? value : "info";
}
function cleanDate(raw) {
	const value = String(raw ?? "").trim();
	return DATE_PATTERN.test(value) ? value : "";
}
function cleanVersion(raw) {
	const value = String(raw ?? "").trim().replace(/^v/i, "");
	return /^\d+(\.\d+)*$/.test(value) ? value : "";
}
function cleanLinkUrl(raw) {
	const value = String(raw ?? "").trim();
	if (!value) return "";
	if (/^https?:\/\//i.test(value)) return value.slice(0, 500);
	if (value.charAt(0) === "/") return value.slice(0, 500);
	return "";
}
/**
* 单条公告的清洗（纯函数）：id 或标题不合格、正文为空一律丢弃（返回 null），
* 其余字段缺省给安全值。远端文件被人写坏也不会让弹窗炸掉。
*/
function normalizeAnnouncementItem(raw) {
	if (!raw || typeof raw !== "object") return null;
	const id = String(raw.id ?? "").trim();
	if (!ID_PATTERN.test(id)) return null;
	const title = cleanAnnouncementText(raw.title, 120);
	if (!title) return null;
	const body = cleanBody(raw.body);
	if (!body.length) return null;
	const linkUrl = cleanLinkUrl(raw.linkUrl);
	return {
		id,
		date: cleanDate(raw.date),
		level: cleanLevel(raw.level),
		title,
		body,
		minVersion: cleanVersion(raw.minVersion),
		maxVersion: cleanVersion(raw.maxVersion),
		until: cleanDate(raw.until),
		linkText: linkUrl ? cleanAnnouncementText(raw.linkText, 40) : "",
		linkUrl
	};
}
/** 整份公告文件的清洗：兼容「直接给数组」与「{ schema, items }」两种写法，按 id 去重 */
function normalizeAnnouncementFile(raw) {
	const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const item of list) {
		const clean = normalizeAnnouncementItem(item);
		if (!clean || seen.has(clean.id)) continue;
		seen.add(clean.id);
		out.push(clean);
		if (out.length >= 20) break;
	}
	return out;
}
function versionParts(version) {
	return String(version || "").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
}
/** a >= b（逐段比较，缺段按 0） */
function versionAtLeast(a, b) {
	if (!b) return true;
	const left = versionParts(a);
	const right = versionParts(b);
	const len = Math.max(left.length, right.length);
	for (let i = 0; i < len; i += 1) {
		const lv = left[i] || 0;
		const rv = right[i] || 0;
		if (lv > rv) return true;
		if (lv < rv) return false;
	}
	return true;
}
/** a <= b（同上） */
function versionAtMost(a, b) {
	if (!b) return true;
	return versionAtLeast(b, a);
}
/** 'YYYY-MM-DD' → 当天 23:59:59.999 的时间戳；格式不对返回 0 */
function announcementDayEnd(date) {
	if (!DATE_PATTERN.test(String(date || ""))) return 0;
	const parts = String(date).split("-").map((n) => parseInt(n, 10) || 0);
	const ts = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 23, 59, 59, 999).getTime();
	return Number.isFinite(ts) ? ts : 0;
}
/** 本条公告此刻是否该投放：版本区间命中，且没超过 until */
function isAnnouncementActive(item, ctx) {
	if (!item) return false;
	const version = String(ctx?.version || "").trim();
	if (item.minVersion && !versionAtLeast(version, item.minVersion)) return false;
	if (item.maxVersion && !versionAtMost(version, item.maxVersion)) return false;
	if (item.until) {
		const end = announcementDayEnd(item.until);
		if (end && (Number(ctx?.now) || Date.now()) > end) return false;
	}
	return true;
}
/** 排序：有日期的在前、日期倒序；同日期按 id 稳定排列 */
function sortAnnouncements(items) {
	return [...Array.isArray(items) ? items : []].sort((a, b) => {
		const ad = a.date || "";
		const bd = b.date || "";
		if (ad && bd && ad !== bd) return ad < bd ? 1 : -1;
		if (!!ad !== !!bd) return ad ? -1 : 1;
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});
}
/** 未读 = 该投放且 id 不在已读集合里；输出按日期倒序 */
function pickUnreadAnnouncements(items, seenIds, ctx) {
	const seen = /* @__PURE__ */ new Set();
	for (const id of seenIds || []) seen.add(String(id));
	return sortAnnouncements((items || []).filter((item) => item && !seen.has(item.id) && isAnnouncementActive(item, ctx)));
}
/** 已读 id 的去重 + 截断（只留最近的 limit 条，防 localStorage 膨胀） */
function pruneSeenIds(ids, limit = 200) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const id of ids || []) {
		const value = String(id || "").trim();
		if (!value || seen.has(value)) continue;
		seen.add(value);
		out.push(value);
	}
	return out.length > limit ? out.slice(out.length - limit) : out;
}
function readSeenAnnouncementIds() {
	const raw = readJson(ANNOUNCEMENT_SEEN_KEY, []);
	return Array.isArray(raw) ? pruneSeenIds(raw.map((v) => String(v ?? ""))) : [];
}
function writeSeenAnnouncementIds(ids) {
	writeJson(ANNOUNCEMENT_SEEN_KEY, pruneSeenIds(ids));
}
/** 标记已读（合并写入，不覆盖历史） */
function markAnnouncementsRead(ids) {
	writeSeenAnnouncementIds(pruneSeenIds([...readSeenAnnouncementIds(), ...ids || []]));
}
function readCachedAnnouncements() {
	return normalizeAnnouncementFile(readJson(ANNOUNCEMENT_CACHE_KEY, []));
}
function writeCachedAnnouncements(items) {
	writeJson(ANNOUNCEMENT_CACHE_KEY, normalizeAnnouncementFile(items));
}
function readLastAnnouncementCheck() {
	const raw = readJson(ANNOUNCEMENT_CHECK_KEY, 0);
	const value = Number(raw);
	return Number.isFinite(value) && value > 0 ? value : 0;
}
function writeLastAnnouncementCheck(at) {
	const value = Number(at);
	if (Number.isFinite(value) && value > 0) writeJson(ANNOUNCEMENT_CHECK_KEY, value);
}
/** 是否该发起一次拉取（节流；manual 跳过节流） */
function shouldFetchAnnouncements(now = Date.now(), manual = false) {
	if (manual) return true;
	const last = readLastAnnouncementCheck();
	if (!last) return true;
	return now - last >= ANNOUNCEMENT_MIN_INTERVAL_MS;
}
function getParentFetch() {
	try {
		const p = globalThis.window?.parent;
		if (p?.fetch) return p.fetch.bind(p);
	} catch {}
	return globalThis.fetch.bind(globalThis);
}
/** 一梯队并发抢：谁先给出合法内容用谁，全部失败/超时返回 null */
function raceSources(urls, timeoutMs) {
	return new Promise((resolve) => {
		if (!urls.length) {
			resolve(null);
			return;
		}
		let settled = false;
		let pending = urls.length;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		const timer = setTimeout(() => finish(null), timeoutMs);
		const done = () => {
			pending -= 1;
			if (pending <= 0) {
				clearTimeout(timer);
				finish(null);
			}
		};
		for (const url of urls) {
			const rf = getParentFetch();
			let request;
			try {
				request = rf(url, {
					method: "GET",
					cache: "no-store",
					credentials: "omit"
				});
			} catch {
				done();
				continue;
			}
			request.then((resp) => resp && resp.ok ? resp.text() : Promise.reject(/* @__PURE__ */ new Error("http"))).then((text) => {
				if (settled) return;
				try {
					normalizeAnnouncementFile(JSON.parse(text));
					clearTimeout(timer);
					finish(text);
				} catch {
					done();
				}
			}).catch(() => done());
		}
	});
}
/**
* 拉一份公告文本：先实时源（raw + 镜像），全灭再退 CDN 缓存源。
* 只在这两个梯队内部并发，失败静默返回 null（调用方用缓存兜底）。
*/
async function fetchAnnouncementText() {
	let sources;
	try {
		sources = remoteSources(ANNOUNCEMENT_PATH, ANNOUNCEMENT_BRANCH);
	} catch {
		return null;
	}
	const live = sources.filter((s) => s.live).map((s) => s.url);
	const cached = sources.filter((s) => !s.live).map((s) => s.url);
	const first = await raceSources(live, ANNOUNCEMENT_SOURCE_TIMEOUT_MS);
	if (first) return first;
	return raceSources(cached, ANNOUNCEMENT_SOURCE_TIMEOUT_MS);
}
/**
* 拉取并写缓存。节流 30 分钟；manual 强制。
* 任何异常都被吞掉，返回值只表达「拿到没有」。
*/
async function fetchAnnouncements(options = {}) {
	const now = Number(options.now) || Date.now();
	if (!shouldFetchAnnouncements(now, options.manual)) return {
		items: null,
		skipped: "throttle"
	};
	writeLastAnnouncementCheck(now);
	let text = null;
	try {
		text = await fetchAnnouncementText();
	} catch {
		text = null;
	}
	if (!text) return {
		items: null,
		skipped: "fetch-failed"
	};
	try {
		const items = normalizeAnnouncementFile(JSON.parse(text));
		writeCachedAnnouncements(items);
		return {
			items,
			skipped: null
		};
	} catch {
		return {
			items: null,
			skipped: "fetch-failed"
		};
	}
}
/** 当前该弹的未读公告：优先用刚拉到的列表，退回本地缓存 */
function unreadAnnouncementsFor(items, ctx) {
	return pickUnreadAnnouncements(items && items.length ? items : readCachedAnnouncements(), readSeenAnnouncementIds(), ctx);
}
//#endregion
//#region src/ui/announcement-dialog.ts
var MASK_ID = "aus-an-mask";
/** 弹窗 HTML（纯函数：只吃条目数组，不碰 DOM，测试可直接断言字符串） */
function announcementDialogHTML(items, options = {}) {
	const list = Array.isArray(items) ? items : [];
	if (!list.length) return "";
	const count = list.length + " 条未读";
	const body = list.map((item) => {
		const date = item.date ? formatChangelogDate(item.date, options.now) : "";
		const link = item.linkUrl ? "<a class=\"aus-an-link\" href=\"" + esc(item.linkUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + esc(item.linkText || "查看详情") + "</a>" : "";
		return "<section class=\"aus-an-item\" data-level=\"" + esc(item.level) + "\"><div class=\"aus-an-item-head\"><span class=\"aus-an-item-title\">" + esc(item.title) + "</span>" + (date ? "<span class=\"aus-an-item-date\">" + esc(date) + "</span>" : "") + "</div>" + item.body.map((p) => "<p class=\"aus-an-p\">" + esc(p) + "</p>").join("") + link + "</section>";
	}).join("");
	return "<div class=\"aus-cl aus-an\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"aus-an-title\"><div class=\"aus-cl-head\"><div class=\"aus-cl-heading\"><span class=\"aus-cl-title\" id=\"aus-an-title\">公告</span><span class=\"aus-cl-version\">" + esc(count) + "</span></div><button type=\"button\" class=\"aus-cl-close\" data-an=\"close\" aria-label=\"关闭\">" + icon("close", 16) + "</button></div><div class=\"aus-cl-body\"><div class=\"aus-an-list\">" + body + "</div></div><div class=\"aus-cl-foot\"><button type=\"button\" class=\"aus-cl-btn is-primary\" data-an=\"ok\">我知道了</button></div></div>";
}
/** 打开弹窗；条目为空返回 false。关闭时把这批 id 记为已读。 */
function openAnnouncementDialog(items) {
	if (typeof document === "undefined") return false;
	const list = (Array.isArray(items) ? items : []).filter((item) => item && item.id);
	if (!list.length) return false;
	const doc = window.parent?.document ?? document;
	const host = doc.getElementById("aus-panel") || doc.body;
	if (!host) return false;
	try {
		doc.getElementById(MASK_ID)?.remove();
	} catch {}
	const mask = doc.createElement("div");
	mask.id = MASK_ID;
	mask.className = "aus-cl-mask" + (host === doc.body ? " is-page" : "");
	mask.innerHTML = announcementDialogHTML(list);
	host.appendChild(mask);
	const close = () => {
		try {
			markAnnouncementsRead(list.map((item) => item.id));
		} catch {}
		try {
			mask.remove();
		} catch {}
	};
	mask.addEventListener("click", (ev) => {
		const target = ev.target;
		if (!target) return;
		if (target === mask) {
			close();
			return;
		}
		if (target.closest ? target.closest("[data-an]")?.getAttribute("data-an") : null) close();
	});
	return true;
}
/**
* 面板打开时调用：有未读公告就弹，没有就静默。
* 先用本地缓存立刻判断（断网也能弹上次没看过的），再看要不要拉一次新的（30 分钟节流）。
*/
async function maybeShowAnnouncementDialog(options = {}) {
	if (typeof document === "undefined") return false;
	const ctx = { version: APP_VERSION };
	const cached = unreadAnnouncementsFor(null, ctx);
	if (cached.length) return openAnnouncementDialog(cached);
	let fresh = null;
	try {
		fresh = (await fetchAnnouncements({ manual: !!options.force })).items;
	} catch {
		fresh = null;
	}
	if (!fresh) return false;
	const unread = unreadAnnouncementsFor(fresh, ctx);
	return unread.length ? openAnnouncementDialog(unread) : false;
}
//#endregion
export { maybeShowAnnouncementDialog };
