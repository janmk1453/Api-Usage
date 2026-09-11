import { describe, expect, it } from 'vitest';
import { normalizeImportData } from './import-export';

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
});
