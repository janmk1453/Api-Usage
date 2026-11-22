# src/data/AGENTS.md — 数据与统计口径分册

> 仓库根 `AGENTS.md` 的模块分册：改 `src/data/**`、`src/store/**`、`src/stats/**` 或任何统计口径前必读。


## 数据与统计口径

- **去重指纹**（`data/fingerprint.ts`）：模型 + token + `endpointId` + `credentialId`；热历史追加另有 `timestamp|model|total` 兜底（`store/index.ts`），`repository.addEntry` 还有 5 秒窗口去重。导出 / 同步走 `utils/history-key.ts#historyRecordKey`。
- **单一历史**：多存档已废弃，`saves` 仅作迁移兼容；热 50 条 + IndexedDB 冷分页，`hydrate` 自动合并旧存档并备份（`migration_backup_<时间戳>`）；`saveHot` 节流 300ms，`loadHot`/`migrateIfNeeded` 只允许 `repository.hydrate` 调用。
- **导入导出**（`import-export.ts`）：保持 `deepseek-stat-export v1` 兼容；钱包配置经可选 `wallets`/`walletIgnored`/`walletFormat:2` 携带；导出经 `getAllHistory` 含冷库全量，导入超 `MAX_HISTORY` 自动回冷；**任何校准密钥都不导出**，`persist` 落盘前剥隐私字段。**WebDAV 同步**（`sync.ts`）包版本 2、兼容读 1，单一历史 + 钱包合并后清洗，密钥不参与。
- **连接身份**（`connection-identity.ts`）：同一协议与主机的不同路径 / 查询参数归入同一来源（`youzi.today/v1`、`youzi.today/ababa`、`youzi.today` 视为一个），界面只显示主机；**`endpointId` 只由接入地址决定，绝不掺 `chat_completion_source`**——掺了就会让扩展 / 脚本自己拼的请求体给同一供应商造出第二个接入（第二个空钱包、费用记 0）；**不读取、不比较、不持久化 `proxy_password` 与 `custom_include_headers`**（反代密码因此无法细分，归入「未识别密钥」）。`HistoryEntry` 只存 `sourceType/endpointId/endpointLabel/credentialId/credentialLabel` 等可选兼容字段，随导入导出与同步透传、不改格式版本。
- **钱包匹配**（`wallets.ts#walletMatchKind`）：返回 `endpoint`（地址身份严格相等）/ `host`（同域名兜底，旧算法残留的两个 id 也能认出是一家）/ `source`（都没有地址时按来源）。`ensureWalletForConnection` 只在钱包没有 `endpointId` 时补写，绝不按请求体改写已登记地址，否则钱包 id 会来回抖动。
- **趋势样本来源**（`sample-quality.ts#isConversationEntry`）：趋势预测 / 模型效率只认**对话本身**发起的请求，`requestOrigin.kind` 为 `extension` / `script` 的一律剔除（它们各自独立、随时并发，混进序列会把上下文增长、压缩点与每轮成本算歪）；旧记录没有 `requestOrigin`（`null` / `unknown` / 缺字段）按对话放行，避免升级后历史凭空消失。两处同口径：`ui/forecast-view.ts#renderForecastView` 入口整表过滤，`stats/forecast-series.ts#prepareEntries` 再兜底一次。
- **请求类型筛选**（`sample-quality.ts#requestTypeKeysOf` / `matchesRequestType`）：值域 `conversation` / `extension` / `script` / `interrupted` / `estimated` / `agent`，并存**来源轴**（对话 / 扩展 / 脚本，占且仅占其一）与**状态轴**（中断 / 估算 / Agent，可叠加）。所以判定是「包含」而不是互斥：一条被中断的扩展请求同时属于 `extension` 与 `interrupted`。`filterStatsHistory` 的 `requestType` 维度调用它，`STATS_FILTER_ALL` 才算全部；历史页与统计页共用这一份判定，不要另写一套。
- **接入身份迁移**（`repository.ts#ENDPOINT_IDENTITY_VERSION`）：算法换代时 `needFullRecalc` 多一个 `!identityDone` 分支，强制跑一次「钱包按新身份去重合并 + 历史 `endpointId`/`walletId` 归位 + 整库重算」，跑完落 `_endpointIdentityVersion`；`migrateHistoryWalletLinks` 是这段历史归一的唯一实现，`migrateWallets` 与 hydrate 共用。
