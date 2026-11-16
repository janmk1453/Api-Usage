import { describe, expect, it } from 'vitest';
import { remoteSources } from './update';

describe('远端多源列表', () => {
  const sources = remoteSources('manifest.json', 'dev');

  it('实时源整体排在缓存源之前', () => {
    const firstCached = sources.findIndex(s => !s.live);
    expect(firstCached).toBeGreaterThan(0);
    expect(sources.slice(0, firstCached).every(s => s.live)).toBe(true);
    expect(sources.slice(firstCached).every(s => !s.live)).toBe(true);
  });

  it('首源为 GitHub raw，缓存源为 jsDelivr', () => {
    expect(sources[0].url.startsWith('https://raw.githubusercontent.com/')).toBe(true);
    expect(sources.some(s => s.url.includes('cdn.jsdelivr.net'))).toBe(true);
  });

  it('至少有一条 GitHub 加速镜像，避免 raw 被墙后只剩缓存源', () => {
    expect(sources.some(s => s.url.includes('ghproxy.net'))).toBe(true);
    expect(sources.some(s => s.url.includes('gh-proxy.com'))).toBe(true);
    expect(sources.some(s => s.url.includes('gh-proxy.org'))).toBe(true);
  });

  it('两个梯队都留有多条国内可达镜像，任一被墙仍有兜底', () => {
    const live = sources.filter(s => s.live);
    const cached = sources.filter(s => !s.live);
    expect(live.length).toBeGreaterThanOrEqual(4);
    expect(cached.length).toBeGreaterThanOrEqual(3);
    expect(cached.some(s => s.url.includes('jsdmirror'))).toBe(true);
    expect(cached.some(s => s.url.includes('jsd.onmicrosoft.cn'))).toBe(true);
  });

  it('每个地址都是 https 合法 URL 且指向同一文件', () => {
    for (const s of sources) {
      const u = new URL(s.url);
      expect(u.protocol).toBe('https:');
      expect(u.pathname.endsWith('/manifest.json')).toBe(true);
    }
  });

  it('地址带时间戳，避免中间层缓存', () => {
    for (const s of sources) {
      expect(new URL(s.url).searchParams.get('t')).toBeTruthy();
    }
  });

  it('分支与仓库名出现在每条地址中', () => {
    for (const s of sources) {
      expect(s.url).toContain('janmk1453/Api-Usage');
      expect(s.url).toContain('dev');
    }
    const policy = remoteSources('update-policy.json', 'main');
    for (const s of policy) {
      expect(s.url).toContain('update-policy.json');
      expect(s.url).toContain('main');
    }
  });
});
