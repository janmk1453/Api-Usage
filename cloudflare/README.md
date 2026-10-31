# 匿名使用统计接收端（Cloudflare Worker + D1）

本目录是扩展「API用量统计」匿名使用统计的自建接收端与数据看板。整个方案只用 Cloudflare 免费额度：一个 Worker（接收上报、提供看板）+ 一个 D1 数据库（存聚合数据），不依赖任何第三方统计服务。

## 目录内容

| 文件 | 作用 |
| --- | --- |
| `worker.js` | Worker 入口：`POST /collect`、`GET /dashboard`、`GET /api/summary`、`GET /api/trend`、`GET /health`，以及每月清理的定时任务 |
| `api.js` | 看板只读聚合层：设备/日/小时/今日/累计/渲染耗时查询、`buildSummary`、`buildTrend`、`buildBootPayload`、`respondWithCache`；不碰写入，可被离线预览脚本直接复用 |
| `boot.js` | 看板模板注入（纯函数）：`serializeBoot` 转义、`renderDashboard` 替换占位符、`BUILD_ID` 构建标识 |
| `summary.js` | 看板聚合纯函数（日期与小时基准、趋势窗口归一、计数截断、时长分桶、渲染耗时估算、环境画像），`summary.test.js` 覆盖 |
| `payload.js` | 上报体白名单校验与数值钳制（纯函数，`payload.test.js` 覆盖） |
| `worker.test.js` | Worker 接口测试：鉴权、`/collect` 契约、看板首屏注入、总计/趋势口径、定时清理 |
| `schema.sql` | D1 建表脚本（`device` 设备维度汇总 + `device_daily` 逐设备日数据 + `device_hourly` 逐设备小时数据），新库直接执行 |
| `migrate-device-totals.sql` | 已有库的一次性迁移与回填脚本（新增累计列并用 `device_daily` 回填） |
| `migrate-backfill-device-totals.sql` | 只做累计列回填与校验（可安全重复执行），用于「列已存在」或需要重新回填时 |
| `migrate-hourly.sql` | 已有库升级到小时粒度趋势（新增 `device_hourly` 表与索引，不改动既有表，可安全重复执行） |
| `migrate-st-version.sql` | 已有库补充 `device.st_version` 酒馆版本号列（不改动既有数据，重复执行会提示列已存在） |
| `migrate-tt-version.sql` | 已有库补充 `device.tt_version` TauriTavern 版本号列（不改动既有数据，未执行时 Worker 自动降级并保留 `st_version`） |
| `migrate-device-metrics.sql` | 已有库补充 `device.history_count` 与 `device.telemetry_off` 两列（未执行时 Worker 自动回退旧列集合，不影响上报） |
| `migrate-theme-mode.sql` | 已有库补充 `device.theme_mode` 颜色模式列（light / dark / auto，未执行时 Worker 自动降级为不写该列，不影响上报） |
| `wrangler.toml` | Worker 配置模板（D1 绑定、Cron、文本模块规则）；`database_id` 保持占位符，真实值放本地 `wrangler.local.toml` |
| `dashboard.html` | 看板页（单文件零依赖，自绘 SVG 图表），作为文本模块打包进 Worker |
| `dashboard.test.js` | 看板模板与注入测试：占位符唯一、无外部资源、五视图结构与 `serializeBoot` 转义 |
| `scripts/build-preview.mjs` | 用 D1 REST 直接生成「真实数据 + 看板」的离线单文件，用于本地/离线验收 |

除 Worker 与 D1 之外没有其它外部依赖：看板图表全部自绘，仓库内不含任何第三方图表库文件。

## 部署步骤

在仓库根目录（`cloudflare/` 的上一级）执行：

```bash
# 1. 登录 Cloudflare（浏览器授权一次）
npx wrangler login

# 2. 创建 D1 数据库，记下返回的 database_id
npx wrangler d1 create api_usage_stat

# 3. 生成本地部署配置（含账号私有信息，已在 .gitignore 中，切勿提交）
cp cloudflare/wrangler.toml cloudflare/wrangler.local.toml
#    并把 database_id 替换为上一步返回的真实值

# 4. 建表（新库）；已有库跳过这步，改跑下面的迁移脚本
npx wrangler d1 execute api_usage_stat --remote --file cloudflare/schema.sql

# 5. 设置看板访问口令（自定义一个足够长的随机串）
npx wrangler secret put DASHBOARD_TOKEN

# 6. 部署（使用本地配置，其中含真实 database_id）
cd cloudflare
npx wrangler deploy -c wrangler.local.toml
```

