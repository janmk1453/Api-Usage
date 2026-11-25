/**
 * 「上传反馈日志」弹窗：把当前请求日志 + 诊断摘要发给开发者排查。
 *
 * 三条链路共用这个弹窗：
 * - 历史记录页健康提示点「上传这一条」：带一个 target，弹窗顶部写明「本次反馈指向 X 时 Y 模型的这一轮」；
 * - 历史记录页点「上传反馈日志」：带 targets（提示条里列出的每一条），弹窗顶部逐条列出，
 *   上传体里 report.scope=all + report.targets + evidence.items 为每条各备一份现场证据；
 * - 设置页 / 请求日志页点「上传反馈」：不带 target，report.scope=recent，上传最近一轮请求的详细数据。
 *
 * 交互口径：
 * - 只有点「同意并上传」才发请求，取消/遮罩外点击都不发；
 * - 上传前先让用户选问题类型、写补充说明，再说清会上传什么、不收集什么；
 * - 最近三轮对话摘要在本地上是「正文前 400 字」，弹窗里给一个默认关闭、需手动勾选的开关；
 * - 地址默认填项目自带的接收端，用户可改成自己的；
 * - 结果就地显示（成功/失败 + 服务端回复），失败不关窗，方便重试。
 */
import { icon } from './icons';
import { readRequestLog } from '../services/request-log';
import {
  buildFeedbackPack,
  FEEDBACK_NOTE_LIMIT,
  FEEDBACK_PROBLEMS,
  isFeedbackProblem,
  type FeedbackProblem,
  type FeedbackTarget,
} from '../services/feedback-pack';
import {
  normalizeUploadAddress,
  readUploadAddress,
  saveUploadAddress,
  uploadLogPayload,
} from '../services/log-upload';

const MASK_ID = 'aus-up-mask';

