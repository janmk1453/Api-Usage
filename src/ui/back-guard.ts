/**
 * 安卓返回键接管用到的纯逻辑 —— 只做状态换算，不碰 DOM 与 history，
 * 真正的 pushState / 事件监听留在 `ui/panel.ts`。
 *
 * 为什么需要「深度缓冲」：浏览器会把用户连按的后退一次性解析成「后退 N 步」，
 * 而 popstate 处理里补压的 pushState 要等这一轮任务跑完才生效。只压一条哨兵时，
 * 连按两次后退就会一跳越过酒馆页面直接退出（已实测复现），因此必须预先压多条，
 * 并让每条哨兵自带「距酒馆条目的步数」，用来精确补压与退出清理。
 */

/** 哨兵历史记录在 state 上的标记键 */
export const AUS_BACK_FLAG = '__ausBackGuard';

/** 预先压入的哨兵条数：连按 3 次返回也不会越过酒馆页面 */
export const BACK_GUARD_DEPTH = 3;

/**
 * 读取某条历史 state 的哨兵深度（= 它距酒馆自己那条记录的步数）。
 * 不是我们压的记录、或值非法一律返回 0（0 表示「就在酒馆页面上」）。
 */
export function readGuardDepth(state: unknown): number {
  if (!state || typeof state !== 'object') return 0;
  const raw = (state as Record<string, unknown>)[AUS_BACK_FLAG];
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), BACK_GUARD_DEPTH);
}

/** 以 base 为底生成「深度为 depth」的哨兵 state；不修改传入的 base */
export function nextGuardState(base: unknown, depth: number): Record<string, unknown> {
  const next: Record<string, unknown> =
    base && typeof base === 'object' ? { ...(base as Record<string, unknown>) } : {};
  const n = Number.isFinite(depth) ? Math.floor(depth) : 0;
  next[AUS_BACK_FLAG] = Math.max(1, Math.min(n || 1, BACK_GUARD_DEPTH));
  return next;
}

/**
 * 当前深度为 current 时还需要依次压入哪些深度；空数组表示缓冲已满。
 * 返回序列由浅到深，调用方按顺序 pushState 即可把缓冲补满。
 */
export function guardFillPlan(current: number, buffer: number = BACK_GUARD_DEPTH): number[] {
  const from = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
  const to = Number.isFinite(buffer) ? Math.max(0, Math.floor(buffer)) : 0;
  const plan: number[] = [];
  for (let depth = from + 1; depth <= to; depth++) plan.push(depth);
  return plan;
}

/** 摘掉哨兵标记（退出接管时用）；本来就没有标记返回 null，且不修改传入对象 */
export function stripGuardState(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== 'object') return null;
  const prev = state as Record<string, unknown>;
  if (!(AUS_BACK_FLAG in prev)) return null;
  const next: Record<string, unknown> = { ...prev };
  delete next[AUS_BACK_FLAG];
  return next;
}
