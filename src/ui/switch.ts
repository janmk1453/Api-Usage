/**
 * 统一胶囊开关（.aus-switch）的标记生成器。
 *
 * 结构：<label class="aus-switch"> → 透明原生 input[type=checkbox] + 轨道 span + 滑钮 span
 * - 视觉全部在 style.css（--aus-switch-* 变量）：关闭为中性灰、开启为品牌橙，
 *   深色主题用同名变量覆盖（轨道更亮一档、橙色取提亮值），开与关一眼可辨；
 * - JS 只写 input.checked，绝不再手改滑钮 left —— 旧写法把「开启」只表现在滑钮位置上，
 *   轨道颜色开与关完全相同，浅色下轨道还和卡片底色糊成一片；
 * - input 保留原生语义（role="switch" + 键盘空格切换 + focus-visible 描边），
 *   轨道与滑钮 pointer-events:none，点击永远落在 label 上，触屏命中区由 CSS 外扩。
 */
export interface SwitchOptions {
  checked?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

function escAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function switchHTML(id: string, opts: SwitchOptions = {}): string {
  const cls = ['aus-switch', opts.className || ''].filter(Boolean).join(' ');
  const checked = opts.checked ? ' checked' : '';
  const disabled = opts.disabled ? ' disabled' : '';
  const aria = opts.ariaLabel ? ` aria-label="${escAttr(opts.ariaLabel)}"` : '';
  return (
    `<label class="${cls}">` +
    `<input type="checkbox" id="${escAttr(id)}" role="switch"${checked}${disabled}${aria} />` +
    '<span class="aus-switch-track" aria-hidden="true"></span>' +
    '<span class="aus-switch-thumb" aria-hidden="true"></span>' +
    '</label>'
  );
}
