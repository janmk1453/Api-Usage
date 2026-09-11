# AGENTS.md — API用量统计（Api-Usage）

## 概览

SillyTavern 原生扩展 `API用量统计`（清单 `api-usage-stat`，版本以 `manifest.json#version` 为准，文档内禁止写死版本号），从 `deepseek-tavern-script` 酒馆助手脚本迁移而来；现提供用量概览、统计、历史、趋势预测、钱包和设置等独立页面。

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
- **存储**：`extensionSettings[api_usage_stat]` 热 `50` 条 + `IndexedDB api_usage_stat_db` 冷分页（旧多存档已合并为单一历史，`XOR` 密钥兼容，自动迁移备份）；钱包配置、忽略列表和 `overviewWalletId` 随热设置持久化，钱包校准密钥单独存放于 `extensionSettings.walletSecrets` 且不参与导出
- **最低版本**：`manifest.minimum_client_version 1.11.0`；接入类型筛选兼容最低版本，API 密钥条目区分依赖酒馆 `>=1.14.0`（更早版本无多条密钥编号，归入未识别密钥）

## 目录

```
Api-Usage/
├── manifest.json          # 扩展清单（display_name/loading_order/js/css/i18n/hooks），版本真源
├── index.js / style.css   # Vite 产物（ST 直接加载，勿手改，改 src 后重建，index.js 为入口+动态分包引用）
├── index-*.js / update-*.js / Axis-*.js ... # Vite 动态分包 hash 产物，必须随 index.js 一并提交，否则 404 导致扩展加载失败
├── global.d.ts            # ST 全局类型补全（+ __APP_VERSION__ 声明）
├── package.json / vite.config.ts / vitest.config.ts / tsconfig.json
├── .github/workflows/ci.yml # GitHub Actions：只读 CI + main 预览预发布
├── scripts/verify-ci.mjs  # 版本单源、清单路径、分包引用链与孤立产物检查
├── scripts/preview-package.mjs # main 预览包：git archive、SHA-256、压缩包清单校验
├── scripts/preview-notes.mjs # main 预览说明：按提交区间生成短哈希、说明与链接
├── i18n/zh-cn.json
├── templates/panel.html   # 预留 Handlebars
├── src/
│   ├── index.ts           # 入口：repository.hydrate + 魔法棒注入 + 全屏面板 + 峰值圆点（ST 未就绪时轮询重试 installInterception）+ 汇率/定价格式同步定时器（24h）+ 延迟自动检查更新
│   ├── constants/pricing.ts  # PRICING/DEFAULT_PEAK_HOURS/MAX_HISTORY/DETAIL_KEEP/STORAGE_KEYS + PRICING_SYNC_SOURCE/FALLBACK/DEFAULT_EXCHANGE_RATE + PRICE_HISTORY/PriceSegment + FLASH_PRICE_CUTOFF(2026-09-10 12:00)/V4_PRO_RETIRE_CUTOFF(2026-09-14 12:00)（内置模型多段价格历史：deepseek-v4-flash 新旧两段、deepseek-v4-pro 独立价段+下线路由段、deepseek-flash 单段；V4.1 Flash 现役模型名为 deepseek-flash，V4 Pro 下线后按同价计费）
│   ├── types/save.ts, settings.ts, wallet.ts # HistoryEntry 含 sourceType/endpointId/endpointLabel/credentialId/credentialLabel/walletId/pricingSource；settings 含 overviewWalletId 与 PricingSyncSettings；wallet.ts 定义 WalletConfig/WalletModel/WalletPriceRule/币种与 catalogProvider 映射
│   ├── data/              # ★ 统一数据框架（所有存/取/算/展的唯一通路）
│   │   ├── types.ts       # Snapshot/Aggregated/TimeRange/OverviewView/StatsView
│   │   ├── fingerprint.ts # 用量去重指纹：model/token + endpointId/credentialId
│   │   ├── wallets.ts     # 钱包纯逻辑：默认 DeepSeek 钱包、连接自动建钱包、模型别名、余额换算、忽略/合并、价格规则标准化
│   │   ├── repository.ts  # 唯一写入口：addEntry(连接定位钱包+5s指纹去重+按钱包计费)/recalcAll/recalcWallet(热+冷)/钱包 CRUD/余额更新/replaceAll/hydrate（旧价格、旧余额、旧密钥和历史接入迁移）+ persist（剥离隐私字段）
│   │   ├── computed.ts    # 唯一算入口：computeOverview(余额口径)/computeStats/getFilteredHistory/computeStatsFour/filterStatsHistory/getEndpointFilterOptions/getCredentialFilterOptions + computeWalletStats/computeChatStats/getRecordedChats
│   │   └── events.ts      # DataEvents.UPDATED/HISTORY_ADDED/SETTINGS_CHANGED
│   ├── store/index.ts, persistence.ts # 单一历史聚合（已废弃多存档，saves 仅作迁移兼容；append/getAllHistory 指纹去重 timestamp|model|total）
│   ├── services/pricing.ts, interception.ts(fetch透传+TTFT/思维链/截断解析+请求开始快照连接身份，GENERATION_ENDED主路径，install/uninstall幂等), connection-identity.ts(接入地址规范化/官方名称/酒馆密钥条目映射/严格隐私模式，不读取 proxy_password 与 custom_include_headers), wallet-secrets.ts(钱包校准密钥 XOR 存取与旧 apiKey 迁移), balance.ts(钱包余额手工/DeepSeek 官方自动校准和定时器), import-export.ts(单一历史+钱包配置+清洗，不导出密钥), sync.ts(单一历史+钱包合并+清洗), debug.ts, theme.ts(applyTheme 同步 overlay), update.ts(检查更新，main 提交哈希优先、失败回退 manifest 版本对比，自动检查 1h 节流), currency.ts(USD↔CNY 动态换算、getDisplayCurrency/formatMoney/getWalletExchangeRate/fetchLiveRate 双源 24h), pricing-sync.ts(按钱包 catalogProvider 从 models.dev 拉取、USD→CNY*rate、add-missing/overwrite-unlocked/overwrite-all 和锁定保护)
│   ├── stats/forecast.ts, energyScore.ts # 预测核心：分段回归/二次方程求 R，能耗评分 A-G
│   ├── utils/date.ts, crypto.ts(XOR+UTF-8), logger.ts
│   ├── **/*.test.ts       # Vitest 核心纯逻辑测试，不进入 Vite 入口构建
│   └── ui/panel.ts(全屏+absolute定位+DeepSeek式侧边栏display切换+汉堡+钱包入口+history 模型/对话/接入类型/API密钥四维筛选+forecast 对话选择), overview.ts(余额钱包口径+双明细+8块2列+热力图+按对话统计表 cold 异步补全、动态币种), wallet-view.ts(多钱包列表、默认收起/独立记忆、余额、密钥、价格来源、模型价格、独立峰谷、忽略恢复), stats-view.ts(直输日期+五维度 time∩model∩chat∩endpoint∩credential+4小块+图表Y/X配置+费用轴按币种换算), chart-config.ts(Y 8×X 5 聚合), heatmap.ts(GitHub风格近2年Token热力图，块内横向滑动), forecast-view.ts(趋势预测 Beta，自选对话胶囊，能耗/预测/敏感度随选中对话联动，余额与价格按钱包口径), stats.ts(旧统计卡), charts.ts(旧), compare.ts(内联详情费用按币种), settings.ts(全局设置，钱包相关编辑入口已迁出), extra-charts.ts(额外 6 图费用轴按币种换算), peak-dot.ts, customize.ts
├── README.md
└── LICENSE
```

