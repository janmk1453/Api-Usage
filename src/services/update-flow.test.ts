import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 检查更新 / 自更新（services/update.ts）的流程测试。
 *
 * 这些用例只替身「外部世界」：宿主 /api/extensions/*、GitHub 源、localStorage、DOM、toast。
 * 判定逻辑、分支切换顺序、错误话术、节流与退避全部走真实实现。
 *
 * 为什么要有这一组：update.ts 的故障都发生在「哪条路该走、失败之后该说什么」上，
 * 而不是单个函数算错。源码断言只能钉住结构，钉不住「compare 挂了会不会误报已最新」
 * 这种真实分支，所以这里按完整链路测。
 */

interface FakeResp {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

function ok(data: any, status = 200): FakeResp {
  return { ok: true, status, json: async () => data, text: async () => JSON.stringify(data) };
}

function bad(status = 500, text = 'boom'): FakeResp {
  return { ok: false, status, json: async () => null, text: async () => text };
}

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  } as Storage;
}

function makeDom() {
  const banner: any = { style: {} as Record<string, string>, innerHTML: '' };
  const button: any = { style: { display: '' } as Record<string, string> };
  const badge: any = {
    attrs: {} as Record<string, string>,
    setAttribute(name: string, value: string) { this.attrs[name] = value; },
    closest() { return null; },
  };
  const doc = {
    getElementById: (id: string) => (id === 'aus-update-banner' ? banner : id === 'aus-run-update' ? button : null),
    querySelectorAll: () => [badge],
  };
  return { doc, banner, button, badge };
}

interface Env {
  mod: typeof import('./update');
  calls: { url: string; init: any }[];
  toasts: { type: string; msg: string }[];
  storage: Storage;
  dom: ReturnType<typeof makeDom>;
  win: any;
}

