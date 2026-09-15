import type { HistoryConnection } from '../services/connection-identity';

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
