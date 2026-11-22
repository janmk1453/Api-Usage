import { afterEach, describe, expect, it } from 'vitest';
import { extensionFolderName, extensionNameCandidates, extensionNameHint, extensionScopeFromList, extensionScopeHint, remoteSources, versionProbePlan } from './update';

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

describe('扩展安装位置探测', () => {
  const raw = (globalThis as any).SillyTavern;
  const setExtensions = (list: any[]) => {
    (globalThis as any).SillyTavern = { getContext: () => ({ extensions: list }) };
  };
  afterEach(() => {
    (globalThis as any).SillyTavern = raw;
  });

  it('清单注明全局安装时返回 true', () => {
    setExtensions([{ name: 'third-party/Api-Usage', type: 'global' }]);
    expect(extensionScopeHint()).toBe(true);
  });

  it('清单注明本地安装时返回 false', () => {
    setExtensions([{ name: 'Api-Usage', type: 'local' }]);
    expect(extensionScopeHint()).toBe(false);
  });

  it('没有本扩展条目、宿主缺失或读取抛错时返回 null，交给兜底顺序', () => {
    setExtensions([{ name: 'third-party/Other', type: 'global' }]);
    expect(extensionScopeHint()).toBe(null);
    (globalThis as any).SillyTavern = undefined;
    expect(extensionScopeHint()).toBe(null);
    (globalThis as any).SillyTavern = { getContext: () => { throw new Error('boom'); } };
    expect(extensionScopeHint()).toBe(null);
  });

  it('清单给出的是带 third-party/ 的逻辑名，回传时只留目录名', () => {
    setExtensions([{ name: 'third-party/Api-Usage', type: 'global' }]);
    expect(extensionNameHint()).toBe('Api-Usage');
    expect(extensionNameCandidates()).toEqual(['Api-Usage']);
  });

  it('服务端只认目录名一段，带 third-party/ 会被 sanitize 成同一个目录而 404', () => {
    // ST：sanitize('third-party/Api-Usage') = 'third-partyApi-Usage'，
    // 再 join 上 data/default-user/extensions → 目录不存在 → 404
    setExtensions([{ name: 'third-party/Api-Usage', type: 'global' }]);
    expect(extensionScopeHint()).toBe(true);
    expect(extensionNameCandidates()).toEqual(['Api-Usage']);

    setExtensions([{ name: 'Api-Usage', type: 'local' }]);
    expect(extensionNameHint()).toBe('Api-Usage');
    expect(extensionNameCandidates()).toEqual(['Api-Usage']);
  });

  it('各种写法都归一化成目录名', () => {
    for (const raw of ['third-party/Api-Usage', 'third-party\\Api-Usage', '/third-party/Api-Usage/', 'Api-Usage', '  Api-Usage  ']) {
      expect(extensionFolderName(raw)).toBe('Api-Usage');
    }
    expect(extensionFolderName('')).toBe('');
    expect(extensionFolderName(null)).toBe('');
    expect(extensionFolderName('third-party/')).toBe('');
  });

  it('按 discover 的 type 判定安装位置，本地与全局不混用', () => {
    // TauriTavern：本地扩展 = data/default-user/extensions/<folder>，全局 = data/extensions/third-party/<folder>
    // global 传错一边，服务端只会回 “Extension not found at <另一个目录>”
    expect(extensionScopeFromList([{ name: 'third-party/Api-Usage', type: 'local' }]))
      .toEqual({ name: 'Api-Usage', global: false });
    expect(extensionScopeFromList([{ name: 'third-party/Api-Usage', type: 'global' }]))
      .toEqual({ name: 'Api-Usage', global: true });
    expect(extensionScopeFromList([{ name: 'Api-Usage', type: 'global' }]))
      .toEqual({ name: 'Api-Usage', global: true });
    expect(extensionScopeFromList([{ name: 'regex', type: 'system' }, { name: 'third-party/Other', type: 'local' }])).toBe(null);
    expect(extensionScopeFromList(null)).toBe(null);
    expect(extensionScopeFromList({})).toBe(null);
  });

  it('discover 给出位置时只探那一处，不再拿另一边去换一条假报错', () => {
    // 真机：全局装、git 连不上 GitHub 时，先试 global（网络错）再试 local，
    // 宿主就会补一条 “Extension not found at .../third-party/Api-Usage”
    const plan = versionProbePlan({ name: 'third-party/Api-Usage', global: true }, false);
    expect(plan).toEqual({ names: ['Api-Usage'], globals: [true] });
    expect(versionProbePlan({ name: 'Api-Usage', global: false }, true))
      .toEqual({ names: ['Api-Usage'], globals: [false] });
  });

  it('没有 discover 时才按 hint 盲试两边，名字优先用已确认过的', () => {
    expect(versionProbePlan(null, true, ['third-party/Api-Usage']))
      .toEqual({ names: ['Api-Usage'], globals: [true, false] });
    expect(versionProbePlan(null, null).globals).toEqual([false, true]);
  });

  it('清单是字符串名单时也能取到目录名，位置未知交给 discover', () => {
    setExtensions(['third-party/Api-Usage', 'third-party/Other']);
    expect(extensionNameHint()).toBe('Api-Usage');
    expect(extensionScopeHint()).toBe(null);
    expect(extensionNameCandidates()).toEqual(['Api-Usage']);
  });

  it('读取不到清单时退到打包目录名', () => {
    (globalThis as any).SillyTavern = undefined;
    expect(extensionNameHint()).toBe(null);
    expect(extensionNameCandidates()).toEqual(['Api-Usage']);
    (globalThis as any).SillyTavern = { getContext: () => { throw new Error('boom'); } };
    expect(extensionNameCandidates()).toEqual(['Api-Usage']);
  });
});
