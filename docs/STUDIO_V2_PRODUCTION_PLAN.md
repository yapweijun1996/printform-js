# Studio v2 Production Plan

Last reviewed: 2026-09-07. Source baseline: `d2536999ae3edd3d94e315bb245ab94f8b74e65d` plus the uncommitted amendment snapshot.
This records the implementation in the current worktree and the evidence still required before release. No deployment, publish or real-provider test was performed.

## Authority and status

- Code and observable execution define Current behavior; [SPEC](../SPEC.md) describes it.
- This document owns the latest review evidence, requirement IDs and acceptance criteria.
- The [priority acceptance checklist](STUDIO_V2_P0_ACCEPTANCE.md) expands PROD-13/01/02/03 into 35 observable cases; all are Not run.
- The [data policy](STUDIO_V2_DATA_POLICY.md) owns PROD-13 classification, storage/sending destinations and transition rules; the host enforcement foundation is implemented and combined acceptance remains Partial.
- The [Agent output field table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) covers all 35 public commands with closed nested shapes and compatibility rules; the public gateway projection is implemented, with full command evidence still open.
- The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) owns enforcement placement, M0-M5 integration gates, client compatibility and failure/rollback handling; M0/M1/M3 foundations are implemented, M2 is Partial, and M4/M5 remain open.
- [TASK](../TASK.md) owns execution status; [EPIC](../EPIC.md) owns epic scope.
- [ROADMAP](../ROADMAP.md) and the [engineering roadmap](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) own sequencing.
- Current = implemented; Partial = some acceptance criteria remain unmet; Pending = not implemented.
- Target = required correction or established requirement, not available behavior.
- Proposed = a review recommendation, not an approved change to product defaults or supported platforms.
- Historical = dated evidence retained for traceability, not a new test run or current release certificate.
- Product maturity remains **Production Pilot**. Production Candidate describes bounded technical evidence, not general readiness.

## Current evidence

This evidence was collected from amendment snapshots after the authorized PROD-13/01/02/03
foundation changes. The worktree is still being changed by another Agent, so only the 80/428 unit run
is fresh for this documentation review; build, doctor and Chromium results are carried forward and must
be rerun after implementation settles. No deployment, publish, real business data connection or real-provider test was performed.
The 35-case P0 checklist remains Not run; these results are implementation and regression evidence,
not release approval.

| Check | Observed result | Limit |
|---|---|---|
| `npm test -- --run` | **Fresh review run:** 80 files / 428 tests passed | Existing coverage plus targeted boundary, embedded/WebMCP/CDP entry parity, catalog equality, CDP target replacement/reconnect, policy/session, compatibility, delayed-response, restrictive server-policy, commit-outcome and 35-command matrix tests; not the complete 35-case P0 record |
| `npm run build:site` | **Carried forward:** passed with the then-current 80/428 suite, Vite bundle and site artifact | Rerun after concurrent implementation completes; local build only, no deployment |
| `npm run doctor` | **Carried forward:** 5 steps / 0 failed | Rerun after concurrent implementation completes; no full browser matrix |
| `npx playwright test --project=chromium --workers=1` | **Carried forward:** 68/68 passed | Rerun after concurrent implementation completes; local Windows Chromium only, not the full browser/OS/print matrix |
| `npm run check` | Passed | Syntax of the built PrintForm bundle |
| Pilot `validate:v2` | Sales Invoice, Purchase Order and Progress Claim passed | Static result has `layout.verified: false`; browser evidence is separate |
| Public tool inventory | 35 contracts | Runtime 1.0.0 / Studio 0.11.0 / Protocol 2.0.0 / Agent Contract 4.0.0 |
| Touched-file syntax, line-limit and whitespace checks | Passed after the final prompt cleanup | Does not replace behavior or release acceptance |

Historical macOS/Linux 88/88 results remain in the [browser matrix](BROWSER_MATRIX.zh-CN.md).
No new full Windows matrix, real printer/Safari certification, live-provider reliability evaluation,
network vulnerability audit or HA/failover certification was performed in this review.
Passing AI E2E assertions do not certify every live model/provider outcome.
Historical 94/100 scoring is not a current release gate; use outstanding acceptance criteria instead.

