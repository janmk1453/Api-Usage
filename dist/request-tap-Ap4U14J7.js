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
	if (list.length > 500) {
		let over = list.length - 500;
		for (let i = 0; i < list.length && over > 0;) {
			if (list[i].state === "pending") {
				i += 1;
				continue;
			}
			list.splice(i, 1);
			over -= 1;
		}
		if (over > 0) list.splice(0, over);
	}
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
/**
* 批量改写（一次性重判旧记录用）：updater 返回新记录才写回，返回 null 表示不动。
* 只落盘、通知一次，避免逐条 patch 触发几十次 emit/persist。
*/
function updateTapRecords(updater) {
	const list = load();
	let changed = 0;
	for (let i = 0; i < list.length; i += 1) {
		let next = null;
		try {
			next = updater(list[i]);
		} catch {
			next = null;
		}
		if (next && next !== list[i]) {
			list[i] = next;
			changed += 1;
		}
	}
	if (changed) {
		persist();
		emit();
	}
	return changed;
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
var WIN_STATE = "__ausTapState";
var RESCAN_INTERVAL_MS = 4e3;
/**
* 每个 window 只挂一个还原闭包。
* fetch 可能被宿主反复替换、我们每 4s 重装一次，若每次都 push 一个闭包，
* restores 会随时间无限增长（并一直持有旧 fetch 的引用），长时间开着页面就是内存泄漏。
*/
var restoreHooked = /* @__PURE__ */ new WeakSet();
var seq = 0;
var installed$1 = false;
/**
* 每个 window 当前「在岗」的那一代探针包装。
*
* 判退役只能认这一代自己的身份，不能判 `w.fetch === tapFetch`：
* 采集层（interception.ts）和宿主的自愈守卫都可能又把包装套在我们外面，
* 那时我们仍留在链上、仍是唯一在岗的一代，按 `w.fetch` 判会把自己误判成退役，
* 探针就静默失聪（表现为「采集日志有、探针零记录」）。
*
* 必须按 window 分别记：主窗与各个 iframe 各有自己的 fetch，若共用一个全局变量，
* 给第二个窗口安装时就会把第一个窗口的那一代判成退役，被退役的窗口从此不再记录。
*/
var activeTapByWin = /* @__PURE__ */ new WeakMap();
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
		v: 2,
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
		const settledAt = Date.now();
		const patch = {
			endedAt: settledAt,
			durationMs: Math.max(0, settledAt - ctx.at),
			usage: r.usage,
			usageMissing: !r.usage,
			ttftMs: r.ttft
		};
		if (r.usage) try {
			const cur = listTapRecords().find((x) => x.id === rec.id);
			if (cur && cur.state === "orphan" && (cur.settledBy === "no-usage" || cur.settledBy === "too-short")) {
				patch.state = "pending";
				patch.settledBy = null;
				patch.settledAt = null;
			}
		} catch {}
		patchTapRecord(rec.id, patch);
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
		if (!w || typeof w.fetch !== "function") return;
		const prevState = w[WIN_STATE];
		if (w.fetch.__ausTapActive === true) return;
		if (prevState && prevState.fetch === w.fetch) return;
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
		const prevFetchFn = w.fetch;
		const prevFetch = prevFetchFn.bind(w);
		const tapFetch = function(input, init) {
			if (activeTapByWin.get(w) !== tapFetch) return prevFetch(input, init);
			let ctx = null;
			try {
				const url = String(typeof input === "string" ? input : input?.url || "");
				const endpoint = endpointOf(url);
				if (endpoint) ctx = begin(url, endpoint, actor, bodyOf(init, input));
			} catch {
				ctx = null;
			}
			if (!ctx) return prevFetch(input, init);
			const record = ctx;
			return prevFetch(input, init).then((res) => {
				try {
					let status = null;
					try {
						status = typeof res?.status === "number" ? res.status : null;
					} catch {}
					let reader;
					try {
						const clone = res?.clone?.();
						if (clone) reader = () => consumeClone(clone);
					} catch {}
					finalize(record, status, reader);
				} catch {}
				return res;
			}, (err) => {
				try {
					finalize(record, null, void 0, String(err?.message || err || "请求异常").slice(0, 200));
				} catch {}
				throw err;
			});
		};
		tapFetch[PATCH_FLAG] = true;
		tapFetch.__ausTapActive = true;
		try {
			Object.defineProperty(tapFetch, "__aus_patched", {
				configurable: true,
				get: () => prevFetchFn.__aus_patched === true
			});
		} catch {}
		const prevActive = activeTapByWin.get(w);
		if (prevActive && prevActive !== tapFetch) try {
			prevActive.__ausTapActive = false;
		} catch {}
		activeTapByWin.set(w, tapFetch);
		w.fetch = tapFetch;
		const state = {
			fetch: tapFetch,
			prevFetch,
			xhrOpen: prevState?.xhrOpen,
			xhrSend: prevState?.xhrSend,
			xhrRawOpen: prevState?.xhrRawOpen,
			xhrRawSend: prevState?.xhrRawSend
		};
		w[WIN_STATE] = state;
		const XP = w.XMLHttpRequest?.prototype;
		const xhrInPlace = !!(prevState && XP && prevState.xhrOpen === XP.open && prevState.xhrSend === XP.send);
		if (XP && !xhrInPlace) {
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
			state.xhrOpen = XP.open;
			state.xhrSend = XP.send;
			if (!state.xhrRawOpen) state.xhrRawOpen = prevOpen;
			if (!state.xhrRawSend) state.xhrRawSend = prevSend;
		}
		if (!restoreHooked.has(w)) {
			restoreHooked.add(w);
			restores.push(() => {
				try {
					const cur = w[WIN_STATE];
					w[WIN_STATE] = null;
					try {
						if (activeTapByWin.get(w) === cur?.fetch) activeTapByWin.delete(w);
					} catch {}
					if (!cur) return;
					if (w.fetch === cur.fetch) w.fetch = cur.prevFetch;
					const P = w.XMLHttpRequest?.prototype;
					if (P) {
						if (cur.xhrOpen && P.open === cur.xhrOpen && cur.xhrRawOpen) P.open = cur.xhrRawOpen;
						if (cur.xhrSend && P.send === cur.xhrSend && cur.xhrRawSend) P.send = cur.xhrRawSend;
					}
				} catch {}
			});
		}
	} catch {}
}
/**
* 补扫：主窗 + 所有同源 iframe。宿主随时可能换掉 window.fetch / XMLHttpRequest
* （TauriTavern 重绑、ST 刷新、别的补丁再包一层），所以这里必须周期性重装，
* 否则探针会静默失聪——3.2.3 里那两轮请求零记录就是缺了这一步。
*/
function scanFrames() {
	try {
		patchWindow(hostWindow());
		patchWindow(window);
	} catch {}
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
var MATCH_WINDOW_MS = 6e4;
/**
* 去掉模型名前缀标签（`[A]`、`[Proxy]`、`[抗截断]` 这类），只用于对账比较。
*
* 探针抓的是请求体原样的模型名，而入账记录的 `entry.model` 已经被扩展归一过
* （前缀留在 `rawModel`）。不做这一步，`[A]gemini-3.8-flash` 与
* `gemini-3.8-flash` 永远对不上，整类请求会被误判成「没记进历史」。
* 展示仍用原名，这里只在比较时剥掉。
*/
function stripModelTag(model) {
	return String(model || "").trim().replace(/^\[[^\]]{1,24}\]\s*/, "");
}
function normalizeModel(model) {
	return stripModelTag(model).toLowerCase();
}
/**
* 宽松模型名比较：反代 / 上游经常在模型名后面挂档位后缀
* （`deepseek-v4.1-flash` → `deepseek-v4.1-flash-free`、`-thinking`、`-preview`）。
* 严格相等会把「确实记过账」的请求判成没记录——3.2.3 里那条 missing-usage 假警报就是这么来的。
* 只允许在 `-` 分隔符处截断，且后缀不以数字开头，避免 `deepseek-v4` 撞上 `deepseek-v4.1-flash`。
*/
function modelLooseMatch(a, b) {
	const x = normalizeModel(a);
	const y = normalizeModel(b);
	if (!x || !y) return false;
	if (x === y) return true;
	const [short, long] = x.length <= y.length ? [x, y] : [y, x];
	if (!long.startsWith(short)) return false;
	const rest = long.slice(short.length);
	return rest.startsWith("-") && rest.length <= 24 && !/^-\d/.test(rest);
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
	const looseCandidates = [];
	for (const s of settlements) {
		if (used.has(s.id)) continue;
		if (!inWindow(s, probe, windowMs)) continue;
		const sModel = normalizeModel(s.model);
		const tokenEq = probe.prompt > 0 && probe.completion > 0 && s.prompt === probe.prompt && s.completion === probe.completion;
		if (model && sModel && sModel !== model) {
			if (tokenEq) looseCandidates.push(s);
			continue;
		}
		if (tokenEq) return {
			settlement: s,
			by: "tokens"
		};
		if (!totalFallback && probe.total > 0 && s.total === probe.total) totalFallback = s;
	}
	if (totalFallback) return {
		settlement: totalFallback,
		by: "total"
	};
	for (const s of looseCandidates) if (modelLooseMatch(probe.model, s.model)) return {
		settlement: s,
		by: "model"
	};
	return null;
}
/**
* 探针没抓到 usage 时的对账：只按「模型 + 时间窗」配一条本地估算补记的入账记录。
*
* 上游不回 usage 的轮次，扩展会按本地估算补记一条历史（usageSource='estimated'），
* 它的 token 数和探针侧（无用量）永远不可能全等，所以走不到 findSettlement。
* 早期版本因此把这类轮次一律判成 orphan，健康提示里就变成「疑似没记进历史」的误报。
* 这是「确认记过账」的弱匹配：只认模型对得上、且时间落窗内的估算条目，并优先取最近的一条。
*/
function findEstimatedSettlement(probe, settlements, used, windowMs = MATCH_WINDOW_MS) {
	if (probe.total > 0 || probe.prompt > 0 || probe.completion > 0) return null;
	const model = normalizeModel(probe.model);
	const anchor = probe.endedAt || probe.at;
	let best = null;
	for (const s of settlements) {
		if (used.has(s.id)) continue;
		if (!s.estimated) continue;
		if (model && s.model && normalizeModel(s.model) !== model) continue;
		if (!inWindow(s, probe, windowMs)) continue;
		if (!best || Math.abs(s.ts - anchor) < Math.abs(best.ts - anchor)) best = s;
	}
	return best;
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
	hydrateLedgerFromHistory: () => hydrateLedgerFromHistory,
	installRequestTap: () => installRequestTap,
	noteSettlement: () => noteSettlement,
	recheckLegacyOrphans: () => recheckLegacyOrphans,
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
			model: String(entry.model || entry.rawModel || ""),
			prompt: Number(entry.prompt_tokens) || 0,
			completion: Number(entry.completion_tokens) || 0,
			total: Number(entry.total_tokens) || 0,
			ts,
			estimated: String(entry.usageSource || "") === "estimated"
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
		const probe = probeKeyOf({
			model: rec.model,
			usage: rec.usage,
			at: rec.at,
			endedAt: rec.endedAt
		});
		if (rec.usage) hit = findSettlement(probe, settlements, used);
		else {
			const est = findEstimatedSettlement(probe, settlements, used);
			if (est) hit = {
				settlement: est,
				by: "estimated"
			};
		}
		if (hit) {
			used.add(hit.settlement.id);
			patchTapRecord(rec.id, {
				state: "settled",
				settledBy: hit.by,
				settledAt: now
			});
		} else {
			const durationMs = Number(rec.durationMs) || 0;
			const tooShort = durationMs > 0 && durationMs < 500;
			patchTapRecord(rec.id, {
				state: "orphan",
				settledBy: tooShort ? "too-short" : rec.usage ? null : "no-usage",
				settledAt: now
			});
		}
	}
}
/**
* 补齐账本：把已存历史（热 + IndexedDB 冷）也转成 settlement。
*
* 运行时账本只收本次会话的 HISTORY_ADDED，页面一刷新就空；旧版本遗留的孤儿探针因此
* 永远等不到对应入账记录，只能一直挂着「没记进历史」。这里在启动后读一次全量历史，
* 让重判有据可依（同一 timestamp+total 只入账一次，重复调用幂等）。
*/
async function hydrateLedgerFromHistory() {
	try {
		const all = await (await import("./persistence-DeIFgZp8.js").then((n) => n.m)).getAllHistory();
		if (!Array.isArray(all)) return settlements.length;
		const seen = new Set(settlements.map((s) => s.id));
		for (const e of all) {
			if (!e) continue;
			const ts = Number(e.timestamp) || 0;
			const total = Number(e.total_tokens) || 0;
			const id = String(e.requestId || "") || "auto:" + ts + ":" + total;
			if (!ts || seen.has(id)) continue;
			seen.add(id);
			settlements.push({
				id,
				model: String(e.model || e.rawModel || ""),
				prompt: Number(e.prompt_tokens) || 0,
				completion: Number(e.completion_tokens) || 0,
				total,
				ts,
				estimated: String(e.usageSource || "") === "estimated"
			});
		}
		if (settlements.length > SETTLEMENT_MAX) settlements = settlements.slice(-800);
	} catch {}
	return settlements.length;
}
/**
* 旧版本遗留孤儿探针的一次性重判。
*
* 旧版本的三个缺陷会留下永远消不掉的误报：模型名带方括号前缀导致对不上账、几毫秒的假探针
* 被算成「疑似对话」、记录本身无法再复核。这些记录不会随时间自愈（reconcilePending 只管
* pending），所以这里按新规则重判一遍：
* - 能对上已存历史 → settled（本来就是常规对话，只是旧规则没认出来）
* - 几毫秒的假探针 → too-short
* - 仍对不上 → settledBy='legacy'，保留在验证页但不参与健康提示（旧数据无从复核，不再打扰）
* 新版本写入的记录带 v=TAP_SCHEMA_VERSION，不走这里，照常按真实漏记提示。
*/
function recheckLegacyOrphans(now = Date.now()) {
	const usedByRecheck = /* @__PURE__ */ new Set();
	const version = 2;
	return updateTapRecords((rec) => {
		if (!rec || rec.state !== "orphan") return null;
		if (Number(rec.v) >= version) return null;
		if (String(rec.settledBy || "") === "legacy") return null;
		const durationMs = Number(rec.durationMs) || 0;
		if (durationMs > 0 && durationMs < 500) return {
			...rec,
			v: version,
			settledBy: "too-short",
			settledAt: now
		};
		const hit = rec.usage ? findSettlement(probeKeyOf({
			model: rec.model,
			usage: rec.usage,
			at: rec.at,
			endedAt: rec.endedAt
		}), settlements, usedByRecheck) : null;
		if (hit) {
			usedByRecheck.add(hit.settlement.id);
			return {
				...rec,
				v: version,
				state: "settled",
				settledBy: hit.by,
				settledAt: now
			};
		}
		return {
			...rec,
			v: version,
			settledBy: "legacy",
			settledAt: now
		};
	});
}
var legacyRecheckDone = false;
/** 等历史可读后跑一次重判；历史还没 hydrate 出来就退避重试 */
async function runLegacyRecheck(attempt = 0) {
	if (legacyRecheckDone) return;
	if (!await hydrateLedgerFromHistory() && attempt < 3) {
		setTimeout(() => {
			runLegacyRecheck(attempt + 1);
		}, 4e3);
		return;
	}
	if (legacyRecheckDone) return;
	legacyRecheckDone = true;
	try {
		recheckLegacyOrphans();
	} catch {}
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
	runLegacyRecheck();
	try {
		globalThis.__ausTap = {
			install: installRequestTap,
			uninstall: uninstallRequestTap,
			reconcile: reconcilePending,
			recheckLegacy: recheckLegacyOrphans,
			hydrateLedger: hydrateLedgerFromHistory,
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
export { listTapRecords as a, clearTapRecords as i, tapDiagnostics as n, subscribeTap as o, stripModelTag as r, request_tap_exports as t };
