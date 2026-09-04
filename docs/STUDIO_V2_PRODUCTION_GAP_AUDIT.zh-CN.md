# PrintForm.js / Studio v2 深度生产差距审计

> 审计日期：2026-09-04。范围：当前工作树的 PrintForm runtime、分页器、Studio v2、Protocol、JSON Pointer、导出、沙箱、WebMCP/MCP、测试、发布脚本及 AI Designer UX。
>
> 当前结论：**YES, WITH CHANGES — remain Production Candidate**（单 writer SQLite server、受控 Chromium、A4-like portrait/landscape；active-active/HA 与更广打印链未认证）。这不是所有浏览器、打印机和多用户服务的 Production Ready 声明。当前 readiness：**94/100**。

> **阶段复核（2026-09-04）**：58/100 是代码实施前 baseline；72/100 是 foundation 代码完成但运维门未关闭时的中间值；84/100 是 E12 运维门收口；89/100 是 E13 local durable foundation；94/100 是 E13-SERVER 受控部署验收后的平台评分。当前评分仍为 **94/100**：全量单测 70 files / 378 tests、doctor 5/5、三个 pilot 静态验证和 Chromium E2E 56/56 已复核。该分数只表示当前平台证据，不代表 AI Designer UX 已完成，也不代表无条件 Production Ready；active-active/HA、remote UI adapter、更广打印链和 E14 UX 仍有边界。

## 0.1 E13 Durable Transaction / Concurrency / Recovery（当前）

| 门 | 代码证据 | 结果 |
|---|---|---|
| Durable record | `core/durable-transaction-store.js` 持久化 head、revision snapshots、transactions、audit、evidence anchors | **PASS（local/offline + backend contract）** |
| State machine | `core/transaction-state.js` 拒绝非法迁移，含 `RECOVERY_REQUIRED`/`CONFLICTED` | **PASS** |
| Optimistic CAS | `compareAndSwapHead()`；two-session stale commit 返回 `REVISION_CONFLICT` | **PASS（memory/server adapter）；localStorage 仅顺序检查** |
| Lease | heartbeat/renew/release、expiry cleanup、new-id takeover | **PASS** |
| Crash recovery | failure injection at CAS-before / CAS-after；restart deterministic outcome | **PASS（unit evidence）** |
| Evidence anchor | artifact ↔ pack ↔ revision ↔ transaction ↔ FormSpec/preview/audit | **PASS** |
| Production multi-device | SQLite server backend、process kill/restart、network lost response/retry、双独立 session acceptance | **PASS（受控单 writer）；failover/active-active REMAINING** |

E13 新增 `get_transaction`、`list_active_transactions`、`renew_lease`、`takeover_transaction`、`recover_transaction`、`resolve_conflict`、`get_revision`、`get_audit_events`。E13-SERVER 新增 `studio-v2/server/sqlite-durable-backend.mjs` 与 bounded HTTP adapter；Agent 仍只能调用语义命令，不能获得 arbitrary database mutation；旧 `TransactionJournal` 保留为兼容镜像。全量为 **70 files / 378 tests**，E13 recovery 与 E13-SERVER 各 **8/8 PASS**。

## 0.2 Production Verification 收口（当前工作树）

| 门 | 证据 | 结果 |
|---|---|---|
| 真实浏览器 | Playwright `1.62.0` / Chromium revision `1234`；`npm run test:e2e -- --project=chromium` | **56/56 PASS** |
| Active Table | Valuation → Variation → Materials → Certification；每个表都跨页，续页只重复当前表头 | **PASS** |
| 数据规模 | 100 / 500 / 1000 行；重复运行 page count 与 page signature 一致，记录 render/pagination duration 与 browser error | **PASS** |
| Paper modes | A4 @ 96dpi portrait (794×1122) / landscape (1122×794)；纸张边界、margin、重复表头、无 clipping | **PASS** |
| Diagnostics | `ROW_TOO_TALL`、overflow、blank、active header、footer/page number、orphan/keep-together/signature/total split；每项含 page/component/size/reason | **PASS** |
| Evidence Pack | approved revision、FormSpec/runtime/preview/export hash、page count、validation/security、Chromium receipt、截图/JSON attachment | **PASS** |
| 安全与工具链 | nanoid 3.3.18；Windows doctor 5/5；70 files / 378 tests、build、AGRUN、3 pilot validate、diff check；audit 0 high 为历史记录 | **PASS（当前门已复核；audit 本轮未重跑）** |