## Architecture and existing work

| Responsibility | Current owner | Boundary |
|---|---|---|
| Public pagination API | `src/printform.js` | `PrintForm.format/formatAll`, legacy DOM compatibility |
| Page placement, repeated areas, PTAC/PADDT, N-up | `src/printform/formatter/` | Sole pagination engine |
| Standalone HTML envelope | `studio-v2/core/project-model.js` | Manifest/schema/i18n/theme/template/sample/FormSpec/runtime/attestation |
| Semantic component inspection and edits | `core/form-spec.js`, `core/operations.js` | FormSpec is inside the envelope; legacy adapter remains supported |
| Project revisions and transactions | `core/command-bus.js`, `core/transaction-service.js` | Preview, approval, content hash and revision checks |
| Candidate and committed rendering | `ui/render-controller.js`, `ui/preview.js` | One visible sandbox iframe; DOM is derived output |
| AI orchestration | `ui/agent-panel-runtime.js`, `ui/agent-runtime.js` | Calls the shared gateway; does not paginate |
| Storage | `core/durable-transaction-store.js`, `server/` | UI uses localStorage; separate SQLite service is single-writer |
| Export eligibility | `CommandBus.readiness()`, `ui/studio-actions.js` | Current render provenance + review + validation + human confirmation |

The canonical project envelope is the source of truth; committed state is owned by CommandBus.
The preview is the visual evidence surface, not an independently editable project model.
`dist/printform.js` and `dist/printform-document.js` are generated runtime outputs.

Current E14 work includes the four-layer AI panel, document title/revision/candidate badges,
structured change cards, apply-mode controls, card-level Undo/Redo controls, session drawer,
settings modal, collapsed trace, resizable rail, responsive/focus/tab handling and desktop export visibility.
These existing controls must not be described as entirely absent or as proof that all behavior is complete.

## Confirmed gaps and validation needs

