import { cn as __exportAll } from "./Image-B5UjBJH1.js";
import { t as log } from "./logger-Bv-AT94O.js";
import { E as resolveRuntimeConnectionContext, T as initConnectionIdentity, c as diag, t as repository } from "./repository-CdkiaEcM.js";
//#region src/services/interception.ts
var interception_exports = /* @__PURE__ */ __exportAll({
	installInterception: () => installInterception,
	interceptionInstalledFlag: () => interceptionInstalledFlag,
	processUsage: () => processUsage,
	recalcAllCosts: () => recalcAllCosts,
	setLastRequest: () => setLastRequest,
	uninstallInterception: () => uninstallInterception
});
var lastMessages = [];
var lastStart = 0;
var lastFetchUsage = null;
var lastFetchModel = null;
var lastFetchTime = 0;
var lastFetchConnection = null;
var lastFetchConnectionTime = 0;
var requestSequence = 0;
var lastRequestId = null;
var lastRequestIdTime = 0;
function setLastRequest(messages, start) {
	lastMessages = messages || [];
	lastStart = start || Date.now();
}
var TARGET_API = "/api/backends/chat-completions/generate";
var STREAM_TEXT_LIMIT = 1e6;
/** 把值替换成“结构描述”，避免把聊天内容写进诊断日志 */
function describeShape(value, depth = 0) {
	if (value == null) return value;
	if (typeof value === "string") return `<字符串 ${value.length}字>`;
	if (typeof value === "number" || typeof value === "boolean") return value;
	if (depth >= 3) return "[层级过深]";
	if (Array.isArray(value)) {
		const list = value.slice(0, 4).map((v) => describeShape(v, depth + 1));
		if (value.length > 4) list.push(`…(共${value.length}项)`);
		return list;
	}
	if (typeof value === "object") {
		const out = {};
		let count = 0;
		for (const key of Object.keys(value)) {
			if (count++ >= 16) {
				out["…"] = "字段已截断";
				break;
			}
			out[key] = describeShape(value[key], depth + 1);
		}
		return out;
	}
	return String(value);
}
/** 只保留 SSE 末尾若干条数据的结构，便于判断是否真的没有 usage 字段 */
function describeSseTail(text, maxLines = 3) {
	try {
		return text.split("\n").filter((line) => line.startsWith("data:")).slice(-maxLines).map((line) => {
			const payload = line.slice(5).trim();
			if (!payload) return "[空]";
			if (payload === "[DONE]") return "[DONE]";
			try {
				return describeShape(JSON.parse(payload));
			} catch {
				return payload.slice(0, 120);
			}
		});
	} catch {
		return [];
	}
}
/** 从 SSE 原文里摘出 usage 片段（只用来看有没有、长什么样，内容本身是数字，不涉及隐私） */
function usageSnippet(text) {
	try {
		const idx = text.indexOf("\"usage\"");
		if (idx === -1) return null;
		return text.slice(idx, idx + 240);
	} catch {
		return null;
	}
}
function safeRequestSnapshot(body, connection) {
	if (!body || typeof body !== "object") return null;
	const keep = {};
	for (const key of [
		"model",
		"stream",
		"temperature",
		"max_tokens",
		"top_p",
		"stream_options",
		"chat_completion_source"
	]) if (body[key] !== void 0) keep[key] = body[key];
	if (connection?.endpointLabel) keep.endpoint = connection.endpointLabel;
	if (Array.isArray(body.messages)) keep.messages_length = body.messages.length;
	return keep;
}
function recentConnection(maxAge = 12e4) {
	try {
		if (lastFetchConnection && Date.now() - lastFetchConnectionTime < maxAge && lastFetchConnectionTime >= lastFetchTime) return lastFetchConnection;
		if (lastFetchUsage?.connection && Date.now() - lastFetchTime < maxAge) return lastFetchUsage.connection;
	} catch {}
	return null;
}
function recentRequestId(maxAge = 5e3) {
	if (lastRequestId && Date.now() - lastRequestIdTime < maxAge) return lastRequestId;
	return null;
}
function estimateThinkTokens(text, usage) {
	if (!usage || typeof usage !== "object") return;
	const detail = usage.completion_tokens_details;
	if (detail && typeof detail.reasoning_tokens === "number" && detail.reasoning_tokens > 0) return;
	let thinkChars = 0, contentChars = 0;
	for (const raw of String(text || "").split("\n")) {
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
		const d = chunk?.choices?.[0]?.delta;
		if (!d) continue;
		if (typeof d.reasoning_content === "string") thinkChars += d.reasoning_content.length;
		else if (typeof d.reasoning === "string") thinkChars += d.reasoning.length;
		if (typeof d.content === "string") contentChars += d.content.length;
	}
	if (thinkChars > 0) {
		const comp = usage.completion_tokens || usage.output_tokens || 0;
		const total = thinkChars + contentChars;
		usage.__think_tokens_est = total > 0 ? Math.round(comp * (thinkChars / total)) : 0;
	}
}
function installFetchCapture() {
	try {
		const p = window.parent || window;
		diag("fetch补丁:安装检查", {
			与父窗口相同: p === window,
			当前页地址: String(window.location?.href || "").slice(0, 120),
			存在fetch: !!p?.fetch,
			已被本扩展打过补丁: !!(p?.fetch)?.__aus_patched,
			补丁函数名: (p?.fetch)?.name || null
		});
		if (!p || !p.fetch || p.fetch.__aus_patched) {
			diag("fetch补丁:跳过", { 原因: !p ? "无目标窗口" : !p.fetch ? "目标窗口无 fetch" : "已被本扩展打过补丁（可能是页面未刷新导致旧实例仍在工作）" });
			return;
		}
		const rawFetch = p.fetch.bind(p);
		const patched = function() {
			const args = arguments;
			const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
			if (typeof url === "string" && url.indexOf(TARGET_API) !== -1) {
				let reqBody = null;
				try {
					reqBody = JSON.parse(args[1]?.body || "null");
				} catch {}
				const requestConnection = resolveRuntimeConnectionContext(reqBody || {});
				const fullReq = safeRequestSnapshot(reqBody, requestConnection);
				const requestId = `req:${Date.now()}:${++requestSequence}`;
				diag("fetch:命中生成请求", {
					地址: String(url).slice(0, 160),
					模型: reqBody?.model ?? null,
					流式: reqBody?.stream ?? null,
					流式用量参数: reqBody?.stream_options ?? null,
					补全来源: reqBody?.chat_completion_source ?? null,
					消息数: Array.isArray(reqBody?.messages) ? reqBody.messages.length : null,
					接入类型: requestConnection?.sourceType ?? null,
					接入地址: requestConnection?.endpointLabel ?? null,
					密钥条目: requestConnection?.credentialLabel ?? null
				});
				try {
					lastFetchConnection = requestConnection;
					lastFetchConnectionTime = Date.now();
					lastRequestId = requestId;
					lastRequestIdTime = Date.now();
				} catch {}
				let msgs = [];
				try {
					if (reqBody?.messages?.length) msgs = reqBody.messages.slice(-10);
				} catch {}
				const startTime = Date.now();
				try {
					lastMessages = msgs;
					lastStart = startTime;
				} catch {}
				return rawFetch.apply(p, args).then((res) => {
					diag("fetch:收到响应", {
						状态码: res.status,
						成功: res.ok,
						类型: res.headers?.get?.("content-type") || null
					});
					try {
						const clone = res.clone();
						const parseAndProcess = (text, ttftVal, thinkTimeVal) => {
							let data = null;
							let finishReason = null;
							try {
								const trimmed = text.trim();
								if (trimmed.startsWith("{")) {
									data = JSON.parse(trimmed);
									try {
										finishReason = data?.choices?.[0]?.finish_reason ?? null;
									} catch {}
								} else {
									text.split("\n").forEach((line) => {
										if (line.startsWith("data:")) {
											const payload = line.slice(5).trim();
											if (!payload || payload === "[DONE]") return;
											try {
												const chunk = JSON.parse(payload);
												if (chunk.usage) data = chunk;
												if (!data && chunk.choices?.[0]?.usage) data = {
													usage: chunk.choices[0].usage,
													model: chunk.model
												};
												const fr = chunk?.choices?.[0]?.finish_reason;
												if (fr != null) finishReason = fr;
											} catch {}
										}
									});
									if (!data || !data.usage) {
										const m = text.match(/"usage"\s*:\s*(\{[^\}]+\})/);
										if (m) try {
											const u = JSON.parse(m[1]);
											if (u && typeof u === "object") data = {
												usage: u,
												model: data?.model
											};
										} catch {}
									}
								}
							} catch (e) {
								diag("fetch:用量响应解析失败", { 错误: e?.message || String(e) });
								log.debug("用量响应解析失败", e?.message || e);
								return;
							}
							if (data && data.usage) {
								const model = data?.model || reqBody?.model || fullReq?.model || lastFetchModel || "deepseek-v4-flash";
								const usage = data.usage;
								try {
									if (finishReason) usage.__finish_reason = finishReason;
								} catch {}
								try {
									estimateThinkTokens(text, usage);
								} catch {}
								lastFetchUsage = {
									usage,
									model,
									msgs,
									startTime,
									fullReq,
									fullResponse: text,
									ttft: ttftVal,
									thinkTime: thinkTimeVal,
									finishReason,
									connection: requestConnection,
									requestId
								};
								lastFetchModel = typeof model === "string" ? model : null;
								lastFetchTime = Date.now();
								diag("fetch:解析到 usage", {
									模型: model,
									用量: describeShape(usage),
									结束原因: finishReason,
									首字毫秒: Math.round(ttftVal),
									思维链毫秒: Math.round(thinkTimeVal)
								});
								log.debug("fetch 捕获 usage", {
									model,
									hasUsage: !!usage,
									finishReason
								});
								try {
									processUsage(usage, model, msgs, startTime, fullReq, text, ttftVal, thinkTimeVal, finishReason, requestConnection, requestId);
								} catch (e) {
									log.error("fetch 用量记录失败 " + (e?.message || e));
								}
							} else diag("fetch:响应流里没有可用 usage", {
								解析到数据对象: !!data,
								有usage字段: !!data?.usage,
								文本长度: String(text || "").length,
								结束原因: finishReason,
								流末尾结构: describeSseTail(String(text || ""))
							});
						};
						try {
							const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
							const nowMs = () => typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
							let ttft = 0;
							let thinkStart = 0, thinkEnd = 0;
							let fullText = "";
							const finish = () => {
								try {
									parseAndProcess(fullText, ttft, thinkEnd && thinkStart ? thinkEnd - thinkStart : 0);
								} catch {}
							};
							const scanThink = (chunk) => {
								for (const line of chunk.split("\n")) {
									if (!line.startsWith("data:")) continue;
									const payload = line.slice(5).trim();
									if (!payload || payload === "[DONE]") continue;
									if (!thinkStart && line.indexOf("\"reasoning_content\"") !== -1) thinkStart = nowMs() - t0;
									if (thinkStart && !thinkEnd && line.indexOf("\"content\"") !== -1) thinkEnd = nowMs() - t0;
								}
							};
							const readStream = async (body) => {
								const reader = body.getReader();
								const dec = new TextDecoder();
								let first = true, buf = "";
								let chunkCount = 0, byteCount = 0;
								for (;;) {
									const { done, value } = await reader.read();
									if (done) break;
									if (first && value && value.byteLength) {
										ttft = Date.now() - startTime;
										first = false;
									}
									chunkCount += 1;
									byteCount += value?.byteLength || 0;
									const piece = dec.decode(value, { stream: true });
									fullText += piece;
									buf += piece;
									if (fullText.length > STREAM_TEXT_LIMIT) fullText = fullText.slice(-1e6);
									const nl = buf.lastIndexOf("\n");
									if (nl !== -1) {
										const lines = buf.slice(0, nl);
										buf = buf.slice(nl + 1);
										scanThink(lines);
									}
								}
								if (buf) scanThink(buf);
								diag("fetch:响应流读取完毕", {
									分片数: chunkCount,
									字节数: byteCount,
									文本长度: fullText.length,
									耗时毫秒: Date.now() - startTime,
									首字毫秒: Math.round(ttft),
									含usage字段: fullText.indexOf("\"usage\"") !== -1,
									usage片段: usageSnippet(fullText),
									流末尾结构: describeSseTail(fullText)
								});
								finish();
							};
							const streamBody = clone.body;
							if (streamBody && typeof streamBody.getReader === "function") readStream(streamBody).catch(() => {
								try {
									finish();
								} catch {}
							});
							else clone.text().then((t) => {
								ttft = Date.now() - startTime;
								parseAndProcess(t, ttft, 0);
							}).catch(() => {});
						} catch (innerErr) {
							log.debug("fetch 流式读取异常，不影响原请求", innerErr?.message || innerErr);
							try {
								clone.text().then((t) => {
									parseAndProcess(t, 0, 0);
								}).catch(() => {});
							} catch {}
						}
					} catch (e) {
						log.debug("fetch 克隆解析异常，不影响原请求", e?.message || e);
					}
					return res;
				}).catch((e) => {
					throw e;
				});
			}
			return rawFetch.apply(p, args);
		};
		patched.__aus_patched = true;
		p.fetch = patched;
		log.debug("fetch 捕获已安装 TARGET_API=" + TARGET_API);
	} catch {}
}
var interceptionInstalled = false;
var rawFetchRef = null;
var messageReceivedHandler = null;
var generationStartedHandler = null;
/** 供诊断使用：拦截器当前是否已安装 */
function interceptionInstalledFlag() {
	return interceptionInstalled;
}
function installInterception() {
	try {
		try {
			initConnectionIdentity();
		} catch {}
		const ctx = globalThis.SillyTavern?.getContext?.();
		const es = ctx?.eventSource;
		const et = ctx?.event_types;
		if (!es || !et) {
			diag("拦截器:安装失败", {
				原因: "酒馆上下文尚未就绪",
				有事件源: !!es,
				有事件类型: !!et
			});
			return false;
		}
		if (interceptionInstalled) {
			diag("拦截器:已安装，跳过重复安装");
			return true;
		}
		try {
			const p = window.parent || window;
			if (p?.fetch && !p.fetch.__aus_patched) rawFetchRef = p.fetch.bind(p);
		} catch {}
		es.on(et.GENERATION_ENDED, onGenerationEnded);
		messageReceivedHandler = () => setTimeout(refresh, 400);
		es.on(et.MESSAGE_RECEIVED, messageReceivedHandler);
		generationStartedHandler = (...args) => onGenerationStarted(args);
		if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, generationStartedHandler);
		globalThis.ApiUsageStatInterceptor = (chat, _ctxSize, _abort, _type) => {
			try {
				setLastRequest(chat?.slice(-10) || [], Date.now());
			} catch {}
		};
		try {
			installFetchCapture();
		} catch {}
		interceptionInstalled = true;
		diag("拦截器:安装成功", {
			有GENERATION_ENDED: !!et.GENERATION_ENDED,
			有MESSAGE_RECEIVED: !!et.MESSAGE_RECEIVED,
			有GENERATION_STARTED: !!et.GENERATION_STARTED
		});
		return true;
	} catch (e) {
		diag("拦截器:安装异常", { 错误: e?.message || String(e) });
		return false;
	}
}
function uninstallInterception() {
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		const es = ctx?.eventSource;
		const et = ctx?.event_types;
		if (es && et && messageReceivedHandler) {
			try {
				es.off?.(et.GENERATION_ENDED, onGenerationEnded);
			} catch {}
			try {
				es.off?.(et.MESSAGE_RECEIVED, messageReceivedHandler);
			} catch {}
			try {
				if (generationStartedHandler) es.off?.(et.GENERATION_STARTED, generationStartedHandler);
			} catch {}
		}
		generationStartedHandler = null;
		try {
			const p = window.parent || window;
			if (p && rawFetchRef && p.fetch.__aus_patched) p.fetch = rawFetchRef;
		} catch {}
		interceptionInstalled = false;
	} catch {}
}
function isValidUsage(u) {
	if (!u || typeof u !== "object" || Array.isArray(u)) return false;
	return typeof u.prompt_tokens === "number" || typeof u.completion_tokens === "number" || typeof u.total_tokens === "number" || typeof u.input_tokens === "number" || typeof u.output_tokens === "number" || typeof u.prompt_cache_hit_tokens === "number" || typeof u.cached_tokens === "number" || u.prompt_tokens_details && typeof u.prompt_tokens_details.cached_tokens === "number";
}
function pickUsageFromExtra(extra) {
	if (!extra || typeof extra !== "object") return null;
	const candidates = [
		extra.api_usage,
		extra.usage,
		extra.openai_usage,
		extra.token_usage,
		extra.data?.usage,
		extra.response?.usage
	];
	for (const c of candidates) if (isValidUsage(c)) return c;
	if (isValidUsage(extra)) return extra;
	return null;
}
function onGenerationStarted(args) {
	try {
		const p = window.parent || window;
		const [type, params, dryRun] = args || [];
		diag("事件:GENERATION_STARTED", {
			生成类型: type ?? null,
			预演模式: !!dryRun,
			补丁仍在: !!(p?.fetch)?.__aus_patched,
			fetch函数名: (p?.fetch)?.name || null,
			自动触发: params?.automatic_trigger ?? null,
			静默生成: params?.quiet_prompt ?? null
		});
	} catch {}
}
function onGenerationEnded(...args) {
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		const chat = ctx?.chat || [];
		const tail = chat[chat.length - 1];
		const extra = tail?.extra || {};
		const tailModel = tail?.model || null;
		const extraModel = extra.model || tailModel || ctx?.model || "deepseek-v4-flash";
		diag("事件:GENERATION_ENDED", {
			消息数: chat.length,
			末条是否用户: !!tail?.is_user,
			extra字段: Object.keys(extra),
			extra模型: extra.model ?? null,
			本地估算tokens: extra.token_count ?? null,
			首字毫秒: extra.time_to_first_token ?? null,
			思维链毫秒: extra.reasoning_duration ?? null,
			有api_usage: !!extra.api_usage,
			有usage: !!extra.usage,
			参数个数: args.length,
			参数0字段: args[0] && typeof args[0] === "object" ? Object.keys(args[0]).slice(0, 12) : null,
			最近fetch距今毫秒: lastFetchTime ? Date.now() - lastFetchTime : null,
			最近fetch有usage: !!(lastFetchUsage && (lastFetchUsage.usage || isValidUsage(lastFetchUsage)))
		});
		log.debug("onGenerationEnded 触发", {
			chatLen: chat.length,
			hasApiUsage: !!extra.api_usage
		});
		let usage = pickUsageFromExtra(extra);
		let model = extraModel;
		log.debug("pickUsageFromExtra 结果", {
			hasUsage: !!usage,
			isValid: usage ? isValidUsage(usage) : false
		});
		if (usage && isValidUsage(usage)) {
			diag("记录路径:extra 主路径命中", { 模型: model });
			log.debug("命中主路径 extra usage");
			let ttft = 0, think = 0, fr = usage?.__finish_reason ?? usage?.finish_reason ?? null;
			try {
				const fp = lastFetchUsage;
				if (fp && Date.now() - lastFetchTime < 5e3) {
					if (!ttft) ttft = fp.ttft || 0;
					if (!think) think = fp.thinkTime || 0;
					if (!fr) fr = fp.finishReason ?? null;
					if (!fr) try {
						const extraFr = extra?.finish_reason ?? tail?.finish_reason ?? null;
						if (extraFr) fr = extraFr;
					} catch {}
				}
			} catch {}
			processUsage(usage, model, lastMessages, lastStart, null, null, ttft, think, fr, recentConnection(5e3), recentRequestId());
			lastFetchUsage = null;
			return;
		}
		if (tail?.swipe_info && typeof tail.swipe_info === "object") {
			log.debug("尝试 swipe_info 路径");
			for (const v of Object.values(tail.swipe_info)) {
				const cand = v?.extra?.api_usage || v?.extra?.usage;
				if (isValidUsage(cand)) {
					usage = cand;
					model = v?.extra?.model || model;
					diag("记录路径:swipe_info 命中", { 模型: model });
					log.debug("swipe_info 命中", { model });
					let ttft = 0, think = 0, fr = cand?.__finish_reason ?? null;
					try {
						const fp = lastFetchUsage;
						if (fp && Date.now() - lastFetchTime < 5e3) {
							ttft = fp.ttft || 0;
							think = fp.thinkTime || 0;
							if (!fr) fr = fp.finishReason ?? null;
						}
					} catch {}
					processUsage(usage, model, lastMessages, lastStart, null, null, ttft, think, fr, recentConnection(5e3), recentRequestId());
					lastFetchUsage = null;
					return;
				}
			}
			log.debug("swipe_info 未命中有效 usage");
		}
		const maybeUsage = args[0]?.usage || args[0]?.api_usage;
		log.debug("尝试 args 兜底", {
			hasMaybeUsage: !!maybeUsage,
			isValid: maybeUsage ? isValidUsage(maybeUsage) : false
		});
		if (isValidUsage(maybeUsage)) {
			const m = args[0]?.model || model;
			diag("记录路径:事件参数兜底命中", { 模型: m });
			log.debug("args 命中", { model: m });
			let ttft = 0, think = 0, fr = maybeUsage?.__finish_reason ?? null;
			try {
				const fp = lastFetchUsage;
				if (fp && Date.now() - lastFetchTime < 5e3) {
					ttft = fp.ttft || 0;
					think = fp.thinkTime || 0;
					if (!fr) fr = fp.finishReason ?? null;
				}
			} catch {}
			processUsage(maybeUsage, m, lastMessages, lastStart, null, null, ttft, think, fr, recentConnection(5e3), recentRequestId());
			lastFetchUsage = null;
			return;
		}
		{
			let fetchPack = lastFetchUsage;
			let fetchUsage = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
			if (fetchUsage && isValidUsage(fetchUsage) && Date.now() - lastFetchTime < 12e4) {
				const fetchedModel = fetchPack && fetchPack.model || lastFetchModel || model;
				const fetchedMsgs = fetchPack && fetchPack.msgs || lastMessages;
				const fetchedStart = fetchPack && fetchPack.startTime || lastStart;
				const fetchedReq = fetchPack && fetchPack.fullReq || null;
				const fetchedRes = fetchPack && fetchPack.fullResponse || null;
				const fTtft = fetchPack && fetchPack.ttft || 0;
				const fThink = fetchPack && fetchPack.thinkTime || 0;
				const fFr = fetchPack && fetchPack.finishReason || fetchUsage?.__finish_reason || null;
				diag("记录路径:fetch 兜底命中", {
					模型: fetchedModel,
					距今毫秒: Date.now() - lastFetchTime
				});
				log.debug("fetch 兜底命中", { model: fetchedModel });
				lastFetchUsage = null;
				processUsage(fetchUsage, fetchedModel, fetchedMsgs, fetchedStart, fetchedReq, fetchedRes, fTtft, fThink, fFr, fetchPack?.connection || recentConnection(), fetchPack?.requestId || recentRequestId(12e4));
				return;
			} else if (lastFetchUsage) {
				const fu = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
				diag("记录路径:fetch 缓存无效或超时", {
					有效: fu ? isValidUsage(fu) : false,
					距今毫秒: Date.now() - lastFetchTime
				});
				log.debug("fetch 有缓存但无效或超时", {
					has: !!lastFetchUsage,
					isValid: fu ? isValidUsage(fu) : false,
					age: Date.now() - lastFetchTime
				});
			}
		}
		if (extra.token_count != null && !usage) {
			diag("记录结果:丢弃本次记录", {
				原因: "只拿到酒馆本地估算的 token_count，没有可计费的服务端用量",
				本地估算tokens: extra.token_count,
				模型: model,
				建议: lastFetchTime ? "若上面出现“fetch:响应流里没有可用 usage”，说明上游流式响应未返回用量" : "本次生成期间扩展未捕获到生成端点请求"
			});
			log.debug("跳过无效 usage：仅有本地 token_count=" + extra.token_count + " model=" + model);
			return;
		}
		diag("记录结果:丢弃本次记录", {
			原因: "未找到任何有效 usage",
			模型: model,
			本次生成是否捕获到请求: !!lastFetchTime
		});
		log.debug("未找到任何有效 usage，丢弃本次记录");
	} catch (e) {
		log.error("onGenerationEnded 异常 " + e?.message || e);
	}
}
function refresh() {
	try {
		globalThis.ApiUsageStat?.refreshUI?.();
	} catch {}
}
function processUsage(usage, model, messages, startTime, fullRequest = null, fullResponse = null, ttft = 0, thinkTime = 0, finishReason = null, connection = null, requestId = null) {
	try {
		const fp = lastFetchUsage;
		if (fp?.usage && Date.now() - lastFetchTime < 5e3) {
			const est = fp.usage.__think_tokens_est;
			const hasReal = usage?.completion_tokens_details && typeof usage.completion_tokens_details.reasoning_tokens === "number" && usage.completion_tokens_details.reasoning_tokens > 0;
			if (est && !hasReal && !usage?.__think_tokens_est) usage.__think_tokens_est = est;
		}
	} catch {}
	repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime, finishReason, connection, requestId);
	refresh();
}
function recalcAllCosts() {
	return repository.recalcAll();
}
//#endregion
export { recalcAllCosts as i, interceptionInstalledFlag as n, interception_exports as r, installInterception as t };
