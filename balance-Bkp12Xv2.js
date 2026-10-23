import { pn as __exportAll } from "./graphic-BAx7jeh4.js";
import { r as state } from "./store-BhaWFCjs.js";
import { r as toast, t as log } from "./logger-8RGXnvfI.js";
import { i as saveWalletApiKey, k as DEEPSEEK_WALLET_ID, r as getWalletApiKey, t as repository } from "./repository-BotjYXCT.js";
//#region src/services/provider-registry.ts
var VENDORS = [
	{
		id: "deepseek",
		label: "DeepSeek",
		color: "#4D6BFE",
		mark: "DS",
		hosts: ["deepseek.com"],
		catalog: "deepseek",
		modelPrefixes: ["deepseek-"]
	},
	{
		id: "openai",
		label: "OpenAI",
		color: "#10A37F",
		mark: "OA",
		hosts: ["openai.com", "openai.azure.com"],
		catalog: "openai",
		modelPrefixes: [
			"gpt-",
			"o1",
			"o3",
			"o4",
			"chatgpt-",
			"codex-"
		]
	},
	{
		id: "anthropic",
		label: "Anthropic",
		color: "#D97757",
		mark: "A",
		hosts: ["anthropic.com", "claude.ai"],
		catalog: "anthropic",
		modelPrefixes: ["claude-"]
	},
	{
		id: "google",
		label: "Google Gemini",
		color: "#4285F4",
		mark: "G",
		hosts: [
			"googleapis.com",
			"generativelanguage.googleapis.com",
			"google.com"
		],
		catalog: "google",
		modelPrefixes: [
			"gemini-",
			"gemma-",
			"learnlm-"
		]
	},
	{
		id: "xai",
		label: "xAI",
		color: "#111827",
		mark: "X",
		hosts: ["x.ai"],
		catalog: "xai",
		modelPrefixes: ["grok-"]
	},
	{
		id: "moonshot",
		label: "Moonshot / Kimi",
		color: "#1F1F1F",
		mark: "K",
		hosts: [
			"moonshot.cn",
			"moonshot.ai",
			"kimi.com",
			"kimi.ai"
		],
		catalog: "moonshotai",
		modelPrefixes: ["kimi-", "moonshot-"]
	},
	{
		id: "zhipu",
		label: "Z.ai / 智谱 GLM",
		color: "#3859FF",
		mark: "智",
		hosts: [
			"bigmodel.cn",
			"z.ai",
			"zhipuai.cn"
		],
		catalog: "zai",
		modelPrefixes: ["glm-", "zai-"]
	},
	{
		id: "minimax",
		label: "MiniMax",
		color: "#F23F5D",
		mark: "MM",
		hosts: [
			"minimaxi.com",
			"minimaxi.io",
			"minimax.chat",
			"minimax.io"
		],
		catalog: "minimax",
		modelPrefixes: [
			"minimax-",
			"abab",
			"m2",
			"hailuo"
		]
	},
	{
		id: "mistral",
		label: "Mistral",
		color: "#FF7000",
		mark: "MI",
		hosts: ["mistral.ai"],
		catalog: "mistral",
		modelPrefixes: [
			"mistral-",
			"codestral-",
			"pixtral-",
			"magistral-",
			"devstral-",
			"ministral-"
		]
	},
	{
		id: "cohere",
		label: "Cohere",
		color: "#39594D",
		mark: "C",
		hosts: ["cohere.ai", "cohere.com"],
		catalog: "cohere",
		modelPrefixes: [
			"command-",
			"c4ai-",
			"embed-"
		]
	},
	{
		id: "openrouter",
		label: "OpenRouter",
		color: "#6467F2",
		mark: "OR",
		hosts: ["openrouter.ai"],
		catalog: null,
		modelPrefixes: []
	},
	{
		id: "siliconflow",
		label: "硅基流动",
		color: "#7C3AED",
		mark: "硅",
		hosts: ["siliconflow.cn", "siliconflow.com"],
		catalog: null,
		modelPrefixes: []
	},
	{
		id: "stepfun",
		label: "阶跃星辰",
		color: "#0E7490",
		mark: "阶",
		hosts: ["stepfun.com", "stepfun.ai"],
		catalog: null,
		modelPrefixes: ["step-"]
	},
	{
		id: "novita",
		label: "Novita",
		color: "#0EA5E9",
		mark: "N",
		hosts: ["novita.ai"],
		catalog: null,
		modelPrefixes: []
	},
	{
		id: "groq",
		label: "Groq",
		color: "#F55036",
		mark: "GQ",
		hosts: ["groq.com"],
		catalog: null,
		modelPrefixes: []
	},
	{
		id: "together",
		label: "Together",
		color: "#0F6FFF",
		mark: "T",
		hosts: ["together.xyz", "together.ai"],
		catalog: null,
		modelPrefixes: []
	},
	{
		id: "fireworks",
		label: "Fireworks",
		color: "#F97316",
		mark: "FW",
		hosts: ["fireworks.ai"],
		catalog: null,
		modelPrefixes: []
	},
	{
		id: "dashscope",
		label: "阿里云百炼 / 通义",
		color: "#FF6A00",
		mark: "通",
		hosts: [
			"aliyuncs.com",
			"dashscope.aliyuncs.com",
			"aliyun.com"
		],
		catalog: null,
		modelPrefixes: [
			"qwen",
			"qwq-",
			"qvq-"
		]
	},
	{
		id: "volcengine",
		label: "火山方舟 / 豆包",
		color: "#1664FF",
		mark: "火",
		hosts: [
			"volces.com",
			"volcengine.com",
			"bytepluses.com"
		],
		catalog: null,
		modelPrefixes: ["doubao-", "ep-"]
	},
	{
		id: "baidu",
		label: "百度千帆 / 文心",
		color: "#2932E1",
		mark: "百",
		hosts: ["baidubce.com", "baidu.com"],
		catalog: null,
		modelPrefixes: ["ernie-"]
	},
	{
		id: "tencent",
		label: "腾讯混元",
		color: "#0052D9",
		mark: "混",
		hosts: ["tencentcloudapi.com", "tencent.com"],
		catalog: null,
		modelPrefixes: ["hunyuan-"]
	},
	{
		id: "xfyun",
		label: "讯飞星火",
		color: "#1F7AFF",
		mark: "讯",
		hosts: ["xf-yun.com", "xfyun.cn"],
		catalog: null,
		modelPrefixes: ["spark-", "generalv"]
	},
	{
		id: "github",
		label: "GitHub Models",
		color: "#24292F",
		mark: "GH",
		hosts: [
			"githubcopilot.com",
			"models.github.ai",
			"github.com"
		],
		catalog: null,
		modelPrefixes: []
	},
	{
		id: "cursor",
		label: "Cursor",
		color: "#111827",
		mark: "CU",
		hosts: ["cursor.com", "cursor.sh"],
		catalog: null,
		modelPrefixes: []
	}
];
/** 酒馆接入类型 → 供应商 */
var SOURCE_TYPE_MAP = {
	deepseek: "deepseek",
	openai: "openai",
	claude: "anthropic",
	makersuite: "google",
	vertexai: "google",
	mistralai: "mistral",
	xai: "xai",
	moonshot: "moonshot",
	zai: "zhipu",
	minimax: "minimax",
	cohere: "cohere",
	groq: "groq",
	together: "together",
	fireworks: "fireworks",
	dashscope: "dashscope",
	volcengine: "volcengine",
	baidu: "baidu",
	hunyuan: "tencent",
	xfyun: "xfyun",
	openrouter: "openrouter"
};
function vendorById(id) {
	const key = String(id || "").trim().toLowerCase();
	if (!key) return null;
	return VENDORS.find((vendor) => vendor.id === key) || null;
}
/** 从任意地址/标签文本中提取主机名（无协议亦可） */
function extractHost(raw) {
	const text = String(raw ?? "").trim().toLowerCase();
	if (!text) return "";
	const host = text.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split("/")[0].split("?")[0].split("#")[0].split(":")[0].replace(/^www\./, "");
	return host.includes(".") ? host : "";
}
/** 主机名 → 供应商：要求主域精确或子域后缀匹配，避免仿冒域名误判 */
function vendorFromHost(host) {
	const target = extractHost(host);
	if (!target) return null;
	let best = null;
	let bestLength = 0;
	for (const vendor of VENDORS) for (const domain of vendor.hosts) if (target === domain || target.endsWith("." + domain)) {
		if (domain.length > bestLength) {
			best = vendor;
			bestLength = domain.length;
		}
	}
	return best;
}
/**
* 供应商识别四级回退：接入地址 → 接入类型 → 模型名前缀。
* 全部失败返回 null（UI 退回单字符标识）。
*/
function resolveVendor(input) {
	for (const raw of [
		input.endpointDisplay,
		input.endpointLabel,
		input.endpointId
	]) {
		const vendor = vendorFromHost(String(raw ?? ""));
		if (vendor) return vendor;
	}
	const bySource = SOURCE_TYPE_MAP[String(input.sourceType || "").trim().toLowerCase()];
	if (bySource) return vendorById(bySource) || null;
	const models = (input.models || []).map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
	if (models.length) {
		const counts = /* @__PURE__ */ new Map();
		for (const model of models) for (const vendor of VENDORS) {
			if (!vendor.modelPrefixes.length) continue;
			if (vendor.modelPrefixes.some((prefix) => model.startsWith(prefix))) counts.set(vendor.id, (counts.get(vendor.id) || 0) + 1);
		}
		let winner = null;
		let winnerCount = 0;
		for (const [id, count] of counts) if (count > winnerCount) {
			winner = id;
			winnerCount = count;
		}
		if (winner && winnerCount * 2 >= models.length) return vendorById(winner);
	}
	return null;
}
/** 未识别时的兜底字标：取名称首个有意义字符（剥离协议与 api./www. 前缀） */
function vendorInitialFallback(name) {
	const first = String(name || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/^api\./i, "").replace(/^[^0-9a-zA-Z\u4e00-\u9fa5]+/, "").charAt(0);
	return first ? first.toUpperCase() : "?";
}
//#endregion
//#region src/services/balance-adapters.ts
function ok(adapterId, patch) {
	return {
		adapterId,
		ok: true,
		...patch
	};
}
function fail(adapterId, reason, message) {
	return {
		adapterId,
		ok: false,
		reason,
		message
	};
}
/** 从钱包接入地址推导 base（协议 + 主机），失败回落到适配器默认域名 */
function resolveBase(ctx, fallback) {
	if (ctx.baseUrl) return ctx.baseUrl.replace(/\/+$/, "");
	const raw = String(ctx.wallet.endpointDisplay || ctx.wallet.endpointLabel || "").trim();
	const host = extractHost(raw);
	if (!host) return fallback;
	return (/^http:\/\//i.test(raw) ? "http" : "https") + "://" + host;
}
function authHeaders(ctx, style) {
	const headers = { Accept: "application/json" };
	if (style === "bearer" || style === "bearer+user-id") headers.Authorization = "Bearer " + ctx.apiKey;
	else if (style === "raw") headers.Authorization = ctx.apiKey;
	else if (style === "api-key-header") headers["api-key"] = ctx.apiKey;
	if (style === "bearer+user-id" && ctx.userId) headers["New-Api-User"] = ctx.userId;
	return headers;
}
async function getJson(url, headers, ctx, adapterId) {
	const fetchImpl = ctx.fetchImpl || fetch;
	let response;
	try {
		response = await fetchImpl(url, {
			method: "GET",
			headers
		});
	} catch (error) {
		const message = String(error?.message || error);
		return fail(adapterId, /failed to fetch|networkerror|load failed/i.test(message) ? "cors" : "network", message);
	}
	if (response.status === 401 || response.status === 403) return fail(adapterId, "auth", "HTTP " + response.status + "：密钥或令牌无效/类型不符");
	if (!response.ok) return fail(adapterId, "http", "HTTP " + response.status);
	try {
		return await response.json();
	} catch {
		return fail(adapterId, "parse", "响应不是合法 JSON");
	}
}
function isFailure(value) {
	return !!value && typeof value === "object" && "ok" in value && "adapterId" in value;
}
function numberFrom(value) {
	const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
	return Number.isFinite(parsed) ? parsed : null;
}
function quota(id, label, unit, used, limit, resetAt, now = Date.now()) {
	return {
		id,
		label,
		unit,
		used,
		limit,
		remaining: used != null && limit != null ? Math.max(0, limit - used) : null,
		resetAt,
		source: "remote",
		checkedAt: now
	};
}
var deepseek = {
	id: "deepseek",
	label: "DeepSeek 官方余额",
	vendor: "deepseek",
	defaultBase: "https://api.deepseek.com",
	authStyle: "bearer",
	supports: {
		balance: true,
		plan: false
	},
	run: async (ctx) => {
		const data = await getJson(resolveBase(ctx, deepseek.defaultBase) + "/user/balance", authHeaders(ctx, "bearer"), ctx, deepseek.id);
		if (isFailure(data)) return data;
		const info = Array.isArray(data?.balance_infos) ? data.balance_infos[0] : null;
		const amount = info ? String(info.total_balance ?? "") : "";
		if (!amount) return fail(deepseek.id, "parse", "未返回余额字段");
		const currency = String(info?.currency || "").toUpperCase() === "USD" ? "USD" : "CNY";
		return ok(deepseek.id, { balance: {
			amount,
			currency
		} });
	}
};
var moonshot = {
	id: "moonshot",
	label: "Moonshot / Kimi 余额",
	vendor: "moonshot",
	defaultBase: "https://api.moonshot.cn",
	authStyle: "bearer",
	supports: {
		balance: true,
		plan: false
	},
	note: "Kimi For Coding 套餐额度接口未开放跨域，只能用本地估算",
	run: async (ctx) => {
		const base = resolveBase(ctx, moonshot.defaultBase);
		const data = await getJson(base + "/v1/users/me/balance", authHeaders(ctx, "bearer"), ctx, moonshot.id);
		if (isFailure(data)) return data;
		const body = data?.data ?? data;
		const amount = body?.available_balance ?? body?.balance;
		if (amount == null) return fail(moonshot.id, "parse", "未返回余额字段");
		const currency = /moonshot\.ai$/.test(base) ? "USD" : "CNY";
		return ok(moonshot.id, { balance: {
			amount: String(amount),
			currency
		} });
	}
};
var siliconflow = {
	id: "siliconflow",
	label: "硅基流动余额",
	vendor: "siliconflow",
	defaultBase: "https://api.siliconflow.cn",
	authStyle: "bearer",
	supports: {
		balance: true,
		plan: false
	},
	run: async (ctx) => {
		const data = await getJson(resolveBase(ctx, siliconflow.defaultBase) + "/v1/user/info", authHeaders(ctx, "bearer"), ctx, siliconflow.id);
		if (isFailure(data)) return data;
		const body = data?.data ?? data;
		const amount = body?.totalBalance ?? body?.balance ?? body?.chargeBalance;
		if (amount == null) return fail(siliconflow.id, "parse", "未返回余额字段");
		return ok(siliconflow.id, { balance: {
			amount: String(amount),
			currency: "CNY"
		} });
	}
};
var openrouter = {
	id: "openrouter",
	label: "OpenRouter 额度",
	vendor: "openrouter",
	defaultBase: "https://openrouter.ai",
	authStyle: "bearer",
	supports: {
		balance: true,
		plan: false
	},
	run: async (ctx) => {
		const data = await getJson(resolveBase(ctx, openrouter.defaultBase) + "/api/v1/credits", authHeaders(ctx, "bearer"), ctx, openrouter.id);
		if (isFailure(data)) return data;
		const body = data?.data ?? data;
		const total = numberFrom(body?.total_credits);
		const usage = numberFrom(body?.total_usage);
		if (total == null || usage == null) return fail(openrouter.id, "parse", "未返回 credits 字段");
		const amount = Math.max(0, total - usage);
		return ok(openrouter.id, { balance: {
			amount: amount.toFixed(4),
			currency: "USD"
		} });
	}
};
var stepfun = {
	id: "stepfun",
	label: "阶跃星辰余额",
	vendor: "stepfun",
	defaultBase: "https://api.stepfun.com",
	authStyle: "bearer",
	supports: {
		balance: true,
		plan: false
	},
	run: async (ctx) => {
		const data = await getJson(resolveBase(ctx, stepfun.defaultBase) + "/v1/accounts", authHeaders(ctx, "bearer"), ctx, stepfun.id);
		if (isFailure(data)) return data;
		const body = data?.data ?? data;
		const amount = body?.balance ?? body?.available_balance ?? body?.total_balance;
		if (amount == null) return fail(stepfun.id, "parse", "未返回余额字段");
		return ok(stepfun.id, { balance: {
			amount: String(amount),
			currency: "CNY"
		} });
	}
};
var novita = {
	id: "novita",
	label: "Novita 余额",
	vendor: "novita",
	defaultBase: "https://api.novita.ai",
	authStyle: "api-key-header",
	supports: {
		balance: true,
		plan: false
	},
	run: async (ctx) => {
		const data = await getJson(resolveBase(ctx, novita.defaultBase) + "/v3/user/balance", authHeaders(ctx, "api-key-header"), ctx, novita.id);
		if (isFailure(data)) return data;
		const amount = data?.availableBalance ?? data?.balance ?? data?.data?.balance;
		if (amount == null) return fail(novita.id, "parse", "未返回余额字段");
		return ok(novita.id, { balance: {
			amount: String(amount),
			currency: "USD"
		} });
	}
};
/** 智谱 GLM Coding Plan：返回 5 小时 + 每周两个 TOKENS_LIMIT（按重置时间升序） */
var zhipu = {
	id: "zhipu",
	label: "智谱 GLM 套餐额度",
	vendor: "zhipu",
	defaultBase: "https://open.bigmodel.cn",
	authStyle: "raw",
	supports: {
		balance: false,
		plan: true
	},
	note: "鉴权用裸 API Key（不加 Bearer 前缀）",
	run: async (ctx) => {
		const data = await getJson(resolveBase(ctx, zhipu.defaultBase) + "/api/monitor/usage/quota/limit", authHeaders(ctx, "raw"), ctx, zhipu.id);
		if (isFailure(data)) return data;
		if (data?.success === false) return fail(zhipu.id, "auth", String(data?.msg || "查询失败"));
		const tokens = (Array.isArray(data?.data?.limits) ? data.data.limits : []).filter((item) => item && item.type === "TOKENS_LIMIT").sort((a, b) => Number(a.nextResetTime || 0) - Number(b.nextResetTime || 0));
		const quotas = [];
		tokens.forEach((item, index) => {
			const used = numberFrom(item.percentage);
			const resetAt = numberFrom(item.nextResetTime);
			quotas.push(quota(index === 0 ? "5h" : index === 1 ? "7d" : "w" + (index + 1), index === 0 ? "5 小时额度" : index === 1 ? "每周额度" : "额度 " + (index + 1), "percent", used, 100, resetAt));
		});
		if (!quotas.length) return fail(zhipu.id, "parse", "未返回额度窗口");
		return ok(zhipu.id, { quotas });
	}
};
/** MiniMax Token Plan：注意 current_interval_usage_count 语义是**剩余** */
var minimax = {
	id: "minimax",
	label: "MiniMax 套餐额度",
	vendor: "minimax",
	defaultBase: "https://api.minimaxi.com",
	authStyle: "bearer",
	supports: {
		balance: false,
		plan: true
	},
	experimental: true,
	note: "返回字段为「剩余次数」，已按剩余语义换算",
	run: async (ctx) => {
		const data = await getJson(resolveBase(ctx, minimax.defaultBase) + "/v1/api/openplatform/coding_plan/remains", authHeaders(ctx, "bearer"), ctx, minimax.id);
		if (isFailure(data)) return data;
		const body = data?.data ?? data;
		const quotas = [];
		const push = (id, label, usedCount, totalCount, resetAt, remainingCount) => {
			const total = numberFrom(totalCount);
			const remainingRaw = numberFrom(remainingCount);
			const used = numberFrom(usedCount);
			if (total == null && remainingRaw == null) return;
			const remaining = remainingRaw != null ? remainingRaw : total != null && used != null ? total - used : null;
			quotas.push({
				id,
				label,
				unit: "count",
				used: total != null && remaining != null ? Math.max(0, total - remaining) : used,
				limit: total,
				remaining,
				resetAt: numberFrom(resetAt),
				source: "remote",
				checkedAt: Date.now()
			});
		};
		const entry = Array.isArray(body?.model_remains) ? body.model_remains[0] : body;
		push("5h", "5 小时额度", entry?.current_interval_total_count, entry?.current_interval_total_count, entry?.current_interval_reset_at ?? entry?.current_interval_end_time, entry?.current_interval_usage_count);
		push("7d", "每周额度", entry?.current_weekly_total_count, entry?.current_weekly_total_count, entry?.current_weekly_reset_at ?? entry?.current_weekly_end_time, entry?.current_weekly_usage_count);
		if (!quotas.length) return fail(minimax.id, "parse", "未返回额度字段");
		return ok(minimax.id, { quotas });
	}
};
/** new-api / one-api 中转：订阅额度 − 已用 */
var newApi = {
	id: "new-api",
	label: "new-api / one-api 中转额度",
	vendor: null,
	defaultBase: "",
	authStyle: "bearer+user-id",
	supports: {
		balance: true,
		plan: true
	},
	experimental: true,
	note: "需填系统访问令牌（不是 sk- API Key）与用户 ID",
	run: async (ctx) => {
		const base = resolveBase(ctx, "");
		if (!base) return fail(newApi.id, "no-endpoint", "钱包没有可用接入地址");
		const headers = authHeaders(ctx, "bearer+user-id");
		const subscription = await getJson(base + "/dashboard/billing/subscription", headers, ctx, newApi.id);
		if (isFailure(subscription)) return subscription;
		const hard = numberFrom(subscription?.hard_limit_usd ?? subscription?.system_hard_limit_usd ?? subscription?.soft_limit_usd);
		const usage = await getJson(base + "/dashboard/billing/usage", headers, ctx, newApi.id);
		const totalUsage = isFailure(usage) ? null : numberFrom(usage?.total_usage);
		if (hard == null && totalUsage == null) return fail(newApi.id, "parse", "未返回额度字段");
		const usedUsd = totalUsage != null ? totalUsage / 100 : 0;
		const amount = hard != null ? Math.max(0, hard - usedUsd) : null;
		const quotas = hard != null ? [quota("1m", "订阅额度（累计）", "cost", usedUsd, hard, Number(subscription?.access_until) || null)] : [];
		return ok(newApi.id, {
			balance: amount != null ? {
				amount: amount.toFixed(4),
				currency: "USD"
			} : void 0,
			quotas
		});
	}
};
var BALANCE_ADAPTERS = [
	deepseek,
	moonshot,
	siliconflow,
	openrouter,
	stepfun,
	novita,
	zhipu,
	minimax,
	newApi
];
function adapterById(id) {
	const key = String(id || "").trim().toLowerCase();
	if (!key) return null;
	return BALANCE_ADAPTERS.find((adapter) => adapter.id === key) || null;
}
var VENDOR_ADAPTER = {
	deepseek: "deepseek",
	moonshot: "moonshot",
	siliconflow: "siliconflow",
	openrouter: "openrouter",
	stepfun: "stepfun",
	novita: "novita",
	zhipu: "zhipu",
	minimax: "minimax"
};
/**
* 钱包 → 适配器：显式指定优先；否则只对**已知官方域名**自动识别，
* 未知中转站不猜（避免向用户站点发莫名其妙的请求），需在 UI 手动选 new-api。
*/
function resolveBalanceAdapter(wallet) {
	if (!wallet) return null;
	const explicit = adapterById(wallet.balance?.adapter || "");
	if (explicit) return explicit;
	const host = extractHost(wallet.endpointDisplay || wallet.endpointLabel || "");
	const vendor = host ? vendorFromHost(host) : null;
	if (vendor) {
		const byHost = BALANCE_ADAPTERS.find((adapter) => adapter.vendor === vendor.id);
		if (byHost) return byHost;
	}
	const byVendor = VENDOR_ADAPTER[wallet.catalogProvider || ""];
	if (byVendor && wallet.kind === "official") return adapterById(byVendor);
	return null;
}
async function probeWallet(wallet, apiKey, opts = {}) {
	const adapter = resolveBalanceAdapter(wallet);
	if (!adapter) return null;
	if (!apiKey) return fail(adapter.id, "missing-key", "请先填写该钱包的查询密钥");
	try {
		return await adapter.run({
			wallet,
			apiKey,
			userId: opts.userId,
			fetchImpl: opts.fetchImpl
		});
	} catch (error) {
		return fail(adapter.id, "network", String(error?.message || error));
	}
}
//#endregion
//#region src/services/balance.ts
var balance_exports = /* @__PURE__ */ __exportAll({
	canAutoCalibrate: () => canAutoCalibrate,
	queryBalance: () => queryBalance,
	queryWalletBalance: () => queryWalletBalance,
	restartBalanceTimer: () => restartBalanceTimer,
	saveApiKey: () => saveApiKey,
	stopBalanceTimer: () => stopBalanceTimer
});
function saveApiKey(key) {
	saveWalletApiKey(DEEPSEEK_WALLET_ID, key);
}
/** 是否支持自动查询（余额或套餐任一） */
function canAutoCalibrate(wallet) {
	return resolveBalanceAdapter(wallet) !== null;
}
var FAIL_REASON_LABEL = {
	cors: "该站点未开放浏览器跨域，请改用通用方式或手工填写",
	auth: "密钥/令牌无效或类型不符",
	http: "接口返回错误状态",
	network: "网络不可达",
	parse: "响应格式无法解析",
	"missing-key": "请先填写该钱包的查询密钥",
	"no-endpoint": "钱包没有可用接入地址"
};
var balanceInFlight = /* @__PURE__ */ new Set();
/**
* 查询钱包余额与套餐额度。
* 余额写入 wallet.balance；套餐快照写入 wallet.plan.remote（仅展示，不参与计费）。
*/
async function queryWalletBalance(walletId, silent = false) {
	const wallet = repository.getWallet(walletId);
	if (!wallet) {
		if (!silent) toast("error", "钱包不存在");
		return null;
	}
	const adapter = resolveBalanceAdapter(wallet);
	if (!adapter) {
		if (!silent) toast("warning", "当前接入没有可用的自动查询适配器，请使用手工余额");
		return null;
	}
	if (balanceInFlight.has(walletId)) return null;
	balanceInFlight.add(walletId);
	try {
		const probe = await probeWallet(wallet, getWalletApiKey(walletId), { userId: wallet.balance?.userId || "" });
		if (!probe) return null;
		const now = Date.now();
		if (!probe.ok) {
			const message = FAIL_REASON_LABEL[probe.reason || "network"] || probe.message || "查询失败";
			repository.updateWallet(walletId, (next) => {
				const plan = next.plan || {
					enabled: false,
					windows: []
				};
				plan.remoteError = message;
				next.plan = plan;
			});
			if (!silent) toast("error", adapter.label + "：" + message + (probe.message && probe.reason === "http" ? "（" + probe.message + "）" : ""));
			return null;
		}
		let updated = wallet;
		if (probe.balance) {
			const amount = String(probe.balance.amount);
			const currency = probe.balance.currency;
			updated = repository.setWalletBalance(walletId, amount, currency, true);
			if (walletId === "wallet:deepseek-official") state.balance = {
				balance: amount,
				currency,
				available: true,
				timestamp: now
			};
		}
		if (probe.quotas && probe.quotas.length) updated = repository.updateWallet(walletId, (next) => {
			const plan = next.plan || {
				enabled: false,
				windows: []
			};
			plan.remote = probe.quotas;
			plan.remoteAt = now;
			plan.remoteError = null;
			next.plan = plan;
		}) || updated;
		else if (wallet.plan?.remoteError) repository.updateWallet(walletId, (next) => {
			if (!next.plan) return;
			next.plan.remoteError = null;
		});
		try {
			globalThis.ApiUsageStat?.refreshUI?.();
		} catch {}
		if (!silent) {
			const parts = [];
			if (probe.balance) parts.push("余额 " + (probe.balance.currency === "USD" ? "$" : "¥") + probe.balance.amount);
			if (probe.quotas?.length) parts.push("套餐 " + probe.quotas.length + " 个窗口");
			toast("success", (updated || wallet).name + "：" + (parts.join(" · ") || "已更新"));
		}
		return updated || null;
	} catch (error) {
		log.error("余额查询失败", error);
		if (!silent) toast("error", "查询失败：" + (error?.message || error));
		return null;
	} finally {
		balanceInFlight.delete(walletId);
	}
}
/** 兼容旧调用：与概览选择器一致，默认校准 DeepSeek 官方钱包。 */
async function queryBalance(silent = false) {
	const selected = String(state.settings.overviewWalletId || "all");
	return queryWalletBalance(selected === "all" ? DEEPSEEK_WALLET_ID : selected, silent);
}
var balanceTimer = null;
function restartBalanceTimer() {
	if (balanceTimer) {
		try {
			clearInterval(balanceTimer);
		} catch {}
		balanceTimer = null;
	}
	const settings = state.settings;
	const ignored = new Set(state.walletIgnored || []);
	if (!(state.wallets || []).filter((wallet) => {
		if (ignored.has(wallet.id)) return false;
		if (!canAutoCalibrate(wallet)) return false;
		return wallet.balance.mode === "auto" || wallet.plan?.enabled === true;
	}).length) return;
	const minutes = Math.min(Math.max(parseInt(settings.balanceInterval) || 10, 1), 1440);
	balanceTimer = setInterval(() => {
		const currentIgnored = new Set(state.walletIgnored || []);
		for (const wallet of state.wallets || []) {
			if (currentIgnored.has(wallet.id) || !canAutoCalibrate(wallet)) continue;
			if (wallet.balance.mode !== "auto" && wallet.plan?.enabled !== true) continue;
			queryWalletBalance(wallet.id, true).catch(() => {});
		}
	}, minutes * 60 * 1e3);
}
function stopBalanceTimer() {
	if (balanceTimer) {
		try {
			clearInterval(balanceTimer);
		} catch {}
		balanceTimer = null;
	}
}
//#endregion
export { BALANCE_ADAPTERS as a, vendorById as c, saveApiKey as i, vendorInitialFallback as l, queryBalance as n, resolveBalanceAdapter as o, queryWalletBalance as r, resolveVendor as s, balance_exports as t };
