import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DB_NAME,
  appendHistoryCold,
  clearHistoryCold,
  flushSaveHot,
  getColdReadFailure,
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

  it('冷历史读坏时报错，并把原因留给 UI（不能静默）', async () => {
    await putRawCold('{"notAnArray":true}');

    await expect(loadHistoryCold()).rejects.toThrow('冷历史格式无效');

    const failure = getColdReadFailure();
    expect(failure).not.toBeNull();
    expect(failure?.message).toBe('冷历史格式无效');
    expect(typeof failure?.at).toBe('number');
  });

  it('恢复读取后自清失败标记（重试成功告警条会消失）', async () => {
    await putRawCold('{"notAnArray":true}');
    await expect(loadHistoryCold()).rejects.toThrow('冷历史格式无效');
    expect(getColdReadFailure()).not.toBeNull();

    await clearHistoryCold();
    await expect(loadHistoryCold()).resolves.toEqual([]);
    expect(getColdReadFailure()).toBeNull();
  });

  it('IndexedDB 打不开且无本地降级时同样留下失败原因', async () => {
    vi.resetModules();
    const originalIndexedDB = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = { open: () => { throw new Error('access denied'); } };
    try {
      const mod = await import('./persistence');
      await expect(mod.loadHistoryCold()).rejects.toThrow('access denied');
      expect(mod.getColdReadFailure()?.message).toBe('access denied');
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });
});

/** 直接往 IndexedDB 的 kv 里写一份原文，用来制造「读得出来但内容坏了」的现场 */
function putRawCold(value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['kv'], 'readwrite');
      tx.objectStore('kv').put(value, 'cold_history');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });
}
