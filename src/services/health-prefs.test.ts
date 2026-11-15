import { describe, it, expect, beforeEach } from 'vitest';
import {
  HEALTH_BAR_ENABLED_KEY,
  HEALTH_IGNORE_KEY,
  HEALTH_IGNORE_LIMIT,
  addIgnoredHealthKeys,
  clearIgnoredHealthKeys,
  ignoredHealthCount,
  isHealthBarEnabled,
  readIgnoredHealthKeys,
  setHealthBarEnabled,
} from './health-prefs';

function memStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

beforeEach(() => {
  (globalThis as any).localStorage = memStorage();
});

describe('历史页问题提示的偏好', () => {
  it('默认开启', () => {
    expect(isHealthBarEnabled()).toBe(true);
  });

  it('关掉后不再提示，重新打开恢复', () => {
    setHealthBarEnabled(false);
    expect(isHealthBarEnabled()).toBe(false);
    expect((globalThis as any).localStorage.getItem(HEALTH_BAR_ENABLED_KEY)).toBe('0');
    setHealthBarEnabled(true);
    expect(isHealthBarEnabled()).toBe(true);
  });

  it('忽略指纹去重且读回顺序为最新在前', () => {
    addIgnoredHealthKeys(['zero-usage|a|zero'], 1000);
    addIgnoredHealthKeys(['zero-usage|b|zero'], 2000);
    addIgnoredHealthKeys(['zero-usage|a|zero'], 3000);
    expect(readIgnoredHealthKeys()).toEqual(['zero-usage|a|zero', 'zero-usage|b|zero']);
    expect(ignoredHealthCount()).toBe(2);
  });

  it('超过上限淘汰最旧的', () => {
    for (let i = 0; i < HEALTH_IGNORE_LIMIT + 5; i += 1) {
      addIgnoredHealthKeys(['k' + i], 1000 + i);
    }
    const keys = readIgnoredHealthKeys();
    expect(keys.length).toBe(HEALTH_IGNORE_LIMIT);
    expect(keys).toContain('k' + (HEALTH_IGNORE_LIMIT + 4));
    expect(keys).not.toContain('k0');
  });

  it('可以全部恢复，空键不写入', () => {
    addIgnoredHealthKeys([]);
    expect(ignoredHealthCount()).toBe(0);
    addIgnoredHealthKeys(['a|b|c']);
    clearIgnoredHealthKeys();
    expect(ignoredHealthCount()).toBe(0);
  });

  it('存储里是坏数据时按「没忽略、保持开启」处理', () => {
    (globalThis as any).localStorage.setItem(HEALTH_IGNORE_KEY, '{oops');
    expect(readIgnoredHealthKeys()).toEqual([]);
    (globalThis as any).localStorage.setItem(HEALTH_IGNORE_KEY, '{"a":1}');
    expect(readIgnoredHealthKeys()).toEqual([]);
  });
});
