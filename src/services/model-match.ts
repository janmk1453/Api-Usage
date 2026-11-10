/**
 * 模型名模糊匹配（纯函数，供价格同步与「供应商建议」共用）。
 *
 * 设计原则：**宁可漏配，不可错配**。价格错配会直接污染历史费用且难以察觉，
 * 因此对「版本号不同」「变体后缀不同（mini/lite/pro/flash）」一律重罚，
 * 低于 MODEL_MATCH_ACCEPT 的候选不会写入任何钱包。
 *
 * 归一化只抹掉「写法差异」，不抹「型号差异」：全角转半角、大小写、小数点/连字符/
 * 下划线/空格等一切分隔符写法、供应商路径、方括号前缀、日期与版本后缀，以及**中文
 * 等非 ASCII 修饰段**（如「抗截断-gemini-3.8-flash」里的中文前缀）都会被剥掉，
 * 因此「抗截断-gemini-3.8-flash」「gemini_3.8_flash」「gemini3.8flash」都能认出是
 * 目录里的 gemini-3.8-flash；但 mini/lite/pro 这类变体词与数字版本一律保留并加重罚。
 */

export type ModelMatchReason = 'exact' | 'normalized' | 'alias' | 'prefix' | 'tokens' | 'fuzzy';

export type ModelMatchCandidate = {
  model: string;
  score: number;
  reason: ModelMatchReason;
};

export type ModelMatchResult = {
  best: ModelMatchCandidate | null;
  second: ModelMatchCandidate | null;
  ambiguous: boolean;
};

/** 可自动写入的最低置信度 */
export const MODEL_MATCH_ACCEPT = 0.85;
/** 第一名与第二名分差小于该值时视为歧义（需人工确认） */
export const MODEL_MATCH_AMBIGUITY_GAP = 0.05;

/** 已知同义模型名（仅做等价加分，不强绑）：归一化后仍不同但确为同一模型的写法 */
export const MODEL_ALIAS_HINTS: Record<string, string[]> = {
  'qwen-max': ['qwen3-max', 'qwen-max-latest'],
  'qwen-plus': ['qwen3-plus', 'qwen-plus-latest'],
  'qwen-turbo': ['qwen3-turbo', 'qwen-turbo-latest'],
  'glm-4-5': ['glm-4-5-air', 'zai-glm-4-5'],
  'kimi-k2': ['kimi-k2-turbo-preview'],
  'gpt-4-1': ['gpt-4-1-2025-04-14'],
};

/** 追加在短名之后、仍视为同一模型的修饰词 */
const NEUTRAL_SUFFIX_TOKENS = new Set([
  'latest', 'preview', 'thinking', 'instruct', 'chat', 'base', 'it', 'hf', 'free', 'exp', 'online',
]);

const DATE_SUFFIX_8 = /-\d{8}$/;
const DATE_SUFFIX_DASHED = /-\d{4}-\d{2}-\d{2}$/;
const DATE_SUFFIX_4 = /-\d{4}$/;
const VERSION_SUFFIX = /-v\d+:\d+$/;

/**
 * 归一化模型名：只保留字母数字与连字符。
 * 依次做：全角转半角 → 去方括号前缀 → 取供应商路径末段 → 去 :free 之类后缀 →
 * 去版本后缀 → **把中文等非 ASCII 段与一切分隔符（. _ 空格 , : – — 等）统一成 "-"**
 * → 去日期后缀 → 去 deepseek-ai- 前缀与 -latest 后缀 → 压平多余连字符。
 * 中文修饰段剥掉后若什么都不剩（如纯中文名）则返回空字符串，由调用方判为不可匹配。
 */
export function normalizeModelName(raw: unknown): string {
  let key = String(raw ?? '').trim().normalize('NFKC').toLowerCase();
  if (!key) return '';
  key = key.replace(/^\[[^\]]*\]\s*/, '');
  key = key.split('/').pop() || key;
  key = key.replace(/:(?:free|nitro|beta|extended|online)$/, '');
  key = key.replace(VERSION_SUFFIX, '');
  key = key.replace(/[^a-z0-9]+/g, '-');
  key = key.replace(DATE_SUFFIX_8, '');
  key = key.replace(DATE_SUFFIX_DASHED, '');
  key = key.replace(DATE_SUFFIX_4, '');
  key = key.replace(/^deepseek-ai-/, '');
  key = key.replace(/-latest$/, '');
  key = key.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return key;
}

function numericTokens(value: string): string[] {
  return value.split('-').filter((token) => /^\d+$/.test(token) || /^v\d+$/.test(token));
}

/** 版本号不一致（4.5 vs 4、72b vs 32b 等）时视为不同模型 */
function hasVersionConflict(a: string, b: string): boolean {
  const left = numericTokens(a);
  const right = numericTokens(b);
  if (!left.length || !right.length) return false;
  return left.join('-') !== right.join('-');
}

