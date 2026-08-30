/**
 * 统一事件总线 — 所有数据变更的唯一通知路径
 * UI 层只订阅 events，不直接轮询 state
 */
type Handler = (payload?: any) => void;
const map = new Map<string, Set<Handler>>();

export const DataEvents = {
  UPDATED: 'data:updated', // 任何数据变更（存储/修改/导入/同步后）
  HISTORY_ADDED: 'data:history:added',
  SETTINGS_CHANGED: 'data:settings:changed',
  BALANCE_CHANGED: 'data:balance:changed',
} as const;

export function on(event: string, fn: Handler) {
  if (!map.has(event)) map.set(event, new Set());
  map.get(event)!.add(fn);
  return () => off(event, fn);
}
export function off(event: string, fn: Handler) { map.get(event)?.delete(fn); }
export function emit(event: string, payload?: any) {
  map.get(event)?.forEach(fn => { try { fn(payload); } catch {} });
}
