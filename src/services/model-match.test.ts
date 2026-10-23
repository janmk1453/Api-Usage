import { describe, expect, it } from 'vitest';
import {
  MODEL_MATCH_ACCEPT,
  matchModelName,
  normalizeModelName,
  scoreModelName,
} from './model-match';

describe('normalizeModelName', () => {
  it('剥离前缀、供应商路径、日期与版本后缀', () => {
    expect(normalizeModelName('[OR] deepseek-chat')).toBe('deepseek-chat');
    expect(normalizeModelName('anthropic/claude-sonnet-4-5-20250929')).toBe('claude-sonnet-4-5');
    expect(normalizeModelName('deepseek-ai/DeepSeek-V3')).toBe('deepseek-v3');
    expect(normalizeModelName('glm-4.6')).toBe('glm-4-6');
    expect(normalizeModelName('kimi-k2-0905')).toBe('kimi-k2');
    expect(normalizeModelName('gpt-4o-mini:free')).toBe('gpt-4o-mini');
    expect(normalizeModelName('qwen-max-latest')).toBe('qwen-max');
  });
});

describe('scoreModelName', () => {
  it('归一化后完全相同视为 1.0', () => {
    expect(scoreModelName('claude-sonnet-4-5', 'claude-sonnet-4-5-20250929').score).toBe(1);
    expect(scoreModelName('deepseek-chat', 'deepseek-chat').reason).toBe('exact');
  });

  it('版本号不同必须重罚（claude-sonnet-4 不能匹配 4-5）', () => {
    expect(scoreModelName('claude-sonnet-4', 'claude-sonnet-4-5').score).toBeLessThan(MODEL_MATCH_ACCEPT);
    expect(scoreModelName('deepseek-v3', 'deepseek-v3-2').score).toBeLessThan(MODEL_MATCH_ACCEPT);
  });

  it('变体后缀不同必须重罚（gpt-4o 不能匹配 gpt-4o-mini）', () => {
    expect(scoreModelName('gpt-4o', 'gpt-4o-mini').score).toBeLessThan(MODEL_MATCH_ACCEPT);
    expect(scoreModelName('glm-4-6', 'glm-4-6-flash').score).toBeLessThan(MODEL_MATCH_ACCEPT);
  });

  it('同族不同型号不匹配（chat vs reasoner / sonnet vs opus）', () => {
    expect(scoreModelName('deepseek-chat', 'deepseek-reasoner').score).toBeLessThan(MODEL_MATCH_ACCEPT);
    expect(scoreModelName('claude-sonnet-4-5', 'claude-opus-4-5').score).toBeLessThan(MODEL_MATCH_ACCEPT);
  });

  it('已知同义写法按别名命中', () => {
    const result = scoreModelName('qwen-max', 'qwen3-max');
    expect(result.score).toBeGreaterThanOrEqual(0.99);
    expect(result.reason).toBe('alias');
  });
});

describe('matchModelName', () => {
  const catalog = ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20250929', 'claude-haiku-4-5'];

  it('唯一最佳匹配时返回候选', () => {
    const result = matchModelName('claude-sonnet-4-5', catalog);
    expect(result.best?.model).toBe('claude-sonnet-4-5-20250929');
    expect(result.ambiguous).toBe(false);
  });

  it('分差过小时判定为歧义', () => {
    const result = matchModelName('claude-4-5', ['claude-sonnet-4-5', 'claude-opus-4-5']);
    if (result.best && result.second) {
      expect(result.best.score - result.second.score).toBeLessThan(0.05);
      expect(result.ambiguous).toBe(true);
    }
  });

  it('低于阈值不返回最佳匹配', () => {
    expect(matchModelName('totally-different-model', catalog).best).toBeNull();
  });
});