### 已有库升级（新增设备累计列）

看板的总计与画像依赖 `device` 表的累计列。若数据库是旧版本建的，先执行一次迁移，**再部署新版 Worker**：

```bash
npx wrangler d1 execute api_usage_stat --remote --file cloudflare/migrate-device-totals.sql
npx wrangler deploy -c cloudflare/wrangler.local.toml
```

- 迁移脚本一次完成三件事：A 加列、B 用 `device_daily` 整体回填、C 输出校验（`mismatch_rows` 应为 `0`）。
- Wrangler 执行 SQL 文件时遇到错误会中止整个文件。若 A 段报 `duplicate column name`（说明此前已加过列）或需要重新回填，请改跑 `cloudflare/migrate-backfill-device-totals.sql`——它只做回填与校验，可安全重复执行。
- 新库（第 4 步用 `schema.sql` 建的库）已包含全部列，不需要跑迁移。
- 顺序必须是「先回填、再部署」：新版 Worker 会把每次上报的增量累加进累计列，若先部署再回填，回填会整体覆盖累计值。
- 回填与部署之间的窗口（通常几分钟）内的上报不会计入累计列，建议在低活跃时段执行；`device_daily` 明细不受影响（趋势与当日数据照常统计）。

### 已有库升级（新增小时粒度趋势）

小时粒度趋势依赖 `device_hourly` 表。已有库执行一次迁移即可，新旧 Worker 均可安全共存：

```bash
npx wrangler d1 execute api_usage_stat --remote --file cloudflare/migrate-hourly.sql
```

- 只新增表与索引，不修改既有表结构，可安全重复执行。
- **未执行迁移也不会影响上报**：新版 Worker 写入小时表失败时会自动降级为原有的 `device` + `device_daily` 两条写入，`/collect` 仍返回 `204`，旧版本扩展照常上报；只是看板的小时粒度视图会提示尚未迁移。
- 小时数据只保留 180 天（日数据仍为 730 天），迁移只能从此刻开始积累，历史小时无法回溯。

其他可选列的迁移脚本见目录内容一节（`migrate-device-metrics.sql` 等），可按需执行；未执行时 Worker 会走兼容降级，不影响 `/collect`。

### 已有库升级（新增酒馆版本号列）

看板「用户与设备画像」中的酒馆版本分布依赖 `device.st_version`：

```bash
npx wrangler d1 execute api_usage_stat --remote --file cloudflare/migrate-st-version.sql
```

- 只新增一列，不改动既有数据；重复执行会提示 `duplicate column name`，正常忽略即可。
- **未执行迁移也不会影响上报**：Worker 会先尝试带该列的写入，失败后自动回退到旧列集合，`/collect` 仍返回 `204`；只是酒馆版本分布暂时为空。

### 已有库升级（新增 TauriTavern 版本号列）

看板「用户与设备画像」中的 TauriTavern 版本分布依赖 `device.tt_version`：

```bash
npx wrangler d1 execute api_usage_stat --remote --file cloudflare/migrate-tt-version.sql
```

- 该列只在 TauriTavern 宿主下由客户端上报（取宿主 `/version` 的 `tauriVersion`），上游 SillyTavern 不产生该字段，因此分布只统计真正上报过的设备。
- **未执行迁移也不会影响上报**：Worker 的降级链为「完整列 → 无 `tt_version` 但保留 `st_version` → 旧列集合」，`/collect` 始终返回 `204`。
- 历史行保持 `NULL` 直到该设备下次上报，无法回溯补采。

> 仓库内的 `wrangler.toml` 只保留占位符，请不要把真实的 `database_id`、账号 ID、API Token 等信息写进任何被提交的文件；`wrangler.local.toml` 与 `.dev.vars` 已在 `.gitignore` 中忽略。

部署成功后会输出访问地址：

- 未绑自定义域名时是 `https://api-usage-stat.<你的子域>.workers.dev`；**推荐同时绑定自有域名**（本仓库当前部署使用 `https://stat.janmk.us.ci`），原因见下文「大陆用户无法上报」。
- 看板：`<地址>/dashboard`（浏览器会弹出用户名/口令框，用户名任意，口令填上面设置的令牌）
- 上报端点：`<地址>/collect`

## 接入客户端

