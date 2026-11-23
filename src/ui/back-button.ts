/**
 * 二级页「返回」按钮的唯一来源。
 *
 * 对话展示管理 / 请求日志 / 其他请求三页各有一处返回按钮，回到哪一页统一由
 * `panel.ts#returnFromChild()` 决定 —— 按钮本身不写目标页名，否则来源一变文案
 * 就说错话（例如从设置进日志、再从日志进其他请求，实际是回日志页）。
 *
 * 外观与位置统一交给 style.css 的 `.aus-back-btn`：三页同一副样子，且一律
 * `margin-left:auto` 贴工具行最右端。**不要复用** `.aus-pill` / `.aus-log-link` /
 * `.aus-chat-manage-btn`：它们都被同排其它动作按钮共用，改观感会连带改一片。
 */
import { esc } from '../utils/date';
import { icon } from './icons';

export const BACK_BUTTON_CLASS = 'aus-back-btn';

export interface BackButtonOptions {
  /** 按钮 id。各页的点击绑定按 id 查找，改名要同步改绑定 */
  id?: string;
  /** 悬停提示，默认「返回上一页」 */
  title?: string;
  /** 额外 data-* 属性，例如请求日志页的 `{ 'data-log-action': 'back' }`（委托依赖） */
  data?: Record<string, string>;
}

export function backButtonHTML(opts: BackButtonOptions = {}): string {
  const attrs: string[] = [];
  if (opts.id) attrs.push('id="' + esc(opts.id) + '"');
  attrs.push('type="button"');
  attrs.push('class="' + BACK_BUTTON_CLASS + '"');
  attrs.push('data-aus-back="1"');
  attrs.push('aria-label="返回上一页"');
  attrs.push('title="' + esc(opts.title || '返回上一页') + '"');
  for (const [key, value] of Object.entries(opts.data || {})) {
    attrs.push(esc(key) + '="' + esc(value) + '"');
  }
  return '<button ' + attrs.join(' ') + '>' + icon('chevron-left', 14) + '返回</button>';
}
