import { describe, expect, it } from 'vitest';
import { CHANGELOG } from '../constants/changelog';
import {
  ABOUT_TAP_LIMIT,
  ABOUT_TAP_WINDOW_MS,
  changelogDialogHTML,
  createTapTracker,
  latestChangelogEntry,
  looksLikeExistingUser,
  shouldShowChangelog,
} from './changelog-dialog';

const latest = CHANGELOG[0];
const older = CHANGELOG[1];
const ts = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();

describe('更新弹窗：取哪一版', () => {
  it('始终取更新日志的第一条（数组按时间倒序）', () => {
    const entry = latestChangelogEntry();
    expect(entry).not.toBeNull();
    expect(entry!.version).toBe(latest.version);
  });
});

describe('更新弹窗：什么时候弹', () => {
  it('没有条目 / 没有当前版本号时不弹', () => {
    expect(shouldShowChangelog('', '3.2.3', false, true)).toBe(false);
    expect(shouldShowChangelog('', '', true, true)).toBe(false);
  });

  it('已读版本与当前版本不同才弹（看过旧版本 = 刚升级）', () => {
    expect(shouldShowChangelog('3.2.2', '3.2.3', true, true)).toBe(true);
    expect(shouldShowChangelog('3.2.3', '3.2.3', true, true)).toBe(false);
  });

  it('没有已读记录时：老用户补弹一次，全新安装不弹', () => {
    expect(shouldShowChangelog('', '3.2.3', true, true)).toBe(true);
    expect(shouldShowChangelog('', '3.2.3', true, false)).toBe(false);
  });

  it('老用户判定只看本扩展写过的键（aus_* / ds_*），不看宿主键', () => {
    expect(looksLikeExistingUser(['aus_stats_chart_prefs_v1'])).toBe(true);
    expect(looksLikeExistingUser(['ds_settings'])).toBe(true);
    expect(looksLikeExistingUser(['extensionSettings', 'SillyTavern'])).toBe(false);
    expect(looksLikeExistingUser([])).toBe(false);
    expect(looksLikeExistingUser(null as any)).toBe(false);
  });
});

describe('更新弹窗：连点十次（开发者入口）', () => {
  it('窗口内点满 10 次触发一次，之后重新计数', () => {
    const tap = createTapTracker();
    const t0 = 1_000_000;
    for (let i = 1; i < ABOUT_TAP_LIMIT; i += 1) {
      expect(tap(t0 + i * 100)).toBe(false);
    }
    expect(tap(t0 + ABOUT_TAP_LIMIT * 100)).toBe(true);
    expect(tap(t0 + (ABOUT_TAP_LIMIT + 1) * 100)).toBe(false);
  });

  it('超过窗口期重新计数，连点中断不会误触发', () => {
    const tap = createTapTracker();
    const t0 = 2_000_000;
    for (let i = 1; i < ABOUT_TAP_LIMIT; i += 1) {
      expect(tap(t0 + i * 100)).toBe(false);
    }
    // 中间停顿超过窗口，计数清零，第 10 下不再触发
    expect(tap(t0 + ABOUT_TAP_LIMIT * 100 + ABOUT_TAP_WINDOW_MS + 1)).toBe(false);
    expect(tap(t0 + ABOUT_TAP_LIMIT * 100 + ABOUT_TAP_WINDOW_MS + 2)).toBe(false);
  });
});

describe('更新弹窗：内容与关于页同源', () => {
  it('渲染最新一版的版本号、日期与全部条目，不夹带更早版本', () => {
    const html = changelogDialogHTML(latest, { currentVersion: '3.2.3', now: ts(2026, 11, 18) });
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(latest.version);
    expect(html).toContain('11/18 更新');
    for (const section of latest.sections) {
      for (const item of section.items) expect(html).toContain(item);
    }
    expect(html).not.toContain(older.version);
    expect(html).toContain('data-cl="ok"');
    expect(html).toContain('data-cl="close"');
  });

  it('给跳转回调时才出「查看全部更新」', () => {
    expect(changelogDialogHTML(latest, { showAll: true })).toContain('data-cl="all"');
    expect(changelogDialogHTML(latest, { showAll: false })).not.toContain('data-cl="all"');
  });
});