function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeText(at: number): string {
  if (!at) return "";
  try {
    const d = new Date(at);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

/** 健康信号类型 → 人话（只用于弹窗顶部那行目标说明） */
const KIND_TEXT: Record<string, string> = {
  "missing-usage": "没取到用量",
  "zero-usage": "用量为 0",
  "rate-anomaly": "速率异常",
  "meta-missing": "信息缺失",
  "estimated-usage": "本地估算",
  "plugin-error": "扩展报错",
};

function targetLine(target: FeedbackTarget | null): string {
  if (!target) return "";
  const kind = KIND_TEXT[String(target.kind || "")] || "异常记录";
  const model = String(target.model || "").trim();
  const when = timeText(Number(target.at) || 0);
  const who = model ? model + " 这一轮" : "这一轮";
  return "本次反馈指向：" + (when ? when + " " : "") + who + "（" + kind + "）";
}

/**
 * 目标类型 → 预选问题类型。
 * 多条时按「最严重的那类」预选：只要有一条根本没进历史，就是「没有被记录」。
 */
function problemForTargets(targets: FeedbackTarget[]): FeedbackProblem {
  const kinds = targets.map((item) => String(item?.kind || ""));
  if (kinds.some((kind) => kind === "missing-usage" || kind === "zero-usage")) return "not-recorded";
  if (kinds.some((kind) => kind === "rate-anomaly" || kind === "meta-missing" || kind === "estimated-usage")) return "wrong-data";
  return "other";
}

/** 单条时一行说明；多条时逐条列出，让用户确认「点名的就是这几条」 */
function targetsHTML(targets: FeedbackTarget[]): string {
  if (!targets.length) return "";
  if (targets.length === 1) {
    return (
      '<div class="aus-up-targets"><p class="aus-up-target">' + esc(targetLine(targets[0])) + "</p>" +
      '<p class="aus-up-target-hint">上传成功后，这条提示会自动从历史记录页消失。</p>' +
      "</div>"
    );
  }
  const rows = targets
    .map((item) => {
      const kind = KIND_TEXT[String(item.kind || "")] || "异常记录";
      const when = timeText(Number(item.at) || 0) || "--";
      const model = String(item.model || "").trim() || "未知模型";
      return (
        '<li class="aus-up-target-item">' +
        '<span class="aus-up-target-when">' + esc(when) + "</span>" +
        '<span class="aus-up-target-main">' + esc(model) + " 这一轮</span>" +
        '<span class="aus-up-target-kind">' + esc(kind) + "</span>" +
        "</li>"
      );
    })
    .join("");
  return (
    '<div class="aus-up-targets">' +
    '<p class="aus-up-target">本次反馈逐条点名 ' + targets.length + ' 条异常记录：</p>' +
    '<ol class="aus-up-target-list">' + rows + "</ol>" +
    '<p class="aus-up-target-hint">上传成功后，这几条提示会自动从历史记录页消失。</p>' +
    "</div>"
  );
}

function problemButtons(current: FeedbackProblem): string {
  return FEEDBACK_PROBLEMS.map((item) => {
    const active = item.id === current ? " is-active" : "";
    return (
      '<button type="button" class="aus-up-problem' + active + '" data-up-problem="' + item.id + '">' +
      '<span class="aus-up-problem-label">' + esc(item.label) + "</span>" +
      '<span class="aus-up-problem-hint">' + esc(item.hint) + "</span>" +
      "</button>"
    );
  }).join("");
}

function dialogHTML(input: {
  address: string;
  hasRecord: boolean;
  problem: FeedbackProblem;
  targets: FeedbackTarget[];
}): string {
  const recordLine = input.hasRecord
    ? "当前请求日志：有，会一起上传"
    : "当前请求日志：无（还没有捕获到请求，仅上传下面的诊断摘要）";
  const targetHTML = targetsHTML(input.targets);
  return (
    '<div class="aus-up" role="dialog" aria-modal="true" aria-label="上传反馈日志">' +
    '<div class="aus-up-head">' +
    '<div class="aus-up-title">上传反馈日志</div>' +
    '<button type="button" class="aus-up-close" data-up-action="cancel" aria-label="关闭">' + icon("close", 16) + "</button>" +
    "</div>" +

    '<div class="aus-up-body">' +
    targetHTML +
    '<p class="aus-up-text">遇到<b>对话没有被记录</b>，或者<b>记录下来的 token、费用明显不对</b>时，可将当前这条请求日志和相关诊断信息发送给开发者，便于定位问题。</p>' +
    '<p class="aus-up-text aus-up-muted">' + esc(recordLine) + "</p>" +

    '<div class="aus-up-label">这是什么问题</div>' +
    '<div class="aus-up-problems">' + problemButtons(input.problem) + "</div>" +

    '<div class="aus-up-label">补充说明<span class="aus-up-optional">可选</span></div>' +
    '<textarea class="aus-up-note" id="aus-up-note" rows="3" maxlength="' + FEEDBACK_NOTE_LIMIT + '" ' +
    'placeholder="什么时候、哪条对话、哪一轮；那次的模型或接入是什么；和你预期的差别在哪"></textarea>' +

    '<label class="aus-up-check"><input type="checkbox" id="aus-up-include-chat" />' +
    '<span>附带最近三轮对话正文（每轮前 400 字，用于还原上下文）</span></label>' +

    '<details class="aus-up-details">' +
    "<summary>查看会一并上传的内容与隐私说明</summary>" +
    '<div class="aus-up-details-body">' +
    '<p class="aus-up-details-title">为排查问题，上传内容可能包括</p>' +
    '<ul class="aus-up-list">' +
    '<li><b>聊天与提示词</b>：当前这一条请求正文里的历史聊天、你的输入、角色设定、世界书与系统提示词。</li>' +
    '<li><b>生成与结构化数据</b>：模型名称、请求端点、是否流式、finish_reason、用量（token 数）以及请求参数。</li>' +
    '<li><b>记录摘要</b>：最近 10 条历史记录的模型、token、费用与接入名称（<b>不含聊天正文</b>），以及「其他请求」探针里最近 20 条请求的模型、状态与错误。</li>' +
    '<li><b>指向证据</b>：从历史提示上传时，会为每一条被点名的异常（最多 8 条）带上那一轮的完整记录字段、前后各一条历史记录、同类请求最多 4 条，以及前后 2 分钟的控制台输出。</li>' +
    '<li><b>最近对话</b>：最近三轮对话的角色、字数与前 400 字（默认不附带，勾选上面才会带上）。</li>' +
    '<li><b>脚本诊断</b>：最近 40 条控制台报错与未处理的 Promise 异常，可能含有酒馆或其他扩展打印的内容。</li>' +
    '<li><b>扩展与运行环境</b>：扩展名称与版本清单、本扩展版本、系统时区、屏幕与视口尺寸、当前对话名与角色名。</li>' +
    "</ul>" +
    '<p class="aus-up-details-title">不会上传</p>' +
    '<ul class="aus-up-list">' +
    '<li>钱包密钥、API Key、登录凭据：上传前会再把请求头、正文和 URL 里的密钥抹成 <code>***</code>。</li>' +
    '<li>图片与附件内容、扩展源码、酒馆设置原文。</li>' +
    "</ul>" +
    '<p class="aus-up-details-title">脱敏有局限</p>' +
    '<p class="aus-up-text">程序会尝试遮蔽常见密钥、密码和认证头，但不能保证识别聊天正文、脚本输出或自定义字段中的所有敏感信息。请勿把日志视为已经完全脱敏。</p>' +
    '<p class="aus-up-details-title">接收与保存</p>' +
    '<p class="aus-up-text">日志会发送到下面填写的接收地址，接收服务及有权限的收件人可能查看、下载和保存内容；保存期限与删除方式由接收方决定，上传后无法替你撤回。请核对地址，仅向信任的接收方上传。</p>' +
    "</div>" +
    "</details>" +

    '<details class="aus-up-details">' +
    "<summary>上传地址（高级）</summary>" +
    '<div class="aus-up-details-body">' +
    '<input type="text" class="aus-up-address" id="aus-up-address" spellcheck="false" value="' + esc(input.address) + '" />' +
    '<p class="aus-up-text aus-up-muted">默认是项目自带的接收端。改成你自己的接收地址时，请确认它愿意接收这些内容。</p>' +
    "</div>" +
    "</details>" +

    '<div class="aus-up-result" id="aus-up-result" hidden></div>' +
    "</div>" +

    '<div class="aus-up-foot">' +
    '<button type="button" class="aus-up-btn" data-up-action="cancel">取消</button>' +
    '<button type="button" class="aus-up-btn is-primary" data-up-action="submit">同意并上传</button>' +
    "</div>" +
    "</div>"
  );
}

let currentProblem: FeedbackProblem = 'not-recorded';
/** 上传成功后的回调（历史提示用它把刚上传的条目从提示条里摘掉） */
let uploadedCallback: ((keys: string[]) => void) | null = null;
/** 本次弹窗点名的目标：设置页/日志页为空，历史提示为一条或多条 */
let currentTargets: FeedbackTarget[] = [];
/** 默认不附带对话正文：由用户在弹窗里手动勾选后才带上（隐私优先） */
let includeConversation = false;
let uploading = false;

export function closeLogUploadDialog(): void {
  if (typeof document === "undefined") return;
  document.getElementById(MASK_ID)?.remove();
  uploading = false;
  uploadedCallback = null;
}

function setResult(mask: HTMLElement, kind: "info" | "ok" | "bad", text: string): void {
  const box = mask.querySelector("#aus-up-result") as HTMLElement | null;
  if (!box) return;
  box.hidden = false;
  box.className = "aus-up-result is-" + kind;
  box.textContent = text;
}

function readInput(mask: HTMLElement, selector: string): string {
  const el = mask.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  return el ? String(el.value || "") : "";
}

async function submit(mask: HTMLElement, appVersion: string): Promise<void> {
  if (uploading) return;
  const submitBtn = mask.querySelector('[data-up-action="submit"]') as HTMLButtonElement | null;
  const address = readInput(mask, "#aus-up-address");
  if (!normalizeUploadAddress(address)) {
    setResult(mask, "bad", "上传地址无效，请填写以 http:// 或 https:// 开头的地址");
    return;
  }
  const note = readInput(mask, "#aus-up-note").slice(0, FEEDBACK_NOTE_LIMIT);
  const chatBox = mask.querySelector("#aus-up-include-chat") as HTMLInputElement | null;
  includeConversation = chatBox ? chatBox.checked : false;
  uploading = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "正在上传…";
  }
  setResult(mask, "info", "正在整理并上传…");
  try {
    // 地址先落盘，下次打开不用重填
    saveUploadAddress(address);
    const pack = await buildFeedbackPack({
      problem: currentProblem,
      note,
      appVersion,
      record: readRequestLog(),
      targets: currentTargets,
      includeConversation,
    });
    const result = await uploadLogPayload(address, pack);
    if (result.ok) {
      setResult(mask, "ok", "上传成功，感谢反馈。");
      // 先通知提示条摘掉这些条目，再延时关闭，避免用户看到「已上传但提示还在」
      const keys = currentTargets.map((item) => String(item?.signalKey || "")).filter(Boolean);
      const done = uploadedCallback;
      uploadedCallback = null;
      if (keys.length && done) {
        try { done(keys); } catch {}
      }
      setTimeout(() => closeLogUploadDialog(), 900);
      return;
    }
    const detail = result.status ? "（HTTP " + result.status + "）" : "";
    setResult(mask, "bad", "上传失败" + detail + "：" + (result.message || "请稍后重试"));
  } catch (error: any) {
    setResult(mask, "bad", "上传失败：" + String(error?.message || error || "未知错误"));
  } finally {
    uploading = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "同意并上传";
    }
  }
}