本阶段还修复了真实回归：PTAC/PADDT continuation row 不应触发普通 `.prowheader` 缺失诊断；现在诊断只对普通 table rows 建立 active-table header 约束，并有单测护栏。Studio source editor/AI inspector 仍默认隐藏，既有 E2E 在需要时显式打开，不改变产品默认行为。

### 本阶段实施状态（以代码为准）

| P0 | 当前状态 | 代码与测试证据 |
|---|---|---|
| FormSpec / component registry | ✅ 基础闭环 | `core/form-spec.js`、可选 `pf-form-spec` 区块、legacy adapter、`get_form_spec/list_components/get_component`、`form-spec.test.js` |
| Active Table Context | ✅ 引擎与回归护栏 | `pagination-render.js` 按 `data-pf-table-id` 选择活动表头；`active-table-context.test.js` 与 `e2e/active-table-pagination.spec.js` |
| Pagination diagnostics | ✅ 基础诊断闭环 | `core/render-diagnostics.js` 覆盖 active header、`ROW_TOO_TALL`、blank、keep-together、footer/page number；`acceptance.js` 合并 overflow/geometry details |
| Agent transaction | ✅ fail-closed 基础闭环 | `CommandBus` 的 begin/preview/approve/apply/rollback、candidate content hash、`transaction-journal.js`；`production-foundation.test.js` |
| Trusted export security | ✅ strict allowlist | `content-security.js` 阻断危险标签、事件属性、JS URL、外联 asset；`exporter.js` 做 trusted preflight |
| Evidence Pack | ✅ artifact + journal 基础闭环 | `evidence-pack.js`、attestation embedded normalized export hash、localStorage journal、`get_evidence_pack` |

本阶段没有把 AI 放入分页热路径，也没有另造并行项目格式；未完成项明确列在“剩余发布阻塞”中。

## E14 AI Designer UX 现状（P0 已完成，P1/P2 Target）

当前已完成 E14 P0 交互重排与状态透明化。P1/P2 体验增强保留为后续 Target：

| 差距 | 当前事实 | 决定 / 验收方向 |
|---|---|---|
| IA 过载 | 约 420px panel 已经完成 4 层架构收敛 | ✅ E14 P0 已完成：固定 `Panel navigation → Context → Conversation → Composer`；抽屉式 Sessions 管理；Settings/History/Activity 按需打开 |
| 缺少 document context | 已建立实时 Document Context 区域 | ✅ E14 P0 已完成：动态连接 document、selection、scope、revision、render status 和 candidate/committed 状态 |
| proposal 结果不够结构化 | 已替换为结构化 Proposal/Change/Validation cards | ✅ E14 P0 已完成：卡片清晰展示 Target、可测量的 Before/After、Safety、Validation metrics 与卡片级 Batch Undo |
| apply policy 不够显式 | 已提供可见且可预测的 Apply mode 选择器 | ✅ E14 P0 已完成：显式展示 `Auto-apply safe changes` 与 `Preview before applying`；两者均通过既有 transaction gate |
| 历史概念重叠 | 会话、历史与活动分离 | 🔶 P0 已将 Session 收纳至抽屉式区域、History 保留为二级控制、Trace 采用折叠；P1 将进一步拆分独立 History/Changes view |
| 状态与编辑风险 | raw source draft 可能被状态刷新覆盖；桌面 topbar 的 Production export 需要继续做显式可见性检查 | 增加 draft dirty/overwrite guard、1440px export visibility E2E；P1/P2 规划项 |

E14 不改变单 HTML SSOT、FormSpec、PrintForm 分页、CommandBus、Agent Contract 3.0.0、Evidence Pack、real-data 隐私或人工 Production export 约束。完整目标和任务拆分见 [DESIGN.md](../DESIGN.md) §0.1、[SPEC.md](../SPEC.md) §3.7 和 [工程路线图](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) E14。

