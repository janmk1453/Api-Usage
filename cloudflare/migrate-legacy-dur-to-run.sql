-- 把旧客户端（app_version < 3.1.9）上报的「使用时长」整段改为「酒馆运行时长」
-- 背景：3.1.9 之前，「使用时长」统计的其实是「页面加载 → 本次上报」的墙钟时间，
--       3.1.9 起才只在真正打开面板后计时，酒馆运行时长另由 run_ms 增量上报。
-- 迁移后：device_daily / device_hourly 的旧版本行 dur_ms 归零、run_ms 承接原值；
--        device 累计列只搬「旧版本行那一部分」，新版本行的真实使用时长保持不动。
-- 可安全重复执行：旧版本行的 dur_ms 迁移后为 0，再次执行为空操作。
CREATE TABLE IF NOT EXISTS _legacy_dur (device_id TEXT PRIMARY KEY, legacy_ms INTEGER NOT NULL);
DELETE FROM _legacy_dur;
INSERT INTO _legacy_dur (device_id, legacy_ms)
  SELECT device_id, SUM(dur_ms) FROM device_daily WHERE app_version < '3.1.9' GROUP BY device_id;
UPDATE device SET
  run_ms_total = run_ms_total + MIN(dur_ms_total, COALESCE((SELECT legacy_ms FROM _legacy_dur WHERE _legacy_dur.device_id = device.device_id), 0)),
  dur_ms_total = dur_ms_total - MIN(dur_ms_total, COALESCE((SELECT legacy_ms FROM _legacy_dur WHERE _legacy_dur.device_id = device.device_id), 0));
UPDATE device_daily SET run_ms = run_ms + dur_ms, dur_ms = 0 WHERE app_version < '3.1.9' AND dur_ms > 0;
UPDATE device_hourly SET run_ms = run_ms + dur_ms, dur_ms = 0 WHERE app_version < '3.1.9' AND dur_ms > 0;
DROP TABLE _legacy_dur;
