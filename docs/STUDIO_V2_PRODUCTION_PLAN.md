# Studio v2 Production Plan

Last reviewed: 2026-09-08. Source baseline: `d2536999ae3edd3d94e315bb245ab94f8b74e65d` plus the uncommitted amendment snapshot.
The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) retains the policy direction. Coding has resumed and the [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md) records bounded corrections and fresh verification, including actual prompt delivery. Overall acceptance remains Partial. No deployment, publish or real-provider test was performed.

## Authority and status

- The [PI Agent Harness plan](STUDIO_V2_PI_HARNESS_MIGRATION.md) owns the selected browser-first, frontend-only BYOK runtime replacement and PI-00 through PI-05 gates. No Node.js/server runtime is required by that target. It is not implemented and does not close existing P0 acceptance gaps.
- Code and observable execution define Current behavior; [SPEC](../SPEC.md) describes it.
- This document owns the latest review evidence, requirement IDs and acceptance criteria.
- The [priority acceptance checklist](STUDIO_V2_P0_ACCEPTANCE.md) expands PROD-13/01/02/03 into 35 observable cases; the case register remains open until each record has its own evidence, even though the public command catalog now has dedicated all-35 dispatch coverage.
- The [data policy](STUDIO_V2_DATA_POLICY.md) owns classification, destinations and transitions; review-time M1 violations have bounded corrections, but complete lifecycle acceptance remains Partial.
- The [Agent output field table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) covers all 35 public commands with closed nested shapes and compatibility rules; the public gateway projection, seven-test all-35 dispatch matrix and focused high-risk shape tests are implemented, while P0 case evidence remains open.
- The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) owns M0-M5 gates; M0 inventory exists, M1 lifecycle case acceptance is partially closed, M2/M3 acceptance is Partial and M4/M5 remain incomplete.
- [TASK](../TASK.md) owns execution status; [EPIC](../EPIC.md) owns epic scope.
- [ROADMAP](../ROADMAP.md) and the [engineering roadmap](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) own sequencing.
- Current = implemented; Partial = some acceptance criteria remain unmet; Pending = not implemented.
- Target = required correction or established requirement, not available behavior.
- Proposed = a review recommendation, not an approved change to product defaults or supported platforms.
- Historical = dated evidence retained for traceability, not a new test run or current release certificate.
- Product maturity remains **Production Pilot**. Production Candidate describes bounded technical evidence, not general readiness.

## Evidence and current review limits

The aggregate evidence below is the historical pre-review baseline; fresh resumed runs live in the [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md).
It covers prior authorized foundation changes, not the complete current worktree. The direction review
used source inspection and isolated in-memory probes, not a new full regression run. The build path
retains serial testing; test totals are not substitutes for case-specific side-effect evidence.
No deployment, publish, real business data connection or real-provider test was performed. The 35-case P0
register now contains 8 Pass (13-01/02/03/04/05/06/07/08), 0 Fail, and 27 Not run. Earlier passed sequences remain evidence only for their recorded scope,
not release approval.

