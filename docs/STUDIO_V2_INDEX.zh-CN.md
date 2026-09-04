# PrintForm Studio v2 文档索引

> 产品状态：**Production Pilot**
>
> 目标用户：熟悉 ERP、HTML/CSS 与 JSON 的工程师
>
> 权威语言：中文；英文 README 与 Agent setup 只提供摘要和入口

> **2026-09-04 当前覆盖**：Production Foundation、E13-SERVER 与 E14 P0（AI Designer IA & Interaction Foundation）已完成代码基础。当前版本为 runtime `1.0.0`、Studio `0.11.0`、Agent Contract `3.0.0`、Protocol `2.0.0`；Agent 写路径必须经过事务化 `begin/preview → approve → apply → commit`，公共 `apply_changes` 不接受直接 `operations[]`。E14 P0 已实现 4 层 IA、真实 Document Context、结构化 Change Cards、可见 Apply mode 与卡片级 Batch Undo。详细证据与未关闭门禁见[生产差距审计](STUDIO_V2_PRODUCTION_GAP_AUDIT.zh-CN.md)。

## 状态词

- **Current**：仓库当前已经实现，并有相应测试或人工验证依据。
- **Target**：达到 Production Ready 前已经决定、但尚未全部实现的行为。
- **Backlog**：P1–P3 方向，不构成当前版本承诺。

任何 Target 或 Backlog 内容都不得写入当前协议文档，或在 README 中描述为已经可用。

## 阅读顺序

| 目的 | 文档 | 权威范围 |
|---|---|---|
| 判断产品适用性 | [产品策略](STUDIO_V2_PRODUCT_STRATEGY.zh-CN.md) | 用户、非目标、指标、模板策略 |
| 理解当前单 HTML | [协议 v2](PRINTFORM_V2_PROTOCOL.zh-CN.md) | Current 文件结构、绑定与 runtime API |
| 理解 AI 与安全边界 | [信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md) | 六项 P0 信任闭环硬门（Current，代码已完成）与已评估未采纳的历史设想（Backlog） |
| 安排工程实施 | [工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) | P0–P3 依赖、接口和退出条件 |
| 执行发布验收 | [发布检查表](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md) | Pilot 检查与 Production Ready 硬门 |
| 生产差距审计 | [深度生产差距审计](STUDIO_V2_PRODUCTION_GAP_AUDIT.zh-CN.md) | 当前实现证据、P0/P1/P2 差距、目标架构与迁移验收 |
| 架构与当前设计 | [DESIGN.md](../DESIGN.md) | 模块边界、数据流、当前实现和 E14 UX 决策 |
| 当前行为规格 | [SPEC.md](../SPEC.md) | 已实现的协议、命令、诊断、导出和 UI 行为 |
| Epic 与任务状态 | [EPIC.md](../EPIC.md)、[TASK.md](../TASK.md) | 已完成、待办、阻塞和验收证据 |
| 查版本与组合兼容性 | [兼容矩阵](COMPATIBILITY_MATRIX.zh-CN.md) | 四条独立版本线、各自 SSOT 与升 major 判据 |
| 配置 Codex/Claude | [Agent setup](../studio-v2/AGENT_SETUP.md) | Current MCP/WebMCP 接入步骤 |
| 维护旧 Studio | [Studio v1 设计](STUDIO_DESIGN.zh-CN.md) | Legacy v1，不是 v2 规范 |

## 当前能力快照

| 能力 | 状态 | 说明 |
|---|---|---|
| 自包含单 HTML | Current | 协议、样本、主题与两段 runtime 可封装在同一文件 |
| 声明式数据绑定 | Current | 使用 JSON Pointer；不执行表达式或业务公式 |
| Studio 静态 PWA | Current | 可部署到 GitHub Pages，并缓存最后成功的应用壳 |
| UI/WebMCP/CDP 命令面 | Current | 共用同一 `CommandBus.execute`；Agent Contract **3.0.0**，35 个工具，含 FormSpec、事务、诊断、证据与安全导出查询 |
| 嵌入式 AI Designer | Current | 4 层固定 IA（Panel navigation → Document context → Conversation → Composer）；真实状态绑定的 Document Context；结构化 Proposal/Change/Validation cards；可见且可预测的 Apply mode（Auto-apply / Preview first）；绑定的卡片级 Batch Undo；抽屉式会话管理；默认 own-gpt-server 公开网关与加密 BYOK vault；生产导出仍由人工完成 |
| 五语言打印内容与 Studio UI | Current | `en-MY`、`zh-CN`、`ms-MY`、`ja-JP`、`vi-VN` |
| 人工生产导出确认 | Current | AI/MCP 不能代替最终点击 |
| 单调 revision（undo 不复用） | Current | 2026-07-31 落地；过期写入稳定返回 `REVISION_CONFLICT` |
| 预览消息目标 iframe 校验 | Current | `event.source === contentWindow`；一次性 nonce 需求已并入候选渲染的请求 token 排序机制（不再单列为独立项）；candidate hash 已实现 |
| 元素级布局诊断 | Current | 渲染报告 issues 带页内 selector、页码与坐标，经 `validate_project` 暴露 |
| 候选项目真实分页 dry-run | Current | `preview_changes`/`apply_changes` 复用可见预览 iframe 做真实分页渲染（非仅内存校验+静态 diff），按 `candidateHash` 缓存渲染报告 |
| Studio 签发的布局证据 | Current | Studio 自测的**几何指纹**（`layoutFingerprint`）与可选 geometry-only SVG；synthetic mode 可选 bounded pixel raster + `pixelSnapshotHash`，real-data mode 硬拒绝像素，receipt 同时绑定 revision/`baseProjectHash` |
| 双 runtime 完整证明 | Current | `printformRuntimeHash`（分页引擎）+ 既有 document runtime hash + `cspScriptHashes`；`browsers` 由 evidence receipt 推导，非硬编码 |
| 内容顺序、遗漏与重叠证明 | Current | `ROW_COUNT_MISMATCH`/`ROW_DUPLICATE_INDEX`/`ROW_MISSING_INDEX`/`ROW_ORDER_MISMATCH`/`HEADER_MISSING`/`DOCINFO_MISSING`/`SECTION_OVERLAP` 全部落地 |
| FormSpec / Component Registry | Current | `get_form_spec`、组件列举/读取、binding 与 pagination rule；旧 HTML 由 legacy adapter 兼容 |
| Agent 事务与证据 | Current | `BEGIN → PREVIEW → APPROVE → APPLY → COMMIT`，持久 journal、Evidence Pack 与 trusted export allowlist |
| 工程师结构化面板 | Current | Table columns、Print font scale、Page settings、Repeated areas、Brand color、Data contract |

