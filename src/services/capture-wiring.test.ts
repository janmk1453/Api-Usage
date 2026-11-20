import { describe, expect, it } from 'vitest';
import interceptionSrc from './interception.ts?raw';
import captureSrc from './request-tap/capture.ts?raw';

/**
 * 采集 / 探针两套 fetch 包装的「在岗代」结构守护。
 *
 * 3.2.3 的两个线上故障都源于同一类错误：包装层不知道自己是第几代。
 * - 采集：宿主反复重绑 fetch，旧包装留在链里继续解析响应 → 一次请求被写 N 条历史；
 * - 探针：用布尔 `PATCH_FLAG` 当闸门（含义是「装过一次」）→ 宿主换掉 fetch 后永久失聪。
 * 这两条都属于「改一行就复发、复发后极难从现象反推」的类型，所以用源码断言钉死。
 */
describe('采集包装：单实例 + 旧代退役', () => {
  it('只有当前在岗的一代解析响应，旧代一律直通', () => {
    expect(interceptionSrc).toContain('let activeCapture: any = null;');
    expect(interceptionSrc).toContain('if (activeCapture !== patched) {');
    expect(interceptionSrc).toContain('return rawFetch.apply(p, args);');
    expect(interceptionSrc).toContain('activeCapture = patched;');
  });

  it('卸载后不留能继续记账的层', () => {
    expect(interceptionSrc).toContain('activeCapture = null;');
  });

  it('探针身份用 getter 动态读内层，不再用 bind 产物上的快照标记', () => {
    // bind 出来的新函数不继承自定义属性，读它会永远读不到 → 两边守卫互相重包
    expect(interceptionSrc).toContain('const prevFetchFn: any = p.fetch;');
    expect(interceptionSrc).toContain("Object.defineProperty(patched, '__ausTapPatched'");
    expect(interceptionSrc).not.toContain('(rawFetch as any).__ausTapPatched === true) patched.__ausTapPatched = true;');
  });
});

describe('探针包装：按代际令牌判退役', () => {
  it('退役判定认自己这一代，不认 w.fetch（否则被包一层就失聪）', () => {
    expect(captureSrc).toContain('const activeTapByWin = new WeakMap<any, any>();');
    expect(captureSrc).toContain('if (activeTapByWin.get(w) !== tapFetch) return prevFetch(input, init);');
    expect(captureSrc).not.toContain('if (!st || st.fetch !== tapFetch) return prevFetch(input, init);');
  });

  it('在岗记录按 window 分开，主窗与 iframe 不会互相踢下线', () => {
    // 共用一个全局变量时，给第二个窗口安装会把第一个窗口判成退役
    expect(captureSrc).not.toContain('let activeTapFetch: any = null;');
    expect(captureSrc).toContain('activeTapByWin.set(w, tapFetch);');
    expect(captureSrc).toContain('const prevActive: any = activeTapByWin.get(w);');
  });

  it('采集标记透传读被包住的原始函数', () => {
    expect(captureSrc).toContain('const prevFetchFn: any = w.fetch;');
    expect(captureSrc).toContain("get: () => (prevFetchFn as any).__aus_patched === true,");
    expect(captureSrc).not.toContain('if ((prevFetch as any).__aus_patched === true)');
  });

  it('新代上岗时清掉旧代的在岗标记，避免重扫时误判', () => {
    expect(captureSrc).toContain('(tapFetch as any).__ausTapActive = true;');
    expect(captureSrc).toContain('try { prevActive.__ausTapActive = false; } catch {}');
    expect(captureSrc).toContain('if ((w.fetch as any).__ausTapActive === true) return;');
  });

  it('卸载后残留的探针层一律作废', () => {
    expect(captureSrc).toContain('try { if (activeTapByWin.get(w) === cur?.fetch) activeTapByWin.delete(w); } catch {}');
  });
});
