import { pn as __exportAll } from "./graphic-BAx7jeh4.js";
import { t as log } from "./logger-8RGXnvfI.js";
import { D as resolveRuntimeConnectionContext, E as initConnectionIdentity, t as repository } from "./repository-CTe-UtI8.js";
//#region src/services/include-usage.ts
/**
* 流式 usage 注入的纯逻辑：把 stream_options.include_usage 合并进用户/预设自定义的请求体参数。
*
* 背景：酒馆只对 custom 源透传 custom_include_body（YAML 合并进上游请求体），
* 且服务端 mergeObjectWithYaml 解析失败时会静默丢弃整段参数。
* 因此这里不能做简单字符串拼接——预设完全可能把参数写成 JSON（如 `{"thinking":{"type":"disabled"}}`），
* 在 JSON 后追加块状 YAML 会得到非法文档，导致预设自己的参数（例如关闭原生思考）一起失效。
*
* 规则：
* - 空值直接写入 YAML；
* - 顶层是 JSON/flow 对象时，用 JSON 解析后合并再序列化，保持合法；
* - 无法安全解析的 flow 写法（非 JSON）、数组/列表、已有 stream_options、文档结束标记一律不介入；
* - 顶层是块状映射时才允许追加 YAML 键；
* - 不是字符串的值（宿主允许 custom_include_body 传对象）一律不介入，避免被 String() 成 [object Object]。
*
* 除了「怎么写」，「要不要写」也有限制：见 isInjectableApiFormat。
* TauriTavern 会把 custom_include_body 无条件合并进最终上游请求体（Gemini 原生 / Interactions /
* Claude Messages / Responses 都是如此），这些端点严格校验未知字段会直接 400，而且 TT 把上游
* 错误包成 200，扩展的「400 就重试」兜底在 TT 上永远不触发。因此只有 OpenAI 兼容格式可以注入。
*/
var INCLUDE_USAGE_YAML = "stream_options:\n  include_usage: true";
var INCLUDE_USAGE_OBJECT = { include_usage: true };
/** 跳过开头的空行、注释行与 YAML 文档起始标记，返回第一个内容字符的下标 */
function contentStart(text) {
	let offset = 0;
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#") || trimmed === "---") {
			offset += line.length + 1;
			continue;
		}
		return offset + (line.length - line.trimStart().length);
	}
	return text.length;
}
function hasOwn(obj, key) {
	return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
}
/**
* 返回合并后的 custom_include_body 字符串。
* changed=false 时调用方必须保持原值不变（宁可拿不到 usage，也不能破坏预设参数）。
*/
function mergeIncludeUsage(raw) {
	if (raw != null && typeof raw !== "string") return {
		changed: false,
		value: ""
	};
	const current = String(raw ?? "").trim();
	if (!current) return {
		changed: true,
		value: `${INCLUDE_USAGE_YAML}\n`
	};
	const head = current.slice(contentStart(current));
	if (!head) return {
		changed: false,
		value: current
	};
	if (head.startsWith("{")) try {
		const parsed = JSON.parse(head);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {
			changed: false,
			value: current
		};
		if (hasOwn(parsed, "stream_options")) return {
			changed: false,
			value: current
		};
		parsed.stream_options = { ...INCLUDE_USAGE_OBJECT };
		return {
			changed: true,
			value: JSON.stringify(parsed)
		};
	} catch {
		return {
			changed: false,
			value: current
		};
	}
	if (head.startsWith("[") || head.startsWith("-")) return {
		changed: false,
		value: current
	};
	if (/(^|\n)\s*stream_options\s*:/.test(current)) return {
		changed: false,
		value: current
	};
	if (/(^|\n)\s*\.\.\.\s*(\n|$)/.test(current)) return {
		changed: false,
		value: current
	};
	return {
		changed: true,
		value: `${current}\n${INCLUDE_USAGE_YAML}\n`
	};
}
/**
* 宿主是否允许往这次请求里塞 stream_options。
*
* SillyTavern 1.19 没有 custom_api_format 字段（custom 恒为 OpenAI 兼容），返回 true。
* TauriTavern 用 custom_api_format 声明 custom 源的真实协议：只有 openai_compat 认这个参数，
* 其余四种的中转请求体是各家原生格式，塞进去会被严格校验拒绝。TT 自己也会给 OpenAI 兼容路径
* 注入同一参数，所以非兼容格式一律不注入，宁可用估算也不打断对话。
*/
function isInjectableApiFormat(format) {
	if (format == null) return true;
	if (typeof format !== "string") return false;
	const text = format.trim();
	if (!text) return true;
	return text === "openai_compat";
}
//#endregion
//#region src/services/think-timing.ts
/**
* 思维链耗时口径（单一来源）
*
* 背景：思维链耗时只能从流式增量里测——上游不会给出 reasoning 的起止时间，
* 因此需要按帧判断「思维链开始」与「正文开始」两个时刻。
*
* 旧实现用整行 substring 匹配（"reasoning_content" / "content"），有两个致命缺陷：
*   1. DeepSeek 官方流式在思维链帧里仍带 "content":null，
*      于是第一个思维链帧就同时命中 content，起止落在同一帧 → 耗时恒为 0；
*   2. 只认 reasoning_content，不认 reasoning / reasoning_text / thinking
*      （OpenRouter、部分中转与 Anthropic 风格），思维链根本没被识别 → 耗时恒为 0。
*
* 现在按 JSON 解析增量，只认「非空」的思维链文本与「非空」的正文文本，
* 并补一条兜底：整段回复只有思维链没有正文时，取最后一帧思维链时间作为结束点。
*/
/** 思维链字段名（按优先级）；Anthropic 风格另有 delta.type=thinking_delta */
var REASONING_KEYS = [
	"reasoning_content",
	"reasoning",
	"reasoning_text",
	"thinking"
];
function createThinkClock() {
	return {
		startAt: null,
		endAt: null,
		lastReasoningAt: null,
		contentFrames: 0
	};
}
function textOf(value) {
	return typeof value === "string" ? value : "";
}
function frameCarriers(record) {
	const first = (Array.isArray(record?.choices) ? record.choices : [])[0] || {};
	return [
		first.delta,
		first.message,
		record?.delta,
		record?.message
	];
}
/** 取一帧增量里的思维链文本（空字符串视为无思维链） */
function reasoningTextOf(record) {
	if (!record || typeof record !== "object") return "";
	for (const carrier of frameCarriers(record)) {
		if (!carrier || typeof carrier !== "object") continue;
		for (const key of REASONING_KEYS) {
			const text = textOf(carrier[key]);
			if (text) return text;
		}
	}
	return textOf(record.reasoning_content) || textOf(record.reasoning);
}
/** 取一帧增量里的正文文本（空字符串=尚无正文，例如仅带 content:null 的思维链帧） */
function contentTextOf$1(record) {
	if (!record || typeof record !== "object") return "";
	for (const carrier of frameCarriers(record)) {
		if (!carrier || typeof carrier !== "object") continue;
		const direct = textOf(carrier.content);
		if (direct) return direct;
		if (carrier.type === "text_delta") {
			const text = textOf(carrier.text);
			if (text) return text;
		}
	}
	if (record.type === "text_delta") return textOf(record.text);
	return "";
}
/**
* 扫一段已是完整行的 SSE 文本（可含多行），更新时钟。
* @param at 该段数据的相对时刻（ms）；同段内的帧共用同一时刻，粒度足够
*/
function scanThinkChunk(clock, chunk, at) {
	for (const raw of String(chunk || "").split("\n")) {
		const line = raw.trim();
		if (!line.startsWith("data:")) continue;
		const payload = line.slice(5).trim();
		if (!payload || payload === "[DONE]") continue;
		let record;
		try {
			record = JSON.parse(payload);
		} catch {
			continue;
		}
		if (!record || typeof record !== "object") continue;
		const reasoning = reasoningTextOf(record);
		if (reasoning) {
			if (clock.startAt == null) clock.startAt = at;
			clock.lastReasoningAt = at;
			clock.reasoningChars = (clock.reasoningChars || 0) + reasoning.length;
		}
		const content = contentTextOf$1(record);
		if (content) {
			clock.contentFrames += 1;
			clock.contentChars = (clock.contentChars || 0) + content.length;
			if (clock.startAt != null && clock.endAt == null) clock.endAt = at;
		}
	}
}
/**
* 结算思维链耗时（ms）。
* 结束点优先级：首帧正文 → 最后一帧思维链（整段只有思维链）→ 流结束时刻。
*/
function resolveThinkTime(clock, endedAt) {
	if (!clock || clock.startAt == null) return 0;
	const end = clock.endAt ?? clock.lastReasoningAt ?? endedAt;
	if (!Number.isFinite(end) || !Number.isFinite(clock.startAt)) return 0;
	const ms = end - clock.startAt;
	if (!(ms > 0)) return 0;
	return Math.round(ms);
}
//#endregion
//#region src/services/frame-normalizer.ts
/** Anthropic 流式事件名（error 不列入：两家都有，靠其他事件锁定） */
var ANTHROPIC_EVENTS = /* @__PURE__ */ new Set([
	"message_start",
	"content_block_start",
	"content_block_delta",
	"content_block_stop",
	"message_delta",
	"message_stop",
	"ping"
]);
/** OpenAI Responses 流式事件名 */
var RESPONSES_EVENTS = /* @__PURE__ */ new Set([
	"response.created",
	"response.in_progress",
	"response.queued",
	"response.output_item.added",
	"response.output_item.done",
	"response.content_part.added",
	"response.content_part.done",
	"response.output_text.delta",
	"response.output_text.done",
	"response.refusal.delta",
	"response.reasoning_summary_text.delta",
	"response.reasoning_summary_text.done",
	"response.completed",
	"response.failed",
	"response.incomplete"
]);
/**
* Gemini Interactions（`POST /v1beta/interactions`）流式事件名。
* 事件名同时出现在 SSE 的 `event:` 行与 data JSON 的 `event_type` 字段里，这里只认后者。
*/
var INTERACTIONS_EVENTS = /* @__PURE__ */ new Set([
	"interaction.created",
	"interaction.in_progress",
	"interaction.status_update",
	"interaction.requires_action",
	"interaction.completed",
	"interaction.failed",
	"step.start",
	"step.delta",
	"step.stop"
]);
/** Interactions status → OpenAI finish_reason */
var INTERACTIONS_STATUS = {
	completed: "stop",
	incomplete: "length",
	requires_action: "tool_calls",
	failed: "other",
	cancelled: "other",
	expired: "other"
};
/** Gemini finishReason → OpenAI finish_reason */
var GEMINI_FINISH = {
	STOP: "stop",
	MAX_TOKENS: "length",
	SAFETY: "content_filter",
	RECITATION: "content_filter",
	LANGUAGE: "content_filter",
	BLOCKLIST: "content_filter",
	PROHIBITED_CONTENT: "content_filter",
	SPII: "content_filter",
	IMAGE_SAFETY: "content_filter",
	MALFORMED_FUNCTION_CALL: "tool_calls",
	UNEXPECTED_TOOL_CALL: "tool_calls",
	TOO_MANY_TOOL_CALLS: "tool_calls",
	OTHER: "other"
};
/** Anthropic stop_reason → OpenAI finish_reason */
var ANTHROPIC_FINISH = {
	end_turn: "stop",
	max_tokens: "length",
	stop_sequence: "stop",
	tool_use: "tool_calls",
	refusal: "content_filter",
	pause_turn: "stop"
};
function num(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function pos(value) {
	return value != null && value > 0 ? value : 0;
}
function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function makeUsage(hit, miss, completion, total, think) {
	const prompt = hit + miss;
	return {
		prompt_tokens: prompt,
		completion_tokens: completion,
		total_tokens: Math.max(total, prompt + completion),
		prompt_cache_hit_tokens: hit,
		prompt_cache_miss_tokens: miss,
		completion_tokens_details: { reasoning_tokens: think }
	};
}
/**
* Gemini 原生 usageMetadata → UsageIR
* - cachedContentTokenCount 是 promptTokenCount 的子集（不是额外量）
* - toolUsePromptTokenCount 不在 promptTokenCount 内，必须并进未命中
* - thoughtsTokenCount 不计入 candidatesTokenCount，计费上属于输出
*/
function geminiUsageIR(um) {
	const promptCount = pos(num(um.promptTokenCount));
	const cached = pos(num(um.cachedContentTokenCount));
	const tool = pos(num(um.toolUsePromptTokenCount));
	const candidates = pos(num(um.candidatesTokenCount));
	const thoughts = pos(num(um.thoughtsTokenCount));
	const hit = Math.min(cached, promptCount);
	return makeUsage(hit, Math.max(0, promptCount - hit) + tool, candidates + thoughts, pos(num(um.totalTokenCount)), thoughts);
}
/** OpenAI / DeepSeek / Gemini 兼容层 usage → UsageIR */
function openaiUsageIR(u) {
	const prompt = pos(num(u.prompt_tokens) ?? num(u.input_tokens));
	const completionRaw = pos(num(u.completion_tokens) ?? num(u.output_tokens));
	const hit = pos(num(u.prompt_cache_hit_tokens) ?? num(u.prompt_tokens_details?.cached_tokens) ?? num(u.input_tokens_details?.cached_tokens) ?? num(u.cached_tokens));
	const missRaw = num(u.prompt_cache_miss_tokens);
	const miss = missRaw != null && missRaw >= 0 ? missRaw : Math.max(0, prompt - hit);
	const explicitThink = num(u.completion_tokens_details?.reasoning_tokens) ?? num(u.output_tokens_details?.reasoning_tokens) ?? num(u.reasoning_tokens) ?? num(u.thinking_tokens);
	let think = pos(explicitThink);
	let completion = completionRaw;
	if (explicitThink == null) {
		const total = num(u.total_tokens);
		if (total != null && total > 0) {
			const diff = total - (prompt + completionRaw);
			if (diff > 0 && diff !== hit && diff !== prompt) {
				think = diff;
				completion = completionRaw + diff;
			}
		}
	}
	const totalRaw = pos(num(u.total_tokens));
	const total = totalRaw > 0 ? totalRaw : prompt + completion;
	return makeUsage(hit, miss, completion, total, think);
}
/** Anthropic usage → UsageIR（input_tokens 不含缓存，cache_read / cache_creation 单列） */
function anthropicUsageIR(start, outputTokens) {
	const s = start || {};
	const hit = pos(num(s.cache_read_input_tokens));
	const create = pos(num(s.cache_creation_input_tokens));
	const miss = pos(num(s.input_tokens)) + create;
	const output = pos(outputTokens ?? num(s.output_tokens));
	return makeUsage(hit, miss, output, hit + miss + output, 0);
}
/** OpenAI Responses usage → UsageIR（output_tokens 已含 reasoning） */
function responsesUsageIR(u) {
	const prompt = pos(num(u.input_tokens));
	const hit = pos(num(u.input_tokens_details?.cached_tokens));
	const miss = Math.max(0, prompt - hit);
	const output = pos(num(u.output_tokens));
	const think = pos(num(u.output_tokens_details?.reasoning_tokens));
	return makeUsage(hit, miss, output, pos(num(u.total_tokens)), think);
}
/**
* Gemini Interactions usage → UsageIR
* - total_input_tokens 与 total_cached_tokens 的关系同 Gemini 原生（cached 是 input 的子集）
* - total_thought_tokens 独立于 total_output_tokens（官方示例 11 + 90 + 245 = 346）
* - total_tool_use_tokens 不在 total_input_tokens 内
*/
function interactionsUsageIR(u) {
	const input = pos(num(u.total_input_tokens) ?? num(u.input_tokens));
	const cached = pos(num(u.total_cached_tokens) ?? num(u.cached_tokens));
	const tool = pos(num(u.total_tool_use_tokens) ?? num(u.tool_use_tokens));
	const output = pos(num(u.total_output_tokens) ?? num(u.output_tokens));
	const thoughts = pos(num(u.total_thought_tokens) ?? num(u.thought_tokens));
	const hit = Math.min(cached, input);
	return makeUsage(hit, Math.max(0, input - hit) + tool, output + thoughts, pos(num(u.total_tokens)), thoughts);
}
/** 把 [{ type:'text', text }] 拼成一段文本（Interactions 的 content / summary 都是这个形状） */
function joinTextBlocks(list) {
	if (!Array.isArray(list)) return "";
	let out = "";
	for (const block of list) if (isObject(block) && typeof block.text === "string" && block.text) out += block.text;
	return out;
}
/** 首帧协议判定（顺序有意义：Gemini 靠 candidates 锁定，不能等末帧的 usageMetadata） */
function detectProtocol(frame) {
	if (!isObject(frame)) return "unknown";
	if (frame.candidates || frame.usageMetadata || frame.promptFeedback) return "gemini";
	const type = frame.type;
	if (typeof type === "string") {
		if (ANTHROPIC_EVENTS.has(type)) return "anthropic";
		if (RESPONSES_EVENTS.has(type)) return "responses";
		if (type === "message" && Array.isArray(frame.content)) return "anthropic";
	}
	if (frame.object === "response" || Array.isArray(frame.output)) return "responses";
	if (frame.object === "interaction") return "interactions";
	if (typeof frame.event_type === "string" && INTERACTIONS_EVENTS.has(frame.event_type)) return "interactions";
	if (isObject(frame.usage) && num(frame.usage.total_input_tokens) != null) return "interactions";
	if (Array.isArray(frame.choices)) return "openai";
	if (frame.usage) return "openai";
	return "unknown";
}
function deltaFrame(content, reasoning) {
	const delta = {};
	if (typeof content === "string" && content) delta.content = content;
	if (typeof reasoning === "string" && reasoning) delta.reasoning_content = reasoning;
	return { choices: [{ delta }] };
}
function finishFrame(reason) {
	return { choices: [{
		delta: {},
		finish_reason: reason
	}] };
}
function usageFrame(usage, model) {
	const out = {
		choices: [],
		usage
	};
	if (model) out.model = model;
	return out;
}
function createFrameNormalizer() {
	const st = {
		protocol: "unknown",
		anthropicStart: null,
		anthropicOutput: null,
		rawUsage: null,
		rawFinish: null,
		rawModel: null
	};
	function projectGemini(frame) {
		const out = [];
		if (typeof frame.modelVersion === "string" && frame.modelVersion) st.rawModel = frame.modelVersion;
		const cand = Array.isArray(frame.candidates) ? frame.candidates[0] : null;
		const parts = cand?.content?.parts;
		if (Array.isArray(parts)) {
			let text = "";
			let think = "";
			for (const part of parts) {
				if (!isObject(part) || typeof part.text !== "string" || !part.text) continue;
				if (part.thought === true) think += part.text;
				else text += part.text;
			}
			if (think) out.push(deltaFrame(void 0, think));
			if (text) out.push(deltaFrame(text));
		}
		const blockReason = frame?.promptFeedback?.blockReason;
		if (blockReason) {
			st.rawFinish = String(blockReason);
			out.push(finishFrame("content_filter"));
		}
		const fr = cand?.finishReason;
		if (typeof fr === "string" && fr) {
			st.rawFinish = fr;
			out.push(finishFrame(GEMINI_FINISH[fr] || "other"));
		}
		const um = frame.usageMetadata;
		if (isObject(um)) {
			st.rawUsage = um;
			out.push(usageFrame(geminiUsageIR(um), typeof frame.modelVersion === "string" ? frame.modelVersion : null));
		}
		return out;
	}
	function projectAnthropic(frame) {
		const out = [];
		const type = frame.type;
		if (type === "message_start") {
			const msg = frame.message || {};
			if (typeof msg.model === "string" && msg.model) st.rawModel = msg.model;
			if (isObject(msg.usage)) st.anthropicStart = { ...msg.usage };
			const u = anthropicUsageIR(st.anthropicStart, st.anthropicOutput);
			st.rawUsage = { ...st.anthropicStart || {} };
			out.push(usageFrame(u, st.rawModel));
			return out;
		}
		if (type === "content_block_delta") {
			const delta = frame.delta || {};
			if (delta.type === "thinking_delta" && typeof delta.thinking === "string" && delta.thinking) out.push(deltaFrame(void 0, delta.thinking));
			else if (delta.type === "text_delta" && typeof delta.text === "string" && delta.text) out.push(deltaFrame(delta.text));
			return out;
		}
		if (type === "message_delta") {
			if (isObject(frame.usage) && typeof frame.usage.output_tokens === "number") st.anthropicOutput = frame.usage.output_tokens;
			st.rawUsage = {
				...st.anthropicStart || {},
				...isObject(frame.usage) ? frame.usage : {}
			};
			const stop = frame?.delta?.stop_reason;
			if (typeof stop === "string" && stop) {
				st.rawFinish = stop;
				out.push(finishFrame(ANTHROPIC_FINISH[stop] || "other"));
			}
			out.push(usageFrame(anthropicUsageIR(st.anthropicStart, st.anthropicOutput), st.rawModel));
			return out;
		}
		if (type === "message") {
			if (typeof frame.model === "string" && frame.model) st.rawModel = frame.model;
			if (Array.isArray(frame.content)) {
				let text = "";
				let think = "";
				for (const block of frame.content) {
					if (!isObject(block) || typeof block.text !== "string" || !block.text) continue;
					if (block.type === "thinking") think += block.text;
					else if (block.type === "text") text += block.text;
				}
				if (think) out.push(deltaFrame(void 0, think));
				if (text) out.push(deltaFrame(text));
			}
			if (isObject(frame.usage)) {
				st.rawUsage = frame.usage;
				st.anthropicStart = { ...frame.usage };
				out.push(usageFrame(anthropicUsageIR(st.anthropicStart, null), st.rawModel));
			}
			if (typeof frame.stop_reason === "string" && frame.stop_reason) {
				st.rawFinish = frame.stop_reason;
				out.push(finishFrame(ANTHROPIC_FINISH[frame.stop_reason] || "other"));
			}
			return out;
		}
		return [];
	}
	function projectResponses(frame) {
		const out = [];
		const type = frame.type;
		if (type === "response.created" || type === "response.in_progress") {
			const model = frame?.response?.model;
			if (typeof model === "string" && model) st.rawModel = model;
			return out;
		}
		if (type === "response.output_text.delta") {
			if (typeof frame.delta === "string" && frame.delta) out.push(deltaFrame(frame.delta));
			return out;
		}
		if (type === "response.reasoning_summary_text.delta") {
			if (typeof frame.delta === "string" && frame.delta) out.push(deltaFrame(void 0, frame.delta));
			return out;
		}
		if (type === "response.completed" || type === "response.incomplete" || type === "response.failed") {
			const resp = frame.response || {};
			if (typeof resp.model === "string" && resp.model) st.rawModel = resp.model;
			if (isObject(resp.usage)) {
				st.rawUsage = resp.usage;
				out.push(usageFrame(responsesUsageIR(resp.usage), st.rawModel));
			}
			if (type === "response.incomplete") {
				const reason = resp?.incomplete_details?.reason;
				st.rawFinish = typeof reason === "string" ? reason : "incomplete";
				out.push(finishFrame(reason === "content_filter" ? "content_filter" : "length"));
			} else if (type === "response.failed") {
				st.rawFinish = "failed";
				out.push(finishFrame("other"));
			} else out.push(finishFrame("stop"));
			return out;
		}
		if (frame.object === "response") {
			if (typeof frame.model === "string" && frame.model) st.rawModel = frame.model;
			if (Array.isArray(frame.output)) {
				let text = "";
				let think = "";
				for (const item of frame.output) {
					if (!isObject(item) || !Array.isArray(item.content)) continue;
					for (const part of item.content) {
						if (!isObject(part) || typeof part.text !== "string" || !part.text) continue;
						if (part.type === "output_text" || part.type === "text") text += part.text;
						else if (part.type === "reasoning_text" || part.type === "summary_text") think += part.text;
					}
				}
				if (think) out.push(deltaFrame(void 0, think));
				if (text) out.push(deltaFrame(text));
			}
			if (isObject(frame.usage)) {
				st.rawUsage = frame.usage;
				out.push(usageFrame(responsesUsageIR(frame.usage), st.rawModel));
			}
			if (frame.status === "incomplete") out.push(finishFrame("length"));
			else if (frame.status === "failed") out.push(finishFrame("other"));
			else out.push(finishFrame("stop"));
			return out;
		}
		return [];
	}
	/**
	* Gemini Interactions → OpenAI 形状
	* 流式：interaction.created → step.start（thought/model_output）→ step.delta（thought_summary/text）
	*       → step.stop → interaction.completed（**usage 只在最后一个事件的 interaction.usage 里**）
	* 非流式：{ object:'interaction', steps[], usage, status }
	*/
	function projectInteractions(frame) {
		const out = [];
		const ev = typeof frame.event_type === "string" ? frame.event_type : "";
		if (ev === "interaction.created" || ev === "interaction.in_progress" || ev === "interaction.status_update") {
			const model = frame?.interaction?.model;
			if (typeof model === "string" && model) st.rawModel = model;
			return out;
		}
		if (ev === "step.start") {
			const step = isObject(frame.step) ? frame.step : null;
			const type = typeof step?.type === "string" ? step.type : "";
			if (type === "thought") {
				const think = joinTextBlocks(step?.summary) || joinTextBlocks(step?.content);
				if (think) out.push(deltaFrame(void 0, think));
			} else if (type === "model_output") {
				const text = joinTextBlocks(step?.content);
				if (text) out.push(deltaFrame(text));
			}
			return out;
		}
		if (ev === "step.delta") {
			const delta = isObject(frame.delta) ? frame.delta : null;
			const type = typeof delta?.type === "string" ? delta.type : "";
			if (type === "thought_summary") {
				const text = typeof delta?.content?.text === "string" ? delta.content.text : typeof delta?.text === "string" ? delta.text : "";
				if (text) out.push(deltaFrame(void 0, text));
			} else if (type === "text") {
				const text = typeof delta?.text === "string" ? delta.text : typeof delta?.content?.text === "string" ? delta.content.text : "";
				if (text) out.push(deltaFrame(text));
			}
			return out;
		}
		if (ev === "interaction.completed" || ev === "interaction.failed") {
			const it = isObject(frame.interaction) ? frame.interaction : {};
			if (typeof it.model === "string" && it.model) st.rawModel = it.model;
			const status = typeof it.status === "string" ? it.status : ev === "interaction.failed" ? "failed" : "";
			if (status) st.rawFinish = status;
			if (isObject(it.usage)) {
				st.rawUsage = it.usage;
				out.push(usageFrame(interactionsUsageIR(it.usage), st.rawModel));
			}
			out.push(finishFrame(INTERACTIONS_STATUS[status] || "other"));
			return out;
		}
		if (frame.object === "interaction") {
			if (typeof frame.model === "string" && frame.model) st.rawModel = frame.model;
			const steps = Array.isArray(frame.steps) ? frame.steps : [];
			let text = "";
			let think = "";
			for (const step of steps) {
				if (!isObject(step)) continue;
				if (step.type === "thought") think += joinTextBlocks(step.summary) || joinTextBlocks(step.content);
				else if (step.type === "model_output") text += joinTextBlocks(step.content);
			}
			if (think) out.push(deltaFrame(void 0, think));
			if (text) out.push(deltaFrame(text));
			if (isObject(frame.usage)) {
				st.rawUsage = frame.usage;
				out.push(usageFrame(interactionsUsageIR(frame.usage), st.rawModel));
			}
			const status = typeof frame.status === "string" ? frame.status : "";
			if (status) st.rawFinish = status;
			out.push(finishFrame(INTERACTIONS_STATUS[status] || "other"));
			return out;
		}
		return [];
	}
	function projectOpenAI(frame) {
		const raw = isObject(frame.usage) ? frame.usage : isObject(frame?.choices?.[0]?.usage) ? frame.choices[0].usage : null;
		const fr = frame?.choices?.[0]?.finish_reason;
		if (typeof fr === "string" && fr) st.rawFinish = fr;
		if (typeof frame.model === "string" && frame.model) st.rawModel = frame.model;
		if (!raw) return [frame];
		st.rawUsage = raw;
		if ((num(raw.completion_tokens_details?.reasoning_tokens) ?? num(raw.output_tokens_details?.reasoning_tokens) ?? num(raw.reasoning_tokens) ?? num(raw.thinking_tokens)) != null) return [frame];
		const usage = openaiUsageIR(raw);
		const completionRaw = pos(num(raw.completion_tokens) ?? num(raw.output_tokens));
		if (usage.completion_tokens === completionRaw) return [frame];
		return [{
			...frame,
			usage
		}];
	}
	function projectFrame(frame) {
		if (st.protocol === "unknown") st.protocol = detectProtocol(frame);
		switch (st.protocol) {
			case "gemini": return projectGemini(frame);
			case "interactions": return projectInteractions(frame);
			case "anthropic": return projectAnthropic(frame);
			case "responses": return projectResponses(frame);
			case "openai": return projectOpenAI(frame);
			default: return [frame];
		}
	}
	function projectLine(line) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) return "";
		const payload = trimmed.slice(5).trim();
		if (!payload) return "";
		if (payload === "[DONE]") return "data: [DONE]\n";
		let frame;
		try {
			frame = JSON.parse(payload);
		} catch {
			return line + "\n";
		}
		try {
			if (st.protocol === "unknown") st.protocol = detectProtocol(frame);
			if (st.protocol === "openai" || st.protocol === "unknown") {
				const out = projectFrame(frame);
				if (out.length === 1 && out[0] === frame) return line + "\n";
				return out.map((f) => "data: " + JSON.stringify(f) + "\n").join("");
			}
			const frames = projectFrame(frame);
			if (!frames.length) return "";
			return frames.map((f) => "data: " + JSON.stringify(f) + "\n").join("");
		} catch {
			return line + "\n";
		}
	}
	function mergeProjected(frames) {
		let content = "";
		let reasoning = "";
		let finish = null;
		let usage = null;
		let model = null;
		for (const f of frames) {
			if (typeof f?.model === "string" && f.model) model = f.model;
			if (isObject(f?.usage)) usage = f.usage;
			const c = Array.isArray(f?.choices) ? f.choices[0] : null;
			if (!c) continue;
			const d = c.delta || c.message || {};
			if (typeof d.content === "string") content += d.content;
			if (typeof d.reasoning_content === "string") reasoning += d.reasoning_content;
			if (typeof c.finish_reason === "string" && c.finish_reason) finish = c.finish_reason;
		}
		const message = {};
		if (content) message.content = content;
		if (reasoning) message.reasoning_content = reasoning;
		const out = { choices: [{
			message,
			finish_reason: finish
		}] };
		if (usage) out.usage = usage;
		if (model) out.model = model;
		return out;
	}
	function projectSseText(text) {
		if (!text) return text;
		try {
			let out = "";
			for (const line of text.split("\n")) out += projectLine(line);
			return out || text;
		} catch {
			return text;
		}
	}
	return {
		projectSse(text) {
			return projectSseText(text);
		},
		projectWhole(text) {
			const trimmed = (text || "").trim();
			if (!trimmed) return text;
			try {
				if (trimmed.startsWith("{")) {
					const frame = JSON.parse(trimmed);
					const frames = projectFrame(frame);
					if (frames.length === 1 && frames[0] === frame) return text;
					return JSON.stringify(mergeProjected(frames));
				}
				if (trimmed.startsWith("[")) {
					const list = JSON.parse(trimmed);
					if (!Array.isArray(list)) return text;
					const frames = [];
					for (const item of list) frames.push(...projectFrame(item));
					if (!frames.length) return text;
					return JSON.stringify(mergeProjected(frames));
				}
			} catch {
				return text;
			}
			return projectSseText(text);
		},
		protocol() {
			return st.protocol;
		},
		rawUsage() {
			return st.rawUsage;
		},
		rawFinishReason() {
			return st.rawFinish;
		},
		rawModel() {
			return st.rawModel;
		},
		active() {
			return st.protocol !== "openai" && st.protocol !== "unknown";
		}
	};
}
//#endregion
//#region src/services/request-log.ts
/**
* 请求日志：只保留「最后一轮」对话请求的标头、正文与响应元数据。
*
* 定位：纯诊断用途，不参与统计、不进历史、不导出。每次请求开始时整体覆盖，
* 因此本地永远只有一条记录（用户点「清空」后为空）。
*
* 隐私：请求头里的 Authorization / x-api-key / cookie 一律打码后再落盘，
* 正文里可能包含对话内容，页面顶部有明确提示，可随时清空。
*/
var LOG_STORAGE_KEY = "aus_last_request_v1";
/** 请求正文上限（字符），超出截断并标记，避免撑爆 localStorage */
var LOG_BODY_LIMIT = 2e5;
/** 单个字符串值在树里最多展示的字符数 */
var LOG_VALUE_LIMIT = 2e3;
var SENSITIVE_HEADERS = [
	"authorization",
	"proxy-authorization",
	"cookie",
	"set-cookie",
	"x-api-key",
	"api-key",
	"x-auth-token",
	"x-csrf-token",
	"x-xsrf-token"
];
function isSensitive(name) {
	return SENSITIVE_HEADERS.includes(name.trim().toLowerCase());
}
/** 打码：保留 scheme 前缀与首尾少量字符，中间用 * 代替 */
function redactValue(value) {
	const text = String(value ?? "");
	const match = text.match(/^(\S+\s+)(.*)$/);
	const prefix = match ? match[1] : "";
	const secret = match ? match[2] : text;
	if (secret.length <= 12) return prefix + "*".repeat(Math.max(secret.length, 4));
	return prefix + secret.slice(0, 6) + "*".repeat(Math.min(10, secret.length - 10)) + secret.slice(-4);
}
function redactHeader(name, value) {
	return isSensitive(name) ? redactValue(value) : String(value ?? "");
}
/** 把 Headers / 数组 / 普通对象统一成有序键值对，敏感项打码 */
function headersToPairs(input) {
	const pairs = [];
	const push = (name, value) => {
		const key = String(name || "").trim();
		if (!key) return;
		pairs.push([key, redactHeader(key, String(value ?? ""))]);
	};
	if (!input) return pairs;
	const anyInput = input;
	if (typeof anyInput.forEach === "function" && typeof anyInput.get === "function") {
		anyInput.forEach((value, name) => push(name, value));
		return pairs.sort((a, b) => a[0].localeCompare(b[0]));
	}
	if (Array.isArray(anyInput)) {
		for (const item of anyInput) if (Array.isArray(item) && item.length >= 2) push(item[0], item[1]);
		return pairs;
	}
	if (typeof anyInput === "object") for (const [key, value] of Object.entries(anyInput)) if (Array.isArray(value)) push(key, value.join(", "));
	else push(key, value);
	return pairs.sort((a, b) => a[0].localeCompare(b[0]));
}
/** 请求体原文 → 截断信息 */
function clipBody(text, limit = LOG_BODY_LIMIT) {
	const raw = typeof text === "string" ? text : "";
	if (raw.length <= limit) return {
		body: raw,
		truncated: false
	};
	return {
		body: raw.slice(0, limit),
		truncated: true
	};
}
function emptyResponse() {
	return {
		status: 0,
		statusText: "",
		headers: [],
		firstByteMs: null,
		durationMs: null,
		streamed: null,
		model: null,
		finishReason: null,
		usage: null,
		error: null
	};
}
/** 请求发出时调用：整体覆盖上一条记录 */
function saveRequestStart(input) {
	try {
		const clipped = clipBody(input.body || "");
		const record = {
			at: typeof input.at === "number" ? input.at : Date.now(),
			method: String(input.method || "POST").toUpperCase(),
			url: String(input.url || ""),
			requestHeaders: headersToPairs(input.headers),
			requestBody: clipped.body,
			requestBodyTruncated: clipped.truncated,
			response: emptyResponse()
		};
		globalThis.localStorage?.setItem(LOG_STORAGE_KEY, JSON.stringify(record));
	} catch {}
}
function readRaw() {
	try {
		const text = globalThis.localStorage?.getItem(LOG_STORAGE_KEY);
		if (!text) return null;
		const parsed = JSON.parse(text);
		if (!parsed || typeof parsed !== "object") return null;
		return {
			at: typeof parsed.at === "number" ? parsed.at : 0,
			method: String(parsed.method || "POST"),
			url: String(parsed.url || ""),
			requestHeaders: Array.isArray(parsed.requestHeaders) ? parsed.requestHeaders.filter((p) => Array.isArray(p) && p.length >= 2).map((p) => [String(p[0]), String(p[1])]) : [],
			requestBody: typeof parsed.requestBody === "string" ? parsed.requestBody : "",
			requestBodyTruncated: parsed.requestBodyTruncated === true,
			response: {
				...emptyResponse(),
				...parsed.response && typeof parsed.response === "object" ? parsed.response : {}
			}
		};
	} catch {
		return null;
	}
}
/** 写入响应侧字段（合并到同一条记录） */
function patchRequestLog(patch) {
	try {
		const record = readRaw();
		if (!record) return;
		const next = { ...record.response };
		if (typeof patch.status === "number") next.status = patch.status;
		if (typeof patch.statusText === "string") next.statusText = patch.statusText;
		if (patch.headers !== void 0) next.headers = headersToPairs(patch.headers);
		if (patch.firstByteMs !== void 0) next.firstByteMs = patch.firstByteMs;
		if (patch.durationMs !== void 0) next.durationMs = patch.durationMs;
		if (patch.streamed !== void 0) next.streamed = patch.streamed;
		if (patch.model !== void 0) next.model = patch.model;
		if (patch.finishReason !== void 0) next.finishReason = patch.finishReason;
		if (patch.usage !== void 0) next.usage = patch.usage;
		if (patch.error !== void 0) next.error = patch.error;
		globalThis.localStorage?.setItem(LOG_STORAGE_KEY, JSON.stringify({
			...record,
			response: next
		}));
	} catch {}
}
function readRequestLog() {
	return readRaw();
}
function clearRequestLog() {
	try {
		globalThis.localStorage?.removeItem(LOG_STORAGE_KEY);
	} catch {}
}
/** 摘要：状态码 + 耗时一行文案，供页面顶部展示 */
function summarizeRequestLog(record) {
	if (!record) return "暂无记录";
	const r = record.response;
	if (!r || !r.status) return "请求已发出，等待响应";
	const parts = [String(r.status)];
	if (r.durationMs != null) parts.push(Math.round(r.durationMs) + "ms");
	else if (r.firstByteMs != null) parts.push("首字 " + Math.round(r.firstByteMs) + "ms");
	return parts.join(" · ");
}
var RECENT_TURNS_KEY = "aus_recent_turns_v1";
function contentTextOf(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const parts = [];
		for (const item of content) if (typeof item === "string") parts.push(item);
		else if (item && typeof item.text === "string") parts.push(String(item.text));
		return parts.join("\n");
	}
	return "";
}
function turnRow(role, full, at, kind) {
	return {
		at,
		role,
		kind,
		text: full.length <= 400 ? full : full.slice(0, 400),
		chars: full.length
	};
}
/**
* 请求发出时记一份「最近几轮在聊什么」。
*
* 只取尾部 6 条 user/assistant 是不够的：人称准则、字数准则、输出模板这类尾部注入
* 提示词本身也是 user，重新生成时尾部连着好几条 user，一条对白都抓不到（真机上反馈
* 包里 6 条全是提示词）。所以改成按轮配对——从尾部往前找 assistant 回复，每条回复
* 连同它前面的 user 提问一起收下，最多 3 轮；找不到 assistant 时只留最后一条 user，
* 并标 kind='prompt-tail'，让看日志的人一眼知道这不是对白。
*/
function noteRecentTurns(messages, at = Date.now()) {
	try {
		if (!Array.isArray(messages)) return;
		const rows = [];
		let turns = 0;
		for (let i = messages.length - 1; i >= 0 && turns < 3; i -= 1) {
			const msg = messages[i];
			if (String(msg?.role || "") !== "assistant") continue;
			const reply = contentTextOf(msg?.content);
			if (!reply) continue;
			const pair = [];
			const prev = i > 0 ? messages[i - 1] : null;
			if (prev && String(prev?.role || "") === "user") {
				const ask = contentTextOf(prev?.content);
				if (ask) pair.push(turnRow("user", ask, at, "dialogue"));
			}
			pair.push(turnRow("assistant", reply, at, "dialogue"));
			rows.unshift(...pair);
			turns += 1;
		}
		if (!rows.length) for (let i = messages.length - 1; i >= 0; i -= 1) {
			const msg = messages[i];
			if (String(msg?.role || "") !== "user") continue;
			const text = contentTextOf(msg?.content);
			if (!text) continue;
			rows.push(turnRow("user", text, at, "prompt-tail"));
			break;
		}
		if (!rows.length) return;
		let trimmed = rows.slice(-6);
		let payload = JSON.stringify(trimmed);
		while (payload.length > 8e3 && trimmed.length > 1) {
			trimmed = trimmed.slice(1);
			payload = JSON.stringify(trimmed);
		}
		globalThis.localStorage?.setItem(RECENT_TURNS_KEY, payload);
	} catch {}
}
function readRecentTurns() {
	try {
		const text = globalThis.localStorage?.getItem(RECENT_TURNS_KEY);
		if (!text) return [];
		const parsed = JSON.parse(text);
		if (!Array.isArray(parsed)) return [];
		const out = [];
		for (const item of parsed) {
			if (!item || typeof item !== "object") continue;
			const role = String(item.role || "");
			if (!role) continue;
			out.push({
				at: Number(item.at) || 0,
				role,
				kind: item.kind === "prompt-tail" ? "prompt-tail" : "dialogue",
				text: String(item.text || ""),
				chars: Number(item.chars) || 0
			});
		}
		return out;
	} catch {
		return [];
	}
}
/**
* 落盘镜像：真机上「没记进历史」往往发生在几轮之前，而页面一刷新内存缓冲就空了
* （反馈包里 capture 总是空数组）。这里把同一批快照同步写进 localStorage，
* 只含阶段名、模型名、URL 与用量数字，不含任何正文。
*/
var CAPTURE_STORAGE_KEY = "aus_capture_stages_v1";
var CAPTURE_STAGE_SET = /* @__PURE__ */ new Set([
	"fetch-start",
	"fetch-parse",
	"event-drop",
	"entry-added",
	"entry-error",
	"turn-estimated",
	"turn-interrupted"
]);
var USAGE_KEYS = [
	"prompt_tokens",
	"completion_tokens",
	"total_tokens",
	"input_tokens",
	"output_tokens",
	"cached_tokens",
	"prompt_cache_hit_tokens",
	"prompt_cache_miss_tokens"
];
var buffer = [];
function readPersisted() {
	try {
		const text = globalThis.localStorage?.getItem(CAPTURE_STORAGE_KEY);
		if (!text) return [];
		const parsed = JSON.parse(text);
		if (!Array.isArray(parsed)) return [];
		const out = [];
		for (const item of parsed) {
			if (!item || typeof item !== "object") continue;
			const stage = String(item.stage || "");
			if (!CAPTURE_STAGE_SET.has(stage)) continue;
			out.push({
				at: Number(item.at) || 0,
				stage,
				model: item.model ? String(item.model) : void 0,
				requestId: item.requestId ? String(item.requestId) : void 0,
				url: item.url ? String(item.url) : void 0,
				streamed: typeof item.streamed === "boolean" ? item.streamed : void 0,
				usageFound: typeof item.usageFound === "boolean" ? item.usageFound : void 0,
				usageZero: typeof item.usageZero === "boolean" ? item.usageZero : void 0,
				usage: item.usage && typeof item.usage === "object" ? item.usage : null,
				finishReason: item.finishReason == null ? void 0 : String(item.finishReason),
				reason: item.reason ? String(item.reason) : void 0
			});
		}
		return out.slice(-24);
	} catch {
		return [];
	}
}
function persist() {
	try {
		globalThis.localStorage?.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(buffer));
	} catch {}
}
/** 只留下数字型用量字段，避免把整块 usage 塞进诊断包 */
function usageNumbers(usage) {
	if (!usage || typeof usage !== "object") return null;
	const out = {};
	let any = false;
	for (const key of USAGE_KEYS) {
		const v = usage[key];
		if (typeof v === "number" && Number.isFinite(v)) {
			out[key] = v;
			any = true;
		}
	}
	const cached = usage?.prompt_tokens_details?.cached_tokens;
	if (typeof cached === "number" && Number.isFinite(cached)) {
		out.cached_tokens = cached;
		any = true;
	}
	return any ? out : null;
}
/** usage 是否存在但三项计数全为 0（上游不计量时的典型表现） */
function isZeroUsage(usage) {
	const n = usageNumbers(usage);
	if (!n) return false;
	const present = [
		"prompt_tokens",
		"completion_tokens",
		"total_tokens",
		"input_tokens",
		"output_tokens"
	].filter((k) => typeof n[k] === "number");
	if (!present.length) return false;
	return present.every((k) => n[k] === 0);
}
function clipText(v, max) {
	const s = typeof v === "string" ? v : v == null ? "" : String(v);
	return s.length > max ? s.slice(0, max) : s;
}
/** 记一条链路快照（永不抛错） */
function noteCaptureStage(stage, data = {}) {
	try {
		const rec = {
			at: typeof data.at === "number" ? data.at : Date.now(),
			stage,
			model: data.model ? clipText(data.model, 120) : void 0,
			requestId: data.requestId ? clipText(data.requestId, 80) : void 0,
			url: data.url ? clipText(data.url, 200) : void 0,
			streamed: data.streamed === void 0 ? void 0 : data.streamed,
			usageFound: data.usageFound,
			usageZero: data.usageZero,
			usage: data.usage || null,
			finishReason: data.finishReason === void 0 ? void 0 : data.finishReason,
			reason: data.reason ? clipText(data.reason, 300) : void 0
		};
		buffer.push(rec);
		if (buffer.length > 24) buffer = buffer.slice(-24);
		persist();
	} catch {}
}
/** 最近的链路快照（按时间正序，最后一条最新） */
function listCaptureStages(limit = 24) {
	try {
		const n = Math.max(1, Math.min(24, Math.floor(limit) || 24));
		if (!buffer.length) buffer = readPersisted();
		return buffer.slice(-n).map((r) => ({ ...r }));
	} catch {
		return [];
	}
}
/** 诊断包里的 capture 段：最近若干条快照，已裁掉空字段 */
function captureDigest(limit = 24) {
	return listCaptureStages(limit).map((rec) => {
		const out = {
			at: rec.at,
			stage: rec.stage
		};
		if (rec.model) out.model = rec.model;
		if (rec.requestId) out.requestId = rec.requestId;
		if (rec.url) out.url = rec.url;
		if (rec.streamed !== void 0 && rec.streamed !== null) out.streamed = rec.streamed;
		if (rec.usageFound !== void 0) out.usageFound = rec.usageFound;
		if (rec.usageZero !== void 0) out.usageZero = rec.usageZero;
		if (rec.usage) out.usage = rec.usage;
		if (rec.finishReason) out.finishReason = rec.finishReason;
		if (rec.reason) out.reason = rec.reason;
		return out;
	});
}
//#endregion
//#region src/services/turn-outcome.ts
/** 本次生成结果 → 处置决定；调用方只按 kind 分派，不再自己拼条件 */
function decideTurnOutcome(signals) {
	const hasUsage = signals.hasUsage === true;
	const usable = signals.usageUsable === true;
	const hasOutput = signals.hasOutput === true;
	const pendingStop = signals.pendingStop === true;
	const streamError = signals.streamError ? String(signals.streamError) : null;
	if (usable) {
		const interrupted = pendingStop ? "user" : streamError ? "upstream" : null;
		return {
			kind: "record",
			interrupted,
			reason: interrupted ? "usage-" + interrupted + "-interrupted" : "usage"
		};
	}
	if (!hasOutput) return {
		kind: "drop",
		interrupted: null,
		reason: hasUsage ? "usage-all-zero-no-output" : "no-usage-no-output"
	};
	if (pendingStop) return {
		kind: "interrupted",
		interrupted: "user",
		reason: "no-usage-user-stop"
	};
	if (streamError) return {
		kind: "interrupted",
		interrupted: "upstream",
		reason: "no-usage-stream-error"
	};
	return {
		kind: "estimate",
		interrupted: null,
		reason: hasUsage ? "usage-all-zero-with-output" : "no-usage-with-output"
	};
}
//#endregion
//#region src/services/token-estimate.ts
/** CJK 与全角标点：这些字符的 token 密度明显高于拉丁字母 */
var CJK_RE = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/g;
function charStats(text) {
	const raw = typeof text === "string" ? text : "";
	const chars = raw.length;
	if (!chars) return {
		chars: 0,
		cjkChars: 0
	};
	const matched = raw.match(CJK_RE);
	return {
		chars,
		cjkChars: matched ? matched.length : 0
	};
}
/** 字符 → token 的兜底口径：CJK 0.6/字，其余 3.5 字符/token */
function tokensFromChars(stats) {
	const chars = Math.max(0, Math.floor(stats.chars || 0));
	const cjk = Math.min(chars, Math.max(0, Math.floor(stats.cjkChars || 0)));
	const ascii = Math.max(0, chars - cjk);
	const tokens = Math.ceil(cjk * .6 + ascii / 3.5);
	return Math.max(0, tokens);
}
function contentToText(value) {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		let out = "";
		for (const part of value) {
			if (typeof part === "string") {
				out += part;
				continue;
			}
			if (part && typeof part === "object") {
				const text = part.text;
				if (typeof text === "string") out += text;
			}
		}
		return out;
	}
	if (value && typeof value === "object" && typeof value.text === "string") return String(value.text);
	return "";
}
/** 把一轮请求的 messages 拍平成纯文本（只用于计数，不上传、不落盘） */
function messagesText(messages) {
	if (!Array.isArray(messages)) return "";
	let out = "";
	for (const message of messages) {
		if (!message || typeof message !== "object") continue;
		const role = typeof message.role === "string" ? message.role : "";
		const text = contentToText(message.content);
		if (role) out += role + ": ";
		out += text + "\n";
	}
	return out;
}
/** 酒馆 tokenizer：拿不到（旧版本、未就绪、报错）一律返回 null，绝不抛出 */
async function tavernTokenCount(text) {
	if (!text) return 0;
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		const counter = ctx?.getTokenCountAsync || globalThis.getTokenCountAsync;
		if (typeof counter !== "function") return null;
		const value = await counter.call(ctx || globalThis, text);
		const num = Number(value);
		return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
	} catch {
		return null;
	}
}
/**
* 估算一段文本的 token 数。
* preferTokens 适合「酒馆已经算好了」的场景（extra.token_count），优先级最高。
*/
async function estimateTextTokens(text, options = {}) {
	const stats = charStats(text);
	const prefer = Number(options.preferTokens);
	if (Number.isFinite(prefer) && prefer > 0) return {
		tokens: Math.round(prefer),
		method: "tavern-token-count",
		chars: stats.chars,
		cjkChars: stats.cjkChars
	};
	if (stats.chars > 0) {
		const counted = await tavernTokenCount(typeof text === "string" ? text : "");
		if (counted != null && counted > 0) return {
			tokens: counted,
			method: "tavern-tokenizer",
			chars: stats.chars,
			cjkChars: stats.cjkChars
		};
	}
	return {
		tokens: tokensFromChars(stats),
		method: "char-heuristic",
		chars: stats.chars,
		cjkChars: stats.cjkChars
	};
}
/** 输入侧估算：按整轮 messages 拍平后的文本计数 */
async function estimatePromptTokens(messages) {
	return estimateTextTokens(messagesText(messages));
}
//#endregion
//#region src/services/interception.ts
var interception_exports = /* @__PURE__ */ __exportAll({
	installInterception: () => installInterception,
	normalizeTiming: () => normalizeTiming,
	pickEndedTurn: () => pickEndedTurn,
	pickPromptMessages: () => pickPromptMessages,
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
/** 流式测量到的时序快照（TTFT / 思维链耗时 / 真假流式），与 usage 解耦：
*  上游不回 usage 时 finish() 也会落一份，避免主路径明明测到了却拿不到。 */
var lastStreamTiming = null;
/**
* 本轮账本：按 requestId 保存每一轮请求的现场。
*
* 早期版本只有一个 lastTurn 单槽，GENERATION_ENDED 取到的是「最后发出的那一轮」。
* 两轮并发（A 在途、B 后发）时，A 结束时会把 B 的 startedAt / promptMessages /
* requestId / streamed 当成 A 的现场落库：历史里出现「duration 只有几秒、
* requestId 却是别人的、输入 token 与那轮真实 prompt 差一截」的错账。
* 因此这里改为按 requestId 记账，结束事件按模型名与「刚结束」时刻对号入座。
*/
var turnLedger = /* @__PURE__ */ new Map();
/** 账本容量与存活时间：只留最近的若干轮，长会话不会无限增长 */
var TURN_LEDGER_KEEP = 32;
var TURN_LEDGER_TTL_MS = 18e5;
/** 生成结束事件与请求的配对窗口：一轮从发出到结束很少超过 10 分钟 */
var ENDED_MATCH_WINDOW_MS = 6e5;
/** 用户点击「停止」的时刻；只在窗口期内有效，过期自动忽略 */
var pendingStopAt = 0;
var pendingStopTimer = null;
/** 停止信号与生成结束事件之间的等待窗口 */
var STOP_WINDOW_MS = 3e3;
/** 收到停止信号后等这么久再兜底结算（等 GENERATION_ENDED 先到） */
var STOP_SETTLE_DELAY_MS = 1500;
function turnKeyOf(turn) {
	return turn.requestId || "start:" + turn.startTime;
}
/** 登记一轮请求现场；同一 requestId 覆盖旧记录（重试会拿到新 id，不会覆盖） */
function registerTurn(turn) {
	try {
		turnLedger.set(turnKeyOf(turn), turn);
		pruneTurns();
	} catch {}
	return turn;
}
function pruneTurns(now = Date.now()) {
	try {
		for (const [key, t] of turnLedger) if (now - t.startTime > TURN_LEDGER_TTL_MS) turnLedger.delete(key);
		let over = turnLedger.size - TURN_LEDGER_KEEP;
		if (over <= 0) return;
		for (const [key, t] of turnLedger) {
			if (over <= 0) break;
			if (!t.settled) continue;
			turnLedger.delete(key);
			over -= 1;
		}
	} catch {}
}
/** 按 startTime 反查现场（fetch 闭包与主路径共用同一把尺子） */
function turnByStart(startTime) {
	if (!(startTime > 0)) return null;
	for (const t of turnLedger.values()) if (t.startTime === startTime) return t;
	return null;
}
function currentTurn(startTime) {
	if (typeof startTime === "number" && startTime > 0) return turnByStart(startTime);
	let latest = null;
	for (const t of turnLedger.values()) if (!latest || t.startTime > latest.startTime) latest = t;
	return latest;
}
function normalizeModel(name) {
	return String(name ?? "").trim().toLowerCase();
}
/** 模型名比对：互为子串也算同一模型（宿主有时给模型名加前缀 / 后缀） */
function modelMatches(a, b) {
	const x = normalizeModel(a);
	const y = normalizeModel(b);
	if (!x || !y) return false;
	return x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1;
}
/** 「刚结束」的先后：读完响应的轮次优先，其次比 endedAt / startTime 谁更晚 */
function endedRank(t) {
	return (t.endedAt > 0 ? 0x38d7ea4c68000 : 0) + (t.endedAt || t.startTime);
}
/**
* 找出生成结束事件对应的那一轮。
*
* 并发时账本里会有多轮在途，绝不能按「最后发出」取：先用模型名对号
* （chat tail 的模型就是这一轮刚用的模型），同模型多轮时取最近结束的一轮；
* 只有一轮候选时直接认领（无歧义，也容忍上游改写模型名）。
* includeSettled=false 时只看还没落库的轮次。
*/
function pickEndedTurn(model, includeSettled = true) {
	const now = Date.now();
	const wanted = normalizeModel(model);
	const candidates = [];
	/** 模型名明确匹配的候选（严格优先） */
	const matched = [];
	/** 模型名缺失的候选（请求体没带 model，或上游没回模型名）：可以认领 */
	const unknownModel = [];
	/** 账本里是否存在同模型的轮次（含已结算）：存在就说明结束事件属于它，不能认别人的 */
	let sameModelAnywhere = false;
	for (const t of turnLedger.values()) {
		const inWindow = now - t.startTime <= ENDED_MATCH_WINDOW_MS;
		const tModel = normalizeModel(t.model);
		if (inWindow && wanted && tModel && modelMatches(model, t.model)) sameModelAnywhere = true;
		if (!inWindow) continue;
		if (!includeSettled && t.settled) continue;
		candidates.push(t);
	}
	if (!candidates.length) return null;
	const latestOf = (list) => {
		let out = null;
		for (const t of list) if (!out || endedRank(t) > endedRank(out)) out = t;
		return out;
	};
	if (!wanted) return latestOf(candidates);
	for (const t of candidates) {
		if (!normalizeModel(t.model)) {
			unknownModel.push(t);
			continue;
		}
		if (modelMatches(model, t.model)) matched.push(t);
	}
	if (matched.length) return latestOf(matched);
	if (sameModelAnywhere) return null;
	if (unknownModel.length) return latestOf(unknownModel);
	if (candidates.length === 1) return candidates[0];
	return null;
}
function stopPending() {
	return pendingStopAt > 0 && Date.now() - pendingStopAt < STOP_WINDOW_MS;
}
/**
* 正常路径（上游给了 usage）的中断标记：
* 用户点了停止 → user；流读出过错 → upstream；都没有则不写 interrupted。
* 估算路径的 meta 由 settleTurnWithoutUsage 自己构造。
*/
function turnMetaFor(startTime) {
	const turn = currentTurn(startTime);
	const interrupted = stopPending() ? "user" : turn?.streamError ? "upstream" : null;
	const modelFallback = turn?.modelFallback === true;
	if (!interrupted && !modelFallback) return null;
	const meta = { usageSource: "upstream" };
	meta.interrupted = interrupted;
	if (interrupted) meta.interruptReason = interrupted === "user" ? "user-stop" : String(turn?.streamError || "stream-error").slice(0, 200);
	if (modelFallback) meta.modelFallback = true;
	return meta;
}
/** 从响应原文里抽出助手输出文本（正文 + 思维链），只用于本地估算 token */
function collectOutputText(raw) {
	const text = String(raw || "");
	if (!text.trim()) return "";
	let out = "";
	const push = (record) => {
		const think = reasoningTextOf(record);
		if (think) out += think;
		const body = contentTextOf$1(record);
		if (body) out += body;
	};
	const trimmed = text.trim();
	if (trimmed.startsWith("{")) {
		try {
			push(JSON.parse(trimmed));
		} catch {}
		return out.slice(0, 2e5);
	}
	for (const rawLine of trimmed.split("\n")) {
		const line = rawLine.trim();
		if (!line.startsWith("data:")) continue;
		const payload = line.slice(5).trim();
		if (!payload || payload === "[DONE]") continue;
		try {
			push(JSON.parse(payload));
		} catch {}
	}
	return out.slice(0, 2e5);
}
function recentStreamTiming(maxAge = 6e4) {
	try {
		const st = lastStreamTiming;
		if (!st) return null;
		if (st.startTime === lastStart || Date.now() - st.at < maxAge) return st;
	} catch {}
	return null;
}
function setLastRequest(messages, start) {
	lastMessages = messages || [];
	lastStart = start || Date.now();
}
var TARGET_API = "/api/backends/chat-completions/generate";
var STREAM_TEXT_LIMIT = 1e6;
/** 应急逃生阀：控制台执行 localStorage.setItem('ds_include_usage','0') 可整体关闭该注入 */
function includeUsageSwitchOn() {
	try {
		return localStorage.getItem("ds_include_usage") !== "0";
	} catch {
		return true;
	}
}
/** 尝试让上游在流式响应里返回 usage，返回是否改动了请求体 */
function injectIncludeUsage(reqBody, source) {
	try {
		if (!reqBody || typeof reqBody !== "object") return false;
		if (reqBody.stream !== true) return false;
		if (!includeUsageSwitchOn()) return false;
		if (source !== "custom") return false;
		if (!isInjectableApiFormat(reqBody.custom_api_format)) return false;
		const merged = mergeIncludeUsage(reqBody.custom_include_body);
		if (!merged.changed) return false;
		reqBody.custom_include_body = merged.value;
		return true;
	} catch {
		return false;
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
	const collect = (record) => {
		const think = reasoningTextOf(record);
		if (think) thinkChars += think.length;
		const body = contentTextOf$1(record);
		if (body) contentChars += body.length;
	};
	const trimmed = String(text || "").trim();
	if (trimmed.startsWith("{")) try {
		collect(JSON.parse(trimmed));
	} catch {}
	else for (const raw of trimmed.split("\n")) {
		const line = raw.trim();
		if (!line.startsWith("data:")) continue;
		const payload = line.slice(5).trim();
		if (!payload || payload === "[DONE]") continue;
		try {
			collect(JSON.parse(payload));
		} catch {
			continue;
		}
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
		if (!p || !p.fetch || isAusFetchPatch(p.fetch)) return;
		const prevFetchFn = p.fetch;
		const rawFetch = prevFetchFn.bind(p);
		rawFetchRef = rawFetch;
		const patched = function() {
			const args = arguments;
			if (activeCapture !== patched) return rawFetch.apply(p, args);
			const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
			if (typeof url === "string" && url.indexOf(TARGET_API) !== -1) {
				let reqBody = null;
				try {
					reqBody = JSON.parse(args[1]?.body || "null");
				} catch {}
				const requestConnection = resolveRuntimeConnectionContext(reqBody || {});
				const fullReq = safeRequestSnapshot(reqBody, requestConnection);
				const requestId = `req:${Date.now()}:${++requestSequence}`;
				try {
					lastFetchConnection = requestConnection;
					lastFetchConnectionTime = Date.now();
					lastRequestId = requestId;
					lastRequestIdTime = Date.now();
				} catch {}
				let msgs = [];
				let promptMessages = [];
				try {
					if (reqBody?.messages?.length) {
						msgs = reqBody.messages.slice(-10);
						promptMessages = reqBody.messages;
					}
				} catch {}
				const startTime = Date.now();
				try {
					if (reqBody?.messages?.length) noteRecentTurns(reqBody.messages, startTime);
				} catch {}
				try {
					lastMessages = msgs;
					lastStart = startTime;
				} catch {}
				const requestModel = (() => {
					try {
						return reqBody?.model;
					} catch {
						return null;
					}
				})();
				const turn = registerTurn({
					startTime,
					requestId,
					model: typeof requestModel === "string" && requestModel ? requestModel : null,
					modelFallback: !(typeof requestModel === "string" && requestModel),
					status: 0,
					streamError: null,
					outputChars: 0,
					reasoningChars: 0,
					fullResponse: null,
					fullRequest: fullReq,
					messages: msgs,
					promptMessages,
					connection: requestConnection,
					ttft: 0,
					thinkTime: 0,
					streamed: null,
					endedAt: 0,
					settled: false,
					settledBy: null,
					usage: null,
					finishReason: null
				});
				const injected = injectIncludeUsage(reqBody, reqBody?.chat_completion_source ?? null);
				const performFetch = (init) => rawFetch.apply(p, init);
				const fetchArgs = injected ? [args[0], {
					...args[1],
					body: JSON.stringify(reqBody)
				}] : args;
				try {
					const rawInit = args[1] || {};
					const rawBody = typeof rawInit.body === "string" ? rawInit.body : "";
					saveRequestStart({
						at: startTime,
						method: rawInit.method || "POST",
						url,
						headers: rawInit.headers,
						body: rawBody
					});
				} catch {}
				try {
					noteCaptureStage("fetch-start", {
						model: reqBody?.model,
						requestId,
						url,
						streamed: reqBody?.stream === true
					});
				} catch {}
				return performFetch(fetchArgs).then((firstRes) => {
					if (injected && !firstRes.ok && (firstRes.status === 400 || firstRes.status === 422)) {
						log.debug("上游不接受 include_usage，按原请求重试");
						try {
							return performFetch(args);
						} catch {
							return firstRes;
						}
					}
					return firstRes;
				}).then((res) => {
					try {
						patchRequestLog({
							status: res.status,
							statusText: res.statusText,
							headers: res.headers,
							firstByteMs: Date.now() - startTime
						});
					} catch {}
					try {
						turn.status = res.status;
					} catch {}
					try {
						const clone = res.clone();
						const requestedStream = reqBody?.stream === true;
						const frameNormalizer = createFrameNormalizer();
						const parseAndProcess = (text, ttftVal, thinkTimeVal, streamed = null, rawText = null) => {
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
								log.debug("用量响应解析失败", e?.message || e);
								return;
							}
							try {
								patchRequestLog({
									model: frameNormalizer.rawModel() || data?.model || reqBody?.model || null,
									finishReason: frameNormalizer.rawFinishReason() ?? finishReason ?? null,
									usage: frameNormalizer.rawUsage() || data?.usage || null
								});
							} catch {}
							try {
								const resModel = data?.model;
								if (typeof resModel === "string" && resModel) {
									turn.model = resModel;
									turn.modelFallback = false;
								}
								if (!turn.fullResponse) turn.fullResponse = rawText ?? text;
								if (!turn.endedAt) turn.endedAt = Date.now();
							} catch {}
							try {
								const parsedUsage = data?.usage || null;
								noteCaptureStage("fetch-parse", {
									model: data?.model || reqBody?.model,
									requestId,
									streamed,
									usageFound: !!parsedUsage,
									usageZero: isZeroUsage(parsedUsage),
									usage: usageNumbers(parsedUsage),
									finishReason: finishReason ?? null
								});
							} catch {}
							if (data && data.usage) {
								const model = data?.model || reqBody?.model || fullReq?.model || lastFetchModel || "deepseek-v4-flash";
								const usage = data.usage;
								try {
									if (finishReason) usage.__finish_reason = finishReason;
								} catch {}
								try {
									turn.usage = usage;
									turn.finishReason = finishReason ?? null;
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
									fullResponse: rawText ?? text,
									ttft: ttftVal,
									thinkTime: thinkTimeVal,
									finishReason,
									streamed,
									connection: requestConnection,
									requestId
								};
								lastFetchModel = typeof model === "string" ? model : null;
								lastFetchTime = Date.now();
								log.debug("fetch 捕获 usage", {
									model,
									hasUsage: !!usage,
									finishReason,
									streamed
								});
								try {
									processUsage(usage, model, msgs, startTime, fullReq, text, ttftVal, thinkTimeVal, finishReason, requestConnection, requestId, streamed);
								} catch (e) {
									log.error("fetch 用量记录失败 " + (e?.message || e));
								}
							}
						};
						try {
							const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
							const nowMs = () => typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
							let ttft = 0;
							let fullText = "";
							const thinkClock = createThinkClock();
							let normText = "";
							const judgeStreamed = () => {
								if (!requestedStream) return false;
								if (!thinkClock.contentFrames) return null;
								return thinkClock.contentFrames > 1;
							};
							const finish = () => {
								try {
									const endedAt = nowMs() - t0;
									const thinkTime = resolveThinkTime(thinkClock, endedAt);
									const safeThinkTime = ttft > 0 ? thinkTime || 0 : 0;
									const streamed = judgeStreamed();
									try {
										turn.ttft = ttft || 0;
										turn.thinkTime = safeThinkTime;
										turn.streamed = streamed;
										turn.outputChars = thinkClock.contentChars || 0;
										turn.reasoningChars = thinkClock.reasoningChars || 0;
										turn.fullResponse = fullText || null;
										if (!turn.endedAt) turn.endedAt = Date.now();
									} catch {}
									if (safeThinkTime > 0) log.debug("思维链耗时已测量 " + safeThinkTime + "ms");
									try {
										lastStreamTiming = {
											ttft,
											thinkTime: safeThinkTime,
											streamed,
											startTime,
											at: Date.now()
										};
									} catch {}
									try {
										patchRequestLog({
											durationMs: endedAt,
											streamed
										});
									} catch {}
									parseAndProcess(normText || fullText, ttft, safeThinkTime, streamed, fullText);
								} catch {}
							};
							const scanThink = (chunk) => {
								const projected = frameNormalizer.projectSse(chunk);
								if (projected) {
									normText += projected;
									if (normText.length > STREAM_TEXT_LIMIT) normText = normText.slice(-1e6);
								}
								scanThinkChunk(thinkClock, projected || chunk, nowMs() - t0);
							};
							const readStream = async (body) => {
								const reader = body.getReader();
								const dec = new TextDecoder();
								let first = true, buf = "";
								for (;;) {
									const { done, value } = await reader.read();
									if (done) break;
									if (first && value && value.byteLength) {
										ttft = Date.now() - startTime;
										first = false;
									}
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
								finish();
							};
							const streamBody = clone.body;
							if (streamBody && typeof streamBody.getReader === "function") readStream(streamBody).catch((streamErr) => {
								try {
									turn.streamError = String(streamErr && (streamErr.message || streamErr.name) || "stream-error");
									if (!turn.endedAt) turn.endedAt = Date.now();
								} catch {}
								try {
									finish();
								} catch {}
							});
							else clone.text().then((t) => {
								ttft = Date.now() - startTime;
								parseAndProcess(frameNormalizer.projectWhole(t), ttft, 0, false, t);
							}).catch(() => {});
						} catch (innerErr) {
							log.debug("fetch 流式读取异常，不影响原请求", innerErr?.message || innerErr);
							try {
								clone.text().then((t) => {
									parseAndProcess(frameNormalizer.projectWhole(t), 0, 0, requestedStream ? null : false, t);
								}).catch(() => {});
							} catch {}
						}
					} catch (e) {
						log.debug("fetch 克隆解析异常，不影响原请求", e?.message || e);
					}
					return res;
				}).catch((e) => {
					const message = String(e && (e.message || e) || "请求失败");
					try {
						patchRequestLog({ error: message });
					} catch {}
					try {
						turn.streamError = message;
						if (!turn.endedAt) turn.endedAt = Date.now();
					} catch {}
					throw e;
				});
			}
			return rawFetch.apply(p, args);
		};
		patched.__aus_patched = true;
		try {
			Object.defineProperty(patched, "__ausTapPatched", {
				configurable: true,
				get: () => prevFetchFn.__ausTapPatched === true
			});
		} catch {}
		activeCapture = patched;
		p.fetch = patched;
		log.debug("fetch 捕获已安装 TARGET_API=" + TARGET_API);
	} catch {}
}
var interceptionInstalled = false;
var rawFetchRef = null;
var messageReceivedHandler = null;
/**
* 当前「在岗」的那一代采集包装。
*
* 为什么需要它：宿主（TauriTavern）会反复把自己的 patchedFetch 装到最外层，我们的 4s 自愈
* 守卫每次都会把「当时的顶层」当 delegate 再包一层，旧层并不会从链上消失。旧层若继续解析
* 响应，同一次请求就会被每一层各解析一次、各生成一个 requestId 各写一条历史——
* 指纹按 requestId 计算，彼此不同，去重完全拦不住（3.2.3 出现过一次请求记 12 条）。
* 所以只认「最新一代」干活，旧代一律纯直通。
*/
var activeCapture = null;
/**
* 宿主可能在我们之后重装自己的 fetch 包装（TauriTavern 在后端就绪后会再 patchFetch 一次，
* 把当前 fetch 当成 delegate 存起来再换成自己的）。一旦被换到内层，
* /api/backends/chat-completions/generate 会被宿主自己的路由直接吃掉，我们就再也看不到响应。
* 因此这里定期校验「最外层是不是我们」，不是就重新包一层。
*/
var FETCH_GUARD_MS = 4e3;
var fetchGuardTimer = null;
var fetchGuardBootTimers = [];
function isAusFetchPatch(fn) {
	return typeof fn === "function" && fn.__aus_patched === true;
}
function ensureFetchCapture() {
	try {
		const p = window.parent || window;
		if (!p || !p.fetch || isAusFetchPatch(p.fetch)) return;
		installFetchCapture();
	} catch {}
}
function startFetchGuard() {
	if (fetchGuardTimer) return;
	try {
		fetchGuardTimer = setInterval(ensureFetchCapture, FETCH_GUARD_MS);
		fetchGuardBootTimers = [setTimeout(ensureFetchCapture, 1200), setTimeout(ensureFetchCapture, 3e3)];
	} catch {}
}
function stopFetchGuard() {
	try {
		if (fetchGuardTimer) clearInterval(fetchGuardTimer);
	} catch {}
	fetchGuardTimer = null;
	try {
		for (const t of fetchGuardBootTimers) clearTimeout(t);
	} catch {}
	fetchGuardBootTimers = [];
}
/**
* 用户点「停止」：只置一个时间戳，先不结算。
* 留 STOP_SETTLE_DELAY_MS 给 GENERATION_ENDED 先走正常路径；
* 若那时仍没落库（上游没回 usage），再按中断补记一次。
*/
function onGenerationStopped() {
	pendingStopAt = Date.now();
	try {
		log.debug("收到停止信号，等待结算");
	} catch {}
	if (pendingStopTimer) try {
		clearTimeout(pendingStopTimer);
	} catch {}
	pendingStopTimer = setTimeout(() => {
		pendingStopTimer = null;
		try {
			settleTurnWithoutUsage("stop");
		} catch {}
	}, STOP_SETTLE_DELAY_MS);
}
function installInterception() {
	try {
		try {
			initConnectionIdentity();
		} catch {}
		const ctx = globalThis.SillyTavern?.getContext?.();
		const es = ctx?.eventSource;
		const et = ctx?.event_types;
		if (!es || !et) return false;
		if (interceptionInstalled) return true;
		try {
			const p = window.parent || window;
			if (p?.fetch && !p.fetch.__aus_patched) rawFetchRef = p.fetch.bind(p);
		} catch {}
		es.on(et.GENERATION_ENDED, onGenerationEnded);
		if (et.GENERATION_STOPPED) try {
			es.on(et.GENERATION_STOPPED, onGenerationStopped);
		} catch {}
		messageReceivedHandler = () => setTimeout(refresh, 400);
		es.on(et.MESSAGE_RECEIVED, messageReceivedHandler);
		globalThis.ApiUsageStatInterceptor = (chat, _ctxSize, _abort, _type) => {
			try {
				setLastRequest(chat?.slice(-10) || [], Date.now());
			} catch {}
		};
		try {
			installFetchCapture();
		} catch {}
		startFetchGuard();
		interceptionInstalled = true;
		return true;
	} catch {
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
				es.off?.(et.GENERATION_STOPPED, onGenerationStopped);
			} catch {}
			try {
				es.off?.(et.MESSAGE_RECEIVED, messageReceivedHandler);
			} catch {}
			if (pendingStopTimer) {
				try {
					clearTimeout(pendingStopTimer);
				} catch {}
				pendingStopTimer = null;
			}
			pendingStopAt = 0;
			turnLedger.clear();
		}
		try {
			const p = window.parent || window;
			if (p && rawFetchRef && p.fetch.__aus_patched) p.fetch = rawFetchRef;
		} catch {}
		activeCapture = null;
		stopFetchGuard();
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
function onGenerationEnded(...args) {
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		const chat = ctx?.chat || [];
		const tail = chat[chat.length - 1];
		const extra = tail?.extra || {};
		const tailModel = tail?.model || null;
		const extraModel = extra.model || tailModel || ctx?.model || "deepseek-v4-flash";
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
		/**
		* 解析「刚结束的那一轮」。并发时账本里有多轮在途，按 tail 模型对号入座；
		* 落库用的 messages / startTime / requestId / connection 一律取自这一轮，
		* 不再从 lastMessages / lastStart / recentRequestId() 这些「最后发出」的槽里取。
		*/
		const endedTurn = (m = model) => pickEndedTurn(m);
		/** 这一轮已经由 fetch 侧按真实 usage 落库 → 不重复记，也不要用估算覆盖 */
		const alreadyRecorded = (t) => {
			if (!t || t.settledBy !== "usage") return false;
			log.debug("这一轮已按真实用量落库，跳过结束事件", { requestId: t.requestId });
			lastFetchUsage = null;
			return true;
		};
		/** fetch 快照是否属于这一轮：并发时别把别轮的时序证据 / 用量串过来 */
		const packMatches = (t, pack) => {
			if (!t || !pack || !t.requestId || !pack.requestId) return true;
			return t.requestId === pack.requestId;
		};
		if (usage && isValidUsage(usage) && isZeroUsage(usage)) {
			log.debug("主路径 usage 全 0，转交估算判定");
			usage = null;
		}
		if (usage && isValidUsage(usage)) {
			log.debug("命中主路径 extra usage");
			const ended = endedTurn();
			if (alreadyRecorded(ended)) return;
			let ttft = ended?.ttft || 0, think = ended?.thinkTime || 0;
			let streamed = ended?.streamed ?? null;
			let fr = usage?.__finish_reason ?? usage?.finish_reason ?? null;
			try {
				const fp = lastFetchUsage;
				if (fp && packMatches(ended, fp) && Date.now() - lastFetchTime < 5e3) {
					if (!ttft) ttft = fp.ttft || 0;
					if (!think) think = fp.thinkTime || 0;
					if (!fr) fr = fp.finishReason ?? null;
					if (fp.streamed != null && streamed == null) streamed = fp.streamed;
				}
				if (!fr) {
					const extraFr = extra?.finish_reason ?? tail?.finish_reason ?? null;
					if (extraFr) fr = extraFr;
				}
			} catch {}
			processUsage(usage, model, ended?.messages?.length ? ended.messages : lastMessages, ended?.startTime || lastStart, null, null, ttft, think, fr, ended?.connection || recentConnection(5e3), ended?.requestId || recentRequestId(), streamed);
			lastFetchUsage = null;
			return;
		}
		if (tail?.swipe_info && typeof tail.swipe_info === "object") {
			log.debug("尝试 swipe_info 路径");
			for (const v of Object.values(tail.swipe_info)) {
				const cand = v?.extra?.api_usage || v?.extra?.usage;
				if (isValidUsage(cand) && !isZeroUsage(cand)) {
					usage = cand;
					model = v?.extra?.model || model;
					const ended = endedTurn(model);
					if (alreadyRecorded(ended)) return;
					log.debug("swipe_info 命中", { model });
					let ttft = ended?.ttft || 0, think = ended?.thinkTime || 0;
					let streamed = ended?.streamed ?? null;
					let fr = cand?.__finish_reason ?? null;
					try {
						const fp = lastFetchUsage;
						if (fp && packMatches(ended, fp) && Date.now() - lastFetchTime < 5e3) {
							if (!ttft) ttft = fp.ttft || 0;
							if (!think) think = fp.thinkTime || 0;
							if (!fr) fr = fp.finishReason ?? null;
							if (fp.streamed != null && streamed == null) streamed = fp.streamed;
						}
					} catch {}
					processUsage(usage, model, ended?.messages?.length ? ended.messages : lastMessages, ended?.startTime || lastStart, null, null, ttft, think, fr, ended?.connection || recentConnection(5e3), ended?.requestId || recentRequestId(), streamed);
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
		if (isValidUsage(maybeUsage) && !isZeroUsage(maybeUsage)) {
			const m = args[0]?.model || model;
			const ended = endedTurn(m);
			if (alreadyRecorded(ended)) return;
			log.debug("args 命中", { model: m });
			let ttft = ended?.ttft || 0, think = ended?.thinkTime || 0;
			let streamed = ended?.streamed ?? null;
			let fr = maybeUsage?.__finish_reason ?? null;
			try {
				const fp = lastFetchUsage;
				if (fp && packMatches(ended, fp) && Date.now() - lastFetchTime < 5e3) {
					if (!ttft) ttft = fp.ttft || 0;
					if (!think) think = fp.thinkTime || 0;
					if (!fr) fr = fp.finishReason ?? null;
					if (fp.streamed != null && streamed == null) streamed = fp.streamed;
				}
			} catch {}
			processUsage(maybeUsage, m, ended?.messages?.length ? ended.messages : lastMessages, ended?.startTime || lastStart, null, null, ttft, think, fr, ended?.connection || recentConnection(5e3), ended?.requestId || recentRequestId(), streamed);
			lastFetchUsage = null;
			return;
		}
		{
			const ended = endedTurn();
			const fetchPack = lastFetchUsage;
			const packUsage = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
			const usageFromTurn = ended?.usage && isValidUsage(ended.usage) ? ended.usage : null;
			const usableFromPack = !!packUsage && isValidUsage(packUsage) && Date.now() - lastFetchTime < 12e4;
			const belongs = packMatches(ended, fetchPack);
			const fetchUsage = usageFromTurn || (usableFromPack && belongs ? packUsage : null);
			if (fetchUsage) {
				if (alreadyRecorded(ended)) return;
				const fetchedModel = ended?.model || fetchPack && fetchPack.model || lastFetchModel || model;
				const fetchedMsgs = (ended?.messages?.length ? ended.messages : null) || fetchPack && fetchPack.msgs || lastMessages;
				const fetchedStart = ended?.startTime || fetchPack && fetchPack.startTime || lastStart;
				const fetchedReq = ended?.fullRequest || fetchPack && fetchPack.fullReq || null;
				const fetchedRes = ended?.fullResponse || fetchPack && fetchPack.fullResponse || null;
				const fTtft = ended?.ttft || fetchPack && fetchPack.ttft || 0;
				const fThink = ended?.thinkTime || fetchPack && fetchPack.thinkTime || 0;
				const fFr = ended?.finishReason || fetchPack && fetchPack.finishReason || fetchUsage?.__finish_reason || null;
				const fStreamed = ended?.streamed ?? null ?? (fetchPack && fetchPack.streamed != null ? fetchPack.streamed : null);
				log.debug("fetch 兜底命中", {
					model: fetchedModel,
					from: usageFromTurn ? "turn" : "pack"
				});
				if (!usageFromTurn) lastFetchUsage = null;
				processUsage(fetchUsage, fetchedModel, fetchedMsgs, fetchedStart, fetchedReq, fetchedRes, fTtft, fThink, fFr, ended?.connection || fetchPack?.connection || recentConnection(), ended?.requestId || fetchPack?.requestId || recentRequestId(12e4), fStreamed);
				return;
			} else if (packUsage && isValidUsage(packUsage) && !belongs) log.debug("fetch 快照属于另一轮请求，留给那一轮结算", {
				ended: ended?.requestId || null,
				pack: fetchPack?.requestId || null
			});
			else if (lastFetchUsage) {
				const fu = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
				log.debug("fetch 有缓存但无效或超时", {
					has: !!lastFetchUsage,
					isValid: fu ? isValidUsage(fu) : false,
					age: Date.now() - lastFetchTime
				});
			}
		}
		log.debug("未找到任何有效 usage，进入估算/中断判定", { localTokenCount: extra.token_count ?? null });
		settleTurnWithoutUsage("generation-ended", {
			model,
			localTokenCount: typeof extra.token_count === "number" ? extra.token_count : null
		});
	} catch (e) {
		log.error("onGenerationEnded 异常 " + e?.message || e);
	}
}
function refresh() {
	try {
		globalThis.ApiUsageStat?.refreshUI?.();
	} catch {}
}
/**
* 输入侧估算用哪一份 messages：完整上下文优先，最近 10 条的展示摘要只做兜底。
* 展示摘要曾因共用到估算里，把输入 token 少算到真实值的一成（裁剪掉了大部分上下文）。
*/
function pickPromptMessages(complete, truncated) {
	if (Array.isArray(complete) && complete.length) return complete;
	if (Array.isArray(truncated) && truncated.length) return truncated;
	return [];
}
/** 时序自洽：没有测到首字（ttft<=0）时，思维链耗时没有锚点，一并归零 */
function normalizeTiming(ttft, thinkTime) {
	const first = Math.max(0, Number(ttft) || 0);
	return {
		ttft: first,
		thinkTime: first > 0 ? Math.max(0, Number(thinkTime) || 0) : 0
	};
}
/**
* 上游没给可用 usage（或 usage 全 0）时的收尾：判定这一轮该估算补记、标中断、还是静默丢弃。
* 依据只有两条硬证据——「实测到了输出」和「有没有中断线索」。
* 静默的判定（无输出）不写历史、不产生健康信号，避免把空轮次灌进统计。
*/
async function settleTurnWithoutUsage(source, opts = {}) {
	const turn = pickEndedTurn(opts.model ?? null, false);
	if (turn?.settled) return;
	if (!turn && turnLedger.size > 0) {
		log.debug("生成结束事件对不上任何请求轮次，跳过估算补记", {
			source,
			model: opts.model || null
		});
		try {
			noteCaptureStage("event-drop", {
				model: opts.model || "",
				requestId: "",
				reason: "turn-unmatched"
			});
		} catch {}
		return;
	}
	const model = opts.model || turn?.model || lastFetchModel || "deepseek-v4-flash";
	const storeMessages = turn?.messages?.length ? turn.messages : lastMessages || [];
	const estimateMessages = pickPromptMessages(turn?.promptMessages, storeMessages);
	const startedAt = turn?.startTime || lastStart || Date.now();
	const requestId = turn?.requestId || recentRequestId(12e4) || null;
	const rawResponse = turn?.fullResponse || "";
	const outputText = collectOutputText(rawResponse);
	const outcome = decideTurnOutcome({
		hasUsage: false,
		usageUsable: false,
		hasOutput: !!outputText.trim() || !!turn && (turn.outputChars > 0 || turn.reasoningChars > 0),
		pendingStop: stopPending(),
		streamError: turn?.streamError || null
	});
	if (outcome.kind === "drop") {
		log.debug("本轮无输出，静默不记录", {
			source,
			reason: outcome.reason
		});
		const reason = stopPending() ? "user-stop-no-output" : outcome.reason;
		try {
			noteCaptureStage("event-drop", {
				model,
				requestId: requestId || "",
				reason
			});
		} catch {}
		return;
	}
	let promptEst = {
		tokens: 0,
		chars: 0,
		method: "char-heuristic"
	};
	let outputEst = {
		tokens: 0,
		chars: 0,
		method: "char-heuristic"
	};
	try {
		promptEst = await estimatePromptTokens(estimateMessages);
		outputEst = await estimateTextTokens(outputText, { preferTokens: opts.localTokenCount ?? null });
	} catch {}
	const promptTokens = Math.max(0, Math.round(promptEst.tokens || 0));
	const completionTokens = Math.max(0, Math.round(outputEst.tokens || 0));
	if (!promptTokens && !completionTokens) {
		try {
			noteCaptureStage("event-drop", {
				model,
				requestId: requestId || "",
				reason: "estimate-empty"
			});
		} catch {}
		return;
	}
	const usage = {
		prompt_tokens: promptTokens,
		completion_tokens: completionTokens,
		total_tokens: promptTokens + completionTokens,
		prompt_cache_hit_tokens: 0,
		prompt_cache_miss_tokens: promptTokens,
		__aus_estimated: true,
		__finish_reason: outcome.interrupted ? "interrupted" : "estimated"
	};
	const meta = {
		usageSource: "estimated",
		interrupted: outcome.interrupted ?? null,
		interruptReason: outcome.reason,
		estimateMethod: promptEst.method === outputEst.method ? promptEst.method : promptEst.method + "+" + outputEst.method,
		estimateVersion: 2,
		promptChars: promptEst.chars || 0,
		outputChars: outputEst.chars || 0,
		estimateCacheUnknown: true,
		costEstimated: true
	};
	if (turn?.modelFallback) meta.modelFallback = true;
	const timing = normalizeTiming(turn?.ttft, turn?.thinkTime);
	try {
		repository.addEntry(usage, model, storeMessages, startedAt, turn?.fullRequest ?? null, rawResponse || null, timing.ttft, timing.thinkTime, null, turn?.connection || recentConnection(), requestId, turn?.streamed ?? null, meta);
	} catch (e) {
		try {
			noteCaptureStage("entry-error", {
				model,
				requestId: requestId || "",
				reason: String(e?.message || e)
			});
		} catch {}
		return;
	}
	if (turn) {
		turn.settled = true;
		turn.settledBy = "estimated";
	}
	log.debug("本轮已按估算补记", {
		source,
		turn: turn?.requestId || null,
		interrupted: outcome.interrupted || null,
		promptTokens,
		completionTokens,
		method: meta.estimateMethod
	});
	try {
		noteCaptureStage(outcome.kind === "interrupted" ? "turn-interrupted" : "turn-estimated", {
			model,
			requestId: requestId || "",
			streamed: turn?.streamed ?? null,
			usageFound: false,
			usageZero: true,
			usage: usageNumbers(usage),
			finishReason: null,
			reason: outcome.reason + ":" + String(meta.estimateMethod || "")
		});
	} catch {}
	refresh();
}
function processUsage(usage, model, messages, startTime, fullRequest = null, fullResponse = null, ttft = 0, thinkTime = 0, finishReason = null, connection = null, requestId = null, streamed = null, meta = null) {
	try {
		const fp = lastFetchUsage;
		const sameTurn = !fp?.requestId || !requestId || fp.requestId === requestId;
		if (fp?.usage && sameTurn && Date.now() - lastFetchTime < 5e3) {
			const est = fp.usage.__think_tokens_est;
			const hasReal = usage?.completion_tokens_details && typeof usage.completion_tokens_details.reasoning_tokens === "number" && usage.completion_tokens_details.reasoning_tokens > 0;
			if (est && !hasReal && !usage?.__think_tokens_est) usage.__think_tokens_est = est;
		}
	} catch {}
	try {
		const st = recentStreamTiming();
		if (st && st.startTime === startTime) {
			if (!ttft) ttft = st.ttft || 0;
			if (!thinkTime) thinkTime = st.thinkTime || 0;
			if (streamed == null) streamed = st.streamed;
		}
		if (!(ttft > 0)) thinkTime = 0;
	} catch {}
	let resolvedMeta = meta;
	if (!resolvedMeta) try {
		resolvedMeta = turnMetaFor(startTime);
	} catch {}
	try {
		const zeroUsage = isZeroUsage(usage);
		const added = repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime, finishReason, connection, requestId, streamed, resolvedMeta);
		try {
			const t = currentTurn(startTime);
			if (t && (added || !zeroUsage)) {
				t.settled = true;
				t.settledBy = "usage";
			}
		} catch {}
	} catch (e) {
		try {
			noteCaptureStage("entry-error", {
				model,
				requestId: requestId || "",
				reason: String(e?.message || e)
			});
		} catch {}
		throw e;
	}
	try {
		noteCaptureStage("entry-added", {
			model,
			requestId: requestId || "",
			streamed,
			usageFound: !!usage,
			usageZero: isZeroUsage(usage),
			usage: usageNumbers(usage),
			finishReason: finishReason ?? null,
			reason: "addEntry"
		});
	} catch {}
	refresh();
}
function recalcAllCosts() {
	return repository.recalcAll();
}
//#endregion
export { listCaptureStages as a, readRecentTurns as c, captureDigest as i, readRequestLog as l, interception_exports as n, LOG_VALUE_LIMIT as o, recalcAllCosts as r, clearRequestLog as s, installInterception as t, summarizeRequestLog as u };
