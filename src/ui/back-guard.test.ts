import { describe, expect, it } from 'vitest';
import {
  AUS_BACK_FLAG,
  BACK_GUARD_DEPTH,
  nextGuardState,
  readGuardDepth,
  stripGuardState,
} from './back-guard';

describe('返回键哨兵深度', () => {
  it('不是对象或没有标记一律当 0（表示站在酒馆自己那条记录上）', () => {
    expect(readGuardDepth(null)).toBe(0);
    expect(readGuardDepth(undefined)).toBe(0);
    expect(readGuardDepth('x')).toBe(0);
    expect(readGuardDepth({})).toBe(0);
    expect(readGuardDepth({ tavern: 'home' })).toBe(0);
  });

  it('读取我们压入的深度，非法值被夹回 0，超出上限被夹到 1 条', () => {
    expect(readGuardDepth({ [AUS_BACK_FLAG]: 1 })).toBe(1);
    expect(readGuardDepth({ [AUS_BACK_FLAG]: '1' })).toBe(1);
    expect(readGuardDepth({ [AUS_BACK_FLAG]: 0 })).toBe(0);
    expect(readGuardDepth({ [AUS_BACK_FLAG]: -3 })).toBe(0);
    expect(readGuardDepth({ [AUS_BACK_FLAG]: Number.NaN })).toBe(0);
    // 旧版本压过 3 / 6 条，残留标记按「一条哨兵」处理
    expect(readGuardDepth({ [AUS_BACK_FLAG]: 3 })).toBe(BACK_GUARD_DEPTH);
    expect(readGuardDepth({ [AUS_BACK_FLAG]: 99 })).toBe(BACK_GUARD_DEPTH);
  });

  it('哨兵只有一条：一次系统返回刚好被它接住', () => {
    expect(BACK_GUARD_DEPTH).toBe(1);
  });

  it('生成哨兵 state 时保留宿主原有字段，且不改动传入对象', () => {
    const base = { tavern: 'home', nested: { a: 1 } };
    const next = nextGuardState(base, 1);
    expect(next.tavern).toBe('home');
    expect(next[AUS_BACK_FLAG]).toBe(1);
    expect(AUS_BACK_FLAG in base).toBe(false);
    expect(nextGuardState(null, 1)).toEqual({ [AUS_BACK_FLAG]: 1 });
  });

  it('深度必须落在 1..BACK_GUARD_DEPTH 之间', () => {
    expect(nextGuardState({}, 0)[AUS_BACK_FLAG]).toBe(1);
    expect(nextGuardState({}, -5)[AUS_BACK_FLAG]).toBe(1);
    expect(nextGuardState({}, 99)[AUS_BACK_FLAG]).toBe(BACK_GUARD_DEPTH);
  });
});

describe('退出接管时摘下哨兵标记', () => {
  it('有标记就复制一份去掉标记，原对象保持不变', () => {
    const st = { tavern: 'home', [AUS_BACK_FLAG]: 1 };
    const stripped = stripGuardState(st);
    expect(stripped).toEqual({ tavern: 'home' });
    expect(st[AUS_BACK_FLAG]).toBe(1);
  });

  it('没有标记或不是对象返回 null', () => {
    expect(stripGuardState({ tavern: 'home' })).toBeNull();
    expect(stripGuardState(null)).toBeNull();
    expect(stripGuardState(7)).toBeNull();
  });
});
