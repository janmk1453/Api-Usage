import { describe, expect, it } from 'vitest';
import {
  announcementDayEnd,
  cleanAnnouncementText,
  isAnnouncementActive,
  normalizeAnnouncementFile,
  normalizeAnnouncementItem,
  pickUnreadAnnouncements,
  pruneSeenIds,
  sortAnnouncements,
  versionAtLeast,
  versionAtMost,
  type AnnouncementItem,
} from './announcement';

const raw = (patch: Record<string, any> = {}) => ({
  id: '2026-11-22-wallet',
  date: '2026-11-22',
  level: 'info',
  title: '钱包合并说明',
  body: ['第一段', '第二段'],
  ...patch,
});

describe('cleanAnnouncementText', () => {
  it('去掉控制字符、把 CRLF 压成 LF、首尾去空白', () => {
    expect(cleanAnnouncementText('  第一行\r\n第二行\u0007  ')).toBe('第一行\n第二行');
  });

  it('非字符串与空串都归零，超长截断并补省略号', () => {
    expect(cleanAnnouncementText(null)).toBe('');
    expect(cleanAnnouncementText(123)).toBe('');
    const long = 'a'.repeat(20);
    expect(cleanAnnouncementText(long, 10)).toBe('a'.repeat(10) + '…');
  });
});

describe('normalizeAnnouncementItem', () => {
  it('合法条目原样收敛', () => {
    const item = normalizeAnnouncementItem(raw({ minVersion: 'v3.2.0', until: '2026-12-31', linkUrl: 'https://example.com/a', linkText: '看说明' }));
    expect(item).toMatchObject({
      id: '2026-11-22-wallet',
      date: '2026-11-22',
      level: 'info',
      title: '钱包合并说明',
      body: ['第一段', '第二段'],
      minVersion: '3.2.0',
      until: '2026-12-31',
      linkUrl: 'https://example.com/a',
      linkText: '看说明',
    });
  });

  it('缺 id / 标题 / 正文一律丢弃', () => {
    expect(normalizeAnnouncementItem(raw({ id: '' }))).toBeNull();
    expect(normalizeAnnouncementItem(raw({ id: '带 空格' }))).toBeNull();
    expect(normalizeAnnouncementItem(raw({ title: '   ' }))).toBeNull();
    expect(normalizeAnnouncementItem(raw({ body: [] }))).toBeNull();
    expect(normalizeAnnouncementItem(null)).toBeNull();
  });

  it('正文可写单个字符串；level 与日期坏了给安全值', () => {
    const item = normalizeAnnouncementItem(raw({ body: '就一段', level: 'fatal', date: '2026/11/22' }));
    expect(item).toMatchObject({ body: ['就一段'], level: 'info', date: '' });
  });

  it('外链只认 http(s) 与站内路径，其余丢弃', () => {
    expect(normalizeAnnouncementItem(raw({ linkUrl: 'javascript:alert(1)' }))?.linkUrl).toBe('');
    expect(normalizeAnnouncementItem(raw({ linkUrl: 'https://a.b/c' }))?.linkUrl).toBe('https://a.b/c');
    expect(normalizeAnnouncementItem(raw({ linkUrl: '/docs/index.html' }))?.linkUrl).toBe('/docs/index.html');
  });
});

describe('normalizeAnnouncementFile', () => {
  it('兼容数组与 { schema, items } 两种写法，并按 id 去重', () => {
    expect(normalizeAnnouncementFile([raw(), raw({ title: '重复 id 丢弃' })])).toHaveLength(1);
    expect(normalizeAnnouncementFile({ schema: 1, items: [raw({ id: 'a' }), raw({ id: 'b' })] })).toHaveLength(2);
    expect(normalizeAnnouncementFile(null)).toEqual([]);
  });
});

describe('版本区间', () => {
  it('逐段比较，缺段按 0', () => {
    expect(versionAtLeast('3.2.3', '3.2')).toBe(true);
    expect(versionAtLeast('3.2.3', '3.2.4')).toBe(false);
    expect(versionAtLeast('3.10.0', '3.9.9')).toBe(true);
    expect(versionAtMost('3.2.3', '3.2.3')).toBe(true);
    expect(versionAtMost('3.3.0', '3.2.9')).toBe(false);
    expect(versionAtLeast('1.0.0', '')).toBe(true);
  });
});

describe('isAnnouncementActive', () => {
  const ctx = { version: '3.2.3', now: new Date(2026, 10, 22, 12, 0, 0).getTime() };
  const item = (patch: Partial<AnnouncementItem>) => normalizeAnnouncementItem(raw(patch)) as AnnouncementItem;

  it('版本区间命中才投放', () => {
    expect(isAnnouncementActive(item({ minVersion: '3.2.0' }), ctx)).toBe(true);
    expect(isAnnouncementActive(item({ minVersion: '3.3.0' }), ctx)).toBe(false);
    expect(isAnnouncementActive(item({ maxVersion: '3.2.9' }), ctx)).toBe(true);
    expect(isAnnouncementActive(item({ maxVersion: '3.2.0' }), ctx)).toBe(false);
  });

  it('until 当天仍有效，过了当天失效', () => {
    const until = item({ until: '2026-11-22' });
    expect(isAnnouncementActive(until, ctx)).toBe(true);
    expect(isAnnouncementActive(until, { version: '3.2.3', now: announcementDayEnd('2026-11-22') + 1 })).toBe(false);
  });
});

describe('未读筛选与排序', () => {
  const make = (id: string, date: string, patch: Partial<AnnouncementItem> = {}) =>
    normalizeAnnouncementItem(raw({ id, date, ...patch })) as AnnouncementItem;

  it('跳过已读、按日期倒序、无日期的排最后', () => {
    const items = [make('a', '2026-11-20'), make('b', '2026-11-22'), make('c', ''), make('d', '2026-11-21')];
    const unread = pickUnreadAnnouncements(items, ['d'], { version: '3.2.3' });
    expect(unread.map(i => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('过期与版本不匹配的不出现在未读里', () => {
    const items = [make('old', '2026-01-01', { until: '2026-02-01' }), make('new', '2026-11-22', { minVersion: '9.0.0' })];
    expect(pickUnreadAnnouncements(items, [], { version: '3.2.3', now: new Date(2026, 10, 22).getTime() })).toEqual([]);
  });

  it('sortAnnouncements 不改原数组', () => {
    const items = [make('a', '2026-11-20'), make('b', '2026-11-22')];
    const sorted = sortAnnouncements(items);
    expect(sorted.map(i => i.id)).toEqual(['b', 'a']);
    expect(items.map(i => i.id)).toEqual(['a', 'b']);
  });
});

describe('pruneSeenIds', () => {
  it('去重后只留最近 limit 条（超限丢最旧的）', () => {
    expect(pruneSeenIds(['a', 'a', 'b'])).toEqual(['a', 'b']);
    expect(pruneSeenIds(['a', 'b', 'c'], 2)).toEqual(['b', 'c']);
    expect(pruneSeenIds([' ', ''])).toEqual([]);
  });
});
