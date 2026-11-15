/**
 * 版本号单一来源。
 *
 * Vite 在构建时把标识符 __APP_VERSION__ 替换成 manifest.json#version 的字面量
 * （见 vite.config.ts 的 define）。注意：只有「裸标识符」会被替换，
 * `globalThis.__APP_VERSION__` 这种属性访问在运行时并不存在 → 恒为 undefined，
 * 因此所有取版本号的地方都必须 import 这里的常量，禁止再用 globalThis 读。
 */
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '';
