/**
 * 「公告」弹窗：作者在 announcement.json 里发的公告，未读时打开面板就弹。
 *
 * 外观与「更新了什么」完全同一套外壳（.aus-cl-mask / .aus-cl，见 style.css「更新弹窗」段），
 * 只是正文换成多条公告：一次列出全部未读条目，竖排、可滚动，底部一颗「我知道了」。
 * 关闭（含点遮罩、点右上角 ×）即把本次展示的 id 全部记为已读——同一条公告不会再弹第二次。
 *
 * 与更新弹窗的先后：Panel 打开时先试更新弹窗，那一轮弹了更新就不再弹公告（公告留到下次），
 * 避免一次打开糊两个弹窗。
 */
import type { AnnouncementItem } from '../services/announcement';
import {
  fetchAnnouncements,
  markAnnouncementsRead,
  unreadAnnouncementsFor,
} from '../services/announcement';
import { APP_VERSION } from '../constants/version';
import { esc } from '../utils/date';
import { icon } from './icons';
import { formatChangelogDate } from './changelog';

const MASK_ID = 'aus-an-mask';

/** 弹窗 HTML（纯函数：只吃条目数组，不碰 DOM，测试可直接断言字符串） */
export function announcementDialogHTML(items: AnnouncementItem[], options: { now?: number } = {}): string {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  const count = list.length + ' 条未读';
  const body = list.map(item => {
    const date = item.date ? formatChangelogDate(item.date, options.now) : '';
    const link = item.linkUrl
      ? '<a class="aus-an-link" href="' + esc(item.linkUrl) + '" target="_blank" rel="noopener noreferrer">'
        + esc(item.linkText || '查看详情') + '</a>'
      : '';
    return '<section class="aus-an-item" data-level="' + esc(item.level) + '">'
      + '<div class="aus-an-item-head">'
      + '<span class="aus-an-item-title">' + esc(item.title) + '</span>'
      + (date ? '<span class="aus-an-item-date">' + esc(date) + '</span>' : '')
      + '</div>'
      + item.body.map(p => '<p class="aus-an-p">' + esc(p) + '</p>').join('')
      + link
      + '</section>';
  }).join('');
  return '<div class="aus-cl aus-an" role="dialog" aria-modal="true" aria-labelledby="aus-an-title">'
    + '<div class="aus-cl-head">'
    + '<div class="aus-cl-heading">'
    + '<span class="aus-cl-title" id="aus-an-title">公告</span>'
    + '<span class="aus-cl-version">' + esc(count) + '</span>'
    + '</div>'
    + '<button type="button" class="aus-cl-close" data-an="close" aria-label="关闭">' + icon('close', 16) + '</button>'
    + '</div>'
    + '<div class="aus-cl-body"><div class="aus-an-list">' + body + '</div></div>'
    + '<div class="aus-cl-foot">'
    + '<button type="button" class="aus-cl-btn is-primary" data-an="ok">我知道了</button>'
    + '</div>'
    + '</div>';
}

/** 打开弹窗；条目为空返回 false。关闭时把这批 id 记为已读。 */
export function openAnnouncementDialog(items: AnnouncementItem[]): boolean {
  if (typeof document === 'undefined') return false;
  const list = (Array.isArray(items) ? items : []).filter(item => item && item.id);
  if (!list.length) return false;
  const doc: Document = (window.parent as any)?.document ?? document;
  const host = (doc.getElementById('aus-panel') as HTMLElement | null) || doc.body;
  if (!host) return false;
  try { doc.getElementById(MASK_ID)?.remove(); } catch { /* 已移除 */ }

  const mask = doc.createElement('div');
  mask.id = MASK_ID;
  mask.className = 'aus-cl-mask' + (host === doc.body ? ' is-page' : '');
  mask.innerHTML = announcementDialogHTML(list);
  host.appendChild(mask);

  const close = () => {
    // 先记已读再移除：用户中途刷新也不会把同一批公告再弹一次
    try { markAnnouncementsRead(list.map(item => item.id)); } catch { /* 隐私模式：忽略 */ }
    try { mask.remove(); } catch { /* 已移除 */ }
  };
  mask.addEventListener('click', (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (target === mask) { close(); return; }
    const action = target.closest ? (target.closest('[data-an]') as HTMLElement | null)?.getAttribute('data-an') : null;
    if (action) close();
  });
  return true;
}

/**
 * 面板打开时调用：有未读公告就弹，没有就静默。
 * 先用本地缓存立刻判断（断网也能弹上次没看过的），再看要不要拉一次新的（30 分钟节流）。
 */
export async function maybeShowAnnouncementDialog(options: { force?: boolean } = {}): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const ctx = { version: APP_VERSION };
  const cached = unreadAnnouncementsFor(null, ctx);
  if (cached.length) return openAnnouncementDialog(cached);
  let fresh: AnnouncementItem[] | null = null;
  try {
    const result = await fetchAnnouncements({ manual: !!options.force });
    fresh = result.items;
  } catch { fresh = null; }
  if (!fresh) return false;
  const unread = unreadAnnouncementsFor(fresh, ctx);
  return unread.length ? openAnnouncementDialog(unread) : false;
}
