# PrintForm.js / Studio v2 深度生产差距审计

> Current review: 2026-09-07, baseline `fb1a641450c2266a712a7b644b32609bea7c0e73`. Product remains **Production Pilot / bounded Production Candidate**. This amendment is documentation-only.

> [Production plan](STUDIO_V2_PRODUCTION_PLAN.md) owns current evidence and PROD-01 through PROD-13 acceptance. Earlier session: 72 files / 385 tests, doctor 5/5, three static pilots and Windows Chromium 60/60 passed. E14 UI exists; scope, apply-policy and status semantics remain Partial.

> Scores 58/72/84/89/94 are historical stage assessments, not an updated readiness score. Sections 3–8 and 10 preserve the earlier proposal/baseline and must not be read as current APIs or new pending duplicates.

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

E13 新增 `get_transaction`、`list_active_transactions`、`renew_lease`、`takeover_transaction`、`recover_transaction`、`resolve_conflict`、`get_revision`、`get_audit_events`。E13-SERVER 新增 `studio-v2/server/sqlite-durable-backend.mjs` 与 bounded HTTP adapter；Agent 仍只能调用语义命令，不能获得 arbitrary database mutation；旧 `TransactionJournal` 保留为兼容镜像。Historical E13 acceptance recorded 70 files / 378 tests, including recovery/server suites at 8/8 each; current full-suite evidence is in the production plan.

## 0.2 Production Verification 收口（当前工作树）

| 门 | 证据 | 结果 |
|---|---|---|
| 真实浏览器 | Windows Chromium; built site; `npx playwright test --project=chromium` on 2026-09-07 | **60/60 PASS** |
| Active Table | Valuation → Variation → Materials → Certification；每个表都跨页，续页只重复当前表头 | **PASS** |
| 数据规模 | 100 / 500 / 1000 行；重复运行 page count 与 page signature 一致，记录 render/pagination duration 与 browser error | **PASS** |
| Paper modes | A4 @ 96dpi portrait (794×1122) / landscape (1122×794)；纸张边界、margin、重复表头、无 clipping | **PASS** |
| Diagnostics | `ROW_TOO_TALL`、overflow、blank、active header、footer/page number、orphan/keep-together/signature/total split；每项含 page/component/size/reason | **PASS** |
| Evidence Pack | approved revision、FormSpec/runtime/preview/export hash、page count、validation/security、Chromium receipt、截图/JSON attachment | **PASS** |
| 安全与工具链 | 72 files / 385 tests; doctor 5/5 including AGRUN/build/three pilots; bundle syntax passed | Existing suite PASS; no fresh network audit |

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

## E14 current findings: Partial

| Finding | Code evidence | Action |
|---|---|---|
| Selection and scope are not enforced | `agent-panel.js` only writes activeScope; app assigns Entire document | PROD-01: stable component IDs and command-level scope checks |
| Review ignores preview-first mode | `agent-panel-runtime.js:runLayoutReview` invokes autoApplyPending without a mode check | PROD-02: shared policy for chat/Review/retries |
| Context printability is incomplete | `agent-document-context.js` ignores renderStatus when rendering badges | PROD-03: derive truthful state from render/readiness |
| Candidate/history/draft/save acceptance | Card Undo calls global history without target/result checks; download is not a save receipt | PROD-04/08: correct history semantics and verify failure paths |
| Real-data persistence gap | localStorage is always injected; durable store serializes full projects; import does not enable real-data mode | PROD-13: classify before persistence and enforce policy across stores |
| Multi-table semantics differ from API expectations | Maximum array length; component repeat rule writes global root flag | PROD-05/06: explicit limits and repeat-rule granularity |
| Quality/layout/release coverage is incomplete | Source-path navigation, two explicit CI pilot validations, incomplete full print matrix | PROD-07/09/10/12; PROD-11 tracks oversized JS |

Already implemented: four-layer IA, structured cards, apply-mode controls, card-level Undo/Redo controls, Sessions drawer, Settings modal, collapsed trace, resizable rail, focus/tab handling and desktop export visibility.

Do not equate these controls with complete behavioral acceptance. The broader workspace/default-mode redesign is Proposed. Existing transaction, privacy, evidence and human-export requirements remain in force.

The earlier six trust gates, E12 foundation gates and the current PROD acceptance list are different scopes; completion of one does not complete the others.

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
| 数据绑定 | `data-pf-text/if/each/href/i18n` + JSON Pointer；文本使用 `textContent` | Declarative binding; FormSpec/component registry exists; selected-component UI enforcement remains incomplete |
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

## 4. Historical target architecture (not the current API)

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

## 5. Historical minimum transaction proposal

```text
BEGIN EDIT → PATCH* → VALIDATE → PREVIEW → EVIDENCE/REVIEW → APPROVE → COMMIT
                                              └──────────────→ ROLLBACK
```

最小记录：`transaction_id`、`base_revision`、`working_revision`、`agent_id`、`changes[]`、`validation_result`、`preview_hash`、`created_at`、`committed_at`、`status`。不变量：