## 开发流程

```bash
cd Api-Usage
npm install
npm run typecheck   # tsc --noEmit 必须通过
npm test            # Vitest 核心纯逻辑测试
npm run build       # 产出 index.js + 拆分 chunk
node --check index.js
npm run verify:ci   # 版本单源、清单路径、引用链与孤立产物
```

- **入口**：酒馆左下角魔法棒 `#extensionsMenu → #aus_wand_entry`（`list-group-item`），点击 `togglePanel()` 打开全屏 `#aus-overlay + #aus-panel`（`absolute` 视口计算，监听 `scroll/resize`，非 `fixed` 以规避 `transform` 祖先在窄屏漂移）
- **面板**：全屏 `absolute` 定位置换 + 侧边导航（复刻 DeepSeek 官网 `display` 切换：`≥761px` 常显 `220px ↔ 60px` 折叠（`#aus-sidebar-toggle` 可见），`≤760px` 默认 `display:none` 隐藏 + `#aus-mobile-header` 内 `24px` 汉堡瞬时呼出 `is-open`，`#aus-sidebar-toggle` 隐藏，无遮罩无动画无过渡，`syncMobileSidebar` 清理宽屏折叠残留 inline），外层 `#aus-panel flex:column` + 内层 `#aus-panel-body flex:row`（`#aus-main overflow-x:hidden + min-width:0` 约束防止 720px 表撑开），`8` 视图（用量概览/统计/历史/趋势预测 Beta/钱包/设置/使用说明/关于）经 `data-view` + `opacity 0.15s` 切换，窄屏由汉堡控制 + 导航点击自动收起
- **样式**：`[data-extension="api-usage-stat"][data-ds-theme="light"]` 隔离，卡片 `1px solid #E5E7EB` 实线，无 `box-shadow`，字重 `600`，`Microsoft YaHei` 保证锐利；`#aus-sidebar` 无过渡（瞬时 `display` 切换），`style.css` 定义 `light/dark` 两套同名变量，深色经 `themeColor()` 注入 ECharts，默认 `light`
- **拦截**：`GENERATION_ENDED → chat[].extra.api_usage` 主路径，`ApiUsageStatInterceptor` 辅路径，`repository.addEntry/recalcAll` 1:1 脚本；fetch 请求开始时同步快照连接身份并随请求传递，禁止生成结束后重新读取可能已切换的密钥
- **连接身份**：`connection-identity.ts` 负责接入地址规范化、官方名称、酒馆密钥条目映射和严格隐私模式；不读取、不比较、不持久化 `proxy_password` 与 `custom_include_headers`
- **数据框架**：所有存/取/算/展必须走 `src/data/` — `repository` 唯一写、`wallets.ts` 唯一管理钱包结构和规则、`computed` 唯一算（`computeOverview` 供概览 8 块，`computeStats` 供统计，`computeWalletStats` 供钱包页，`filterStatsHistory` 供统计/历史统一筛选）、`events` 订阅刷新；禁止在 UI 直接读写 `state.history`、`state.wallets` 聚合或手算
- **持久化**：`saveHot` 节流 `300ms`，`loadHot/migrateIfNeeded` 仅由 `repository.hydrate` 调用，已自动将旧多存档合并为单一历史（`hot 50` + `cold_history`）
- **CI**：`.github/workflows/ci.yml` 在 `dev/main` 推送及目标为 `dev/main` 的合并请求中执行，使用 Node 24；顺序为 `typecheck → test → build → node --check → verify:ci → 工作区零差异`。`verify` 只读；仅 `main` 推送或从 `main` 手动触发时，成功后再执行 `contents: write` 的 `preview` 作业，创建或更新 `preview-<12位提交哈希>` 预发布。预览说明优先列出上一个 `preview-*` 到当前提交的全部提交；首次预览回退最近正式 `vX.Y.Z` 标签，仍无标签时只列当前提交。`dev` 与合并请求不发布，CI 不提交、不修改三个版本字段、不操作正式 `vX.Y.Z` 标签

