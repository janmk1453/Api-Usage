import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyImportedData, normalizeImportData } from './import-export';
import { repository } from '../data/repository';

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