## 当前 AI Designer UX 边界

### Current（E14 P0 已落地）

- AI Designer 采用 4 层固定信息架构：`Panel navigation → Current document context → Conversation → Composer`。
- Panel navigation 提供精简导航，将 session 切换与删除收纳至抽屉式区域，避免挤占主会话界面。
- Document Context 动态连接活动文档、版本号（`r0`, `r1`...）、排版状态（`Printable`/`Blocked`）、状态模式（`Committed`/`Candidate`）、选区与范围选择器。
- 结构化 Proposal/Change/Validation cards 展示变更目标、可测量的 Before/After、安全标记与详细验证指标。
- 显式可见的 Apply mode 选择器（`Auto-apply safe changes` 与 `Preview before applying`）；严格复用既有 preview/approval/hash gate。
- 卡片级 Batch Undo 强绑定已提交的事务版本，支持直接撤销与重做；全局 Undo/Redo 作为二级兜底控制保留。
- Provider、Gateway、BYOK vault 和隐私设置默认位于 Settings modal；生产导出仍要求工程师最终点击。

### Target：E14 P1 / P2

- P1：History/Changes 独立抽屉与检索、动态 prompt、stream/error 状态进一步丰富、移动端全屏 chat、focus/tab 键盘可访问性深度打磨。
- P2：before/after 深度视图、preview 与 change card 双向高亮、可调整宽度的 side rail、视觉层级优化。
- 不把 AI hidden reasoning、技术日志或假 selection 显示为普通聊天内容。

## 成熟度规则

Production Pilot 可以用于受控试点，但工程师必须检查浏览器系统打印预览。2026-09-04 已验证全量单测 70 files / 378 tests、`npm run doctor` 5/5、三个 pilot 静态验证和 Chromium E2E 56/56。Production Foundation 与 E13-SERVER 已补齐 FormSpec、Active Table、多项确定性诊断、事务门、trusted export allowlist、Evidence Pack 和 SQLite durable backend；旧的历史验收数字保留作过程记录，不代表所有发布门已关闭：

1. ✅ 候选项目在复用的可见预览 iframe 中执行真实分页渲染，`apply_changes` 命中同一 `candidateHash` 直接复用报告提交。
2. ✅ revision 永不复用；写操作用 `expectedRevision` + `candidateHash` 内容寻址天然防止旧预览被提交（未做破坏性两阶段提交，评估后判定当前机制已达成同等安全目标）。
3. ✅ Studio 签发几何指纹布局证据（`capture_layout_evidence`），Agent 不能自我声明证据（`complete_layout_review` 只接受 `evidenceIds`）。
4. ✅ Preview 消息验证目标 iframe + 跨 iframe reload 的单调请求 token（原「一次性 nonce」需求已并入此机制）+ revision 与 candidate hash。
5. ✅ Attestation 覆盖两段 runtime hash、CSP script hash、内容 hash 与由 evidence receipt 推导的真实浏览器凭证。
6. ✅ 自动检查内容数量、顺序、重复、遗漏、重叠、越界、对比度与重复区完整性。

**但这不等于 Production Ready**：该状态是对外承诺，由维护者显式宣布，不由代码硬门齐全自动推导。路线图 P0-B 退出条件还包含发布流程验收——两模板 × 四浏览器目标 × 全边界场景，已在 macOS 与 Linux（GitHub Actions Ubuntu runner）两个操作系统上各跑满 88/88 全过、零跨引擎分歧（见[浏览器矩阵验收记录](BROWSER_MATRIX.zh-CN.md)），仅 Windows 尚未验证。这些硬门不得通过人工勾选绕过。自定义脚本仍可作为 `Untrusted` 草稿人工导出，但不能获得生产有效凭证。

## 稳定边界

- 单 HTML 继续是唯一事实来源，不增加 ZIP、sidecar schema 或必需构建步骤。
- Studio v1 继续冻结并并存，不自动迁移旧模板。
- AI 只参与设计与检查；导出 HTML 不依赖 AI、WebMCP 或 MCP。
- 最终输出依赖浏览器系统打印，不内置 PDF 引擎或云端 PDF 服务。
- 移动端只保证查看和数据渲染，不承诺一致打印分页。
