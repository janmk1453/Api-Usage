# .github/AGENTS.md — CI 与 Pages 工作流分册

> 仓库根 `AGENTS.md` 的模块分册：改 `.github/workflows/**` 前必读。**CI 只读、不得提交或改版本字段。**

## ci.yml（`.github/workflows/ci.yml`）

- 触发：`dev` / `main` 推送，以及目标为这两支的 PR。
- 环境：Node 24。
- `verify` 作业（只读）：顺序 `typecheck → test → build → node --check → verify:ci → 工作区零差异`；任一步失败即失败。
- `preview` 作业：仅 `main` 推送或从 `main` 手动触发、且前置作业成功时运行，需要 `contents: write`，创建或更新 `preview-<12位提交哈希>` 预发布。`dev` 与 PR 不发布。
- 禁止：CI 提交代码、修改 `manifest.json#version` / `package.json#version` / `build_no`、操作正式 `vX.Y.Z` 标签。

## pages.yml

- 触发路径包含 `docs/**`（改文档或截图都会重建）。
- 构建：把 `docs/index.html` 复制为 `_site/index.html` 与 `_site/docs.html`，因此站点根与旧 `docs.html` 链接、以及 `#privacy` 锚点全部保持有效；同时复制 `docs/images/`。
- 页面是单文件内联实现，新增外部资源前要先确认 Pages 产物里带上了该资源。
