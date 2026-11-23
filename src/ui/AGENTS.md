# src/ui/AGENTS.md — 面板、页面与样式分册

> 仓库根 `AGENTS.md` 的模块分册：改 `src/ui/**` 或 `style.css` 前必读。根文件的铁律、数据通路、版本与提交约定同样适用。


## 入口与面板

- 酒馆左下角魔法棒 `#extensionsMenu → #aus_wand_entry` → `togglePanel()` 打开 `#aus-overlay + #aus-panel`（`position:absolute` 视口计算，监听 `scroll/resize`；**不用 `fixed`**，否则会被带 `transform` 的祖先把窄屏拽偏）。8 个视图经 `data-view` 切换、只重绘目标视图；桌面与窄屏都播 `aus-view-in`（220ms，`prefers-reduced-motion` 下 0ms，先起动画再建 DOM/ECharts）；图表宽度兜底用下一帧 `requestAnimationFrame`，不用定时器。
- **公告弹窗**（`ui/announcement-dialog.ts`）：与「更新了什么」共用 `.aus-cl-mask` / `.aus-cl` 外壳（`style.css`「更新弹窗」段），正文换成多条公告，`.aus-an-*` 只负责内容排版（`[data-level]` 决定橙边 / 红底）。一次列出全部未读、关闭即 `markAnnouncementsRead` 把那批 id 记已读。
  - **串行不叠**：`openPanel` 先试更新弹窗；弹出来了就等它的 `onClose`（`openChangelogDialog` 的选项）再过 300ms 试公告，所以一次只出一个弹窗、但两个都会送到。
  - **只在面板里**：面板关着（`display:none`）或还没建好就放弃——拉公告要几秒，期间用户可能已经关掉面板，不能把弹窗甩到酒馆页面上；下次打开再试。
  - **关于页还有一块「公告」**（`ui/announcement-card.ts`）：同一份 `announcement.json`，位置在「检查更新」卡之后、更新日志之前，列出**当前版本可用的全部公告**（含已读，未读挂一枚小标）、默认展开可收起（折叠状态只在本次会话内记住，不落盘）、正文限高 360px 内滚；进入关于页先用缓存画一次，再 `fetchAnnouncements({ manual: true })` 强制拉一次（**跳过节流**：每次进关于页都要看到最新公告，30 分钟节流是给常驻弹窗用的）重画；拉不到静默保留缓存，不弹错。它**绝不写已读**——已读只由弹窗关闭时 `markAnnouncementsRead` 决定，否则用户还没看就被吃掉。
  - **`.aus-an` 的 `margin:auto`** 只给桌面端用（公告可能很长，`align-items:center` 在内容超高时会把顶部裁掉）；**窄屏必须归零**，flex 的 auto 外边距优先级高于 `align-items:flex-end`，不归零会把弹窗顶到屏幕正中、还丢掉「上圆下方」的底部卡片形状。

## 安卓返回键（一次返回直接关面板）

- **一次返回直接关面板**：窄屏打开面板时 `ui/back-guard.ts#armBackGuard()` 往宿主窗口压**唯一一条** `__ausBackGuard` 记录（`BACK_GUARD_DEPTH = 1`），按一次系统返回即 `closePanel()`、人留在酒馆页面。**不要再引入逐层后退**（`backTargetOf`/`goBackInPanel`/浏览栈已删）：真机实测第二次侧滑不产生 `popstate`，基于历史栈的分层后退不可靠。压哨兵前先 `stripGuardState` 洗掉旧标记。两条硬约束：① **`popstate` 处理里绝不碰历史**（不 `pushState`/`go`/`replaceState`，否则被浏览器「历史操纵干预」吞掉，下一次手势直接退穿成整页重载）；② **哨兵只压一条**。关闭按钮 / Esc / 扩展重载走 `releaseBackGuard(true)`：先 `removeEventListener`，250ms 后按当前 state 深度 `history.go(-depth)`（执行前重读深度，为 0 跳过）；返回键触发时传 `false`，绝不能再 `go`。`isNarrowViewport()` = 宿主 `innerWidth ≤ 760` **或** `utils/device.ts#mobileDeviceHint()`（平板横屏、折叠屏展开会超 760）；桌面不接管。
- **诊断日志（临时排查工具，定位完可整段删）**：`ui/back-debug.ts#backDebug(kind, extra)` 记环形缓冲（`BACK_DEBUG_MAX = 300`）+ 120ms 节流写 `localStorage[aus_back_debug_v1]` + `console.log('[aus-back]', json)`；`backDebugDump/backDebugClear` 读写清空，`window.__ausBackDebug.dump()` 取全量；`installBackDebug()` 由入口尽早调用（幂等，注册最早的 `popstate` → `pop-raw`、`pagehide`/`pageshow`/`visibilitychange`）；`localStorage[aus_back_debug_off] = '1'` 永久关闭。只为真机排查安卓返回键，不参与业务判断。


## 页面与数据

 用量概览（`ui/overview.ts`）

- **双余额卡**：充值余额（默认 DeepSeek 官方钱包，胶囊可切「全部钱包合计」或其他钱包；**只有它影响余额与剩余轮次预测**，其余指标仍按全量历史；旧 `all` 默认值一次性迁到官方钱包，用户手选后由 `overviewWalletManuallySet` 保护）+ 累计消费（显示币种由钱包驱动 `walletDrivenCurrency`，金额经 `formatMoney`/`getDisplayCurrency` 换算）+ `tokens`。余额汇总按 `CNY/USD` 换算、钱包扣费按钱包自身币种；余额卡按钮文案为「导出记录 / 导入记录」（绑 `#aus-btn-export` / `#aus-btn-import`）。
- **双明细**（`ui/overview-breakdown.ts` 单源产出结构，样式只在 style.css「概览页：历史消耗 / 支出明细」段的 `.aus-ovm-*`）：历史消耗与支出明细并列，两卡同构四层——合计大字（复用 `.ds-card-val`，和结算卡同字号；单位 / 币种降级成 `<small>`）→ 6px 占比条（左卡 `--aus-token-hit/miss/output`，**合计与分项之和不符时补一段灰的「未分项」**）→ 明细行（**桌面就是两行两列**，窄屏同两列但行内改纵向；标签左、数字右对齐 + `tabular-nums`，附注百分比 11px）→ 虚线分隔的对照附注（左卡「缓存命中率」、右卡「预计节省」+ 省下输入比例）。两卡在网格里等高，附注 `margin-top:auto` 压到卡底所以底边对齐；金额一律经 `moneyHtml()` 跟着显示币种走（**不再写死 CNY**）。窄屏两卡各占一行后明细行排 2×2，两套 760 断点必须同步。
- **占比条的内联值只有 `--aus-ovm-seg`**：段宽由数据（百分比）驱动，故写在模板上；其余尺寸与颜色全部在 CSS。禁止把旧的「Token 历史消耗 / 支出在输入」内联排版加回来。
- **8 小块**：默认 `repeat(4,1fr)`，`≤760px`/`≤480px` 保持 `repeat(2,1fr)`；指标表 `FOUR_OPTIONS` 共 18 项（含 `avg_ttft`），由 `computeOverview` 单源计算，费用类经 `moneyHtml()` 按币种。
- **热力图**（`ui/heatmap.ts`）：GitHub 风格近 2 年按日聚合，5 级绿阶；卡片自身 `overflow:hidden` + `max-width:100%`，内部 `overflow-x:auto` 横滑，**禁止让块撑开页面**。
- **按对话统计**（`ui/chat-summary-table.ts`）：按 `chatId` 聚合（`computeChatStats` 单源，按总 Token 倒序），冷库全量异步补全；除「对话」列外 `data-sort-key` 表头可排序（与模型汇总表共用 `ui/sort-header.ts`，单表只绑一次、相等值按名称兜底），未选列时保持默认顺序。

