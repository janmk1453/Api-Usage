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

export const INCLUDE_USAGE_YAML = 'stream_options:\n  include_usage: true';

const INCLUDE_USAGE_OBJECT = { include_usage: true };

export type MergeIncludeUsageResult = { changed: boolean; value: string };

/** 跳过开头的空行、注释行与 YAML 文档起始标记，返回第一个内容字符的下标 */
function contentStart(text: string): number {
  let offset = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed === '---') {
      offset += line.length + 1;
      continue;
    }
    return offset + (line.length - line.trimStart().length);
  }
  return text.length;
}

function hasOwn(obj: any, key: string): boolean {
  return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * 返回合并后的 custom_include_body 字符串。
 * changed=false 时调用方必须保持原值不变（宁可拿不到 usage，也不能破坏预设参数）。
 */
export function mergeIncludeUsage(raw: unknown): MergeIncludeUsageResult {
  if (raw != null && typeof raw !== 'string') return { changed: false, value: '' };
  const current = String(raw ?? '').trim();
  if (!current) return { changed: true, value: `${INCLUDE_USAGE_YAML}\n` };

  const head = current.slice(contentStart(current));
  if (!head) return { changed: false, value: current };

  // 顶层 JSON / flow 对象：解析后合并，避免在 JSON 尾部追加块状 YAML 造成整段解析失败
  if (head.startsWith('{')) {
    try {
      const parsed: any = JSON.parse(head);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { changed: false, value: current };
      }
      if (hasOwn(parsed, 'stream_options')) return { changed: false, value: current };
      parsed.stream_options = { ...INCLUDE_USAGE_OBJECT };
      return { changed: true, value: JSON.stringify(parsed) };
    } catch {
      // 真正的 YAML flow 写法（如 { thinking: { type: disabled } }）无法安全转成 JSON，放弃注入
      return { changed: false, value: current };
    }
  }

  // 数组/列表写法，追加会破坏结构
  if (head.startsWith('[') || head.startsWith('-')) return { changed: false, value: current };

  // 用户已自行配置 stream_options，或存在 YAML 文档结束标记（追加会变成第二个文档）
  if (/(^|\n)\s*stream_options\s*:/.test(current)) return { changed: false, value: current };
  if (/(^|\n)\s*\.\.\.\s*(\n|$)/.test(current)) return { changed: false, value: current };

  return { changed: true, value: `${current}\n${INCLUDE_USAGE_YAML}\n` };
}

/**
 * 宿主是否允许往这次请求里塞 stream_options。
 *
 * SillyTavern 1.19 没有 custom_api_format 字段（custom 恒为 OpenAI 兼容），返回 true。
 * TauriTavern 用 custom_api_format 声明 custom 源的真实协议：只有 openai_compat 认这个参数，
 * 其余四种的中转请求体是各家原生格式，塞进去会被严格校验拒绝。TT 自己也会给 OpenAI 兼容路径
 * 注入同一参数，所以非兼容格式一律不注入，宁可用估算也不打断对话。
 */
export function isInjectableApiFormat(format: unknown): boolean {
  if (format == null) return true;
  if (typeof format !== 'string') return false;
  const text = format.trim();
  if (!text) return true;
  return text === 'openai_compat';
}
