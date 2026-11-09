import { describe, expect, it } from 'vitest';
import {
  SNAPSHOT_SEALED_AFTER_EVENT_ABI,
  createFrozenSnapshotProbe,
  hasFrozenRunSnapshot,
  needsSnapshotProbe,
} from './snapshot-probe';

describe('Agent 快照封口时机判定', () => {
  it('ABI 常量对齐 TauriTavern 2.4.0', () => {
    expect(SNAPSHOT_SEALED_AFTER_EVENT_ABI).toBe(2);
  });

  it('只认 generate_data 自身属性', () => {
    expect(hasFrozenRunSnapshot({ frozenRunInputSnapshot: {} })).toBe(true);
    expect(hasFrozenRunSnapshot({ frozenRunInputSnapshot: null })).toBe(true);
    expect(hasFrozenRunSnapshot({ prompt: [] })).toBe(false);
    expect(hasFrozenRunSnapshot(Object.create({ frozenRunInputSnapshot: {} }))).toBe(false);
    expect(hasFrozenRunSnapshot(null)).toBe(false);
    expect(hasFrozenRunSnapshot(undefined)).toBe(false);
    expect(hasFrozenRunSnapshot('frozenRunInputSnapshot')).toBe(false);
  });

  it('ABI 1 只走同步判定，其余一律启用探测', () => {
    expect(needsSnapshotProbe(1)).toBe(false);
    expect(needsSnapshotProbe(0)).toBe(true);
    expect(needsSnapshotProbe(2)).toBe(true);
    expect(needsSnapshotProbe(3)).toBe(true);
    expect(needsSnapshotProbe(Number.NaN)).toBe(true);
  });
});

describe('事件前后快照对比', () => {
  it('没有记住任何对象时不判定', () => {
    const probe = createFrozenSnapshotProbe();
    expect(probe.flush()).toBe(false);
    probe.remember(null);
    probe.remember('x');
    expect(probe.size()).toBe(0);
    expect(probe.flush()).toBe(false);
  });

  it('事件前没有、事件后出现快照即命中', () => {
    const probe = createFrozenSnapshotProbe();
    const data: any = { prompt: [] };
    probe.remember(data);
    expect(probe.size()).toBe(1);
    expect(probe.flush()).toBe(false);
    // 模拟 TauriTavern 2.4.0：事件返回后才封口，且是同一个对象
    probe.remember(data);
    data.frozenRunInputSnapshot = { generationType: 'normal' };
    expect(probe.flush()).toBe(true);
    expect(probe.size()).toBe(0);
  });

  it('同一次生成重复 remember 只记一条', () => {
    const probe = createFrozenSnapshotProbe();
    const data: any = { prompt: [] };
    probe.remember(data);
    probe.remember(data);
    expect(probe.size()).toBe(1);
  });

  it('始终没出现快照就当普通生成，复查后清空', () => {
    const probe = createFrozenSnapshotProbe();
    const data: any = { prompt: [] };
    probe.remember(data);
    expect(probe.flush()).toBe(false);
    expect(probe.size()).toBe(0);
  });

  it('只保留最近几次生成，旧引用被挤掉', () => {
    const probe = createFrozenSnapshotProbe(2);
    const a: any = { prompt: ['a'] };
    const b: any = { prompt: ['b'] };
    const c: any = { prompt: ['c'] };
    probe.remember(a);
    probe.remember(b);
    probe.remember(c);
    expect(probe.size()).toBe(2);
    a.frozenRunInputSnapshot = {};
    expect(probe.flush()).toBe(false);
    c.frozenRunInputSnapshot = {};
    probe.remember(c);
    expect(probe.flush()).toBe(true);
  });

  it('clear 丢弃全部待复查引用', () => {
    const probe = createFrozenSnapshotProbe();
    const data: any = { prompt: [] };
    probe.remember(data);
    probe.clear();
    expect(probe.size()).toBe(0);
    data.frozenRunInputSnapshot = {};
    expect(probe.flush()).toBe(false);
  });
});