async function setup(
  handler: (url: string, init: any) => FakeResp,
  options: { context?: any | null } = {},
): Promise<Env> {
  const storage = makeStorage();
  const dom = makeDom();
  const calls: { url: string; init: any }[] = [];
  const toasts: { type: string; msg: string }[] = [];
  const fetchMock = async (url: any, init: any = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  const ctx = options.context === null ? null : {
    getRequestHeaders: () => ({ 'X-Test': '1' }),
    extensions: [{ name: 'third-party/Api-Usage', type: 'local' }],
    extensionSettings: {} as Record<string, any>,
    saveSettingsDebounced: () => {},
    ...options.context,
  };
  const win: any = {
    fetch: fetchMock,
    localStorage: storage,
    document: dom.doc,
    location: { reload: vi.fn() },
    toastr: {
      info: (msg: string) => toasts.push({ type: 'info', msg }),
      error: (msg: string) => toasts.push({ type: 'error', msg }),
      success: (msg: string) => toasts.push({ type: 'success', msg }),
      warning: (msg: string) => toasts.push({ type: 'warning', msg }),
    },
  };
  win.parent = win;
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('SillyTavern', ctx ? { getContext: () => ctx } : undefined);
  vi.resetModules();
  const mod = await import('./update');
  return { mod, calls, toasts, storage, dom, win };
}

/** 默认宿主与远端：本地 main@aaaa111、落后一个提交、远端 main@bbbb222 */
function defaultHandler(url: string): FakeResp {
  if (url.includes('/api/extensions/discover')) return ok([{ name: 'third-party/Api-Usage', type: 'local' }]);
  if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'main', isUpToDate: false });
  if (url.includes('/api/extensions/switch')) return ok({});
  if (url.includes('/api/extensions/update')) return ok({ isUpToDate: false, shortCommitHash: 'cccc333' });
  if (url.includes('compare/')) return ok({ ahead_by: 2, commits: [{ sha: 'bbbb222ccc' }] });
  if (url.includes('manifest.json')) return ok({ version: '3.2.3' });
  if (url.includes('update-policy.json')) return bad(404, 'no policy');
  return bad(404, 'not found');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('checkUpdate：先比提交，失败再比版本', () => {
  it('远端提交领先时判定有更新，并把徽标、按钮、提示一起点亮', async () => {
    const { mod, toasts, dom } = await setup(defaultHandler);
    const res = await mod.checkUpdate(true);

    expect(res).toEqual({ hasUpdate: true, current: 'main@aaaa111', remote: 'main@bbbb222' });
    expect(toasts.some(t => t.type === 'info' && t.msg.includes('发现新提交 main@bbbb222'))).toBe(true);
    expect(dom.badge.attrs['data-on']).toBe('1');
    expect(dom.button.style.display).toBe('inline-flex');
    expect(dom.banner.innerHTML).toContain('main@bbbb222');
    expect(mod.isUpdateAvailable()).toBe(true);
  });

  it('同一条远端提交重复检查只提醒一次', async () => {
    const { mod, toasts, storage } = await setup(defaultHandler);
    await mod.checkUpdate(true);
    // 绕过 10 分钟节流，模拟下一次自动检查
    storage.setItem('aus_update_last_check', '0');
    const before = toasts.length;
    const again = await mod.checkUpdate(false);

    expect(again?.hasUpdate).toBe(true);
    expect(toasts.length).toBe(before);
  });

  it('compare 拿不到结果时用远端 manifest 版本兜底，不误报「已是最新」', async () => {
    const { mod, toasts } = await setup((url) => {
      // 老宿主只报提交号、不报 isUpToDate：这时提交比较是唯一依据，compare 挂了才轮到版本兜底
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'main' });
      if (url.includes('compare/')) return bad(503, 'rate limited');
      if (url.includes('manifest.json')) return ok({ version: '9.9.9' });
      return defaultHandler(url);
    });
    const res = await mod.checkUpdate(false);

    expect(res).toEqual({ hasUpdate: true, current: 'main@aaaa111', remote: 'v9.9.9' });
    expect(toasts.some(t => t.msg.includes('新版本 v9.9.9'))).toBe(true);
  });

  it('compare 失败且远端版本不领先时，不凭「服务端说落后」就认定有更新', async () => {
    const { mod, toasts } = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'main', isUpToDate: true });
      if (url.includes('compare/')) return bad(503, 'rate limited');
      if (url.includes('manifest.json')) return ok({ version: '3.2.3' });
      return defaultHandler(url);
    });
    const res = await mod.checkUpdate(false);

    expect(res?.hasUpdate).toBe(false);
    expect(toasts.length).toBe(0);
  });

  it('服务端确认已最新时，手动检查给出明确结论而不是静默', async () => {
    const { mod, toasts } = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'main', isUpToDate: true });
      if (url.includes('compare/')) return ok({ ahead_by: 0, commits: [] });
      return defaultHandler(url);
    });
    const res = await mod.checkUpdate(true);

    expect(res?.hasUpdate).toBe(false);
    expect(toasts.some(t => t.msg.includes('已是最新版本'))).toBe(true);
  });

  it('目标分支与当前分支不一致时提示切换，而不是直接拉取', async () => {
    const env = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'main', isUpToDate: true });
      if (url.includes('compare/')) return ok({ ahead_by: 0, commits: [] });
      return defaultHandler(url);
    });
    // getUpdateBranch 每次调用都读 localStorage，所以在 import 之后改也生效
    env.storage.setItem('aus_update_branch', 'dev');
    const res = await env.mod.checkUpdate(true);

    expect(res?.hasUpdate).toBe(true);
    expect(env.toasts.some(t => t.msg.includes('切换到 dev 分支'))).toBe(true);
    // 只提示、不替用户切：切分支必须由「立即更新」触发
    expect(env.calls.some(c => c.url.includes('/api/extensions/switch'))).toBe(false);
  });

  it('非 Git 安装回退版本比较，并提示去「管理扩展程序」更新', async () => {
    const { mod, toasts, dom } = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: '', currentBranchName: '', isUpToDate: false });
      if (url.includes('manifest.json')) return ok({ version: '9.9.9' });
      return defaultHandler(url);
    });
    const res = await mod.checkUpdate(true);

    expect(res?.hasUpdate).toBe(true);
    expect(res?.remote).toBe('9.9.9');
    expect(res?.current).toMatch(/^\d+\.\d+\.\d+$/);
    expect(toasts.some(t => t.msg.includes('管理扩展程序'))).toBe(true);
    // 非 Git 安装不给「立即更新」按钮：点了也只会 404
    expect(dom.button.style.display).toBe('none');
    expect(dom.badge.attrs['data-on']).toBe('1');
  });

  it('宿主与远端都不可用时返回 null，自动检查保持沉默', async () => {
    const { mod, toasts } = await setup(() => bad(500, 'offline'), { context: null });
    const auto = await mod.checkUpdate(false);
    expect(auto).toBe(null);
    expect(toasts.length).toBe(0);
  });

  it('网络全灭时手动检查给出错误提示，而不是假装已最新', async () => {
    const { mod, toasts } = await setup(() => bad(500, 'offline'), { context: null });
    const manual = await mod.checkUpdate(true);
    expect(manual).toBe(null);
    expect(toasts.some(t => t.type === 'error' && t.msg.includes('检查更新失败'))).toBe(true);
  });

  it('自动检查 10 分钟内只联网一次', async () => {
    const { mod, calls } = await setup(defaultHandler);
    await mod.checkUpdate(false);
    const afterFirst = calls.length;
    const second = await mod.checkUpdate(false);

    expect(second).toBe(null);
    expect(calls.length).toBe(afterFirst);
  });
});

