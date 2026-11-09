/**
 * TauriTavern Agent 起点识别：`generate_data.frozenRunInputSnapshot` 的封口时机。
 *
 * 事实基线（已对 TauriTavern 源码逐 tag 核实）：
 * - ABI 1（TauriTavern ≤ 2.3.0）：快照挂在 `generate_data` 上**早于**
 *   `await eventSource.emit(GENERATE_AFTER_DATA, generate_data, dryRun)`
 *   （v2.3.0 `script.js:6449-6470` 赋值 → `:6485` emit），事件回调里同步读就能判定；
 * - ABI 2（TauriTavern 2.4.0 起，`src/tauri/main/bootstrap.js` 的 `HOST_ABI_VERSION` 由 1 升到 2）：
 *   改为 emit **之后**才赋值（v2.4.0 `script.js:6307` emit → `:6311-6333` 赋值，注释
 *   「Extensions finish their prompt work before the Run takes ownership of its inputs.」），
 *   事件回调里同步读必然读不到，导致「失败/取消且未提交聊天」的 Run 完全识别不到起点。
 *
 * 因此识别分两条路，**都不排定时器、不轮询**：
 * 1. 宿主 `__TAURITAVERN__.abiVersion === 1`（明确的旧版）：只走同步判定，最省；
 * 2. `abiVersion >= 2` 或读不到版本号：先做同步判定，未命中就把这次 `generate_data` 的
 *    **对象引用**存下来，在随后到来的任意酒馆事件里复查同一个对象是否已出现快照 ——
 *    事件前没有、事件后有了，即证明这次生成是 Agent 模式（ABI 2 的封口时机使然）。
 */

/** 自该 ABI 版本起，`frozenRunInputSnapshot` 在 GENERATE_AFTER_DATA 之后才封口 */
export const SNAPSHOT_SEALED_AFTER_EVENT_ABI = 2;

/** `generate_data` 上是否已经挂上 Agent 快照（自身属性，不认原型链） */
export function hasFrozenRunSnapshot(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(data as Record<string, unknown>, 'frozenRunInputSnapshot');
}

/** 该 ABI 版本是否需要「事件前后对比」兜底探测（未知版本号按需要处理） */
export function needsSnapshotProbe(abiVersion: number): boolean {
  const abi = Number.isFinite(abiVersion) ? Math.floor(abiVersion) : 0;
  return abi !== 1;
}

export interface FrozenSnapshotProbe {
  /** 记下本次 GENERATE_AFTER_DATA 的 generate_data 引用，留待后续事件复查 */
  remember(data: unknown): void;
  /** 复查并清空：任一被记住的对象已出现快照则返回 true */
  flush(): boolean;
  /** 丢弃全部待复查引用（卸载时用） */
  clear(): void;
  /** 当前待复查条数（测试与日志用） */
  size(): number;
}

/** 只保留最近几次生成：连续多次生成时，旧引用的封口窗口早已过去 */
export function createFrozenSnapshotProbe(limit = 2): FrozenSnapshotProbe {
  const max = Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 1));
  let pending: unknown[] = [];
  return {
    remember(data: unknown): void {
      if (!data || typeof data !== 'object') return;
      if (pending.indexOf(data) >= 0) return;
      pending.push(data);
      while (pending.length > max) pending.shift();
    },
    flush(): boolean {
      if (!pending.length) return false;
      const hit = pending.some((item) => hasFrozenRunSnapshot(item));
      pending = [];
      return hit;
    },
    clear(): void {
      pending = [];
    },
    size(): number {
      return pending.length;
    },
  };
}
