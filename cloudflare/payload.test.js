import { describe, it, expect } from 'vitest';
import {
  MAX_BODY_BYTES,
  PAGE_KEYS,
  isDayKey,
  normalizePayload,
  withinDayWindow,
} from './payload.js';

const NOW = Date.parse('2026-10-10T04:00:00Z');

function goodPayload(overrides = {}) {
  return {
    v: 1,
    id: '0123456789abcdef0123456789abcdef',
    seq: 3,
    day: '2026-10-10',
    tz: 8,
    app: '3.1.1',
    env: {
      b: 'Chrome', bv: '141', os: 'Windows', arch: 'x86_64', lang: 'zh-CN',
      w: 'gt1024', dark: true, standalone: false, touch: false,
    },
    s: {
      opens: 2,
      dur_ms: 90000,
      pages: { overview: 3, stats: 1, history: 0, forecast: 0, wallet: 1, settings: 0, help: 0, about: 0 },
      render: [2, 1, 0, 0, 0],
    },
    daily: true,
    ...overrides,
  };
}

describe('日期校验', () => {
  it('只接受合法日期键', () => {
    expect(isDayKey('2026-10-10')).toBe(true);
    expect(isDayKey('2026-10-32')).toBe(false);
    expect(isDayKey('2026-1-1')).toBe(false);
    expect(isDayKey(20261010)).toBe(false);
  });

  it('允许客户端本地日期与 UTC 相差一天', () => {
    expect(withinDayWindow('2026-10-10', NOW)).toBe(true);
    expect(withinDayWindow('2026-10-09', NOW)).toBe(true);
    expect(withinDayWindow('2026-10-11', NOW)).toBe(true);
    expect(withinDayWindow('2026-10-08', NOW)).toBe(true);
    expect(withinDayWindow('2026-10-12', NOW)).toBe(false);
    expect(withinDayWindow('2026-10-07', NOW)).toBe(false);
  });
});

describe('上报体归一', () => {
  it('接受合法上报体并保留白名单字段', () => {
    const result = normalizePayload(goodPayload(), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.id).toBe('0123456789abcdef0123456789abcdef');
    expect(result.value.seq).toBe(3);
    expect(result.value.day).toBe('2026-10-10');
    expect(result.value.tz).toBe(8);
    expect(result.value.app).toBe('3.1.1');
    expect(result.value.env).toEqual({
      b: 'Chrome', bv: '141', os: 'Windows', arch: 'x86_64', lang: 'zh-CN',
      w: 'gt1024', dark: 1, standalone: 0, touch: 0,
    });
    expect(result.value.counters.opens).toBe(2);
    expect(result.value.counters.pages).toEqual({
      overview: 3, stats: 1, history: 0, forecast: 0, wallet: 1, settings: 0, help: 0, about: 0,
    });
    expect(result.value.counters.render).toEqual([2, 1, 0, 0, 0]);
  });

  it('丢弃未知字段，不写入任何额外内容', () => {
    const result = normalizePayload(goodPayload({
      extra: 'x',
      env: { ...goodPayload().env, chatName: '秘密对话', ua: 'raw-ua' },
      s: { ...goodPayload().s, model: 'deepseek-flash', cost: 12.34 },
    }), NOW);
    expect(result.ok).toBe(true);
    const serialized = JSON.stringify(result.value);
    expect(serialized).not.toContain('秘密对话');
    expect(serialized).not.toContain('deepseek-flash');
    expect(serialized).not.toContain('raw-ua');
    expect(result.value.env.chatName).toBeUndefined();
    expect(result.value.counters.model).toBeUndefined();
    expect(result.value.counters.cost).toBeUndefined();
    expect(result.value.extra).toBeUndefined();
  });

  it('拒绝非法标识、序号、版本与日期', () => {
    expect(normalizePayload(goodPayload({ id: 'short' }), NOW).ok).toBe(false);
    expect(normalizePayload(goodPayload({ id: 'ZZZZ456789abcdef0123456789abcdef' }), NOW).ok).toBe(false);
    expect(normalizePayload(goodPayload({ seq: 0 }), NOW).ok).toBe(false);
    expect(normalizePayload(goodPayload({ seq: -5 }), NOW).ok).toBe(false);
    expect(normalizePayload(goodPayload({ v: 2 }), NOW).ok).toBe(false);
    expect(normalizePayload(goodPayload({ day: '2026-10-20' }), NOW).ok).toBe(false);
    expect(normalizePayload(null, NOW).ok).toBe(false);
    expect(normalizePayload([], NOW).ok).toBe(false);
    expect(normalizePayload('nope', NOW).ok).toBe(false);
  });

  it('大写标识会归一为小写', () => {
    const result = normalizePayload(goodPayload({ id: 'ABCDEF0123456789ABCDEF0123456789' }), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.id).toBe('abcdef0123456789abcdef0123456789');
  });

  it('数值字段钳制到上限并忽略非法值', () => {
    const result = normalizePayload(goodPayload({
      seq: 999999999999,
      tz: 30,
      s: {
        opens: -3,
        dur_ms: 99999999999,
        pages: { overview: 999999, stats: 'abc' },
        render: [1, 'x', null, -8, 999999],
      },
    }), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.seq).toBe(100000000);
    expect(result.value.tz).toBe(14);
    expect(result.value.counters.opens).toBe(0);
    expect(result.value.counters.dur_ms).toBe(12 * 60 * 60 * 1000);
    expect(result.value.counters.pages.overview).toBe(2000);
    expect(result.value.counters.pages.stats).toBe(0);
    expect(result.value.counters.render).toEqual([1, 0, 0, 0, 2000]);
  });

  it('缺失或非法枚举回退到安全默认值', () => {
    const result = normalizePayload(goodPayload({
      env: { arch: 'mips', w: 'huge', dark: 'yes', standalone: 1, touch: null, b: 123 },
    }), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.env.arch).toBe('unknown');
    expect(result.value.env.w).toBe('gt1024');
    expect(result.value.env.dark).toBe(0);
    expect(result.value.env.standalone).toBe(0);
    expect(result.value.env.touch).toBe(0);
    expect(result.value.env.b).toBe('');
  });

  it('字符串超长会被截断', () => {
    const result = normalizePayload(goodPayload({
      app: 'x'.repeat(64),
      env: { ...goodPayload().env, b: 'y'.repeat(64), lang: 'z'.repeat(64) },
    }), NOW);
    expect(result.value.app.length).toBe(16);
    expect(result.value.env.b.length).toBe(24);
    expect(result.value.env.lang.length).toBe(12);
  });
});

describe('常量', () => {
  it('页面 key 与上报体上限保持稳定', () => {
    expect(PAGE_KEYS).toEqual(['overview', 'stats', 'history', 'forecast', 'wallet', 'settings', 'help', 'about']);
    expect(MAX_BODY_BYTES).toBe(4096);
  });
});
