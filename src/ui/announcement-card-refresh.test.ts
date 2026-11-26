import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 一份合法公告文件：只要 JSON 能解析，拉取就算成功 */
const FILE = {
  schema: 1,
  items: [
    {
      id: 'test-1',
      date: '2026-11-23',
      level: 'info',
      title: '测试公告',
      body: ['正文'],
      minVersion: '',
      maxVersion: '',
      until: '',
      linkText: '',
      linkUrl: '',
    },
  ],
};

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}

/** refreshAnnouncementCard 只用到 getElementById 与 createElement（paint 内部只换 innerHTML） */
function fakeDoc() {
  const root: any = { innerHTML: '' };
  const doc: any = {
    getElementById: (id: string) => (id === 'aus-announcements' ? root : null),
    createElement: () => {
      let stored = '';
      const el: any = { firstElementChild: null };
      Object.defineProperty(el, 'innerHTML', {
        get: () => stored,
        set: (value: string) => { stored = value; el.firstElementChild = { innerHTML: value }; },
      });
      return el;
    },
  };
  return { doc, root };
}

describe('refreshAnnouncementCard：进入关于页强制拉一次公告', () => {
  let fetchCalls = 0;

  beforeEach(() => {
    fetchCalls = 0;
    vi.resetModules();
    vi.stubGlobal('localStorage', fakeLocalStorage());
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCalls += 1;
      return { ok: true, text: async () => JSON.stringify(FILE) } as any;
    }));
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('30 分钟内已拉过，进入关于页仍会真的发请求，并把结果写进缓存', async () => {
    const ann = await import('../services/announcement');
    ann.writeLastAnnouncementCheck(Date.now());
    // 对照组：普通拉取被 30 分钟节流挡住，一个字都不发
    await expect(ann.fetchAnnouncements()).resolves.toEqual({ items: null, skipped: 'throttle' });
    expect(fetchCalls).toBe(0);

    const card = await import('./announcement-card');
    const { doc, root } = fakeDoc();
    await card.refreshAnnouncementCard(doc as unknown as Document);

    expect(fetchCalls).toBeGreaterThan(0);
    expect(ann.readCachedAnnouncements().map(item => item.id)).toEqual(['test-1']);
    expect(root.innerHTML).toContain('测试公告');
  });

  it('展示公告不写已读（已读只由弹窗关闭时写入）', async () => {
    const ann = await import('../services/announcement');
    const card = await import('./announcement-card');
    await card.refreshAnnouncementCard(fakeDoc().doc as unknown as Document);
    expect(ann.readSeenAnnouncementIds()).toEqual([]);
  });
});
