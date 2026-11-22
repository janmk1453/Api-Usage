# src/services/AGENTS.md — 采集、拦截、更新与钱包服务分册

> 仓库根 `AGENTS.md` 的模块分册：改 `src/services/**`（含 `request-tap/`、`agent-usage/`）前必读。数据读写仍必须走 `src/data/`。


## 采集与拦截

- **主路径** `GENERATION_ENDED` → `chat[].extra.api_usage`；辅助路径 `ApiUsageStatInterceptor`（`/api/backends/chat-completions/generate` 响应解析）。两条都汇到 `repository.addEntry`，与脚本 1:1。连接身份在 fetch 请求开始时同步快照并随请求传递，**禁止在生成结束后重读可能已切换的密钥**。
- **fetch 包装必须是最外层且自愈**：宿主（TauriTavern 的 `initialize-tauri-integration.js#interceptors.patchFetch()`）会把自己的 patchedFetch 装回去并把当前 fetch 当 delegate——被挤到内层就再也看不到响应。故 `interception.ts` 用 `__aus_patched` 标记 + `startFetchGuard()`（`FETCH_GUARD_MS = 4000` + 启动后 1.2s/3s 补挂）发现最外层不是自己就重包；`rawFetchRef` 每次安装同步更新，卸载时还原到本次所用的下一层。
- **TTFT / 思维链**：`GENERATION_ENDED` 不带 ttft，需合并 5 秒内的 `lastFetchUsage`；思维链耗时由 `services/think-timing.ts` 按 JSON 增量只认「首个非空思维链帧 / 首个非空正文帧」（旧实现 substring 匹配 `reasoning_content`/`content`，DeepSeek 首帧 `"content":null` 会同时命中 → 思维链耗时恒 0）；`lastStreamTiming` 经 `processUsage` 按 `startTime` 补齐。
- **速率**（`data/token-rate.ts`）：实测与估算同口径「输出 Token（含思维链）÷（总耗时 − 首字）」；`streamed === false` 或首字 ≥ 总耗时 98%（假流式）时首字归一为 0；测不出实测值时按同公式估算并标 `rateEstimated`（`prefill` 为旧口径，只剩兼容）；窗口 <200ms 或 >1000 t/s 判脏归 0；`sanitizeHistoryTiming` 修历史脏值并清掉旧估算标记以便重算。
- **中断与估算**（`services/turn-outcome.ts#decideTurnOutcome` 是唯一判定表）：有可用 usage 就正常记录（`pendingStop` 标 user 中断、`streamError` 标 upstream 中断）；无 usage 但有输出（正文或思维链）时，手动停止 / 上游报错记中断、否则本地估算；既无 usage 又无输出直接丢弃。`GENERATION_STOPPED` 只置 `pendingStop`（`STOP_WINDOW_MS = 3000`，延迟 `STOP_SETTLE_DELAY_MS = 1500` 兜底结算），落库统一走 `settleTurnWithoutUsage` 与 `processUsage`。
- **本地估算**（`services/token-estimate.ts`）：按 `tavern-token-count`（`extra.token_count`）→ `tavern-tokenizer` → `char-heuristic-v1`（`ceil(cjk*0.6 + other/3.5)`）三级降级；估算时 `usageSource='estimated'`、`estimateCacheUnknown=true`、`costEstimated=true`，命中量按 0、未命中按 prompt。
- **请求来源**（`services/request-origin.ts`，纯逻辑可直接单测）：只认调用栈，**禁止用请求体特征反推发起方**（扩展改一行模板就漂移，方案阶段已否掉）。判据以「酒馆发送脚本帧」为锚点——`SEND_SCRIPTS = ['/scripts/openai.js', '/scripts/textgen-settings.js']`（聊天/文本补全的唯一两个真 fetch 处，文件级判断，改名压缩不影响），排在它**外面**的 third-party 帧才是发起者，排在它**里面**的只是包装 fetch（酒馆助手/预设脚本的常规操作，判酒馆）；栈里没有发送帧时任何 third-party 帧即扩展直连（此时 `/script.js` 帧只是触发它的 UI 事件）。三个必须守住的点：① 必须跳过自身帧（`SELF_MARKERS` 默认 `api-usage`，入口 `registerRequestOriginSelf(import.meta.url)` 补真实目录名）——自身帧漏排会把内层包装器反判成更外层发起者，实测踩过；② `detectRequestOrigin()` 只能在 fetch 包装的同步段调用，任何 `await` 之后栈就断了；③ 认不出返回 `null`、界面不标角标、绝不编一个来源。来源随 `TurnContext` 落地，**并发一律按 `requestId` 配对**（`turnByRequestId`；`startTime` 是 `Date.now()`，同毫秒连发会撞），查不到 `requestId` 才退回 `startTime`，都没有就返回空。
- **探针**（`services/request-tap/`）：采集 / 判定 / 匹配 / 账本各自单文件，为历史页健康提示提供「请求是否真的没记进历史」的证据，**不要让探针逻辑渗进拦截主链**。

