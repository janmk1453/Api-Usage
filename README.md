# API用量统计 — SillyTavern 扩展

实时统计与可视化 DeepSeek 及兼容 API 的调用成本，按官方用量页的极简浅色重塑交互（`v3.0.1`，详见更新）。

## 预览

> 扩展主面板为全屏独立页（`#aus-panel`，`position: fixed` 全屏，`container-query` 驱动），左侧可收起导航（`220px ↔ 60px` / `≤760px` 汉堡覆盖式抽屉），右侧多视图切换，样式对齐 DeepSeek（`#F6F7F8` 卡片 / 黑色 `pill` / 橙色柱状图，双主题 `light/dark`）。

## 功能（v3.0.1）

- **实时统计**：自动记录每次调用的 `token / 费用 / 命中率 / 时长 / 首字延迟 / 速率 / 思维链 / 截断` 等全量数据（`finish_reason === 'length'` 判截断，`reasoning_tokens/completion_tokens` 算思维链占比）
- **峰谷计费**：按北京时区区分高/低峰（多时段、支持跨天，周末全天低谷），仅对 `deepseek*` 模型生效，改后 `recalcAll`
- **余额**：同步官方余额或自定义余额，自动校准间隔可配（成功静默），`XOR` 混淆存储
- **可视化**：`7` 图（`Token/费用/命中率/请求数/耗时速率/模型占比` 等）+ 热力图 + 主图标（`Y` 8 选 × `X` 5 维度，双轴可读，统计页隐藏时跳过初始化）
- **历史**：倒序分页（`30/页`）+ `6px` 三色占比条 + 内联详情（`max 520px` 可内部滚动，`基础/性能/Token/费用` 四块 + `4 Tab` 原始数据，去重耗时/去 Emoji + 思维链占比/是否截断）+ 缓存断点对比（`旧/新` 并排 `diff`）
- **趋势预测（Beta）**：独立页，分段线性回归 `prompt(n)=C₀+n·Δ`（回落 `≥30%` 分段，仅末段，`R²` 择优 `linear/log/recent-mean`），`remainingRounds` 解二次方程得剩余轮数（`Δ±σ` 区间）与上下文上限 `R_ctx`，预测卡（余额/上下文双条）、预测图（拟合虚线+预测延伸+置信带+上限参考线）、敏感度滑块（假设命中率）、对比视图（最耗对话 Top）+ 能耗评分 `A-G`（`Δ 25%/out 20%/效率20%/命中15%/截断10%/思维链10%`）
- **设置**：`颜色模式（胶囊下拉）/ API 密钥（不回显）/ 余额 / 峰谷时段 / 模型与价格（内置可覆写+自定义增删，三价 ¥/百万）/ 调试（批量模拟，8% 截断）/ 峰值圆点 / WebDAV`，全部受 `recalcAll` 联动
- **导入导出**：白名单 `deepseek-stat-export v1`，`覆盖/合并`（按 `timestamp` 去重），`history` 中 `messages/fullRequest/fullResponse/raw_usage` 仅保留统计字段
- **云同步**：`WebDAV` `pull-merge-push` 双向合并（`history` 去重，`_debug` 已隔离），不含密钥与聊天内容，`https` 强制，支持 `CORS` 代理
- **检查更新**：关于页按钮 + 打开扩展自动检查（`6h` 节流，有更新 `toast+横幅`，无更新静默）；扩展内版本号由 `manifest.json` 单源注入（`vite.define __APP_VERSION__`），侧边栏/关于/导出同步
## 安装

1. `SillyTavern → 扩展程序 → 安装扩展程序 → 输入`https://github.com/janmk1453/Api-Usage`（稳定 `main`）
2. 测试通道：`管理扩展程序 → 更新源分支` 填 `dev` 可抢先体验（`dev` 的 `v3.0.1-dev.*` 不推送给 `main` 用户）
3. 启用后刷新网页，左下角魔法棒出现 `API用量统计` 入口

## 更新