### 对话展示管理（`ui/chat-manage.ts`，`data-view="chat-manage"`）

- **三处入口进同一页并记住来源**：概览表标题右侧 `#aus-chat-manage-btn`（带隐藏计数 `#aus-chat-manage-count`）、趋势预测工具栏 `#aus-forecast-chat-manage-btn`、设置页 `#aus-settings-chat-manage`，共用 class `.aus-manage-chat-btn`。`panel.ts#chatManageOrigin` 记来源，`openChatManage(from)` 打开，`returnFromChild()` 让页内返回 / 顶栏返回 / 底栏 pop-root 统一回来源页，`paintNavState` 的 `navSource` 让底栏高亮跟随来源。
- **双模式分段滑块**「表格展示 / 下拉选项」分别管理两套集合：`localStorage[aus_chat_visibility_v1]` = `{hidden, hiddenPickers}`（`ui/chat-visibility.ts`）——`hidden` 管概览表格、`hiddenPickers` 管统计 / 历史 / 趋势的「对话」胶囊，互不影响；无 `chatId` 归 `__null__`（与 `computeChatStats` 聚合键一致）；旧版只有 `hidden` 的数据照常读。
- **只改展示、不删数据**：表格在渲染路径过滤（`filterVisibleRows`，入参保持全量），胶囊在选项渲染处过滤（`filterPickerRows`，选中项与 label 仍按全量取名，全被隐藏时提示「对话已全部隐藏（可在「对话展示管理」中恢复）」）。不得因此改变任何页面口径。
- 布局全写在 `style.css`（模板不写内联宽度）：行 `grid-template-columns: minmax(0,1fr) auto auto` + `.aus-chat-manage-main{min-width:0;overflow:hidden}`；`≤760px` 头部纵向堆叠（两套断点同步），`≤380px` 状态胶囊再收一档，保证「全部显示 / 全部隐藏 / 返回」始终在视口内。「返回」不再是手写按钮：走 `ui/back-button.ts#backButtonHTML({ id: 'aus-chat-manage-back' })`，与请求日志、其他请求两页同一副样子（见「二级页返回按钮」）。

### 模型展示管理（`ui/model-manage.ts`，`data-view="model-manage"`）

- **两处入口进同一页并记住来源**：统计页「模型汇总」标题右侧 `#aus-model-manage-btn`（带隐藏计数 `#aus-model-manage-count`）、设置页 `#aus-settings-model-manage`，共用 class `.aus-manage-chat-btn`。`panel.ts#modelManageOrigin`（默认 `stats`）记来源，`openModelManage(from)` 打开，`returnFromChild()` / `viewSourceOf()` 让页内返回、顶栏返回箭头、底栏 pop-root 都回来源页，`tabOf()` 让底栏高亮归来源 tab（`CHILD_PARENT['model-manage'] = 'stats'` 只是兜底值，必须是根 tab）。
- **双模式分段滑块**「表格展示 / 下拉选项」分别管理两套集合：`localStorage[aus_model_visibility_v1]` = `{hidden, hiddenPickers}`（`ui/model-visibility.ts`）——`hidden` 管统计页模型汇总表、`hiddenPickers` 管统计 / 历史 / 趋势三处「模型」下拉，互不影响；空模型名统一归 `unknown`（与汇总表 `model || 'unknown'` 同组）；旧版只有 `hidden` 的数据照常读。
- **只改展示、不删数据**：汇总表在渲染路径过滤（`filterVisibleModelRows`，入参保持全量），下拉在选项渲染处过滤（`filterModelPickerRows`，选中值校验仍用全量，历史页全被隐藏时提示「模型已全部隐藏（可在「模型展示管理」中恢复）」）。**趋势预测页的「模型」下拉是功能选择器**（决定价格上下文与上下文上限），全部被隐藏时必须回退全量并追加一行「其余 N 个模型已隐藏」，不得让预测退化。
- 布局全部复用对话展示管理那一套数值（行 `grid-template-columns: minmax(0,1fr) auto auto`、`≤760px` 头部纵向堆叠、`≤380px` 状态胶囊再收一档，两套断点同步），但类名独立为 `.aus-model-manage-*` / `#aus-model-manage-*`，**不改 `.aus-chat-manage-*`**（两个页面共用会串味）。模式按钮查询必须限定在 `#aus-model-manage-modes` 内——两页都用 `[data-manage-mode]`，全局 `querySelectorAll` 会误改另一页。

### 用量统计（`ui/stats-view.ts`）

- **六维度**：时间（全部 / 今天 / 昨天 / 近 7 天 / 近 30 天 / 本月 / 上月 / 自定义，自定义为直输日期两框、`max` 限今日、自动纠正起止倒置；「全部」= `2020-01-01~今日`）、**请求类型**、模型、对话、接入类型、API 密钥；筛选为 `time ∩ requestType ∩ model ∩ chat ∩ endpoint ∩ credential`，六胶囊互斥关闭、点外关闭。
- **请求类型胶囊**（`#aus-type-btn` / `#aus-type-dropdown`，选项文案与 title 来自 `ui/request-type-filter.ts`）：全部 + 对话 / 扩展 / 脚本 / 中断 / 估算 / Agent，判定口径只由 `data/sample-quality.ts#requestTypeKeysOf` 提供（来源轴与状态轴并存、按「包含」命中）。选项是固定 6 项，不按记录联动、也不参与失效剔除；历史页同一份选项（`#aus-history-type-btn`）。接入类型优先联动密钥（切换接入后密钥重置为全部）；对话与密钥选项按 `lastSeen` 倒序。
- **「当前对话」动态项**：对话胶囊在「全部」下方固定一枚，哨兵 `STATS_FILTER_CURRENT_CHAT = '__current_chat__'`（`src/data/computed.ts`）——过滤时现场解析 `getCurrentChatIdForStore()`、不缓存 chatId；不参与隐藏管理、不要求当前对话已有记录。历史页同一口径。
- **重置筛选**：`#aus-stats-filter-reset` → `resetStatsFilters()`（六维回 `DEFAULT_RANGE` = 近 30 天 + 全部、关闭下拉、渲染后落盘）；历史页 `#aus-history-filter-reset`。两枚按钮 inline `background:transparent`，故其 hover/active 规则必须带 `!important`。 另：筛选行右侧的动作（重置筛选、历史页「请求日志」`#aus-history-log-btn`）与同排 5 枚筛选胶囊（`.aus-pill`）同一行，尺寸口径必须跟胶囊一致——桌面 `6px 11px` / `min-height 32px` / `--aus-fs-base`，≤760px `6px 10px` / `30px` / `--aus-fs-sm`。所以重置筛选的 padding 与字号只能写在 `style.css` 的 `.aus-filter-reset` 段（模板里写内联就不跟窄屏收），请求日志**不许**挂小号 `.aus-pill-sm`（曾是 `aus-pill aus-pill-sm`，被用户截图指出比其他按钮小一圈）；守门测试 `ui/panel-history-toolbar.test.ts`。
- **历史页空态「清除筛选」**（`#aus-history-empty-reset`，渲染在 `#aus-history` 内）与工具栏「重置筛选」共用 `panel.ts#applyHistoryFilterReset()`，别各写一份。它曾经和工具栏撞 id，而 `getElementById` 只返回文档里第一个同名元素（工具栏在模板里更靠前），导致绑定落到工具栏那枚、空态按钮点了没反应——**空态按钮一律用独立 id 并在 `host` 内 `querySelector`**，模板静态 id 不许重复（`panel-history-empty-reset.test.ts` 守着）。
- **三块 + 四小块**：消费金额 / API 请求次数 / Tokens；四小块 `repeat(4,1fr)`（竖屏 2×2）由 `computeStatsFour` 单源、随六维过滤、选项与概览共用 `FOUR_OPTIONS`。
- **模型汇总表**：10 列（模型 / 调用 / 命中 / 未命中 / 输出 / 总 / 总成本 / 平均成本 / 平均耗时 / 平均速率），横向滚动；全站唯一保留描边的块（见样式规范）。标题行右侧有「管理模型」入口 `#aus-model-manage-btn` 与隐藏计数 `#aus-model-manage-count`（`ui/model-manage.ts`），渲染时在排序前用 `filterVisibleModelRows(list, (row) => row.m)` 过滤，全被隐藏时表体提示「全部模型都已隐藏 · 点击右上角「管理模型」恢复显示」。
- **图表**：首图 `图表`（`Y` 多选 + `X` 双胶囊，Y 下拉底部切「自动 / 柱状 / 曲线 / 面积」；默认 `DEFAULT_Y_KEYS = ['input_hit_token','input_miss_token','output_token','total_cost','hit_rate']`、`X = 'round'`，常量在 `ui/chart-config.ts`）；下方 6 图（Token 三段堆叠、费用曲线、命中 100% 面积、请求数柱、耗时/速率双轴、模型环——窄屏 <560px 只画前 5、宽屏前 8，其余合并「其他 N 个模型」并进悬浮窗，legend 单行滚动）。`API请求数 趋势` 的 X 走 `X_OPTIONS_WITHOUT_ROUND`（无轮次、默认每日）。**所有图表配置（Y 多选 / X / 展示方式 / 轴标签 / 占比口径）必须经 `ui/chart-prefs.ts` 落 localStorage 并在初始化时恢复**，重开面板不得回默认；图表 `display:none` 时跳过初始化、切到统计页下一帧再建，避免 `clientWidth 0` 误报。

