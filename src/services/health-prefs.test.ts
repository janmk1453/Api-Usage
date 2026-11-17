import { describe, it, expect, beforeEach } from 'vitest';
import {
  HEALTH_BAR_ENABLED_KEY,
  HEALTH_IGNORE_KEY,
  HEALTH_IGNORE_LEGACY_KEY,
  HEALTH_IGNORE_LIMIT,
  HEALTH_IGNORE_TTL_MS,
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

/** 固定时间基准：忽略记录带 7 天有效期，用例必须传同一个 now 才稳定 */
const NOW = 1_800_000_000_000;

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
    addIgnoredHealthKeys(['zero-usage|a|zero'], NOW);
    addIgnoredHealthKeys(['zero-usage|b|zero'], NOW + 1000);
    addIgnoredHealthKeys(['zero-usage|a|zero'], NOW + 2000);
    expect(readIgnoredHealthKeys(NOW + 3000)).toEqual(['zero-usage|a|zero', 'zero-usage|b|zero']);
    expect(ignoredHealthCount(NOW + 3000)).toBe(2);
  });

  it('超过上限淘汰最旧的', () => {
    for (let i = 0; i < HEALTH_IGNORE_LIMIT + 5; i += 1) {
      addIgnoredHealthKeys(['k' + i], NOW + i);
    }
    const keys = readIgnoredHealthKeys(NOW + 10_000);
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

  it('忽略记录 7 天后自动失效，避免永久静音', () => {
    addIgnoredHealthKeys(['plugin-error|a1b2c3d4|x'], NOW);
    expect(readIgnoredHealthKeys(NOW + HEALTH_IGNORE_TTL_MS - 1)).toHaveLength(1);
    expect(readIgnoredHealthKeys(NOW + HEALTH_IGNORE_TTL_MS)).toHaveLength(0);
  });

  it('v1 旧指纹里无归因的 plugin-error||console 在迁移时丢弃', () => {
    const legacy = [
      { key: "plugin-error||console", at: NOW - 1000 },
      { key: "zero-usage|deepseek-flash|zero", at: NOW - 2000 },
    ];
    (globalThis as any).localStorage.setItem(HEALTH_IGNORE_LEGACY_KEY, JSON.stringify(legacy));
    expect(readIgnoredHealthKeys(NOW)).toEqual(["zero-usage|deepseek-flash|zero"]);
    // 迁移完成后旧键被清掉，v2 结构里已是对象数组
    expect((globalThis as any).localStorage.getItem(HEALTH_IGNORE_LEGACY_KEY)).toBe(null);
    const v2 = JSON.parse((globalThis as any).localStorage.getItem(HEALTH_IGNORE_KEY));
    expect(Array.isArray(v2)).toBe(true);
    expect(v2[0].key).toBe("zero-usage|deepseek-flash|zero");
    expect(v2[0].expiresAt).toBe(NOW - 2000 + HEALTH_IGNORE_TTL_MS);
  });
});