function bind(mask: HTMLElement, appVersion: string): void {
  mask.addEventListener("click", (event: any) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target === mask) {
      closeLogUploadDialog();
      return;
    }
    const problemBtn = target.closest("[data-up-problem]") as HTMLElement | null;
    if (problemBtn) {
      const value = problemBtn.getAttribute("data-up-problem");
      if (isFeedbackProblem(value)) currentProblem = value;
      mask.querySelectorAll("[data-up-problem]").forEach((el: any) => {
        el.classList.toggle("is-active", el.getAttribute("data-up-problem") === currentProblem);
      });
      return;
    }
    const actionBtn = target.closest("[data-up-action]") as HTMLElement | null;
    if (!actionBtn) return;
    const action = actionBtn.getAttribute("data-up-action");
    if (action === "cancel") {
      closeLogUploadDialog();
      return;
    }
    if (action === "submit") void submit(mask, appVersion);
  });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeLogUploadDialog();
      document.removeEventListener("keydown", onKey, true);
    }
  };
  document.addEventListener("keydown", onKey, true);
}

/**
 * 打开弹窗（单例：重复调用先收掉旧的）
 * @param options.targets 历史提示「上传反馈日志」时传提示条里的每一条，逐条点名
 * @param options.target 历史提示「上传这一条」时传单条目标（targets 为空时生效）
 * 都不传就是「最近一条 + 全量诊断」
 */
