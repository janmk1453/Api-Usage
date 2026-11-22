# AGENTS.md — API用量统计（Api-Usage）

> 本文件是**仓库级规则书 + 模块索引**；按目录的细节写在各自分册里，动手前先读对应分册。
> 工具提示压缩上下文时，直接在 `run_code` 里 `await tools.compress({ content: [...] })`，不要说没有该工具。
> 三条最高优先级：① 全程中文；② 没有用户当轮**明确要求**，禁止推进版本号、打标签、合并 `main`；③ 所有存 / 取 / 算 / 展必须走 `src/data/`。
> **分册加载机制**：DSH 只在我 read / write / edit 触及该目录文件后，才把该目录的 `AGENTS.md` 纳入下一轮上下文——不要假设它已在上下文里，跨模块动手前先显式 `read` 对应分册。

## 模块索引（动手前先读）

| 改动范围 | 必读分册 |
| --- | --- |
| `src/ui/**`、`style.css`、任一页面口径、导航与移动端、安卓返回键 | `src/ui/AGENTS.md` |
| `src/services/**`（采集拦截、TauriTavern 兼容层、强制更新、钱包服务、探针、诊断上传） | `src/services/AGENTS.md` |
| `src/data/**`、统计口径、去重 / 持久化、导入导出与 WebDAV | `src/data/AGENTS.md` |
| `src/stats/**`（预测与能耗） | `src/data/AGENTS.md` + `src/ui/AGENTS.md`（趋势预测段） |
| `cloudflare/**`（接收端、schema、迁移、看板） | `cloudflare/AGENTS.md` |
| `scripts/**`（校验与预览包） | `scripts/AGENTS.md` |
| `.github/**`（CI 与 Pages） | `.github/AGENTS.md` |
| 版本号 / 标签 / 发布 / 提交 | 本文件「版本与发布管控」「提交与发布」 |


## 概览

SillyTavern 原生扩展 `API用量统计`（清单 `api-usage-stat`），由酒馆助手脚本 `deepseek-tavern-script` 迁移而来，是一套自包含的用量记录 / 统计 / 预测 / 钱包面板。

- **仓库**：`Api-Usage`（`https://github.com/janmk1453/Api-Usage`），`main` 稳定发布 / `dev` 日常测试；本地检出目录即本仓库根。
- **只在 Api-Usage 开发**：重构迁移版的一切修改与产物都在此仓库；`pr/RE3.0` 仅同步产物备份，禁止在其上继续开发；构建与提交一律以本仓库为准。
- **脚本主线独立**：`pr/DeepSeek使用预测.js` 仍是脚本真源，扩展与脚本经 `deepseek-stat-export v1` 互通数据、互不覆盖，勿改脚本。
- **版本真源**：`manifest.json#version`（语义版本，文档禁止写死 `vX.Y.Z`）；**构建号真源** `manifest.json#build_no`（正整数）。`vite.config.ts` 注入 `__APP_VERSION__` / `__BUILD_NO__`，`src/constants/version.ts` 暴露 `BUILD_NO` 与 `APP_BUILD_TAG`（`版本号|构建号`）；侧栏品牌、设置页关于入口、关于页、更新弹窗、导出与检查更新全部取这两个值。
- **更新日志归属（挂起）**：`src/constants/changelog.ts` 视为用户专有内容，由用户手动维护——未经用户当轮明确要求，一律不得增删改任何条目。「每完成一项改动必须追加日志」的强制要求已暂停，风格范本见「提交与发布 → 日志文案风格」备用。

## 技术栈