### 历史记录（`ui/panel.ts`）

- **五维度**：请求类型 / 模型 / 对话 / 接入类型 / API 密钥按交集过滤，先作用热+冷全量历史再按 `30/页` 分页（筛选无结果显示清除按钮）；接入类型优先联动密钥；「当前对话」同统计页哨兵，`renderHistoryFilterDropdown` 用 `leading` 参数插入。请求类型选项固定 6 项、不参与失效剔除；元素 id 的中间段由 `HISTORY_FILTER_ID`（`requestType` → `type`）决定，新增维度必须同时登记这张表、模板与 `controls` 绑定，否则 `ui/pill.ts` 配不到 `-btn` / `-dropdown` 这一对。
- **二级入口**：历史记录页工具栏只剩「请求日志」`#aus-history-log-btn`（`openRequestLog('history')`），它与设置页「问题反馈 / 请求日志」是同一页（`data-view="log"`）；「其他请求」（`data-view="tap"`）的入口挪到了请求日志页工具栏（`data-log-action="tap"` → `openTap('log')`）。`panel.ts#logOrigin` / `#tapOrigin` 记来源，`viewSourceOf(view)` 同时供 `returnFromChild`、`paintNavState` 高亮与 `handleBottomTabTap` 的「重复点当前 tab」判定，后两者统一走 `tabOf()` = `nav-model.ts#tabOfView(view, viewSourceOf)`——它会把「其他请求 ← 请求日志 ← 历史/设置」这条两级来源链解析到底，别退回 `parentTabOf(viewSourceOf(view))`（会停在中间的日志页、恒算成「设置」）。**以后再加没有独立导航项的二级页，必须同时接好这三件套（origin / viewSourceOf / returnFromChild）**，只改 `returnFromChild` 会让底栏高亮跟错。
- **冷库读不出来要说话**：`#aus-history-cold` 由 `ui/cold-read-warn.ts#coldReadWarnHTML` 渲染，`getColdReadFailure()` 非空时常驻显示（说明「只显示最近 `MAX_HISTORY` 条、记录没被删除」＋失败原因），右侧「重试」= `clearColdReadFailure()` + `invalidateHistoryCache()` + `refreshUI()`。它**不吃运行健康提示条的总开关**（那是记录质量，这是数据完整性）；全量读取一律走 `repository.getAllHistory()`，失败由仓库层 `log.error` + 10 分钟节流 `toast` 后继续抛出，历史页那段 `catch` 不许再写成空的。
- 列表按 `timestamp` 倒序；卡片含模型 / 时间 / `in/out/rate` / 费用 / 旧·新·详情；**卡片不外显毫秒耗时**，耗时只在详情窗口按秒展示。
- **请求来源角标**单一来源 `ui/source-badge.ts#sourceBadgeOf`，**与记录状态角标是两条正交线**（状态讲这条记录准不准，来源讲是谁打出去的），同一条记录可以两枚并挂：来源在左、状态在右。只有 `extension` / `script` 出角标（蓝「扩展」/ 紫「脚本」），`tavern` / `unknown` 一律不标——主界面是默认情况，标出来只是噪音。
- **记录状态角标**单一来源 `ui/history-badge.ts#historyBadgeOf`，优先级：用户中断（黄「中断」）→ 上游中断（红「中断」）→ 估算（黄「估算」）→ Agent（绿）→ 对话（灰，默认态）；面板只渲染 `badge.background/color/text` 并按 `kind` 给 title，**不许在面板里重新分支**。**默认态那枚由 `shouldShowStateBadge(badge, !!sourceBadge)` 决定是否渲染**——已有来源角标（扩展 / 脚本）时不再并排一枚「对话」（一条记录只留一枚描述性角标），中断 / 估算 / Agent 照常显示。**详情里的「记录状态」与 Token「估算」小标必须用 `isEstimatedEntry(entry)`（读 `usageSource`）**——中断又靠估算补记时角标是「中断」，按角标判断会把本地推算值当成上游真实用量。

### 聊天消息头（注入宿主聊天区）

- 节点是宿主的 `#chat .mes` 里插的 `small.mes_generation_info.aus-mes-meta`，**不在 `#aus-panel` 内**，所以 `style.css` 里这段规则不能挂在 `[data-extension]` 作用域下；尺寸/透明度对齐 TauriTavern 原生 `.mes_generation_info`（`opacity .7`、`0.8 × --mainFontSize`、`nowrap`）。
- 单项由 `data-kind`（`cost` / `ttft` / `rate` / `cache`）区分；窄屏 `@media (max-width:760px)` 只留 `cost`，与面板两套断点规则分开写（这条在宿主聊天区，不涉及 `@container ausbody`）。
- 开关行注入宿主设置页，勾选状态由扩展设置驱动，重绘一律走 `paintMessageMeta()`（先删旧节点再画，避免堆叠）。

### 历史详情窗口

- 桌面从右侧滑入 `clamp(320px,26%,460px)` 抽屉（`border-left` 一条分隔线），手机从底部上滑约 3/4 高、抬在底栏之上并带 `36×4` 拖动把手。
- 16 字段按「基础 / 性能 / Token / 费用」四块白卡竖直排布（基础块含「请求来源」，文案走 `ui/source-badge.ts#originTextOf`：扩展 · 名字 / 脚本 · iframe 脚本 / 酒馆主界面 / 未识别；`HistoryEntry.requestOrigin` 缺省即旧记录，显示「未识别」且不回填）（`.aus-dt-*` 骨架：`section.aus-dt-block` + `.aus-dt-head` + `.aus-dt-grid` 两列 `.aus-dt-item`；块内不画描边，靠抽屉 `--ds-card` 与白块 `--ds-card-inner` 分层）；Token 块顶部有 6px 迷你三段占比条（与列表卡、图表同源）。
- 性能块与 Token 块曾各显示一次「思维链占比」，已收敛为仅性能块保留、Token 块改为单列占满的「思维链 Token」——不要再两边都放。
- 头部两行（模型名省略 + 记录时间）；4 个 Tab：请求参数 / 完整响应 / Raw 用量 / 消息内容（短名不带英文括号），`pre` 滚动；Tab 选中态由 `data-active="1"` 交 CSS（`--ds-black` 底 + `--ds-black-text` 字），JS 只切属性。

