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

describe('写法差异：中文修饰段、小数点与分隔符', () => {
  it('剥掉中文等非 ASCII 修饰段后按本体识别', () => {
    expect(normalizeModelName('抗截断-gemini-3.8-flash')).toBe('gemini-3-8-flash');
    expect(normalizeModelName('gemini-3.8-flash-抗截断')).toBe('gemini-3-8-flash');
    expect(normalizeModelName('[抗截断]gemini-3.8-flash')).toBe('gemini-3-8-flash');
    expect(normalizeModelName('（抗截断）gemini-3.8-flash')).toBe('gemini-3-8-flash');
  });

  it('小数点 / 下划线 / 空格 / 全角写法都归一成同一串', () => {
    for (const name of ['gemini-3.8-flash', 'gemini_3.8_flash', 'gemini 3.8 flash', 'gemini.3.8.flash', 'Gemini－３．８－Flash']) {
      expect(normalizeModelName(name)).toBe('gemini-3-8-flash');
    }
  });

  it('纯中文名剥完为空，不参与匹配', () => {
    expect(normalizeModelName('抗截断')).toBe('');
    expect(scoreModelName('抗截断', 'gemini-3.8-flash').score).toBe(0);
    expect(matchModelName('抗截断', ['gemini-3.8-flash']).best).toBeNull();
  });

  it('带中文前缀、无连字符的写法也能认出目录模型', () => {
    const catalog = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.8-pro', 'gemini-3-flash'];
    for (const local of ['抗截断-gemini-3.8-flash', '抗截断gemini-3.8-flash', '抗截断gemini3.8flash', 'gemini3.8flash']) {
      const result = matchModelName(local, catalog);
      expect(result.best?.model).toBe('gemini-3.8-flash');
      expect(result.best?.score).toBe(1);
      expect(result.ambiguous).toBe(false);
    }
  });

  it('渠道前后缀与目录名的各种组合都能落到同一模型', () => {
    const catalog = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.1-pro', 'gemini-3.1-pro-preview'];
    const locals = [
      '抗截断-gemini-3.8-flash',
      '流式保活抗截断-gemini-3.8-flash',
      '原生流式-gemini-3.8-flash',
      'build-st/抗截断-gemini-3.8-flash',
      'build-st/gemini-3.8-flash',
      'build/抗截断-gemini-3.8-flash',
      'build/gemini-3.8-flash',
    ];
    for (const local of locals) {
      const result = matchModelName(local, catalog);
      expect(result.best?.model).toBe('gemini-3.8-flash');
      expect(result.best?.score).toBe(1);
      expect(result.ambiguous).toBe(false);
    }
    for (const local of ['抗截断-gemini-3.1-pro-preview', '原生流式-gemini-3.1-pro-preview']) {
      expect(matchModelName(local, catalog).best?.model).toBe('gemini-3.1-pro-preview');
    }
  });

  it('目录只登记正式名时，preview 之类中性后缀仍能对上', () => {
    const catalog = ['gemini-3.1-pro', 'gemini-3.1-flash', 'gemini-3.8-flash'];
    for (const local of ['抗截断-gemini-3.1-pro-preview', '流式保活抗截断-gemini-3.1-pro-preview', '原生流式-gemini-3.1-pro-preview']) {
      const result = matchModelName(local, catalog);
      expect(result.best?.model).toBe('gemini-3.1-pro');
      expect(result.best?.score).toBeGreaterThanOrEqual(MODEL_MATCH_ACCEPT);
      expect(result.ambiguous).toBe(false);
    }
  });

  it('放宽写法差异不能顺带放宽变体与版本差异', () => {
    expect(scoreModelName('抗截断-gemini-3.8-flash-lite', 'gemini-3.8-flash').score).toBeLessThan(MODEL_MATCH_ACCEPT);
    expect(scoreModelName('抗截断-gemini-3.8-pro', 'gemini-3.8-flash').score).toBeLessThan(MODEL_MATCH_ACCEPT);
    expect(scoreModelName('抗截断-gemini-3.8', 'gemini-3.8-flash').score).toBeLessThan(MODEL_MATCH_ACCEPT);
    expect(scoreModelName('抗截断-gpt-4o-mini', 'gpt-4o').score).toBeLessThan(MODEL_MATCH_ACCEPT);
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
