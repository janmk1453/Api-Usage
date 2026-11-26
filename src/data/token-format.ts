/**
 * Token 数字显示口径（唯一来源）
 *
 * 需求：概览 / 统计 / 历史 / 预测里的大数字 Token 可以在「完整千分位」与「K/M/B 缩写」之间切换，
 * 开关放在设置页（settings.tokenUnitCompact，默认关）。所有页面都必须走这里，禁止再写
 * `n.toLocaleString('zh-CN')` 或本地 `compactNumber` 变体，否则会出现同一屏两套单位。
 *
 * 规则（缩写态）：
 *  - |n| < TOKEN_COMPACT_MIN（一万）→ 不缩写，仍显示完整千分位：9999 → 9999
 *  - 一万起按 1000 进制缩写：12345 → 12.3K，123456 → 123K，1234567 → 1.2M，1.2e9 → 1.2B
 *  - 100 以下保留 1 位小数，100 及以上取整（宽度稳定，避免 123.5K 这种长串）
 *  - 舍入后达到 1000 个当前单位时进位到上一级：999950 → 1M，而不是 1000K
 *  - 负数保留符号（预测页「每轮增量 Δ」可能为负）；null / NaN / 非数字归 0
 *  - 单位后缀不带空格，整数不补 .0（写 2K，不写 2.0K）
 *
 * 注意：图表 Y 轴**不受开关控制**（轴宽有限，各图表仍用自己的缩写实现），
 * 开关只作用于文本块、列表、表格与 tooltip。
 */

export type TokenUnit = 'full' | 'compact';

/** 缩写起点：小于一万不缩写（用户明确要求，万以下数字本来就好读） */
export const TOKEN_COMPACT_MIN = 10_000;

const STEPS: { base: number; suffix: string }[] = [
  { base: 1e3, suffix: 'K' },
  { base: 1e6, suffix: 'M' },
  { base: 1e9, suffix: 'B' },
];

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 完整千分位：999 → 999，1234567 → 1,234,567 */
export function formatTokenFull(value: unknown): string {
  return Math.round(toNumber(value)).toLocaleString('zh-CN');
}

function roundCompact(scaled: number): number {
  // 100 以下留 1 位小数，100 及以上取整；Number(...) 顺手去掉 12.0 这种尾零
  return scaled >= 100 ? Math.round(scaled) : Number(scaled.toFixed(1));
}

/** 强制缩写：一万以下原样千分位，一万起 K / M / B */
export function formatTokenCompact(value: unknown): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  if (abs < TOKEN_COMPACT_MIN) return formatTokenFull(n);
  const sign = n < 0 ? '-' : '';
  let index = 0;
  for (let i = 0; i < STEPS.length; i += 1) {
    if (abs >= STEPS[i].base) index = i;
  }
  let rounded = roundCompact(abs / STEPS[index].base);
  // 舍入后满 1000 个当前单位就进位（999950 → 999.95K → 1000K → 1M）
  while (index < STEPS.length - 1 && rounded >= 1000) {
    index += 1;
    rounded = roundCompact(abs / STEPS[index].base);
  }
  return sign + String(rounded) + STEPS[index].suffix;
}

/** 开关感知：unit 为 compact 时缩写，否则完整千分位 */
export function formatToken(value: unknown, unit: TokenUnit = 'full'): string {
  return unit === 'compact' ? formatTokenCompact(value) : formatTokenFull(value);
}

/** 从设置里取当前口径；字段缺失 / 非布尔一律按完整数字（老用户升级后行为不变） */
export function tokenUnitOf(settings: any): TokenUnit {
  return settings && settings.tokenUnitCompact === true ? 'compact' : 'full';
}

/**
 * title 属性用的完整值：缩写态下让鼠标悬停仍能看到精确数字（缩写不可用于对账）。
 * 完整态不需要 title 时返回空串，调用方据此决定是否写属性。
 */
export function tokenTitle(value: unknown, unit: TokenUnit): string {
  return unit === 'compact' ? formatTokenFull(value) : '';
}