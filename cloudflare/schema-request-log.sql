-- 请求日志接收表（设置 → 请求日志 → 上传）
-- 只存归一化之后的字段：外层元数据 + payload（整条记录的 JSON 文本）。
-- 与应用内其他表无关，可单独创建；已有库执行本文件即可，无需重建其他表。
CREATE TABLE IF NOT EXISTS request_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at  INTEGER NOT NULL,
  ip_hash      TEXT    NOT NULL,
  app_version  TEXT,
  user_agent   TEXT,
  time_zone    TEXT,
  language     TEXT,
  bytes        INTEGER NOT NULL,
  payload      TEXT    NOT NULL
);

-- 按时间倒序取最近若干条（管理接口 / 清理）
CREATE INDEX IF NOT EXISTS idx_request_log_received ON request_log (received_at DESC);
-- 按来源 IP 哈希做限流计数
CREATE INDEX IF NOT EXISTS idx_request_log_ip ON request_log (ip_hash, received_at);