## 聊天消息头元信息（`services/message-cost/`）

在酒馆聊天页每条回复的头部标「这一轮花了多少钱」，可选带首字延迟 / 生成速度 / 缓存命中率。**只读 `state.history` 画 DOM，绝不回写 `message.extra`**——那会随聊天落盘、进导出与 WebDAV。

- **配对**（`match.ts`，纯逻辑可单测）：锚点只取内核写的消息字段 `gen_started` / `gen_finished` / `extra.prompt_cache` / `extra.model`，**不读请求体**。L1 指纹——`prompt_cache.input_tokens`/`cached_tokens` 与记录的 `prompt_tokens`/`cache_hit_tokens` 完全相等；L2 时间窗（`MATCH_WINDOW_BEFORE_MS = 1500` / `MATCH_WINDOW_AFTER_MS = 5000`）+ 只认 `requestOrigin.kind` 为 `tavern`/`unknown`/空（扩展直连与 iframe 脚本的请求不算这一轮对话）；L3 无 `gen_finished` 时只有唯一候选才采用。两条候选与锚点距离差 < `MATCH_AMBIGUITY_MS = 300` 且 Token 不同 → 判并发歧义**直接不显示**（宁缺勿错）。记录侧 `timestamp` 是**入库时刻**（≈ 响应结束），不是请求开始。
- **swipe**：`swipe_info[swipe_id]` 里才是那条分支自己的 `gen_started`/`gen_finished`/`extra`，切 swipe 必须用它，否则会拿主字段（最后一次生成）错配。
- **环境分叉**（`render.ts#hasNativeGenerationInfo`，探针是 `#messageFirstTokenEnabled`）：TauriTavern 内核自带首字 / 速度 / 命中三块，扩展**只补价格**；SillyTavern 没有，四项全画。显示口径：`moneyText()` 4 位小数不带币种码，`pricingSource === 'unpriced'` 显示「待定价」，`costEstimated` 加 `≈`。
- **开关**（`settings-row.ts`）：注入到宿主「用户设置 → 消息显示」栏（ST 接 `#messageTokensEnabled`、TT 接 `#messageCacheEnabled` 那个 `label` 之后），状态存扩展自己的 `settings.messageCost/messageTtft/messageRate/messageCache`（默认全关），**不写 `power_user`**，避免污染宿主设置导出。
- **刷新**（`index.ts`）：`CHARACTER_MESSAGE_RENDERED` / `MESSAGE_SWIPED` / `CHAT_CHANGED` / `MESSAGE_UPDATED` / `GENERATION_ENDED`（400ms 与 1200ms 各一次，记录可能晚于事件入库）+ `#chat` 的 `MutationObserver` 兜底（只含自身 `.aus-mes-meta` 的变更要过滤掉，否则自激）。

## TauriTavern Agent 模式（兼容层，禁止改动酒馆侧采集）

TauriTavern 的 Agent 模式把「一次 Run 的多次模型调用」交给宿主记账，酒馆侧 `GENERATION_ENDED` 根本不触发，所以 `src/services/agent-usage/` 单独走宿主 API 采集。**适配逻辑必须落在 `src/services/agent-usage/` 内，`interception.ts` 等服务酒馆本身的采集代码一律不动**（用户明确要求）。

