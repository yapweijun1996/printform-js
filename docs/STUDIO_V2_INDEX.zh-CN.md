# PrintForm Studio v2 文档索引

> 产品状态：**Production Pilot**
>
> 目标用户：熟悉 ERP、HTML/CSS 与 JSON 的工程师
>
> Documentation authority follows responsibility, not language: SPEC owns Current behavior; the English production plan owns latest evidence/criteria; TASK owns execution status. README and Agent setup summarize and link to these sources.

> Current-source amendment (2026-09-10): the current build supersedes the older 567-test snapshot with `npm run doctor` 5/5, 106 files / 571 tests and 203 Service Worker entries. The reviewed Demo Gateway path remains supporting evidence only; direct-BYOK PI-04, platform/print and release acceptance remain open.

> **2026-09-09 direction correction**: implementation Partial; coding resumed; M1 bounded corrections, host-bound MCP/CDP admission, transaction-context binding, FormSpec component scope selection, canonical Undo/Redo revision alignment, old-bus lifecycle invalidation and the reviewed browser Demo Gateway session path are implemented, with PROD-01 01-01/01-02/01-03/01-04/01-05/01-06/01-07/01-08, PROD-02 02-01/02-02/02-03/02-04/02-05/02-06/02-07/02-08, PROD-03 03-01/03-02/03-03/03-04/03-05/03-06/03-07/03-08 and 13-04/07/08 now case-specific Passes, plus production-shell X-01..03, while PI/release acceptance remains open. The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) retains the policy direction. P0: 35 Pass (01-01/01-02/01-03/01-04/01-05/01-06/01-07/01-08/02-01/02-02/02-03/02-04/02-05/02-06/02-07/02-08/03-01/03-02/03-03/03-04/03-05/03-06/03-07/03-08/13-01/13-02/13-03/13-04/13-05/13-06/13-07/13-08/X-01/X-02/X-03), 0 Fail, and 0 Not run. The current `npm run doctor` passed 5/5 with 106 files / 571 tests (see [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md)); the prior 536-test standalone and 535-test doctor runs are historical. Other recorded evidence includes, 17/17 old-bus/commit-race controls, 30/30 focused transaction-context tests, 20/20 focused host-admission tests, 6/6 three-engine component-scope browser controls, 3/3 each for three-engine PROD-01 01-01 through 01-08 browser controls, 3/3 each for three-engine PROD-02 02-01/02-02/02-03/02-04/02-05/02-06/02-07/02-08 chat, Review, approval-provenance, mode-change, cancel/retry, duplicate/unknown-outcome, Auto-mode and host/prompt/export controls, 3/3 each for PROD-03 03-01 initial-readiness, 03-02 render-failure/retry, 03-03 review-lifecycle, 03-04 invalidated-evidence, 03-05 late-result, 03-06 candidate-separation, 03-07 save-independence and 03-08 surface-agreement controls, 6/6 final Provider/outbound browser controls, 6/6 three-engine Demo Gateway browser controls, 47/47 Chromium direct-gateway tests and 52 Firefox/WebKit direct-gateway passes with 10 expected skips. Runtime 1.0.0, Studio 0.11.0, Protocol 2.0.0, Agent Contract 4.0.0; 35 public commands. These results are not release approval.

## 状态词

- **Current**：仓库当前已经实现，并有相应测试或人工验证依据。
- **Target**：达到 Production Ready 前已经决定、但尚未全部实现的行为。
- **Backlog**：P1–P3 方向，不构成当前版本承诺。
- **Partial**: an implemented feature has unmet acceptance criteria.
- **Proposed**: a review recommendation, not an adopted product/default/platform change.
- **Historical**: a dated implementation or verification record, not a fresh result.

任何 Target 或 Backlog 内容都不得写入当前协议文档，或在 README 中描述为已经可用。

## 阅读顺序

