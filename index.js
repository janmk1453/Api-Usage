import { pn as __exportAll } from "./graphic-BAx7jeh4.js";
import { n as getSelectedSave, o as mobileDeviceHint, r as state$2, t as getHistoryForDisplay } from "./store-TDK3YzRZ.js";
import { t as DEFAULT_CONTEXT_LIMIT } from "./pricing-Bc-qEvy8.js";
import { f as saveHot, p as historyRecordKey } from "./persistence-CaWdvByH.js";
import { r as toast, t as log } from "./logger-8RGXnvfI.js";
import { A as WALLET_CATALOG_PROVIDERS, C as mergeWalletCollections, S as findWalletModel, T as walletPendingModelCount, _ as normalizeModel, c as isTruncatedFinish, f as calcSavings, g as isWalletPeakHour, h as isPeakHour, i as saveWalletApiKey, k as DEEPSEEK_WALLET_ID, l as DataEvents, p as getPricing, r as getWalletApiKey, s as sanitizeHistoryTiming, t as repository, u as on, v as cloneWallet, w as walletBalanceToCny, x as findWalletForHistory, y as defaultContextLimitForModel } from "./repository-Cf26MO-h.js";
import { c as localDay, i as isPeakHour$1, l as localTimeHM, n as isChinaHoliday, r as isExtraOffDay, s as isWeekendDay, t as esc, u as CN_HOLIDAY_COVERAGE_LABEL } from "./date-BJI2m6dS.js";
import { a as getWalletExchangeRate, i as getDisplayCurrency, r as formatMoney } from "./currency-Dsn2T9-Q.js";
import { t as installInterception } from "./interception-BzsoKaEQ.js";
import { a as BALANCE_ADAPTERS, c as vendorById, l as vendorInitialFallback, n as queryBalance, o as resolveBalanceAdapter, r as queryWalletBalance, s as resolveVendor } from "./balance-DwuYkZLE.js";
import { a as trackOpen, c as afterNextPaint, d as applyTheme, f as unwatchSystemTheme, h as icon, i as initTelemetry, l as closeDropdownInstant, m as switchHTML, o as trackPage, p as watchSystemTheme, r as flushTelemetry, s as trackRender, t as renderSettings, u as closeDropdownThenPaint } from "./settings-BBoJGXG-.js";
import { c as walletSyncStatus, n as buildSyncPlan, r as fetchModelsDevCatalog, t as applySyncPlan } from "./pricing-sync-LRQyOkr3.js";
//#region src/services/import-export.ts
function isUnsafeKey(k) {
	return k === "__proto__" || k === "constructor" || k === "prototype";
}
function finiteNonNegative(value, fallback = 0) {
	const number = typeof value === "number" ? value : parseFloat(String(value));
	return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function cleanText(value) {
	return String(value ?? "").trim() || null;
}
function sanitizeImportedValue(value, depth = 0) {
	if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	if (depth >= 6) return null;
	if (Array.isArray(value)) return value.map((item) => sanitizeImportedValue(item, depth + 1));
	if (typeof value !== "object") return null;
	const clean = {};
	for (const [key, item] of Object.entries(value)) {
		if (isUnsafeKey(key)) continue;
		clean[key] = sanitizeImportedValue(item, depth + 1);
	}
	return clean;
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
async function exportHistory() {
	const doc = window.parent?.document ?? document;
	const d = /* @__PURE__ */ new Date();
	const pad = (n) => n < 10 ? "0" + n : "" + n;
	const safeSettings = JSON.parse(JSON.stringify(state$2.settings || {}));
	if (safeSettings.webdav) safeSettings.webdav = {
		url: "",
		username: "",
		path: "",
		proxy: ""
	};
	const _appVer = "3.2.0";
	let fullHist = [];
	try {
		fullHist = await repository.getAllHistory();
	} catch (error) {
		alert("导出失败：无法读取完整历史（" + (error?.message || error) + "）");
		return;
	}
	const payload = {
		format: "deepseek-stat-export",
		version: 1,
		exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
		appVersion: _appVer,
		scope: "full",
		walletFormat: 2,
		data: {
			history: stripHistory(fullHist),
			total_tokens: state$2.total_tokens,
			total_cost: state$2.total_cost,
			input_tokens: state$2.input_tokens,
			output_tokens: state$2.output_tokens,
			cache_hit_tokens: state$2.cache_hit_tokens,
			cache_miss_tokens: state$2.cache_miss_tokens,
			input_cost: state$2.input_cost,
			output_cost: state$2.output_cost,
			rounds: state$2.rounds,
			startTime: state$2.startTime,
			balance: state$2.balance,
			customBalance: state$2.customBalance,
			wallets: state$2.wallets,
			walletIgnored: state$2.walletIgnored,
			settings: safeSettings,
			messageCount: state$2.messageCount,
			saves: { default: {
				name: "default",
				history: stripHistory(fullHist),
				total_tokens: state$2.total_tokens,
				total_cost: state$2.total_cost,
				input_tokens: state$2.input_tokens,
				output_tokens: state$2.output_tokens,
				cache_hit_tokens: state$2.cache_hit_tokens,
				cache_miss_tokens: state$2.cache_miss_tokens,
				input_cost: state$2.input_cost,
				output_cost: state$2.output_cost,
				rounds: state$2.rounds,
				startTime: state$2.startTime
			} },
			currentSave: "default"
		}
	};
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = doc.createElement("a");
	a.href = url;
	a.download = `API用量统计_导出_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
	doc.body.appendChild(a);
	a.click();
	doc.body.removeChild(a);
	setTimeout(() => {
		try {
			URL.revokeObjectURL(url);
		} catch {}
	}, 1e3);
}
function normalizeImportData(raw) {
	if (!raw || typeof raw !== "object") return { error: "文件格式不正确" };
	let version = raw.version ?? 1;
	if (typeof version !== "number" || isNaN(version) || version < 1) version = 1;
	if (version > 1) return { error: `文件版本 v${version} 高于当前 v1，请升级扩展` };
	const d = raw.data;
	if (!d || typeof d !== "object") return { error: "文件中缺少数据" };
	let history = [];
	if (Array.isArray(d.history)) history = d.history;
	else if (d.saves && typeof d.saves === "object") for (const s of Object.values(d.saves)) {
		const h = s.history || [];
		history = history.concat(h);
	}
	const cleaned = [];
	let skipped = 0;
	for (const h of history) {
		if (!h || typeof h !== "object") {
			skipped++;
			continue;
		}
		const timestamp = finiteNonNegative(h.timestamp, NaN);
		const rawModel = cleanText(h.model);
		if (!Number.isFinite(timestamp) || timestamp <= 0 || !rawModel) {
			skipped++;
			continue;
		}
		const model = normalizeModel(rawModel);
		const nh = {
			timestamp,
			model,
			rawModel: rawModel !== model ? rawModel : null,
			prompt_tokens: finiteNonNegative(h.prompt_tokens),
			cache_hit_tokens: finiteNonNegative(h.cache_hit_tokens),
			cache_miss_tokens: finiteNonNegative(h.cache_miss_tokens),
			completion_tokens: finiteNonNegative(h.completion_tokens),
			total_tokens: finiteNonNegative(h.total_tokens),
			priceType: cleanText(h.priceType) || "old"
		};
		const SKIP_IMPORT = /* @__PURE__ */ new Set([
			"messages",
			"fullRequest",
			"fullResponse",
			"raw_usage"
		]);
		for (const f of Object.keys(h)) {
			if (isUnsafeKey(f) || SKIP_IMPORT.has(f)) continue;
			if (nh[f] === void 0) nh[f] = sanitizeImportedValue(h[f]);
		}
		for (const field of [
			"cost",
			"input_cost",
			"output_cost"
		]) if (nh[field] !== void 0) nh[field] = finiteNonNegative(nh[field]);
		if (h.raw_usage && typeof h.raw_usage === "object") {
			const raw = sanitizeImportedValue(h.raw_usage);
			if (raw && typeof raw === "object") try {
				if (JSON.stringify(raw).length <= 8192) nh.raw_usage = raw;
			} catch {}
		}
		if (!(Number(nh.total_tokens) > 0)) {
			const derived = Number(nh.prompt_tokens || 0) + Number(nh.completion_tokens || 0);
			if (derived > 0) nh.total_tokens = derived;
		}
		sanitizeHistoryTiming(nh);
		cleaned.push(nh);
	}
	cleaned.sort((a, b) => b.timestamp - a.timestamp);
	return {
		data: {
			history: cleaned,
			balance: sanitizeImportedValue(d.balance),
			customBalance: sanitizeImportedValue(d.customBalance),
			wallets: Array.isArray(d.wallets) ? sanitizeImportedValue(d.wallets) : void 0,
			walletIgnored: Array.isArray(d.walletIgnored) ? sanitizeImportedValue(d.walletIgnored) : void 0,
			settings: sanitizeImportedValue(d.settings),
			messageCount: finiteNonNegative(d.messageCount),
			total_tokens: finiteNonNegative(d.total_tokens),
			total_cost: finiteNonNegative(d.total_cost),
			input_tokens: finiteNonNegative(d.input_tokens),
			output_tokens: finiteNonNegative(d.output_tokens),
			cache_hit_tokens: finiteNonNegative(d.cache_hit_tokens),
			cache_miss_tokens: finiteNonNegative(d.cache_miss_tokens),
			input_cost: finiteNonNegative(d.input_cost),
			output_cost: finiteNonNegative(d.output_cost),
			rounds: finiteNonNegative(d.rounds),
			startTime: finiteNonNegative(d.startTime, Date.now())
		},
		skipped: { entries: skipped }
	};
}
async function applyImportedData(d) {
	const existing = await repository.getAllHistory();
	const seen = new Set(existing.map((h) => historyRecordKey(h)));
	const toAdd = [];
	for (const h of d.history || []) {
		const key = historyRecordKey(h);
		if (!seen.has(key)) {
			seen.add(key);
			toAdd.push(h);
		}
	}
	const merged = [...toAdd, ...existing].sort((a, b) => b.timestamp - a.timestamp);
	await repository.replaceAll({ history: merged });
	if (Array.isArray(d.wallets)) await repository.replaceAll({
		wallets: mergeWalletCollections(repository.getWallets(), d.wallets),
		walletIgnored: Array.from(/* @__PURE__ */ new Set([...state$2.walletIgnored || [], ...d.walletIgnored || []]))
	});
	if (d.settings && typeof d.settings === "object") {
		const mergedSettings = { ...d.settings };
		mergedSettings.webdav = { ...state$2.settings?.webdav || {} };
		await repository.replaceAll({ settings: mergedSettings });
	}
	await repository.recalcAll();
	await repository.rebuildAggregates();
	try {
		globalThis.ApiUsageStat?.refreshUI?.();
	} catch {}
}
function bindImportExport(doc) {
	const exp = doc.getElementById("aus-btn-export");
	if (exp) exp.onclick = () => exportHistory();
	const imp = doc.getElementById("aus-btn-import");
	if (imp) imp.onclick = () => triggerImport();
}
function triggerImport() {
	const doc = window.parent?.document ?? document;
	let inputEl = doc.getElementById("aus-import-file");
	if (!inputEl) {
		const el = doc.createElement("input");
		el.type = "file";
		el.id = "aus-import-file";
		el.accept = ".json,application/json";
		el.style.display = "none";
		doc.body.appendChild(el);
		el.addEventListener("change", () => {
			const inp = el;
			const file = inp.files?.[0];
			inp.value = "";
			if (!file) return;
			const reader = new FileReader();
			reader.onload = async () => {
				let raw = null;
				try {
					raw = JSON.parse(reader.result);
				} catch {}
				if (!raw || raw.format !== "deepseek-stat-export") return alert("导入失败：文件格式不正确");
				const res = normalizeImportData(raw);
				if (res.error) return alert("导入失败：" + res.error);
				if (!confirm("合并导入：历史按记录去重，钱包与设置一并合并，本机 WebDAV 配置保留。\n确定导入？取消则不导入。")) return;
				try {
					await applyImportedData(res.data);
					alert("已合并导入");
				} catch (error) {
					alert("导入失败：" + (error?.message || error));
				}
			};
			reader.readAsText(file, "utf-8");
		});
		inputEl = el;
	}
	inputEl.click();
}
//#endregion
//#region src/ui/compare.ts
var selOld = null;
var selNew = null;
function getDoc$12() {
	return window.parent?.document ?? document;
}
function diffMessages(oldMsgs, newMsgs) {
	const toText = (m) => `${m.role || ""}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`;
	const a = (oldMsgs || []).map(toText).join("\n");
	const b = (newMsgs || []).map(toText).join("\n");
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i++;
	if (i === a.length && i === b.length) return "<span style=\"color:var(--ds-text-2);\">两条请求完全一致（缓存命中段完整）</span>";
	const ctx = 80;
	return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;font-size:var(--aus-fs-sm);white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">旧：${esc(a.slice(Math.max(0, i - ctx), i)) + "<span style=\"background:var(--ds-red-bg);color:var(--ds-red);padding:0 2px;border-radius:3px;\">" + esc(a.slice(i, i + 200)) + "</span>" + esc(a.slice(i + 200, i + 280))}</div><div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;font-size:var(--aus-fs-sm);white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">新：${esc(b.slice(Math.max(0, i - ctx), i)) + "<span style=\"background:var(--ds-green-bg);color:var(--ds-green);padding:0 2px;border-radius:3px;\">" + esc(b.slice(i, i + 200)) + "</span>" + esc(b.slice(i + 200, i + 280))}</div></div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:8px;">差异起点即缓存发散位置，前 ${i} 字符一致为命中段</div>`;
}
function bindHistoryCompare() {
	const doc = getDoc$12();
	doc.addEventListener("click", (e) => {
		const t = e.target;
		if (!t) return;
		if (t.classList.contains("aus-compare-old") || t.classList.contains("aus-compare-new")) {
			const ts = parseInt(t.getAttribute("data-ts") || "0");
			if (t.classList.contains("aus-compare-old")) selOld = ts;
			else selNew = ts;
			renderDiff();
		}
		if (t.id === "aus-diff-fullscreen") {
			const m = doc.getElementById("aus-diff");
			if (m) m.classList.toggle("aus-diff-full");
		}
	});
}
function renderDiff() {
	const host = getDoc$12().getElementById("aus-diff");
	if (!host) return;
	if (selOld == null || selNew == null) {
		host.innerHTML = "<div style=\"text-align:center;padding:16px;color:var(--ds-text-3);font-size:var(--aus-fs-base);\">已选 " + (selOld != null ? "旧 " : "") + (selNew != null ? "新 " : "") + "，请在历史中各选一条 旧/新 进行对比</div>";
		return;
	}
	const s = getSelectedSave();
	const oldEntry = (s?.history || []).find((h) => h.timestamp === selOld);
	const newEntry = (s?.history || []).find((h) => h.timestamp === selNew);
	if (!oldEntry || !newEntry) {
		host.innerHTML = "<div style=\"color:var(--ds-red);font-size:var(--aus-fs-base);\">未找到对应记录</div>";
		return;
	}
	host.innerHTML = diffMessages(oldEntry.messages || [], newEntry.messages || []);
}
function clamp01$1(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
function average(values) {
	if (!values.length) return 0;
	let sum = 0;
	for (const value of values) sum += value;
	return sum / values.length;
}
function standardDeviation(values) {
	if (values.length <= 1) return 0;
	const mean = average(values);
	let sum = 0;
	for (const value of values) sum += (value - mean) ** 2;
	return Math.sqrt(sum / values.length);
}
function median(values) {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function quantile(values, q) {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	if (sorted.length === 1) return sorted[0];
	const pos = (sorted.length - 1) * q;
	const base = Math.floor(pos);
	const rest = pos - base;
	const next = sorted[Math.min(sorted.length - 1, base + 1)];
	return sorted[base] + rest * (next - sorted[base]);
}
function medianAbsoluteDeviation(values) {
	if (!values.length) return 0;
	const med = median(values);
	return median(values.map((value) => Math.abs(value - med)));
}
/**
* 数据准备：按时间升序、过滤空 prompt、计算命中率与截断标记。
* 无缓存字段时 hit=0、miss=prompt，仅用于堆叠图展示，不伪造命中率。
*/
function prepareEntries(history) {
	const sorted = [...history || []].sort((a, b) => (Number(a?.timestamp) || 0) - (Number(b?.timestamp) || 0));
	const prepared = [];
	for (const entry of sorted) {
		const rawHit = Math.max(0, Number(entry?.cache_hit_tokens) || 0);
		const rawMiss = Math.max(0, Number(entry?.cache_miss_tokens) || 0);
		const cacheSamples = rawHit + rawMiss;
		const prompt = Math.max(0, Number(entry?.prompt_tokens) || cacheSamples);
		if (prompt <= 0) continue;
		const output = Math.max(0, Number(entry?.completion_tokens) || 0);
		const hitRate = cacheSamples > 0 ? clamp01$1(rawHit / cacheSamples) : null;
		prepared.push({
			index: prepared.length,
			timestamp: Number(entry?.timestamp) || 0,
			model: entry?.model || "unknown",
			prompt,
			hit: cacheSamples > 0 ? rawHit : 0,
			miss: cacheSamples > 0 ? rawMiss : prompt,
			output,
			total: Math.max(0, Number(entry?.total_tokens) || prompt + output),
			cost: Number(entry?.cost) || 0,
			inputCost: Number(entry?.input_cost) || 0,
			outputCost: Number(entry?.output_cost) || 0,
			hitRate,
			cacheSamples,
			truncated: entry?.isTruncated === true || isTruncatedFinish(entry?.finishReason),
			round: prepared.length + 1
		});
	}
	return prepared;
}
/**
* 识别上下文回落点。连续回落只记录第一次，避免一次压缩被拆成多个点。
*/
function detectCompactions(prepared) {
	const points = [];
	let lastRound = 0;
	for (let i = 1; i < prepared.length; i++) {
		if (points.length && points[points.length - 1].index === i - 1) continue;
		const previous = prepared[i - 1];
		const current = prepared[i];
		const drop = previous.prompt - current.prompt;
		if (previous.prompt <= 0) continue;
		if (current.prompt / previous.prompt > .8) continue;
		if (drop < 1500) continue;
		const gapRounds = lastRound ? current.round - lastRound : current.round;
		points.push({
			index: i,
			round: current.round,
			before: previous.prompt,
			after: current.prompt,
			dropPct: drop / previous.prompt,
			gapRounds,
			postHitRate: current.hitRate
		});
		lastRound = current.round;
	}
	return points;
}
function regression(xs, ys) {
	const n = xs.length;
	let sx = 0;
	let sy = 0;
	let sxx = 0;
	let sxy = 0;
	for (let i = 0; i < n; i += 1) {
		sx += xs[i];
		sy += ys[i];
		sxx += xs[i] * xs[i];
		sxy += xs[i] * ys[i];
	}
	const xMean = n ? sx / n : 0;
	const yMean = n ? sy / n : 0;
	const centeredXX = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
	const denominator = centeredXX;
	const slope = denominator > 1e-9 ? xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0) / denominator : 0;
	const intercept = yMean - slope * xMean;
	let rss = 0;
	let tss = 0;
	for (let i = 0; i < n; i += 1) {
		const predicted = intercept + slope * xs[i];
		rss += (ys[i] - predicted) ** 2;
		tss += (ys[i] - yMean) ** 2;
	}
	const variance = n > 2 ? rss / (n - 2) : 0;
	const sigma = Math.sqrt(Math.max(0, variance));
	return {
		slope,
		intercept,
		r2: tss > 1e-9 ? 1 - rss / tss : 1,
		sigma,
		xMean,
		sxx: centeredXX
	};
}
function averageIntervalMs$1(prepared) {
	if (prepared.length < 2) return 0;
	const recent = prepared.slice(-21);
	const diffs = [];
	for (let i = 1; i < recent.length; i += 1) {
		const diff = recent[i].timestamp - recent[i - 1].timestamp;
		if (diff > 0) diffs.push(diff);
	}
	return diffs.length ? average(diffs) : 0;
}
/**
* 对最后一个压缩点之后的当前段做增长拟合。
* 样本 >= 12 时先用中位绝对偏差剔除离群点，再回归。
*/
function computeGrowthFit(prepared, compactions) {
	const segStart = compactions.length ? compactions[compactions.length - 1].index : 0;
	const segment = prepared.slice(segStart);
	const n = segment.length;
	const interval = averageIntervalMs$1(prepared);
	if (!n) return {
		model: "recent-mean",
		c0: 0,
		delta: 0,
		sigma: 0,
		r2: 0,
		n: 0,
		segStart,
		lastPrompt: 0,
		avgIntervalMs: interval,
		xMean: 0,
		sxx: 0
	};
	const y = segment.map((entry) => entry.prompt);
	const lastPrompt = y[n - 1];
	if (n === 1) return {
		model: "recent-mean",
		c0: lastPrompt,
		delta: 0,
		sigma: Math.max(1, lastPrompt * .01),
		r2: 0,
		n,
		segStart,
		lastPrompt,
		avgIntervalMs: interval,
		xMean: 0,
		sxx: 0
	};
	if (n === 2) {
		const delta = Math.max(0, y[1] - y[0]);
		return {
			model: "linear",
			c0: y[0],
			delta,
			sigma: Math.max(1, standardDeviation(y), lastPrompt * .01),
			r2: 0,
			n,
			segStart,
			lastPrompt,
			avgIntervalMs: interval,
			xMean: .5,
			sxx: .5
		};
	}
	let xs = y.map((_, index) => index);
	let ys = y.slice();
	if (n >= 12) {
		const med = median(y);
		const mad = medianAbsoluteDeviation(y) * 1.4826;
		if (mad > 0) {
			const filtered = y.map((value, index) => ({
				value,
				index
			})).filter((point) => Math.abs(point.value - med) <= 3 * mad);
			if (filtered.length >= 6) {
				xs = filtered.map((point) => point.index);
				ys = filtered.map((point) => point.value);
			}
		}
	}
	const fit = regression(xs, ys);
	const sigmaFloor = Math.max(1, lastPrompt * .01);
	const sigma = Math.max(fit.sigma, sigmaFloor);
	if (fit.r2 < .35 && n >= 6) {
		const recent = y.slice(-Math.min(5, n));
		return {
			model: "recent-mean",
			c0: median(recent),
			delta: 0,
			sigma: Math.max(standardDeviation(recent), sigmaFloor),
			r2: fit.r2,
			n,
			segStart,
			lastPrompt,
			avgIntervalMs: interval,
			xMean: 0,
			sxx: 0
		};
	}
	return {
		model: "linear",
		c0: Math.max(0, fit.intercept),
		delta: Math.max(0, fit.slope),
		sigma,
		r2: fit.r2,
		n,
		segStart,
		lastPrompt,
		avgIntervalMs: interval,
		xMean: fit.xMean,
		sxx: fit.sxx
	};
}
/** 当前段内第 offset 轮的拟合 prompt（offset 从当前段起点算） */
function promptAt(fit, offset) {
	if (fit.model === "recent-mean") return Math.max(0, fit.c0);
	return Math.max(0, fit.c0 + fit.delta * offset);
}
/** 95% 预测区间半宽 */
function predictionBand(fit, offset) {
	if (fit.n <= 0) return 0;
	const base = fit.sigma * Math.sqrt(1 + 1 / fit.n);
	if (fit.model === "recent-mean" || fit.sxx <= 1e-9) return 1.96 * base;
	const distance = offset - fit.xMean;
	const factor = Math.sqrt(1 + 1 / fit.n + distance * distance / fit.sxx);
	return 1.96 * fit.sigma * factor;
}
/** 全量历史的有效缓存命中率（hit / (hit + miss)） */
function computeGlobalHitRate$1(history) {
	let hit = 0;
	let samples = 0;
	for (const entry of history || []) {
		const h = Math.max(0, Number(entry?.cache_hit_tokens) || 0);
		const m = Math.max(0, Number(entry?.cache_miss_tokens) || 0);
		if (h + m <= 0) continue;
		hit += h;
		samples += h + m;
	}
	return samples > 0 ? clamp01$1(hit / samples) : null;
}
/** 指定模型的有效缓存命中率 */
function computeModelHitRate$1(history, model) {
	let hit = 0;
	let samples = 0;
	for (const entry of history || []) {
		if ((entry?.model || "") !== model) continue;
		const h = Math.max(0, Number(entry?.cache_hit_tokens) || 0);
		const m = Math.max(0, Number(entry?.cache_miss_tokens) || 0);
		if (h + m <= 0) continue;
		hit += h;
		samples += h + m;
	}
	return samples > 0 ? clamp01$1(hit / samples) : null;
}
function pickWeightedHitRate(entries) {
	const recent = entries.slice(-10);
	let hit = 0;
	let samples = 0;
	for (const entry of recent) {
		if (entry.hitRate == null || entry.cacheSamples <= 0) continue;
		hit += entry.hit;
		samples += entry.cacheSamples;
	}
	return samples > 0 ? {
		rate: clamp01$1(hit / samples),
		samples
	} : null;
}
/**
* 命中率测算：
* 1. 当前段有有效样本 → token 加权（最近 10 个有效样本）；
* 2. 当前段无、但对话更早有样本 → 用对话最近的有效样本；
* 3. 完全没有样本 → 按选项回退（全站/同模型/手动），都没有则为 0。
*/
function computeHitEstimate(prepared, compactions, fallback) {
	const segStart = compactions.length ? compactions[compactions.length - 1].index : 0;
	const segmentData = prepared.slice(segStart).filter((entry) => entry.hitRate != null && entry.cacheSamples > 0);
	const allData = prepared.filter((entry) => entry.hitRate != null && entry.cacheSamples > 0);
	const segmentPick = pickWeightedHitRate(segmentData);
	if (segmentPick) return {
		rate: segmentPick.rate,
		source: "data",
		samples: segmentPick.samples,
		segmentSamples: segmentData.length,
		hasData: true
	};
	const allPick = pickWeightedHitRate(allData);
	if (allPick) return {
		rate: allPick.rate,
		source: "data",
		samples: allPick.samples,
		segmentSamples: 0,
		hasData: true
	};
	if (fallback.mode === "manual" && fallback.manualRate != null) return {
		rate: clamp01$1(fallback.manualRate),
		source: "manual",
		samples: 0,
		segmentSamples: 0,
		hasData: false
	};
	if (fallback.mode === "model" && fallback.modelRate != null) return {
		rate: clamp01$1(fallback.modelRate),
		source: "model",
		samples: 0,
		segmentSamples: 0,
		hasData: false
	};
	if (fallback.globalRate != null) return {
		rate: clamp01$1(fallback.globalRate),
		source: "global",
		samples: 0,
		segmentSamples: 0,
		hasData: false
	};
	return {
		rate: 0,
		source: "none",
		samples: 0,
		segmentSamples: 0,
		hasData: false
	};
}
/** 输出 token 估计：当前段非截断样本的中位数，MAD 作为波动半宽 */
function computeOutputEstimate(prepared, compactions) {
	const segStart = compactions.length ? compactions[compactions.length - 1].index : 0;
	const segment = prepared.slice(segStart);
	const excluded = prepared.filter((entry) => entry.truncated).length;
	const segmentCandidates = segment.filter((entry) => !entry.truncated && entry.output > 0);
	const allCandidates = prepared.filter((entry) => !entry.truncated && entry.output > 0);
	const list = (segmentCandidates.length ? segmentCandidates : allCandidates).slice(-10);
	if (!list.length) return {
		value: 0,
		low: 0,
		high: 0,
		samples: 0,
		excluded
	};
	const values = list.map((entry) => entry.output);
	const med = median(values);
	const mad = medianAbsoluteDeviation(values) * 1.4826;
	const spread = mad > 0 ? mad : Math.max(0, quantile(values, .75) - quantile(values, .25)) / 2;
	return {
		value: med,
		low: Math.max(0, med - spread),
		high: med + spread,
		samples: values.length,
		excluded
	};
}
/**
* 压缩预测：用最近一次压缩的“压缩前段长度”作为周期。
* 即使只有一次压缩，也能给出下次压缩的估计。
*/
function computeCompactionForecast(prepared, compactions) {
	if (!compactions.length) return {
		detected: false,
		count: 0,
		lastRound: null,
		period: null,
		retention: null,
		postHitRate: null,
		segmentAge: prepared.length,
		roundsUntilNext: null,
		nextRound: null,
		medianGap: null
	};
	const last = compactions[compactions.length - 1];
	const currentRound = prepared.length;
	const period = last.gapRounds > 0 ? last.gapRounds : null;
	const segmentAge = Math.max(0, currentRound - last.round);
	const roundsUntilNext = period != null ? Math.max(1, period - segmentAge) : null;
	const retention = last.before > 0 ? Math.max(.05, Math.min(.95, last.after / last.before)) : null;
	const medianGap = compactions.length >= 2 ? median(compactions.map((point) => point.gapRounds)) : null;
	return {
		detected: true,
		count: compactions.length,
		lastRound: last.round,
		period,
		retention,
		postHitRate: last.postHitRate,
		segmentAge,
		roundsUntilNext,
		nextRound: roundsUntilNext != null ? currentRound + roundsUntilNext : null,
		medianGap
	};
}
function buildHistoryPoints(prepared, compactions) {
	const compactionRounds = new Set(compactions.map((point) => point.round));
	let cumulative = 0;
	return prepared.map((entry) => {
		cumulative += entry.cost;
		return {
			round: entry.round,
			timestamp: entry.timestamp,
			input: entry.prompt,
			hit: entry.hit,
			miss: entry.miss,
			output: entry.output,
			cost: entry.cost,
			cumulativeCost: cumulative,
			hitRate: entry.hitRate,
			compaction: compactionRounds.has(entry.round)
		};
	});
}
function projectRounds(prepared, fit, hit, output, pricing, ctxLimit, compactionForecast, compactionEnabled, maxRounds) {
	const out = [];
	const currentRound = prepared.length;
	let cumulative = prepared.reduce((sum, entry) => sum + entry.cost, 0);
	let factor = 1;
	let currentHit = hit.rate;
	const retention = compactionForecast.retention ?? .5;
	let nextCompactionRound = compactionEnabled && compactionForecast.detected ? compactionForecast.nextRound : null;
	for (let k = 0; k < maxRounds; k += 1) {
		const round = currentRound + k + 1;
		const offset = fit.n + k;
		const base = promptAt(fit, offset);
		const baseBand = predictionBand(fit, offset);
		let input = base * factor;
		let overLimit = ctxLimit != null && input > ctxLimit;
		let isCompaction = false;
		if (compactionEnabled && nextCompactionRound != null && round >= nextCompactionRound) {
			isCompaction = true;
			factor *= retention;
			input = base * factor;
			currentHit = compactionForecast.postHitRate ?? hit.rate;
			nextCompactionRound = compactionForecast.period != null ? round + compactionForecast.period : null;
		} else if (compactionEnabled && compactionForecast.postHitRate != null && currentHit < hit.rate) currentHit = Math.min(hit.rate, currentHit + (hit.rate - currentHit) * .35);
		const hitRate = clamp01$1(currentHit);
		const hitTokens = input * hitRate;
		const missTokens = input * (1 - hitRate);
		let cost = null;
		let costLow = null;
		let costHigh = null;
		if (pricing) {
			const costAt = (rate) => (input * rate * pricing.hit + input * (1 - rate) * pricing.miss + output.value * pricing.output) / 1e6;
			cost = costAt(hitRate);
			const low = costAt(clamp01$1(hitRate + .1));
			const high = costAt(clamp01$1(hitRate - .1));
			costLow = Math.min(low, high);
			costHigh = Math.max(low, high);
			cumulative += cost;
		}
		const band = baseBand * factor;
		out.push({
			round,
			input,
			inputLow: Math.max(0, input - band),
			inputHigh: input + band,
			hit: hitTokens,
			miss: missTokens,
			output: output.value,
			hitRate,
			cost,
			costLow,
			costHigh,
			cumulativeCost: pricing ? cumulative : null,
			compaction: isCompaction,
			overLimit
		});
		if (overLimit) break;
	}
	return out;
}
/**
* 构建完整预测序列。历史点完整保留，未来点按 horizon 生成。
* 无任何有效历史时返回 null。
*/
function buildForecastSeries(history, options) {
	const prepared = prepareEntries(history);
	if (!prepared.length) return null;
	const compactions = detectCompactions(prepared);
	const fit = computeGrowthFit(prepared, compactions);
	const hit = computeHitEstimate(prepared, compactions, options.hitFallback);
	const output = computeOutputEstimate(prepared, compactions);
	const compactionForecast = computeCompactionForecast(prepared, compactions);
	const historyPoints = buildHistoryPoints(prepared, compactions);
	const horizon = Math.max(1, Math.floor(options.horizon) || 10);
	const future = projectRounds(prepared, fit, hit, output, options.pricing, options.ctxLimit, compactionForecast, options.compaction, horizon);
	const first = future[0];
	const last = prepared[prepared.length - 1];
	const totalCost = prepared.reduce((sum, entry) => sum + entry.cost, 0);
	const next = first ? {
		input: first.input,
		inputLow: first.inputLow,
		inputHigh: first.inputHigh,
		output: first.output,
		hitRate: first.hitRate,
		cost: first.cost,
		costLow: first.costLow,
		costHigh: first.costHigh
	} : {
		input: promptAt(fit, fit.n),
		inputLow: promptAt(fit, fit.n),
		inputHigh: promptAt(fit, fit.n),
		output: output.value,
		hitRate: hit.rate,
		cost: null,
		costLow: null,
		costHigh: null
	};
	return {
		prepared,
		history: historyPoints,
		future,
		compactions,
		fit,
		hit,
		output,
		compactionForecast,
		currentRound: prepared.length,
		currentPrompt: last?.prompt || 0,
		totalCost,
		averageCost: prepared.length ? totalCost / prepared.length : 0,
		next
	};
}
/**
* 逐轮模拟余额可支撑轮数。与图表共用 projectRounds，保证口径一致。
* 返回 null 表示无法估算（价格未知）。
*/
function simulateRemainingRounds(budget, series, options, maxRounds = 1e4) {
	if (!options.pricing) return null;
	if (!Number.isFinite(budget) || budget <= 0) return {
		R: 0,
		low: 0,
		high: 0,
		ctxLimited: false
	};
	const run = (deltaScale, hitDelta) => {
		const fit = {
			...series.fit,
			delta: series.fit.delta * deltaScale
		};
		const hit = {
			...series.hit,
			rate: clamp01$1(series.hit.rate + hitDelta)
		};
		const points = projectRounds(series.prepared, fit, hit, series.output, options.pricing, options.ctxLimit, series.compactionForecast, options.compaction, maxRounds);
		let spent = 0;
		let rounds = 0;
		let ctxLimited = false;
		for (const point of points) {
			if (point.overLimit) {
				ctxLimited = true;
				break;
			}
			if (point.cost == null) break;
			if (spent + point.cost > budget) break;
			spent += point.cost;
			rounds += 1;
		}
		return {
			R: rounds,
			ctxLimited
		};
	};
	const base = run(1, 0);
	const optimistic = run(.5, .05);
	const pessimistic = run(1.5, -.05);
	return {
		R: base.R,
		low: Math.min(base.R, pessimistic.R),
		high: Math.max(base.R, optimistic.R),
		ctxLimited: base.ctxLimited
	};
}
/**
* 上下文可支撑轮数。
* - 未启用压缩预测：按当前段 Δ 线性外推；
* - 启用且检测到压缩：返回 null，由“距下次压缩”表达（压缩会主动回落）。
*/
function contextRoundsFor(series, ctxLimit, compactionEnabled) {
	if (!ctxLimit) return null;
	if (compactionEnabled && series.compactionForecast.detected) return null;
	if (series.fit.delta <= 0) return null;
	const remain = ctxLimit - series.currentPrompt;
	return remain <= 0 ? 0 : Math.max(0, Math.floor(remain / series.fit.delta));
}
//#endregion
//#region src/stats/model-efficiency.ts
/**
* 模型效率/性价比聚合 — 纯函数。
*
* 输入输出比只说明“单位产出的上下文开销”，不能单独代表便宜；
* 每 1k 输出 token 成本才是产出成本的直接度量。两者并列展示。
*/
function clamp01(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
function compareNullableAsc(a, b) {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return a - b;
}
/**
* 按模型聚合效率指标，默认按每 1k 输出成本升序（无价排最后）。
*/
function aggregateModelEfficiency(history, options = {}) {
	const prepared = prepareEntries(history);
	const map = /* @__PURE__ */ new Map();
	for (const entry of prepared) {
		const model = entry.model || "unknown";
		let acc = map.get(model);
		if (!acc) {
			acc = {
				model,
				rounds: 0,
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				cost: 0,
				inputCost: 0,
				outputCost: 0,
				hit: 0,
				hitSamples: 0
			};
			map.set(model, acc);
		}
		acc.rounds += 1;
		acc.inputTokens += entry.prompt;
		acc.outputTokens += entry.output;
		acc.totalTokens += entry.total;
		acc.cost += entry.cost;
		acc.inputCost += entry.inputCost;
		acc.outputCost += entry.outputCost;
		if (entry.cacheSamples > 0) {
			acc.hit += entry.hit;
			acc.hitSamples += entry.cacheSamples;
		}
	}
	const rows = [];
	for (const acc of map.values()) {
		const price = options.priceForModel ? options.priceForModel(acc.model) : null;
		const priced = acc.cost > 0 || acc.inputCost > 0 || acc.outputCost > 0;
		const ioRatio = acc.outputTokens > 0 ? acc.inputTokens / acc.outputTokens : null;
		const outputShare = acc.totalTokens > 0 ? acc.outputTokens / acc.totalTokens : 0;
		const costPer1kOutput = priced && acc.outputTokens > 0 ? acc.cost / acc.outputTokens * 1e3 : null;
		const avgCost = priced && acc.rounds > 0 ? acc.cost / acc.rounds : null;
		const hitRate = acc.hitSamples > 0 ? clamp01(acc.hit / acc.hitSamples) : null;
		let cacheSaving = null;
		if (price && price.miss > 0 && acc.inputTokens > 0 && (acc.cost > 0 || acc.inputCost > 0)) {
			const expected = acc.inputTokens * price.miss / 1e6;
			if (expected > 0) cacheSaving = clamp01(1 - acc.inputCost / expected);
		}
		rows.push({
			model: acc.model,
			rounds: acc.rounds,
			inputTokens: acc.inputTokens,
			outputTokens: acc.outputTokens,
			totalTokens: acc.totalTokens,
			cost: acc.cost,
			inputCost: acc.inputCost,
			outputCost: acc.outputCost,
			ioRatio,
			outputShare,
			costPer1kOutput,
			avgCost,
			hitRate,
			cacheSaving,
			priced
		});
	}
	rows.sort((a, b) => {
		const byCost = compareNullableAsc(a.costPer1kOutput, b.costPer1kOutput);
		if (byCost !== 0) return byCost;
		const byRatio = compareNullableAsc(a.ioRatio, b.ioRatio);
		if (byRatio !== 0) return byRatio;
		return a.model.localeCompare(b.model);
	});
	return rows;
}
//#endregion
//#region src/data/computed.ts
/**
* 统一计算层 — 所有展示/统计的唯一来源
* 禁止在 UI 中直接对 history 做过滤/求和，所有派生在此定义
*/
var STATS_FILTER_ALL = "__all__";
var STATS_FILTER_UNKNOWN = "__unknown__";
function numberValue(value) {
	const n = typeof value === "number" ? value : parseFloat(String(value));
	return Number.isFinite(n) ? n : 0;
}
function averagePositive(values) {
	const valid = values.filter((value) => Number.isFinite(value) && value > 0);
	if (!valid.length) return 0;
	return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}
function filterStatsHistory(entries, filter = {}) {
	return (entries || []).filter((entry) => {
		if (!entry) return false;
		if (filter.start || filter.end) {
			const day = localDay(entry.timestamp);
			if (filter.start && day < filter.start) return false;
			if (filter.end && day > filter.end) return false;
		}
		if (filter.model && filter.model !== "__all__") {
			const models = Array.isArray(filter.model) ? filter.model : [filter.model];
			if (!models.length || !models.includes(entry.model)) return false;
		}
		if (filter.chat && filter.chat !== "__all__") {
			if (filter.chat === "__null__") {
				if (entry.chatId) return false;
			} else if ((entry.chatId ?? null) !== filter.chat) return false;
		}
		if (filter.endpoint && filter.endpoint !== "__all__") {
			if (filter.endpoint === "__unknown__") {
				if (entry.endpointId) return false;
			} else if (entry.endpointId !== filter.endpoint) return false;
		}
		if (filter.credential && filter.credential !== "__all__") {
			if (filter.credential === "__unknown__") {
				if (entry.credentialId) return false;
			} else if (entry.credentialId !== filter.credential) return false;
		}
		return true;
	});
}
function addLabelCollisionSuffix(options) {
	const counts = /* @__PURE__ */ new Map();
	for (const option of options) counts.set(option.label, (counts.get(option.label) || 0) + 1);
	return options.map((option) => {
		if (option.unknown || (counts.get(option.label) || 0) < 2) return option;
		return {
			...option,
			label: `${option.label} · ${option.id.slice(0, 4)}`
		};
	});
}
function getEndpointFilterOptions(history) {
	const map = /* @__PURE__ */ new Map();
	for (const entry of history || []) {
		const unknown = !entry?.endpointId;
		const id = unknown ? STATS_FILTER_UNKNOWN : entry.endpointId;
		const timestamp = Number(entry?.timestamp) || 0;
		const label = unknown ? "未记录接入" : entry.endpointLabel || `接入 ${String(id).slice(0, 6)}`;
		const current = map.get(id);
		if (!current) map.set(id, {
			id,
			label,
			count: 1,
			unknown,
			lastSeen: timestamp
		});
		else {
			current.count++;
			if (timestamp >= current.lastSeen && label) {
				current.label = label;
				current.lastSeen = timestamp;
			}
		}
	}
	const options = Array.from(map.values()).map(({ id, label, count, unknown }) => ({
		id,
		label,
		count,
		unknown
	}));
	options.sort((a, b) => Number(!!a.unknown) - Number(!!b.unknown) || a.label.localeCompare(b.label, "zh-CN"));
	return addLabelCollisionSuffix(options);
}
function getCredentialFilterOptions(history, endpoint = STATS_FILTER_ALL) {
	const map = /* @__PURE__ */ new Map();
	for (const entry of history || []) {
		if (endpoint === "__unknown__") {
			if (entry?.endpointId) continue;
		} else if (endpoint !== "__all__" && entry?.endpointId !== endpoint) continue;
		const unknown = !entry?.credentialId;
		const id = unknown ? STATS_FILTER_UNKNOWN : entry.credentialId;
		const timestamp = Number(entry?.timestamp) || 0;
		const label = unknown ? "未识别密钥" : entry.credentialLabel || `密钥 ${String(id).slice(0, 6)}`;
		const current = map.get(id);
		if (!current) map.set(id, {
			id,
			label,
			count: 1,
			unknown,
			lastSeen: timestamp
		});
		else {
			current.count++;
			if (timestamp >= current.lastSeen && label) {
				current.label = label;
				current.lastSeen = timestamp;
			}
		}
	}
	return addLabelCollisionSuffix(Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen || a.label.localeCompare(b.label, "zh-CN")).map(({ id, label, count, unknown }) => ({
		id,
		label,
		count,
		unknown
	})));
}
function computeOverview(balanceWalletId = "all", historyOverride) {
	const s = getSelectedSave();
	if (!s) return {
		balanceText: "¥0.00 CNY",
		hasBalance: false,
		walletBalanceCount: 0,
		totalCost: 0,
		totalTokens: 0,
		hit: 0,
		miss: 0,
		output: 0,
		hitRate: 0,
		savings: 0,
		inputCost: 0,
		outputCost: 0,
		avgCost: 0,
		avgTokens: 0,
		avgDuration: 0,
		avgRate: 0,
		avgTtft: 0,
		rounds: 0,
		remainingRounds: null,
		avgInputCost: 0,
		avgInputTokens: 0,
		avgOutputCost: 0,
		avgOutputTokens: 0,
		avgThinkTime: 0,
		avgThinkTokens: 0,
		avgHitRate: 0,
		latestHitRate: null,
		maxOutput: 0,
		maxInput: 0,
		maxTotal: 0,
		avgThinkRatio: 0,
		truncationRate: 0
	};
	const totalCost = s.total_cost || 0;
	const totalTokens = s.total_tokens || 0;
	const hist = historyOverride || s.history || [];
	let viewTotalCost = totalCost;
	let viewTotalTokens = totalTokens;
	let viewInputCost = s.input_cost || 0;
	let viewOutputCost = s.output_cost || 0;
	let viewHit = s.cache_hit_tokens || 0;
	let viewMiss = s.cache_miss_tokens || 0;
	let viewOutput = s.output_tokens || 0;
	let viewRounds = s.rounds || 0;
	if (historyOverride) {
		viewTotalCost = 0;
		viewTotalTokens = 0;
		viewInputCost = 0;
		viewOutputCost = 0;
		viewHit = 0;
		viewMiss = 0;
		viewOutput = 0;
		viewRounds = hist.length;
		for (const h of hist) {
			viewTotalCost += Number(h.cost) || 0;
			viewTotalTokens += Number(h.total_tokens) || 0;
			viewInputCost += Number(h.input_cost) || 0;
			viewOutputCost += Number(h.output_cost) || 0;
			viewHit += Number(h.cache_hit_tokens) || 0;
			viewMiss += Number(h.cache_miss_tokens) || 0;
			viewOutput += Number(h.completion_tokens) || 0;
		}
	}
	const hitRate = viewHit + viewMiss > 0 ? viewHit / (viewHit + viewMiss) * 100 : 0;
	let savings = 0;
	try {
		for (const h of hist) savings += calcSavings({
			timestamp: h.timestamp,
			model: h.model,
			prompt_cache_hit_tokens: h.cache_hit_tokens || 0,
			prompt_cache_miss_tokens: h.cache_miss_tokens || 0,
			completion_tokens: h.completion_tokens || 0
		}, state$2.settings, findWalletForHistory(state$2.wallets, h));
	} catch {}
	const rounds = viewRounds;
	const avgCost = averagePositive(hist.map((h) => numberValue(h.cost)));
	const avgTokens = averagePositive(hist.map((h) => numberValue(h.total_tokens)));
	const avgDuration = averagePositive(hist.map((h) => numberValue(h.duration))) / 1e3;
	const avgRate = averagePositive(hist.map((h) => numberValue(h.tokenRate)));
	const avgTtft = averagePositive(hist.map((h) => numberValue(h.ttft))) / 1e3;
	const avgInputCost = averagePositive(hist.map((h) => numberValue(h.input_cost)));
	const avgInputTokens = averagePositive(hist.map((h) => numberValue(h.cache_hit_tokens) + numberValue(h.cache_miss_tokens)));
	const avgOutputCost = averagePositive(hist.map((h) => numberValue(h.output_cost)));
	const avgOutputTokens = averagePositive(hist.map((h) => numberValue(h.completion_tokens)));
	const thinkTimes = hist.map((h) => h.thinkTime || 0).filter((v) => v > 0);
	const thinkTokensArr = hist.map((h) => h.thinkTokens || 0).filter((v) => v > 0);
	const avgThinkTime = thinkTimes.length ? thinkTimes.reduce((a, b) => a + b, 0) / thinkTimes.length / 1e3 : 0;
	const avgThinkTokens = thinkTokensArr.length ? thinkTokensArr.reduce((a, b) => a + b, 0) / thinkTokensArr.length : 0;
	const hitRates = hist.map((h) => {
		const ch = h.cache_hit_tokens || 0, tot = ch + (h.cache_miss_tokens || 0);
		return tot > 0 ? ch / tot * 100 : 0;
	}).filter((v) => v > 0);
	const avgHitRate = hitRates.length ? hitRates.reduce((a, b) => a + b, 0) / hitRates.length : 0;
	let latestHitRate = null;
	if (hist.length) {
		const latest = [...hist].sort((a, b) => b.timestamp - a.timestamp)[0];
		const ch = latest.cache_hit_tokens || 0, tot = ch + (latest.cache_miss_tokens || 0);
		latestHitRate = tot > 0 ? ch / tot * 100 : 0;
	}
	let maxOutput = 0, maxInput = 0, maxTotal = 0;
	for (const h of hist) {
		const out = h.completion_tokens || 0;
		const inp = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) || h.prompt_tokens || 0;
		const tot = h.total_tokens || 0;
		if (out > maxOutput) maxOutput = out;
		if (inp > maxInput) maxInput = inp;
		if (tot > maxTotal) maxTotal = tot;
	}
	let sumThink = 0, sumOut = 0;
	for (const h of hist) {
		sumThink += h.thinkTokens || 0;
		sumOut += h.completion_tokens || 0;
	}
	const avgThinkRatio = sumOut > 0 ? sumThink / sumOut * 100 : 0;
	const truncCnt = hist.filter((h) => isTruncatedFinish(h.finishReason) || h.isTruncated).length;
	const truncationRate = hist.length ? truncCnt / hist.length * 100 : 0;
	const ignored = new Set(state$2.walletIgnored || []);
	const activeWallets = (state$2.wallets || []).filter((wallet) => !ignored.has(wallet.id));
	const selectedWallet = balanceWalletId !== "all" ? activeWallets.find((wallet) => wallet.id === balanceWalletId) || null : null;
	const balanceWallets = selectedWallet ? [selectedWallet] : activeWallets;
	let balanceCny = null;
	let walletBalanceCount = 0;
	for (const wallet of balanceWallets) {
		const value = walletBalanceToCny(wallet, getWalletExchangeRate());
		if (value == null) continue;
		walletBalanceCount++;
		balanceCny = (balanceCny ?? 0) + value;
	}
	if (balanceCny == null && !selectedWallet) {
		const legacy = state$2.customBalance || state$2.balance?.balance;
		const value = legacy != null && legacy !== "" ? parseFloat(String(legacy)) : NaN;
		if (Number.isFinite(value)) {
			balanceCny = value;
			walletBalanceCount = 1;
		}
	}
	let remainingRounds = null;
	try {
		const balNum = balanceCny == null ? NaN : balanceCny;
		if (!isNaN(balNum) && hist.length) {
			const scopedHist = hist.filter((h) => !selectedWallet || h.walletId === selectedWallet.id);
			if (scopedHist.length) {
				const alpha = .3;
				let ewma = scopedHist[scopedHist.length - 1].cost || 0;
				for (let i = scopedHist.length - 2; i >= 0; i--) ewma = alpha * (scopedHist[i].cost || 0) + .7 * ewma;
				if (ewma > 0) remainingRounds = Math.floor(balNum / ewma);
			}
		}
	} catch {}
	return {
		balanceText: (() => {
			try {
				return formatMoney(balanceCny == null ? 0 : balanceCny, 2);
			} catch {
				return "¥" + (balanceCny || 0).toFixed(2) + " CNY";
			}
		})(),
		hasBalance: balanceCny != null,
		walletBalanceCount,
		totalCost: viewTotalCost,
		totalTokens: viewTotalTokens,
		hit: viewHit,
		miss: viewMiss,
		output: viewOutput,
		hitRate,
		savings,
		inputCost: viewInputCost,
		outputCost: viewOutputCost,
		avgCost,
		avgTokens,
		avgDuration,
		avgRate,
		avgTtft,
		rounds,
		remainingRounds,
		avgInputCost,
		avgInputTokens,
		avgOutputCost,
		avgOutputTokens,
		avgThinkTime,
		avgThinkTokens,
		avgHitRate,
		latestHitRate,
		maxOutput,
		maxInput,
		maxTotal,
		avgThinkRatio,
		truncationRate
	};
}
function computeChatStats(hist) {
	const s = getSelectedSave();
	const history = hist ?? (s?.history || []);
	if (!history.length) return [];
	const map = /* @__PURE__ */ new Map();
	for (const h of history) {
		const cid = h.chatId ?? null;
		const cname = h.chatName ?? null;
		const key = cid ?? "__null__";
		if (!map.has(key)) map.set(key, {
			chatId: cid,
			chatName: cname,
			count: 0,
			hit: 0,
			miss: 0,
			out: 0,
			total: 0,
			cost: 0
		});
		const e = map.get(key);
		if (cname && !e.chatName) e.chatName = cname;
		e.count++;
		e.hit += h.cache_hit_tokens || 0;
		e.miss += h.cache_miss_tokens || 0;
		e.out += h.completion_tokens || 0;
		e.total += h.total_tokens || 0;
		e.cost += h.cost || 0;
	}
	const rows = Array.from(map.values()).map((e) => {
		let display = e.chatName || "";
		if (!display) {
			if (e.chatId) display = e.chatId.length > 18 ? e.chatId.slice(0, 8) + "…" + e.chatId.slice(-4) : e.chatId;
			else display = "未分组/旧数据";
		}
		const totIn = e.hit + e.miss;
		const avgHitRate = totIn > 0 ? e.hit / totIn * 100 : 0;
		return {
			chatId: e.chatId,
			chatName: e.chatName,
			displayName: display,
			count: e.count,
			hit: e.hit,
			miss: e.miss,
			out: e.out,
			total: e.total,
			cost: e.cost,
			avgTokens: e.count ? e.total / e.count : 0,
			avgHitRate
		};
	});
	rows.sort((a, b) => b.total - a.total);
	return rows;
}
function computeStatsFour(filtered) {
	if (!filtered || !filtered.length) return {
		avgCost: 0,
		avgTokens: 0,
		avgDuration: 0,
		avgRate: 0,
		avgTtft: 0,
		avgInputCost: 0,
		avgInputTokens: 0,
		avgOutputCost: 0,
		avgOutputTokens: 0,
		avgThinkTime: 0,
		avgThinkTokens: 0,
		avgHitRate: 0,
		latestHitRate: null,
		maxOutput: 0,
		maxInput: 0,
		maxTotal: 0,
		avgThinkRatio: 0,
		truncationRate: 0,
		rounds: 0
	};
	const rounds = filtered.length;
	let costSum = 0, costCnt = 0, tokensSum = 0, tokensCnt = 0, durSum = 0, durCnt = 0, rateSum = 0, rateCnt = 0;
	let inputCostSum = 0, inputCostCnt = 0, inputTokensSum = 0, inputTokensCnt = 0, outputCostSum = 0, outputCostCnt = 0, outputTokensSum = 0, outputTokensCnt = 0;
	let ttftSum = 0, ttftCnt = 0;
	let thinkTimeSum = 0, thinkTokensSum = 0, thinkTimeCnt = 0, thinkTokensCnt = 0;
	let hitRateSum = 0, hitRateCnt = 0;
	let maxOutput = 0, maxInput = 0, maxTotal = 0;
	let sumThink = 0, sumOut = 0, truncCnt = 0;
	for (const h of filtered) {
		const cost = numberValue(h.cost);
		if (cost > 0) {
			costSum += cost;
			costCnt++;
		}
		const tokens = numberValue(h.total_tokens);
		if (tokens > 0) {
			tokensSum += tokens;
			tokensCnt++;
		}
		const duration = numberValue(h.duration);
		if (duration > 0) {
			durSum += duration;
			durCnt++;
		}
		const rate = numberValue(h.tokenRate);
		if (rate > 0) {
			rateSum += rate;
			rateCnt++;
		}
		const inputCost = numberValue(h.input_cost);
		if (inputCost > 0) {
			inputCostSum += inputCost;
			inputCostCnt++;
		}
		const inputTokens = numberValue(h.cache_hit_tokens) + numberValue(h.cache_miss_tokens);
		if (inputTokens > 0) {
			inputTokensSum += inputTokens;
			inputTokensCnt++;
		}
		const outputCost = numberValue(h.output_cost);
		if (outputCost > 0) {
			outputCostSum += outputCost;
			outputCostCnt++;
		}
		const outputTokens = numberValue(h.completion_tokens);
		if (outputTokens > 0) {
			outputTokensSum += outputTokens;
			outputTokensCnt++;
		}
		if ((h.ttft || 0) > 0) {
			ttftSum += h.ttft;
			ttftCnt++;
		}
		if ((h.thinkTime || 0) > 0) {
			thinkTimeSum += h.thinkTime;
			thinkTimeCnt++;
		}
		if ((h.thinkTokens || 0) > 0) {
			thinkTokensSum += h.thinkTokens;
			thinkTokensCnt++;
		}
		const ch = h.cache_hit_tokens || 0, tot = ch + (h.cache_miss_tokens || 0);
		if (tot > 0) {
			hitRateSum += ch / tot * 100;
			hitRateCnt++;
		}
		const out = h.completion_tokens || 0, inp = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0), totTok = h.total_tokens || 0;
		if (out > maxOutput) maxOutput = out;
		if (inp > maxInput) maxInput = inp;
		if (totTok > maxTotal) maxTotal = totTok;
		sumThink += h.thinkTokens || 0;
		sumOut += h.completion_tokens || 0;
		if (isTruncatedFinish(h.finishReason) || h.isTruncated) truncCnt++;
	}
	return {
		avgCost: costCnt ? costSum / costCnt : 0,
		avgTokens: tokensCnt ? tokensSum / tokensCnt : 0,
		avgDuration: durCnt ? durSum / durCnt / 1e3 : 0,
		avgRate: rateCnt ? rateSum / rateCnt : 0,
		avgTtft: ttftCnt ? ttftSum / ttftCnt / 1e3 : 0,
		avgInputCost: inputCostCnt ? inputCostSum / inputCostCnt : 0,
		avgInputTokens: inputTokensCnt ? inputTokensSum / inputTokensCnt : 0,
		avgOutputCost: outputCostCnt ? outputCostSum / outputCostCnt : 0,
		avgOutputTokens: outputTokensCnt ? outputTokensSum / outputTokensCnt : 0,
		avgThinkTime: thinkTimeCnt ? thinkTimeSum / thinkTimeCnt / 1e3 : 0,
		avgThinkTokens: thinkTokensCnt ? thinkTokensSum / thinkTokensCnt : 0,
		avgHitRate: hitRateCnt ? hitRateSum / hitRateCnt : 0,
		latestHitRate: (() => {
			const latest = [...filtered].sort((a, b) => b.timestamp - a.timestamp)[0];
			const ch = latest.cache_hit_tokens || 0, tot = ch + (latest.cache_miss_tokens || 0);
			return tot > 0 ? ch / tot * 100 : 0;
		})(),
		maxOutput,
		maxInput,
		maxTotal,
		avgThinkRatio: sumOut > 0 ? sumThink / sumOut * 100 : 0,
		truncationRate: truncCnt / rounds * 100,
		rounds
	};
}
/** 全量历史有效缓存命中率；无样本时返回 null */
function computeGlobalHitRate(history) {
	return computeGlobalHitRate$1(history || []);
}
/** 指定模型的有效缓存命中率；无样本时返回 null */
function computeModelHitRate(history, model) {
	return computeModelHitRate$1(history || [], model);
}
/** 模型效率对比（按每 1k 输出成本升序，无价排最后） */
function computeModelEfficiency(history, options = {}) {
	return aggregateModelEfficiency(history || [], options);
}
//#endregion
//#region src/ui/sort-header.ts
/**
* 表头排序：点击带 data-sort-key 的表头切换排序（同列切换升/降序，换列回到降序）。
*
* 用量统计的「模型汇总」与用量概览的「按对话统计」共用这一份实现，
* 保证交互、指示箭头与悬停高亮完全一致；排序本身由各表自己按业务字段映射。
*/
/** 表头容器：只认表头里带 data-sort-key 的列（首列名称列保持不可排序） */
function sortableHeaders(doc, tableId) {
	try {
		const table = doc.getElementById(tableId);
		if (!table) return [];
		return Array.from(table.querySelectorAll("thead th[data-sort-key]"));
	} catch {
		return [];
	}
}
/** 重绘排序指示（当前排序列加粗 + 箭头，其余列复原） */
function paintSortHeader(doc, tableId, state) {
	const ths = sortableHeaders(doc, tableId);
	for (const th of ths) {
		th.style.color = "";
		th.style.fontWeight = "";
		const ind = th.querySelector(".aus-sort-ind");
		if (ind) ind.textContent = "";
	}
	if (!state.key) return;
	const cur = ths.find((th) => th.getAttribute("data-sort-key") === state.key);
	if (!cur) return;
	cur.style.color = "var(--ds-text)";
	cur.style.fontWeight = "600";
	const ind = cur.querySelector(".aus-sort-ind");
	if (ind) ind.innerHTML = state.dir === "asc" ? icon("chevron-up", 14) : icon("chevron-down", 14);
}
/**
* 绑定表头点击排序（幂等：同一张表只绑一次，表头由首屏模板渲染、不会被重绘）。
* @param onChange 状态变化后触发重绘，由调用方用最近一次数据重新渲染表体
*/
function bindSortableHeaders(doc, tableId, state, onChange) {
	const table = doc.getElementById(tableId);
	if (!table || table._ausSortBound) return;
	const ths = sortableHeaders(doc, tableId);
	if (!ths.length) return;
	table._ausSortBound = true;
	for (const th of ths) {
		const key = th.getAttribute("data-sort-key");
		if (!key) continue;
		th.style.cursor = "pointer";
		th.style.userSelect = "none";
		th.addEventListener("click", () => {
			if (state.key === key) state.dir = state.dir === "asc" ? "desc" : "asc";
			else {
				state.key = key;
				state.dir = "desc";
			}
			paintSortHeader(doc, tableId, state);
			try {
				onChange();
			} catch {}
		});
		th.addEventListener("mouseenter", () => {
			if (key !== state.key) th.style.color = "var(--ds-text)";
		});
		th.addEventListener("mouseleave", () => {
			if (key !== state.key) th.style.color = "";
		});
	}
}
/**
* 按状态排序：未选列时原样返回；相等值按 tie 文本升序稳定兜底，避免顺序抖动。
* @param pick 从行里取该列的可比较数值
*/
function sortRows(rows, state, pick, tie) {
	const key = state.key;
	if (!key) return rows;
	const dir = state.dir === "asc" ? 1 : -1;
	return [...rows].sort((a, b) => {
		const av = Number(pick(a, key)) || 0;
		const bv = Number(pick(b, key)) || 0;
		if (av === bv) return tie(a).localeCompare(tie(b));
		return (av - bv) * dir;
	});
}
//#endregion
//#region src/ui/chat-visibility.ts
/**
* 对话显隐偏好（纯展示偏好，localStorage）。
*
* 定位与 `filter-prefs.ts` / `chart-prefs.ts` 一致：不进 `settings`、不参与导出与
* WebDAV 同步，也不影响任何统计口径——隐藏只是让该对话不出现在某个展示位置，
* 热力图、统计页、历史页、趋势预测、能耗评分等全部照旧按全量历史计算。
*
* 两个互相独立的隐藏集合：
* - `hidden`：概览「按对话统计」表格里不列出；
* - `hiddenPickers`：统计页/历史页/趋势预测页的「对话」下拉胶囊里不列出。
*   胶囊只是少一个可选项，数据统计口径不变（已选中的对话仍按全量计算）。
*
* 存储形态：`{ hidden: string[], hiddenPickers: string[] }`，元素是「对话键」而不是
* chatId 原值：无 chatId 的记录（旧数据/未分组）统一用 `NULL_CHAT_KEY`，与
* `data/computed.ts#computeChatStats` 内部的聚合键保持一致，这样没有 chatId 的
* 那一行也能被单独隐藏。旧版只有 `{ hidden }` 的数据照常读取，缺的集合视为空。
*
* 读写全部包 try/catch：宿主禁用存储或隐私模式下静默退化为内存态
* （本次会话有效，刷新后回到全部显示），不影响功能可用性。
*/
var CHAT_VISIBILITY_KEY = "aus_chat_visibility_v1";
/** 无 chatId 的记录（旧数据/未分组）在所有统计里共用的聚合键 */
var NULL_CHAT_KEY = "__null__";
/** chatId → 存储键：空值统一落到 NULL_CHAT_KEY */
function chatVisibilityKey(chatId) {
	return chatId ? String(chatId) : NULL_CHAT_KEY;
}
/** 校验并去重：只保留非空字符串，非法输入一律丢弃 */
function normalizeHiddenKeys(value) {
	if (!Array.isArray(value)) return [];
	const out = [];
	for (const item of value) {
		if (typeof item !== "string" || !item) continue;
		if (!out.includes(item)) out.push(item);
	}
	return out;
}
/** 校验整份偏好：缺字段、脏字段一律回落为空数组（兼容旧版只有 hidden 的数据） */
function normalizePrefs(value) {
	const raw = value ?? {};
	return {
		hidden: normalizeHiddenKeys(raw.hidden),
		hiddenPickers: normalizeHiddenKeys(raw.hiddenPickers)
	};
}
function storage$2() {
	try {
		const store = globalThis.localStorage;
		if (!store || typeof store.getItem !== "function" || typeof store.setItem !== "function") return null;
		store.getItem(CHAT_VISIBILITY_KEY);
		return store;
	} catch {
		return null;
	}
}
/** 内存态兜底（localStorage 不可用时本次会话仍可切换） */
var memoryPrefs = null;
/** 读取整份偏好（每次返回新对象，调用方可安全修改） */
function readPrefs() {
	const store = storage$2();
	if (!store) return normalizePrefs(memoryPrefs ?? {});
	try {
		const raw = store.getItem(CHAT_VISIBILITY_KEY);
		if (!raw) return {
			hidden: [],
			hiddenPickers: []
		};
		return normalizePrefs(JSON.parse(raw));
	} catch {
		return {
			hidden: [],
			hiddenPickers: []
		};
	}
}
function writePrefs(prefs) {
	const clean = normalizePrefs(prefs);
	memoryPrefs = clean;
	const store = storage$2();
	if (!store) return;
	try {
		store.setItem(CHAT_VISIBILITY_KEY, JSON.stringify(clean));
	} catch {}
}
function listOf(prefs, target) {
	return target === "picker" ? prefs.hiddenPickers : prefs.hidden;
}
function writeList(target, keys) {
	const prefs = readPrefs();
	if (target === "picker") prefs.hiddenPickers = normalizeHiddenKeys(keys);
	else prefs.hidden = normalizeHiddenKeys(keys);
	writePrefs(prefs);
}
/** 读取某个展示位置的隐藏键列表（只读副本） */
function readHiddenFor(target) {
	return listOf(readPrefs(), target).slice();
}
/** 「按对话统计」表格的隐藏键列表 */
function readHiddenKeys() {
	return readHiddenFor("table");
}
/** 该对话在该位置是否被隐藏（入参是存储键） */
function isHiddenFor(target, key) {
	return listOf(readPrefs(), target).includes(key);
}
/** 设置某个对话键在某位置的显隐 */
function setHiddenFor(target, key, hidden) {
	if (!key) return;
	const current = readHiddenFor(target);
	if (hidden === current.includes(key)) return;
	writeList(target, hidden ? current.concat(key) : current.filter((k) => k !== key));
}
/** 一次写入多个键的显隐（「全部隐藏 / 全部显示」用，避免逐条读写存储） */
function setAllHiddenFor(target, keys, hidden) {
	const clean = normalizeHiddenKeys(keys);
	const current = readHiddenFor(target);
	if (hidden) {
		const merged = current.slice();
		for (const key of clean) if (!merged.includes(key)) merged.push(key);
		writeList(target, merged);
	} else {
		const drop = new Set(clean);
		writeList(target, current.filter((key) => !drop.has(key)));
	}
}
/** 清空某个展示位置的隐藏项（全部恢复显示） */
function clearHiddenFor(target) {
	writeList(target, []);
}
function filterByHidden(rows, hidden, keyOf) {
	if (!hidden.length) return rows.slice();
	const set = new Set(hidden);
	return rows.filter((row) => !set.has(keyOf(row)));
}
/**
* 过滤出应当出现在「按对话统计」表中的行（纯函数，按入参顺序、不改变排序）。
* 传 keyOf 便于测试与复用；默认按 ChatSummaryRow.chatId 取键。
*/
function filterVisibleRows(rows, keyOf = (row) => chatVisibilityKey(row?.chatId ?? null)) {
	return filterByHidden(rows, readHiddenFor("table"), keyOf);
}
/**
* 过滤出应当出现在「对话」下拉胶囊里的选项（纯函数，按入参顺序）。
* 默认按选项的 chatId 取键；历史页的选项自己带 `id`（已是对话键），传 keyOf 取它。
*/
function filterPickerRows(rows, keyOf = (row) => chatVisibilityKey(row?.chatId ?? null)) {
	return filterByHidden(rows, readHiddenFor("picker"), keyOf);
}
//#endregion
//#region src/ui/chat-summary-table.ts
/** 排序状态：key 为 null 时保持数据源默认顺序（总 Tokens 倒序） */
var sortState = {
	key: null,
	dir: "desc"
};
/** 最近一次渲染的数据，供点击表头时就地重排，避免重新聚合 */
var lastRows = [];
var TABLE_ID = "aus-chat-summary-overview";
var TBODY_ID = "aus-chat-summary-tbody";
/** 列 → 可比较数值（导出以便单测，保持与表头 data-sort-key 一一对应） */
function pickChatSortValue(row, key) {
	switch (key) {
		case "count": return row.count;
		case "hit": return row.hit;
		case "miss": return row.miss;
		case "out": return row.out;
		case "total": return row.total;
		case "cost": return row.cost;
		case "avgTokens": return row.avgTokens;
		case "avgHitRate": return row.avgHitRate;
		default: return 0;
	}
}
/** 绑定表头排序（幂等），点击后按最近一次数据重排重绘 */
function bindChatSummarySort(doc) {
	bindSortableHeaders(doc, TABLE_ID, sortState, () => {
		renderChatSummaryTable(doc, lastRows);
	});
	paintSortHeader(doc, TABLE_ID, sortState);
}
/** 概览表格标题右侧「管理对话」按钮上的隐藏计数（0 个时整块隐藏） */
function paintChatManageBadge(doc) {
	const badge = doc.getElementById("aus-chat-manage-count");
	if (!badge) return;
	const hiddenSet = new Set(readHiddenKeys());
	const hidden = lastRows.filter((r) => hiddenSet.has(chatVisibilityKey(r.chatId))).length;
	badge.textContent = hidden ? "已隐藏 " + hidden + " 个" : "";
	badge.style.display = hidden ? "inline" : "none";
}
/** 渲染表体：先按当前排序状态排序，未选列时保持入参顺序 */
function renderChatSummaryTable(doc, rows) {
	const tbody = doc.getElementById(TBODY_ID);
	if (!tbody) return;
	lastRows = rows || [];
	try {
		bindChatSummarySort(doc);
	} catch {}
	try {
		paintChatManageBadge(doc);
	} catch {}
	if (!lastRows.length) {
		tbody.innerHTML = "<tr><td colspan=\"9\" style=\"text-align:center;padding:16px;color:var(--ds-text-3);\">暂无数据</td></tr>";
		return;
	}
	const visible = filterVisibleRows(lastRows);
	if (!visible.length) {
		tbody.innerHTML = "<tr><td colspan=\"9\" style=\"text-align:center;padding:16px;color:var(--ds-text-3);\">全部对话都已隐藏 · 点击右上角「管理对话」恢复显示</td></tr>";
		return;
	}
	tbody.innerHTML = sortRows(visible, sortState, pickChatSortValue, (row) => row.displayName).map((r) => {
		const avgRate = r.avgHitRate > 0 ? r.avgHitRate.toFixed(1) + "%" : "—";
		const colorRate = r.avgHitRate >= 50 ? "var(--ds-green)" : r.avgHitRate > 0 ? "var(--ds-text)" : "var(--ds-text-3)";
		let costTxt = "¥" + r.cost.toFixed(4);
		try {
			costTxt = formatMoney(r.cost, 4);
		} catch {}
		return [
			"<tr style=\"border-bottom:1px solid var(--ds-card);\">",
			"<td style=\"padding:6px 8px;text-align:left;color:var(--ds-text);font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;\" title=\"" + esc(r.chatId || "null") + "\">" + esc(r.displayName) + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;\">" + r.count + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;color:#0BA25E;\">" + r.hit.toLocaleString("zh-CN") + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;color:#DC2626;\">" + r.miss.toLocaleString("zh-CN") + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;color:#6366F1;\">" + r.out.toLocaleString("zh-CN") + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;font-weight:600;\">" + r.total.toLocaleString("zh-CN") + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;color:var(--ds-text);\">" + costTxt + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;\">" + Math.round(r.avgTokens).toLocaleString("zh-CN") + "</td>",
			"<td style=\"padding:6px 8px;text-align:right;color:" + colorRate + ";\">" + avgRate + "</td>",
			"</tr>"
		].join("");
	}).join("");
}
//#endregion
//#region src/ui/heatmap.ts
function getDoc$11() {
	return window.parent?.document ?? document;
}
function themeIsDark() {
	try {
		return getDoc$11().getElementById("aus-panel")?.getAttribute("data-ds-theme") === "dark";
	} catch {
		return false;
	}
}
function renderHeatmap(filtered) {
	const doc = getDoc$11();
	const container = doc.getElementById("aus-heatmap-container-overview") || doc.getElementById("aus-heatmap-container");
	const legendEl = doc.getElementById("aus-heatmap-legend-overview") || doc.getElementById("aus-heatmap-legend");
	const labelsEl = doc.getElementById("aus-heatmap-labels-overview") || doc.getElementById("aus-heatmap-labels");
	const scrollEl = doc.getElementById("aus-heatmap-scroll-overview") || doc.getElementById("aus-heatmap-scroll");
	if (!container) return;
	if (!filtered || filtered.length === 0) {
		container.innerHTML = "<div style=\"text-align:center;padding:20px;color:var(--ds-text-3);font-size:var(--aus-fs-base)\">暂无数据</div>";
		if (legendEl) legendEl.innerHTML = "";
		if (labelsEl) labelsEl.innerHTML = "";
		return;
	}
	const dayMap = {};
	for (const h of filtered) {
		const k = localDay(h.timestamp);
		dayMap[k] = (dayMap[k] || 0) + (h.total_tokens || 0);
	}
	const keys = Object.keys(dayMap).sort();
	const isDark = themeIsDark();
	const endStr = localDay((/* @__PURE__ */ new Date()).getTime());
	const endDate = /* @__PURE__ */ new Date(endStr + "T00:00:00");
	let startDate = new Date(endDate);
	startDate.setFullYear(startDate.getFullYear() - 2);
	if (keys.length > 0) {
		const earliest = /* @__PURE__ */ new Date(keys[0] + "T00:00:00");
		if (earliest < startDate) startDate = earliest;
	}
	const sd = startDate.getDay();
	startDate.setDate(startDate.getDate() + (sd === 0 ? -6 : 1 - sd));
	const ed = endDate.getDay();
	endDate.setDate(endDate.getDate() + (ed === 0 ? 0 : 7 - ed));
	const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 864e5);
	const totalWeeks = Math.ceil(totalDays / 7);
	const vals = [];
	for (const k in dayMap) if (dayMap[k] > 0) vals.push(dayMap[k]);
	vals.sort((a, b) => a - b);
	const pct = (arr, p) => {
		if (arr.length === 0) return 0;
		const idx = Math.ceil(arr.length * p / 100) - 1;
		return arr[Math.max(0, Math.min(idx, arr.length - 1))];
	};
	let p25 = pct(vals, 25), p50 = pct(vals, 50), p75 = pct(vals, 75);
	if (p25 === 0 && p50 === 0 && p75 === 0) {
		p25 = 1;
		p50 = 1e3;
		p75 = 1e4;
	} else if (p25 === p50 && p50 === p75) {
		p25 = Math.max(1, Math.floor(p50 / 2));
		p75 = p50 * 2;
	}
	const getLevel = (t) => {
		if (t <= 0) return 0;
		if (t <= p25) return 1;
		if (t <= p50) return 2;
		if (t <= p75) return 3;
		return 4;
	};
	const clr = isDark ? [
		"#161b22",
		"#0d3b20",
		"#1a7f37",
		"#3fb950",
		"#aceebb"
	] : [
		"#EBEDF0",
		"#9BE9A8",
		"#40C463",
		"#30A14E",
		"#216E39"
	];
	const borderClr = isDark ? "#1f2937" : "#E5E7EB";
	const mn = [
		"1月",
		"2月",
		"3月",
		"4月",
		"5月",
		"6月",
		"7月",
		"8月",
		"9月",
		"10月",
		"11月",
		"12月"
	];
	const dl = [
		"周一",
		"",
		"周三",
		"",
		"周五",
		"",
		"周日"
	];
	if (labelsEl) {
		let lhtml = "<div style=\"display:flex;flex-direction:column\">";
		lhtml += "<div style=\"height:16px;width:28px;\"></div>";
		for (let d = 0; d < 7; d++) lhtml += "<div style=\"height:14px;width:28px;padding:0 4px 0 0;line-height:14px;font-size:var(--aus-fs-xs);color:var(--ds-text-3);text-align:right;box-sizing:border-box\">" + (d % 2 === 0 ? dl[d] : "") + "</div>";
		lhtml += "</div>";
		labelsEl.innerHTML = lhtml;
	}
	let html = "<table style=\"border-collapse:collapse;font-size:var(--aus-fs-sm);color:var(--ds-text-3)\"><tr><td style=\"height:16px;padding:0;line-height:16px\"></td>";
	let lastM = -1;
	for (let w = 0; w < totalWeeks; w++) {
		const ws = new Date(startDate);
		ws.setDate(startDate.getDate() + w * 7);
		const mk = ws.getFullYear() * 12 + ws.getMonth();
		if (mk !== lastM) {
			let span = 1;
			for (let w2 = w + 1; w2 < totalWeeks; w2++) {
				const ws2 = new Date(startDate);
				ws2.setDate(startDate.getDate() + w2 * 7);
				if (ws2.getFullYear() * 12 + ws2.getMonth() === mk) span++;
				else break;
			}
			let label = mn[ws.getMonth()];
			if (ws.getMonth() === 0) label = ws.getFullYear() + "年";
			html += "<td colspan=\"" + span + "\" style=\"padding:0 0 0 2px;line-height:16px;height:16px;font-size:var(--aus-fs-sm);color:var(--ds-text-3);white-space:nowrap\">" + label + "</td>";
			lastM = mk;
		}
	}
	html += "</tr>";
	for (let d = 0; d < 7; d++) {
		html += "<tr>";
		for (let w = 0; w < totalWeeks; w++) {
			const cd = new Date(startDate);
			cd.setDate(startDate.getDate() + w * 7 + d);
			const t = dayMap[localDay(cd.getTime())] || 0;
			const lv = getLevel(t);
			const weekday = [
				"周日",
				"周一",
				"周二",
				"周三",
				"周四",
				"周五",
				"周六"
			][cd.getDay()];
			const tip = cd.getFullYear() + "年" + (cd.getMonth() + 1) + "月" + cd.getDate() + "日 " + weekday + (t > 0 ? " · " + t.toLocaleString() + " Token" : " · 无记录");
			html += "<td style=\"padding:1px;line-height:0;font-size:0\"><div style=\"width:12px;height:12px;border-radius:2px;background:" + clr[lv] + ";border:1px solid " + borderClr + ";cursor:pointer;box-sizing:border-box;\" title=\"" + tip + "\"></div></td>";
		}
		html += "</tr>";
	}
	html += "</table>";
	container.innerHTML = html;
	if (legendEl) {
		let lhtml = "更少 ";
		for (let i = 0; i < 5; i++) lhtml += "<span style=\"display:inline-block;width:11px;height:11px;border-radius:2px;background:" + clr[i] + ";border:1px solid " + borderClr + ";vertical-align:middle;margin:0 0 0 3px\"></span>";
		lhtml += " 更多";
		legendEl.innerHTML = lhtml;
	}
	setTimeout(() => {
		if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
	}, 50);
}
//#endregion
//#region src/ui/overview.ts
function getDoc$10() {
	return window.parent?.document ?? document;
}
function fmt(n) {
	return n.toLocaleString("zh-CN");
}
function CNY(n) {
	try {
		return formatMoney(n, 4);
	} catch {
		return "¥" + n.toFixed(4) + " CNY";
	}
}
function moneyHtml(cny, digits = 4) {
	try {
		const cur = getDisplayCurrency();
		const v = cur.code === "USD" ? cny / cur.rate : cny;
		return `${cur.symbol}${v.toFixed(digits)} <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">${cur.code}</span>`;
	} catch {
		return `¥${(cny || 0).toFixed(digits)} <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">CNY</span>`;
	}
}
var FOUR_OPTIONS = [
	{
		key: "avg_cost",
		label: "每轮费用"
	},
	{
		key: "avg_tokens",
		label: "每轮 Token"
	},
	{
		key: "avg_duration",
		label: "平均耗时"
	},
	{
		key: "avg_ttft",
		label: "平均首字延迟"
	},
	{
		key: "avg_rate",
		label: "输出速率"
	},
	{
		key: "avg_input_cost",
		label: "每轮平均输入费用"
	},
	{
		key: "avg_input_tokens",
		label: "每轮平均输入 Token"
	},
	{
		key: "avg_output_cost",
		label: "每轮平均输出费用"
	},
	{
		key: "avg_output_tokens",
		label: "每轮平均输出 Token"
	},
	{
		key: "avg_think_time",
		label: "思维链平均耗时"
	},
	{
		key: "avg_think_tokens",
		label: "思维链平均 Token"
	},
	{
		key: "avg_hit_rate",
		label: "平均缓存命中率"
	},
	{
		key: "latest_hit_rate",
		label: "最新命中率"
	},
	{
		key: "max_output",
		label: "单轮最大输出"
	},
	{
		key: "max_input",
		label: "单轮最大输入"
	},
	{
		key: "max_total",
		label: "单轮最大总 Token"
	},
	{
		key: "avg_think_ratio",
		label: "思维链占比"
	},
	{
		key: "truncation_rate",
		label: "截断率"
	}
];
var FOUR_LABEL_MAP = new Map(FOUR_OPTIONS.map((o) => [o.key, o.label]));
function ensureFour() {
	let cur = state$2.settings.overviewFour;
	const valid = new Set(FOUR_OPTIONS.map((o) => o.key));
	const defaults = [
		"avg_cost",
		"avg_tokens",
		"avg_duration",
		"avg_rate",
		"avg_input_tokens",
		"avg_output_tokens",
		"avg_hit_rate",
		"max_total"
	];
	if (!Array.isArray(cur) || cur.some((k) => !valid.has(k))) {
		cur = defaults.slice();
		state$2.settings.overviewFour = cur;
		try {
			saveHot({ settings: state$2.settings });
		} catch {}
		return cur;
	}
	if (cur.length === 4) {
		cur = [...cur, ...defaults.slice(4)];
		state$2.settings.overviewFour = cur;
		try {
			saveHot({ settings: state$2.settings });
		} catch {}
	}
	if (cur.length !== 8) {
		cur = defaults.slice();
		state$2.settings.overviewFour = cur;
		try {
			saveHot({ settings: state$2.settings });
		} catch {}
	}
	return cur;
}
function getFourDisplay(key, v) {
	const title = FOUR_LABEL_MAP.get(key) || key;
	switch (key) {
		case "avg_cost": return {
			title,
			html: moneyHtml(v.avgCost || 0, 4)
		};
		case "avg_tokens": return {
			title,
			html: `${Math.round(v.avgTokens || 0).toLocaleString("zh-CN")}`
		};
		case "avg_duration": return {
			title,
			html: `${(v.avgDuration || 0).toFixed(1)} <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">s</span>`
		};
		case "avg_ttft": return {
			title,
			html: (v.avgTtft || 0) > 0 ? `${v.avgTtft.toFixed(1)} <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">s</span>` : `<span style="color:var(--ds-text-3);">—</span>`
		};
		case "avg_rate": return {
			title,
			html: (v.avgRate || 0) > 0 ? `${Math.round(v.avgRate)} <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">t/s</span>` : `<span style="color:var(--ds-text-3);">—</span>`
		};
		case "avg_input_cost": return {
			title,
			html: moneyHtml(v.avgInputCost || 0, 4)
		};
		case "avg_input_tokens": return {
			title,
			html: `${Math.round(v.avgInputTokens || 0).toLocaleString("zh-CN")}`
		};
		case "avg_output_cost": return {
			title,
			html: moneyHtml(v.avgOutputCost || 0, 4)
		};
		case "avg_output_tokens": return {
			title,
			html: `${Math.round(v.avgOutputTokens || 0).toLocaleString("zh-CN")}`
		};
		case "avg_think_time": return {
			title,
			html: (v.avgThinkTime || 0) > 0 ? `${v.avgThinkTime.toFixed(1)} <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">s</span>` : `<span style="color:var(--ds-text-3);">—</span>`
		};
		case "avg_think_tokens": return {
			title,
			html: (v.avgThinkTokens || 0) > 0 ? `${Math.round(v.avgThinkTokens).toLocaleString("zh-CN")}` : `<span style="color:var(--ds-text-3);">—</span>`
		};
		case "avg_hit_rate": return {
			title,
			html: (v.avgHitRate || 0) > 0 ? `${v.avgHitRate.toFixed(1)}<span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">%</span>` : `<span style="color:var(--ds-text-3);">—</span>`
		};
		case "latest_hit_rate": {
			const val = v.latestHitRate;
			if (val == null) return {
				title,
				html: `<span style="color:var(--ds-text-3);">—</span>`
			};
			return {
				title,
				html: `${val.toFixed(1)}<span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">%</span>`
			};
		}
		case "max_output": return {
			title,
			html: `${(v.maxOutput || 0).toLocaleString("zh-CN")}`
		};
		case "max_input": return {
			title,
			html: `${(v.maxInput || 0).toLocaleString("zh-CN")}`
		};
		case "max_total": return {
			title,
			html: `${(v.maxTotal || 0).toLocaleString("zh-CN")}`
		};
		case "avg_think_ratio": {
			const has = (v.avgThinkRatio || 0) > 0 || (v.rounds || 0) > 0;
			const val = v.avgThinkRatio || 0;
			return {
				title,
				html: has && val > 0 ? `${val.toFixed(1)}<span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">%</span>` : `<span style="color:var(--ds-text-3);">—</span>`
			};
		}
		case "truncation_rate": {
			const has = (v.rounds || 0) > 0;
			const val = v.truncationRate || 0;
			return {
				title,
				html: has ? `${val.toFixed(1)}<span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);font-weight:400;">%</span>` : `<span style="color:var(--ds-text-3);">—</span>`
			};
		}
		default: return {
			title,
			html: "—"
		};
	}
}
var fourBound = false;
var overviewWalletBound = false;
var overviewWalletViewportBound = false;
var overviewAsyncToken = 0;
function closeOverviewWalletDropdown() {
	const dropdown = getDoc$10().getElementById("aus-overview-wallet-dropdown");
	if (dropdown) dropdown.style.display = "none";
}
function bindOverviewWalletViewport() {
	if (overviewWalletViewportBound) return;
	overviewWalletViewportBound = true;
	try {
		(window.parent || window).addEventListener("resize", closeOverviewWalletDropdown, { passive: true });
	} catch {}
	try {
		window.addEventListener("resize", closeOverviewWalletDropdown, { passive: true });
	} catch {}
	try {
		getDoc$10().getElementById("aus-main")?.addEventListener("scroll", closeOverviewWalletDropdown, { passive: true });
	} catch {}
}
function positionOverviewWalletDropdown(btn, dropdown) {
	try {
		const panelRect = getDoc$10().getElementById("aus-panel")?.getBoundingClientRect();
		const btnRect = btn.getBoundingClientRect();
		const viewportWidth = window.parent?.innerWidth ?? window.innerWidth;
		const viewportHeight = window.parent?.innerHeight ?? window.innerHeight;
		const available = Math.max(180, Math.min(280, viewportWidth - 16));
		dropdown.style.position = "fixed";
		dropdown.style.width = `${available}px`;
		dropdown.style.minWidth = "0";
		dropdown.style.maxWidth = `${viewportWidth - 16}px`;
		dropdown.style.maxHeight = `${Math.max(120, viewportHeight - 24)}px`;
		const left = Math.max(8, Math.min(btnRect.right - available, viewportWidth - available - 8));
		const estimatedHeight = Math.min(dropdown.scrollHeight || 220, viewportHeight - 24);
		const top = btnRect.bottom + 6 + estimatedHeight > viewportHeight - 8 ? Math.max(8, btnRect.top - estimatedHeight - 6) : btnRect.bottom + 6;
		dropdown.style.top = `${Math.round(top)}px`;
		dropdown.style.left = `${Math.round(left)}px`;
		dropdown.style.right = "auto";
		dropdown.style.zIndex = "100500";
		if (panelRect) dropdown.style.pointerEvents = "auto";
	} catch {}
}
function bindFour() {
	if (fourBound) return;
	fourBound = true;
	const doc = window.parent?.document ?? document;
	doc.addEventListener("click", (e) => {
		const t = e.target;
		for (let i = 0; i < 8; i++) {
			const drop = doc.getElementById(`aus-four-drop-${i}`);
			const btn = doc.getElementById(`aus-four-btn-${i}`);
			if (drop && btn && !t.closest(`#aus-four-drop-${i}`) && !t.closest(`#aus-four-btn-${i}`)) drop.style.display = "none";
		}
	});
}
function openFourDrop(idx, v) {
	const drop = (window.parent?.document ?? document).getElementById(`aus-four-drop-${idx}`);
	if (!drop) return;
	const cur = ensureFour()[idx];
	drop.innerHTML = FOUR_OPTIONS.map((o) => {
		const active = o.key === cur;
		return `<div data-four="${idx}" data-key="${o.key}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-sm);${active ? "background:var(--ds-card);font-weight:600;color:var(--ds-text);" : ""}">${o.label}</div>`;
	}).join("");
	drop.querySelectorAll("[data-four]").forEach((el) => {
		el.onclick = () => {
			const key = el.getAttribute("data-key");
			const at = Number(el.getAttribute("data-four"));
			const arr = ensureFour().slice();
			arr[at] = key;
			state$2.settings.overviewFour = arr;
			try {
				saveHot({ settings: state$2.settings });
			} catch {}
			closeDropdownThenPaint(drop, () => renderOverview());
		};
	});
	drop.style.display = drop.style.display === "block" ? "none" : "block";
}
function renderOverview(fullHistory) {
	const doc = window.parent?.document ?? document;
	const ignored = new Set(repository.getIgnoredWalletIds());
	const wallets = repository.getWallets().filter((wallet) => !ignored.has(wallet.id));
	const selectedWalletId = String(state$2.settings.overviewWalletId || "all");
	const activeWalletId = selectedWalletId !== "all" && wallets.some((wallet) => wallet.id === selectedWalletId) ? selectedWalletId : "all";
	const v = computeOverview(activeWalletId, fullHistory);
	const walletBtn = doc.getElementById("aus-overview-wallet-btn");
	const walletLabel = doc.getElementById("aus-overview-wallet-label");
	const walletDrop = doc.getElementById("aus-overview-wallet-dropdown");
	if (walletLabel) walletLabel.textContent = activeWalletId === "all" ? "全部钱包合计" : wallets.find((wallet) => wallet.id === activeWalletId)?.name || "全部钱包合计";
	if (walletDrop) {
		const item = (id, label) => {
			const active = id === activeWalletId;
			return `<div data-overview-wallet="${esc(id)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-sm);${active ? "background:var(--ds-card);font-weight:600;" : ""}">${esc(label)}</div>`;
		};
		walletDrop.innerHTML = item("all", "全部钱包合计") + wallets.map((wallet) => item(wallet.id, wallet.name)).join("");
		walletDrop.querySelectorAll("[data-overview-wallet]").forEach((el) => {
			el.onclick = () => {
				state$2.settings.overviewWalletId = el.getAttribute("data-overview-wallet") || "all";
				state$2.settings.overviewWalletManuallySet = true;
				try {
					saveHot({ settings: state$2.settings });
				} catch {}
				closeDropdownThenPaint(walletDrop, () => renderOverview());
			};
		});
	}
	if (walletBtn && walletDrop) walletBtn.onclick = (event) => {
		event.stopPropagation();
		const open = walletDrop.style.display !== "block";
		walletDrop.style.display = open ? "block" : "none";
		if (open) {
			bindOverviewWalletViewport();
			positionOverviewWalletDropdown(walletBtn, walletDrop);
		}
	};
	if (!overviewWalletBound) {
		overviewWalletBound = true;
		doc.addEventListener("click", (event) => {
			const target = event.target;
			const drop = doc.getElementById("aus-overview-wallet-dropdown");
			if (drop && !target?.closest?.("#aus-overview-wallet-dropdown") && !target?.closest?.("#aus-overview-wallet-btn")) drop.style.display = "none";
		});
	}
	const balEl = doc.getElementById("aus-balance");
	if (balEl) balEl.textContent = v.balanceText;
	const remEl = doc.getElementById("aus-balance-remaining");
	if (remEl) {
		if (v.remainingRounds != null) remEl.textContent = "预计还可进行 " + v.remainingRounds.toLocaleString("zh-CN") + " 轮对话";
		else remEl.textContent = v.hasBalance ? "暂无可用于预测的费用记录" : "设置钱包余额后可预测剩余轮次";
	}
	const costEl = doc.getElementById("aus-total-cost");
	if (costEl) try {
		costEl.textContent = formatMoney(v.totalCost, 4);
	} catch {
		costEl.textContent = "¥" + v.totalCost.toFixed(4) + " CNY";
	}
	const tokEl = doc.getElementById("aus-total-tokens");
	if (tokEl) tokEl.textContent = fmt(v.totalTokens) + " tokens";
	const histHost = doc.getElementById("aus-overview-history");
	if (histHost) histHost.innerHTML = `
      <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);margin-bottom:8px;">历史消耗</div>
      <div style="display:grid;gap:10px;font-size:var(--aus-fs-sm);">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">Token 历史消耗</span><span style="font-weight:600;font-size:var(--aus-fs-base);font-variant-numeric:tabular-nums;color:var(--ds-text);">${fmt(v.totalTokens)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输入（命中缓存）</span><span style="font-weight:600;font-size:var(--aus-fs-base);font-variant-numeric:tabular-nums;color:var(--ds-green);">${fmt(v.hit)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输入（未命中缓存）</span><span style="font-weight:600;font-size:var(--aus-fs-base);font-variant-numeric:tabular-nums;color:var(--ds-red);">${fmt(v.miss)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输出</span><span style="font-weight:600;font-size:var(--aus-fs-base);font-variant-numeric:tabular-nums;color:var(--ds-text);">${fmt(v.output)} tokens</span></div>
      </div>
    `;
	const spendHost = doc.getElementById("aus-overview-spend");
	if (spendHost) spendHost.innerHTML = `
      <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);margin-bottom:8px;">支出明细</div>
      <div style="display:grid;gap:10px;font-size:var(--aus-fs-sm);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:3px;">预计节省</span><span style="text-align:right;"><div style="font-weight:600;font-size:var(--aus-fs-base);font-variant-numeric:tabular-nums;color:var(--ds-green);">${CNY(v.savings)}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:1px;">${fmt(v.hit)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:3px;">支出在输入</span><span style="text-align:right;"><div style="font-weight:600;font-size:var(--aus-fs-base);font-variant-numeric:tabular-nums;color:var(--ds-text);">${CNY(v.inputCost)}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:1px;">${fmt(v.hit + v.miss)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:3px;">支出在输出</span><span style="text-align:right;"><div style="font-weight:600;font-size:var(--aus-fs-base);font-variant-numeric:tabular-nums;color:var(--ds-text);">${CNY(v.outputCost)}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:1px;">${fmt(v.output)} tokens</div></span></div>
      </div>
    `;
	const fourHost = doc.getElementById("aus-overview-four");
	if (fourHost) {
		const keys = ensureFour();
		bindFour();
		fourHost.innerHTML = keys.map((k, i) => {
			const d = getFourDisplay(k, v);
			const valColor = k === "avg_rate" ? "var(--ds-green)" : "var(--ds-text)";
			return `<div class="ds-card" style="padding:14px;position:relative;overflow:visible;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.title}</div>
          <button id="aus-four-btn-${i}" title="切换指标" style="flex-shrink:0;padding:4px 7px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;line-height:1;">${icon("chevron-down", 14)}</button>
          <div id="aus-four-drop-${i}" style="display:none;position:absolute;top:38px;right:8px;z-index:6;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:180px;max-height:260px;overflow:auto;"></div>
        </div>
        <div style="font-size:18px;font-weight:600;color:${valColor};margin-top:6px;word-break:break-all;">${d.html}</div>
      </div>`;
		}).join("");
		keys.forEach((_, i) => {
			const btn = doc.getElementById(`aus-four-btn-${i}`);
			if (btn) btn.onclick = () => openFourDrop(i, v);
		});
	}
	try {
		renderHeatmap(fullHistory || state$2.history || []);
	} catch {}
	try {
		renderChatSummaryOverview(fullHistory);
	} catch {}
	if (!fullHistory) {
		const token = ++overviewAsyncToken;
		repository.getAllHistory().then((all) => {
			if (token === overviewAsyncToken && all?.length) renderOverview(all);
		}).catch(() => {});
	}
}
function renderChatSummaryOverview(fullHistory) {
	const doc = window.parent?.document ?? document;
	if (!doc.getElementById("aus-chat-summary-overview")) return;
	const hotRows = computeChatStats(fullHistory);
	renderChatSummaryTable(doc, hotRows);
	if (fullHistory) return;
	(async () => {
		try {
			const mod = await import("./persistence-CaWdvByH.js").then((n) => n.l);
			if (!mod.getAllHistory) return;
			const all = await mod.getAllHistory();
			if (!all || all.length <= (state$2.history?.length || 0)) return;
			const fullRows = computeChatStats(all);
			if (fullRows.length !== hotRows.length || fullRows.some((r, i) => r.total !== hotRows[i]?.total)) renderChatSummaryTable(doc, fullRows);
		} catch {}
	})();
}
//#endregion
//#region src/ui/nav-model.ts
/** 底栏从左到右：概览、统计、历史、趋势、设置 */
var MOBILE_TABS = [
	{
		view: "overview",
		label: "概览",
		icon: "overview"
	},
	{
		view: "stats",
		label: "统计",
		icon: "stats"
	},
	{
		view: "history",
		label: "历史",
		icon: "history"
	},
	{
		view: "forecast",
		label: "趋势",
		icon: "forecast"
	},
	{
		view: "settings",
		label: "设置",
		icon: "settings"
	}
];
/** 收进「设置」页的二级入口（顺序即列表顺序） */
var SETTINGS_ENTRIES = [
	{
		view: "wallet",
		label: "钱包",
		desc: "余额、模型价格与接入管理",
		icon: "wallet"
	},
	{
		view: "help",
		label: "使用说明",
		desc: "功能说明、隐私与免责声明",
		icon: "help"
	},
	{
		view: "about",
		label: "关于",
		desc: "版本信息与更新日志",
		icon: "about"
	}
];
/** 挂在「设置」下的二级视图 */
var SETTINGS_CHILD_VIEWS = [
	"wallet",
	"help",
	"about"
];
/** 所有二级视图 → 父级根视图（用于底栏高亮、返回箭头、重复点 tab 回根页） */
var CHILD_PARENT = {
	wallet: "settings",
	help: "settings",
	about: "settings",
	"chat-manage": "overview"
};
/** 二级视图清单（顺序即声明顺序） */
var CHILD_VIEWS = [
	"wallet",
	"help",
	"about",
	"chat-manage"
];
function isSettingsChild(view) {
	return SETTINGS_CHILD_VIEWS.includes(view);
}
/** 任意二级页判定（含挂在概览下的对话展示管理） */
function isChildView(view) {
	return CHILD_VIEWS.includes(view);
}
/** 二级页的父级根视图；非二级页返回 null */
function childParentOf(view) {
	return CHILD_PARENT[view] ?? null;
}
/**
* 视图所属的底栏 tab：二级页归到父级（设置 / 概览），其余自身。
* 底栏高亮与「重复点当前 tab」判定都以它为准。
*/
function parentTabOf(view) {
	return CHILD_PARENT[view] ?? view;
}
/** 页面标题（全称）：桌面顶栏与窄屏 header 共用 */
var VIEW_TITLES = {
	overview: "用量概览",
	stats: "用量统计",
	history: "历史记录",
	forecast: "趋势预测",
	wallet: "钱包",
	settings: "设置",
	help: "使用说明",
	about: "关于",
	"chat-manage": "对话展示管理"
};
function viewTitle(view) {
	return VIEW_TITLES[view] || VIEW_TITLES.overview;
}
/** 主动切页时压入上一页；与目标页相同则不入栈 */
function pushViewTrail(trail, prev, next, max = 24) {
	if (prev === next) return;
	trail.push(prev);
	if (max > 0 && trail.length > max) trail.splice(0, trail.length - max);
}
/** 弹出一页可回退的上次视图；返回 null 表示已经回到底，可交给上层关面板 */
function popViewTrail(trail, current) {
	while (trail.length) {
		const prev = trail.pop();
		if (prev !== current) return prev;
	}
	return null;
}
/**
* 底栏 tab 点击语义。
* @param target 用户点到的 tab（根视图）
* @param current 当前视图（可能是二级页）
* @param currentIsChildView 当前视图是否为「设置」下的二级页
*/
function resolveTabTap(target, current, currentIsChildView) {
	if (target !== parentTabOf(current)) return "switch";
	if (currentIsChildView) return "pop-root";
	return "scroll-top";
}
//#endregion
//#region src/ui/chart-time.ts
var WEEKDAY = [
	"周日",
	"周一",
	"周二",
	"周三",
	"周四",
	"周五",
	"周六"
];
var pad = (n) => String(n).padStart(2, "0");
var num = (v) => {
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? n : 0;
};
/** 2026-10-23 */
function chartDate(ts) {
	const t = num(ts);
	if (!t) return "";
	const d = new Date(t);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** 2026-10-23 周五 */
function chartDateWeek(ts) {
	const t = num(ts);
	if (!t) return "";
	return chartDate(t) + " " + WEEKDAY[new Date(t).getDay()];
}
/** 2026-10-23 19:12 */
function chartDateTime(ts) {
	const t = num(ts);
	if (!t) return "";
	const d = new Date(t);
	return chartDate(t) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
/** 19:12:33 */
function chartClock(ts) {
	const t = num(ts);
	if (!t) return "";
	const d = new Date(t);
	return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}
/** ISO 周键：2026-W43 */
function isoWeekKey(ts) {
	const t = num(ts);
	if (!t) return "";
	const d = new Date(t);
	const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const dayNum = tmp.getUTCDay() || 7;
	tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
	return tmp.getUTCFullYear() + "-W" + pad(weekNo);
}
/** 单条记录的悬浮标题：2026-10-23 19:12:33 */
function entryTip(entry) {
	const ts = num(entry?.timestamp);
	if (!ts) return "";
	return chartDate(ts) + " " + chartClock(ts);
}
/** 轮次图（X = 轮次）的悬浮标题：#3 · 2026-10-23 19:12:33 */
function roundTip(round, timestamp) {
	const head = "#" + (Number(round) || 1);
	const time = entryTip({ timestamp });
	return time ? head + " · " + time : head;
}
/**
* 分桶图（X = 每小时/每日/每周/每月）的悬浮标题，带上日期与时间：
* - 每小时：2026-10-23 周五 14:00–15:00
* - 每日：2026-10-23 周五
* - 每周：2026-10-19 周一 ~ 2026-10-25 周日（2026-W43）
* - 每月：2026 年 10 月
*/
function bucketTip(x, firstTs, lastTs) {
	const first = num(firstTs);
	if (!first) return "";
	const last = num(lastTs) || first;
	if (x === "hour") {
		const d = new Date(first);
		const from = pad(d.getHours()) + ":00";
		const to = pad((d.getHours() + 1) % 24) + ":00";
		return chartDateWeek(first) + " " + from + "–" + to;
	}
	if (x === "day") return chartDateWeek(first);
	if (x === "week") {
		const from = chartDateWeek(first);
		const to = chartDateWeek(last);
		const week = isoWeekKey(first);
		return (from === to ? from : from + " ~ " + to) + (week ? "（" + week + "）" : "");
	}
	if (x === "month") {
		const d = new Date(first);
		return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月";
	}
	return chartDate(first) + " " + chartClock(first);
}
/** 汇总类图表（如模型占比）的悬浮时间范围：2026-10-01 09:12 ~ 2026-10-23 19:20 */
function rangeTip(entries) {
	let min = 0;
	let max = 0;
	for (const e of entries || []) {
		const ts = num(e?.timestamp);
		if (!ts) continue;
		if (!min || ts < min) min = ts;
		if (!max || ts > max) max = ts;
	}
	if (!min) return "";
	if (min === max) return chartDateTime(min);
	return chartDateTime(min) + " ~ " + chartDateTime(max);
}
//#endregion
//#region src/ui/chart-prefs.ts
/**
* 用量统计页图表配置的持久化（Y 轴多选、X 轴维度、展示方式、轴标签、占比模式）。
*
* 为什么放 localStorage 而不是 settings：这些是纯展示偏好，
* 与趋势预测的 aus_forecast_prefs_v1 同一定位——不进导出、不参与 WebDAV 同步、
* 不污染 `extensionSettings`。读写全部包在 try/catch 内，
* 宿主禁用存储或隐私模式时静默退化为内存态，不影响图表本身。
*
* 只做「整段读、按块合并写」：main 是自定义图表，extra 按图表 id 分片，
* 这样改其中一张图不会覆盖另一张图已保存的配置。
*/
var CHART_PREFS_KEY = "aus_stats_chart_prefs_v1";
function isPlainObject$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function storage$1() {
	try {
		const store = globalThis.localStorage;
		return store && typeof store.getItem === "function" && typeof store.setItem === "function" ? store : null;
	} catch {
		return null;
	}
}
function normalizeExtra(value) {
	const out = {};
	if (!isPlainObject$1(value)) return out;
	for (const [id, section] of Object.entries(value)) if (isPlainObject$1(section)) out[id] = section;
	return out;
}
/** 读取全部图表配置；损坏数据或不可用存储统一回退为空对象（调用方按默认值处理） */
function readChartPrefs() {
	const store = storage$1();
	if (store) try {
		const raw = store.getItem(CHART_PREFS_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (isPlainObject$1(parsed)) return {
				main: isPlainObject$1(parsed.main) ? parsed.main : {},
				extra: normalizeExtra(parsed.extra),
				pie: isPlainObject$1(parsed.pie) ? parsed.pie : {}
			};
		}
	} catch {}
	return {
		main: {},
		extra: {},
		pie: {}
	};
}
/** 按块合并写入（只覆盖 patch 里出现的字段与图表，其余保持不变） */
function writeChartPrefs(patch) {
	const store = storage$1();
	if (!store) return;
	try {
		const current = readChartPrefs();
		const next = {
			main: {
				...current.main,
				...patch.main || {}
			},
			extra: { ...current.extra },
			pie: {
				...current.pie,
				...patch.pie || {}
			}
		};
		for (const [id, section] of Object.entries(patch.extra || {})) {
			if (!isPlainObject$1(section)) continue;
			next.extra[id] = {
				...next.extra[id] || {},
				...section
			};
		}
		store.setItem(CHART_PREFS_KEY, JSON.stringify(next));
	} catch {}
}
//#endregion
//#region src/ui/chart-config.ts
/** Token 三段配色（命中 / 未命中 / 输出，浅 → 深蓝，取自设计稿图例）：全站图表统一引用 */
var TOKEN_SERIES_COLORS = {
	hit: "#A0DCFD",
	miss: "#60B3FE",
	output: "#0C70F3"
};
/** 堆叠柱自下而上的叠放次序：输出最深压底，命中最浅置顶（与「上浅下深」的读图习惯一致） */
var TOKEN_STACK_RANK = {
	output_token: 0,
	input_miss_token: 1,
	input_hit_token: 2
};
/**
* 调整 Token 三段的绘制顺序：ECharts 堆叠按 series 数组顺序自下而上叠放，
* 因此把命中最浅的一段放到数组末尾（最上层）、输出最深的一段放到最前（最底层）。
* 只重排 input_hit_token / input_miss_token / output_token 这三个键，其余系列位置不变。
*/
function tokenStackDrawOrder(series) {
	const slots = [];
	for (let i = 0; i < series.length; i++) {
		const key = series[i]?.key;
		if (key && key in TOKEN_STACK_RANK) slots.push(i);
	}
	if (slots.length < 2) return series;
	const picked = slots.map((i) => series[i]).sort((a, b) => (TOKEN_STACK_RANK[a.key] ?? 9) - (TOKEN_STACK_RANK[b.key] ?? 9));
	const out = series.slice();
	slots.forEach((pos, i) => {
		out[pos] = picked[i];
	});
	return out;
}
/** 悬浮窗条目按 Y 选项顺序（命中 → 未命中 → 输出）排列，稳定排序，未命中的条目保持原相对次序 */
function sortTooltipParams(params) {
	const order = new Map(Y_OPTIONS.map((o, i) => [o.label, i]));
	const rank = (p) => order.get(p?.seriesName || "") ?? 999;
	return params.slice().sort((a, b) => rank(a) - rank(b));
}
var Y_OPTIONS = [
	{
		key: "input_hit_token",
		label: "输入(命中) token",
		unit: "tokens",
		kind: "token",
		agg: "sum",
		group: "token",
		color: TOKEN_SERIES_COLORS.hit
	},
	{
		key: "input_miss_token",
		label: "输入(未命中) token",
		unit: "tokens",
		kind: "token",
		agg: "sum",
		group: "token",
		color: TOKEN_SERIES_COLORS.miss
	},
	{
		key: "output_token",
		label: "输出 token",
		unit: "tokens",
		kind: "token",
		agg: "sum",
		group: "token",
		color: TOKEN_SERIES_COLORS.output
	},
	{
		key: "total_token",
		label: "总 Token",
		unit: "tokens",
		kind: "token",
		agg: "sum",
		group: "token",
		color: "#111827"
	},
	{
		key: "avg_tokens",
		label: "平均每轮 Token",
		unit: "tokens",
		kind: "token",
		agg: "avg",
		group: "token",
		color: "#0EA5E9"
	},
	{
		key: "input_hit_cost",
		label: "输入(命中)费用",
		unit: "CNY",
		kind: "cost",
		agg: "sum",
		group: "cost",
		color: "#10B981"
	},
	{
		key: "input_miss_cost",
		label: "输入(未命中)费用",
		unit: "CNY",
		kind: "cost",
		agg: "sum",
		group: "cost",
		color: "#F59E0B"
	},
	{
		key: "output_cost",
		label: "输出费用",
		unit: "CNY",
		kind: "cost",
		agg: "sum",
		group: "cost",
		color: "#8B5CF6"
	},
	{
		key: "total_cost",
		label: "总费用",
		unit: "CNY",
		kind: "cost",
		agg: "sum",
		group: "cost",
		color: "#FF6A00"
	},
	{
		key: "avg_cost",
		label: "平均每轮成本",
		unit: "CNY",
		kind: "cost",
		agg: "avg",
		group: "cost",
		color: "#EA580C"
	},
	{
		key: "request_count",
		label: "请求数",
		unit: "次",
		kind: "count",
		agg: "sum",
		group: "perf",
		color: "#64748B"
	},
	{
		key: "avg_ttft",
		label: "平均首字延迟",
		unit: "s",
		kind: "duration",
		agg: "avg",
		group: "perf",
		color: "#06B6D4"
	},
	{
		key: "avg_duration",
		label: "平均耗时",
		unit: "s",
		kind: "duration",
		agg: "avg",
		group: "perf",
		color: "#0EA5E9"
	},
	{
		key: "avg_rate",
		label: "平均速率",
		unit: "t/s",
		kind: "rate",
		agg: "avg",
		group: "perf",
		color: "#14B8A6"
	},
	{
		key: "hit_rate",
		label: "缓存命中率",
		unit: "%",
		kind: "percent",
		agg: "ratio",
		group: "ratio",
		color: "#22C55E"
	},
	{
		key: "think_ratio",
		label: "思维链占比",
		unit: "%",
		kind: "percent",
		agg: "ratio",
		group: "ratio",
		color: "#A855F7"
	},
	{
		key: "truncation_rate",
		label: "截断率",
		unit: "%",
		kind: "percent",
		agg: "ratio",
		group: "ratio",
		color: "#EF4444"
	}
];
var Y_GROUPS = [
	{
		key: "token",
		label: "Token"
	},
	{
		key: "cost",
		label: "费用"
	},
	{
		key: "perf",
		label: "请求与性能"
	},
	{
		key: "ratio",
		label: "比率"
	}
];
var X_OPTIONS = [
	{
		key: "round",
		label: "轮次"
	},
	{
		key: "hour",
		label: "每小时"
	},
	{
		key: "day",
		label: "每日"
	},
	{
		key: "week",
		label: "每周"
	},
	{
		key: "month",
		label: "每月"
	}
];
var X_OPTIONS_WITHOUT_ROUND = X_OPTIONS.filter((option) => option.key !== "round");
/** 默认组合：缓存命中/未命中/输出三段 Token + 总费用曲线 + 命中率曲线，一屏内同时看用量、成本与缓存效果 */
var DEFAULT_Y_KEYS = [
	"input_hit_token",
	"input_miss_token",
	"output_token",
	"total_cost",
	"hit_rate"
];
var DEFAULT_X_KEY = "round";
var DEFAULT_CHART_TYPE = "auto";
var DEFAULT_AXIS_LABEL_MODE = "auto";
var ySelected = new Set(DEFAULT_Y_KEYS);
var axisLabelMode = DEFAULT_AXIS_LABEL_MODE;
var xSelected = DEFAULT_X_KEY;
var chartType = DEFAULT_CHART_TYPE;
/** 从 localStorage 恢复上次的配置（刷新后 Y/X/展示方式/轴标签保持不变）；非法值逐项丢弃回退默认 */
function restoreChartPrefs() {
	const { main } = readChartPrefs();
	const y = Array.isArray(main.y) ? main.y.filter((k) => Y_OPTIONS.some((o) => o.key === k)) : [];
	if (y.length) ySelected = new Set(y);
	if (X_OPTIONS.some((o) => o.key === main.x)) xSelected = main.x;
	if (main.type === "bar" || main.type === "line" || main.type === "area" || main.type === "auto") chartType = main.type;
	if (main.axisLabel === "all" || main.axisLabel === "hide" || main.axisLabel === "auto") axisLabelMode = main.axisLabel;
}
restoreChartPrefs();
/** 任一 setter 都要落盘，保证刷新后与界面一致 */
function persistChartPrefs() {
	writeChartPrefs({ main: {
		y: Array.from(ySelected),
		x: xSelected,
		type: chartType,
		axisLabel: axisLabelMode
	} });
}
function getYSelected() {
	return Array.from(ySelected);
}
function getXSelected() {
	return xSelected;
}
function getChartType() {
	return chartType;
}
function setXSelected(k) {
	xSelected = k;
	persistChartPrefs();
}
function setChartType(t) {
	chartType = t === "bar" || t === "line" || t === "area" ? t : "auto";
	persistChartPrefs();
}
function getAxisLabelMode() {
	return axisLabelMode;
}
function setAxisLabelMode(m) {
	axisLabelMode = m === "all" || m === "hide" ? m : "auto";
	persistChartPrefs();
}
function toggleY(key) {
	if (ySelected.has(key)) {
		if (ySelected.size > 1) ySelected.delete(key);
	} else ySelected.add(key);
	persistChartPrefs();
}
function toHourKey(ts) {
	const d = new Date(ts);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
}
function toWeekKey(ts) {
	const d = new Date(ts);
	const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const dayNum = tmp.getUTCDay() || 7;
	tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
	return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function toMonthKey(ts) {
	const d = new Date(ts);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getBucketKey(e, x, idx) {
	if (x === "round") return `#${idx + 1}`;
	if (x === "hour") return toHourKey(e.timestamp);
	if (x === "day") return localDay(e.timestamp);
	if (x === "week") return toWeekKey(e.timestamp);
	if (x === "month") return toMonthKey(e.timestamp);
	return localDay(e.timestamp);
}
/** 单条记录对应的数值（比率类返回 0-100） */
function getYValue$1(e, y) {
	switch (y) {
		case "input_hit_token": return e.cache_hit_tokens || 0;
		case "input_miss_token": return e.cache_miss_tokens || 0;
		case "output_token": return e.completion_tokens || 0;
		case "total_token": return e.total_tokens || 0;
		case "avg_tokens": return e.total_tokens || 0;
		case "input_hit_cost": {
			const hit = e.cache_hit_tokens || 0, tot = hit + (e.cache_miss_tokens || 0);
			const ic = e.input_cost || 0;
			return tot ? ic * (hit / tot) : 0;
		}
		case "input_miss_cost": {
			const hit = e.cache_hit_tokens || 0, miss = e.cache_miss_tokens || 0, tot = hit + miss;
			const ic = e.input_cost || 0;
			return tot ? ic * (miss / tot) : 0;
		}
		case "output_cost": return e.output_cost || 0;
		case "total_cost": return e.cost || 0;
		case "avg_cost": return e.cost || 0;
		case "request_count": return 1;
		case "avg_ttft": return e.ttft ? e.ttft / 1e3 : 0;
		case "avg_duration": return e.duration ? e.duration / 1e3 : 0;
		case "avg_rate": return e.tokenRate || 0;
		case "hit_rate": {
			const hit = e.cache_hit_tokens || 0;
			const tot = hit + (e.cache_miss_tokens || 0);
			return tot ? hit / tot * 100 : 0;
		}
		case "think_ratio": {
			const out = e.completion_tokens || 0, think = e.thinkTokens || 0;
			return out ? think / out * 100 : 0;
		}
		case "truncation_rate": return e.isTruncated ? 100 : 0;
	}
	return 0;
}
function bucketValue(arr, opt) {
	if (opt.agg === "sum") {
		let sum = 0;
		for (const e of arr) sum += getYValue$1(e, opt.key);
		return sum;
	}
	if (opt.agg === "avg") {
		let sum = 0, n = 0;
		for (const e of arr) {
			const v = getYValue$1(e, opt.key);
			if (v > 0) {
				sum += v;
				n++;
			}
		}
		return n ? sum / n : 0;
	}
	if (opt.key === "hit_rate") {
		let hit = 0, miss = 0;
		for (const e of arr) {
			hit += e.cache_hit_tokens || 0;
			miss += e.cache_miss_tokens || 0;
		}
		const tot = hit + miss;
		return tot ? hit / tot * 100 : 0;
	}
	if (opt.key === "think_ratio") {
		let think = 0, out = 0;
		for (const e of arr) {
			think += e.thinkTokens || 0;
			out += e.completion_tokens || 0;
		}
		return out ? think / out * 100 : 0;
	}
	if (opt.key === "truncation_rate") {
		let n = 0;
		for (const e of arr) if (e.isTruncated) n++;
		return arr.length ? n / arr.length * 100 : 0;
	}
	return 0;
}
function precisionFor(kind) {
	if (kind === "cost") return 4;
	if (kind === "percent" || kind === "duration") return 2;
	if (kind === "rate") return 1;
	return 0;
}
function aggregateForChart(entries, yKeys, xKey) {
	const meta = new Map(Y_OPTIONS.map((o) => [o.key, o]));
	if (!yKeys.length) yKeys = DEFAULT_Y_KEYS;
	const round = xKey === "round";
	const labels = [];
	const tips = [];
	let buckets = null;
	let sortedKeys = [];
	if (round) {
		labels.push(...entries.map((_, i) => `#${i + 1}`));
		tips.push(...entries.map((e, i) => roundTip(i + 1, e?.timestamp)));
	} else {
		buckets = /* @__PURE__ */ new Map();
		for (const e of entries) {
			const key = getBucketKey(e, xKey, 0);
			const ts = Number(e?.timestamp) || 0;
			const bucket = buckets.get(key);
			if (!bucket) buckets.set(key, {
				list: [e],
				first: ts,
				last: ts
			});
			else {
				bucket.list.push(e);
				if (ts && (!bucket.first || ts < bucket.first)) bucket.first = ts;
				if (ts > bucket.last) bucket.last = ts;
			}
		}
		sortedKeys = Array.from(buckets.keys()).sort();
		labels.push(...sortedKeys.map((k) => {
			if (xKey === "hour") return k.slice(5);
			if (xKey === "day") return k.slice(5).replace("-", "/");
			return k;
		}));
		tips.push(...sortedKeys.map((k) => {
			const bucket = buckets.get(k);
			return bucketTip(xKey, bucket.first, bucket.last) || k;
		}));
	}
	return {
		labels,
		series: yKeys.map((k) => {
			const opt = meta.get(k);
			const data = round ? entries.map((e) => Number(getYValue$1(e, k).toFixed(precisionFor(opt.kind)))) : sortedKeys.map((b) => Number(bucketValue(buckets.get(b).list, opt).toFixed(precisionFor(opt.kind))));
			return {
				key: k,
				name: opt.label,
				data,
				kind: opt.kind,
				agg: opt.agg,
				unit: opt.unit,
				group: opt.group,
				color: opt.color
			};
		}),
		tips
	};
}
//#endregion
//#region src/ui/chart-tooltip.ts
/**
* 图表悬浮窗（tooltip）统一外观（单一来源）
*
* 圆角直接对齐块（.ds-card）的圆角 —— style.css 里 `--ds-radius-card: 14px`，
* 让 ECharts 浮层与页面卡片用同一套圆角语言；正文内边距同步放大一点，
* 否则 14px 圆角会把默认 5px 内距里的文字切到弧线上。
* 需要调整浮层外观时只改这里，禁止各图表自己写 borderRadius。
*/
var CHART_TOOLTIP_SURFACE = {
	/** 与 .ds-card 的 --ds-radius-card 保持一致 */
	borderRadius: 14,
	/** 上/下 8、左/右 12：让 14px 圆角内部留出与卡片相近的呼吸感 */
	padding: [8, 12]
};
//#endregion
//#region src/ui/chart-bar.ts
/**
* 柱状图柱子形状（单一来源）
*
* 圆角口径按参考效果定：**圆角半径 ≈ 柱宽的 1/6**（截图实测柱宽 38px、圆角 6px，比例 0.16）。
* 旧实现写死 `[4,4,0,0]`，柱宽只有 6-8px 时会被夹到半宽，顶部变成"子弹头"，
* 与参考效果的「圆角矩形」手感差很多；改为按估算柱宽等比换算后，
* 宽柱(16-18px)≈3px、窄柱(8px)≈2px，任意密度下都是同一个观感。
* 只给最顶段加圆角，中间段与柱底保持直角（堆叠才无缝）。
*/
var BAR_RADIUS_RATIO = 1 / 6;
/** 堆叠柱的中间段与柱底：直角 */
var BAR_SQUARE = [
	0,
	0,
	0,
	0
];
/** 按柱宽换算顶部圆角 [左上, 右上, 右下, 左下] */
function barTopRadius(barWidthPx) {
	const radius = Math.max(2, Math.min(8, Math.round((Number.isFinite(barWidthPx) ? barWidthPx : 16) * BAR_RADIUS_RATIO)));
	return [
		radius,
		radius,
		0,
		0
	];
}
/**
* 估算单根柱的实际宽度：绘图区宽 ÷ 类目数 × 0.8（ECharts 默认 barCategoryGap 20%），
* 再与 barMaxWidth 取小。用于给 borderRadius 选一个跟视觉柱宽匹配的半径。
*/
function estimateBarWidth(containerWidth, plotReservePx, categoryCount, maxBarWidth) {
	const band = Math.max(120, containerWidth - plotReservePx) / Math.max(1, categoryCount);
	return Math.min(maxBarWidth, Math.max(2, band * .8));
}
//#endregion
//#region src/ui/range-zoom.ts
var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function attachRangeZoom(options) {
	const { doc, container, onChange } = options;
	const left = Math.max(0, options.left);
	const right = Math.max(0, options.right);
	const bottom = options.bottom ?? 4;
	const minSpan = Math.max(2, options.minSpan ?? 4);
	try {
		container.style.position = "relative";
	} catch {}
	const existing = container.querySelector("[data-range-zoom=\"1\"]");
	if (existing) existing.remove();
	const root = doc.createElement("div");
	root.className = "aus-range-zoom";
	root.setAttribute("data-range-zoom", "1");
	root.style.left = left + "px";
	root.style.right = right + "px";
	root.style.bottom = bottom + "px";
	const track = doc.createElement("div");
	track.className = "aus-range-zoom-track";
	const win = doc.createElement("div");
	win.className = "aus-range-zoom-window";
	win.setAttribute("data-range-window", "1");
	const handleLeft = doc.createElement("div");
	handleLeft.className = "aus-range-zoom-handle is-left";
	handleLeft.setAttribute("data-range-handle", "left");
	const handleRight = doc.createElement("div");
	handleRight.className = "aus-range-zoom-handle is-right";
	handleRight.setAttribute("data-range-handle", "right");
	win.appendChild(handleLeft);
	win.appendChild(handleRight);
	root.appendChild(track);
	root.appendChild(win);
	container.appendChild(root);
	let start = 0;
	let end = 100;
	let dragging = null;
	let dragStartX = 0;
	let dragStartValue = 0;
	let dragEndValue = 100;
	const paint = () => {
		win.style.left = start + "%";
		win.style.width = Math.max(0, end - start) + "%";
	};
	paint();
	const width = () => {
		return root.getBoundingClientRect().width || 1;
	};
	const emit = () => {
		paint();
		onChange(start, end);
	};
	const onPointerDown = (event) => {
		const target = event.target;
		const handle = target?.getAttribute?.("data-range-handle");
		const isWindow = !!target?.getAttribute?.("data-range-window");
		if (!handle && !isWindow) return;
		dragging = handle === "left" ? "left" : handle === "right" ? "right" : "move";
		dragStartX = Number(event.clientX) || 0;
		dragStartValue = start;
		dragEndValue = end;
		root.classList.add("is-dragging");
		try {
			root.setPointerCapture(event.pointerId);
		} catch {}
		try {
			event.preventDefault();
		} catch {}
		try {
			event.stopPropagation();
		} catch {}
	};
	const onPointerMove = (event) => {
		if (!dragging) return;
		const delta = ((Number(event.clientX) || 0) - dragStartX) / width() * 100;
		if (dragging === "move") {
			const span = dragEndValue - dragStartValue;
			start = clamp(dragStartValue + delta, 0, 100 - span);
			end = start + span;
		} else if (dragging === "left") {
			start = clamp(dragStartValue + delta, 0, dragEndValue - minSpan);
			end = dragEndValue;
		} else {
			start = dragStartValue;
			end = clamp(dragEndValue + delta, dragStartValue + minSpan, 100);
		}
		emit();
		try {
			event.preventDefault();
		} catch {}
	};
	const onPointerUp = (event) => {
		if (!dragging) return;
		dragging = null;
		root.classList.remove("is-dragging");
		try {
			root.releasePointerCapture(event.pointerId);
		} catch {}
	};
	root.addEventListener("pointerdown", onPointerDown);
	root.addEventListener("pointermove", onPointerMove);
	root.addEventListener("pointerup", onPointerUp);
	root.addEventListener("pointercancel", onPointerUp);
	root.addEventListener("touchstart", (event) => {
		try {
			event.preventDefault();
		} catch {}
	}, { passive: false });
	return {
		setRange(nextStart, nextEnd) {
			const s = clamp(Number(nextStart) || 0, 0, 100);
			const e = clamp(Number(nextEnd) || 0, 0, 100);
			start = Math.min(s, e);
			end = Math.max(s, e);
			if (end - start < minSpan) end = Math.min(100, start + minSpan);
			paint();
		},
		getRange() {
			return {
				start,
				end
			};
		},
		destroy() {
			root.removeEventListener("pointerdown", onPointerDown);
			root.removeEventListener("pointermove", onPointerMove);
			root.removeEventListener("pointerup", onPointerUp);
			root.removeEventListener("pointercancel", onPointerUp);
			try {
				root.remove();
			} catch {}
		}
	};
}
/** 图表实例 → 滑块句柄（用 WeakMap，实例销毁后自动回收） */
var chartHandles = /* @__PURE__ */ new WeakMap();
/** 各图表的视窗位置记忆（切换页面时保留；时间维度/筛选变化时整体清空） */
var storedRanges = /* @__PURE__ */ new Map();
function getChartRange(key) {
	return storedRanges.get(key) || null;
}
function setChartRange(key, start, end) {
	if (!key) return;
	if (!Number.isFinite(start) || !Number.isFinite(end)) return;
	storedRanges.set(key, {
		start,
		end
	});
}
function clearChartRanges() {
	storedRanges.clear();
}
/**
* 给任意 ECharts 实例挂载视窗滑块，并与 inside dataZoom 双向同步。
* 同一实例重复调用会先清理旧滑块，避免叠加。
*/
function attachChartZoom(options) {
	const { chart, container, enabled = true } = options;
	if (chart) detachChartZoom(chart);
	if (!chart || !enabled) return null;
	const rangeKey = options.rangeKey;
	const handle = attachRangeZoom({
		doc: options.doc,
		container,
		left: options.left,
		right: options.right,
		bottom: options.bottom,
		minSpan: options.minSpan,
		onChange: (start, end) => {
			if (rangeKey) setChartRange(rangeKey, start, end);
			try {
				chart.dispatchAction({
					type: "dataZoom",
					start,
					end
				});
			} catch {}
		}
	});
	chartHandles.set(chart, handle);
	const saved = rangeKey ? getChartRange(rangeKey) : null;
	if (saved) {
		handle.setRange(saved.start, saved.end);
		try {
			chart.dispatchAction({
				type: "dataZoom",
				start: saved.start,
				end: saved.end
			});
		} catch {}
	}
	try {
		chart.off("datazoom");
		chart.on("datazoom", () => {
			try {
				const option = chart.getOption();
				const dataZoom = option && option.dataZoom && option.dataZoom[0];
				if (dataZoom) {
					handle.setRange(Number(dataZoom.start ?? 0), Number(dataZoom.end ?? 100));
					if (rangeKey) setChartRange(rangeKey, Number(dataZoom.start ?? 0), Number(dataZoom.end ?? 100));
				}
			} catch {}
		});
	} catch {}
	return handle;
}
function detachChartZoom(chart) {
	if (!chart) return;
	const handle = chartHandles.get(chart);
	if (!handle) return;
	try {
		handle.destroy();
	} catch {}
	chartHandles.delete(chart);
}
//#endregion
//#region src/ui/extra-charts.ts
var CHART_DEFS = {
	token: {
		title: "Token 趋势",
		yOpts: Y_OPTIONS.filter((o) => o.kind === "token"),
		hasX: true
	},
	cost: {
		title: "费用 趋势",
		yOpts: Y_OPTIONS.filter((o) => o.kind === "cost"),
		hasX: true
	},
	hit: {
		title: "缓存命中 趋势",
		yOpts: [{
			key: "hit_rate",
			label: "命中率",
			unit: "%",
			kind: "cost",
			color: "#0BA25E"
		}],
		hasX: true
	},
	req: {
		title: "API请求数 趋势",
		yOpts: [{
			key: "req_count",
			label: "请求数",
			unit: "次",
			kind: "token",
			color: "#6366F1"
		}],
		hasX: true
	},
	dur: {
		title: "耗时与速率 趋势",
		yOpts: [{
			key: "duration",
			label: "耗时",
			unit: "s",
			kind: "token",
			color: "#2563EB"
		}, {
			key: "rate",
			label: "速率",
			unit: "t/s",
			kind: "cost",
			color: "#10B981"
		}],
		hasX: true
	},
	pie: {
		title: "模型用量占比",
		yOpts: [],
		hasX: false
	}
};
var state$1 = {
	token: {
		y: /* @__PURE__ */ new Set([
			"input_hit_token",
			"input_miss_token",
			"output_token"
		]),
		x: "round",
		pieMode: "token"
	},
	cost: {
		y: /* @__PURE__ */ new Set(["total_cost"]),
		x: "round",
		pieMode: "token"
	},
	hit: {
		y: /* @__PURE__ */ new Set(["hit_rate"]),
		x: "round",
		pieMode: "token"
	},
	req: {
		y: /* @__PURE__ */ new Set(["req_count"]),
		x: "day",
		pieMode: "token"
	},
	dur: {
		y: /* @__PURE__ */ new Set(["duration", "rate"]),
		x: "round",
		pieMode: "token"
	},
	pie: {
		y: /* @__PURE__ */ new Set([]),
		x: "day",
		pieMode: "token"
	}
};
/** 从 localStorage 恢复各图上次的 Y/X 与占比模式（刷新后保持不变）；非法键逐项丢弃回退默认 */
function restoreExtraPrefs() {
	const { extra, pie } = readChartPrefs();
	for (const id of Object.keys(state$1)) {
		const saved = extra[id];
		if (!saved) continue;
		if (Array.isArray(saved.y)) {
			const allowed = CHART_DEFS[id].yOpts.map((o) => o.key);
			const y = saved.y.filter((k) => typeof k === "string" && allowed.includes(k));
			if (y.length) state$1[id].y = new Set(y);
		}
		const options = id === "req" ? X_OPTIONS_WITHOUT_ROUND : X_OPTIONS;
		if (typeof saved.x === "string" && options.some((o) => o.key === saved.x)) state$1[id].x = saved.x;
	}
	if (pie.mode === "count" || pie.mode === "token") state$1.pie.pieMode = pie.mode;
}
restoreExtraPrefs();
/** 改动即落盘：按图表 id 分片写入，不会覆盖其他图已保存的配置 */
function persistExtraPrefs(id) {
	if (id === "pie") {
		writeChartPrefs({ pie: { mode: state$1.pie.pieMode } });
		return;
	}
	writeChartPrefs({ extra: { [id]: {
		y: Array.from(state$1[id].y),
		x: state$1[id].x
	} } });
}
function getDoc$9() {
	return window.parent?.document ?? document;
}
function themeColor$3(name, fallback) {
	try {
		const doc = getDoc$9();
		const el = doc.getElementById("aus-panel") || doc.documentElement;
		return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
	} catch {
		return fallback;
	}
}
function bucketKey$1(ts, x, idx) {
	if (x === "round") return `#${idx + 1}`;
	if (x === "hour") {
		const d = new Date(ts);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
	}
	if (x === "day") return localDay(ts);
	if (x === "week") {
		const d = new Date(ts);
		const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
		const dayNum = tmp.getUTCDay() || 7;
		tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
		const weekNo = Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
		return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
	}
	if (x === "month") {
		const d = new Date(ts);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	}
	return localDay(ts);
}
function getYValue(e, key) {
	switch (key) {
		case "input_hit_token": return e.cache_hit_tokens || 0;
		case "input_miss_token": return e.cache_miss_tokens || 0;
		case "output_token": return e.completion_tokens || 0;
		case "total_token": return e.total_tokens || 0;
		case "input_hit_cost": {
			const hit = e.cache_hit_tokens || 0, tot = hit + (e.cache_miss_tokens || 0);
			return tot ? (e.input_cost || 0) * (hit / tot) : 0;
		}
		case "input_miss_cost": {
			const hit = e.cache_hit_tokens || 0, miss = e.cache_miss_tokens || 0, tot = hit + miss;
			return tot ? (e.input_cost || 0) * (miss / tot) : 0;
		}
		case "output_cost": return e.output_cost || 0;
		case "total_cost": return e.cost || 0;
		case "hit_rate": {
			const h = e.cache_hit_tokens || 0, tot = h + (e.cache_miss_tokens || 0);
			return tot ? h / tot * 100 : 0;
		}
		case "req_count": return 1;
		case "duration": return (e.duration || 0) / 1e3;
		case "rate": return e.tokenRate || 0;
	}
	return 0;
}
async function getEcharts$1() {
	const ec = await import("./core-fg_o3xmJ.js");
	const { BarChart, LineChart, PieChart } = await import("./charts-BstuNsfd.js");
	const { GridComponent, TooltipComponent, LegendComponent, DataZoomInsideComponent } = await import("./components-CpGqNjDG.js");
	const { CanvasRenderer } = await import("./renderers-DtxFY9_W.js");
	ec.use([
		BarChart,
		LineChart,
		PieChart,
		GridComponent,
		TooltipComponent,
		LegendComponent,
		DataZoomInsideComponent,
		CanvasRenderer
	]);
	return ec;
}
var charts$1 = {};
/**
* 主题重绘：ECharts 实例在跨主题切换时复用，option 中的颜色是绘制时取值的，
* 不会随 CSS 变量自动更新，因此「跟随系统」实时切换后需要主动重绘。
* 仅释放本模块内部持有的实例，实例容器留在 DOM 中，各视图自身的 render 会重新 init 并取新配色。
*/
function resetChartThemeCache() {
	for (const id of Object.keys(charts$1)) {
		try {
			charts$1[id]?.dispose?.();
		} catch {}
		charts$1[id] = null;
	}
}
var lastFiltered$1 = [];
/** 容器被文案覆盖时同步销毁实例，否则下次有数据会往已脱离 DOM 的 canvas 上 setOption（表现为图表空白） */
function dropChart(id) {
	const c = charts$1[id];
	if (!c) return;
	try {
		detachChartZoom(c);
	} catch {}
	try {
		c.dispose();
	} catch {}
	charts$1[id] = null;
}
function renderExtraCharts(filtered) {
	lastFiltered$1 = filtered || [];
	for (const id of Object.keys(CHART_DEFS)) renderOne$1(id, filtered);
}
function shortModelName(name, max = 16) {
	const s = String(name || "");
	return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
async function renderOne$1(id, filtered) {
	try {
		const doc = getDoc$9();
		const el = doc.getElementById(`aus-chart-${id}`);
		if (!el) return;
		if (id === "req" && state$1[id].x === "round") state$1[id].x = "day";
		if (id === "pie") {
			const mode = state$1.pie.pieMode;
			if (!filtered.length) {
				dropChart(id);
				el.innerHTML = "<div style=\"text-align:center;padding:40px;color:var(--ds-text-3);\">暂无数据</div>";
				return;
			}
			const map = {};
			for (const e of filtered) {
				const m = e.model || "unknown";
				const v = mode === "token" ? e.total_tokens || 0 : 1;
				map[m] = (map[m] || 0) + v;
			}
			const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
			const narrow = (el.clientWidth || doc.documentElement.clientWidth || 320) < 560;
			const maxSlices = narrow ? 5 : 8;
			let others = [];
			let data = sorted.map(([name, value]) => ({
				name,
				value
			}));
			if (sorted.length > maxSlices + 1) {
				const rest = sorted.slice(maxSlices);
				others = rest.map(([n]) => n);
				data = sorted.slice(0, maxSlices).map(([name, value]) => ({
					name,
					value
				}));
				data.push({
					name: `其他 ${rest.length} 个模型`,
					value: rest.reduce((s, [, v]) => s + v, 0)
				});
			}
			const ec = await getEcharts$1();
			let c = charts$1[id];
			if (!c || c.isDisposed?.()) {
				el.innerHTML = "";
				el.style.height = "260px";
				c = charts$1[id] = ec.init(el, void 0, {
					width: el.clientWidth || 320,
					height: el.clientHeight || 260
				});
			}
			c.setOption({
				backgroundColor: "transparent",
				tooltip: {
					trigger: "item",
					...CHART_TOOLTIP_SURFACE,
					backgroundColor: themeColor$3("--ds-card-inner", "#FFFFFF"),
					borderColor: themeColor$3("--ds-border", "#E5E7EB"),
					textStyle: {
						fontSize: 12,
						color: themeColor$3("--ds-text", "#111827")
					},
					formatter: (p) => {
						const range = rangeTip(filtered);
						const val = mode === "token" ? Number(p.value).toLocaleString() + " tokens" : Number(p.value).toLocaleString() + " 次请求";
						const pct = Number(p.percent || 0).toFixed(1);
						let html = `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px;">${p.marker || ""}${p.name}</div>`;
						html += `<div style="display:flex;gap:16px;"><span>用量</span><span style="margin-left:auto;font-weight:600;">${val}</span></div>`;
						html += `<div style="display:flex;gap:16px;"><span>占比</span><span style="margin-left:auto;font-weight:600;">${pct} %</span></div>`;
						if (others.length && String(p.name || "").startsWith("其他")) html += `<div style="margin-top:4px;font-size:11px;color:${themeColor$3("--ds-text-3", "#9CA3AF")};max-width:220px;white-space:normal;">含 ${others.map((n) => esc(n)).join("、")}</div>`;
						if (range) html += `<div style="margin-top:4px;font-size:11px;color:#9CA3AF;">时间范围 ${range}</div>`;
						return `<div style="padding:2px 2px;min-width:170px;">${html}</div>`;
					}
				},
				legend: {
					type: "scroll",
					bottom: 0,
					icon: "circle",
					itemWidth: 8,
					itemHeight: 8,
					itemGap: narrow ? 8 : 12,
					textStyle: {
						fontSize: 12,
						color: themeColor$3("--ds-text-2", "#6B7280")
					},
					pageIconSize: 10,
					pageTextStyle: {
						fontSize: 11,
						color: themeColor$3("--ds-text-3", "#9CA3AF")
					},
					formatter: (name) => shortModelName(name, narrow ? 12 : 18)
				},
				series: [{
					type: "pie",
					radius: narrow ? ["30%", "54%"] : ["38%", "64%"],
					center: ["50%", narrow ? "45%" : "43%"],
					avoidLabelOverlap: true,
					itemStyle: {
						borderRadius: 6,
						borderColor: themeColor$3("--ds-card-inner", "#FFFFFF"),
						borderWidth: 2
					},
					label: narrow ? { show: false } : {
						show: true,
						fontSize: 12,
						color: themeColor$3("--ds-text-2", "#6B7280"),
						formatter: (p) => shortModelName(String(p?.name || ""), 14)
					},
					labelLine: narrow ? { show: false } : {
						show: true,
						length: 8,
						length2: 10,
						lineStyle: { color: themeColor$3("--ds-border", "#E5E7EB") }
					},
					data
				}]
			}, true);
			setTimeout(() => {
				try {
					c.resize();
				} catch {}
			}, 60);
			return;
		}
		const yKeys = Array.from(state$1[id].y);
		const xKey = state$1[id].x;
		if (!yKeys.length) {
			dropChart(id);
			el.innerHTML = "<div style=\"text-align:center;padding:30px;color:var(--ds-text-3);font-size:var(--aus-fs-sm);\">请选择 Y 轴</div>";
			return;
		}
		if (xKey === "round") {
			const labels = filtered.map((_, i) => `#${i + 1}`);
			const tips = filtered.map((e, i) => roundTip(i + 1, e?.timestamp));
			const yMeta = new Map(CHART_DEFS[id].yOpts.map((o) => [o.key, o]));
			await drawBarLine(el, id, labels, yKeys.map((k) => {
				const meta = yMeta.get(k) || Y_OPTIONS.find((o) => o.key === k) || {
					label: k,
					color: "var(--ds-text-2)"
				};
				const data = filtered.map((e) => {
					const v = getYValue(e, k);
					return Number(v.toFixed(k.includes("cost") || k === "hit_rate" ? 2 : 0));
				});
				return {
					key: k,
					name: meta.label,
					data,
					color: meta.color,
					kind: meta.kind || "token"
				};
			}), tips);
			return;
		}
		const buckets = /* @__PURE__ */ new Map();
		filtered.forEach((e) => {
			const key = bucketKey$1(e.timestamp, xKey, 0);
			const ts = Number(e?.timestamp) || 0;
			const bucket = buckets.get(key);
			if (!bucket) buckets.set(key, {
				list: [e],
				first: ts,
				last: ts
			});
			else {
				bucket.list.push(e);
				if (ts && (!bucket.first || ts < bucket.first)) bucket.first = ts;
				if (ts > bucket.last) bucket.last = ts;
			}
		});
		const sortedKeys = Array.from(buckets.keys()).sort();
		const labels = sortedKeys.map((k) => xKey === "day" ? k.slice(5).replace("-", "/") : xKey === "hour" ? k.slice(5) : k);
		const tips = sortedKeys.map((k) => {
			const bucket = buckets.get(k);
			return bucketTip(xKey, bucket.first, bucket.last) || k;
		});
		new Map(CHART_DEFS[id].yOpts.map((o) => [o.key, o]));
		const fullMap = new Map([...Y_OPTIONS, ...CHART_DEFS[id].yOpts].map((o) => [o.key, o]));
		await drawBarLine(el, id, labels, yKeys.map((k) => {
			const meta = fullMap.get(k) || {
				label: k,
				color: "var(--ds-text-2)",
				kind: "token"
			};
			let data;
			if (k === "hit_rate") data = sortedKeys.map((key) => {
				const arr = buckets.get(key).list;
				let hit = 0, tot = 0;
				for (const e of arr) {
					hit += e.cache_hit_tokens || 0;
					tot += (e.cache_hit_tokens || 0) + (e.cache_miss_tokens || 0);
				}
				return tot ? Number((hit / tot * 100).toFixed(1)) : 0;
			});
			else if (k === "duration") data = sortedKeys.map((key) => {
				const arr = buckets.get(key).list;
				const avg = arr.reduce((a, c) => a + (c.duration || 0), 0) / arr.length / 1e3;
				return Number(avg.toFixed(1));
			});
			else if (k === "rate") data = sortedKeys.map((key) => {
				const valid = buckets.get(key).list.map((c) => c.tokenRate || 0).filter((v) => v > 0);
				if (!valid.length) return 0;
				const avg = valid.reduce((a, c) => a + c, 0) / valid.length;
				return Math.round(avg);
			});
			else if (k === "req_count") data = sortedKeys.map((key) => buckets.get(key).list.length);
			else data = sortedKeys.map((key) => {
				const arr = buckets.get(key).list;
				let sum = 0;
				for (const e of arr) sum += getYValue(e, k);
				return Number(sum.toFixed(k.includes("cost") ? 2 : 0));
			});
			return {
				key: k,
				name: meta.label,
				data,
				color: meta.color,
				kind: meta.kind || "token"
			};
		}), tips);
	} catch (e) {
		dropChart(id);
		try {
			const el2 = getDoc$9().getElementById(`aus-chart-${id}`);
			if (el2) el2.innerHTML = "<div style=\"text-align:center;padding:20px;color:#DC2626;font-size:var(--aus-fs-sm);\">图表加载失败: " + (e?.message || e) + "</div>";
		} catch {}
		try {
			console.error("[Api-Usage] renderOne failed", id, e);
		} catch {}
	}
}
function calcXInterval(labels, el) {
	const w = el.clientWidth || 320;
	const maxLabels = Math.max(8, Math.floor(w / (w < 500 ? 42 : w < 760 ? 56 : 68)));
	if (labels.length <= maxLabels) return 0;
	return Math.ceil(labels.length / maxLabels) - 1;
}
/** 按系列名判断数值单位，悬浮窗据此显示单位（费用按当前显示币种） */
function seriesUnit(name) {
	const n = String(name || "");
	if (n.includes("费用") || n.includes("成本")) return "cost";
	if (n.includes("率") || n.includes("占比")) return "percent";
	if (n.includes("速率")) return "rate";
	if (n.includes("耗时") || n.includes("延迟")) return "duration";
	if (n.includes("请求")) return "count";
	return "token";
}
async function drawBarLine(el, id, labels, series, tips = []) {
	try {
		const curCur = (() => {
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
		if (curCur.code === "USD") {
			for (const s of series) if (s.kind === "cost" || s.name.includes("费用") || s.name.toLowerCase().includes("cost")) s.data = s.data.map((v) => Number((Number(v) / curCur.rate).toFixed(4)));
		}
		const ec = await getEcharts$1();
		let c = charts$1[id];
		if (!c || c.isDisposed?.()) {
			el.innerHTML = "";
			el.style.height = "290px";
			c = charts$1[id] = ec.init(el, void 0, {
				width: el.clientWidth || 320,
				height: el.clientHeight || 290
			});
		}
		const isTokenCost = id === "token" || id === "cost";
		const savedZoom = getChartRange("extra-" + id);
		calcXInterval(labels, el);
		const opts = {
			backgroundColor: "transparent",
			tooltip: {
				trigger: "axis",
				...CHART_TOOLTIP_SURFACE,
				backgroundColor: themeColor$3("--ds-card-inner", "#FFFFFF"),
				borderColor: themeColor$3("--ds-border", "#E5E7EB"),
				textStyle: { fontSize: 12 },
				formatter: (params) => {
					const list = Array.isArray(params) ? params : [params];
					if (!list.length) return "";
					let html = `<div style="font-weight:600;margin-bottom:6px;">${tips[list[0].dataIndex] || list[0].axisValueLabel || ""}</div>`;
					for (const p of sortTooltipParams(list)) {
						const unit = seriesUnit(p.seriesName);
						const v = Number(p.value);
						let disp;
						if (unit === "percent") disp = v.toFixed(1) + " %";
						else if (unit === "rate") disp = Math.round(v).toLocaleString() + " t/s";
						else if (unit === "duration") disp = v.toFixed(2) + " s";
						else if (unit === "count") disp = v.toLocaleString() + " 次";
						else disp = v.toLocaleString() + " tokens";
						html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;font-weight:600;">${disp}</span></div>`;
					}
					return `<div style="padding:4px 2px;min-width:170px;">${html}</div>`;
				}
			},
			grid: {
				left: 40,
				right: 20,
				top: 8,
				bottom: labels.length > 12 ? 62 : 46
			},
			xAxis: {
				type: "category",
				data: labels,
				axisLine: { lineStyle: { color: themeColor$3("--ds-border", "#E5E7EB") } },
				axisLabel: {
					fontSize: 12,
					color: themeColor$3("--ds-text-3", "#9CA3AF"),
					rotate: labels.length > 12 ? 30 : 0,
					interval: "auto",
					hideOverlap: false
				}
			},
			yAxis: {
				type: "value",
				axisLabel: {
					fontSize: 12,
					color: themeColor$3("--ds-text-3", "#9CA3AF")
				},
				splitLine: { lineStyle: { color: themeColor$3("--ds-card", "#F5F6F7") } }
			},
			dataZoom: labels.length > 1 ? [{
				type: "inside",
				xAxisIndex: 0,
				start: savedZoom?.start ?? 0,
				end: savedZoom?.end ?? 100,
				zoomOnMouseWheel: false,
				moveOnMouseMove: true,
				zoomLock: true
			}] : void 0,
			series: (() => {
				const drawSeries = tokenStackDrawOrder(series);
				const barIndices = drawSeries.map((s, i) => ({
					s,
					i
				})).filter(({ s }) => !(isTokenCost && s.name.includes("总"))).map(({ i }) => i);
				const topIdx = barIndices.length ? barIndices[barIndices.length - 1] : -1;
				const BAR_MAX_WIDTH = 16;
				const topRadius = barTopRadius(estimateBarWidth(el?.clientWidth || 320, 60, labels.length, BAR_MAX_WIDTH));
				return drawSeries.map((s, idx) => {
					const isTotal = s.name.includes("总");
					if (isTokenCost && isTotal) return {
						name: s.name,
						type: "line",
						data: s.data,
						smooth: true,
						lineStyle: {
							color: s.color,
							width: 2
						},
						itemStyle: { color: s.color },
						symbolSize: 2
					};
					const isTop = idx === topIdx;
					return {
						name: s.name,
						type: "bar",
						stack: "total",
						data: s.data,
						itemStyle: {
							color: s.color,
							borderRadius: isTop ? topRadius : BAR_SQUARE
						},
						barMaxWidth: BAR_MAX_WIDTH,
						barGap: "-100%"
					};
				});
			})()
		};
		if (id === "cost") {
			opts.yAxis = {
				type: "value",
				axisLabel: {
					fontSize: 12,
					color: themeColor$3("--ds-text-3", "#9CA3AF"),
					formatter: (v) => curCur.symbol + Number(v).toFixed(2)
				},
				splitLine: { lineStyle: { color: themeColor$3("--ds-card", "#F5F6F7") } }
			};
			opts.tooltip = {
				trigger: "axis",
				...CHART_TOOLTIP_SURFACE,
				backgroundColor: themeColor$3("--ds-card-inner", "#FFFFFF"),
				borderColor: themeColor$3("--ds-border", "#E5E7EB"),
				textStyle: { fontSize: 12 },
				formatter: (params) => {
					let html = `<div style="font-weight:600;margin-bottom:6px;">${tips[params[0]?.dataIndex ?? 0] || params[0]?.axisValueLabel || ""}</div>`;
					for (const p of sortTooltipParams(Array.isArray(params) ? params : [params])) html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;font-weight:600;">${curCur.symbol}${Number(p.value).toFixed(4)} ${curCur.code}</span></div>`;
					return `<div style="padding:4px 2px;min-width:160px;">${html}</div>`;
				}
			};
		}
		if (id === "hit") {
			opts.series = [{
				name: "命中率",
				type: "line",
				data: series[0].data,
				areaStyle: {
					opacity: .12,
					color: series[0].color
				},
				lineStyle: { color: series[0].color },
				itemStyle: { color: series[0].color },
				smooth: true
			}];
			opts.yAxis = {
				max: 100,
				axisLabel: { formatter: (v) => v + "%" }
			};
		}
		if (id === "dur") {
			opts.yAxis = [{
				type: "value",
				name: "耗时 s",
				position: "left",
				axisLabel: {
					fontSize: 12,
					color: themeColor$3("--ds-text-3", "#9CA3AF")
				},
				splitLine: { lineStyle: { color: themeColor$3("--ds-card", "#F5F6F7") } }
			}, {
				type: "value",
				name: "速率 t/s",
				position: "right",
				axisLabel: {
					fontSize: 12,
					color: themeColor$3("--ds-text-3", "#9CA3AF")
				},
				splitLine: { show: false }
			}];
			opts.series = series.map((s) => ({
				name: s.name,
				type: "line",
				yAxisIndex: s.name.includes("速率") || s.name.toLowerCase().includes("rate") ? 1 : 0,
				data: s.data,
				smooth: true,
				symbolSize: 4,
				lineStyle: {
					color: s.color,
					width: 2
				},
				itemStyle: { color: s.color },
				areaStyle: s.name.includes("耗时") ? {
					opacity: .08,
					color: s.color
				} : void 0
			}));
		}
		c.setOption(opts, true);
		attachChartZoom({
			doc: getDoc$9(),
			chart: c,
			container: el,
			left: 40,
			right: 20,
			bottom: 2,
			enabled: labels.length > 1,
			rangeKey: "extra-" + id
		});
		setTimeout(() => {
			try {
				c.resize();
			} catch {}
		}, 60);
	} catch (e) {
		dropChart(id);
		try {
			el.innerHTML = "<div style=\"text-align:center;padding:20px;color:#DC2626;font-size:var(--aus-fs-sm);\">图表渲染失败</div>";
		} catch {}
		try {
			console.error("[Api-Usage] drawBarLine failed", id, e);
		} catch {}
	}
}
function initExtraCharts() {
	const doc = getDoc$9();
	for (const id of Object.keys(CHART_DEFS)) {
		if (!CHART_DEFS[id].hasX) continue;
		renderExtraY(id);
		renderExtraX(id);
	}
	for (const id of Object.keys(CHART_DEFS)) {
		if (!CHART_DEFS[id].hasX) continue;
		const yBtn = doc.getElementById(`aus-extra-y-btn-${id}`);
		const yDrop = doc.getElementById(`aus-extra-y-drop-${id}`);
		const xBtn = doc.getElementById(`aus-extra-x-btn-${id}`);
		const xDrop = doc.getElementById(`aus-extra-x-drop-${id}`);
		if (yBtn && yDrop) yBtn.onclick = () => {
			const willOpen = yDrop.style.display !== "block";
			yDrop.style.display = willOpen ? "block" : "none";
			if (willOpen) {
				if (xDrop) xDrop.style.display = "none";
				renderExtraY(id);
			}
		};
		if (xBtn && xDrop) xBtn.onclick = () => {
			const willOpen = xDrop.style.display !== "block";
			xDrop.style.display = willOpen ? "block" : "none";
			if (willOpen) {
				if (yDrop) yDrop.style.display = "none";
				renderExtraX(id);
			}
		};
	}
	const pieToggle = doc.getElementById("aus-pie-toggle");
	const pieToggleVal = doc.getElementById("aus-pie-toggle-val");
	if (pieToggle) {
		const paintPieToggle = () => {
			if (pieToggleVal) pieToggleVal.textContent = state$1.pie.pieMode === "token" ? "Token" : "次数";
		};
		paintPieToggle();
		pieToggle.onclick = () => {
			state$1.pie.pieMode = state$1.pie.pieMode === "token" ? "count" : "token";
			paintPieToggle();
			persistExtraPrefs("pie");
			renderOne$1("pie", lastFiltered$1);
		};
	}
	doc.addEventListener("click", (e) => {
		const t = e.target;
		for (const id of Object.keys(CHART_DEFS)) {
			if (!CHART_DEFS[id].hasX) continue;
			const yDrop = doc.getElementById(`aus-extra-y-drop-${id}`);
			const yBtn = doc.getElementById(`aus-extra-y-btn-${id}`);
			const xDrop = doc.getElementById(`aus-extra-x-drop-${id}`);
			const xBtn = doc.getElementById(`aus-extra-x-btn-${id}`);
			if (yDrop && yBtn && !t.closest(`#aus-extra-y-drop-${id}`) && !t.closest(`#aus-extra-y-btn-${id}`)) yDrop.style.display = "none";
			if (xDrop && xBtn && !t.closest(`#aus-extra-x-drop-${id}`) && !t.closest(`#aus-extra-x-btn-${id}`)) xDrop.style.display = "none";
		}
	});
}
function renderExtraY(id) {
	const doc = getDoc$9();
	const drop = doc.getElementById(`aus-extra-y-drop-${id}`);
	const label = doc.getElementById(`aus-extra-y-label-${id}`);
	if (!drop) return;
	const opts = CHART_DEFS[id].yOpts;
	const sel = state$1[id].y;
	if (label) label.textContent = sel.size ? `${sel.size} 项` : "选择";
	drop.innerHTML = opts.map((o) => {
		const checked = sel.has(o.key);
		return `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:var(--aus-fs-sm);${checked ? "background:var(--ds-card);" : ""}"><input type="checkbox" data-y="${o.key}" data-chart="${id}" ${checked ? "checked" : ""} class="aus-checkbox" /><span style="display:inline-block;width:8px;height:8px;background:${o.color};border-radius:2px;"></span>${o.label}<span style="margin-left:auto;color:var(--ds-text-3);font-size:var(--aus-fs-sm);">${o.unit}</span></label>`;
	}).join("");
	drop.querySelectorAll("input[data-y]").forEach((el) => {
		el.onchange = () => {
			const k = el.getAttribute("data-y"), cid = el.getAttribute("data-chart");
			if (el.checked) state$1[cid].y.add(k);
			else if (state$1[cid].y.size > 1) state$1[cid].y.delete(k);
			else el.checked = true;
			persistExtraPrefs(cid);
			renderExtraY(cid);
			afterNextPaint(() => renderOne$1(cid, lastFiltered$1));
		};
	});
}
function renderExtraX(id) {
	const doc = getDoc$9();
	const drop = doc.getElementById(`aus-extra-x-drop-${id}`);
	const label = doc.getElementById(`aus-extra-x-label-${id}`);
	if (!drop) return;
	const options = id === "req" ? X_OPTIONS_WITHOUT_ROUND : X_OPTIONS;
	const cur = state$1[id].x;
	if (label) label.textContent = options.find((o) => o.key === cur)?.label || cur;
	drop.innerHTML = options.map((o) => {
		const active = o.key === cur;
		return `<div data-x="${o.key}" data-chart="${id}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active ? "background:var(--ds-card);font-weight:600;" : ""}">${o.label}</div>`;
	}).join("");
	drop.querySelectorAll("[data-x]").forEach((el) => {
		el.onclick = () => {
			const k = el.getAttribute("data-x"), cid = el.getAttribute("data-chart");
			state$1[cid].x = k;
			persistExtraPrefs(cid);
			closeDropdownThenPaint(drop, () => {
				renderExtraX(cid);
				renderOne$1(cid, lastFiltered$1);
			});
		};
	});
}
//#endregion
//#region src/ui/model-trends.ts
var MODEL_COLORS = [
	"#0BA25E",
	"#6366F1",
	"#FF6A00",
	"#10B981",
	"#F59E0B",
	"#8B5CF6",
	"#EF4444",
	"#06B6D4",
	"#84CC16",
	"#E11D48",
	"#0EA5E9",
	"#F97316",
	"#14B8A6",
	"#A855F7",
	"#EAB308",
	"#22C55E"
];
var state = {
	token: { x: "day" },
	req: { x: "day" }
};
function getDoc$8() {
	return window.parent?.document ?? document;
}
function themeColor$2(name, fallback) {
	try {
		const doc = getDoc$8();
		const el = doc.getElementById("aus-panel") || doc.documentElement;
		return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
	} catch {
		return fallback;
	}
}
function bucketKey(ts, x, idx) {
	if (x === "round") return `#${idx + 1}`;
	if (x === "hour") {
		const d = new Date(ts);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
	}
	if (x === "day") return localDay(ts);
	if (x === "week") {
		const d = new Date(ts);
		const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
		const dayNum = tmp.getUTCDay() || 7;
		tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
		const weekNo = Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
		return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
	}
	if (x === "month") {
		const d = new Date(ts);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	}
	return localDay(ts);
}
async function getEcharts() {
	const ec = await import("./core-fg_o3xmJ.js");
	const { LineChart } = await import("./charts-BstuNsfd.js");
	const { GridComponent, TooltipComponent, LegendComponent, DataZoomInsideComponent } = await import("./components-CpGqNjDG.js");
	const { CanvasRenderer } = await import("./renderers-DtxFY9_W.js");
	ec.use([
		LineChart,
		GridComponent,
		TooltipComponent,
		LegendComponent,
		DataZoomInsideComponent,
		CanvasRenderer
	]);
	return ec;
}
var charts = {};
var lastFiltered = [];
function renderModelTrends(filtered) {
	lastFiltered = filtered || [];
	renderOne("token", filtered);
	renderOne("req", filtered);
}
async function renderOne(id, filtered) {
	try {
		const doc = getDoc$8();
		const el = doc.getElementById(`aus-chart-model-${id}`);
		if (!el) return;
		const xKey = state[id].x;
		if (!filtered.length) {
			if (charts[id]) {
				try {
					detachChartZoom(charts[id]);
				} catch {}
				try {
					charts[id].dispose();
				} catch {}
			}
			charts[id] = null;
			el.innerHTML = "<div style=\"text-align:center;padding:40px;color:var(--ds-text-3);font-size:var(--aus-fs-sm);\">暂无数据</div>";
			return;
		}
		const modelSet = /* @__PURE__ */ new Set();
		for (const e of filtered) modelSet.add(e.model || "unknown");
		const models = Array.from(modelSet).sort();
		const colorMap = /* @__PURE__ */ new Map();
		models.forEach((m, i) => colorMap.set(m, MODEL_COLORS[i % MODEL_COLORS.length]));
		let labels = [];
		let seriesData = [];
		if (xKey === "round") {
			labels = filtered.map((_, i) => `#${i + 1}`);
			seriesData = models.map((m) => {
				const col = colorMap.get(m);
				return {
					name: m,
					data: filtered.map((e) => {
						if ((e.model || "unknown") !== m) return 0;
						return id === "token" ? e.total_tokens || 0 : 1;
					}),
					color: col
				};
			});
		} else {
			const buckets = /* @__PURE__ */ new Map();
			filtered.forEach((_, idx) => {
				const e = filtered[idx];
				const key = bucketKey(e.timestamp, xKey, idx);
				if (!buckets.has(key)) buckets.set(key, []);
				buckets.get(key).push(e);
			});
			const sortedKeys = Array.from(buckets.keys()).sort();
			labels = sortedKeys.map((k) => xKey === "day" ? k.slice(5).replace("-", "/") : xKey === "hour" ? k.slice(5) : k);
			seriesData = models.map((m) => {
				const col = colorMap.get(m);
				return {
					name: m,
					data: sortedKeys.map((key) => {
						const arr = buckets.get(key);
						let sum = 0;
						for (const e of arr) if ((e.model || "unknown") === m) sum += id === "token" ? e.total_tokens || 0 : 1;
						return sum;
					}),
					color: col
				};
			});
		}
		const w = el.clientWidth;
		const h = el.clientHeight;
		if (w === 0 || h === 0) {
			const statsView = doc.querySelector("[data-view=\"stats\"]");
			if (statsView ? statsView.style.display === "none" || statsView.offsetParent === null : false) return;
			const tries = renderOne._retryCount || 0;
			if (tries >= 20) {
				el.innerHTML = "<div style=\"text-align:center;padding:20px;color:var(--ds-text-3);font-size:var(--aus-fs-sm);\">图表容器未就绪</div>";
				return;
			}
			renderOne._retryCount = tries + 1;
			setTimeout(() => renderOne(id, filtered), 120);
			return;
		}
		renderOne._retryCount = 0;
		const ec = await getEcharts();
		let c = charts[id];
		if (!c || c.isDisposed?.()) {
			el.innerHTML = "";
			el.style.height = "250px";
			c = charts[id] = ec.init(el, void 0, {
				width: el.clientWidth || 320,
				height: el.clientHeight || 250
			});
		}
		const cBorder = themeColor$2("--ds-border", "#E5E7EB");
		const cCard = themeColor$2("--ds-card", "#F5F6F7");
		const cText3 = themeColor$2("--ds-text-3", "#9CA3AF");
		const cCardInner = themeColor$2("--ds-card-inner", "#FFFFFF");
		const cText = themeColor$2("--ds-text", "#111827");
		const cw = w || 320;
		const maxLabels = Math.max(8, Math.floor(cw / (cw < 500 ? 42 : cw < 760 ? 56 : 68)));
		labels.length <= maxLabels || Math.ceil(labels.length / maxLabels) - 1;
		const savedZoom = getChartRange("trend-" + id);
		const legendTop = models.length > 4 ? 2 : 0;
		c.setOption({
			backgroundColor: "transparent",
			tooltip: {
				trigger: "axis",
				backgroundColor: cCardInner,
				borderColor: cBorder,
				borderWidth: 1,
				...CHART_TOOLTIP_SURFACE,
				textStyle: {
					color: cText,
					fontSize: 12
				},
				formatter: (params) => {
					if (!params?.length) return "";
					const idx = params[0].dataIndex;
					const label = labels[idx];
					let sum = 0;
					for (const p of params) sum += Number(p.value || 0);
					let html = `<div style="font-weight:600;margin-bottom:6px;">${esc(label)}<span style="margin-left:8px;color:var(--ds-text-2);font-weight:400;">合计 ${id === "token" ? sum.toLocaleString() + " tokens" : sum + " 次"}</span></div>`;
					for (const p of params) {
						if (Number(p.value) === 0) continue;
						html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${esc(p.seriesName)}<span style="margin-left:auto;font-weight:600;">${id === "token" ? Number(p.value).toLocaleString() + " tokens" : p.value + " 次"}</span></div>`;
					}
					if (!params.some((p) => Number(p.value) > 0)) html += `<div style="color:var(--ds-text-3);font-size:var(--aus-fs-sm);">本${xKey === "day" ? "日" : xKey === "hour" ? "时段" : xKey === "week" ? "周" : xKey === "month" ? "月" : "轮次"}无数据</div>`;
					return `<div style="padding:4px 2px;min-width:180px;max-width:280px;">${html}</div>`;
				}
			},
			legend: {
				top: legendTop,
				type: "scroll",
				textStyle: {
					fontSize: 12,
					color: cText3
				},
				pageIconColor: cText3,
				pageTextStyle: { color: cText3 },
				itemWidth: 10,
				itemHeight: 6
			},
			grid: {
				left: 42,
				right: 16,
				top: 22 + (models.length > 4 ? 8 : 0),
				bottom: labels.length > 12 ? 62 : 46
			},
			dataZoom: labels.length > 1 ? [{
				type: "inside",
				xAxisIndex: 0,
				start: savedZoom?.start ?? 0,
				end: savedZoom?.end ?? 100,
				zoomOnMouseWheel: false,
				moveOnMouseMove: true,
				zoomLock: true
			}] : void 0,
			xAxis: {
				type: "category",
				data: labels,
				boundaryGap: false,
				axisLine: { lineStyle: { color: cBorder } },
				axisLabel: {
					color: cText3,
					fontSize: 12,
					interval: "auto",
					rotate: labels.length > 12 ? 30 : 0,
					hideOverlap: false
				}
			},
			yAxis: {
				type: "value",
				axisLabel: {
					color: cText3,
					fontSize: 12,
					formatter: (v) => id === "token" ? v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : String(v) : String(v)
				},
				splitLine: { lineStyle: { color: cCard } }
			},
			series: seriesData.map((s) => ({
				name: s.name,
				type: "line",
				smooth: true,
				symbol: "none",
				lineStyle: {
					width: 1.5,
					color: s.color
				},
				itemStyle: { color: s.color },
				areaStyle: {
					color: s.color,
					opacity: .18
				},
				emphasis: { focus: "series" },
				data: s.data
			}))
		}, true);
		attachChartZoom({
			doc,
			chart: c,
			container: el,
			left: 42,
			right: 16,
			bottom: 2,
			enabled: labels.length > 1,
			rangeKey: "trend-" + id
		});
		setTimeout(() => {
			try {
				c.resize();
			} catch {}
		}, 60);
	} catch (e) {
		if (charts[id]) {
			try {
				detachChartZoom(charts[id]);
			} catch {}
			try {
				charts[id].dispose();
			} catch {}
			charts[id] = null;
		}
		try {
			const el2 = getDoc$8().getElementById(`aus-chart-model-${id}`);
			if (el2) el2.innerHTML = "<div style=\"text-align:center;padding:20px;color:#DC2626;font-size:var(--aus-fs-sm);\">图表加载失败</div>";
		} catch {}
		try {
			console.error("[Api-Usage] renderModelTrends failed", id, e);
		} catch {}
	}
}
function initModelTrends() {
	const doc = getDoc$8();
	for (const id of ["token", "req"]) {
		const btn = doc.getElementById(`aus-modeltrends-x-btn-${id}`);
		const drop = doc.getElementById(`aus-modeltrends-x-drop-${id}`);
		if (btn && drop) btn.onclick = () => {
			drop.style.display = drop.style.display === "block" ? "none" : "block";
			if (drop.style.display === "block") renderXDrop(id);
		};
	}
	doc.addEventListener("click", (e) => {
		const t = e.target;
		for (const id of ["token", "req"]) {
			const btn = doc.getElementById(`aus-modeltrends-x-btn-${id}`);
			const drop = doc.getElementById(`aus-modeltrends-x-drop-${id}`);
			if (btn && drop && !t.closest(`#aus-modeltrends-x-btn-${id}`) && !t.closest(`#aus-modeltrends-x-drop-${id}`)) drop.style.display = "none";
		}
	});
}
function renderXDrop(id) {
	const doc = getDoc$8();
	const drop = doc.getElementById(`aus-modeltrends-x-drop-${id}`);
	const label = doc.getElementById(`aus-modeltrends-x-label-${id}`);
	if (!drop) return;
	const cur = state[id].x;
	if (label) label.textContent = X_OPTIONS.find((o) => o.key === cur)?.label || cur;
	drop.innerHTML = X_OPTIONS.map((o) => {
		const active = o.key === cur;
		return `<div data-x="${o.key}" data-trend="${id}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active ? "background:var(--ds-card);font-weight:600;" : ""}">${o.label}</div>`;
	}).join("");
	drop.querySelectorAll("[data-x]").forEach((el) => {
		el.onclick = () => {
			const k = el.getAttribute("data-x"), tid = el.getAttribute("data-trend");
			state[tid].x = k;
			closeDropdownThenPaint(drop, () => {
				renderXDrop(tid);
				renderOne(tid, lastFiltered);
			});
		};
	});
}
//#endregion
//#region src/ui/filter-prefs.ts
/**
* 统计页 / 历史记录页筛选状态的持久化（时间维度、模型、对话、接入类型、API 密钥）。
*
* 为什么放 localStorage 而不是 settings：与 `chart-prefs.ts`、`aus_forecast_prefs_v1`
* 同一定位——纯展示偏好，不进导出、不参与 WebDAV 同步、不污染 `extensionSettings`。
* 读写全部包在 try/catch 内，宿主禁用存储或隐私模式时静默退化为内存态，
* 页面行为退回到「每次打开都是默认筛选」，不影响功能可用性。
*
* 只做「整段读、按分片合并写」：stats 与 history 各自一片，
* 这样改统计页筛选不会覆盖历史页已保存的筛选。
*/
var FILTER_PREFS_KEY = "aus_filter_prefs_v1";
var STATS_RANGE_KEYS = [
	"today",
	"yesterday",
	"7d",
	"30d",
	"month",
	"lastMonth",
	"custom",
	"all"
];
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var HISTORY_KEYS = [
	"model",
	"chat",
	"endpoint",
	"credential"
];
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function storage() {
	try {
		const store = globalThis.localStorage;
		return store && typeof store.getItem === "function" && typeof store.setItem === "function" ? store : null;
	} catch {
		return null;
	}
}
/** 时间维度白名单校验；非法值返回 undefined（调用方保留默认值） */
function normalizeRange(value) {
	return typeof value === "string" && STATS_RANGE_KEYS.includes(value) ? value : void 0;
}
/** 自定义日期校验：空串合法（未填写），非空必须 YYYY-MM-DD */
function normalizeDate(value) {
	if (typeof value !== "string") return void 0;
	if (value === "") return "";
	return DATE_RE.test(value) ? value : void 0;
}
function normalizeText(value) {
	return typeof value === "string" && value ? value : void 0;
}
function normalizeModels(value) {
	if (!Array.isArray(value)) return void 0;
	const out = [];
	for (const item of value) {
		if (typeof item !== "string" || !item) continue;
		if (!out.includes(item)) out.push(item);
	}
	return out;
}
function normalizeStatsPrefs(value) {
	const out = {};
	if (!isPlainObject(value)) return out;
	const range = normalizeRange(value.range);
	if (range) out.range = range;
	const start = normalizeDate(value.customStart);
	if (start !== void 0) out.customStart = start;
	const end = normalizeDate(value.customEnd);
	if (end !== void 0) out.customEnd = end;
	const models = normalizeModels(value.models);
	if (models) out.models = models;
	const chat = normalizeText(value.chat);
	if (chat) out.chat = chat;
	const endpoint = normalizeText(value.endpoint);
	if (endpoint) out.endpoint = endpoint;
	const credential = normalizeText(value.credential);
	if (credential) out.credential = credential;
	return out;
}
function normalizeHistoryPrefs(value) {
	const out = {};
	if (!isPlainObject(value)) return out;
	for (const key of HISTORY_KEYS) {
		const text = normalizeText(value[key]);
		if (text) out[key] = text;
	}
	return out;
}
/** 读取全部筛选偏好；损坏数据或不可用存储统一回退为空对象（调用方按默认值处理） */
function readFilterPrefs() {
	const store = storage();
	if (store) try {
		const raw = store.getItem(FILTER_PREFS_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (isPlainObject(parsed)) return {
				stats: normalizeStatsPrefs(parsed.stats),
				history: normalizeHistoryPrefs(parsed.history)
			};
		}
	} catch {}
	return {
		stats: {},
		history: {}
	};
}
/** 按分片合并写入（只覆盖 patch 里出现的字段与分片，其余保持不变；内容无变化时跳过写入） */
function writeFilterPrefs(patch) {
	const store = storage();
	if (!store) return;
	try {
		const raw = store.getItem(FILTER_PREFS_KEY);
		const current = readFilterPrefs();
		const next = {
			stats: {
				...current.stats,
				...normalizeStatsPrefs(patch.stats)
			},
			history: {
				...current.history,
				...normalizeHistoryPrefs(patch.history)
			}
		};
		const serialized = JSON.stringify(next);
		if (raw === serialized) return;
		store.setItem(FILTER_PREFS_KEY, serialized);
	} catch {}
}
//#endregion
//#region src/ui/stats-view.ts
var DEFAULT_RANGE = "30d";
var currentRange = DEFAULT_RANGE;
var customStart = "";
var customEnd = "";
var pickerOpen = false;
var selectedModels = [];
var modelPickerOpen = false;
var selectedChat = STATS_FILTER_ALL;
var chatPickerOpen = false;
var selectedEndpoint = STATS_FILTER_ALL;
var endpointPickerOpen = false;
var selectedCredential = STATS_FILTER_ALL;
var credentialPickerOpen = false;
var lastStatsHistory = [];
var restoredStatsPrefs = readFilterPrefs().stats;
if (restoredStatsPrefs.range) currentRange = restoredStatsPrefs.range;
if (typeof restoredStatsPrefs.customStart === "string") customStart = restoredStatsPrefs.customStart;
if (typeof restoredStatsPrefs.customEnd === "string") customEnd = restoredStatsPrefs.customEnd;
if (restoredStatsPrefs.models) selectedModels = restoredStatsPrefs.models.slice();
if (restoredStatsPrefs.chat) selectedChat = restoredStatsPrefs.chat;
if (restoredStatsPrefs.endpoint) selectedEndpoint = restoredStatsPrefs.endpoint;
if (restoredStatsPrefs.credential) selectedCredential = restoredStatsPrefs.credential;
function persistStatsFilters() {
	writeFilterPrefs({ stats: {
		range: currentRange,
		customStart,
		customEnd,
		models: selectedModels.slice(),
		chat: selectedChat,
		endpoint: selectedEndpoint,
		credential: selectedCredential
	} });
}
function resetStatsFilters() {
	const doc = getDoc$7();
	currentRange = DEFAULT_RANGE;
	customStart = "";
	customEnd = "";
	selectedModels = [];
	selectedChat = STATS_FILTER_ALL;
	selectedEndpoint = STATS_FILTER_ALL;
	selectedCredential = STATS_FILTER_ALL;
	pickerOpen = false;
	modelPickerOpen = false;
	chatPickerOpen = false;
	endpointPickerOpen = false;
	credentialPickerOpen = false;
	[
		"aus-range-dropdown",
		"aus-model-dropdown",
		"aus-chat-dropdown",
		"aus-endpoint-dropdown",
		"aus-credential-dropdown"
	].forEach((id) => {
		const el = doc.getElementById(id);
		if (el) el.style.display = "none";
	});
	updatePickerLabel();
	renderStatsView();
}
var summarySort = {
	key: null,
	dir: "desc"
};
var lastSummaryFiltered = null;
function updateSummarySortHeader() {
	paintSortHeader(getDoc$7(), "aus-model-summary", summarySort);
}
function bindSummarySort() {
	bindSortableHeaders(getDoc$7(), "aus-model-summary", summarySort, () => {
		if (lastSummaryFiltered) renderModelSummary(lastSummaryFiltered);
	});
}
function getDoc$7() {
	return window.parent?.document ?? document;
}
function themeColor$1(name, fallback) {
	try {
		const doc = getDoc$7();
		const el = doc.getElementById("aus-panel") || doc.documentElement;
		return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
	} catch {
		return fallback;
	}
}
function getRangeDates() {
	const today = localDay(Date.now());
	const d = /* @__PURE__ */ new Date(today + "T00:00:00");
	const fmt = (x) => localDay(x.getTime());
	switch (currentRange) {
		case "today": return {
			start: today,
			end: today
		};
		case "yesterday": {
			const y = new Date(d);
			y.setDate(y.getDate() - 1);
			const s = fmt(y);
			return {
				start: s,
				end: s
			};
		}
		case "7d": {
			const s = new Date(d);
			s.setDate(s.getDate() - 6);
			return {
				start: fmt(s),
				end: today
			};
		}
		case "30d": {
			const s = new Date(d);
			s.setDate(s.getDate() - 29);
			return {
				start: fmt(s),
				end: today
			};
		}
		case "month": return {
			start: fmt(new Date(d.getFullYear(), d.getMonth(), 1)),
			end: today
		};
		case "lastMonth": {
			const s = new Date(d.getFullYear(), d.getMonth() - 1, 1);
			const e = new Date(d.getFullYear(), d.getMonth(), 0);
			return {
				start: fmt(s),
				end: fmt(e)
			};
		}
		case "custom": return {
			start: customStart || today,
			end: customEnd || today
		};
		case "all": return {
			start: "2020-01-01",
			end: today
		};
	}
	return {
		start: today,
		end: today
	};
}
function getRecordedModels(history) {
	const set = /* @__PURE__ */ new Set();
	for (const h of history || []) if (h?.model) set.add(h.model);
	return Array.from(set).sort();
}
function getRecordedChatsFrom(list) {
	const map = /* @__PURE__ */ new Map();
	for (const h of list || []) {
		const cid = h.chatId ?? null;
		const cname = h.chatName ?? null;
		const key = cid ?? "__null__";
		const timestamp = Number(h?.timestamp) || 0;
		if (!map.has(key)) map.set(key, {
			chatId: cid,
			chatName: cname,
			lastSeen: timestamp
		});
		else {
			const current = map.get(key);
			if (timestamp >= current.lastSeen && cname) current.chatName = cname;
			if (timestamp > current.lastSeen) current.lastSeen = timestamp;
		}
	}
	return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen).map((v) => {
		let display = v.chatName || "";
		if (!display) {
			if (v.chatId) display = v.chatId.length > 18 ? v.chatId.slice(0, 8) + "…" + v.chatId.slice(-4) : v.chatId;
			else display = "未分组/旧数据";
		}
		return {
			chatId: v.chatId,
			chatName: v.chatName,
			displayName: display
		};
	});
}
function currentStatsFilter() {
	const { start, end } = getRangeDates();
	return {
		start,
		end,
		model: selectedModels.length ? selectedModels : STATS_FILTER_ALL,
		chat: selectedChat,
		endpoint: selectedEndpoint,
		credential: selectedCredential
	};
}
function updateRangeHighlight() {
	const doc = getDoc$7();
	doc.querySelectorAll("[data-range]").forEach((el) => {
		if (el.getAttribute("data-range") === currentRange) {
			el.style.background = "var(--ds-card)";
			el.style.fontWeight = "600";
		} else {
			el.style.background = "";
			el.style.fontWeight = "";
		}
	});
	const calWrap = doc.getElementById("aus-date-calendar");
	if (calWrap) calWrap.style.display = currentRange === "custom" ? "block" : "none";
}
function renderCalendar() {
	const doc = getDoc$7();
	const cal = doc.getElementById("aus-date-calendar");
	if (!cal) return;
	updateRangeHighlight();
	if (currentRange !== "custom") return;
	const todayStr = localDay(Date.now());
	if (!customStart) customStart = todayStr;
	if (!customEnd) customEnd = todayStr;
	cal.innerHTML = `<div style="padding:12px;min-width:260px;display:grid;gap:10px;">
    <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">开始日期</div><input type="date" id="aus-custom-start" value="${customStart}" max="${todayStr}" style="width:100%;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);box-sizing:border-box;"></div>
    <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-bottom:4px;">结束日期</div><input type="date" id="aus-custom-end" value="${customEnd}" max="${todayStr}" style="width:100%;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);box-sizing:border-box;"></div>
    <button id="aus-custom-apply" style="padding:8px 12px;border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);border:none;font-size:var(--aus-fs-base);cursor:pointer;">应用</button>
  </div>`;
	const startEl = doc.getElementById("aus-custom-start");
	const endEl = doc.getElementById("aus-custom-end");
	const applyBtn = doc.getElementById("aus-custom-apply");
	const apply = () => {
		if (startEl) customStart = startEl.value || todayStr;
		if (endEl) customEnd = endEl.value || todayStr;
		if (customStart > customEnd) {
			const t = customStart;
			customStart = customEnd;
			customEnd = t;
			if (startEl) startEl.value = customStart;
			if (endEl) endEl.value = customEnd;
		}
		updatePickerLabel();
		updateRangeHighlight();
		renderStatsView();
	};
	if (startEl) startEl.onchange = apply;
	if (endEl) endEl.onchange = apply;
	if (applyBtn) applyBtn.onclick = apply;
}
function updatePickerLabel() {
	const label = getDoc$7().getElementById("aus-range-label");
	if (!label) return;
	const map = {
		all: "全部",
		today: "今天",
		yesterday: "昨天",
		"7d": "近 7 天",
		"30d": "近 30 天",
		month: "本月",
		lastMonth: "上月",
		custom: "自定义"
	};
	if (currentRange === "custom" && customStart && customEnd) label.textContent = customStart === customEnd ? customStart : `${customStart} ~ ${customEnd}`;
	else label.textContent = map[currentRange] || "近 30 天";
	updateRangeHighlight();
}
function renderModelPicker(modelsHist) {
	const doc = getDoc$7();
	const dropdown = doc.getElementById("aus-model-dropdown");
	const label = doc.getElementById("aus-model-label");
	if (!dropdown || !label) return;
	const models = getRecordedModels(modelsHist);
	const validModels = new Set(models);
	selectedModels = selectedModels.filter((model) => validModels.has(model));
	const allSelected = selectedModels.length === 0;
	label.textContent = allSelected ? "全部" : selectedModels.length === 1 ? selectedModels[0] : `已选 ${selectedModels.length} 项`;
	label.title = allSelected ? "全部模型" : selectedModels.join("、");
	let html = `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${allSelected ? "background:var(--ds-card);font-weight:600;" : ""}"><input type="checkbox" data-model-all ${allSelected ? "checked" : ""} class="aus-checkbox" /><span>全部模型</span></label>`;
	for (const m of models) {
		const checked = selectedModels.includes(m);
		html += `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${checked ? "background:var(--ds-card);font-weight:600;" : ""}"><input type="checkbox" data-model="${esc(m)}" ${checked ? "checked" : ""} class="aus-checkbox" /><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(m)}</span></label>`;
	}
	if (!models.length) html += "<div style=\"padding:8px 10px;color:var(--ds-text-3);font-size:var(--aus-fs-base);\">暂无模型</div>";
	dropdown.innerHTML = html;
	const allInput = dropdown.querySelector("[data-model-all]");
	if (allInput) allInput.onchange = () => {
		selectedModels = [];
		closeDropdownThenPaint(dropdown, () => renderStatsView());
	};
	dropdown.querySelectorAll("input[data-model]").forEach((el) => {
		el.onchange = () => {
			const model = el.getAttribute("data-model") || "";
			if (!model) return;
			if (el.checked) {
				if (!selectedModels.includes(model)) selectedModels.push(model);
			} else selectedModels = selectedModels.filter((item) => item !== model);
			closeDropdownThenPaint(dropdown, () => renderStatsView());
		};
	});
}
function renderChatPicker(chatHist) {
	const doc = getDoc$7();
	const dropdown = doc.getElementById("aus-chat-dropdown");
	const label = doc.getElementById("aus-chat-label");
	if (!dropdown || !label) return;
	const fullList = chatHist ? getRecordedChatsFrom(chatHist) : getRecordedChatsFrom(getSelectedSave()?.history || []);
	const list = filterPickerRows(fullList);
	const find = fullList.find((c) => (c.chatId ?? "__null__") === selectedChat);
	label.textContent = selectedChat === "__all__" ? "全部" : find?.displayName || selectedChat;
	label.title = find?.chatId || find?.displayName || "";
	let html = `<div data-chat="__all__" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${selectedChat === "__all__" ? "background:var(--ds-card);font-weight:600;" : ""}">全部</div>`;
	for (const c of list) {
		const key = c.chatId ?? "__null__";
		const active = key === selectedChat ? "background:var(--ds-card);font-weight:600;" : "";
		html += `<div data-chat="${esc(key)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active}" title="${esc(c.chatId || "")}">${esc(c.displayName)}</div>`;
	}
	if (!list.length) html += "<div style=\"padding:8px 10px;color:var(--ds-text-3);font-size:var(--aus-fs-base);\">" + (fullList.length ? "对话已全部隐藏（可在「对话展示管理」中恢复）" : "暂无对话") + "</div>";
	dropdown.innerHTML = html;
	dropdown.querySelectorAll("[data-chat]").forEach((el) => {
		el.onclick = () => {
			selectedChat = el.getAttribute("data-chat") || "__all__";
			chatPickerOpen = false;
			closeDropdownThenPaint(dropdown, () => {
				renderChatPicker(chatHist);
				renderStatsView();
			});
		};
	});
}
function renderEndpointPicker(history) {
	const doc = getDoc$7();
	const dropdown = doc.getElementById("aus-endpoint-dropdown");
	const label = doc.getElementById("aus-endpoint-label");
	if (!dropdown || !label) return;
	const options = getEndpointFilterOptions(history || []);
	const current = options.find((option) => option.id === selectedEndpoint);
	label.textContent = selectedEndpoint === "__all__" ? "全部" : selectedEndpoint === "__unknown__" ? "未记录接入" : current?.label || selectedEndpoint;
	label.title = label.textContent;
	const optionHtml = (id, text, title) => {
		const active = id === selectedEndpoint ? "background:var(--ds-card);font-weight:600;" : "";
		return `<div data-endpoint="${esc(id)}" title="${esc(title)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active}">${esc(text)}</div>`;
	};
	let html = optionHtml(STATS_FILTER_ALL, "全部", "全部");
	for (const option of options) html += optionHtml(option.id, option.label, option.label);
	if (!options.length) html += "<div style=\"padding:8px 10px;color:var(--ds-text-3);font-size:var(--aus-fs-base);\">暂无接入记录</div>";
	dropdown.innerHTML = html;
	dropdown.querySelectorAll("[data-endpoint]").forEach((el) => {
		el.onclick = () => {
			selectedEndpoint = el.getAttribute("data-endpoint") || "__all__";
			selectedCredential = STATS_FILTER_ALL;
			endpointPickerOpen = false;
			closeDropdownThenPaint(dropdown, () => renderStatsView());
		};
	});
}
function renderCredentialPicker$1(history, endpoint = selectedEndpoint) {
	const doc = getDoc$7();
	const dropdown = doc.getElementById("aus-credential-dropdown");
	const label = doc.getElementById("aus-credential-label");
	if (!dropdown || !label) return;
	const options = getCredentialFilterOptions(history || [], endpoint);
	const current = options.find((option) => option.id === selectedCredential);
	label.textContent = selectedCredential === "__all__" ? "全部" : selectedCredential === "__unknown__" ? "未识别密钥" : current?.label || selectedCredential;
	label.title = label.textContent;
	const optionHtml = (id, text, title) => {
		const active = id === selectedCredential ? "background:var(--ds-card);font-weight:600;" : "";
		return `<div data-credential="${esc(id)}" title="${esc(title)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active}">${esc(text)}</div>`;
	};
	let html = optionHtml(STATS_FILTER_ALL, "全部", "全部");
	for (const option of options) html += optionHtml(option.id, option.label, option.label);
	if (!options.length) html += "<div style=\"padding:8px 10px;color:var(--ds-text-3);font-size:var(--aus-fs-base);\">暂无密钥记录</div>";
	dropdown.innerHTML = html;
	dropdown.querySelectorAll("[data-credential]").forEach((el) => {
		el.onclick = () => {
			selectedCredential = el.getAttribute("data-credential") || "__all__";
			credentialPickerOpen = false;
			closeDropdownThenPaint(dropdown, () => renderStatsView());
		};
	});
}
function positionFilterDropdown(btn, dropdown) {
	try {
		const panel = getDoc$7().getElementById("aus-panel");
		if (!panel) return;
		const panelRect = panel.getBoundingClientRect();
		const btnRect = btn.getBoundingClientRect();
		const available = Math.max(160, panelRect.width - 16);
		dropdown.style.maxWidth = `${available}px`;
		dropdown.style.boxSizing = "border-box";
		const width = Math.min(dropdown.offsetWidth || 220, available);
		const buttonLeft = btnRect.left - panelRect.left;
		const desiredLeft = Math.max(8, Math.min(buttonLeft, panelRect.width - width - 8));
		dropdown.style.left = `${desiredLeft - buttonLeft}px`;
		dropdown.style.right = "auto";
	} catch {}
}
function closeFilterDropdowns(except) {
	const doc = getDoc$7();
	if (except !== "range") {
		pickerOpen = false;
		const el = doc.getElementById("aus-range-dropdown");
		if (el) el.style.display = "none";
	}
	if (except !== "model") {
		modelPickerOpen = false;
		const el = doc.getElementById("aus-model-dropdown");
		if (el) el.style.display = "none";
	}
	if (except !== "chat") {
		chatPickerOpen = false;
		const el = doc.getElementById("aus-chat-dropdown");
		if (el) el.style.display = "none";
	}
	if (except !== "endpoint") {
		endpointPickerOpen = false;
		const el = doc.getElementById("aus-endpoint-dropdown");
		if (el) el.style.display = "none";
	}
	if (except !== "credential") {
		credentialPickerOpen = false;
		const el = doc.getElementById("aus-credential-dropdown");
		if (el) el.style.display = "none";
	}
}
function bindPicker() {
	const doc = getDoc$7();
	const btn = doc.getElementById("aus-range-btn");
	const dropdown = doc.getElementById("aus-range-dropdown");
	if (btn && dropdown) {
		btn.onclick = () => {
			pickerOpen = !pickerOpen;
			closeFilterDropdowns("range");
			dropdown.style.display = pickerOpen ? "flex" : "none";
			if (pickerOpen) {
				renderCalendar();
				positionFilterDropdown(btn, dropdown);
			}
		};
		doc.querySelectorAll("[data-range]").forEach((el) => {
			el.onclick = () => {
				const r = el.getAttribute("data-range");
				currentRange = r;
				if (r !== "custom") {
					customStart = "";
					customEnd = "";
				}
				pickerOpen = false;
				updatePickerLabel();
				closeDropdownThenPaint(dropdown, () => renderStatsView());
			};
		});
	}
	const mBtn = doc.getElementById("aus-model-btn");
	const mDropdown = doc.getElementById("aus-model-dropdown");
	if (mBtn && mDropdown) mBtn.onclick = () => {
		modelPickerOpen = !modelPickerOpen;
		closeFilterDropdowns("model");
		mDropdown.style.display = modelPickerOpen ? "block" : "none";
		if (modelPickerOpen) {
			renderModelPicker(lastStatsHistory);
			positionFilterDropdown(mBtn, mDropdown);
		}
	};
	const cBtn = doc.getElementById("aus-chat-btn");
	const cDropdown = doc.getElementById("aus-chat-dropdown");
	if (cBtn && cDropdown) cBtn.onclick = () => {
		chatPickerOpen = !chatPickerOpen;
		closeFilterDropdowns("chat");
		cDropdown.style.display = chatPickerOpen ? "block" : "none";
		if (chatPickerOpen) (async () => {
			try {
				renderChatPicker(await getHistoryForStats());
			} catch {
				renderChatPicker();
			}
			positionFilterDropdown(cBtn, cDropdown);
		})();
	};
	const eBtn = doc.getElementById("aus-endpoint-btn");
	const eDropdown = doc.getElementById("aus-endpoint-dropdown");
	if (eBtn && eDropdown) eBtn.onclick = () => {
		endpointPickerOpen = !endpointPickerOpen;
		closeFilterDropdowns("endpoint");
		eDropdown.style.display = endpointPickerOpen ? "block" : "none";
		if (endpointPickerOpen) {
			renderEndpointPicker(lastStatsHistory);
			positionFilterDropdown(eBtn, eDropdown);
		}
	};
	const kBtn = doc.getElementById("aus-credential-btn");
	const kDropdown = doc.getElementById("aus-credential-dropdown");
	if (kBtn && kDropdown) kBtn.onclick = () => {
		credentialPickerOpen = !credentialPickerOpen;
		closeFilterDropdowns("credential");
		kDropdown.style.display = credentialPickerOpen ? "block" : "none";
		if (credentialPickerOpen) {
			renderCredentialPicker$1(lastStatsHistory);
			positionFilterDropdown(kBtn, kDropdown);
		}
	};
	const statsResetBtn = doc.getElementById("aus-stats-filter-reset");
	if (statsResetBtn) statsResetBtn.onclick = () => {
		resetStatsFilters();
	};
	doc.addEventListener("click", (e) => {
		const t = e.target;
		if (pickerOpen && !t.closest("#aus-range-dropdown") && !t.closest("#aus-range-btn")) {
			pickerOpen = false;
			const d = doc.getElementById("aus-range-dropdown");
			if (d) d.style.display = "none";
		}
		if (modelPickerOpen && !t.closest("#aus-model-dropdown") && !t.closest("#aus-model-btn")) {
			modelPickerOpen = false;
			const d = doc.getElementById("aus-model-dropdown");
			if (d) d.style.display = "none";
		}
		if (chatPickerOpen && !t.closest("#aus-chat-dropdown") && !t.closest("#aus-chat-btn")) {
			chatPickerOpen = false;
			const d = doc.getElementById("aus-chat-dropdown");
			if (d) d.style.display = "none";
		}
		if (endpointPickerOpen && !t.closest("#aus-endpoint-dropdown") && !t.closest("#aus-endpoint-btn")) {
			endpointPickerOpen = false;
			const d = doc.getElementById("aus-endpoint-dropdown");
			if (d) d.style.display = "none";
		}
		if (credentialPickerOpen && !t.closest("#aus-credential-dropdown") && !t.closest("#aus-credential-btn")) {
			credentialPickerOpen = false;
			const d = doc.getElementById("aus-credential-dropdown");
			if (d) d.style.display = "none";
		}
	});
}
var chartYOpen = false;
var chartXOpen = false;
function renderChartSelectors() {
	const doc = getDoc$7();
	const yBtn = doc.getElementById("aus-chart-y-btn");
	const xBtn = doc.getElementById("aus-chart-x-btn");
	const yDrop = doc.getElementById("aus-chart-y-dropdown");
	const xDrop = doc.getElementById("aus-chart-x-dropdown");
	const yLabel = doc.getElementById("aus-chart-y-label");
	const xLabel = doc.getElementById("aus-chart-x-label");
	if (!yBtn || !xBtn || !yDrop || !xDrop) return;
	const ySel = getYSelected();
	if (yLabel) yLabel.textContent = ySel.length ? `${ySel.length} 项` : "选择";
	let yHtml = "";
	for (const group of Y_GROUPS) {
		const opts = Y_OPTIONS.filter((o) => o.group === group.key);
		if (!opts.length) continue;
		yHtml += `<div style="padding:6px 8px 2px;font-size:var(--aus-fs-xs);color:var(--ds-text-3);font-weight:600;">${group.label}</div>`;
		for (const opt of opts) {
			const checked = ySel.includes(opt.key);
			yHtml += `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:var(--aus-fs-sm);${checked ? "background:var(--ds-card);" : ""}"><input type="checkbox" data-ykey="${opt.key}" ${checked ? "checked" : ""} class="aus-checkbox" /><span style="display:inline-block;width:8px;height:8px;background:${opt.color};border-radius:2px;"></span>${opt.label}<span style="margin-left:auto;color:var(--ds-text-3);font-size:var(--aus-fs-sm);">${opt.unit}</span></label>`;
		}
	}
	const typeSel = getChartType();
	const typeOpts = [
		{
			v: "auto",
			l: "自动"
		},
		{
			v: "bar",
			l: "柱状"
		},
		{
			v: "line",
			l: "曲线"
		},
		{
			v: "area",
			l: "面积"
		}
	];
	yHtml += `<div style="margin-top:4px;border-top:1px solid var(--ds-border);padding:6px 8px 2px;font-size:var(--aus-fs-xs);color:var(--ds-text-3);font-weight:600;">展示方式</div>`;
	yHtml += `<div style="display:flex;gap:4px;flex-wrap:wrap;padding:2px 6px 6px;">${typeOpts.map((t) => `<div data-chart-type="${t.v}" style="padding:4px 9px;border-radius:999px;border:1px solid var(--ds-border);font-size:var(--aus-fs-sm);cursor:pointer;${typeSel === t.v ? "background:var(--ds-card);font-weight:600;" : ""}">${t.l}</div>`).join("")}</div>`;
	const axisSel = getAxisLabelMode();
	const axisOpts = [
		{
			v: "auto",
			l: "自动"
		},
		{
			v: "all",
			l: "全部"
		},
		{
			v: "hide",
			l: "隐藏"
		}
	];
	yHtml += `<div style="padding:2px 8px 2px;font-size:var(--aus-fs-xs);color:var(--ds-text-3);font-weight:600;">轴标签</div>`;
	yHtml += `<div style="display:flex;gap:4px;flex-wrap:wrap;padding:2px 6px 8px;align-items:center;"><span style="font-size:var(--aus-fs-xs);color:var(--ds-text-3);">左右轴合计 &gt; 2 时默认隐藏叠加</span>${axisOpts.map((a) => `<div data-axis-label="${a.v}" style="padding:4px 9px;border-radius:999px;border:1px solid var(--ds-border);font-size:var(--aus-fs-sm);cursor:pointer;${axisSel === a.v ? "background:var(--ds-card);font-weight:600;" : ""}">${a.l}</div>`).join("")}</div>`;
	yDrop.innerHTML = yHtml;
	yDrop.querySelectorAll("input[data-ykey]").forEach((el) => {
		el.onchange = () => {
			toggleY(el.getAttribute("data-ykey"));
			closeDropdownThenPaint(yDrop, () => {
				renderChartSelectors();
				renderStatsView();
			});
		};
	});
	yDrop.querySelectorAll("[data-chart-type]").forEach((el) => {
		el.onclick = () => {
			setChartType(el.getAttribute("data-chart-type"));
			closeDropdownThenPaint(yDrop, () => {
				renderChartSelectors();
				renderStatsView();
			});
		};
	});
	yDrop.querySelectorAll("[data-axis-label]").forEach((el) => {
		el.onclick = () => {
			setAxisLabelMode(el.getAttribute("data-axis-label"));
			closeDropdownThenPaint(yDrop, () => {
				renderChartSelectors();
				renderStatsView();
			});
		};
	});
	const xSel = getXSelected();
	const xMap = {
		round: "轮次",
		hour: "每小时",
		day: "每日",
		week: "每周",
		month: "每月"
	};
	if (xLabel) xLabel.textContent = xMap[xSel] || xSel;
	let xHtml = "";
	for (const opt of X_OPTIONS) {
		const active = opt.key === xSel;
		xHtml += `<div data-xkey="${opt.key}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active ? "background:var(--ds-card);font-weight:600;" : ""}">${opt.label}</div>`;
	}
	xDrop.innerHTML = xHtml;
	xDrop.querySelectorAll("[data-xkey]").forEach((el) => {
		el.onclick = () => {
			setXSelected(el.getAttribute("data-xkey"));
			chartXOpen = false;
			closeDropdownThenPaint(xDrop, () => {
				renderChartSelectors();
				renderStatsView();
			});
		};
	});
}
function bindChartSelectors() {
	const doc = getDoc$7();
	const yBtn = doc.getElementById("aus-chart-y-btn");
	const yDrop = doc.getElementById("aus-chart-y-dropdown");
	const xBtn = doc.getElementById("aus-chart-x-btn");
	const xDrop = doc.getElementById("aus-chart-x-dropdown");
	if (yBtn && yDrop) yBtn.onclick = () => {
		chartYOpen = !chartYOpen;
		yDrop.style.display = chartYOpen ? "block" : "none";
		if (chartYOpen) {
			const xD = doc.getElementById("aus-chart-x-dropdown");
			if (xD) {
				xD.style.display = "none";
				chartXOpen = false;
			}
			renderChartSelectors();
		}
	};
	if (xBtn && xDrop) xBtn.onclick = () => {
		chartXOpen = !chartXOpen;
		xDrop.style.display = chartXOpen ? "block" : "none";
		if (chartXOpen) {
			const yD = doc.getElementById("aus-chart-y-dropdown");
			if (yD) {
				yD.style.display = "none";
				chartYOpen = false;
			}
			renderChartSelectors();
		}
	};
	doc.addEventListener("click", (e) => {
		const t = e.target;
		if (chartYOpen && !t.closest("#aus-chart-y-dropdown") && !t.closest("#aus-chart-y-btn")) {
			chartYOpen = false;
			const d = doc.getElementById("aus-chart-y-dropdown");
			if (d) d.style.display = "none";
		}
		if (chartXOpen && !t.closest("#aus-chart-x-dropdown") && !t.closest("#aus-chart-x-btn")) {
			chartXOpen = false;
			const d = doc.getElementById("aus-chart-x-dropdown");
			if (d) d.style.display = "none";
		}
	});
	renderChartSelectors();
}
var chart = null;
var rangeZoom = null;
async function renderChart(filteredRaw) {
	const doc = getDoc$7();
	const el = doc.getElementById("aus-stats-chart");
	if (!el) return;
	const { labels, series, tips } = aggregateForChart(filteredRaw, getYSelected(), getXSelected());
	if (!labels.length) {
		if (chart) {
			try {
				chart.dispose();
			} catch {}
			chart = null;
		}
		if (chart) try {
			detachChartZoom(chart);
		} catch {}
		if (rangeZoom) {
			try {
				rangeZoom.destroy();
			} catch {}
			rangeZoom = null;
		}
		el.innerHTML = "<div style=\"text-align:center;padding:40px;color:var(--ds-text-3);font-size:var(--aus-fs-base);\">该筛选无数据（历史 " + filteredRaw.length + " 条）</div>";
		return;
	}
	const w = el.clientWidth, h = el.clientHeight;
	if (w === 0 || h === 0) {
		const statsView = doc.querySelector("[data-view=\"stats\"]");
		if (statsView ? statsView.style.display === "none" || statsView.offsetParent === null : false) {
			try {
				const { log } = await import("./logger-8RGXnvfI.js").then((n) => n.n);
				log.debug("renderChart 容器隐藏，等待切换");
			} catch {}
			return;
		}
		const tries = renderChart._retryCount || 0;
		if (tries >= 80) {
			el.innerHTML = "<div style=\"text-align:center;padding:20px;color:var(--ds-text-3);font-size:var(--aus-fs-sm);\">图表容器未就绪，请切换视图重试</div>";
			return;
		}
		renderChart._retryCount = tries + 1;
		setTimeout(() => renderChart(filteredRaw), 120);
		return;
	}
	renderChart._retryCount = 0;
	let echarts;
	try {
		echarts = await import("./core-fg_o3xmJ.js").then(async (ec) => {
			const { BarChart, LineChart } = await import("./charts-BstuNsfd.js");
			const { GridComponent, TooltipComponent, DataZoomInsideComponent } = await import("./components-CpGqNjDG.js");
			const { CanvasRenderer } = await import("./renderers-DtxFY9_W.js");
			ec.use([
				BarChart,
				LineChart,
				GridComponent,
				TooltipComponent,
				DataZoomInsideComponent,
				CanvasRenderer
			]);
			return ec;
		});
	} catch (e) {
		el.innerHTML = "<div style=\"text-align:center;padding:20px;color:#DC2626;font-size:var(--aus-fs-base);\">图表加载失败，请检查网络后重试</div>";
		console.error("[Api-Usage] echarts load failed", e);
		return;
	}
	if (!chart) chart = echarts.init(el);
	else try {
		chart.resize();
	} catch {}
	const kinds = new Set(series.map((s) => s.kind));
	const hasToken = kinds.has("token");
	const hasCost = kinds.has("cost");
	const hasCount = kinds.has("count");
	const hasDuration = kinds.has("duration");
	const hasRate = kinds.has("rate");
	const hasPercent = kinds.has("percent");
	const chartType = getChartType();
	const cBorder = themeColor$1("--ds-border", "#E5E7EB");
	const cCard = themeColor$1("--ds-card", "#F5F6F7");
	const cText3 = themeColor$1("--ds-text-3", "#9CA3AF");
	const curCur = (() => {
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
	if (hasCost) {
		for (const s of series) if (s.kind === "cost") s.data = s.data.map((v) => curCur.code === "USD" ? Number((Number(v) / curCur.rate).toFixed(4)) : v);
	}
	const narrow = w < 560;
	const labelSize = narrow ? 10 : 12;
	const axisGap = narrow ? 40 : 46;
	const compactNum = (v) => {
		const n = Number(v);
		if (!isFinite(n)) return "0";
		if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(Math.abs(n) % 1e4 ? 1 : 0) + "万";
		if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(Math.abs(n) % 1e3 ? 1 : 0) + "k";
		return String(Math.round(n));
	};
	const yAxis = [];
	const axisIndex = {};
	let rightOffset = 0;
	const labelStyle = {
		color: cText3,
		fontSize: labelSize
	};
	const addAxis = (key, cfg, left = false, gap = axisGap) => {
		const axis = {
			type: "value",
			...cfg
		};
		if (left) axis.position = "left";
		else {
			axis.position = "right";
			axis.offset = rightOffset;
			rightOffset += gap;
		}
		axisIndex[key] = yAxis.length;
		yAxis.push(axis);
	};
	if (hasToken) addAxis("token", {
		name: narrow ? "" : "tokens",
		axisLine: { show: false },
		splitLine: { lineStyle: { color: cCard } },
		axisLabel: {
			...labelStyle,
			formatter: compactNum
		}
	}, true);
	if (hasCount) addAxis("count", {
		name: narrow ? "" : "次",
		minInterval: 1,
		axisLine: { show: false },
		splitLine: { show: false },
		axisLabel: narrow ? { show: false } : labelStyle
	}, !hasToken, narrow ? 12 : axisGap);
	if (hasCost) addAxis("cost", {
		name: narrow ? "" : curCur.code,
		axisLine: { show: false },
		splitLine: { show: false },
		axisLabel: {
			...labelStyle,
			formatter: (v) => curCur.symbol + Number(v).toFixed(narrow ? 3 : 4)
		}
	});
	if (hasDuration) addAxis("duration", {
		name: narrow ? "" : "耗时 s",
		axisLine: { show: false },
		splitLine: { show: false },
		axisLabel: {
			...labelStyle,
			formatter: (v) => Number(v).toFixed(1)
		}
	});
	if (hasRate) addAxis("rate", {
		name: narrow ? "" : "速率 t/s",
		axisLine: { show: false },
		splitLine: { show: false },
		axisLabel: {
			...labelStyle,
			formatter: (v) => Math.round(v)
		}
	});
	if (hasPercent) addAxis("percent", {
		name: narrow ? "" : "%",
		min: 0,
		max: 100,
		axisLine: { show: false },
		splitLine: { show: false },
		axisLabel: {
			...labelStyle,
			formatter: (v) => v + "%"
		}
	});
	const axisMode = getAxisLabelMode();
	const totalAxisCount = yAxis.length;
	if (axisMode === "hide" || axisMode === "auto" && totalAxisCount > 2) {
		for (const axis of yAxis) {
			if (axis.position !== "right") continue;
			axis.name = "";
			axis.axisLabel = {
				...axis.axisLabel || {},
				show: false
			};
			axis.axisLine = { show: false };
			axis.axisTick = { show: false };
			axis.offset = 0;
		}
		rightOffset = 0;
	}
	const BAR_MAX_WIDTH = 18;
	const barWidth = estimateBarWidth(w || 320, narrow ? 70 : 104, labels.length, BAR_MAX_WIDTH);
	const drawSeries = tokenStackDrawOrder(series);
	const tokenSeries = drawSeries.filter((s) => s.kind === "token");
	const lastTokenIdx = tokenSeries.length ? drawSeries.indexOf(tokenSeries[tokenSeries.length - 1]) : -1;
	const seriesOpt = drawSeries.map((s, idx) => {
		const kind = s.kind;
		let type;
		if (chartType === "bar") type = "bar";
		else if (chartType === "line" || chartType === "area") type = "line";
		else type = kind === "token" || kind === "count" ? "bar" : "line";
		const isStack = kind === "token" && type === "bar";
		const isTop = idx === lastTokenIdx;
		let col = s.color;
		if (col === "#111827" || typeof col === "string" && col.indexOf("var(") === 0) col = themeColor$1("--ds-text", "#111827");
		const base = {
			name: s.name,
			type,
			yAxisIndex: axisIndex[kind] ?? 0,
			data: s.data,
			emphasis: { focus: "series" },
			itemStyle: { color: col }
		};
		if (type === "bar") {
			base.barMaxWidth = BAR_MAX_WIDTH;
			if (isStack) {
				base.stack = "token";
				base.barGap = "-100%";
			}
			const radius = barTopRadius(barWidth);
			base.itemStyle.borderRadius = isStack ? isTop ? radius : BAR_SQUARE : radius;
		} else {
			base.smooth = true;
			base.symbol = "circle";
			base.symbolSize = 4;
			base.lineStyle = {
				color: col,
				width: kind === "percent" ? 1.6 : 2,
				type: kind === "percent" ? "dashed" : "solid"
			};
			if (chartType === "area" || chartType === "auto" && kind === "percent") base.areaStyle = {
				color: col,
				opacity: .08
			};
		}
		return base;
	});
	const cCardInner = themeColor$1("--ds-card-inner", "#FFFFFF");
	const cText = themeColor$1("--ds-text", "#111827");
	const cw = w || 320;
	const maxLabels = Math.max(8, Math.floor(cw / (cw < 500 ? 42 : cw < 760 ? 56 : 68)));
	const xInterval = labels.length <= maxLabels ? 0 : Math.ceil(labels.length / maxLabels) - 1;
	const showZoom = labels.length > 1;
	const savedZoom = getChartRange("stats-main");
	const gridLeft = narrow ? 40 : 50;
	const gridRight = 12 + rightOffset;
	chart.setOption({
		backgroundColor: "transparent",
		tooltip: {
			trigger: "axis",
			backgroundColor: cCardInner,
			borderColor: cBorder,
			borderWidth: 1,
			...CHART_TOOLTIP_SURFACE,
			textStyle: {
				color: cText,
				fontSize: 12
			},
			formatter: (params) => {
				if (!params?.length) return "";
				const idx = params[0].dataIndex;
				const label = tips[idx] || labels[idx];
				let html = `<div style="font-weight:600;margin-bottom:6px;">${esc(label)}</div>`;
				for (const p of sortTooltipParams(params)) {
					const v = p.value;
					const meta = Y_OPTIONS.find((o) => o.label === p.seriesName);
					const kind = meta?.kind;
					let disp;
					if (kind === "cost") disp = curCur.symbol + Number(v).toFixed(4) + " " + curCur.code;
					else if (kind === "percent") disp = Number(v).toFixed(1) + " %";
					else if (kind === "duration") disp = Number(v).toFixed(2) + " s";
					else if (kind === "rate") disp = Math.round(Number(v)) + " t/s";
					else if (kind === "count") disp = Number(v).toLocaleString() + " 次";
					else disp = Number(v).toLocaleString() + " " + (meta?.unit || "");
					html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${esc(p.seriesName)}<span style="margin-left:auto;font-weight:600;">${disp}</span></div>`;
				}
				return `<div style="padding:4px 2px;min-width:180px;">${html}</div>`;
			}
		},
		grid: {
			left: gridLeft,
			right: gridRight,
			top: 8,
			bottom: showZoom ? narrow ? 50 : 54 : 28
		},
		dataZoom: showZoom ? [{
			type: "inside",
			xAxisIndex: 0,
			start: savedZoom?.start ?? 0,
			end: savedZoom?.end ?? 100,
			zoomOnMouseWheel: false,
			moveOnMouseMove: true,
			zoomLock: true
		}] : void 0,
		xAxis: {
			type: "category",
			data: labels,
			axisLine: { lineStyle: { color: cBorder } },
			axisLabel: {
				color: cText3,
				fontSize: 12,
				interval: showZoom ? "auto" : xInterval,
				rotate: labels.length > 12 ? 30 : 0,
				hideOverlap: false
			}
		},
		yAxis: yAxis.length ? yAxis : {
			type: "value",
			axisLabel: {
				color: cText3,
				fontSize: 12
			}
		},
		series: seriesOpt
	}, true);
	rangeZoom = attachChartZoom({
		doc,
		chart,
		container: el,
		left: gridLeft,
		right: gridRight,
		bottom: narrow ? 2 : 4,
		enabled: showZoom,
		rangeKey: "stats-main"
	});
	setTimeout(() => {
		try {
			chart.resize();
		} catch {}
	}, 60);
}
function renderModelSummary(filtered) {
	const tbody = getDoc$7().getElementById("aus-summary-tbody");
	if (!tbody) return;
	lastSummaryFiltered = filtered;
	try {
		bindSummarySort();
	} catch {}
	try {
		updateSummarySortHeader();
	} catch {}
	if (!filtered.length) {
		tbody.innerHTML = "<tr><td colspan=\"10\" style=\"text-align:center;padding:16px;color:var(--ds-text-3);\">暂无数据</td></tr>";
		return;
	}
	const map = {};
	for (const h of filtered) {
		const m = h.model || "unknown";
		if (!map[m]) map[m] = {
			count: 0,
			hit: 0,
			miss: 0,
			out: 0,
			total: 0,
			cost: 0,
			dur: 0,
			rate: 0,
			rateCnt: 0
		};
		const e = map[m];
		e.count++;
		e.hit += h.cache_hit_tokens || 0;
		e.miss += h.cache_miss_tokens || 0;
		e.out += h.completion_tokens || 0;
		e.total += h.total_tokens || 0;
		e.cost += h.cost || 0;
		if (h.duration) e.dur += h.duration;
		if (h.tokenRate) {
			e.rate += h.tokenRate;
			e.rateCnt++;
		}
	}
	let list = Object.keys(map).map((m) => {
		const e = map[m];
		const avgCost = e.count ? e.cost / e.count : 0;
		const avgDurVal = e.count && e.dur ? e.dur / e.count : -1;
		const avgDurStr = e.count && e.dur ? (e.dur / e.count / 1e3).toFixed(1) + "s" : "—";
		const avgRateVal = e.rateCnt ? e.rate / e.rateCnt : -1;
		const avgRateStr = e.rateCnt ? Math.round(e.rate / e.rateCnt) + " t/s" : "—";
		return {
			m,
			count: e.count,
			hit: e.hit,
			miss: e.miss,
			out: e.out,
			total: e.total,
			cost: e.cost,
			avgCost,
			avgDurVal,
			avgRateVal,
			avgDurStr,
			avgRateStr
		};
	});
	const sortKey = summarySort.key;
	if (sortKey) {
		const dir = summarySort.dir === "asc" ? 1 : -1;
		const getVal = (r) => {
			switch (sortKey) {
				case "count": return r.count;
				case "hit": return r.hit;
				case "miss": return r.miss;
				case "out": return r.out;
				case "total": return r.total;
				case "cost": return r.cost;
				case "avgCost": return r.avgCost;
				case "avgDur": return r.avgDurVal;
				case "avgRate": return r.avgRateVal;
				default: return 0;
			}
		};
		list.sort((a, b) => {
			const av = getVal(a), bv = getVal(b);
			if (av === bv) return a.m.localeCompare(b.m);
			return (av - bv) * dir;
		});
	} else list.sort((a, b) => a.m.localeCompare(b.m));
	const fmtC = (v) => {
		try {
			return formatMoney(v || 0, 4);
		} catch {
			return "¥" + (v || 0).toFixed(4) + " CNY";
		}
	};
	tbody.innerHTML = list.map((r) => {
		return `<tr style="border-bottom:1px solid var(--ds-card);"><td style="padding:6px 8px;text-align:left;color:var(--ds-text);font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;">${esc(r.m)}</td><td style="padding:6px 8px;text-align:right;">${r.count}</td><td style="padding:6px 8px;text-align:right;color:#0BA25E;">${r.hit.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#DC2626;">${r.miss.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#6366F1;">${r.out.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;font-weight:600;">${r.total.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:var(--ds-text);">${fmtC(r.cost)}</td><td style="padding:6px 8px;text-align:right;">${fmtC(r.avgCost)}</td><td style="padding:6px 8px;text-align:right;color:var(--ds-text-2);">${r.avgDurStr}</td><td style="padding:6px 8px;text-align:right;color:#0BA25E;">${r.avgRateStr}</td></tr>`;
	}).join("");
}
var cachedAllHistory = null;
var allHistoryPromise = null;
var statsHistoryWarningShown = false;
function invalidateStatsCache() {
	cachedAllHistory = null;
	lastStatsHistory = [];
}
try {
	on(DataEvents.HISTORY_ADDED, invalidateStatsCache);
	on(DataEvents.UPDATED, invalidateStatsCache);
} catch {}
async function getHistoryForStats() {
	const hot = getSelectedSave()?.history || [];
	if (cachedAllHistory) {
		const keyOf = historyRecordKey;
		const seen = new Set(cachedAllHistory.map(keyOf));
		const fresh = hot.filter((h) => !seen.has(keyOf(h)));
		if (fresh.length) cachedAllHistory = [...fresh, ...cachedAllHistory].sort((a, b) => b.timestamp - a.timestamp);
		return cachedAllHistory;
	}
	if (allHistoryPromise) return allHistoryPromise;
	allHistoryPromise = (async () => {
		try {
			const mod = await import("./persistence-CaWdvByH.js").then((n) => n.l);
			if (mod.getAllHistory) {
				const result = await mod.getAllHistory() || hot;
				cachedAllHistory = result;
				return result;
			}
		} catch (error) {
			if (!statsHistoryWarningShown) {
				statsHistoryWarningShown = true;
				toast("warning", "冷历史读取失败，当前统计可能只包含近期记录");
			}
			console.error("[Api-Usage] 全量历史读取失败", error);
		} finally {
			allHistoryPromise = null;
		}
		cachedAllHistory = hot;
		return hot;
	})();
	return allHistoryPromise;
}
/** 视窗记忆签名：时间维度/筛选/X/Y/图表类型变化时重置为全量，仅页面切换时保留 */
var lastZoomSignature = "";
function currentZoomSignature() {
	const filter = currentStatsFilter();
	let chartType = "";
	try {
		chartType = getChartType();
	} catch {}
	return [
		currentRange,
		filter.start || "",
		filter.end || "",
		Array.isArray(filter.model) ? filter.model.join(",") : String(filter.model || ""),
		String(filter.chat || ""),
		String(filter.endpoint || ""),
		String(filter.credential || ""),
		String(getXSelected() || ""),
		getYSelected().join(","),
		chartType
	].join("|");
}
async function renderStatsView() {
	const doc = getDoc$7();
	if (!getSelectedSave()) return;
	const allHistory = await getHistoryForStats();
	lastStatsHistory = allHistory;
	const zoomSignature = currentZoomSignature();
	if (zoomSignature !== lastZoomSignature) {
		lastZoomSignature = zoomSignature;
		clearChartRanges();
	}
	const endpointOptions = getEndpointFilterOptions(allHistory);
	if (!(/* @__PURE__ */ new Set(["__all__", ...endpointOptions.map((option) => option.id)])).has(selectedEndpoint)) {
		selectedEndpoint = STATS_FILTER_ALL;
		selectedCredential = STATS_FILTER_ALL;
	}
	const credentialOptions = getCredentialFilterOptions(allHistory, selectedEndpoint);
	if (!(/* @__PURE__ */ new Set(["__all__", ...credentialOptions.map((option) => option.id)])).has(selectedCredential)) selectedCredential = STATS_FILTER_ALL;
	const summaryFiltered = filterStatsHistory(allHistory, currentStatsFilter());
	const chartFiltered = summaryFiltered;
	let totalCost = 0, totalReq = summaryFiltered.length, totalTok = 0;
	for (const e of summaryFiltered) {
		totalCost += e.cost || 0;
		totalTok += e.total_tokens || 0;
	}
	const costEl = doc.getElementById("aus-stats-cost");
	if (costEl) try {
		costEl.textContent = formatMoney(totalCost, 2);
	} catch {
		costEl.textContent = "¥" + totalCost.toFixed(2) + " CNY";
	}
	const reqEl = doc.getElementById("aus-stats-req");
	if (reqEl) reqEl.textContent = String(totalReq);
	const tokEl = doc.getElementById("aus-stats-tok");
	if (tokEl) tokEl.textContent = totalTok.toLocaleString("zh-CN");
	renderStatsFour(summaryFiltered);
	renderModelSummary(summaryFiltered);
	renderModelPicker(allHistory);
	renderChatPicker(allHistory);
	renderEndpointPicker(allHistory);
	renderCredentialPicker$1(allHistory);
	renderChartSelectors();
	const statsViewEl = doc.querySelector("[data-view=\"stats\"]");
	if (!(statsViewEl ? statsViewEl.style.display === "none" || statsViewEl.offsetParent === null : false)) {
		renderChart(chartFiltered);
		renderExtraCharts(chartFiltered);
		renderModelTrends(chartFiltered);
	} else try {
		const { log } = await import("./logger-8RGXnvfI.js").then((n) => n.n);
		log.debug("stats 隐藏，跳过图表初始化");
	} catch {}
	persistStatsFilters();
}
function ensureStatsFour() {
	const def = [
		"avg_cost",
		"avg_tokens",
		"avg_think_ratio",
		"truncation_rate"
	];
	let cur = state$2.settings.statsFour;
	const valid = new Set(FOUR_OPTIONS.map((o) => o.key));
	if (!Array.isArray(cur) || cur.length !== 4 || cur.some((k) => !valid.has(k))) {
		cur = def.slice();
		state$2.settings.statsFour = cur;
		try {
			saveHot({ settings: state$2.settings });
		} catch {}
		return cur;
	}
	return cur;
}
var statsFourBound = false;
function bindStatsFour() {
	if (statsFourBound) return;
	statsFourBound = true;
	const doc = getDoc$7();
	doc.addEventListener("click", (e) => {
		const t = e.target;
		for (let i = 0; i < 4; i++) {
			const drop = doc.getElementById(`aus-stats-four-drop-${i}`);
			const btn = doc.getElementById(`aus-stats-four-btn-${i}`);
			if (drop && btn && !t.closest(`#aus-stats-four-drop-${i}`) && !t.closest(`#aus-stats-four-btn-${i}`)) drop.style.display = "none";
		}
	});
}
function openStatsFourDrop(idx, v) {
	const drop = getDoc$7().getElementById(`aus-stats-four-drop-${idx}`);
	if (!drop) return;
	const cur = ensureStatsFour()[idx];
	drop.innerHTML = FOUR_OPTIONS.map((o) => {
		const active = o.key === cur;
		return `<div data-sfour="${idx}" data-key="${o.key}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-sm);${active ? "background:var(--ds-card);font-weight:600;color:var(--ds-text);" : ""}">${o.label}</div>`;
	}).join("");
	drop.querySelectorAll("[data-sfour]").forEach((el) => {
		el.onclick = () => {
			const key = el.getAttribute("data-key");
			const at = Number(el.getAttribute("data-sfour"));
			const arr = ensureStatsFour().slice();
			arr[at] = key;
			state$2.settings.statsFour = arr;
			try {
				saveHot({ settings: state$2.settings });
			} catch {}
			closeDropdownThenPaint(drop, () => renderStatsView());
		};
	});
	drop.style.display = drop.style.display === "block" ? "none" : "block";
}
function renderStatsFour(filtered) {
	const doc = getDoc$7();
	const host = doc.getElementById("aus-stats-four");
	if (!host) return;
	const v = computeStatsFour(filtered || []);
	const keys = ensureStatsFour();
	bindStatsFour();
	host.innerHTML = keys.map((k, i) => {
		const d = getFourDisplay(k, v);
		const valColor = k === "avg_rate" ? "var(--ds-green)" : "var(--ds-text)";
		return `<div class="ds-card" style="padding:14px;position:relative;overflow:visible;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.title}</div>
        <button id="aus-stats-four-btn-${i}" title="切换指标" style="flex-shrink:0;padding:4px 7px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;line-height:1;">${icon("chevron-down", 14)}</button>
        <div id="aus-stats-four-drop-${i}" style="display:none;position:absolute;top:38px;right:8px;z-index:6;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:180px;max-height:260px;overflow:auto;"></div>
      </div>
      <div style="font-size:18px;font-weight:600;color:${valColor};margin-top:6px;word-break:break-all;">${d.html}</div>
    </div>`;
	}).join("");
	keys.forEach((_, i) => {
		const btn = doc.getElementById(`aus-stats-four-btn-${i}`);
		if (btn) btn.onclick = () => openStatsFourDrop(i, v);
	});
}
function initStatsView() {
	bindPicker();
	bindChartSelectors();
	try {
		bindSummarySort();
	} catch {}
	try {
		initModelTrends();
	} catch {}
	updatePickerLabel();
	renderStatsView();
}
//#endregion
//#region src/stats/forecast.ts
function ewma(arr, alpha = .3) {
	if (!arr.length) return 0;
	let v = arr[arr.length - 1];
	for (let i = arr.length - 2; i >= 0; i--) v = alpha * arr[i] + (1 - alpha) * v;
	return v;
}
/** 检测回落点：prompt 骤降 >=30% 则分段，只用最后一段 */
function segmentByDrop(sorted) {
	if (sorted.length < 2) return {
		seg: sorted,
		segStart: 0
	};
	let cut = 0;
	for (let i = 1; i < sorted.length; i++) {
		const prev = sorted[i - 1].prompt_tokens ?? (sorted[i - 1].cache_hit_tokens || 0) + (sorted[i - 1].cache_miss_tokens || 0);
		const cur = sorted[i].prompt_tokens ?? (sorted[i].cache_hit_tokens || 0) + (sorted[i].cache_miss_tokens || 0);
		if (prev > 0 && cur / prev <= .7) cut = i;
	}
	return {
		seg: sorted.slice(cut),
		segStart: cut
	};
}
function linearFit(y) {
	const n = y.length;
	if (n < 3) {
		const deltas = [];
		for (let i = 1; i < n; i++) deltas.push(y[i] - y[i - 1]);
		const delta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
		return {
			C0: n ? y[0] : 0,
			delta,
			sigma: 0,
			r2: 0
		};
	}
	let sx = 0, sy = 0, sxx = 0, sxy = 0;
	for (let i = 0; i < n; i++) {
		sx += i;
		sy += y[i];
		sxx += i * i;
		sxy += i * y[i];
	}
	const denom = n * sxx - sx * sx;
	const delta = denom ? (n * sxy - sx * sy) / denom : 0;
	const C0 = (sy - delta * sx) / n;
	let rss = 0, tss = 0;
	const mean = sy / n;
	for (let i = 0; i < n; i++) {
		const pred = C0 + delta * i;
		rss += (y[i] - pred) ** 2;
		tss += (y[i] - mean) ** 2;
	}
	return {
		C0,
		delta,
		sigma: Math.sqrt(rss / n),
		r2: tss ? 1 - rss / tss : 0
	};
}
function logFit(y) {
	const n = y.length;
	if (n < 6) return {
		C0: y[0] || 0,
		delta: 0,
		sigma: 0,
		r2: -1,
		a: 0,
		b: y[0] || 0
	};
	const xs = y.map((_, i) => Math.log(i + 1));
	let sx = 0, sy = 0, sxx = 0, sxy = 0;
	for (let i = 0; i < n; i++) {
		sx += xs[i];
		sy += y[i];
		sxx += xs[i] * xs[i];
		sxy += xs[i] * y[i];
	}
	const denom = n * sxx - sx * sx;
	const a = denom ? (n * sxy - sx * sy) / denom : 0;
	const b = (sy - a * sx) / n;
	let rss = 0, tss = 0;
	const mean = sy / n;
	for (let i = 0; i < n; i++) {
		const pred = a * xs[i] + b;
		rss += (y[i] - pred) ** 2;
		tss += (y[i] - mean) ** 2;
	}
	return {
		C0: b,
		delta: a,
		sigma: Math.sqrt(rss / n),
		r2: tss ? 1 - rss / tss : 0,
		a,
		b
	};
}
function fitSegments(history, chatId) {
	const filtered = chatId ? history.filter((h) => (h.chatId ?? null) === chatId) : history.slice();
	if (filtered.length < 1) return null;
	const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
	const promptOf = (h) => h.prompt_tokens ?? (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0);
	const { seg, segStart } = segmentByDrop(sorted);
	const y = seg.map(promptOf);
	if (y.length < 6) {
		const C0 = y[0] || 0;
		const delta = y.length >= 2 ? (y[y.length - 1] - y[0]) / (y.length - 1) : 0;
		const mean = y.reduce((a, b) => a + b, 0) / y.length;
		return finalize(seg, sorted, C0, delta, Math.sqrt(y.reduce((a, b) => a + (b - mean) ** 2, 0) / y.length), 0, "recent-mean", segStart);
	}
	const lf = linearFit(y);
	const gf = logFit(y);
	if (gf.r2 > lf.r2 && gf.r2 > .5) {
		const approxDelta = y.length >= 2 ? y[y.length - 1] - y[y.length - 2] : 0;
		return finalize(seg, sorted, gf.b, approxDelta, gf.sigma, gf.r2, "log", segStart, {
			C0: gf.b,
			delta: approxDelta,
			sigma: gf.sigma,
			r2: gf.r2
		});
	}
	return finalize(seg, sorted, lf.C0, lf.delta, lf.sigma, lf.r2, "linear", segStart);
}
function finalize(seg, sorted, C0, delta, sigma, r2, model, segStart, extra) {
	const hitRates = seg.map((h) => {
		const ch = h.cache_hit_tokens || 0, tot = ch + (h.cache_miss_tokens || 0);
		return tot ? ch / tot : 0;
	});
	const outTokens = seg.map((h) => h.completion_tokens || 0);
	const hitEwma = ewma(hitRates.slice(-5));
	const outEwma = ewma(outTokens.slice(-5));
	let avgIntervalMs = 0;
	if (sorted.length >= 2) {
		const diffs = [];
		for (let i = 1; i < sorted.length; i++) diffs.push(sorted[i].timestamp - sorted[i - 1].timestamp);
		avgIntervalMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
	}
	return {
		chatId: seg[0]?.chatId ?? null,
		C0: Math.max(0, C0),
		delta: Math.max(0, delta),
		sigma: Math.max(0, sigma),
		r2,
		segStart,
		segLen: seg.length,
		model,
		hitEwma,
		outEwma,
		avgIntervalMs
	};
}
function ctxLimitForModel(model, configuredLimit) {
	if (configuredLimit != null && Number.isFinite(configuredLimit) && configuredLimit > 0) return Math.round(configuredLimit);
	const m = (model || "").toLowerCase();
	if (m.includes("128k")) return 128e3;
	if (m.includes("64k")) return 64e3;
	if (m.includes("32k")) return 32e3;
	return DEFAULT_CONTEXT_LIMIT;
}
//#endregion
//#region src/stats/energyScore.ts
/**
* Q4 RP 能耗效率评分 — 基于 6 指标加权分档 A-G
*/
function percentileAbs(value, thresholds, reverse) {
	const n = thresholds.length;
	for (let i = 0; i < n; i++) if (value <= thresholds[i]) {
		const score = 100 - i / n * 100;
		return reverse ? 100 - score : score;
	}
	return reverse ? 100 : 0;
}
var ABS_THRESHOLDS = {
	delta: [
		800,
		1500,
		3e3,
		5e3,
		8e3,
		12e3
	],
	out: [
		600,
		900,
		1300,
		1800,
		2400,
		3200
	],
	efficiency: [
		.4,
		.3,
		.25,
		.2,
		.15,
		.1
	],
	hitRate: [
		.9,
		.8,
		.65,
		.5,
		.35,
		.2
	],
	truncRate: [
		.01,
		.03,
		.06,
		.1,
		.15,
		.25
	],
	thinkRatio: [
		.1,
		.2,
		.3,
		.4,
		.5,
		.6
	]
};
var WEIGHTS = {
	delta: .25,
	out: .2,
	efficiency: .2,
	hitRate: .15,
	truncRate: .1,
	thinkRatio: .1
};
function computeMetricsForChat(history, chatId) {
	const filtered = chatId ? history.filter((h) => (h.chatId ?? null) === chatId) : history.slice();
	if (!filtered.length) return {
		delta: 0,
		out: 0,
		efficiency: 0,
		hitRate: .5,
		truncRate: 0,
		thinkRatio: 0
	};
	const fit = fitSegments(history, chatId);
	const delta = fit?.delta ?? 0;
	const out = fit?.outEwma ?? filtered.reduce((a, b) => a + (b.completion_tokens || 0), 0) / filtered.length;
	const totalTok = filtered.reduce((a, b) => a + (b.total_tokens || 0), 0);
	const sumOut = filtered.reduce((a, b) => a + (b.completion_tokens || 0), 0);
	const efficiency = totalTok ? sumOut / totalTok : 0;
	const hitRates = filtered.map((h) => {
		const ch = h.cache_hit_tokens || 0, tot = ch + (h.cache_miss_tokens || 0);
		return tot ? ch / tot : .5;
	});
	return {
		delta,
		out,
		efficiency,
		hitRate: hitRates.length ? hitRates.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, hitRates.length) : .5,
		truncRate: filtered.filter((h) => isTruncatedFinish(h.finishReason) || h.isTruncated).length / filtered.length,
		thinkRatio: (() => {
			const sOut = filtered.reduce((a, b) => a + (b.completion_tokens || 0), 0);
			const sThink = filtered.reduce((a, b) => a + (b.thinkTokens || 0), 0);
			return sOut ? sThink / sOut : 0;
		})()
	};
}
function scoreFromMetrics(m) {
	const sDelta = percentileAbs(m.delta, ABS_THRESHOLDS.delta, false);
	const sOut = percentileAbs(m.out, ABS_THRESHOLDS.out, false);
	100 - percentileAbs(m.efficiency, [
		.1,
		.15,
		.2,
		.25,
		.3,
		.4
	].reverse(), false);
	100 - percentileAbs(m.hitRate, [
		.2,
		.35,
		.5,
		.65,
		.8,
		.9
	], false);
	const sTrunc = percentileAbs(m.truncRate, ABS_THRESHOLDS.truncRate, false);
	const sThink = percentileAbs(m.thinkRatio, ABS_THRESHOLDS.thinkRatio, false);
	100 - percentileAbs(m.hitRate, [
		.2,
		.35,
		.5,
		.65,
		.8,
		.9
	], false);
	function scoreLargerBetter(v, thr) {
		for (let i = thr.length - 1; i >= 0; i--) if (v >= thr[i]) return (i + 1) / thr.length * 100;
		return 0;
	}
	const effScore = scoreLargerBetter(m.efficiency, [
		.1,
		.15,
		.2,
		.25,
		.3,
		.4
	]);
	const hitScore2 = scoreLargerBetter(m.hitRate, [
		.2,
		.35,
		.5,
		.65,
		.8,
		.9
	]);
	return WEIGHTS.delta * sDelta + WEIGHTS.out * sOut + WEIGHTS.efficiency * effScore + WEIGHTS.hitRate * hitScore2 + WEIGHTS.truncRate * sTrunc + WEIGHTS.thinkRatio * sThink;
}
function gradeFromScore(score) {
	if (score >= 85) return "A";
	if (score >= 75) return "B";
	if (score >= 65) return "C";
	if (score >= 55) return "D";
	if (score >= 45) return "E";
	if (score >= 35) return "F";
	return "G";
}
function energyScore(history, chatId) {
	const metrics = computeMetricsForChat(history, chatId);
	const score = scoreFromMetrics(metrics);
	return {
		metrics,
		score,
		grade: gradeFromScore(score)
	};
}
function topPowerChats(history, limit = 10) {
	const list = Array.from(new Set(history.map((h) => h.chatId ?? null))).map((id) => {
		const r = energyScore(history, id);
		return {
			chatId: id,
			grade: r.grade,
			score: r.score,
			delta: r.metrics.delta
		};
	});
	list.sort((a, b) => b.delta - a.delta);
	return list.slice(0, limit);
}
//#endregion
//#region src/ui/forecast-chart.ts
var instances = {};
var echartsPromise = null;
var resizeObserver = null;
var resizeBound = false;
function getDoc$6() {
	return window.parent?.document ?? document;
}
function themeColor(name, fallback) {
	try {
		const doc = getDoc$6();
		const el = doc.getElementById("aus-panel") || doc.documentElement;
		return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
	} catch {
		return fallback;
	}
}
async function loadECharts() {
	if (!echartsPromise) echartsPromise = (async () => {
		const echarts = await import("./core-fg_o3xmJ.js");
		const { LineChart, ScatterChart } = await import("./charts-BstuNsfd.js");
		const { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkPointComponent, GraphicComponent } = await import("./components-CpGqNjDG.js");
		const { CanvasRenderer } = await import("./renderers-DtxFY9_W.js");
		echarts.use([
			LineChart,
			ScatterChart,
			GridComponent,
			TooltipComponent,
			LegendComponent,
			MarkLineComponent,
			MarkPointComponent,
			GraphicComponent,
			CanvasRenderer
		]);
		return echarts;
	})();
	return echartsPromise;
}
function compactNumber(value) {
	const n = Number(value) || 0;
	if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + "亿";
	if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + "万";
	return Math.round(n).toLocaleString("zh-CN");
}
function axisMoney(currency, cnyValue) {
	const n = currency.code === "USD" ? (Number(cnyValue) || 0) / (currency.rate || 1) : Number(cnyValue) || 0;
	if (currency.code === "USD") {
		if (Math.abs(n) >= 1) return currency.symbol + n.toFixed(2);
		if (Math.abs(n) >= .01) return currency.symbol + n.toFixed(4);
		return currency.symbol + n.toFixed(5);
	}
	if (Math.abs(n) >= 1) return currency.symbol + n.toFixed(2);
	return currency.symbol + n.toFixed(4);
}
async function initChart(id, echarts) {
	const el = getDoc$6().getElementById(id);
	if (!el) return null;
	if (!el.clientWidth || !el.clientHeight) return null;
	if (instances[id]) {
		try {
			instances[id].dispose();
		} catch {}
		delete instances[id];
	}
	try {
		const existing = echarts.getInstanceByDom?.(el);
		if (existing) existing.dispose();
	} catch {}
	el.innerHTML = "";
	const chart = echarts.init(el);
	instances[id] = chart;
	return chart;
}
function ensureResizeObserver() {
	if (resizeObserver || typeof ResizeObserver === "undefined") return;
	const doc = getDoc$6();
	const targets = [
		"aus-forecast-main-chart",
		"aus-forecast-hit-chart",
		"aus-forecast-cost-chart"
	];
	const observed = [];
	for (const id of targets) {
		const el = doc.getElementById(id);
		if (el) observed.push(el);
	}
	if (!observed.length) return;
	resizeObserver = new ResizeObserver(() => {
		try {
			resizeForecastCharts();
		} catch {}
	});
	observed.forEach((el) => resizeObserver.observe(el));
	if (!resizeBound) {
		resizeBound = true;
		try {
			window.addEventListener("resize", () => {
				try {
					resizeForecastCharts();
				} catch {}
			});
			const parentWindow = window.parent;
			if (parentWindow && parentWindow !== window && parentWindow.addEventListener) parentWindow.addEventListener("resize", () => {
				try {
					resizeForecastCharts();
				} catch {}
			});
		} catch {}
	}
}
function resizeForecastCharts() {
	for (const id of Object.keys(instances)) try {
		instances[id]?.resize();
	} catch {}
}
function disposeForecastCharts() {
	for (const id of Object.keys(instances)) {
		try {
			instances[id]?.dispose();
		} catch {}
		delete instances[id];
	}
	if (resizeObserver) {
		try {
			resizeObserver.disconnect();
		} catch {}
		resizeObserver = null;
	}
}
/** 历史轮次的中位间隔（ms），用于给预测轮次估个大致时刻 */
function medianInterval(history) {
	const diffs = [];
	for (let i = 1; i < history.length; i += 1) {
		const prev = Number(history[i - 1]?.timestamp) || 0;
		const cur = Number(history[i]?.timestamp) || 0;
		const diff = cur - prev;
		if (prev > 0 && cur > 0 && diff > 0) diffs.push(diff);
	}
	if (!diffs.length) return 0;
	diffs.sort((a, b) => a - b);
	return diffs[Math.floor(diffs.length / 2)];
}
/**
* X 轴标签保持 #N 紧凑，tips 给出悬浮窗标题：
* 历史轮次用真实时间戳，预测轮次按中位间隔推算「预计」时刻。
*/
function buildLabels(series) {
	const labels = [...series.history.map((point) => `#${point.round}`), ...series.future.map((point) => `+${point.round - series.currentRound}`)];
	const interval = medianInterval(series.history);
	const lastTs = Number(series.history[series.history.length - 1]?.timestamp) || 0;
	const historyTips = series.history.map((point) => {
		const time = chartDateTime(Number(point.timestamp) || 0);
		return time ? `第 ${point.round} 轮 · ${time}` : `第 ${point.round} 轮`;
	});
	const futureTips = series.future.map((point, index) => {
		const estimated = lastTs && interval ? chartDateTime(lastTs + interval * (index + 1)) : "";
		const head = `第 ${point.round} 轮（预测）`;
		return estimated ? `${head} · 预计 ${estimated}` : head;
	});
	return {
		labels,
		tips: [...historyTips, ...futureTips],
		historyLength: series.history.length,
		futureLength: series.future.length
	};
}
function futureOnlySeries(historyLength, futureValues, connection) {
	const result = new Array(historyLength + futureValues.length).fill(null);
	if (historyLength > 0 && connection != null) result[historyLength - 1] = connection;
	for (let i = 0; i < futureValues.length; i += 1) result[historyLength + i] = futureValues[i];
	return result;
}
function baseAxisStyle(border, text3) {
	return {
		axisLine: { lineStyle: { color: border } },
		axisTick: { show: false },
		axisLabel: {
			color: text3,
			fontSize: 12,
			hideOverlap: true
		}
	};
}
function compactionTooltip(point) {
	if (!point) return "";
	return `<div style="font-size:11px;color:#9CA3AF;">压缩前 ${compactNumber(point.before)} → 后 ${compactNumber(point.after)}（降 ${Math.round(point.dropPct * 100)}%）</div>`;
}
async function renderMainChart(echarts, options) {
	const chart = await initChart("aus-forecast-main-chart", echarts);
	if (!chart) return;
	const { series, ctxLimit, currency, formatCost } = options;
	const { labels, tips, historyLength } = buildLabels(series);
	if (!labels.length) return;
	const border = themeColor("--ds-border", "#E5E7EB");
	const text3 = themeColor("--ds-text-3", "#9CA3AF");
	const text = themeColor("--ds-text", "#111827");
	const cardInner = themeColor("--ds-card-inner", "#FFFFFF");
	const historyHit = series.history.map((point) => point.hit);
	const historyMiss = series.history.map((point) => point.miss);
	const historyInput = series.history.map((point) => point.input);
	const historyOutput = series.history.map((point) => point.output);
	const historyCost = series.history.map((point) => point.cost);
	const futureInput = series.future.map((point) => point.input);
	const futureOutput = series.future.map((point) => point.output);
	const futureCost = series.future.map((point) => point.cost ?? 0);
	const lastInput = historyLength ? historyInput[historyLength - 1] : null;
	const lastOutput = historyLength ? historyOutput[historyLength - 1] : null;
	const lastCost = historyLength ? historyCost[historyLength - 1] : null;
	const predInput = futureOnlySeries(historyLength, futureInput, lastInput);
	const predOutput = futureOnlySeries(historyLength, futureOutput, lastOutput);
	const predCost = series.future.some((point) => point.cost != null) ? futureOnlySeries(historyLength, futureCost, lastCost) : null;
	const bandLow = futureOnlySeries(historyLength, series.future.map((point) => point.inputLow), lastInput);
	const bandHigh = futureOnlySeries(historyLength, series.future.map((point) => Math.max(0, point.inputHigh - point.inputLow)), 0);
	const historyCompactions = series.history.filter((point) => point.compaction).map((point) => {
		const detail = series.compactions.find((item) => item.round === point.round);
		return {
			value: [`#${point.round}`, point.input],
			compaction: detail
		};
	});
	const futureCompactions = series.future.filter((point) => point.compaction).map((point) => ({
		value: [`+${point.round - series.currentRound}`, point.input],
		compaction: null
	}));
	const markLineData = [];
	for (const compaction of series.compactions) markLineData.push({
		xAxis: `#${compaction.round}`,
		lineStyle: {
			color: "#F59E0B",
			width: 1,
			type: "dashed",
			opacity: .45
		},
		label: { show: false }
	});
	for (const point of series.future.filter((item) => item.compaction)) markLineData.push({
		xAxis: `+${point.round - series.currentRound}`,
		lineStyle: {
			color: "#F59E0B",
			width: 1,
			type: "dotted",
			opacity: .6
		},
		label: { show: false }
	});
	if (ctxLimit != null) markLineData.push({
		yAxis: ctxLimit,
		lineStyle: {
			color: "#DC2626",
			width: 1,
			type: "dashed",
			opacity: .75
		},
		label: {
			show: true,
			position: "insideEndTop",
			formatter: `参考上限 ${compactNumber(ctxLimit)}`,
			color: "#DC2626",
			fontSize: 10
		}
	});
	const markArea = historyLength && series.future.length ? {
		silent: true,
		itemStyle: { color: "rgba(16, 185, 129, 0.06)" },
		label: { show: false },
		data: [[{ xAxis: labels[historyLength - 1] }, { xAxis: labels[labels.length - 1] }]]
	} : void 0;
	const legendData = [
		"历史输入(命中)",
		"历史输入(未命中)",
		"历史输出",
		...series.future.length ? ["预测输入", "预测输出"] : [],
		...predCost ? ["历史成本", "预测成本"] : [],
		...historyCompactions.length ? ["历史压缩"] : [],
		...futureCompactions.length ? ["预测压缩"] : []
	];
	const hasCost = predCost != null;
	const yAxis = [{
		type: "value",
		name: "tokens",
		position: "left",
		nameTextStyle: {
			color: text3,
			fontSize: 11
		},
		axisLine: { show: false },
		splitLine: { lineStyle: { color: border } },
		axisLabel: {
			color: text3,
			fontSize: 12,
			formatter: (value) => compactNumber(value)
		}
	}];
	if (hasCost) yAxis.push({
		type: "value",
		name: currency.code,
		position: "right",
		nameTextStyle: {
			color: text3,
			fontSize: 11
		},
		axisLine: { show: false },
		splitLine: { show: false },
		axisLabel: {
			color: text3,
			fontSize: 12,
			formatter: (value) => axisMoney(currency, value)
		}
	});
	const seriesOption = [
		{
			name: "历史输入(未命中)",
			type: "line",
			stack: "input",
			data: historyMiss,
			smooth: false,
			showSymbol: false,
			lineStyle: {
				width: 1,
				color: TOKEN_SERIES_COLORS.miss
			},
			itemStyle: { color: TOKEN_SERIES_COLORS.miss },
			areaStyle: { color: "rgba(96, 179, 254, 0.32)" },
			sampling: "lttb"
		},
		{
			name: "历史输入(命中)",
			type: "line",
			stack: "input",
			data: historyHit,
			smooth: false,
			showSymbol: false,
			lineStyle: {
				width: 1,
				color: TOKEN_SERIES_COLORS.hit
			},
			itemStyle: { color: TOKEN_SERIES_COLORS.hit },
			areaStyle: { color: "rgba(160, 220, 253, 0.38)" },
			sampling: "lttb",
			markLine: markLineData.length ? {
				silent: true,
				symbol: "none",
				data: markLineData
			} : void 0,
			markArea
		},
		{
			name: "历史输出",
			type: "line",
			data: historyOutput,
			smooth: false,
			showSymbol: false,
			lineStyle: {
				width: 1.6,
				color: TOKEN_SERIES_COLORS.output
			},
			itemStyle: { color: TOKEN_SERIES_COLORS.output },
			sampling: "lttb"
		}
	];
	if (series.future.length) seriesOption.push({
		name: "预测输入",
		type: "line",
		data: predInput,
		smooth: false,
		showSymbol: false,
		lineStyle: {
			width: 1.8,
			color: TOKEN_SERIES_COLORS.hit,
			type: "dashed"
		},
		itemStyle: { color: TOKEN_SERIES_COLORS.hit }
	}, {
		name: "预测输出",
		type: "line",
		data: predOutput,
		smooth: false,
		showSymbol: false,
		lineStyle: {
			width: 1.4,
			color: TOKEN_SERIES_COLORS.output,
			type: "dashed"
		},
		itemStyle: { color: TOKEN_SERIES_COLORS.output }
	}, {
		name: "__bandLow",
		type: "line",
		stack: "band",
		data: bandLow,
		showSymbol: false,
		lineStyle: { opacity: 0 },
		areaStyle: { opacity: 0 },
		silent: true,
		tooltip: { show: false }
	}, {
		name: "__bandHigh",
		type: "line",
		stack: "band",
		data: bandHigh,
		showSymbol: false,
		lineStyle: { opacity: 0 },
		areaStyle: { color: "rgba(11, 162, 94, 0.12)" },
		silent: true,
		tooltip: { show: false }
	});
	if (predCost) seriesOption.push({
		name: "历史成本",
		type: "line",
		yAxisIndex: 1,
		data: historyCost,
		smooth: false,
		showSymbol: false,
		lineStyle: {
			width: 1.8,
			color: "#FF6A00"
		},
		itemStyle: { color: "#FF6A00" },
		sampling: "lttb"
	}, {
		name: "预测成本",
		type: "line",
		yAxisIndex: 1,
		data: predCost,
		smooth: false,
		showSymbol: false,
		lineStyle: {
			width: 1.8,
			color: "#FF6A00",
			type: "dashed"
		},
		itemStyle: { color: "#FF6A00" }
	});
	if (historyCompactions.length) seriesOption.push({
		name: "历史压缩",
		type: "scatter",
		data: historyCompactions,
		symbol: "triangle",
		symbolSize: 9,
		itemStyle: { color: "#F59E0B" },
		z: 8
	});
	if (futureCompactions.length) seriesOption.push({
		name: "预测压缩",
		type: "scatter",
		data: futureCompactions,
		symbol: "diamond",
		symbolSize: 8,
		itemStyle: {
			color: "#F59E0B",
			opacity: .8
		},
		z: 8
	});
	const maxLabels = 12;
	const interval = labels.length <= maxLabels ? 0 : Math.ceil(labels.length / maxLabels) - 1;
	chart.setOption({
		animation: false,
		backgroundColor: "transparent",
		legend: {
			type: "scroll",
			top: 0,
			left: 0,
			right: 0,
			data: legendData,
			textStyle: {
				color: text3,
				fontSize: 11
			},
			itemWidth: 14,
			itemHeight: 8,
			pageIconColor: text3,
			pageIconInactiveColor: border,
			pageTextStyle: {
				color: text3,
				fontSize: 11
			}
		},
		tooltip: {
			trigger: "axis",
			backgroundColor: cardInner,
			borderColor: border,
			borderWidth: 1,
			...CHART_TOOLTIP_SURFACE,
			textStyle: {
				color: text,
				fontSize: 12
			},
			axisPointer: {
				type: "line",
				lineStyle: { color: border }
			},
			formatter: (params) => {
				if (!Array.isArray(params) || !params.length) return "";
				const index = params[0].dataIndex;
				const label = labels[index] || "";
				const isFuture = index >= historyLength;
				const roundNumber = isFuture ? series.currentRound + (index - historyLength) + 1 : index + 1;
				let html = `<div style="font-weight:600;margin-bottom:6px;">${tips[index] || `第 ${roundNumber} 轮${isFuture ? "（预测）" : ""}`}</div>`;
				for (const param of params) {
					if (!param || String(param.seriesName).startsWith("__")) continue;
					if (param.seriesName === "历史压缩" || param.seriesName === "预测压缩") continue;
					const value = Array.isArray(param.value) ? param.value[1] : param.value;
					if (value == null || !Number.isFinite(Number(value))) continue;
					const display = param.seriesName.includes("成本") ? formatCost(Number(value), 4) : compactNumber(Number(value)) + " tok";
					html += `<div style="display:flex;align-items:center;gap:6px;line-height:1.7;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${param.color};"></span><span>${param.seriesName}</span><span style="margin-left:auto;font-weight:600;">${display}</span></div>`;
				}
				const hitPoint = historyCompactions.find((point) => point.value[0] === label);
				if (hitPoint?.compaction) html += compactionTooltip(hitPoint.compaction);
				if (futureCompactions.find((point) => point.value[0] === label)) html += "<div style=\"font-size:11px;color:#F59E0B;\">预测压缩点（按历史压缩节奏）</div>";
				return `<div style="padding:2px 4px;min-width:190px;">${html}</div>`;
			}
		},
		grid: {
			left: 52,
			right: hasCost ? 58 : 20,
			top: 42,
			bottom: 30
		},
		xAxis: {
			type: "category",
			data: labels,
			boundaryGap: false,
			...baseAxisStyle(border, text3),
			axisLabel: {
				color: text3,
				fontSize: 12,
				interval,
				hideOverlap: true
			}
		},
		yAxis,
		series: seriesOption
	}, true);
}
async function renderHitChart(echarts, options) {
	const chart = await initChart("aus-forecast-hit-chart", echarts);
	if (!chart) return;
	const { series } = options;
	const { labels, tips, historyLength } = buildLabels(series);
	if (!labels.length) return;
	const border = themeColor("--ds-border", "#E5E7EB");
	const text3 = themeColor("--ds-text-3", "#9CA3AF");
	const text = themeColor("--ds-text", "#111827");
	const cardInner = themeColor("--ds-card-inner", "#FFFFFF");
	const historyRate = series.history.map((point) => point.hitRate == null ? null : point.hitRate * 100);
	const lastRate = historyLength ? historyRate[historyLength - 1] : null;
	const futureRate = futureOnlySeries(historyLength, series.future.map((point) => point.hitRate * 100), lastRate);
	const fallbackLine = !series.hit.hasData ? [{
		yAxis: series.hit.rate * 100,
		lineStyle: {
			color: "#0BA25E",
			width: 1,
			type: "dashed",
			opacity: .7
		},
		label: {
			show: true,
			position: "insideEndTop",
			formatter: `回退命中率 ${Math.round(series.hit.rate * 100)}%`,
			color: "#0BA25E",
			fontSize: 10
		}
	}] : [];
	const compactionLines = series.compactions.map((point) => ({
		xAxis: `#${point.round}`,
		lineStyle: {
			color: "#F59E0B",
			width: 1,
			type: "dashed",
			opacity: .35
		},
		label: { show: false }
	}));
	const interval = labels.length <= 12 ? 0 : Math.ceil(labels.length / 12) - 1;
	chart.setOption({
		animation: false,
		backgroundColor: "transparent",
		tooltip: {
			trigger: "axis",
			backgroundColor: cardInner,
			borderColor: border,
			borderWidth: 1,
			...CHART_TOOLTIP_SURFACE,
			textStyle: {
				color: text,
				fontSize: 12
			},
			formatter: (params) => {
				if (!Array.isArray(params) || !params.length) return "";
				const index = params[0].dataIndex;
				labels[index];
				const isFuture = index >= historyLength;
				let html = `<div style="font-weight:600;margin-bottom:4px;">${tips[index] || `第 ${isFuture ? series.currentRound + (index - historyLength) + 1 : index + 1} 轮${isFuture ? "（预测）" : ""}`}</div>`;
				for (const param of params) {
					if (!param || String(param.seriesName).startsWith("__")) continue;
					const value = Array.isArray(param.value) ? param.value[1] : param.value;
					if (value == null || !Number.isFinite(Number(value))) continue;
					html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${param.color};"></span><span>${param.seriesName}</span><span style="margin-left:auto;font-weight:600;">${Number(value).toFixed(1)}%</span></div>`;
				}
				return `<div style="padding:2px 4px;min-width:160px;">${html}</div>`;
			}
		},
		grid: {
			left: 42,
			right: 18,
			top: 18,
			bottom: 26
		},
		xAxis: {
			type: "category",
			data: labels,
			boundaryGap: false,
			...baseAxisStyle(border, text3),
			axisLabel: {
				color: text3,
				fontSize: 12,
				interval,
				hideOverlap: true
			}
		},
		yAxis: {
			type: "value",
			min: 0,
			max: 100,
			axisLine: { show: false },
			splitLine: { lineStyle: { color: border } },
			axisLabel: {
				color: text3,
				fontSize: 12,
				formatter: (value) => `${value}%`
			}
		},
		series: [{
			name: "缓存命中率",
			type: "line",
			data: historyRate,
			showSymbol: false,
			connectNulls: false,
			lineStyle: {
				width: 1.8,
				color: "#0BA25E"
			},
			itemStyle: { color: "#0BA25E" },
			markLine: {
				silent: true,
				symbol: "none",
				data: [...compactionLines, ...fallbackLine]
			}
		}, ...series.future.length ? [{
			name: "预测命中率",
			type: "line",
			data: futureRate,
			showSymbol: false,
			lineStyle: {
				width: 1.8,
				color: "#0BA25E",
				type: "dashed"
			},
			itemStyle: { color: "#0BA25E" }
		}] : []]
	}, true);
}
async function renderCostChart(echarts, options) {
	const chart = await initChart("aus-forecast-cost-chart", echarts);
	if (!chart) return;
	const { series, currency, formatCost } = options;
	const { labels, tips, historyLength } = buildLabels(series);
	if (!labels.length) return;
	const border = themeColor("--ds-border", "#E5E7EB");
	const text3 = themeColor("--ds-text-3", "#9CA3AF");
	const text = themeColor("--ds-text", "#111827");
	const cardInner = themeColor("--ds-card-inner", "#FFFFFF");
	if (!series.future.some((point) => point.cost != null)) {
		chart.setOption({
			animation: false,
			backgroundColor: "transparent",
			graphic: [{
				type: "text",
				left: "center",
				top: "middle",
				style: {
					text: "未配置价格，无法估算成本",
					fill: text3,
					fontSize: 12
				}
			}],
			xAxis: {
				type: "category",
				data: labels,
				show: false
			},
			yAxis: {
				type: "value",
				show: false
			},
			series: []
		}, true);
		return;
	}
	const historyCumulative = series.history.map((point) => point.cumulativeCost);
	const lastCumulative = historyLength ? historyCumulative[historyLength - 1] : 0;
	const futureCumulative = futureOnlySeries(historyLength, series.future.map((point) => point.cumulativeCost ?? lastCumulative), lastCumulative);
	const futureTotal = series.future.reduce((sum, point) => sum + (point.cost ?? 0), 0);
	const interval = labels.length <= 12 ? 0 : Math.ceil(labels.length / 12) - 1;
	chart.setOption({
		animation: false,
		backgroundColor: "transparent",
		tooltip: {
			trigger: "axis",
			backgroundColor: cardInner,
			borderColor: border,
			borderWidth: 1,
			...CHART_TOOLTIP_SURFACE,
			textStyle: {
				color: text,
				fontSize: 12
			},
			formatter: (params) => {
				if (!Array.isArray(params) || !params.length) return "";
				const index = params[0].dataIndex;
				const isFuture = index >= historyLength;
				let html = `<div style="font-weight:600;margin-bottom:4px;">${tips[index] || `第 ${isFuture ? series.currentRound + (index - historyLength) + 1 : index + 1} 轮${isFuture ? "（预测）" : ""}`}</div>`;
				for (const param of params) {
					const value = Array.isArray(param.value) ? param.value[1] : param.value;
					if (value == null || !Number.isFinite(Number(value))) continue;
					html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${param.color};"></span><span>${param.seriesName}</span><span style="margin-left:auto;font-weight:600;">${formatCost(Number(value), 4)}</span></div>`;
				}
				return `<div style="padding:2px 4px;min-width:170px;">${html}</div>`;
			}
		},
		graphic: futureTotal > 0 ? [{
			type: "text",
			right: 10,
			top: 0,
			style: {
				text: `未来 ${series.future.length} 轮 ≈ ${formatCost(futureTotal, 4)}`,
				fill: text3,
				fontSize: 11
			}
		}] : void 0,
		grid: {
			left: 58,
			right: 22,
			top: 28,
			bottom: 26
		},
		xAxis: {
			type: "category",
			data: labels,
			boundaryGap: false,
			...baseAxisStyle(border, text3),
			axisLabel: {
				color: text3,
				fontSize: 12,
				interval,
				hideOverlap: true
			}
		},
		yAxis: {
			type: "value",
			axisLine: { show: false },
			splitLine: { lineStyle: { color: border } },
			axisLabel: {
				color: text3,
				fontSize: 12,
				formatter: (value) => axisMoney(currency, value)
			}
		},
		series: [{
			name: "累计成本",
			type: "line",
			data: historyCumulative,
			showSymbol: false,
			smooth: false,
			lineStyle: {
				width: 1.8,
				color: "#FF6A00"
			},
			itemStyle: { color: "#FF6A00" },
			areaStyle: { color: "rgba(255, 106, 0, 0.12)" },
			sampling: "lttb"
		}, {
			name: "预测累计成本",
			type: "line",
			data: futureCumulative,
			showSymbol: false,
			lineStyle: {
				width: 1.8,
				color: "#FF6A00",
				type: "dashed"
			},
			itemStyle: { color: "#FF6A00" }
		}]
	}, true);
}
async function renderForecastCharts(options) {
	let echarts;
	try {
		echarts = await loadECharts();
	} catch (error) {
		console.error("[Api-Usage] 预测图表加载失败", error);
		return;
	}
	ensureResizeObserver();
	await Promise.all([
		renderMainChart(echarts, options),
		renderHitChart(echarts, options),
		renderCostChart(echarts, options)
	]);
}
//#endregion
//#region src/ui/forecast-view.ts
var PREFS_KEY = "aus_forecast_prefs_v1";
var HORIZONS = [
	5,
	10,
	20,
	50,
	100
];
var selectedForecastKey = "__current__";
var selectedForecastModel = null;
var horizon = 10;
var hitMode = "global";
var manualHitRate = 50;
var compactionEnabled = true;
var efficiencyScope = "all";
var showTop = false;
var openDropdown = null;
var renderToken$1 = 0;
var globalCloseBound = false;
var hitRefreshTimer = null;
var lastFullHistory = [];
var lastEffectiveHistory = [];
var lastEfficiencyHistory = [];
var lastEfficiencyLabel = "全部历史";
var efficiencySort = null;
function getDoc$5() {
	return window.parent?.document ?? document;
}
function currentChatId() {
	try {
		return (globalThis.SillyTavern?.getContext?.())?.getCurrentChatId?.() || null;
	} catch {
		return null;
	}
}
function loadPreferences() {
	try {
		const raw = localStorage.getItem(PREFS_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (HORIZONS.includes(Number(parsed.horizon))) horizon = Number(parsed.horizon);
		if (parsed.hitMode === "global" || parsed.hitMode === "model" || parsed.hitMode === "manual") hitMode = parsed.hitMode;
		const manual = Number(parsed.manualHit);
		if (Number.isFinite(manual)) manualHitRate = Math.max(0, Math.min(100, manual));
		if (typeof parsed.compaction === "boolean") compactionEnabled = parsed.compaction;
		if (parsed.scope === "all" || parsed.scope === "chat") efficiencyScope = parsed.scope;
		if (typeof parsed.showTop === "boolean") showTop = parsed.showTop;
	} catch {}
}
function savePreferences() {
	try {
		const prefs = {
			horizon,
			hitMode,
			manualHit: manualHitRate,
			compaction: compactionEnabled,
			scope: efficiencyScope,
			showTop
		};
		localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
	} catch {}
}
function balanceNum() {
	const ignored = new Set(state$2.walletIgnored || []);
	const selected = String(state$2.settings.overviewWalletId || "all");
	const wallets = (state$2.wallets || []).filter((wallet) => !ignored.has(wallet.id));
	const target = selected === "all" ? wallets : wallets.filter((wallet) => wallet.id === selected);
	let total = null;
	for (const wallet of target) {
		const value = walletBalanceToCny(wallet, getWalletExchangeRate());
		if (value == null) continue;
		total = (total ?? 0) + value;
	}
	if (total == null) {
		const fallback = state$2.customBalance || state$2.balance?.balance;
		if (fallback == null || fallback === "") return null;
		const value = parseFloat(String(fallback));
		if (Number.isFinite(value)) total = value;
	}
	return total;
}
function getRecordedChatsForForecast(list) {
	const map = /* @__PURE__ */ new Map();
	for (const entry of list || []) {
		const chatId = entry.chatId ?? null;
		const chatName = entry.chatName ?? null;
		const key = chatId ?? "__null__";
		const timestamp = Number(entry?.timestamp) || 0;
		if (!map.has(key)) map.set(key, {
			chatId,
			chatName,
			lastSeen: timestamp
		});
		else {
			const current = map.get(key);
			if (timestamp >= current.lastSeen && chatName) current.chatName = chatName;
			if (timestamp > current.lastSeen) current.lastSeen = timestamp;
		}
	}
	return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen).map((value) => {
		let display = value.chatName || "";
		if (!display) {
			if (value.chatId) display = value.chatId.length > 18 ? value.chatId.slice(0, 8) + "…" + value.chatId.slice(-4) : value.chatId;
			else display = "未分组/旧数据";
		}
		return {
			chatId: value.chatId,
			chatName: value.chatName,
			displayName: display
		};
	});
}
function getEffectiveHist(fullHist) {
	if (selectedForecastKey === "__all__") return fullHist.slice();
	if (selectedForecastKey === "__current__") return getCurrentChatHist(fullHist);
	if (selectedForecastKey === "__null__") return fullHist.filter((entry) => !entry.chatId);
	return fullHist.filter((entry) => (entry.chatId ?? null) === selectedForecastKey);
}
function getCurrentChatHist(fullHist) {
	const current = currentChatId();
	if (!current) return [];
	return fullHist.filter((entry) => (entry.chatId ?? null) === current);
}
function getForecastLabel(fullHist) {
	if (selectedForecastKey === "__current__") return currentChatId() ? "当前对话" : "当前对话（未打开）";
	if (selectedForecastKey === "__all__") return "全部";
	if (selectedForecastKey === "__null__") return "未分组/旧数据";
	return getRecordedChatsForForecast(fullHist).find((chat) => (chat.chatId ?? "__null__") === selectedForecastKey)?.displayName || selectedForecastKey;
}
function getModelOptions(history) {
	const map = /* @__PURE__ */ new Map();
	for (const entry of history || []) {
		const model = entry?.model;
		if (!model) continue;
		const timestamp = Number(entry?.timestamp) || 0;
		const current = map.get(model);
		if (current) {
			current.count += 1;
			if (timestamp > current.lastSeen) current.lastSeen = timestamp;
		} else map.set(model, {
			model,
			count: 1,
			lastSeen: timestamp
		});
	}
	return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}
function latestEntryForModel(history, model) {
	if (!history.length) return null;
	if (!model) return [...history].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)).slice(-1)[0] || null;
	const filtered = history.filter((entry) => entry.model === model);
	if (!filtered.length) return null;
	return [...filtered].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)).slice(-1)[0] || null;
}
function averageIntervalMs(history) {
	if (history.length < 2) return 0;
	const sorted = [...history].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)).slice(-21);
	const diffs = [];
	for (let i = 1; i < sorted.length; i += 1) {
		const diff = (Number(sorted[i].timestamp) || 0) - (Number(sorted[i - 1].timestamp) || 0);
		if (diff > 0) diffs.push(diff);
	}
	return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
}
function resolvePriceContext(history, model) {
	if (!model) return null;
	const latest = latestEntryForModel(history, model);
	if (!latest && !history.length) return null;
	const wallet = findWalletForHistory(state$2.wallets || [], latest || history[history.length - 1] || {});
	const walletModel = findWalletModel(wallet, model);
	const pricing = getPricing(model, state$2.settings, wallet);
	const pending = pricing?.pending === true;
	const avgInterval = averageIntervalMs(history);
	const nextTs = latest?.timestamp ? Number(latest.timestamp) + avgInterval : Date.now();
	const usePeak = pricing?.usePeakPricing !== false && (wallet ? isWalletPeakHour(nextTs, wallet, state$2.settings) : isPeakHour(nextTs, state$2.settings));
	const tier = usePeak ? pricing?.peak : pricing?.offpeak;
	const trio = pending || !tier ? null : {
		hit: Number(tier.hit) || 0,
		miss: Number(tier.miss) || 0,
		output: Number(tier.output) || 0
	};
	return {
		model,
		wallet,
		walletModel,
		pricing,
		trio,
		known: !pending && trio != null,
		usePeak,
		label: pending ? "未配置价格" : pricing?.usePeakPricing === false ? "固定价" : usePeak ? "高峰价" : "低谷价",
		walletLabel: wallet?.name || "未归属钱包",
		nextTs
	};
}
function formatCost(value, digits = 4) {
	try {
		return formatMoney(value || 0, digits);
	} catch {
		return "¥" + (value || 0).toFixed(digits) + " CNY";
	}
}
function compactTok(value) {
	return Math.round(Number(value) || 0).toLocaleString("zh-CN");
}
function pct(value, digits = 1) {
	return (Number(value) * 100).toFixed(digits) + "%";
}
function currencyInfo() {
	const currency = getDisplayCurrency();
	return {
		code: currency.code,
		symbol: currency.symbol,
		rate: currency.rate
	};
}
function hitSourceText(series) {
	switch (series.hit.source) {
		case "data": return series.hit.segmentSamples > 0 ? `自动测算 · 当前段 ${series.hit.segmentSamples} 条记录` : "自动测算 · 对话历史有效样本";
		case "global": return "无缓存数据 · 全站平均";
		case "model": return "无缓存数据 · 同模型平均";
		case "manual": return "无缓存数据 · 手动假设";
		default: return "无缓存数据 · 按 0% 保守估算";
	}
}
function closeAllDropdowns() {
	const doc = getDoc$5();
	for (const name of [
		"chat",
		"model",
		"horizon",
		"hit",
		"scope"
	]) {
		const dropdown = doc.getElementById(`aus-forecast-${name}-dropdown`);
		if (dropdown) dropdown.style.display = "none";
	}
	openDropdown = null;
}
/** 选中某一项后要整页重绘时用：先把五个浮层全部瞬时关掉，重绘留到下一帧。 */
function closeAllDropdownsInstant() {
	const doc = getDoc$5();
	for (const name of [
		"chat",
		"model",
		"horizon",
		"hit",
		"scope"
	]) closeDropdownInstant(doc.getElementById(`aus-forecast-${name}-dropdown`));
	openDropdown = null;
}
function toggleDropdown(name) {
	const doc = getDoc$5();
	if (openDropdown === name) {
		closeAllDropdowns();
		return;
	}
	closeAllDropdowns();
	const dropdown = doc.getElementById(`aus-forecast-${name}-dropdown`);
	if (!dropdown) return;
	dropdown.style.display = "block";
	openDropdown = name;
}
function bindGlobalClose() {
	if (globalCloseBound) return;
	globalCloseBound = true;
	try {
		getDoc$5().addEventListener("click", () => closeAllDropdowns());
	} catch {}
}
function dropdownItem(attr, value, label, active, meta = "") {
	return `<div class="aus-forecast-dropdown-item${active ? " is-active" : ""}" ${attr}="${esc(value)}" title="${esc(label)}">
    <span class="aus-forecast-dropdown-label">${esc(label)}</span>
    ${meta ? `<span class="aus-forecast-dropdown-meta">${esc(meta)}</span>` : ""}
  </div>`;
}
function renderChatDropdown(fullHist) {
	const dropdown = getDoc$5().getElementById("aus-forecast-chat-dropdown");
	if (!dropdown) return;
	const allChats = getRecordedChatsForForecast(fullHist);
	const chats = filterPickerRows(allChats);
	let html = dropdownItem("data-fchat", "__current__", "当前对话", selectedForecastKey === "__current__");
	html += dropdownItem("data-fchat", "__all__", "全部", selectedForecastKey === "__all__");
	for (const chat of chats) {
		const key = chat.chatId ?? "__null__";
		html += dropdownItem("data-fchat", key, chat.displayName, selectedForecastKey === key, chat.chatId ? "" : "旧数据");
	}
	if (!chats.length) html += "<div class=\"aus-forecast-dropdown-empty\">" + (allChats.length ? "对话已全部隐藏（可在「对话展示管理」中恢复）" : "暂无对话") + "</div>";
	dropdown.innerHTML = html;
	dropdown.querySelectorAll("[data-fchat]").forEach((el) => {
		el.onclick = (event) => {
			event.stopPropagation();
			selectedForecastKey = el.getAttribute("data-fchat") || "__current__";
			selectedForecastModel = null;
			closeAllDropdownsInstant();
			afterNextPaint(() => renderForecastView());
		};
	});
}
function renderModelDropdown(options) {
	const dropdown = getDoc$5().getElementById("aus-forecast-model-dropdown");
	if (!dropdown) return;
	dropdown.innerHTML = options.map((option) => dropdownItem("data-fmodel", option.model, option.model, selectedForecastModel === option.model, `${option.count} 轮`)).join("") || "<div class=\"aus-forecast-dropdown-empty\">暂无模型</div>";
	dropdown.querySelectorAll("[data-fmodel]").forEach((el) => {
		el.onclick = (event) => {
			event.stopPropagation();
			selectedForecastModel = el.getAttribute("data-fmodel") || null;
			closeAllDropdownsInstant();
			afterNextPaint(() => renderForecastView());
		};
	});
}
function renderHorizonDropdown() {
	const dropdown = getDoc$5().getElementById("aus-forecast-horizon-dropdown");
	if (!dropdown) return;
	dropdown.innerHTML = HORIZONS.map((value) => dropdownItem("data-fhorizon", String(value), `${value} 轮`, horizon === value, value === 10 ? "默认" : "")).join("");
	dropdown.querySelectorAll("[data-fhorizon]").forEach((el) => {
		el.onclick = (event) => {
			event.stopPropagation();
			const value = Number(el.getAttribute("data-fhorizon"));
			if (HORIZONS.includes(value)) horizon = value;
			savePreferences();
			closeAllDropdownsInstant();
			afterNextPaint(() => renderForecastView());
		};
	});
}
function hitModeLabel(mode, globalRate, modelRate) {
	if (mode === "manual") return `手动 ${Math.round(manualHitRate)}%`;
	if (mode === "model") return modelRate == null ? "同模型平均 —" : `同模型平均 ${pct(modelRate)}`;
	return globalRate == null ? "全站平均 —" : `全站平均 ${pct(globalRate)}`;
}
function renderHitControl(fullHist, model, series, globalRate, modelRate) {
	const doc = getDoc$5();
	const host = doc.getElementById("aus-forecast-hit-control");
	if (!host) return;
	if (selectedForecastKey === "__all__" || !model) {
		host.innerHTML = "";
		return;
	}
	if (series?.hit.hasData) {
		host.innerHTML = `<span class="aus-forecast-badge" title="命中率来自当前对话的缓存命中 token，不提供手动设置">自动测算 · ${pct(series.hit.rate)}</span>`;
		return;
	}
	host.innerHTML = `
    <div class="aus-forecast-picker" style="position:relative;">
      <div id="aus-forecast-hit-btn" class="aus-forecast-pill" title="该对话没有缓存命中数据，可选择平均命中率">
        <span class="aus-forecast-pill-label">平均命中率</span>
        <span class="aus-forecast-pill-value">${esc(hitModeLabel(hitMode, globalRate, modelRate))}</span>
        ${icon("chevron-down", 14)}
      </div>
      <div id="aus-forecast-hit-dropdown" class="aus-forecast-dropdown"></div>
    </div>
    ${hitMode === "manual" ? `<div class="aus-forecast-hit-range">
      <input id="aus-forecast-hit-range" type="range" min="0" max="100" value="${Math.round(manualHitRate)}">
      <span id="aus-forecast-hit-range-val">${Math.round(manualHitRate)}%</span>
    </div>` : ""}
  `;
	const button = doc.getElementById("aus-forecast-hit-btn");
	const dropdown = doc.getElementById("aus-forecast-hit-dropdown");
	if (button) button.onclick = (event) => {
		event.stopPropagation();
		toggleDropdown("hit");
	};
	if (dropdown) {
		dropdown.innerHTML = [
			dropdownItem("data-fhit", "global", "全站平均", hitMode === "global", globalRate == null ? "无样本" : pct(globalRate)),
			dropdownItem("data-fhit", "model", "同模型平均", hitMode === "model", modelRate == null ? "无样本" : pct(modelRate)),
			dropdownItem("data-fhit", "manual", "手动假设", hitMode === "manual", `${Math.round(manualHitRate)}%`)
		].join("");
		dropdown.querySelectorAll("[data-fhit]").forEach((el) => {
			el.onclick = (event) => {
				event.stopPropagation();
				const mode = el.getAttribute("data-fhit");
				if (mode === "global" || mode === "model" || mode === "manual") hitMode = mode;
				savePreferences();
				closeAllDropdownsInstant();
				afterNextPaint(() => renderForecastView());
			};
		});
	}
	const range = doc.getElementById("aus-forecast-hit-range");
	const valueLabel = doc.getElementById("aus-forecast-hit-range-val");
	if (range) {
		range.oninput = (event) => {
			event.stopPropagation();
			manualHitRate = Math.max(0, Math.min(100, Number(range.value) || 0));
			if (valueLabel) valueLabel.textContent = `${Math.round(manualHitRate)}%`;
			if (hitRefreshTimer) clearTimeout(hitRefreshTimer);
			hitRefreshTimer = setTimeout(() => {
				savePreferences();
				renderForecastView();
			}, 180);
		};
		range.onchange = () => savePreferences();
	}
}
function renderToolbar(fullHist, effective, modelOptions, model, priceContext, series, globalRate, modelRate) {
	const doc = getDoc$5();
	bindGlobalClose();
	const chatLabel = doc.getElementById("aus-forecast-chat-label");
	if (chatLabel) chatLabel.textContent = getForecastLabel(fullHist);
	renderChatDropdown(fullHist);
	const chatButton = doc.getElementById("aus-forecast-chat-btn");
	if (chatButton) chatButton.onclick = (event) => {
		event.stopPropagation();
		toggleDropdown("chat");
	};
	const modelWrap = doc.getElementById("aus-forecast-model-wrap");
	if (modelWrap) modelWrap.style.display = modelOptions.length > 1 && selectedForecastKey !== "__all__" ? "flex" : "none";
	const modelLabel = doc.getElementById("aus-forecast-model-label");
	if (modelLabel) modelLabel.textContent = model || "—";
	renderModelDropdown(modelOptions);
	const modelButton = doc.getElementById("aus-forecast-model-btn");
	if (modelButton) modelButton.onclick = (event) => {
		event.stopPropagation();
		toggleDropdown("model");
	};
	const horizonLabel = doc.getElementById("aus-forecast-horizon-label");
	if (horizonLabel) horizonLabel.textContent = `${horizon} 轮`;
	renderHorizonDropdown();
	const horizonButton = doc.getElementById("aus-forecast-horizon-btn");
	if (horizonButton) horizonButton.onclick = (event) => {
		event.stopPropagation();
		toggleDropdown("horizon");
	};
	renderHitControl(fullHist, model, series, globalRate, modelRate);
	const compactionToggle = doc.getElementById("aus-forecast-compaction-toggle");
	const compactionLabel = doc.getElementById("aus-forecast-compaction-label");
	if (compactionToggle) {
		compactionToggle.checked = compactionEnabled;
		compactionToggle.onchange = () => {
			compactionEnabled = compactionToggle.checked;
			savePreferences();
			renderForecastView();
		};
	}
	if (compactionLabel) compactionLabel.textContent = series?.compactionForecast.detected ? `压缩情景（检测到 ${series?.compactionForecast.count} 次）` : "压缩情景（未检测到）";
	const sub = doc.getElementById("aus-forecast-sub");
	if (sub) {
		const parts = [];
		if (selectedForecastKey === "__all__") parts.push(`全部历史 ${fullHist.length} 条`, "逐轮预测需选择单个对话");
		else {
			parts.push(`样本 ${effective.length} 轮`);
			if (series) {
				parts.push(`当前段 ${series.fit.n} 轮`);
				if (series.compactionForecast.detected) parts.push(`最近压缩第 ${series.compactionForecast.lastRound} 轮`);
			}
			if (priceContext?.known) parts.push(`计价 ${priceContext.walletLabel} · ${model || "—"} · ${priceContext.label}`);
			else parts.push("未配置价格，成本类不可用");
		}
		sub.textContent = parts.join(" · ");
	}
}
function kpiCard(label, value, sub, tone = "default", title = "") {
	return `<div class="ds-card aus-forecast-kpi aus-forecast-kpi-${tone}"${title ? ` title="${esc(title)}"` : ""}>
    <div class="aus-forecast-kpi-label">${esc(label)}</div>
    <div class="aus-forecast-kpi-value">${value}</div>
    <div class="aus-forecast-kpi-sub">${sub}</div>
  </div>`;
}
function renderKpis(series, priceContext, ctxLimit, options, balance) {
	const host = getDoc$5().getElementById("aus-forecast-kpis");
	if (!host) return;
	const remaining = balance != null ? simulateRemainingRounds(balance, series, options) : null;
	const ctxRounds = contextRoundsFor(series, ctxLimit, options.compaction);
	const futureCost = series.future.reduce((sum, point) => sum + (point.cost ?? 0), 0);
	const futureInput = series.future.reduce((sum, point) => sum + point.input, 0);
	const pricingKnown = priceContext?.known === true;
	const costValue = series.next.cost == null || !pricingKnown ? "—" : formatCost(series.next.cost, 4);
	const costSub = series.next.cost == null || !pricingKnown ? "未配置价格，成本类不可用" : series.next.costLow != null && series.next.costHigh != null ? `区间 ${formatCost(series.next.costLow, 4)} – ${formatCost(series.next.costHigh, 4)}` : "按当前模型与时段价格";
	const ctxCompaction = options.compaction && series.compactionForecast.detected;
	const promptOverLimit = ctxLimit != null && series.currentPrompt > ctxLimit;
	const ctxValue = ctxCompaction ? series.compactionForecast.roundsUntilNext != null ? `距下次压缩 ${series.compactionForecast.roundsUntilNext} 轮` : "距下次压缩 —" : ctxRounds != null ? `${ctxRounds} 轮` : ctxLimit != null && series.fit.delta <= 0 ? "可维持" : "—";
	const ctxSub = ctxCompaction ? `预计第 ${series.compactionForecast.nextRound ?? "—"} 轮 · 本次压缩前 ${series.compactionForecast.period ?? "—"} 轮` : ctxLimit != null ? promptOverLimit ? `当前输入 ${compactTok(series.currentPrompt)} 已超过参考上限 ${compactTok(ctxLimit)} tok` : series.fit.delta <= 0 ? "Δ≈0，上下文不再增长" : `上下文上限 ${compactTok(ctxLimit)} tok` : "上下文上限未知";
	const remainingValue = remaining == null ? "—" : `${remaining.R} 轮`;
	const remainingSub = balance == null ? "未设置余额，可在钱包页填写" : !pricingKnown ? "未配置价格，无法估算" : `区间 ${remaining?.low ?? 0} – ${remaining?.high ?? 0} 轮${remaining?.ctxLimited ? " · 受上下文上限限制" : ""}`;
	host.innerHTML = [
		kpiCard("下一轮输入", `${compactTok(series.next.input)} tok`, `区间 ${compactTok(series.next.inputLow)} – ${compactTok(series.next.inputHigh)}`, "default", "基于当前段增长拟合，95% 预测区间"),
		kpiCard("下一轮输出", `${compactTok(series.next.output)} tok`, `非截断样本 ${series.output.samples} 条`, "default", "已剔除截断/异常输出样本"),
		kpiCard("下一轮成本", costValue, costSub, "orange", "按当前计价模型、钱包与下一轮预计时段价格"),
		kpiCard("命中率", pct(series.hit.rate), hitSourceText(series), series.hit.hasData ? "green" : "orange", "有缓存数据时自动测算；无数据时才使用平均命中率"),
		kpiCard("每轮增量 Δ", `${compactTok(series.fit.delta)} tok/轮`, `当前段 ${series.fit.n} 轮 · ${series.fit.model === "linear" ? "线性拟合" : "近期均值"}`, "default", "当前压缩后段的平均每轮新增"),
		kpiCard("余额可撑", remainingValue, remainingSub, remaining != null && remaining.R <= 0 ? "red" : "default", "按预测成本逐轮累加，直到余额不足"),
		kpiCard("上下文可撑", ctxValue, ctxSub, ctxCompaction ? "green" : "default", "未启用压缩预测时按当前 Δ 线性外推"),
		kpiCard("未来 N 轮总成本", pricingKnown ? formatCost(futureCost, 4) : "—", pricingKnown ? `未来 ${series.future.length} 轮 · 输入 ${compactTok(futureInput)} tok` : "未配置价格，成本类不可用", "orange", "按当前视界累加预测成本")
	].join("");
}
function renderHealth(history, model) {
	const host = getDoc$5().getElementById("aus-forecast-health");
	if (!host) return;
	if (!history.length) {
		host.innerHTML = "<div class=\"aus-forecast-empty\">暂无数据</div>";
		return;
	}
	const result = energyScore([...history].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)), null);
	const colors = {
		A: "#16a34a",
		B: "#22c55e",
		C: "#84cc16",
		D: "#eab308",
		E: "#f97316",
		F: "#ef4444",
		G: "#dc2626"
	};
	const grades = [
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G"
	];
	const metrics = result.metrics;
	host.innerHTML = `
    <div class="aus-forecast-health-grades">
      ${grades.map((grade) => `<span class="aus-forecast-grade${grade === result.grade ? " is-current" : ""}" style="background:${colors[grade]};">${grade}</span>`).join("")}
    </div>
    <div class="aus-forecast-health-score">
      <span class="aus-forecast-health-score-value" style="color:${colors[result.grade]};">${result.score.toFixed(0)}</span>
      <span class="aus-forecast-health-score-label">综合评分 · ${result.grade} 级</span>
    </div>
    <div class="aus-forecast-health-metrics">
      <div><span>增速 Δ</span><b>${compactTok(metrics.delta)} tok/轮</b></div>
      <div><span>输出</span><b>${compactTok(metrics.out)} tok/轮</b></div>
      <div><span>效率</span><b>${pct(metrics.efficiency)}</b></div>
      <div><span>命中</span><b>${pct(metrics.hitRate)}</b></div>
      <div><span>截断</span><b>${pct(metrics.truncRate)}</b></div>
      <div><span>思维链</span><b>${pct(metrics.thinkRatio)}</b></div>
    </div>
    <div class="aus-forecast-health-foot">样本 ${history.length} 轮 · ${esc(model || "—")} · ${esc(getForecastLabel(lastFullHistory))}</div>
  `;
}
function renderCompaction(series, options) {
	const host = getDoc$5().getElementById("aus-forecast-compaction");
	if (!host) return;
	const forecast = series.compactionForecast;
	if (!forecast.detected) {
		host.innerHTML = `<div class="aus-forecast-empty">
      未检测到上下文压缩。判定规则：prompt 环比回落 ≥20% 且绝对降幅 ≥1500 tok；若酒馆使用总结/隐藏楼层，压缩点会在这里自动标记。
    </div>`;
		return;
	}
	const list = series.compactions.slice(-3).reverse().map((point) => {
		const gapLabel = point.gapRounds === point.round ? `累计 ${point.gapRounds} 轮` : `间隔 ${point.gapRounds} 轮`;
		return `<div class="aus-forecast-compaction-row">
    <span class="aus-forecast-compaction-round">第 ${point.round} 轮</span>
    <span class="aus-forecast-compaction-change">${compactTok(point.before)} → ${compactTok(point.after)}</span>
    <span class="aus-forecast-compaction-drop">-${Math.round(point.dropPct * 100)}%</span>
    <span class="aus-forecast-compaction-gap">${gapLabel}</span>
  </div>`;
	}).join("");
	host.innerHTML = `
    <div class="aus-forecast-compaction-grid">
      <div><span>本次压缩前</span><b>${forecast.period ?? "—"} 轮</b></div>
      <div><span>压缩后保留</span><b>${forecast.retention != null ? Math.round(forecast.retention * 100) + "%" : "—"}</b></div>
      <div><span>当前段已持续</span><b>${forecast.segmentAge} 轮</b></div>
      <div><span>预计下次压缩</span><b>${forecast.nextRound != null ? `第 ${forecast.nextRound} 轮` : "—"}</b></div>
    </div>
    <div class="aus-forecast-compaction-note">
      ${options.compaction ? `按最近一次压缩前 ${forecast.period ?? "—"} 轮推算，约 ${forecast.roundsUntilNext ?? "—"} 轮后触发。` : "压缩情景已关闭，当前预测按线性外推。"}
      ${forecast.postHitRate != null ? ` 压缩后首轮命中率 ${pct(forecast.postHitRate)}。` : ""}
      ${forecast.medianGap != null ? ` 历史间隔中位 ${forecast.medianGap} 轮。` : ""}
    </div>
    <div class="aus-forecast-compaction-list">${list}</div>
    <div class="aus-forecast-compaction-foot">样本较少时压缩周期仅供参考；预测压缩点会在主图中以橙色虚线标出。</div>
  `;
}
function sortEfficiencyRows(rows) {
	if (!efficiencySort) return rows;
	const { key, dir } = efficiencySort;
	const sign = dir === "asc" ? 1 : -1;
	return [...rows].sort((a, b) => {
		const left = a[key];
		const right = b[key];
		if (left == null && right == null) return 0;
		if (left == null) return 1;
		if (right == null) return -1;
		if (typeof left === "string") return String(left).localeCompare(String(right)) * sign;
		return (Number(left) - Number(right)) * sign;
	});
}
function renderEfficiency(history, scopeLabel) {
	const doc = getDoc$5();
	const host = doc.getElementById("aus-forecast-efficiency");
	const sub = doc.getElementById("aus-forecast-efficiency-sub");
	const scopeButton = doc.getElementById("aus-forecast-scope-btn");
	if (scopeButton) {
		scopeButton.innerHTML = `<span class="aus-forecast-pill-label">范围</span><span class="aus-forecast-pill-value">${scopeLabel}</span>${icon("chevron-down", 14)}`;
		scopeButton.onclick = (event) => {
			event.stopPropagation();
			toggleDropdown("scope");
		};
	}
	const scopeDropdown = doc.getElementById("aus-forecast-scope-dropdown");
	if (scopeDropdown) {
		scopeDropdown.innerHTML = [dropdownItem("data-fscope", "all", "全部历史", efficiencyScope === "all", `${lastFullHistory.length} 条`), dropdownItem("data-fscope", "chat", "当前对话", efficiencyScope === "chat", `${getCurrentChatHist(lastFullHistory).length} 条`)].join("");
		scopeDropdown.querySelectorAll("[data-fscope]").forEach((el) => {
			el.onclick = (event) => {
				event.stopPropagation();
				const value = el.getAttribute("data-fscope");
				if (value === "all" || value === "chat") efficiencyScope = value;
				savePreferences();
				closeAllDropdownsInstant();
				afterNextPaint(() => renderForecastView());
			};
		});
	}
	if (!host) return;
	const rows = computeModelEfficiency(history, { priceForModel: (model) => resolvePriceContext(history, model)?.trio ?? null });
	lastEfficiencyHistory = history;
	lastEfficiencyLabel = scopeLabel;
	if (!rows.length) {
		host.innerHTML = "<div class=\"aus-forecast-empty\">暂无模型效率数据</div>";
		if (sub) sub.textContent = `范围：${scopeLabel} · 暂无记录`;
		return;
	}
	const sorted = sortEfficiencyRows(rows);
	const selectableModels = new Set(getModelOptions(lastEffectiveHistory).map((option) => option.model));
	const pricedCosts = sorted.map((row) => row.costPer1kOutput).filter((value) => value != null && value > 0);
	const maxCost = pricedCosts.length ? Math.max(...pricedCosts) : 0;
	const sortArrow = (key) => {
		if (!efficiencySort || efficiencySort.key !== key) return "<span class=\"aus-forecast-sort-arrow\">↕</span>";
		return `<span class="aus-forecast-sort-arrow is-active">${efficiencySort.dir === "asc" ? "↑" : "↓"}</span>`;
	};
	const header = (key, label) => `<th class="aus-forecast-eff-th" data-sort="${key}">${label}${sortArrow(key)}</th>`;
	const firstPriced = sorted.find((row) => row.costPer1kOutput != null);
	const body = sorted.map((row) => {
		const isBest = firstPriced === row;
		const cost = row.costPer1kOutput == null ? "—" : formatCost(row.costPer1kOutput, 4);
		const width = row.costPer1kOutput != null && maxCost > 0 ? Math.max(3, Math.min(100, row.costPer1kOutput / maxCost * 100)) : 0;
		const hit = row.hitRate == null ? "—" : pct(row.hitRate);
		const saving = row.cacheSaving == null ? "—" : pct(row.cacheSaving);
		const avg = row.avgCost == null ? "—" : formatCost(row.avgCost, 4);
		const ratio = row.ioRatio == null ? "—" : `${row.ioRatio.toFixed(1)} : 1`;
		const selectable = selectableModels.has(row.model);
		return `<tr class="aus-forecast-eff-row${row.model === selectedForecastModel ? " is-selected" : ""}" data-eff-model="${esc(row.model)}" title="${selectable ? "点击切换为计价模型" : "该模型不在当前对话中，仅作全量对比"}">
      <td><div class="aus-forecast-eff-model"><span>${esc(row.model)}</span>${isBest ? "<span class=\"aus-forecast-eff-best\">最省</span>" : ""}</div></td>
      <td>${row.rounds}</td>
      <td>${ratio}</td>
      <td><div class="aus-forecast-eff-cost"><span>${cost}</span><span class="aus-forecast-eff-bar"><i style="width:${width}%"></i></span></div></td>
      <td>${hit}</td>
      <td>${saving}</td>
      <td>${avg}</td>
    </tr>`;
	}).join("");
	host.innerHTML = `<div class="aus-forecast-eff-wrap">
    <table class="aus-forecast-eff-table">
      <thead><tr>
        <th class="aus-forecast-eff-th" data-sort="model">模型${sortArrow("model")}</th>
        ${header("rounds", "轮次")}
        ${header("ioRatio", "输入/输出")}
        ${header("costPer1kOutput", "每 1k 输出成本")}
        ${header("hitRate", "命中率")}
        ${header("cacheSaving", "缓存节省")}
        ${header("avgCost", "平均每轮")}
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
	if (sub) sub.textContent = `范围：${scopeLabel}（${history.length} 条）· 按每 1k 输出成本升序 · 点击行可切换计价模型`;
	host.querySelectorAll("th[data-sort]").forEach((th) => {
		th.onclick = (event) => {
			event.stopPropagation();
			const key = th.getAttribute("data-sort");
			if (!key) return;
			if (efficiencySort && efficiencySort.key === key) efficiencySort = {
				key,
				dir: efficiencySort.dir === "asc" ? "desc" : "asc"
			};
			else efficiencySort = {
				key,
				dir: key === "model" ? "asc" : "asc"
			};
			renderEfficiency(lastEfficiencyHistory, lastEfficiencyLabel);
		};
	});
	host.querySelectorAll("[data-eff-model]").forEach((tr) => {
		tr.onclick = (event) => {
			event.stopPropagation();
			const model = tr.getAttribute("data-eff-model");
			if (!model) return;
			if (!getModelOptions(lastEffectiveHistory).some((option) => option.model === model)) return;
			selectedForecastModel = model;
			closeAllDropdownsInstant();
			afterNextPaint(() => renderForecastView());
		};
	});
}
function chatDisplayNameMap(fullHist) {
	const map = /* @__PURE__ */ new Map();
	for (const chat of getRecordedChatsForForecast(fullHist)) map.set(chat.chatId ?? "__null__", chat.displayName);
	return map;
}
function renderTop(fullHist) {
	const doc = getDoc$5();
	const host = doc.getElementById("aus-forecast-top");
	const toggle = doc.getElementById("aus-forecast-top-toggle");
	if (!host || !toggle) return;
	toggle.textContent = `${showTop ? "▾" : "▸"} 最耗对话 Top`;
	toggle.onclick = (event) => {
		event.stopPropagation();
		showTop = !showTop;
		savePreferences();
		renderTop(fullHist);
	};
	host.style.display = showTop ? "block" : "none";
	if (!showTop) return;
	const list = topPowerChats(fullHist, 8);
	if (!list.length) {
		host.innerHTML = "<div class=\"aus-forecast-empty\">暂无对话</div>";
		return;
	}
	const names = chatDisplayNameMap(fullHist);
	const colors = {
		A: "#16a34a",
		B: "#22c55e",
		C: "#84cc16",
		D: "#eab308",
		E: "#f97316",
		F: "#ef4444",
		G: "#dc2626"
	};
	host.innerHTML = list.map((row) => {
		const key = row.chatId ?? "__null__";
		const name = names.get(key) || row.chatId || "未分组/旧数据";
		const entries = fullHist.filter((entry) => (entry.chatId ?? null) === row.chatId);
		const avgCost = entries.length ? entries.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0) / entries.length : 0;
		const pctWidth = Math.max(4, Math.min(100, row.delta / Math.max(1, list[0].delta) * 100));
		return `<div class="aus-forecast-top-row">
      <span class="aus-forecast-top-name" title="${esc(row.chatId || "未分组/旧数据")}">${esc(name)}</span>
      <span class="aus-forecast-grade aus-forecast-grade-sm" style="background:${colors[row.grade] || "#9CA3AF"};">${row.grade}</span>
      <span class="aus-forecast-top-bar"><span style="width:${pctWidth}%"></span></span>
      <span class="aus-forecast-top-delta">${compactTok(row.delta)} tok/轮</span>
      <span class="aus-forecast-top-cost">${formatCost(avgCost, 4)}/轮</span>
    </div>`;
	}).join("");
}
function clearCharts(message) {
	disposeForecastCharts();
	const doc = getDoc$5();
	for (const id of [
		"aus-forecast-main-chart",
		"aus-forecast-hit-chart",
		"aus-forecast-cost-chart"
	]) {
		const el = doc.getElementById(id);
		if (el) el.innerHTML = `<div class="aus-forecast-chart-empty">${esc(message)}</div>`;
	}
}
function renderNoticeCards(message) {
	const doc = getDoc$5();
	const kpis = doc.getElementById("aus-forecast-kpis");
	if (kpis) kpis.innerHTML = `<div class="ds-card aus-forecast-notice">${esc(message)}</div>`;
	const health = doc.getElementById("aus-forecast-health");
	if (health) health.innerHTML = "<div class=\"aus-forecast-empty\">需要单个对话的逐轮数据</div>";
	const compaction = doc.getElementById("aus-forecast-compaction");
	if (compaction) compaction.innerHTML = "<div class=\"aus-forecast-empty\">需要单个对话的逐轮数据</div>";
}
function renderAllNotice() {
	renderNoticeCards("当前选择“全部”历史。逐轮预测、压缩与健康度需要单个对话的时间序列；请从上方对话胶囊选择具体对话。下方模型效率对比仍可查看。");
	clearCharts("请选择单个对话以查看逐轮预测");
	const mainSub = getDoc$5().getElementById("aus-forecast-main-sub");
	if (mainSub) mainSub.textContent = "逐轮预测需要指定单个对话";
}
function renderNoSeries(message) {
	renderNoticeCards(message);
	clearCharts(message);
	const mainSub = getDoc$5().getElementById("aus-forecast-main-sub");
	if (mainSub) mainSub.textContent = message;
}
function renderMainSub(series, ctxLimit) {
	const mainSub = getDoc$5().getElementById("aus-forecast-main-sub");
	if (!mainSub) return;
	const future = series.future.length;
	const parts = [
		`历史 ${series.history.length} 轮`,
		future ? `未来 ${future} 轮` : "未来预测受上下文上限限制",
		"虚线为预测 · 阴影为 95% 区间"
	];
	if (series.compactionForecast.detected) parts.push("橙色标记为压缩点");
	if (ctxLimit != null && series.history.some((point) => point.input > ctxLimit)) parts.push("历史输入已超过参考上限，参考线按当前计价模型估算");
	mainSub.textContent = parts.join(" · ");
}
async function renderForecastView() {
	const token = ++renderToken$1;
	let fullHist = [];
	try {
		fullHist = await repository.getAllHistory();
	} catch {
		fullHist = state$2.history || [];
	}
	if (token !== renderToken$1) return;
	lastFullHistory = fullHist;
	bindGlobalClose();
	const effective = getEffectiveHist(fullHist);
	lastEffectiveHistory = effective;
	const modelOptions = getModelOptions(effective);
	if (!selectedForecastModel || !modelOptions.some((option) => option.model === selectedForecastModel)) selectedForecastModel = modelOptions[0]?.model || null;
	const model = selectedForecastModel;
	const priceContext = model ? resolvePriceContext(effective, model) : null;
	const ctxLimit = model ? ctxLimitForModel(model, (priceContext?.walletModel)?.contextLimit) : null;
	const globalRate = computeGlobalHitRate(fullHist);
	const modelRate = model ? computeModelHitRate(fullHist, model) : null;
	const hitFallback = {
		mode: hitMode,
		globalRate,
		modelRate,
		manualRate: manualHitRate / 100
	};
	const options = {
		horizon,
		pricing: priceContext?.known && priceContext.trio ? priceContext.trio : null,
		ctxLimit,
		hitFallback,
		compaction: compactionEnabled
	};
	const series = selectedForecastKey !== "__all__" && effective.length ? buildForecastSeries(effective, options) : null;
	renderToolbar(fullHist, effective, modelOptions, model, priceContext, series, globalRate, modelRate);
	if (!fullHist.length) {
		renderNoSeries("暂无数据，发起一次对话后自动统计");
		renderEfficiency(fullHist, "全部历史");
		renderTop(fullHist);
		return;
	}
	if (selectedForecastKey === "__all__") {
		renderAllNotice();
		renderEfficiency(efficiencyScope === "all" ? fullHist : getCurrentChatHist(fullHist), efficiencyScope === "all" ? "全部历史" : "当前对话");
		renderTop(fullHist);
		return;
	}
	if (!series) {
		renderNoSeries(selectedForecastKey === "__current__" && !currentChatId() ? "未打开对话。请先进入一个聊天，或从上方选择一个具体对话。" : "当前对话暂无可用于预测的记录，继续对话后自动启用。");
		renderEfficiency(efficiencyScope === "all" ? fullHist : effective, efficiencyScope === "all" ? "全部历史" : "当前对话");
		renderTop(fullHist);
		return;
	}
	renderMainSub(series, ctxLimit);
	renderKpis(series, priceContext, ctxLimit, options, balanceNum());
	renderHealth(effective, model);
	renderCompaction(series, options);
	renderEfficiency(efficiencyScope === "all" ? fullHist : effective, efficiencyScope === "all" ? "全部历史" : "当前对话");
	renderTop(fullHist);
	try {
		await renderForecastCharts({
			series,
			ctxLimit,
			currency: currencyInfo(),
			formatCost: (value, digits) => formatCost(value, digits ?? 4)
		});
	} catch (error) {
		console.error("[Api-Usage] 趋势预测图表渲染失败", error);
	}
}
function initForecastView() {
	loadPreferences();
	bindGlobalClose();
}
//#endregion
//#region src/ui/vendor-icons.ts
/**
* 厂商官方图标（内联 SVG path，24×24 视框，fill: currentColor）。
*
* 路径数据取自 simple-icons（其 SVG 数据以 CC0 发布，免费用于个人与商业项目）；
* 各品牌名称与图形商标归各自所有者，本扩展仅用于标识接入来源，不代表任何关联、合作或背书。
* 没有收录的厂商（如 Cohere、Groq、Z.AI、硅基流动、阶跃、Novita、讯飞等）自动回退为字标。
*/
var VENDOR_ICON_PATHS = {
	deepseek: "M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45",
	anthropic: "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z",
	google: "M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81",
	xai: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
	mistral: "M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z",
	openrouter: "M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z",
	minimax: "M11.43 3.92a.86.86 0 1 0-1.718 0v14.236a1.999 1.999 0 0 1-3.997 0V9.022a.86.86 0 1 0-1.718 0v3.87a1.999 1.999 0 0 1-3.997 0V11.49a.57.57 0 0 1 1.139 0v1.404a.86.86 0 0 0 1.719 0V9.022a1.999 1.999 0 0 1 3.997 0v9.134a.86.86 0 0 0 1.719 0V3.92a1.998 1.998 0 1 1 3.996 0v11.788a.57.57 0 1 1-1.139 0zm10.572 3.105a2 2 0 0 0-1.999 1.997v7.63a.86.86 0 0 1-1.718 0V3.923a1.999 1.999 0 0 0-3.997 0v16.16a.86.86 0 0 1-1.719 0V18.08a.57.57 0 1 0-1.138 0v2a1.998 1.998 0 0 0 3.996 0V3.92a.86.86 0 0 1 1.719 0v12.73a1.999 1.999 0 0 0 3.996 0V9.023a.86.86 0 1 1 1.72 0v6.686a.57.57 0 0 0 1.138 0V9.022a2 2 0 0 0-1.998-1.997",
	moonshot: "m1.053 16.91 9.538 2.55a21 20.981 0 0 0 .06 2.031l5.956 1.592a12 11.99 0 0 1-15.554-6.172m-1.02-5.79 11.352 3.035a21 20.981 0 0 0-.469 2.01l10.817 2.89a12 11.99 0 0 1-1.845 2.004L.658 15.918a12 11.99 0 0 1-.625-4.796m1.593-5.146L13.573 9.17a21 20.981 0 0 0-1.01 1.874l11.297 3.02a21 20.981 0 0 1-.67 2.362l-11.55-3.087L.125 10.26a12 11.99 0 0 1 1.499-4.285ZM6.067 1.58l11.285 3.016a21 20.981 0 0 0-1.688 1.719l7.824 2.091a21 20.981 0 0 1 .513 2.664L2.107 5.218a12 11.99 0 0 1 3.96-3.638M21.68 4.866 7.222 1.003A12 11.99 0 0 1 21.68 4.866",
	dashscope: "M23.919 14.545 20.817 9.17l1.47-2.544a.56.56 0 0 0 0-.566l-1.633-2.83a.57.57 0 0 0-.49-.283h-6.207L12.487.402a.57.57 0 0 0-.49-.284H8.732a.56.56 0 0 0-.49.284L5.139 5.775h-2.94a.56.56 0 0 0-.49.284L.077 8.887a.56.56 0 0 0 0 .567L3.18 14.83l-1.47 2.545a.56.56 0 0 0 0 .566l1.634 2.83a.57.57 0 0 0 .49.283h6.205l1.47 2.545a.57.57 0 0 0 .49.284h3.266a.57.57 0 0 0 .49-.284l3.104-5.375h2.94a.57.57 0 0 0 .49-.283l1.634-2.828a.55.55 0 0 0-.004-.568M8.733.686l1.634 2.828-1.634 2.828H21.8L20.164 9.17H7.425L5.63 6.06Zm1.306 19.801-6.205-.002 1.634-2.83h3.265L2.201 6.344h3.267q3.182 5.517 6.367 11.032zm10.124-5.66L18.53 12l-6.532 11.315-1.634-2.83c2.129-3.673 4.25-7.351 6.373-11.028h3.592l3.102 5.374z",
	baidu: "M9.154 0C7.71 0 6.54 1.658 6.54 3.707c0 2.051 1.171 3.71 2.615 3.71 1.446 0 2.614-1.659 2.614-3.71C11.768 1.658 10.6 0 9.154 0zm7.025.594C14.86.58 13.347 2.589 13.2 3.927c-.187 1.745.25 3.487 2.179 3.735 1.933.25 3.175-1.806 3.422-3.364.252-1.555-.995-3.364-2.362-3.674a1.218 1.218 0 0 0-.261-.03zM3.582 5.535a2.811 2.811 0 0 0-.156.008c-2.118.19-2.428 3.24-2.428 3.24-.287 1.41.686 4.425 3.297 3.864 2.617-.561 2.262-3.68 2.183-4.362-.125-1.018-1.292-2.773-2.896-2.75zm16.534 1.753c-2.308 0-2.617 2.119-2.617 3.616 0 1.43.121 3.425 2.988 3.362 2.867-.063 2.553-3.238 2.553-3.988 0-.745-.62-2.99-2.924-2.99zm-8.264 2.478c-1.424.014-2.708.925-3.323 1.947-1.118 1.868-2.863 3.05-3.112 3.363-.25.309-3.61 2.116-2.864 5.42.746 3.301 3.365 3.237 3.365 3.237s1.93.19 4.171-.31c2.24-.495 4.17.123 4.17.123s5.233 1.748 6.665-1.616c1.43-3.364-.808-5.109-.808-5.109s-2.99-2.306-4.736-4.798c-1.072-1.665-2.348-2.268-3.528-2.257zm-2.234 3.84l1.542.024v8.197H7.758c-1.47-.291-2.055-1.292-2.13-1.462-.072-.173-.488-.976-.268-2.343.635-2.049 2.447-2.196 2.447-2.196h1.81zm3.964 2.39v3.881c.096.413.612.488.612.488h1.614v-4.343h1.689v5.782h-3.915c-1.517-.39-1.59-1.465-1.59-1.465v-4.317zm-5.458 1.147c-.66.197-.978.708-1.05.928-.076.22-.247.78-.1 1.269.294 1.095 1.248 1.144 1.248 1.144h1.37v-3.34z",
	github: "M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z",
	cursor: "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23",
	openai: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
	tencent: "M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673"
};
/** 生成内联 SVG；该厂商没有官方图标时返回 null（调用方回退字标） */
function vendorIconSvg(id, size = 20) {
	const path = VENDOR_ICON_PATHS[String(id || "").trim().toLowerCase()];
	if (!path) return null;
	return "<svg viewBox=\"0 0 24 24\" width=\"" + size + "\" height=\"" + size + "\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\" style=\"display:block;\"><path d=\"" + path + "\"/></svg>";
}
//#endregion
//#region src/ui/wallet-sync-preview.ts
var OVERLAY_ID = "aus-wallet-sync-overlay";
var MODE_LABELS = [
	{
		id: "add-missing",
		label: "只补未定价"
	},
	{
		id: "overwrite-unlocked",
		label: "覆盖未锁定"
	},
	{
		id: "overwrite-all",
		label: "全部覆盖"
	}
];
function getDoc$4() {
	return window.parent?.document ?? document;
}
function money$1(value) {
	if (value == null) return "—";
	try {
		return formatMoney(value, 6);
	} catch {
		return String(value);
	}
}
function scoreLabel(row) {
	if (row.action === "unmatched") return "<span style=\"color:var(--ds-text-3);\">未匹配</span>";
	const percent = Math.round(row.score * 100);
	const exact = row.reason === "exact" || row.reason === "normalized" || row.reason === "alias";
	const color = exact ? "var(--ds-green)" : row.ambiguous ? "var(--ds-red)" : "var(--ds-orange)";
	const text = exact ? "精确" : row.ambiguous ? "歧义 " + percent + "%" : "模糊 " + percent + "%";
	return "<span style=\"color:" + color + ";font-weight:600;\">" + text + "</span>";
}
function actionLabel(row) {
	if (row.action === "write") return "<span style=\"color:var(--ds-red);\">待写入</span>";
	if (row.action === "update") return "<span style=\"color:var(--ds-orange);\">将更新</span>";
	if (row.action === "skip-locked") return "<span style=\"color:var(--ds-text-3);\">已锁定</span>";
	if (row.action === "skip-same") return "<span style=\"color:var(--ds-text-3);\">无变化</span>";
	return "<span style=\"color:var(--ds-text-3);\">—</span>";
}
function tierText(row) {
	if (!row.next) return "—";
	const before = row.current ? money$1(row.current.hit) + " / " + money$1(row.current.miss) + " / " + money$1(row.current.output) : "未定价";
	const after = money$1(row.next.hit) + " / " + money$1(row.next.miss) + " / " + money$1(row.next.output);
	if (!row.current) return "<span style=\"color:var(--ds-red);\">" + after + "</span>";
	if (row.current.hit === row.next.hit && row.current.miss === row.next.miss && row.current.output === row.next.output) return "<span style=\"color:var(--ds-text-3);\">" + after + "</span>";
	return "<span style=\"color:var(--ds-text-3);text-decoration:line-through;\">" + before + "</span> → <b>" + after + "</b>";
}
async function openWalletSyncPreview(options = {}) {
	const doc = getDoc$4();
	const existing = doc.getElementById(OVERLAY_ID);
	if (existing) existing.remove();
	const overlay = doc.createElement("div");
	overlay.id = OVERLAY_ID;
	overlay.style.cssText = "position:absolute;inset:0;z-index:400;background:rgba(15,20,25,0.32);display:flex;align-items:center;justify-content:center;padding:16px;";
	overlay.innerHTML = "<div style=\"width:min(880px,100%);max-height:86%;display:flex;flex-direction:column;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:14px;overflow:hidden;\"><div style=\"display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--ds-border);\"><div style=\"font-weight:600;color:var(--ds-text);\">价格同步预览</div><button data-sync-close=\"1\" style=\"display:flex;align-items:center;gap:4px;padding:5px 9px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;\">" + icon("close", 14) + " 关闭</button></div><div data-sync-body=\"1\" style=\"padding:12px 14px;overflow:auto;display:grid;gap:10px;\"></div></div>";
	(doc.getElementById("aus-panel") || doc.getElementById("aus-main") || doc.body).appendChild(overlay);
	const close = () => {
		overlay.remove();
		doc.removeEventListener("keydown", onKey);
	};
	const onKey = (event) => {
		if (event?.key === "Escape") close();
	};
	doc.addEventListener("keydown", onKey);
	overlay.addEventListener("click", (event) => {
		if (event.target === overlay) close();
	});
	overlay.querySelector("[data-sync-close]")?.addEventListener("click", close);
	const body = overlay.querySelector("[data-sync-body]");
	body.innerHTML = "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-2);\">正在拉取价格目录（首次约 6 MB，之后走浏览器缓存）…</div>";
	const walletId = options.walletId;
	const wallet = walletId ? repository.getWallet(walletId) : null;
	if (walletId && !wallet) {
		body.textContent = "钱包不存在";
		return;
	}
	if (wallet && !wallet.catalogProvider) {
		body.innerHTML = "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-2);\">该钱包还没有选择价格来源，请先在「价格来源」中选择供应商。</div>";
		return;
	}
	let catalog = null;
	try {
		catalog = await fetchModelsDevCatalog();
	} catch (error) {
		body.innerHTML = "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-red);\">价格目录拉取失败：" + esc(error?.message || error) + "</div>";
		return;
	}
	wallet && resolveVendor({
		sourceType: wallet.sourceType,
		endpointDisplay: wallet.endpointDisplay,
		endpointLabel: wallet.endpointLabel,
		endpointId: wallet.endpointId,
		models: wallet.models.map((item) => item.model)
	});
	const providerVendor = wallet?.catalogProvider ? vendorById(wallet.catalogProvider) : null;
	let mode = "add-missing";
	let onlyChanged = true;
	let keyword = "";
	let plan = buildSyncPlan(catalog, {
		walletIds: walletId ? [walletId] : void 0,
		mode
	});
	const selected = new Set(plan.rows.filter((row) => row.changed && !row.ambiguous).map((row) => row.key));
	const render = () => {
		const rows = plan.rows.filter((row) => {
			if (onlyChanged && !row.changed) return false;
			if (!keyword) return true;
			return (row.localModel + " " + (row.catalogModel || "")).toLowerCase().includes(keyword.toLowerCase());
		});
		const actionable = plan.rows.filter((row) => row.changed && !row.ambiguous);
		const head = "<div style=\"display:flex;flex-wrap:wrap;align-items:center;gap:8px;\"><div style=\"display:flex;align-items:center;gap:6px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);\">" + (providerVendor ? "<span style=\"width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;background:" + providerVendor.color + ";color:#fff;font-size:10px;font-weight:700;\">" + (vendorIconSvg(providerVendor.id, 12) || esc(providerVendor.mark)) + "</span>" : "") + "供应商 <b style=\"color:var(--ds-text);\">" + esc(plan.providerLabel || "未选择") + "</b></div><div style=\"display:flex;gap:4px;margin-left:auto;\">" + MODE_LABELS.map((item) => "<button data-sync-mode=\"" + item.id + "\" style=\"padding:5px 10px;border:1px solid " + (mode === item.id ? "var(--ds-black)" : "var(--ds-border)") + ";border-radius:999px;background:" + (mode === item.id ? "var(--ds-black)" : "var(--ds-card)") + ";color:" + (mode === item.id ? "var(--ds-black-text)" : "var(--ds-text)") + ";font-size:var(--aus-fs-sm);cursor:pointer;\">" + item.label + "</button>").join("") + "</div></div><div style=\"display:flex;flex-wrap:wrap;align-items:center;gap:8px;\"><input data-sync-search=\"1\" value=\"" + esc(keyword) + "\" placeholder=\"搜索模型\" style=\"flex:1;min-width:140px;padding:6px 9px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card);color:var(--ds-text);font-size:var(--aus-fs-sm);\" /><label style=\"display:flex;align-items:center;gap:5px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);cursor:pointer;\"><input type=\"checkbox\" class=\"aus-checkbox\" data-sync-only-changed=\"1\" " + (onlyChanged ? "checked" : "") + " /> 仅看变化</label></div><div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);line-height:1.7;\">按钱包里已识别的模型名，在目录中用模糊匹配找到对应价格后写入该模型（不会新增模型）。 匹配 " + plan.summary.matched + " · 精确 " + plan.summary.exact + " · 模糊 " + plan.summary.fuzzy + (plan.summary.ambiguous ? " · 歧义 " + plan.summary.ambiguous : "") + " · 未匹配 " + plan.summary.unmatched + " · 单位 " + getDisplayCurrency().code + "/百万 tokens</div>";
		const table = rows.length ? "<div style=\"width:100%;overflow:auto;border-radius:10px;\"><table style=\"width:100%;min-width:720px;border-collapse:collapse;font-size:var(--aus-fs-sm);\"><thead><tr style=\"text-align:left;color:var(--ds-text-2);background:var(--ds-card);\"><th style=\"padding:6px;\">选</th><th style=\"padding:6px;\">钱包模型</th><th style=\"padding:6px;\">匹配</th><th style=\"padding:6px;\">目录模型</th><th style=\"padding:6px;\">价格（命中/未命中/输出）</th><th style=\"padding:6px;\">动作</th></tr></thead><tbody>" + rows.map((row) => {
			const checked = selected.has(row.key);
			return "<tr style=\"border-top:1px solid var(--ds-border);\"><td style=\"padding:6px;\"><input type=\"checkbox\" class=\"aus-checkbox\" data-sync-row=\"" + esc(row.key) + "\" " + (checked ? "checked" : "") + " " + (row.changed ? "" : "disabled") + " /></td><td style=\"padding:6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\" title=\"" + esc(row.localModel) + "\">" + esc(row.localModel) + "</td><td style=\"padding:6px;white-space:nowrap;\">" + scoreLabel(row) + "</td><td style=\"padding:6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ds-text-2);\" title=\"" + esc(row.catalogModel || "") + "\">" + esc(row.catalogModel || "—") + "</td><td style=\"padding:6px;white-space:nowrap;\">" + tierText(row) + "</td><td style=\"padding:6px;white-space:nowrap;\">" + actionLabel(row) + "</td></tr>";
		}).join("") + "</tbody></table></div>" : "<div style=\"padding:14px;text-align:center;color:var(--ds-text-3);font-size:var(--aus-fs-sm);\">" + (onlyChanged ? "没有需要变化的价格（可关闭「仅看变化」查看全部）" : "没有可展示的模型") + "</div>";
		const footer = "<div style=\"display:flex;flex-wrap:wrap;align-items:center;gap:8px;\"><div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);\">已选 " + selected.size + " / 可写入 " + actionable.length + "</div><div style=\"margin-left:auto;display:flex;gap:8px;\"><button data-sync-cancel=\"1\" style=\"padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;\">取消</button><button data-sync-apply=\"1\" style=\"padding:6px 14px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:var(--aus-fs-sm);cursor:pointer;\">应用所选</button></div></div>";
		body.innerHTML = head + table + footer;
		body.querySelectorAll("[data-sync-mode]").forEach((button) => {
			button.onclick = () => {
				mode = button.getAttribute("data-sync-mode");
				plan = buildSyncPlan(catalog, {
					walletIds: walletId ? [walletId] : void 0,
					mode
				});
				selected.clear();
				plan.rows.filter((row) => row.changed && !row.ambiguous).forEach((row) => selected.add(row.key));
				render();
			};
		});
		const search = body.querySelector("[data-sync-search]");
		if (search) search.oninput = () => {
			keyword = search.value;
			const pos = search.selectionStart;
			render();
			const next = body.querySelector("[data-sync-search]");
			if (next) {
				next.focus();
				try {
					next.setSelectionRange(pos ?? 0, pos ?? 0);
				} catch {}
			}
		};
		const onlyChangedEl = body.querySelector("[data-sync-only-changed]");
		if (onlyChangedEl) onlyChangedEl.onchange = () => {
			onlyChanged = onlyChangedEl.checked;
			render();
		};
		body.querySelectorAll("[data-sync-row]").forEach((input) => {
			input.onchange = () => {
				const key = input.getAttribute("data-sync-row");
				if (!key) return;
				if (input.checked) selected.add(key);
				else selected.delete(key);
				render();
			};
		});
		body.querySelector("[data-sync-cancel]")?.addEventListener("click", close);
		body.querySelector("[data-sync-apply]")?.addEventListener("click", async () => {
			if (!selected.size) {
				toast("warning", "没有选中任何条目");
				return;
			}
			const button = body.querySelector("[data-sync-apply]");
			if (button) {
				button.disabled = true;
				button.textContent = "写入中…";
			}
			const result = await applySyncPlan(plan, { selectedKeys: Array.from(selected) });
			close();
			toast(result.applied ? "success" : "warning", result.applied ? "已写入 " + result.applied + " 个模型价格" : "没有价格被写入");
			options.onDone?.();
			try {
				globalThis.ApiUsageStat?.refreshUI?.();
			} catch {}
		});
	};
	render();
}
//#endregion
//#region src/services/plan-quota.ts
var HOUR = 36e5;
var DAY = 24 * HOUR;
/** 窗口起点（滚动窗口回溯，自然月按本地时间月初） */
function planWindowStart(window, now) {
	if (window.resetMode === "calendar") {
		const date = new Date(now);
		date.setDate(1);
		date.setHours(0, 0, 0, 0);
		return date.getTime();
	}
	if (window.id === "5h") return now - 5 * HOUR;
	if (window.id === "7d") return now - 7 * DAY;
	if (window.id === "1m") return now - 30 * DAY;
	return now - (Number.isFinite(window.hours) && window.hours > 0 ? window.hours : 5) * HOUR;
}
/** 窗口周期（毫秒） */
function planWindowSpan(window) {
	if (window.id === "5h") return 5 * HOUR;
	if (window.id === "7d") return 7 * DAY;
	if (window.id === "1m") return 30 * DAY;
	return (Number.isFinite(window.hours) && window.hours > 0 ? window.hours : 5) * HOUR;
}
/** 整体重置时刻：只有自然月窗口才有（滚动窗口随记录滑出逐步恢复） */
function planWindowResetAt(window, now) {
	if (window.resetMode !== "calendar") return null;
	const date = new Date(now);
	date.setMonth(date.getMonth() + 1, 1);
	date.setHours(0, 0, 0, 0);
	return date.getTime();
}
function entryTokens(entry) {
	const value = entry.total_tokens ?? entry.totalTokens;
	return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function entryCost(entry) {
	const value = entry.cost ?? entry.total_cost;
	return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function computePlanWindowUsage(window, entries, walletId, now = Date.now()) {
	const startAt = planWindowStart(window, now);
	const resetAt = planWindowResetAt(window, now);
	let used = 0;
	for (const entry of entries) {
		if (!entry) continue;
		if (entry.walletId !== walletId) continue;
		const ts = Number(entry.timestamp);
		if (!Number.isFinite(ts) || ts < startAt) continue;
		if (window.unit === "token") used += entryTokens(entry);
		else if (window.unit === "cost") used += entryCost(entry);
		else used += 1;
	}
	const limit = Number.isFinite(window.limit) && window.limit > 0 ? window.limit : 0;
	const remaining = limit > 0 ? Math.max(0, limit - used) : 0;
	const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
	return {
		window,
		used,
		limit,
		remaining,
		ratio,
		startAt,
		resetAt,
		unit: window.unit
	};
}
function computeAllPlanUsage(windows, entries, walletId, now = Date.now()) {
	return (windows || []).map((window) => computePlanWindowUsage(window, entries, walletId, now));
}
/** 按近期速率估算耗尽时刻；数据不足返回 null */
function estimateExhaustion(usage, now = Date.now()) {
	if (!usage.limit || usage.remaining <= 0 || usage.used <= 0) return null;
	const elapsed = Math.max(1, now - usage.startAt);
	const rate = usage.used / elapsed;
	if (!Number.isFinite(rate) || rate <= 0) return null;
	const eta = now + usage.remaining / rate;
	if (eta <= now) return null;
	if (usage.resetAt != null && eta > usage.resetAt) return null;
	return eta;
}
function formatPlanUnit(value, unit) {
	if (!Number.isFinite(value)) return "—";
	if (unit === "cost") return value.toFixed(2);
	if (unit === "percent") return Math.round(value) + "%";
	if (value >= 1e4) return (value / 1e4).toFixed(1) + " 万";
	return String(Math.round(value));
}
/**
* 按适配器给出默认窗口：只按该供应商实际存在的额度窗口生成，
* 不再让用户在多个供应商预设里挑。
*/
function planWindowsForAdapter(adapterId) {
	const id = String(adapterId || "").trim();
	if (id === "zhipu") return [{
		id: "5h",
		label: "5 小时额度",
		unit: "token",
		limit: 0,
		resetMode: "rolling"
	}, {
		id: "7d",
		label: "每周额度",
		unit: "token",
		limit: 0,
		resetMode: "rolling"
	}];
	if (id === "minimax") return [{
		id: "5h",
		label: "5 小时额度",
		unit: "request",
		limit: 0,
		resetMode: "rolling"
	}, {
		id: "7d",
		label: "每周额度",
		unit: "request",
		limit: 0,
		resetMode: "rolling"
	}];
	if (id === "new-api") return [{
		id: "1m",
		label: "订阅额度",
		unit: "cost",
		limit: 0,
		resetMode: "calendar"
	}];
	return [];
}
/** 展示用：窗口标题（含周期说明） */
function describePlanWindow(window) {
	if (window.label) return window.label;
	if (window.id === "5h") return "5 小时额度";
	if (window.id === "7d") return "每周额度";
	if (window.id === "1m") return window.resetMode === "calendar" ? "本月额度" : "30 天额度";
	return (Number.isFinite(window.hours) ? window.hours : 5) + " 小时额度";
}
var PLAN_UNIT_LABEL = {
	token: "tokens",
	cost: "金额",
	request: "次请求"
};
//#endregion
//#region src/ui/wallet-plan.ts
/** 该钱包是否具备「可查询套餐额度」能力（无则整块不显示） */
function hasPlanCapability(wallet) {
	return resolveBalanceAdapter(wallet)?.supports.plan === true;
}
function bar(ratio, color) {
	return "<div style=\"height:6px;border-radius:999px;background:var(--ds-border);overflow:hidden;\"><div style=\"height:100%;width:" + Math.max(0, Math.min(100, Math.round(ratio * 100))) + "%;background:" + color + ";\"></div></div>";
}
function ratioColor(ratio) {
	if (ratio >= .85) return "var(--ds-red)";
	if (ratio >= .6) return "var(--ds-orange)";
	return "var(--ds-green)";
}
function relativeTime(timestamp) {
	if (!timestamp) return "—";
	const diff = timestamp - Date.now();
	if (!Number.isFinite(diff)) return "—";
	if (diff <= 0) return "已重置";
	const minutes = Math.round(diff / 6e4);
	if (minutes < 60) return minutes + " 分钟后";
	const hours = Math.round(minutes / 60);
	if (hours < 36) return hours + " 小时后";
	return Math.round(hours / 24) + " 天后";
}
function resetLabel(window, resetAt) {
	if (!resetAt) {
		const hours = Math.round(planWindowSpan(window) / 36e5);
		return "滚动窗口（" + (hours >= 24 ? Math.round(hours / 24) + " 天" : hours + " 小时") + "）";
	}
	return "重置 " + relativeTime(resetAt);
}
/** 远端真值：查到哪个展示哪个 */
function renderRemote(wallet) {
	const remote = wallet.plan?.remote || [];
	if (!remote.length) return "";
	return "<div style=\"background:var(--ds-card-inner);border-radius:8px;padding:8px;display:grid;gap:8px;\">" + remote.map((item) => {
		const ratio = item.used != null && item.limit ? Math.min(1, item.used / item.limit) : 0;
		const percent = Math.round(ratio * 100);
		const left = item.remaining != null ? formatPlanUnit(item.remaining, item.unit === "percent" ? "percent" : item.unit === "count" ? "count" : item.unit) : formatPlanUnit(Math.max(0, 100 - percent), "percent");
		return "<div style=\"display:grid;gap:4px;\"><div style=\"display:flex;justify-content:space-between;gap:8px;font-size:var(--aus-fs-sm);\"><span style=\"color:var(--ds-text-2);\">" + esc(item.label) + "</span><span style=\"color:" + ratioColor(ratio) + ";font-weight:600;\">已用 " + percent + "% · 剩余 " + esc(left) + "</span></div>" + bar(ratio, ratioColor(ratio)) + "<div style=\"font-size:var(--aus-fs-xs,11px);color:var(--ds-text-3);\">厂商返回 · " + esc(resetLabel({
			id: "custom",
			label: item.label,
			unit: "token",
			limit: 0,
			resetMode: item.resetAt ? "calendar" : "rolling"
		}, item.resetAt)) + " · 查询于 " + esc(item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString("zh-CN") : "—") + "</div></div>";
	}).join("") + "</div>";
}
/** 本地估算（可选，仅作补充） */
function renderLocal(wallet, history) {
	const plan = wallet.plan;
	if (!plan || !plan.windows.length) return "";
	return computeAllPlanUsage(plan.windows, history, wallet.id).map((usage, index) => {
		const window = usage.window;
		const eta = estimateExhaustion(usage);
		const hasLimit = usage.limit > 0;
		return "<div style=\"display:grid;gap:4px;\"><div style=\"display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:space-between;\"><span style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-2);\">" + esc(describePlanWindow(window)) + "</span><span style=\"display:flex;align-items:center;gap:4px;font-size:var(--aus-fs-sm);\"><input type=\"number\" min=\"0\" step=\"1000\" data-plan-limit=\"" + index + "\" value=\"" + (window.limit || "") + "\" placeholder=\"额度\" style=\"width:96px;padding:3px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);\" /><span style=\"color:var(--ds-text-3);\">" + esc(PLAN_UNIT_LABEL[window.unit]) + "</span><button data-plan-reset=\"" + index + "\" title=\"切换重置方式：滚动窗口 / 自然月\" style=\"padding:2px 7px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;\">" + (window.resetMode === "calendar" ? "自然月" : "滚动") + "</button><button data-plan-remove=\"" + index + "\" title=\"移除该窗口\" style=\"padding:2px 6px;border:1px solid var(--ds-red-border);border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;\">" + icon("close", 12) + "</button></span></div>" + (hasLimit ? bar(usage.ratio, ratioColor(usage.ratio)) : "<div style=\"height:6px;border-radius:999px;background:var(--ds-border);\"></div>") + "<div style=\"font-size:var(--aus-fs-xs,11px);color:var(--ds-text-3);\">本地估算 · 已用 " + esc(formatPlanUnit(usage.used, window.unit)) + (hasLimit ? " / " + esc(formatPlanUnit(usage.limit, window.unit)) + "（" + Math.round(usage.ratio * 100) + "%）· 剩余 " + esc(formatPlanUnit(usage.remaining, window.unit)) : "（填额度后显示比例）") + " · " + resetLabel(window, usage.resetAt) + (eta ? " · 预计 " + esc(relativeTime(eta)) + "耗尽" : "") + "</div></div>";
	}).join("");
}
function renderPlanBlock(wallet, history) {
	const adapter = resolveBalanceAdapter(wallet);
	if (!adapter?.supports.plan) return "";
	const plan = wallet.plan;
	plan?.remote;
	const localEnabled = plan?.enabled === true && (plan?.windows || []).length > 0;
	const hasKey = !!getWalletApiKey(wallet.id);
	const header = "<div style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;\"><div><div style=\"font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-text);\">套餐额度</div><div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);\">" + esc(adapter.label) + " · 仅供展示参考，不参与计费与导出</div></div><div style=\"display:flex;gap:6px;flex-wrap:wrap;\"><button data-plan-query=\"1\" style=\"padding:6px 11px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:var(--aus-fs-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;\">" + icon("refresh", 13) + " 查询额度</button>" + (localEnabled ? "<button data-plan-disable=\"1\" style=\"padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;\">关闭本地估算</button>" : "<button data-plan-enable=\"1\" style=\"padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;\">启用本地估算</button>") + "</div></div>";
	const error = plan?.remoteError ? "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-red);\">查询失败：" + esc(plan.remoteError) + "</div>" : "";
	const remoteHtml = renderRemote(wallet);
	const localHtml = localEnabled ? renderLocal(wallet, history) : "";
	const empty = !remoteHtml && !localHtml ? "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);\">" + (hasKey ? "点击「查询额度」获取厂商返回的额度与剩余。" : "先在下方填写查询密钥，再点「查询额度」。") + "</div>" : "";
	const localTools = localEnabled && !remoteHtml ? "<div style=\"display:flex;gap:6px;\"><button data-plan-add=\"1\" style=\"padding:5px 9px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;\">+ 添加本地窗口</button></div>" : "";
	return "<div style=\"background:var(--ds-card-inner);border-radius:10px;padding:10px;display:grid;gap:8px;\">" + header + error + empty + (remoteHtml ? "<div style=\"display:grid;gap:8px;\">" + remoteHtml + "</div>" : "") + (localHtml ? "<div style=\"display:grid;gap:8px;\">" + localHtml + "</div>" : "") + localTools + "</div>";
}
function bindPlanBlock(doc, walletId, onChange) {
	const host = doc.querySelector("[data-wallet-card=\"" + walletId + "\"]");
	if (!host) return;
	const updatePlan = (mutate) => {
		repository.updateWallet(walletId, (wallet) => {
			const plan = wallet.plan || {
				enabled: false,
				windows: []
			};
			mutate(plan);
			wallet.plan = plan;
		});
		onChange();
	};
	host.querySelectorAll("[data-plan-query]").forEach((button) => {
		button.onclick = async (event) => {
			event.stopPropagation();
			const wallet = repository.getWallet(walletId);
			if (!resolveBalanceAdapter(wallet)?.supports.plan) return;
			if (!getWalletApiKey(walletId)) {
				toast("warning", "请先在该钱包填写查询密钥");
				return;
			}
			button.textContent = "查询中…";
			await queryWalletBalance(walletId, false);
			onChange();
		};
	});
	host.querySelectorAll("[data-plan-enable]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			const adapter = resolveBalanceAdapter(repository.getWallet(walletId));
			updatePlan((plan) => {
				plan.enabled = true;
				if (!plan.windows.length) plan.windows = planWindowsForAdapter(adapter?.id);
			});
		};
	});
	host.querySelectorAll("[data-plan-disable]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			updatePlan((plan) => {
				plan.enabled = false;
			});
		};
	});
	host.querySelectorAll("[data-plan-limit]").forEach((input) => {
		input.onchange = () => {
			const index = parseInt(input.getAttribute("data-plan-limit") || "-1", 10);
			const value = parseFloat(String(input.value || ""));
			updatePlan((plan) => {
				const window = plan.windows[index];
				if (!window) return;
				window.limit = Number.isFinite(value) && value > 0 ? value : 0;
			});
		};
	});
	host.querySelectorAll("[data-plan-reset]").forEach((button) => {
		button.onclick = () => {
			const index = parseInt(button.getAttribute("data-plan-reset") || "-1", 10);
			updatePlan((plan) => {
				const window = plan.windows[index];
				if (!window) return;
				window.resetMode = window.resetMode === "calendar" ? "rolling" : "calendar";
			});
		};
	});
	host.querySelectorAll("[data-plan-remove]").forEach((button) => {
		button.onclick = () => {
			const index = parseInt(button.getAttribute("data-plan-remove") || "-1", 10);
			updatePlan((plan) => {
				plan.windows.splice(index, 1);
			});
		};
	});
	host.querySelectorAll("[data-plan-add]").forEach((button) => {
		button.onclick = () => {
			const adapter = resolveBalanceAdapter(repository.getWallet(walletId));
			updatePlan((plan) => {
				plan.windows.push({
					id: "custom",
					label: "",
					unit: plan.windows[0]?.unit || "token",
					limit: 0,
					resetMode: "rolling",
					hours: 5
				});
				if (adapter) plan.label = adapter.label;
			});
		};
	});
}
//#endregion
//#region src/ui/wallet-view.ts
function getDoc$3() {
	return window.parent?.document ?? document;
}
function money(cny, digits = 4) {
	try {
		return formatMoney(cny, digits);
	} catch {
		return `¥${cny.toFixed(digits)} CNY`;
	}
}
function walletBalanceText(wallet) {
	const amount = wallet.balance.amount == null || wallet.balance.amount === "" ? NaN : parseFloat(String(wallet.balance.amount));
	if (!Number.isFinite(amount)) return "未设置";
	return `${wallet.balance.currency === "USD" ? "$" : "¥"}${amount.toFixed(2)} ${wallet.balance.currency}`;
}
function displayToCny(value) {
	const number = typeof value === "number" ? value : parseFloat(String(value));
	if (!Number.isFinite(number)) return 0;
	const currency = getDisplayCurrency();
	return currency.code === "USD" ? number * currency.rate : number;
}
function cnyToDisplay(value) {
	const number = typeof value === "number" ? value : parseFloat(String(value));
	if (!Number.isFinite(number)) return "0";
	const currency = getDisplayCurrency();
	const result = currency.code === "USD" ? number / currency.rate : number;
	return String(Math.round(result * 1e6) / 1e6);
}
function closeDropdowns() {
	getDoc$3().querySelectorAll("[data-wallet-dropdown]").forEach((el) => {
		el.style.display = "none";
	});
}
/** 选中某一项后要重建钱包页时用：先瞬时收掉全部浮层，重绘留到下一帧。 */
function closeDropdownsInstant() {
	getDoc$3().querySelectorAll("[data-wallet-dropdown]").forEach((el) => {
		closeDropdownInstant(el);
	});
}
function closeOtherDropdowns(id) {
	getDoc$3().querySelectorAll("[data-wallet-dropdown]").forEach((el) => {
		if (el.id !== id) el.style.display = "none";
	});
}
function dropdownHtml(walletId, kind, options) {
	return options.map((option) => `
    <div data-wallet-select="${esc(kind)}" data-wallet-id="${esc(walletId)}" data-value="${esc(option.id)}"
      style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-sm);${option.active ? "background:var(--ds-card);font-weight:600;" : ""}">
      ${esc(option.label)}
    </div>
  `).join("");
}
function sourceLabel(model) {
	if (model.source === "builtin") return "内置";
	if (model.source === "sync") return "同步";
	if (model.source === "manual") return "自定义";
	return "待定价";
}
function priceField(walletId, modelId, tier, key, value) {
	return `<input type="number" step="0.000001" min="0" data-wallet-price="1" data-wallet-id="${esc(walletId)}"
    data-model-id="${esc(modelId)}" data-tier="${tier}" data-key="${key}" value="${esc(cnyToDisplay(value))}"
    style="width:100%;min-width:72px;padding:5px 6px;border:1px solid var(--ds-border);border-radius:7px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />`;
}
function renderModelRows(wallet, showHidden = false) {
	const models = wallet.models.filter((model) => showHidden || model.hidden !== true).sort((a, b) => {
		return Number(!a.price.priceConfigured) - Number(!b.price.priceConfigured) || a.model.localeCompare(b.model, "zh-CN");
	});
	if (!models.length) return "<tr><td colspan=\"7\" style=\"padding:14px;text-align:center;color:var(--ds-text-3);\">尚未识别到模型，可手动添加或等待请求接入</td></tr>";
	return models.map((model) => {
		const pending = !model.price.priceConfigured;
		const canDelete = model.source !== "builtin";
		const matchLine = model.priceMatch ? "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:3px;\" title=\"来源：" + esc(model.priceMatch.provider + " / " + model.priceMatch.catalogModel) + "\">↳ " + esc(model.priceMatch.catalogModel) + " · " + Math.round(model.priceMatch.score * 100) + "%</div>" : "";
		const rowStyle = "border-top:1px solid var(--ds-border);" + (model.hidden === true ? "opacity:0.55;" : "");
		return `
      <tr data-wallet-model-row="${esc(model.id)}" style="${rowStyle}">
        <td style="padding:8px 6px;min-width:180px;">
          <input data-wallet-model-name="1" data-wallet-id="${esc(wallet.id)}" data-model-id="${esc(model.id)}"
            value="${esc(model.model)}"
            style="width:100%;padding:6px 7px;border:1px solid var(--ds-border);border-radius:7px;background:${model.source === "builtin" ? "var(--ds-sidebar-bg)" : "var(--ds-card-inner)"};color:var(--ds-text);font-size:var(--aus-fs-sm);" />
          <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:3px;">${esc(model.sourceModel)}${model.aliases.length ? ` · 别名 ${esc(model.aliases.join("、"))}` : ""}${model.hidden === true ? " · 已隐藏" : ""}</div>
          <label style="display:flex;align-items:center;gap:5px;margin-top:5px;font-size:var(--aus-fs-sm);color:var(--ds-text-3);">
            上下文上限
            <input type="number" min="1" step="1000" data-wallet-context-limit="1" data-wallet-id="${esc(wallet.id)}" data-model-id="${esc(model.id)}"
              value="${model.contextLimit ?? ""}" placeholder="未知"
              style="width:80px;padding:3px 5px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />
          </label>
        </td>
        <td style="padding:8px 6px;white-space:nowrap;">
          <span style="padding:2px 7px;border-radius:999px;background:${pending ? "var(--ds-red-bg)" : model.source === "sync" ? "var(--ds-green-bg)" : "var(--ds-card)"};color:${pending ? "var(--ds-red)" : model.source === "sync" ? "var(--ds-green)" : "var(--ds-text-2)"};font-size:var(--aus-fs-sm);">${sourceLabel(model)}</span>
          ${matchLine}
        </td>
        <td style="padding:8px 6px;min-width:224px;">
          <div style="display:grid;grid-template-columns:repeat(3,minmax(68px,1fr));gap:4px;">${priceField(wallet.id, model.id, "offpeak", "hit", model.price.offpeak.hit)}${priceField(wallet.id, model.id, "offpeak", "miss", model.price.offpeak.miss)}${priceField(wallet.id, model.id, "offpeak", "output", model.price.offpeak.output)}</div>
        </td>
        <td style="padding:8px 6px;min-width:224px;opacity:${model.price.usePeakPricing ? "1" : "0.45"};">
          <div style="display:grid;grid-template-columns:repeat(3,minmax(68px,1fr));gap:4px;">${priceField(wallet.id, model.id, "peak", "hit", model.price.peak.hit)}${priceField(wallet.id, model.id, "peak", "miss", model.price.peak.miss)}${priceField(wallet.id, model.id, "peak", "output", model.price.peak.output)}</div>
        </td>
        <td style="padding:8px 6px;text-align:center;"><input type="checkbox" class="aus-checkbox" data-wallet-model-peak="1" data-wallet-id="${esc(wallet.id)}" data-model-id="${esc(model.id)}" ${model.price.usePeakPricing ? "checked" : ""} /></td>
        <td style="padding:8px 6px;text-align:center;"><input type="checkbox" class="aus-checkbox" data-wallet-model-lock="1" data-wallet-id="${esc(wallet.id)}" data-model-id="${esc(model.id)}" ${model.locked ? "checked" : ""} /></td>
        <td style="padding:8px 6px;text-align:center;">${canDelete ? `<button data-wallet-model-delete="1" data-wallet-id="${esc(wallet.id)}" data-model-id="${esc(model.id)}" style="padding:4px 8px;border:1px solid var(--ds-red-border);border-radius:7px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">删除</button>` : "—"}</td>
      </tr>`;
	}).join("");
}
function renderPeakRows(wallet) {
	if (!wallet.peakHours.length) return "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);\">暂无高峰时段</div>";
	return wallet.peakHours.map((item, index) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="time" data-wallet-peak="1" data-wallet-id="${esc(wallet.id)}" data-peak-index="${index}" data-peak-field="start" value="${esc(item.start)}" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:7px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />
      <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">至</span>
      <input type="time" data-wallet-peak="1" data-wallet-id="${esc(wallet.id)}" data-peak-index="${index}" data-peak-field="end" value="${esc(item.end)}" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:7px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />
      <button data-wallet-peak-delete="1" data-wallet-id="${esc(wallet.id)}" data-peak-index="${index}" style="padding:5px 8px;border:1px solid var(--ds-red-border);border-radius:7px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">删除</button>
    </div>
  `).join("");
}
function renderCredentialPicker(wallet) {
	const current = wallet.credentials.find((item) => item.id === wallet.balance.primaryCredentialId);
	return `
    <button data-wallet-credential-btn="1" data-wallet-id="${esc(wallet.id)}" style="display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;max-width:100%;">
      <span style="color:var(--ds-text-2);">主密钥</span>
      <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;">${esc(current?.label || "未指定")}</span>
      ${icon("chevron-down", 14)}
    </button>
    <div id="aus-wallet-credential-drop-${esc(wallet.id)}" data-wallet-dropdown="1" style="display:none;position:absolute;top:38px;left:0;z-index:30;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:220px;max-width:320px;">
      ${dropdownHtml(wallet.id, "credential", [{
		id: "",
		label: "无（使用钱包内校准密钥）",
		active: !wallet.balance.primaryCredentialId
	}, ...wallet.credentials.map((item) => ({
		id: item.id,
		label: item.label,
		active: item.id === wallet.balance.primaryCredentialId
	}))])}
    </div>`;
}
function renderCatalogPicker(wallet) {
	const current = WALLET_CATALOG_PROVIDERS.find((item) => item.id === wallet.catalogProvider);
	const providerVendor = vendorById(wallet.catalogProvider);
	const providerIcon = providerVendor ? vendorIconSvg(providerVendor.id, 14) : null;
	const status = walletSyncStatus(wallet);
	return `
    <div class="aus-wallet-catalog-picker" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:0 0 auto;min-width:0;max-width:100%;">
    <button type="button" class="aus-wallet-catalog-btn" data-wallet-catalog-btn="1" data-wallet-id="${esc(wallet.id)}" title="选择价格来源" style="display:flex;align-items:center;gap:7px;flex:0 0 auto;max-width:100%;box-sizing:border-box;min-height:30px;padding:7px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">
      <span style="color:var(--ds-text-2);flex:0 0 auto;">价格来源</span>
      ${providerIcon ? "<span style=\"display:inline-flex;flex:0 0 auto;color:var(--ds-text-2);\">" + providerIcon + "</span>" : ""}
      <span style="font-weight:600;min-width:0;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(current?.label || "不自动同步")}</span>
      <span style="display:inline-flex;flex:0 0 auto;">${icon("chevron-down", 14)}</span>
    </button>
    <div style="font-size:var(--aus-fs-sm);color:${status.pending ? "var(--ds-red)" : "var(--ds-text-3)"};max-width:190px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(status.label)}">${esc(status.label)}${status.pending ? ` · ${status.pending} 个待匹配` : ""}</div>
    <div id="aus-wallet-catalog-drop-${esc(wallet.id)}" data-wallet-dropdown="1" style="display:none;position:absolute;top:38px;right:0;z-index:30;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:180px;max-height:260px;overflow:auto;">
      ${dropdownHtml(wallet.id, "catalog", [{
		id: "",
		label: "不自动同步",
		active: !wallet.catalogProvider
	}, ...WALLET_CATALOG_PROVIDERS.map((item) => ({
		id: item.id,
		label: item.label,
		active: item.id === wallet.catalogProvider
	}))])}
    </div>
    </div>`;
}
function renderAdapterPicker(wallet) {
	const current = BALANCE_ADAPTERS.find((item) => item.id === wallet.balance.adapter);
	return `
    <div style="position:relative;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <button data-wallet-adapter-btn="1" data-wallet-id="${esc(wallet.id)}" style="display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">
        <span style="color:var(--ds-text-2);">查询适配器</span>
        <span style="font-weight:600;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(current?.label || "自动识别")}</span>
        ${icon("chevron-down", 14)}
      </button>
      <input data-wallet-adapter-user-id="1" data-wallet-id="${esc(wallet.id)}" value="${esc(wallet.balance.userId || "")}" placeholder="用户 ID（new-api 需要）"
        style="width:150px;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />
      <div id="aus-wallet-adapter-drop-${esc(wallet.id)}" data-wallet-dropdown="1" style="display:none;position:absolute;top:36px;left:0;z-index:30;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:220px;max-height:280px;overflow:auto;">
        ${dropdownHtml(wallet.id, "adapter", [{
		id: "",
		label: "自动识别",
		active: !wallet.balance.adapter
	}, ...BALANCE_ADAPTERS.map((item) => ({
		id: item.id,
		label: item.label + (item.experimental ? "（实验）" : ""),
		active: item.id === wallet.balance.adapter
	}))])}
      </div>
    </div>`;
}
function renderWalletCard(wallet, history) {
	const balanceAdapter = resolveBalanceAdapter(wallet);
	const supportsAuto = !!balanceAdapter && (balanceAdapter.supports.balance || balanceAdapter.supports.plan);
	const visibleModels = wallet.models.filter((model) => model.hidden !== true);
	const hiddenCount = wallet.models.length - visibleModels.length;
	const vendor = resolveVendor({
		sourceType: wallet.sourceType,
		endpointDisplay: wallet.endpointDisplay,
		endpointLabel: wallet.endpointLabel,
		endpointId: wallet.endpointId,
		models: visibleModels.map((model) => model.model)
	});
	const avatarLetter = vendorInitialFallback(wallet.name || wallet.endpointDisplay || wallet.endpointLabel || "");
	let showHidden = false;
	try {
		showHidden = window.parent?.localStorage?.getItem("aus_wallet_show_hidden_v1") === "1";
	} catch {}
	const pending = walletPendingModelCount(wallet);
	const isOfficial = wallet.id === DEEPSEEK_WALLET_ID;
	const selectedCredential = wallet.credentials.find((item) => item.id === wallet.balance.primaryCredentialId);
	const collapsed = wallet.collapsed !== false;
	const metrics = [{
		label: "余额",
		value: walletBalanceText(wallet),
		title: walletBalanceText(wallet)
	}];
	return `
    <section class="ds-card" data-wallet-card="${esc(wallet.id)}" style="display:grid;gap:12px;">
      <div class="aus-wallet-header">
        ${vendor ? `<div class="aus-wallet-avatar" title="${esc(vendor.label)}" style="background:${vendor.color};color:#FFFFFF;${vendorIconSvg(vendor.id, 22) ? "padding:0;" : vendor.mark.length > 1 ? "font-size:12px;" : ""}">${vendorIconSvg(vendor.id, 22) || esc(vendor.mark)}</div>` : `<div class="aus-wallet-avatar" title="${esc(wallet.name)}">${esc(avatarLetter)}</div>`}
        <div class="aus-wallet-identity">
          <div class="aus-wallet-name-row">
            <input data-wallet-name="1" data-wallet-id="${esc(wallet.id)}" value="${esc(wallet.name)}" />
            <span class="${isOfficial ? "aus-wallet-badge-official" : "aus-wallet-badge-relay"}" style="padding:3px 8px;border-radius:999px;background:${isOfficial ? "var(--ds-green-bg)" : "var(--ds-card-inner)"};color:${isOfficial ? "var(--ds-green)" : "var(--ds-text-2)"};font-size:var(--aus-fs-sm);white-space:nowrap;">${isOfficial ? "DeepSeek 官方" : esc(vendor?.label || "中转/自定义")}</span>
            ${pending ? `<span style="padding:3px 8px;border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);white-space:nowrap;">${pending} 个待定价</span>` : ""}
          </div>
          <div class="aus-wallet-sub">${esc(wallet.endpointDisplay || wallet.endpointLabel || "本机官方接口")} · ${esc(wallet.sourceType || "未识别")}</div>
        </div>
        <div class="aus-wallet-metrics">
          ${metrics.map((item) => `<div class="aus-wallet-metric" title="${esc(item.title)}"><div class="aus-wallet-metric-label">${esc(item.label)}</div><div class="aus-wallet-metric-value">${esc(item.value)}</div></div>`).join("")}
        </div>
        <div class="aus-wallet-actions">
          <button class="aus-wallet-icon-btn" data-wallet-toggle="1" data-wallet-id="${esc(wallet.id)}" title="${collapsed ? "展开钱包详情" : "收起钱包详情"}" aria-label="${collapsed ? "展开钱包详情" : "收起钱包详情"}">${collapsed ? icon("chevron-down", 16) : icon("chevron-up", 16)}</button>
          <button class="aus-wallet-icon-btn" data-wallet-sync="1" data-wallet-id="${esc(wallet.id)}" title="${wallet.catalogProvider ? "预览并应用价格同步（按已识别模型模糊匹配）" : "先选择价格来源，再同步价格"}" aria-label="预览价格同步">${icon("refresh", 16)}</button>
          ${isOfficial ? "" : `<button class="aus-wallet-icon-btn is-danger" data-wallet-ignore="1" data-wallet-id="${esc(wallet.id)}" title="忽略该钱包（历史与统计保留）" aria-label="忽略钱包">${icon("close", 16)}</button>`}
        </div>
      </div>

      <div data-wallet-body="1" style="display:${collapsed ? "none" : "grid"};gap:12px;">
      <div class="aus-wallet-two-col" style="display:grid;grid-template-columns:minmax(250px,1fr) minmax(260px,1fr);gap:10px;">
        <div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;display:grid;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">钱包余额</div><div style="font-size:17px;font-weight:700;color:var(--ds-text);">${esc(walletBalanceText(wallet))}</div></div>
            <label style="display:flex;align-items:center;gap:6px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);cursor:${supportsAuto ? "pointer" : "not-allowed"};">
              <input type="checkbox" class="aus-checkbox" data-wallet-auto-balance="1" data-wallet-id="${esc(wallet.id)}" ${wallet.balance.mode === "auto" ? "checked" : ""} ${supportsAuto ? "" : "disabled"} /> 自动校准
            </label>
          </div>
          <div style="display:flex;gap:6px;align-items:center;position:relative;">
            <input data-wallet-balance-amount="1" data-wallet-id="${esc(wallet.id)}" value="${esc(wallet.balance.amount ?? "")}" placeholder="手工余额" style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />
            <button data-wallet-currency-btn="1" data-wallet-id="${esc(wallet.id)}" style="padding:7px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">${wallet.balance.currency}${icon("chevron-down", 14)}</button>
            <div id="aus-wallet-currency-drop-${esc(wallet.id)}" data-wallet-dropdown="1" style="display:none;position:absolute;top:38px;right:0;z-index:30;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:6px;min-width:110px;">
              ${dropdownHtml(wallet.id, "currency", [{
		id: "CNY",
		label: "CNY",
		active: wallet.balance.currency === "CNY"
	}, {
		id: "USD",
		label: "USD",
		active: wallet.balance.currency === "USD"
	}])}
            </div>
          </div>
          ${supportsAuto ? `
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;position:relative;">
              ${renderCredentialPicker(wallet)}
              <button data-wallet-calibrate="1" data-wallet-id="${esc(wallet.id)}" style="padding:7px 11px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:var(--aus-fs-sm);cursor:pointer;">立即校准</button>
            </div>
            <div style="display:flex;gap:6px;">
              <input type="password" data-wallet-api-key="1" data-wallet-id="${esc(wallet.id)}" value="" placeholder="${getWalletApiKey(wallet.id) ? "已保存钱包校准密钥（留空不修改）" : "填写钱包校准密钥"}" style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />
              <button data-wallet-save-key="1" data-wallet-id="${esc(wallet.id)}" style="padding:7px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">保存密钥</button>
            </div>
            <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">查询方式：${esc(balanceAdapter?.label || "无")}${balanceAdapter?.note ? "（" + esc(balanceAdapter.note) + "）" : ""}；勾选「自动校准」后按设置页校准间隔轮询；主密钥：${esc(selectedCredential?.label || "未指定")}</div>
            <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);word-break:break-all;">已识别密钥：${wallet.credentials.length ? wallet.credentials.map((item) => esc(item.label)).join("、") : "未识别"}</div>
          ` : `<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">该接入暂无可用查询适配器，可直接手工维护余额；中转站可在下方「查询适配器」中选择 new-api 并填写系统访问令牌与用户 ID。</div>`}
          ${renderAdapterPicker(wallet)}
          <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);word-break:break-all;">已识别密钥：${wallet.credentials.length ? wallet.credentials.map((item) => esc(item.label)).join("、") : "未识别"}</div>
        </div>

        <div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;display:grid;gap:8px;position:relative;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div style="font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-text);">峰谷规则</div>
            ${renderCatalogPicker(wallet)}
          </div>
          <div style="display:grid;gap:6px;">${renderPeakRows(wallet)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);cursor:pointer;"><input type="checkbox" class="aus-checkbox" data-wallet-weekend="1" data-wallet-id="${esc(wallet.id)}" ${wallet.weekendOffpeak ? "checked" : ""} /> 周末全天按低谷</label>
            <button data-wallet-add-peak="1" data-wallet-id="${esc(wallet.id)}" style="padding:6px 9px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">+ 添加时段</button>
          </div>
          ${isOfficial ? `<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);line-height:1.6;">官方接口按 DeepSeek 规则计费：中国法定节假日全天空闲（内置数据覆盖 ${CN_HOLIDAY_COVERAGE_LABEL}），调休上班的周末同样按空闲计价，可在设置中补充额外空闲日期。</div>` : ""}
        </div>
      </div>

      <div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <div><div style="font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-text);">模型与价格</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">单位 ${getDisplayCurrency().code}/百万 tokens；模型改名会保留旧名别名</div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;"><button data-wallet-toggle-hidden="1" data-wallet-id="${esc(wallet.id)}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;display:${hiddenCount ? "inline-flex" : "none"};align-items:center;gap:4px;">${showHidden ? "隐藏" : "显示"} ${hiddenCount} 个隐藏条目</button><button data-wallet-add-model="1" data-wallet-id="${esc(wallet.id)}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">+ 添加模型</button></div>
        </div>
        <div style="width:100%;overflow-x:auto;">
          <table style="width:100%;min-width:900px;border-collapse:collapse;font-size:var(--aus-fs-sm);">
            <thead><tr style="text-align:center;color:var(--ds-text-2);"><th style="text-align:left;padding:5px 6px;">模型</th><th style="padding:5px 6px;">来源</th><th style="padding:5px 6px;">非峰（命中/未命中/输出）</th><th style="padding:5px 6px;">高峰（命中/未命中/输出）</th><th style="padding:5px 6px;">峰谷</th><th style="padding:5px 6px;">锁定</th><th style="padding:5px 6px;">操作</th></tr></thead>
            <tbody>${renderModelRows(wallet, showHidden)}</tbody>
          </table>
        </div>
      </div>

      ${hasPlanCapability(wallet) ? renderPlanBlock(wallet, history) : ""}
      </div>
    </section>`;
}
function renderIgnoredWallets(ignored, wallets) {
	return ignored.map((id) => {
		const wallet = wallets.find((item) => item.id === id);
		if (!wallet) return "";
		return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid var(--ds-border);">
      <div><div style="font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-text);">${esc(wallet.name)}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">${esc(wallet.endpointDisplay || wallet.endpointLabel || "")}</div></div>
      <button data-wallet-restore="1" data-wallet-id="${esc(wallet.id)}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">恢复显示</button>
    </div>`;
	}).filter(Boolean).join("") || "<div style=\"font-size:var(--aus-fs-sm);color:var(--ds-text-3);\">暂无已忽略接入</div>";
}
var walletRenderToken = 0;
async function renderWalletView() {
	const doc = getDoc$3();
	const host = doc.getElementById("aus-wallet");
	if (!host) return;
	const token = ++walletRenderToken;
	const history = await repository.getAllHistory();
	if (token !== walletRenderToken || !host.isConnected) return;
	const wallets = repository.getWallets();
	const ignored = repository.getIgnoredWalletIds();
	const ignoredSet = new Set(ignored);
	const active = wallets.filter((wallet) => !ignoredSet.has(wallet.id));
	const planCapable = active.filter((wallet) => resolveBalanceAdapter(wallet)?.supports.plan === true);
	const planRemoteCount = planCapable.filter((wallet) => (wallet.plan?.remote || []).length > 0).length;
	let walletFilter = "all";
	let walletQuery = "";
	try {
		walletFilter = window.parent?.localStorage?.getItem("aus_wallet_filter_v1") || "all";
		walletQuery = window.parent?.localStorage?.getItem("aus_wallet_query_v1") || "";
	} catch {}
	const filters = [
		{
			id: "all",
			label: "全部",
			count: active.length
		},
		{
			id: "pending",
			label: "有待定价",
			count: active.filter((wallet) => walletPendingModelCount(wallet) > 0).length
		},
		{
			id: "plan",
			label: "可查套餐",
			count: planCapable.length
		},
		{
			id: "official",
			label: "官方",
			count: active.filter((wallet) => wallet.id === DEEPSEEK_WALLET_ID).length
		}
	];
	const matchesFilter = (wallet) => {
		if (walletFilter === "pending") return walletPendingModelCount(wallet) > 0;
		if (walletFilter === "plan") return resolveBalanceAdapter(wallet)?.supports.plan === true;
		if (walletFilter === "official") return wallet.id === DEEPSEEK_WALLET_ID;
		return true;
	};
	const anyCollapsed = active.some((wallet) => wallet.collapsed);
	const toolbar = `
      <div class="ds-card" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
        <input data-wallet-search="1" value="${esc(walletQuery)}" placeholder="搜索钱包 / 地址 / 模型" style="flex:1;min-width:180px;padding:7px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />
        ${filters.map((item) => "<button data-wallet-filter=\"" + item.id + "\" style=\"padding:6px 11px;border:1px solid " + (walletFilter === item.id ? "var(--ds-black)" : "var(--ds-border)") + ";border-radius:999px;background:" + (walletFilter === item.id ? "var(--ds-black)" : "var(--ds-card-inner)") + ";color:" + (walletFilter === item.id ? "var(--ds-black-text)" : "var(--ds-text)") + ";font-size:var(--aus-fs-sm);cursor:pointer;\">" + esc(item.label) + (item.count != null ? " " + item.count : "") + "</button>").join("")}
        <button data-wallet-toggle-all="${anyCollapsed ? "expand" : "collapse"}" style="padding:6px 11px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">${anyCollapsed ? "展开全部" : "收起全部"}</button>
      </div>`;
	const visibleWallets = active.filter(matchesFilter);
	let balanceCny = 0;
	let balanceCount = 0;
	let pending = 0;
	for (const wallet of active) {
		const value = walletBalanceToCny(wallet, getWalletExchangeRate());
		if (value != null) {
			balanceCny += value;
			balanceCount++;
		}
		pending += walletPendingModelCount(wallet);
	}
	host.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div class="ds-card aus-wallet-summary" id="aus-wallet-summary" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">钱包余额合计</div><div style="font-size:20px;font-weight:700;color:var(--ds-text);margin-top:4px;">${money(balanceCny, 2)}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:2px;">${balanceCount} 个钱包已设置余额</div></div>
        <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">钱包数量</div><div style="font-size:20px;font-weight:700;color:var(--ds-text);margin-top:4px;">${active.length}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:2px;">已忽略 ${ignored.length} 个</div></div>
        <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">待定价模型</div><div style="font-size:20px;font-weight:700;color:${pending ? "var(--ds-red)" : "var(--ds-green)"};margin-top:4px;">${pending}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:2px;">保存价格后自动重算</div></div>
        <div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">可查套餐</div><div style="font-size:20px;font-weight:700;color:var(--ds-text);margin-top:4px;">${planCapable.length}</div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:2px;">${planRemoteCount ? `已查到 ${planRemoteCount} 个` : "仅展示可查询的厂商"}</div></div>
      </div>
      ${toolbar}
      ${visibleWallets.length ? visibleWallets.map((wallet) => renderWalletCard(wallet, history)).join("") : "<div class=\"ds-card\" style=\"text-align:center;color:var(--ds-text-3);font-size:var(--aus-fs-sm);padding:18px;\">没有符合筛选条件的钱包</div>"}
      <div class="ds-card">
        <div style="font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-text);margin-bottom:2px;">已忽略接入</div>
        ${renderIgnoredWallets(ignored, wallets)}
      </div>
    </div>`;
	bindWalletView(doc);
}
function readModelPrices(row) {
	const result = {
		offpeak: {
			hit: 0,
			miss: 0,
			output: 0
		},
		peak: {
			hit: 0,
			miss: 0,
			output: 0
		}
	};
	row.querySelectorAll("input[data-wallet-price]").forEach((input) => {
		const tier = input.getAttribute("data-tier");
		const key = input.getAttribute("data-key");
		if ((tier === "offpeak" || tier === "peak") && (key === "hit" || key === "miss" || key === "output")) result[tier][key] = displayToCny(input.value);
	});
	return result;
}
function bindWalletView(doc) {
	doc.querySelectorAll("[data-wallet-toggle]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			if (!walletId) return;
			repository.updateWallet(walletId, (wallet) => {
				wallet.collapsed = wallet.collapsed === false;
			});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-name]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			const name = String(input.value || "").trim();
			if (!walletId || !name) return renderWalletView();
			repository.updateWallet(walletId, (wallet) => {
				wallet.name = name;
			});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-balance-amount]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			if (!walletId) return;
			repository.updateWallet(walletId, (wallet) => {
				wallet.balance.amount = String(input.value || "").trim() || null;
				wallet.balance.mode = wallet.balance.mode === "auto" ? "auto" : "manual";
			});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-auto-balance]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			if (!walletId) return;
			repository.updateWallet(walletId, (wallet) => {
				wallet.balance.mode = input.checked ? "auto" : "manual";
			});
			try {
				import("./balance-DwuYkZLE.js").then((n) => n.t).then((mod) => mod.restartBalanceTimer?.());
			} catch {}
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-weekend]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			if (!walletId) return;
			repository.updateWallet(walletId, (wallet) => {
				wallet.weekendOffpeak = !!input.checked;
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-save-key]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			const input = doc.querySelector(`[data-wallet-api-key][data-wallet-id="${walletId}"]`);
			if (!walletId || !input) return;
			saveWalletApiKey(walletId, input.value.trim());
			toast("success", input.value.trim() ? "钱包校准密钥已保存" : "钱包校准密钥已清除");
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-calibrate]").forEach((button) => {
		button.onclick = async () => {
			const walletId = button.getAttribute("data-wallet-id");
			if (!walletId) return;
			button.textContent = "校准中…";
			await queryWalletBalance(walletId, false);
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-sync]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			openWalletSyncPreview({
				walletId: button.getAttribute("data-wallet-id") || void 0,
				onDone: () => {
					renderWalletView();
				}
			}).catch(() => {});
		};
	});
	doc.querySelectorAll("[data-wallet-toggle-hidden]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			try {
				const storage = window.parent?.localStorage ?? null;
				const current = storage?.getItem("aus_wallet_show_hidden_v1") === "1";
				storage?.setItem("aus_wallet_show_hidden_v1", current ? "0" : "1");
			} catch {}
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-ignore]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			if (!walletId) return;
			repository.setWalletIgnored(walletId, true);
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-restore]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			if (!walletId) return;
			repository.setWalletIgnored(walletId, false);
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-add-peak]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			if (!walletId) return;
			repository.updateWallet(walletId, (wallet) => {
				wallet.peakHours.push({
					start: "09:00",
					end: "12:00"
				});
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-peak]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			const index = parseInt(input.getAttribute("data-peak-index") || "-1", 10);
			const field = input.getAttribute("data-peak-field");
			if (!walletId || index < 0 || field !== "start" && field !== "end") return;
			repository.updateWallet(walletId, (wallet) => {
				const item = wallet.peakHours[index];
				if (!item) return;
				if (field === "start") item.start = input.value;
				else item.end = input.value;
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-peak-delete]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			const index = parseInt(button.getAttribute("data-peak-index") || "-1", 10);
			if (!walletId || index < 0) return;
			repository.updateWallet(walletId, (wallet) => {
				if (wallet.peakHours.length <= 1) return;
				wallet.peakHours.splice(index, 1);
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-add-model]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			if (!walletId) return;
			const modelName = window.prompt("输入模型名");
			if (!modelName || !modelName.trim()) return;
			const name = modelName.trim();
			repository.updateWallet(walletId, (wallet) => {
				if (wallet.models.some((item) => item.model === name)) return;
				const now = Date.now();
				wallet.models.push({
					id: `manual:${now}:${Math.random().toString(36).slice(2, 8)}`,
					sourceModel: name,
					model: name,
					aliases: [],
					price: {
						usePeakPricing: wallet.kind === "official",
						offpeak: {
							hit: 0,
							miss: 0,
							output: 0
						},
						peak: {
							hit: 0,
							miss: 0,
							output: 0
						},
						priceConfigured: false
					},
					source: "discovered",
					locked: false,
					discoveredAt: now,
					lastSeen: now,
					updatedAt: now
				});
			});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-model-name]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			const modelId = input.getAttribute("data-model-id");
			const nextName = String(input.value || "").trim();
			if (!walletId || !modelId || !nextName) return renderWalletView();
			repository.updateWallet(walletId, (wallet) => {
				const model = wallet.models.find((item) => item.id === modelId);
				if (!model || model.model === nextName) return;
				if (model.model && !model.aliases.includes(model.model)) model.aliases.push(model.model);
				model.model = nextName;
				model.source = model.source === "builtin" ? "manual" : model.source;
				model.updatedAt = Date.now();
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-context-limit]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			const modelId = input.getAttribute("data-model-id");
			if (!walletId || !modelId) return;
			const value = parseFloat(String(input.value || ""));
			const contextLimit = Number.isFinite(value) && value > 0 ? Math.round(value) : null;
			repository.updateWallet(walletId, (wallet) => {
				const model = wallet.models.find((item) => item.id === modelId);
				if (model) {
					model.contextLimit = contextLimit ?? defaultContextLimitForModel(model.sourceModel);
					model.contextLimitManual = contextLimit != null;
				}
			});
			renderWalletView();
		};
	});
	doc.querySelectorAll("input[data-wallet-price]").forEach((input) => {
		input.onchange = () => {
			const row = input.closest("[data-wallet-model-row]");
			const walletId = input.getAttribute("data-wallet-id");
			const modelId = input.getAttribute("data-model-id");
			if (!row || !walletId || !modelId) return;
			const prices = readModelPrices(row);
			repository.updateWallet(walletId, (wallet) => {
				const model = wallet.models.find((item) => item.id === modelId);
				if (!model) return;
				model.price.offpeak = prices.offpeak;
				model.price.peak = prices.peak;
				model.price.priceConfigured = true;
				model.source = "manual";
				model.updatedAt = Date.now();
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-model-peak]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			const modelId = input.getAttribute("data-model-id");
			if (!walletId || !modelId) return;
			repository.updateWallet(walletId, (wallet) => {
				const model = wallet.models.find((item) => item.id === modelId);
				if (!model) return;
				model.price.usePeakPricing = !!input.checked;
				model.updatedAt = Date.now();
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-model-lock]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			const modelId = input.getAttribute("data-model-id");
			if (!walletId || !modelId) return;
			repository.updateWallet(walletId, (wallet) => {
				const model = wallet.models.find((item) => item.id === modelId);
				if (model) model.locked = !!input.checked;
			});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-model-delete]").forEach((button) => {
		button.onclick = () => {
			const walletId = button.getAttribute("data-wallet-id");
			const modelId = button.getAttribute("data-model-id");
			if (!walletId || !modelId) return;
			repository.updateWallet(walletId, (wallet) => {
				wallet.models = wallet.models.filter((item) => item.id !== modelId || item.source === "builtin");
			});
			repository.recalcWallet(walletId).catch(() => {});
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-currency-btn]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			const walletId = button.getAttribute("data-wallet-id");
			const dropdown = doc.getElementById(`aus-wallet-currency-drop-${walletId}`);
			if (!dropdown) return;
			closeOtherDropdowns(dropdown.id);
			dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
		};
	});
	doc.querySelectorAll("[data-wallet-adapter-btn]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			const walletId = button.getAttribute("data-wallet-id");
			const dropdown = doc.getElementById("aus-wallet-adapter-drop-" + walletId);
			if (!dropdown) return;
			closeOtherDropdowns(dropdown.id);
			dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
		};
	});
	doc.querySelectorAll("[data-wallet-adapter-user-id]").forEach((input) => {
		input.onchange = () => {
			const walletId = input.getAttribute("data-wallet-id");
			const value = String(input.value || "").trim();
			if (!walletId) return;
			repository.updateWallet(walletId, (wallet) => {
				wallet.balance.userId = value || null;
			});
		};
	});
	doc.querySelectorAll("[data-wallet-catalog-btn]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			const walletId = button.getAttribute("data-wallet-id");
			const dropdown = doc.getElementById(`aus-wallet-catalog-drop-${walletId}`);
			if (!dropdown) return;
			closeOtherDropdowns(dropdown.id);
			dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
		};
	});
	try {
		const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
		const view = doc.querySelector("[data-view=\"wallet\"]");
		const viewHidden = view ? win?.getComputedStyle?.(view).display === "none" : false;
		if (win && !viewHidden) doc.querySelectorAll("[data-wallet-catalog-btn]").forEach((btn) => {
			const box = btn.getBoundingClientRect();
			const cs = win.getComputedStyle(btn);
			if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0 || box.width < 4 || box.height < 4) console.warn("[Api-Usage] 价格来源胶囊不可见", {
				walletId: btn.getAttribute("data-wallet-id"),
				display: cs.display,
				visibility: cs.visibility,
				opacity: cs.opacity,
				width: Math.round(box.width),
				height: Math.round(box.height),
				parentDisplay: btn.parentElement ? win.getComputedStyle(btn.parentElement).display : null,
				parentOverflow: btn.parentElement ? win.getComputedStyle(btn.parentElement).overflow : null
			});
		});
	} catch {}
	doc.querySelectorAll("[data-wallet-credential-btn]").forEach((button) => {
		button.onclick = (event) => {
			event.stopPropagation();
			const walletId = button.getAttribute("data-wallet-id");
			const dropdown = doc.getElementById(`aus-wallet-credential-drop-${walletId}`);
			if (!dropdown) return;
			closeOtherDropdowns(dropdown.id);
			dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
		};
	});
	doc.querySelectorAll("[data-wallet-select]").forEach((item) => {
		item.onclick = (event) => {
			event.stopPropagation();
			const walletId = item.getAttribute("data-wallet-id");
			const kind = item.getAttribute("data-wallet-select");
			const value = item.getAttribute("data-value") || "";
			if (!walletId) return;
			if (kind === "currency") repository.updateWallet(walletId, (wallet) => {
				wallet.balance.currency = value;
			});
			else if (kind === "catalog") repository.updateWallet(walletId, (wallet) => {
				wallet.catalogProvider = value || null;
			});
			else if (kind === "adapter") repository.updateWallet(walletId, (wallet) => {
				wallet.balance.adapter = value || null;
			});
			else if (kind === "credential") repository.updateWallet(walletId, (wallet) => {
				wallet.balance.primaryCredentialId = value || null;
			});
			closeDropdownsInstant();
			afterNextPaint(() => renderWalletView());
		};
	});
	const searchInput = doc.querySelector("[data-wallet-search]");
	if (searchInput) {
		const applySearch = () => {
			const keyword = String(searchInput.value || "").trim().toLowerCase();
			try {
				window.parent?.localStorage?.setItem("aus_wallet_query_v1", keyword);
			} catch {}
			doc.querySelectorAll("[data-wallet-card]").forEach((card) => {
				const walletId = card.getAttribute("data-wallet-card");
				const wallet = repository.getWallet(walletId);
				if (!wallet) return;
				const hay = [
					wallet.name,
					wallet.endpointDisplay,
					wallet.endpointLabel,
					...wallet.models.map((model) => model.model)
				].filter(Boolean).join(" ").toLowerCase();
				card.style.display = !keyword || hay.includes(keyword) ? "" : "none";
			});
		};
		searchInput.oninput = applySearch;
		if (String(searchInput.value || "").trim()) applySearch();
	}
	doc.querySelectorAll("[data-wallet-filter]").forEach((button) => {
		button.onclick = () => {
			try {
				window.parent?.localStorage?.setItem("aus_wallet_filter_v1", button.getAttribute("data-wallet-filter") || "all");
			} catch {}
			renderWalletView();
		};
	});
	doc.querySelectorAll("[data-wallet-toggle-all]").forEach((button) => {
		button.onclick = () => {
			const expand = button.getAttribute("data-wallet-toggle-all") === "expand";
			const next = repository.getWallets().map((wallet) => cloneWallet(wallet));
			next.forEach((wallet) => {
				wallet.collapsed = !expand;
			});
			repository.replaceWallets(next);
			renderWalletView();
		};
	});
	for (const wallet of repository.getWallets()) bindPlanBlock(doc, wallet.id, () => {
		renderWalletView();
	});
	if (!bindWalletView._outsideBound) {
		bindWalletView._outsideBound = true;
		doc.addEventListener("click", (event) => {
			const target = event.target;
			if (!target?.closest?.("[data-wallet-dropdown]") && !target?.closest?.("[data-wallet-currency-btn]") && !target?.closest?.("[data-wallet-catalog-btn]") && !target?.closest?.("[data-wallet-credential-btn]") && !target?.closest?.("[data-wallet-adapter-btn]")) closeDropdowns();
		});
	}
}
//#endregion
//#region src/ui/chat-manage.ts
/**
* 对话展示管理页（`data-view="chat-manage"`）。
*
* 入口三处，都进同一个页面：概览「按对话统计」标题右侧、趋势预测页顶部、
* 设置页的「对话展示」设置项。页面本身是扁平同级视图，不挂在任何导航 tab 下，
* 底栏布局下由 `nav-model.ts#CHILD_PARENT` 归到「概览」tab（底栏高亮与顶栏返回
* 都回到进入前的来源页，来源由 `panel.ts` 记录并注入 `initChatManageView`）。
*
* 页面管两件事，两套独立的隐藏集合（`chat-visibility.ts`）：
* - 「表格展示」：该对话是否出现在概览「按对话统计」表里；
* - 「下拉选项」：该对话是否出现在统计页/历史页/趋势预测页的「对话」下拉胶囊里。
* 两者都只改展示，不删数据、不参与任何统计口径——热力图、统计、历史、趋势预测、
* 能耗评分依旧按全量历史计算，与用户要求「不影响数据统计展示」一致。
*/
var navigator = null;
/** 切页导航回调由 panel.ts 注册（避免 chat-manage 反向 import panel 造成循环依赖） */
function initChatManageView(opts) {
	navigator = opts;
}
function getDoc$2() {
	return window.parent?.document ?? document;
}
/** 搜索关键词（只在本页内过滤显示，不进存储） */
var keyword = "";
/** 最近一次聚合结果，供搜索、模式切换与重绘复用 */
var rows = [];
/** 当前管理模式：表格展示 / 下拉选项（只在本次会话内记忆） */
var mode = "table";
/** 渲染令牌：热数据先画、冷数据补全，快速切页时丢弃过期结果 */
var renderToken = 0;
var MODES = [{
	key: "table",
	label: "表格展示",
	title: "控制哪些对话出现在概览「按对话统计」表格",
	desc: "只控制「按对话统计」表格里是否列出该对话：隐藏不会删除任何数据，热力图、用量统计、历史记录与趋势预测仍按全部历史计算。"
}, {
	key: "picker",
	label: "下拉选项",
	title: "控制哪些对话出现在各页「对话」下拉胶囊",
	desc: "只控制统计页、历史页与趋势预测页的「对话」下拉胶囊里是否列出该对话：隐藏不会删除任何数据，各页统计口径不变。"
}];
function modeInfo() {
	return MODES.find((m) => m.key === mode) || MODES[0];
}
function shellHTML() {
	const info = modeInfo();
	return [
		"<div id=\"aus-chat-manage-head\">",
		"<div class=\"aus-chat-manage-lead\">",
		"<div class=\"aus-chat-manage-title\">对话展示管理</div>",
		"<div class=\"aus-chat-manage-desc\" id=\"aus-chat-manage-desc\">" + esc(info.desc) + "</div>",
		"</div>",
		"<div id=\"aus-chat-manage-tools\">",
		"<input id=\"aus-chat-manage-search\" type=\"text\" placeholder=\"搜索对话\" value=\"" + esc(keyword) + "\" />",
		"<button id=\"aus-chat-manage-reset\" type=\"button\" class=\"aus-chat-manage-btn\">全部显示</button>",
		"<button id=\"aus-chat-manage-hide-all\" type=\"button\" class=\"aus-chat-manage-btn\">全部隐藏</button>",
		"<button id=\"aus-chat-manage-back\" type=\"button\" class=\"aus-chat-manage-btn\" title=\"回到进入本页之前的页面\">" + icon("chevron-left", 14) + "返回</button>",
		"</div>",
		"</div>",
		"<div id=\"aus-chat-manage-modes\">",
		MODES.map((m) => "<button type=\"button\" class=\"aus-chat-manage-mode\" data-manage-mode=\"" + m.key + "\" data-active=\"" + (m.key === mode ? "1" : "0") + "\" title=\"" + esc(m.title) + "\">" + esc(m.label) + "</button>").join(""),
		"</div>",
		"<div class=\"ds-card aus-chat-manage-card\">",
		"<div id=\"aus-chat-manage-list\"></div>",
		"</div>",
		"<div id=\"aus-chat-manage-foot\"></div>"
	].join("");
}
function rowHTML(row, index) {
	const key = chatVisibilityKey(row.chatId);
	const hidden = isHiddenFor(mode, key);
	let costTxt = "¥" + row.cost.toFixed(4);
	try {
		costTxt = formatMoney(row.cost, 4);
	} catch {}
	const meta = row.count + " 轮 · " + row.total.toLocaleString("zh-CN") + " tokens · " + costTxt;
	const aria = row.displayName + "：" + (mode === "picker" ? "在「对话」下拉胶囊中展示" : "在按对话统计中展示");
	return [
		"<div class=\"aus-chat-manage-row\" data-chat-row=\"" + esc(key) + "\" data-chat-name=\"" + esc(row.displayName.toLowerCase()) + "\" data-hidden=\"" + (hidden ? "1" : "0") + "\">",
		"<div class=\"aus-chat-manage-main\">",
		"<div class=\"aus-chat-manage-name\" title=\"" + esc(row.chatId || row.displayName) + "\">" + esc(row.displayName) + "</div>",
		"<div class=\"aus-chat-manage-meta\">" + meta + "</div>",
		"</div>",
		"<span class=\"aus-chat-manage-state\" data-state>" + (hidden ? "已隐藏" : "展示中") + "</span>",
		switchHTML("aus-chat-sw-" + index, {
			checked: !hidden,
			ariaLabel: aria
		}),
		"</div>"
	].join("");
}
function applyKeywordFilter(doc) {
	const list = doc.getElementById("aus-chat-manage-list");
	if (!list) return;
	const kw = keyword.trim().toLowerCase();
	list.querySelectorAll("[data-chat-row]").forEach((el) => {
		const name = el.getAttribute("data-chat-name") || "";
		el.style.display = !kw || name.includes(kw) ? "" : "none";
	});
}
function paintFoot(doc) {
	const foot = doc.getElementById("aus-chat-manage-foot");
	if (!foot) return;
	const total = rows.length;
	const hidden = rows.filter((r) => isHiddenFor(mode, chatVisibilityKey(r.chatId))).length;
	const where = mode === "picker" ? "「对话」下拉胶囊" : "「按对话统计」表";
	foot.textContent = total ? "共 " + total + " 个对话 · 已隐藏 " + hidden + " 个" + (hidden ? "（隐藏项不会出现在" + where + "中）" : "") : "暂无对话数据";
}
/** 重画列表（数据、模式或显隐变更后调用） */
function paintList(doc) {
	const list = doc.getElementById("aus-chat-manage-list");
	if (!list) return;
	if (!rows.length) {
		list.innerHTML = "<div style=\"padding:20px 16px;text-align:center;color:var(--ds-text-3);font-size:var(--aus-fs-sm);\">暂无可管理的对话，产生用量记录后即可在此设置</div>";
		paintFoot(doc);
		return;
	}
	list.innerHTML = rows.map((row, i) => rowHTML(row, i)).join("");
	applyKeywordFilter(doc);
	paintFoot(doc);
	try {
		paintChatManageBadge(doc);
	} catch {}
}
/** 切换管理模式：重画描述、按钮选中态与整张列表 */
function paintMode(doc) {
	const desc = doc.getElementById("aus-chat-manage-desc");
	if (desc) desc.textContent = modeInfo().desc;
	doc.querySelectorAll("[data-manage-mode]").forEach((el) => {
		el.setAttribute("data-active", el.getAttribute("data-manage-mode") === mode ? "1" : "0");
	});
	paintList(doc);
}
/** 绑定 shell 内的按钮与列表事件（幂等：只在首次构建 shell 时绑定一次） */
function bindShell(doc) {
	const list = doc.getElementById("aus-chat-manage-list");
	list?.addEventListener("change", (e) => {
		const input = e.target;
		if (!input || input.type !== "checkbox") return;
		const rowEl = input.closest("[data-chat-row]");
		const key = rowEl?.getAttribute("data-chat-row") || "";
		if (!key) return;
		setHiddenFor(mode, key, !input.checked);
		if (rowEl) {
			rowEl.setAttribute("data-hidden", input.checked ? "0" : "1");
			const stateEl = rowEl.querySelector("[data-state]");
			if (stateEl) stateEl.textContent = input.checked ? "展示中" : "已隐藏";
		}
		paintFoot(doc);
		try {
			paintChatManageBadge(doc);
		} catch {}
	});
	list?.addEventListener("click", (e) => {
		const target = e.target;
		if (!target || target.closest("label.aus-switch")) return;
		const rowEl = target.closest("[data-chat-row]");
		if (!rowEl) return;
		const input = rowEl.querySelector("input[type=\"checkbox\"]");
		if (!input) return;
		input.checked = !input.checked;
		input.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
	});
	const search = doc.getElementById("aus-chat-manage-search");
	search?.addEventListener("input", () => {
		keyword = search.value || "";
		applyKeywordFilter(doc);
	});
	doc.getElementById("aus-chat-manage-reset")?.addEventListener("click", () => {
		clearHiddenFor(mode);
		paintList(doc);
	});
	doc.getElementById("aus-chat-manage-hide-all")?.addEventListener("click", () => {
		setAllHiddenFor(mode, rows.map((row) => chatVisibilityKey(row.chatId)), true);
		paintList(doc);
	});
	doc.getElementById("aus-chat-manage-back")?.addEventListener("click", () => {
		try {
			navigator?.go();
		} catch {}
	});
	doc.querySelectorAll("[data-manage-mode]").forEach((el) => {
		el.addEventListener("click", () => {
			const next = el.getAttribute("data-manage-mode");
			if (next !== "table" && next !== "picker") return;
			if (next === mode) return;
			mode = next;
			paintMode(doc);
		});
	});
}
/**
* 渲染管理页：先用热数据（最近 50 条）立即出图，再异步用冷存储全量补全，
* 避免打开页面时空白等待 IndexedDB（与概览「按对话统计」同一套补全思路）。
*/
async function renderChatManageView() {
	const doc = getDoc$2();
	const host = doc.getElementById("aus-chat-manage-body");
	if (!host) return;
	if (!host.firstChild) {
		host.innerHTML = shellHTML();
		try {
			bindShell(doc);
		} catch {}
	} else paintMode(doc);
	const token = ++renderToken;
	const hot = state$2.history || [];
	rows = computeChatStats(hot);
	paintList(doc);
	try {
		const all = await repository.getAllHistory();
		if (token !== renderToken) return;
		if (!all || !all.length || all.length <= hot.length) return;
		rows = computeChatStats(all);
		paintList(doc);
	} catch {}
}
//#endregion
//#region src/ui/help-view.ts
/** 完整使用文档（线上文档站）与隐私条款锚点，全站单一定义。 */
var HELP_DOC_URL = "https://janmk1453.github.io/Api-Usage/";
var HELP_PRIVACY_URL = "https://janmk1453.github.io/Api-Usage/#privacy";
function guideCard(iconName, title, steps) {
	return `<section class="ds-card aus-help-card">
      <div class="aus-help-card-head"><span class="aus-help-card-icon">${icon(iconName, 16)}</span><span class="aus-help-card-title">${title}</span></div>
      <ol class="aus-help-steps">${steps.map((text) => `<li>${text}</li>`).join("")}</ol>
    </section>`;
}
function legalList(items) {
	return `<ul class="aus-help-legal-list">${items.map((text) => `<li>${text}</li>`).join("")}</ul>`;
}
var PRIVACY_ITEMS = [
	"扩展在酒馆里只能读到密钥条目的<strong>编号、备注与掩码末三位</strong>，仅用于区分请求来源，不会读取、保存或上传完整密钥。",
	"你保存在酒馆里的密钥是安全的，扩展无法获取真实密钥。",
	"你主动填入扩展的<strong>校准密钥</strong>是真实可用的密钥，只用于查询该钱包对应厂商的余额或套餐额度（DeepSeek、Moonshot/Kimi、硅基流动、OpenRouter、阶跃星辰、Novita、智谱 GLM、MiniMax，以及你自填的 new-api 中转），不会额外扣费或消耗。",
	"校准密钥经 XOR 混淆后存放在 SillyTavern，<strong>不进入历史记录、统计、日志、导入导出与 WebDAV</strong>。",
	"查询由浏览器直连厂商接口，不经过第三方代理；未开放跨域（CORS）的厂商会直接失败并提示，扩展不会绕过该限制。",
	"XOR 不是安全加密，请使用权限受限的密钥并自行评估风险。",
	"本扩展完整代码开源，可自行审查。"
];
var DISCLAIMER_ITEMS = [
	"「价格来源」「自动同步」用到 <a href=\"https://models.dev\" target=\"_blank\" rel=\"noreferrer\">models.dev</a> 的数据，其中若出现商业化中转站，扩展不负责也不推荐；数据量太大难以完全筛净，与 models.dev 及任何中转站都没有商业往来，坚定反对商业化。",
	"「套餐额度」中的本地估算基于本扩展记录推算，不含其他设备或其他客户端的消耗，可能与实际有偏差，<strong>仅供展示参考，不参与计费、导出与云同步，不能作为账单依据</strong>；对没有公开接口或未开放跨域的厂商（Claude Code、Codex、OpenCode、GitHub Copilot、Cursor、讯飞星辰等）不提供自动查询，也不会绕过限制。",
	"界面中的厂商图标与名称商标归各自所有者，仅用于标识接入来源，不构成任何关联、合作或背书；图标数据内联自 simple-icons（CC0 发布）。",
	"会尽可能维护扩展的安全与隐私性，但不对因酒馆或本扩展的安全漏洞及间接原因导致的密钥泄露与损失负责。"
];
var GUIDES = [
	[
		"brand",
		"开始使用",
		[
			"在酒馆左下角打开魔法棒菜单，点「API用量统计」进入扩展面板。",
			"之后正常对话即可，扩展会自动记录每次请求。",
			"桌面用左侧栏切换页面，手机用底部标签栏切换。"
		]
	],
	[
		"overview",
		"用量概览",
		[
			"顶部两张卡是充值余额与累计消费，余额旁的下拉可切换其它钱包。",
			"8 个数据块、Token 热力图与按对话统计都按全部历史汇总。",
			"「按对话统计」点表头可排序，右上角「管理对话」可隐藏不常看的对话。"
		]
	],
	[
		"stats",
		"用量统计",
		[
			"用时间、模型、对话、接入类型、API 密钥五个胶囊筛选，模型可多选。",
			"三块总量、四个小块、模型汇总表与全部图表都跟随筛选。",
			"图表里可自选 Y 指标与 X 维度，Y 下拉底部可切自动 / 柱状 / 曲线 / 面积。",
			"筛选结果会记住，点「重置筛选」可回到默认范围。"
		]
	],
	[
		"history",
		"历史记录",
		[
			"列表按时间倒序，每页 30 条，可按模型、对话、接入类型与 API 密钥筛选。",
			"点「详情」查看单条数据：请求参数、完整响应、Raw 用量与消息内容。",
			"先对较早一条点「旧」、再对较晚一条点「新」，可对比两条消息的差异。",
			"详情窗口在电脑端从右侧打开，手机端从屏幕下方弹出。"
		]
	],
	[
		"forecast",
		"趋势预测",
		[
			"选好对话、计价模型与视界（预测未来几轮），页面给出下一轮预测、余额可撑轮数与三张趋势图。",
			"对话内出现上下文压缩时，打开「压缩情景」可看压缩后的锯齿预测。",
			"页面下方是模型效率表与对话健康评分。",
			"工具栏「管理对话」可决定本页对话胶囊里显示哪些对话。"
		]
	],
	[
		"wallet",
		"钱包",
		[
			"扩展按接入链接自动创建钱包，DeepSeek 官方钱包始终保留。",
			"展开钱包可改名称、余额、模型价格、峰谷规则与价格来源。",
			"勾选「自动校准」并填好该钱包的校准密钥后，会按设置里的间隔自动查余额。",
			"点忽略后钱包进入「已忽略接入」，不参与合计，可在页面底部恢复显示。"
		]
	],
	[
		"settings",
		"设置与数据",
		[
			"颜色模式、移动端兼容 UI、历史显示范围与匿名统计都在设置页顶部。",
			"「对话展示」管理对话显示，「按范围删除记录」可按日期、模型、对话删除。",
			"WebDAV 云同步可跨设备同步记录与钱包；「存储占用」里能清理旧版迁移备份。",
			"峰谷规则与「额外空闲日期」决定费用计算，默认按 DeepSeek 官方规则。"
		]
	],
	[
		"menu",
		"对话展示管理",
		[
			"从概览「按对话统计」右上角、趋势预测工具栏或设置页「对话展示」进入，返回时回到进入前的页面。",
			"「表格展示」模式管概览统计表里显示哪些对话。",
			"「下拉选项」模式管统计页、历史页、趋势预测页「对话」下拉里的选项。",
			"支持搜索、全部显示、全部隐藏；只影响显示，不删除任何数据。"
		]
	]
];
/** 使用说明页整页 HTML（内容全部静态，交互由 style.css 与原生链接承担）。 */
function helpViewHTML() {
	const guides = GUIDES.map(([iconName, title, steps]) => guideCard(iconName, title, steps)).join("");
	return `
    <div id="aus-help-body">
      <a class="aus-help-hero" href="${HELP_DOC_URL}" target="_blank" rel="noreferrer">
        <span class="aus-help-hero-icon">${icon("help", 20)}</span>
        <span class="aus-help-hero-main">
          <span class="aus-help-hero-title">完整使用文档</span>
          <span class="aus-help-hero-desc">逐页说明筛选、钱包与定价、云同步和常见问题</span>
        </span>
        <span class="aus-help-hero-arrow">${icon("chevron-right", 16)}</span>
      </a>

      <div class="ds-card" id="aus-help-legal">
        <p class="aus-help-legal-notice">安装、启用或使用本扩展，即视为您已阅读、理解并同意本声明的全部内容。如不同意，请立即停止使用并卸载本扩展。</p>
        <section class="aus-help-legal-block" data-kind="privacy">
          <div class="aus-help-legal-head">
            <span class="aus-help-legal-dot"></span>
            <span class="aus-help-legal-title">隐私声明</span>
            <a class="aus-help-legal-link" href="${HELP_PRIVACY_URL}" target="_blank" rel="noreferrer">完整版${icon("chevron-right", 12)}</a>
          </div>
          ${legalList(PRIVACY_ITEMS)}
        </section>
        <section class="aus-help-legal-block" data-kind="disclaimer">
          <div class="aus-help-legal-head">
            <span class="aus-help-legal-dot"></span>
            <span class="aus-help-legal-title">免责声明</span>
            <a class="aus-help-legal-link" href="${HELP_PRIVACY_URL}" target="_blank" rel="noreferrer">完整版${icon("chevron-right", 12)}</a>
          </div>
          ${legalList(DISCLAIMER_ITEMS)}
        </section>
      </div>

      <div id="aus-help-guides">${guides}</div>

      <div class="ds-card" id="aus-help-foot">
        <div class="aus-help-foot-sec">
          <div class="aus-help-foot-title">模型兼容</div>
          <div class="aus-help-foot-text">完全兼容 DeepSeek 官方 API；其它厂商与渠道尽量兼容，部分模型可能没有缓存命中。数据异常时请携带完整请求与响应反馈。</div>
        </div>
        <div class="aus-help-foot-sec">
          <div class="aus-help-foot-title">关于</div>
          <div class="aus-help-foot-text">由原脚本 <a href="https://github.com/janmk1453/deepseek-tavern-script" target="_blank" rel="noreferrer">deepseek-tavern-script</a> 迁移重构 · <span style="color:var(--ds-text);">@janmk</span> · 仓库 <a href="https://github.com/janmk1453/Api-Usage" target="_blank" rel="noreferrer">janmk1453/Api-Usage</a></div>
        </div>
      </div>
    </div>`;
}
//#endregion
//#region src/ui/chart-picker.ts
var ESCAPE = {
	"&": "&amp;",
	"\"": "&quot;",
	"<": "&lt;",
	">": "&gt;"
};
var escText = (value) => String(value).replace(/[&"<>]/g, (ch) => ESCAPE[ch] || ch);
/** 单枚轴设置胶囊；箭头只在真有下拉时出现（箭头永远是最后一个 svg，pill.ts 旋转它） */
function chartPillHTML(pill) {
	const hasDrop = pill.dropdown !== false;
	return `<button type="button" class="aus-chart-pill" id="${escText(pill.btnId)}" data-axis-key="${escText(pill.key)}"><span class="aus-chart-pill-key">${escText(pill.key)}</span><span class="aus-chart-pill-val" id="${escText(pill.labelId)}">${escText(pill.label)}</span>` + (hasDrop ? icon("chevron-down", 14) : "") + "</button>";
}
/** 下拉浮层；data-axis 决定从胶囊左端（Y）还是右端（X）展开 */
function chartDropdownHTML(pill) {
	const axis = pill.key === "X" ? "x" : "y";
	return `<div class="aus-chart-dropdown" id="${escText(pill.dropId)}" data-axis="${axis}" style="display:none;"></div>`;
}
/** 右上角设置区：胶囊并排 + 各自的绝对定位下拉（同一个 relative 容器里，位置随胶囊走） */
function chartAxisPickerHTML(pills) {
	return `<div class="aus-chart-picker">${pills.map(chartPillHTML).join("")}${pills.filter((pill) => pill.dropdown !== false).map(chartDropdownHTML).join("")}</div>`;
}
/** 统计页图表卡片：标题行 + 图表容器 */
function chartCardHTML(spec) {
	const pills = spec.pills && spec.pills.length ? chartAxisPickerHTML(spec.pills) : "";
	const cardId = spec.cardId ? ` id="${escText(spec.cardId)}"` : "";
	const height = spec.height ?? 220;
	return `<div class="ds-card aus-chart-card"${cardId}><div class="aus-chart-card-head"><span class="aus-chart-card-title">${escText(spec.title)}</span>` + pills + `</div><div id="${escText(spec.chartId)}" style="height:${height}px;"></div></div>`;
}
/** 更新日志（最新在前） */
var CHANGELOG = [
	{
		version: "r3.2.0",
		date: "2026-11-08",
		sections: [
			{
				kind: "feature",
				items: ["新增「管理对话」，管理首页表格和下拉胶囊中的对话是否显示", "安卓设备现在使用系统返回时会退出扩展"]
			},
			{
				kind: "improve",
				items: [
					"优化启动速度",
					"更新了使用说明页的内容",
					"改进部分组件UI细节和可视性"
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
function entryHtml(entry, open, isLatest) {
	const dateText = formatChangelogDate(entry.date);
	const meta = [dateText ? `${esc(dateText)} 更新` : ""].concat(isLatest ? ["<span class=\"aus-changelog-latest\">最新</span>"] : []).filter(Boolean).join("");
	const sections = entry.sections.filter((s) => s && s.items && s.items.length).map(sectionHtml).join("");
	return "<div class=\"aus-changelog-entry\" data-changelog-entry data-open=\"" + (open ? "1" : "0") + `"><button type="button" class="aus-changelog-head" data-changelog-toggle aria-expanded="${open ? "true" : "false"}"><span class="aus-changelog-version">${esc(entry.version)}</span><span class="aus-changelog-meta">${meta}</span><span class="aus-changelog-caret">${icon(open ? "chevron-up" : "chevron-down", 16)}</span></button><div class="aus-changelog-body"${open ? "" : " style=\"display:none;\""}>${sections}</div></div>`;
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
//#region src/ui/pill.ts
/**
* 全站胶囊下拉的「打开状态」标记。
*
* 面板里所有下拉胶囊的开关逻辑都是手写 inline `style.display`（`block` / `none`），
* 没有统一的状态类。为了让胶囊能在展开时把箭头转 180°、并在悬停时有一点反馈，
* 这里用 MutationObserver 监听 `#aus-panel` 内的 style 变化，按「下拉当前是否可见」
* 给对应触发器打 `data-aus-open`，视觉全部交给 `style.css`，不干预任何开关逻辑。
*
* 配对规则（与既有命名约定一致，无需逐个登记）：
*  - `aus-xxx-btn`      ↔ `aus-xxx-dropdown`（如 aus-range-btn / aus-chart-y-btn）
*  - `aus-xxx-btn-<后缀>` ↔ `aus-xxx-drop-<后缀>`（如 aus-four-btn-0 / aus-extra-y-btn-token）
*  - 钱包卡触发器 `[data-wallet-<kind>-btn][data-wallet-id]` ↔ `aus-wallet-<kind>-drop-<钱包 id>`
*
* 各页 innerHTML 重绘会换掉按钮节点，所以扫描是幂等的：每次变化都重新标注一遍，
* 找不到下拉的按钮直接跳过，不影响任何现有交互。
*/
var PILL_ATTR = "data-aus-pill";
var OPEN_ATTR = "data-aus-open";
var DROP_OPEN_ATTR = "data-aus-drop-open";
var WALLET_KINDS = [
	"credential",
	"catalog",
	"adapter",
	"currency"
];
var TRIGGER_SELECTOR = [
	"[id$=\"-btn\"]",
	"[id*=\"-btn-\"]",
	...WALLET_KINDS.map((kind) => `[data-wallet-${kind}-btn]`)
].join(", ");
var observer = null;
var observedPanel = null;
function dropdownFor(button, doc) {
	const id = button.id || "";
	if (id.includes("-btn")) {
		const candidates = [id.replace("-btn", "-dropdown"), id.replace("-btn", "-drop")];
		for (const candidate of candidates) {
			const el = doc.getElementById(candidate);
			if (el) return el;
		}
	}
	for (const kind of WALLET_KINDS) {
		if (!button.hasAttribute(`data-wallet-${kind}-btn`)) continue;
		const walletId = button.getAttribute("data-wallet-id") || "";
		const el = doc.getElementById(`aus-wallet-${kind}-drop-${walletId}`);
		if (el) return el;
	}
	return null;
}
/** 下拉是否处于展开状态：先看 inline display（绝大多数），再看计算样式（趋势预测写在 class 里） */
function isOpen(drop) {
	const inline = drop.style.display;
	if (inline === "none") return false;
	if (inline) return true;
	try {
		const view = drop.ownerDocument?.defaultView;
		if (!view) return false;
		return view.getComputedStyle(drop).display !== "none";
	} catch {
		return false;
	}
}
function syncPillState() {
	const panel = observedPanel;
	if (!panel || !panel.isConnected) return;
	const doc = panel.ownerDocument;
	const buttons = Array.from(panel.querySelectorAll(TRIGGER_SELECTOR));
	for (const button of buttons) {
		const drop = dropdownFor(button, doc);
		if (!drop) {
			if (button.hasAttribute(PILL_ATTR)) {
				button.removeAttribute(PILL_ATTR);
				button.removeAttribute(OPEN_ATTR);
			}
			continue;
		}
		if (button.getAttribute(PILL_ATTR) !== "1") button.setAttribute(PILL_ATTR, "1");
		if (isOpen(drop)) {
			if (button.getAttribute(OPEN_ATTR) !== "1") button.setAttribute(OPEN_ATTR, "1");
			if (drop.getAttribute(DROP_OPEN_ATTR) !== "1") drop.setAttribute(DROP_OPEN_ATTR, "1");
		} else {
			if (button.hasAttribute(OPEN_ATTR)) button.removeAttribute(OPEN_ATTR);
			if (drop.hasAttribute(DROP_OPEN_ATTR)) drop.removeAttribute(DROP_OPEN_ATTR);
		}
	}
}
/** 绑定面板（幂等）：同一 panel 重复调用只补一次扫描，换面板则重建监听 */
function initPillState(doc) {
	const panel = doc.getElementById("aus-panel");
	if (!panel) return;
	if (observer && observedPanel === panel) {
		syncPillState();
		return;
	}
	disposePillState();
	observedPanel = panel;
	const View = doc.defaultView || window;
	if (!View || typeof View.MutationObserver !== "function") return;
	try {
		const local = new View.MutationObserver((records) => {
			let need = false;
			for (const record of records) {
				if (record.type === "childList") {
					need = true;
					break;
				}
				const target = record.target;
				if (target && target !== panel) {
					need = true;
					break;
				}
			}
			if (need) syncPillState();
		});
		local.observe(panel, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["style"]
		});
		observer = local;
	} catch {
		observer = null;
	}
	syncPillState();
}
function disposePillState() {
	try {
		observer?.disconnect();
	} catch {}
	observer = null;
	observedPanel = null;
}
//#endregion
//#region src/ui/panel.ts
var panel_exports = /* @__PURE__ */ __exportAll({
	applyMobileNavMode: () => applyMobileNavMode,
	bindPanel: () => bindPanel,
	closePanel: () => closePanel,
	createPanel: () => createPanel,
	openPanel: () => openPanel,
	refreshTheme: () => refreshTheme,
	refreshUI: () => refreshUI,
	resetPanelState: () => resetPanelState,
	togglePanel: () => togglePanel
});
/** 面板首帧渲染耗时的起点（用于匿名统计里的渲染耗时分桶） */
var panelOpenStartTs = 0;
function nowTs() {
	try {
		return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
	} catch {
		return Date.now();
	}
}
/** 当前扩展版本号（构建时由 manifest.version 注入）：侧栏品牌、设置页「关于」入口与关于页共用 */
function appVersionText() {
	return String("3.2.0");
}
function getDoc$1() {
	return window.parent?.document ?? document;
}
function prettyFullResponse(resp) {
	if (resp == null) return "（原文已清理）";
	if (typeof resp !== "string") try {
		return JSON.stringify(resp, null, 2);
	} catch {
		return String(resp);
	}
	const text = resp.trim();
	if (text.indexOf("data:") === -1) try {
		return JSON.stringify(JSON.parse(text), null, 2);
	} catch {
		return text;
	}
	let id = "", model = "", finish = null, usage = null;
	let content = "", reasoning = "", chunks = 0;
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line.startsWith("data:")) continue;
		const payload = line.slice(5).trim();
		if (!payload || payload === "[DONE]") continue;
		let chunk;
		try {
			chunk = JSON.parse(payload);
		} catch {
			continue;
		}
		chunks++;
		if (chunk.id) id = chunk.id;
		if (chunk.model) model = chunk.model;
		if (chunk.usage) usage = chunk.usage;
		const ch = Array.isArray(chunk.choices) ? chunk.choices[0] : null;
		if (ch) {
			const d = ch.delta || {};
			if (typeof d.reasoning_content === "string") reasoning += d.reasoning_content;
			else if (typeof d.reasoning === "string") reasoning += d.reasoning;
			if (typeof d.content === "string") content += d.content;
			if (ch.finish_reason) finish = ch.finish_reason;
		}
	}
	const head = [];
	if (id) head.push(`id: ${id}`);
	if (model) head.push(`model: ${model}`);
	head.push(`chunks: ${chunks}`);
	head.push(`finish_reason: ${finish ?? "（无）"}`);
	if (usage) head.push(`usage: ${JSON.stringify(usage)}`);
	const body = [];
	if (reasoning) body.push(`【思维链】\n${reasoning}`);
	body.push(`【正文】\n${content || "（无内容）"}`);
	return `${head.join("\n")}\n\n${body.join("\n\n")}\n\n—— 已合并 SSE 增量并隐藏重复字段 ——`;
}
var panelCreated = false;
var panelOpen = false;
var currentView = "overview";
/** 「设置」下最近打开的二级页（窄屏点回「设置」tab 时恢复到上次位置） */
var settingsChildView = null;
/** 「对话展示管理」的来源页：进入前记录的视图，页内「返回」与顶栏返回箭头都回到这里 */
var chatManageOrigin = "overview";
/** 当前导航高亮键：窄屏二级页归到「设置」，桌面为视图本身 */
var currentNavKey = "overview";
/** 面板内浏览栈：安卓返回键逐页回退（栈空才关面板），打开/关闭面板时清空 */
var viewTrail = [];
var collapsed = false;
function refreshUI() {
	try {
		if (!panelOpen) return;
		const doc = getDoc$1();
		const s = getSelectedSave();
		if (!s) return;
		const bal = state$2.customBalance || state$2.balance?.balance;
		const balEl = doc.getElementById("aus-balance");
		if (balEl) try {
			const v = bal ? parseFloat(String(bal)) : NaN;
			balEl.textContent = !isNaN(v) ? formatMoney(v, 2) : formatMoney(0, 2);
		} catch {
			balEl.textContent = bal ? "¥" + bal + " CNY" : "¥0.00 CNY";
		}
		const totalCostEl = doc.getElementById("aus-total-cost");
		if (totalCostEl) try {
			totalCostEl.textContent = formatMoney(s.total_cost || 0, 4);
		} catch {
			totalCostEl.textContent = "¥" + (s.total_cost || 0).toFixed(4) + " CNY";
		}
		const tokEl = doc.getElementById("aus-total-tokens");
		if (tokEl) tokEl.textContent = (s.total_tokens || 0).toLocaleString("zh-CN") + " tokens";
		renderHistory(doc, s);
		renderOverview();
		renderStatsView();
		try {
			renderForecastView();
		} catch {}
		try {
			renderWalletView();
		} catch {}
	} catch {}
}
/**
* 主题切换后的整体重绘（跟随系统时由 prefers-color-scheme 变化触发）。
* 面板关闭时无需处理：下次打开由 createPanel/refreshUI 重新取色。
*/
function refreshTheme() {
	try {
		if (!panelOpen) return;
		try {
			resetChartThemeCache();
		} catch {}
		try {
			disposeForecastCharts();
		} catch {}
		refreshUI();
	} catch {}
}
var historyPage = 1;
var HISTORY_PAGE_SIZE = 30;
var historyFullCache = null;
var historyCacheScope = "";
var historyLoading = false;
var invalidateHistoryCache = () => {
	historyFullCache = null;
	historyCacheScope = "";
	historyPage = 1;
};
var historyFilters = {
	model: STATS_FILTER_ALL,
	chat: STATS_FILTER_ALL,
	endpoint: STATS_FILTER_ALL,
	credential: STATS_FILTER_ALL
};
var restoredHistoryPrefs = readFilterPrefs().history;
if (restoredHistoryPrefs.model) historyFilters.model = restoredHistoryPrefs.model;
if (restoredHistoryPrefs.chat) historyFilters.chat = restoredHistoryPrefs.chat;
if (restoredHistoryPrefs.endpoint) historyFilters.endpoint = restoredHistoryPrefs.endpoint;
if (restoredHistoryPrefs.credential) historyFilters.credential = restoredHistoryPrefs.credential;
var historyFilterBase = [];
try {
	on(DataEvents.HISTORY_ADDED, invalidateHistoryCache);
	on(DataEvents.UPDATED, invalidateHistoryCache);
} catch {}
function resetHistoryFilters() {
	historyFilters.model = STATS_FILTER_ALL;
	historyFilters.chat = STATS_FILTER_ALL;
	historyFilters.endpoint = STATS_FILTER_ALL;
	historyFilters.credential = STATS_FILTER_ALL;
	historyPage = 1;
}
function getHistoryChatOptions(history) {
	const map = /* @__PURE__ */ new Map();
	for (const entry of history || []) {
		const chatId = entry?.chatId ?? null;
		const id = chatId ?? "__null__";
		const chatName = String(entry?.chatName || "").trim();
		const label = chatName || (chatId ? String(chatId).length > 18 ? `${String(chatId).slice(0, 8)}…${String(chatId).slice(-4)}` : String(chatId) : "未分组/旧数据");
		const timestamp = Number(entry?.timestamp) || 0;
		const current = map.get(id);
		if (!current) map.set(id, {
			id,
			label,
			title: String(chatId || label),
			lastSeen: timestamp
		});
		else {
			if (timestamp >= current.lastSeen && chatName) {
				current.label = chatName;
				current.title = String(chatId || chatName);
			}
			if (timestamp > current.lastSeen) current.lastSeen = timestamp;
		}
	}
	return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen || a.label.localeCompare(b.label, "zh-CN")).map(({ id, label, title }) => ({
		id,
		label,
		title
	}));
}
function closeHistoryFilterDropdowns() {
	const doc = getDoc$1();
	for (const kind of [
		"model",
		"chat",
		"endpoint",
		"credential"
	]) {
		const dropdown = doc.getElementById(`aus-history-${kind}-dropdown`);
		if (dropdown) dropdown.style.display = "none";
	}
}
/** 选中某一项后要重建列表时用：先把四个浮层瞬时收掉，重绘留到下一帧。 */
function closeHistoryFilterDropdownsInstant() {
	const doc = getDoc$1();
	for (const kind of [
		"model",
		"chat",
		"endpoint",
		"credential"
	]) closeDropdownInstant(doc.getElementById(`aus-history-${kind}-dropdown`));
}
function renderHistoryFilterDropdown(kind, selected, options, emptyText, onSelect) {
	const dropdown = getDoc$1().getElementById(`aus-history-${kind}-dropdown`);
	if (!dropdown) return;
	const item = (id, label, title = label) => {
		const active = id === selected ? "background:var(--ds-card);font-weight:600;" : "";
		return `<div data-history-value="${esc(id)}" title="${esc(title)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active}">${esc(label)}</div>`;
	};
	let html = item(STATS_FILTER_ALL, "全部");
	for (const option of options) html += item(option.id, option.label, option.title || option.label);
	if (!options.length) html += `<div style="padding:8px 10px;color:var(--ds-text-3);font-size:var(--aus-fs-base);">${esc(emptyText)}</div>`;
	dropdown.innerHTML = html;
	dropdown.querySelectorAll("[data-history-value]").forEach((element) => {
		element.onclick = () => onSelect(element.getAttribute("data-history-value") || "__all__");
	});
}
function renderHistoryFilters(history) {
	historyFilterBase = history || [];
	const doc = getDoc$1();
	const models = Array.from(new Set(historyFilterBase.map((entry) => String(entry?.model || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN")).map((id) => ({
		id,
		label: id
	}));
	if (historyFilters.model !== "__all__" && !models.some((option) => option.id === historyFilters.model)) historyFilters.model = STATS_FILTER_ALL;
	const chatOptions = getHistoryChatOptions(historyFilterBase);
	if (historyFilters.chat !== "__all__" && !chatOptions.some((option) => option.id === historyFilters.chat)) historyFilters.chat = STATS_FILTER_ALL;
	const chats = filterPickerRows(chatOptions, (option) => option.id);
	const endpoints = getEndpointFilterOptions(historyFilterBase);
	if (historyFilters.endpoint !== "__all__" && !endpoints.some((option) => option.id === historyFilters.endpoint)) {
		historyFilters.endpoint = STATS_FILTER_ALL;
		historyFilters.credential = STATS_FILTER_ALL;
	}
	const credentials = getCredentialFilterOptions(historyFilterBase, historyFilters.endpoint);
	if (historyFilters.credential !== "__all__" && !credentials.some((option) => option.id === historyFilters.credential)) historyFilters.credential = STATS_FILTER_ALL;
	const labelMap = {
		model: historyFilters.model === "__all__" ? "全部" : historyFilters.model,
		chat: historyFilters.chat === "__all__" ? "全部" : chatOptions.find((option) => option.id === historyFilters.chat)?.label || historyFilters.chat,
		endpoint: historyFilters.endpoint === "__all__" ? "全部" : historyFilters.endpoint === "__unknown__" ? "未记录接入" : endpoints.find((option) => option.id === historyFilters.endpoint)?.label || historyFilters.endpoint,
		credential: historyFilters.credential === "__all__" ? "全部" : historyFilters.credential === "__unknown__" ? "未识别密钥" : credentials.find((option) => option.id === historyFilters.credential)?.label || historyFilters.credential
	};
	for (const kind of [
		"model",
		"chat",
		"endpoint",
		"credential"
	]) {
		const label = doc.getElementById(`aus-history-${kind}-label`);
		if (label) {
			label.textContent = labelMap[kind];
			label.title = labelMap[kind];
		}
	}
	renderHistoryFilterDropdown("model", historyFilters.model, models, "暂无模型", (value) => {
		historyFilters.model = value;
		historyPage = 1;
		closeHistoryFilterDropdownsInstant();
		afterNextPaint(() => renderHistory(doc, getSelectedSave()));
	});
	renderHistoryFilterDropdown("chat", historyFilters.chat, chats, chatOptions.length ? "对话已全部隐藏（可在「对话展示管理」中恢复）" : "暂无对话", (value) => {
		historyFilters.chat = value;
		historyPage = 1;
		closeHistoryFilterDropdownsInstant();
		afterNextPaint(() => renderHistory(doc, getSelectedSave()));
	});
	renderHistoryFilterDropdown("endpoint", historyFilters.endpoint, endpoints, "暂无接入记录", (value) => {
		historyFilters.endpoint = value;
		historyFilters.credential = STATS_FILTER_ALL;
		historyPage = 1;
		closeHistoryFilterDropdownsInstant();
		afterNextPaint(() => renderHistory(doc, getSelectedSave()));
	});
	renderHistoryFilterDropdown("credential", historyFilters.credential, credentials, "暂无密钥记录", (value) => {
		historyFilters.credential = value;
		historyPage = 1;
		closeHistoryFilterDropdownsInstant();
		afterNextPaint(() => renderHistory(doc, getSelectedSave()));
	});
	writeFilterPrefs({ history: {
		model: historyFilters.model,
		chat: historyFilters.chat,
		endpoint: historyFilters.endpoint,
		credential: historyFilters.credential
	} });
}
function filteredHistoryForDisplay(history) {
	return filterStatsHistory(history, {
		model: historyFilters.model,
		chat: historyFilters.chat,
		endpoint: historyFilters.endpoint,
		credential: historyFilters.credential
	});
}
function bindHistoryFilters(doc) {
	for (const [kind, selector] of [
		["model", "#aus-history-model-btn"],
		["chat", "#aus-history-chat-btn"],
		["endpoint", "#aus-history-endpoint-btn"],
		["credential", "#aus-history-credential-btn"]
	]) {
		const button = doc.querySelector(selector);
		const dropdown = doc.getElementById(`aus-history-${kind}-dropdown`);
		if (!button || !dropdown) continue;
		button.onclick = () => {
			const willOpen = dropdown.style.display !== "block";
			closeHistoryFilterDropdowns();
			if (!willOpen) return;
			renderHistoryFilters(historyFilterBase);
			dropdown.style.display = "block";
			positionFilterDropdown(button, dropdown);
		};
	}
	const historyResetBtn = doc.getElementById("aus-history-filter-reset");
	if (historyResetBtn) historyResetBtn.onclick = () => {
		resetHistoryFilters();
		closeHistoryFilterDropdowns();
		renderHistory(doc, getSelectedSave());
	};
	doc.addEventListener("click", (event) => {
		if (!event.target.closest("#aus-history-filter-host")) closeHistoryFilterDropdowns();
	});
}
var activeHistoryDetailTs = null;
var activeHistoryDetailPanel = null;
var activeHistoryDetailHost = null;
var activeHistoryDetailBtn = null;
function resetHistoryDetailState(doc, clearBody = false) {
	try {
		const body = doc.getElementById("aus-history-detail-body");
		if (body && clearBody) body.innerHTML = "";
		const drawer = doc.getElementById("aus-history-detail");
		if (drawer) drawer.style.display = "none";
		const content = doc.getElementById("aus-content-body");
		if (content) content.classList.remove("has-history-detail");
	} catch {}
	activeHistoryDetailTs = null;
	activeHistoryDetailPanel = null;
	activeHistoryDetailHost = null;
	activeHistoryDetailBtn = null;
}
function closeHistoryDetail(doc) {
	const panel = activeHistoryDetailPanel;
	const host = activeHistoryDetailHost;
	if (panel) {
		try {
			if (panel.parentElement && panel.parentElement.id === "aus-history-detail-body" && host) host.appendChild(panel);
		} catch {}
		panel.style.display = "none";
		panel.style.flexDirection = "column";
		panel.style.maxHeight = "min(520px,60vh)";
		panel.style.overflowY = "auto";
		panel.style.overflowX = "hidden";
		panel.style.marginTop = "8px";
		panel.style.borderTop = "1px solid var(--ds-border)";
		panel.style.paddingTop = "8px";
	}
	const btn = activeHistoryDetailBtn;
	if (btn && btn.isConnected) {
		btn.textContent = "详情";
		btn.style.background = "var(--ds-black)";
		btn.style.color = "var(--ds-black-text)";
		btn.style.borderColor = "var(--ds-black)";
	}
	resetHistoryDetailState(doc);
}
function openHistoryDetail(doc, panel, btn) {
	const ts = btn.getAttribute("data-ts") || "";
	if (activeHistoryDetailTs === ts && activeHistoryDetailPanel === panel) {
		closeHistoryDetail(doc);
		return;
	}
	if (activeHistoryDetailPanel && activeHistoryDetailPanel !== panel) closeHistoryDetail(doc);
	const body = doc.getElementById("aus-history-detail-body");
	const drawer = doc.getElementById("aus-history-detail");
	const title = doc.getElementById("aus-history-detail-title");
	if (!body || !drawer) return;
	activeHistoryDetailHost = panel.parentElement;
	activeHistoryDetailTs = ts;
	activeHistoryDetailPanel = panel;
	activeHistoryDetailBtn = btn;
	panel.style.display = "flex";
	panel.style.flexDirection = "column";
	panel.style.maxHeight = "none";
	panel.style.overflow = "visible";
	panel.style.marginTop = "0";
	panel.style.borderTop = "none";
	panel.style.paddingTop = "0";
	try {
		body.appendChild(panel);
	} catch {}
	if (title) {
		const model = btn.getAttribute("data-model") || "记录详情";
		const time = btn.getAttribute("data-time") || "";
		title.textContent = time ? `${model} · ${time}` : model;
	}
	btn.textContent = "收起";
	btn.style.background = "var(--ds-card-inner)";
	btn.style.color = "var(--ds-text)";
	btn.style.borderColor = "var(--ds-black)";
	drawer.style.display = "flex";
	const content = doc.getElementById("aus-content-body");
	if (content) content.classList.add("has-history-detail");
}
/**
* 在重绘列表期间保持 #aus-main 的滚动位置不变：翻页、异步补齐全量数据都只换内容，
* 不允许把页面滚到别处（旧实现用 scrollIntoView 把列表拽回顶部）。
*/
function keepMainScrollPosition(doc, fn) {
	const scroller = doc.getElementById("aus-main");
	const top = scroller ? scroller.scrollTop : 0;
	const left = scroller ? scroller.scrollLeft : 0;
	fn();
	if (!scroller) return;
	const restore = () => {
		try {
			scroller.scrollTop = top;
			scroller.scrollLeft = left;
		} catch {}
	};
	restore();
	try {
		const view = doc.defaultView;
		if (view && view.requestAnimationFrame) view.requestAnimationFrame(restore);
		else setTimeout(restore, 0);
	} catch {
		setTimeout(restore, 0);
	}
}
function renderHistoryInner(doc, fullHist) {
	const host = doc.getElementById("aus-history");
	if (!host) return;
	const reopenDetailTs = activeHistoryDetailTs;
	resetHistoryDetailState(doc, true);
	const total = fullHist.length;
	if (!total) {
		host.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ds-text-3);font-size:var(--aus-fs-base);line-height:1.8;">当前筛选无记录<br/><button id="aus-history-filter-reset" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">清除筛选</button></div>`;
		const reset = doc.getElementById("aus-history-filter-reset");
		if (reset) reset.onclick = () => {
			resetHistoryFilters();
			closeHistoryFilterDropdowns();
			renderHistory(doc, getSelectedSave());
		};
		return;
	}
	const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
	if (historyPage > totalPages) historyPage = totalPages;
	if (historyPage < 1) historyPage = 1;
	const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
	const pageHist = fullHist.slice(start, start + HISTORY_PAGE_SIZE);
	const pagerTop = total > HISTORY_PAGE_SIZE ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);">
      <span>共 ${total} 条 · 第 ${historyPage}/${totalPages} 页</span>
      <span style="display:flex;gap:6px;">
        <button id="aus-history-prev" ${historyPage <= 1 ? "disabled" : ""} style="padding:4px 10px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage <= 1 ? "var(--ds-card)" : "var(--ds-card-inner)"};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage <= 1 ? "not-allowed" : "pointer"};opacity:${historyPage <= 1 ? "0.5" : "1"};display:inline-flex;align-items:center;gap:4px;">${icon("chevron-left", 14)} 上一页</button>
        <button id="aus-history-next" ${historyPage >= totalPages ? "disabled" : ""} style="padding:4px 10px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage >= totalPages ? "var(--ds-card)" : "var(--ds-card-inner)"};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage >= totalPages ? "not-allowed" : "pointer"};opacity:${historyPage >= totalPages ? "0.5" : "1"};display:inline-flex;align-items:center;gap:4px;">下一页 ${icon("chevron-right", 14)}</button>
      </span>
    </div>` : "";
	const pagerBottom = total > HISTORY_PAGE_SIZE ? `<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:10px;font-size:var(--aus-fs-sm);">
      <button id="aus-history-prev-b" ${historyPage <= 1 ? "disabled" : ""} style="padding:4px 12px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage <= 1 ? "var(--ds-card)" : "var(--ds-card-inner)"};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage <= 1 ? "not-allowed" : "pointer"};opacity:${historyPage <= 1 ? "0.5" : "1"};display:inline-flex;align-items:center;gap:4px;">${icon("chevron-left", 14)} 上一页</button>
      <span style="color:var(--ds-text-2);">第 ${historyPage}/${totalPages} 页</span>
      <button id="aus-history-next-b" ${historyPage >= totalPages ? "disabled" : ""} style="padding:4px 12px;border:1px solid var(--ds-border);border-radius:999px;background:${historyPage >= totalPages ? "var(--ds-card)" : "var(--ds-card-inner)"};color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:${historyPage >= totalPages ? "not-allowed" : "pointer"};opacity:${historyPage >= totalPages ? "0.5" : "1"};display:inline-flex;align-items:center;gap:4px;">下一页 ${icon("chevron-right", 14)}</button>
    </div>` : "";
	host.innerHTML = pagerTop + pageHist.map((h) => {
		const total = h.total_tokens || 1;
		const hp = (h.cache_hit_tokens || 0) / total * 100;
		const mp = (h.cache_miss_tokens || 0) / total * 100;
		const op = (h.completion_tokens || 0) / total * 100;
		const hps = hp.toFixed(1), mps = mp.toFixed(1), ops = op.toFixed(1);
		const fmtMoney = (v, d = 4) => {
			try {
				return formatMoney(v || 0, d);
			} catch {
				return "¥" + (v || 0).toFixed(d) + " CNY";
			}
		};
		const c4 = fmtMoney(h.cost || 0, 4);
		const c6 = fmtMoney(h.cost || 0, 6);
		const in6 = fmtMoney(h.input_cost || 0, 6);
		const out6 = fmtMoney(h.output_cost || 0, 6);
		const isAgentRecord = String(h.origin || "") === "agent";
		const agentTurnCount = Number(h.agentModelTurns) || 0;
		const agentStatusKey = String(h.agentStatus || "");
		const originTitle = isAgentRecord ? [
			"Agent 模式",
			agentTurnCount > 0 ? agentTurnCount + " 个模型回合" : "",
			{
				completed: "已完成",
				partial_success: "部分完成",
				cancelled: "已取消",
				failed: "失败"
			}[agentStatusKey] || ""
		].filter(Boolean).join(" · ") : "常规对话";
		const originBadge = isAgentRecord ? `<span class="aus-origin-badge" title="${esc(originTitle)}" style="flex-shrink:0;display:inline-block;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600;line-height:16px;background:var(--ds-green-bg);color:var(--ds-green);">Agent</span>` : `<span class="aus-origin-badge" title="${esc(originTitle)}" style="flex-shrink:0;display:inline-block;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600;line-height:16px;background:var(--ds-card-inner);color:var(--ds-text-3);">常规</span>`;
		const recordDate = new Date(h.timestamp);
		const recordDateText = recordDate.toLocaleDateString("zh-CN");
		const recordTimeText = recordDate.toLocaleTimeString("zh-CN", { hour12: false });
		return `
    <div style="padding:10px 12px;background:var(--ds-card);border-radius:10px;margin-bottom:8px;font-size:var(--aus-fs-base);">
      <div class="aus-history-card-head" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="aus-history-card-main" style="min-width:0;flex:1;">
          <div class="aus-history-card-title" style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--ds-text);white-space:nowrap;overflow:hidden;">${originBadge}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(h.model)} · ${esc(localTimeHM(h.timestamp))}</span></div>
          <div style="color:var(--ds-text-2);margin-top:2px;">${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${(h.tokenRate || 0) > 0 ? h.tokenRate + " t/s" : "未测速"}</div>
        </div>
        <div class="aus-history-card-actions" style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;gap:6px;align-items:center;">
          <div class="aus-history-card-cost">
            <div style="font-weight:700;color:var(--ds-text);">${c4}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="aus-compare-old" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">旧</button>
            <button class="aus-compare-new" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">新</button>
            <button class="aus-detail-toggle" data-ts="${h.timestamp}" data-model="${esc(h.model || "")}" data-time="${esc(recordDateText + " " + recordTimeText)}" style="padding:4px 8px;border:1px solid var(--ds-black);border-radius:6px;background:var(--ds-black);color:var(--ds-black-text);font-size:var(--aus-fs-sm);cursor:pointer;">详情</button>
          </div>
        </div>
      </div>
      <div style="background:var(--ds-border);border-radius:999px;height:6px;overflow:hidden;margin-top:8px;display:flex;">
        <div style="background:var(--aus-token-hit);width:${hp}%;height:100%;"></div>
        <div style="background:var(--aus-token-miss);width:${mp}%;height:100%;"></div>
        <div style="background:var(--aus-token-output);width:${op}%;height:100%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:var(--aus-fs-sm);margin-top:4px;">
        <div style="display:flex;gap:10px;align-items:center;color:var(--ds-text-2);">
          <span style="display:inline-flex;align-items:center;gap:4px;"><span class="aus-token-dot" style="background:var(--aus-token-hit);"></span><b style="color:var(--ds-text);font-weight:600;">${hps}%</b> 命中</span>
          <span style="display:inline-flex;align-items:center;gap:4px;"><span class="aus-token-dot" style="background:var(--aus-token-miss);"></span><b style="color:var(--ds-text);font-weight:600;">${mps}%</b> 未命中</span>
          <span style="display:inline-flex;align-items:center;gap:4px;"><span class="aus-token-dot" style="background:var(--aus-token-output);"></span><b style="color:var(--ds-text);font-weight:600;">${ops}%</b> 输出</span>
        </div>
        <span style="color:var(--ds-text-2);">${total.toLocaleString()}t</span>
      </div>
      <div class="aus-detail-panel" data-detail="${h.timestamp}" style="display:none;margin-top:8px;border-top:1px solid var(--ds-border);padding-top:8px;max-height:min(520px,60vh);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;flex-direction:column;gap:8px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">基础信息</div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">模型</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;word-break:break-all;">${esc(h.model || "—")}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">时段</div><div style="font-weight:600;margin-top:2px;color:var(--ds-text);">${h.priceType === "new-peak" || h.priceType === "wallet-peak" ? "高峰" : h.priceType === "new-offpeak" || h.priceType === "wallet-offpeak" ? "非高峰" : h.priceType === "unpriced" ? "待定价" : "旧价格"}</div></div>
              <div style="min-width:0;"><div style="color:var(--ds-text-2);font-size:10px;">钱包</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;word-break:break-all;">${esc(repository.getWallet(String(h.walletId || ""))?.name || h.endpointLabel || "未归属钱包")}</div></div>
              <div style="min-width:0;"><div style="color:var(--ds-text-2);font-size:10px;">计价来源</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;word-break:break-all;">${h.pricingSource === "wallet" ? "钱包规则" : h.pricingSource === "builtin" ? "DeepSeek 内置" : h.pricingSource === "unpriced" ? "待定价" : h.pricingSource === "legacy-match" ? "旧数据同名价" : h.pricingSource === "legacy" ? "旧全局规则" : "旧记录兜底"}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">日期</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${esc(recordDateText)}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">时间</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${esc(recordTimeText)}</div></div>
            </div>
          </div>
            <div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">性能</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">耗时</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.duration || 0) / 1e3).toFixed(1)}s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">首字延迟</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${(h.ttft || 0) > 0 ? ((h.ttft || 0) / 1e3).toFixed(1) + "s" : "—"}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">速率</div><div style="font-weight:600;margin-top:2px;color:${(h.tokenRate || 0) > 0 ? "var(--ds-green)" : "var(--ds-text-3)"};">${(h.tokenRate || 0) > 0 ? h.tokenRate + " t/s" : h.streamed === false ? "非流式" : "—"}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">思维链耗时</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${(h.thinkTime || 0) > 0 ? ((h.thinkTime || 0) / 1e3).toFixed(1) + "s" : "—"}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">思维链占比</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${(() => {
			const comp = h.completion_tokens || 0, th = h.thinkTokens || 0;
			if (!comp || !th) return "—";
			return (th / comp * 100).toFixed(1) + "%";
		})()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">是否截断</div><div style="font-weight:600;margin-top:2px;color:${isTruncatedFinish(h.finishReason) || h.isTruncated ? "var(--ds-red)" : "var(--ds-text)"};">${isTruncatedFinish(h.finishReason) || h.isTruncated ? "是 (" + esc(h.finishReason || "length") + ")" : "否"}</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">Token 消耗</div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">缓存命中</div><div style="font-weight:600;color:var(--ds-green);margin-top:2px;">${(h.cache_hit_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">缓存未命中</div><div style="font-weight:600;color:var(--ds-red);margin-top:2px;">${(h.cache_miss_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">输出 Token</div><div style="font-weight:600;color:var(--ds-purple);margin-top:2px;">${(h.completion_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">总 Token</div><div style="font-weight:700;color:var(--ds-text);margin-top:2px;">${(h.total_tokens || 0).toLocaleString()}</div></div>
              <div style="grid-column:1/-1;"><div style="color:var(--ds-text-2);font-size:10px;">思维链 Token</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${h.thinkTokens || 0}</div></div>
            </div>
          </div>
          <div style="background:var(--ds-card-inner);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">费用明细</div>
            <div style="display:grid;gap:6px;margin-top:6px;font-size:11px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输入费用</span><span style="font-weight:600;color:var(--ds-text);">${in6}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输出费用</span><span style="font-weight:600;color:var(--ds-text);">${out6}</span></div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid var(--ds-card);padding-top:6px;margin-top:2px;"><span style="color:var(--ds-text);font-weight:600;">总费用</span><span style="font-weight:700;color:var(--ds-text);">${c6}</span></div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="aus-tab-btn" data-tab="req" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:11px;cursor:pointer;">请求参数 (Request Body)</button>
          <button class="aus-tab-btn" data-tab="res" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">API 完整响应 (Full Response)</button>
          <button class="aus-tab-btn" data-tab="raw" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">原始 Token 用量 (Raw Usage)</button>
          <button class="aus-tab-btn" data-tab="msg" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">消息内容 (Messages)</button>
        </div>
        <pre class="aus-tab-content" data-content="req-${h.timestamp}" style="flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(h.fullRequest ? JSON.stringify(h.fullRequest, null, 2) : h.raw_usage ? JSON.stringify(h.raw_usage, null, 2) : "（原文已清理，仅保留统计）")}</pre>
        <div class="aus-tab-content" data-content="res-${h.timestamp}" style="display:none;margin-top:2px;">
          <pre style="margin:0;min-height:160px;max-height:360px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(prettyFullResponse(h.fullResponse))}</pre>
          ${h.fullResponse ? `<div style="display:flex;justify-content:flex-end;margin-top:6px;"><button class="aus-res-raw-btn" data-ts="${h.timestamp}" style="padding:4px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">查看原始完整数据</button></div><pre class="aus-res-raw" data-ts="${h.timestamp}" style="display:none;margin:6px 0 0;max-height:360px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(typeof h.fullResponse === "string" ? h.fullResponse : JSON.stringify(h.fullResponse, null, 2))}</pre>` : ""}
        </div>
        <pre class="aus-tab-content" data-content="raw-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(JSON.stringify(h.raw_usage || {}, null, 2))}</pre>
        <pre class="aus-tab-content" data-content="msg-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(h.messages && h.messages.length ? JSON.stringify(h.messages, null, 2) : "（原文已清理——仅最近 5 条保留，其余仅统计可用）")}</pre>
      </div>
    </div>
  `;
	}).join("") + pagerBottom;
	const bindPager = (id) => {
		const b = doc.getElementById(id);
		if (!b) return;
		b.onclick = () => {
			const totalPages = Math.max(1, Math.ceil(fullHist.length / HISTORY_PAGE_SIZE));
			const nextPage = historyPage + (id.includes("prev") ? -1 : 1);
			if (nextPage < 1 || nextPage > totalPages) return;
			historyPage = nextPage;
			keepMainScrollPosition(doc, () => renderHistoryInner(doc, fullHist));
		};
	};
	bindPager("aus-history-prev");
	bindPager("aus-history-next");
	bindPager("aus-history-prev-b");
	bindPager("aus-history-next-b");
	host.querySelectorAll(".aus-detail-toggle").forEach((btn) => {
		btn.addEventListener("click", () => {
			const ts = btn.getAttribute("data-ts");
			if (activeHistoryDetailBtn === btn && activeHistoryDetailPanel) {
				closeHistoryDetail(doc);
				return;
			}
			const panel = host.querySelector(`[data-detail="${ts}"]`);
			if (!panel) return;
			openHistoryDetail(doc, panel, btn);
		});
	});
	host.querySelectorAll(".aus-tab-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const ts = btn.getAttribute("data-ts");
			const tab = btn.getAttribute("data-tab");
			const root = btn.closest(".aus-detail-panel");
			if (!root) return;
			root.querySelectorAll(".aus-tab-btn").forEach((b) => {
				b.style.background = "var(--ds-card-inner)";
				b.style.color = "var(--ds-text)";
				b.style.borderColor = "var(--ds-border)";
			});
			btn.style.background = "var(--ds-black)";
			btn.style.color = "var(--ds-black-text)";
			btn.style.borderColor = "var(--ds-black)";
			root.querySelectorAll(".aus-tab-content").forEach((c) => {
				c.style.display = "none";
			});
			const target = root.querySelector(`[data-content="${tab}-${ts}"]`);
			if (target) target.style.display = "block";
		});
	});
	host.querySelectorAll(".aus-res-raw-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const ts = btn.getAttribute("data-ts");
			const pre = btn.closest(".aus-detail-panel")?.querySelector(`.aus-res-raw[data-ts="${ts}"]`);
			if (!pre) return;
			const show = pre.style.display === "none";
			pre.style.display = show ? "block" : "none";
			btn.textContent = show ? "隐藏原始完整数据" : "查看原始完整数据";
		});
	});
	if (reopenDetailTs) {
		const panel = host.querySelector(`[data-detail="${reopenDetailTs}"]`);
		const btn = host.querySelector(`.aus-detail-toggle[data-ts="${reopenDetailTs}"]`);
		if (panel && btn) openHistoryDetail(doc, panel, btn);
	}
}
function renderHistory(doc, s) {
	const host = doc.getElementById("aus-history");
	if (!host) return;
	let hist = s.history || [];
	let scope = "all";
	try {
		scope = state$2.settings.historyScope || "all";
		if (scope === "current") hist = getHistoryForDisplay();
	} catch {}
	if (!hist.length) {
		historyPage = 1;
		historyFullCache = null;
		historyCacheScope = "";
		host.innerHTML = scope === "current" ? "<div style=\"text-align:center;padding:16px;color:var(--ds-text-3);font-size:var(--aus-fs-base);line-height:1.8;\">当前对话暂无记录<br/><span style=\"font-size:var(--aus-fs-sm);\">已按“当前对话”过滤，旧记录（未关联对话）仅在“全部历史”中可见</span><br/><button id=\"aus-history-scope-switch\" style=\"margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:var(--aus-fs-sm);cursor:pointer;\">切换为全部历史</button></div>" : "<div style=\"text-align:center;padding:16px;color:var(--ds-text-3);font-size:var(--aus-fs-base);\">暂无历史记录</div>";
		const btn = doc.getElementById("aus-history-scope-switch");
		if (btn) btn.onclick = () => {
			state$2.settings.historyScope = "all";
			try {
				saveHot({ settings: state$2.settings });
			} catch {}
			historyPage = 1;
			try {
				refreshUI();
			} catch {}
		};
		return;
	}
	let curChatId = null;
	try {
		curChatId = globalThis.SillyTavern?.getContext?.()?.getCurrentChatId?.() || globalThis.SillyTavern?.getContext?.().getCurrentChatId?.call?.(null) || null;
	} catch {}
	try {
		if (!curChatId) curChatId = globalThis.SillyTavern?.getContext?.().getCurrentChatId?.() || null;
	} catch {}
	const scopeKey = scope === "current" ? `current:${curChatId || ""}` : "all";
	if (historyCacheScope !== scopeKey) {
		historyPage = 1;
		historyCacheScope = scopeKey;
		historyFullCache = null;
	}
	let fullForRender = hist;
	if (historyFullCache && historyFullCache.length > hist.length) fullForRender = historyFullCache;
	renderHistoryFilters(fullForRender);
	renderHistoryInner(doc, filteredHistoryForDisplay(fullForRender));
	if (historyLoading) return;
	if (!(hist.length >= HISTORY_PAGE_SIZE || historyFullCache !== null || fullForRender.length >= HISTORY_PAGE_SIZE) && hist.length < HISTORY_PAGE_SIZE) return;
	historyLoading = true;
	(async () => {
		try {
			const mod = await import("./persistence-CaWdvByH.js").then((n) => n.l);
			if (!mod.getAllHistory) return;
			const all = await mod.getAllHistory();
			if (!all || !all.length) return;
			let full = all;
			try {
				if (scope === "current" && curChatId) full = all.filter((h) => h.chatId === curChatId);
			} catch {}
			if (full.length <= hist.length) return;
			historyFullCache = full;
			keepMainScrollPosition(doc, () => {
				renderHistoryFilters(full);
				renderHistoryInner(doc, filteredHistoryForDisplay(full));
			});
		} catch {} finally {
			historyLoading = false;
		}
	})();
}
function syncTopbarState(doc) {
	try {
		const main = doc.getElementById("aus-main");
		if (!main) return;
		const on = main.scrollTop > 4 ? "1" : "0";
		for (const id of ["aus-page-header", "aus-mobile-header"]) {
			const bar = doc.getElementById(id);
			if (bar && bar.getAttribute("data-scrolled") !== on) bar.setAttribute("data-scrolled", on);
		}
	} catch {}
}
function bindTopbarScroll(doc) {
	try {
		const main = doc.getElementById("aus-main");
		if (!main || main.getAttribute("data-topbar-bound") === "1") return;
		main.setAttribute("data-topbar-bound", "1");
		let raf = 0;
		main.addEventListener("scroll", () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				syncTopbarState(doc);
			});
		}, { passive: true });
		syncTopbarState(doc);
	} catch {}
}
function bindPressFeedback(doc) {
	try {
		doc.querySelectorAll("#aus-hamburger-btn, #aus-mobile-back, #aus-bottom-nav .aus-bottom-item, #aus-settings-entries .aus-settings-entry").forEach((el) => {
			const node = el;
			if (node.getAttribute("data-press-bound") === "1") return;
			node.setAttribute("data-press-bound", "1");
			const press = (on) => {
				if (on) node.setAttribute("data-pressed", "1");
				else node.removeAttribute("data-pressed");
			};
			node.addEventListener("pointerdown", () => press(true), { passive: true });
			node.addEventListener("pointerup", () => press(false), { passive: true });
			node.addEventListener("pointercancel", () => press(false), { passive: true });
			node.addEventListener("pointerleave", () => press(false), { passive: true });
			node.addEventListener("click", () => press(false));
			node.addEventListener("blur", () => press(false));
		});
	} catch {}
}
/**
* 最近一次由 pointerup 接管处理的底栏点按时间戳。
* 触屏上 click 有两个坑：滑动惯性期间浏览器把这一下点按当成「停止滚动」不再派发 click；
* 手指在按下与抬起之间挪动几个像素，click 也会落到共同祖先上而不再命中 tab。
* 因此底栏改为在 pointerup 里按「位移 + 时长」判定点按并直接切页，click 只作为键盘/读屏兜底。
*/
var lastBottomTapAt = 0;
/**
* 底栏指示胶囊最近一次落位的 x / y（syncBottomNav 写入）。
* 拖动起点直接从这两个数换算，不去解析 transform 字符串，省掉一个易碎的解析步骤。
*/
var bottomPillX = 0;
var bottomPillY = 0;
/**
* 底栏点按 + 拖动选中胶囊接管（幂等）：整条底栏只绑一次，用事件委托覆盖内部所有 tab。
* - 点按：pointerup 里按「位移 + 时长」判定后直接切页，click 只作键盘/读屏兜底；
* - 拖动：按住选中灰底横向拖动，胶囊跟手移动并预览落点，松手用弹性曲线归位并切到最近的 tab
*   （纵向为主的滑动不接管，仍然交给页面滚动）。
*/
function bindBottomNavTap(doc) {
	try {
		const bar = doc.getElementById("aus-bottom-nav");
		if (!bar || bar.getAttribute("data-tap-bound") === "1") return;
		bar.setAttribute("data-tap-bound", "1");
		const TAP_SLOP = 12;
		const TAP_MAX_MS = 800;
		const DRAG_LOCK = 6;
		let item = null;
		let startX = 0;
		let startY = 0;
		let startAt = 0;
		let moved = false;
		let pointerId = null;
		let onPill = false;
		let pill = null;
		let pillW = BOTTOM_PILL_W;
		let trackW = 0;
		let baseX = 0;
		let slots = [];
		let dropEl = null;
		let snapTimer = null;
		const reset = () => {
			item = null;
			moved = false;
			pointerId = null;
			onPill = false;
		};
		/** 量一遍底栏与每个 tab 的中心：只在拖动开始与尺寸变化时做，拖动过程中不再触发布局 */
		const measure = () => {
			const barRect = bar.getBoundingClientRect();
			trackW = barRect.width;
			slots = [];
			bar.querySelectorAll("[data-bottom-nav]").forEach((el) => {
				const node = el;
				const r = node.getBoundingClientRect();
				slots.push({
					el: node,
					cx: r.left - barRect.left + r.width / 2
				});
			});
			return !!(trackW && slots.length);
		};
		/** 落点预览：只给非当前 tab 打标记（当前 tab 本身就是选中态，不必再高亮） */
		const paintDrop = (next) => {
			if (dropEl === next) return;
			const prev = dropEl;
			if (prev) prev.removeAttribute("data-pill-target");
			dropEl = next;
			const cur = dropEl;
			if (cur && !cur.classList.contains("active")) cur.setAttribute("data-pill-target", "1");
		};
		/**
		* 按下点是否落在选中胶囊上。胶囊自身是 pointer-events:none（好让点击穿透到 tab），
		* 所以只能按几何位置判断；留 4px 容差，手指按在边缘也能抓住。拿不到尺寸时判 false。
		*/
		const hitPill = (x, y) => {
			const ind = doc.getElementById("aus-bottom-indicator");
			if (!ind) return false;
			const r = ind.getBoundingClientRect();
			if (!r.width || !r.height) return false;
			const pad = 4;
			return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
		};
		/** 胶囊 x 夹在底栏内，避免拖出边界 */
		const clampX = (x) => Math.max(0, Math.min(Math.max(0, trackW - pillW), x));
		const startDrag = (id) => {
			if (!bottomNavActive(doc)) return false;
			pill = doc.getElementById("aus-bottom-indicator");
			if (!pill || !measure()) {
				pill = null;
				return false;
			}
			pillW = pill.offsetWidth || BOTTOM_PILL_W;
			baseX = bottomPillX;
			if (snapTimer) {
				clearTimeout(snapTimer);
				snapTimer = null;
			}
			pill.classList.remove("is-snapping");
			pill.classList.add("is-dragging");
			try {
				if (bar.setPointerCapture) bar.setPointerCapture(id);
			} catch {}
			return true;
		};
		const moveDrag = (clientX) => {
			if (!pill) return;
			const x = clampX(baseX + (clientX - startX));
			pill.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(bottomPillY) + "px,0) scale(1.06)";
			const center = x + pillW / 2;
			let best = null;
			let bestGap = Infinity;
			for (const slot of slots) {
				const gap = Math.abs(slot.cx - center);
				if (gap < bestGap) {
					bestGap = gap;
					best = slot.el;
				}
			}
			paintDrop(best);
		};
		const endDrag = (commit) => {
			const p = pill;
			const target = dropEl;
			pill = null;
			paintDrop(null);
			if (pointerId !== null) try {
				if (bar.releasePointerCapture) bar.releasePointerCapture(pointerId);
			} catch {}
			if (!p) return;
			p.classList.remove("is-dragging");
			const slot = target ? slots.find((s) => s.el === target) : void 0;
			const x = clampX(slot ? slot.cx - pillW / 2 : baseX);
			p.classList.add("is-snapping");
			p.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(bottomPillY) + "px,0)";
			bottomPillX = Math.round(x);
			if (snapTimer) clearTimeout(snapTimer);
			snapTimer = setTimeout(() => {
				snapTimer = null;
				try {
					p.classList.remove("is-snapping");
				} catch {}
			}, 460);
			lastBottomTapAt = Date.now();
			if (!commit || !slot) return;
			const v = slot.el.getAttribute("data-bottom-nav");
			if (v && !slot.el.classList.contains("active")) handleBottomTabTap(v);
		};
		bar.addEventListener("pointerdown", (e) => {
			if (e.pointerType === "mouse" && e.button !== 0) {
				reset();
				return;
			}
			const target = e.target;
			const hit = target && target.closest ? target.closest(".aus-bottom-item") : null;
			if (!hit) {
				reset();
				return;
			}
			item = hit;
			startX = e.clientX;
			startY = e.clientY;
			startAt = Date.now();
			moved = false;
			onPill = hitPill(e.clientX, e.clientY);
			pointerId = typeof e.pointerId === "number" ? e.pointerId : null;
		}, { passive: true });
		bar.addEventListener("pointermove", (e) => {
			if (!item) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved = true;
			if (!pill) {
				if (!onPill) return;
				if (!(Math.abs(dx) > DRAG_LOCK && Math.abs(dx) > Math.abs(dy))) return;
				if (!startDrag(pointerId === null ? 0 : pointerId)) return;
			}
			moveDrag(e.clientX);
		}, { passive: true });
		bar.addEventListener("pointercancel", () => {
			if (pill) endDrag(false);
			reset();
		}, { passive: true });
		bar.addEventListener("pointerup", () => {
			if (pill) {
				endDrag(true);
				reset();
				return;
			}
			const hit = item;
			const wasMoved = moved;
			const elapsed = Date.now() - startAt;
			reset();
			if (!hit || wasMoved || elapsed > TAP_MAX_MS) return;
			lastBottomTapAt = Date.now();
			const v = hit.getAttribute("data-bottom-nav");
			if (v) handleBottomTabTap(v);
		}, { passive: true });
	} catch {}
}
function bindPanel(doc) {
	const q = doc.getElementById("aus-btn-query-balance");
	if (q) q.onclick = () => queryBalance();
	try {
		initPillState(doc);
	} catch {}
	bindTopbarScroll(doc);
	bindPressFeedback(doc);
	bindBottomNavTap(doc);
}
/** 「移动端兼容 UI」关闭时窄屏回到改造前的侧栏抽屉（含汉堡按钮与遮罩） */
var mobileOpen = false;
/** 由 createPanel 注入：切换「移动端兼容 UI」后立即按新布局重排导航 */
var applyMobileNavModeImpl = null;
/** 移动端兼容 UI 开关：true（默认）窄屏用底栏；false 回到改造前的侧栏抽屉 */
function mobileNavMode() {
	try {
		return state$2.settings.mobileCompatUi === false ? "sidebar" : "bottom";
	} catch {
		return "bottom";
	}
}
/** 窄屏且开启底栏布局时才走底栏语义（指示胶囊 / 返回箭头 / 重复点 tab / 入场动画） */
function bottomNavActive(doc) {
	return isNarrowPanel(doc) && mobileNavMode() === "bottom";
}
/** 设置页开关调用：把当前选择写到 #aus-panel[data-mobile-nav] 并重排导航，无需刷新页面 */
function applyMobileNavMode() {
	try {
		applyMobileNavModeImpl?.();
	} catch {}
}
/**
* 面板当前是否按窄屏（底栏）布局渲染。
* 用 #aus-panel-body 的实际宽度判定；面板未显示（clientWidth 为 0）时回退到窗口宽度。
*/
function isNarrowPanel(doc) {
	try {
		const body = (doc || getDoc$1()).getElementById("aus-panel-body");
		if (body && body.clientWidth > 0) return body.clientWidth <= 760;
		return (window.parent?.innerWidth ?? window.innerWidth) <= 760;
	} catch {
		return true;
	}
}
function prefersReducedMotion() {
	try {
		return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
	} catch {
		return false;
	}
}
/**
* 页面切换入场动画（桌面与窄屏共用，观感对齐遥测看板的 pageIn）。
* 移除 class + 强制一次回流，保证连续切换（哪怕切回同一页）都能重新播放。
* prefers-reduced-motion 由 style.css 的 `animation:none` 兜底，这里不做判断。
*/
function playViewEnter(el) {
	if (!el) return;
	try {
		el.classList.remove("aus-view-in");
		el.offsetWidth;
		el.classList.add("aus-view-in");
	} catch {}
}
/**
* 底栏指示胶囊的兜底尺寸：实际以 #aus-bottom-indicator 量到的 offsetWidth/Height 为准
* （极短横屏会把胶囊压小），量不到时才回退这两个值，改动须与 style.css 同步。
*/
var BOTTOM_PILL_W = 64;
var BOTTOM_PILL_H = 48;
/**
* 底栏布局下「先让胶囊起跑、再渲染目标页」。
* 切换距离远时（概览 ↔ 设置）目标页要新建几十毫秒的 DOM，若和写 transform 落在同一个任务里，
* 浏览器必须等这轮任务结束才做首次绘制——手感就是「点了先愣一下、胶囊才滑出去」，滑动途中还会被主线程抢帧。
* 做法：第一帧只强制一次样式计算让过渡真正起跑（此时胶囊已是独立合成层，见 style.css 的 will-change），
* 第二帧再渲染内容，只晚约 16ms，肉眼不可见。
*/
function renderAfterPillStart(doc, run) {
	const ind = doc.getElementById("aus-bottom-indicator");
	let done = false;
	const fire = () => {
		if (done) return;
		done = true;
		try {
			run();
		} catch {}
	};
	const raf = typeof requestAnimationFrame === "function" ? (fn) => {
		requestAnimationFrame(fn);
	} : (fn) => {
		setTimeout(fn, 16);
	};
	raf(() => {
		try {
			if (ind) ind.getBoundingClientRect();
		} catch {}
		raf(fire);
	});
	setTimeout(fire, 120);
}
/**
* 底栏指示胶囊跟随当前 tab（切换动画的核心）。
* 首次定位关掉过渡，避免面板一打开胶囊就从最左侧"飞过来"。
*/
function syncBottomNav(doc, animate) {
	try {
		const bar = doc.getElementById("aus-bottom-nav");
		if (!bar) return;
		let activeEl = null;
		bar.querySelectorAll("[data-bottom-nav]").forEach((el) => {
			const on = el.getAttribute("data-bottom-nav") === currentNavKey;
			el.classList.toggle("active", on);
			if (on) activeEl = el;
		});
		const ind = doc.getElementById("aus-bottom-indicator");
		if (!ind) return;
		const target = activeEl;
		if (!target) {
			ind.style.opacity = "0";
			return;
		}
		if (!target.offsetWidth) {
			ind.style.opacity = "0";
			return;
		}
		ind.style.opacity = "1";
		const barRect = bar.getBoundingClientRect();
		const itemRect = target.getBoundingClientRect();
		if (!barRect.height || !itemRect.width) {
			ind.style.opacity = "0";
			return;
		}
		const pillW = ind.offsetWidth || BOTTOM_PILL_W;
		const pillH = ind.offsetHeight || BOTTOM_PILL_H;
		const x = Math.round(itemRect.left - barRect.left + itemRect.width / 2 - pillW / 2);
		const y = Math.round(itemRect.top - barRect.top + itemRect.height / 2 - pillH / 2);
		bottomPillX = x;
		bottomPillY = y;
		const first = bar.getAttribute("data-ready") !== "1";
		const next = "translate3d(" + x + "px," + y + "px,0)";
		if (!animate || first) {
			const prev = ind.style.transition;
			ind.style.transition = "none";
			ind.style.transform = next;
			ind.offsetWidth;
			ind.style.transition = prev;
			bar.setAttribute("data-ready", "1");
		} else ind.style.transform = next;
	} catch {}
}
/**
* 侧栏 / 底栏高亮 + 二级页返回箭头显隐：切页与窗口尺寸变化共用。
* bottom=true 表示当前是底栏布局（窄屏 + 移动端兼容 UI 开启）：二级页的高亮归到「设置」并显示返回箭头；
* bottom=false 是桌面侧栏或「移动端兼容 UI」关闭后的原侧栏抽屉，直接按当前视图高亮，也没有返回箭头。
*/
function paintNavState(doc, bottom, animate) {
	const navSource = currentView === "chat-manage" ? chatManageOrigin : currentView;
	currentNavKey = bottom || !isSettingsChild(currentView) ? parentTabOf(navSource) : navSource;
	try {
		doc.querySelectorAll("#aus-sidebar [data-nav]").forEach((el) => {
			const v = el.getAttribute("data-nav");
			el.classList.toggle("active", v === currentNavKey);
		});
	} catch {}
	if (bottom) syncBottomNav(doc, animate);
	const backBtn = doc.getElementById("aus-mobile-back");
	if (backBtn) backBtn.style.display = bottom && isChildView(currentView) ? "flex" : "none";
}
/**
* 底栏 tab 点击语义：
* - 桌面端（底栏不显示）直接切页；
* - 窄屏换 tab → 切页（回到「设置」时恢复上次的二级页）；
* - 窄屏重复点当前 tab → 二级页回根页，已在根页则回到顶部。
*/
function handleBottomTabTap(target) {
	const doc = getDoc$1();
	if (!bottomNavActive(doc)) {
		switchView(target);
		return;
	}
	const action = resolveTabTap(target, currentView, isChildView(currentView));
	if (action === "switch") {
		switchView(target === "settings" && settingsChildView ? settingsChildView : target);
		return;
	}
	if (action === "pop-root") {
		switchView(returnFromChild());
		return;
	}
	try {
		const main = doc.getElementById("aus-main");
		if (main) main.scrollTo({
			top: 0,
			behavior: prefersReducedMotion() ? "auto" : "smooth"
		});
		const contentBody = doc.getElementById("aus-content-body");
		if (contentBody) contentBody.scrollTop = 0;
	} catch {}
}
/**
* 侧栏抽屉显隐（仅「移动端兼容 UI」关闭时的窄屏：原侧栏抽屉 + 汉堡 + 遮罩，与改造前实现一致）。
* 滑动/淡入淡出动画全部由 style.css 提供，这里只管 class 与遮罩可点性。
*/
function syncMobileSidebar(doc) {
	try {
		const sb = doc.getElementById("aus-sidebar");
		if (!sb) return;
		const ov = doc.getElementById("aus-sidebar-overlay");
		if (isNarrowPanel(doc) && mobileNavMode() === "sidebar") {
			sb.classList.toggle("is-open", mobileOpen);
			if (ov) {
				ov.classList.toggle("is-open", mobileOpen);
				ov.style.display = "";
				ov.onclick = mobileOpen ? () => {
					mobileOpen = false;
					syncMobileSidebar(doc);
				} : null;
			}
			const brand = doc.getElementById("aus-brand");
			if (brand) brand.style.removeProperty("display");
			doc.querySelectorAll("#aus-sidebar .aus-nav-label").forEach((el) => {
				el.style.removeProperty("display");
			});
			doc.querySelectorAll("#aus-sidebar .aus-nav-item").forEach((el) => {
				const c = el;
				c.style.removeProperty("justify-content");
				c.style.removeProperty("padding");
			});
			sb.style.removeProperty("width");
			sb.style.removeProperty("min-width");
			sb.style.removeProperty("max-width");
		} else {
			sb.classList.remove("is-open");
			if (ov) {
				ov.classList.remove("is-open");
				ov.style.display = "none";
				ov.onclick = null;
			}
		}
	} catch {}
}
/** 二级页「返回」目标：对话展示管理回到进入前的来源页，其余回到自己的父级根页 */
function returnFromChild() {
	if (currentView === "chat-manage") return chatManageOrigin;
	return childParentOf(currentView) ?? "settings";
}
/** 进入对话展示管理页并记住来源（概览 / 趋势预测 / 设置三处入口共用） */
function openChatManage(from) {
	chatManageOrigin = from;
	switchView("chat-manage");
}
function switchView(view, opts) {
	const prevView = currentView;
	if (!opts?.back) pushViewTrail(viewTrail, prevView, view);
	currentView = view;
	if (isSettingsChild(view)) settingsChildView = view;
	else if (view === "settings") settingsChildView = null;
	if (prevView === "wallet" && view !== "wallet") try {
		repository.collapseAllWallets();
	} catch {}
	if (opts?.track !== false) try {
		trackPage(view);
	} catch {}
	const doc = getDoc$1();
	const bottom = bottomNavActive(doc);
	if (view !== "history") closeHistoryDetail(doc);
	doc.querySelectorAll("[data-view]").forEach((el) => {
		const on = el.getAttribute("data-view") === view;
		el.style.display = on ? "block" : "none";
		if (on) {
			el.style.transition = "none";
			el.style.opacity = "1";
		}
		if (on && view !== prevView) playViewEnter(el);
	});
	try {
		for (const id of ["aus-main", "aus-content-body"]) {
			const scroller = doc.getElementById(id);
			if (!scroller) continue;
			scroller.scrollTop = 0;
			scroller.scrollLeft = 0;
		}
	} catch {}
	syncTopbarState(doc);
	paintNavState(doc, bottom, bottom);
	const titleText = viewTitle(view);
	const titleEl = doc.getElementById("aus-page-title");
	const mobileTitleEl = doc.getElementById("aus-mobile-page-title");
	if (titleEl) titleEl.textContent = titleText;
	if (mobileTitleEl) mobileTitleEl.textContent = titleText;
	const renderTargetView = () => {
		if (currentView !== view) return;
		try {
			if (view === "overview") renderOverview();
			else if (view === "stats") renderStatsView();
			else if (view === "forecast") Promise.resolve(renderForecastView()).catch(() => {});
			else if (view === "wallet") Promise.resolve(renderWalletView()).catch(() => {});
			else if (view === "history") {
				const s = getSelectedSave();
				if (s) renderHistory(doc, s);
			} else if (view === "chat-manage") Promise.resolve(renderChatManageView()).catch(() => {});
		} catch {}
	};
	const animateIn = view !== prevView;
	if (animateIn && bottom) renderAfterPillStart(doc, renderTargetView);
	else if (animateIn) {
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(renderTargetView);
		else renderTargetView();
	} else renderTargetView();
	if (view === "stats" || view === "forecast") requestAnimationFrame(() => {
		try {
			const chartEl = doc.getElementById(view === "stats" ? "aus-stats-chart" : "aus-forecast-main-chart");
			if (chartEl && (chartEl.clientWidth === 0 || chartEl.clientHeight === 0)) {
				if (view === "stats") renderStatsView();
				else Promise.resolve(renderForecastView()).catch(() => {});
			}
		} catch {}
	});
}
/**
* 移动端浏览器的「浏览器工具栏」不占布局视口：Edge（安卓版把地址栏放底部）/ Chrome 的
* 100vh 与 window.innerHeight 取的是「工具栏收起」的大视口，比真正可见的区域高出一个工具栏，
* 于是面板底栏（position:absolute;bottom:0）正好落在工具栏背后——既看不见也点不到。
* visualViewport.height 才是此刻真正可见的高度，面板按它收一下就能贴住可见底部。
* 双指缩放（scale≠1）时不动，避免面板被反复裁切、内容重排。
*/
function visibleViewportHeight() {
	try {
		const vv = getDoc$1().defaultView?.visualViewport;
		if (!vv || !(vv.height > 0)) return null;
		const scale = typeof vv.scale === "number" ? vv.scale : 1;
		if (Math.abs(scale - 1) > .01) return null;
		return vv.height;
	} catch {
		return null;
	}
}
/** 把 #aus-overlay / #aus-panel 的高度贴到当前可视视口（工具栏显隐、键盘弹出都会变） */
function syncViewportHeight() {
	const doc = getDoc$1();
	const h = visibleViewportHeight();
	const supportsDvh = (() => {
		try {
			return !!(window.CSS && CSS.supports && CSS.supports("height", "100dvh"));
		} catch {
			return false;
		}
	})();
	for (const id of ["aus-overlay", "aus-panel"]) {
		const node = doc.getElementById(id);
		if (!node) continue;
		node.style.height = h == null ? supportsDvh ? "100dvh" : "100vh" : `${Math.round(h)}px`;
	}
}
function positionPanel() {
	try {
		syncViewportHeight();
	} catch {}
	try {
		const doc = getDoc$1();
		for (const id of [
			"aus-stats-chart",
			"aus-chart-token",
			"aus-chart-cost",
			"aus-chart-hit",
			"aus-chart-req",
			"aus-chart-dur",
			"aus-chart-pie",
			"aus-chart-model-token",
			"aus-chart-model-req",
			"aus-forecast-main-chart",
			"aus-forecast-hit-chart",
			"aus-forecast-cost-chart"
		]) {
			const el = doc.getElementById(id);
			if (el && el.__echarts_instance) try {
				el.__echarts_instance.resize();
			} catch {}
		}
	} catch {}
}
function createPanel() {
	if (panelCreated) return;
	const doc = getDoc$1();
	if (doc.getElementById("aus-panel")) {
		panelCreated = true;
		return;
	}
	panelCreated = true;
	const theme = state$2.settings.theme || "light";
	const overlay = doc.createElement("div");
	overlay.id = "aus-overlay";
	overlay.setAttribute("data-extension", "api-usage-stat");
	overlay.setAttribute("data-ds-theme", theme);
	overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;background:var(--ds-overlay);z-index:100000;display:none;opacity:0;transition:opacity 0.2s;";
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) closePanel();
	});
	const panel = doc.createElement("div");
	panel.id = "aus-panel";
	panel.setAttribute("data-extension", "api-usage-stat");
	panel.setAttribute("data-ds-theme", theme);
	panel.setAttribute("data-mobile-nav", mobileNavMode());
	panel.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:100001;background:var(--ds-panel-bg);color:var(--ds-text);font-family:'Microsoft YaHei','微软雅黑',system-ui,-apple-system,sans-serif;display:none;flex-direction:column;overflow:hidden;transform:none;filter:none;will-change:auto;";
	panel.innerHTML = `
    <div id="aus-mobile-header" style="display:none;height:56px;align-items:center;padding:0 16px;flex-shrink:0;">
      <button id="aus-hamburger-btn" title="菜单" style="display:none;width:28px;height:28px;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:var(--ds-text);padding:0;flex-shrink:0;">${icon("menu", 22)}</button>
      <button id="aus-mobile-back" title="返回" style="display:none;">${icon("chevron-left", 20)}</button>
      <span id="aus-mobile-brand" style="margin-left:12px;font-size:var(--aus-fs-base);font-weight:700;color:var(--ds-text);white-space:nowrap;flex-shrink:0;">API用量统计</span>
      <span id="aus-mobile-page-title" style="margin-left:10px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text-2);">用量概览</span>
      <button id="aus-mobile-panel-close" title="关闭" style="margin-left:auto;width:32px;height:32px;padding:0;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;font-size:var(--aus-fs-base);">${icon("close", 16)}</button>
    </div>
    <div id="aus-panel-body" style="flex:1;display:flex;flex-direction:row;overflow:hidden;min-height:0;">
    <div id="aus-sidebar" style="width:260px;flex-shrink:0;background:var(--ds-sidebar-bg);border-right:1px solid var(--ds-border);display:flex;flex-direction:column;overflow:hidden;">
      <div id="aus-brand-row" style="height:56px;display:flex;align-items:flex-start;justify-content:space-between;padding:0 14px;flex-shrink:0;">
        <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;margin-top:18px;" id="aus-brand">
          <span class="aus-brand-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--ds-orange);">${icon("brand", 18)}</span>
          <div style="display:flex;flex-direction:column;min-width:0;">
            <span style="font-size:15px;font-weight:700;line-height:20px;color:var(--ds-text);white-space:nowrap;">API用量统计</span>
            <span style="font-size:var(--aus-fs-sm);line-height:16px;color:var(--ds-text-2);white-space:nowrap;">v${appVersionText()}</span>
          </div>
        </div>
        <button id="aus-sidebar-toggle" style="width:30px;height:30px;margin-top:13px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;flex-shrink:0;font-size:var(--aus-fs-base);padding:0;line-height:1;">${icon("chevron-left", 14)}</button>
      </div>
      <div style="flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:4px;">
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:4px;">
          <div class="aus-nav-item active" data-nav="overview" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("overview")}</span><span class="aus-nav-label">用量概览</span></div>
          <div class="aus-nav-item" data-nav="stats" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("stats")}</span><span class="aus-nav-label">用量统计</span></div>
          <div class="aus-nav-item" data-nav="history" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("history")}</span><span class="aus-nav-label">历史记录</span></div>
          <div class="aus-nav-item" data-nav="forecast" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("forecast")}</span><span class="aus-nav-label">趋势预测</span></div>
          <div class="aus-nav-item" data-nav="wallet" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("wallet")}</span><span class="aus-nav-label">钱包</span></div>
        </div>
        <div style="flex:1;"></div>
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--ds-border);padding-top:10px;">
          <div class="aus-nav-item" data-nav="settings" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("settings")}</span><span class="aus-nav-label">设置</span></div>
          <div class="aus-nav-item" data-nav="help" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("help")}</span><span class="aus-nav-label">使用说明</span></div>
          <div class="aus-nav-item" data-nav="about" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:var(--aus-fs-base);line-height:1.5;"><span class="aus-nav-icon" style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">${icon("about")}</span><span class="aus-nav-label">关于</span><span id="aus-nav-update-badge" data-update-badge="1" data-on="0" title="检测到新版本，点击查看关于页">新版本</span></div>
        </div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--ds-panel-bg);position:relative;">
      <div id="aus-page-header" style="flex-shrink:0;height:56px;display:flex;align-items:flex-start;justify-content:space-between;padding:0 20px;">
        <span id="aus-page-title" style="font-size:var(--aus-fs-base);font-weight:600;line-height:20px;margin-top:18px;color:var(--ds-text);">用量概览</span>
        <button id="aus-panel-close" style="width:32px;height:32px;margin-top:12px;padding:0;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;line-height:1;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;font-size:var(--aus-fs-base);">${icon("close", 16)}</button>
      </div>
      <div id="aus-content-body" style="flex:1;display:flex;flex-direction:row;overflow:hidden;min-height:0;position:relative;">
      <div id="aus-main" style="flex:1;min-width:0;overflow:auto;padding:20px;background:var(--ds-panel-bg);">
        <div style="max-width:1100px;margin:0 auto;display:grid;gap:16px;">
          <div data-view="overview">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="ds-card aus-overview-balance-card" style="position:relative;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div class="ds-card-title">充值余额</div><div id="aus-overview-wallet-btn" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;"><span style="color:var(--ds-text-2);">余额口径</span><span id="aus-overview-wallet-label" style="font-weight:600;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部钱包合计</span>${icon("chevron-down", 14)}</div><div id="aus-overview-wallet-dropdown" style="display:none;position:absolute;top:44px;right:10px;z-index:20;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:190px;max-height:260px;overflow:auto;"></div></div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div id="aus-balance-remaining" style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);margin-top:6px;min-height:16px;"></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:var(--aus-fs-sm);">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">导出记录</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">导入记录</button></div></div>
              <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.0000<small>CNY</small></div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:2px;" id="aus-total-tokens">0 tokens</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div class="ds-card" id="aus-overview-history"></div>
              <div class="ds-card" id="aus-overview-spend"></div>
            </div>
            <div id="aus-overview-four" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;"></div>
            <div id="aus-heatmap-card-overview" class="ds-card" style="margin-top:12px;width:100%;max-width:100%;overflow:hidden;box-sizing:border-box;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">Token 使用量热力图</div>
                <div id="aus-heatmap-legend-overview" style="display:flex;align-items:center;gap:3px;font-size:var(--aus-fs-sm);color:var(--ds-text-3);"></div>
              </div>
              <div style="display:flex;gap:0;overflow:hidden;max-width:100%;box-sizing:border-box;">
                <div id="aus-heatmap-labels-overview" style="flex-shrink:0;padding:4px 0"></div>
                <div id="aus-heatmap-scroll-overview" style="overflow-x:auto;overflow-y:hidden;flex:1;min-width:0;max-width:100%;padding:4px 0;cursor:grab;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;">
                  <div id="aus-heatmap-container-overview" style="display:inline-block;min-width:max-content;"></div>
                </div>
              </div>
              <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;display:flex;justify-content:space-between;">
                <span>按日聚合 Token（深绿=高用量，展示近 2 年）</span>
                <span style="color:var(--ds-text-2);">悬停查看日期</span>
              </div>
            </div>
            <div id="aus-chat-summary-overview" class="ds-card" style="margin-top:12px;overflow:auto;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">按对话统计</div>
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <span id="aus-chat-manage-count" style="display:none;font-size:var(--aus-fs-xs);color:var(--ds-text-3);white-space:nowrap;"></span>
                  <button id="aus-chat-manage-btn" type="button" class="aus-manage-chat-btn" title="设置哪些对话出现在按对话统计表与各页「对话」下拉中（不影响数据统计）">${icon("menu", 14)}管理对话</button>
                </div>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:var(--aus-fs-sm);white-space:nowrap;min-width:720px;">
                <thead><tr style="color:var(--ds-text-2);border-bottom:1px solid var(--ds-border);text-align:right;"><th style="text-align:left;padding:6px 8px;">对话</th><th data-sort-key="count" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">轮次<span class="aus-sort-ind"></span></th><th data-sort-key="hit" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">命中<span class="aus-sort-ind"></span></th><th data-sort-key="miss" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">未命中<span class="aus-sort-ind"></span></th><th data-sort-key="out" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输出<span class="aus-sort-ind"></span></th><th data-sort-key="total" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总 Tokens<span class="aus-sort-ind"></span></th><th data-sort-key="cost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总费用<span class="aus-sort-ind"></span></th><th data-sort-key="avgTokens" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均 Token/轮<span class="aus-sort-ind"></span></th><th data-sort-key="avgHitRate" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均命中率<span class="aus-sort-ind"></span></th></tr></thead>
                <tbody id="aus-chat-summary-tbody"><tr><td colspan="9" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr></tbody>
              </table>
              <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);margin-top:6px;">默认按总 Tokens 倒序，点击表头可切换排序 · 数据来源为全部历史（不受统计页筛选影响）· 点「管理对话」可隐藏不常看的对话</div>
            </div>
            </div>
           <div data-view="chat-manage" style="display:none;">
             <div id="aus-chat-manage-body"></div>
           </div>
           <div data-view="stats" style="display:none;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:relative;flex-wrap:wrap;">
              <div class="aus-stats-filter">
                <div id="aus-range-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">时间维度</span><span id="aus-range-label" style="font-weight:600;color:var(--ds-text);">近 30 天</span>${icon("chevron-down", 14)}</div>
                <div id="aus-range-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);overflow:hidden;flex-direction:row;">
                  <div style="min-width:120px;border-right:1px solid var(--ds-card);padding:8px;display:grid;gap:2px;">
                    <div data-range="all" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">全部</div>
                    <div data-range="today" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">今天</div>
                    <div data-range="yesterday" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">昨天</div>
                    <div data-range="7d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">近 7 天</div>
                    <div data-range="30d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">近 30 天</div>
                    <div data-range="month" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">本月</div>
                    <div data-range="lastMonth" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">上月</div>
                    <div data-range="custom" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);color:var(--ds-text);">自定义</div>
                  </div>
                  <div id="aus-date-calendar" style="padding:12px;display:none;"></div>
                </div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-model-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">模型</span><span id="aus-model-label" style="font-weight:600;color:var(--ds-text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-model-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-chat-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">对话</span><span id="aus-chat-label" style="font-weight:600;color:var(--ds-text);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-chat-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-endpoint-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">接入类型</span><span id="aus-endpoint-label" style="font-weight:600;color:var(--ds-text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-endpoint-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-credential-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">API 密钥</span><span id="aus-credential-label" style="font-weight:600;color:var(--ds-text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-credential-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div id="aus-stats-filter-reset" class="aus-filter-reset" title="重置筛选" aria-label="重置筛选" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:transparent;color:var(--ds-text-2);font-size:var(--aus-fs-base);cursor:pointer;margin-left:auto;">${icon("refresh", 14)}<span>重置筛选</span></div>
            </div>
            <div id="aus-stats-three" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
              <div class="ds-card"><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">消费金额</div><div id="aus-stats-cost" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">¥0.00 CNY</div></div>
              <div class="ds-card"><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">API 请求次数</div><div id="aus-stats-req" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
              <div class="ds-card"><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">Tokens</div><div id="aus-stats-tok" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
            </div>
            <div id="aus-stats-four" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;"></div>
            <div id="aus-model-summary" class="ds-card" style="margin-top:12px;overflow:auto;">
              <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);margin-bottom:8px;">模型汇总</div>
              <table style="width:100%;border-collapse:collapse;font-size:var(--aus-fs-sm);white-space:nowrap;">
                <thead><tr style="color:var(--ds-text-2);border-bottom:1px solid var(--ds-border);text-align:right;"><th style="text-align:left;padding:6px 8px;">模型</th><th data-sort-key="count" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">调用次数<span class="aus-sort-ind"></span></th><th data-sort-key="hit" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(命中)<span class="aus-sort-ind"></span></th><th data-sort-key="miss" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(未命中)<span class="aus-sort-ind"></span></th><th data-sort-key="out" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输出<span class="aus-sort-ind"></span></th><th data-sort-key="total" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总 Tokens<span class="aus-sort-ind"></span></th><th data-sort-key="cost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgCost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgDur" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均耗时<span class="aus-sort-ind"></span></th><th data-sort-key="avgRate" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均速率<span class="aus-sort-ind"></span></th></tr></thead>
                <tbody id="aus-summary-tbody"><tr><td colspan="10" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr></tbody>
              </table>
            </div>
            <div style="margin-top:12px;">
              ${chartCardHTML({
		title: "自定义图表",
		chartId: "aus-stats-chart",
		height: 300,
		pills: [{
			key: "Y",
			btnId: "aus-chart-y-btn",
			labelId: "aus-chart-y-label",
			dropId: "aus-chart-y-dropdown",
			label: "5 项"
		}, {
			key: "X",
			btnId: "aus-chart-x-btn",
			labelId: "aus-chart-x-label",
			dropId: "aus-chart-x-dropdown",
			label: "轮次"
		}]
	})}
            </div>
            <div id="aus-extra-charts" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;">
              ${chartCardHTML({
		title: "Token 趋势",
		chartId: "aus-chart-token",
		pills: [{
			key: "Y",
			btnId: "aus-extra-y-btn-token",
			labelId: "aus-extra-y-label-token",
			dropId: "aus-extra-y-drop-token",
			label: "3 项"
		}, {
			key: "X",
			btnId: "aus-extra-x-btn-token",
			labelId: "aus-extra-x-label-token",
			dropId: "aus-extra-x-drop-token",
			label: "轮次"
		}]
	})}
              ${chartCardHTML({
		title: "费用 趋势",
		chartId: "aus-chart-cost",
		pills: [{
			key: "Y",
			btnId: "aus-extra-y-btn-cost",
			labelId: "aus-extra-y-label-cost",
			dropId: "aus-extra-y-drop-cost",
			label: "1 项"
		}, {
			key: "X",
			btnId: "aus-extra-x-btn-cost",
			labelId: "aus-extra-x-label-cost",
			dropId: "aus-extra-x-drop-cost",
			label: "轮次"
		}]
	})}
              ${chartCardHTML({
		title: "缓存命中 趋势",
		chartId: "aus-chart-hit",
		pills: [{
			key: "X",
			btnId: "aus-extra-x-btn-hit",
			labelId: "aus-extra-x-label-hit",
			dropId: "aus-extra-x-drop-hit",
			label: "轮次"
		}]
	})}
              ${chartCardHTML({
		title: "API请求数 趋势",
		chartId: "aus-chart-req",
		pills: [{
			key: "X",
			btnId: "aus-extra-x-btn-req",
			labelId: "aus-extra-x-label-req",
			dropId: "aus-extra-x-drop-req",
			label: "每日"
		}]
	})}
              ${chartCardHTML({
		title: "耗时与速率 趋势",
		chartId: "aus-chart-dur",
		pills: [{
			key: "X",
			btnId: "aus-extra-x-btn-dur",
			labelId: "aus-extra-x-label-dur",
			dropId: "aus-extra-x-drop-dur",
			label: "轮次"
		}]
	})}
              ${chartCardHTML({
		title: "模型用量占比",
		chartId: "aus-chart-pie",
		pills: [{
			key: "口径",
			btnId: "aus-pie-toggle",
			labelId: "aus-pie-toggle-val",
			dropId: "",
			label: "Token",
			dropdown: false
		}]
	})}
            </div>
            <div id="aus-model-trends" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;">
              ${chartCardHTML({
		title: "模型 Token 趋势",
		chartId: "aus-chart-model-token",
		pills: [{
			key: "X",
			btnId: "aus-modeltrends-x-btn-token",
			labelId: "aus-modeltrends-x-label-token",
			dropId: "aus-modeltrends-x-drop-token",
			label: "每日"
		}]
	})}
              ${chartCardHTML({
		title: "模型调用次数趋势",
		chartId: "aus-chart-model-req",
		pills: [{
			key: "X",
			btnId: "aus-modeltrends-x-btn-req",
			labelId: "aus-modeltrends-x-label-req",
			dropId: "aus-modeltrends-x-drop-req",
			label: "每日"
		}]
	})}
            </div>
          </div>
          <div data-view="forecast" style="display:none;">
            <div id="aus-forecast-root" class="aus-forecast-root">
              <div class="aus-forecast-toolbar">
                <div class="aus-forecast-toolbar-main">
                  <div class="aus-forecast-picker">
                    <div id="aus-forecast-chat-btn" class="aus-forecast-pill" title="选择要预测的对话">
                      <span class="aus-forecast-pill-label">对话</span><span id="aus-forecast-chat-label" class="aus-forecast-pill-value">当前对话</span>${icon("chevron-down", 14)}
                    </div>
                    <div id="aus-forecast-chat-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                  <div id="aus-forecast-model-wrap" class="aus-forecast-picker" style="display:none;">
                    <div id="aus-forecast-model-btn" class="aus-forecast-pill" title="选择计价模型">
                      <span class="aus-forecast-pill-label">计价模型</span><span id="aus-forecast-model-label" class="aus-forecast-pill-value">—</span>${icon("chevron-down", 14)}
                    </div>
                    <div id="aus-forecast-model-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                  <div class="aus-forecast-picker">
                    <div id="aus-forecast-horizon-btn" class="aus-forecast-pill" title="选择未来预测轮数">
                      <span class="aus-forecast-pill-label">视界</span><span id="aus-forecast-horizon-label" class="aus-forecast-pill-value">10 轮</span>${icon("chevron-down", 14)}
                    </div>
                    <div id="aus-forecast-horizon-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                  <div id="aus-forecast-hit-control" class="aus-forecast-hit-control"></div>
                  <label class="aus-forecast-toggle">
                    <input id="aus-forecast-compaction-toggle" type="checkbox" checked>
                    <span class="aus-forecast-checkbox" aria-hidden="true"></span>
                    <span id="aus-forecast-compaction-label">压缩情景</span>
                  </label>
                  <button id="aus-forecast-chat-manage-btn" type="button" class="aus-manage-chat-btn" title="设置哪些对话出现在「对话」下拉中（不影响数据统计）">${icon("menu", 14)}管理对话</button>
                </div>
                <div id="aus-forecast-sub" class="aus-forecast-sub"></div>
              </div>
              <div id="aus-forecast-kpis" class="aus-forecast-kpis"></div>
              <div class="ds-card aus-forecast-chart-card">
                <div class="aus-forecast-card-head">
                  <div>
                    <div class="aus-forecast-card-title">轮次趋势与预测</div>
                    <div id="aus-forecast-main-sub" class="aus-forecast-card-sub"></div>
                  </div>
                </div>
                <div id="aus-forecast-main-chart" class="aus-forecast-chart" style="height:300px;"></div>
              </div>
              <div class="aus-forecast-chart-grid">
                <div class="ds-card aus-forecast-chart-card">
                  <div class="aus-forecast-card-title">缓存命中率趋势</div>
                  <div id="aus-forecast-hit-chart" class="aus-forecast-chart" style="height:220px;"></div>
                </div>
                <div class="ds-card aus-forecast-chart-card">
                  <div class="aus-forecast-card-title">累计成本趋势</div>
                  <div id="aus-forecast-cost-chart" class="aus-forecast-chart" style="height:220px;"></div>
                </div>
              </div>
              <div class="aus-forecast-two-col">
                <div class="ds-card">
                  <div class="aus-forecast-card-title">对话健康</div>
                  <div id="aus-forecast-health"></div>
                </div>
                <div class="ds-card">
                  <div class="aus-forecast-card-title">上下文压缩</div>
                  <div id="aus-forecast-compaction"></div>
                </div>
              </div>
              <div class="ds-card" id="aus-forecast-efficiency-card">
                <div class="aus-forecast-card-head">
                  <div>
                    <div class="aus-forecast-card-title">模型效率对比</div>
                    <div id="aus-forecast-efficiency-sub" class="aus-forecast-card-sub"></div>
                  </div>
                  <div class="aus-forecast-picker">
                    <div id="aus-forecast-scope-btn" class="aus-forecast-pill">
                      <span class="aus-forecast-pill-label">范围</span><span class="aus-forecast-pill-value">全部历史</span>${icon("chevron-down", 14)}
                    </div>
                    <div id="aus-forecast-scope-dropdown" class="aus-forecast-dropdown"></div>
                  </div>
                </div>
                <div id="aus-forecast-efficiency"></div>
              </div>
              <div class="ds-card">
                <button id="aus-forecast-top-toggle" class="aus-forecast-top-toggle" type="button">▸ 最耗对话 Top</button>
                <div id="aus-forecast-top" style="display:none;"></div>
              </div>
            </div>
          </div>
          <div data-view="wallet" style="display:none;">
            <div id="aus-wallet"></div>
          </div>
          <div data-view="history" style="display:none;">
            <div id="aus-history-filter-host" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:relative;flex-wrap:wrap;">
              <div class="aus-stats-filter">
                <div id="aus-history-model-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">模型</span><span id="aus-history-model-label" style="font-weight:600;color:var(--ds-text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-history-model-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-history-chat-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">对话</span><span id="aus-history-chat-label" style="font-weight:600;color:var(--ds-text);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-history-chat-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-history-endpoint-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">接入类型</span><span id="aus-history-endpoint-label" style="font-weight:600;color:var(--ds-text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-history-endpoint-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div class="aus-stats-filter">
                <div id="aus-history-credential-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-base);cursor:pointer;"><span style="color:var(--ds-text-2);">API 密钥</span><span id="aus-history-credential-label" style="font-weight:600;color:var(--ds-text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">全部</span>${icon("chevron-down", 14)}</div>
                <div id="aus-history-credential-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;max-width:320px;max-height:260px;overflow:auto;padding:8px;"></div>
              </div>
              <div id="aus-history-filter-reset" class="aus-filter-reset" title="重置筛选" aria-label="重置筛选" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:transparent;color:var(--ds-text-2);font-size:var(--aus-fs-base);cursor:pointer;margin-left:auto;">${icon("refresh", 14)}<span>重置筛选</span></div>
            </div>
            <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">全屏</button></div><div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
            <div id="aus-history"></div>
          </div>
          <div data-view="settings" style="display:none;">
            <div id="aus-settings-entries" style="display:none;grid-template-columns:1fr;gap:8px;margin-bottom:12px;">${SETTINGS_ENTRIES.map((e) => {
		const version = e.view === "about" && appVersionText() ? "<span class=\"aus-settings-entry-version\" title=\"当前版本\">v" + appVersionText() + "</span>" : "";
		return `
              <div class="aus-settings-entry" data-settings-entry="${e.view}" role="button" tabindex="0">
                <span class="aus-settings-entry-icon">${icon(e.icon, 20)}</span>
                <span class="aus-settings-entry-text">
                  <span class="aus-settings-entry-label">${e.label}${version}</span>
                  <span class="aus-settings-entry-desc">${e.desc}</span>
                </span>
                ${e.view === "about" ? "<span class=\"aus-entry-badge\" data-update-badge=\"1\" data-on=\"0\">新版本</span>" : ""}
                <span class="aus-settings-entry-arrow">${icon("chevron-right", 16)}</span>
              </div>`;
	}).join("")}
            </div>
            <div id="aus-settings"></div>
          </div>
          <div data-view="help" style="display:none;">${helpViewHTML()}</div>
          <div data-view="about" style="display:none;">
            <div style="display:grid;gap:12px;">
              <div class="ds-card" style="line-height:1.7;font-size:var(--aus-fs-base);color:var(--ds-text);">
                <div style="font-size:var(--aus-fs-base);font-weight:600;">关于<br/>API用量统计</div>
                <div style="margin-top:8px;color:var(--ds-text-2);">致力于实现最全面的用量可视化统计<br/><br/>仓库：<a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:var(--ds-text);">janmk1453/Api-Usage</a></div>
              </div>
              <div class="ds-card" style="display:grid;gap:8px;">
                <div style="font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">检查更新</div>
                <div id="aus-update-banner" style="display:none;padding:8px 10px;border-radius:8px;background:var(--ds-yellow-bg);border:1px solid var(--ds-yellow-border);font-size:var(--aus-fs-sm);color:var(--ds-text);"></div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <div style="position:relative;z-index:5;">
                    <button id="aus-update-branch-btn" class="ds-btn-pill" style="padding:6px 14px;font-size:var(--aus-fs-sm);">更新分支：<span id="aus-update-branch-label">main</span></button>
                    <div id="aus-update-branch-dropdown" style="display:none;position:absolute;top:calc(100% + 6px);left:0;min-width:150px;padding:6px;background:var(--ds-bg);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:60;flex-direction:column;gap:4px;">
                      <div data-update-branch="main" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);">main（稳定）</div>
                      <div data-update-branch="dev" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);">dev（测试）</div>
                    </div>
                  </div>
                  <button id="aus-check-update" class="ds-btn-pill" style="padding:6px 14px;font-size:var(--aus-fs-sm);">检查更新</button>
                  <button id="aus-run-update" class="ds-btn-pill" style="display:none;padding:6px 14px;font-size:var(--aus-fs-sm);">立即更新</button>
                  <span style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">当前 v${appVersionText()} · 每 1 小时自动检查</span>
                </div>
                <div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">可选择 main（稳定）或 dev（测试）分支获取更新，默认 main；更新完成后自动刷新网页。</div>
              </div>
              ${renderChangelogCard()}
            </div>
          </div>
        </div>
      </div>
      <aside id="aus-history-detail" style="display:none;flex-direction:column;width:25%;min-width:300px;max-width:480px;flex-shrink:0;border-left:1px solid var(--ds-border);background:var(--ds-card-inner);overflow:hidden;">
        <div style="flex-shrink:0;height:48px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;border-bottom:1px solid var(--ds-border);">
          <span id="aus-history-detail-title" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--aus-fs-base);font-weight:600;color:var(--ds-text);">记录详情</span>
          <button id="aus-history-detail-close" title="关闭" style="width:28px;height:28px;flex-shrink:0;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card);color:var(--ds-text-2);cursor:pointer;line-height:1;padding:0;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;">${icon("close", 16)}</button>
        </div>
        <div id="aus-history-detail-body" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:12px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;"></div>
      </aside>
    </div>
    </div>
    </div>
    <div id="aus-bottom-nav" style="display:none;">
      <div id="aus-bottom-indicator" aria-hidden="true"></div>
      ${MOBILE_TABS.map((t) => `
        <div class="aus-bottom-item" data-bottom-nav="${t.view}" role="tab" title="${t.label}">
          <span class="aus-bottom-icon">${icon(t.icon, 22)}</span>
          <span class="aus-bottom-label">${t.label}</span>
          ${t.view === "settings" ? "<span class=\"aus-bottom-badge\" data-update-badge=\"1\" data-on=\"0\" title=\"检测到新版本，去「设置 → 关于」查看\">新版本</span>" : ""}
        </div>`).join("")}
    </div>
  `;
	const sbOverlay = doc.createElement("div");
	sbOverlay.id = "aus-sidebar-overlay";
	sbOverlay.style.cssText = "display:none;";
	panel.appendChild(sbOverlay);
	doc.body.appendChild(overlay);
	doc.body.appendChild(panel);
	try {
		import("./update-C0nJ98Sq.js").then((mod) => mod.syncUpdateIndicators?.());
	} catch {}
	try {
		applyTheme(theme);
	} catch {}
	try {
		(window.parent || window).addEventListener("resize", positionPanel, { passive: true });
	} catch {}
	doc.getElementById("aus-panel-close")?.addEventListener("click", closePanel);
	doc.getElementById("aus-mobile-panel-close")?.addEventListener("click", closePanel);
	doc.getElementById("aus-history-detail-close")?.addEventListener("click", () => closeHistoryDetail(doc));
	doc.querySelectorAll("#aus-sidebar [data-nav]").forEach((el) => {
		el.addEventListener("click", () => {
			const v = el.getAttribute("data-nav");
			if (v) switchView(v);
			if (mobileOpen) {
				mobileOpen = false;
				syncMobileSidebar(doc);
			}
		});
	});
	doc.querySelectorAll("#aus-bottom-nav [data-bottom-nav]").forEach((el) => {
		el.addEventListener("click", () => {
			if (Date.now() - lastBottomTapAt < 600) return;
			const v = el.getAttribute("data-bottom-nav");
			if (v) handleBottomTabTap(v);
		});
	});
	doc.querySelectorAll("#aus-settings-entries [data-settings-entry]").forEach((el) => {
		el.addEventListener("click", () => {
			const v = el.getAttribute("data-settings-entry");
			if (v) switchView(v);
		});
		el.addEventListener("keydown", (e) => {
			if (e.key !== "Enter" && e.key !== " ") return;
			e.preventDefault();
			const v = el.getAttribute("data-settings-entry");
			if (v) switchView(v);
		});
	});
	doc.getElementById("aus-mobile-back")?.addEventListener("click", () => switchView(returnFromChild()));
	doc.getElementById("aus-chat-manage-btn")?.addEventListener("click", () => openChatManage("overview"));
	doc.getElementById("aus-forecast-chat-manage-btn")?.addEventListener("click", () => openChatManage("forecast"));
	doc.getElementById("aus-panel")?.addEventListener("click", (e) => {
		if (e.target?.closest?.("#aus-settings-chat-manage")) openChatManage("settings");
	});
	initChatManageView({ go: () => switchView(chatManageOrigin) });
	const applyCollapsed = (v) => {
		collapsed = v;
		const sb = doc.getElementById("aus-sidebar");
		const brand = doc.getElementById("aus-brand");
		const btn = doc.getElementById("aus-sidebar-toggle");
		if (!sb) return;
		if (isNarrowPanel(doc)) {
			if (mobileNavMode() === "sidebar") syncMobileSidebar(doc);
			return;
		}
		sb.setAttribute("data-collapsed", collapsed ? "1" : "0");
		sb.style.setProperty("width", collapsed ? "60px" : "260px", "important");
		sb.style.setProperty("min-width", collapsed ? "60px" : "260px", "important");
		sb.style.setProperty("max-width", collapsed ? "60px" : "260px", "important");
		if (brand) brand.style.setProperty("display", collapsed ? "none" : "flex", "important");
		if (btn) btn.innerHTML = collapsed ? icon("chevron-right", 14) : icon("chevron-left", 14);
		doc.querySelectorAll("#aus-sidebar .aus-nav-label").forEach((el) => {
			el.style.setProperty("display", collapsed ? "none" : "inline", "important");
		});
		doc.querySelectorAll("#aus-sidebar .aus-nav-item").forEach((el) => {
			el.style.justifyContent = collapsed ? "center" : "flex-start";
		});
		doc.querySelectorAll("#aus-sidebar .aus-nav-item").forEach((el) => {
			el.style.padding = collapsed ? "10px 0" : "10px 12px";
		});
	};
	doc.getElementById("aus-sidebar-toggle")?.addEventListener("click", () => applyCollapsed(!collapsed));
	doc.getElementById("aus-hamburger-btn")?.addEventListener("click", () => {
		mobileOpen = !mobileOpen;
		syncMobileSidebar(doc);
	});
	/**
	* 把「移动端兼容 UI」开关状态写到 #aus-panel[data-mobile-nav]（CSS 靠这个属性二选一），
	* 并立刻按新布局重排：关掉抽屉、必要时恢复宽屏折叠、重算底栏高亮与返回箭头。
	*/
	const applyMobileNavModeLocal = () => {
		const pn = doc.getElementById("aus-panel");
		if (pn) pn.setAttribute("data-mobile-nav", mobileNavMode());
		mobileOpen = false;
		syncMobileSidebar(doc);
		if (!isNarrowPanel(doc)) applyCollapsed(collapsed);
		paintNavState(doc, bottomNavActive(doc), false);
	};
	applyMobileNavModeImpl = applyMobileNavModeLocal;
	applyMobileNavModeLocal();
	try {
		let rzT = null;
		const onResize = () => {
			if (rzT) return;
			rzT = setTimeout(() => {
				rzT = null;
				if (!isNarrowPanel(doc)) {
					mobileOpen = false;
					syncMobileSidebar(doc);
					applyCollapsed(collapsed);
				} else syncMobileSidebar(doc);
				paintNavState(doc, bottomNavActive(doc), false);
				try {
					positionPanel();
				} catch {}
			}, 150);
		};
		window.parent?.addEventListener("resize", onResize);
		window.addEventListener("resize", onResize);
	} catch {}
	try {
		const vv = window.visualViewport;
		let vvRaf = null;
		const onViewportChange = () => {
			try {
				syncViewportHeight();
			} catch {}
			if (vvRaf) return;
			vvRaf = (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(fn, 16))(() => {
				vvRaf = null;
				try {
					syncViewportHeight();
				} catch {}
				try {
					paintNavState(doc, bottomNavActive(doc), false);
				} catch {}
				try {
					positionPanel();
				} catch {}
			});
		};
		vv?.addEventListener?.("resize", onViewportChange, { passive: true });
		vv?.addEventListener?.("scroll", onViewportChange, { passive: true });
	} catch {}
	bindPanel(doc);
	bindHistoryFilters(doc);
	bindImportExport(doc);
	renderSettings(doc);
	bindHistoryCompare();
	bindChangelog(doc);
	initStatsView();
	initExtraCharts();
	try {
		initForecastView();
	} catch {}
	try {
		import("./update-C0nJ98Sq.js").then((m) => {
			const branchBtn = doc.getElementById("aus-update-branch-btn");
			const branchLabel = doc.getElementById("aus-update-branch-label");
			const branchDrop = doc.getElementById("aus-update-branch-dropdown");
			if (!branchBtn || !branchLabel || !branchDrop) return;
			const renderBranch = () => {
				const branch = m.getUpdateBranch();
				branchLabel.textContent = branch;
				branchDrop.querySelectorAll("[data-update-branch]").forEach((el) => {
					const active = el.getAttribute("data-update-branch") === branch;
					el.style.background = active ? "var(--ds-card)" : "transparent";
					el.style.fontWeight = active ? "600" : "400";
				});
			};
			renderBranch();
			branchBtn.onclick = (e) => {
				e.stopPropagation();
				branchDrop.style.display = branchDrop.style.display === "flex" ? "none" : "flex";
			};
			branchDrop.querySelectorAll("[data-update-branch]").forEach((el) => {
				el.onclick = () => {
					const branch = el.getAttribute("data-update-branch");
					if (branch !== "main" && branch !== "dev") return;
					m.setUpdateBranch(branch);
					renderBranch();
					closeDropdownInstant(branchDrop);
					m.checkUpdate(true);
				};
			});
			doc.addEventListener("click", (ev) => {
				const drop = doc.getElementById("aus-update-branch-dropdown");
				if (!drop) return;
				if (!ev?.target?.closest?.("#aus-update-branch-dropdown") && !ev?.target?.closest?.("#aus-update-branch-btn")) drop.style.display = "none";
			});
		}).catch(() => {});
		const updBtn = doc.getElementById("aus-check-update");
		if (updBtn) updBtn.onclick = () => {
			updBtn.textContent = "检查中…";
			updBtn.setAttribute("disabled", "");
			import("./update-C0nJ98Sq.js").then((m) => m.checkUpdate(true).finally(() => {
				updBtn.textContent = "检查更新";
				updBtn.removeAttribute("disabled");
			}));
		};
		const runUpdBtn = doc.getElementById("aus-run-update");
		if (runUpdBtn) runUpdBtn.onclick = () => {
			if (runUpdBtn.hasAttribute("disabled")) return;
			runUpdBtn.textContent = "更新中…";
			runUpdBtn.setAttribute("disabled", "");
			import("./update-C0nJ98Sq.js").then((m) => m.updateSelf()).then((res) => {
				if (res.ok && res.changed) {
					const bannerEl = doc.getElementById("aus-update-banner");
					if (bannerEl) {
						bannerEl.style.display = "block";
						bannerEl.style.background = "var(--ds-green-bg)";
						bannerEl.style.borderColor = "var(--ds-green)";
						bannerEl.textContent = `已更新到 ${res.branch} 分支，正在刷新页面…`;
					}
					runUpdBtn.textContent = "即将刷新…";
					setTimeout(() => {
						try {
							window.parent?.location?.reload?.();
						} catch {
							try {
								location.reload();
							} catch {}
						}
					}, 1500);
					return;
				}
				runUpdBtn.textContent = "立即更新";
				runUpdBtn.removeAttribute("disabled");
				if (res.ok && !res.changed) {
					const bannerEl = doc.getElementById("aus-update-banner");
					if (bannerEl) {
						bannerEl.style.display = "block";
						bannerEl.style.background = "var(--ds-green-bg)";
						bannerEl.style.borderColor = "var(--ds-green)";
						bannerEl.textContent = `已是最新版本（${res.branch}），无需更新` + (res.commit ? "（" + res.commit + "）" : "");
					}
					runUpdBtn.style.display = "none";
				}
			}).catch(() => {
				runUpdBtn.textContent = "立即更新";
				runUpdBtn.removeAttribute("disabled");
			});
		};
	} catch {}
	switchView("overview", { track: false });
	refreshUI();
}
var AUS_BACK_FLAG = "__ausBackGuard";
var NARROW_VIEWPORT_MAX = 760;
var backGuardPushed = false;
var backGuardWin = null;
/** 历史记录属于宿主窗口（扩展通常跑在 iframe 里），跨源时回退到自身窗口 */
function backGuardHost() {
	try {
		const w = window.parent;
		if (w && w !== window && w.history) return w;
	} catch {}
	return window;
}
/**
* 是否该接管返回键：窄屏（手机竖屏 / 小窗）或本身就是移动设备
* （平板横屏、折叠屏展开后宽度会超过 760，但返回键行为与手机一致）。
*/
function isNarrowViewport() {
	try {
		const w = backGuardHost();
		const width = Number(w?.innerWidth || window.innerWidth || 0);
		if (width > 0 && width <= NARROW_VIEWPORT_MAX) return true;
		return mobileDeviceHint();
	} catch {
		return false;
	}
}
/** 关掉面板内最上面的一层浮层（展开的胶囊下拉 / 历史详情窗口），关掉了返回 true */
function closeTopOverlay() {
	const doc = getDoc$1();
	try {
		const open = Array.from(doc.querySelectorAll("[data-aus-drop-open=\"1\"]"));
		if (open.length) {
			for (const el of open) closeDropdownInstant(el);
			return true;
		}
	} catch {}
	if (activeHistoryDetailTs !== null) try {
		closeHistoryDetail(doc);
		return true;
	} catch {}
	return false;
}
/** 退到面板内的上一页；没有上一页返回 false（交给上层关面板） */
function goBackInPanel() {
	const prev = popViewTrail(viewTrail, currentView);
	if (!prev) return false;
	try {
		switchView(prev, { back: true });
		return true;
	} catch {
		return false;
	}
}
/** 消费掉一条历史记录后立刻补压一条，保持「总能再退一步」 */
function rearmBackGuard() {
	const w = backGuardWin;
	if (!w || !backGuardPushed) return;
	try {
		if (!w.history?.pushState) return;
		const prev = w.history.state;
		const next = prev && typeof prev === "object" ? { ...prev } : {};
		next[AUS_BACK_FLAG] = 1;
		w.history.pushState(next, "");
	} catch {}
}
function onBackGuardPop(ev) {
	if (!panelOpen) {
		releaseBackGuard(false);
		return;
	}
	if (ev?.state && ev.state[AUS_BACK_FLAG]) return;
	if (closeTopOverlay() || goBackInPanel()) {
		rearmBackGuard();
		return;
	}
	releaseBackGuard(false);
	try {
		closePanel();
	} catch {}
}
/** 打开面板时压一条历史记录，把返回键变成「关闭面板」 */
function armBackGuard() {
	if (backGuardPushed) return;
	if (!isNarrowViewport()) return;
	const w = backGuardHost();
	try {
		if (!w?.history?.pushState) return;
		const prev = w.history.state;
		const next = prev && typeof prev === "object" ? { ...prev } : {};
		next[AUS_BACK_FLAG] = 1;
		w.history.pushState(next, "");
		backGuardWin = w;
		backGuardPushed = true;
		w.addEventListener("popstate", onBackGuardPop);
	} catch {}
}
/**
* 解除接管。
* stepBack=true（点关闭按钮 / 按 Esc / 切换视图重置）时把我们压的那条记录弹掉，
* 避免下次返回多退一步；由返回键触发时传 false，因为历史已经退过去了。
*/
function releaseBackGuard(stepBack = true) {
	const w = backGuardWin;
	const pushed = backGuardPushed;
	backGuardWin = null;
	backGuardPushed = false;
	if (!w) return;
	try {
		w.removeEventListener("popstate", onBackGuardPop);
	} catch {}
	if (!stepBack || !pushed) return;
	try {
		const st = w.history?.state;
		if (st && st[AUS_BACK_FLAG]) {
			const next = { ...st };
			delete next[AUS_BACK_FLAG];
			w.history.replaceState(next, "");
			w.history.back();
		}
	} catch {}
}
function resetPanelState() {
	panelCreated = false;
	panelOpen = false;
	viewTrail.length = 0;
	try {
		releaseBackGuard();
	} catch {}
}
function openPanel() {
	const doc = getDoc$1();
	viewTrail.length = 0;
	panelOpenStartTs = nowTs();
	try {
		trackOpen();
	} catch {}
	let ov = doc.getElementById("aus-overlay");
	let pn = doc.getElementById("aus-panel");
	if (!ov || !pn) {
		createPanel();
		ov = doc.getElementById("aus-overlay");
		pn = doc.getElementById("aus-panel");
		if (!ov || !pn) return;
	}
	try {
		trackPage(currentView);
	} catch {}
	ov.style.display = "block";
	pn.style.display = "flex";
	try {
		applyMobileNavModeImpl?.();
	} catch {}
	positionPanel();
	requestAnimationFrame(() => {
		ov.style.opacity = "1";
		positionPanel();
		try {
			if (panelOpenStartTs) trackRender(nowTs() - panelOpenStartTs);
		} catch {}
	});
	panelOpen = true;
	try {
		armBackGuard();
	} catch {}
	refreshUI();
	try {
		import("./collector-BCuK7bhd.js").then((m) => m.reconcileOnPanelOpen()).catch(() => {});
	} catch {}
	try {
		import("./update-C0nJ98Sq.js").then((m) => m.maybeAutoCheck());
	} catch {}
}
function closePanel() {
	const doc = getDoc$1();
	const ov = doc.getElementById("aus-overlay");
	const pn = doc.getElementById("aus-panel");
	if (ov) {
		ov.style.opacity = "0";
		setTimeout(() => {
			ov.style.display = "none";
		}, 200);
	}
	if (pn) pn.style.display = "none";
	mobileOpen = false;
	syncMobileSidebar(doc);
	panelOpen = false;
	viewTrail.length = 0;
	try {
		releaseBackGuard();
	} catch {}
	try {
		flushTelemetry("close");
	} catch {}
}
function togglePanel() {
	if (panelOpen) closePanel();
	else openPanel();
}
//#endregion
//#region src/ui/peak-dot.ts
function isPeak(ts) {
	const hours = state$2.settings.peakHours || [];
	return isPeakHour$1(ts, hours, state$2.settings.extraOffDays);
}
function getPeakStatus(now = Date.now()) {
	const extraOffDays = state$2.settings.extraOffDays;
	if (isWeekendDay(now)) return {
		color: "#22c55e",
		label: "周末全天低谷"
	};
	if (isChinaHoliday(now)) return {
		color: "#22c55e",
		label: "法定节假日全天低谷"
	};
	if (isExtraOffDay(now, extraOffDays)) return {
		color: "#22c55e",
		label: "自定义空闲日全天低谷"
	};
	if (isPeak(now)) return {
		color: "#ef4444",
		label: "高峰时段"
	};
	const d = new Date(now);
	const mins = d.getHours() * 60 + d.getMinutes();
	let nearest = 1440;
	for (const h of state$2.settings.peakHours || []) {
		let diff = parseInt(h.start.split(":")[0]) * 60 + parseInt(h.start.split(":")[1] || "0") - mins;
		if (diff < 0) diff += 1440;
		if (diff < nearest) nearest = diff;
	}
	if (nearest <= 10) return {
		color: "#eab308",
		label: `距高峰 ${nearest} 分`
	};
	return {
		color: "#22c55e",
		label: "非高峰"
	};
}
function updatePeakDot() {
	const dot = (window.parent?.document ?? document).getElementById("aus-peak-dot-indicator");
	if (!dot) return;
	if (state$2.settings.peakDot === false) {
		dot.style.display = "none";
		return;
	}
	dot.style.display = "block";
	const st = getPeakStatus();
	dot.style.background = st.color;
	dot.style.boxShadow = `0 0 8px ${st.color}`;
	dot.title = `API用量统计 · ${st.label}`;
}
var peakTimer = null;
function clampPos(left, top) {
	const w = window.parent?.innerWidth ?? window.innerWidth;
	const h = window.parent?.innerHeight ?? window.innerHeight;
	return {
		left: Math.min(Math.max(left, 0), w - 40),
		top: Math.min(Math.max(top, 0), h - 40)
	};
}
function stopPeakDot() {
	if (peakTimer) {
		try {
			clearInterval(peakTimer);
		} catch {}
		peakTimer = null;
	}
	try {
		(window.parent?.document ?? document).getElementById("aus-peak-dot-indicator")?.remove();
	} catch {}
}
function createPeakDot() {
	const doc = window.parent?.document ?? document;
	if (doc.getElementById("aus-peak-dot-indicator")) return;
	const dot = doc.createElement("div");
	dot.id = "aus-peak-dot-indicator";
	dot.style.cssText = "position:fixed;width:18px;height:18px;border-radius:50%;z-index:3000;cursor:grab;opacity:0.85;border:2px solid rgba(0,0,0,0.25);transition:opacity 0.2s;user-select:none;touch-action:none;";
	let saved = null;
	try {
		const v = localStorage.getItem("ds_ds_peak_dot_pos");
		if (v) saved = JSON.parse(v);
	} catch {}
	if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
		const c = clampPos(saved.left, saved.top);
		dot.style.left = c.left + "px";
		dot.style.top = c.top + "px";
	} else {
		dot.style.right = "16px";
		dot.style.top = "60px";
	}
	doc.body.appendChild(dot);
	updatePeakDot();
	peakTimer = setInterval(updatePeakDot, 3e4);
	dot.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		try {
			dot.setPointerCapture(e.pointerId);
		} catch {}
		dot.style.cursor = "grabbing";
		const rect = dot.getBoundingClientRect();
		const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
		const onMove = (ev) => {
			dot.style.right = "auto";
			dot.style.left = ev.clientX - sx + "px";
			dot.style.top = ev.clientY - sy + "px";
		};
		const onUp = (ev) => {
			dot.style.cursor = "grab";
			dot.removeEventListener("pointermove", onMove);
			dot.removeEventListener("pointerup", onUp);
			try {
				dot.releasePointerCapture(ev.pointerId);
			} catch {}
			const c = clampPos(parseInt(dot.style.left) || 0, parseInt(dot.style.top) || 0);
			dot.style.left = c.left + "px";
			dot.style.top = c.top + "px";
			try {
				localStorage.setItem("ds_ds_peak_dot_pos", JSON.stringify({
					left: c.left,
					top: c.top
				}));
			} catch {}
		};
		dot.addEventListener("pointermove", onMove);
		dot.addEventListener("pointerup", onUp);
	});
}
//#endregion
//#region src/index.ts
/**
* API用量统计 — 全屏独立面板 + 魔法棒入口
* 入口：酒馆左下角魔法棒（#extensionsMenu） → 点击打开全屏用量页
* 面板：独立于酒馆的 #aus-overlay + #aus-panel 全屏页面，DeepSeek 浅色风格
*/
var MODULE = "api_usage_stat";
var wandRetryTimer = null;
var mountRetryTimer = null;
var interceptionRetryTimer = null;
function onEscapeKey(e) {
	if (e.key === "Escape") closePanel();
}
function onPageHide() {
	try {
		import("./persistence-CaWdvByH.js").then((n) => n.l).then((m) => m.flushSaveHot()).catch(() => {});
	} catch {}
}
function cleanupRuntimeBindings() {
	if (wandRetryTimer) {
		try {
			clearInterval(wandRetryTimer);
		} catch {}
		wandRetryTimer = null;
	}
	if (mountRetryTimer) {
		try {
			clearTimeout(mountRetryTimer);
		} catch {}
		mountRetryTimer = null;
	}
	if (interceptionRetryTimer) {
		try {
			clearInterval(interceptionRetryTimer);
		} catch {}
		interceptionRetryTimer = null;
	}
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		if (ctx?.eventSource?.off) {
			ctx.eventSource.off(ctx.event_types?.APP_READY, onAppReady);
			ctx.eventSource.off(ctx.event_types?.APP_INITIALIZED, onAppInitialized);
			ctx.eventSource.off(ctx.event_types?.CHAT_CHANGED, onChatChanged);
		}
	} catch {}
	try {
		getDoc().removeEventListener("keydown", onEscapeKey);
	} catch {}
	try {
		window.removeEventListener("pagehide", onPageHide);
	} catch {}
}
function onAppReady() {
	try {
		createPanel();
	} catch {}
	try {
		ensureWandEntry();
	} catch {}
	try {
		refreshUI();
	} catch {}
	try {
		import("./interception-BzsoKaEQ.js").then((n) => n.n).then((m) => m.installInterception()).catch(() => {});
	} catch {}
	try {
		import("./collector-BCuK7bhd.js").then((m) => m.initAgentUsage()).catch(() => {});
	} catch {}
}
function onAppInitialized() {
	try {
		ensureWandEntry();
	} catch {}
	try {
		import("./interception-BzsoKaEQ.js").then((n) => n.n).then((m) => m.installInterception()).catch(() => {});
	} catch {}
	try {
		import("./collector-BCuK7bhd.js").then((m) => m.initAgentUsage()).catch(() => {});
	} catch {}
}
function onChatChanged() {
	try {
		if (state$2.settings.historyScope === "current") refreshUI();
	} catch {}
}
function getDoc() {
	return window.parent?.document ?? document;
}
function ensureStyleScope() {
	try {
		document.documentElement.removeAttribute("data-extension");
		document.documentElement.removeAttribute("data-ds-theme");
		const doc = getDoc();
		doc.documentElement.removeAttribute("data-ds-theme");
		if (doc.documentElement.getAttribute("data-extension") === "api-usage-stat" && doc.getElementById("aus-panel")) doc.documentElement.removeAttribute("data-extension");
	} catch {}
}
async function initStore() {
	await repository.hydrate();
}
function injectWandEntry() {
	const doc = getDoc();
	const menu = doc.getElementById("extensionsMenu") || doc.getElementById("extensions_menu") || doc.querySelector("#extensionsMenu") || doc.querySelector("#extensions_menu") || doc.querySelector(".extensionsMenu") || doc.getElementById("extensions_settings") || doc.querySelector("#rm_extensions_block");
	if (!menu) return false;
	if (doc.getElementById("aus_wand_container")) return true;
	const container = doc.createElement("div");
	container.id = "aus_wand_container";
	container.className = "extension_container";
	container.innerHTML = "<div id=\"aus_wand_entry\" class=\"list-group-item flex-container flexGap5\" style=\"cursor:pointer;\"><div class=\"fa-solid fa-chart-column extensionsMenuExtensionButton\"></div>API用量统计</div>";
	try {
		menu.appendChild(container);
	} catch {
		return false;
	}
	const btn = doc.getElementById("aus_wand_entry");
	if (btn) btn.addEventListener("click", () => togglePanel());
	log.debug("魔法棒入口已注入");
	return true;
}
function ensureWandEntry() {
	if (injectWandEntry()) {
		if (wandRetryTimer) {
			clearInterval(wandRetryTimer);
			wandRetryTimer = null;
		}
		return;
	}
	if (wandRetryTimer) clearInterval(wandRetryTimer);
	let tries = 0;
	wandRetryTimer = setInterval(() => {
		tries++;
		if (injectWandEntry() || tries > 20) {
			clearInterval(wandRetryTimer);
			wandRetryTimer = null;
		}
	}, 500);
}
async function onInstall() {
	log.debug("installed");
	try {
		const { loadHot } = await import("./persistence-CaWdvByH.js").then((n) => n.l);
		await loadHot();
	} catch {}
}
async function onUpdate() {
	log.debug("updated");
}
async function onDelete() {
	log.debug("deleted");
	try {
		const { flushSaveHot } = await import("./persistence-CaWdvByH.js").then((n) => n.l);
		flushSaveHot();
	} catch {}
	try {
		const doc = getDoc();
		doc.getElementById("aus-overlay")?.remove();
		doc.getElementById("aus-panel")?.remove();
		doc.getElementById("aus_wand_container")?.remove();
		doc.getElementById("aus-peak-dot-indicator")?.remove();
	} catch {}
	try {
		resetPanelState();
	} catch {}
	try {
		stopPeakDot();
	} catch {}
	try {
		(await import("./balance-DwuYkZLE.js").then((n) => n.t)).stopBalanceTimer?.();
	} catch {}
	try {
		(await import("./currency-Dsn2T9-Q.js").then((n) => n.t)).stopRateTimer?.();
	} catch {}
	try {
		(await import("./pricing-sync-LRQyOkr3.js").then((n) => n.a)).stopPricingSyncTimer?.();
	} catch {}
	cleanupRuntimeBindings();
	try {
		localStorage.removeItem("ds_ds_webdav_pass");
	} catch {}
	try {
		localStorage.removeItem("ds_ds_peak_dot_pos");
	} catch {}
	try {
		localStorage.removeItem("ds_debug_log");
	} catch {}
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		if (ctx?.extensionSettings) {
			delete ctx.extensionSettings["api_usage_stat"];
			ctx.saveSettingsDebounced?.();
		}
	} catch {}
	try {
		delete globalThis.ApiUsageStat;
		delete globalThis.ApiUsageStatInterceptor;
	} catch {}
}
function onEnable() {
	log.debug("enabled");
	try {
		import("./interception-BzsoKaEQ.js").then((n) => n.n).then((m) => m.installInterception());
	} catch {}
	try {
		import("./collector-BCuK7bhd.js").then((m) => m.initAgentUsage()).catch(() => {});
	} catch {}
	try {
		import("./balance-DwuYkZLE.js").then((n) => n.t).then((m) => m.restartBalanceTimer?.());
	} catch {}
	try {
		import("./currency-Dsn2T9-Q.js").then((n) => n.t).then((m) => m.restartRateTimer?.());
	} catch {}
	try {
		import("./pricing-sync-LRQyOkr3.js").then((n) => n.a).then((m) => m.restartPricingSyncTimer?.());
	} catch {}
}
async function onDisable() {
	log.debug("disabled");
	try {
		const { flushSaveHot } = await import("./persistence-CaWdvByH.js").then((n) => n.l);
		flushSaveHot();
	} catch {}
	try {
		import("./interception-BzsoKaEQ.js").then((n) => n.n).then((m) => m.uninstallInterception?.());
	} catch {}
	try {
		import("./collector-BCuK7bhd.js").then((m) => m.uninstallAgentUsage?.()).catch(() => {});
	} catch {}
	try {
		const doc = getDoc();
		doc.getElementById("aus-overlay")?.remove();
		doc.getElementById("aus-panel")?.remove();
		doc.getElementById("aus_wand_container")?.remove();
		doc.getElementById("aus-peak-dot-indicator")?.remove();
	} catch {}
	try {
		resetPanelState();
	} catch {}
	try {
		stopPeakDot();
	} catch {}
	try {
		unwatchSystemTheme();
	} catch {}
	try {
		(await import("./balance-DwuYkZLE.js").then((n) => n.t)).stopBalanceTimer?.();
	} catch {}
	try {
		(await import("./currency-Dsn2T9-Q.js").then((n) => n.t)).stopRateTimer?.();
	} catch {}
	try {
		(await import("./pricing-sync-LRQyOkr3.js").then((n) => n.a)).stopPricingSyncTimer?.();
	} catch {}
	cleanupRuntimeBindings();
}
async function onActivate() {
	ensureStyleScope();
	try {
		injectWandEntry();
		ensureWandEntry();
	} catch {}
	try {
		installInterception();
	} catch {}
}
async function init() {
	ensureStyleScope();
	try {
		setTimeout(() => {
			import("./update-C0nJ98Sq.js").then((m) => m.probeForcedUpdateAtStartup()).catch(() => {});
		}, 3e3);
	} catch {}
	try {
		applyTheme(state$2.settings.theme);
	} catch {}
	try {
		await initStore();
	} catch (e) {
		console.error("[API用量统计] initStore 失败", e);
	}
	try {
		initTelemetry();
	} catch {}
	try {
		(await import("./balance-DwuYkZLE.js").then((n) => n.t)).restartBalanceTimer?.();
	} catch {}
	try {
		(await import("./currency-Dsn2T9-Q.js").then((n) => n.t)).restartRateTimer?.();
	} catch {}
	try {
		(await import("./pricing-sync-LRQyOkr3.js").then((n) => n.a)).restartPricingSyncTimer?.();
	} catch {}
	try {
		installInterception();
	} catch {}
	try {
		import("./collector-BCuK7bhd.js").then((m) => m.initAgentUsage()).catch(() => {});
	} catch {}
	const mount = () => {
		try {
			applyTheme(state$2.settings.theme);
		} catch {}
		try {
			watchSystemTheme();
		} catch {}
		try {
			createPanel();
		} catch {}
		try {
			ensureWandEntry();
		} catch {}
		try {
			createPeakDot();
		} catch {}
		try {
			refreshUI();
		} catch {}
		try {
			import("./pricing-sync-LRQyOkr3.js").then((n) => n.a).then((m) => m.markLegacySyncedModels?.()).catch(() => {});
		} catch {}
	};
	if (globalThis.SillyTavern?.getContext) mount();
	else mountRetryTimer = window.setTimeout(mount, 1500);
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, onAppReady);
		ctx?.eventSource?.on?.(ctx?.event_types?.APP_INITIALIZED, onAppInitialized);
		ctx?.eventSource?.on?.(ctx?.event_types?.CHAT_CHANGED, onChatChanged);
		let retry = 0;
		interceptionRetryTimer = setInterval(() => {
			retry++;
			try {
				if (globalThis.SillyTavern?.getContext?.()?.eventSource) try {
					if (installInterception()) {
						clearInterval(interceptionRetryTimer);
						interceptionRetryTimer = null;
					}
				} catch {}
			} catch {}
			if (retry > 6 && interceptionRetryTimer) {
				clearInterval(interceptionRetryTimer);
				interceptionRetryTimer = null;
			}
		}, 1500);
	} catch {}
	try {
		getDoc().addEventListener("keydown", onEscapeKey);
	} catch {}
	try {
		window.addEventListener("pagehide", onPageHide);
	} catch {}
	globalThis.ApiUsageStat = {
		MODULE,
		refreshUI,
		refreshTheme,
		updatePeakDot,
		openPanel,
		closePanel,
		togglePanel,
		state: state$2,
		injectWandEntry: ensureWandEntry
	};
}
init();
//#endregion
export { onActivate, onDelete, onDisable, onEnable, onInstall, onUpdate, panel_exports as t };