| ID | Evidence and current behavior | Consequence |
|---|---|---|
| PROD-01 | `agent-scope.js` and transaction preview enforce the host scope at the domain entry; `agent-scope-options.js` maps UI table choices to stable FormSpec IDs and rejects ambiguous/global table effects; `agent-entry-parity.test.js` observes the same rejection through embedded, WebMCP and CDP | Scope enforcement and table selection foundation exist; full component selection and cross-document browser evidence remain incomplete |
| PROD-02 | `agent-boundary.js` applies one shared decision to chat and Review; Preview mode checks `humanApproval`, Auto mode accepts only the low-risk allowlist, and `agent-commit-resolution.js` resolves duplicate/lost Apply outcomes by transaction identity. However, `installAgentGateway()` exposes `executeHuman` on the page-global gateway and bound session objects; callers with arbitrary page/CDP execution can invoke the privileged path without passing through the UI approval-token check in `DesignerRuntimeController.applyProposal()` | First-party MCP/WebMCP catalogs do not expose this method, but trusted human-approval provenance is not established against arbitrary page/CDP execution. Keep PROD-02 Partial and close 02-03 with a private UI-owned capability or an explicitly narrower threat claim |
| PROD-03 | `agent-document-context.js` maps waiting/rendering/candidate/failed states and document validation to visible printability; `CommandBus.readiness().productionValid` remains authoritative for export controls | Browser evidence must confirm stale and delayed render states cannot show Printable or enable export |
| PROD-04 | Candidate tokens/cleanup exist. Stop marks the turn cancelled and drops late provider output; recovery-required cards do not offer Apply/Discard. Card Undo/Redo still calls global history without card-target/result checks | Exact card-target Undo and truthful history failure status remain incomplete |
| PROD-05 | `core/acceptance.js:countRows` and `core/runtime.js:maxArrayLength` use the maximum nested array length; two 400-row arrays report 400 | The row-limit metric does not represent aggregate bound table rows |
| PROD-06 | `core/operations.js:applyPaginationRule` accepts componentId but repeatHeader writes root `data-repeat-rowheader` | Component-shaped API changes a document-wide flag |
| PROD-07 | `ui/status-view.js` routes issue paths to source textareas and shows the first 30 issues; full page/component navigation is absent | Users cannot reliably move from every reported issue to the owning visual component |
| PROD-08 | `app.js` refreshes editors on committed changes; recovery is policy-gated and explicit discard is the only cleanup path; browser download still has no disk-completion receipt | Persistence failure, remaining delayed callbacks and download truthfulness still need verification |
| PROD-09 | Source editor is collapsible; current tabs are Designer/Quality/Agent; topbar reserves right-rail space | Proposed workspace reorganization is not current layout |
| PROD-10 | Chromium automation exists; full target release matrix and real print acceptance are incomplete | Green tests do not establish the final supported deployment promise |
| PROD-11 | This implementation split `ui/app.js`, `ui/agent-panel.js` and new boundary/projector modules; the touched files are within the 300-line rule, while the pre-existing `pagination-render.js` remains 389 lines | No new touched-file violation; the pre-existing renderer remains a separate refactor item |
| PROD-12 | Build/doctor generate and validate three pilots; `.github/workflows/ci.yml` explicitly static-validates only two; browser-matrix script covers Invoice/PO | Release evidence coverage differs between entry points |
| PROD-13 | The main app classifies before CommandBus/storage setup, and the server defaults to Unknown. Restrictive policies use volatile transactions, memory sessions, no recovery writes and restricted asset/provider media paths. However, standalone `installAgentGateway()` and `installWebMcpAdapter()` still create a Synthetic fallback when no host policy getter is supplied; `defaultPolicyForOptions()` also defaults missing policy to Synthetic. In addition, `isPolicyCurrent()` treats a missing current policy as current, while gateway context construction substitutes the old active policy when the getter returns empty | This contradicts the documented rule “missing policy is Unknown” and leaves adapter/no-active-document transitions fail-open. Keep PROD-13 Partial; require Unknown fallback and stale rejection for missing-policy transitions before M4 closure |

PROD-01/02/03/13 have implementation foundations but still carry acceptance gaps. PROD-04/08/10/12 and the P0 matrix also include failure scenarios
that still need reproduction. Do not claim all listed scenarios have already failed in production.

## Product decisions and proposed layout

Preserved requirements: one HTML envelope, one pagination engine, semantic Agent operations,
revision-bound approved transactions, real-data privacy, evidence checks and final human export.
Protocol remains 2.0.0; Agent Contract 4.0.0 is the intentional breaking change for closed projections, opaque references and boundary checks. No deployment or provider authorization is implied.

Recommended first release profile: a single engineer on Windows + a named Chromium browser,
local projects and self-contained HTML export, with declared paper/locale/template/data limits.
This is **Proposed**; existing broader desktop acceptance goals remain recorded until the maintainer
explicitly adopts a narrower release profile. Multi-user/HA work is required only for a release that promises it.

| Area | Proposed design | Acceptance |
|---|---|---|
| Global topbar | Full workspace width; document name, save state, Undo/Redo, print preview, export | Primary action remains visible with either side panel open |
| Preview | Dominant central area; fit-width/zoom, page navigation, candidate/committed label | Controls do not change print dimensions; visible content identifies its revision |
| Right panel | Design / AI / Quality, one active panel | Settings affect the selected component; existing Agent integration details remain accessible under Advanced |
| Document structure | On-demand FormSpec component tree | Tree, preview selection, property editor and AI target agree |
| Advanced source | On-demand HTML/CSS/JSON editor | Source round-trip and pending draft protection remain intact |
| AI panel | Navigation/context/conversation/composer; visible progress and change cards | Applying and Applied are distinct; Stop and pending approval remain accessible |
| Responsive | Resizable desktop rail, collapsed secondary tablet panels, Preview/Edit mobile switch | Keyboard/focus behavior, five locales, zoom and narrow screens pass; no mobile print guarantee |

