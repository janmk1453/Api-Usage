import { t as esc } from "./date-Dsu8hrMO.js";
import { t as icon } from "./icons-BBwmzRpr.js";
import { t as remoteSources } from "./update-BsrR54Lw.js";
//#region src/constants/version.ts
var APP_VERSION = String("3.2.4");
/**
* 构建号：manifest.json#build_no → __BUILD_NO__。
*
* 用途只有两个：① 界面上显性展示，方便用户与反馈日志确认拿到的是哪一次构建；
* ② 更新弹窗的「已读」判定键 = `版本号|构建号`，因此同一版本号重发修复版也能提示，
* 不必为了提示而推进版本号。
*
* 规则（与 AGENTS.md 同步）：未经用户当轮明确要求不得改动；确需改动时在现有值上 +1，
* 同一次发布内不要重复递增。
*/
var BUILD_NO = String("6");
/** 更新弹窗的已读键：版本号 + 构建号；拿不到构建号时退回纯版本号 */
var APP_BUILD_TAG = BUILD_NO ? `${APP_VERSION}|${BUILD_NO}` : APP_VERSION;
/** 更新日志（最新在前） */
var CHANGELOG = [
	{
		version: "r3.2.4",
		buildNo: 6,
		date: "2026-11-24",
		sections: [
			{
				kind: "feature",
				items: [
					"消息顶部展示对话数据与费用：",
					"TT酒馆：在 酒馆-用户设置 中，提供额外的消息费用选择框，基于TT原有逻辑，在消息顶部额外展示对话费用",
					"ST酒馆：TT在ST的基础上在 酒馆-用户设置 中增加了 首字延迟、生成速度、缓存命中率 的勾选显示，对此我们迁移了相关能力并额外提供了 消息费用 展示能力",
					"记录现在支持定位区分不同扩展/脚本的请求",
					"统计与历史页现在可以通过请求类型进行筛选了",
					"新增公告能力",
					"支持管理模型显示",
					"支持数字单位缩写"
				]
			},
			{
				kind: "improve",
				items: [
					"趋势预测只统计对话类请求",
					"改进测试与发布流程，加强版本管理",
					"改进一些UI效果，统一组件样式",
					"移动端底栏逻辑",
					"现在页面文字不再会被选中",
					"第N次重做钱包UI效果，怎么做都不好看（"
				]
			},
			{
				kind: "fix",
				items: [
					"误将TT酒馆API报错输出的详细说明统计为输出",
					"同一供应商被扩展请求被拆成两个钱包",
					"清除筛选按钮无效",
					"数据储存逻辑部分描述错误",
					"修复了一些已知问题"
				]
			}
		]
	},
	{
		version: "r3.2.3",
		buildNo: 4,
		date: "2026-11-22",
		sections: [{
			kind: "fix",
			items: ["ST酒馆中自更新失效，极端条件下历史数据错位"]
		}]
	},
	{
		version: "r3.2.3fix",
		buildNo: 2,
		date: "2026-11-20",
		sections: [{
			kind: "fix",
			items: [
				"多请求并发导致的竞态问题与大量复杂错误",
				"同一次请求被重复记成多条",
				"改善修复错误报告",
				"重新加载宿主后取不到用量"
			]
		}, {
			kind: "improve",
			items: [
				"非流式与假流式不再错误展示首字延迟",
				"改进速率估算准确性",
				"采集安装流程"
			]
		}]
	},
	{
		version: "r3.2.3",
		buildNo: 1,
		date: "2026-11-18",
		sections: [
			{
				kind: "feature",
				items: [
					"新增支持：Vertex AI API、Interactions API（TT*）、Gemini 原生 API、Gemini OpenAI 兼容 API、Anthropic API（TT）、Responses API（TT），*标注TT的格式为仅TauriTavern支持",
					"上游没有返回用量时，支持本地估算数据，且计入历史",
					"手动中断对话时，可以正确识别并估算用量，且计入历史",
					"历史记录列表现在可以显示更多信息",
					"更新说明弹窗",
					"速率估算"
				]
			},
			{
				kind: "improve",
				items: [
					"改进了国内网络环境下的检查更新",
					"提高对网络中断，请求超时，用户手动中断等情况的兼容性",
					"改进错误提示，降低误报率",
					"手动中断的对话不再算作截断"
				]
			},
			{
				kind: "fix",
				items: [
					"检查更新在 TauriTavern 上显示扩展目录不存在",
					"速率异常提示误报",
					"本地估算的输入用量异常偏低",
					"同一轮重复入账时耗时丢失",
					"修复部分模型前缀导致误判",
					"修复潜在的 TT酒馆 中 Gemini 原生、Claude、Responses 格式的请求报错问题",
					"修复扩展误报「连续两轮没有取到用量」",
					"修复宿主重新加载后取不到用量",
					"其他已知问题"
				]
			}
		]
	},
	{
		version: "r3.2.2fix",
		date: "2026-11-18",
		sections: [{
			kind: "fix",
			items: [
				"检查更新在 TauriTavern 上误报扩展目录不存在",
				"速率异常提示误报",
				"本地估算的输入用量偏低",
				"同一轮重复入账时耗时丢失"
			]
		}, {
			kind: "improve",
			items: ["网络中断与请求超时不再算作扩展报错"]
		}]
	},
	{
		version: "r3.2.2",
		date: "2026-11-16",
		sections: [
			{
				kind: "feature",
				items: [
					"上游没有返回用量时，支持本地估算数据，且计入历史",
					"手动中断对话时，可以正确识别并估算用量，且计入历史",
					"历史记录列表现在可以显示更多信息"
				]
			},
			{
				kind: "improve",
				items: [
					"国内网络环境下的检查更新",
					"提高对网络中断，请求超时，用户中断等情况的兼容性",
					"改进错误提示，降低误报率"
				]
			},
			{
				kind: "fix",
				items: ["修复部分模型前缀导致误判", "修复手机端部分UI问题"]
			}
		]
	},
	{
		version: "r3.2.1",
		date: "2026-11-15",
		sections: [
			{
				kind: "feature",
				items: [
					"新增 请求日志，在设置中查看最近一轮请求的完整数据",
					"新增 问题反馈 能力，支持上传日志，自动提示，日志输出，问题报告",
					"实验性功能 在 历史记录 页中增加其他请求选项，用于验证记录 数据库/记忆/填表/提取 等非常规对话请求的能力，为未来实现全局统计做铺垫"
				]
			},
			{
				kind: "improve",
				items: [
					"改进图表tooltip效果",
					"历史记录失败时给出具体原因",
					"改进价格同步逻辑"
				]
			},
			{
				kind: "fix",
				items: ["修复价格同步后历史费用没有自动重算", "修复了一些已知问题"]
			}
		]
	},
	{
		version: "r3.2.0",
		date: "2026-11-08",
		sections: [
			{
				kind: "feature",
				items: [
					"新增「管理对话」，管理首页表格和下拉胶囊中的对话是否显示",
					"安卓设备现在使用系统返回手势时会返回酒馆",
					"兼容TauriTavern 2.4.0",
					"更新2027年法定节假日数据"
				]
			},
			{
				kind: "improve",
				items: [
					"优化启动速度",
					"更新了使用说明页的内容",
					"改进了价格匹配",
					"改进了很多视觉效果和UI细节",
					"优化扩展卸载时的数据清理"
				]
			},
			{
				kind: "fix",
				items: ["修复了一些已知问题"]
			}
		]
	},
	{
		version: "r3.1.9fix",
		date: "2026-11-04",
		sections: [{
			kind: "fix",
			items: ["移动端部分情况下底部导航栏被浏览器工具栏遮挡"]
		}]
	},
	{
		version: "r3.1.9",
		date: "2026-11-02",
		sections: [
			{
				kind: "feature",
				items: ["移动端重构导航栏逻辑，默认启用更适合移动端的底部导航栏UI，可在设置中的“移动端兼容UI”开关切回旧版", "温馨提示：多次点击底栏按钮可以返回上级页面"]
			},
			{
				kind: "improve",
				items: ["视觉效果和UI细节，完善动画效果", "增加统计数字实时变动的能力和动画"]
			},
			{
				kind: "fix",
				items: [
					"解决了一个gemini的兼容问题",
					"侧边导航栏在极限情况下错位",
					"修复了很多已知问题"
				]
			}
		]
	},
	{
		version: "r3.1.8",
		date: "2026-10-29",
		sections: [
			{
				kind: "feature",
				items: [
					"关于页新增更新日志",
					"新增一些动画和模糊效果",
					"新增重置筛选"
				]
			},
			{
				kind: "improve",
				items: [
					"移除了一些旧有设置",
					"优化深浅色模式显示效果，提高可读性",
					"图表/历史记录的输入输出和部分 UI 配色与样式对齐 DeepSeek 官网",
					"部分选项的选择现在会在刷新网页后留存",
					"调整移动端 UI"
				]
			},
			{
				kind: "fix",
				items: [
					"鼠标滚轮无法在图表上滚动",
					"调整细节",
					"模型占比图在大量模型时挤成一团"
				]
			}
		]
	},
	{
		version: "r3.1.7",
		date: "2026-10-23",
		sections: [
			{
				kind: "feature",
				items: [
					"重做钱包价格自动识别填充，现在可以通过选择价格来源并点击更新实现自动识别填充价格",
					"余额自动校准支持多家供应商：DeepSeek、Moonshot/Kimi、硅基流动、OpenRouter、阶跃星辰、Novita；套餐额度支持智谱 GLM、MiniMax",
					"钱包卡新增自动识别厂商官方图标",
					"钱包页新增工具栏",
					"所有统计图表底部新增视窗滑块：拖中间平移、拖两端缩放"
				]
			},
			{
				kind: "improve",
				items: [
					"改进钱包和统计页的部分 UI",
					"优化滚动条视觉效果",
					"在 tooltip 中显示时间和更多信息",
					"部分图表现在支持排序",
					"设置 - 储存 中现在支持清理缓存",
					"改进了很多 UI 效果，验证性的加入了少量过渡动画"
				]
			},
			{
				kind: "fix",
				items: [
					"修复移动端钱包页文字与按钮错位",
					"修复潜在的图表不可用问题",
					"修复无法统计思维链耗时"
				]
			}
		]
	}
];
/** 取最近若干个版本（默认 CHANGELOG_ENTRY_LIMIT 条） */
function getRecentChangelog(limit = 5) {
	const n = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5;
	return CHANGELOG.slice(0, n);
}
//#endregion
//#region src/ui/changelog.ts
/** 分类样式：新增=绿、改进=蓝、修复=橙，与全站语义色一致 */
var KIND_STYLE = {
	feature: {
		label: "新增",
		color: "var(--ds-green)",
		bg: "var(--ds-green-bg)"
	},
	improve: {
		label: "改进",
		color: "var(--ds-blue, #2563EB)",
		bg: "var(--ds-blue-bg, rgba(37,99,235,0.12))"
	},
	fix: {
		label: "修复",
		color: "var(--ds-orange)",
		bg: "rgba(255,106,0,0.12)"
	}
};
/** 更新日期展示：同年只显示 M/D，跨年补上年份；非法格式原样返回 */
function formatChangelogDate(date, now = Date.now()) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || "").trim());
	if (!m) return String(date || "");
	const year = Number(m[1]);
	const month = Number(m[2]);
	const day = Number(m[3]);
	return year === new Date(now).getFullYear() ? `${month}/${day}` : `${year}/${month}/${day}`;
}
function sectionHtml(section) {
	const style = KIND_STYLE[section.kind] || KIND_STYLE.feature;
	const items = section.items.map((text) => `<div class="aus-changelog-item"><span class="aus-changelog-dot" style="background:${style.color};"></span><span>${esc(text)}</span></div>`).join("");
	return `<div class="aus-changelog-section"><span class="aus-changelog-kind" style="color:${style.color};background:${style.bg};">${style.label}</span><div class="aus-changelog-items">${items}</div></div>`;
}
/** 单条版本的分类与条目：关于页与「更新了什么」弹窗共用，保证两处文案一字不差 */
function changelogSectionsHTML(entry) {
	if (!entry || !Array.isArray(entry.sections)) return "";
	return entry.sections.filter((s) => s && Array.isArray(s.items) && s.items.length).map(sectionHtml).join("");
}
function entryHtml(entry, open, isLatest) {
	const dateText = formatChangelogDate(entry.date);
	const meta = [dateText ? `${esc(dateText)} 更新` : ""].concat(isLatest ? ["<span class=\"aus-changelog-latest\">最新</span>"] : []).filter(Boolean).join("");
	const sections = changelogSectionsHTML(entry);
	return "<div class=\"aus-changelog-entry\" data-changelog-entry data-open=\"" + (open ? "1" : "0") + `"><button type="button" class="aus-changelog-head" data-changelog-toggle aria-expanded="${open ? "true" : "false"}"><span class="aus-changelog-version">${esc(entry.version)}</span>` + (entry.buildNo != null ? `<span class="aus-changelog-build">b${esc(String(entry.buildNo))}</span>` : "") + `<span class="aus-changelog-meta">${meta}</span><span class="aus-changelog-caret">${icon(open ? "chevron-up" : "chevron-down", 16)}</span></button><div class="aus-changelog-body"${open ? "" : " style=\"display:none;\""}>${sections}</div></div>`;
}
/**
* 关于页底部的「更新日志」块：默认只展开最新版本，其余版本点击表头展开/收起。
* 数据全部来自 constants/changelog.ts，这里只负责渲染与交互，不写死任何版本内容。
*/
function renderChangelogCard() {
	const entries = getRecentChangelog();
	if (!entries.length) return "";
	const total = CHANGELOG.length;
	const countText = total > entries.length ? `共 ${total} 个版本 · 显示最近 ${entries.length} 个` : `共 ${total} 个版本`;
	const list = entries.map((e, i) => entryHtml(e, i === 0, i === 0)).join("");
	return `<div class="ds-card" id="aus-changelog"><div class="aus-changelog-header"><span class="aus-changelog-title">更新日志</span><span class="aus-changelog-count">${esc(countText)}</span></div><div class="aus-changelog-list">${list}</div><div class="aus-changelog-footer">更新日志由作者手动维护，更早的版本请看仓库提交记录：<a href="https://github.com/janmk1453/Api-Usage/commits/main" target="_blank" rel="noreferrer">janmk1453/Api-Usage</a></div></div>`;
}
/** 绑定展开/收起（事件委托，只绑一次；表头是原生 button，键盘回车/空格同样可用） */
function bindChangelog(doc) {
	const root = doc.getElementById("aus-changelog");
	if (!root || root.getAttribute("data-bound") === "1") return;
	root.setAttribute("data-bound", "1");
	root.addEventListener("click", (ev) => {
		const target = ev.target;
		const head = target && target.closest ? target.closest("[data-changelog-toggle]") : null;
		if (!head || !root.contains(head)) return;
		const entry = head.closest("[data-changelog-entry]");
		const body = entry ? entry.querySelector(".aus-changelog-body") : null;
		if (!entry || !body) return;
		const open = head.getAttribute("aria-expanded") === "true";
		head.setAttribute("aria-expanded", open ? "false" : "true");
		entry.setAttribute("data-open", open ? "0" : "1");
		body.style.display = open ? "none" : "grid";
		const caret = head.querySelector(".aus-changelog-caret");
		if (caret) caret.innerHTML = icon(open ? "chevron-down" : "chevron-up", 16);
	});
}
//#endregion
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
export { readSeenAnnouncementIds as a, bindChangelog as c, renderChangelogCard as d, CHANGELOG as f, BUILD_NO as h, readCachedAnnouncements as i, changelogSectionsHTML as l, APP_VERSION as m, isAnnouncementActive as n, sortAnnouncements as o, APP_BUILD_TAG as p, markAnnouncementsRead as r, unreadAnnouncementsFor as s, fetchAnnouncements as t, formatChangelogDate as u };