## 页面与数据

### 用量概览（overview）
- **双余额卡**：充值余额（默认全部钱包合计，胶囊下拉可切换单一钱包；仅此选择影响余额和剩余轮次预测，其他概览指标仍按全量历史）+ 累计消费（动态币种 `¥ CNY ↔ $ USD` 按 `pricingSync.enabled` 切换，`formatMoney(cny)` 经 `getDisplayCurrency()` 换算）+ `tokens`
- **双明细**：历史消耗（Token 历史/命中/未命中/输出，`gap:10px + 行内 padding:4px` 与右侧对齐）与支出明细（预计节省/支出输入/输出，分两行，`token` 灰 `10px #9CA3AF`，金额均经 `CNY()/moneyHtml()` 按币种换算）并列
- **四小块→八小块**：默认 8 块 `repeat(4,1fr)`，`≤760px` 与 `≤480px` 保持 `repeat(2,1fr)` 两列（`gap 10px→8px`，卡片 `10px 12px`），支持 `overviewFour` 自定义 `14` 指标（`computeOverview` 单源，费用类经 `moneyHtml()` 动态 `CNY/USD`，通用兜底排除 `#aus-overview-four`）
- **热力图**：`Token 使用量热力图`（GitHub 风格，近 2 年按日聚合，5 级绿阶 `EBEDF0→216E39/161b22→aceebb`，`#aus-heatmap-card-overview` 块不超出、内部 `overflow-x:auto` 横向滑动，与 `模型汇总` 块一致，悬停显示日期+Token，渲染于 `overview.ts → heatmap.ts`，数据源 `state.history` 全量）
- **按对话统计**：热力图下方 `#aus-chat-summary-overview` 按 `chatId` 聚合（`computeChatStats` 单源，按总 Token 倒序，列：对话/轮次/命中/未命中/输出/总 Tokens/总费用/平均 Token/平均命中率，费用经 `formatMoney`，`cold` 全量异步补全，`displayName` 截断 `chatId 8…4`/`未分组/旧数据`）

### 用量统计（stats）
- **五维度**：时间维度（`全部/今天/昨天/近 7 天/近 30 天/本月/上月/自定义` 直输日期，仅 `自定义` 时显示日历，`全部` 为 `2020-01-01~今日`）、模型、对话、接入类型与 API 密钥；五胶囊互斥关闭、点外关闭，筛选为 `time ∩ model ∩ chat ∩ endpoint ∩ credential`，统一影响本页全部内容。接入类型优先联动密钥，切换接入后密钥重置为全部；选项来自完整热冷历史，旧记录归入“未记录接入/未识别密钥”
- **三块**：消费金额（动态币种 `CNY/USD` 经 `formatMoney`）/API 请求次数/Tokens
- **四小块**：模型汇总表上方 4 块 `repeat(4,1fr)`，竖屏 `repeat(2,1fr)`，与概览 8 块同体系（`statsFour`，响应五维度过滤，`computeStatsFour` 单源，支持 `avg_think_ratio/truncation_rate`，费用类按币种换算）
- **模型汇总表**：`10` 列（模型/调用/命中/未命中/输出/总/总成本/平均成本/平均耗时/平均速率），横向可滚动，随五维度联动，费用列经 `formatMoney`
- **图表**：首图通用 `图表`（`Y` 8 项多选 + `X` 5 维度双胶囊，默认 `总 Token`，费用 `Y` 经 `getDisplayCurrency()` 换算，`yAxis name=CNY/USD`，`tooltip` 按币种显示）+ 下方 `6` 图 `2×3` 网格（Token/费用堆叠同柱 `stack:'total'` + 曲线、命中 `100%` 面积、请求数柱、耗时/速率双轴、模型环，费用图 `drawBarLine` 内按币种除率），均支持 `Y/X` 独立配置与按 `time ∩ model ∩ chat ∩ endpoint ∩ credential` 联动，`vite.define` 修复 `process` 未定义，**隐藏时跳过初始化**（`display:none` 则不渲染，切到统计页再 `setTimeout 60ms` 触发，避免 `clientWidth 0` 误报 `图表容器未就绪`）

