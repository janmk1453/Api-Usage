export {};

// SillyTavern 全局类型（按官方文档，需置于扩展根）
// 本地开发时指向 ST 仓库路径，构建时不影响产物
// 若 ST 未在本地检出，类型仅作编辑期提示，可忽略
// 路径1：用户范围安装  ../../../../public/global
// 路径2：服务器范围安装  ../../../../global
declare global {
  const SillyTavern: any;
  const getContext: any;
  const eventSource: any;
  const event_types: any;
  var TavernHelper: any;
  const __APP_VERSION__: string;
}

declare module '/script.js' {
  export const eventSource: any;
  export const event_types: any;
}
declare module '/scripts/extensions.js' {
  export function getContext(): any;
}
