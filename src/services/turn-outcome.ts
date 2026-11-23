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
 * - drop：没有可统计的内容，静默不记录（由健康信号 / 诊断快照单独提示）。
 *
 * 还有第三种失真：TauriTavern 把上游非 2xx 包装成 HTTP 200 + 正文，错误提示被当成
 * 「有输出」→ 走 estimate 入库并按全价计费（3.2.x 实测）。因此增加 errorPayload 信号，
 * 命中即代表这一整段输出不是模型内容，优先于任何 usage / 输出判断直接 drop。
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
  /**
   * 本轮「输出」其实是上游错误提示（识别结果串，例如 endpoint-status:128）。
   *
   * 宿主把非 2xx 的失败包成 200 时，响应正文里只有客户端拼的错误文案，没有任何模型内容；
   * 它既不能算输出、也不能计费，哪怕上游顺手回了 usage（更像伪造的假记录）。
   */
  errorPayload?: string | null;
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
  const errorPayload = signals.errorPayload ? String(signals.errorPayload) : null;

  // 最先判定：整段输出是上游错误提示时，这一轮根本没有模型内容。
  // 放在 usage 判断之前，是因为「错误响应带 usage」的假记录更隐蔽（4.1 节的第二种组合）。
  if (errorPayload) {
    return { kind: 'drop', interrupted: null, reason: 'api-error-payload' };
  }
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