### 历史记录
- **四维度**：模型、对话、接入类型与 API 密钥按交集过滤；接入类型优先联动密钥；筛选先作用于热+冷全量历史，再进行 `30/页` 分页，筛选无结果显示清除按钮
- 列表按 `timestamp` 倒序，卡片含模型/时间、`in/out/duration/rate`、费用、旧/新/详情
- **占比条**：`6px` 圆角三段（命中 `#0BA25E`/未命中 `#FCA5A5`/输出 `#A5B4FC`）
- **内联详情**：点击详情向下展开固定 `320→520px`（`15` 字段按 `基础/性能/Token/费用` 四块 + `4 Tab`：请求参数/完整响应/Raw 用量/消息内容，`pre` `160px` 滚动，收起切换）

### 趋势预测（Beta，独立页）
- **入口**：侧边栏 `趋势预测（Beta）`，`data-view="forecast"` 独立页，概览不再嵌入预测卡（避免与统计混淆）；顶部自选对话胶囊（`当前对话/全部/各对话`，与统计页同款，默认 `__current__` 跟随当前聊天，`__null__` 为未分组），切换后全页联动
- **预测核心**：`src/stats/forecast.ts` 分段回归（回落点 `≥30%` 分段，仅末段，最小二乘 `C₀+nΔ`，`R²` 择优 `linear/log/recent-mean`）+ `remainingRounds` 解二次方程（`Δ±σ` 给区间）+ `ctxLimitRounds`；`forecast-view.ts` 渲染预测卡（余额口径 `R`/`R(ctx)` 双条、下一轮 `prompt/cost/hit` 经 `formatMoney` 按币种）、预测图（历史散点+拟合虚线+预测延伸+置信带+`ctxLimit` 参考线，`chatId=null` 时不过滤）、敏感度滑块（假设命中率实时重算，模型取选中对话末轮）、对比视图（`topPowerChats` 最耗对话保持全局）
- **能耗评分**：`src/stats/energyScore.ts` 6 指标加权（`Δ 25%/out 20%/效率 20%/命中 15%/截断 10%/思维链占比 10%`）→ `A-G`，冷启动绝对阈值表，随历史自动切分位；`forecast-view.ts` 中能耗标识已改为基于选中对话 `energyScore(effectiveHist,null)`，文案顯示选中对话名与样本数

### 钱包（wallet，独立页）
- **入口**：侧边栏 `钱包`，`data-view="wallet"` 独立页；页面顶部为钱包汇总卡，下面按接入链接展示钱包，最后展示已忽略接入口
- **钱包粒度**：一个 `endpointId` 对应一个钱包，同一链接下多个密钥归入同一钱包；默认始终有不可删除的 DeepSeek 官方钱包。历史中已有识别的接入会在迁移时回填，新请求首次出现未忽略接入时自动创建钱包并命名成接入地址
- **固定与可编辑**：接入地址、接入类型、已识别密钥身份只读；钱包名称、模型名、价格、价格来源、峰谷规则、手工余额和忽略状态可编辑。模型改名会保留旧名别名，旧请求仍能命中规则
- **默认收起**：每个钱包默认 `collapsed=true`，收起时仍展示钱包名、接入地址、余额、密钥数、模型数、请求数、费用和待定价数量；展开状态按钱包独立记忆并随导入导出/WebDAV 同步
- **余额**：币种首版支持 `CNY/USD`，手工余额可直接填写；自动校准只开放给 DeepSeek 官方直连钱包，默认使用钱包内单独保存的校准密钥，可选一个主密钥作为账号身份。多密钥不会自动相加。钱包余额在每次请求按当前币种预扣，成功校准后覆盖为服务端余额
- **密钥隐私**：普通官方接口只记录酒馆密钥条目编号、标签和掩码末三位；反向代理 `proxy_password` 与 `custom_include_headers` 继续不读取、不比较、不持久化，因此按“未识别密钥”处理
- **钱包模型**：模型条目含 `sourceModel/model/aliases/price/source/locked`；非峰与高峰均包含命中、未命中、输出三价。每条规则可关闭峰谷、锁定防止同步覆盖。每个钱包可独立配置跨天峰谷时段与“周末全天低谷”
- **计价优先级**：钱包规则优先；DeepSeek 官方钱包无覆盖时使用内置 `PRICE_HISTORY` 多段价格；其他钱包无价格时标记待定价并计零费用。旧全局 `customModels` 复制到官方钱包并继续作为旧记录/未映射记录只读兜底
- **旧数据同名校验价**：一次迁移中，若旧热/冷记录按当前钱包规则为 `unpriced`，且任意未忽略钱包存在模型名与记录完全相同的已配置价格，则给该历史条目写入 `legacyPricingWalletId/legacyPricingModel` 并以该钱包价格重算，`pricingSource=legacy-match`。新版本之后产生的请求不带该标记，仍按所属钱包原规则保持待定价
- **待定价重算**：保存模型价格、修改峰谷、修改周末规则或同步价格后调用 `repository.recalcWallet(walletId)`，同时处理热历史和 IndexedDB 冷历史，并修正累计费用
- **models.dev**：每个钱包配置 `catalogProvider`。开启同步后，官方接入自动映射来源，中转站由用户选择；支持 `add-missing/overwrite-unlocked/overwrite-all`，锁定规则仅允许全部覆盖模式修改。关闭同步会移除未锁定的同步价格并重算
- **忽略与恢复**：删除钱包改为加入 `walletIgnored`，后续请求不自动重建、不参与余额合计，历史仍保留 `walletId`；钱包页可恢复显示。DeepSeek 官方钱包不可忽略
- **响应式**：钱包汇总卡在所有宽度保持一行三列，仅压缩字号和间距；钱包双栏区域在窄屏改为单列。钱包卡内容使用边框面板，不嵌套 `.ds-card`