- **打包**：Vite 8，`build.lib`（`es`）+ `outDir: 'dist'` + `emptyOutDir: true`，产物为 `dist/index.js` 与若干 hash 分包；`define` 注入 `process.env.NODE_ENV="production"`（修复浏览器 `process` 未定义）、`__APP_VERSION__`、`__BUILD_NO__`。
- **语言**：TypeScript 5，`strict`；`tsconfig.include = ["src", "global.d.ts"]`。
- **图表**：ECharts 6 按需引入（`echarts/core` + Bar/Line + Grid/Tooltip/Legend/CanvasRenderer），动态分包随 `dist/` 提交。`Y` 17 项（Token / 费用 / 请求与性能 / 比率四组）×`X` 5 维度（轮次 / 每小时 / 每日 / 每周 / 每月），渲染按 `Y.kind` 分流：`token` 堆叠柱、`cost/duration/rate/percent` 曲线（右侧独立轴，百分比 0–100）、`count` 柱；费用轴按币种换算。
- **样式**：无框架。`[data-extension="api-usage-stat"][data-ds-theme="light|dark"]` 隔离宿主 `SmartTheme`；`style.css` 是**手写样式源**（非产物，留在根目录，`manifest.css` 指向它，Vite 不产 CSS）——四套同名变量 + `services/theme.ts` 切换 + 设置页胶囊下拉；默认 `light`。
- **存储**：`extensionSettings[api_usage_stat]` 热 `50` 条 + IndexedDB `api_usage_stat_db` 冷分页（`MAX_HISTORY = 2000`，超出自动回冷库）；钱包配置 / 忽略列表 / `overviewWalletId` / `overviewWalletManuallySet` 随热设置持久化；**钱包校准密钥**单独存 `extensionSettings.walletSecrets`（XOR 混淆，不参与导出 / WebDAV）；**匿名统计**的匿名标识与待发数据单独存 `extensionSettings.telemetry`（不进 `state.settings`，因而不参与导出、导入与同步）。
- **最低版本**：`manifest.minimum_client_version 1.11.0`；hooks 机制要 1.17.0、`clean` 钩子要 1.18.0；API 密钥条目编号要 `>= 1.14.0`（更早版本归入「未识别密钥」）。

## 目录

```
Api-Usage/
├── manifest.json           # 扩展清单 + version/build_no 真源 + hooks.clean
├── style.css               # 手写样式源（非产物，直接维护）
├── dist/                   # Vite 产物：index.js + 全部 hash 分包，必须提交
├── global.d.ts             # ST 全局类型 + __APP_VERSION__/__BUILD_NO__ 声明
├── update-policy.json      # 强制更新策略真源（force/minVersion/reason）
├── package.json / package-lock.json / vite.config.ts / vitest.config.ts / tsconfig.json
├── .github/workflows/      # ci.yml（只读 CI + main 预览预发布）、pages.yml
├── scripts/                # verify-ci.mjs、preview-package.mjs、preview-notes.mjs
├── docs/index.html         # GitHub Pages 完整文档（单文件内联）+ docs/images/ 截图
├── i18n/zh-cn.json
├── src/                    # 扩展源码（见下表）
└── cloudflare/             # 匿名统计接收端（Worker + D1 + 看板，独立部署）
```

`src/` 按职责分组（`**/*.test.ts` 为 Vitest 纯逻辑测试，不进 Vite 入口）：

