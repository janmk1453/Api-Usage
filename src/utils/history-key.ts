/**
 * 历史记录去重键：兼容旧记录缺少钱包字段的情况。
 * 优先使用 endpointId，钱包记录与迁移前记录才能保持同一身份。
 */
export function historyRecordKey(entry: any): string {
  return JSON.stringify([
    Number(entry?.timestamp) || 0,
    String(entry?.model || ''),
    Number(entry?.total_tokens) || 0,
    Number(entry?.cache_hit_tokens) || 0,
    Number(entry?.cache_miss_tokens) || 0,
    Number(entry?.completion_tokens) || 0,
    String(entry?.endpointId || entry?.walletId || ''),
    String(entry?.credentialId || ''),
  ]);
}
