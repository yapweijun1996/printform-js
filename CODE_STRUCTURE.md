# 📁 PrintForm.js 代码结构说明（索引）

> 本文件提供代码结构的总览与导航，细节拆分到 `docs/code-structure/`。

---

## 🗂️ 顶层结构一览

`src/` 源代码、`docs/` 文档、`scripts/` 构建脚本、`tests/` 单元测试、`dist/` 构建输出(不进 git)、`index*.html` 演示页面。完整文件树见 [docs/code-structure/FILE_MAP.md](docs/code-structure/FILE_MAP.md)。

---

## 🎯 关键入口

- `src/printform.js` - 公共 API 与自动初始化
- `src/printform/config.js` - 配置项定义与合并逻辑
- `src/printform/formatter/` - 分页格式化核心
- `scripts/` - 构建与文档生成脚本

---

## 🔍 深入阅读

- 文件角色与职责: `docs/code-structure/FILE_MAP.md`
- 分页数据流与流程: `docs/code-structure/PIPELINE.md`