把上报端点写进扩展常量并重新构建：

1. 打开 `src/services/telemetry.ts`，把 `TELEMETRY_ENDPOINT` 改为你的 `/collect` 地址；
2. 在仓库根目录执行 `npm run build`，提交构建产物（`index.js` 与随之更新的分包）；
3. 扩展内「设置 → 匿名使用统计」应显示"已开启：成功上报 N 次"；此前显示"未配置上报端点"是预期行为（占位符不会发任何请求）。

## 看板

`/dashboard`（以及根路径 `/`）是一个**单文件零依赖**页面：HTML 里没有任何 `<script src>`、外部样式、字体或图表库，图表全部自绘 SVG。首屏数据由 Worker 直接内联成 `window.__TEL_BOOT__`（紧凑数组 JSON），浏览器拿到 HTML 就能渲染，不额外请求接口。

页面分五个视图，每个视图只回答一个问题；顶部只有**一个全局时间范围**（近 7 / 30 / 90 天或自定义起止），切视图不会重置。范围、粒度与所选指标写进地址 hash（如 `#/trends?r=30d&g=hour&m=users,views`），可直接分享或存成书签。

| 视图 | 回答的问题 | 主要内容 |
| --- | --- | --- |
| 概览 `#/overview` | 现在整体什么情况 | 3 条自动结论（活跃时段、版本覆盖与快慢）+ 4 张 KPI（活跃用户·日均 / 打开次数 / 使用时长 / 新增用户，均带环比）+ 活跃趋势图（可叠上一周期虚线）+ 今日卡（设备 / 新增 / 打开 / 时长 / 今日峰值时段）+ 页面构成 + 活跃时段 + 累计快照（全时段，不随范围变化） |
| 趋势 `#/trends` | 在往哪个方向走 | 指标多选（最多 3 个，单位不同的指标自动指数化到基准 100）+ 粒度按天 / 按小时 + 形态面积 / 折线 / 柱状 + 对比上一周期 + 当前指标数值表 + 页面表现表 + 24 小时分布 |
| 用户 `#/audience` | 谁在用、怎么用 | 设备总数 / 深色偏好 / 触屏 / 关闭匿名四项占比 + 扩展版本、酒馆版本、宿主版本分布 + 使用深度（人均页面浏览、单次打开时长）+ 面板宽度 / 指针类型 / 显示形态 / 时区 |
| 性能 `#/performance` | 面板打开得够快吗 | 平均渲染耗时与快慢标尺、P50 / P90（由 5 档估算）、慢样本占比 + 版本耗时分布与明细表（可排序）+ 结论与建议 |
| 自定义 `#/explore` | 想按任意维度切数据 | 维度 × 形态（条形 / 环形 / 占比条）× Top N（5 / 8 / 12 / 20）× 排序，即时预览，可保存为本机视图（最多 8 个，存 `localStorage`）并把配置带进链接 |

界面与交互：

- **图表全部自绘 SVG**：`niceTicks` 取整刻度、单调三次插值平滑曲线、渐变面积、十字线与悬浮读数。没有第三方图表库，因此也不存在「图表库加载失败 / 只剩文本列表」的降级路径。
- 动效克制：入场错峰上浮、数字滚动、柱与折线的生长动画；`prefers-reduced-motion` 下全部降级为瞬时。
- 主题浅色 / 深色 / 跟随系统，首帧由内联脚本读 `localStorage` 恢复，不闪白；切主题即时重绘图表。
- 响应式：≥1280 常显侧栏；≤1120 收成 72px 图标栏；≤900 侧栏隐藏、改底部 5 项 tab；≤760 单列；≤620 表格隐藏次要列；图表随容器宽度重绘。
- 键盘：`⌘K` / `Ctrl+K` 打开命令面板，`1`–`5` 直切视图，`?` 看快捷键。

数据口径：

