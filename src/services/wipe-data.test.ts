import { describe, it, expect, afterEach } from 'vitest';
import { wipeAllExtensionData, shouldWipeLocalKey, WIPE_LOCAL_KEYS } from './wipe-data';
import { blockPersistentWrites, saveExtensionSettings } from '../store/persistence';

/** 假 localStorage：只需 key/length/removeItem 三件套 */
function fakeStorage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

/** 假 indexedDB：success / blocked / error 三种行为 */
function fakeIdb(mode: 'ok' | 'blocked' | 'error') {
  const calls: string[] = [];
  const idb = {
    deleteDatabase(name: string) {
      calls.push(name);
      const req: any = {};
      setTimeout(() => {
        if (mode === 'ok') req.onsuccess?.();
        else if (mode === 'error') req.onerror?.();
        else req.onblocked?.();
      }, 0);
      return req;
    },
  };
  return { idb, calls };
}

const g: any = globalThis as any;
afterEach(() => {
  delete g.localStorage;
  delete g.indexedDB;
  delete g.SillyTavern;
  blockPersistentWrites(false);
});

describe('卸载清理：localStorage 键判定', () => {
  it('aus_ 前缀一律属于本扩展', () => {
    expect(shouldWipeLocalKey('aus_stats_chart_prefs_v1')).toBe(true);
    expect(shouldWipeLocalKey('aus_filter_prefs_v1')).toBe(true);
    expect(shouldWipeLocalKey('aus_cold_history')).toBe(true);
    expect(shouldWipeLocalKey('aus_back_debug_off')).toBe(true);
  });

  it('旧版 ds_ 遗留键按白名单精确命中', () => {
    for (const key of WIPE_LOCAL_KEYS) expect(shouldWipeLocalKey(key)).toBe(true);
    expect(shouldWipeLocalKey('ds_ds_peak_dot_pos')).toBe(true);
  });

  it('别的扩展或无关键一律不动', () => {
    expect(shouldWipeLocalKey('dsx_custom')).toBe(false);
    expect(shouldWipeLocalKey('other_extension_key')).toBe(false);
    expect(shouldWipeLocalKey('')).toBe(false);
    expect(shouldWipeLocalKey(null)).toBe(false);
    expect(shouldWipeLocalKey(undefined)).toBe(false);
    expect(shouldWipeLocalKey(42)).toBe(false);
  });
});

describe('卸载清理：整体清除', () => {
  it('删掉本扩展的本地键并保留无关键', async () => {
    const ls = fakeStorage({
      aus_stats_chart_prefs_v1: '{}',
      aus_wallet_filter_v1: 'all',
      ds_debug_log: '1',
      ds_ds_webdav_pass: 'x',
      other_extension_key: 'keep',
    });
    g.localStorage = ls;
    const report = await wipeAllExtensionData({ timeoutMs: 50 });
    expect(report.localKeysRemoved.sort()).toEqual([
      'aus_stats_chart_prefs_v1',
      'aus_wallet_filter_v1',
      'ds_debug_log',
      'ds_ds_webdav_pass',
    ]);
    expect(ls.dump()).toEqual({ other_extension_key: 'keep' });
  });

  it('删库成功时报告 deleted', async () => {
    const { idb, calls } = fakeIdb('ok');
    g.indexedDB = idb;
    g.localStorage = fakeStorage({});
    const report = await wipeAllExtensionData({ timeoutMs: 200 });
    expect(calls).toEqual(['api_usage_stat_db']);
    expect(report.databaseDeleted).toBe(true);
    expect(report.databaseBlocked).toBe(false);
    expect(report.errors).toEqual([]);
  });

  it('被其它标签页挡住时报告 blocked 且不抛错', async () => {
    const { idb } = fakeIdb('blocked');
    g.indexedDB = idb;
    g.localStorage = fakeStorage({});
    const report = await wipeAllExtensionData({ timeoutMs: 60 });
    expect(report.databaseDeleted).toBe(false);
    expect(report.databaseBlocked).toBe(true);
    expect(report.errors).toContain('idb-blocked');
  });

  it('清掉设置块并触发一次保存，不碰别的扩展', async () => {
    let saved = 0;
    const bag: any = { api_usage_stat: { wallets: [] }, other_ext: { a: 1 } };
    g.localStorage = fakeStorage({});
    g.SillyTavern = { getContext: () => ({ extensionSettings: bag, saveSettingsDebounced: () => { saved++; } }) };
    const report = await wipeAllExtensionData({ timeoutMs: 50 });
    expect(report.settingsCleared).toBe(true);
    expect('api_usage_stat' in bag).toBe(false);
    expect(bag.other_ext).toEqual({ a: 1 });
    expect(saved).toBe(1);
  });

  it('裸环境（无存储 API）不抛错并返回空报告', async () => {
    const report = await wipeAllExtensionData({ timeoutMs: 50 });
    expect(report.settingsCleared).toBe(false);
    expect(report.databaseDeleted).toBe(false);
    expect(report.localKeysRemoved).toEqual([]);
  });

  it('清理后写盘闸门生效，不会把设置写回去', async () => {
    const bag: any = { api_usage_stat: { keep: 1 } };
    g.SillyTavern = { getContext: () => ({ extensionSettings: bag, saveSettingsDebounced: () => {} }) };
    g.localStorage = fakeStorage({});
    await wipeAllExtensionData({ timeoutMs: 50 });
    saveExtensionSettings({ resurrected: true });
    expect('api_usage_stat' in bag).toBe(false);
  });
});