Preview-first as the production default is **Proposed**. The current default remains auto-apply.
Any future auto-apply policy must use explicit operation/range eligibility plus existing validation gates.
An operation's catalog risk label alone is not proof that a batch matches user intent.

## Required logic and acceptance

### PROD-01: scope and selection

Map preview selection to stable FormSpec component IDs. Carry allowed targets/operations through
the request and enforce the boundary in the command/domain path, not only in model instructions.
Test edits inside/outside scope, whole-document operations, stale selection and imported legacy templates.
The current implementation enforces document/layout/theme/table/component scope at the command boundary;
do not claim the full selection matrix is complete until the acceptance cases are observed.

### PROD-02: apply policy

Use one policy decision for chat proposals, review repairs and retries. In preview-first mode no AI
path may advance the committed revision before human Apply. Test Review with a generated repair,
repeated repairs and cancellation. Preserve transaction ID/revision/hash/validation checks.
The embedded `studio-v2/agent-skills/printform-designer.md` is a runtime-loaded prompt and now
describes Preview approval plus explicit Auto eligibility. The complete delayed-response and
client-entry-point matrix remains required.

Amendment-review finding: the normal panel path verifies its approval token before calling the
privileged gateway, and the registered MCP/WebMCP tool catalogs expose only `execute`. The same
gateway object nevertheless publishes `executeHuman` on `window.PrintFormStudioAgent`, and bound
session objects retain that method. Therefore “human approval” is currently a host convention, not
an authorization boundary against arbitrary same-origin script or raw CDP execution. The smallest
complete correction is to keep the privileged capability inside the UI closure (or use an
unforgeable, single-candidate capability) and add a negative 02-03 test proving every Agent surface
can neither discover nor invoke it. If arbitrary page/CDP execution is intentionally out of scope,
state that limitation wherever human approval is claimed.

### PROD-03: state ownership

Derive UI state from committed revision, candidate identity, render lifecycle, readiness and save outcome.
Keep application, persistence and export eligibility separate. No-error static validation must not imply
current browser readiness. Test rendering, timeout, failure, stale review, Undo and successful rerender.

### PROD-04: candidate lifecycle

Verify Apply/Discard/return-to-current against one candidate ID/hash and base revision.
Test rapid requests, Stop, document replacement, delayed responses and double Apply.
Discard must restore committed output; stale output must not replace a newer view or commit twice.
Card Undo must verify the intended applied revision against the current head and report the actual command outcome;
it must not undo a later unrelated revision or label a failed history action Reverted/Applied.

### PROD-05 and PROD-06: multi-table semantics

Define per-table and aggregate limits from actual repeated bindings; do not blindly sum unrelated arrays.
Preserve render row-conservation checks independently of input size limits. Cover two 400-row tables,
nested repeats, empty tables and exact-limit boundaries. Current default is 500 rows / 100 logical pages;
1000-row test coverage does not increase the default supported limit.
For repeatHeader, explicitly choose document-wide API semantics or implement per-table behavior through
FormSpec, template projection and formatter. Record compatibility/migration implications before changing the contract.

### PROD-07 and PROD-08: quality and persistence

Quality must show blocking errors before warnings, explain next actions and navigate to the owning page/component/field.
Display incomplete review when AI is unavailable; allow editing and draft saving without relaxing trusted-export gates.
Distinguish source draft, applied project, recovery copy, file save and production export.
Verify editor refresh, import/switch, reload, quota failure, denied storage, picker cancellation/failure and download fallback.
Only a completed file write proves a file was saved; a browser download can only be reported as started.
Keep real-data recovery/persistence restrictions explicit; do not introduce silent caching or uploads.

### PROD-13: real-data classification and persistence

Use the [data classification and destination rules](STUDIO_V2_DATA_POLICY.md) for the detailed Target policy.
Unknown/Real document state is volatile except explicit artifact actions; preferences and credential vault have separate rules.
The review also identifies Agent result projections (revision/FormSpec/audit), same-origin Service Worker caching and asset URL requests as surfaces to verify; do not claim every listed disclosure scenario has been reproduced.

