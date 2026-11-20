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

/**
 * 请求内容的摘要指纹（FNV-1a 32 位，只为「是不是同一份请求体」服务，不做安全用途）。
 *
 * 用途：多层 fetch 包装各自解析同一个响应时，requestId 各不相同、起始时间也差几毫秒，
 * 唯一稳定可比的现场就是「这一轮发出的 messages」。两次真实请求即使 token 数完全一致，
 * 请求体也几乎不可能相同，所以拿它做内容去重的判据比「请求起始秒」稳得多。
 * 任何异常都退化成空串（调用方据此跳过这层去重，绝不因为摘要失败而丢记录）。
 */
/**
 * 长文本抽样：整段上下文可能有几十万字符，逐字哈希没必要——
 * 同一份请求体抽样结果必然一致，不同请求体在头尾各一段上也几乎不可能撞。
 */
function sampleText(text: string): string {
  const s = String(text || '');
  if (s.length <= 4000) return s;
  return s.slice(0, 2000) + '#' + s.length + '#' + s.slice(-1500);
}

export function messageDigest(messages: any): string {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  let hash = 0x811c9dc5;
  const feed = (s: string): void => {
    for (let i = 0; i < s.length; i += 1) {
      hash ^= s.charCodeAt(i);
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    // 段间混一个分隔符，避免 ["ab","c"] 与 ["a","bc"] 撞成同一个摘要
    hash ^= 0x1f;
    hash = hash >>> 0;
  };
  for (const m of messages) {
    try {
      if (!m || typeof m !== 'object') { feed(String(m ?? '')); continue; }
      feed(String((m as any).role || ''));
      const c: any = (m as any).content;
      if (typeof c === 'string') feed(sampleText(c));
      else if (c == null) feed('');
      else feed(sampleText(JSON.stringify(c)));
    } catch {
      feed('');
    }
  }
  return messages.length + ':' + (hash >>> 0).toString(36);
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
