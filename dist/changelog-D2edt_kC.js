import { t as esc } from "./date-Dsu8hrMO.js";
import { t as icon } from "./icons-BBwmzRpr.js";
//#region src/constants/version.ts
var APP_VERSION = String("3.2.3");
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
var BUILD_NO = String("4");
/** 更新弹窗的已读键：版本号 + 构建号；拿不到构建号时退回纯版本号 */
var APP_BUILD_TAG = BUILD_NO ? `${APP_VERSION}|${BUILD_NO}` : APP_VERSION;
/** 更新日志（最新在前） */
var CHANGELOG = [
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
export { CHANGELOG as a, BUILD_NO as c, renderChangelogCard as i, changelogSectionsHTML as n, APP_BUILD_TAG as o, formatChangelogDate as r, APP_VERSION as s, bindChangelog as t };
