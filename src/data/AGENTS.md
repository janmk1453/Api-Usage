# src/data/AGENTS.md — 数据与统计口径分册

> 仓库根 `AGENTS.md` 的模块分册：改 `src/data/**`、`src/store/**`、`src/stats/**` 或任何统计口径前必读。


## 数据与统计口径

- **去重指纹**（`data/fingerprint.ts`）：模型 + token + `endpointId` + `credentialId`；热历史追加另有 `timestamp|model|total` 兜底（`store/index.ts`），`repository.addEntry` 还有 5 秒窗口去重。导出 / 同步走 `utils/history-key.ts#historyRecordKey`。
- **单一历史**：多存档已废弃，`saves` 仅作迁移兼容；热 50 条 + IndexedDB 冷分页，`hydrate` 自动合并旧存档并备份（`migration_backup_<时间戳>`）；`saveHot` 节流 300ms，`loadHot`/`migrateIfNeeded` 只允许 `repository.hydrate` 调用。
- **导入导出**（`import-export.ts`）：保持 `deepseek-stat-export v1` 兼容；钱包配置经可选 `wallets`/`walletIgnored`/`walletFormat:2` 携带；导出经 `getAllHistory` 含冷库全量，导入超 `MAX_HISTORY` 自动回冷；**任何校准密钥都不导出**，`persist` 落盘前剥隐私字段。**WebDAV 同步**（`sync.ts`）包版本 2、兼容读 1，单一历史 + 钱包合并后清洗，密钥不参与。
- **连接身份**（`connection-identity.ts`）：同一协议与主机的不同路径 / 查询参数归入同一来源（`youzi.today/v1`、`youzi.today/ababa`、`youzi.today` 视为一个），界面只显示主机；**不读取、不比较、不持久化 `proxy_password` 与 `custom_include_headers`**（反代密码因此无法细分，归入「未识别密钥」）。`HistoryEntry` 只存 `sourceType/endpointId/endpointLabel/credentialId/credentialLabel` 等可选兼容字段，随导入导出与同步透传、不改格式版本。
