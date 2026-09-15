import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendHistoryCold,
  clearHistoryCold,
  flushSaveHot,
  loadHistoryCold,
  saveHot,
} from './persistence';

type TestContext = {
  extensionSettings: Record<string, any>;
  saveSettingsDebounced: ReturnType<typeof vi.fn>;
};

let context: TestContext;

function entry(timestamp: number, total: number) {
  return {
    timestamp,
    model: 'deepseek-flash',
    total_tokens: total,
    cache_hit_tokens: 0,
    cache_miss_tokens: 0,
    completion_tokens: total,
  };
}

describe('热设置与冷历史持久化', () => {
  beforeEach(async () => {
    context = {
      extensionSettings: {},
      saveSettingsDebounced: vi.fn(),
    };
    (globalThis as any).SillyTavern = {
      getContext: () => context,
    };
    (globalThis as any).toastr = undefined;
    await clearHistoryCold();
  });

  afterEach(async () => {
    vi.useRealTimers();
    flushSaveHot();
    await clearHistoryCold();
    delete (globalThis as any).SillyTavern;
  });

  it('连续补丁会合并而不是互相覆盖', () => {
    vi.useFakeTimers();
    saveHot({ history: [entry(1, 10)] });
    saveHot({ settings: { theme: 'dark' } });
    saveHot({ customBalance: null });
    vi.advanceTimersByTime(301);

    const saved = context.extensionSettings['api_usage_stat'];
    expect(saved.history).toHaveLength(1);
    expect(saved.settings.theme).toBe('dark');
    expect(saved.customBalance).toBeNull();
  });

  it('同键补丁保持最后一次写入值', () => {
    vi.useFakeTimers();
    saveHot({ settings: { theme: 'dark' } });
    saveHot({ settings: { theme: 'light' } });
    vi.advanceTimersByTime(301);

    expect(context.extensionSettings['api_usage_stat'].settings.theme).toBe('light');
  });

  it('并发追加冷历史不会互相覆盖', async () => {
    await Promise.all([
      appendHistoryCold([entry(100, 10)]),
      appendHistoryCold([entry(200, 20)]),
    ]);

    const cold = await loadHistoryCold();
    expect(cold.map((item) => item.timestamp).sort()).toEqual([100, 200]);
  });

  it('清空冷历史后不会保留旧记录', async () => {
    await appendHistoryCold([entry(300, 30)]);
    await clearHistoryCold();
    expect(await loadHistoryCold()).toEqual([]);
  });
});
