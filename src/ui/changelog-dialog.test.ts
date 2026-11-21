import { describe, expect, it } from 'vitest';
import { CHANGELOG } from '../constants/changelog';
import {
  ABOUT_TAP_LIMIT,
  ABOUT_TAP_WINDOW_MS,
  changelogDialogHTML,
  changelogEntryForBuild,
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

describe('更新弹窗：按构建号取条目', () => {
  it('只认 buildNo 与当前构建号完全相等的那一条', () => {
    const buildNo = latest.buildNo;
    expect(buildNo).toBeTypeOf('number');
    expect(changelogEntryForBuild(buildNo!)!.version).toBe(latest.version);
    expect(changelogEntryForBuild(String(buildNo))!.version).toBe(latest.version);
  });

  it('没有对应构建号（还没写这一版的日志）时返回 null，不拿上一版顶替', () => {
    expect(changelogEntryForBuild('')).toBeNull();
    expect(changelogEntryForBuild(0)).toBeNull();
    expect(changelogEntryForBuild(987654)).toBeNull();
    expect(changelogEntryForBuild(older.buildNo ?? -1) === null).toBe(older.buildNo == null);
  });
});

describe('更新弹窗：什么时候弹', () => {
  it('没有条目 / 没有当前标识时不弹', () => {
    expect(shouldShowChangelog('', '3.2.3|1', false, true)).toBe(false);
    expect(shouldShowChangelog('', '', true, true)).toBe(false);
  });

  it('已读标识与当前不同才弹（看过旧版本 = 刚升级）', () => {
    expect(shouldShowChangelog('3.2.2|1', '3.2.3|1', true, true)).toBe(true);
    expect(shouldShowChangelog('3.2.3|1', '3.2.3|1', true, true)).toBe(false);
  });

  it('版本号不变、只递增构建号也会弹（重发修复版）', () => {
    expect(shouldShowChangelog('3.2.3|1', '3.2.3|2', true, true)).toBe(true);
  });

  it('没有已读记录时：老用户补弹一次，全新安装不弹', () => {
    expect(shouldShowChangelog('', '3.2.3|1', true, true)).toBe(true);
    expect(shouldShowChangelog('', '3.2.3|1', true, false)).toBe(false);
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
    const html = changelogDialogHTML(latest, { currentVersion: '3.2.3', buildNo: String(latest.buildNo ?? ''), now: ts(2026, 11, 20) });
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(latest.version);
    // 日期与构建号跟条目自身保持一致，避免每次发版都要改测试
    const [, month, day] = latest.date.split('-').map(Number);
    expect(html).toContain(`${month}/${day} 更新`);
    expect(html).toContain(`构建 ${latest.buildNo}`);
    for (const section of latest.sections) {
      for (const item of section.items) expect(html).toContain(item);
    }
    // 同版本号重发（只递增构建号）时，版本号会重复出现，改按条目文案判断没有夹带上一版；
    // 版本号可能互为前缀（r3.2.3fix 包含 r3.2.3），所以比对整段标签而不是裸字符串
    if (older.version !== latest.version) expect(html).not.toContain(`>${older.version}<`);
    const olderItem = older.sections[0]?.items[0];
    if (olderItem) expect(html).not.toContain(olderItem);
    expect(html).toContain('data-cl="ok"');
    expect(html).toContain('data-cl="close"');
  });

  it('给跳转回调时才出「查看全部更新」', () => {
    expect(changelogDialogHTML(latest, { showAll: true })).toContain('data-cl="all"');
    expect(changelogDialogHTML(latest, { showAll: false })).not.toContain('data-cl="all"');
  });
});