Treat unknown imports as potentially real before installing the project or exposing it to AI.
Apply the chosen privacy policy consistently to recovery, durable head/revisions/transactions, sessions,
Agent responses and evidence capture. Verify with synthetic canary values, never actual private data.
Real-data mode must prevent unauthorized persistent copies; explicitly handle pre-existing stored records
without silent deletion or an assertion that clearing one cache clears every store.
Current pixel rejection/redaction must remain. Test fresh import, mode switching, reload and storage inspection.

Amendment-review finding: the main app and server have restrictive defaults, but the adapter-level
fallback is inconsistent. A gateway or WebMCP install without a host policy currently creates a
Synthetic policy, and a temporarily missing current policy can be treated as unchanged. This is a
fail-open default at the integration boundary. Change the adapter contract so missing policy means
Unknown, and make an absent current policy invalidate queued Agent work. Preserve an explicit legacy
compatibility path only when the host deliberately opts into it; do not infer Synthetic from the
absence of configuration.

### PROD-09 through PROD-12: UX, maintainability and release

Validate the proposed layout with import/edit/review/apply/undo/save/reopen/export tasks before claiming UX completion.
Use existing performance budgets in the Chromium reference environment: 100 rows <=2s, 500 rows <=5s;
measure responsiveness separately. Add five-language, focus, keyboard, viewport and paper/print checks.
Split oversized JS by responsibility only during implementation, with pagination/transaction regressions preserved.
Align all three pilots across build, static validation, browser coverage and release records.
Publish the exact version, supported environment, known limitations, diagnostics, rollback and approval record.

## Dependency order and release blockers

| Stage | Tasks | Dependency / exit |
|---|---|---|
| Behavioral/privacy corrections | PROD-13 and PROD-01/02/03 | Existing FormSpec, gateway, CommandBus and render controller; cross-path behavior tests |
| Editing reliability | PROD-04/07/08 | Shared policy/state above; no silent overwrite, false save claim or stale candidate |
| Multi-table correctness | PROD-05/06 | Binding/formatter investigation; explicit limits and repeat-rule semantics |
| Workspace and maintenance | PROD-09/11 | Stable selection/state; validated layout and focused source refactors |
| Release certification | PROD-10/12 | Prior required fixes, adopted release profile, real print and failure-path evidence |
| Shared-service expansion | E15 | E13-SERVER foundation and explicit multi-user deployment scope |

No external access blocker prevents documenting or investigating the known local issues.
Production release remains blocked by unresolved behavior/privacy criteria and missing evidence for the selected release profile.
Platform/default-policy proposals await product adoption before being represented as release commitments.
HA/fencing/remote UI remain pending E15 work, not universal prerequisites for an explicitly single-user release.

## Completion rule

An implemented task needs its targeted behavior evidence, preserved regressions and synchronized status in TASK.
Historical E14 completion labels do not override the current partial findings.
Production Ready requires closed applicable criteria, recorded environment/print acceptance and maintainer release approval.
This implementation session changes application behavior within the authorized worktree; it does not deploy, publish or declare a production release.

## SCMC amendment review

- Simple: **WARN**. The shared boundary is compact, but two implicit privilege defaults make its behavior harder to reason about.
- Clear: **WARN**. Documentation previously described human approval and missing-policy behavior more strongly than the callable surface supports.
- Modular: **PASS**. Policy, projection, transaction and UI responsibilities are separated into focused modules.
- Consistent: **FAIL**. Main-app/server Unknown defaults conflict with gateway/WebMCP Synthetic fallbacks, and the UI-only approval claim conflicts with a page-global privileged method.
- Overall: **FAIL until the two boundary findings above are resolved or explicitly narrowed by an approved threat model**. The fresh 80/428 unit run proves covered behavior, not approval provenance or fail-closed missing-policy behavior.
