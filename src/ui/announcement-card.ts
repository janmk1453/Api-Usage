/**
 * 关于页的「公告」块：把当前版本能收到的公告都摆出来，可收起展开。
 *
 * 与「公告」弹窗（ui/announcement-dialog.ts）的分工：弹窗只送未读、关掉即记已读，是「送达」；
 * 这块是「信箱」，把所有可用公告（含已读）都留在页面上，未读的挂一枚小标。
 * 所以这里**绝不写已读**——已读只由弹窗关闭时 markAnnouncementsRead 决定，否则用户还没看就把未读吃掉了。
 *
 * 数据：readCachedAnnouncements() 经 isAnnouncementActive 过滤（版本区间 + until）+ sortAnnouncements 排序。
 * 进入关于页先用缓存画一次（断网也有内容），再强制拉一次（fetchAnnouncements({ manual: true })，
 * 跳过节流——每次进关于页都要看到最新公告），拿到新列表后重画。
 * 折叠状态只在本次会话内记住（模块级变量、不落盘），与设置页 WebDAV 卡的「每次都从默认态开始」一致。
 */
import type { AnnouncementItem } from '../services/announcement';
import {
  fetchAnnouncements,
  isAnnouncementActive,
  readCachedAnnouncements,
  readSeenAnnouncementIds,
  sortAnnouncements,
} from '../services/announcement';
import { APP_VERSION } from '../constants/version';
import { esc } from '../utils/date';
import { icon } from './icons';
import { formatChangelogDate } from './changelog';

export const ANNOUNCEMENT_CARD_ID = 'aus-announcements';
const BODY_ID = 'aus-announcements-body';

/** 折叠状态：本次会话内记住，不落盘（重开面板即回到展开） */
let cardOpen = true;

export interface AnnouncementCardOptions {
  /** 是否展开，默认 true */
  open?: boolean;
  /** 已读 id 集合，用于给未读条目挂标 */
  seenIds?: Iterable<string>;
  /** 日期展示基准（测试注入） */
  now?: number;
}

/** 当前版本此刻能收到的公告：按版本区间 / until 过滤后倒序 */
export function activeAnnouncements(
  items: AnnouncementItem[] | null,
  ctx: { version: string; now?: number },
): AnnouncementItem[] {
  const list = Array.isArray(items) ? items : [];
  return sortAnnouncements(list.filter(item => item && isAnnouncementActive(item, ctx)));
}

function countText(total: number, unread: number): string {
  if (!total) return '暂无公告';
  return unread > 0 ? total + ' 条 · ' + unread + ' 条未读' : total + ' 条';
}

function itemHtml(item: AnnouncementItem, unread: boolean, now: number): string {
  const date = item.date ? formatChangelogDate(item.date, now) : '';
  const meta = (unread ? '<span class="aus-an-card-unread">未读</span>' : '')
    + (date ? '<span class="aus-an-item-date">' + esc(date) + '</span>' : '');
  const link = item.linkUrl
    ? '<a class="aus-an-link" href="' + esc(item.linkUrl) + '" target="_blank" rel="noopener noreferrer">'
      + esc(item.linkText || '查看详情') + '</a>'
    : '';
  return '<section class="aus-an-item" data-level="' + esc(item.level) + '">'
    + '<div class="aus-an-item-head">'
    + '<span class="aus-an-item-title">' + esc(item.title) + '</span>'
    + (meta ? '<span class="aus-an-item-meta">' + meta + '</span>' : '')
    + '</div>'
    + (Array.isArray(item.body) ? item.body : []).map(p => '<p class="aus-an-p">' + esc(p) + '</p>').join('')
    + link
    + '</section>';
}

