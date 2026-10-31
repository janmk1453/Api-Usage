/**
 * 看板模板渲染：纯函数，负责把首屏数据安全地塞进 dashboard.html。
 *
 * 约定：
 *   - dashboard.html 是单文件零依赖页面，只有一个数据占位符 `<%= TEL_BOOT %>`
 *     与一个构建标识占位符 `__TEL_BUILD__`；
 *   - JSON 里的标记字符 `<` 统一转义成 `\\u003c`，避免上报里的 `</script>` 提前闭合脚本；
 *   - 本模块不碰数据查询，便于单独测试（只验证「注入 + 转义 + 占位符唯一」）。
 */
export const PLACEHOLDER_BOOT = '<%= TEL_BOOT %>';
export const PLACEHOLDER_BUILD = '__TEL_BUILD__';

/** 看板构建标识：改动 dashboard.html 时同步更新，页头据此确认浏览器拿到的是新页面 */
export const BUILD_ID = '2026-10-31.1';

/** 序列化首屏数据：转义 <、> 与行分隔符，保证内联进 <script> 一定安全 */
export function serializeBoot(boot) {
  return JSON.stringify(boot ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** 把首屏数据与构建标识注入模板；占位符缺失直接抛错，避免部署出一个空看板 */
export function renderDashboard(template, boot, buildId = BUILD_ID) {
  if (typeof template !== 'string' || !template.includes(PLACEHOLDER_BOOT)) {
    throw new Error('dashboard.html 缺少首屏数据占位符');
  }
  const payload = serializeBoot(boot);
  return template
    .split(PLACEHOLDER_BOOT).join(payload)
    .split(PLACEHOLDER_BUILD).join(String(buildId));
}
