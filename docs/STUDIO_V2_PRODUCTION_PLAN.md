# Studio v2 Production Plan

Last reviewed: 2026-09-10. Source baseline: current application review commit `a4caf93857669e05d0d521567ecf5ab6f4389df5` (prior application baseline `e4302009e461ae398476ec63043c888cd19a07a`); documentation status is synchronized in the release packet.
The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) retains the policy direction. Coding has resumed and the [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md) records bounded corrections and fresh verification, including actual prompt delivery. Overall acceptance remains Partial. No deployment, publish or direct-BYOK Provider test was performed; the bounded Demo Gateway run is supporting evidence only.

## Authority and status

- The [PI Agent Harness plan](STUDIO_V2_PI_HARNESS_MIGRATION.md) owns the frontend-only direct BYOK target. PI-00..03 retain isolated closure; PI-04/05 remain open. P0 X-01..03 are closed by separate production-shell UI evidence, while isolated PI X-01..03 evidence remains supporting-only for PI acceptance. Follow [current handoff](STUDIO_V2_AGENT_HANDOFF.md); the embedded AGRUN Demo Gateway remains Current until qualified cutover, not the PI target.
- Code and observable execution define Current behavior; [SPEC](../SPEC.md) describes it.
- This document owns the latest review evidence, requirement IDs and acceptance criteria.
- The [priority acceptance checklist](STUDIO_V2_P0_ACCEPTANCE.md) expands PROD-13/01/02/03 into 35 observable cases; the current case register is closed at 35/35 with each record's own evidence; PI/provider and release evidence remain separate.
- The [data policy](STUDIO_V2_DATA_POLICY.md) owns classification, destinations and transitions; review-time M1 violations have bounded corrections, but complete lifecycle acceptance remains Partial.
- The [Agent output field table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) covers all 35 public commands with closed nested shapes and compatibility rules; the public gateway projection, seven-test all-35 dispatch matrix and focused high-risk shape tests are implemented, while the current 35-case P0 evidence is closed and PI/client migration remains separate.
- The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) owns M0-M5 gates; M0 inventory exists, M1 lifecycle case acceptance is partially closed, M2/M3 acceptance is Partial and M4/M5 remain incomplete.
- [TASK](../TASK.md#sequential-execution-ledger) owns live execution status/gate credit; [EPIC](../EPIC.md) owns epic scope. The [DoD](STUDIO_V2_DEFINITION_OF_DONE.md) owns the completion checklist and progress formula.
- [ROADMAP](../ROADMAP.md) and the [engineering roadmap](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) own milestones; the [execution plan](STUDIO_V2_EXECUTION_PLAN.md) orders the 21 bounded PI/PROD packages without changing requirement IDs.
- Current = implemented; Partial = some acceptance criteria remain unmet; Pending = not implemented.
- Target = required correction or established requirement, not available behavior.
- Proposed = a review recommendation, not an approved change to product defaults or supported platforms.
- Historical = dated evidence retained for traceability, not a new test run or current release certificate.
- Product maturity remains **Production Pilot**. Production Candidate describes bounded technical evidence, not general readiness.

## Current external Demo Gateway decision

The latest supplied OpenAI Gateway Admin/User Guide Reports Admin v0.1 was
reviewed against the current browser transport. The old browser assumption of a
private `/v1/*` Gateway key was incorrect. Current code uses `POST /demo/session`
without a key, keeps the returned short-lived `dmo_...` token in memory, and
sends it only to `/demo/v1/responses`; private `/v1/*` credentials remain
server-side. The detailed destination rules and agent instructions are owned by
[the data policy](STUDIO_V2_DATA_POLICY.md) and [the setup guide](../studio-v2/AGENT_SETUP.md).
The guide contains conflicting model examples (`demo-auto`/`demo-fast` versus
`gpt-5.4-mini`). A real browser session on 2026-09-10 received `200` from
`/demo/v1/models` and listed `demo-auto`, `demo-fast`, and the configured Demo
aliases. A live Studio request using `gpt-5.4-mini` then returned the redacted
`DEMO_MODEL_NOT_ALLOWED` `400` contract error before Provider dispatch. The
current default is therefore the confirmed public alias `demo-fast`; this
fix verifies model admission only and does not change release status.
Because the guide disables Provider tools, the embedded runtime now selects
provider-tool-free `envelope` mode for the Demo recipient and rejects
geometry-only SVG before transport; the host-side 35-command catalog remains a
separate local permission surface. BYOK remains on the existing native-tools
path.
A current-source real Chromium probe from the registered local origin reached `Printable`; `/demo/session` had no
Authorization and returned `201`, then two `/demo/v1/responses` requests returned `200` with the in-memory Demo-session
header. No raw token, credential or response body was retained and no Apply/export/delete action was performed. This is
supporting Demo reachability evidence only, not live direct-BYOK provider reliability, quota or retention.

## Evidence and current review limits

The aggregate evidence below is the historical pre-review baseline; fresh resumed runs live in the [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md).
It covers prior authorized foundation changes, not the complete current worktree. The direction review
used source inspection and isolated in-memory probes, not a new full regression run. The build path
retains serial testing; test totals are not substitutes for case-specific side-effect evidence.
No deployment, publish or real business data connection was used. A bounded Demo Gateway browser run is recorded as supporting evidence, not direct-BYOK Provider acceptance. The 35-case P0
register now contains 35 Pass (01-01/01-02/01-03/01-04/01-05/01-06/01-07/01-08/02-01/02-02/02-03/02-04/02-05/02-06/02-07/02-08/03-01/03-02/03-03/03-04/03-05/03-06/03-07/03-08/13-01/13-02/13-03/13-04/13-05/13-06/13-07/13-08/X-01/X-02/X-03), 0 Fail, and 0 Not run. Earlier passed sequences remain evidence only for their recorded scope,
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
| Touched-file syntax, line-limit and whitespace checks | S13/PROD-11 bounded extraction leaves the v1 composition entry, formatter adapter, helpers and all amended modules within 300 lines; unrelated oversized documents remain separately tracked | Does not replace behavior or release acceptance |
| Earlier resumed serial unit run | **95 files / 497 tests passed** | Historical supporting evidence; it does not close the 35 P0 cases |
| Prior resumed serial unit run before the Demo Gateway amendment | **102 files / 529 tests passed** | Historical supporting evidence; it does not close the 35 P0 cases |
| Current `npm run doctor` | **5/5 high-level checks passed**; **106 files / 571 tests**, production build and all three static pilot validators completed | Prior 535-test doctor and 536-test standalone runs are historical; this local result still does not close the 35 P0 cases or authorize release |
| Current bounded browser controls | **36/36 composed**, **24/24 explicit-save**, **6/6 recipient replacement**, **6/6 scope/component selection**, **3/3 each for PROD-01 01-01 through 01-08**, and **3/3 each for PROD-02 02-01 chat preview, 02-02 Review repair, 02-03 approval provenance, 02-04 mode changes, 02-05 cancel/retry, 02-06 duplicate/unknown outcome, 02-07 Auto-mode control and 02-08 host/prompt/export agreement** passed serially across Chromium, Firefox and WebKit | Supporting evidence only; S10/PROD-08 overwrite/recovery is now closed, while all-35 acceptance remains open |
| Host admission and direct-gateway browser migration | Focused unit/transport set **20/20**; Chromium direct set **47/47**; remaining Firefox/WebKit direct set **52 passed / 10 expected skips / 0 failures** | Compatibility/session boundary is implemented and evidenced; this does not close scope/apply/state, storage destinations or all-35 acceptance |
| Transaction context boundary | **30/30** focused unit tests and **33/33** updated Chromium/Firefox/WebKit boundary tests passed | Supporting evidence only; complete PI/client migration and release closure remain open; S10/PROD-08 is separately closed |
| Latest output/provider browser smoke | **27/27 serially passed** across Chromium, Firefox and WebKit; final Provider request bodies were inspected | Supporting evidence only; no live Provider or all-35 acceptance |
| Latest restrictive resource/operation/provider controls | **31/31 focused tests passed**; omitted asset/provider policies default to Unknown before fetch/send, strict Agent empty operation sets are rejected before transaction creation, and policy-bound Provider transport rejects stale context before send and after response delivery; the final Provider wire regression passed **6/6** across three engines | Supporting evidence only; PI/provider, external-retention and release gates remain open |
| Canonical history navigation | **45/45 focused unit tests** and **21/21 rebuilt E14/candidate browser controls** passed across Chromium, Firefox and WebKit; Undo/Redo keep the logical cursor while durable head, `get_revision`, project revision and CAS use fresh monotonic revisions. S09 04-01 and 04-06 add **3/3** actual card/stale-target and durable-reload browser evidence | Supporting history evidence is complete for S09; S10/PROD-08 is now closed, while PI/provider and release closure remain open |
| Old-bus lifecycle and commit race | **17/17 focused tests passed**; deactivated buses reject later writes and policy expiry during commit/history async work is rejected before CAS | Supporting evidence only; cross-document browser case closure and full PROD-01/02/03 acceptance remain open |
| Latest lifecycle/history browser regression | **48/48 passed** across Chromium, Firefox and WebKit; delayed policy/document results, Provider payload path, candidate history and E14 controls remain green | Supporting evidence only; no live Provider, deployment or release authorization |
| Recovery provenance browser regression | **6/6 passed** across Chromium, Firefox and WebKit; explicit recovery does not trust stored Real/Synthetic labels, restores under Unknown and adds no localStorage destination | Supporting M1 evidence only; broader PROD-13 user classification and provider/OS/deployment retention remain open |
| Current Demo Gateway transport regression | **28/28 focused Demo unit tests**, **6/6 public-gateway browser controls** across Chromium/Firefox/WebKit, **2/2 Chromium AI settings/locale controls**, current-source 13-07 **3/3**, and one real Chromium Studio probe with session **201** plus two Demo Responses **200** results; the e430-baseline Demo browser run passed session/models, design, layout review, seven media variants and privacy checks | Confirms the no-key `/demo/session` → provider-tool-free `/demo/v1/responses` path, restricted media projection and final request body; broad preview/media results are baseline supporting evidence because preview source assignment changed in a4caf93, and neither the live probe nor current 13-07 qualifies direct-BYOK PI-04 reliability/retention |
 | Latest PROD-03 readiness browser regression | **03-01 through 03-08 passed 3/3 each** across Chromium, Firefox and WebKit; the focused render/controller/CommandBus/context/status set passed **30/30**, the focused studio-file-export retry set passed **11/11**, UI i18n passed **7/7**, and the final serial unit run passed **106 files / 571 tests**. The site rebuild passed with the pinned PI-00 bundle at 823439 bytes and 203 service-worker precache entries | The 03-01..08 case matrix is closed; S10/PROD-08 is separately closed, while physical print/platform, direct-BYOK Provider and release approval remain open |
| Latest transaction HTTP error boundary | **4/4 focused tests**, **8/8** server transaction and **1/1** restrictive server-policy regression passed after the final control-code/status amendment; fixed recovery codes remain distinguishable | Handler projection evidence only; fatal-process handlers were source-reviewed. Deployed logs, WAL, backups and OS sinks remain open |
| Resumed doctor and browser verification | Doctor **5/5**, **104 files / 541 tests**, build and three static pilots; rebuilt Demo browser controls **6/6** across three engines | Doctor preceded the final server-only amendment, covered separately by 13/13 above. Earlier 103/537 evidence is historical; P0 status is unchanged |
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
| PROD-01 | `agent-scope.js` and transaction preview enforce the host scope at the domain entry; malformed or incomplete host scopes fail closed instead of becoming document scope; Theme/Layout/Table/Component operation categories are explicit, layout binding and cross-table component reassignment are rejected; table selectors must resolve to one semantic table identity, while `agent-scope-options.js` maps UI table and component choices to stable FormSpec IDs and rejects ambiguous/global table effects; project replacement resets the active UI scope while policy-only switching preserves it; the preview now annotates FormSpec IDs and the AI context consumes current selection tokens/revisions; source commits refresh scope options without resetting a valid selection; wrong target/category errors are projected as actionable scope messages; mixed operation arrays are rejected before transaction creation; effective repeatHeader output is verified against the legacy root default; scope-bound candidate approval returns `SCOPE_CHANGED` after a scope change; embedded, WebMCP, Chromium CDP and direct domain parity observes the same allowed/rejected decisions; the legacy sample resolves through `createLegacyFormSpec`, ambiguous selectors stay blocked under table scope, explicit whole-document selection passes the existing transaction/validation/private approval path, and component restrictions return after switching back; `e2e/studio-v2-scope-reset.spec.js` passes 6/6, and `e2e/studio-v2-p0-prod01-01.spec.js` through `e2e/studio-v2-p0-prod01-08.spec.js` each pass 3/3 across three engines | 01-01..01-08 are case-specific Passes; S06/PROD-01 scope acceptance and the current mapped P0 register are closed, while PI/provider and release gates remain open |
| PROD-02 | `agent-boundary.js` applies one shared decision to chat and Review; Preview mode checks `humanApproval`, Auto mode accepts only the low-risk allowlist, transaction records bind to document/policy/session context, and `ui/agent-commit-resolution.js` resolves duplicate/lost Apply outcomes by transaction identity. `installAgentGateway()` now keeps `executeHuman` only on the app-local UI session factory; the page-global gateway and ordinary bound sessions expose only `execute`, and the panel still verifies its proposal token before using the private session | Case acceptance is Done: the real chat-panel 02-01, Review-repair 02-02, approval-provenance 02-03, mode-change 02-04, cancel/retry 02-05, duplicate/unknown outcome 02-06, Auto-mode 02-07 and host/prompt/export 02-08 cases each pass 3/3 across Chromium, Firefox and WebKit. Later PROD/PI/release gates remain; arbitrary browser debugging is not claimed to be sandboxed |
 | PROD-03 | `agent-document-context.js` maps waiting/rendering/candidate/failed states and now requires `CommandBus.readiness().productionValid` before showing Printable; `render-controller.js` invalidates pending UI mutations and rejects stale render results while preserving the committed report during restore; the same readiness remains authoritative for export controls, and `app.js` re-derives it during UI locale refresh | 03-01..08 case acceptance is Done with three-engine evidence for iframe lifecycle, rendered-but-unreviewed blocking, review lifecycle, invalidated/late evidence, candidate/save independence, warning-only readiness and five-locale surface agreement; S10/PROD-08 and release gates remain separate |
| PROD-04 | Candidate tokens/cleanup exist. Stop marks the turn cancelled and drops late provider output; recovery-required cards do not offer Apply/Discard. Applied-card Undo/Redo now binds to the applied revision, passes an expected revision and keeps the card unchanged on a rejected result. Global history navigation preserves the logical cursor while assigning a fresh durable revision through CAS | S09 04-01 through 04-06 each pass 3/3 across Chromium, Firefox and WebKit for card target/result, candidate/Discard, Stop/late, rapid/double Apply, project replacement and durable reload/restore; focused history/card/runtime checks pass 42/42. The independent Changes/history search remains E14-UI-05/PROD-07; see [S09 evidence](STUDIO_V2_S09_PROD04_EVIDENCE.md) |
| PROD-05 | `core/row-limits.js` counts only actual table repeats; legacy `maxRows` is the aggregate limit and `maxRowsPerTable` is the per-table limit, both 500 by default. Binding keeps the all-repeat count separate from table-row conservation | S04 passes two 400-row tables (aggregate rejection), exact 500 and limit+1 boundaries, a 1000-row unbound nested array, and 500 rendered rows in order across three browsers; no remaining PROD-05 gap is claimed |
| PROD-06 | `core/operations.js:applyPaginationRule` resolves the addressed table-header component, records its `repeatHeader` override in FormSpec and writes only `data-pf-repeat-rowheader`; the legacy root `data-repeat-rowheader` remains the default | Component A no longer changes table B; non-table repeatHeader targets fail closed. Three-engine browser evidence covers independent A/B continuation and legacy root behavior |
| PROD-07 | `ui/status-view.js` merges category errors with render issue details, routes source paths to their owning textareas and exposes page/component/selector targets; `render-controller.js` and the isolated `preview.js` bridge enforce current revision/token navigation with keyboard and locale-safe labels | S11 07-01..02 pass **6/6** across Chromium, Firefox and WebKit; focused status/preview/controller checks pass **20/20**; unlocatable legacy fallback remains explicit. Independent Changes/history search is E14-UI-05 backlog |
 | PROD-08 | `app.js` refreshes editors on committed changes and now guards dirty HTML replacement; recovery is policy-gated and explicit discard is the only cleanup path; save state distinguishes saved, unsaved, cancelled, failed and download-started, and save races retain dirty state | S10 08-01..06 pass across Chromium, Firefox and WebKit; focused draft/save/recovery/runtime checks pass 9 files / 82 tests and the file-boundary matrix passes 15/15. Browser download still has no disk-completion receipt, so it remains started-only |
| PROD-09 | Source editor is collapsible; current tabs are Designer/Quality/Agent; topbar reserves right-rail space; current desktop/mobile/focus behavior is now composed-tested | S12 validates the retained current default; the alternative workspace reorganization remains Proposed and was not adopted |
| PROD-10 | Chromium automation exists; full target release matrix and real print acceptance are incomplete | Green tests do not establish the final supported deployment promise |
| PROD-11 | S13/PROD-11 split the frozen v1 composition entry and pagination render owners into bounded responsibility modules; all amended source files remain within the 300-line rule and browser regressions pass | No protocol/data-behavior change; unrelated oversized documents and release evidence remain separate. PI-01 direct transport is separately closed in its evidence |
| PROD-12 | Build/doctor and `.github/workflows/ci.yml` now validate all three pilots; browser-matrix script still covers Invoice/PO | Static CI entry alignment is corrected; browser/print/release evidence remains incomplete |
| PROD-13 | Unknown import, restrictive adapters, closed projections and static-only caching exist. Resumed host/session fixes address R1-R3; current controls cover classification confirmation, delayed store admission, session CAS, recipient replacement, explicit save and actual panel/Provider isolation | Partial: S03/M1 application-controlled destination inventory is reconciled to all eight case records, including the tested Synthetic server/error boundary; the current P0 register is 35/35 Pass, 0 Fail, 0 Not run after the production-shell X-01..03 cases. Broader M4, deployment and Provider/OS retention evidence remain open; preserve raw-output rejection, old records and explicit-file-only authorization |

PROD-01/02/03/13 have implementation foundations and their mapped P0 case records are closed; PI/provider, PROD-10/12 and external-retention release scenarios remain open. S10 closes the six PROD-08 draft/save/recovery cases locally and
S11 closes actionable PROD-07 Quality navigation within its declared scope; S12 closes the
retained current workspace acceptance; the alternative reorganization remains Proposed. Do
not claim all listed scenarios have already failed in production.

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
01-01 through 01-08 observe preview-to-FormSpec/context/AI-target agreement, an allowed source edit,
wrong target/category rejection, atomic mixed-batch rejection, indirect global-effect locality, stale
candidate/scope/document replacement handling, cross-entry adapter parity and legacy/whole-document control
in three engines. The PROD-01/S06 selection matrix is complete for these eight cases; the mapped P0 matrices are closed, while PI/provider and release matrices remain open.

### PROD-02: apply policy

Use one policy decision for chat proposals, review repairs and retries. In preview-first mode no AI
path may advance the committed revision before human Apply. Test Review with a generated repair,
repeated repairs and cancellation. Preserve transaction ID/revision/hash/validation checks.
The embedded `studio-v2/agent-skills/printform-designer.md` is a runtime-loaded prompt and now
describes Preview approval plus explicit Auto eligibility. The complete delayed-response and
client-entry-point matrix remains required.
After an Apply response confirms a commit, a failed validation/reporting follow-up must query the
same transaction before changing UI state. A confirmed committed transaction remains Applied with
validation unavailable; an unconfirmed outcome remains Recovery required. Do not retry or roll back
solely because post-commit response processing failed.

Amendment-review finding — resolved implementation: the normal panel path verifies its approval
token before calling the privileged path, and the registered MCP/WebMCP catalogs expose only
`execute`. `installAgentGateway()` now creates the privileged `executeHuman` method only on an
app-local UI session delivered through a closure callback; `window.PrintFormStudioAgent` and
ordinary bound sessions do not expose it. Gateway unit coverage and the Chromium production-boundary
check confirm the public surface is absent. The real chat-panel 02-01, Review-repair 02-02, approval-provenance 02-03, mode-change 02-04,
cancel/retry 02-05, duplicate/unknown outcome 02-06, Auto-mode 02-07 and host/prompt/export 02-08 cases
now pass 3/3 each across
Chromium, Firefox and WebKit; this is not a browser sandbox: hostile extensions,
arbitrary debugging and untrusted same-origin code remain outside the application boundary. This
completes the S07/PROD-02 case matrix; later PROD/PI/release gates remain open.

### PROD-03: state ownership

Derive UI state from committed revision, candidate identity, render lifecycle, readiness and save outcome.
Keep application, persistence and export eligibility separate. No-error static validation must not imply
current browser readiness. Document Context now requires current `readiness.productionValid`; a rendered
but unreviewed revision remains blocked, while non-blocking warnings may remain visible after a passing
review without disabling the human export gate. The context unit test passes 5/5 and the rebuilt E14
browser contract passes 12/12 across Chromium, Firefox and WebKit. This is supporting evidence only;
03-01 through 03-08 now have case-specific three-engine evidence; 03-07 also proves cancelled/failed/confirmed/download-started save outcomes and preserves a newer unsaved revision during a held close, while 03-08 proves five-locale surface agreement and current-readiness re-derivation after locale refresh. S10/PROD-08 now closes the bounded broader draft/recovery paths. Test rendering, timeout, failure,
stale review, Undo and successful rerender.

### PROD-04: candidate lifecycle

Verify Apply/Discard/return-to-current against one candidate ID/hash and base revision.
Test rapid requests, Stop, document replacement, delayed responses and double Apply.
Discard must restore committed output; stale output must not replace a newer view or commit twice.
Card Undo must verify the intended applied revision against the current head and report the actual command outcome;
it must not undo a later unrelated revision or label a failed history action Reverted/Applied.

S09 is closed at 100%: 04-01..06 each pass 3/3 across Chromium, Firefox and WebKit, and the focused
history/card/runtime set passes 42/42. The independent Changes/history search remains E14-UI-05 backlog;
all six case records are tracked in [STUDIO_V2_S09_PROD04_EVIDENCE.md](STUDIO_V2_S09_PROD04_EVIDENCE.md).

### PROD-05 and PROD-06: multi-table semantics

S04 defines per-table and aggregate limits from actual table repeated bindings; it does not blindly sum unrelated arrays.
`maxRowsPerTable` and aggregate `maxRows` default to 500, while the logical-page limit remains 100.
The three-engine evidence covers two 400-row tables, exact 500, limit+1, a 1000-row unbound nested array and
500 rendered rows in source order. Render row-conservation checks remain independent of input size limits.
For repeatHeader, S05 adopts a compatible table-header-local override through FormSpec, template projection and
formatter policy. An absent local override inherits the legacy root `data-repeat-rowheader`; an explicit local value
affects only that table. The full indirect-scope matrix remains under S06.

### PROD-07 and PROD-08: quality and persistence

Quality must show blocking errors before warnings, explain next actions and navigate to the owning page/component/field.
Display incomplete review when AI is unavailable; allow editing and draft saving without relaxing trusted-export gates.
Distinguish source draft, applied project, recovery copy, file save and production export.
Verify editor refresh, import/switch, reload, quota failure, denied storage, picker cancellation/failure and download fallback.
Only a completed file write proves a file was saved; a browser download can only be reported as started. Within one unchanged active document context, cancelled or failed trusted saves reuse the revision-bound prepared artifact so retry cannot create a conflicting evidence pack or falsely mark a newer revision saved.
Keep real-data recovery/persistence restrictions explicit; do not introduce silent caching or uploads.

S10/PROD-08 is closed at 100%: 08-01..06 pass in Chromium, Firefox and WebKit, with focused unit/runtime
evidence preserving canonical revision/CAS, Unknown/Real privacy, existing records and private human export;
browser download remains only a started outcome, with no disk receipt or release-platform evidence implied.

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

Use the [sequential plan](STUDIO_V2_EXECUTION_PLAN.md) for the executable order and hard dependencies: qualify PI-00 early, preserve PROD-13-first host enforcement, settle PROD-05/06 before final indirect-scope acceptance, then close workflow/PI composition before release certification. This table groups responsibilities rather than creating a competing live task order.

| Stage | Tasks | Dependency / exit |
|---|---|---|
| Behavioral/privacy corrections | PROD-13 and PROD-01/02/03 | Existing FormSpec, gateway, CommandBus and render controller; cross-path behavior tests |
| Editing reliability | PROD-04/07/08 | Shared policy/state above; no silent overwrite, false save claim or stale candidate |
| Multi-table correctness | PROD-05/06 | Binding/formatter investigation; explicit limits and repeat-rule semantics |
| Workspace and maintenance | PROD-09/11 | Stable selection/state; validated layout and focused source refactors |
| Release certification | PROD-10/12 | Prior required fixes, adopted release profile, real print and failure-path evidence |
| Shared-service expansion | E15 | E13-SERVER foundation and explicit multi-user deployment scope |

No external access blocker prevents documenting or investigating the known local issues. Production release remains blocked by unresolved behavior/privacy criteria and missing evidence for the selected release profile.
Platform/default-policy proposals await product adoption before being represented as release commitments. HA/fencing/remote UI remain pending E15 work, not universal prerequisites for an explicitly single-user release.

## Completion rule

An implemented task needs all five [DoD gates](STUDIO_V2_DEFINITION_OF_DONE.md), targeted behavior evidence, preserved regressions and synchronized status in TASK. Existing implementation earns no automatic acceptance or percentage; reusable evidence must cover the actual gate. Historical E14 completion labels do not override the current partial findings.
Production Ready requires closed applicable criteria, recorded environment/print acceptance and maintainer release approval. This implementation session changes application behavior within the authorized worktree; it does not deploy, publish or declare a production release.

## SCMC amendment review

- Simple: **PASS**. Retain existing host, gateway and domain/store owners; no new service or product mode is needed.
- Clear: **PASS for mapped lifecycle cases and the application-controlled destination inventory; remaining scope open**. Actual sink evidence verifies the memory-only classification/status and delayed-write boundaries for 13-04/07/08; provider, OS and deployment retention still require separate evidence.
- Modular: **WARN (Medium)**. Host sample state, panel controls and session defaults independently influence classification; centralize that decision without rewriting canonical transactions.
- Consistent: **PASS for the eight mapped paths and tested server boundary; remaining acceptance open**. Imported provenance, session defaults/lifecycle and explicit-save boundaries now follow the retained data policy in their recorded cases.
- Overall: **Partial for current implementation conformance; no rollback or release authorization**. S03/M1 closes the application-controlled map, not provider/OS/deployment retention or PI/M4 acceptance. See [direction review](STUDIO_V2_DIRECTION_REVIEW.md). Continue with scope/apply/state and client acceptance while preserving canonical/revision/CAS/lease/hash/evidence semantics.