- **门面**：`window.__TAURITAVERN__`（`tt-agent-api.ts#getTauriTavernRoot/isTauriTavern/getHostAbiVersion/getAgentApi`）。2.4.0 的 Web Host 不注入该门面 → `getAgentApi()` 返回 `null` → 采集静默关闭，不得报错。
- **起点识别按 ABI 分流**：`HOST_ABI_VERSION = 1`（≤2.3.x）时 `generate_data.frozenRunInputSnapshot` 已封口 → 直接 `markPending()`；`= 2`（2.4.0 起）时快照在事件**之后**才封口 → 回调只 `snapshotProbe.remember(data)` 留引用，等下一个真实酒馆事件（`MESSAGE_RECEIVED` / `CHAT_CHANGED` / `APP_READY` / 打开面板）时 `flushSnapshotProbe()` 对比**同一个对象**是否已出现封口字段，出现即 `scheduleReconcile(300)`。
- **禁止用 `setTimeout` / `setInterval` 轮询等快照**（延时方案已被用户否决）；待查引用环形只留最近 2 个（`createFrozenSnapshotProbe(2)`）。
- `needsSnapshotProbe(abi)`：`abi === 1` → `false`，其余（0 / 未知 / ≥2）→ `true`（未知版本按新语义探测）；`hasFrozenRunSnapshot(data)` 只认自身属性（`hasOwnProperty`），不认原型链；`snapshot-probe.ts#SNAPSHOT_SEALED_AFTER_EVENT_ABI` 需随宿主封口时机变化同步。
- **对账**（`reconcileAgentRuns`）：一律扫最近 20 条，**不再按 `aus_agent_watermark_v1` 水位提前 `break`**（水位只保留首次初始化用途），否则「失败 / 取消且没提交聊天」的 Run 永远补不回来；已记录的由 `hasRecordedAgentRun` 跳过。
- **卸载**（`uninstallAgentUsage`）要 `snapshotProbe.clear()`。
- **测试三件**：`snapshot-probe.test.ts`、`tt-agent-api.test.ts`、`collector-wiring.test.ts`（`?raw` 源码字符串断言，守住「两条路径 + 不许出现定时器 + 对账不按水位收手」）。改 `collector.ts` 必须同步核对。

## 强制更新（救援通道）

用途只有一个：**未来某版本坏到用户无法手动更新时把用户拉回来**。它不是「自动更新功能」，没有本地开关，不受任何用户偏好影响。

- **策略真源**：仓库根 `update-policy.json`（与 `manifest.json` 分开放，改策略不用动版本号）：`{ force, minVersion, reason }`，平时 `force:false`；`minVersion` 用于提前埋旗到点生效，`reason` 会展示给用户。读的是**用户当前所在分支**的这份文件（main / dev 各自独立）。
- **触发**：① 启动后 3s 静默探测（`probeForcedUpdateAtStartup`，2 小时最多一次，入口里独立 try/catch，不依赖面板与 `repository.hydrate`）；② 打开面板的常规 `checkUpdate` 发现落后时。两处都只在远端版本确实更高时动手（`shouldForceUpdate`，**永不降级**）。
- **执行**：复用 `updateSelf()`（跨分支先 `/api/extensions/switch` 再 `/api/extensions/update`），成功后 `scheduleReloadForUpdate()` 刷新；正在生成时挂到 `GENERATION_ENDED` 之后，拿不到事件源则 15s 轮询、最多等 10 分钟。
- **失败退避**：任何失败（非 Git 安装、403、服务端拉不到）只写 30 分钟退避 + 静默 log，不阻断面板；策略读不到（网络 / 限流）一律当「没有强制要求」，绝不反过来硬更新。策略文件走 GitHub raw + jsDelivr 双源。
- **硬边界（不要承诺能救）**：坏在 `dist/index.js` 加载阶段的版本（语法错误、分包 404、顶层 import 抛错）自救逻辑没有执行机会；非 Git 安装与无管理员权限的全局扩展只能提示手动更新。所以这条通道必须在健康版本里预埋。
- **禁用形状**：不要加开关、不要降级、失败不要反复重试刷屏、不要依赖面板 DOM。

## 更新检查（国内多源竞速）

