import type { HistoryConnection } from '../services/connection-identity';

/**
 * 一轮对话的去重指纹（两级）
 *
 * 为什么不再把 token 数算进指纹：
 * 估算记录与随后到达的真实 usage 的 token 数必然不同，含 token 的指纹会让两者都写进历史。
 * - 有 requestId：它就是同一请求的幂等键；
 * - 无 requestId：退化为「模型 + 接入身份 + 请求起始秒」，同一秒同一接入的同模型请求视为同一轮。
 */
export function turnFingerprint(input: {
  requestId?: string | null;
  model: string;
  startTime?: number | null;
  connection?: Partial<HistoryConnection> | null;
  now?: number;
}): string {
  const requestId = String(input.requestId || '').trim();
  if (requestId) return 'req:' + requestId;
  const startTime = Number(input.startTime);
  const now = Number(input.now);
  const base = Number.isFinite(startTime) && startTime > 0
    ? startTime
    : Number.isFinite(now) && now > 0
      ? now
      : Date.now();
  return [
    'turn',
    String(input.model || ''),
    input.connection?.endpointId || '',
    input.connection?.credentialId || '',
    Math.round(base / 1000),
  ].join('|');
}

export function usageFingerprint(
  model: string,
  total: number,
  hit: number,
  miss: number,
  completion: number,
  connection?: Partial<HistoryConnection> | null,
  requestId?: string | null,
): string {
  return [
    requestId || '',
    model,
    total,
    hit,
    miss,
    completion,
    connection?.endpointId || '',
    connection?.credentialId || '',
  ].join('|');
}
