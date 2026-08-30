# AGENTS.md — API用量统计（Api-Usage）

## 概览

SillyTavern 原生扩展 `API用量统计`（`manifest: api-usage-stat@3.0.0`），从 `deepseek-tavern-script` 酒馆助手脚本迁移而来。

- **真源**：`D:/Desktop/DeepSeek/Api-Usage`（独立仓库 `https://github.com/janmk1453/Api-Usage`，`main` 分支）
- **归档**：`pr/RE3.0/迁移重构计划.md` 仅作设计归档，不作为开发目录
- **脚本主线不变**：`pr/DeepSeek使用预测.js` 仍为脚本真源，扩展与脚本数据通过 `deepseek-stat-export v1` 互通，不自动覆盖

**规则：所有有关重构迁移版的修改一律在 `Api-Usage` 下进行，所有产物亦在此。禁止在 `pr/RE3.0` 继续开发。**

## 技术栈（已确认）

- **打包**：`Vite 5`（`lib: es / cssCodeSplit:false`，产物 `index.js + style.css` 直出根目录）
- **语言**：`TypeScript 5 strict`
- **图表**：`ECharts 5` 按需 `echarts/core + Bar/Heatmap + Grid/Tooltip/VisualMap/CanvasRenderer`，懒加载分包（首屏 `~73kB`）
- **样式**：无框架，`SmartTheme` 隔离 + `DeepSeek 官方浅色`（`#FFFFFF/#F6F7F8/#111827/#FF6A00/#E6F8EC`，`Microsoft YaHei`，`14px` 圆角，无阴影/无滤镜以保锐利）
- **存储**：`extensionSettings[api_usage_stat]` 热 50 条 + `IndexedDB api_usage_stat_db` 冷分页（`maxHistoryItems=500` 热，`IndexedDB` 兜 `5000`），`XOR` 密钥兼容，旧 `ds_*` 自动迁移备份
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
│   │   ├── repository.ts  # 唯一写入口：addEntry/recalcAll/replaceAll/hydrate + persist
│   │   ├── computed.ts    # 唯一算入口：computeOverview/computeStats/getFilteredHistory
│   │   └── events.ts      # DataEvents.UPDATED/HISTORY_ADDED/SETTINGS_CHANGED
│   ├── store/index.ts, persistence.ts # 底层状态与冷热分页（仅 repository 调用）
│   ├── services/pricing.ts, interception.ts(delegates→repository), balance.ts, import-export.ts, sync.ts
│   ├── utils/date.ts, crypto.ts, logger.ts
│   └── ui/panel.ts, overview.ts, stats-view.ts, stats.ts, charts.ts, compare.ts, settings.ts, peak-dot.ts, customize.ts
├── README.md
├── 迁移重构计划.md        # 同步自 RE3.0 的计划副本（可选）
└── LICENSE
```

## 开发流程

```bash
cd Api-Usage
npm install
npm run typecheck   # tsc --noEmit 必须通过
npm run build       # 产出 index.js + 拆分 chunk（barGrid等懒加载）
node --check index.js
```

- **入口**：酒馆左下角魔法棒 `#extensionsMenu → #aus_wand_entry`（`list-group-item`），点击 `togglePanel()` 打开全屏 `#aus-overlay + #aus-panel`（`fixed inset:0` 白底，非 `inline-drawer`）
- **面板**：`createPanel/openPanel/closePanel/togglePanel`（单例，`will-change:auto` 即时销毁合成层，`display:flex` + `overflow:auto`，无 `backdrop-filter/阴影` 干扰）
- **样式**：`[data-extension="api-usage-stat"][data-ds-theme="light"]` 隔离，卡片 `1px solid #E5E7EB` 实线，无 `box-shadow`，字重 `600`，`Microsoft YaHei` 保证锐利
- **拦截**：`GENERATION_ENDED → chat[].extra.api_usage` 主路径，`ApiUsageStatInterceptor` 辅路径，`processUsage/recalcAllCosts` 1:1 脚本
- **数据框架**：所有存/取/算/展必须走 `src/data/` — `repository` 唯一写（`addEntry/recalcAll/replaceAll/hydrate`）、`computed` 唯一算（`computeOverview/computeStats`）、`events` 订阅刷新；禁止在 UI 中直接读写 `state.saves` 或手算 `history` 求和
- **持久化**：`saveHot` 节流 `300ms`，`loadHot/migrateIfNeeded` 仅由 `repository` 调用，UI 不直连 `persistence`

## 样式规范（DeepSeek 截图定版）

- 变量：`--ds-bg:#FFFFFF --ds-card:#F6F7F8 --ds-text:#111827 --ds-border:#E5E7EB --ds-black:#111827 --ds-orange:#FF6A00 --ds-green-bg:#E6F8EC --ds-green:#0BA25E --ds-radius-card:14px --ds-radius-pill:999px`
- 魔法棒悬停：`background: transparent !important`（跟随酒馆，不白底）
- 文字：`Microsoft YaHei`，无 `antialiased/optimizeLegibility` 干预，交还系统默认以保清晰

## 常见任务

- **改定价/峰谷**：`src/constants/pricing.ts` + `src/services/pricing.ts`（纯函数，`isPeakHour(timestamp, peakHours)` 不读全局）
- **改面板**：`src/ui/panel.ts`（全屏结构）+ `style.css`（浅色卡）
- **改图表**：`src/ui/charts.ts`（按需 ECharts）
- **改同步**：`src/services/sync.ts`（`pull-merge-push`，`https` 强制，`proxy?url=`）

## 提交与发布

```bash
git add src/ style.css manifest.json index.js
git commit -m "feat/fix: ..."
git push origin main
# 发版（可选）
gh release create v3.0.0 --title "3.0.0" --notes "..." 
```

- 产物 `index.js` 为构建后单文件（`73kB`）+ 拆分 `barGrid-*` 等按需，`style.css` 直出，勿手改产物
- `RE3.0` 仅同步产物备份，不作为提交源

## 注意事项

- **编码**：`UTF-8`，中文路径/注释保持，勿用 PowerShell `>` 重定向破坏编码
- **中文**：所有思考与输出保持中文（最高优先级）
- **脚本隔离**：勿改 `pr/DeepSeek使用预测.js`，扩展与脚本独立演进