- 「累计打开 / 累计时长 / 人均」一律取 `device_daily` 的汇总（`api.js#lifetime`），**不用 `device.opens_total` / `device.dur_ms_total`**：那两列由 `last_seq` 幂等累加，补发或跨天重发时增量会被跳过（实测累计打开 2732 vs 日表 2746、时长 505h vs 561h）。设备数仍取 `device` 全表行数。
- `device_daily.sessions` / `device_hourly.sessions` 记的是**上报批次数**（Worker 每写一行 +1），不是用户会话数，看板不再展示这一项；「打开次数」用 `opens`，「使用时长」用 `dur_ms`。
- 活跃时段（24 小时分布）按窗口内 `device_hourly` 聚合，日均除数取「小时数据实际覆盖的天数」（小时表通常比日表短），因此不会因为缺天被摊平；峰值不做四舍五入，23 时这类峰能正常显示。
- 首屏内联的数据量：日趋势最长 730 天、小时趋势 32 天、按版本渲染耗时 30 天。性能页切到其它范围时按需请求 `GET /api/trend?parts=render&from=…&to=…` 补齐；其余视图全部用首屏数据本地重算，切换不产生请求。
- 其余口径不变：北京时间 UTC+8；环境维度取每台设备最近一次上报的状态；渲染耗时由客户端 5 档（<100 / <300 / <800 / <2000 / ≥2000ms，代表值 50 / 200 / 550 / 1400 / 3000ms）估算，用于版本间横向对比；使用时长按每台设备的累计时长分桶。

### 缓存与刷新

- `/dashboard`、`/api/summary`、`/api/trend` 都走 Cloudflare Cache API 缓存 **600 秒**，响应头 `X-Cache: HIT|MISS|BYPASS` 标明本次来源。
- 页面里的「刷新」用 `?force=1`：绕过缓存重新查库并回填；`?force=1` 会在页面加载后从地址栏清掉，复制出去的链接仍是干净地址。
- 页脚显示「数据生成于 … · 构建 …」，构建标识来自 `cloudflare/boot.js` 的 `BUILD_ID`；改动看板后同步更新它，用来确认浏览器拿到的是新页面。

## 接口

| 接口 | 说明 |
| --- | --- |
| `POST /collect` | 接收匿名上报，返回 `204`；兼容旧版扩展的上报体（`v1`、无 `ts`），新版新增可选 `ts`（毫秒时间戳，服务端归一为分钟精度） |
| `GET /api/summary` | 总计、当日、累计用户序列、面板累计、版本分布、环境画像、时长直方图；支持 `?force=1` |
| `GET /api/trend?from=YYYY-MM-DD&to=YYYY-MM-DD&parts=daily\|render\|both` | 每日趋势（不重复用户 / 打开次数 / 使用时长 / 面板明细）与按版本渲染耗时；支持 `?force=1` |
| `GET /api/trend?bucket=hour&from=YYYY-MM-DDTHH&to=YYYY-MM-DDTHH&parts=daily` | 小时粒度趋势（同上指标，X 轴为北京时间整点，缺失小时补 0，另返回累计用户序列）；缺省窗口为最近 24 小时，最长 180 天；支持 `?force=1` |
| `GET /dashboard` | 口令保护的看板页（也响应根路径 `/`）；首屏数据内联，支持 `?force=1` 绕过缓存 |
| `GET /health` | 健康检查，无需口令 |

除 `/collect` 与 `/health` 外都需要 HTTP Basic 口令（用户名任意，口令为 `DASHBOARD_TOKEN`）。

## 本地调试

```bash
cd cloudflare
npx wrangler d1 execute api_usage_stat --local --file schema.sql          # 建本地库
npx wrangler d1 execute api_usage_stat --local --file migrate-device-totals.sql  # 演练迁移（可选）
npx wrangler dev --local -c wrangler.local.toml                           # 默认 http://127.0.0.1:8787
```

本地调试时可以把 `TELEMETRY_ENDPOINT` 临时指向本地地址（或直接用 curl 手工发上报体）：

```bash
curl -i -X POST http://127.0.0.1:8787/collect \
  -H 'Content-Type: text/plain;charset=UTF-8' \
  --data '{"v":1,"id":"0123456789abcdef0123456789abcdef","seq":1,"day":"2026-10-10","tz":8,"app":"3.1.1","env":{"b":"Chrome","bv":"141","os":"Windows","arch":"x86_64","lang":"zh-CN","w":"gt1024","dark":false,"standalone":false,"touch":false},"s":{"opens":1,"dur_ms":60000,"pages":{"overview":2,"stats":0,"history":0,"forecast":0,"wallet":0,"settings":0,"help":0,"about":0},"render":[1,0,0,0,0]},"daily":true}'

# 看板接口（口令任意用户名 + DASHBOARD_TOKEN）
curl -u 'user:你的口令' 'http://127.0.0.1:8787/api/summary'
curl -u 'user:你的口令' 'http://127.0.0.1:8787/api/trend?parts=both'
curl -u 'user:你的口令' 'http://127.0.0.1:8787/api/summary?force=1'
```

