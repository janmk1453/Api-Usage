import { pn as __exportAll } from "./graphic-BAx7jeh4.js";
import { r as state } from "./store-BhaWFCjs.js";
import { a as HIDDEN_PRICING_MODELS, d as PRICING_SYNC_SOURCE, l as PRICING, u as PRICING_SYNC_FALLBACK } from "./pricing-Bc-qEvy8.js";
import { u as saveHot } from "./persistence-C4IJVd-B.js";
import { r as toast, t as log } from "./logger-8RGXnvfI.js";
import { _ as normalizeModel, m as isDeepSeekOfficialModel, t as repository, y as cloneWallet } from "./repository-amYRMrqm.js";
import { a as getWalletExchangeRate } from "./currency-CkKG5JR0.js";
/** 已知同义模型名（仅做等价加分，不强绑）：归一化后仍不同但确为同一模型的写法 */
var MODEL_ALIAS_HINTS = {
	"qwen-max": ["qwen3-max", "qwen-max-latest"],
	"qwen-plus": ["qwen3-plus", "qwen-plus-latest"],
	"qwen-turbo": ["qwen3-turbo", "qwen-turbo-latest"],
	"glm-4-5": ["glm-4-5-air", "zai-glm-4-5"],
	"kimi-k2": ["kimi-k2-turbo-preview"],
	"gpt-4-1": ["gpt-4-1-2025-04-14"]
};
/** 追加在短名之后、仍视为同一模型的修饰词 */
var NEUTRAL_SUFFIX_TOKENS = /* @__PURE__ */ new Set([
	"latest",
	"preview",
	"thinking",
	"instruct",
	"chat",
	"base",
	"it",
	"hf",
	"free",
	"exp",
	"online"
]);
var DATE_SUFFIX_8 = /-\d{8}$/;
var DATE_SUFFIX_DASHED = /-\d{4}-\d{2}-\d{2}$/;
var DATE_SUFFIX_4 = /-\d{4}$/;
var VERSION_SUFFIX = /-v\d+(?::\d+)?$/;
/** 归一化模型名：去前缀/供应商路径/日期与版本后缀，统一分隔符与小数点 */
function normalizeModelName(raw) {
	let key = String(raw ?? "").trim().toLowerCase();
	if (!key) return "";
	key = key.replace(/^\[[^\]]*\]\s*/, "");
	key = key.split("/").pop() || key;
	key = key.replace(/:(?:free|nitro|beta|extended|online)$/, "");
	key = key.replace(/_/g, "-");
	key = key.replace(/\s+/g, "-");
	key = key.replace(DATE_SUFFIX_8, "");
	key = key.replace(DATE_SUFFIX_DASHED, "");
	key = key.replace(DATE_SUFFIX_4, "");
	key = key.replace(VERSION_SUFFIX, "");
	key = key.replace(/^deepseek-ai-/, "");
	key = key.replace(/-latest$/, "");
	key = key.replace(/(\d)\.(\d)/g, "$1-$2");
	key = key.replace(/-+/g, "-").replace(/^-|-$/g, "");
	return key;
}
function numericTokens(value) {
	return value.split("-").filter((token) => /^\d+$/.test(token) || /^v\d+$/.test(token));
}
/** 版本号不一致（4.5 vs 4、72b vs 32b 等）时视为不同模型 */
function hasVersionConflict(a, b) {
	const left = numericTokens(a);
	const right = numericTokens(b);
	if (!left.length || !right.length) return false;
	return left.join("-") !== right.join("-");
}
function tokenScore(a, b) {
	const left = a.split("-").filter(Boolean);
	const right = b.split("-").filter(Boolean);
	const setLeft = new Set(left);
	const setRight = new Set(right);
	let intersection = 0;
	for (const token of setLeft) if (setRight.has(token)) intersection += 1;
	const union = (/* @__PURE__ */ new Set([...left, ...right])).size;
	const jaccard = union ? intersection / union : 0;
	const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
	return jaccard * .75 + lengthRatio * .25;
}
function levenshtein(a, b) {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	let prev = new Array(b.length + 1);
	let curr = new Array(b.length + 1);
	for (let j = 0; j <= b.length; j += 1) prev[j] = j;
	for (let i = 1; i <= a.length; i += 1) {
		curr[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		const swap = prev;
		prev = curr;
		curr = swap;
	}
	return prev[b.length];
}
function aliasEquivalent(a, b) {
	const hints = MODEL_ALIAS_HINTS[a];
	if (hints && hints.includes(b)) return true;
	const reverse = MODEL_ALIAS_HINTS[b];
	return !!reverse && reverse.includes(a);
}
/**
* 计算单对模型名相似度。
* 返回 score 与判定原因，score 已包含版本/变体惩罚。
*/
function scoreModelName(local, catalog) {
	const a = normalizeModelName(local);
	const b = normalizeModelName(catalog);
	if (!a || !b) return {
		score: 0,
		reason: "fuzzy"
	};
	if (String(local).trim().toLowerCase() === String(catalog).trim().toLowerCase()) return {
		score: 1,
		reason: "exact"
	};
	if (a === b) return {
		score: 1,
		reason: "normalized"
	};
	if (aliasEquivalent(a, b)) return {
		score: .99,
		reason: "alias"
	};
	let best = 0;
	let reason = "fuzzy";
	if (a.startsWith(b + "-") || b.startsWith(a + "-")) {
		const longer = a.length >= b.length ? a : b;
		const shorter = a.length >= b.length ? b : a;
		const extra = longer.slice(shorter.length + 1).split("-").filter(Boolean);
		const neutral = extra.length > 0 && extra.every((token) => NEUTRAL_SUFFIX_TOKENS.has(token));
		const lengthRatio = shorter.length / longer.length;
		if (neutral && lengthRatio >= .75) {
			best = .95;
			reason = "prefix";
		} else if (lengthRatio >= .6) {
			best = .6;
			reason = "prefix";
		}
	}
	const tokens = tokenScore(a, b);
	if (tokens > best) {
		best = tokens;
		reason = "tokens";
	}
	if (Math.max(a.length, b.length) >= 6) {
		const similarity = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
		if (similarity >= .85 && similarity - .05 > best) {
			best = similarity - .05;
			reason = "fuzzy";
		}
	}
	if (hasVersionConflict(a, b)) best = Math.min(best, .45);
	return {
		score: Math.round(best * 1e3) / 1e3,
		reason
	};
}
/** 对给定本地模型名，在目录模型名列表中排序候选项 */
function rankModelCandidates(local, catalogModels, limit = 5) {
	const rows = [];
	for (const model of catalogModels) {
		const { score, reason } = scoreModelName(local, model);
		if (score <= 0) continue;
		rows.push({
			model,
			score,
			reason
		});
	}
	rows.sort((left, right) => right.score - left.score || left.model.localeCompare(right.model));
	return rows.slice(0, limit);
}
/** 取最匹配项并判定是否歧义（分差过小） */
function matchModelName(local, catalogModels) {
	const ranked = rankModelCandidates(local, catalogModels, 3);
	const best = ranked[0] || null;
	const second = ranked[1] || null;
	if (!best || best.score < .85) return {
		best: null,
		second,
		ambiguous: false
	};
	return {
		best,
		second,
		ambiguous: !!second && second.score >= .85 && best.score - second.score < .05
	};
}
//#endregion
//#region src/services/pricing-sync.ts
var pricing_sync_exports = /* @__PURE__ */ __exportAll({
	SYNCED_MARK_VERSION: () => 2,
	applySyncPlan: () => applySyncPlan,
	buildSyncPlan: () => buildSyncPlan,
	fetchModelsDevCatalog: () => fetchModelsDevCatalog,
	isSyncedCustomModel: () => isSyncedCustomModel,
	markLegacySyncedModels: () => markLegacySyncedModels,
	removeSyncedModels: () => removeSyncedModels,
	restartPricingSyncTimer: () => restartPricingSyncTimer,
	stopPricingSyncTimer: () => stopPricingSyncTimer,
	syncPricingFromModelsDev: () => syncPricingFromModelsDev,
	walletSyncStatus: () => walletSyncStatus
});
/** 目录缓存有效期（内存） */
var CATALOG_TTL = 6e5;
/** 自动同步节流：60s 内不重复拉取目录 */
var AUTO_SYNC_THROTTLE = 6e4;
var catalogCache = null;
var lastAutoSync = 0;
/** 是否为 models.dev 同步写入的价格条目（默认不在“模型与价格”列表显示） */
function isSyncedCustomModel(entry) {
	return !!entry && entry.synced === true;
}
/** 内置模型键（含隐藏内置），这些模型不参与同步模型判定 */
function builtinModelKeys() {
	return /* @__PURE__ */ new Set([...Object.keys(PRICING), ...HIDDEN_PRICING_MODELS || []]);
}
function sameTier(a, b) {
	if (!a || !b) return false;
	return a.hit === b.hit && a.miss === b.miss && a.output === b.output;
}
function toCNY(usd, rate) {
	return Math.round(usd * rate * 1e4) / 1e4;
}
function normalizeCost(c) {
	if (!c || typeof c !== "object") return null;
	const hitRaw = c.cache_read ?? c.cacheRead ?? c.cached_tokens;
	const missRaw = c.input;
	const outRaw = c.output ?? c.reasoning;
	const hit = hitRaw != null ? parseFloat(String(hitRaw)) : NaN;
	const miss = missRaw != null ? parseFloat(String(missRaw)) : NaN;
	const out = outRaw != null ? parseFloat(String(outRaw)) : NaN;
	if (!isFinite(miss) || !isFinite(out)) return null;
	return {
		hit: isFinite(hit) ? hit : miss,
		miss,
		output: out
	};
}
async function fetchJson(url, timeoutMs = 12e3) {
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const r = await fetch(url, { signal: ctrl.signal });
		if (!r.ok) throw new Error("HTTP " + r.status);
		return await r.json();
	} finally {
		clearTimeout(to);
	}
}
/** 拉取 models.dev 目录（10 分钟内存缓存，force 可绕过） */
async function fetchModelsDevCatalog(opts = {}) {
	if (!opts.force && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.data;
	const urls = [PRICING_SYNC_SOURCE, PRICING_SYNC_FALLBACK];
	let lastErr = null;
	for (const u of urls) try {
		const data = await fetchJson(u);
		catalogCache = {
			at: Date.now(),
			data
		};
		return data;
	} catch (e) {
		lastErr = e;
	}
	throw lastErr || /* @__PURE__ */ new Error("fetch failed");
}
/** 目录 → 该供应商的价格表（USD/百万 → 内部计价单位） */
function buildProviderPrices(catalog, providerId, rate) {
	const models = catalog?.[providerId]?.models;
	if (!models || typeof models !== "object") return [];
	const out = [];
	for (const modelId of Object.keys(models)) {
		const cost = normalizeCost(models[modelId]?.cost);
		if (!cost) continue;
		const hit = toCNY(cost.hit, rate);
		const miss = toCNY(cost.miss, rate);
		const output = toCNY(cost.output, rate);
		const usePeak = isDeepSeekOfficialModel(modelId);
		out.push({
			catalogModel: modelId,
			usePeakPricing: usePeak,
			offpeak: {
				hit,
				miss,
				output
			},
			peak: usePeak ? {
				hit: Math.round(hit * 2 * 1e4) / 1e4,
				miss: Math.round(miss * 2 * 1e4) / 1e4,
				output: Math.round(output * 2 * 1e4) / 1e4
			} : {
				hit,
				miss,
				output
			}
		});
	}
	return out;
}
function providerLabel(providerId) {
	return {
		deepseek: "DeepSeek",
		openai: "OpenAI",
		anthropic: "Anthropic",
		google: "Google",
		mistral: "Mistral",
		xai: "xAI",
		moonshotai: "Moonshot AI",
		zai: "Z.AI",
		minimax: "MiniMax",
		cohere: "Cohere"
	}[providerId] || providerId;
}
/**
* 构建同步计划：**只遍历钱包里已识别的模型**，用模糊匹配在供应商目录中找对应价格。
* 不新增模型（历史 bug：add-missing 会把整个供应商目录灌进钱包）。
*/
function buildSyncPlan(catalog, opts = {}) {
	const rate = getWalletExchangeRate() || 7.2;
	const settings = state.settings;
	const mode = opts.mode || settings?.pricingSync?.mode || "add-missing";
	const ignored = new Set(state.walletIgnored || []);
	const only = opts.walletIds && opts.walletIds.length ? new Set(opts.walletIds) : null;
	const wallets = repository.getWallets().filter((wallet) => {
		if (ignored.has(wallet.id)) return false;
		if (only && !only.has(wallet.id)) return false;
		return true;
	});
	const rows = [];
	const summary = {
		wallets: 0,
		catalogModels: 0,
		matched: 0,
		exact: 0,
		fuzzy: 0,
		ambiguous: 0,
		unmatched: 0,
		write: 0,
		update: 0,
		skipped: 0
	};
	const providers = /* @__PURE__ */ new Set();
	for (const wallet of wallets) {
		const provider = opts.providerOverride || wallet.catalogProvider;
		if (!provider) continue;
		const prices = buildProviderPrices(catalog, provider, rate);
		if (!prices.length) continue;
		summary.wallets += 1;
		summary.catalogModels += prices.length;
		providers.add(provider);
		const catalogModels = prices.map((item) => item.catalogModel);
		const byModel = new Map(prices.map((item) => [item.catalogModel, item]));
		for (const model of wallet.models) {
			const localName = String(model.model || model.sourceModel || "").trim();
			if (!localName) continue;
			const matched = matchModelName(localName, catalogModels);
			const base = {
				key: wallet.id + "|" + model.id,
				walletId: wallet.id,
				walletName: wallet.name,
				provider,
				modelId: model.id,
				localModel: localName,
				locked: model.locked === true
			};
			if (!matched.best) {
				summary.unmatched += 1;
				rows.push({
					...base,
					catalogModel: null,
					score: 0,
					reason: "none",
					ambiguous: false,
					action: "unmatched",
					changed: false,
					usePeakPricing: model.price.usePeakPricing,
					current: model.price.priceConfigured ? model.price.offpeak : null,
					next: null,
					nextPeak: null
				});
				continue;
			}
			const price = byModel.get(matched.best.model);
			const ambiguous = matched.ambiguous;
			const usePeakPricing = model.price.usePeakPricing === true;
			const next = { ...price.offpeak };
			const nextPeak = usePeakPricing ? {
				hit: Math.round(next.hit * 2 * 1e4) / 1e4,
				miss: Math.round(next.miss * 2 * 1e4) / 1e4,
				output: Math.round(next.output * 2 * 1e4) / 1e4
			} : { ...next };
			summary.matched += 1;
			if (matched.best.reason === "exact" || matched.best.reason === "normalized" || matched.best.reason === "alias") summary.exact += 1;
			else summary.fuzzy += 1;
			if (ambiguous) summary.ambiguous += 1;
			let action = "update";
			if (!model.price.priceConfigured) action = "write";
			else if (model.locked && mode !== "overwrite-all") action = "skip-locked";
			else if (mode === "add-missing") action = "skip-same";
			else if (sameTier(model.price.offpeak, next) && sameTier(model.price.peak, nextPeak)) action = "skip-same";
			if (action === "write") summary.write += 1;
			else if (action === "update") summary.update += 1;
			else summary.skipped += 1;
			rows.push({
				...base,
				catalogModel: price.catalogModel,
				score: matched.best.score,
				reason: matched.best.reason,
				ambiguous,
				action,
				changed: action === "write" || action === "update",
				usePeakPricing,
				current: model.price.priceConfigured ? { ...model.price.offpeak } : null,
				next,
				nextPeak
			});
		}
	}
	const provider = Array.from(providers)[0] || "";
	return {
		provider,
		providerLabel: providers.size === 1 ? providerLabel(provider) : providers.size > 1 ? "多供应商" : "",
		mode,
		rate,
		createdAt: Date.now(),
		rows,
		summary
	};
}
/**
* 应用同步计划。默认**排除歧义行**（分差过小的匹配置信度不足），
* 也排除 skip-locked / skip-same / unmatched；selectedKeys 明确给定时以它为准。
*/
async function applySyncPlan(plan, opts = {}) {
	const selected = opts.selectedKeys ? new Set(opts.selectedKeys) : null;
	const targets = plan.rows.filter((row) => {
		if (row.action !== "write" && row.action !== "update") return false;
		if (!row.catalogModel || !row.next) return false;
		if (selected) return selected.has(row.key);
		return opts.includeAmbiguous ? true : !row.ambiguous;
	});
	if (!targets.length) return {
		applied: 0,
		wallets: []
	};
	const nextWallets = repository.getWallets().map((wallet) => cloneWallet(wallet));
	const affected = /* @__PURE__ */ new Set();
	const now = Date.now();
	for (const row of targets) {
		const wallet = nextWallets.find((item) => item.id === row.walletId);
		if (!wallet) continue;
		const model = wallet.models.find((item) => item.id === row.modelId);
		if (!model) continue;
		const catalogModel = row.catalogModel;
		if (!catalogModel) continue;
		if (model.locked && plan.mode !== "overwrite-all" && row.action === "update") continue;
		model.price = {
			usePeakPricing: row.usePeakPricing,
			offpeak: { ...row.next },
			peak: { ...row.nextPeak || row.next },
			priceConfigured: true
		};
		model.source = "sync";
		model.hidden = false;
		model.priceMatch = {
			provider: row.provider,
			catalogModel,
			score: row.score,
			matchedAt: now
		};
		model.updatedAt = now;
		affected.add(wallet.id);
	}
	if (!affected.size) return {
		applied: 0,
		wallets: []
	};
	repository.replaceWallets(nextWallets);
	const ps = state.settings.pricingSync;
	if (ps) {
		ps.lastSync = now;
		ps.lastMatchSummary = {
			matched: plan.summary.matched,
			fuzzy: plan.summary.fuzzy,
			unmatched: plan.summary.unmatched,
			at: now
		};
	}
	try {
		saveHot({ settings: state.settings });
	} catch {}
	if (ps?.recalcOnSync !== false) for (const walletId of affected) try {
		await repository.recalcWallet(walletId);
	} catch {}
	try {
		globalThis.ApiUsageStat?.refreshUI?.();
	} catch {}
	log.debug("sync plan applied", {
		applied: targets.length,
		wallets: Array.from(affected)
	});
	return {
		applied: targets.length,
		wallets: Array.from(affected)
	};
}
/** 按钱包同步价格：构建计划 → 自动应用（排除歧义行） */
async function syncPricingFromModelsDev(opts = {}) {
	const silent = !!opts.silent;
	if (!state.settings.pricingSync) return null;
	if (silent && !opts.force && Date.now() - lastAutoSync < AUTO_SYNC_THROTTLE) return null;
	if (silent) lastAutoSync = Date.now();
	try {
		const plan = buildSyncPlan(await fetchModelsDevCatalog({ force: !!opts.force }), {
			walletIds: opts.walletIds,
			mode: opts.mode
		});
		if (!plan.rows.length) {
			if (!silent) toast("warning", "没有可用于比对的模型：请先为钱包选择价格来源，并等待识别到模型");
			return plan;
		}
		if (opts.autoApply === false) return plan;
		const result = await applySyncPlan(plan);
		if (!silent) {
			const s = plan.summary;
			toast(result.applied ? "success" : "warning", "价格同步：写入 " + result.applied + " 个模型（匹配 " + s.matched + " / 未匹配 " + s.unmatched + (s.ambiguous ? " / 歧义 " + s.ambiguous : "") + "）");
		}
		return plan;
	} catch (e) {
		log.error("pricing sync failed", e);
		if (!silent) toast("error", "同步失败：" + (e?.message || e));
		return null;
	}
}
/** 移除旧版本全量灌入留下的孤儿同步模型（有 priceMatch 的保留） */
function removeSyncedModels() {
	const cms = state.settings.customModels || [];
	const kept = cms.filter((c) => c?.synced !== true);
	let removed = cms.length - kept.length;
	state.settings.customModels = kept;
	const nextWallets = repository.getWallets().map((wallet) => {
		const next = cloneWallet(wallet);
		const before = next.models.length;
		next.models = next.models.filter((model) => !(model.source === "sync" && !model.locked && !model.priceMatch));
		removed += before - next.models.length;
		return next;
	});
	if (removed > 0) repository.replaceWallets(nextWallets);
	try {
		saveHot({ settings: state.settings });
	} catch {}
	try {
		globalThis.ApiUsageStat?.refreshUI?.();
	} catch {}
	log.debug("synced models removed", { removed });
	return removed;
}
var pricingTimer = null;
function restartPricingSyncTimer() {
	if (pricingTimer) {
		try {
			clearInterval(pricingTimer);
		} catch {}
		pricingTimer = null;
	}
	const ps = state.settings.pricingSync;
	if (!ps?.enabled) return;
	const hours = parseInt(String(ps.autoIntervalHours)) || 0;
	if (!hours || hours <= 0) return;
	pricingTimer = setInterval(() => {
		syncPricingFromModelsDev({ silent: true }).catch(() => {});
	}, hours * 60 * 60 * 1e3);
}
function stopPricingSyncTimer() {
	if (pricingTimer) {
		try {
			clearInterval(pricingTimer);
		} catch {}
		pricingTimer = null;
	}
}
/** 钱包卡上的同步状态摘要 */
function walletSyncStatus(wallet) {
	const visible = (wallet.models || []).filter((model) => model.hidden !== true);
	const pending = visible.filter((model) => model.price.priceConfigured !== true).length;
	const synced = visible.filter((model) => model.priceMatch && model.price.priceConfigured === true).length;
	if (!wallet.catalogProvider) return {
		label: "未配置价格来源",
		pending,
		synced
	};
	return {
		label: providerLabel(wallet.catalogProvider) + (synced ? " · 已同步 " + synced : ""),
		pending,
		synced
	};
}
/**
* 迁移：旧版本把供应商目录**全量**写进钱包（source=sync 且从未被任何请求命中）。
* v2 起把这些孤儿条目置为 hidden（不删除，可手动清理），价格仍保留参与计价。
*/
async function markLegacySyncedModels(opts) {
	const ps = state.settings.pricingSync;
	if (!ps) return null;
	if (Number(ps.syncedMarkVersion) >= 2) return {
		hidden: 0,
		scanned: 0
	};
	let history = [];
	try {
		history = await repository.getAllHistory();
	} catch {
		history = state.history || [];
	}
	const used = /* @__PURE__ */ new Set();
	for (const entry of history) try {
		if (entry?.model) used.add(normalizeModel(entry.model).toLowerCase());
	} catch {}
	let hidden = 0;
	let scanned = 0;
	const nextWallets = repository.getWallets().map((wallet) => {
		const next = cloneWallet(wallet);
		for (const model of next.models) {
			if (model.source !== "sync" || model.locked || model.priceMatch) continue;
			if (model.hidden === true) continue;
			scanned += 1;
			const name = String(model.model || model.sourceModel || "").toLowerCase();
			if (used.has(name)) continue;
			model.hidden = true;
			model.updatedAt = Date.now();
			hidden += 1;
		}
		return next;
	});
	if (!(Number(ps.syncedMarkVersion) >= 1)) {
		const cms = state.settings.customModels || [];
		const builtin = builtinModelKeys();
		for (const entry of cms) {
			if (!entry?.model || entry.synced === true) continue;
			if (builtin.has(entry.model)) continue;
			if (used.has(String(entry.model).toLowerCase())) continue;
			entry.synced = true;
		}
	}
	if (hidden > 0) repository.replaceWallets(nextWallets);
	ps.syncedMarkVersion = 2;
	try {
		saveHot({ settings: state.settings });
	} catch {}
	if (hidden > 0) {
		try {
			globalThis.ApiUsageStat?.refreshUI?.();
		} catch {}
		if (!opts?.skipRerender) try {
			const { renderSettings } = await import("./index.js").then((n) => n.t);
			const doc = window.parent?.document ?? document;
			if (doc?.getElementById("aus-settings")) renderSettings(doc);
		} catch {}
	}
	log.debug("legacy synced models hidden", {
		hidden,
		scanned
	});
	return {
		hidden,
		scanned
	};
}
//#endregion
export { pricing_sync_exports as a, walletSyncStatus as c, isSyncedCustomModel as i, buildSyncPlan as n, removeSyncedModels as o, fetchModelsDevCatalog as r, syncPricingFromModelsDev as s, applySyncPlan as t };