| 目录 | 职责 |
| --- | --- |
| `index.ts` | 入口：hydrate → 魔法棒 → 面板 → 峰值圆点 → 拦截安装（ST 未就绪轮询重试）→ 24h 定时器 → 延迟检查更新 → `installBackDebug` → `onDelete`/`onClean` 钩子 |
| `constants/` | `pricing.ts`（`PRICING`/`DEFAULT_PEAK_HOURS`/`MAX_HISTORY`/`DETAIL_KEEP`/`STORAGE_KEYS`/`PRICE_HISTORY`/`FLASH_PRICE_CUTOFF`）、`holidays.ts`、`changelog.ts`（用户手动维护）、`version.ts` |
| `types/` | `save.ts`（`HistoryEntry`）、`settings.ts`、`wallet.ts`、`agent.ts` |
| `data/` | ★ 唯一数据通路：`repository`（写）、`computed`（算）、`wallets`（钱包纯逻辑）、`fingerprint`、`sample-quality`（统计口径）、`token-rate`、`events`、`types` |
| `store/` | `index.ts` + `persistence.ts`：单一历史聚合、热 50 + 冷库、`DB_NAME`、迁移备份 |
| `services/` | 采集与业务：`interception`、`request-origin`、`think-timing`、`turn-outcome`、`token-estimate`、`connection-identity`、`pricing`/`pricing-sync`、`model-match`、`currency`、`balance`、`wallet-secrets`、`plan-quota`、`import-export`、`sync`、`update`/`update-policy`、`telemetry`、`storage-usage`、`wipe-data`/`wipe-hooks`、`theme`、`debug`、`logger`、`announcement`（公告：拉取 / 已读 / 版本与有效期过滤；公告文件在远端 `announce` 分支） |
| `services/request-tap/` | 请求探针账本：`capture`/`match`/`classify`/`store`/`types`/`index` |
| `services/message-cost/` | 聊天消息头元信息：`match`（消息↔记录配对）/`render`/`settings-row`（注入宿主设置页）/`index` |
| `services/`（诊断） | `health-signals`、`health-prefs`、`error-classify`、`console-ring`、`capture-digest`、`frame-normalizer`、`log-sanitize`、`log-upload`、`feedback-pack`、`request-log`、`include-usage` |
| `services/agent-usage/` | TauriTavern 兼容层：`tt-agent-api`/`collector`/`normalize`/`snapshot-probe` |
| `stats/` | `forecast-series`（预测核心）、`forecast`（旧 API 兼容）、`model-efficiency`、`energyScore` |
| `ui/`（页面） | `panel`（骨架 / 视图切换 / 历史与详情 / 底栏）、`overview`、`stats-view`、`forecast-view`、`wallet-view`、`settings`、`help-view`、`log-view`、`tap-view`、`chat-manage` |
| `ui/`（图表） | `chart-config`、`chart-picker`（卡片骨架）、`chart-prefs`、`chart-time`、`chart-bar`、`chart-tooltip`、`extra-charts`、`model-trends`、`forecast-chart`、`heatmap`、`range-zoom` |
| `ui/`（交互） | `pill`、`source-badge`、`dropdown-placement`、`dropdown-close`、`switch`、`icons`、`nav-model`、`sort-header`、`filter-prefs`、`request-type-filter`、`chat-visibility`、`back-guard`、`history-badge`、`history-health-bar`、`log-upload-dialog`、`storage-usage-card`、`wallet-plan`、`wallet-sync-preview`、`peak-dot`、`compare`、`changelog`、`changelog-dialog`、`announcement-dialog`、`rate-text`、`vendor-icons`、`back-debug`（临时工具） |
| `utils/` | `device`（设备判定单一来源）、`date`、`crypto`（XOR）、`history-key`、`finish`、`logger` |

`cloudflare/`：`worker.js`（路由 + cron 清理 + Cache API）、`api.js`、`boot.js`、`summary.js`、`payload.js`、`log-payload.js`、`dashboard.html`、`schema.sql`、`schema-request-log.sql`、9 个 `migrate-*.sql`（`device-totals` / `hourly` / `st-version` / `device-metrics` / `theme-mode` / `backfill-device-totals` / `legacy-dur-to-run` / `run-ms` / `tt-version`）、`vendor/echarts.min.js`（自托管 full 构建）、`scripts/build-preview.mjs`、`wrangler.toml`、`README.md`、`*.test.js`。


## 开发流程

```bash
cd Api-Usage
npm install
npm run typecheck   # tsc --noEmit 必须通过
npm test            # Vitest 纯逻辑测试
npm run build       # 产出 dist/index.js + 分包
node --check dist/index.js
npm run verify:ci   # 版本单源、清单路径、引用链、孤立产物
```

- **产物必须提交**：`dist/index.js` 只是 `import "./index-*.js"` 存根，漏交任一 hash 分包就 `GET dist/index-*.js 404` → `Could not activate extension [object Event]` 并阻断后续扩展加载（全站故障）。
- **入口、面板与安卓返回键**：魔法棒入口、8 视图切换、`aus-view-in` 动画与「一次返回关面板」的硬约束见 `src/ui/AGENTS.md`。
- **CI 与 Pages 工作流**：触发条件、作业顺序与预览边界见 `.github/AGENTS.md`。
- **本地自检不连网**：`npm run verify:ci` 已覆盖版本单源、`manifest` 的 `js/css/i18n` 路径、从入口出发的 import 引用链、孤立产物。

