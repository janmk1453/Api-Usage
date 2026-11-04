import { describe, expect, it } from 'vitest';
import { normalizePolicy, shouldForceUpdate } from './update';

describe('强制更新策略解析', () => {
  it('缺字段与脏数据一律降级为「不强制」', () => {
    for (const raw of [null, undefined, {}, { force: 'yes' }, { force: 1 }, { force: false }]) {
      expect(normalizePolicy(raw as any).force).toBe(false);
    }
  });

  it('force 只认布尔 true 与字符串 true', () => {
    expect(normalizePolicy({ force: true }).force).toBe(true);
    expect(normalizePolicy({ force: 'true' }).force).toBe(true);
  });

  it('minVersion 只接受点分数字，其它一律丢弃', () => {
    expect(normalizePolicy({ minVersion: '3.2.0' }).minVersion).toBe('3.2.0');
    expect(normalizePolicy({ minVersion: 'v3.2.0' }).minVersion).toBe('3.2.0');
    expect(normalizePolicy({ minVersion: '3.2.0fix' }).minVersion).toBe('');
    expect(normalizePolicy({ minVersion: '  ' }).minVersion).toBe('');
  });

  it('reason 去空白并截断到 200 字', () => {
    expect(normalizePolicy({ reason: '  修复数据丢失  ' }).reason).toBe('修复数据丢失');
    expect(normalizePolicy({ reason: 'x'.repeat(500) }).reason.length).toBe(200);
  });
});

describe('强制更新判定', () => {
  const policy = normalizePolicy({ force: true, reason: '严重问题' });

  it('远端版本更高且策略要求强制时成立', () => {
    expect(shouldForceUpdate(policy, '3.1.9', '3.2.0')).toBe(true);
  });

  it('远端不高于本地时不强制（永不降级）', () => {
    expect(shouldForceUpdate(policy, '3.2.0', '3.2.0')).toBe(false);
    expect(shouldForceUpdate(policy, '3.2.0', '3.1.9')).toBe(false);
  });

  it('远端版本读不到时不强制', () => {
    expect(shouldForceUpdate(policy, '3.1.9', '')).toBe(false);
  });

  it('未达 minVersion 门槛时不强制，达到后成立', () => {
    const gated = normalizePolicy({ force: true, minVersion: '3.2.0' });
    expect(shouldForceUpdate(gated, '3.1.9', '3.1.10')).toBe(false);
    expect(shouldForceUpdate(gated, '3.1.9', '3.2.0')).toBe(true);
  });

  it('没有策略或 force=false 时一律不强制', () => {
    expect(shouldForceUpdate(null, '3.1.9', '9.9.9')).toBe(false);
    expect(shouldForceUpdate(normalizePolicy({ force: false }), '3.1.9', '9.9.9')).toBe(false);
  });
});
