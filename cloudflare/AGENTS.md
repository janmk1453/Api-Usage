# cloudflare/AGENTS.md — 匿名统计接收端分册

> 仓库根 `AGENTS.md` 的模块分册：改 `cloudflare/**` 前必读。接收端独立部署，不参与 Vite 构建与 CI。


## 匿名统计接收端（`cloudflare/`）

- 独立部署，不参与 Vite 构建与 CI；步骤见 `cloudflare/README.md`（`wrangler login` → `d1 create` → 填 `database_id` → `d1 execute --file cloudflare/schema.sql`（已有库按需跑各 `migrate-*.sql`）→ `secret put DASHBOARD_TOKEN` → `wrangler deploy`），部署后把 `/collect` 地址写进 `src/services/telemetry.ts#TELEMETRY_ENDPOINT` 并重新构建提交产物。
- 路由唯一分发点 `cloudflare/worker.js` 的 `const path = url.pathname.replace(/\/+$/, '') || '/'`；绑定与 Cron 在 `wrangler.toml`（`wrangler.local.toml` 被 gitignore 忽略，绝不提交真实 `database_id`）。
- **客户端 ↔ 接收端契约必须同步**：`cloudflare/log-payload.js` 的 `LOG_SCHEMAS = [1,2,3,4,5]`、`MAX_LOG_BODY_BYTES = 400000`、`MAX_REPORT_TARGETS = 8`；客户端升 `FEEDBACK_SCHEMA` 时忘了扩这里，线上直接 `400 bad_schema`。`normalizeReport` 归一 `scope/target/targets/targetTotal`，`normalizeDiagnostics` 归一 `evidence`，`normalizeHistoryRow` 必须保留 `usageSource/interrupted/estimateMethod`。改完先 `npx wrangler deploy` 让接收端上线。
- `payload.js`（白名单 + 数值钳制）、`summary.js`（聚合纯函数，`HISTORY_COUNT_CURVE_STEP/MID/WIDE_STEP`）、`log-payload.js`（诊断包归一）都要有对应测试。
