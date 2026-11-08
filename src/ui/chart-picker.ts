import { icon } from './icons';

/**
 * 统计页图表卡片的统一骨架（标题 + 右上角轴设置胶囊 + 下拉浮层）。
 *
 * 单一来源：自定义图表、6 张扩展图与 2 张模型趋势图全部由这里生成，
 * 保证胶囊尺寸、下拉浮层、开合动画、悬停反馈完全一致（改这里即全站同步）。
 *
 * 命名的两个硬约束（动了就会丢动画/丢标注）：
 *  - 胶囊按钮 id 必须含 `-btn`：pill.ts 靠它配对下拉（`-btn` → `-dropdown` / `-drop`），
 *    并给按钮打 `data-aus-pill` / `data-aus-open`，悬停叠层与箭头 180° 旋转全靠这个标；
 *  - 下拉 id 必须以 `-dropdown` 结尾或含 `-drop-`：style.css 的「胶囊下拉浮层开合过渡」
 *    按这两个 id 选择器统一给 90ms 淡出 / 140ms 展开与 @starting-style 进入态。
 */

export type ChartAxisPill = {
  /** 胶囊最左侧的方向标记：Y / X，占比图给「口径」 */
  key: string;
  /** 胶囊按钮 id（必须含 -btn 才能被 pill.ts 配对） */
  btnId: string;
  /** 胶囊右侧文案节点 id（值由各图表脚本回填） */
  labelId: string;
  /** 下拉浮层 id（以 -dropdown 结尾或含 -drop-）；dropdown 为 false 时忽略 */
  dropId: string;
  /** 初始文案 */
  label: string;
  /** 是否带下拉浮层；纯切换胶囊（如占比的 Token/次数）传 false，不画箭头 */
  dropdown?: boolean;
};

export type ChartCardSpec = {
  /** 卡片标题 */
  title: string;
  /** 图表挂载容器 id，如 aus-chart-token */
  chartId: string;
  /** 卡片自身 id（可省略） */
  cardId?: string;
  /** 右上角设置胶囊；省略表示这张图没有可配置项 */
  pills?: ChartAxisPill[];
  /** 图表容器高度，默认 220 */
  height?: number;
};

const ESCAPE: Record<string, string> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
const escText = (value: string) => String(value).replace(/[&"<>]/g, (ch) => ESCAPE[ch] || ch);

/** 单枚轴设置胶囊；箭头只在真有下拉时出现（箭头永远是最后一个 svg，pill.ts 旋转它） */
export function chartPillHTML(pill: ChartAxisPill): string {
  const hasDrop = pill.dropdown !== false;
  return (
    `<button type="button" class="aus-chart-pill" id="${escText(pill.btnId)}" data-axis-key="${escText(pill.key)}">` +
    `<span class="aus-chart-pill-key">${escText(pill.key)}</span>` +
    `<span class="aus-chart-pill-val" id="${escText(pill.labelId)}">${escText(pill.label)}</span>` +
    (hasDrop ? icon('chevron-down', 14) : '') +
    '</button>'
  );
}

/** 下拉浮层；data-axis 决定从胶囊左端（Y）还是右端（X）展开 */
function chartDropdownHTML(pill: ChartAxisPill): string {
  const axis = pill.key === 'X' ? 'x' : 'y';
  return `<div class="aus-chart-dropdown" id="${escText(pill.dropId)}" data-axis="${axis}" style="display:none;"></div>`;
}

/** 右上角设置区：胶囊并排 + 各自的绝对定位下拉（同一个 relative 容器里，位置随胶囊走） */
export function chartAxisPickerHTML(pills: ChartAxisPill[]): string {
  const buttons = pills.map(chartPillHTML).join('');
  const drops = pills
    .filter((pill) => pill.dropdown !== false)
    .map(chartDropdownHTML)
    .join('');
  return `<div class="aus-chart-picker">${buttons}${drops}</div>`;
}

/** 统计页图表卡片：标题行 + 图表容器 */
export function chartCardHTML(spec: ChartCardSpec): string {
  const pills = spec.pills && spec.pills.length ? chartAxisPickerHTML(spec.pills) : '';
  const cardId = spec.cardId ? ` id="${escText(spec.cardId)}"` : '';
  const height = spec.height ?? 220;
  return (
    `<div class="ds-card aus-chart-card"${cardId}>` +
    '<div class="aus-chart-card-head">' +
    `<span class="aus-chart-card-title">${escText(spec.title)}</span>` +
    pills +
    '</div>' +
    `<div id="${escText(spec.chartId)}" style="height:${height}px;"></div>` +
    '</div>'
  );
}
