/**
 * 版本号单一来源。
 *
 * Vite 在构建时把标识符 __APP_VERSION__ 替换成 manifest.json#version 的字面量
 * （见 vite.config.ts 的 define）。注意：只有「裸标识符」会被替换，
 * `globalThis.__APP_VERSION__` 这种属性访问在运行时并不存在 → 恒为 undefined，
 * 因此所有取版本号的地方都必须 import 这里的常量，禁止再用 globalThis 读。
 */
declare const __APP_VERSION__: string;
declare const __BUILD_NO__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '';

/**
 * 构建号：manifest.json#build_no → __BUILD_NO__。
 *
 * 用途只有两个：① 界面上显性展示，方便用户与反馈日志确认拿到的是哪一次构建；
 * ② 更新弹窗的「已读」判定键 = `版本号|构建号`，因此同一版本号重发修复版也能提示，
 * 不必为了提示而推进版本号。
 *
 * 规则（与 AGENTS.md 同步）：未经用户当轮明确要求不得改动；确需改动时在现有值上 +1，
 * 同一次发布内不要重复递增。
 */
export const BUILD_NO: string =
  typeof __BUILD_NO__ !== 'undefined' ? String(__BUILD_NO__) : '';

/** 更新弹窗的已读键：版本号 + 构建号；拿不到构建号时退回纯版本号 */
export const APP_BUILD_TAG: string = BUILD_NO ? `${APP_VERSION}|${BUILD_NO}` : APP_VERSION;
