import { describe, expect, it } from 'vitest';
import {
  TOKEN_COMPACT_MIN,
  formatToken,
  formatTokenCompact,
  formatTokenFull,
  tokenTitle,
  tokenUnitOf,
} from './token-format';

describe('token-format 完整千分位', () => {
  it('整数加千分位，小数四舍五入', () => {
    expect(formatTokenFull(0)).toBe('0');
    expect(formatTokenFull(999)).toBe('999');
    expect(formatTokenFull(1234567)).toBe('1,234,567');
    expect(formatTokenFull(1234.6)).toBe('1,235');
  });

  it('空值与非数字归 0', () => {
    expect(formatTokenFull(null)).toBe('0');
    expect(formatTokenFull(undefined)).toBe('0');
    expect(formatTokenFull(Number.NaN)).toBe('0');
    expect(formatTokenFull('abc')).toBe('0');
  });
});

describe('token-format 缩写', () => {
  it('一万以下不缩写', () => {
    expect(TOKEN_COMPACT_MIN).toBe(10000);
    expect(formatTokenCompact(0)).toBe('0');
    expect(formatTokenCompact(999)).toBe('999');
    expect(formatTokenCompact(9999)).toBe('9,999');
  });

  it('一万起用 K，100 以下保留 1 位小数、以上取整', () => {
    expect(formatTokenCompact(10000)).toBe('10K');
    expect(formatTokenCompact(12345)).toBe('12.3K');
    expect(formatTokenCompact(123456)).toBe('123K');
    expect(formatTokenCompact(999499)).toBe('999K');
  });

  it('舍入后满 1000 进位到 M / B', () => {
    expect(formatTokenCompact(999950)).toBe('1M');
    expect(formatTokenCompact(999999)).toBe('1M');
    expect(formatTokenCompact(1000000)).toBe('1M');
    expect(formatTokenCompact(1234567)).toBe('1.2M');
    expect(formatTokenCompact(12345678)).toBe('12.3M');
    expect(formatTokenCompact(123456789)).toBe('123M');
    expect(formatTokenCompact(999999999)).toBe('1B');
    expect(formatTokenCompact(1234567890)).toBe('1.2B');
  });

  it('负值保留符号（预测页每轮增量可能为负）', () => {
    expect(formatTokenCompact(-12345)).toBe('-12.3K');
    expect(formatTokenCompact(-9999)).toBe('-9,999');
    expect(formatTokenCompact(-2500000)).toBe('-2.5M');
  });

  it('超过 B 的量级继续用 B 表示，不再造单位', () => {
    expect(formatTokenCompact(1e12)).toBe('1000B');
  });
});

describe('token-format 开关感知', () => {
  it('unit 决定走缩写还是完整数字', () => {
    expect(formatToken(12345, 'full')).toBe('12,345');
    expect(formatToken(12345, 'compact')).toBe('12.3K');
    expect(formatToken(12345)).toBe('12,345');
  });

  it('设置里缺字段或非布尔一律按完整数字', () => {
    expect(tokenUnitOf(undefined)).toBe('full');
    expect(tokenUnitOf({})).toBe('full');
    expect(tokenUnitOf({ tokenUnitCompact: false })).toBe('full');
    expect(tokenUnitOf({ tokenUnitCompact: 'true' })).toBe('full');
    expect(tokenUnitOf({ tokenUnitCompact: true })).toBe('compact');
  });

  it('缩写态才给 title 完整值', () => {
    expect(tokenTitle(12345, 'compact')).toBe('12,345');
    expect(tokenTitle(12345, 'full')).toBe('');
  });
});