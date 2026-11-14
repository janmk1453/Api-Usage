import { pn as __exportAll } from "./graphic-BAx7jeh4.js";
import { r as on, t as DataEvents } from "./events-BD2MbRMW.js";
//#region src/services/request-tap/classify.ts
var THIRD_PARTY = "/scripts/extensions/third-party/";
/** 从一段路径里取出扩展名：.../third-party/<name>/... → <name> */
function pluginNameFromPath(path) {
	if (!path) return null;
	const idx = path.indexOf(THIRD_PARTY);
	if (idx === -1) return null;
	return path.slice(idx + 32).split(/[/?#]/)[0] || null;
}
/**
* 由执行上下文推发起方。
* isTop=true 表示补丁装在宿主窗口上（酒馆自身发起），此时还不能排除插件经 parent.fetch 发出的请求，
* 需要再用调用栈复核（见 actorFromStack）。
*/
function actorFromLocation(input) {
	const id = String(input.frameSrc || input.href || "");
	const plugin = pluginNameFromPath(id);
	if (plugin) return {
		kind: "plugin",
		id,
		label: plugin
	};
	if (input.isTop) return {
		kind: "tavern",
		id: id || "main",
		label: "酒馆主窗"
	};
	if (!id) return {
		kind: "unknown",
		id: "",
		label: "未知来源"
	};
	return {
		kind: "unknown",
		id,
		label: id.split("/").filter(Boolean).pop() || "未知来源"
	};
}
/** 从调用栈里找扩展路径（比上下文更细：能定位到具体插件，即使补丁装在主窗上） */
function actorFromStack(stack) {
	if (!stack) return null;
	for (const raw of stack.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		if (line.indexOf("request-tap") !== -1) continue;
		const plugin = pluginNameFromPath(line);
		if (plugin) return {
			kind: "plugin",
			id: line,
			label: plugin
		};
	}
	return null;
}
/** 调用栈里第一条有意义的帧（去掉探针自身与浏览器内部帧） */
function stackTopFrame(stack) {
	if (!stack) return "";
	for (const raw of stack.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		if (line.indexOf("request-tap") !== -1) continue;
		if (line.startsWith("Error")) continue;
		return line.slice(0, 160);
	}
	return "";
}
/** 32 位字符串指纹（不需要密码学强度，只要稳定） */
function fingerprint(text) {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
	}
	return h.toString(16).padStart(8, "0");
}
function promptHintOf(body) {
	try {
		const msgs = body?.messages;
		if (Array.isArray(msgs) && msgs.length) {
			const last = msgs[msgs.length - 1];
			const text = typeof last?.content === "string" ? last.content : "";
			return (msgs.map((m) => typeof m?.content === "string" ? m.content : "").join(" ") || text).replace(/\s+/g, " ").trim().slice(0, 80);
		}
		const p = body?.prompt;
		if (typeof p === "string") return p.replace(/\s+/g, " ").trim().slice(0, 80);
	} catch {}
	return "";
}
/** 用途规则表：命中即命名；没命中就走结构特征兜底 */
var PURPOSE_RULES = [
	{
		test: /变量|状态栏|mvu|magvar|variable/i,
		label: "变量更新"
	},
	{
		test: /表格|填表|表单|表格数据|table/i,
		label: "填表 / 结构化"
	},
	{
		test: /摘要|总结|summar|memory|记忆/i,
		label: "摘要 / 记忆"
	},
	{
		test: /翻译|translate/i,
		label: "翻译"
	},
	{
		test: /标题|title/i,
		label: "标题生成"
	},
	{
		test: /表情|emoji|image|绘图|画图|提示词/i,
		label: "图像 / 表情"
	}
];
/** 结构特征兜底命名（不猜语义，只说形态） */
function structuralLabel(input) {
	if (input.structured) return "结构化输出";
	if (input.requestType === "quiet") return "静默请求";
	if (input.endpoint === "text") return "文本补全";
	if (input.messageCount <= 2) return "短上下文请求";
	return "长上下文请求";
}
/**
* 生成用途指纹与展示名。
* 指纹刻意做得「粗」：同一插件的同类调用必须落在同一簇里，便于人眼一键命名；
* 语义关键词只影响展示名，不参与指纹（否则改个词就裂成新簇）。
*/
function classifyPurpose(input) {
	const bucket = input.messageCount <= 2 ? "2" : input.messageCount <= 8 ? "8" : "32";
	const key = fingerprint([
		input.actorLabel,
		input.requestType || "-",
		input.structured ? "json" : "text",
		input.endpoint,
		bucket
	].join("|"));
	for (const rule of PURPOSE_RULES) if (rule.test.test(input.promptHint)) return {
		key,
		label: rule.label
	};
	return {
		key,
		label: structuralLabel(input)
	};
}
//#endregion
//#region src/services/request-tap/store.ts
var TAP_STORAGE_KEY = "aus_tap_log_v1";
var cache = null;
var writeTimer = null;
var listeners = /* @__PURE__ */ new Set();
function storage() {
	try {
		return (window.parent || window)?.localStorage ?? (typeof localStorage !== "undefined" ? localStorage : null);
	} catch {
		return null;
	}
}
function load() {
	if (cache) return cache;
	cache = [];
	try {
		const raw = storage()?.getItem(TAP_STORAGE_KEY);
		if (raw) {
			const arr = JSON.parse(raw);
			if (Array.isArray(arr)) cache = arr.filter((r) => r && typeof r.id === "string");
		}
	} catch {}
	return cache;
}
function persist() {
	if (writeTimer) return;
	writeTimer = setTimeout(() => {
		writeTimer = null;
		try {
			storage()?.setItem(TAP_STORAGE_KEY, JSON.stringify(load()));
		} catch {
			try {
				cache = load().slice(-Math.floor(250));
				storage()?.setItem(TAP_STORAGE_KEY, JSON.stringify(cache));
			} catch {}
		}
	}, 240);
}
function emit() {
	for (const fn of listeners) try {
		fn();
	} catch {}
}
/** 当前全部探针记录（按时间升序） */
function listTapRecords() {
	return load().slice();
}
/** 订阅探针记录变化（验证页刷新用） */
function subscribeTap(fn) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}
/** 写入或按 id 覆盖一条记录 */
function upsertTapRecord(record) {
	const list = load();
	const idx = list.findIndex((r) => r.id === record.id);
	if (idx >= 0) list[idx] = record;
	else list.push(record);
	if (list.length > 500) list.splice(0, list.length - 500);
	persist();
	emit();
}
/** 按 id 局部更新（避免整条覆盖时丢字段） */
function patchTapRecord(id, patch) {
	const list = load();
	const idx = list.findIndex((r) => r.id === id);
	if (idx < 0) return false;
	list[idx] = {
		...list[idx],
		...patch
	};
	persist();
	emit();
	return true;
}
/** 清空验证数据 */
function clearTapRecords() {
	cache = [];
	try {
		storage()?.removeItem(TAP_STORAGE_KEY);
	} catch {}
	emit();
}
var PATCH_FLAG = "__ausTapPatched";
var RESCAN_INTERVAL_MS = 4e3;
var seq = 0;
var installed$1 = false;
var rescanTimer = null;
var observer = null;
var restores = [];
function hostWindow() {
	try {
		return window.parent || window;
	} catch {
		return window;
	}
}
function hostDoc() {
	try {
		return hostWindow()?.document ?? document;
	} catch {
		return null;
	}
}
/** 命中的端点类型；不命中返回 null（不采集） */
function endpointOf(url) {
	const u = String(url || "");
	if (u.indexOf("/api/backends/") === -1) return null;
	if (u.indexOf("/generate") === -1) return null;
	if (u.indexOf("text-completions") !== -1) return "text";
	if (u.indexOf("chat-completions") !== -1) return "chat";
	return "other";
}
/** 从 JSON / SSE 文本里取 usage（不依赖 interception 内部实现，保持两边独立） */
function readUsageFromText(text) {
	const raw = String(text || "");
	if (!raw) return null;
	const pick = (u) => {
		if (!u || typeof u !== "object") return null;
		const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
		const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
		const total = Number(u.total_tokens ?? 0) || prompt + completion;
		const hit = Number(u.prompt_cache_hit_tokens ?? u.cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0) || 0;
		if (!prompt && !completion && !total) return null;
		return {
			prompt,
			completion,
			total,
			hit,
			miss: Math.max(0, prompt - hit)
		};
	};
	const trimmed = raw.trim();
	if (trimmed.startsWith("{")) try {
		const data = JSON.parse(trimmed);
		const direct = pick(data?.usage) || pick(data?.data?.usage) || pick(data);
		if (direct) return direct;
	} catch {}
	let found = null;
	for (const line of raw.split("\n")) {
		if (line.indexOf("data:") !== 0) continue;
		const payload = line.slice(5).trim();
		if (!payload || payload === "[DONE]") continue;
		try {
			const chunk = JSON.parse(payload);
			const u = pick(chunk?.usage) || pick(chunk?.choices?.[0]?.usage);
			if (u) found = u;
		} catch {}
	}
	return found;
}
function bodyOf(init, input) {
	try {
		const raw = init?.body;
		if (typeof raw === "string") return JSON.parse(raw);
		if (raw && typeof raw === "object" && !(raw instanceof FormData)) return raw;
		const b = input?.body;
		if (typeof b === "string") return JSON.parse(b);
	} catch {}
	return null;
}
function promptCharsOf(body) {
	try {
		const msgs = body?.messages;
		if (Array.isArray(msgs)) {
			let n = 0;
			for (const m of msgs) if (typeof m?.content === "string") n += m.content.length;
			return n;
		}
		if (typeof body?.prompt === "string") return body.prompt.length;
	} catch {}
	return 0;
}
function begin(url, endpoint, ctxActor, body) {
	let stack = "";
	try {
		stack = String((/* @__PURE__ */ new Error()).stack || "");
	} catch {}
	const stackActor = actorFromStack(stack);
	const actor = stackActor || ctxActor;
	const attribution = stackActor && ctxActor.kind !== "unknown" ? "A" : stackActor ? "B" : "C";
	const hint = promptHintOf(body);
	const purpose = classifyPurpose({
		actorLabel: actor.label,
		requestType: String(body?.type || ""),
		structured: !!(body?.json_schema || body?.response_format || body?.tools),
		messageCount: Array.isArray(body?.messages) ? body.messages.length : 0,
		promptHint: hint,
		endpoint
	});
	return {
		id: "tap:" + Date.now() + ":" + ++seq,
		at: Date.now(),
		url,
		endpoint,
		actor,
		attribution,
		stackTop: stackTopFrame(stack),
		body,
		promptChars: promptCharsOf(body),
		__purpose: purpose
	};
}
function toRecord(ctx, endedAt, status, error) {
	const body = ctx.body;
	const hint = promptHintOf(body);
	const purpose = ctx.__purpose;
	return {
		id: ctx.id,
		at: ctx.at,
		endedAt,
		url: ctx.url,
		endpoint: ctx.endpoint,
		actorKind: ctx.actor.kind,
		actorId: ctx.actor.id.slice(0, 240),
		actorLabel: ctx.actor.label,
		stackTop: ctx.stackTop,
		attribution: ctx.attribution,
		model: String(body?.model || ""),
		requestType: String(body?.type || ""),
		stream: body?.stream === true,
		messageCount: Array.isArray(body?.messages) ? body.messages.length : 0,
		promptChars: ctx.promptChars,
		structured: !!(body?.json_schema || body?.response_format || body?.tools),
		purposeKey: purpose.key,
		purposeLabel: purpose.label,
		promptHint: hint,
		usage: null,
		usageMissing: false,
		durationMs: Math.max(0, endedAt - ctx.at),
		ttftMs: 0,
		status,
		error,
		state: "pending",
		settledBy: null,
		settledAt: null
	};
}
function finalize(ctx, status, reader, error = null) {
	const rec = toRecord(ctx, Date.now(), status, error);
	upsertTapRecord(rec);
	if (!reader) return;
	reader().then((r) => {
		patchTapRecord(rec.id, {
			usage: r.usage,
			usageMissing: !r.usage,
			ttftMs: r.ttft
		});
	}).catch(() => {
		patchTapRecord(rec.id, { usageMissing: true });
	});
}
/** 读 fetch 响应 clone：顺带量首字延迟；只读，不消费原响应 */
async function consumeClone(res) {
	const body = res?.body;
	const t0 = Date.now();
	if (body && typeof body.getReader === "function") {
		const reader = body.getReader();
		const dec = new TextDecoder();
		let text = "";
		let first = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value && value.byteLength) {
				if (!first) first = Date.now() - t0;
				text += dec.decode(value, { stream: true });
				if (text.length > 4e5) text = text.slice(-4e5);
			}
		}
		return {
			usage: readUsageFromText(text),
			ttft: first
		};
	}
	return {
		usage: readUsageFromText(await res.text()),
		ttft: Date.now() - t0
	};
}
function patchWindow(w) {
	try {
		if (!w || !w.fetch || w[PATCH_FLAG]) return;
		w[PATCH_FLAG] = true;
		const actor = actorFromLocation({
			frameSrc: (() => {
				try {
					return w.frameElement?.getAttribute?.("src") || "";
				} catch {
					return "";
				}
			})(),
			href: (() => {
				try {
					return w.location?.href || "";
				} catch {
					return "";
				}
			})(),
			isTop: (() => {
				try {
					return w === w.parent;
				} catch {
					return true;
				}
			})()
		});
		const prevFetch = w.fetch.bind(w);
		const tapFetch = function(input, init) {
			const url = String(typeof input === "string" ? input : input?.url || "");
			const endpoint = endpointOf(url);
			if (!endpoint) return prevFetch(input, init);
			const ctx = begin(url, endpoint, actor, bodyOf(init, input));
			return prevFetch(input, init).then((res) => {
				let status = null;
				try {
					status = typeof res?.status === "number" ? res.status : null;
				} catch {}
				let reader;
				try {
					const clone = res?.clone?.();
					if (clone) reader = () => consumeClone(clone);
				} catch {}
				finalize(ctx, status, reader);
				return res;
			}, (err) => {
				finalize(ctx, null, void 0, String(err?.message || err || "请求异常").slice(0, 200));
				throw err;
			});
		};
		w.fetch = tapFetch;
		restores.push(() => {
			try {
				if (w.fetch === tapFetch) w.fetch = prevFetch;
			} catch {}
		});
		const XP = w.XMLHttpRequest?.prototype;
		if (XP && !XP[PATCH_FLAG]) {
			XP[PATCH_FLAG] = true;
			const prevOpen = XP.open;
			const prevSend = XP.send;
			XP.open = function(method, url) {
				try {
					this.__ausTapUrl = String(url || "");
				} catch {}
				return prevOpen.apply(this, arguments);
			};
			XP.send = function(body) {
				try {
					const url = String(this.__ausTapUrl || "");
					const endpoint = endpointOf(url);
					if (endpoint) {
						const ctx = begin(url, endpoint, actor, bodyOf({ body }, null));
						this.addEventListener("loadend", () => {
							const status = typeof this.status === "number" ? this.status : null;
							finalize(ctx, status, async () => ({
								usage: readUsageFromText(String(this.responseText || "")),
								ttft: 0
							}), status !== null && status >= 200 && status < 400 ? null : "HTTP " + status);
						});
					}
				} catch {}
				return prevSend.apply(this, arguments);
			};
			restores.push(() => {
				try {
					XP.open = prevOpen;
					XP.send = prevSend;
				} catch {}
			});
		}
	} catch {}
}
/** 补扫所有同源 iframe：插件在自己的 iframe 里 fetch 时，只有装到那个 window 上才看得见 */
function scanFrames() {
	try {
		const doc = hostDoc();
		if (!doc) return;
		doc.querySelectorAll("iframe").forEach((frame) => {
			try {
				if (frame.contentWindow) patchWindow(frame.contentWindow);
			} catch {}
		});
	} catch {}
}
/** 安装探针（幂等） */
function installTapCapture() {
	if (installed$1) return;
	installed$1 = true;
	try {
		patchWindow(hostWindow());
	} catch {}
	try {
		patchWindow(window);
	} catch {}
	scanFrames();
	try {
		const doc = hostDoc();
		if (doc && typeof MutationObserver === "function") {
			observer = new MutationObserver(() => {
				try {
					scanFrames();
				} catch {}
			});
			observer.observe(doc.documentElement, {
				childList: true,
				subtree: true
			});
		}
	} catch {}
	rescanTimer = setInterval(scanFrames, RESCAN_INTERVAL_MS);
}
/** 卸载探针（还原被包过的 fetch / XHR） */
function uninstallTapCapture() {
	if (!installed$1) return;
	installed$1 = false;
	try {
		if (rescanTimer) clearInterval(rescanTimer);
	} catch {}
	rescanTimer = null;
	try {
		observer?.disconnect();
	} catch {}
	observer = null;
	for (const restore of restores.splice(0)) try {
		restore();
	} catch {}
}
/** 供调试用：把一段请求手工记进来（不涉及网络） */
function tapDebugRecord(input) {
	const rec = toRecord(begin(input.url, endpointOf(input.url) || "chat", {
		kind: "unknown",
		id: "",
		label: input.actorLabel || "手工"
	}, input.body || null), Date.now(), null, null);
	upsertTapRecord(rec);
	return rec;
}
//#endregion
//#region src/services/request-tap/match.ts
/** 匹配窗口：覆盖酒馆 GENERATION_ENDED → 写库的延迟，同时避免误配相邻请求 */
var MATCH_WINDOW_MS = 2e4;
function normalizeModel(model) {
	return String(model || "").trim().toLowerCase();
}
/** 入账时刻是否落在探针请求的合理时间范围（请求发出 ~ 结束 + 窗口）内 */
function inWindow(s, p, windowMs) {
	const lo = p.at - windowMs;
	const hi = (p.endedAt || p.at) + windowMs;
	return s.ts >= lo && s.ts <= hi;
}
/**
* 为一条探针记录找入账记录。
* 优先级：tokens（prompt+completion 全等）→ total（总数全等，usage 只有总数时兜底）。
* used 里已消费的 id 会被跳过，保证一对一。
*/
function findSettlement(probe, settlements, used, windowMs = MATCH_WINDOW_MS) {
	const model = normalizeModel(probe.model);
	let totalFallback = null;
	for (const s of settlements) {
		if (used.has(s.id)) continue;
		if (model && s.model && normalizeModel(s.model) !== model) continue;
		if (!inWindow(s, probe, windowMs)) continue;
		if (probe.prompt > 0 && probe.completion > 0 && s.prompt === probe.prompt && s.completion === probe.completion) return {
			settlement: s,
			by: "tokens"
		};
		if (!totalFallback && probe.total > 0 && s.total === probe.total) totalFallback = s;
	}
	return totalFallback ? {
		settlement: totalFallback,
		by: "total"
	} : null;
}
/** 探针侧可选用量 → 对账键 */
function probeKeyOf(input) {
	return {
		model: input.model,
		prompt: input.usage?.prompt ?? 0,
		completion: input.usage?.completion ?? 0,
		total: input.usage?.total ?? 0,
		at: input.at,
		endedAt: input.endedAt
	};
}
//#endregion
//#region src/services/request-tap/index.ts
/**
* 请求探针（技术验证版）—— 装配与对账
*
* 对账口径（用户判断）：探针抓到的请求里，现有逻辑记过账的就是常规对话请求，
* 没记过账的才是「非常规对话请求」。因此这里不改采集链路，只订阅既有的
* DataEvents.HISTORY_ADDED 当账本，把探针记录标成 settled / orphan。
*/
var request_tap_exports = /* @__PURE__ */ __exportAll({
	RECONCILE_DELAY_MS: () => RECONCILE_DELAY_MS,
	installRequestTap: () => installRequestTap,
	noteSettlement: () => noteSettlement,
	reconcilePending: () => reconcilePending,
	tapDiagnostics: () => tapDiagnostics,
	uninstallRequestTap: () => uninstallRequestTap
});
/** 入账窗口：酒馆 GENERATION_ENDED → 写库有延迟，留足时间再判定 */
var RECONCILE_DELAY_MS = 12e3;
/** 账本上限：只对账近期请求，更早的入账记录不再参与 */
var SETTLEMENT_MAX = 800;
var RECONCILE_INTERVAL_MS = 3e3;
var settlements = [];
var used = /* @__PURE__ */ new Set();
var reconcileTimer = null;
var unsubscribe = null;
var installed = false;
/** 把一条入账记录放进账本 */
function noteSettlement(entry) {
	try {
		if (!entry) return;
		const ts = Number(entry.timestamp) || Date.now();
		const id = String(entry.requestId || "") || "auto:" + ts + ":" + settlements.length;
		settlements.push({
			id,
			model: String(entry.model || ""),
			prompt: Number(entry.prompt_tokens) || 0,
			completion: Number(entry.completion_tokens) || 0,
			total: Number(entry.total_tokens) || 0,
			ts
		});
		if (settlements.length > SETTLEMENT_MAX) settlements = settlements.slice(-800);
	} catch {}
}
/**
* 扫描一次：到期的 pending 记录按「用量全等 → 总数相等 + 时间窗」对账。
* 命中 → settled（现有逻辑已记过账，属常规对话请求，验证页默认不展示）；
* 不命中 → orphan（现有逻辑没记过账，验证页重点看这些）。
*/
function reconcilePending(now = Date.now()) {
	let all = [];
	try {
		all = listTapRecords();
	} catch {
		return;
	}
	for (const rec of all) {
		if (rec.state !== "pending") continue;
		if (now - (rec.endedAt || rec.at) < 12e3) continue;
		let hit = null;
		if (rec.usage) hit = findSettlement(probeKeyOf({
			model: rec.model,
			usage: rec.usage,
			at: rec.at,
			endedAt: rec.endedAt
		}), settlements, used);
		if (hit) {
			used.add(hit.settlement.id);
			patchTapRecord(rec.id, {
				state: "settled",
				settledBy: hit.by,
				settledAt: now
			});
		} else patchTapRecord(rec.id, {
			state: "orphan",
			settledBy: rec.usage ? null : "no-usage",
			settledAt: now
		});
	}
}
/** 供验证页显示的诊断信息（只读） */
function tapDiagnostics() {
	return {
		settlements: settlements.length,
		consumed: used.size
	};
}
/** 安装探针：采集 + 对账（幂等，与现有 interception 采集完全并行、互不调用） */
function installRequestTap() {
	if (installed) return;
	installed = true;
	try {
		installTapCapture();
	} catch {}
	try {
		unsubscribe = on(DataEvents.HISTORY_ADDED, (entry) => {
			noteSettlement(entry);
		});
	} catch {
		unsubscribe = null;
	}
	reconcileTimer = setInterval(() => {
		try {
			reconcilePending();
		} catch {}
	}, RECONCILE_INTERVAL_MS);
	try {
		globalThis.__ausTap = {
			install: installRequestTap,
			uninstall: uninstallRequestTap,
			reconcile: reconcilePending,
			note: noteSettlement,
			diagnostics: tapDiagnostics,
			record: tapDebugRecord,
			list: listTapRecords,
			clear: clearTapRecords
		};
	} catch {}
}
/** 卸载探针（还原被包过的 fetch / XHR，停掉对账定时器） */
function uninstallRequestTap() {
	if (!installed) return;
	installed = false;
	try {
		if (reconcileTimer) clearInterval(reconcileTimer);
	} catch {}
	reconcileTimer = null;
	try {
		unsubscribe?.();
	} catch {}
	unsubscribe = null;
	try {
		uninstallTapCapture();
	} catch {}
}
//#endregion
export { subscribeTap as a, listTapRecords as i, tapDiagnostics as n, clearTapRecords as r, request_tap_exports as t };