### 设置
- 保留全局控制：颜色模式、历史显示范围、自动校准总开关与间隔、新价格机制（日期）、新钱包默认峰谷、models.dev 自动同步、调试、峰值圆点和 WebDAV
- 已迁出钱包页：API 密钥、手工余额、模型与价格编辑。旧 API 密钥、旧余额和旧 `customModels` 由 `repository.hydrate` 自动迁移到 DeepSeek 官方钱包；隐藏兼容控件不参与新增配置
- `models.dev` 同步已改为逐钱包写入，预览和状态显示总新增/更新/跳过/待定价数量；全局开关关闭时只移除未锁定的同步规则
- 货币切换仍通过 `formatMoney/getDisplayCurrency` 全站即时换算；钱包余额汇总固定使用 `pricingSync.exchangeRate`，不因关闭美元展示而错误回退为 `1`

## 样式规范（DeepSeek 截图定版）

- 变量：`--ds-bg:#FFFFFF --ds-card:#F6F7F8 --ds-text:#111827 --ds-border:#E5E7EB --ds-black:#111827 --ds-orange:#FF6A00 --ds-green-bg:#E6F8EC --ds-green:#0BA25E --ds-radius-card:14px --ds-radius-pill:999px`，深色 `data-ds-theme="dark"` 同名覆盖（`--ds-bg:#0F1419/--ds-card:#1E242E/--ds-text:#E5E7EB` 高对比，`ECharts` 经 `themeColor()` 动态取变量保证可读性）
- 选择器统一：所有选择类 UI 必须使用用量统计·模型选择同款胶囊下拉（`#xxx-btn` 胶囊 `999px` + `#xxx-dropdown` 绝对定位 `12px` 圆角 `box-shadow`），禁止原生 `select`，选中态 `background:var(--ds-card)` 加粗
- 魔法棒悬停：`background: transparent !important`
- 文字：`Microsoft YaHei`，无 `antialiased/optimizeLegibility` 干预
- 移动端：`≤760px` 侧边栏 `display:none` 默认隐藏、`#aus-mobile-header` 汉堡（`24px` `☰`，`display:flex`）瞬时呼出 `is-open`，无遮罩无动画；`#aus-panel flex:column + #aus-panel-body flex:row`（`#aus-main overflow-x:hidden + min-width:0` 约束防止 720px 表撑开），概览 8 块保持 `repeat(2,1fr)` 两列，钱包汇总卡强制保持 `repeat(3,minmax(0,1fr))` 一行三列，钱包双栏和其他网格 `4→1` 列，窄屏所有胶囊下拉 `overflow:visible + z-index:50` 不被裁剪

## 常见任务