- 源清单单一来源 `services/update.ts#remoteSources(path, branch)`，`manifest.json` / `update-policy.json` / compare 共用；九条分两梯队——实时源 `raw.githubusercontent.com` / `ghproxy.net` / `gh-proxy.com` / `gh-proxy.org` / `raw.gitmirror.com` 用 `raceJson` 并发先到先得，全部失败才退 CDN 缓存源 `cdn.jsdelivr.net` / `fastly.jsdelivr.net` / `cdn.jsdmirror.com` / `jsd.onmicrosoft.cn`（对 `@branch` 最长 12 小时缓存，只能兜底；国内实测 raw 与 cdn.jsdelivr 常双双不可达，`gh-proxy.com` / `fastly` / `jsd.onmicrosoft.cn` 仍可用）。
- 每梯队独立 `AbortController` + `TIER_TIMEOUT_MS = 3000`；URL 一律带 `?t=` 绕缓存。
- compare 同样竞速：`api.github.com` 直连 + `gh-proxy.com` 包装；拿不到 compare 不放弃，改用远端 `manifest.json` 版本比 `isNewer`（`remoteKind = 'version'`，提示「发现 <分支> 分支新版本 vX（当前 vY），可在关于页更新」）。
- 源顺序与 URL 形状由 `services/update-sources.test.ts` 锁定，改源必须同步该测试。
- 跨分支更新先 `/api/extensions/switch` 再 `/api/extensions/update`，成功后刷新；自动检查 10 分钟节流。
- **扩展名只发目录名**（`update.ts#extensionFolderName`）：宿主所有 `/api/extensions/*` 端点都是「`sanitize(extensionName)` + `path.join(basePath, name)`」，而 `basePath` 本身已是用户扩展目录或全局 `third-party` 目录，所以只认单段目录名 `Api-Usage`。清单与 `/discover` 给的是逻辑名 `third-party/Api-Usage`，原样回传会被 sanitize 成 `third-partyApi-Usage` → 404「Directory does not exist at …」。`extensionNameHint` / `extensionNameCandidates` / `extensionScopeFromList` / `versionProbePlan` 必须全部过这个归一化，`update-sources.test.ts` 锁定该行为。

## 公告（`announcement.json`）

- **发布方式**：仓库根的 `announcement.json`（与 `update-policy.json` 同一思路，**独立于版本与构建号**），客户端固定读 `main` 分支——改完提交即生效，不动版本号、不重新打包，可随时加一条或撤回。`dev` 用户也读 `main`，避免公告只对测试分支可见。
- **文件形状**：`{ "schema": 1, "items": [ { id, date, level, title, body: ["段1","段2"], minVersion, maxVersion, until, linkText, linkUrl } ] }`。`id` 必填且全局唯一（`[A-Za-z0-9._:-]{1,64}`），`title`/`body` 必填，`level` 只认 `info`/`warning`/`critical`，`until` 为 `YYYY-MM-DD`（当天仍有效），`linkUrl` 只认 `http(s)` 与 `/` 开头。清洗在 `services/announcement.ts#normalizeAnnouncementItem`：坏条目直接丢，不让弹窗炸。
- **已读按条目 id**（`localStorage[aus_announcement_seen_v1]`，只留最近 200 条），不是按版本/构建号：同一条改文案不会重弹，新发的照常弹。`aus_announcement_cache_v1` 存上次成功拉到的列表，断网也能弹未读。
- **拉取**：打开面板才检查，`ANNOUNCEMENT_MIN_INTERVAL_MS = 30 分钟` 节流（`aus_announcement_check_v1`）；源复用 `remoteSources(path, 'main')` 两梯队（实时源 3.5s 超时，全灭再退 CDN）；任何失败（超时、被墙、JSON 坏）**一律静默**返回 null，不影响面板与任何统计。
- **与更新弹窗互斥**：`ui/panel.ts#openPanel` 先试 `maybeShowChangelogDialog`，那一轮弹了更新就不再弹公告（留到下次），避免一次打开糊两个弹窗。
- **隐私**：只 GET 静态 JSON，不带任何本地数据；`ui/help-view.ts` 隐私声明里已写明。
