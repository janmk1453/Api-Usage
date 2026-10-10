# 匿名使用统计接收端（Cloudflare Worker + D1）

本目录是扩展「API用量统计」匿名使用统计的自建接收端与数据看板。整个方案只用 Cloudflare 免费额度：一个 Worker（接收上报、提供看板）+ 一个 D1 数据库（存聚合数据），不依赖任何第三方统计服务。

## 目录内容

| 文件 | 作用 |
| --- | --- |
| `worker.js` | Worker 入口：`POST /collect`、`GET /dashboard`、`GET /api/summary`、`GET /health`，以及每月清理的定时任务 |
| `payload.js` | 上报体白名单校验与数值钳制（纯函数，有单元测试） |
| `schema.sql` | D1 建表脚本（`device` 设备快照 + `device_daily` 逐设备日数据） |
| `wrangler.toml` | Worker 配置模板（D1 绑定、Cron、文本模块规则）；`database_id` 保持占位符，真实值放本地 `wrangler.local.toml` |
| `dashboard.html` | 看板页模板，作为文本模块打包进 Worker |

## 部署步骤

在仓库根目录（`cloudflare/` 的上一级）执行：

```bash
# 1. 登录 Cloudflare（浏览器授权一次）
npx wrangler login

# 2. 创建 D1 数据库，记下返回的 database_id
npx wrangler d1 create api_usage_stat

# 3. 生成本地部署配置（含账号私有信息，已在 .gitignore 中，切勿提交）
#    把 cloudflare/wrangler.toml 复制为 cloudflare/wrangler.local.toml，
#    并把 database_id 替换为上一步返回的真实值
cp cloudflare/wrangler.toml cloudflare/wrangler.local.toml

# 4. 建表（远程库）
npx wrangler d1 execute api_usage_stat --remote --file cloudflare/schema.sql

# 5. 设置看板访问口令（自定义一个足够长的随机串）
npx wrangler secret put DASHBOARD_TOKEN

# 6. 部署（使用本地配置，其中含真实 database_id）
cd cloudflare
npx wrangler deploy -c wrangler.local.toml
```

> 仓库内的 `wrangler.toml` 只保留占位符，请不要把真实的 `database_id`、账号 ID、API Token 等信息写进任何被提交的文件；`wrangler.local.toml` 与 `.dev.vars` 已在 `.gitignore` 中忽略。

部署成功后会输出访问地址：

- 未绑自定义域名时是 `https://api-usage-stat.<你的子域>.workers.dev`；**推荐同时绑定自有域名**（本仓库当前部署使用 `https://stat.janmk.us.ci`），原因见下文「大陆用户无法上报」。
- 看板：`<地址>/dashboard`（浏览器会弹出用户名/口令框，用户名任意，口令填第 5 步设置的令牌）
- 上报端点：`<地址>/collect`

## 接入客户端

把上报端点写进扩展常量并重新构建：

1. 打开 `src/services/telemetry.ts`，把 `TELEMETRY_ENDPOINT` 改为你的 `/collect` 地址；
2. 在仓库根目录执行 `npm run build`，提交构建产物（`index.js` 与随之更新的分包）；
3. 扩展内「设置 → 匿名使用统计」应显示"已开启：成功上报 N 次"；此前显示"未配置上报端点"是预期行为（占位符不会发任何请求）。

## 本地调试

```bash
cd cloudflare
npx wrangler d1 execute api_usage_stat --local --file schema.sql   # 建本地库
npx wrangler dev --local -c wrangler.local.toml                    # 本地启动，默认 http://127.0.0.1:8787
```

本地调试时可以把 `TELEMETRY_ENDPOINT` 临时指向本地地址（或直接用 curl 手工发一条上报体）：

```bash
curl -i -X POST http://127.0.0.1:8787/collect \
  -H 'Content-Type: text/plain;charset=UTF-8' \
  --data '{"v":1,"id":"0123456789abcdef0123456789abcdef","seq":1,"day":"2026-10-10","tz":8,"app":"3.1.1","env":{"b":"Chrome","bv":"141","os":"Windows","arch":"x86_64","lang":"zh-CN","w":"gt1024","dark":false,"standalone":false,"touch":false},"s":{"opens":1,"dur_ms":60000,"pages":{"overview":2,"stats":0,"history":0,"forecast":0,"wallet":0,"settings":0,"help":0,"about":0},"render":[1,0,0,0,0]},"daily":true}'
```

## 免费额度与省额度设计

Cloudflare 免费额度（2026 年 4 月官方文档）：Workers **10 万请求/天**；D1 **读 500 万行/天、写 10 万行/天、存储 5 GB**。本方案在几个环节做了压缩：