> 口径说明：仓库既有文档所称的“六项 P0 代码硬门”主要是候选 hash、revision、layout receipt、preview channel 与 runtime attestation 的信任闭环；本审计额外按 AI+ERP 生产目标检查 FormSpec、active table、事务、内容 allowlist 和可复核 Evidence Pack，两者不是同一组门。

## 1. 当前架构与 SSOT

```text
单 HTML / Project Model
  ├─ manifest + schema + i18n + themeCss + templateHtml + sampleData
  └─ Studio CommandBus / WebMCP / MCP / UI
       └─ clone project → operation → candidate preview
            └─ binding(JSON Pointer) → sandbox DOM → PrintFormFormatter
                 └─ logical/physical pages → inspectRenderedDocument
                      └─ review receipt → human export → self-contained HTML
```

| 层 | 当前实现 | 审计判断 |
|---|---|---|
| PrintForm runtime | `src/printform.js` 调用 `PrintFormFormatter`；formatter 按 section 测量、分页、页脚、PTAC/PADDT、页码和 N-up | 单表、传统 ERP 模板的确定性核心较成熟；布局仍依赖真实浏览器测量 |
| Studio project model | `studio-v2/core/project-model.js` 解析并序列化单 HTML；`canonicalProjectContent()` 对结构化区块和模板内容做 hash | **当前项目/交付物 SSOT 是单 HTML** |
| 编辑模型 | `CommandBus` 对 project clone 应用安全 semantic operation；可选 FormSpec/component registry 是 Agent 的语义编辑面，legacy source editor 仍可替换整段 JSON/CSS/HTML；预览 DOM 是派生物 | 没有对 rendered DOM 直接编辑；旧模板仍保留 `templateHtml` 投影，未声明 FormSpec 的文件走 legacy adapter |
| 数据绑定 | `data-pf-text/if/each/href/i18n` + JSON Pointer；文本使用 `textContent` | 声明式、安全边界清楚；未形成组件/字段注册表 |
| 质量门 | `validateProject()` + 浏览器 `inspectRenderedDocument()` + revision-bound evidence receipt | 已有 Pilot 级门禁；诊断字段还不足以成为 ERP 生产证书 |
| 适配器 | UI、WebMCP、第一方 CDP bridge 共用 `CommandBus.execute()` | 方向正确；WebMCP 是适配层，不应成为领域模型 |

### FormSpec 判断

现有 Protocol 可以继续作为**封装协议**，不建议另造 sidecar 格式。当前已在同一 envelope 增加可选 `pf-form-spec`；它承担 Agent 的 canonical semantic SSOT，单 HTML 仍是交付与兼容 SSOT：

- 当前交付 SSOT：`templateHtml + themeCss + schema + sampleData + optional FormSpec` 的单 HTML project。
- 当前 Agent SSOT：同一 Protocol envelope 内的可版本化 FormSpec/component registry；旧模板通过 legacy adapter 生成 inspection spec，未要求一次性迁移所有存量 HTML。
- AI 应修改 `spec` 和数据绑定，不应把渲染后的 `.printform_page` 或任意 DOM 当作事实来源。

## 2. 已经达到 Production Pilot 水平的部分

- 核心 formatter 已拆分为 pages、sections、row-types、PTAC、PADDT、render、finalize 等模块；已有 45 行、多页 header、PTAC/PADDT、N-up 和 500 行性能回归。
- `preview_changes` 在有浏览器 renderer 时会真实渲染候选；`candidateHash`、`expectedRevision`、stale revision 拒绝和 human export confirmation 已落地。
- Layout review receipt 会绑定 revision、candidate/base hash、scenario、coverage 和 layout fingerprint；AI 不能只靠自报浏览器/证据完成 review。
- JSON Pointer binding、文本 `textContent`、sandbox preview、双 runtime hash、CSP script hash、内容 hash 和 trusted/untrusted 区分是有价值的安全基线。
- 当前单测、协议 round-trip、Progress Claim/Purchase Order/Sales Invoice 样本验证与 AGRUN integrity check 能运行；三份 pilot export 的静态 `validate:v2` 当前均通过。
- 历史仓库记录的 browser matrix 为 2 个模板、88/88 格子通过；记录同时诚实说明 Chromium/Chrome 共用 Blink，Playwright WebKit 不等于 Safari.app，Windows 未覆盖。

