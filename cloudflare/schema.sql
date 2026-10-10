-- API用量统计 · 匿名使用统计（Cloudflare D1）
-- 首次部署执行：
--   npx wrangler d1 execute api_usage_stat --remote --file cloudflare/schema.sql

-- 设备环境快照：每台匿名设备一行，首次上报写入，之后仅按周回写活跃时间与版本
CREATE TABLE IF NOT EXISTS device (
  device_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  app_version TEXT,
  browser TEXT,
  browser_major TEXT,
  os TEXT,
  arch TEXT,
  lang TEXT,
  width_bucket TEXT,
  dark INTEGER,
  standalone INTEGER,
  touch INTEGER,
  tz_offset REAL
);

-- 逐设备日数据：每设备每天一行，重复上报在库内累加（last_seq 保证幂等）
CREATE TABLE IF NOT EXISTS device_daily (
  day TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  opens INTEGER NOT NULL DEFAULT 0,
  dur_ms INTEGER NOT NULL DEFAULT 0,
  p_overview INTEGER NOT NULL DEFAULT 0,
  p_stats INTEGER NOT NULL DEFAULT 0,
  p_history INTEGER NOT NULL DEFAULT 0,
  p_forecast INTEGER NOT NULL DEFAULT 0,
  p_wallet INTEGER NOT NULL DEFAULT 0,
  p_settings INTEGER NOT NULL DEFAULT 0,
  p_help INTEGER NOT NULL DEFAULT 0,
  p_about INTEGER NOT NULL DEFAULT 0,
  r0 INTEGER NOT NULL DEFAULT 0,
  r1 INTEGER NOT NULL DEFAULT 0,
  r2 INTEGER NOT NULL DEFAULT 0,
  r3 INTEGER NOT NULL DEFAULT 0,
  r4 INTEGER NOT NULL DEFAULT 0,
  app_version TEXT,
  last_seq INTEGER NOT NULL DEFAULT 0,
  first_ts INTEGER,
  last_ts INTEGER,
  PRIMARY KEY (day, device_id)
);

-- 按天聚合查询（日活、折线、窗口统计）走该索引，避免全表扫描
CREATE INDEX IF NOT EXISTS idx_device_daily_day ON device_daily (day);

-- 设备表按最近活跃排序/清理时使用
CREATE INDEX IF NOT EXISTS idx_device_last_seen ON device (last_seen);