- **改定价/峰谷**：内置价看 `src/constants/pricing.ts` + `src/services/pricing.ts`；钱包价和独立峰谷看 `src/data/wallets.ts` + `src/ui/wallet-view.ts`；`calcCost/calcSavings/getPricing/hasPriceForModel` 均支持可选钱包上下文，未传钱包时保持旧行为
- **加价格段（多段定价）**：`PRICE_HISTORY[模型].push({since: 生效时间戳, offpeak, peak, usePeakPricing?, peakHours?, label?})`（按 `since` 升序，命中 `timestamp>=since` 最后一段，未来段同样写法）；内置段按记录时间查询，钱包手工/同步规则覆盖后不分段；改价后按钱包执行冷热重算
- **改面板/导航**：`src/ui/panel.ts`（全屏+`positionPanel` 定位置换+`applyCollapsed`）+ `style.css`（`#aus-mobile-header` 汉堡 + `display` 切换，无过渡）
- **改概览/统计**：`src/ui/overview.ts` + `src/ui/stats-view.ts`（五维度 time∩model∩chat∩endpoint∩credential 过滤）+ `src/data/computed.ts`（`computeChatStats` / `filterStatsHistory` / 接入与密钥选项单源）+ `src/ui/heatmap.ts`（概览热力图，GitHub 风格，近 2 年，块内滑动）
- **改钱包**：`src/types/wallet.ts`（结构与默认值）+ `src/data/wallets.ts`（纯逻辑）+ `src/data/repository.ts`（迁移、自动建钱包、钱包 CRUD、余额和冷热重算）+ `src/ui/wallet-view.ts`（页面交互）+ `src/services/wallet-secrets.ts`（钱包校准密钥）
- **改历史筛选/详情/占比**：`src/ui/panel.ts`（`renderHistory` 四维度筛选 + 筛选后分页 + 内联展开 + 三色条，费用按币种）
- **改连接身份/隐私**：`src/services/connection-identity.ts`（地址规范、密钥条目映射）+ `src/services/interception.ts`（请求开始快照）+ `src/data/fingerprint.ts`（连接感知去重）；严格隐私模式禁止读取 `proxy_password` 与 `custom_include_headers`
- **改同步/导入**：`src/services/sync.ts` + `src/services/import-export.ts`（保持 `deepseek-stat-export v1` 兼容；钱包配置通过可选 `wallets/walletIgnored/walletFormat:2` 携带，导出经 `getAllHistory` 含冷库全量，导入超 `MAX_HISTORY` 自动回冷库，任何钱包校准密钥均不导出）+ `src/services/pricing-sync.ts`（models.dev 按钱包同步）
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
- **接入/密钥筛选为空**：先检查 `state.history[]` 是否已有 `endpointId/credentialId`；旧记录只会进入“未记录接入/未识别密钥”，反向代理密码模式按严格隐私归入未识别密钥；密钥条目能力依赖酒馆 `>=1.14.0`，1.11 至 1.13 只能区分接入类型
- **钱包费用为 0**：先检查 `history[].walletId`、钱包 `models[].priceConfigured` 和 `pricingSource`。待定价模型按设计为 0；保存价格、切换价格来源或执行 models.dev 同步后应调用 `recalcWallet`。DeepSeek 官方旧模型若已迁移进钱包，需确认没有误设成未定价 discovered 规则
- **钱包没有自动创建**：确认请求包含 `endpointId`，且对应 `wallet:<endpointId>` 未被加入 `walletIgnored`；反向代理仅创建按地址区分的钱包，不识别代理密码
- **钱包展开状态异常**：状态存于 `WalletConfig.collapsed`，默认 `true`，旧数据缺字段也按收起处理；若展开后刷新仍收起，检查热持久化是否覆盖了 `wallets` 字段
- **窄屏汇总错位**：钱包汇总卡必须使用 `repeat(3,minmax(0,1fr))`，内侧文本用省略号或缩小字号，不能退回 `1fr` 三行

## 版本与发布管控（新增，基于分支隔离）

- **分支模型**：`main` 稳定发布（普通用户跟踪）/ `dev` 日常测试（开发者自用酒馆中手动将扩展更新源切为 `dev`）；`beta` 可选作小范围公测。禁止直接 `push main` 做测试，所有功能先在 `dev` 验证。
- **版本真源**：`manifest.json#version` 唯一来源，`vite.config.ts` 注入 `__APP_VERSION__`，侧边栏/关于/导出/检查更新均取此值，禁止硬编码 `v3.0.x`
- **版本号推进管控（最高优先级，强制）**：没有用户当轮的**明确要求**，一律禁止推进版本号。禁止执行 `npm version`，禁止改动 `manifest.json#version` 与 `package.json#version`，禁止新建或移动 `vX.Y.Z` 标签，禁止合并到 `main`，禁止执行 `git push origin main --tags`。`dev` 上完成需求只做常规提交与 `git push origin dev`；版本推进、打标签、合并 `main` 与正式发布均属发布动作，必须等用户明确下达（一次明确要求只覆盖当轮那一次发布），未获要求时即使功能已通过 `typecheck + build + node --check` 也不得自行推进。
- **合并 ≠ 授权推进版本（最高优先级，强制，2026-09-10 事故后追加）**：用户说“合并到主线 / 合并 main / 发布”**只授权合并本身**，不等于授权推进版本号或打标签。除非用户在同一轮**明确说出目标版本号**（如“推进到 3.0.8”）或明确要求“推进 patch/minor 版本号并打标签”，否则合并 `main` 时 `manifest.json#version`、`package.json#version`、`package-lock.json#version` 一律保持原值，禁止 `git tag`、禁止 `git push --tags`，只做 `git merge --no-ff dev` + 常规 `git push origin main`。授权范围按**字面最小化**解释：任何“看起来顺理成章”的配套动作都不构成授权，宁可少做一步、等用户补一句。
- **违规回退义务（最高优先级，强制）**：一旦擅自推进了版本号或打了标签，必须立刻回退：把 `manifest.json` + `package.json` + `package-lock.json` 改回原版本号 → `npm run typecheck && npm run build && node --check index.js` 重建产物 → 提交推送 → 删除本地与远端多余标签（`git tag -d vX.Y.Z`、`git push origin :refs/tags/vX.Y.Z`），并在回复中明确说明已回退。
- **开发→测试→发布**（合并与版本推进是两次独立授权，缺一不可省略）：
  1. `feature/* → dev`：`npm run typecheck && npm test && npm run build && node --check index.js && npm run verify:ci` → `git push origin dev` → 酒馆切 `dev` 分支真机测试
  2. `dev → main`（**仅用户当轮明确要求“合并”时**）：`git checkout main && git merge --no-ff dev` → 解决 `index.js` 等产物冲突 → `git push origin main`；**到合并为止**，版本号与标签保持原样
  3. 版本推进 + 打标签（**必须由用户当轮单独明确授权**）：`manifest.json` + `package.json` + `package-lock.json` 同步改为目标版本 → `npm run build` 重建产物 → 提交 → `git tag vX.Y.Z` → `git push origin main --tags`
  4. 回滚（**仅用户明确要求时**）：按用户指定版本回退并重建产物，多余标签在本地与远端一并删除
