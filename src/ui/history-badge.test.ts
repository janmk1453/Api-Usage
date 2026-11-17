import { describe, it, expect } from 'vitest';
import { historyBadgeOf } from './history-badge';

describe('历史记录状态徽标', () => {
  it('普通记录显示常规', () => {
    const badge = historyBadgeOf({});
    expect(badge.kind).toBe('normal');
    expect(badge.text).toBe('常规');
  });

  it('Agent 记录显示 Agent', () => {
    const badge = historyBadgeOf({ origin: 'agent' });
    expect(badge.kind).toBe('agent');
    expect(badge.text).toBe('Agent');
  });

  it('用户中断为黄色', () => {
    const badge = historyBadgeOf({ interrupted: 'user' });
    expect(badge.kind).toBe('interrupted-user');
    expect(badge.text).toBe('中断');
    expect(badge.background).toContain('yellow');
  });

  it('上游中断为红色', () => {
    const badge = historyBadgeOf({ interrupted: 'upstream' });
    expect(badge.kind).toBe('interrupted-upstream');
    expect(badge.background).toContain('red');
  });

  it('估算记录为黄色并显示估算', () => {
    const badge = historyBadgeOf({ usageSource: 'estimated' });
    expect(badge.kind).toBe('estimated');
    expect(badge.text).toBe('估算');
    expect(badge.background).toContain('yellow');
  });

  it('中断优先于估算，估算优先于 Agent', () => {
    expect(historyBadgeOf({ interrupted: 'upstream', usageSource: 'estimated', origin: 'agent' }).kind).toBe('interrupted-upstream');
    expect(historyBadgeOf({ usageSource: 'estimated', origin: 'agent' }).kind).toBe('estimated');
  });

  it('正常上游用量不显示估算', () => {
    expect(historyBadgeOf({ usageSource: 'upstream' }).kind).toBe('normal');
    expect(historyBadgeOf({ interrupted: null, usageSource: null }).kind).toBe('normal');
  });
});
