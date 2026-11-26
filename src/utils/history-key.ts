/**
 * 历史记录去重键：兼容旧记录缺少钱包字段的情况。
 * 优先使用 endpointId，钱包记录与迁移前记录才能保持同一身份。
 * 有 requestId 时再追加一项：同毫秒、同模型、同 token 的两条真实请求靠它区分。
 */
export function historyRecordKey(entry: any): string {
  // Agent 模式的一条历史代表一整次 Run：只按 runId 去重，
  // 保证同一 Run 跨设备/跨导入导出始终合并为一条，且不受事后补采的 token 变化影响。
  // 常规记录（无 agentRunId）完全沿用原有键，行为不变。
  const agentRunId = typeof entry?.agentRunId === 'string' ? entry.agentRunId.trim() : '';
  if (agentRunId) return JSON.stringify(['agent', agentRunId]);
  const parts: any[] = [
    Number(entry?.timestamp) || 0,
    String(entry?.model || ''),
    Number(entry?.total_tokens) || 0,
    Number(entry?.cache_hit_tokens) || 0,
    Number(entry?.cache_miss_tokens) || 0,
    Number(entry?.completion_tokens) || 0,
    String(entry?.endpointId || entry?.walletId || ''),
    String(entry?.credentialId || ''),
  ];
  // 采集器给每次请求分配 req:<毫秒>:<自增序号>，同毫秒连发也不重复。
  // 只在前八项完全相同（同毫秒、同模型、同四元 token、同接入与密钥）时才可能误并，
  // 补上 requestId 就能把两条真实请求分开；旧记录没有这个字段，键保持原样，跨设备合并不受影响。
  const requestId = typeof entry?.requestId === 'string' ? entry.requestId.trim() : '';
  if (requestId) parts.push(requestId);
  return JSON.stringify(parts);
}
