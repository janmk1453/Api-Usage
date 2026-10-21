-- API用量统计 · 匿名使用统计：已有库补充设备颜色模式列
-- 执行：
--   npx wrangler d1 execute api_usage_stat --remote --file cloudflare/migrate-theme-mode.sql
--
-- 新增 device.theme_mode 列，保存扩展设置里的颜色模式（light / dark / auto）。
-- 存量设备在下次上报前保持 NULL（看板显示为「未上报」）。
-- 重复执行会报 duplicate column name，属正常提示（说明已迁移完成）。
-- 未执行也不影响上报：Worker 会自动降级为不含该列的语句。
ALTER TABLE device ADD COLUMN theme_mode TEXT;