| Check | Observed result | Limit |
|---|---|---|
| `npm test -- --run --maxWorkers=1 --no-file-parallelism` | **Pre-review:** 86 files / 454 tests passed | Existing coverage plus storage-failure/save-state/card-history guards, service-worker shell-only caching, WebMCP missing-policy fail-closed behavior and restrictive session-index guards, targeted boundary, public/bound-session capability checks, embedded/WebMCP/CDP entry parity and Real-data diagnostic redaction, catalog equality, CDP target replacement/reconnect, policy/session, compatibility, delayed-response, restrictive server-policy, commit-outcome, recursive unknown-field canaries, null/malformed-input handling, delayed apply-mode snapshots, late render/candidate ownership guards and 35-command matrix tests; not the complete 35-case P0 record |
| `npm run build:assets` + `node scripts/build-site.mjs` | **Pre-review:** Vite assets, generated runtime and site artifact passed; `dist/printform.js` 99.75 kB / gzip 18.62 kB; service worker precache 150 entries | Local build only, no deployment |
| `npm run doctor` | **Pre-review:** 5/5 steps passed; 86 files / 454 tests, production build, AGRUN integrity and all three pilot validations passed | Local health check only; no full browser matrix or release approval is implied |
| Combined `npx playwright test --workers=1` | **Prior complete run:** 190 passed / 32 expected skips / 0 failures; Chromium 74/74, Firefox 58/58 applicable and WebKit 58/58 applicable. **Pre-review targeted run:** production boundary/candidate/apply-policy/PROD-13 54/54 across all three engines | Windows Playwright regression only; not Edge, Safari.app or the system print chain |
| `npm run check` | Passed | Syntax of the built PrintForm bundle |
| `npx playwright test e2e/studio-v2-p0-prod13.spec.js e2e/studio-v2-p0-prod13-persistent-sinks.spec.js e2e/studio-v2-p0-prod13-fresh-reload.spec.js e2e/studio-v2-p0-prod13-policy-race.spec.js e2e/studio-v2-p0-prod13-existing-records.spec.js e2e/studio-v2-p0-prod13-outbound.spec.js --workers=1` | **Pre-review:** 18/18 passed across Chromium, Firefox and WebKit | Dedicated 13-01 through 13-06 evidence; the outbound case includes Chromium CDP; no live provider or release certification |
| `npx playwright test e2e/studio-v2-recovery-boundary.spec.js e2e/studio-v2-session-policy.spec.js --workers=1` | **Pre-review:** 6/6 passed across Chromium, Firefox and WebKit | Supporting recovery/session evidence retained for 13-05; the dedicated existing-record case closes its cross-store/project inventory |
| Pilot `validate:v2` | Sales Invoice, Purchase Order and Progress Claim passed | Static result has `layout.verified: false`; browser evidence is separate |
| Public tool inventory | 35 contracts | Runtime 1.0.0 / Studio 0.11.0 / Protocol 2.0.0 / Agent Contract 4.0.0 |
| Touched-file syntax, line-limit and whitespace checks | Current resumed Studio v2 files are within 300 lines. The pre-existing modified `studio/studio.js` (1491 lines) remains a violation, not an authorized exception; the formatter is not modified in this worktree | Does not replace behavior or release acceptance |
| Earlier resumed serial unit run | **95 files / 497 tests passed** | Historical supporting evidence; it does not close the 35 P0 cases |
| Latest resumed serial unit run | **97 files / 504 tests passed** | Full unit evidence is current for this worktree; it does not close the 35 P0 cases |
| Current `npm run doctor` | **5/5 high-level checks passed**; the serial unit/build path and all three static pilot validators completed | Local health evidence only; it does not close the 35 P0 cases or authorize release |
| Current bounded browser controls | **36/36 composed**, **24/24 explicit-save**, and **6/6 recipient replacement** passed serially across Chromium, Firefox and WebKit | Supporting evidence only; full external-client, scope/apply/state, overwrite/recovery and all-35 acceptance remain open |
| Latest output/provider browser smoke | **27/27 serially passed** across Chromium, Firefox and WebKit; final Provider request bodies were inspected | Supporting evidence only; no live Provider, full external-client admission or all-35 acceptance |

