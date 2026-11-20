/**
 * 请求探针 —— 对账（纯逻辑，无 DOM、无副作用）
 *
 * 设计前提（用户判断）：探针抓到的请求里，绝大多数命中对账的就是常规对话请求；
 * 对不上的，极大概率就是现有逻辑拿不到的非对话请求。所以这里不判断「是不是对话」，
 * 只判断「现有逻辑有没有为它写过一条历史记录」。
 *
 * 匹配只做一对一消耗：N 条探针记录配 M 条入账记录时，逐条消费，不会出现一条入账被两条探针共用。
 */

/** 现有链路写入的入账快照（来自 DataEvents.HISTORY_ADDED 携带的 entry） */
export interface Settlement {
  /** entry.requestId（可能为空） */
  id: string;
  model: string;
  prompt: number;
  completion: number;
  total: number;
  /** entry.timestamp */
  ts: number;
  /** 这条入账是不是「上游没给用量、按本地估算补记」的（usageSource === 'estimated'） */
  estimated?: boolean;
}

/** 探针记录里参与对账的字段 */
export interface ProbeKey {
  model: string;
  prompt: number;
  completion: number;
  total: number;
  at: number;
  endedAt: number;
}

/** 匹配窗口：覆盖酒馆 GENERATION_ENDED → 写库的延迟，同时避免误配相邻请求 */
export const MATCH_WINDOW_MS = 60000;

/**
 * 去掉模型名前缀标签（`[A]`、`[Proxy]`、`[抗截断]` 这类），只用于对账比较。
 *
 * 探针抓的是请求体原样的模型名，而入账记录的 `entry.model` 已经被扩展归一过
 * （前缀留在 `rawModel`）。不做这一步，`[A]gemini-3.8-flash` 与
 * `gemini-3.8-flash` 永远对不上，整类请求会被误判成「没记进历史」。
 * 展示仍用原名，这里只在比较时剥掉。
 */
export function stripModelTag(model: string): string {
  return String(model || '').trim().replace(/^\[[^\]]{1,24}\]\s*/, '');
}

export function normalizeModel(model: string): string {
  return stripModelTag(model).toLowerCase();
}

/** 入账时刻是否落在探针请求的合理时间范围（请求发出 ~ 结束 + 窗口）内 */
function inWindow(s: Settlement, p: ProbeKey, windowMs: number): boolean {
  const lo = p.at - windowMs;
  const hi = (p.endedAt || p.at) + windowMs;
  return s.ts >= lo && s.ts <= hi;
}

export type MatchBy = 'tokens' | 'total' | 'estimated';

/**
 * 为一条探针记录找入账记录。
 * 优先级：tokens（prompt+completion 全等）→ total（总数全等，usage 只有总数时兜底）。
 * used 里已消费的 id 会被跳过，保证一对一。
 */
export function findSettlement(
  probe: ProbeKey,
  settlements: Settlement[],
  used: Set<string>,
  windowMs = MATCH_WINDOW_MS,
): { settlement: Settlement; by: MatchBy } | null {
  const model = normalizeModel(probe.model);
  let totalFallback: Settlement | null = null;
  for (const s of settlements) {
    if (used.has(s.id)) continue;
    if (model && s.model && normalizeModel(s.model) !== model) continue;
    if (!inWindow(s, probe, windowMs)) continue;
    if (probe.prompt > 0 && probe.completion > 0 && s.prompt === probe.prompt && s.completion === probe.completion) {
      return { settlement: s, by: 'tokens' };
    }
    if (!totalFallback && probe.total > 0 && s.total === probe.total) totalFallback = s;
  }
  return totalFallback ? { settlement: totalFallback, by: 'total' } : null;
}

/**
 * 探针没抓到 usage 时的对账：只按「模型 + 时间窗」配一条本地估算补记的入账记录。
 *
 * 上游不回 usage 的轮次，扩展会按本地估算补记一条历史（usageSource='estimated'），
 * 它的 token 数和探针侧（无用量）永远不可能全等，所以走不到 findSettlement。
 * 早期版本因此把这类轮次一律判成 orphan，健康提示里就变成「疑似没记进历史」的误报。
 * 这是「确认记过账」的弱匹配：只认模型对得上、且时间落窗内的估算条目，并优先取最近的一条。
 */
export function findEstimatedSettlement(
  probe: ProbeKey,
  settlements: Settlement[],
  used: Set<string>,
  windowMs = MATCH_WINDOW_MS,
): Settlement | null {
  if (probe.total > 0 || probe.prompt > 0 || probe.completion > 0) return null;
  const model = normalizeModel(probe.model);
  const anchor = probe.endedAt || probe.at;
  let best: Settlement | null = null;
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
export function probeKeyOf(input: {
  model: string;
  usage: { prompt: number; completion: number; total: number } | null;
  at: number;
  endedAt: number;
}): ProbeKey {
  return {
    model: input.model,
    prompt: input.usage?.prompt ?? 0,
    completion: input.usage?.completion ?? 0,
    total: input.usage?.total ?? 0,
    at: input.at,
    endedAt: input.endedAt,
  };
}
