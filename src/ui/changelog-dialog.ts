/**
 * 「更新了什么」弹窗：版本升级后第一次打开面板时，把最新一版的更新日志弹出来。
 *
 * 三条口径：
 * - 内容与关于页「更新日志」同源（src/constants/changelog.ts），弹窗只渲染**最新一版**，
 *   不重复铺整份列表；想看历史版本点「查看全部更新」跳到关于页。
 * - 只在「升级后的第一次打开面板」弹一次：已读版本记在 localStorage
 *   aus_changelog_seen_v1（不进 settings、不参与导出与同步）。没有任何已读记录时靠
 *   「本扩展是否已有使用痕迹」区分「老用户升级」（补弹一次）与「全新安装」（不弹），
 *   免得新用户第一次打开就糊一脸。
 * - 关于页标题「API用量统计」连点 10 次可手动唤出（开发者自测），这条路径不写已读版本，
 *   以免把真正的升级提示吃掉。
 *
 * 样式全部走 style.css「更新弹窗」段，条目沿用关于页的 .aus-changelog-* 类，
 * 两处观感因此完全一致；窄屏改为底部上滑卡片，与上传反馈弹窗同一套手势。
 */
import { CHANGELOG, type ChangelogEntry } from '../constants/changelog';
import { APP_VERSION } from '../constants/version';
import { esc } from '../utils/date';
import { icon } from './icons';
import { changelogSectionsHTML, formatChangelogDate } from './changelog';

/** 已读版本号（localStorage）：存的是触发弹窗时的 APP_VERSION */
export const CHANGELOG_SEEN_KEY = 'aus_changelog_seen_v1';
/** 关于页标题连点次数与统计窗口：8 秒内点满 10 次算一次开发者手势 */
export const ABOUT_TAP_LIMIT = 10;
export const ABOUT_TAP_WINDOW_MS = 8000;

const MASK_ID = 'aus-cl-mask';

function storage(): Storage | null {
  try {
    const store = (globalThis as any).localStorage;
    if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return null;
    store.getItem(CHANGELOG_SEEN_KEY);
    return store as Storage;
  } catch {
    return null;
  }
}

export function readSeenVersion(): string {
  const store = storage();
  if (!store) return '';
  try { return String(store.getItem(CHANGELOG_SEEN_KEY) || '').trim(); } catch { return ''; }
}

export function writeSeenVersion(version: string): void {
  const store = storage();
  if (!store) return;
  try { store.setItem(CHANGELOG_SEEN_KEY, String(version || '')); } catch { /* 隐私模式：忽略 */ }
}

/** 最新一版（数组按时间倒序，CHANGELOG[0] 即当前版本应展示的内容） */
export function latestChangelogEntry(): ChangelogEntry | null {
  const first = Array.isArray(CHANGELOG) ? CHANGELOG[0] : null;
  return first && String(first.version || '').trim() ? first : null;
}

/** 老用户判定：localStorage 里已有本扩展写过的键（aus_* 偏好、ds_* 旧键）即视为用过 */
export function looksLikeExistingUser(keys: string[]): boolean {
  if (!Array.isArray(keys)) return false;
  for (const key of keys) {
    const k = String(key || '');
    if (k.indexOf('aus_') === 0 || k.indexOf('ds_') === 0) return true;
  }
  return false;
}

/**
 * 是否弹窗的纯判定（便于测试）：
 * - 没有条目或没有当前版本号 → 不弹；
 * - 有已读记录：与当前版本不同才弹（看过旧版本 = 刚升级；看过当前版本 = 已弹过）；
 * - 没有已读记录：老用户补弹一次，全新安装不弹。
 */
export function shouldShowChangelog(seen: string, appVersion: string, hasEntry: boolean, looksLikeUpgrade: boolean): boolean {
  if (!hasEntry) return false;
  const current = String(appVersion || '').trim();
  if (!current) return false;
  const last = String(seen || '').trim();
  if (last) return last !== current;
  return !!looksLikeUpgrade;
}

/** 连点计数器：窗口内点满 limit 次返回 true 并清零（纯函数，便于测试） */
export function createTapTracker(limit: number = ABOUT_TAP_LIMIT, windowMs: number = ABOUT_TAP_WINDOW_MS) {
  let count = 0;
  let startedAt = 0;
  return (now: number = Date.now()): boolean => {
    const t = Number(now) || 0;
    if (!count || t - startedAt > windowMs) { count = 0; startedAt = t; }
    count += 1;
    if (count >= limit) { count = 0; startedAt = 0; return true; }
    return false;
  };
}

export interface ChangelogDialogHTMLOptions {
  /** 当前扩展版本号，只用于「当前版本 x.y.z」那行小字 */
  currentVersion?: string;
  /** 是否给「查看全部更新」按钮（没有跳转回调时不出） */
  showAll?: boolean;
  /** 时间基准（测试用） */
  now?: number;
}