Historical macOS/Linux 88/88 results remain in the [browser matrix](BROWSER_MATRIX.zh-CN.md); current Windows Playwright engine smoke is recorded separately there.
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
| PROD-01 | `agent-scope.js` and transaction preview enforce the host scope at the domain entry; malformed or incomplete host scopes fail closed instead of becoming document scope; `agent-scope-options.js` maps UI table choices to stable FormSpec IDs and rejects ambiguous/global table effects; project replacement resets the active UI scope while policy-only switching preserves it; `agent-entry-parity.test.js` observes the same rejection through embedded, WebMCP and CDP | Scope enforcement and table selection foundation exist; full component selection and cross-document browser evidence remain incomplete |
| PROD-02 | `agent-boundary.js` applies one shared decision to chat and Review; Preview mode checks `humanApproval`, Auto mode accepts only the low-risk allowlist, and `agent-commit-resolution.js` resolves duplicate/lost Apply outcomes by transaction identity. `installAgentGateway()` now keeps `executeHuman` only on the app-local UI session factory; the page-global gateway and ordinary bound sessions expose only `execute`, and the panel still verifies its proposal token before using the private session | The concrete public page/CDP bypass is closed by code plus gateway/Chromium negative checks. Keep PROD-02 Partial until the complete 02-01..02-08 evidence is recorded; arbitrary browser debugging is not claimed to be sandboxed |
| PROD-03 | `agent-document-context.js` maps waiting/rendering/candidate/failed states and document validation to visible printability; `render-controller.js` invalidates pending UI mutations and rejects stale render results; `CommandBus.readiness().productionValid` remains authoritative for export controls | Targeted browser evidence is green for locale/scenario transitions and iframe lifecycle; full state-composition and save/recovery acceptance remains open |
| PROD-04 | Candidate tokens/cleanup exist. Stop marks the turn cancelled and drops late provider output; recovery-required cards do not offer Apply/Discard. Applied-card Undo/Redo now binds to the applied revision, passes an expected revision and keeps the card unchanged on a rejected result | Full browser lifecycle evidence and pending Changes/history search remain incomplete |
| PROD-05 | `core/acceptance.js:countRows` and `core/runtime.js:maxArrayLength` use the maximum nested array length; two 400-row arrays report 400 | The row-limit metric does not represent aggregate bound table rows |
| PROD-06 | `core/operations.js:applyPaginationRule` accepts componentId but repeatHeader writes root `data-repeat-rowheader` | Component-shaped API changes a document-wide flag |
| PROD-07 | `ui/status-view.js` routes issue paths to source textareas and shows the first 30 issues; full page/component navigation is absent | Users cannot reliably move from every reported issue to the owning visual component |
| PROD-08 | `app.js` refreshes editors on committed changes; recovery is policy-gated and explicit discard is the only cleanup path; save state distinguishes saved, unsaved, cancelled, failed and download-started, and save races retain dirty state | Bounded quota/denied-storage, explicit-download, uncertain-close and policy-race controls pass 24/24 serially; browser download still has no disk-completion receipt and full overwrite/recovery evidence remains open |
| PROD-09 | Source editor is collapsible; current tabs are Designer/Quality/Agent; topbar reserves right-rail space | Proposed workspace reorganization is not current layout |
| PROD-10 | Chromium automation exists; full target release matrix and real print acceptance are incomplete | Green tests do not establish the final supported deployment promise |
| PROD-11 | This implementation split `ui/app.js`, `ui/agent-panel.js` and new boundary/projector modules; new v2 touched files remain within the 300-line rule. The legacy `studio/studio.js` and pre-existing `pagination-render.js` remain oversized files with only bounded compatibility edits in this worktree | No new v2 module violation; legacy file decomposition remains a separate refactor item |
| PROD-12 | Build/doctor generate and validate three pilots; `.github/workflows/ci.yml` explicitly static-validates only two; browser-matrix script covers Invoice/PO | Release evidence coverage differs between entry points |
| PROD-13 | Unknown import, restrictive adapters, closed projections and static-only caching exist. Resumed host/session fixes address R1-R3; current controls cover classification confirmation, delayed store admission, session CAS, recipient replacement, explicit save and actual panel/Provider isolation | Partial: 13-04/07/08 now have case-specific Pass evidence; remaining M1 destinations and broader M4 closure remain. Register is 8 Pass, 0 Fail, 27 Not run; preserve raw-output rejection, old records and explicit-file-only authorization |

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

Amendment-review finding — resolved implementation: the normal panel path verifies its approval
token before calling the privileged path, and the registered MCP/WebMCP catalogs expose only
`execute`. `installAgentGateway()` now creates the privileged `executeHuman` method only on an
app-local UI session delivered through a closure callback; `window.PrintFormStudioAgent` and
ordinary bound sessions do not expose it. Gateway unit coverage and the Chromium production-boundary
check confirm the public surface is absent. This is not a browser sandbox: hostile extensions,
arbitrary debugging and untrusted same-origin code remain outside the application boundary. The
complete 02-01..02-08 acceptance record therefore remains open.

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

Amendment implementation result: the main app, server, gateway and WebMCP now share the restrictive
default. A gateway or WebMCP install without a host policy creates an Unknown policy, and a temporarily
missing current policy invalidates queued Agent work. Preserve an explicit legacy compatibility path only
when the host deliberately opts into it; do not infer Synthetic from the absence of configuration.

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

- Simple: **PASS**. Retain existing host, gateway and domain/store owners; no new service or product mode is needed.
- Clear: **PASS for mapped lifecycle cases; remaining scope open**. Actual sink evidence now verifies the memory-only classification/status and delayed-write boundaries for 13-04/07/08; the complete destination inventory still requires evidence.
- Modular: **WARN (Medium)**. Host sample state, panel controls and session defaults independently influence classification; centralize that decision without rewriting canonical transactions.
- Consistent: **PASS for the corrected mapped paths; remaining acceptance open**. Imported provenance, session defaults/lifecycle and explicit-save boundaries now follow the retained data policy in their recorded cases.
- Overall: **Partial for current implementation conformance; no rollback or release authorization**. See [direction review](STUDIO_V2_DIRECTION_REVIEW.md). Continue with remaining destination, scope/apply/state and client acceptance while preserving canonical/revision/CAS/lease/hash/evidence semantics.