1. `apply/commit` 必须引用当前 transaction、current revision、approved preview hash 和 `requireValid=true`；缺任何一个就 fail closed。
2. 失败 patch 只能生成 candidate，不能替换 last-known-good revision。
3. commit 后保存 immutable revision diff 与 evidence/artifact hashes；rollback 是生成新 revision，不复用旧 revision number。
4. UI 的 memory undo 保留作便利功能；生产审计需要 IndexedDB/服务端可恢复的 transaction journal。

## 6. Historical Agent API proposals

保留现有 `get_capabilities`、`preview_changes`、`validate_project`、review tools 作为兼容层；新增 semantic domain tools：

`get_form_spec`、`get_data_schema`、`list_components`、`get_component`、`add_component`、`update_component`、`remove_component`、`move_component`、`bind_field`、`set_style_token`、`set_pagination_rule`、`validate_form`、`render_preview`、`get_page_diagnostics`、`compare_revision`、`commit_revision`、`rollback_revision`、`export_artifact`。

不得提供 `execute_javascript`、`set_inner_html`、arbitrary CSS execution 或任意 DOM mutation。raw template/theme operation 只留给 Advanced/legacy migration，并且不能直接获得 production commit 权限。WebMCP/MCP/local API 只做 transport、schema 和 auth adapter，安全 invariant 必须在 domain service 内重复执行。

## 7. Historical validator/evidence proposal

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

## 8. Historical foundation priorities (superseded by PROD tasks)

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

## 9. Current evidence and remaining certification

| Area | Verified scope | Remaining scope |
|---|---|---|
| Pagination | Chromium core/golden/Active Table, PTAC/PADDT/N-up, 100/500/1000 rows | Multi-table limit policy; declared printer/font/paper combinations |
| Pilots | Three built/static-validated pilots; Progress Claim Chromium coverage | CI explicit static validation still lists two; full browser-matrix script covers Invoice/PO |
| Agent | Existing transaction/candidate/evidence/E14 E2E passes | Scope, cross-path preview-first, status and failure cases in PROD-01/02/03/04/08 |
| Runtime integrity | AGRUN/build/static hashes and existing negative tests pass | Fresh dependency audit and exact release artifact acceptance |
| Browser/print | Windows Chromium 60/60 on 2026-09-07; historical macOS/Linux 88/88 | Full Windows matrix, actual Safari/printer chain and selected release profile |
| Durable service | Existing SQLite single-writer recovery/CAS tests | Remote UI, HA/fencing/failover only for applicable shared-service scope |

No new full matrix, live-provider reliability certification, real print or HA test is claimed.
Static `validate:v2` reports `layout.verified: false`; it does not certify browser output.

### Release blockers

1. Correct scope/apply/status and multi-table semantics; verify candidate/draft/save/Quality criteria in the production plan.
2. Adopt the actual supported release profile and close its browser/print/recovery evidence. A proposed single-user profile has not silently replaced broader requirements.
3. For shared-service deployments, complete applicable E15 remote UI, recovery and concurrency acceptance. HA is not an automatic prerequisite for an explicitly single-user release.

## 10. Historical foundation migration strategy

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

## 12. Historical stage scoring and current decision

> Historical E13-SERVER stage score: **94/100**; not recomputed or used as the current release gate. 真实 SQLite server、SQL CAS、server clock lease、幂等提交、process restart/network retry、Evidence registry、真实 Chromium、依赖安全和 Windows doctor 均有证据；扣分主要来自 active-active/HA、remote UI wiring 与更广浏览器/打印链认证。

| 维度 | 分数 | 说明 |
|---|---:|---|
| 核心单表分页与性能 | 88 | 多页、PTAC/PADDT/N-up、100/500/1000 行 Chromium 实测，未重写 engine |
| Studio candidate/revision/review | 93 | preview→validate→approve→apply、rollback、revision/hash/audit、lease/recovery、真实 server CAS/idempotency 已有；remote UI wiring 与 HA 仍缺 |
| AI semantic architecture | 82 | FormSpec/component registry 与 semantic gateway 已有；transaction API 已受限，仍需服务端部署边界 |
| ERP 多表/确定性诊断 | 84 | active table、row-too-tall、overflow、footer/page-number、keep-together 等有浏览器/单测护栏 |
| 导出内容安全 | 90 | strict allowlist、CSP/runtime/artifact hash、Evidence Pack、publish fail-closed |
| 发布与认证 | 88 | Chromium reference + 56/56、server acceptance 8/8、doctor PASS、历史 audit 记录、Evidence registry PASS；Firefox/WebKit/Safari/打印链与 HA 未认证 |

**Current decision: remain Production Pilot / bounded Production Candidate.** Continue on the existing architecture. Close PROD-13 and PROD-01/02/03 first, then editing/multi-table and release acceptance. Use explicit requirements and observed evidence, not the historical score, to decide release readiness. E15 remains conditional on shared-service scope.
