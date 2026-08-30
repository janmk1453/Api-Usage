# AGENTS.md — API用量统计（Api-Usage）

## 概览

SillyTavern 原生扩展 `API用量统计`（`manifest: api-usage-stat@3.0.0`），从 `deepseek-tavern-script` 酒馆助手脚本迁移而来。

- **真源**：`D:/Desktop/DeepSeek/Api-Usage`（独立仓库 `https://github.com/janmk1453/Api-Usage`，`main` 分支）
- **归档**：`pr/RE3.0/迁移重构计划.md` 仅作设计归档，不作为开发目录
- **脚本主线不变**：`pr/DeepSeek使用预测.js` 仍为脚本真源，扩展与脚本数据通过 `deepseek-stat-export v1` 互通，不自动覆盖

**规则：所有有关重构迁移版的修改一律在 `Api-Usage` 下进行，所有产物亦在此。禁止在 `pr/RE3.0` 继续开发。后续构建与提交均以 `Api-Usage` 为准，`RE3.0` 仅同步产物备份。**

## 技术栈（已确认）

- **打包**：`Vite 5`（`lib: es / cssCodeSplit:false`，产物 `index.js 150k + ECharts 分包` 直出，`define: process.env.NODE_ENV="production"` 以修复浏览器 `process` 未定义）
- **语言**：`TypeScript 5 strict`
- **图表**：`ECharts 5` 按需 `echarts/core + Bar/Line + Grid/Tooltip/CanvasRenderer`，动态分包（`core` 等 9 产物，已提交，随 `index.js` 按需加载），`Y` 8 选项×`X` 5 维度（见下）
- **样式**：无框架，`SmartTheme` 隔离 + `DeepSeek 官方浅色`（`#FFFFFF/#F6F7F8/#111827/#FF6A00/#E6F8EC`，`Microsoft YaHei`，`14px` 圆角，无阴影/无滤镜以保锐利，`absolute` 定位置换修复窄屏 `fixed` 漂移）
- **存储**：`extensionSettings[api_usage_stat]` 热 `50` 条 + `IndexedDB api_usage_stat_db` 冷分页（旧多存档已合并为单一历史，`XOR` 密钥兼容，自动迁移备份）
- **最低版本**：`manifest.minimum_client_version 1.11.0`

## 目录