/** 卡片 HTML（纯函数：只吃条目数组，不碰 DOM，测试可直接断言字符串） */
export function announcementCardHTML(
  items: AnnouncementItem[],
  options: AnnouncementCardOptions = {},
): string {
  const list = sortAnnouncements((Array.isArray(items) ? items : []).filter(Boolean));
  const open = options.open !== false;
  const now = Number(options.now) || Date.now();
  const seen = new Set<string>();
  for (const id of options.seenIds || []) seen.add(String(id));
  const unread = list.filter(item => !seen.has(item.id)).length;
  const body = list.length
    ? '<div class="aus-an-list">' + list.map(item => itemHtml(item, !seen.has(item.id), now)).join('') + '</div>'
    : '<div class="aus-an-card-empty">当前版本没有可展示的公告</div>';
  return '<div class="ds-card" id="' + ANNOUNCEMENT_CARD_ID + '">'
    + '<button type="button" class="aus-an-card-head" data-an-card-toggle aria-expanded="' + (open ? 'true' : 'false')
    + '" aria-controls="' + BODY_ID + '">'
    + '<span class="aus-an-card-title">公告</span>'
    + '<span class="aus-an-card-count">' + esc(countText(list.length, unread)) + '</span>'
    + '<span class="aus-an-card-caret">' + icon(open ? 'chevron-up' : 'chevron-down', 16) + '</span>'
    + '</button>'
    + '<div class="aus-an-card-body" id="' + BODY_ID + '"' + (open ? '' : ' style="display:none;"') + '>'
    + body
    + '</div>'
    + '</div>';
}

/** 本地缓存里当前可用的公告 */
function cachedItems(): AnnouncementItem[] {
  return activeAnnouncements(readCachedAnnouncements(), { version: APP_VERSION });
}

/** 用本地缓存渲染（关于页模板与刷新都走这里，页面一出现就有内容） */
export function renderAnnouncementCard(): string {
  return announcementCardHTML(cachedItems(), { open: cardOpen, seenIds: readSeenAnnouncementIds() });
}

/** 只换卡片内部，保留 #aus-announcements 本体（事件委托绑在它上面，不能整个替换） */
function paint(doc: Document, items?: AnnouncementItem[]): void {
  const root = doc.getElementById(ANNOUNCEMENT_CARD_ID) as HTMLElement | null;
  if (!root) return;
  const list = items || cachedItems();
  const html = announcementCardHTML(list, { open: cardOpen, seenIds: readSeenAnnouncementIds() });
  const holder = doc.createElement('div');
  holder.innerHTML = html;
  const fresh = holder.firstElementChild as HTMLElement | null;
  if (fresh) root.innerHTML = fresh.innerHTML;
}

function setOpen(root: HTMLElement, open: boolean): void {
  cardOpen = open;
  const head = root.querySelector('[data-an-card-toggle]') as HTMLElement | null;
  const body = root.querySelector('.aus-an-card-body') as HTMLElement | null;
  if (head) {
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    const caret = head.querySelector('.aus-an-card-caret') as HTMLElement | null;
    if (caret) caret.innerHTML = icon(open ? 'chevron-up' : 'chevron-down', 16);
  }
  if (body) body.style.display = open ? 'grid' : 'none';
}

/** 绑定收起展开（事件委托，只绑一次；表头是原生 button，键盘回车 / 空格同样可用） */
export function bindAnnouncementCard(doc: Document): void {
  const root = doc.getElementById(ANNOUNCEMENT_CARD_ID) as HTMLElement | null;
  if (!root || root.getAttribute('data-bound') === '1') return;
  root.setAttribute('data-bound', '1');
  root.addEventListener('click', (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    const head = target && target.closest ? (target.closest('[data-an-card-toggle]') as HTMLElement | null) : null;
    if (!head || !root.contains(head)) return;
    setOpen(root, head.getAttribute('aria-expanded') !== 'true');
  });
}

/**
 * 进入关于页时调用：先用缓存重画一次（顺手把上一轮拉到的写进页面），再强制拉一次远端。
 * manual 跳过节流：30 分钟内拉过也要再拉——进入关于页就该看到最新公告，节流是给常驻弹窗用的。
 * 拉取失败静默保留缓存内容——这块是展示，不该因为网络问题弹错。
 */
export async function refreshAnnouncementCard(doc?: Document): Promise<void> {
  const target: Document = doc || ((window.parent as any)?.document ?? document);
  if (!target) return;
  try { paint(target); } catch { /* 模板缺失：忽略 */ }
  let fresh: AnnouncementItem[] | null = null;
  try { fresh = (await fetchAnnouncements({ manual: true })).items; } catch { fresh = null; }
  if (!fresh) return;
  try { paint(target, activeAnnouncements(fresh, { version: APP_VERSION })); } catch { /* 面板已重建：忽略 */ }
}