## 3. 生产差距与风险（阶段开始 baseline；当前实施状态见本文顶部）

> 下表记录本阶段动手前的审计差距，保留用于解释 58/100 → 72/100 的变化；不要将其直接解读为当前代码状态。当前实现与仍未关闭的发布门以本文顶部、本阶段测试和 `TASK.md` 为准。

### P0：必须在 Production Ready 前关闭

| ID | 差距 | 代码证据 | 风险 |
|---|---|---|---|
| P0-FS | 没有 canonical FormSpec/component registry | `project-model.js` 的 canonical 内容包含 raw `templateHtml`；`design-state.js` 只读 page/table/assets | AI 只能可靠地改 selector/整段 HTML，难以比较组件、迁移模板或保证语义正确 |
| P0-ACTIVE-TABLE | 分页器没有 Active Table Context | `formatter/sections.js:35-43` 用全局 `querySelectorAll(ROW_SELECTOR)`，只有一个 `querySelector(".prowheader")`；`rendering.js:23-43` 重复同一个 row header | Table B 跨页时无法证明重复 B header，而不是重复第一个/全局 header；当前没有 Table A/B 回归测试 |
| P0-TXN | 事务字段和持久化提交缺失 | `history.js` 只有 memory-only、最多 50 entries；`apply_changes` 的 `expectedCandidateHash`/`requireValid` 是 optional | 直接调用 `apply_changes` 可在没有 preview hash 的情况下提交；崩溃/刷新后无法恢复 transaction、rollback 或审计链 |
| P0-VAL | 诊断不是 production-grade | `acceptance.js` 有 overflow、vertical overflow、row count/order、repeat-region、overlap；没有 `ROW_TOO_TALL`、component_id、available_height、建议动作、binding map、footer/page-number/keep-together/orphan-total 检查 | “valid” 不等于“每页可打印”；问题无法稳定定位到 ERP 组件/行/页 |
| P0-SEC | 导出不是严格 allowlist | `sanitizeExecutableContent()` 主要移除 script、on*、javascript URL；实测含 `<iframe>`、`<object>`、`onclick` 的 trusted project 仍返回 `productionValid=true` | hash/CSP 能证明文件未被篡改，但不能证明内容本身没有危险元素或外联请求 |
| P0-EVID | 没有独立、可持久化 Print Evidence Pack | receipt 存在 `CommandBus.evidenceReceipts` memory Map；attestation 有 hashes/summary，但不是完整检查清单与发布附件 | 无法在 CI、审批、事故复盘中独立验证 page_count、每项 gate、preview/artifact/runtime hash |

### P1：Pilot 扩展前关闭

- **语义 Agent API 不完整**：当前 18 个工具与 13 个 operation 仍以 `replace_template`、任意 selector `set_attribute/set_text` 为主；缺少 `get_form_spec`、`list_components`、`add/update/remove/move_component`、`bind_field`、`set_pagination_rule`、`get_page_diagnostics`、`compare_revision`、`rollback_revision`、`export_artifact`。
- **事务 policy 与代码不一致**：`agent-setup.json` 写着 mutation requires preview，但 domain bus 仍接受不带 `expectedCandidateHash` 的直接 apply；AI UI path 有 proposal approval，这不能代替所有入口的 invariant。
- **多表行数门限不正确**：`countRows()` 取嵌套数组最大长度；两个 400 行数组得到 400，而实际表行是 800。应按绑定 table/section 统计并保留总量。
- **Pilot 样本门不同步**：`build-site` 已输出 Progress Claim，但 `.github/workflows/ci.yml` 与 `scripts/browser-matrix.mjs` 仍只覆盖 Sales Invoice/Purchase Order；Progress Claim 也尚未进入多表、签名、总额和页面边界矩阵。
- **安全供应链与工具链**：`npm audit --audit-level=high` 当前报告 `vite → postcss → nanoid@3.3.16` 一项 high；`npm run doctor` 在 Windows 因 `spawnSync("npm")` 环境调用失败，直接 `npm run check:agrun` 则通过。
- **认证矩阵不足**：应分别认证 Chromium/Chrome、Edge、Firefox、Safari Desktop 的稳定版本、OS、纸张、DPI、Print-to-PDF 与 background graphics；不能把 WebKit 结果写成 Safari.app 证书，也不承诺跨引擎 pixel-identical。

