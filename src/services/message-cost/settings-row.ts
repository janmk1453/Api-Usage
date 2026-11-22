/**
 * 在宿主「用户设置 → 消息显示」一栏里注入 API 用量统计自己的开关。
 *
 * 为什么不写进宿主 power_user 设置：那些字段会随酒馆的设置导出、跨设备同步，
 * 我们把状态留在扩展自己的 settings 里，卸载/重装互不影响；这里只借用宿主的 checkbox 样式。
 */
import { state } from '../../store/index';
import { saveHot } from '../../store/persistence';
import { hasNativeGenerationInfo } from './render';

/** 注入行的类名，卸载时按它整体删除 */
export const SETTING_ROW_CLASS = 'aus-mes-cost-row';

type RowKey = 'messageCost' | 'messageTtft' | 'messageRate' | 'messageCache';

type RowDef = { key: RowKey; id: string; label: string; title: string };

/** 价格一项两套内核都有；另外三项 TauriTavern 内核自带，不需要重复注入 */
const ROWS: RowDef[] = [
  { key: 'messageCost', id: 'aus_message_cost_enabled', label: '消息费用', title: '在每条回复旁显示这一轮对话的费用' },
  { key: 'messageTtft', id: 'aus_message_ttft_enabled', label: '首字延迟', title: '在每条回复旁显示首字延迟' },
  { key: 'messageRate', id: 'aus_message_rate_enabled', label: '生成速度', title: '在每条回复旁显示生成速度（输出 Token ÷ 生成耗时）' },
  { key: 'messageCache', id: 'aus_message_cache_enabled', label: '缓存命中率', title: '在每条回复旁显示缓存命中率' },
];

function rowsToInstall(): RowDef[] {
  return hasNativeGenerationInfo() ? ROWS.filter(row => row.key === 'messageCost') : ROWS;
}

function anchorLabel(): HTMLLabelElement | null {
  // TauriTavern 已把三项排好，接在最后一项后面；SillyTavern 只有 token 计数，接在它后面
  const id = hasNativeGenerationInfo() ? 'messageCacheEnabled' : 'messageTokensEnabled';
  const input = document.getElementById(id) || document.getElementById('messageTokensEnabled');
  return input?.closest('label') || null;
}

export function removeMessageCostRows(): void {
  document.querySelectorAll(`.${SETTING_ROW_CLASS}`).forEach(node => node.remove());
}

/**
 * 注入开关行。onChange 在用户勾选后回调，由调用方决定何时重画消息头
 * （用回调而不是直接 import，避免 settings-row ↔ index 循环依赖）。
 */
export function installMessageCostRows(onChange: () => void): void {
  removeMessageCostRows();
  const anchor = anchorLabel();
  if (!anchor || !anchor.parentElement) return;
  let cursor: Element = anchor;
  for (const row of rowsToInstall()) {
    const label = document.createElement('label');
    label.className = `checkbox_label ${SETTING_ROW_CLASS}`;
    label.setAttribute('for', row.id);
    label.title = row.title;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = row.id;
    input.checked = !!(state.settings as any)?.[row.key];
    const small = document.createElement('small');
    small.textContent = row.label;
    label.appendChild(input);
    label.appendChild(small);
    input.addEventListener('change', () => {
      (state.settings as any)[row.key] = input.checked;
      saveHot({ settings: state.settings });
      onChange();
    });
    cursor.insertAdjacentElement('afterend', label);
    cursor = label;
  }
}

/** 宿主设置页可能晚于扩展加载才渲染，轮询几次补注入 */
export function syncMessageCostRows(): void {
  for (const row of rowsToInstall()) {
    const input = document.getElementById(row.id) as HTMLInputElement | null;
    if (input) input.checked = !!(state.settings as any)?.[row.key];
  }
}
