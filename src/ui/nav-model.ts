/**
 * 窄屏底栏导航模型（纯逻辑，无 DOM 依赖）。
 *
 * 视图树本身不改：8 个页面仍是 `#aus-main` 下的扁平同级 `data-view`。
 * 这里只负责「底栏 5 个 tab ↔ 8 个视图」的映射与点击语义：
 * - 钱包 / 使用说明 / 关于 挂在「设置」tab 下作为二级页；
 * - 二级页时底栏保持父级 tab 高亮；
 * - 重复点当前 tab：二级页回到父级根页，已在根页则回到顶部。
 */
import type { NavIconName } from './icons';

export type AppView =
  | 'overview'
  | 'stats'
  | 'history'
  | 'forecast'
  | 'wallet'
  | 'settings'
  | 'help'
  | 'about';

export const APP_VIEWS: readonly AppView[] = [
  'overview',
  'stats',
  'history',
  'forecast',
  'wallet',
  'settings',
  'help',
  'about',
];

export function isAppView(value: unknown): value is AppView {
  return typeof value === 'string' && (APP_VIEWS as readonly string[]).includes(value);
}

export interface MobileTab {
  /** 对应的根视图（点击底栏直接切到这里） */
  view: AppView;
  /** 底栏短名（页面标题仍用全称，见 viewTitle） */
  label: string;
  icon: NavIconName;
}

/** 底栏从左到右：概览、统计、历史、趋势、设置 */
export const MOBILE_TABS: readonly MobileTab[] = [
  { view: 'overview', label: '概览', icon: 'overview' },
  { view: 'stats', label: '统计', icon: 'stats' },
  { view: 'history', label: '历史', icon: 'history' },
  { view: 'forecast', label: '趋势', icon: 'forecast' },
  { view: 'settings', label: '设置', icon: 'settings' },
];

/** 收进「设置」页的二级入口（顺序即列表顺序） */
export const SETTINGS_ENTRIES: readonly { view: AppView; label: string; desc: string; icon: NavIconName }[] = [
  { view: 'wallet', label: '钱包', desc: '余额、模型价格与接入管理', icon: 'wallet' },
  { view: 'help', label: '使用说明', desc: '功能说明、隐私与免责声明', icon: 'help' },
  { view: 'about', label: '关于', desc: '版本信息与更新日志', icon: 'about' },
];

/** 挂在「设置」下的二级视图 */
export const SETTINGS_CHILD_VIEWS: readonly AppView[] = ['wallet', 'help', 'about'];

export function isSettingsChild(view: AppView): boolean {
  return SETTINGS_CHILD_VIEWS.includes(view);
}

/**
 * 视图所属的底栏 tab：二级页归到「设置」，其余自身。
 * 底栏高亮与「重复点当前 tab」判定都以它为准。
 */
export function parentTabOf(view: AppView): AppView {
  return isSettingsChild(view) ? 'settings' : view;
}

/** 页面标题（全称）：桌面顶栏与窄屏 header 共用 */
const VIEW_TITLES: Record<AppView, string> = {
  overview: '用量概览',
  stats: '用量统计',
  history: '历史记录',
  forecast: '趋势预测',
  wallet: '钱包',
  settings: '设置',
  help: '使用说明',
  about: '关于',
};

export function viewTitle(view: AppView): string {
  return VIEW_TITLES[view] || VIEW_TITLES.overview;
}

export type TabTapAction = 'switch' | 'pop-root' | 'scroll-top';

/**
 * 底栏 tab 点击语义。
 * @param target 用户点到的 tab（根视图）
 * @param current 当前视图（可能是二级页）
 * @param currentIsChildView 当前视图是否为「设置」下的二级页
 */
export function resolveTabTap(
  target: AppView,
  current: AppView,
  currentIsChildView: boolean,
): TabTapAction {
  const currentTab = parentTabOf(current);
  if (target !== currentTab) return 'switch';
  if (currentIsChildView) return 'pop-root';
  return 'scroll-top';
}
