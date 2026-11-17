/**
 * 本轮生成结果的处置判定（纯函数，单一来源）
 *
 * 背景：历史记录过去只看「有没有解析到非 0 usage」，于是出现两种丢失：
 * - 用户中途点停止 / 上游断流：明明有输出，却因为没有 usage 被整轮丢弃；
 * - 上游返回 usage 全 0（或部分中转直接不回）：同样整轮丢弃。
 *
 * 现在把「这一轮到底发生了什么」显式判定出来，采集侧按 kind 分派：
 * - record：usage 可用，正常入库（若同时被手动停止/断流，只加中断标记）；
 * - estimate：没有可用 usage 但有输出，按本地估算入库；
 * - interrupted：没有可用 usage、有输出，且能判定是手动停止或上游断开；
 * - drop：既没有可用 usage 也没有任何输出，静默不记录（由健康信号单独提示）。
 */

export type TurnOutcomeKind = 'record' | 'estimate' | 'interrupted' | 'drop';

export type TurnInterrupt = 'user' | 'upstream';

export interface TurnSignals {
  /** 是否解析到 usage 对象 */
  hasUsage: boolean;
  /** usage 里是否存在真实非 0 的 token 数（全 0 的 usage 视为不可用） */
  usageUsable: boolean;
  /** 本轮是否产出了正文或思维链字符 */
  hasOutput: boolean;
  /** 本轮是否收到过「用户点击停止」信号 */
  pendingStop: boolean;
  /** 流式读取过程中的错误文案（上游断开、网络中断、AbortError 等） */
  streamError: string | null;
}

export interface TurnOutcome {
  kind: TurnOutcomeKind;
  interrupted: TurnInterrupt | null;
  /** 判定依据（写进采集快照与健康信号，便于复现） */
  reason: string;
}

/** 本次生成结果 → 处置决定；调用方只按 kind 分派，不再自己拼条件 */
export function decideTurnOutcome(signals: TurnSignals): TurnOutcome {
  const hasUsage = signals.hasUsage === true;
  const usable = signals.usageUsable === true;
  const hasOutput = signals.hasOutput === true;
  const pendingStop = signals.pendingStop === true;
  const streamError = signals.streamError ? String(signals.streamError) : null;

  if (usable) {
    const interrupted: TurnInterrupt | null = pendingStop ? 'user' : streamError ? 'upstream' : null;
    return {
      kind: 'record',
      interrupted,
      reason: interrupted ? 'usage-' + interrupted + '-interrupted' : 'usage',
    };
  }
  if (!hasOutput) {
    return {
      kind: 'drop',
      interrupted: null,
      reason: hasUsage ? 'usage-all-zero-no-output' : 'no-usage-no-output',
    };
  }
  if (pendingStop) return { kind: 'interrupted', interrupted: 'user', reason: 'no-usage-user-stop' };
  if (streamError) return { kind: 'interrupted', interrupted: 'upstream', reason: 'no-usage-stream-error' };
  return {
    kind: 'estimate',
    interrupted: null,
    reason: hasUsage ? 'usage-all-zero-with-output' : 'no-usage-with-output',
  };
}
