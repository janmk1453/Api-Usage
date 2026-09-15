import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { repository } from './repository';
import { state } from '../store/index';
import {
  appendHistoryCold,
  clearHistoryCold,
  flushSaveHot,
  loadHistoryCold,
} from '../store/persistence';

function entry(timestamp: number, tokens: number, cost: number): any {
  return {
    timestamp,
    model: 'deepseek-flash',
    total_tokens: tokens,
    prompt_tokens: tokens,
    cache_hit_tokens: 0,
    cache_miss_tokens: tokens,
    completion_tokens: 0,
    input_cost: cost,
    output_cost: 0,
    cost,
  };
}

describe('仓库全量处理', () => {
  beforeEach(async () => {
    const context: any = {
      extensionSettings: {},
      saveSettingsDebounced: vi.fn(),
    };
    (globalThis as any).SillyTavern = { getContext: () => context };
    state.history = [];
    state.total_tokens = 0;
    state.total_cost = 0;
    state.input_tokens = 0;
    state.output_tokens = 0;
    state.cache_hit_tokens = 0;
    state.cache_miss_tokens = 0;
    state.input_cost = 0;
    state.output_cost = 0;
    state.rounds = 0;
    await clearHistoryCold();
  });

  afterEach(async () => {
    flushSaveHot();
    await clearHistoryCold();
    delete (globalThis as any).SillyTavern;
  });

  it('覆盖替换可以清空冷库', async () => {
    await appendHistoryCold([entry(1, 10, 1)]);
    await repository.replaceAll({ history: [entry(2, 20, 2)] }, { clearCold: true });

    expect(await loadHistoryCold()).toEqual([]);
    expect(state.history).toHaveLength(1);
  });

  it('累计值从热冷全量重建', async () => {
    state.history = [entry(2, 20, 2)];
    await appendHistoryCold([entry(1, 10, 1)]);
    await repository.rebuildAggregates();

    expect(state.total_tokens).toBe(30);
    expect(state.total_cost).toBe(3);
  });
});
