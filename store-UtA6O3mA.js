import { pn as __exportAll } from "./graphic-BAx7jeh4.js";
import "./pricing-Bc-qEvy8.js";
//#region src/utils/device.ts
/**
* 设备类型判定（只回答一个问题：这台设备是不是「手指优先」的移动端）。
*
* 用途：「移动端兼容 UI」的默认值只按设备类型决定一次——移动端默认开启底栏，
* 桌面端保持原样（原侧栏抽屉）。判定刻意不看窗口宽度：桌面端把窗口拖窄不该被当成移动端。
* 入口与设置归一化都走 mobileDeviceHint()，结果在本次会话内缓存；
* 一旦用户（或上一版扩展）把开关写进设置，后续版本就不会再碰它。
*/
var hint = null;
/**
* 现场探测：UA 里的移动端关键字 + 粗指针（触屏）与多点触控。
* 拿不到任何线索时按桌面端处理——桌面端保持原样是更保守的选择，
* 也不会把窄窗口误判成手机。
*/
function detectMobileDevice() {
	try {
		const nav = typeof navigator === "undefined" ? null : navigator;
		const win = typeof window === "undefined" ? null : window;
		const ua = String(nav?.userAgent || "");
		const touchPoints = Number(nav?.maxTouchPoints || 0);
		const uaMobile = /Android|iPhone|iPod|iPad|Mobile|Windows Phone|HarmonyOS|OpenHarmony/i.test(ua);
		const iPadDesktopMode = /Macintosh/i.test(ua) && touchPoints > 1;
		if (uaMobile || iPadDesktopMode) return true;
		return !!(win && typeof win.matchMedia === "function" && win.matchMedia("(pointer: coarse)").matches) && touchPoints > 0;
	} catch {
		return false;
	}
}
/** 本次会话的设备判定结果：已注入就用注入值，否则现场探测一次并缓存 */
function mobileDeviceHint() {
	if (hint === null) hint = detectMobileDevice();
	return hint;
}
//#endregion
//#region src/types/settings.ts
var defaultSettings = () => ({
	theme: "light",
	overviewWalletId: "wallet:deepseek-official",
	overviewWalletManuallySet: false,
	balanceInterval: 10,
	debug: false,
	debugHit: 1e4,
	debugMiss: 5e3,
	debugOutput: 2e3,
	debugModel: "deepseek-v4-flash",
	debugDateStart: "",
	debugDateEnd: "",
	debugBatchCount: 30,
	customModels: [],
	peakHours: [{
		start: "09:00",
		end: "12:00"
	}, {
		start: "14:00",
		end: "18:00"
	}],
	extraOffDays: [],
	peakDot: false,
	telemetryEnabled: true,
	mobileCompatUi: mobileDeviceHint(),
	webdav: {
		url: "https://dav.jianguoyun.com/dav/",
		username: "",
		path: "",
		proxy: ""
	},
	historyScope: "all",
	overviewFour: [
		"avg_cost",
		"avg_tokens",
		"avg_duration",
		"avg_rate",
		"avg_input_tokens",
		"avg_output_tokens",
		"avg_hit_rate",
		"max_total"
	],
	statsFour: [
		"avg_cost",
		"avg_tokens",
		"avg_think_ratio",
		"truncation_rate"
	],
	modelsPricingCollapsed: true,
	pricingSync: {
		mode: "add-missing",
		exchangeRate: 7.2,
		useLiveRate: true,
		autoIntervalHours: 0,
		lastSync: null,
		lastRateFetch: null,
		showSyncedModels: false,
		syncedMarkVersion: 0
	}
});
//#endregion
//#region src/store/index.ts
var store_exports = /* @__PURE__ */ __exportAll({
	getCurrentChatIdForStore: () => getCurrentChatIdForStore,
	getHistoryForDisplay: () => getHistoryForDisplay,
	getSelectedSave: () => getSelectedSave,
	state: () => state
});
var state = {
	history: [],
	total_tokens: 0,
	total_cost: 0,
	input_tokens: 0,
	output_tokens: 0,
	cache_hit_tokens: 0,
	cache_miss_tokens: 0,
	input_cost: 0,
	output_cost: 0,
	rounds: 0,
	startTime: Date.now(),
	lastUsage: null,
	settings: defaultSettings(),
	balance: null,
	customBalance: null,
	wallets: [],
	walletIgnored: [],
	messageCount: 0
};
function getSelectedSave() {
	return {
		history: state.history,
		total_tokens: state.total_tokens,
		total_cost: state.total_cost,
		input_tokens: state.input_tokens,
		output_tokens: state.output_tokens,
		cache_hit_tokens: state.cache_hit_tokens,
		cache_miss_tokens: state.cache_miss_tokens,
		input_cost: state.input_cost,
		output_cost: state.output_cost,
		rounds: state.rounds,
		startTime: state.startTime
	};
}
function getCurrentChatIdForStore() {
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		if (ctx?.getCurrentChatId) {
			const v = ctx.getCurrentChatId();
			if (typeof v === "string" && v) return v;
		}
		const chid = globalThis.this_chid;
		const chars = globalThis.characters;
		if (typeof chid === "number" && Array.isArray(chars) && chars[chid]) {
			const c = chars[chid].chat;
			if (typeof c === "string" && c) return c;
		}
	} catch {}
	return null;
}
function getHistoryForDisplay() {
	if ((state.settings.historyScope || "all") !== "current") return state.history || [];
	const cur = getCurrentChatIdForStore();
	if (!cur) return state.history || [];
	return (state.history || []).filter((h) => h.chatId === cur);
}
//#endregion
export { defaultSettings as a, store_exports as i, getSelectedSave as n, mobileDeviceHint as o, state as r, getHistoryForDisplay as t };
