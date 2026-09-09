# AGENTS.md — API用量统计（Api-Usage）

## 概览

SillyTavern 原生扩展 `API用量统计`（`manifest: api-usage-stat@3.0.3`），从 `deepseek-tavern-script` 酒馆助手脚本迁移而来。

- **真源**：`D:/Desktop/DeepSeek/Api-Usage`（独立仓库 `https://github.com/janmk1453/Api-Usage`，`main` 稳定 / `dev` 测试 双分支）
- **归档**：`pr/RE3.0/迁移重构计划.md` 仅作设计归档，不作为开发目录
- **脚本主线不变**：`pr/DeepSeek使用预测.js` 仍为脚本真源，扩展与脚本数据通过 `deepseek-stat-export v1` 互通，不自动覆盖
- **版本真源**：`manifest.json#version` 单一来源，`vite.config.ts` 注入 `__APP_VERSION__`，侧边栏/关于/导出/检查更新均取此值，禁止硬编码 `v3.0.x`

**规则：所有有关重构迁移版的修改一律在 `Api-Usage` 下进行，所有产物亦在此。禁止在 `pr/RE3.0` 继续开发。后续构建与提交均以 `Api-Usage` 为准，`RE3.0` 仅同步产物备份。**

## 技术栈（已确认）

- **打包**：`Vite 5`（`lib: es`，产物 `index.js + 动态分包 index-*.js/update-*.js + ECharts 9 块` 直出，`define: { process.env.NODE_ENV="production", __APP_VERSION__: manifest.version }` 以修复 `process` 未定义并实现版本单源化）
- **语言**：`TypeScript 5 strict`
- **图表**：`ECharts 5` 按需 `echarts/core + Bar/Line + Grid/Tooltip/CanvasRenderer`，动态分包（`core` 等 9 产物，已提交，随 `index.js` 按需加载），`Y` 8 选项×`X` 5 维度（见下）
- **样式**：无框架，`SmartTheme` 隔离 + `DeepSeek 官方浅色`（`#FFFFFF/#F6F7F8/#111827/#FF6A00/#E6F8EC`，`Microsoft YaHei`，`14px` 圆角，无阴影/无滤镜以保锐利，`absolute` 定位置换修复窄屏 `fixed` 漂移）+ 双主题（`light/dark`，`style.css` 同名变量覆盖 + `services/theme.ts` 切换 + 设置中胶囊下拉，深色高对比 `#0F1419/#1E242E/#E5E7EB`，ECharts 经 `themeColor()` 动态取变量，默认 `light`）
- **存储**：`extensionSettings[api_usage_stat]` 热 `50` 条 + `IndexedDB api_usage_stat_db` 冷分页（旧多存档已合并为单一历史，`XOR` 密钥兼容，自动迁移备份）
- **最低版本**：`manifest.minimum_client_version 1.11.0`

## 目录

