# Studio v2 Production Plan

Last reviewed: 2026-09-07. Source baseline: `fb1a641450c2266a712a7b644b32609bea7c0e73`.
This is a documentation-only review; none of the pending behavior below was implemented.

## Authority and status

- Code and observable execution define Current behavior; [SPEC](../SPEC.md) describes it.
- This document owns the latest review evidence, requirement IDs and acceptance criteria.
- The [priority acceptance checklist](STUDIO_V2_P0_ACCEPTANCE.md) expands PROD-13/01/02/03 into 35 observable cases; all are Not run.
- The [data policy](STUDIO_V2_DATA_POLICY.md) owns PROD-13 Target classification, storage/sending destinations and transition rules; implementation remains Pending.
- The [Agent output field table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) covers all 35 public commands with closed nested shapes and compatibility rules; this is Target documentation only.
- The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) owns Target enforcement placement, M0-M5 integration gates, client compatibility and failure/rollback handling; all packages remain Pending.
- [TASK](../TASK.md) owns execution status; [EPIC](../EPIC.md) owns epic scope.
- [ROADMAP](../ROADMAP.md) and the [engineering roadmap](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) own sequencing.
- Current = implemented; Partial = some acceptance criteria remain unmet; Pending = not implemented.
- Target = required correction or established requirement, not available behavior.
- Proposed = a review recommendation, not an approved change to product defaults or supported platforms.
- Historical = dated evidence retained for traceability, not a new test run or current release certificate.
- Product maturity remains **Production Pilot**. Production Candidate describes bounded technical evidence, not general readiness.

## Current evidence

The following checks ran earlier in this review session on Windows, before this documentation amendment.
Application code has not changed since those runs. The full suites were not rerun for the documentation patch.
For this amendment, the documentation-dependent `tests/version.test.js` suite passed 4/4;
local document links, touched-file <=300-line limits, Markdown-only scope and diff whitespace were checked.

| Check | Observed result | Limit |
|---|---|---|
| `npm test -- --run` | 72 files / 385 tests passed | Only existing assertions are covered |
| `npm run doctor` | 5 steps / 0 failed | AGRUN integrity, unit/build:site and three pilot validations; no E2E |
| `npx playwright test --project=chromium` after doctor built the site | 60/60 passed | Windows Chromium; not the full browser/OS/print matrix |
| `npm run check` | Passed | Syntax of the built PrintForm bundle |
| Pilot `validate:v2` | Sales Invoice, Purchase Order, Progress Claim passed | Static result has `layout.verified: false`; not browser evidence |
| Public tool inventory | 35 contracts | Runtime 1.0.0 / Studio 0.11.0 / Protocol 2.0.0 / Agent Contract 3.0.0 |

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
| PROD-01 | `ui/agent-panel.js` only assigns `state.activeScope`; `ui/app.js` sets selection to `Entire document`; no execution consumer of activeScope was found | Scope is not an enforced edit boundary; component selection is incomplete |
| PROD-02 | `send()` checks applyMode, but `runLayoutReview()` calls `autoApplyPending()` without that check | Review-generated repairs can auto-apply while preview-first is selected; transaction checks still run |
| PROD-03 | `ui/agent-document-context.js` stores renderStatus but renders its badge from error/warning counts; app supplies validation rather than full readiness | The context badge can imply printability before current render/review completion |
| PROD-04 | Candidate tokens/cleanup exist. Card Undo/Redo calls global history; callbacks do not compare the card revision or inspect the command outcome before relabeling the card | Exact card-target Undo and truthful failure status are incomplete; cancel/stop/late-response scenarios still need verification |
| PROD-05 | `core/acceptance.js:countRows` and `core/runtime.js:maxArrayLength` use the maximum nested array length; two 400-row arrays report 400 | The row-limit metric does not represent aggregate bound table rows |
| PROD-06 | `core/operations.js:applyPaginationRule` accepts componentId but repeatHeader writes root `data-repeat-rowheader` | Component-shaped API changes a document-wide flag |
| PROD-07 | `ui/status-view.js` routes issue paths to source textareas and shows the first 30 issues; full page/component navigation is absent | Users cannot reliably move from every reported issue to the owning visual component |
| PROD-08 | `app.js` refreshes editors on committed changes; recovery is best-effort; downloadHtml has no completion receipt, yet export clears dirty/recovery state | Raw draft overwrite and persistence failure paths need verification; download initiation is not proof of a saved file |
| PROD-09 | Source editor is collapsible; current tabs are Designer/Quality/Agent; topbar reserves right-rail space | Proposed workspace reorganization is not current layout |
| PROD-10 | Chromium automation exists; full target release matrix and real print acceptance are incomplete | Green tests do not establish the final supported deployment promise |
| PROD-11 | `pagination-render.js` 389 lines, `ui/app.js` 310, `ui/agent-panel.js` 301 | These JS files exceed the repository's 300-line rule; no source refactor was done here |
| PROD-12 | Build/doctor generate and validate three pilots; `.github/workflows/ci.yml` explicitly static-validates only two; browser-matrix script covers Invoice/PO | Release evidence coverage differs between entry points |
| PROD-13 | `app.js:installBus` always injects localStorage; durable store writes full project snapshots. Real-data toggle clears recovery/session state, not durable storage. Import does not automatically enable the unchecked real-data checkbox | Real-data mode is not an end-to-end no-persistence guarantee; unknown imports can remain in synthetic mode |

PROD-01/02/03/05/06/13 and PROD-04 card-history behavior are code-confirmed gaps. PROD-04/08 also include failure scenarios
that still need reproduction. Do not claim all listed scenarios have already failed in production.

## Product decisions and proposed layout

Preserved requirements: one HTML envelope, one pagination engine, semantic Agent operations,
revision-bound approved transactions, real-data privacy, evidence checks and final human export.
No change to Protocol 2.0.0 or Agent Contract 3.0.0 is implemented by this plan.

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
Until complete, describe Scope as a UI choice without enforcement; do not promise selected-only editing.

### PROD-02: apply policy

Use one policy decision for chat proposals, review repairs and retries. In preview-first mode no AI
path may advance the committed revision before human Apply. Test Review with a generated repair,
repeated repairs and cancellation. Preserve transaction ID/revision/hash/validation checks.
The embedded `studio-v2/agent-skills/printform-designer.md` is a runtime-loaded prompt and still
describes an auto-apply host. Align it with the policy during authorized implementation, not this docs-only amendment.

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
This documentation amendment neither changes application behavior nor declares a production release.
