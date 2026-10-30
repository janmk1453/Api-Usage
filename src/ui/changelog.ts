import { CHANGELOG, getRecentChangelog } from '../constants/changelog';
import type { ChangelogEntry, ChangelogSection, ChangelogSectionKind } from '../constants/changelog';
import { esc } from '../utils/date';
import { icon } from './icons';

/** 分类样式：新增=绿、改进=蓝、修复=橙，与全站语义色一致 */
const KIND_STYLE: Record<ChangelogSectionKind, { label: string; color: string; bg: string }> = {
  feature: { label: '新增', color: 'var(--ds-green)', bg: 'var(--ds-green-bg)' },
  improve: { label: '改进', color: 'var(--ds-blue, #2563EB)', bg: 'var(--ds-blue-bg, rgba(37,99,235,0.12))' },
  fix: { label: '修复', color: 'var(--ds-orange)', bg: 'rgba(255,106,0,0.12)' },
};

/** 更新日期展示：同年只显示 M/D，跨年补上年份；非法格式原样返回 */
export function formatChangelogDate(date: string, now: number = Date.now()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
  if (!m) return String(date || '');
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const nowYear = new Date(now).getFullYear();
  return year === nowYear ? `${month}/${day}` : `${year}/${month}/${day}`;
}

function sectionHtml(section: ChangelogSection): string {
  const style = KIND_STYLE[section.kind] || KIND_STYLE.feature;
  const items = section.items
    .map((text) => '<div class="aus-changelog-item">'
      + `<span class="aus-changelog-dot" style="background:${style.color};"></span>`
      + `<span>${esc(text)}</span></div>`)
    .join('');
  return '<div class="aus-changelog-section">'
    + `<span class="aus-changelog-kind" style="color:${style.color};background:${style.bg};">${style.label}</span>`
    + `<div class="aus-changelog-items">${items}</div>`
    + '</div>';
}

function entryHtml(entry: ChangelogEntry, open: boolean, isLatest: boolean): string {
  const dateText = formatChangelogDate(entry.date);
  const meta = [dateText ? `${esc(dateText)} 更新` : '']
    .concat(isLatest ? ['<span class="aus-changelog-latest">最新</span>'] : [])
    .filter(Boolean)
    .join('');
  const sections = entry.sections.filter((s) => s && s.items && s.items.length).map(sectionHtml).join('');
  return '<div class="aus-changelog-entry" data-changelog-entry data-open="' + (open ? '1' : '0') + '">'
    + `<button type="button" class="aus-changelog-head" data-changelog-toggle aria-expanded="${open ? 'true' : 'false'}">`
    + `<span class="aus-changelog-version">${esc(entry.version)}</span>`
    + `<span class="aus-changelog-meta">${meta}</span>`
    + `<span class="aus-changelog-caret">${icon(open ? 'chevron-up' : 'chevron-down', 16)}</span>`
    + '</button>'
    + `<div class="aus-changelog-body"${open ? '' : ' style="display:none;"'}>${sections}</div>`
    + '</div>';
}

/**
 * 关于页底部的「更新日志」块：默认只展开最新版本，其余版本点击表头展开/收起。
 * 数据全部来自 constants/changelog.ts，这里只负责渲染与交互，不写死任何版本内容。
 */
export function renderChangelogCard(): string {
  const entries = getRecentChangelog();
  if (!entries.length) return '';
  const total = CHANGELOG.length;
  const countText = total > entries.length
    ? `共 ${total} 个版本 · 显示最近 ${entries.length} 个`
    : `共 ${total} 个版本`;
  const list = entries.map((e, i) => entryHtml(e, i === 0, i === 0)).join('');
  return '<div class="ds-card" id="aus-changelog">'
    + '<div class="aus-changelog-header">'
    + '<span class="aus-changelog-title">更新日志</span>'
    + `<span class="aus-changelog-count">${esc(countText)}</span>`
    + '</div>'
    + `<div class="aus-changelog-list">${list}</div>`
    + '<div class="aus-changelog-footer">更新日志由作者手动维护，更早的版本请看仓库提交记录：'
    + '<a href="https://github.com/janmk1453/Api-Usage/commits/main" target="_blank" rel="noreferrer">janmk1453/Api-Usage</a></div>'
    + '</div>';
}

/** 绑定展开/收起（事件委托，只绑一次；表头是原生 button，键盘回车/空格同样可用） */
export function bindChangelog(doc: Document): void {
  const root = doc.getElementById('aus-changelog') as HTMLElement | null;
  if (!root || root.getAttribute('data-bound') === '1') return;
  root.setAttribute('data-bound', '1');
  root.addEventListener('click', (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    const head = target && target.closest ? (target.closest('[data-changelog-toggle]') as HTMLElement | null) : null;
    if (!head || !root.contains(head)) return;
    const entry = head.closest('[data-changelog-entry]') as HTMLElement | null;
    const body = entry ? (entry.querySelector('.aus-changelog-body') as HTMLElement | null) : null;
    if (!entry || !body) return;
    const open = head.getAttribute('aria-expanded') === 'true';
    head.setAttribute('aria-expanded', open ? 'false' : 'true');
    entry.setAttribute('data-open', open ? '0' : '1');
    body.style.display = open ? 'none' : 'grid';
    const caret = head.querySelector('.aus-changelog-caret') as HTMLElement | null;
    if (caret) caret.innerHTML = icon(open ? 'chevron-down' : 'chevron-up', 16);
  });
}