```
Api-Usage/
├── manifest.json          # 扩展清单（display_name/loading_order/js/css/i18n/hooks），版本真源
├── index.js / style.css   # Vite 产物（ST 直接加载，勿手改，改 src 后重建，index.js 为入口+动态分包引用）
├── index-*.js / update-*.js / Axis-*.js ... # Vite 动态分包 hash 产物，必须随 index.js 一并提交，否则 404 导致扩展加载失败
├── global.d.ts            # ST 全局类型补全（+ __APP_VERSION__ 声明）
├── package.json / vite.config.ts / tsconfig.json
├── i18n/zh-cn.json
├── templates/panel.html   # 预留 Handlebars
├── src/
│   ├── index.ts           # 入口：repository.hydrate + 魔法棒注入 + 全屏面板 + 峰值圆点（ST 未就绪时轮询重试 installInterception）+ 汇率/定价格式同步定时器（24h）+ 延迟自动检查更新
│   ├── constants/pricing.ts  # PRICING/DEFAULT_PEAK_HOURS/MAX_HISTORY/DETAIL_KEEP/STORAGE_KEYS + PRICING_SYNC_SOURCE/FALLBACK/DEFAULT_EXCHANGE_RATE + PRICE_HISTORY/PriceSegment（内置模型多段价格历史，flash 新旧两段、pro 新旧两段、v4.1-flash 单段已预置，切换点 2026-09-10 12:00+08:00）│   ├── types/save.ts, settings.ts # settings 含 PricingSyncSettings{enabled,mode,exchangeRate,useLiveRate,autoIntervalHours,lastSync,lastRateFetch,recalcOnSync}
│   ├── data/              # ★ 统一数据框架（所有存/取/算/展的唯一通路）
│   │   ├── types.ts       # Snapshot/Aggregated/TimeRange/OverviewView/StatsView
│   │   ├── repository.ts  # 唯一写入口：addEntry(5s指纹去重+finishReason)/recalcAll/replaceAll(默认合并+清洗)/hydrate（含 pricingSync 迁移）+ persist（剥离隐私字段）
│   │   ├── computed.ts    # 唯一算入口：computeOverview/computeStats/getFilteredHistory/computeStatsFour + computeChatStats/getRecordedChats（对话维度聚合）
│   │   └── events.ts      # DataEvents.UPDATED/HISTORY_ADDED/SETTINGS_CHANGED
│   ├── store/index.ts, persistence.ts # 单一历史聚合（已废弃多存档，saves 仅作迁移兼容；append/getAllHistory 指纹去重 timestamp|model|total）
│   ├── services/pricing.ts, interception.ts(fetch透传+TTFT/思维链/截断解析+指纹去重，GENERATION_ENDED主路径，install/uninstall幂等), balance.ts(余额 toast 按币种格式化), import-export.ts(单一历史+清洗), sync.ts(单一历史+清洗), debug.ts, theme.ts(applyTheme 同步 overlay), update.ts(检查更新，main 提交哈希优先、失败回退 manifest 版本对比，自动检查 1h 节流), currency.ts(USD↔CNY 动态换算、getDisplayCurrency/formatMoney、fetchLiveRate 双源 24h), pricing-sync.ts(models.dev 拉取、USD→CNY*rate、峰谷 2×合成、add-missing/overwrite-unlocked/overwrite-all 预览与同步)
│   ├── stats/forecast.ts, energyScore.ts # 预测核心：分段回归/二次方程求 R，能耗评分 A-G
│   ├── utils/date.ts, crypto.ts(XOR+UTF-8), logger.ts
│   └── ui/panel.ts(全屏+absolute定位+DeepSeek式侧边栏display切换+汉堡+forecast 对话选择), overview.ts(双明细+8块2列+热力图+按对话统计表 cold 异步补全、动态币种), stats-view.ts(直输日期+三维度 time∩model∩chat+4小块+图表Y/X配置+费用轴按币种换算), chart-config.ts(Y 8×X 5 聚合), heatmap.ts(GitHub风格近2年Token热力图，块内横向滑动), forecast-view.ts(趋势预测 Beta，自选对话胶囊，能耗/预测/敏感度随选中对话联动，能耗信息列限宽 210~340px 紧贴等级条), stats.ts(旧统计卡), charts.ts(旧), compare.ts(内联详情费用按币种), settings.ts(完整设置+不回显密钥+模型价格自动同步卡片，双向币种换算), extra-charts.ts(额外 6 图费用轴按币种换算), peak-dot.ts, customize.ts
├── README.md
└── LICENSE
```

## 开发流程

```bash
cd Api-Usage
npm install
npm run typecheck   # tsc --noEmit 必须通过
npm run build       # 产出 index.js + 拆分 chunk
node --check index.js
```

