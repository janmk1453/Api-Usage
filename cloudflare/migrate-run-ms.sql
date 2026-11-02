-- 已有库补充酒馆运行时长列：device.run_ms_total + device_daily.run_ms + device_hourly.run_ms
-- 可重复执行（列已存在时 SQLite 会报 duplicate column，忽略即可）；
-- 未迁移时 Worker 会自动降级到旧语句集合，旧版客户端上报不受影响。
ALTER TABLE device ADD COLUMN run_ms_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE device_daily ADD COLUMN run_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE device_hourly ADD COLUMN run_ms INTEGER NOT NULL DEFAULT 0;
