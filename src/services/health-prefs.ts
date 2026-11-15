/**
 * 历史记录页「问题提示」的偏好：总开关 + 已忽略的问题指纹
 *
 * 两件事分开存：
 * - 总开关（默认开启）：关掉后历史记录页不再显示任何提示条，入口在
 *   「问题反馈 / 请求日志」页；用户主动关掉的意图要跨刷新保留。
 * - 忽略列表：点提示条上的「忽略」时，把当前这批问题按指纹记下来，
 *   同类问题以后不再弹；换了模型或换了问题类型仍会重新提示。
 *
 * 只用 localStorage，失败时退化为「不忽略、保持开启」，绝不阻塞主流程。
 */

export const HEALTH_BAR_ENABLED_KEY = 'aus_health_bar_enabled_v1';
export const HEALTH_IGNORE_KEY = 'aus_health_ignore_v1';
/** 最多记多少个指纹，超了淘汰最旧的，避免存储无限增长 */
export const HEALTH_IGNORE_LIMIT = 50;

interface IgnoreEntry {
  key: string;
  at: number;
}

function readStorage(key: string): string | null {
  try {
    return (globalThis as any).localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    (globalThis as any).localStorage?.setItem(key, value);
  } catch {
    /* 隐私模式/配额满：静默忽略 */
  }
}

/** 总开关：没存过（或存坏了）都按「开启」处理 */
export function isHealthBarEnabled(): boolean {
  const raw = readStorage(HEALTH_BAR_ENABLED_KEY);
  if (raw === '0') return false;
  if (raw === '1') return true;
  return true;
}

export function setHealthBarEnabled(enabled: boolean): void {
  writeStorage(HEALTH_BAR_ENABLED_KEY, enabled ? '1' : '0');
}

function readEntries(): IgnoreEntry[] {
  const raw = readStorage(HEALTH_IGNORE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: IgnoreEntry[] = [];
    for (const item of parsed) {
      const key = typeof item?.key === 'string' ? item.key : '';
      if (!key) continue;
      const at = Number(item?.at) || 0;
      out.push({ key, at });
    }
    return out;
  } catch {
    return [];
  }
}

/** 已忽略的问题指纹（新→旧） */
export function readIgnoredHealthKeys(): string[] {
  return readEntries().map((e) => e.key);
}

export function ignoredHealthCount(): number {
  return readEntries().length;
}

/** 追加忽略；重复的指纹只更新时间为最新，超出上限淘汰最旧的 */
export function addIgnoredHealthKeys(keys: string[], now = Date.now()): number {
  const incoming = (keys || []).filter((k) => typeof k === 'string' && k);
  if (!incoming.length) return ignoredHealthCount();
  const map = new Map<string, number>();
  for (const entry of readEntries()) map.set(entry.key, entry.at);
  for (const key of incoming) map.set(key, now);
  const kept = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, HEALTH_IGNORE_LIMIT)
    .map(([key, at]) => ({ key, at }));
  writeStorage(HEALTH_IGNORE_KEY, JSON.stringify(kept));
  return kept.length;
}

/** 清空忽略记录（「问题反馈 / 请求日志」页的恢复入口） */
export function clearIgnoredHealthKeys(): void {
  writeStorage(HEALTH_IGNORE_KEY, '[]');
}