function tokenScore(a: string, b: string): number {
  const left = a.split('-').filter(Boolean);
  const right = b.split('-').filter(Boolean);
  const setLeft = new Set(left);
  const setRight = new Set(right);
  let intersection = 0;
  for (const token of setLeft) if (setRight.has(token)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  const jaccard = union ? intersection / union : 0;
  const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  return jaccard * 0.75 + lengthRatio * 0.25;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

function aliasEquivalent(a: string, b: string): boolean {
  const hints = MODEL_ALIAS_HINTS[a];
  if (hints && hints.includes(b)) return true;
  const reverse = MODEL_ALIAS_HINTS[b];
  return !!reverse && reverse.includes(a);
}

/**
 * 计算单对模型名相似度。
 * 返回 score 与判定原因，score 已包含版本/变体惩罚。
 */
export function scoreModelName(local: string, catalog: string): { score: number; reason: ModelMatchReason } {
  const a = normalizeModelName(local);
  const b = normalizeModelName(catalog);
  if (!a || !b) return { score: 0, reason: 'fuzzy' };
  if (String(local).trim().toLowerCase() === String(catalog).trim().toLowerCase()) {
    return { score: 1, reason: 'exact' };
  }
  if (a === b) return { score: 1, reason: 'normalized' };
  // 有无分隔符的写法差异（gemini3.8flash / gemini-3-8-flash）也算同一模型；
  // 只在去掉连字符后完全一致时成立，且要求足够长，避免 o1 / o-1 这类短名的巧合
  const compactA = a.replace(/-/g, '');
  const compactB = b.replace(/-/g, '');
  if (compactA.length >= 6 && compactA === compactB) return { score: 1, reason: 'normalized' };
  if (aliasEquivalent(a, b)) return { score: 0.99, reason: 'alias' };

  let best = 0;
  let reason: ModelMatchReason = 'fuzzy';

  // 前缀关系：仅当长名多出的部分全是中性修饰词时才认为同一模型
  if (a.startsWith(b + '-') || b.startsWith(a + '-')) {
    const longer = a.length >= b.length ? a : b;
    const shorter = a.length >= b.length ? b : a;
    const extra = longer.slice(shorter.length + 1).split('-').filter(Boolean);
    const neutral = extra.length > 0 && extra.every((token) => NEUTRAL_SUFFIX_TOKENS.has(token));
    const lengthRatio = shorter.length / longer.length;
    if (neutral) {
      // 只多出 latest/preview/exp 这类中性修饰词就是同一模型，长度比不该成为拦路虎：
      // 「gemini-3.1-pro-preview」对「gemini-3.1-pro」长度比只有 0.62，按老规则会被压到 0.6
      // 而漏配；给 0.9（低于 1.0 但与第二名拉开 0.05 以上分差，不制造假歧义）
      best = lengthRatio >= 0.75 ? 0.95 : 0.9;
      reason = 'prefix';
    } else if (lengthRatio >= 0.6) {
      // 变体后缀（mini/lite/pro/flash/plus…）或数字版本追加：可能是不同模型，重罚
      best = 0.6;
      reason = 'prefix';
    }
  }

  const tokens = tokenScore(a, b);
  if (tokens > best) {
    best = tokens;
    reason = 'tokens';
  }

  if (Math.max(a.length, b.length) >= 6) {
    const distance = levenshtein(a, b);
    const similarity = 1 - distance / Math.max(a.length, b.length);
    if (similarity >= 0.85 && similarity - 0.05 > best) {
      best = similarity - 0.05;
      reason = 'fuzzy';
    }
  }

  if (hasVersionConflict(a, b)) best = Math.min(best, 0.45);
  return { score: Math.round(best * 1000) / 1000, reason };
}

/** 对给定本地模型名，在目录模型名列表中排序候选项 */
export function rankModelCandidates(
  local: string,
  catalogModels: string[],
  limit = 5,
): ModelMatchCandidate[] {
  const rows: ModelMatchCandidate[] = [];
  for (const model of catalogModels) {
    const { score, reason } = scoreModelName(local, model);
    if (score <= 0) continue;
    rows.push({ model, score, reason });
  }
  rows.sort((left, right) => right.score - left.score || left.model.localeCompare(right.model));
  return rows.slice(0, limit);
}

/** 取最匹配项并判定是否歧义（分差过小） */
export function matchModelName(local: string, catalogModels: string[]): ModelMatchResult {
  const ranked = rankModelCandidates(local, catalogModels, 3);
  const best = ranked[0] || null;
  const second = ranked[1] || null;
  if (!best || best.score < MODEL_MATCH_ACCEPT) return { best: null, second, ambiguous: false };
  const ambiguous = !!second
    && second.score >= MODEL_MATCH_ACCEPT
    && best.score - second.score < MODEL_MATCH_AMBIGUITY_GAP;
  return { best, second, ambiguous };
}
