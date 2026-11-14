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
export const MATCH_WINDOW_MS = 20000;

export function normalizeModel(model: string): string {
  return String(model || '').trim().toLowerCase();
}

/** 入账时刻是否落在探针请求的合理时间范围（请求发出 ~ 结束 + 窗口）内 */
function inWindow(s: Settlement, p: ProbeKey, windowMs: number): boolean {
  const lo = p.at - windowMs;
  const hi = (p.endedAt || p.at) + windowMs;
  return s.ts >= lo && s.ts <= hi;
}

export type MatchBy = 'tokens' | 'total';

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