- **预览预发布边界**：`preview-*` 标签与 Release 只允许由 `main` 分支的 `preview` 作业创建，`dev` 与合并请求永不发布；预览标签基于 12 位提交哈希且不可复用或移动，但**不属于正式版本推进**，不得借预览发布修改 `manifest.json`、`package.json`、`package-lock.json` 的版本字段，也不得创建或移动 `vX.Y.Z` 标签。同一提交重复自动运行或手动补发只更新既有 Release 标题、说明与同名资产，不产生第二个标签
- **产物铁律**：`Vite lib` 产物为 `index.js(入口) + index-*.js/update-*.js + ECharts 9 块`，`index.js` 为 `import "./index-*.js"` 存根，**必须**随 `index.js` 一并 `git add` 提交，缺一则 `404 index-*.js` 导致 `[object Event]` 加载失败并中断后续扩展；`style.css` 同理直出，`outDir: '.' + emptyOutDir:false` 禁止误删。
- **主题一致性**：`defaultSettings.theme` 默认为 `light`，与隔离样式浅色保持一致；旧用户无 `theme` 字段时迁移补 `light`，禁止在更新中强制覆为 `dark`
- **检查更新**：`src/services/update.ts` 优先对比 `main` 提交哈希（本地扩展提交经 GitHub compare 判领先，失败回退 `raw.githubusercontent.../main/manifest.json` 的 `version` 与本地 `__APP_VERSION__` 对比），自动检查 1h 节流（`localStorage + extensionSettings._updateLastCheck`，1 小时内最多一次），关于页按钮为手动触发（不受节流），有更新 `toast + 横幅`，已是最新/检查失败时自动与手动均 `toast` 提示

## 提交与发布

```bash
# 日常开发（在 dev）
git checkout dev
# ... 改 src/ ...
npm run typecheck && npm test && npm run build && node --check index.js && npm run verify:ci
git add src/ style.css manifest.json index.js index-*.js update-*.js Axis-*.js ...
git commit -m "feat/fix: ..."
gh auth status                         # WSL 认证检查
git push origin dev                    # 仅 dev，用户无感知

# ① 合并主线（用户说“合并到主线”时只做这一步，版本号与标签一律保持原样）
git checkout main && git merge --no-ff dev
git push origin main
# main 推送通过完整 CI 后会自动创建或更新 preview-<12位提交哈希> 预发布

# ② 推进版本 + 打标签（必须由用户当轮单独明确授权，例如“推进到 3.0.8”“发一个 patch”）
#    未获独立授权时禁止执行下面任何一行
# 同步改 manifest.json + package.json + package-lock.json 的 version 为目标版本号
npm run build && git add . && git commit -m "chore: 版本号推进至 vX.Y.Z 并重建产物"
git tag vX.Y.Z
git push origin main --tags
```

- **自动提交规则**：完整完成一项独立修改后必须立即执行提交推送，无需等待用户二次确认。单项定义：通过 `typecheck + test + build + node --check + verify:ci` 且满足用户当轮需求即视为完成。提交需包含 `src/` 源码与 `index.js/style.css` 产物，`commit` 信息遵循 `fix/feat/docs:` 前缀并简述本次变更点。该自动提交仅限 `dev` 的常规提交，不含版本号推进、合并 `main` 与打标签。
- **提交时机（强制）**：所有修改必须在完整完成并验证通过后最后统一提交，禁止边改边提、分步提交或提前推送。提交前必须依次通过 `npm run typecheck`、`npm test`、`npm run build`、`node --check index.js`、`npm run verify:ci`，且 `index.js/style.css` 与源码保持一致后，一次性添加源码、测试、CI 配置与产物并推送，单轮需求仅产生一次提交。同样禁止在未获明确要求时改动版本号字段。
- **预览包本地验证**：可用 `node scripts/preview-package.mjs <输出目录> HEAD` 复现 `main` 预览包；脚本只读取指定提交，通过 `git archive` 生成压缩包，并校验清单、入口、引用链、允许文件集合、压缩包结构和 SHA-256。可用 `node scripts/preview-notes.mjs <输出文件> HEAD` 复现更新日志，生成时优先读取上一个 `preview-*`（首次回退最近正式标签）到当前提交的全部提交。不得修改源码或提交产物后再打包。
- 产物入口存根 `index.js` + `ECharts` 等 hash 分包随仓库提交以保离线加载，`style.css` 直出，勿手改产物；`vite.config.ts` 已 `define: { process.env.NODE_ENV, __APP_VERSION__ }` 防浏览器 `process` 报错且实现版本单源化
- `RE3.0` 仅同步产物备份，不作为提交源