describe('updateSelf：分支切换 + 拉取提交', () => {
  it('非 Git 安装直接拒绝，不调用更新接口', async () => {
    const { mod, calls, toasts } = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: '', currentBranchName: 'main', isUpToDate: false });
      return defaultHandler(url);
    });
    const res = await mod.updateSelf();

    expect(res.ok).toBe(false);
    expect(res.message).toContain('不是 Git 仓库');
    expect(calls.some(c => c.url.includes('/api/extensions/update'))).toBe(false);
    expect(toasts.some(t => t.type === 'error')).toBe(true);
  });

  it('目标分支与当前分支不同：先 switch 再 update，并带上目录名', async () => {
    const { mod, calls, storage } = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'dev', isUpToDate: false });
      if (url.includes('/api/extensions/switch')) return ok({});
      if (url.includes('/api/extensions/update')) return ok({ isUpToDate: false, shortCommitHash: 'cccc333' });
      return defaultHandler(url);
    });
    storage.setItem('aus_update_branch', 'main');
    const res = await mod.updateSelf();

    const switchCall = calls.find(c => c.url.includes('/api/extensions/switch'));
    const updateCall = calls.find(c => c.url.includes('/api/extensions/update'));
    expect(switchCall).toBeTruthy();
    expect(JSON.parse(switchCall!.init.body)).toEqual({ extensionName: 'Api-Usage', branch: 'origin/main', global: false });
    expect(updateCall).toBeTruthy();
    expect(JSON.parse(updateCall!.init.body)).toEqual({ extensionName: 'Api-Usage', global: false });
    // switch 必须排在 update 之前，否则服务端会在旧分支上拉取
    expect(calls.indexOf(switchCall!)).toBeLessThan(calls.indexOf(updateCall!));
    expect(res).toMatchObject({ ok: true, isUpToDate: false, changed: true, message: '已更新到 main 分支（cccc333）', branch: 'main' });
  });

  it('切换分支 403：不再继续更新，并说明是权限问题', async () => {
    const { mod, calls } = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'dev', isUpToDate: false });
      if (url.includes('/api/extensions/switch')) return bad(403, 'forbidden');
      return defaultHandler(url);
    });
    (globalThis as any).localStorage.setItem('aus_update_branch', 'main');
    const res = await mod.updateSelf();

    expect(res.ok).toBe(false);
    expect(res.message).toContain('没有切换全局扩展分支的权限');
    expect(calls.some(c => c.url.includes('/api/extensions/update'))).toBe(false);
  });

  it('更新 404：明确指出服务端没找到扩展目录', async () => {
    const { mod } = await setup((url) => {
      if (url.includes('/api/extensions/update')) return bad(404, 'Directory does not exist at data\\default-user\\extensions\\Api-Usage');
      return defaultHandler(url);
    });
    const res = await mod.updateSelf();

    expect(res.ok).toBe(false);
    expect(res.message).toContain('服务端未找到扩展目录');
    expect(res.message).toContain('Api-Usage');
  });

  it('更新 500：把服务端错误正文带出来（截断到 200 字）', async () => {
    const long = 'x'.repeat(300);
    const { mod } = await setup((url) => {
      if (url.includes('/api/extensions/update')) return bad(500, long);
      return defaultHandler(url);
    });
    const res = await mod.updateSelf();

    expect(res.ok).toBe(false);
    expect(res.message).toContain('服务端执行 git 更新失败');
    expect(res.message.endsWith('…')).toBe(true);
    expect(res.message.length).toBeLessThan(300);
  });

  it('同分支已最新：changed 为 false，不触发刷新', async () => {
    const { mod, win } = await setup((url) => {
      if (url.includes('/api/extensions/update')) return ok({ isUpToDate: true, shortCommitHash: 'aaaa111' });
      return defaultHandler(url);
    });
    const res = await mod.updateSelf();

    expect(res).toMatchObject({ ok: true, isUpToDate: true, changed: false, message: 'main 分支已是最新版本，无需更新' });
    expect(win.location.reload).not.toHaveBeenCalled();
  });
});

