# EPIC.md — 史诗级工作项与状态

> 状态：✅ 完成 · 🔶 部分完成 · ⬜ 未开始。逐条任务见 [TASK.md](TASK.md)，时间线见 [ROADMAP.md](ROADMAP.md)。
>
> 最后核对：2026-07-31（对齐 `ef2b3d3`；E1–E7 全部完成，六项 P0 代码硬门齐；成熟度仍是 Production Pilot——见 E7 说明）。

| # | Epic | 状态 | 说明 / 证据 |
|---|---|---|---|
| E1 | 核心引擎稳定化 | ✅ | 分页引擎模块化拆分完成；2026-07-31 修复动态注入不执行、PADDT 克隆强制换页（`00e3b7f`）；100 个单测全绿 |
| E2 | Studio v1 加固并冻结 | ✅ | 结构模式索引对齐、XSS 加固、mustache-lite 严格化（`ebd5d20`）；此后**只修 bug 不加功能** |
| E3 | 构建/脚本健壮化 | ✅ | serve-site 防崩、SW 占位符断言、v2 校验器区分未签名与被篡改（`ebd5d20`） |
| E4 | Studio v2 安全闭环（第一批） | ✅ | 预览消息防伪造、opener 切断、原型污染防护、单调 revision、信任物理剥离（`1bc63d7`）；对应路线图 P0-A #2 与 P0-B #1 的 iframe 身份部分 |
| E5 | Agent / 开发者可观测性 | ✅ | WebMCP 标准注册、元素级 issues、质量门可点击、开发模式 SW 网络优先（`53d4a52`）、预览问题元素红框 overlay（`1dc2856`）、Apply 前并排 diff 面板（`ebf3931`，取代 window.confirm 文本） |
| E6 | P0-A 事务闭环 | ✅ | 单调 revision（`1bc63d7`）、operations 判别联合 schema 校验（`77d9722`）、候选项目在复用的可见预览 iframe 中真实渲染 + candidateHash 缓存（TASK.md #12+#13，含原 P0-B #15 nonce 需求，`f4ca539`）、Agent Contract 版本声明 1.1.0→1.2.0（TASK.md #14，向后兼容的次版本升级，非路线图原设想的破坏性 2.0 两阶段提交切换——就此分歧征询用户后确认范围，待提交）。P0-A 六项全部完成 |
| E7 | P0-B 信任闭环（证据体系） | ✅ | `event.source` 目标 iframe 校验、元素级越界/对比度定位、渲染内容数量+顺序+identity 完整性校验（`ROW_*` 四项）、重复区缺失+重叠检测（`535c58c`）、Studio 签发布局证据 receipt + Agent Contract 2.0.0（#18，`1e6cb3e`，证据形态经确认为几何指纹而非像素截图）、attestation 覆盖两段 runtime hash + CSP script hash + 真实浏览器凭证（#19，待提交）。原 nonce 需求（原 #15）已并入 E6/#12。**代码硬门全完成，但成熟度仍是 Production Pilot**——路线图 P0-B 退出条件含"两模板 × 四浏览器 × 全场景矩阵"这类发布流程验收，非代码可达成 |
| E8 | P1 工程师结构化工作流 | 🔶 | 已完成：高层语义工具第一批 `set_column_widths`/`set_font_scale`（`46254d6`）、semantic diff drawer 取代 confirm 对话框（`ebf3931`，供 Apply 前变更审查用）。待办：Branding/Page/Repeated areas/Table columns/Locale/Data contract 这类工程师可视化编辑面板——目前 Raw JSON/CSS/HTML 编辑器仍是唯一入口 |
| E9 | P2 分页引擎演进 | ⬜ | PaginationSession、结构化 trace、性能预算（100 行 <2s、500 行 <5s）；硬约束：v1 ERP DOM 行为不变 |
| E10 | P3 发布治理 | 🔶 | 已完成：LICENSE（MIT）、SW precache manifest 构建期自动生成（`eebcae1`）。待办：独立 SemVer + 兼容矩阵、CHANGELOG、GitHub Release 附试点导出、版本化模板目录 |
| E11 | 维护成本优化 | 🔶 | 已完成：v2 安全回归测试固化 + v1 mustache-lite 测试 + 修复 vitest 环境 localStorage 遮蔽问题（`4806408`，136 测试）、`examples/README.md` 演示页目录（`d78bd51`）、CI 增加 validate:v2 两试点 + 核心库/v1 冒烟 5 条（`4a0c5e0`）、PR 模板（`c081a91`）、3 页分页黄金样本（`c081a91`，Playwright 共 21 测试）。待办：文档 SSOT 持续治理（见 [ROADMAP.md](ROADMAP.md) 第 2 节） |
