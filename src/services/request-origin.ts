/**
 * 请求发起方（扩展 / 脚本 / 酒馆主界面）——纯逻辑，无 DOM、无副作用，可直接单测。
 *
 * 判定只认调用栈这一条硬证据，刻意不用请求体反推——body 属于上游协议，
 * 扩展改一行代码、换个模板就会漂移，拿它猜发起方永远是猜（方案确定时已否掉）。
 *
 * 三条硬约束（每一条都是踩过才知道的）：
 * 1) 必须跳过本扩展自己的帧。构建产物就躺在 third-party/Api-Usage/dist/ 下，
 *    不排除的话每条记录都会被认成「Api-Usage 发起」，全表污染。
 * 2) 不能「取第一个可识别帧」，要用「酒馆发送帧」当锚点。实测（无头 Chrome，五个场景）：
 *    - 扩展直连 fetch，被酒馆 UI 事件触发时，酒馆的 /script.js 帧在扩展帧**外层**；
 *    - 酒馆助手 / 预设脚本 monkey-patch window.fetch 时，包装帧在发送帧**内层**。
 *    两者方向相反，所以「谁更外层」单独用一定会错，必须分清锚点是不是真正的发送函数。
 * 3) 认不出就不认：返回 null，界面不显示角标，绝不编一个来源。
 */

import type { RequestOrigin, RequestOriginKind } from '../types/save';

// 类型真源在 types/save.ts（数据契约），这里只做判定，不另立一套
export type { RequestOrigin, RequestOriginKind };

/** 酒馆第三方扩展的固定挂载路径 */
const THIRD_PARTY = '/scripts/extensions/third-party/';

/**
 * 自身帧标记。默认值兜底目录名，运行期再用 registerRequestOriginSelf 补真实 URL；
 * 只用于「排除自己」，不参与任何来源判定。
 */
const SELF_MARKERS: string[] = ['api-usage'];
const SELF_FRAME_CLIP = 220;

/**
 * 酒馆「发送脚本」：真正执行 fetch 的那两个文件。聊天补全走
 * openai.js#sendOpenAIRequest，文本补全走 textgen-settings.js#generateTextGenWithStreaming，
 * 全站只此两处，所以文件级判断就够、不必认函数名（改名 / 压缩都不影响）。
 */
const SEND_SCRIPTS = [
  '/scripts/openai.js',
  '/scripts/textgen-settings.js',
];

/** 酒馆主链脚本（含发送脚本）：仅用于「认不出扩展/脚本时兜底判酒馆」 */
const TAVERN_SCRIPTS = [
  '/script.js',
  ...SEND_SCRIPTS,
  '/scripts/extensions.js',
];