- **入口**：酒馆左下角魔法棒 `#extensionsMenu → #aus_wand_entry`（`list-group-item`），点击 `togglePanel()` 打开全屏 `#aus-overlay + #aus-panel`（`absolute` 视口计算，监听 `scroll/resize`，非 `fixed` 以规避 `transform` 祖先在窄屏漂移）
- **面板**：全屏 `absolute` 定位置换 + 侧边导航（复刻 DeepSeek 官网 `display` 切换：`≥761px` 常显 `220px ↔ 60px` 折叠（`#aus-sidebar-toggle` 可见），`≤760px` 默认 `display:none` 隐藏 + `#aus-mobile-header` 内 `24px` 汉堡瞬时呼出 `is-open`，`#aus-sidebar-toggle` 隐藏，无遮罩无动画无过渡，`syncMobileSidebar` 清理宽屏折叠残留 inline），外层 `#aus-panel flex:column` + 内层 `#aus-panel-body flex:row`（`#aus-main overflow-x:hidden + min-width:0` 约束防止 720px 表撑开），`7` 视图（用量概览/统计/历史/趋势预测 Beta/设置/使用说明/关于）经 `data-view` + `opacity 0.15s` 切换，窄屏由汉堡控制 + 导航点击自动收起
- **样式**：`[data-extension="api-usage-stat"][data-ds-theme="light"]` 隔离，卡片 `1px solid #E5E7EB` 实线，无 `box-shadow`，字重 `600`，`Microsoft YaHei` 保证锐利；`#aus-sidebar` 无过渡（瞬时 `display` 切换），`style.css` 定义 `light/dark` 两套同名变量，深色经 `themeColor()` 注入 ECharts，默认 `light`
- **拦截**：`GENERATION_ENDED → chat[].extra.api_usage` 主路径，`ApiUsageStatInterceptor` 辅路径，`repository.addEntry/recalcAll` 1:1 脚本
- **数据框架**：所有存/取/算/展必须走 `src/data/` — `repository` 唯一写、`computed` 唯一算（`computeOverview` 供概览 8 块，`computeStats` 供统计）、`events` 订阅刷新；禁止在 UI 直接读写 `state.history` 聚合或手算
- **持久化**：`saveHot` 节流 `300ms`，`loadHot/migrateIfNeeded` 仅由 `repository.hydrate` 调用，已自动将旧多存档合并为单一历史（`hot 50` + `cold_history`）

## 页面与数据

### 用量概览（overview）
- **双余额卡**：充值余额（`customBalance|balance`）+ 累计消费（动态币种 `¥ CNY ↔ $ USD` 按 `pricingSync.enabled` 切换，`formatMoney(cny)` 经 `getDisplayCurrency()` 换算，余额 toast 同步）+ `tokens`
- **双明细**：历史消耗（Token 历史/命中/未命中/输出，`gap:10px + 行内 padding:4px` 与右侧对齐）与支出明细（预计节省/支出输入/输出，分两行，`token` 灰 `10px #9CA3AF`，金额均经 `CNY()/moneyHtml()` 按币种换算）并列
- **四小块→八小块**：默认 8 块 `repeat(4,1fr)`，`≤760px` 与 `≤480px` 保持 `repeat(2,1fr)` 两列（`gap 10px→8px`，卡片 `10px 12px`），支持 `overviewFour` 自定义 `14` 指标（`computeOverview` 单源，费用类经 `moneyHtml()` 动态 `CNY/USD`，通用兜底排除 `#aus-overview-four`）
- **热力图**：`Token 使用量热力图`（GitHub 风格，近 2 年按日聚合，5 级绿阶 `EBEDF0→216E39/161b22→aceebb`，`#aus-heatmap-card-overview` 块不超出、内部 `overflow-x:auto` 横向滑动，与 `模型汇总` 块一致，悬停显示日期+Token，渲染于 `overview.ts → heatmap.ts`，数据源 `state.history` 全量）
- **按对话统计**：热力图下方 `#aus-chat-summary-overview` 按 `chatId` 聚合（`computeChatStats` 单源，按总 Token 倒序，列：对话/轮次/命中/未命中/输出/总 Tokens/总费用/平均 Token/平均命中率，费用经 `formatMoney`，`cold` 全量异步补全，`displayName` 截断 `chatId 8…4`/`未分组/旧数据`）

### 用量统计（stats）
- **三维度**：时间维度（`全部/今天/昨天/近 7 天/近 30 天/本月/上月/自定义` 直输日期，仅 `自定义` 时显示日历，`‹/›` 月份切换，`全部` 为 `2020-01-01~今日`）仅影响 `消费金额/API 次数/Tokens/模型汇总`；模型维度（同款胶囊，列表为所有已记录模型 + 全部）与对话维度（同款胶囊，列表为所有已记录 `chatId` + 全部/未分组）均影响本页所有内容（`三块`+`汇总表`+`图表`）；筛选为 `time ∩ model ∩ chat`，三胶囊互斥关闭、点外关闭
- **三块**：消费金额（动态币种 `CNY/USD` 经 `formatMoney`）/API 请求次数/Tokens
- **四小块**：模型汇总表上方 4 块 `repeat(4,1fr)`，竖屏 `repeat(2,1fr)`，与概览 8 块同体系（`statsFour`，响应三维度过滤，`computeStatsFour` 单源，支持 `avg_think_ratio/truncation_rate`，费用类按币种换算）
- **模型汇总表**：`10` 列（模型/调用/命中/未命中/输出/总/总成本/平均成本/平均耗时/平均速率），横向可滚动，随三维度联动，费用列经 `formatMoney`
- **图表**：首图通用 `图表`（`Y` 8 项多选 + `X` 5 维度双胶囊，默认 `总 Token`，费用 `Y` 经 `getDisplayCurrency()` 换算，`yAxis name=CNY/USD`，`tooltip` 按币种显示）+ 下方 `6` 图 `2×3` 网格（Token/费用堆叠同柱 `stack:'total'` + 曲线、命中 `100%` 面积、请求数柱、耗时/速率双轴、模型环，费用图 `drawBarLine` 内按币种除率），均支持 `Y/X` 独立配置与按 `time ∩ model ∩ chat` 联动，`vite.define` 修复 `process` 未定义，**隐藏时跳过初始化**（`display:none` 则不渲染，切到统计页再 `setTimeout 60ms` 触发，避免 `clientWidth 0` 误报 `图表容器未就绪`）