1. `SillyTavern → 扩展程序 → 管理扩展程序 → 在下方找到`API用量统计`，等待一会右侧会出现更新按钮同时文字变绿
2. 或进入扩展 `关于` 页点击 `检查更新`（自动检查 `6h` 节流，有更新 `toast+横幅`）
3. 更新后刷新网页（`Ctrl+Shift+R` 若遇 `404 index-*.js` 需清缓存）

## 快速开始

1. **设置 → API 密钥** 输入并保存（不回显）
2. **设置 → 查询余额** 或开启自动校准（成功静默，失败 `toast`）
3. 正常对话，扩展自动记录（`fetch` 流式透传测 `TTFT/思维链`，`GENERATION_ENDED` 合并，`5s` 指纹去重）
4. **魔法棒 → API用量统计** 查看：用量概览为日报，用量统计按维度筛选，历史记录对比缓存，趋势预测（Beta）看剩余轮数

## 详细说明

### 用量概览

- **双余额卡**：充值余额（`CNY`）与累计消费（`CNY + tokens`）
- **双明细**：历史消耗（`总/命中/未命中/输出`）与支出明细（预计节省/支出输入/输出，分两行，`token` 灰色）
- **八小块**（`repeat(4,1fr)`，`≤760px` `repeat(2,1fr)`）：`overviewFour` 自定义 `16` 指标（`computeOverview` 单源，含新增 `avg_think_ratio/truncation_rate`），竖屏两列
- **热力图**：`Token 使用量热力图`（近 2 年按日聚合，卡内横向滑动，悬停日期+Token）

### 用量统计

- **双维度**：时间维度（`全部/今天/昨天/近 7 天/近 30 天/本月/上月/自定义`，自定义为直输日期两框 + 应用按钮，仅 `自定义` 时显示）仅影响 `三块+模型汇总`；模型维度（全部 + 已记录模型）影响本页所有内容；二者取交集
- **三块**：消费金额 `CNY` / `API 请求次数` / `Tokens`（`≤760px` 单列三行，满足一行一列）
- **四小块**：模型汇总表上方 `repeat(4,1fr)`（`≤760px` `repeat(2,1fr)` 两行两列），`statsFour` 自定义，与概览同体系，响应双维度（`computeStatsFour`）
- **模型汇总表**：`10` 列（模型/调用/命中/未命中/输出/总/总成本/平均成本/平均耗时/平均速率），横向可滚动，随双维度联动
- **图表**：主图 `Y` 8 选（`命中/未命中/输出/总 Token/命中/未命中/输出/总费用`）× `X` 5 选（轮次/每小时/每日/每周/每月，默认总 Token）双轴堆叠/曲线，悬浮分 `¥/tokens` 明细；下方 `6` 图 `2×3` 网格（`Token/费用` 堆叠同柱 + 曲线、`命中` 面积、`请求` 柱、`耗时/速率` 双轴、`模型` 环 `Token/次数` 切换），均支持独立 `Y/X` 配置，隐藏时跳过初始化

### 历史记录

- 每条含 `模型·日期 / in/out/duration/rate / ¥cost / 旧/新/详情`，底部 `6px` 三色占比条，分页 `30/页`
- 详情为内联 `max 520px` 可滚动展开（`基础/性能/Token/费用` 四块 + `请求参数/完整响应/Raw 用量/消息内容` 四 `Tab`，单列占满的“思维链 Token”，性能块 `耗时/首字延迟/速率/思维链耗时/思维链占比/是否截断`，`总时长` 已去重，`时段` 去 Emoji）

### 缓存断点对比

- 列表中前者点 `旧`、后者点 `新`，并排高亮差异，差异起点即发散位置

### 趋势预测（Beta）

- 独立页 `趋势预测（Beta）`（侧边栏入口），含预测卡（`R 余额/R 上下文` 双条、下一轮 `prompt/cost/hit`、`±σ` 区间）、预测图（输入 token 按轮次散点+拟合虚线+预测延伸+置信带+上下文上限参考线）、敏感度滑块（假设命中率实时重算）、能耗标识 `A-G` 与对比视图（最耗对话 Top）

### 设置

- 按 `设置` 视图内浅色卡片分组，`颜色模式` 胶囊下拉（`light` 默认，与隔离样式一致，旧用户自动迁移），改后自动 `recalcAllCosts + refreshUI`
- 调试批量可按日期区间生成模拟数据（8% 截断），便于图表压测

### WebDAV 云同步

- 填写 `https` 地址、用户名、应用密码与子路径，`CORS 代理` 可选（推荐 `config.yaml: enableCorsProxy: true` 后填 `http://127.0.0.1:8000/proxy?url=`）
- 同步包为单一历史聚合，`history` 按 `timestamp` 去重，`_debug` 已隔离，`balance/settings` 按 `_ts` 晚者胜