```
Api-Usage/
├── manifest.json          # 扩展清单（display_name/loading_order/js/css/i18n/hooks）
├── index.js / style.css   # Vite 产物（ST 直接加载，勿手改，改 src 后重建）
├── global.d.ts            # ST 全局类型补全
├── package.json / vite.config.ts / tsconfig.json
├── i18n/zh-cn.json
├── templates/panel.html   # 预留 Handlebars
├── src/
│   ├── index.ts           # 入口：repository.hydrate + 魔法棒注入 + 全屏面板 + 峰值圆点
│   ├── constants/pricing.ts  # PRICING/DEFAULT_PEAK_HOURS/MAX_HISTORY/DETAIL_KEEP/STORAGE_KEYS
│   ├── types/save.ts, settings.ts
│   ├── data/              # ★ 统一数据框架（所有存/取/算/展的唯一通路）
│   │   ├── types.ts       # Snapshot/Aggregated/TimeRange/OverviewView/StatsView
│   │   ├── repository.ts  # 唯一写入口：addEntry/recalcAll/replaceAll/hydrate + persist（单一历史）
│   │   ├── computed.ts    # 唯一算入口：computeOverview/computeStats/getFilteredHistory
│   │   └── events.ts      # DataEvents.UPDATED/HISTORY_ADDED/SETTINGS_CHANGED
│   ├── store/index.ts, persistence.ts # 单一历史聚合（已废弃多存档，saves 仅作迁移兼容）
│   ├── services/pricing.ts, interception.ts(delegates→repository), balance.ts, import-export.ts(单一历史), sync.ts(单一历史), debug.ts
│   ├── utils/date.ts, crypto.ts, logger.ts
│   └── ui/panel.ts(全屏+侧边导航+absolute 定位), overview.ts(双明细+四块), stats-view.ts(日历+双维度+图表Y/X配置), chart-config.ts(Y 8×X 5 聚合), stats.ts(旧统计卡), charts.ts(旧), compare.ts(内联详情), settings.ts(完整设置), peak-dot.ts, customize.ts
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
- **面板**：全屏 `absolute` 定位置换 + 侧边导航（`220px ↔ 60px`，`≤760px` 自动收起 `60px` 图标栏，展开 `220px` 覆盖式 + 遮罩），`6` 视图（用量概览/统计/历史/设置/使用说明/关于）经 `data-view` + `opacity 0.15s` 切换，`sidebar-toggle` 同步宽度与标签显隐
- **样式**：`[data-extension="api-usage-stat"][data-ds-theme="light"]` 隔离，卡片 `1px solid #E5E7EB` 实线，无 `box-shadow`，字重 `600`，`Microsoft YaHei` 保证锐利；`#aus-sidebar` 过渡 `width 0.2s`，移动端横向可滚动
- **拦截**：`GENERATION_ENDED → chat[].extra.api_usage` 主路径，`ApiUsageStatInterceptor` 辅路径，`repository.addEntry/recalcAll` 1:1 脚本
- **数据框架**：所有存/取/算/展必须走 `src/data/` — `repository` 唯一写、`computed` 唯一算（`computeOverview` 供概览 8 块，`computeStats` 供统计）、`events` 订阅刷新；禁止在 UI 直接读写 `state.history` 聚合或手算
- **持久化**：`saveHot` 节流 `300ms`，`loadHot/migrateIfNeeded` 仅由 `repository.hydrate` 调用，已自动将旧多存档合并为单一历史（`hot 50` + `cold_history`）

## 页面与数据

### 用量概览（overview）
- **双余额卡**：充值余额（`customBalance|balance`）+ 累计消费（`¥ + CNY` + `tokens`）
- **双明细**：历史消耗（Token 历史/命中/未命中/输出，右对齐）与支出明细（预计节省/支出输入/输出，分两行，`token` 灰 `10px #9CA3AF`）并列
- **四小块**：每轮费用（`CNY`）/每轮 Token/平均耗时 `s`/输出速率 `t/s`（`computeOverview` 单源）

### 用量统计（stats）
- **双维度**：时间维度（`全部/今天/昨天/近 7 天/近 30 天/本月/上月/自定义` 双月日历，仅 `自定义` 时显示日历，`‹/›` 月份切换，`全部` 为 `2020-01-01~今日`）仅影响 `消费金额/API 次数/Tokens/模型汇总`；模型维度（同款胶囊，列表为所有已记录模型 + 全部）影响本页所有内容（`三块`+`汇总表`+`图表`）；筛选为 `time ∩ model`，日历选中态仅对当前选项生效
- **三块**：消费金额 `CNY`/API 请求次数/Tokens
- **模型汇总表**：`10` 列（模型/调用/命中/未命中/输出/总/总成本/平均成本/平均耗时/平均速率），横向可滚动，随双维度联动
- **图表**：首图通用 `图表`（`Y` 8 项多选 + `X` 5 维度双胶囊）+ 下方 `6` 图 `2×3` 网格（Token/费用堆叠同柱 `stack:'total'` + 曲线、命中 `100%` 面积、请求数柱、耗时/速率双轴、模型环），均支持 `Y/X` 独立配置与按 `time ∩ model` 联动，`vite.define` 修复 `process` 未定义

### 历史记录
- 列表按 `timestamp` 倒序，卡片含模型/时间、`in/out/duration/rate`、费用、旧/新/详情
- **占比条**：`6px` 圆角三段（命中 `#0BA25E`/未命中 `#FCA5A5`/输出 `#A5B4FC`）
- **内联详情**：点击详情向下展开固定 `320→520px`（`15` 字段按 `基础/性能/Token/费用` 四块 + `4 Tab`：请求参数/完整响应/Raw 用量/消息内容，`pre` `160px` 滚动，收起切换）