### 历史页问题提示与反馈上传

- **三种口径，别合并**：① 每条明细的「上传这一条」（`data-health-key` → `openLogUploadDialog({targets:[healthTargetOf(sig)]})`，`FEEDBACK_SCHEMA = 5`）带被点名那条及前后各一、同簇探针、±120s 控制台；② 提示条下方「上传反馈日志」是**全部逐条点名**（`report.items` 全过 `healthTargetOf` 交给 `buildFeedbackPack({targets})`，每条生成一份 `evidence.items[i]`，上限 `FEEDBACK_TARGET_LIMIT = 8`，更多只计入 `targetTotal`，`report.scope='all'`，单条时才 `'single'` 且 `report.target` 非空）；③ 日志页「上传反馈」`scope='recent'`，只传最近一轮 + 诊断摘要。`evidence` 顶层保留第一条的 signal/request/history/tap/console 以兼容旧解析。
- **忽略指纹**：`kind|模型或错误签名|细分` 三层（`aus_health_ignore_v2`，7 天 TTL；`plugin-error` 必须有归一化错误签名才可忽略）；v1 的 `plugin-error||console` 一刀切指纹迁移时丢弃。**用户手动中断的记录不产生任何健康提示**（`scanHistoryHealth` 首行 `if (interruptKindOf(entry) === 'user') continue;`）——手动停止时上游必然没给完整 usage、耗时只有半截，估算补记是既定行为；上游中断照常提示。
- **上传成功要立刻摘掉提示**：`log-upload-dialog.ts#onUploaded(keys)` 在 HTTP 200 分支触发，`history-health-bar.ts#dropUploaded` 用 `addIgnoredHealthKeys(keys, Date.now(), 'one')` 落盘后整条重绘；上传失败不摘除。
- **诊断包可诊断性约束（schema 5，别再退化）**：① 探针模型名必须经 `request-tap/match.ts#stripModelTag` 剥掉 `[A]`/`[D]` 这类 ≤24 字的方括号前缀再比较（探针存原名、入账存剥过的 `model`，原名在 `rawModel`），否则带前缀模型 100% 判成 orphan；② 耗时 < `MIN_TAP_DURATION_MS = 500` 的探针标 `settledBy='too-short'`，`scanTapHealth` 跳过、也不算孤儿；③ 采集快照同时写 `localStorage[aus_capture_stages_v1]`（`capture-digest.ts`），重载后 `capture` 不再恒为空；④ 最近三轮由 `noteRecentTurns` 按轮配对（assistant + 前一条 user，最多 3 轮），纯尾部提示词标 `kind='prompt-tail'`；⑤ `evidence.request` 必须带 `matched`（`|logAt - 目标时刻| <= EVIDENCE_REQUEST_WINDOW_MS = 120s`），不匹配时 `logAt=null`；⑥ `tapRowDigest` 是 `tapDigest` 与 `tapEvidence.cluster` 的唯一字段来源，不许分叉；⑦ 请求体打包经 `clipPackRecord` 裁到 `FEEDBACK_BODY_LIMIT = 60_000` 并置 `requestBodyTruncated`（接收端上限 400KB）；⑧ 探针带 `v`（`TAP_SCHEMA_VERSION = 2`），**旧孤儿探针必须一次性重判**：`request-tap/index.ts#recheckLegacyOrphans` 由 `runLegacyRecheck()`（先 `hydrateLedgerFromHistory()` 补账本，空则 4s 退避最多 3 次）跑一次——`v<2` 的 orphan 能对上已存历史标 `settled`、耗时 <500ms 标 `too-short`、其余标 `settledBy='legacy'` 并把 `v` 提到 2；`scanTapHealth` 跳过 `settledBy==='legacy'`。批量改写只走 `updateTapRecords(updater)`（一次 persist + emit，别循环 `patchTapRecord`）。
- 弹窗的逐条点名列表 `.aus-up-target-item` 是 flex+wrap，`.aus-up-target-kind` 必须 `margin-left:auto` 收右；勾选行 `.aus-up-check` 必须显式 `display:flex` + `align-items:flex-start`（宿主会把 `label` 块级化）。
- **占比条**：6px 圆角三段，色取 `--aus-token-hit/miss/output`，图例 7px 色点；凡展示「输出」Token 处（模型汇总「输出」列、概览「历史消耗」输出行、按对话统计「输出」列）都必须用 `var(--aus-token-output)`，禁止旧的 `#6366F1` / `--ds-purple`。

### 趋势预测（`ui/forecast-view.ts`，独立页）

- **工具栏**：对话胶囊（当前对话 / 全部 / 各对话，默认 `__current__`）、计价模型胶囊（多模型时显示，默认最近）、视界胶囊（5/10/20/50/100，默认 10）、压缩情景开关；偏好存 `localStorage[aus_forecast_prefs_v1]`（不进 `settings`、不参与导出）。选「全部」时禁用逐轮预测并提示，模型效率表仍可用。
- **窄屏例外规则**：`@media (max-width:760px)` 里 `[data-view="forecast"] [id^="aus-forecast-"]{width:100% !important}` 会误伤工具栏按钮，因此紧跟 `#aus-forecast-chat-manage-btn{width:auto !important;max-width:100% !important;flex:0 0 auto !important}`；**给趋势页新增任何胶囊类按钮都要照此放行**。
- **内容**：8 块 KPI（下一轮输入 / 输出 / 成本、命中率、Δ、余额可撑、上下文可撑、未来 N 轮总成本）+ 主趋势图（全部历史命中 / 未命中堆叠 + 输出 + 成本双轴、未来虚线、95% 置信带、压缩标记、上限线）+ 命中率图 + 累计成本图；三图由 `ui/forecast-chart.ts` 统一管实例 / 主题 / resize / dispose。
- **数据范围**：本页所有统计（逐轮序列、压缩检测、命中率回退、模型效率、Top 对话、对话胶囊）只含**对话来源**的记录——`renderForecastView` 一进来就用 `isConversationEntry` 过滤全量历史，扩展 / 脚本直连的请求不计入，所以这里的「全部历史 N 条」会小于历史页条数，属预期。
- **预测核心**（`stats/forecast-series.ts`）：排序清洗（`isReliableForecastSample` 先剔除中断与估算，`isConversationEntry` 再剔除扩展与脚本）→ 压缩识别（环比回落 ≥20% 且绝对降幅 ≥1500 tok）→ 末段稳健回归（近期加权 / 离群剔除 / `linear` 与 `recent-mean` 择优）→ 命中率测算（有缓存样本时最近 10 条 token 加权，无数据才回退全站 / 同模型 / 手动）→ 输出中位数、成本与余额逐轮模拟；`stats/forecast.ts` 保留旧 API 兼容 `energyScore` 与旧测试。
- **压缩预测**：检测到一次压缩即以「最近一次压缩前的段长度」为周期，结合保留比例与压缩后首轮命中率做锯齿投影；卡片展示周期、保留比例、当前段已持续、预计下次压缩轮次；压缩点用橙色虚线标出。
- **模型效率**（`stats/model-efficiency.ts`）：按模型聚合输入输出比、每 1k 输出成本、命中率、缓存节省、平均每轮成本，按每 1k 输出成本升序（无价最后）；范围可切全部历史 / 当前对话，点行切计价模型。
- **能耗评分**（`stats/energyScore.ts`）：6 指标加权（Δ 25% / out 20% / 效率 20% / 命中 15% / 截断 10% / 思维链占比 10%）→ A–G，冷启动用绝对阈值表、随后按历史分位；「对话健康」卡展示色带与指标，最耗对话 Top 默认折叠。

### 钱包（`ui/wallet-view.ts`，独立页）

