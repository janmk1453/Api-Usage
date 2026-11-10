import { afterEach, describe, expect, it } from 'vitest';
import { getHostAbiVersion } from './tt-agent-api';

const g: any = globalThis;

describe('宿主 ABI 版本读取', () => {
  afterEach(() => {
    delete g.__TAURITAVERN__;
  });

  it('没有宿主门面时返回 0', () => {
    delete g.__TAURITAVERN__;
    expect(getHostAbiVersion()).toBe(0);
  });

  it('读出 TauriTavern 2.3.0 / 2.4.0 的 ABI', () => {
    g.__TAURITAVERN__ = { abiVersion: 1 };
    expect(getHostAbiVersion()).toBe(1);
    g.__TAURITAVERN__ = { abiVersion: 2 };
    expect(getHostAbiVersion()).toBe(2);
  });

  it('字符串数字也认，缺字段或非法值一律 0', () => {
    g.__TAURITAVERN__ = { abiVersion: '3' };
    expect(getHostAbiVersion()).toBe(3);
    g.__TAURITAVERN__ = {};
    expect(getHostAbiVersion()).toBe(0);
    g.__TAURITAVERN__ = { abiVersion: 0 };
    expect(getHostAbiVersion()).toBe(0);
    g.__TAURITAVERN__ = { abiVersion: -1 };
    expect(getHostAbiVersion()).toBe(0);
    g.__TAURITAVERN__ = { abiVersion: 'abc' };
    expect(getHostAbiVersion()).toBe(0);
  });
});
