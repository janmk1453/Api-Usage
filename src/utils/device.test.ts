import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  detectMobileDevice,
  hasMobileDeviceHint,
  mobileDeviceHint,
  resetMobileDeviceHint,
  setMobileDeviceHint,
} from './device';

/** 把 navigator / window 换成指定环境（node 环境下这两个全局默认不存在，用 stubGlobal 注入） */
function stubEnv(opts: { ua?: string; touch?: number; coarse?: boolean; withWindow?: boolean }): void {
  vi.stubGlobal('navigator', {
    userAgent: opts.ua === undefined ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' : opts.ua,
    maxTouchPoints: opts.touch === undefined ? 0 : opts.touch,
  });
  if (opts.withWindow === false) {
    vi.stubGlobal('window', undefined);
  } else {
    vi.stubGlobal('window', { matchMedia: (query: string) => ({ matches: opts.coarse === true, media: query }) });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetMobileDeviceHint();
});

describe('设备判定：只回答「是不是手指优先的移动端」', () => {
  it('UA 里的移动端关键字直接判为移动端', () => {
    stubEnv({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
    expect(detectMobileDevice()).toBe(true);
    stubEnv({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
    expect(detectMobileDevice()).toBe(true);
  });

  it('iPadOS 桌面模式的 Macintosh UA 靠触控点数识别', () => {
    stubEnv({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', touch: 5 });
    expect(detectMobileDevice()).toBe(true);
    // 真 Mac 没有多点触控，仍按桌面端
    stubEnv({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', touch: 0 });
    expect(detectMobileDevice()).toBe(false);
  });

  it('粗指针 + 有触控点也算移动端', () => {
    stubEnv({ ua: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0', touch: 2, coarse: true });
    expect(detectMobileDevice()).toBe(true);
    stubEnv({ ua: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0', touch: 0, coarse: true });
    expect(detectMobileDevice()).toBe(false);
  });

  it('桌面端（细指针、无触控）保持原样', () => {
    stubEnv({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', touch: 0, coarse: false });
    expect(detectMobileDevice()).toBe(false);
  });

  it('拿不到任何线索（无 window / 无 navigator）时按桌面端处理且不抛错', () => {
    stubEnv({ withWindow: false });
    expect(detectMobileDevice()).toBe(false);
    vi.stubGlobal('navigator', undefined);
    expect(detectMobileDevice()).toBe(false);
  });
});

describe('设备判定只决定一次并缓存', () => {
  it('首次判定后固定，不随环境变化', () => {
    expect(hasMobileDeviceHint()).toBe(false);
    stubEnv({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' });
    expect(mobileDeviceHint()).toBe(true);
    expect(hasMobileDeviceHint()).toBe(true);
    // 环境换成桌面端，但本次会话已判定过，不再重新探测
    stubEnv({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36' });
    expect(mobileDeviceHint()).toBe(true);
  });

  it('可注入写死判定结果，reset 后重新探测', () => {
    setMobileDeviceHint(false);
    expect(hasMobileDeviceHint()).toBe(true);
    expect(mobileDeviceHint()).toBe(false);
    resetMobileDeviceHint();
    expect(hasMobileDeviceHint()).toBe(false);
    stubEnv({ ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile/15E148' });
    expect(mobileDeviceHint()).toBe(true);
  });
});
