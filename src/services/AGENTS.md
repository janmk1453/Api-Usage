# src/services/AGENTS.md — 采集、拦截、更新与钱包服务分册

> 仓库根 `AGENTS.md` 的模块分册：改 `src/services/**`（含 `request-tap/`、`agent-usage/`）前必读。数据读写仍必须走 `src/data/`。


## 采集与拦截

- **主路径** `GENERATION_ENDED` → `chat[].extra.api_usage`；辅助路径 `ApiUsageStatInterceptor`（`/api/backends/chat-completions/generate` 响应解析）。两条都汇到 `repository.addEntry`，与脚本 1:1。连接身份在 fetch 请求开始时同步快照并随请求传递，**禁止在生成结束后重读可能已切换的密钥**。
- **fetch 包装必须是最外层且自愈**：宿主（TauriTavern 的 `initialize-tauri-integration.js#interceptors.patchFetch()`）会把自己的 patchedFetch 装回去并把当前 fetch 当 delegate——被挤到内层就再也看不到响应。故 `interception.ts` 用 `__aus_patched` 标记 + `startFetchGuard()`（`FETCH_GUARD_MS = 4000` + 启动后 1.2s/3s 补挂）发现最外层不是自己就重包；`rawFetchRef` 每次安装同步更新，卸载时还原到本次所用的下一层。
- **TTFT / 思维链**：`GENERATION_ENDED` 不带 ttft，需合并 5 秒内的 `lastFetchUsage`；思维链耗时由 `services/think-timing.ts` 按 JSON 增量只认「首个非空思维链帧 / 首个非空正文帧」（旧实现 substring 匹配 `reasoning_content`/`content`，DeepSeek 首帧 `"content":null` 会同时命中 → 思维链耗时恒 0）；`lastStreamTiming` 经 `processUsage` 按 `startTime` 补齐。
- **速率**（`data/token-rate.ts`）：`streamed === false`（非流式 / 假流式）时速率与 ttft 归零；窗口 <200ms 或 >1000 t/s 判脏归 0；`sanitizeHistoryTiming` 修历史脏值。
- **中断与估算**（`services/turn-outcome.ts#decideTurnOutcome` 是唯一判定表）：有可用 usage 就正常记录（`pendingStop` 标 user 中断、`streamError` 标 upstream 中断）；无 usage 但有输出（正文或思维链）时，手动停止 / 上游报错记中断、否则本地估算；既无 usage 又无输出直接丢弃。`GENERATION_STOPPED` 只置 `pendingStop`（`STOP_WINDOW_MS = 3000`，延迟 `STOP_SETTLE_DELAY_MS = 1500` 兜底结算），落库统一走 `settleTurnWithoutUsage` 与 `processUsage`。
- **本地估算**（`services/token-estimate.ts`）：按 `tavern-token-count`（`extra.token_count`）→ `tavern-tokenizer` → `char-heuristic-v1`（`ceil(cjk*0.6 + other/3.5)`）三级降级；估算时 `usageSource='estimated'`、`estimateCacheUnknown=true`、`costEstimated=true`，命中量按 0、未命中按 prompt。
- **探针**（`services/request-tap/`）：采集 / 判定 / 匹配 / 账本各自单文件，为历史页健康提示提供「请求是否真的没记进历史」的证据，**不要让探针逻辑渗进拦截主链**。

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
