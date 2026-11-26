/**
 * 概览页「历史消耗 / 支出明细」两块卡的分项口径与 HTML 单一来源。
 *
 * 这两块原来把字号、内距、颜色全写在 overview.ts 的内联样式里：标题比别的卡更粗、
 * 金额写死人民币、两卡行数不等、合计与分项对不上也没人交代。现在统一成四层结构——
 * 合计（.ds-card-val 大字）→ 占比条 → 明细行 → 对照附注，样式全在 style.css 的
 * 「概览页：历史消耗 / 支出明细」段（.aus-ovm-*），模板里除数据驱动的 --aus-ovm-seg
 * （占比条每段占比）之外不写任何尺寸与颜色。
 */

export interface OverviewBreakdownInput {
  totalTokens: number;
  hit: number;
  miss: number;
  output: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  savings: number;
  hitRate: number;
}

/** 分项键：前三/前二是主分项，rest 是「合计 − 分项之和」的差额，只在存在时才渲染 */
export type BreakdownKey = 'hit' | 'miss' | 'output' | 'input' | 'rest';

export interface BreakdownPart {
  key: BreakdownKey;
  label: string;
  value: number;
  /** 0–100，保留一位小数 */
  percent: number;
}

export interface Breakdown {
  total: number;
  parts: BreakdownPart[];
}

/** 金额差额的判定阈值：小于半分钱视为同额（避免浮点噪声多出一行「未分项 ¥0.0000」） */
const COST_EPS = 0.0005;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percentOf(value: number, total: number): number {
  if (!(total > 0) || !(value > 0)) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/**
 * 左卡四段：命中 / 未命中 / 输出，以及合计与三段之和不符时的「未分项」。
 * 分母取 max(total_tokens, 三段之和)：旧记录或中断轮次可能只写了总计、没有分项，
 * 反过来也可能只写了分项。这样占比条与合计行永远自洽。
 */
export function tokenBreakdown(v: Partial<OverviewBreakdownInput>): Breakdown {
  const hit = Math.max(0, num(v.hit));
  const miss = Math.max(0, num(v.miss));
  const output = Math.max(0, num(v.output));
  const partsSum = hit + miss + output;
  const total = Math.max(num(v.totalTokens), partsSum);
  const parts: BreakdownPart[] = [
    { key: 'hit', label: '命中缓存', value: hit, percent: percentOf(hit, total) },
    { key: 'miss', label: '未命中缓存', value: miss, percent: percentOf(miss, total) },
    { key: 'output', label: '输出', value: output, percent: percentOf(output, total) },
  ];
  const rest = Math.max(0, Math.round((total - partsSum) * 100) / 100);
  if (rest > 0) parts.push({ key: 'rest', label: '未分项', value: rest, percent: percentOf(rest, total) });
  return { total, parts };
}

/** 右卡：输入支出 / 输出支出（金额），合计与两者不符时补「未分项」 */
export function costBreakdown(v: Partial<OverviewBreakdownInput>): Breakdown {
  const inputCost = Math.max(0, num(v.inputCost));
  const outputCost = Math.max(0, num(v.outputCost));
  const partsSum = inputCost + outputCost;
  const total = Math.max(num(v.totalCost), partsSum);
  const parts: BreakdownPart[] = [
    { key: 'input', label: '输入支出', value: inputCost, percent: percentOf(inputCost, total) },
    { key: 'output', label: '输出支出', value: outputCost, percent: percentOf(outputCost, total) },
  ];
  const rest = total - partsSum;
  if (rest > COST_EPS) {
    parts.push({ key: 'rest', label: '未分项', value: Math.round(rest * 10000) / 10000, percent: percentOf(rest, total) });
  }
  return { total, parts };
}

/** 缓存省下多少输入费用：节省 ÷（节省 + 实际输入支出），两者同币种同口径 */
export function savingSharePercent(v: Partial<OverviewBreakdownInput>): number {
  const savings = Math.max(0, num(v.savings));
  const inputCost = Math.max(0, num(v.inputCost));
  if (savings + inputCost <= 0) return 0;
  return Math.round((savings / (savings + inputCost)) * 1000) / 10;
}

export interface BreakdownText {
  /** 整数千分位（Token 数） */
  fmt: (value: number) => string;
  /** 已带币种符号与代码的金额 HTML */
  money: (value: number) => string;
}

export function percentText(percent: number): string {
  const n = num(percent);
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)) + '%';
}

function barHTML(parts: BreakdownPart[]): string {
  const segs = parts
    .map((part) => '<span class="aus-ovm-seg is-' + part.key + '" style="--aus-ovm-seg:' + part.percent + '"></span>')
    .join('');
  const label = parts.map((part) => part.label + ' ' + percentText(part.percent)).join('，');
  return '<div class="aus-ovm-bar" role="img" aria-label="' + label + '">' + segs + '</div>';
}

function rowHTML(part: BreakdownPart, valueHTML: string): string {
  return (
    '<div class="aus-ovm-row is-' + part.key + '">' +
    '<span class="aus-ovm-key"><i class="aus-ovm-dot"></i>' + part.label + '</span>' +
    '<span class="aus-ovm-num">' + valueHTML + '<small>' + percentText(part.percent) + '</small></span>' +
    '</div>'
  );
}

/** 左卡：合计 tokens 大字 + 三段占比条 + 四行明细 + 缓存命中率附注 */
export function historyBreakdownHTML(v: Partial<OverviewBreakdownInput>, text: BreakdownText): string {
  const { total, parts } = tokenBreakdown(v);
  const rows = parts.map((part) => rowHTML(part, text.fmt(part.value))).join('');
  return (
    '<div class="aus-ovm">' +
    '<div class="ds-card-title">历史消耗</div>' +
    '<div class="aus-ovm-total ds-card-val">' + text.fmt(total) + '<small>tokens</small></div>' +
    barHTML(parts) +
    '<div class="aus-ovm-rows">' + rows + '</div>' +
    '<div class="aus-ovm-foot"><span class="aus-ovm-key">缓存命中率</span>' +
    '<span class="aus-ovm-num">' + percentText(num(v.hitRate)) + '</span></div>' +
    '</div>'
  );
}

/** 右卡：合计支出大字 + 成本占比条 + 明细行 + 预计节省附注 */
export function spendBreakdownHTML(v: Partial<OverviewBreakdownInput>, text: BreakdownText): string {
  const { total, parts } = costBreakdown(v);
  const rows = parts.map((part) => rowHTML(part, text.money(part.value))).join('');
  const share = savingSharePercent(v);
  const sub = share > 0 ? '<small>省下输入 ' + percentText(share) + '</small>' : '';
  return (
    '<div class="aus-ovm">' +
    '<div class="ds-card-title">支出明细</div>' +
    '<div class="aus-ovm-total ds-card-val">' + text.money(total) + '</div>' +
    barHTML(parts) +
    '<div class="aus-ovm-rows">' + rows + '</div>' +
    '<div class="aus-ovm-foot"><span class="aus-ovm-key">预计节省</span>' +
    '<span class="aus-ovm-num is-save">' + text.money(num(v.savings)) + sub + '</span></div>' +
    '</div>'
  );
}
