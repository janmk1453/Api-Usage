import { describe, it, expect } from 'vitest';
import {
  APP_VIEWS,
  MOBILE_TABS,
  SETTINGS_CHILD_VIEWS,
  SETTINGS_ENTRIES,
  isAppView,
  isSettingsChild,
  parentTabOf,
  resolveTabTap,
  viewTitle,
} from './nav-model';

describe('nav-model', () => {
  it('底栏固定 5 个 tab，顺序为 概览/统计/历史/趋势/设置', () => {
    expect(MOBILE_TABS.map((t) => t.view)).toEqual([
      'overview',
      'stats',
      'history',
      'forecast',
      'settings',
    ]);
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(['概览', '统计', '历史', '趋势', '设置']);
  });

  it('设置页收进钱包/使用说明/关于三个二级入口，且都有图标与描述', () => {
    expect(SETTINGS_ENTRIES.map((e) => e.view)).toEqual(['wallet', 'help', 'about']);
    for (const entry of SETTINGS_ENTRIES) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.desc.length).toBeGreaterThan(0);
      expect(entry.icon).toBe(entry.view);
    }
  });

  it('钱包/使用说明/关于 归到设置 tab，其余视图归自身', () => {
    expect(parentTabOf('wallet')).toBe('settings');
    expect(parentTabOf('help')).toBe('settings');
    expect(parentTabOf('about')).toBe('settings');
    for (const view of ['overview', 'stats', 'history', 'forecast', 'settings'] as const) {
      expect(parentTabOf(view)).toBe(view);
    }
  });

  it('isSettingsChild 与二级视图清单一致', () => {
    expect(SETTINGS_CHILD_VIEWS.every((v) => isSettingsChild(v))).toBe(true);
    expect(isSettingsChild('settings')).toBe(false);
    expect(isSettingsChild('overview')).toBe(false);
  });

  it('每个视图都有全称标题', () => {
    for (const view of APP_VIEWS) {
      expect(viewTitle(view).length).toBeGreaterThan(0);
    }
    expect(viewTitle('wallet')).toBe('钱包');
    expect(viewTitle('forecast')).toBe('趋势预测');
  });

  it('isAppView 只认已知视图', () => {
    expect(isAppView('stats')).toBe(true);
    expect(isAppView('unknown')).toBe(false);
    expect(isAppView(null)).toBe(false);
  });

  it('resolveTabTap：换 tab 直接切页面', () => {
    expect(resolveTabTap('overview', 'stats', false)).toBe('switch');
    expect(resolveTabTap('overview', 'wallet', true)).toBe('switch');
    expect(resolveTabTap('settings', 'history', false)).toBe('switch');
  });

  it('resolveTabTap：二级页重复点当前 tab 回到父级根页', () => {
    expect(resolveTabTap('settings', 'wallet', true)).toBe('pop-root');
    expect(resolveTabTap('settings', 'help', true)).toBe('pop-root');
    expect(resolveTabTap('settings', 'about', true)).toBe('pop-root');
  });

  it('resolveTabTap：已在根页重复点则回到顶部', () => {
    expect(resolveTabTap('settings', 'settings', false)).toBe('scroll-top');
    expect(resolveTabTap('overview', 'overview', false)).toBe('scroll-top');
  });
});
