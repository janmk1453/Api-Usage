import { t as esc } from "./date-Dsu8hrMO.js";
import { m as APP_VERSION, r as markAnnouncementsRead, s as unreadAnnouncementsFor, t as fetchAnnouncements, u as formatChangelogDate } from "./announcement-D04vHVjN.js";
import { t as icon } from "./icons-BBwmzRpr.js";
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
/** 面板还在吗：公告只挂在面板里，面板关着（display:none）或还没建好都不弹。 */
function panelHost() {
	const panel = (window.parent?.document ?? document).getElementById("aus-panel");
	if (!panel) return null;
	if (panel.style.display === "none") return null;
	return panel;
}
/** 打开弹窗；条目为空或面板已关返回 false。关闭时把这批 id 记为已读。 */
function openAnnouncementDialog(items) {
	if (typeof document === "undefined") return false;
	const list = (Array.isArray(items) ? items : []).filter((item) => item && item.id);
	if (!list.length) return false;
	const doc = window.parent?.document ?? document;
	const host = panelHost();
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
	if (!panelHost()) return false;
	const unread = unreadAnnouncementsFor(fresh, ctx);
	return unread.length ? openAnnouncementDialog(unread) : false;
}
//#endregion
export { maybeShowAnnouncementDialog };
