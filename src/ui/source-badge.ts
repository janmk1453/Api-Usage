/**
 * 请求来源角标（纯函数，单一来源）
 *
 * 与 ui/history-badge.ts 的「记录状态」是两条正交的线，别混：
 * 状态讲这条记录准不准（中断 / 估算 / Agent），来源讲这条记录是谁打出去的（扩展 / 脚本）。
 * 因此同一条记录可以同时挂两枚角标，面板只负责把两枚都渲染出来。
 *
 * 只有认出「扩展」或「脚本」才出角标：酒馆主界面是默认情况，标出来只会变成噪音；
 * 认不出的（旧记录、浏览器插件等）一律不标，宁缺勿错。
 */

export interface SourceBadge {
  text: string;
  /** 悬浮提示：说清是怎么认出来的、认到哪一步 */
  title: string;
  background: string;
  color: string;
}

export function sourceBadgeOf(entry: any): SourceBadge | null {
  const kind = String(entry?.requestOrigin?.kind || '');
  const label = String(entry?.requestOrigin?.label || '').trim();
  if (kind === 'extension') {
    return {
      text: '扩展',
      title: label ? '由扩展「' + label + '」发起（按调用栈定位）' : '由第三方扩展发起',
      background: 'var(--ds-blue-bg)',
      color: 'var(--ds-blue)',
    };
  }
  if (kind === 'script') {
    return {
      text: '脚本',
      title: '由酒馆助手的 iframe 脚本发起：脚本跑在 srcdoc / blob 里，栈帧定位不到具体脚本文件',
      background: 'var(--ds-purple-bg)',
      color: 'var(--ds-purple)',
    };
  }
  return null;
}

/** 详情里的「请求来源」文案 */
export function originTextOf(entry: any): string {
  const kind = String(entry?.requestOrigin?.kind || '');
  const label = String(entry?.requestOrigin?.label || '').trim();
  if (kind === 'extension') return label ? '扩展 · ' + label : '扩展';
  if (kind === 'script') return '脚本 · ' + (label || 'iframe 脚本');
  if (kind === 'tavern') return '酒馆主界面';
  return '未识别';
}
