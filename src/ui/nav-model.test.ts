import { describe, it, expect } from 'vitest';
import {
  APP_VIEWS,
  CHILD_PARENT,
  CHILD_VIEWS,
  MOBILE_TABS,
  SETTINGS_CHILD_VIEWS,
  SETTINGS_ENTRIES,
  childParentOf,
  isAppView,
  isChildView,
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

  it('钱包/使用说明/关于 归到设置 tab，对话展示管理归到概览，其余视图归自身', () => {
    expect(parentTabOf('wallet')).toBe('settings');
    expect(parentTabOf('help')).toBe('settings');
    expect(parentTabOf('about')).toBe('settings');
    // 「管理对话」页是从概览表格进来的，底栏仍高亮概览
    expect(parentTabOf('chat-manage')).toBe('overview');
    for (const view of ['overview', 'stats', 'history', 'forecast', 'settings'] as const) {
      expect(parentTabOf(view)).toBe(view);
    }
  });

  it('二级视图清单与 CHILD_PARENT 双向一致，非二级页返回 null', () => {
    expect([...CHILD_VIEWS].sort()).toEqual(Object.keys(CHILD_PARENT).sort());
    for (const view of CHILD_VIEWS) {
      const parent = childParentOf(view);
      expect(parent).not.toBeNull();
      expect(isChildView(view)).toBe(true);
      // 父级必须是根视图，不能再是二级页
      expect(parent).not.toBe(view);
      expect(isChildView(parent as any)).toBe(false);
      expect(parentTabOf(parent as any)).toBe(parent);
    }
    for (const view of ['overview', 'stats', 'history', 'forecast', 'settings'] as const) {
      expect(childParentOf(view)).toBeNull();
      expect(isChildView(view)).toBe(false);
    }
  });

  it('对话展示管理是扁平视图而非设置二级页', () => {
    expect(isSettingsChild('chat-manage')).toBe(false);
    expect(SETTINGS_CHILD_VIEWS.includes('chat-manage')).toBe(false);
    expect(APP_VIEWS.includes('chat-manage')).toBe(true);
    expect(viewTitle('chat-manage')).toBe('对话展示管理');
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

  it('resolveTabTap：对话展示管理重复点概览 tab 回到概览', () => {
    expect(resolveTabTap('overview', 'chat-manage', true)).toBe('pop-root');
  });

  it('resolveTabTap：已在根页重复点则回到顶部', () => {
    expect(resolveTabTap('settings', 'settings', false)).toBe('scroll-top');
    expect(resolveTabTap('overview', 'overview', false)).toBe('scroll-top');
  });
});
