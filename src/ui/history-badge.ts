/**
 * 历史记录角标（纯函数，单一来源）
 *
 * 优先级刻意如此：中断 > 估算 > Agent > 常规。
 * 中断记录最需要被一眼看到（它可能少算了 token），其次才是「这轮是估的」。
 * 颜色取自语义色变量，浅色/深色主题自动跟随；此处只输出内联样式，不写 CSS 类。
 */

export type HistoryBadgeKind = 'normal' | 'agent' | 'interrupted-user' | 'interrupted-upstream' | 'estimated';

export interface HistoryBadge {
  kind: HistoryBadgeKind;
  text: string;
  background: string;
  color: string;
}

const NORMAL: HistoryBadge = {
  kind: 'normal',
  text: '常规',
  background: 'var(--ds-card-inner)',
  color: 'var(--ds-text-3)',
};

export function historyBadgeOf(entry: any): HistoryBadge {
  const interrupted = entry?.interrupted;
  if (interrupted === 'user') {
    return { kind: 'interrupted-user', text: '中断', background: 'var(--ds-yellow-bg)', color: 'var(--ds-yellow)' };
  }
  if (interrupted === 'upstream') {
    return { kind: 'interrupted-upstream', text: '中断', background: 'var(--ds-red-bg)', color: 'var(--ds-red)' };
  }
  if (String(entry?.usageSource || '') === 'estimated') {
    return { kind: 'estimated', text: '估算', background: 'var(--ds-yellow-bg)', color: 'var(--ds-yellow)' };
  }
  if (String(entry?.origin || '') === 'agent') {
    return { kind: 'agent', text: 'Agent', background: 'var(--ds-green-bg)', color: 'var(--ds-green)' };
  }
  return { ...NORMAL };
}