想在不部署的情况下看真实数据的效果，可直接生成离线单文件（与线上 `/dashboard` 同源，用同一套 `buildBootPayload` + `renderDashboard`，双击即可打开）：

```bash
# 凭据：CLOUDFLARE_API_TOKEN（或 CLOUDFLARE_TOKEN_FILE 指向的文件）+ CLOUDFLARE_ACCOUNT_ID
# 库 ID 默认从 cloudflare/wrangler.local.toml 的 database_id 读取，也可用 CLOUDFLARE_DATABASE_ID 覆盖
node cloudflare/scripts/build-preview.mjs [输出路径]
```

单元测试（含看板模板注入、聚合与 Worker 接口契约，不需要网络）：

```bash
npm test          # 覆盖 cloudflare/*.test.js 与 src/**/*.test.ts
```

## 免费额度与省额度设计

Cloudflare 免费额度（2026 年 4 月官方文档）：Workers **10 万请求/天**；D1 **读 500 万行/天、写 10 万行/天、存储 5 GB**。本方案在几个环节做了压缩：

| 环节 | 做法 | 效果 |
| --- | --- | --- |
| 请求次数 | 客户端在会话内只累加，关闭面板/页面隐藏时才合并上报 | 每设备每天通常 1~3 个请求 |
| CORS | 上报体用 `text/plain` 简单请求 + `sendBeacon` | 不触发 OPTIONS 预检，一次上报只算 1 个请求 |
| 写入行数 | `device` 每次有效上报 1 行（累计列增量累加）+ `device_daily` 1 行 + `device_hourly` 1 行 | 每次上报 3 行写，重复上报 0 行；小时表缺失时自动降级为 2 行 |
| 幂等 | `device.last_seq < seq`、`device_daily.last_seq < seq` 与 `device_hourly.last_seq < seq` 三重判据 | 重发/重复提交不重复计数、不重复累加 |
| 读取行数 | 总计与画像走 `device` 表一次全表读（行数 = 设备数）；趋势按 `day` / `hour` 索引范围扫描（行数 = 桶数 × 桶内活跃设备） | 单次冷加载 ≈ 设备数 + 日活 + 2 × 窗口桶数 × 桶内活跃设备 |
| 缓存 | `/dashboard`、`/api/summary` 与 `/api/trend` 走 Cache API 600 秒 | 重复查看、切换范围与粒度都不会重复扫表；「刷新」按钮才强制重查 |
| 保留期 | 每月 1 号清理超过 730 天的逐设备日数据与超过 180 天的逐设备小时数据（设备维度汇总长期保留） | 长期占用远低于 5 GB |

读量估算：日活 5000、累计设备 2 万、趋势窗口 30 天时，单次冷加载约 `2 万 + 0.5 万 + 2 × 15 万 ≈ 33 万行`，配合 10 分钟缓存远低于 500 万行/天。若日后 30 天窗口的单次读行数逼近 100 万，可再加一层按日汇总表（本期未做）。

写量估算：日活 1 万台、每台每天上报 1 次时约 1 万次上报 → 3 万行写，远低于 10 万行/天；小时表按 180 天清理，长期行数约为日表的三分之一。

## 隐私边界

采集字段严格限定为：匿名随机标识、上报序号、客户端本地日期、**上报时刻（时间戳，服务端归一为分钟精度）**、时区偏移、扩展版本、**酒馆版本号**、**TauriTavern 版本号（仅该宿主有值）**、浏览器名与主版本、操作系统、CPU 架构、语言、窄屏分桶、系统深色偏好、**颜色模式（浅色 / 深色 / 跟随系统）**、standalone、触屏标记、8 个页面使用次数、打开面板次数、会话时长、面板渲染耗时分桶。分钟级时间戳仅用于按小时聚合趋势，旧版本扩展不含该字段时由服务端接收时间兜底，不影响上报。

服务端存储：

- `device`：每台匿名设备一行，保存最近一次上报的环境状态与去标识化的累计计数（累计打开次数、累计使用时长、各面板累计次数、首次出现日期、最近序号）；这些累计值由同一份白名单上报数据累加得到，不新增任何采集字段。
- `device_daily`：每台设备每天一行，保存当天分桶与计数，730 天后自动清理。
- `device_hourly`：每台设备每（北京时间）小时一行，保存该小时分桶与计数与分钟级首末上报时间，180 天后自动清理。