### P2：规模化体验

- 设计辅助、模板 marketplace、更多 reusable component catalog、可视化编辑增强。
- 将 `pagination-render.js`（当前超过 300 行）继续按 page transition、row placement、diagnostics 拆分，但不能以结构重构替代功能门禁。
- 1000 行、极端变量高度图片、复杂签名/附件、A3/landscape 与更多税务/ERP locale 样本。

## 4. 目标架构

```text
FormSpec SSOT
  → transactional operation log
  → deterministic validator (static + browser layout)
  → PrintForm pagination engine
  → preview + page diagnostics
  → Evidence Pack
  → human approval
  → committed revision
  → allowlisted self-contained HTML

Studio Agent API
  ├─ WebMCP adapter
  ├─ MCP/CDP adapter
  └─ local UI adapter
```

建议扩展当前 Protocol，而不是建立第二个项目格式：

```json
{
  "spec": {
    "schemaVersion": "1.0",
    "document": { "type": "progress_claim", "paper": "A4", "orientation": "portrait", "margins": {} },
    "tokens": {},
    "sections": [{ "id": "valuation", "type": "DataTable", "components": [], "pagination": {} }],
    "bindings": {},
    "pagination": { "repeatHeader": true, "keepTogether": [], "pageBreaks": [] }
  }
}
```

语义组件首先映射到已有结构：`DocumentHeader→.pheader`、`DocumentMeta→.pdocinfo`、`DataTable→.prowheader + .prowitem`、`PageFooter→.pfooter*`、`SignatureBlock/TotalBlock→带 component id 的 keep-together section`。`templateHtml` 可作为编译产物和 legacy 输入，但必须能从 spec 重建并验证 hash。

## 5. 最小事务模型

```text
BEGIN EDIT → PATCH* → VALIDATE → PREVIEW → EVIDENCE/REVIEW → APPROVE → COMMIT
                                              └──────────────→ ROLLBACK
```

最小记录：`transaction_id`、`base_revision`、`working_revision`、`agent_id`、`changes[]`、`validation_result`、`preview_hash`、`created_at`、`committed_at`、`status`。不变量：

1. `apply/commit` 必须引用当前 transaction、current revision、approved preview hash 和 `requireValid=true`；缺任何一个就 fail closed。
2. 失败 patch 只能生成 candidate，不能替换 last-known-good revision。
3. commit 后保存 immutable revision diff 与 evidence/artifact hashes；rollback 是生成新 revision，不复用旧 revision number。
4. UI 的 memory undo 保留作便利功能；生产审计需要 IndexedDB/服务端可恢复的 transaction journal。

## 6. 安全的 Agent API 方向

保留现有 `get_capabilities`、`preview_changes`、`validate_project`、review tools 作为兼容层；新增 semantic domain tools：

`get_form_spec`、`get_data_schema`、`list_components`、`get_component`、`add_component`、`update_component`、`remove_component`、`move_component`、`bind_field`、`set_style_token`、`set_pagination_rule`、`validate_form`、`render_preview`、`get_page_diagnostics`、`compare_revision`、`commit_revision`、`rollback_revision`、`export_artifact`。

不得提供 `execute_javascript`、`set_inner_html`、arbitrary CSS execution 或任意 DOM mutation。raw template/theme operation 只留给 Advanced/legacy migration，并且不能直接获得 production commit 权限。WebMCP/MCP/local API 只做 transport、schema 和 auth adapter，安全 invariant 必须在 domain service 内重复执行。

## 7. 确定性 Validator 与 Evidence Pack

每个 issue 至少应为：

```json
{
  "code": "ROW_TOO_TALL",
  "severity": "error",
  "component_id": "valuation-row-23",
  "page": 4,
  "problem": "row exceeds available page height",
  "measured_height": 986,
  "available_height": 822,
  "recommended_action": "split text or move whole row to next page"
}
```