## 其他经验

- **动态分包 404 坑**：`import('../services/update')` 等动态 `import()` 会使 `Vite lib` 输出额外 `index-*.js`，`index.js` 仅为 re-export 存根；若漏提交新 hash 文件，扩展激活时 `GET .../index-*.js 404` → `Could not activate extension [object Event]` 并阻断后续扩展加载，属全站故障
- **TTFT/思维链为 0 坑**：`GENERATION_ENDED` 主路径不带 `ttft`，需在 `onGenerationEnded` 中合并最近 `lastFetchUsage.ttft/thinkTime/finishReason`（5s 内有效），否则 `tokenRate` 失真且详情为 0
- **截断率/思维链占比**：`finish_reason === 'length'` 判截断，`thinkTokens/completion_tokens` 算占比，统计块与详情均基于此；`isTruncated` 持久化于 `HistoryEntry`
- **详情双占比去重**：性能块与 Token 消耗块曾各显示一次“思维链占比”，后收敛为仅性能块保留，Token 块改为单列占满的“思维链 Token”
- **密钥身份与隐私**：普通官方接口的密钥由酒馆后端注入，扩展只读活动密钥条目编号、标签和掩码末三位；反向代理的 `proxy_password` 与 `custom_include_headers` 不读取、不比较、不持久化，因此同一中转地址下的反向代理密码无法细分
- **连接身份落盘**：`HistoryEntry` 只保存 `sourceType/endpointId/endpointLabel/credentialId/credentialLabel`，其中接入地址经短哈希生成稳定标识，界面仅显示域名与路径；新增字段为可选兼容字段，随导入导出和 WebDAV 同步透传，不改变导出格式版本
- **钱包计费隔离**：同一模型名在不同钱包可以使用完全不同的价格和峰谷；匹配顺序为钱包当前模型名/来源模型名/别名，先用 `walletId` 定位历史归属，旧记录才回退接入地址或全局价格
- **钱包迁移边界**：旧 `customModels` 复制到 DeepSeek 官方钱包但原全局数组保留；带接入地址的旧历史会建立钱包并尽量复制对应旧价格，未识别接入或无地址记录继续使用旧全局兜底
- **余额口径**：概览钱包选择器只影响充值余额和剩余轮次预测，累计消费、热力图、按对话统计等保持全量；余额汇总按 `CNY/USD` 换算，钱包扣费按钱包自身币种
- **WalletConfig 兼容**：新增字段必须提供默认值；`collapsed` 缺省为 `true`，`legacyPricingImported` 防止重复迁移，`walletIgnored` 决定是否允许自动重建
- **旧价回填边界**：同名校验只按完整模型名匹配，不做别名/归一化；只运行一次并覆盖升级时的热冷历史，新请求仍用钱包自身规则。匹配钱包价格变更时，`recalcWallet` 会同时重算引用该钱包的 `legacy-match` 条目
- **筛选与分页顺序**：统计页统一走 `filterStatsHistory`；历史页先对热冷全量历史执行 `model ∩ chat ∩ endpoint ∩ credential`，再进行 `30/页` 分页，筛选不参与分页会导致总数错误
- **三块竖屏**：统计页 `消费金额/API 次数/Tokens` 在 `760px` 下已为 `1fr` 单列三行，满足一行一列需求；新增 `statsFour` 4 块在竖屏为 `2×2`
- **自定义日期**：统计页 `自定义` 原为双月日历，现为直输 `input[type=date]` 两框 + 应用按钮，`max` 限今日，自动纠正起止倒置
- **货币与同步**：开关开启时全站 `formatMoney(cny)` → `$/USD`（`CNY/rate`），关闭回 `¥/CNY`；`models.dev` 价为 `$US` 仅 `cost` 无 `currency`，同步时 `USD→CNY*rate`，DeepSeek 系模型再合成 `2×` 峰价并写入钱包规则；模型价格输入框开启 `USD` 时双向换算（显示 `CNY/rate`，保存 `USD*rate`）；钱包余额汇总固定使用 `getWalletExchangeRate()`，不受展示币种开关影响。汇率双源 `open.er-api.com → api.exchangerate-api.com` 24h 节流，定时器随 `pricingSync.enabled/useLiveRate` 启停

## 注意事项

- **编码**：`UTF-8`，中文路径/注释保持，勿用 PowerShell `>` 重定向破坏编码
- **WSL Git 认证**：Git 推送固定从 WSL 使用 `/usr/bin/git` + `gh auth git-credential`，无需再切 Windows；提交推送前可用 `gh auth status` 与 `git push --dry-run origin dev` 检查
- **中文**：所有思考与输出保持中文（最高优先级）
- **脚本隔离**：勿改 `pr/DeepSeek使用预测.js`，扩展与脚本独立演进
- **数据唯一**：所有存/取/算/展必经 `src/data/`，禁止绕过