- **入口**：桌面侧栏「钱包」；窄屏走设置页顶部入口行；`data-view="wallet"` 独立页，顶部是汇总卡，下面按接入链接列出钱包，最后是已忽略接入口。
- **粒度**：一个 `endpointId` 一个钱包，同一链接下多个密钥归入同一钱包；默认始终有不可删除、不可忽略的 DeepSeek 官方钱包；`hydrate` 为历史中已识别的接入回填钱包，新请求首次出现未忽略接入时自动建钱包并命名成接入地址。
- **固定与可编辑**：接入地址 / 接入类型 / 已识别密钥身份只读；名称、模型名、价格、价格来源、峰谷规则、手工余额、忽略状态可编辑；模型改名保留旧名别名，旧请求仍能命中规则。
- **官方峰谷**：按北京时间，周一至周五（不含法定节假日）`9:00-12:00`、`14:00-18:00` 为高峰，其余（含周末与节假日全天）空闲，调休上班的周末同样按空闲计；节假日数据在 `constants/holidays.ts`（覆盖 2024–2027），`settings.extraOffDays` 可补充；官方钱包的自定义规则同样享受节假日豁免，中转钱包按自身配置。
- **默认收起**：`WalletConfig.collapsed = true`（旧数据缺字段按收起）；收起态为单行卡片——左侧 `44px` 方形标识（取名字首个有意义字符，剥离 `http(s)://`、`www.`、`api.` 前缀；窄屏缩到 `36px`）+ 名称与副标题 + 右侧只外显余额 + 图标按钮（展开 / 忽略，官方钱包没有忽略；价格同步按钮在展开态的「模型与价格」段里，不摆在钱包外面）；`≤760px` 标识缩到 `36px` 并压成四区网格（标识 / 名称 / 余额 / 操作），宽度不足时余额行自动落到第二行（`≤400px`）；收起/展开状态按钱包独立记忆并随导入导出 / 同步。
- **展开态是「三段 + 一行折叠」**（`ui/wallet-view.ts#renderWalletCard`；卡内**不再嵌套白块**，段间只有 `1px` 分隔线）：① 余额与校准（**余额只在外面的头部显示一次，段内不再重复**：手工余额输入 + 币种胶囊 + 自动校准开关、主密钥胶囊 + 「立即校准」、校准密钥默认收起成文字链「设置校准密钥 / 已保存校准密钥 · 修改」、适配器与账号，已识别密钥压缩成「N 个 · 末位 aaaa/bbbb」且**只出现一次**）；② 模型与价格（右上：价格来源胶囊 + 「同步价格」+ 显示/隐藏条目 + 添加模型；**没有表头**——宽屏每行三列 `minmax(200px,320px) minmax(0,1fr) 96px`（名称 / 价格组 / 操作），组标签与「命中 / 未命中 / 输出」小标签都就地显示；**只有模型勾了「峰谷计价」才并排两组价格**（`.aus-wallet-prices.is-split`），否则只显示一组「价格」，单组三格宽度上限 180px；峰谷计价复选框在模型名下（`data-wallet-model-peak`），锁定与删除收在行尾 `⋯` 菜单；窄屏每行变一张卡片、两组价格上下叠）；③ 套餐额度（`wallet-plan.ts` 已去掉自身的白底卡片）；④ 峰谷规则折成末尾一行（折叠态显示「N 个高峰时段 · 周末全天低谷」概要，展开后时段是 chip + 「+ 添加时段」）。**峰谷折叠状态只在会话内用模块级 `Set` 记住，不落盘、不进导出同步**（不要塞进 `WalletConfig`）。
- **价格输入一个都不能少**：`readModelPrices` 按 `input[data-wallet-price]` 的 `data-tier/data-key` 读值，峰谷关闭时只给 `.aus-wallet-mtier` 加 `data-peak-hidden` 让它 `display:none`，**禁止把 DOM 删掉**，否则保存价格会把历史峰谷价静默写成 0。
- **模板不写内联尺寸**：`ui/wallet-view.ts` 渲染区只允许 `style="display:…"`（浮层与展开体的动态显隐）与 `style="--aus-wallet-avatar-bg:…"`（厂商品牌色），其余尺寸颜色全部落在 `style.css`「钱包页（重做）」段；`ui/switch.ts` 的 `SwitchOptions.data` 用于给开关挂 `data-wallet-*`，以便复用既有绑定。
- **计费隔离**：同一模型名在不同钱包可以有完全不同的价格与峰谷；匹配顺序为「钱包当前模型名 → 来源模型名 → 别名」，历史归属先用 `walletId` 定位，旧记录才回退接入地址或全局价格。
- **模型条目字段**：`sourceModel/model/aliases/price/source/locked`，非峰与高峰各含命中 / 未命中 / 输出三价；每条规则可关闭峰谷、可锁定防同步覆盖；每个钱包可独立配置跨天峰谷时段与「周末全天低谷」。
- **工具栏**：筛选固定「全部 / 有待定价 / 可查套餐」三项——**「官方」筛选已按用户要求移除，不要再加回**（旧 localStorage 的 `official` 渲染时回落「全部」）；「展开全部 / 收起全部」已合并为单切换胶囊 `[data-wallet-toggle-all]`（由 `anyCollapsed` 决定文案与动作）。
- **余额**：币种 `CNY/USD`，手工可直接填；自动校准只开放给 DeepSeek 官方直连钱包，默认用钱包内单独保存的校准密钥，可选一个主密钥作账号身份；多密钥不自动相加；每次请求按当前币种预扣，校准成功后覆盖为服务端余额；**自动校准没有全局开关**——钱包页勾选即按设置页间隔轮询（`restartBalanceTimer` 只在存在已勾选且未忽略钱包时启动）。
- **计价优先级**：钱包规则优先 → 官方钱包无覆盖时用内置 `PRICE_HISTORY` 多段价格 → 其他钱包无价格标「待定价」并计 0；旧全局 `customModels` 复制到官方钱包，作为旧记录 / 未映射记录的只读兜底。旧「新价格机制 / 生效日期」入口已删除：`calcCost/calcSavings` 不再读 `settings.useNewPricing/newPricingDate`，历史统一以 `LEGACY_PEAK_PRICING_DATE`（2026-08-17 北京时间）为默认生效日。
- **旧价同名校验**（一次迁移）：旧热 / 冷记录按当前钱包规则为 `unpriced` 且任意未忽略钱包有完全同名价格时，写入 `legacyPricingWalletId/legacyPricingModel` 并按该钱包价重算（`pricingSource='legacy-match'`）；新请求不带该标记。
- **待定价重算**：保存模型价、改峰谷 / 周末规则或同步价格后必须调 `repository.recalcWallet(walletId)`（热 + 冷 + 累计费用一起修正）。
- **models.dev 同步**：钱包 `catalogProvider` 是唯一开关；价格来源只展示第一方厂商（DeepSeek / OpenAI / Anthropic / Google / Mistral / xAI / Moonshot AI / Z.AI / MiniMax / Cohere），不展示 OpenRouter / Groq / SiliconFlow / Fireworks 等聚合渠道（旧第三方来源标准化为 `null`）；模式 `add-missing / overwrite-unlocked / overwrite-all`，锁定规则只允许全部覆盖模式修改；关闭同步会移除未锁定同步价并重算。**免责口径**：价格来源与模型同步必须写明不对 models.dev 数据中的商业化中转站负责，且不构成推荐或商业关系。
- **模型匹配**（`services/model-match.ts`）：只写已有模型价格、**不新增模型**；归一化后按相似度打分，完全相等 1.0、别名等价 0.99。阈值 `MODEL_MATCH_ACCEPT = 0.85`、`MODEL_MATCH_AMBIGUITY_GAP = 0.05` **一律不降**（`mini/lite/pro` 与数字版本必须重罚，宁可漏配不可错配）；纯中文名剥完为空则判不可匹配。预览文案由 `ui/wallet-sync-preview.ts` 渲染。
- **忽略与恢复**：删除钱包 = 加 `walletIgnored`，之后不自动重建、不参与余额合计，历史仍保留 `walletId`；钱包页可恢复。
- **密钥隐私**：普通官方接口只记录酒馆密钥条目编号、标签、掩码末三位；反向代理 `proxy_password` 与 `custom_include_headers` 不读不存，按「未识别密钥」处理。**对外文案口径**：酒馆密钥只写「编号、备注、掩码末三位」，用户主动填入的校准密钥才写「实际可用密钥」，任何地方都不得称 XOR 是安全加密。
- **响应式**：汇总卡所有宽度保持一行三列（只压字号间距）；钱包卡用边框面板、**不嵌套 `.ds-card`**；专用响应式网格必须能覆盖通用网格，否则窄屏会按桌面三栏计算并裁切。