| 目的 | 文档 | 权威范围 |
|---|---|---|
| Execute one step at a time | [Execution plan](STUDIO_V2_EXECUTION_PLAN.md), [TASK ledger](../TASK.md#sequential-execution-ledger) | 21 ordered packages, explicit dependencies and one live progress owner |
| Decide whether a step is Done | [Definition of Done](STUDIO_V2_DEFINITION_OF_DONE.md) | Five evidence gates; separate step delivery, P0 case closure and release approval |
| Start the next implementation task | [Goal Prompt](STUDIO_V2_GOAL_PROMPT.md) | Copyable execution instruction under 2000 characters with required Markdown references |
| Current gaps and acceptance | [Production plan](STUDIO_V2_PRODUCTION_PLAN.md) | 2026-09-09 evidence, PROD requirement IDs, dependencies and proposed layout |
| Priority acceptance cases | [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md) | 35 cases: 35 Pass (01-01/01-02/01-03/01-04/01-05/01-06/01-07/01-08/02-01/02-02/02-03/02-04/02-05/02-06/02-07/02-08/03-01/03-02/03-03/03-04/03-05/03-06/03-07/03-08/13-01/13-02/13-03/13-04/13-05/13-06/13-07/13-08/X-01/X-02/X-03), 0 Fail, and 0 Not run |
| Data classification and destinations | [Data policy](STUDIO_V2_DATA_POLICY.md) | PROD-13 Target: data classes, storage/sending rules, lifetime, transitions and mapping to eight acceptance cases |
| Agent output fields | [35-command table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md), [nested shapes](STUDIO_V2_AGENT_OUTPUT_SHAPES.md) | Implemented closed projections for the public gateway; browser/provider and full acceptance evidence remain Partial |
| Agent enforcement and migration | [Boundary plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) | M0 inventory retained; M1 case acceptance partially closed; M2/M3 acceptance Partial; M4/M5 incomplete |
| Embedded harness replacement | [PI Agent Harness plan](STUDIO_V2_PI_HARNESS_MIGRATION.md) | Frontend-only direct BYOK target; PI-00..03 retain isolated closure, PI-04/05 open. Start with [detailed handoff](STUDIO_V2_AGENT_HANDOFF.md) and [21 step worksheets](STUDIO_V2_STEP_CHECKLISTS.md); TASK owns live credit. Current production entry remains AGRUN. |
| 判断产品适用性 | [产品策略](STUDIO_V2_PRODUCT_STRATEGY.zh-CN.md) | 用户、非目标、指标、模板策略 |
| 理解当前单 HTML | [协议 v2](PRINTFORM_V2_PROTOCOL.zh-CN.md) | Current 文件结构、绑定与 runtime API |
| 理解 AI 与安全边界 | [信任与代理模型](STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md) | 六项 P0 信任闭环硬门（Current，代码已完成）与已评估未采纳的历史设想（Backlog） |
| 安排工程实施 | [工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) | P0–P3 依赖、接口和退出条件 |
| 执行发布验收 | [发布检查表](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md)、[本地 review packet 草案](STUDIO_V2_RELEASE_PACKET.md) | Pilot 检查、Production Ready 硬门与当前未批准的证据包 |
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
| UI/WebMCP/CDP 命令面 | Current/Partial | 共用同一 `CommandBus.execute`；Agent Contract **4.0.0**，35 个工具，含闭字段投影、会话引用、FormSpec、事务、诊断、证据与安全导出查询 |
| 嵌入式 AI Designer | Partial | Four-layer panel, cards, mode controls, batch history, session/settings/trace and resizable rail exist. Structured scope and shared Review/apply guards are implemented; full PROD-01/02/03 acceptance remains open. Human export remains required. |
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

### Current UI foundation

- Four-layer panel: Navigation → Document context → Conversation → Composer.
- Document title/revision/candidate badges, structured change cards and card-level Undo/Redo controls.
- Apply-mode selector; current default is auto-apply.
- Sessions drawer, Settings modal, collapsed trace, resizable rail, focus/tab handling and desktop export visibility.

### Partial behavior and pending work

- Selection starts as Entire document; the UI now maps available table and component choices to stable FormSpec IDs and the domain guard enforces the structured scope. Cross-entry/browser selection evidence and the complete matrix remain Partial (PROD-01).
- The context badge now maps render lifecycle and committed readiness to visible states; 03-01 through 03-08 initial, failure, timeout/retry, review-lifecycle, invalidated-evidence, late-result, candidate-separation, save-independence and five-locale surface-agreement browser evidence is a case-specific Pass. S10/PROD-08 now also passes its six-case overwrite, recovery, storage/privacy and file-outcome acceptance matrix; release-platform evidence remains separate.
- Review-generated repairs now consult the shared apply mode and auto-eligibility guard; all 02-01 through 02-08 chat/Review/apply/export cases pass in three engines, while later PROD/PI/release evidence remains open (PROD-02).
- The panel verifies an approval token before using a UI-owned `executeHuman` capability; page-global and ordinary bound-session gateways expose only `execute`. S07/PROD-02 acceptance is closed; arbitrary browser debugging is not treated as sandboxed.
- Raw draft protection and recovery are locally closed for S10/PROD-08: 08-01..06 pass across Chromium, Firefox and WebKit, with browser download reported only as started. S09/PROD-04 retains its six-case candidate/history lifecycle evidence.
- Card Undo/Redo now uses applied/reverted revision guards and leaves the card unchanged on a rejected result (PROD-04). Unknown/Real host classification now disables durable project snapshots and recovery writes before CommandBus installation; the dedicated reload and stale-context evidence passes, while remaining sink-transition evidence stays open (PROD-13).
- Main-app/server/gateway/WebMCP missing policy is restrictive Unknown, and an empty current policy invalidates old context; full sink and transition evidence is still required before PROD-13 closure.
- Independent Changes/history search and richer visible progress remain pending; S11 covers actionable Quality component targeting, S12 validates the retained current workspace including mobile/focus behavior, and S13 closes bounded v1/formatter maintainability in the isolated preview path.
- New Design/AI/Quality workspace and preview-first default are Proposed; current tabs/defaults are unchanged.
- See the production plan for multi-table limits, repeat-rule semantics, Quality navigation and release tasks.

## 成熟度规则

Production Pilot 可以用于受控试点，但工程师必须检查浏览器系统打印预览。当前 `npm run doctor` 为 5/5，106 个文件 / 571 个测试通过；三项静态 pilot validation、先前完整 Windows Playwright E2E 的 190/222 通过（32 个预期跳过、0 失败）、当前 bounded 36/36 组合浏览器控制、24/24 显式保存控制、6/6 接收方替换控制、6/6 scope/component 选择控制、重建后的 21/21 三引擎 Undo/Redo 控制和当前 Windows 四目标本地矩阵 88/88 均已留证。当前四目标矩阵只证明本地渲染/布局支持，不替代 direct-BYOK provider、系统打印或发布审批证据。此前长运行事务测试超时的 4/5 结果保留为历史证据。Production Foundation 与 E13-SERVER 已补齐 FormSpec、Active Table、多项确定性诊断、事务门、trusted export allowlist、Evidence Pack 和 SQLite durable backend；这些证据不代表所有发布门已关闭：

1. ✅ 候选项目在复用的可见预览 iframe 中执行真实分页渲染，`apply_changes` 命中同一 `candidateHash` 直接复用报告提交。
2. ✅ revision 永不复用；写操作用 `expectedRevision` + `candidateHash` 内容寻址天然防止旧预览被提交（未做破坏性两阶段提交，评估后判定当前机制已达成同等安全目标）。
3. ✅ Studio 签发几何指纹布局证据（`capture_layout_evidence`），Agent 不能自我声明证据（`complete_layout_review` 只接受 `evidenceIds`）。
4. ✅ Preview 消息验证目标 iframe + 跨 iframe reload 的单调请求 token（原「一次性 nonce」需求已并入此机制）+ revision 与 candidate hash。
5. ✅ Attestation 覆盖两段 runtime hash、CSP script hash、内容 hash 与由 evidence receipt 推导的真实浏览器凭证。
6. ✅ 自动检查内容数量、顺序、重复、遗漏、重叠、越界、对比度与重复区完整性。

**但这不等于 Production Ready**：该状态是对外承诺，由维护者显式宣布，不由代码硬门齐全自动推导。路线图 P0-B 退出条件还包含发布流程验收——两模板 × 四浏览器目标 × 全边界场景，已在 macOS 与 Linux（GitHub Actions Ubuntu runner）两个操作系统上各跑满 88/88 全过、零跨引擎分歧（见[浏览器矩阵验收记录](BROWSER_MATRIX.zh-CN.md)）；Windows current-source 本地 Chromium/Chrome/Firefox/WebKit 四目标也已 88/88，但仍只是支持性渲染证据，不是完整远程 release certification。Edge、Safari.app、real print chain 及已知 PROD 行为标准仍未关闭；现有硬门不能被 checkbox 豁免。自定义脚本仍可作为 `Untrusted` 草稿人工导出，但不能获得生产有效凭证。

## 稳定边界

- Real-data no-persistence is a requirement, not a complete current guarantee; see PROD-13.
- 单 HTML 继续是唯一事实来源，不增加 ZIP、sidecar schema 或必需构建步骤。
- Studio v1 继续冻结并并存，不自动迁移旧模板。
- AI 只参与设计与检查；导出 HTML 不依赖 AI、WebMCP 或 MCP。
- 最终输出依赖浏览器系统打印，不内置 PDF 引擎或云端 PDF 服务。
- 移动端只保证查看和数据渲染，不承诺一致打印分页。