P0 checks：水平/垂直/纸张边界、row-too-tall、missing JSON Pointer、duplicate component id、broken binding、active-table header、footer/page number、blank page、table continuation、orphan totals、signature/total keep-together、external request、危险标签/属性/CSS、100/500/1000 行守恒。

Evidence Pack 应包含 `formRevision`、protocol/schema/runtime versions、documentType、pageCount、previewHash、artifactHash、runtimeHash、browser/OS/paper/DPI、每项 PASS/FAIL、diagnostics 与 attestation。mandatory FAIL 时 `commit_revision`/`export_artifact` 必须不可用。

## 8. 优先级、任务与验收标准

### P0

1. 为 legacy template 增加 Table identity 与 Active Table Context；先写 Table A/B continuation test，再改 formatter；必须证明 B 续页只重复 B header。
2. 在现有 Protocol envelope 加 `spec` v1、component IDs、binding registry、pagination rules；legacy adapter 输出同一语义 inspection。
3. 将 transaction/preview/evidence invariant 下沉到 CommandBus/domain service，禁止 direct apply 绕过 approved candidate。
4. 扩充 validator 与 issue schema；为 row-too-tall、keep-together、footer/page-number、binding/component/security checks 写失败样本。
5. 导出前做 HTML/CSS/URL allowlist sanitizer；trusted 只允许内联安全资产、无 script/iframe/object/embed/event handler/external request。
6. 生成持久化 Evidence Pack，并让 `validate:v2` 与 CI 读取同一 pack/manifest。

P0 完成定义：每项均有单测、真实 Chromium E2E、至少一个失败样本、CI gate；Progress Claim、Invoice、PO 至少各一份可追溯 pack。

### P1 / P2

- P1：semantic Agent API、revision diff/rollback、component library、3 pilot 全矩阵、依赖升级、Windows doctor 修复、A4/A3/portrait/landscape certification。
- P2：视觉设计辅助、模板库、advanced canvas（只有当 semantic workflow 不能覆盖实际需求时才评估）。

## 9. 测试矩阵

| 场景 | 当前证据 | 生产缺口/退出条件 |
|---|---|---|
| 单表分页/header/footer | `e2e/core-pagination.spec.js`、golden samples；新增 deterministic diagnostics | 真实 Chromium 运行仍需 OPS-PLAYWRIGHT；继续补 footer/page-number 精确断言 |
| PTAC/PADDT/N-up | golden E2E + segments/math 单测 | 保持回归；补变量高度与组合 footer/signature |
| 1/45/100/500 行 | Studio E2E 与历史 matrix | 加 1000 行、两个/多个 table 总量、极长单行 |
| Progress Claim | sample unit/round-trip/static validate、FormSpec legacy adapter 已有 | 纳入 CI/browser matrix；补 totals、variations、signatures、多表 |
| 安全导出 | hash/CSP/自包含 E2E、dangerous element/CSS/URL allowlist negative suite | 增加 CI artifact evidence 与 server-side attestation |
| Agent workflow | command-bus/agent/layout-review/production-foundation 单测；direct apply 已 fail closed；server-side durable transaction/CAS/recovery 已由 E13-SERVER 验收 | active-active/HA、remote UI store wiring、长期 cleanup |
| 浏览器 | Chromium revision 1234，56/56；历史 2 模板×88 cells，3 引擎记录 | 补 Edge/Safari.app/Windows/打印 PDF；Firefox/WebKit/真实 Safari/打印机链仍未纳入当前发布门 |

当前本地证据：全量单测 **70 files / 378 tests PASS**；E13-SERVER **8/8 PASS**；`npm run build:site`、`npm run check:agrun`、三份 pilot `validate:v2`、`git diff --check` PASS；真实 Chromium E2E **56/56 PASS**；`nanoid` lockfile 为 `3.3.18`；Windows `npm run doctor` 为 5/5 PASS。`npm audit --audit-level=high` 的 0 high 是最后已记录的历史结果，本轮未将未完成的网络命令当作新的 PASS。服务器证据 manifest 写入 `test-results/e13-server/server-acceptance.json`，CI 上传 `test-results/`。静态 `validate:v2` 仍不证明分页/字体/overflow，本次由真实 Chromium E2E 补上该证据。

### 本阶段之后的剩余发布阻塞

