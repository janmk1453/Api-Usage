/**
 * 请求探针 —— 发起方与用途归类（纯逻辑，无 DOM、无副作用，可直接单测）
 *
 * 判定思路（与设计文档一致）：
 * 1) 发起方优先看「执行上下文」——补丁所在 window 的 frameElement / location；
 * 2) 上下文拿不到（跨源）或只是主窗时，退回调用栈里的 third-party 路径；
 * 3) 用途不用「猜是不是对话」，只按结构化特征 + prompt 片段做聚类，
 *    是不是对话完全交给对账结果（见 match.ts）判定。
 */

import type { TapActorKind, TapAttribution } from './types';

export type { TapActorKind, TapAttribution };

export interface TapActor {
  kind: TapActorKind;
  /** iframe src / 页面地址 */
  id: string;
  /** 展示名 */
  label: string;
}

const THIRD_PARTY = '/scripts/extensions/third-party/';

/** 从一段路径里取出扩展名：.../third-party/<name>/... → <name> */
export function pluginNameFromPath(path: string): string | null {
  if (!path) return null;
  const idx = path.indexOf(THIRD_PARTY);
  if (idx === -1) return null;
  const rest = path.slice(idx + THIRD_PARTY.length);
  const name = rest.split(/[/?#]/)[0];
  return name || null;
}

/**
 * 由执行上下文推发起方。
 * isTop=true 表示补丁装在宿主窗口上（酒馆自身发起），此时还不能排除插件经 parent.fetch 发出的请求，
 * 需要再用调用栈复核（见 actorFromStack）。
 */
export function actorFromLocation(input: { frameSrc?: string | null; href?: string | null; isTop?: boolean }): TapActor {
  const id = String(input.frameSrc || input.href || '');
  const plugin = pluginNameFromPath(id);
  if (plugin) return { kind: 'plugin', id, label: plugin };
  if (input.isTop) return { kind: 'tavern', id: id || 'main', label: '酒馆主窗' };
  if (!id) return { kind: 'unknown', id: '', label: '未知来源' };
  // 同源但不是扩展目录：可能是其它 iframe（如酒馆的功能页）
  return { kind: 'unknown', id, label: id.split('/').filter(Boolean).pop() || '未知来源' };
}

/** 从调用栈里找扩展路径（比上下文更细：能定位到具体插件，即使补丁装在主窗上） */
export function actorFromStack(stack: string): TapActor | null {
  if (!stack) return null;
  for (const raw of stack.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // 跳过探针自身的帧，否则永远匹配到自己
    if (line.indexOf('request-tap') !== -1) continue;
    const plugin = pluginNameFromPath(line);
    if (plugin) return { kind: 'plugin', id: line, label: plugin };
  }
  return null;
}

/** 调用栈里第一条有意义的帧（去掉探针自身与浏览器内部帧） */
export function stackTopFrame(stack: string): string {
  if (!stack) return '';
  for (const raw of stack.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.indexOf('request-tap') !== -1) continue;
    if (line.startsWith('Error')) continue;
    return line.slice(0, 160);
  }
  return '';
}

/** 32 位字符串指纹（不需要密码学强度，只要稳定） */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** prompt 片段：只留开头，避免把整段对话留在验证数据里 */
export const PROMPT_HINT_LIMIT = 80;
export function promptHintOf(body: any): string {
  try {
    const msgs = body?.messages;
    if (Array.isArray(msgs) && msgs.length) {
      const last = msgs[msgs.length - 1];
      const text = typeof last?.content === 'string' ? last.content : '';
      const sys = msgs.map((m: any) => (typeof m?.content === 'string' ? m.content : '')).join(' ');
      const src = sys || text;
      return src.replace(/\s+/g, ' ').trim().slice(0, PROMPT_HINT_LIMIT);
    }
    const p = body?.prompt;
    if (typeof p === 'string') return p.replace(/\s+/g, ' ').trim().slice(0, PROMPT_HINT_LIMIT);
  } catch {}
  return '';
}

/** 用途规则表：命中即命名；没命中就走结构特征兜底 */
export const PURPOSE_RULES: { test: RegExp; label: string }[] = [
  { test: /变量|状态栏|mvu|magvar|variable/i, label: '变量更新' },
  { test: /表格|填表|表单|表格数据|table/i, label: '填表 / 结构化' },
  { test: /摘要|总结|summar|memory|记忆/i, label: '摘要 / 记忆' },
  { test: /翻译|translate/i, label: '翻译' },
  { test: /标题|title/i, label: '标题生成' },
  { test: /表情|emoji|image|绘图|画图|提示词/i, label: '图像 / 表情' },
];

/** 结构特征兜底命名（不猜语义，只说形态） */
export function structuralLabel(input: { structured: boolean; requestType: string; messageCount: number; endpoint: string }): string {
  if (input.structured) return '结构化输出';
  if (input.requestType === 'quiet') return '静默请求';
  if (input.endpoint === 'text') return '文本补全';
  if (input.messageCount <= 2) return '短上下文请求';
  return '长上下文请求';
}

/** 用途归类结果 */
export interface TapPurpose {
  key: string;
  label: string;
}

/**
 * 生成用途指纹与展示名。
 * 指纹刻意做得「粗」：同一插件的同类调用必须落在同一簇里，便于人眼一键命名；
 * 语义关键词只影响展示名，不参与指纹（否则改个词就裂成新簇）。
 */
export function classifyPurpose(input: {
  actorLabel: string;
  requestType: string;
  structured: boolean;
  messageCount: number;
  promptHint: string;
  endpoint: string;
}): TapPurpose {
  const bucket = input.messageCount <= 2 ? '2' : input.messageCount <= 8 ? '8' : '32';
  const key = fingerprint([input.actorLabel, input.requestType || '-', input.structured ? 'json' : 'text', input.endpoint, bucket].join('|'));
  for (const rule of PURPOSE_RULES) {
    if (rule.test.test(input.promptHint)) return { key, label: rule.label };
  }
  return { key, label: structuralLabel(input) };
}