### 历史记录
- 列表按 `timestamp` 倒序，卡片含模型/时间、`in/out/duration/rate`、费用、旧/新/详情
- **占比条**：`6px` 圆角三段（命中 `#0BA25E`/未命中 `#FCA5A5`/输出 `#A5B4FC`）
- **内联详情**：点击详情向下展开固定 `320→520px`（`15` 字段按 `基础/性能/Token/费用` 四块 + `4 Tab`：请求参数/完整响应/Raw 用量/消息内容，`pre` `160px` 滚动，收起切换）

### 趋势预测（Beta，独立页）
- **入口**：侧边栏 `趋势预测（Beta）`，`data-view="forecast"` 独立页，概览不再嵌入预测卡（避免与统计混淆）；顶部自选对话胶囊（`当前对话/全部/各对话`，与统计页同款，默认 `__current__` 跟随当前聊天，`__null__` 为未分组），切换后全页联动
- **预测核心**：`src/stats/forecast.ts` 分段回归（回落点 `≥30%` 分段，仅末段，最小二乘 `C₀+nΔ`，`R²` 择优 `linear/log/recent-mean`）+ `remainingRounds` 解二次方程（`Δ±σ` 给区间）+ `ctxLimitRounds`；`forecast-view.ts` 渲染预测卡（余额口径 `R`/`R(ctx)` 双条、下一轮 `prompt/cost/hit` 经 `formatMoney` 按币种）、预测图（历史散点+拟合虚线+预测延伸+置信带+`ctxLimit` 参考线，`chatId=null` 时不过滤）、敏感度滑块（假设命中率实时重算，模型取选中对话末轮）、对比视图（`topPowerChats` 最耗对话保持全局）
- **能耗评分**：`src/stats/energyScore.ts` 6 指标加权（`Δ 25%/out 20%/效率 20%/命中 15%/截断 10%/思维链占比 10%`）→ `A-G`，冷启动绝对阈值表，随历史自动切分位；`forecast-view.ts` 中能耗标识已改为基于选中对话 `energyScore(effectiveHist,null)`，文案顯示选中对话名与样本数

### 设置（完整迁移原脚本）
- `颜色模式（浅色/深色，胶囊下拉，`settings.theme` + `theme.ts:applyTheme` 即时切换，与用量统计·模型选择同款） / API 密钥 / 自动校准余额（开关+间隔）/ 自定义余额 / 新价格机制（开关+日期+今日）/ 高峰时段（可增删跨天，改后重算）/ 模型与价格（内置 4 模型 flash/v4.1-flash/pro/vision-exp 可覆写+自定义增删，其中 v4-flash 已替代隐藏不外显但保留计价+自定义覆盖仍生效，峰谷开关，三价 动态 `CNY/USD` 经 `getDisplayCurrency()`，输入框双向换算）/ 模型价格自动同步（`pricingSync.enabled` 默认关闭，模式 `add-missing/overwrite-unlocked/overwrite-all` 胶囊、汇率 `USD→CNY` 输入 + `useLiveRate` 每 24h 双源自动获取 + `autoIntervalHours`  + `recalcOnSync` + 立即同步/预览，`models.dev` 拉取 `USD→CNY*rate` 合成峰谷 `2×`）/ 调试（开关+hit/miss/output/model/date/batchCount+生成）/ 峰值圆点（开关+重置）/ WebDAV（url/user/pass/path/proxy+同步，`https` 强制，`pull-merge-push`）`，全部主题变量卡片，改后 `recalcAll`+`refreshUI`；货币切换时 `formatMoney(cny)` 全站即时换算（余额 toast 同步）