### 设置（`ui/settings.ts`）

- **保留的全局控制**：匿名使用统计（默认开启，可关闭并重置匿名标识，位于设置页顶部）、移动端兼容 UI（`settings.mobileCompatUi`）、颜色模式、历史显示范围、自动校准间隔（**总开关已移除**）、新钱包默认峰谷与额外空闲日期、汇率与价格同步参数（**无总开关**）、调试、峰值圆点、记录数据管理、WebDAV、存储占用。
- **移动端兼容 UI**：默认值只按设备类型决定一次（`utils/device.ts#mobileDeviceHint()`：移动端默认开 = 窄屏底栏，桌面默认关），落盘后不再被后续版本覆盖。
- **WebDAV 卡片默认收起**：`#aus-webdav-body` 初始 `display:none`，标题行 `#aus-webdav-header` 与胶囊 `#aus-webdav-toggle` 都可点开；折叠状态**刻意不落盘**，每次进设置页都从收起开始。
- **「对话展示」/「模型展示」入口**：`#aus-settings-chat-manage` / `#aus-settings-model-manage`（`.aus-manage-chat-btn`）由 `renderSettings` 生成，故 `panel.ts` 用 `#aus-panel` 点击委托捕获；设置页内要用 `#aus-panel #aus-settings-*-manage` 提高尺寸到与同页胶囊一致，别动通用类（概览、统计与趋势页用紧凑尺寸）。
- **版本胶囊**：`#aus-settings-entries .aus-settings-entry-version` 显示 `vX.Y.Z`，版本统一由 `panel.ts#appVersionText()` 读 `__APP_VERSION__`，**禁止各处自己拼**；桌面端版本在品牌区，此胶囊为窄屏补信息。
- **存储占用**（`services/storage-usage.ts` + `ui/storage-usage-card.ts`）：列出酒馆设置 / IndexedDB / localStorage 占用；**只有 `migration_backup_<时间戳>` 的旧版迁移备份可清理**（两步确认 → `persistence.deleteMigrationBackups` 逐条删 + 清 `aus_migration_backup_*` 降级副本 + 删后复扫）；禁止 `clear()` / `deleteDatabase()`，禁止把在用数据标成可清理。
- **按范围删除**（`#aus-delete-*`，`bindHistoryDelete`）：开始 / 结束日期、模型（完全匹配）、对话（`chatId` 或 `chatName` 完全匹配），留空不限；先「统计匹配记录」预览再二次确认；底层 `repository.deleteHistoryByFilter`（热 + 冷 + `recalcAll` + `rebuildAggregates`），日期用 `localDay` 比较、口径与 `filterStatsHistory` 一致。
- **卸载与清数据（clean 钩子）**：`manifest.json#hooks.clean = onClean`（hook 机制要酒馆 1.17.0、`clean` 要 1.18.0；`minimum_client_version` 是 1.11.0，老版本没有该勾选项）。
  - `src/index.ts#onDelete` **只拆界面与运行时**（`teardownRuntime()`：卸拦截、卸 Agent 采集、删面板 DOM、`resetPanelState`、停峰值圆点与定时器、`cleanupRuntimeBindings`），**不碰数据**——卸载后重装仍能看到历史与钱包；清数据只走 `onClean`。
  - `services/wipe-data.ts#wipeAllExtensionData()` 四步：① `flushSaveHot()` 后 `blockPersistentWrites()` 关写盘闸门（否则 300ms 延迟保存（防抖）会把刚删的设置写回）；② `await closeDB()` 再 `deleteDatabase(DB_NAME, 2500)`（**删库前必须断开连接**，否则被 `blocked`）；③ localStorage 先收集键名再逐个 `removeItem`（`WIPE_LOCAL_KEYS` + `aus_` 前缀，**禁止 `clear()`**）；④ 删 `extensionSettings[api_usage_stat]` + `saveSettingsDebounced()`；全程 try/catch，失败写 `WipeReport.errors`。
  - **硬边界**：只删 `api_usage_stat_db`；删库超时 2.5s（钩子预算 5s）；`onblocked` 只记 `databaseBlocked`（此时库未删）；只在「管理扩展程序」里删除时触发，手动删目录不会跑；每浏览器一份，无法跨设备清理。
  - 测试 `wipe-data.test.ts`（9 用例）与 `wipe-hooks.test.ts`（4 用例，**读源码文本断言** manifest 接线、`onDelete` 不碰数据、清理面齐全、无 `clear()`）——改 `src/index.ts` / `wipe-data.ts` / `manifest.json` 必须同步。

### 使用说明（`ui/help-view.ts`）

- 内容全部由 `helpViewHTML()` 生成，面板只留 `<div data-view="help" style="display:none;">${helpViewHTML()}</div>`；布局全在 `style.css`「使用说明页」段（模板不写内联尺寸）。
- 区块顺序固定：**完整使用文档入口（第一高位）**（整块可点的黑底图标块 → `https://janmk1453.github.io/Api-Usage/`）→ **隐私与免责（第二高位）**（一行准入提示 + 灰面内两块白面 + 左侧语义色竖线（隐私 `--ds-red`、免责 `--ds-orange`），标题行 = 色点 + 标题 + 「完整版」链接到 `#privacy`，正文要点列表、关键词加粗）→ **9 张操作说明卡**（`#aus-help-guides` 两列、`≤760px` 单列：开始使用 / 用量概览 / 用量统计 / 历史记录 / 趋势预测 / 钱包 / 设置与数据 / 对话展示管理 / 模型展示管理，每卡标题 + 2–4 条 counter 步骤）→ **模型兼容与关于**（`#aus-help-foot`）。隐私与免责必留；文案只讲「怎么用」不解释设计动机；增删功能时同步这 9 张卡与 `docs/index.html`。

### 请求日志 / 其他请求（`ui/log-view.ts`、`ui/tap-view.ts`）

- 「问题反馈 / 请求日志」页（`data-view="log"`）：两处入口（设置页 `#aus-settings-request-log`、历史页工具栏），来源由 `logOrigin` 记录；页内「上传反馈」= `scope='recent'`，「复制诊断信息」走 `request-log.ts` 组包。顶部工具条由纯函数 `logTopHTML(summary)` 生成（便于单测），五枚动作按钮都是 `data-log-action` 委托：`upload` / `tap` / `refresh` / `clear` / `back`（`back` 那枚即统一返回按钮 `backButtonHTML`，固定在动作组最右）。
- 「其他请求」页（`data-view="tap"`，入口在请求日志页工具条，返回回日志页，返回按钮同款 `backButtonHTML({ id: 'aus-tap-back' })` 挂在 `.aus-tap-tools` 末位）：展示探针账本（`services/request-tap/`），按用途聚簇，可查 `pending` / `orphan` / `settled` / `too-short` / `legacy` 状态；**这里只是验证页，不参与统计口径**。

### 二级页返回按钮（`ui/back-button.ts`）

