/**
 * 窄屏底栏导航模型（纯逻辑，无 DOM 依赖）。
 *
 * 视图树本身不改：所有页面仍是 `#aus-main` 下的扁平同级 `data-view`。
 * 这里只负责「底栏 5 个 tab ↔ 各视图」的映射与点击语义：
 * - 钱包 / 使用说明 / 关于 挂在「设置」tab 下作为二级页；
 * - 对话展示管理（chat-manage，从概览「按对话统计」表格进入）挂在「概览」tab 下，
 *   桌面侧栏没有它的条目，因此桌面端高亮也归到父级（见 panel.ts#paintNavState）；
 * - 二级页时底栏保持父级 tab 高亮，顶栏显示返回箭头（回到父级根页）；
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
  | 'about'
  /** 对话展示管理：概览「按对话统计」表格的显隐设置页 */
  | 'chat-manage';

export const APP_VIEWS: readonly AppView[] = [
  'overview',
  'stats',
  'history',
  'forecast',
  'wallet',
  'settings',
  'help',
  'about',
  'chat-manage',
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

/** 所有二级视图 → 父级根视图（用于底栏高亮、返回箭头、重复点 tab 回根页） */
export const CHILD_PARENT: Readonly<Partial<Record<AppView, AppView>>> = {
  wallet: 'settings',
  help: 'settings',
  about: 'settings',
  'chat-manage': 'overview',
};

/** 二级视图清单（顺序即声明顺序） */
export const CHILD_VIEWS: readonly AppView[] = ['wallet', 'help', 'about', 'chat-manage'];

export function isSettingsChild(view: AppView): boolean {
  return SETTINGS_CHILD_VIEWS.includes(view);
}

/** 任意二级页判定（含挂在概览下的对话展示管理） */
export function isChildView(view: AppView): boolean {
  return CHILD_VIEWS.includes(view);
}

/** 二级页的父级根视图；非二级页返回 null */
export function childParentOf(view: AppView): AppView | null {
  return CHILD_PARENT[view] ?? null;
}

/**
 * 视图所属的底栏 tab：二级页归到父级（设置 / 概览），其余自身。
 * 底栏高亮与「重复点当前 tab」判定都以它为准。
 */
export function parentTabOf(view: AppView): AppView {
  return CHILD_PARENT[view] ?? view;
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
  'chat-manage': '对话展示管理',
};

export function viewTitle(view: AppView): string {
  return VIEW_TITLES[view] || VIEW_TITLES.overview;
}

/* ── 面板内浏览栈（安卓返回键逐页回退用，纯逻辑） ────────────────────── */

/** 栈深上限：面板只有 9 个视图，留一点余量足够，避免长会话无限增长 */
export const VIEW_TRAIL_MAX = 24;

/** 主动切页时压入上一页；与目标页相同则不入栈 */
export function pushViewTrail(
  trail: AppView[],
  prev: AppView,
  next: AppView,
  max: number = VIEW_TRAIL_MAX,
): void {
  if (prev === next) return;
  trail.push(prev);
  if (max > 0 && trail.length > max) trail.splice(0, trail.length - max);
}

/** 弹出一页可回退的上次视图；返回 null 表示已经回到底，可交给上层关面板 */
export function popViewTrail(trail: AppView[], current: AppView): AppView | null {
  while (trail.length) {
    const prev = trail.pop() as AppView;
    if (prev !== current) return prev;
  }
  return null;
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
