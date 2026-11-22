import { describe, expect, it } from 'vitest';
import { originTextOf, sourceBadgeOf } from './source-badge';

/**
 * 来源角标的两条铁律：
 * ① 只给「扩展 / 脚本」出角标 —— 酒馆主界面是默认情况，标出来是噪音；
 * ② 未知来源宁可不标，也不能猜。
 */

const entry = (requestOrigin: any) => ({ requestOrigin });

describe('sourceBadgeOf', () => {
  it('扩展：蓝底「扩展」，提示里带上扩展名', () => {
    const badge = sourceBadgeOf(entry({ kind: 'extension', id: 'ST-BaiBai-Image', label: 'ST-BaiBai-Image' }));
    expect(badge).toMatchObject({ text: '扩展', background: 'var(--ds-blue-bg)', color: 'var(--ds-blue)' });
    expect(badge?.title).toContain('ST-BaiBai-Image');
  });

  it('扩展但没解析出名字：仍然标扩展，提示退到通用说法', () => {
    const badge = sourceBadgeOf(entry({ kind: 'extension', label: '' }));
    expect(badge?.text).toBe('扩展');
    expect(badge?.title).toBe('由第三方扩展发起');
  });

  it('脚本：紫底「脚本」，说明只能定位到 iframe 运行时', () => {
    const badge = sourceBadgeOf(entry({ kind: 'script' }));
    expect(badge).toMatchObject({ text: '脚本', background: 'var(--ds-purple-bg)', color: 'var(--ds-purple)' });
    expect(badge?.title).toContain('srcdoc');
  });

  it('酒馆主界面、未知来源与旧记录一律不标', () => {
    expect(sourceBadgeOf(entry({ kind: 'tavern' }))).toBe(null);
    expect(sourceBadgeOf(entry({ kind: 'unknown' }))).toBe(null);
    expect(sourceBadgeOf(entry(null))).toBe(null);
    expect(sourceBadgeOf({})).toBe(null);
    expect(sourceBadgeOf(null)).toBe(null);
  });
});

describe('originTextOf（详情里的「请求来源」）', () => {
  it('四个来源各自有明确文案', () => {
    expect(originTextOf(entry({ kind: 'extension', label: 'yuzuki-Memory' }))).toBe('扩展 · yuzuki-Memory');
    expect(originTextOf(entry({ kind: 'extension' }))).toBe('扩展');
    expect(originTextOf(entry({ kind: 'script', label: '酒馆助手运行时' }))).toBe('脚本 · 酒馆助手运行时');
    expect(originTextOf(entry({ kind: 'script' }))).toBe('脚本 · iframe 脚本');
    expect(originTextOf(entry({ kind: 'tavern' }))).toBe('酒馆主界面');
  });

  it('认不出来时写「未识别」，不冒充酒馆主界面', () => {
    expect(originTextOf(entry({ kind: 'unknown' }))).toBe('未识别');
    expect(originTextOf({})).toBe('未识别');
    expect(originTextOf(null)).toBe('未识别');
  });
});
