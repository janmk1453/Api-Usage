import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CAPTURE_MAX,
  CAPTURE_STORAGE_KEY,
  clearCaptureStages,
  listCaptureStages,
  noteCaptureStage,
} from './capture-digest';

function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };
  return store;
}

/** 模拟页面重载：内存缓冲重新归零，落盘镜像还在 */
async function reloadModule() {
  vi.resetModules();
  return await import('./capture-digest');
}

describe('采集链路快照', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
    clearCaptureStages();
  });

  it('页面重载后仍能从落盘镜像读到上一轮的链路', async () => {
    noteCaptureStage('fetch-start', { at: 10, model: 'deepseek-flash', url: '/api/backends/chat-completions/generate' });
    noteCaptureStage('fetch-parse', { at: 20, model: 'deepseek-flash', usageFound: false, usageZero: true });
    noteCaptureStage('event-drop', { at: 30, reason: 'no-usage', model: 'deepseek-flash' });
    expect(store.has(CAPTURE_STORAGE_KEY)).toBe(true);

    const fresh = await reloadModule();
    const rows = fresh.listCaptureStages();
    expect(rows.map((r) => r.stage)).toEqual(['fetch-start', 'fetch-parse', 'event-drop']);
    expect(rows[2].reason).toBe('no-usage');
    expect(rows[0].model).toBe('deepseek-flash');
  });

  it('落盘里的坏数据与未知阶段被丢弃，只留白名单内的', async () => {
    store.set(CAPTURE_STORAGE_KEY, JSON.stringify([
      { at: 1, stage: 'fetch-start' },
      { at: 2, stage: 'not-a-stage' },
      null,
      { at: 3 },
      { at: 4, stage: 'turn-estimated', usage: { total_tokens: 12 } },
    ]));
    const fresh = await reloadModule();
    const rows = fresh.listCaptureStages();
    expect(rows.map((r) => r.stage)).toEqual(['fetch-start', 'turn-estimated']);
    expect(rows[1].usage).toEqual({ total_tokens: 12 });
  });

  it('超过上限只留最近的一批', async () => {
    for (let i = 0; i < CAPTURE_MAX + 5; i += 1) noteCaptureStage('fetch-start', { at: i });
    const rows = listCaptureStages();
    expect(rows).toHaveLength(CAPTURE_MAX);
    expect(rows[rows.length - 1].at).toBe(CAPTURE_MAX + 4);
    expect(rows[0].at).toBe(5);
  });

  it('清空同时删内存与落盘', () => {
    noteCaptureStage('entry-added', { at: 1 });
    clearCaptureStages();
    expect(listCaptureStages()).toHaveLength(0);
    expect(store.has(CAPTURE_STORAGE_KEY)).toBe(false);
  });
});