## 铁律

1. **数据通路唯一**：存 / 取 / 算 / 展只走 `src/data/`——`repository` 唯一写、`computed` 唯一算、`wallets.ts` 唯一管钱包规则、`events` 订阅刷新。UI 里禁止直接读写 `state.history`/`state.wallets` 聚合或自己手算。
2. **总额同源**：概览与统计的「累计消费 / Tokens」必须由 `computeOverview(activeWalletId, fullHistory)` 从热+冷全量逐条累加，不读热缓存聚合；`hydrate` 结束处 `rebuildAggregates() + persist()` 对齐缓存。（曾出现概览 ¥1.4356 / 2,108,164 与统计「全部」¥3.06 / 3,651,493 冲突。）
3. **平均值忽略 0/空值**：所有 `avg_*` 统一走 `averagePositive`，单轮为 0 或空时从分子分母同时剔除。
4. **统计口径单一来源**：`src/data/sample-quality.ts` 的 `isReliablePerformanceSample` / `isReliableCacheSample` / `isReliableForecastSample` 分别把关性能均值、命中率、预测序列；`computeOverview`、`computeStatsFour`、`forecast-series.prepareEntries` 三处必须同口径。
5. **速率口径单一来源**：`src/data/token-rate.ts`；实测与估算同一公式「输出 Token（含思维链）÷（总耗时 − 首字延迟）」；`streamed === false` 或首字 ≥ 总耗时 98%（假流式）时首字归一为 0、界面显示「—」；测不出实测值时按同公式估算并标 `rateEstimated`；生成窗口 < 200ms 或结果 > 1000 t/s 归 0。
6. **不写死版本 / 价格 / 颜色**：版本走 `__APP_VERSION__`、构建号走 `__BUILD_NO__`；价格走 `PRICE_HISTORY` + 钱包规则；Token 三段色只取 `TOKEN_SERIES_COLORS` 与 `--aus-token-hit/miss/output`。
7. **不做全局开关**：价格同步由钱包 `catalogProvider` 决定（`hasSyncableWallet` 为假时静默不联网），显示币种由钱包 `balance.currency` 驱动，余额自动校准由钱包卡片逐项勾选——旧 `pricingSync.enabled` / 全局余额校准开关已删除，勿再新增。
8. **删数据只走白名单**：禁止 `localStorage.clear()`、禁止无差别 `deleteDatabase`、禁止把在用数据（`cold_history`/`aus_cold*`）标为可清理；只删 `DB_NAME = 'api_usage_stat_db'` 一个库。
9. **两套窄屏断点必须同步**：`@media (max-width:760px)` 与 `@container ausbody (max-width:760px)` 成对修改，否则部分机型不生效。
10. **产物不手改**：`dist/` 由 `npm run build` 生成；`style.css` 是手写源，随源码一起提交。
11. **提交不夹带**：不提交 `docs/images` 之外的随意素材、不提交本地草稿（`.gitignore` 已忽略 `deepseek-ui-reference.md`、`趋势预测初步计划.md` 等）。


## 常见任务地图

