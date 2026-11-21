# scripts/AGENTS.md — 校验与预览包脚本分册

> 仓库根 `AGENTS.md` 的模块分册：改 `scripts/**` 前必读。三个脚本都是**只读校验 / 打包**工具，不得在 CI 之外产生副作用。

## 职责

- `scripts/verify-ci.mjs`：版本单源（`manifest.json#version` / `build_no`）、`manifest.json` 的 `js/css/i18n` 路径、从入口出发的 import 引用链、`dist/` 孤立产物检测。任何一项失败即 `exit 1`。
- `scripts/preview-package.mjs`：`git archive` 打包含 `dist/index.js`、`style.css`、`manifest.json`、`README.md`、`LICENSE` 等允许文件，校验清单 / 入口 / 引用链 / 结构并输出 SHA-256；允许文件清单集中在 `fixedFiles` 与后缀正则，新增产物类型必须同步。
- `scripts/preview-notes.mjs`：按提交区间生成 `preview-<12位哈希>` 的说明与链接，不复用 / 不移动既有标签。
- 调用方式：`node scripts/preview-package.mjs <输出目录> HEAD`、`node scripts/preview-notes.mjs <输出文件> HEAD`。

## 常用命令

```bash
node scripts/preview-package.mjs <输出目录> HEAD
node scripts/preview-notes.mjs <输出文件> HEAD
```

## 硬约束

- **产物必须提交**：`dist/index.js` 只是 `import "./index-*.js"` 存根，漏交任一 hash 分包就 `GET dist/index-*.js 404` → `Could not activate extension [object Event]` 并阻断后续扩展加载（全站故障）。
- **import 扫描必须先剥注释**：`verify-ci.mjs` 与 `preview-package.mjs` 都要先 `stripCommentsForImportScan`，否则 ECharts 分包里的示例 `import './XxxModel.js'` 会被误判成缺失依赖（曾导致 `main` 预览作业失败）。
- **只读**：脚本不得写仓库文件、不得改版本字段、不得创建正式 `vX.Y.Z` 标签。