## 样式规范（DeepSeek 截图定版）

- 变量：`--ds-bg:#FFFFFF --ds-card:#F6F7F8 --ds-text:#111827 --ds-border:#E5E7EB --ds-black:#111827 --ds-orange:#FF6A00 --ds-green-bg:#E6F8EC --ds-green:#0BA25E --ds-radius-card:14px --ds-radius-pill:999px`，深色 `data-ds-theme="dark"` 同名覆盖（`--ds-bg:#0F1419/--ds-card:#1E242E/--ds-text:#E5E7EB` 高对比，`ECharts` 经 `themeColor()` 动态取变量保证可读性）
- 选择器统一：所有选择类 UI 必须使用用量统计·模型选择同款胶囊下拉（`#xxx-btn` 胶囊 `999px` + `#xxx-dropdown` 绝对定位 `12px` 圆角 `box-shadow`），禁止原生 `select`，选中态 `background:var(--ds-card)` 加粗
- 魔法棒悬停：`background: transparent !important`
- 文字：`Microsoft YaHei`，无 `antialiased/optimizeLegibility` 干预
- 移动端：`≤760px` 侧边栏 `display:none` 默认隐藏、`#aus-mobile-header` 汉堡（`24px` `☰`，`display:flex`）瞬时呼出 `is-open`，无遮罩无动画；`#aus-panel flex:column + #aus-panel-body flex:row`（`#aus-main overflow-x:hidden + min-width:0` 约束防止 720px 表撑开），概览 8 块保持 `repeat(2,1fr)` 两列，其余网格 `4→1` 列，窄屏所有胶囊下拉 `overflow:visible + z-index:50` 不被裁剪

## 常见任务

- **改定价/峰谷**：`src/constants/pricing.ts` + `src/services/pricing.ts`（纯函数，`isPeakHour(ts, peakHours)` 不读全局）+ `src/services/currency.ts`（币种换算、24h 汇率）+ `src/services/pricing-sync.ts`（models.dev 同步、2×峰谷合成）
- **加价格段（多段定价）**：`PRICE_HISTORY[模型].push({since: 生效时间戳, offpeak, peak, usePeakPricing?, peakHours?, label?})`（按 `since` 升序，命中 `timestamp>=since` 最后一段，未来段同样写法）；`findSegment/effectivePricingFor` 按记录时间查段，`calcCost/calcSavings` 段规则峰谷优先（无段规则回落用户设置），`getPricing` 取当前命中段展示，`recalcAll` 逐条按各自时间重算故统计/图表/详情自动正确；自定义模型价优先不回退
- **改面板/导航**：`src/ui/panel.ts`（全屏+`positionPanel` 定位置换+`applyCollapsed`）+ `style.css`（`#aus-mobile-header` 汉堡 + `display` 切换，无过渡）
- **改概览/统计**：`src/ui/overview.ts` + `src/ui/stats-view.ts`（三维度 time∩model∩chat 过滤）+ `src/data/computed.ts`（computeChatStats 单源）+ `src/ui/heatmap.ts`（概览热力图，GitHub 风格，近 2 年，块内滑动）
- **改历史详情/占比**：`src/ui/panel.ts`（`renderHistory` 内联展开 + 三色条，费用按币种）
- **改同步/导入**：`src/services/sync.ts` + `src/services/import-export.ts`（单一历史，导出经 `getAllHistory` 含冷库全量，导入超 `MAX_HISTORY` 自动回冷库）+ `src/services/pricing-sync.ts`（models.dev 价格同步）
- **改预测**：`src/ui/forecast-view.ts`（自选对话胶囊、能耗/预测/敏感度联动）+ `src/stats/forecast.ts`

## 调试规范（Playwright MCP）

