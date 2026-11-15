import { describe, it, expect } from 'vitest';
import { healthBarHTML, isHistoryHealthDismissed } from './history-health-bar';
import type { HealthReport } from '../services/health-signals';

function report(over: Partial<HealthReport> = {}): HealthReport {
  return {
    total: 3,
    counts: { 'zero-usage': 2, 'missing-usage': 1, 'rate-anomaly': 0, 'plugin-error': 0 },
    items: [
      { kind: 'zero-usage', at: 1794719000000, detail: 'deepseek-flash 这一轮用量全为 0' },
      { kind: 'missing-usage', at: 1794719100000, detail: 'glm-5 的这一轮没有取到用量' },
    ],
    shouldShow: true,
    ...over,
  };
}

describe('历史记录页健康提示条', () => {
  it('展示异常次数、分类摘要与上传入口', () => {
    const html = healthBarHTML(report());
    expect(html).toContain('最近有 3 次对话记录异常');
    expect(html).toContain('用量为 0 2 次');
    expect(html).toContain('没有取到用量 1 次');
    expect(html).toContain('data-health-action="upload"');
    expect(html).toContain('上传反馈日志');
  });

  it('明细最多三条，其余折叠成一行提示', () => {
    const many = report({
      total: 6,
      items: [
        { kind: 'zero-usage', at: 1, detail: 'a' },
        { kind: 'zero-usage', at: 2, detail: 'b' },
        { kind: 'zero-usage', at: 3, detail: 'c' },
        { kind: 'zero-usage', at: 4, detail: 'd' },
      ],
    });
    const html = healthBarHTML(many);
    expect(html).toContain('还有 3 条未列出');
    expect(html).not.toContain('>d<');
  });

  it('明细里的文本会被转义', () => {
    const html = healthBarHTML(report({ items: [{ kind: 'plugin-error', at: 1, detail: '<img src=x>' }] }));
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });

  it('默认不处于「本次会话不再提示」状态', () => {
    expect(isHistoryHealthDismissed()).toBe(false);
  });
});
