import { describe, expect, it } from 'vitest';
import { CHANGELOG, CHANGELOG_ENTRY_LIMIT, getRecentChangelog } from '../constants/changelog';
import { formatChangelogDate, renderChangelogCard } from './changelog';

const KINDS = ['feature', 'improve', 'fix'];
/** 用本地时间构造，测试结果与运行机器时区无关 */
const ts = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();

describe('更新日志日期展示', () => {
  it('同年只显示 月/日，跨年补年份', () => {
    expect(formatChangelogDate('2026-10-23', ts(2026, 10, 29))).toBe('10/23');
    expect(formatChangelogDate('2026-01-05', ts(2026, 3, 1))).toBe('1/5');
    expect(formatChangelogDate('2025-12-01', ts(2026, 1, 2))).toBe('2025/12/1');
  });

  it('非法或空日期原样返回，不抛错', () => {
    expect(formatChangelogDate('', ts(2026, 1, 1))).toBe('');
    expect(formatChangelogDate('10/23', ts(2026, 1, 1))).toBe('10/23');
  });
});

describe('更新日志数据', () => {
  it('条目字段合法且按日期倒序', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    let prev = Number.POSITIVE_INFINITY;
    for (const entry of CHANGELOG) {
      expect(entry.version.trim().length).toBeGreaterThan(0);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const time = new Date(entry.date + 'T00:00:00').getTime();
      expect(Number.isFinite(time)).toBe(true);
      expect(time).toBeLessThanOrEqual(prev);
      prev = time;
      expect(entry.sections.length).toBeGreaterThan(0);
      for (const section of entry.sections) {
        expect(KINDS).toContain(section.kind);
        expect(section.items.length).toBeGreaterThan(0);
        for (const item of section.items) {
          expect(typeof item).toBe('string');
          expect(item.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('getRecentChangelog 按上限截取', () => {
    expect(getRecentChangelog().length).toBe(Math.min(CHANGELOG_ENTRY_LIMIT, CHANGELOG.length));
    expect(getRecentChangelog(1).length).toBe(1);
    expect(getRecentChangelog(0).length).toBe(0);
    expect(getRecentChangelog(-5).length).toBe(0);
  });
});

describe('更新日志渲染', () => {
  it('最新版本默认展开，其余版本默认收起', () => {
    const html = renderChangelogCard();
    expect(html).toContain('id="aus-changelog"');
    expect(html).toContain(CHANGELOG[0].version);
    expect(html).toContain('aus-changelog-latest');
    const bodies = html.match(/class="aus-changelog-body"[^>]*>/g) || [];
    expect(bodies.length).toBe(Math.min(CHANGELOG_ENTRY_LIMIT, CHANGELOG.length));
    expect(bodies[0]).not.toContain('display:none');
    bodies.slice(1).forEach((b) => expect(b).toContain('display:none'));
  });

  it('三分类文案与条目全部渲染且做转义', () => {
    const html = renderChangelogCard();
    for (const label of ['新增', '改进', '修复']) expect(html).toContain(label);
    for (const section of CHANGELOG[0].sections) {
      for (const item of section.items) {
        expect(html).toContain(item.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      }
    }
  });
});