export function openLogUploadDialog(options: {
  appVersion?: string;
  target?: FeedbackTarget | null;
  targets?: FeedbackTarget[] | null;
  /** 上传成功后回调：参数是本次点名的 signalKey，供提示条把已上报的条目摘掉 */
  onUploaded?: ((keys: string[]) => void) | null;
} = {}): void {
  if (typeof document === "undefined") return;
  document.getElementById(MASK_ID)?.remove();
  uploading = false;
  const list = Array.isArray(options.targets) ? options.targets.filter((item) => item && typeof item === "object") : [];
  if (!list.length && options.target && typeof options.target === "object") list.push(options.target);
  currentTargets = list;
  uploadedCallback = typeof options.onUploaded === "function" ? options.onUploaded : null;
  currentProblem = problemForTargets(currentTargets);
  includeConversation = false;
  const panel = document.getElementById("aus-panel") || document.body;
  const mask = document.createElement("div");
  mask.id = MASK_ID;
  mask.className = "aus-up-mask";
  const hasRecord = !!readRequestLog();
  mask.innerHTML = dialogHTML({
    address: readUploadAddress(),
    hasRecord,
    problem: currentProblem,
    targets: currentTargets,
  });
  panel.appendChild(mask);
  bind(mask, String(options.appVersion || ""));
}
