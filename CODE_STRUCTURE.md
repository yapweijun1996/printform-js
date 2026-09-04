# 📁 PrintForm.js 代码结构说明（索引）

> 本文件提供代码结构的总览与导航，细节拆分到 `docs/code-structure/`。

> 最后核对：2026-09-04。Studio v2 当前包含 `core/`、`ui/`、`adapters/`、`samples/`、`server/`；AI Designer 的 UI 入口是 `ui/agent-panel-view.js`、`ui/agent-panel.js`、`ui/agent-runtime.js`，事务和信任逻辑仍归 `core/`，不由 UI 重复实现。

---

## 🗂️ 顶层结构一览

`src/` 源代码、`docs/` 文档、`scripts/` 构建脚本、`tests/` 单元测试(含 `tests/studio-v2/`)、`dist/` 构建输出(不进 git)、`index*.html` 演示页面、`studio/` 可视化调参工具(**已冻结**,独立静态工具,详见 [docs/STUDIO_DESIGN.zh-CN.md](docs/STUDIO_DESIGN.zh-CN.md))、`studio-v2/` Production Pilot 单 HTML 工作室(core/ui/adapters/samples 分层,详见 [docs/STUDIO_V2_INDEX.zh-CN.md](docs/STUDIO_V2_INDEX.zh-CN.md) 与 [DESIGN.md](DESIGN.md))。完整文件树见 [docs/code-structure/FILE_MAP.md](docs/code-structure/FILE_MAP.md)。

---

## 🎯 关键入口

- `src/printform.js` - 公共 API 与自动初始化
- `src/printform/config.js` - 配置项定义与合并逻辑
- `src/printform/formatter/` - 分页格式化核心
- `scripts/` - 构建与文档生成脚本
- `studio-v2/core/` - Protocol/FormSpec、semantic operations、CommandBus、事务、诊断、Evidence Pack、导出
- `studio-v2/ui/` - Studio 工作区、预览、编辑器、AI Designer、设置 modal、i18n 和 PWA 交互
- `studio-v2/adapters/` - WebMCP 与公共 Agent gateway 适配层
- `studio-v2/server/` - E13-SERVER SQLite durable backend 与 bounded HTTP adapter

---

## 🔍 深入阅读

- 文件角色与职责: `docs/code-structure/FILE_MAP.md`
- 分页数据流与流程: `docs/code-structure/PIPELINE.md`

