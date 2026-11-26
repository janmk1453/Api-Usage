//#region src/services/request-origin.ts
/** 酒馆第三方扩展的固定挂载路径 */
var THIRD_PARTY = "/scripts/extensions/third-party/";
/**
* 自身帧标记。默认值兜底目录名，运行期再用 registerRequestOriginSelf 补真实 URL；
* 只用于「排除自己」，不参与任何来源判定。
*/
var SELF_MARKERS = ["api-usage"];
var SELF_FRAME_CLIP = 220;
/**
* 酒馆「发送脚本」：真正执行 fetch 的那两个文件。聊天补全走
* openai.js#sendOpenAIRequest，文本补全走 textgen-settings.js#generateTextGenWithStreaming，
* 全站只此两处，所以文件级判断就够、不必认函数名（改名 / 压缩都不影响）。
*/
var SEND_SCRIPTS = ["/scripts/openai.js", "/scripts/textgen-settings.js"];
/** 酒馆主链脚本（含发送脚本）：仅用于「认不出扩展/脚本时兜底判酒馆」 */
var TAVERN_SCRIPTS = [
	"/script.js",
	...SEND_SCRIPTS,
	"/scripts/extensions.js"
];
/** 从一段路径里取出扩展目录名：.../third-party/<name>/... → <name> */
function pluginNameFromPath(path) {
	if (!path) return null;
	const idx = path.indexOf(THIRD_PARTY);
	if (idx === -1) return null;
	return path.slice(idx + 32).split(/[/?#]/)[0] || null;
}
/** 注册自身脚本地址（由入口调用）；取不到 URL 时静默忽略，兜底标记仍然生效 */
function registerRequestOriginSelf(url) {
	try {
		const name = pluginNameFromPath(String(url || ""));
		if (!name) return;
		const marker = name.toLowerCase();
		if (!SELF_MARKERS.includes(marker)) SELF_MARKERS.push(marker);
	} catch {}
}
function clip(text) {
	return String(text || "").slice(0, SELF_FRAME_CLIP);
}
function isSelfFrame(line) {
	const lower = line.toLowerCase();
	for (const marker of SELF_MARKERS) if (marker && lower.indexOf(marker) !== -1) return true;
	return false;
}
/**
* 脚本帧：酒馆助手（JS-Slash-Runner）把用户脚本塞进 srcdoc / blob iframe 里跑，
* 栈帧只留得下 about:srcdoc 或 blob: 前缀，定位不到具体脚本文件。
* 这是「脚本」与「扩展」的分界线：认得出扩展目录就是扩展，只剩这类帧就是脚本。
*/
function isScriptFrame(line) {
	return line.indexOf("about:srcdoc") !== -1 || line.indexOf("about:blank") !== -1 || line.indexOf("blob:") !== -1;
}
function frameHas(line, scripts) {
	for (const script of scripts) if (line.indexOf(script) !== -1) return true;
	return false;
}
function isSendFrame(line) {
	return frameHas(line, SEND_SCRIPTS);
}
function isTavernFrame(line) {
	return frameHas(line, TAVERN_SCRIPTS);
}
/** 抓栈深度：默认 10 帧常常够不到「扩展 → 酒馆 Generate → fetch」的起点 */
var MAX_STACK_FRAMES = 50;
/**
* 从调用栈判定发起方；认不出返回 null。
*
* 判据以「酒馆发送帧」为锚点（栈内层在前、外层在后，下标小 = 更靠 fetch）：
* - 有发送帧：只有排在它**外面**的扩展 / 脚本帧才算发起者（扩展经 Generate 转发、脚本调酒馆 API）；
*   排在它里面的只是包装 fetch，判酒馆。
* - 无发送帧：请求不经过酒馆发送函数，任何扩展帧都是自己直连（酒馆帧只是触发它的 UI 事件）。
* 这三种形态已用无头 Chrome 实测过，详见文件头的约束 2。
*/
function originFromStack(stack) {
	const frames = [];
	for (const raw of String(stack || "").split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("Error")) continue;
		if (isSelfFrame(line)) continue;
		frames.push(line);
	}
	let sendInner = -1;
	let tavernInner = -1;
	let extensionOuter = -1;
	let extensionFrame = "";
	let scriptOuter = -1;
	let scriptFrame = "";
	for (let i = 0; i < frames.length; i += 1) {
		const line = frames[i];
		if (sendInner === -1 && isSendFrame(line)) sendInner = i;
		else if (tavernInner === -1 && isTavernFrame(line)) tavernInner = i;
		if (pluginNameFromPath(line)) {
			extensionOuter = i;
			extensionFrame = line;
		}
		if (isScriptFrame(line)) {
			scriptOuter = i;
			scriptFrame = line;
		}
	}
	const pickExtension = () => ({
		kind: "extension",
		id: clip(extensionFrame),
		label: pluginNameFromPath(extensionFrame) || ""
	});
	const pickScript = () => ({
		kind: "script",
		id: clip(scriptFrame),
		label: "iframe 脚本"
	});
	const tavern = () => ({
		kind: "tavern",
		id: "tavern",
		label: "酒馆主界面"
	});
	if (sendInner !== -1) {
		if (extensionOuter > sendInner) return pickExtension();
		if (scriptOuter > sendInner) return pickScript();
		return tavern();
	}
	if (extensionOuter !== -1) return pickExtension();
	if (scriptOuter !== -1) return pickScript();
	if (tavernInner !== -1) return tavern();
	return null;
}
/** 现场抓栈判定：必须在 fetch 包装的同步段调用，任何 await 之后栈就断了 */
function detectRequestOrigin() {
	const previous = Error.stackTraceLimit;
	try {
		Error.stackTraceLimit = MAX_STACK_FRAMES;
		return originFromStack(String((/* @__PURE__ */ new Error()).stack || ""));
	} catch {
		return null;
	} finally {
		try {
			Error.stackTraceLimit = previous;
		} catch {}
	}
}
//#endregion
export { originFromStack as n, registerRequestOriginSelf as r, detectRequestOrigin as t };
