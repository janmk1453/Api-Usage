import { describe, expect, it } from 'vitest';
import {
  CAPTURE_INNER_KEY,
  TAP_INNER_KEY,
  describeFetchChain,
  fetchChainHas,
  fetchChainInner,
  fetchChainKind,
} from './fetch-chain';

/** 造一层「采集层」：身份标记 + 被包住的下一层 */
function captureLayer(inner?: any): any {
  const fn: any = function() {};
  fn.__ausCaptureLayer = true;
  fn.__ausCaptureDepth = inner ? (Number(inner.__ausCaptureDepth) || 0) + 1 : 1;
  if (inner) fn[CAPTURE_INNER_KEY] = inner;
  return fn;
}

/** 造一层「探针层」：只声明自己是探针，按需把 __aus_patched 透传成「读内层」的 getter */
function tapLayer(inner: any, { relayPatched = true }: { relayPatched?: boolean } = {}): any {
  const fn: any = function() {};
  fn.__ausTapActive = true;
  if (inner) fn[TAP_INNER_KEY] = inner;
  if (relayPatched) {
    Object.defineProperty(fn, '__aus_patched', {
      configurable: true,
      get: () => inner?.__aus_patched === true,
    });
  }
  return fn;
}

describe('fetch 链遍历：在岗判定只认本体', () => {
  it('顶层就是在岗那一代时判在岗', () => {
    const active = captureLayer();
    expect(fetchChainHas(active, active)).toBe(true);
  });

  it('探针压在上面时，沿链仍能摸到在岗的采集层', () => {
    const active = captureLayer();
    const top = tapLayer(active);
    expect(fetchChainHas(top, active)).toBe(true);
    expect(describeFetchChain(top)).toBe('tap>capture');
  });

  it('没有在岗代（卸载后 / 从未装上）一律判不在岗', () => {
    const retired = captureLayer();
    expect(fetchChainHas(tapLayer(retired), null)).toBe(false);
    expect(fetchChainHas(null, retired)).toBe(false);
  });

  it('宿主自己的包装不记录下一层，摸不到就不算在岗', () => {
    const active = captureLayer();
    const hostWrapper: any = function() {};
    expect(fetchChainHas(hostWrapper, active)).toBe(false);
    expect(fetchChainInner(hostWrapper)).toBeNull();
  });

  it('自指的链不会死循环', () => {
    const loop: any = function() {};
    loop[CAPTURE_INNER_KEY] = loop;
    const active = captureLayer();
    expect(fetchChainHas(loop, active)).toBe(false);
    expect(() => describeFetchChain(loop)).not.toThrow();
  });

  it('超过 maxHops 就停下，不会无限往下摸', () => {
    const active = captureLayer();
    const top = tapLayer(captureLayer(active));
    expect(fetchChainHas(top, active, 1)).toBe(false);
    expect(fetchChainHas(top, active, 2)).toBe(true);
  });
});

/**
 * 3.2.3 真机事故的回归用例。
 *
 * 现场：宿主重载后顶层只剩探针，它包住的采集代已经退役、也不在链上了；探针的
 * __aus_patched getter 因为读的是「退役代快照」而恒为 true。老守卫只看这个布尔，
 * 于是每 4s 判一次「采集已在岗」，永不重装——采集静默几小时，诊断包里 0 条失败痕迹。
 */
describe('假在岗：标记为真但链上摸不到在岗代', () => {
  it('探针透传的 __aus_patched 为 true 也不能当在岗证据', () => {
    const retired: any = captureLayer();
    retired.__aus_patched = true; // 退役代自己留下的历史标记
    const top = tapLayer(retired);
    expect(top.__aus_patched).toBe(true); // 老判据看到的正是这个值
    expect(top.__ausCaptureLayer).toBeUndefined(); // 探针层没有身份标记，老判据的另一半也不成立
    const active = captureLayer(); // 真正应该触发的结论：在岗代不在链上 → 必须重装
    expect(fetchChainHas(top, active)).toBe(false);
  });

  it('内层采集代被宿主整层换掉后，同样判不在岗', () => {
    const retired = captureLayer();
    const top = tapLayer(retired);
    // 宿主把链换成自己的包装，我们的两代都不在链上了
    const hostWrapper: any = function() {};
    expect(fetchChainHas(hostWrapper, retired)).toBe(false);
    expect(fetchChainHas(top, retired)).toBe(true); // 只要还在链上就仍然可用
  });
});

describe('链上各层识别', () => {
  it('认采集层 / 探针层 / 宿主层', () => {
    expect(fetchChainKind(captureLayer())).toBe('capture');
    expect(fetchChainKind(tapLayer(null))).toBe('tap');
    expect(fetchChainKind(function() {})).toBe('other');
    expect(fetchChainKind(undefined)).toBe('other');
  });

  it('空链描述为 empty，便于诊断包一眼看出「什么都没挂上」', () => {
    expect(describeFetchChain(null)).toBe('empty');
    expect(describeFetchChain(function() {})).toBe('other');
  });
});
