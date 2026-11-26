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
    expect(interceptionSrc).toContain('activateCapture(patched);');
    // 上岗动作集中在 activateCapture：旧代标记退役 + 新代标记在岗 + 退避复位
    expect(interceptionSrc).toContain('activeCapture = fn;');
  });

  it('卸载后不留能继续记账的层', () => {
    expect(interceptionSrc).toContain('activeCapture = null;');
  });

  it('层数封顶 + 重装退避 + 安装失败不再静默', () => {
    // 硬上限：宿主反复重绑时停止再包一层，旧代直通（层数只增会导致每次请求都被解析 N 遍）
    expect(interceptionSrc).toContain('const MAX_CAPTURE_DEPTH = 6;');
    expect(interceptionSrc).toContain('if (depth > MAX_CAPTURE_DEPTH) {');
    expect(interceptionSrc).toContain("patched.__ausCaptureDepth = depth;");
    // 退避：被反复替换时把 4s 拉长到 60s，别和宿主互相刷层
    expect(interceptionSrc).toContain('const MAX_GUARD_BACKOFF_MS = 60_000;');
    expect(interceptionSrc).toContain('function growGuardBackoff(): void {');
    expect(interceptionSrc).toContain('if (Date.now() < nextInstallAllowedAt) return;');
    // 失败必须留痕：计数 + 采集日志 + 健康信号，绝不再被一个空 catch 吞掉
    expect(interceptionSrc).toContain('function noteInstallProblem(');
    expect(interceptionSrc).toContain("noteCaptureStage('install-failed'");
    expect(interceptionSrc).not.toContain('function ensureFetchCapture() {\n  try {\n    const p: any = (window as any).parent || window;\n    if (!p || !p.fetch || isAusFetchPatch(p.fetch)) return;\n    installFetchCapture();\n  } catch {}');
  });

  it('无主轮次尽量补记，但绝不借用别轮的现场', () => {
    // 拒凑 → 尽量记上：不再整轮丢弃
    expect(interceptionSrc).not.toContain('跳过估算补记');
    expect(interceptionSrc).toContain('按无主轮次估算补记');
    // 但开始时间与 requestId 必须留空，不能拿 lastStart / recentRequestId 顶上（串账根源）
    expect(interceptionSrc).toContain('const startedAt = turn?.startTime || null;');
    expect(interceptionSrc).toContain('const requestId = turn?.requestId || null;');
    expect(interceptionSrc).toContain("meta.interruptReason = String(meta.interruptReason || '') + '|turn-unmatched';");
  });

  it('探针身份用 getter 动态读内层，不再用 bind 产物上的快照标记', () => {
    // bind 出来的新函数不继承自定义属性，读它会永远读不到 → 两边守卫互相重包
    expect(interceptionSrc).toContain('const prevFetchFn: any = p.fetch;');
    expect(interceptionSrc).toContain("Object.defineProperty(patched, '__ausTapPatched'");
    expect(interceptionSrc).not.toContain('(rawFetch as any).__ausTapPatched === true) patched.__ausTapPatched = true;');
  });
});

/**
 * 上游错误被宿主包装成 200 的拒绝链（3.2.x 线上故障）。
 *
 * 重现条件在真机的上游 500（TT 的 Rust 后端把错误当 SSE 正文回 200），单测无法复现 fetch 链，
 * 所以用源码断言钉住三处接线：解析时记载荷、结算时传载荷、入库前先看载荷。
 */
describe('上游错误被包装成 200：拒绝入库而不是按输出估算', () => {
  it('响应解析阶段记下错误载荷', () => {
    expect(interceptionSrc).toContain("from './api-error-payload';");
    expect(interceptionSrc).toContain('detectApiErrorPayload');
    expect(interceptionSrc).toContain('function detectTurnErrorPayload(');
    expect(interceptionSrc).toContain('const errorTag = detectTurnErrorPayload(text, rawText);');
    expect(interceptionSrc).toContain('if (errorTag) turn.errorPayload = errorTag;');
  });

  it('无用量结算与正常入库两条路都先看载荷', () => {
    expect(interceptionSrc).toContain('const errorPayload = turn?.errorPayload || detectTurnErrorPayload(rawResponse, rawResponse);');
    expect(interceptionSrc).toContain('streamError: turn?.streamError || null,\n    errorPayload,');
    expect(interceptionSrc).toContain('if (errTurn && errTag) {');
  });

  it('拒绝的轮次留诊断快照，且不混进「对话未写入历史」', () => {
    expect(interceptionSrc).toContain("noteCaptureStage('entry-rejected'");
    expect(interceptionSrc).toContain("reason: 'api-error-payload:'");
    expect(interceptionSrc).toContain("turn.settledBy = 'rejected';");
    expect(interceptionSrc).not.toContain("noteCaptureStage('event-drop', { model, requestId: requestId || '', reason: 'api-error-payload'");
  });
});

