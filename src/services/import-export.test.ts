import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyImportedData, normalizeImportData } from './import-export';
import { repository } from '../data/repository';
import { state } from '../store/index';
import { defaultSettings } from '../types/settings';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('钱包导入兼容', () => {
  it('保持 v1 格式并读取可选钱包数据', () => {
    const result = normalizeImportData({
      format: 'deepseek-stat-export',
      version: 1,
      walletFormat: 2,
      data: {
        history: [],
        wallets: [{ id: 'wallet:test', name: '测试钱包', models: [] }],
        walletIgnored: ['wallet:ignored'],
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.data.wallets).toHaveLength(1);
    expect(result.data.walletIgnored).toEqual(['wallet:ignored']);
  });

  it('规范化时间戳、数值和模型名', () => {
    const result = normalizeImportData({
      format: 'deepseek-stat-export',
      version: 1,
      data: {
        history: [{
          timestamp: '1000',
          model: '[OR] deepseek-v4-pro',
          prompt_tokens: '30',
          completion_tokens: '-5',
          total_tokens: '25',
          __proto__: { polluted: true },
        }],
      },
    });

    const item = result.data.history[0];
    expect(item.timestamp).toBe(1000);
    expect(item.model).toBe('deepseek-v4-pro');
    expect(item.rawModel).toBe('[OR] deepseek-v4-pro');
    expect(item.prompt_tokens).toBe(30);
    expect(item.completion_tokens).toBe(0);
    expect(item).not.toHaveProperty('polluted');
  });

  it('覆盖导入会要求清空冷库', async () => {
    const replaceSpy = vi.spyOn(repository, 'replaceAll').mockResolvedValue();
    vi.spyOn(repository, 'recalcAll').mockResolvedValue();
    vi.spyOn(repository, 'rebuildAggregates').mockResolvedValue();

    await applyImportedData({ history: [] }, 'overwrite');

    expect(replaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ history: [] }),
      { clearCold: true },
    );
  });
});

describe('导出入对称与新字段', () => {
  const baseHistory = {
    timestamp: 1790000000000,
    model: 'deepseek-flash',
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120,
    cache_hit_tokens: 60,
    cache_miss_tokens: 40,
    messages: [{ role: 'user', content: '秘密' }],
    fullRequest: { model: 'x' },
    fullResponse: { huge: true },
  };

  it('raw_usage 随导入保留（详情 Raw 用量 Tab 依赖），超大对象被丢弃', () => {
    const small = normalizeImportData({ version: 1, data: { history: [{ ...baseHistory, raw_usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }] } });
    expect((small as any).data.history[0].raw_usage).toEqual({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 });

    const huge = normalizeImportData({ version: 1, data: { history: [{ ...baseHistory, raw_usage: { blob: 'x'.repeat(9000) } }] } });
    expect((huge as any).data.history[0].raw_usage).toBeUndefined();
  });

  it('隐私大字段仍然被剥离', () => {
    const res: any = normalizeImportData({ version: 1, data: { history: [baseHistory] } });
    const h = res.data.history[0];
    expect(h.messages).toBeUndefined();
    expect(h.fullRequest).toBeUndefined();
    expect(h.fullResponse).toBeUndefined();
  });

  it('total_tokens 为 0 时按 prompt+completion 校正', () => {
    const res: any = normalizeImportData({
      version: 1,
      data: { history: [{ ...baseHistory, total_tokens: 0 }] },
    });
    expect(res.data.history[0].total_tokens).toBe(120);

    const normal: any = normalizeImportData({ version: 1, data: { history: [baseHistory] } });
    expect(normal.data.history[0].total_tokens).toBe(120);
  });
});

describe('合并导入会带上设置', () => {
  it('应用文件中的设置，同时保留本机 WebDAV 配置', async () => {
    vi.spyOn(repository, 'getAllHistory').mockResolvedValue([]);
    const replaceSpy = vi.spyOn(repository, 'replaceAll').mockResolvedValue();
    vi.spyOn(repository, 'recalcAll').mockResolvedValue();
    vi.spyOn(repository, 'rebuildAggregates').mockResolvedValue();

    state.settings = { ...defaultSettings(), webdav: { url: 'https://dav.local/dav', username: 'me', path: 'p', proxy: '' } };
    const importedSettings = { ...defaultSettings(), theme: 'dark', peakDot: false, webdav: { url: '', username: '', path: '', proxy: '' } };

    await applyImportedData({ history: [], settings: importedSettings } as any, 'merge');

    const call = replaceSpy.mock.calls.find((entry) => (entry[0] as any)?.settings);
    expect(call).toBeTruthy();
    const applied: any = (call![0] as any).settings;
    expect(applied.theme).toBe('dark');
    expect(applied.peakDot).toBe(false);
    expect(applied.webdav.url).toBe('https://dav.local/dav');
  });
});