- **唯一来源**：`backButtonHTML({ id?, title?, data? })` 产出 `<button class="aus-back-btn" data-aus-back="1" aria-label="返回上一页">chevron-left 14 + 「返回」</button>`；样式只有一套 `#aus-panel .aus-back-btn`（`5px 12px`、`--aus-fs-sm`、`font-weight:600`、`border-radius:999px`、`margin-left:auto`）。三页（对话展示管理 / 请求日志 / 其他请求）必须都调它，禁止再复用 `.aus-pill`、`.aus-log-link`、`.aus-chat-manage-btn`——那三类被同排动作按钮共用，改一处会连带改别人。
- **位置统一贴右**：靠 `margin-left:auto` 落在所在工具行的最右；所在行必须 `flex-wrap`，**动作组自身也必须可收缩并限宽**（`max-width:100%`，窄屏 `flex:1 1 100%`）——只给父级 `flex-wrap` 不够：`flex:0 0 auto` 让动作组宽度由内容撑开，五枚按钮会顶出视口右缘（真机反馈过，`.aus-log-actions` 已修）。请求日志页把它放在 `.aus-log-actions` 末位（上传反馈 / 其他请求 / 刷新 / 清空 / 返回），`≤760px` 时 `.aus-log-desc` 独占第一行、动作组独占第二行并在行内折行靠右（窄屏底栏布局下这枚不显示，见下条）。
- **文案不写目标页名**：目标由 `panel.ts#returnFromChild()` 算（`chatManageOrigin` / `logOrigin` / `tapOrigin` / `childParentOf`），按钮只写「返回」。
- **窄屏只留一个返回**：`≤760px` 且 `#aus-panel[data-mobile-nav="bottom"]`（底栏布局）时 `.aus-back-btn` 直接 `display:none`，返回只走顶栏箭头 `#aus-mobile-back`——五枚胶囊在 400px 级宽度放不下一行，「返回」会孤零零折到下一行（真机反馈过）。**必须限定 `data-mobile-nav="bottom"`**：窄屏但关掉「移动端兼容 UI」时属性是 `sidebar`、顶栏箭头不显示（`paintNavState` 只在 `bottom && isChildView` 时给 `#aus-mobile-back` 写 `display:flex`），页内这枚就是唯一入口，不能一起隐藏；宽屏桌面照旧贴右。规则写在 `style.css`「二级页返回按钮」段末尾，`@media (max-width:760px)` 与 `@container ausbody (max-width:760px)` 两套断点同步写。
- 钱包 / 使用说明 / 关于三页**不补**页内返回（桌面靠侧栏、窄屏靠顶栏箭头），这是用户明确要求。

### 导航与移动端

- **桌面侧栏**：`≥761px` 常显 `260px ↔ 60px` 折叠（`#aus-sidebar-toggle`），导航图标走 `ui/icons.ts#icon()`（Lucide 线性路径、`stroke=currentColor`），`.aus-nav-icon` 固定尺寸精确居中。品牌区 `#aus-brand` = 橙色图标 + 标题 / 版本两行，图标与导航图标同列、标题与导航文字同列；`#aus-brand-row` 与 `#aus-page-header` 同为 56px 且统一 `align-items:flex-start` 与标题行高，保证两侧标题**顶边严格齐平**；品牌图标容器比视觉尺寸略大并带微移（中文字形光学中心偏低）——**改其中任一项都要重新校准**。
- **窄屏底栏**（`panel.ts#bottomNavActive` = 窄屏 + 兼容 UI 开启）：`≤760px` 侧栏整块隐藏，导航交给 `#aus-bottom-nav`（概览 / 统计 / 历史 / 趋势 / 设置，短名来自 `nav-model.ts#MOBILE_TABS`，页面标题仍用全称 `viewTitle`）；点击语义由 `resolveTabTap` 决定（换标签切页、重复点当前标签回顶、二级页点「设置」回设置主页）。**换标签一律进该标签的根页，不记忆上次停留的二级页**：钱包 / 使用说明 / 关于只能从设置主页的入口进，从别的标签回到「设置」必须落在设置主页（曾用 `settingsChildView` 恢复上次二级页，「关于 → 历史 → 设置」会直接落回关于页，已删，勿再加回来）。钱包 / 使用说明 / 关于的入口收进 `#aus-settings-entries`（仅窄屏），进入后底栏「设置」保持高亮（`parentTabOf`），`#aus-mobile-header` 左侧出现返回箭头 `#aus-mobile-back`（显隐由 `paintNavState` 写 inline display）。
- **开关切换不用刷新**：`settings.ts` 写设置后动态 `import('./panel')` 调 `applyMobileNavMode()`（重写 `data-mobile-nav`、关抽屉、宽屏恢复折叠、`paintNavState`）；**回 `sidebar` 分支时必须给 `#aus-sidebar #aus-brand` 写 `display:flex !important`**（`syncMobileSidebar` 会 `removeProperty('display')` 清掉残留，清完品牌区退回 `block`、图标与标题被拆两行），`.aus-nav-label` 同理。
- **选择器前缀**：窄屏底栏 CSS 必须带 `#aus-panel[data-mobile-nav="bottom"]`，抽屉规则必须带 `[data-mobile-nav="sidebar"]`；底栏项**必须用独立类名 `.aus-bottom-item`**，禁止复用 `.aus-nav-item`（`applyCollapsed` 会按该选择器改侧栏项）。
- **宽表块横滑白名单**：`[data-view="overview"] .ds-card { overflow:hidden !important }` 会压过卡片内联 `overflow:auto`，需块内横滑的卡片必须补 ID 规则（现存 `#aus-overview-history`、`#aus-overview-spend`、`#aus-chat-summary-overview`，统计页 `#aus-model-summary`）——ID 特异性高于「属性 + 类」，`!important` 下同样胜出。


## 样式规范（硬约束）