## 构建

```bash
npm install
npm run typecheck
npm run build  # 产出 index.js + 动态分包 index-*.js/update-*.js + ECharts 9 块 + style.css
node --check index.js
```

产物为 `index.js（入口 re-export） + hash 分包`，**必须**与 `style.css` 一并提交，缺一则 `404` 导致 `[object Event]` 加载失败。

## 数据

- 存储于 `extensionSettings[api_usage_stat]`（热 `50`）+ `IndexedDB api_usage_stat_db`（冷 `cold_history`），旧 `ds_saves` 自动合并为单一历史并备份 `migration_backup_*`
- 导出 `deepseek-stat-export v1`，`_debug` 已隔离，不含密钥，`history` 中 `messages/fullRequest/fullResponse` 仅保留统计字段
- 计算：`src/data/computed.ts` 单源（`computeOverview/computeStatsFour`），`recalcAll` 按归一化模型重算

## 版本与分支

- `manifest.json#version` 单源，`vite.config.ts` 注入 `__APP_VERSION__`，侧边栏/关于/导出/检查更新均同步
- 分支：`main` 稳定（普通用户） / `dev` 测试（开发者切分支验证） / `beta` 可选公测；`main` 仅在 `dev` 验证后 `merge --no-ff` 发布

## 常见问题

- **扩展加载失败 [object Event]**：`GET .../index-*.js 404` 导致，属分包漏提交，重新 `build` 并提交全部 `index-*.js` 即可
- **TTFT/思维链为 0**：已修复为流式透传测量，`GENERATION_ENDED` 合并 `lastFetchUsage`，旧数据仍为 0 正常
- **颜色模式重置为深色**：已修复，默认 `light` 与隔离样式一致，旧用户迁移保留 `light`
- **WebDAV CORS**：坚果云等不返回 `CORS` 头，需配置代理

## 更新

- `3.0.1`：版本单源化、分支隔离（`main/dev`）、检查更新（关于页按钮 + `6h` 自动节流）、趋势预测（Beta）+ 能耗评分、统计 4 小块、思维链占比/截断率、直输日期、三块竖屏单列、详情滚动与去重等
- `3.0.0`：`Tavern Helper` 脚本迁移至原生扩展，重塑为官方浅色，`Vite` 构建，单一历史，`Y/X` 可配置图表等

## 技术说明

- 统一数据框架 `src/data/`：`repository` 唯一写（`addEntry/recalcAll/replaceAll/hydrate` 含 `finishReason/isTruncated`）、`computed` 唯一算（`computeOverview/computeStatsFour`）、`events` 订阅刷新，禁止在 `UI` 直写 `state`
- 拦截：`GENERATION_ENDED → extra.api_usage` 主路径，`fetch` 辅路径流式测 `TTFT/思维链/截断`，`process` 合规
- 预测：`src/stats/forecast.ts` 分段回归 + 二次方程求 `R`，`energyScore.ts` 加权 `A-G`

## 致谢

部分实现参考了 [cone97218-alt/ds](https://github.com/cone97218-alt/ds)，在此致谢。

## 许可证

MIT