/** 从一段路径里取出扩展目录名：.../third-party/<name>/... → <name> */
export function pluginNameFromPath(path: string): string | null {
  if (!path) return null;
  const idx = path.indexOf(THIRD_PARTY);
  if (idx === -1) return null;
  const rest = path.slice(idx + THIRD_PARTY.length);
  const name = rest.split(/[/?#]/)[0];
  return name || null;
}

/** 注册自身脚本地址（由入口调用）；取不到 URL 时静默忽略，兜底标记仍然生效 */
export function registerRequestOriginSelf(url: string): void {
  try {
    const text = String(url || '');
    const name = pluginNameFromPath(text);
    if (!name) return;
    const marker = name.toLowerCase();
    if (!SELF_MARKERS.includes(marker)) SELF_MARKERS.push(marker);
  } catch {}
}

function clip(text: string): string {
  return String(text || '').slice(0, SELF_FRAME_CLIP);
}

function isSelfFrame(line: string): boolean {
  const lower = line.toLowerCase();
  for (const marker of SELF_MARKERS) {
    if (marker && lower.indexOf(marker) !== -1) return true;
  }
  return false;
}

/**
 * 脚本帧：酒馆助手（JS-Slash-Runner）把用户脚本塞进 srcdoc / blob iframe 里跑，
 * 栈帧只留得下 about:srcdoc 或 blob: 前缀，定位不到具体脚本文件。
 * 这是「脚本」与「扩展」的分界线：认得出扩展目录就是扩展，只剩这类帧就是脚本。
 */
function isScriptFrame(line: string): boolean {
  return line.indexOf('about:srcdoc') !== -1
    || line.indexOf('about:blank') !== -1
    || line.indexOf('blob:') !== -1;
}

function frameHas(line: string, scripts: string[]): boolean {
  for (const script of scripts) {
    if (line.indexOf(script) !== -1) return true;
  }
  return false;
}

function isSendFrame(line: string): boolean {
  return frameHas(line, SEND_SCRIPTS);
}

function isTavernFrame(line: string): boolean {
  return frameHas(line, TAVERN_SCRIPTS);
}

/** 抓栈深度：默认 10 帧常常够不到「扩展 → 酒馆 Generate → fetch」的起点 */
const MAX_STACK_FRAMES = 50;

/**
 * 从调用栈判定发起方；认不出返回 null。
 *
 * 判据以「酒馆发送帧」为锚点（栈内层在前、外层在后，下标小 = 更靠 fetch）：
 * - 有发送帧：只有排在它**外面**的扩展 / 脚本帧才算发起者（扩展经 Generate 转发、脚本调酒馆 API）；
 *   排在它里面的只是包装 fetch，判酒馆。
 * - 无发送帧：请求不经过酒馆发送函数，任何扩展帧都是自己直连（酒馆帧只是触发它的 UI 事件）。
 * 这三种形态已用无头 Chrome 实测过，详见文件头的约束 2。
 */
export function originFromStack(stack: string): RequestOrigin | null {
  const frames: string[] = [];
  for (const raw of String(stack || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('Error')) continue;
    if (isSelfFrame(line)) continue;
    frames.push(line);
  }
  let sendInner = -1;
  let tavernInner = -1;
  let extensionOuter = -1;
  let extensionFrame = '';
  let scriptOuter = -1;
  let scriptFrame = '';
  for (let i = 0; i < frames.length; i += 1) {
    const line = frames[i];
    // 记「最内层」= 下标更小：离 fetch 最近的那一个才是真正发请求的
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

  const pickExtension = (): RequestOrigin => ({
    kind: 'extension',
    id: clip(extensionFrame),
    label: pluginNameFromPath(extensionFrame) || '',
  });
  const pickScript = (): RequestOrigin => ({ kind: 'script', id: clip(scriptFrame), label: 'iframe 脚本' });
  const tavern = (): RequestOrigin => ({ kind: 'tavern', id: 'tavern', label: '酒馆主界面' });

  if (sendInner !== -1) {
    // 请求由酒馆发送脚本执行：只有排在它外面的帧才是「让它发这条请求的人」，
    // 排在它里面的扩展 / 脚本帧只是包装了 fetch —— 那是酒馆助手和预设脚本的常规操作。
    if (extensionOuter > sendInner) return pickExtension();
    if (scriptOuter > sendInner) return pickScript();
    return tavern();
  }

  // 栈里没有发送脚本：请求不是酒馆主链发出的。
  // 此时任何扩展帧都是自己直接打 fetch，酒馆帧只是触发它的 UI 事件，不算发起方。
  if (extensionOuter !== -1) return pickExtension();
  if (scriptOuter !== -1) return pickScript();
  if (tavernInner !== -1) return tavern();
  return null;
}

/** 现场抓栈判定：必须在 fetch 包装的同步段调用，任何 await 之后栈就断了 */
export function detectRequestOrigin(): RequestOrigin | null {
  const previous = (Error as any).stackTraceLimit;
  try {
    // 只在这一句里放宽深度，平时不改变宿主行为
    (Error as any).stackTraceLimit = MAX_STACK_FRAMES;
    return originFromStack(String(new Error().stack || ''));
  } catch {
    return null;
  } finally {
    try { (Error as any).stackTraceLimit = previous; } catch {}
  }
}
