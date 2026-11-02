/**
 * 设备类型判定（只回答一个问题：这台设备是不是「手指优先」的移动端）。
 *
 * 用途：「移动端兼容 UI」的默认值只按设备类型决定一次——移动端默认开启底栏，
 * 桌面端保持原样（原侧栏抽屉）。判定刻意不看窗口宽度：桌面端把窗口拖窄不该被当成移动端。
 * 入口与设置归一化都走 mobileDeviceHint()，结果在本次会话内缓存；
 * 一旦用户（或上一版扩展）把开关写进设置，后续版本就不会再碰它。
 */

let hint: boolean | null = null;

/** 由入口 / 测试注入：写死本次会话的设备判定结果（不再现场探测） */
export function setMobileDeviceHint(value: boolean): void {
  hint = value === true;
}

/** 是否已有判定结果（测试与调试用） */
export function hasMobileDeviceHint(): boolean {
  return hint !== null;
}

/** 清掉缓存（测试与调试用），下次 mobileDeviceHint() 会重新探测 */
export function resetMobileDeviceHint(): void {
  hint = null;
}

/**
 * 现场探测：UA 里的移动端关键字 + 粗指针（触屏）与多点触控。
 * 拿不到任何线索时按桌面端处理——桌面端保持原样是更保守的选择，
 * 也不会把窄窗口误判成手机。
 */
export function detectMobileDevice(): boolean {
  try {
    const nav: any = typeof navigator === 'undefined' ? null : navigator;
    const win: any = typeof window === 'undefined' ? null : window;
    const ua = String(nav?.userAgent || '');
    const touchPoints = Number(nav?.maxTouchPoints || 0);
    const uaMobile = /Android|iPhone|iPod|iPad|Mobile|Windows Phone|HarmonyOS|OpenHarmony/i.test(ua);
    // iPadOS 13+ 的桌面模式 UA 与 Mac 完全一致，只能靠触控点数区分
    const iPadDesktopMode = /Macintosh/i.test(ua) && touchPoints > 1;
    if (uaMobile || iPadDesktopMode) return true;
    const coarse = !!(win && typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches);
    return coarse && touchPoints > 0;
  } catch {
    return false;
  }
}

/** 本次会话的设备判定结果：已注入就用注入值，否则现场探测一次并缓存 */
export function mobileDeviceHint(): boolean {
  if (hint === null) hint = detectMobileDevice();
  return hint;
}