describe('探针包装：按代际令牌判退役', () => {
  it('XHR 探针：安全读文本 + 首字节 + 中止也收尾', () => {
    // responseType 非 text 时读 responseText 会抛 InvalidStateError，老代码等于永远拿不到 usage
    expect(captureSrc).toContain('function readXhrText(');
    expect(captureSrc).not.toContain("readUsageFromText(String(this.responseText || ''))");
    // 首字节与「只收尾一次」：progress 记首字节，loadend / error / timeout / send 抛错 四条路径共用 finish
    expect(captureSrc).toContain("xhr.addEventListener('progress'");
    expect(captureSrc).toContain("xhr.addEventListener('loadend', () => finish());");
    expect(captureSrc).toContain("xhr.addEventListener('error', () => finish());");
    expect(captureSrc).toContain("xhr.addEventListener('timeout', () => finish());");
    expect(captureSrc).toContain('if (done) return;');
    // send 自己抛错也必须收尾，否则探针只剩 pending（fetch 分支的 rejection 已有对应处理）
    expect(captureSrc).toContain("finish('XHR send failed: '");
  });

  it('补扫节流 + 卸载后可重装', () => {
    // 流式输出会持续触发 MutationObserver，无节流等于每帧全量补扫所有 iframe
    expect(captureSrc).toContain('function scheduleScan(): void {');
    expect(captureSrc).toContain('observer = new MutationObserver(() => { scheduleScan(); });');
    // 还原闭包挂在 window 上，卸载后必须允许重新挂，否则重装时 fetch / XHR 再也还不回去
    expect(captureSrc).toContain('let restoreHooked = new WeakSet<object>();');
    expect(captureSrc).toContain('restoreHooked = new WeakSet<object>();');
  });

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

/**
 * 采集守卫的「假在岗」（3.2.3 真机事故）。
 *
 * 现象：一次重载后采集再也没记过任何一轮，持续几个小时；诊断包里 0 条 fetch-start、
 * 0 条 install-failed，只有越来越密的 turn-unmatched / event-drop。
 * 根因：守卫用 __aus_patched 布尔判在岗，而探针层把这个标记定义成「读内层」的 getter，
 * 内层采集代退役后它恒为 true、探针层又没有 __ausCaptureLayer —— 两条分支都不命中，
 * 4s 自愈守卫每轮都 early return：不重装，也不告警。
 */
describe('采集守卫：只认链上在岗代，不认标记布尔', () => {
  it('在岗判定必须顺着链摸到 activeCapture 本体', () => {
    expect(interceptionSrc).toContain("import { fetchChainHas, fetchChainKind, describeFetchChain } from './fetch-chain';");
    expect(interceptionSrc).toContain('return fetchChainHas(top, activeCapture);');
    // 老判据必须彻底消失，否则守卫会再次静默早退
    expect(interceptionSrc).not.toContain('function isAusFetchPatch(');
    expect(interceptionSrc).not.toContain('if (isAusFetchPatch(p.fetch))');
    // 顶层就是我们的某一代采集层时复用在岗，不新增层
    expect(interceptionSrc).toContain('if ((top as any).__ausCaptureLayer === true) {');
  });

  it('两边都要记录「被包住的下一层」，否则无法验证在岗', () => {
    expect(interceptionSrc).toContain('patched.__ausCaptureInner = prevFetchFn;');
    expect(captureSrc).toContain('(tapFetch as any).__ausTapInner = prevFetchFn;');
    // 探针夹在中间时层深不能断，否则采集的层深上限永远数不到顶
    expect(captureSrc).toContain('(tapFetch as any).__ausCaptureDepth = Number((prevFetchFn as any).__ausCaptureDepth) || 0;');
  });

  it('假在岗必须留痕，且不能混成安装失败', () => {
    expect(interceptionSrc).toContain('staleFlags: 0,');
    expect(interceptionSrc).toContain("noteCaptureStage('guard-recovered'");
    expect(interceptionSrc).toContain('function noteStaleCapture(');
    // 安装并没有失败：写 install-failed 会让健康信号误报成插件报错，install-failed 只能有一个调用点
    const installFailedHits = interceptionSrc.split("noteCaptureStage('install-failed'").length - 1;
    expect(installFailedHits).toBe(1);
  });

  it('卸载只还原自己那一代，不把压在上面的探针一起摘掉', () => {
    expect(interceptionSrc).toContain('let restoreTarget: any = null;');
    expect(interceptionSrc).toContain('restoreTarget = prevFetchFn;');
    expect(interceptionSrc).toContain('if (p && (p.fetch as any)?.__ausCaptureLayer === true && restoreTarget) {');
  });
});