- **配置**：`~/.config/opencode/opencode.jsonc` 中 `mcp.playwright` 使用 `npx -y @playwright/mcp@latest --browser msedge --isolated --caps vision`（`msedge + isolated + vision`），`chrome-devtools` 仅备选默认 `enabled:false`，已预装 `0.0.79 / 1.8.0`，走 `npmmirror` 源
- **用途限定**：Playwright 仅用于问题定位，禁止用于修复后验证。修复后验证必须走用户标准流程：提交推送 → 酒馆管理扩展程序更新 → 刷新网页后由用户肉眼确认，禁止用 Playwright 自动快照断言通过
- **隔离特性**：`isolated` 为独立会话，与用户本地 Edge 非同一实例，无法直接看见用户已打开的面板；需在自动化会话中通过 `window.ApiUsageStat.togglePanel()` 复现打开，再经 `snapshot / evaluate` 采集
- **定位四件套**：`browser_snapshot`（DOM 结构 + `ref`） + `browser_console_messages`（`1 errors 6 warnings` 定界） + `browser_network_requests`（过滤 `translate / api`） + `browser_evaluate`（`SillyTavern.getContext().chat / ApiUsageStat.state.history / documentElement[data-extension]`） + `browser_take_screenshot`（视觉确认）
- **输入框污染等样式问题**：必须检查 `document.documentElement[data-extension]` 是否污染宿主，`#send_textarea` 计算样式 `backgroundColor` 是否跟随主题，收紧选择器至 `#aus-panel input` 而非 `[data-extension] input`
- **对话数据为 0 问题**：必须通过 `evaluate` 检查 `chat[].extra.api_usage` 是否为对象（拒绝 `token_count` 数字误判）、`normalizeModel` 是否剥离 `[OR]/[masa]` 前缀、`state.history[0].raw_usage` 类型及 `pricing` 命中
- **0 tokens 中断误判**：`[AUS-TEMP]` 日志显示 `hasFetch:false + token_count` 且无 `chat-completions/generate` 网络请求时，非扩展导致，实为 ST 未发请求（`No secret key saved for openai / AbortReason / status check failed`），需检查 `API 连接 → DeepSeek` 密钥与 `status`，而非回退拦截
- **热力图/图表未就绪**：统计页图表在 `display:none` 时 `clientWidth 0` 误报，需检测 `offsetParent` 跳过渲染，切到统计页再 `setTimeout 60ms` 触发；热力图块必须 `max-width:100%; overflow:hidden` 卡片 + `overflow-x:auto` 内部滑动，复刻 `模型汇总` 表 `min-width:720px` 在卡片内滑动的模式，禁止让块本身撑开屏幕

## 版本与发布管控（新增，基于分支隔离）

- **分支模型**：`main` 稳定发布（普通用户跟踪）/ `dev` 日常测试（开发者自用酒馆中手动将扩展更新源切为 `dev`）；`beta` 可选作小范围公测。禁止直接 `push main` 做测试，所有功能先在 `dev` 验证。
- **版本真源**：`manifest.json#version` 唯一来源，`vite.config.ts` 注入 `__APP_VERSION__`，侧边栏/关于/导出/检查更新均取此值，禁止硬编码 `v3.0.x`
- **开发→测试→发布**：
  1. `feature/* → dev`：`npm run typecheck && build && node --check index.js` → `git push origin dev` → 酒馆切 `dev` 分支真机测试
  2. `dev → main`：测试通过后 `git checkout main && git merge --no-ff dev && npm version patch/minor && git tag vX.Y.Z && git push origin main --tags`
  3. 回滚：`main` 上 `git revert` 并递增 `patch`
- **产物铁律**：`Vite lib` 产物为 `index.js(入口) + index-*.js/update-*.js + ECharts 9 块`，`index.js` 为 `import "./index-*.js"` 存根，**必须**随 `index.js` 一并 `git add` 提交，缺一则 `404 index-*.js` 导致 `[object Event]` 加载失败并中断后续扩展；`style.css` 同理直出，`outDir: '.' + emptyOutDir:false` 禁止误删。
- **主题一致性**：`defaultSettings.theme` 默认为 `light`，与隔离样式浅色保持一致；旧用户无 `theme` 字段时迁移补 `light`，禁止在更新中强制覆为 `dark`
- **检查更新**：`src/services/update.ts` 优先对比 `main` 提交哈希（本地扩展提交经 GitHub compare 判领先，失败回退 `raw.githubusercontent.../main/manifest.json` 的 `version` 与本地 `__APP_VERSION__` 对比），自动检查 1h 节流（`localStorage + extensionSettings._updateLastCheck`，1 小时内最多一次），关于页按钮为手动触发（不受节流），有更新 `toast + 横幅`，已是最新/检查失败时自动与手动均 `toast` 提示

