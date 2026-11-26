-- API用量统计 · 匿名使用统计：为 device 表补充「扩展构建号」列
-- 背景：manifest.json#build_no 会随修复版重发而递增，同一版本号（如 3.2.3）可能存在多个构建；
--       只记 app_version 时看板无法区分「谁装了 b4、谁还停在 b2」，因此新增 app_build 列。
-- 用法：npx wrangler d1 execute api_usage_stat --remote --file cloudflare/migrate-app-build.sql
-- 说明：
--   1. 本脚本只加列、不改旧数据，可重复执行；
--   2. 未执行时 Worker 自动降级为「不写 app_build」的语句（批次失败即换下一档），上报照常返回 204，
--      /api/summary 也不会请求该列；旧客户端本来就不上报构建号，看板记为「未知」属预期；
--   3. 历史行保持 NULL 直到该设备下次上报。

ALTER TABLE device ADD COLUMN app_build TEXT;