不采集、不存库的内容包括：IP 地址、User-Agent 原文、对话名称或内容、模型名、密钥信息、余额与费用、接口地址、精确屏幕分辨率。Worker 只把校验后的白名单字段写入 D1，原始请求体不做持久化，也不开启访问日志。

## 运维

```bash
# 看最近 7 天的整体情况
npx wrangler d1 execute api_usage_stat --remote --command \
  "SELECT day, COUNT(*) AS devices, SUM(opens) AS opens FROM device_daily WHERE day >= date('now','-7 day') GROUP BY day ORDER BY day"

# 查看某天的页面使用率
npx wrangler d1 execute api_usage_stat --remote --command \
  "SELECT SUM(p_overview) overview, SUM(p_stats) stats, SUM(p_history) history, SUM(p_forecast) forecast, SUM(p_wallet) wallet, SUM(p_settings) settings, SUM(p_help) help, SUM(p_about) about FROM device_daily WHERE day = date('now')"

# 校验设备累计列与逐设备日数据是否一致（迁移或排查时使用）
npx wrangler d1 execute api_usage_stat --remote --command \
  "SELECT COUNT(*) AS mismatch FROM device d JOIN (SELECT device_id, SUM(opens) o, SUM(dur_ms) m FROM device_daily GROUP BY device_id) a ON a.device_id = d.device_id WHERE d.opens_total <> a.o OR d.dur_ms_total <> a.m"

# 手动清理超过保留期的数据（正常由定时任务完成）
npx wrangler d1 execute api_usage_stat --remote --command \
  "DELETE FROM device_daily WHERE day < date('now','-730 day')"

npx wrangler d1 execute api_usage_stat --remote --command \
  "DELETE FROM device_hourly WHERE hour < strftime('%Y-%m-%dT%H', datetime('now','-180 day'))"

# 用户要求删除其数据（需要对方提供设置页显示的匿名标识前 8 位）
npx wrangler d1 execute api_usage_stat --remote --command \
  "DELETE FROM device_daily WHERE device_id LIKE 'xxxxxxxx%'; DELETE FROM device_hourly WHERE device_id LIKE 'xxxxxxxx%'; DELETE FROM device WHERE device_id LIKE 'xxxxxxxx%'"
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
- **看板数字比预期略旧**：接口默认缓存 10 分钟，页面顶部显示数据生成时间；点「刷新」按钮会 `?force=1` 强制取最新数据。
- **看板空白或只有骨架**：先强制刷新一次（`Ctrl+Shift+R`），再看浏览器 console 是否有脚本报错。确认服务端确实内联了首屏数据：`curl -u 'user:你的口令' https://你的域名/dashboard | grep -c '__TEL_BOOT__'` 应为 `1`。看板没有外部脚本与外部资源，这类问题通常来自前置代理截断或改写了 HTML。
- **看板图表画不出来**：图表是自绘 SVG，先确认浏览器不是过老（需支持 SVG、CSS 变量）；再确认没有被浏览器扩展注入的全局样式覆盖（例如给 `svg` 设了 `display:none`）。
- **更新看板后浏览器仍是旧版**：看页脚「构建」标识是否变化；`/dashboard` 响应带 `Cache-Control: no-store`，旧页面通常只是没有刷新（接口数据另有 600 秒缓存，点「刷新」可强取）。
- **迁移脚本报 `duplicate column name`**：说明这些列此前已经加过，改跑 `cloudflare/migrate-backfill-device-totals.sql`（只做回填与校验、可重复执行）即可，不必再加列。
- **想重新计算累计列**：同样跑 `cloudflare/migrate-backfill-device-totals.sql`；它会把累计列整体重算为 `device_daily` 的汇总值，因此请在部署新版 Worker 之前执行（否则会覆盖上线后累加进去的增量）。
- **当日数据看起来比「昨天」少**：趋势图按客户端本地日期（`day`）归集，而「当日新增」按北京时间计算；跨时区用户在 0 点~8 点之间的上报可能归到前一天，属预期现象。
- **设置页一直显示"未配置上报端点"**：`TELEMETRY_ENDPOINT` 仍是占位符，按上文「接入客户端」修改后重新构建。
- **上报返回 400**：上报体被校验拒绝（字段非法、日期超出窗口、体长超过 4 KB），可先用上面的 curl 示例确认端点本身可用。
