import { describe, expect, it } from 'vitest';
import type { AnnouncementItem } from '../services/announcement';
import { activeAnnouncements, announcementCardHTML } from './announcement-card';

/** 用本地时间构造，测试结果与运行机器时区无关 */
const ts = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();
const NOW = ts(2026, 11, 23);

const item = (patch: Partial<AnnouncementItem> = {}): AnnouncementItem => ({
  id: '2026-11-22-wallet',
  date: '2026-11-22',
  level: 'info',
  title: '钱包合并说明',
  body: ['第一段', '第二段'],
  minVersion: '',
  maxVersion: '',
  until: '',
  linkText: '',
  linkUrl: '',
  ...patch,
});

/** 取某条公告自己的那段 HTML（标题唯一即可定位） */
function sectionOf(html: string, title: string): string {
  const chunks = html.split('<section class="aus-an-item"');
  return chunks.find(chunk => chunk.includes(title)) || '';
}

describe('activeAnnouncements', () => {
  it('按版本区间与 until 过滤，再按日期倒序', () => {
    const list = [
      item({ id: 'a', date: '2026-11-01' }),
      item({ id: 'b', date: '2026-11-20', minVersion: '3.2.0' }),
      item({ id: 'c', date: '2026-11-10', minVersion: '9.0.0' }),
      item({ id: 'd', date: '2026-11-05', until: '2026-11-06' }),
    ];
    const ids = activeAnnouncements(list, { version: '3.2.4', now: NOW }).map(i => i.id);
    expect(ids).toEqual(['b', 'a']);
  });

  it('版本没到 / 已过期 / 空值都不算可用', () => {
    const ctx = { version: '3.2.4', now: NOW };
    expect(activeAnnouncements([item({ minVersion: '3.2.5' })], ctx)).toHaveLength(0);
    expect(activeAnnouncements([item({ maxVersion: '3.2.3' })], ctx)).toHaveLength(0);
    expect(activeAnnouncements([item({ until: '2026-11-22' })], ctx)).toHaveLength(0);
    expect(activeAnnouncements(null, ctx)).toHaveLength(0);
    expect(activeAnnouncements([item()], ctx)).toHaveLength(1);
  });
});

describe('announcementCardHTML', () => {
  it('没有可用公告时给空态，且默认展开', () => {
    const html = announcementCardHTML([], { now: NOW });
    expect(html).toContain('id="aus-announcements"');
    expect(html).toContain('当前版本没有可展示的公告');
    expect(html).toContain('暂无公告');
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('display:none');
    expect(html).not.toContain('aus-an-card-unread');
  });

  it('渲染标题、正文、日期与级别', () => {
    const html = announcementCardHTML([item({ level: 'warning' })], { seenIds: ['2026-11-22-wallet'], now: NOW });
    expect(html).toContain('data-level="warning"');
    expect(html).toContain('钱包合并说明');
    expect(html).toContain('第一段');
    expect(html).toContain('第二段');
    expect(html).toContain('11/22');
    expect(html).toContain('1 条');
  });

  it('未读条目挂标、已读条目不挂，计数给出条数与未读数', () => {
    const list = [
      item({ id: 'read-one', title: '已读公告', date: '2026-11-20' }),
      item({ id: 'unread-one', title: '未读公告', date: '2026-11-21' }),
    ];
    const html = announcementCardHTML(list, { seenIds: ['read-one'], now: NOW });
    expect(sectionOf(html, '未读公告')).toContain('aus-an-card-unread');
    expect(sectionOf(html, '已读公告')).not.toContain('aus-an-card-unread');
    expect(html).toContain('2 条 · 1 条未读');
  });

  it('全部已读时计数不出现未读字样', () => {
    const html = announcementCardHTML([item()], { seenIds: ['2026-11-22-wallet'], now: NOW });
    expect(html).toContain('1 条');
    expect(html).not.toContain('条未读');
  });

  it('收起态写 display:none 且 aria-expanded=false', () => {
    const html = announcementCardHTML([item()], { open: false, now: NOW });
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('style="display:none;"');
  });

  it('链接只在有地址时出现，标题与正文都做转义', () => {
    const html = announcementCardHTML([
      item({ title: '<b>注意</b>', body: ['a & b'], linkUrl: 'https://example.com/a', linkText: '看说明' }),
    ], { seenIds: ['2026-11-22-wallet'], now: NOW });
    expect(html).toContain('&lt;b&gt;注意&lt;/b&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain('看说明');
    const plain = announcementCardHTML([item()], { seenIds: ['2026-11-22-wallet'], now: NOW });
    expect(plain).not.toContain('aus-an-link');
  });

  it('多条公告按日期倒序排列', () => {
    const html = announcementCardHTML([
      item({ id: 'old', title: '旧公告', date: '2026-11-01' }),
      item({ id: 'new', title: '新公告', date: '2026-11-20' }),
    ], { now: NOW });
    expect(html.indexOf('新公告')).toBeLessThan(html.indexOf('旧公告'));
  });
});