改定价 / 峰谷 → `constants/pricing.ts` + `services/pricing.ts` + `constants/holidays.ts` + `utils/date.ts` + `data/wallets.ts` + `ui/wallet-view.ts`（`calcCost/calcSavings/getPricing/hasPriceForModel` 均支持可选钱包上下文）｜强制更新策略 → 根目录 `update-policy.json`（平时 `force:false`）｜更新日志 → `constants/changelog.ts` + `ui/changelog.ts` + `style.css#aus-changelog`｜加价格段 → `PRICE_HISTORY[模型].push({since, offpeak, peak, usePeakPricing?, peakHours?, label?})`｜面板 / 导航 → `ui/panel.ts` + `ui/nav-model.ts` + `types/settings.ts#mobileCompatUi`｜任一页面 → 对应 `ui/*-view.ts` + `data/computed.ts`｜使用说明 / 隐私 → `ui/help-view.ts`，并同步 `README.md` 与 `docs/index.html`（**不得声明「不包含任何埋点」「不上传任何数据」**，不得把掩码密钥写成明文，不得称 XOR 是安全加密）｜连接身份 → `services/connection-identity.ts`｜匿名统计 → 客户端 `services/telemetry.ts` + `ui/settings.ts`；服务端 `cloudflare/` + `cloudflare/README.md`｜改看板 → `cloudflare/dashboard.html` + `api.js` + `summary.js`（要点见 `cloudflare/AGENTS.md`）｜同步 / 导入导出 → `services/import-export.ts` / `sync.ts`｜自定义小块 → `FOUR_OPTIONS`（18 项）+ `OverviewFourKey/StatsFourKey` + `getFourDisplay` + `normalizeSettings/hydrate` 白名单**四处同步**｜统计 / 历史筛选 → `ui/filter-prefs.ts`（`aus_filter_prefs_v1`）｜图表配置 → `chart-config` / `extra-charts` / `chart-prefs`｜下拉交互 → 确认 `ui/pill.ts` 能配对到 id｜按范围删除记录 → `repository.deleteHistoryByFilter`。

## 调试与排查

- **只用于定位，不用于验证修复**：修复后验证走「提交推送 → 酒馆「管理扩展程序」更新 → 刷新后用户肉眼确认」。
- 排查四件套：DOM snapshot、console messages、network requests、`evaluate`（`SillyTavern.getContext().chat` / `ApiUsageStat.state.history` / `documentElement[data-extension]`）；隔离会话看不见用户已开的面板，需 `window.ApiUsageStat.togglePanel()` 复现。
- 常见症状：输入框被污染（选择器收到 `#aus-panel input`，查 `#send_textarea` 计算样式）｜面板统计为 0（`chat[].extra.api_usage` 必须是对象、模型名要去 `[OR]/[masa]` 等前缀）｜有 token 无记录 / 中断误判（先看状态里的 `hasFetch` 与 network 是否有 `chat-completions/generate`）｜热力图空白（`display:none` 时 `clientWidth 0`，检测 `offsetParent` 跳过）｜接入 / 密钥筛选为空（旧记录只进「未记录接入 / 未识别密钥」，密钥条目要酒馆 ≥1.14.0）｜钱包费用 0（查 `walletId` / `priceConfigured` / `pricingSource`，待定价按 0；保存后要 `recalcWallet`）｜峰谷异常（节假日 / 周末 → `extraOffDays` → 钱包 `peakHours/weekendOffpeak`）｜钱包没自动创建（需 `endpointId` 且不在 `walletIgnored`）｜展开状态异常（`WalletConfig.collapsed` 缺字段按收起）｜下拉被卡片裁切（卡片的层叠上下文 + `overflow`，需 `overflow:visible` 并抬 `z-index`）｜窄屏汇总错位（`repeat(3,minmax(0,1fr))` 未生效，被通用网格覆盖）。


## 版本与发布管控（最高优先级）

