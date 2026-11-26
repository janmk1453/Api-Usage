/**
 * fetch 包装链的遍历与在岗判定（纯逻辑，无副作用）
 *
 * 为什么单独成文件：采集层（services/interception）与探针层（services/request-tap/capture）
 * 会互相把对方包进同一条 fetch 链，宿主（TauriTavern）还会在任意时刻重绑 fetch 把整条链换掉。
 * 判断「我们这一代还在不在岗」时**不能看标记布尔**——探针层为了让两边守卫不互相对套，
 * 把 __aus_patched 定义成「读内层」的 getter；内层采集代退役后它照样是 true。
 * 3.2.3 真机事故就是这样：自愈守卫每 4s 判一次「已在岗」，于是永不重装，采集静默几个小时，
 * 诊断包里连一条 install-failed 都没有（守卫根本没进安装分支）。
 *
 * 唯一可靠的判据是顺着链能不能摸到在岗那一代本体，所以把遍历逻辑抽出来单测。
 */

/** 采集层记录「被包住的下一层」的字段 */
export const CAPTURE_INNER_KEY = '__ausCaptureInner';
/** 探针层记录「被包住的下一层」的字段 */
export const TAP_INNER_KEY = '__ausTapInner';
/** 遍历封顶：够穿过探针层与宿主的几层包装，又不会在自指的链上死循环 */
export const FETCH_CHAIN_MAX_HOPS = 8;

export type FetchChainKind = 'capture' | 'tap' | 'other';

/** 这一层是我们哪一类包装：只认身份标记，不代表它还在岗 */
export function fetchChainKind(fn: any): FetchChainKind {
  if (typeof fn !== 'function') return 'other';
  if ((fn as any).__ausCaptureLayer === true) return 'capture';
  if ((fn as any).__ausTapActive === true) return 'tap';
  return 'other';
}

/** 取链上的下一层；宿主的包装不记录下一层，返回 null 表示到头 */
export function fetchChainInner(fn: any): any {
  if (typeof fn !== 'function') return null;
  const inner: any = (fn as any)[CAPTURE_INNER_KEY] || (fn as any)[TAP_INNER_KEY];
  return typeof inner === 'function' ? inner : null;
}

/**
 * 从 top 起沿链找 target（含 top 本身），最多 maxHops 跳。
 * target 为空表示「没有任何在岗层」——守卫必须据此重装，不能当成在岗。
 */
export function fetchChainHas(top: any, target: any, maxHops: number = FETCH_CHAIN_MAX_HOPS): boolean {
  if (!target) return false;
  let node: any = top;
  for (let hop = 0; hop <= maxHops; hop++) {
    if (!node) return false;
    if (node === target) return true;
    node = fetchChainInner(node);
  }
  return false;
}

/** 链上各层种类的可读描述（诊断用），例如 'tap>capture'、'other' */
export function describeFetchChain(top: any, maxHops: number = FETCH_CHAIN_MAX_HOPS): string {
  const parts: string[] = [];
  let node: any = top;
  for (let hop = 0; hop <= maxHops; hop++) {
    if (typeof node !== 'function') break;
    parts.push(fetchChainKind(node));
    node = fetchChainInner(node);
    if (!node) break;
  }
  return parts.length ? parts.join('>') : 'empty';
}