describe('probeForcedUpdateAtStartup：救援通道', () => {
  const forcedHandler = (url: string): FakeResp => {
    if (url.includes('update-policy.json')) return ok({ force: true, minVersion: '3.2.3', reason: '安全修复' });
    if (url.includes('manifest.json')) return ok({ version: '9.9.9' });
    return defaultHandler(url);
  };

  it('策略要求强制更新时自动安装，并在生成结束后刷新', async () => {
    vi.useFakeTimers();
    const { mod, calls, toasts, win } = await setup(forcedHandler);
    await mod.probeForcedUpdateAtStartup();

    expect(calls.some(c => c.url.includes('/api/extensions/update'))).toBe(true);
    expect(toasts.some(t => t.msg.includes('强制更新 v9.9.9'))).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(win.location.reload).toHaveBeenCalled();
  });

  it('两小时内不重复探测', async () => {
    const { mod, calls } = await setup(forcedHandler);
    await mod.probeForcedUpdateAtStartup();
    const afterFirst = calls.length;
    await mod.probeForcedUpdateAtStartup();

    expect(calls.length).toBe(afterFirst);
  });

  it('服务端确认已最新时直接退出，不读策略、不发额外请求', async () => {
    const { mod, calls } = await setup((url) => {
      if (url.includes('/api/extensions/version')) return ok({ currentCommitHash: 'aaaa111', currentBranchName: 'main', isUpToDate: true });
      return forcedHandler(url);
    });
    await mod.probeForcedUpdateAtStartup();

    expect(calls.some(c => c.url.includes('update-policy.json'))).toBe(false);
    expect(calls.some(c => c.url.includes('/api/extensions/update'))).toBe(false);
  });

  it('强制更新失败后写入退避时间，避免每次打开面板都重试', async () => {
    const { mod, storage } = await setup((url) => {
      if (url.includes('/api/extensions/update')) return bad(500, 'git failed');
      return forcedHandler(url);
    });
    await mod.probeForcedUpdateAtStartup();

    const retryAt = Number(storage.getItem('aus_update_force_retry_at') || 0);
    expect(retryAt).toBeGreaterThan(Date.now());
  });

  it('策略版本门槛未达到时不触发强制更新', async () => {
    const { mod, calls } = await setup((url) => {
      // minVersion 是「远端达到该版本才强制」：设成比远端更高就不会触发
      if (url.includes('update-policy.json')) return ok({ force: true, minVersion: '10.0.0', reason: '未来版本才生效' });
      if (url.includes('manifest.json')) return ok({ version: '9.9.9' });
      return defaultHandler(url);
    });
    await mod.probeForcedUpdateAtStartup();

    expect(calls.some(c => c.url.includes('/api/extensions/update'))).toBe(false);
  });
});