- **分支**：`main` 稳定、`dev` 测试（`beta` 可选）；禁止直接 push `main` 做测试。
- **版本真源**：`manifest.json#version` 单源，`vite.config.ts` 注入 `__APP_VERSION__`；侧栏 / 关于 / 导出 / 检查更新全取此值，禁硬编码。
- **构建号**：`build_no` 从 1 起，注入 `__BUILD_NO__` 与 `APP_BUILD_TAG`。**未经当轮明确要求不得改**；须改时必须 +1，同次发布不得重复递增；改 `build_no` 必须同时补 `constants/changelog.ts` 头部对应 `buildNo` 条目，否则更新弹窗静默不弹，`verify-ci.mjs` 也会校验。已读标识 = `localStorage[aus_changelog_seen_v1]`，值为 `版本号|构建号`。
- **版本号推进管控**：无当轮明确要求一律禁止推进——禁 `npm version`、禁改 `manifest.json#version` / `package.json#version`、禁新建或移动 `vX.Y.Z` 标签、禁合并到 `main`、禁 `git push origin main --tags`；**一次明确要求只覆盖当次，不做延展解释**；**合并 ≠ 授权推进版本**（2026-09-10 事故后追加，授权按字面最小化解释）。
- **PR 审查只合并到 `dev`**（2026-10-20 追加）：禁用 GitHub「Merge pull request」与 `gh pr merge` 直合 `main`；**即使 PR 的 base 是 `main`，也必须先把内容落到 `dev` 再合并**——`dev` 是唯一真源，`main` 只承接稳定发布。
- **违规回退义务**：一旦误推进，立即改回三处版本号 → `npm run typecheck && npm run build && node --check dist/index.js` → 提交推送 → 删除本地与远端多余标签，并在回复里说明。
- **四步流程**：① feature 分支 → `dev`：五连验通过 + `git push origin dev`；② `dev` → `main`：仅在明确批准后 `git merge --no-ff dev`、解决 `dist/` 冲突、push，版本与标签保持原样；③ 版本推进 + 打标签必须单独授权；④ 回滚仅在明确要求时。
- **预览预发布边界**：`preview-<12位哈希>` 只由 `main` 的 preview 作业创建，标签不可复用 / 移动，不得借此改版本字段。
- **产物铁律**：`outDir: 'dist'`、`emptyOutDir: true`、`dist/` 必须随源码提交（删一个分包就是 404 加载失败）；`style.css` 是手写样式源、不是产物。
- **主题一致性**：默认 `light`，旧用户缺字段补 `light`，禁止强制 `dark`。
- **检查更新**：分支 `main` / `dev` 可选、默认 `main`、用 localStorage 记忆；优先 compare 哈希 + `/api/extensions/version`，失败回退远端 `manifest.json` 版本对比；自动检查 10 分钟节流（`localStorage` + `extensionSettings._updateLastCheck`），自动「已是最新」静默、手动才 toast；发现更新给 toast + 横幅「立即更新」，跨分支先 `/api/extensions/switch` 再 `/api/extensions/update` 后自动刷新。


## 提交与发布

```bash
git checkout dev
npm run typecheck && npm test && npm run build && node --check dist/index.js && npm run verify:ci
git add src/ style.css manifest.json dist/ docs/ scripts/ cloudflare/ i18n/ .github/ README.md AGENTS.md
git commit -m "…"
git push origin dev
```

- **自动提交**：独立修改完成（五连验通过 + 满足需求）即提交推送 `dev`，无需二次确认；自动提交**不含**版本推进、合并 `main`、打标签。
- **提交时机（强制）**：一轮需求完整做完后一次性提交；禁边改边提、分步提交、提前推送——单轮需求只产生一次提交。
- **更新日志**：当前由用户手动维护（强制追加要求已挂起），未经当轮明确要求不得增删条目。若被要求撰写，风格范本取 `r3.1.7` 的手写风格：口语、极简、一句话一件事、名词或动词短语开头、不加句号、不自夸、不写文件名 / 色值 / id / hash / 实现细节；同一主题合并成一条，每分类 1–3 条、整版 ≤8 条；只写用户可感知的行为与视觉变化，纯内部重构与像素级微调不写。
- **预览包脚本**：`scripts/preview-package.mjs`（git archive + 清单 / 入口 / 引用链 / 允许文件 / 结构 / SHA-256）与 `scripts/preview-notes.mjs`（提交区间说明）的约束见 `scripts/AGENTS.md`。
- `pr/RE3.0` 只同步产物备份，不在此开发。


## 注意事项

- 所有文件 UTF-8；**禁用 PowerShell `>` 重定向写文件**（会破坏编码）。
- Git 操作用当前环境的 Windows Git Bash（`git` 直连；推送需已登录凭据），不要切到其它发行版或换解释器。
- 回复一律中文（最高优先级）；不擅自扩大用户要求。
- 不要修改 `pr/DeepSeek使用预测.js`（脚本真源，只读参考）。
- 数据读写算一律走 `src/data/`，禁止在 UI 层直接操作 `state.history` / `state.wallets` 或手算聚合。
