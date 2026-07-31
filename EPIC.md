# EPIC.md — 史诗级工作项与状态

> 状态：✅ 完成 · 🔶 部分完成 · ⬜ 未开始。逐条任务见 [TASK.md](TASK.md)，时间线见 [ROADMAP.md](ROADMAP.md)。
>
> 最后核对：2026-07-31（对齐待提交的渲染行数完整性校验批次；E5 现已全部完成；E6/E7 已拆分为 TASK.md #12–19）。

| # | Epic | 状态 | 说明 / 证据 |
|---|---|---|---|
| E1 | 核心引擎稳定化 | ✅ | 分页引擎模块化拆分完成；2026-07-31 修复动态注入不执行、PADDT 克隆强制换页（`00e3b7f`）；100 个单测全绿 |
| E2 | Studio v1 加固并冻结 | ✅ | 结构模式索引对齐、XSS 加固、mustache-lite 严格化（`ebd5d20`）；此后**只修 bug 不加功能** |
| E3 | 构建/脚本健壮化 | ✅ | serve-site 防崩、SW 占位符断言、v2 校验器区分未签名与被篡改（`ebd5d20`） |
| E4 | Studio v2 安全闭环（第一批） | ✅ | 预览消息防伪造、opener 切断、原型污染防护、单调 revision、信任物理剥离（`1bc63d7`）；对应路线图 P0-A #2 与 P0-B #1 的 iframe 身份部分 |
| E5 | Agent / 开发者可观测性 | ✅ | WebMCP 标准注册、元素级 issues、质量门可点击、开发模式 SW 网络优先（`53d4a52`）、预览问题元素红框 overlay（`1dc2856`）、Apply 前并排 diff 面板（待提交，取代 window.confirm 文本） |
| E6 | P0-A 事务闭环（Agent Contract 2.0） | 🔶 | 已完成：单调 revision（`1bc63d7`）、operations 判别联合 schema 校验（`77d9722`）。已拆分为 TASK.md #12–14（隔离 iframe 真实渲染 → previewId/candidateHash 契约 → Agent Contract 2.0 切换，三者耦合需一起交付） |
| E7 | P0-B 信任闭环（证据体系） | 🔶 | 已完成：`event.source` 目标 iframe 校验、元素级越界/对比度定位、渲染行数完整性校验 `ROW_COUNT_MISMATCH`（待提交，仅数量未含顺序）。已拆分为 TASK.md #15–19（nonce、行顺序/identity、重叠碰撞检测、截图 Evidence Receipt、完整 attestation） |
| E8 | P1 工程师结构化工作流 | 🔶 | 已完成：高层语义工具第一批 `set_column_widths`/`set_font_scale`（`46254d6`）、semantic diff drawer 取代 confirm 对话框（`ebf3931`，供 Apply 前变更审查用）。待办：Branding/Page/Repeated areas/Table columns/Locale/Data contract 这类工程师可视化编辑面板——目前 Raw JSON/CSS/HTML 编辑器仍是唯一入口 |
| E9 | P2 分页引擎演进 | ⬜ | PaginationSession、结构化 trace、性能预算（100 行 <2s、500 行 <5s）；硬约束：v1 ERP DOM 行为不变 |
| E10 | P3 发布治理 | ⬜ | 独立 SemVer、LICENSE、CHANGELOG、SW precache manifest 自动生成、模板目录 |
| E11 | 维护成本优化 | 🔶 | 已完成：v2 安全回归测试固化 + v1 mustache-lite 测试 + 修复 vitest 环境 localStorage 遮蔽问题（`4806408`，136 测试）、`examples/README.md` 演示页目录（`d78bd51`）、CI 增加 validate:v2 两试点 + 核心库/v1 冒烟 5 条（`4a0c5e0`）、PR 模板（待提交）、3 页分页黄金样本（待提交，Playwright 共 21 测试）。待办：文档 SSOT 持续治理（见 [ROADMAP.md](ROADMAP.md) 第 2 节） |
