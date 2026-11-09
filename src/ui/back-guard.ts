/**
 * 安卓返回键接管用到的纯逻辑 —— 只做状态换算，不碰 DOM 与 history，
 * 真正的 pushState / 事件监听留在 `ui/panel.ts`。
 *
 * 现在的语义很简单：窄屏打开面板时，往酒馆当前记录之上压**一条**哨兵，
 * 用户按一次系统返回就关掉面板、留在酒馆页面，不再做「逐层后退」。
 *
 * 为什么不再压多层、也不再补压（真机日志换来的结论）：
 *   ① 在 popstate 里 pushState 补压会被浏览器的「历史操纵干预」吃掉——页面在事件里
 *      插入的记录会被忽略，用户下一次手势直接跳过哨兵退进旧文档，表现就是整页重载，
 *      也就是用户说的「退出酒馆」；
 *   ② 压得越多，关面板后留在历史里的空记录越多，用户回上一页要多按好几次。
 * 一条哨兵就够隔开「一次返回」，所以 BACK_GUARD_DEPTH 固定为 1。
 */

/** 哨兵历史记录在 state 上的标记键 */
export const AUS_BACK_FLAG = '__ausBackGuard';

/** 预先压入的哨兵条数：一条，一次系统返回刚好被它接住 */
export const BACK_GUARD_DEPTH = 1;

/**
 * 读取某条历史 state 的哨兵深度（= 它距酒馆自己那条记录的步数）。
 * 不是我们压的记录、或值非法一律返回 0（0 表示「就在酒馆页面上」）。
 * 旧版本压过 3/6 条，残留标记会被夹到 1，按「一条哨兵」处理。
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

/** 摘掉哨兵标记（压新哨兵前把当前记录洗成干净基线）；本来就没有标记返回 null，且不修改传入对象 */
export function stripGuardState(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== 'object') return null;
  const prev = state as Record<string, unknown>;
  if (!(AUS_BACK_FLAG in prev)) return null;
  const next: Record<string, unknown> = { ...prev };
  delete next[AUS_BACK_FLAG];
  return next;
}