/** 弹窗 HTML（纯函数：只吃 ChangelogEntry，不碰 DOM，测试可直接断言字符串） */
export function changelogDialogHTML(entry: ChangelogEntry, options: ChangelogDialogHTMLOptions = {}): string {
  if (!entry) return '';
  const dateText = formatChangelogDate(entry.date, options.now);
  const current = String(options.currentVersion || '').trim();
  const meta = [
    dateText ? esc(dateText) + ' 更新' : '',
    current ? '当前版本 ' + esc(current) : '',
  ].filter(Boolean).join(' · ');
  return '<div class="aus-cl" role="dialog" aria-modal="true" aria-labelledby="aus-cl-title">'
    + '<div class="aus-cl-head">'
    + '<div class="aus-cl-heading">'
    + '<span class="aus-cl-title" id="aus-cl-title">更新了什么</span>'
    + '<span class="aus-cl-version">' + esc(entry.version) + '</span>'
    + '</div>'
    + '<button type="button" class="aus-cl-close" data-cl="close" aria-label="关闭">' + icon('close', 16) + '</button>'
    + '</div>'
    + '<div class="aus-cl-body">'
    + (meta ? '<div class="aus-cl-meta">' + meta + '</div>' : '')
    + '<div class="aus-cl-sections">' + changelogSectionsHTML(entry) + '</div>'
    + '</div>'
    + '<div class="aus-cl-foot">'
    + (options.showAll ? '<button type="button" class="aus-cl-btn" data-cl="all">查看全部更新</button>' : '')
    + '<button type="button" class="aus-cl-btn is-primary" data-cl="ok">知道了</button>'
    + '</div>'
    + '</div>';
}

export interface OpenChangelogOptions {
  /** 指定条目，默认最新一版 */
  entry?: ChangelogEntry | null;
  /** 当前版本号，默认构建期注入的 APP_VERSION */
  currentVersion?: string;
  /** 点「查看全部更新」后在关闭弹窗的同时跳到关于页 */
  onOpenAll?: (() => void) | null;
  /** 打开即写已读版本（默认 true）；开发者手势传 false */
  markSeen?: boolean;
}

/** 打开弹窗；返回是否真的打开了（没有可展示的条目时返回 false） */
export function openChangelogDialog(options: OpenChangelogOptions = {}): boolean {
  if (typeof document === 'undefined') return false;
  const doc: Document = (window.parent as any)?.document ?? document;
  const entry = options.entry || latestChangelogEntry();
  if (!entry) return false;
  const version = String(options.currentVersion || APP_VERSION || '').trim();
  const host = (doc.getElementById('aus-panel') as HTMLElement | null) || doc.body;
  if (!host) return false;
  try { doc.getElementById(MASK_ID)?.remove(); } catch { /* 已移除 */ }

  const mask = doc.createElement('div');
  mask.id = MASK_ID;
  // 挂在面板内用 absolute 覆盖整个面板；面板没建好（极少见）时退回整页 fixed
  mask.className = 'aus-cl-mask' + (host === doc.body ? ' is-page' : '');
  mask.innerHTML = changelogDialogHTML(entry, {
    currentVersion: version,
    showAll: typeof options.onOpenAll === 'function',
  });
  host.appendChild(mask);
  // 打开即记已读：用户中途刷新页面也不会反复弹同一个版本
  if (options.markSeen !== false && version) writeSeenVersion(version);

  const close = () => { try { mask.remove(); } catch { /* 已移除 */ } };
  mask.addEventListener('click', (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (target === mask) { close(); return; }
    const action = target.closest ? (target.closest('[data-cl]') as HTMLElement | null)?.getAttribute('data-cl') : null;
    if (!action) return;
    if (action === 'all') {
      close();
      try { options.onOpenAll?.(); } catch { /* 跳转失败不影响关闭 */ }
      return;
    }
    close();
  });
  return true;
}

/**
 * 面板打开时调用：只有「升级后的第一次」才弹。
 * 已读版本与「有没有使用痕迹」都由 localStorage 判定，不读 settings。
 */
export function maybeShowChangelogDialog(options: { onOpenAll?: (() => void) | null } = {}): boolean {
  const entry = latestChangelogEntry();
  const seen = readSeenVersion();
  const store = storage();
  const keys: string[] = [];
  try {
    if (store) {
      for (let i = 0; i < store.length; i += 1) keys.push(String(store.key(i) || ''));
    }
  } catch { /* 隐私模式：按全新安装处理 */ }
  if (!shouldShowChangelog(seen, APP_VERSION, !!entry, looksLikeExistingUser(keys))) return false;
  return openChangelogDialog({ entry, currentVersion: APP_VERSION, onOpenAll: options.onOpenAll, markSeen: true });
}

/** 关于页标题「API用量统计」连点十次 → 打开弹窗（开发者自测，不写已读版本） */
export function bindAboutBrandTap(doc: Document, onTrigger: () => void): void {
  const el = doc.getElementById('aus-about-brand') as HTMLElement | null;
  if (!el || el.getAttribute('data-bound') === '1') return;
  el.setAttribute('data-bound', '1');
  const tap = createTapTracker();
  el.addEventListener('click', () => {
    if (!tap(Date.now())) return;
    try { onTrigger(); } catch { /* 测试入口失败不影响页面 */ }
  });
}