1. **E15 active-active/HA gate**：当前 SQLite 验收限定一个 writer service；仍需 leader/fencing 或外部 DB CAS、故障转移、备份恢复和多实例 kill-point 演练。
2. Studio UI 默认仍使用 localStorage/offline adapter；需要显式 remote-store wiring 后，再用两个真实浏览器/设备上下文验收端到端远程事务。
3. 更广认证仍未在本阶段完成：Firefox/WebKit、真实 Safari、真实打印机/PDF driver、Windows browser matrix；当前只承诺 Chromium reference runtime。

## 10. 迁移策略

1. **冻结现有 PrintForm engine contract**：先加入 Table A/B、row-too-tall、security negative tests，不改 PTAC/PADDT 算法。
2. **Protocol additive migration**：`spec` 可选；旧单 HTML 由 `legacyTemplate` adapter 读取，新的 semantic template 同时生成 HTML projection。
3. **Transaction first**：先把 current operation catalog 接入强制 preview/commit/rollback，再逐步把 raw operation 降权。
4. **Validator/Evidence second**：统一 issue schema、Evidence Pack、manifest/hash，CI 与 export 只消费一个证据对象。
5. **Semantic API/component library third**：组件库只覆盖 header/meta/table/summary/signature/footer 等 ERP 高频语义；不建立 pixel canvas。
6. **Pilot certification last**：三份 pilot、三引擎/真实浏览器、OS/打印设置分别记录；发布声明仍由维护者批准。

## 11. 明确不应改变的边界

- AI 不负责分页；分页、页码、重复表头和物理页由 PrintForm deterministic engine 负责。
- 不先重写 formatter，不引入第二套渲染器，不把 CSS 像素坐标当 SSOT。
- 不让 AI 执行任意 JavaScript、DOM mutation 或网络抓取；导出不依赖 AI/WebMCP/MCP 在线可用。
- 不承诺所有浏览器/打印机 pixel-identical；Certified、Best Effort、Preview Only 分层。
- 不因引入 FormSpec 就废弃可离线打开的 self-contained HTML；`spec` 必须与单 HTML envelope 共存并可验证。

## 12. 最终评分与决定

> 本轮综合复核分数为 **94/100**。真实 SQLite server、SQL CAS、server clock lease、幂等提交、process restart/network retry、Evidence registry、真实 Chromium、依赖安全和 Windows doctor 均有证据；扣分主要来自 active-active/HA、remote UI wiring 与更广浏览器/打印链认证。

| 维度 | 分数 | 说明 |
|---|---:|---|
| 核心单表分页与性能 | 88 | 多页、PTAC/PADDT/N-up、100/500/1000 行 Chromium 实测，未重写 engine |
| Studio candidate/revision/review | 93 | preview→validate→approve→apply、rollback、revision/hash/audit、lease/recovery、真实 server CAS/idempotency 已有；remote UI wiring 与 HA 仍缺 |
| AI semantic architecture | 82 | FormSpec/component registry 与 semantic gateway 已有；transaction API 已受限，仍需服务端部署边界 |
| ERP 多表/确定性诊断 | 84 | active table、row-too-tall、overflow、footer/page-number、keep-together 等有浏览器/单测护栏 |
| 导出内容安全 | 90 | strict allowlist、CSP/runtime/artifact hash、Evidence Pack、publish fail-closed |
| 发布与认证 | 88 | Chromium reference + 56/56、server acceptance 8/8、doctor PASS、历史 audit 记录、Evidence registry PASS；Firefox/WebKit/Safari/打印链与 HA 未认证 |

**最终答案：YES, WITH CHANGES — remain Production Candidate。** 现有架构可以继续推进受控 AI-assisted ERP printing；不需要重写 PrintForm.js，也不应让 AI 负责分页。当前可证明的是单 writer SQLite server、独立 HTTP sessions、真实 SQL CAS、server-time lease、restart/network retry 和 Evidence registry；扩大到 active-active、多实例、真实 remote UI browser flow 前，必须完成 E15 HA/fencing、远程 adapter 和更广打印链认证，并保留 human approval、Evidence Pack 和 fail-closed security gates。E14 先处理 AI Designer 的信息架构和交互透明度，不改变这些安全边界。