- **变量**（唯一配色来源，深浅各一套同名变量）：浅色 `--ds-bg:#FFFFFF --ds-card:#F5F6F7 --ds-text:#111827 --ds-border:#E5E7EB --ds-black:#111827 --ds-orange:#FF6A00 --ds-green-bg:#E6F8EC --ds-green:#0BA25E --ds-radius-card:14px --ds-radius-pill:999px`；深色 `--ds-bg:#151517 --ds-card:#303134 --ds-card-inner:#3A3B3E --ds-text:#F5F6F7 --ds-text-2:#C0C2C6 --ds-text-3:#9A9CA1`。字号 `--aus-fs-base:14px` / `--aus-fs-sm:12px` / `--aus-fs-xs:11px`，内联只用变量（ECharts 轴与 tooltip `fontSize:12`）。
- **无阴影、无滤镜、块面不描边**：块面只靠 `--ds-card`（灰）与 `--ds-card-inner`（白）分层，块内二级面板必须自带白底，卡片留 `1px solid transparent` 防尺寸跳动；输入框 / 胶囊 / 复选框 / 表格分割线 / 语义告警块 / 浮层保留描边。例外只有两处：`#aus-model-summary`（模型汇总表，透明 + 全宽横滑，必须保留 `border-color: var(--ds-border)`）与顶栏 / 底栏毛玻璃。
- **选择类 UI 一律胶囊下拉**，禁原生 `select`：触发器 `.aus-pill`（小号 `.aus-pill-sm` **必须与大号同时挂**，单独挂会丢描边圆角白底）+ 浮层绝对定位。按钮 id 必须含 `-btn`、下拉 id 必须以 `-dropdown` 结尾或含 `-drop-`——`ui/pill.ts` 与 `style.css` 靠这两条配对打标、做箭头旋转。模板**禁止内联 `background` / 尺寸**（`background` 简写会把 `background-image` 钉成 `none`，吃掉 `[data-aus-pill="1"]:hover` 叠层）。不纳入统一胶囊：四小块角标按钮、钱包「保存密钥」、`#aus-update-branch-btn`、`#aus-pricing-sync-interval-btn`、分页与内联小按钮。
- **文本默认不可选中**：`#aus-panel, #aus-panel *` 一律 `user-select:none`——按钮 / 胶囊 / 下拉项 / 表格数字 / 历史卡片拖一下就是蓝底选区，还会跟「选中项」的浅底混在一起（下拉里「全部」曾这样）。要复制的必须显式放行，且选择器带 `#aus-panel` 前缀（否则特异性压不过 `#aus-panel *`）：`input` / `textarea` / `[contenteditable="true"]` / `pre` / `code` / 弹窗正文 `.aus-cl-body` / 通用钩子 `.aus-selectable`；关于页「更新日志」卡整块放行（`#aus-panel #aus-changelog` 与其所有后代——用户要把版本说明复制出来，卡内的折叠按钮照旧可点）；弹窗在面板外打开时（`.aus-cl-mask.is-page`）另有一套放行。宿主聊天区的消息头 `#chat .mes .aus-mes-meta` 不在面板内，单独禁选。守门测试 `ui/no-select.test.ts`。
- **复选框** `.aus-checkbox`：`appearance:none` + 内联 SVG `background-image` 打勾，**禁止伪元素画勾**；`border / background-color / background-image / background-repeat / background-position / background-size` 六项全带 `!important`（压 `#aus-panel input` 的 (1,1,1)），`::before/::after` 一律 `content:none !important; display:none !important`；趋势预测压缩开关用独立 `.aus-forecast-checkbox`。
- **胶囊开关** `.aus-switch`：结构由 `ui/switch.ts#switchHTML(id,{checked,disabled,ariaLabel})` 生成，状态**只由 `input:checked` 驱动**，不写内联、不用 JS 改 `left`。尺寸全用变量 `--aus-switch-w/-h/-thumb-size/-inset`（默认 44/24/18/3）算 `top` 与 `translateX`——**禁止写死像素**；触屏（`≤760px` + `pointer:coarse`）48×26，`::before` 外扩命中区；隐藏 input 的选择器要写成 `#aus-panel .aus-switch input[type="checkbox"]` 才压得过通用规则。
- **分段滑块** `.aus-chat-manage-mode-thumb`：位置与宽高只由 `ui/chat-manage.ts#paintModeThumb` 按 `getBoundingClientRect` 实测写入（首次关过渡，两项同 `min-width`），`transition` 只过 `transform/width`。
- **下拉动画**：选择器只限 `#aus-panel [id$="-dropdown"], #aus-panel [id*="-drop-"], #aus-panel [data-wallet-dropdown], #aus-panel .aus-forecast-dropdown`；关 90ms / 开 140ms（`data-aus-drop-open`）+ `@starting-style` 淡入 `scale(0.97)`；`[style*="display: none"]` 那组**必须写终止值**（`opacity:0` + `translateY(-4px) scale(0.97)` + `pointer-events:none`），少了就「点了没反应、等一下才关」。选中项关闭走 `ui/dropdown-close.ts#closeDropdownInstant / afterNextPaint / closeDropdownThenPaint`；**点外部 / 互斥 / toggle 保持 CSS 淡出**。**展开状态只认 DOM 的 inline `display`**（`stats-view.ts#isDropOpen`），禁止再用模块变量记录开关——选中项关闭只写 `display`，变量会停在「打开」，表现成「点选项后浮层关了，再点胶囊没反应、要按第二次」。**多选下拉（图表 Y、统计页模型筛选、扩展图表 Y）勾选后不收起**：只就地重画勾选态与胶囊文案，图表与统计页留到 `afterNextPaint` 再画，重画前保存并恢复浮层 `scrollTop`。
- **按触发元素摆位的浮层**必须 `position:absolute` + `ui/dropdown-placement.ts#placeDropdownRelativeToHost`（只吃 rect，返回相对宿主 padding box 的 left/top/width/maxHeight/openUp，下方放不下且上方更宽则上翻）；**禁 `fixed` + `getBoundingClientRect`**（会被带 transform / filter / will-change 的祖先劫持）；范围取 `#aus-main` 与 `visualViewport` 交集，写 inline `left/top/width/maxWidth/maxHeight` 且 `right/bottom` 置 auto。
- **图表**：柱圆角由 `ui/chart-bar.ts#barTopRadius(柱宽)`（≈柱宽 1/6）算，禁写死 `[4,4,0,0]`，中间段与柱底固定 `BAR_SQUARE`（直角，堆叠才无缝）、柱宽由 `estimateBarWidth(容器宽, 轴占位, 类目数, barMaxWidth)` 估算（参考实测 38px 柱宽 → 6px 圆角）；tooltip 统一 `CHART_TOOLTIP_SURFACE`（圆角 14、内距 [8,12]，禁各处自写）；三段 Token 配色 `TOKEN_SERIES_COLORS` = 命中 `#A0DCFD` / 未命中 `#60B3FE` / 输出 `#0C70F3`，堆叠顺序 `tokenStackDrawOrder()`（输出压底）、悬浮窗顺序 `sortTooltipParams()`（按 Y 选项顺序）；tooltip 统一 `CHART_TOOLTIP_SURFACE`，时间文案归 `ui/chart-time.ts`；`dataZoom` 必须 `zoomLock:true`（`type:'inside'` 会无条件吞滚轮，`zoomOnMouseWheel:false` 无效，现存 `stats-view` / `extra-charts` / `model-trends`）。
- **统计页 9 图卡片骨架单一来源** `ui/chart-picker.ts#chartCardHTML`，样式全在 `.aus-chart-card` 段；`min-height:0` 必须写在 `.aus-chart-picker .aus-chart-pill` 上（否则触屏 `min-height:30px` 撑大）；Y 左端、X 右端展开，窄屏 Y 改右端且限宽；窄屏下 `#aus-extra-charts` / `#aus-model-trends` 的 `.ds-card` 必须 `overflow: visible`。
- **导航配色**：`--aus-nav-hover-bg`、`--ds-nav-active-bg`、`--aus-nav-active-icon` 各深浅一套；`.aus-nav-item.active` 必须写在 `:hover` 之后（同特异性靠顺序），窄屏规则禁写死灰度覆盖选中态。
- **毛玻璃（顶栏 + 底栏）**：`backdrop-filter: blur(20px) saturate(140%) !important` + `--aus-glass-bg`，滚动后才由 `panel.ts#syncTopbarState` 写 `data-scrolled="1"` 淡出 hairline；**禁给 backdrop-filter 加过渡或 will-change**，`@supports` 缺能力与 `prefers-reduced-transparency` 退回实心 `--ds-panel-bg`。底栏高度 `--aus-bottomnav-h`（默认 58px，矮屏 50px）+ `env(safe-area-inset-bottom)`，`#aus-main` 的 `padding-top/padding-bottom` 必须扣出顶栏 / 底栏与安全区；指示胶囊 `#aus-bottom-indicator` 圆角 18px（**刻意不用 999px**），`transform` 由 `panel.ts#syncBottomNav` 按当前 tab 实测中心写。
- **两个必须记住的坑**：① `#aus-panel *` 的 filter / backdrop-filter / will-change 规则必须排除 `#aus-page-header`、`#aus-mobile-header`、`#aus-bottom-nav`——早期全量清零把顶栏模糊干掉（表现「简直是透明」）；② 手机浏览器工具栏不占布局视口，`100vh` / `innerHeight` 是「工具栏收起」的大视口，底栏 `bottom:0` 会掉到工具栏背后（整条消失）→ 视图高度一律用 `panel.ts#visibleViewportHeight`（`visualViewport.height`，`scale≠1` 不动）并监听其 `resize/scroll`。
- 魔法棒入口 `background: transparent !important`；字体 `Microsoft YaHei`，不干预抗锯齿。