| 环节 | 做法 | 效果 |
| --- | --- | --- |
| 请求次数 | 客户端在会话内只累加，关闭面板/页面隐藏时才合并上报 | 每设备每天通常 1~3 个请求 |
| CORS | 上报体用 `text/plain` 简单请求 + `sendBeacon` | 不触发 OPTIONS 预检，一次上报只算 1 个请求 |
| 写入行数 | 逐设备每天一行 upsert 累加；设备快照表每设备只写一次、最多每 7 天回写一次 | 每次上报约 1~2 行写 |
| 幂等 | `device_daily.last_seq < seq` 才更新 | 重发/重复提交不产生额外行写，也不重复计数 |
| 读取行数 | 按天查询走 `day` 索引；环境分布一次取回后在 Worker 内聚合；看板**不做缓存**，每次交互实时查询 | 单次查询只扫目标天数的行；看板为开发者手动查看，请求量极低 |
| 保留期 | 每月 1 号清理超过 730 天的逐设备日数据（设备快照表保留） | 长期占用远低于 5 GB |

估算：若日活 1 万台设备、每台每天上报 1 次，约消耗 1 万请求、2 万行写、看板查询数万行读，均在免费额度内。

## 隐私边界

采集字段严格限定为：匿名随机标识、上报序号、客户端本地日期、时区偏移、扩展版本、浏览器名与主版本、操作系统、CPU 架构、语言、窄屏分桶、深色偏好、standalone、触屏标记、8 个页面使用次数、打开面板次数、会话时长、面板渲染耗时分桶。

不采集、不存库的内容包括：IP 地址、User-Agent 原文、对话名称或内容、模型名、密钥信息、余额与费用、接口地址、历史条数、精确屏幕分辨率。Worker 只把校验后的白名单字段写入 D1，原始请求体不做持久化，也不开启访问日志。

## 运维

```bash
# 看最近 7 天的整体情况
npx wrangler d1 execute api_usage_stat --remote --command \
  "SELECT day, COUNT(DISTINCT device_id) AS devices, SUM(opens) AS opens FROM device_daily WHERE day >= date('now','-7 day') GROUP BY day ORDER BY day"

# 查看某天的页面使用率
npx wrangler d1 execute api_usage_stat --remote --command \
  "SELECT SUM(p_overview) overview, SUM(p_stats) stats, SUM(p_history) history, SUM(p_forecast) forecast, SUM(p_wallet) wallet, SUM(p_settings) settings, SUM(p_help) help, SUM(p_about) about FROM device_daily WHERE day = date('now')"

# 手动清理超过保留期的数据（正常由定时任务完成）
npx wrangler d1 execute api_usage_stat --remote --command \
  "DELETE FROM device_daily WHERE day < date('now','-730 day')"

# 用户要求删除其数据（需要对方提供设置页显示的匿名标识前 8 位）
npx wrangler d1 execute api_usage_stat --remote --command \
  "DELETE FROM device_daily WHERE device_id LIKE 'xxxxxxxx%'; DELETE FROM device WHERE device_id LIKE 'xxxxxxxx%'"
```

## 常见问题

- **大陆用户无法上报**：`*.workers.dev` 在大陆被定点阻断（DNS 污染 + SNI 阻断，实测换子域无效，而 Cloudflare 边缘自身可达），只用 workers.dev 时只有挂代理的客户端能上报。**推荐给 Worker 绑定自有域名**（本仓库当前部署使用 `stat.janmk.us.ci`），把域名的 NS 托管到 Cloudflare 后按下面配置：

  ```toml
  [[routes]]
  pattern = "stat.你的域名"
  custom_domain = true
  ```

  再执行 `npx wrangler deploy`，并把 `src/services/telemetry.ts` 的 `TELEMETRY_ENDPOINT` 换成 `https://stat.你的域名/collect` 后重新构建。
- **看板 401**：未设置 `DASHBOARD_TOKEN`，或浏览器缓存了错误口令；重新 `npx wrangler secret put DASHBOARD_TOKEN` 后换浏览器隐私窗口访问。
- **设置页一直显示"未配置上报端点"**：`TELEMETRY_ENDPOINT` 仍是占位符，按上文「接入客户端」修改后重新构建。
- **不同时间范围的数字不一致**：看板已不做缓存，各范围读的是同一份实时数据；若仍不一致，说明两次查询之间确实有新上报进来（对比顶部"数据生成于"时间即可确认）。
- **上报返回 400**：上报体被校验拒绝（字段非法、日期超出窗口、体长超过 4 KB），可先用上面的 curl 示例确认端点本身可用。
