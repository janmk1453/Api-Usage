# cloudflare/AGENTS.md — 匿名统计接收端分册

> 仓库根 `AGENTS.md` 的模块分册：改 `cloudflare/**` 前必读。接收端独立部署，不参与 Vite 构建与 CI。


## 匿名统计接收端（`cloudflare/`）

- 独立部署，不参与 Vite 构建与 CI；步骤见 `cloudflare/README.md`（`wrangler login` → `d1 create` → 填 `database_id` → `d1 execute --file cloudflare/schema.sql`（已有库按需跑各 `migrate-*.sql`）→ `secret put DASHBOARD_TOKEN` → `wrangler deploy`），部署后把 `/collect` 地址写进 `src/services/telemetry.ts#TELEMETRY_ENDPOINT` 并重新构建提交产物。
- 路由唯一分发点 `cloudflare/worker.js` 的 `const path = url.pathname.replace(/\/+$/, '') || '/'`；绑定与 Cron 在 `wrangler.toml`（`wrangler.local.toml` 被 gitignore 忽略，绝不提交真实 `database_id`）。
- **客户端 ↔ 接收端契约必须同步**：`cloudflare/log-payload.js` 的 `LOG_SCHEMAS = [1,2,3,4,5]`、`MAX_LOG_BODY_BYTES = 400000`、`MAX_REPORT_TARGETS = 8`；客户端升 `FEEDBACK_SCHEMA` 时忘了扩这里，线上直接 `400 bad_schema`。`normalizeReport` 归一 `scope/target/targets/targetTotal`，`normalizeDiagnostics` 归一 `evidence`，`normalizeHistoryRow` 必须保留 `usageSource/interrupted/estimateMethod`。改完先 `npx wrangler deploy` 让接收端上线。
- `payload.js`（白名单 + 数值钳制）、`summary.js`（聚合纯函数，`HISTORY_COUNT_CURVE_STEP/MID/WIDE_STEP`）、`log-payload.js`（诊断包归一）都要有对应测试。

- **路由**（`worker.js` 唯一分发）：`POST /collect` 上报、`GET /dashboard` 看板页（口令校验）、`GET /vendor/echarts.js` 同源自托管 ECharts、`GET /api/summary`、`GET /api/trend`、`GET /api/log`、`GET /health`；每月 cron 清理；Cache API 缓存 10 分钟，`?force=1` 绕过。
- **D1 结构**（`schema.sql`）：`device` 设备维度汇总（环境取每设备最新状态 + `opens_total` / `dur_ms_total` / `p_*_total` 累计列 + `first_day` / `last_seq` + `app_version` / `st_version` / `history_count` / `telemetry_off` / `theme_mode`）、`device_daily` 逐设备日数据、`device_hourly` 逐设备小时数据（均按 `last_seq` 幂等）；请求日志表见 `schema-request-log.sql`。
- **迁移脚本（9 个，别重复造）**：`migrate-device-totals.sql`（新增累计列并用 `device_daily` 回填，**必须先回填再部署**）、`migrate-backfill-device-totals.sql`（只回填与校验，可重复执行）、`migrate-hourly.sql`、`migrate-st-version.sql`、`migrate-device-metrics.sql`、`migrate-theme-mode.sql`、`migrate-legacy-dur-to-run.sql`、`migrate-run-ms.sql`、`migrate-tt-version.sql`。未迁移时 Worker 自动回退旧列集合，旧版上报照常入库。
- **看板**（`dashboard.html` + `api.js` + `boot.js`）：口令保护，五个分区（总计 / 趋势 / 面板构成 / 画像 / 性能）；ECharts 必须同源自托管且**必须 full 构建**（simple 构建不含 Tooltip 组件，tooltip / axisPointer 会静默失效）；页头显示来源徽标与 `BUILD_ID`；移动端触屏点按固定数值提示（`touchstart` + `showTip`、`touchend` 补钉）。「历史记录条数分布」折线图由 `summary.js#historyCountCurve` 生成（X 轴分段：1–499 每 10 条、500–999 每 50 条、1000 以上合并，**0 条不计**，共 61 点；常量 `HISTORY_COUNT_CURVE_STEP` / `_MID` / `_WIDE_STEP` / `_MAX`）；每个趋势图独立时间控件默认 30 天；「增长与活跃趋势」6 图桌面固定一行 3 个（≤1180px 两列、≤860px 单列）。