## 提交与发布

```bash
# 日常开发（在 dev）
git checkout dev
# ... 改 src/ ...
npm run typecheck && npm run build && node --check index.js
git add src/ style.css manifest.json index.js index-*.js update-*.js Axis-*.js ...
git commit -m "feat/fix: ..."
git push origin dev   # 仅 dev，用户无感知

# 正式发布（dev 已验证）
git checkout main && git merge --no-ff dev
npm version patch  # 或 minor，自动改 manifest+package 并打 tag
# 确认侧边栏版本号已跟随 __APP_VERSION__ 更新
npm run build && git add . && git commit --amend --no-edit
git push origin main --tags
```

- **自动提交规则**：完整完成一项独立修改后必须立即执行提交推送，无需等待用户二次确认。单项定义：通过 `typecheck + build + node --check` 且满足用户当轮需求即视为完成。提交需包含 `src/` 源码与 `index.js/style.css` 产物，`commit` 信息遵循 `fix/feat/docs:` 前缀并简述本次变更点。
- **提交时机（强制）**：所有修改必须在完整完成并验证通过后最后统一提交，禁止边改边提、分步提交或提前推送。提交前必须依次通过 `npm run typecheck`、`npm run build`、`node --check index.js`，且 `index.js/style.css` 与源码保持一致后，一次性 `git add src/ style.css manifest.json index.js` 并推送，单轮需求仅产生一次提交。
- 产物 `index.js 150k` + `ECharts` 分包（`Axis-*` 等 9 个）随仓库提交以保离线加载，`style.css` 直出，勿手改产物；`vite.config.ts` 已 `define: { process.env.NODE_ENV, __APP_VERSION__ }` 防浏览器 `process` 报错且实现版本单源化
- `RE3.0` 仅同步产物备份，不作为提交源

## 其他经验

- **动态分包 404 坑**：`import('../services/update')` 等动态 `import()` 会使 `Vite lib` 输出额外 `index-*.js`，`index.js` 仅为 re-export 存根；若漏提交新 hash 文件，扩展激活时 `GET .../index-*.js 404` → `Could not activate extension [object Event]` 并阻断后续扩展加载，属全站故障
- **TTFT/思维链为 0 坑**：`GENERATION_ENDED` 主路径不带 `ttft`，需在 `onGenerationEnded` 中合并最近 `lastFetchUsage.ttft/thinkTime/finishReason`（5s 内有效），否则 `tokenRate` 失真且详情为 0
- **截断率/思维链占比**：`finish_reason === 'length'` 判截断，`thinkTokens/completion_tokens` 算占比，统计块与详情均基于此；`isTruncated` 持久化于 `HistoryEntry`
- **详情双占比去重**：性能块与 Token 消耗块曾各显示一次“思维链占比”，后收敛为仅性能块保留，Token 块改为单列占满的“思维链 Token”
- **三块竖屏**：统计页 `消费金额/API 次数/Tokens` 在 `760px` 下已为 `1fr` 单列三行，满足一行一列需求；新增 `statsFour` 4 块在竖屏为 `2×2`
- **自定义日期**：统计页 `自定义` 原为双月日历，现为直输 `input[type=date]` 两框 + 应用按钮，`max` 限今日，自动纠正起止倒置
- **货币与同步**：开关开启时全站 `formatMoney(cny)` → `$/USD`（`CNY/rate`），关闭回 `¥/CNY`；`models.dev` 价为 `$US` 仅 `cost` 无 `currency`，同步时 `USD→CNY*rate` 再 `peak=2×offpeak` 合成 DeepSeek 峰谷；模型价格输入框开启 `USD` 时双向换算（显示 `CNY/rate`，保存 `USD*rate`）；汇率双源 `open.er-api.com → api.exchangerate-api.com` 24h 节流，定时器随 `pricingSync.enabled/useLiveRate` 启停

## 注意事项

- **编码**：`UTF-8`，中文路径/注释保持，勿用 PowerShell `>` 重定向破坏编码
- **中文**：所有思考与输出保持中文（最高优先级）
- **脚本隔离**：勿改 `pr/DeepSeek使用预测.js`，扩展与脚本独立演进
- **数据唯一**：所有存/取/算/展必经 `src/data/`，禁止绕过
