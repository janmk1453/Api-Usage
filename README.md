# API用量统计 — SillyTavern 原生扩展（RE 3.0）

> 样式对齐 `https://platform.deepseek.com/usage`（浅色 `F6F7F8` 卡 / 黑 pill / 橙柱），内容与 `DeepSeek使用预测.js` 1:1。

## 安装

1. 将 `RE3.0` 文件夹作为 `SillyTavern/data/default-user/extensions/api-usage-stat` 或 `third-party/api-usage-stat` 放置
2. `manifest.json: js=index.js css=style.css`，ST 自动加载
3. 或 `npm run build` 后将产物 `index.js + style.css + manifest.json` 打包安装

## 功能（阶段 0-3 已完成）

- **拦截**：`GENERATION_ENDED → extra.api_usage`，`processUsage` 1:1（含 `cached_tokens` 回退、推理 `thinkTokens`、`TTFT`、`tokenRate`）
- **定价**：`PRICING` 三模型峰谷、`isPeakHour/isWeekendDay` 北京时区、`calcCost/calcSavings`、`recalcAllCosts`
- **存储**：`extensionSettings[api_usage_stat]` 热 50 + `IndexedDB api_usage_stat_db` 冷分页，旧 `ds_*` 自动迁移备份，`XOR` 密钥兼容
- **面板**：`inline-drawer` 浅色隔离 `data-ds-theme="light"`，双余额卡/筛选条/18 统计卡（`F6F7F8` 网格）/橙柱 `ECharts` + 热力 + 历史旧/新/详情 + 缓存断点 Diff + 设置（API Key/余额/WebDAV/峰值圆点）+ 峰值圆点可拖动
- **导入导出**：白名单 `deepseek-stat-export v1`，`overwrite/merge` 按 `timestamp` 去重
- **WebDAV**：`pull-merge-push` 双向合并（`_mtime` 晚者胜），`https` 强制，`proxy?url=` 双代理

## 样式

- 底 `#FFFFFF`，卡 `#F6F7F8` 14px 圆角，文字 `#111827 / #6B7280 / #9CA3AF`，黑 pill `#111827`，橙 `#FF6A00` 柱圆角 4px，薄荷 `#E6F8EC` 标签，`Inter/tabular-nums`

## 构建

```bash
npm install
npm run typecheck
npm run build  # 产出 index.js + style.css
```

## 迁移

- 旧脚本 `ds_saves/ds_settings/...` 首次启动自动搬至 `extensionSettings`，冷历史进 `IndexedDB`，备份 `migration_backup_*`
- 独立仓库：脚本主线不变，`RE3.0` 本地开发，暂不建仓

## 待办（阶段 4）

- 统计卡显隐排序、`Popup` 确认统一、文档与发布清单

## 版本

- `manifest 3.0.0 / 1.11.0`