### 设置（完整迁移原脚本）
- `API 密钥 / 自动校准余额（开关+间隔）/ 自定义余额 / 新价格机制（开关+日期+今日）/ 高峰时段（可增删跨天，改后重算）/ 模型与价格（内置 3 模型可覆写+自定义增删，峰谷开关，三价 ¥/百万）/ 调试（开关+hit/miss/output/model/date/batchCount+生成）/ 峰值圆点（开关+重置）/ WebDAV（url/user/pass/path/proxy+同步，`https` 强制，`pull-merge-push`）`，全部浅色卡片，改后 `recalcAll`+`refreshUI`

### 存档
- **已废弃**：移除 `saves/currentSave` 多存档，收敛为单一 `history` 聚合；保留 `saves` 在导入/同步/迁移中的兼容解析，旧文件自动合并去重，不影响现有功能

## 样式规范（DeepSeek 截图定版）

- 变量：`--ds-bg:#FFFFFF --ds-card:#F6F7F8 --ds-text:#111827 --ds-border:#E5E7EB --ds-black:#111827 --ds-orange:#FF6A00 --ds-green-bg:#E6F8EC --ds-green:#0BA25E --ds-radius-card:14px --ds-radius-pill:999px`，深色 `data-ds-theme="dark"` 同名覆盖（`--ds-bg:#0F1419/--ds-card:#1E242E/--ds-text:#E5E7EB` 高对比）
- 选择器统一：所有选择类 UI 必须使用用量统计·模型选择同款胶囊下拉（`#xxx-btn` 胶囊 `999px` + `#xxx-dropdown` 绝对定位 `12px` 圆角 `box-shadow`），禁止原生 `select`，选中态 `background:var(--ds-card)` 加粗
- 魔法棒悬停：`background: transparent !important`
- 文字：`Microsoft YaHei`，无 `antialiased/optimizeLegibility` 干预
- 移动端：`≤760px` 侧边栏自动收起 `60px`，展开 `220px` 覆盖式（`absolute` + 遮罩），网格 `4→2→1` 列自适应

## 常见任务

- **改定价/峰谷**：`src/constants/pricing.ts` + `src/services/pricing.ts`（纯函数，`isPeakHour(ts, peakHours)` 不读全局）
- **改面板/导航**：`src/ui/panel.ts`（全屏+`positionPanel` 定位置换+`applyCollapsed`）+ `style.css`
- **改概览/统计**：`src/ui/overview.ts` + `src/ui/stats-view.ts`（双维度过滤）+ `src/data/computed.ts`
- **改历史详情/占比**：`src/ui/panel.ts`（`renderHistory` 内联展开 + 三色条）
- **改同步/导入**：`src/services/sync.ts` + `src/services/import-export.ts`（单一历史）

## 提交与发布

```bash
git add src/ style.css manifest.json index.js
git commit -m "feat/fix: ..."
git push origin main
```

- **自动提交规则**：完整完成一项独立修改后必须立即执行提交推送，无需等待用户二次确认。单项定义：通过 `typecheck + build + node --check` 且满足用户当轮需求即视为完成。提交需包含 `src/` 源码与 `index.js/style.css` 产物，`commit` 信息遵循 `fix/feat/docs:` 前缀并简述本次变更点。
- 产物 `index.js 150k` + `ECharts` 分包（`Axis-*` 等 9 个）随仓库提交以保离线加载，`style.css` 直出，勿手改产物；`vite.config.ts` 已 `define: process.env.NODE_ENV` 防浏览器 `process` 报错
- `RE3.0` 仅同步产物备份，不作为提交源

## 注意事项

- **编码**：`UTF-8`，中文路径/注释保持，勿用 PowerShell `>` 重定向破坏编码
- **中文**：所有思考与输出保持中文（最高优先级）
- **脚本隔离**：勿改 `pr/DeepSeek使用预测.js`，扩展与脚本独立演进
- **数据唯一**：所有存/取/算/展必经 `src/data/`，禁止绕过
