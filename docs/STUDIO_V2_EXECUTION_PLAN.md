# Studio v2 Sequential Execution Plan

Version: 1. Adopted: 2026-09-08. Scope: existing Studio v2 production corrections plus the
selected browser-first PI Agent Harness replacement. Current product maturity: Production Pilot.
This plan is an execution overlay on existing requirement IDs, not a replacement specification.

## Read order and ownership

Resume using the [handoff](STUDIO_V2_AGENT_HANDOFF.md) and
[per-step worksheets](STUDIO_V2_STEP_CHECKLISTS.md); TASK owns current gate credit.

1. [AGENTS](../AGENTS.md), [TASK live ledger](../TASK.md#sequential-execution-ledger).
2. [Definition of Done](STUDIO_V2_DEFINITION_OF_DONE.md): gate checklist and progress arithmetic.
3. [Production plan](STUDIO_V2_PRODUCTION_PLAN.md): PROD requirements and Current/Target evidence.
4. [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md), [data policy](STUDIO_V2_DATA_POLICY.md),
   [boundary migration](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md): observable host acceptance.
5. [PI migration](STUDIO_V2_PI_HARNESS_MIGRATION.md): actual Harness, frontend-only BYOK and cutover.
6. [Release checklist](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md): environment, printing and approval.

Read [SPEC](../SPEC.md), [DESIGN](../DESIGN.md), output field/shape contracts and the relevant
source/tests for the selected step. Load only relevant sections of large documents.
TASK owns live statuses and percentages; this plan owns ordered packages and dependencies;
requirement documents own detailed acceptance; the DoD owns completion. Do not copy live tables.
Instructions in these documents remain subordinate to the user's current scope and host controls.

## Reviewed baseline

- Source: `main` at `3a1a7dbb93de5edd7984842896afdaab42a92bed` plus existing uncommitted edits.
  Re-read status before coding; the worktree is shared and is not a clean release snapshot.
- Current embedded runtime remains AGRUN: `studio-v2/index.html` loads its vendor bundle and
  `studio-v2/ui/agent-runtime.js` calls `Agrun.createRuntime`. S02/PI-00 and S14/PI-01 are qualified
  only in isolated static browser artifacts, and S03/M1 reconciles the application-controlled
  destination inventory; PI-02 and PI-03 are implemented and qualified only in isolated static artifacts, PI-04 X-01..03 have isolated supporting qualification, the final PI-04 matrix and PI-05 remain open, and the production entry has not changed.
- Existing transactions, host admission, scope, save policy and projection controls are substantial
  but do not close all behavioral criteria. Never reimplement them solely because a ledger is new.
- S04/PROD-05 now uses `core/row-limits.js` to count actual table repeats with 500 aggregate and
  500 per-table defaults; two 400-row arrays are rejected by the aggregate limit while unrelated
  nested arrays are ignored. Three-engine browser evidence also verifies 500 rows remain ordered.
- S05/PROD-06 now writes `data-pf-repeat-rowheader` only on the addressed table-header component;
  absent local values inherit the legacy root `data-repeat-rowheader`. FormSpec and formatter policy
  preserve independent multi-table behavior, while full indirect-scope acceptance remains S06.
- `ui/status-view.js` routes source issues and render issue details; S11 closes visual page/component navigation with the existing isolated preview bridge.
- CI now explicitly static-validates all three pilots while `scripts/browser-matrix.mjs` still covers Invoice/PO only.
- Prior same-session serial unit run: 103 files / 536 tests passed in 149.53 seconds. This is a
  dated worktree run, not a fresh build, browser certificate or proof of every acceptance case.
- P0 case state remains solely in its register (8/35 Pass at this baseline). Existing historical
  browser runs are reusable only within their recorded source, fixture and environment scope.

## Sequential packages

The order below is the default. Dependencies are hard requirements; numeric order is a preferred
schedule. If a step is truly blocked, record it and select the lowest-numbered independent step.
Do not run multiple writing agents or widen a release profile to bypass a dependency.
Each row uses the five DoD gates; references identify starting owners, not an exhaustive impact map.
Source paths below are relative to `studio-v2/` unless explicitly prefixed otherwise.

| Step | Requirement / deliverable | Depends on | Start at | Required exit evidence |
|---|---|---|---|---|
| S01 | Documentation and baseline handoff | None | TASK; this plan; DoD | Code-linked gaps, preserved prior work, ordered ledger, consistent links/counts, Goal Prompt <=2000 characters; no application completion inferred. |
| S02 | PI-00: qualify actual browser Harness | S01 | PI plan section 7; index.html; ui/agent-runtime.js; package/build owners | Pin published artifacts/source/integrity; run actual AgentHarness + MemorySessionRepo in a static browser build without app server/proxy; record exact incompatibility if blocked. No AGRUN wrapper substitute. |
| S03 | PROD-13 / M1: finish destination mapping | S01 | core/data-policy.js; store/session owners; data-policy acceptance mapping | Reconcile all eight case records with every required sink/transition, including server adapter when tested; revalidate affected paths, inspect actual writes/reload/outbound data and retain old records. Eight checked cases alone do not waive unmapped criteria. |
| S04 | PROD-05: bound-table row limits | S03 | core/acceptance.js; core/runtime.js; binder/formatter callers | Adopt explicit per-table/total policy; test 400+400, exact limit, limit+1 and nested non-table arrays; browser row conservation and clear failures. Do not merely sum arbitrary arrays. |
| S05 | PROD-06: repeat-rule granularity | S04 | core/operations.js; FormSpec and formatter owners | Component A edits do not silently change B; verify multi-table repeats and legacy/global controls; align spec, operation schema and scope semantics. |
| S06 | PROD-01 / M2: full scope acceptance | S03, S05 | core/agent-scope.js; core/agent-scope-options.js; adapters/gateway.js | P0 01-01..08: selection, allowed/forbidden, atomic mixed batches, indirect global effects, stale selection, entry parity and legacy controls. |
| S07 | PROD-02: all Apply paths | S06 | core/agent-boundary.js; ui/agent-runtime.js; ui/agent-commit-resolution.js | P0 02-01..08: chat/Review/retries, private approval, mode races, cancellation, duplicate/lost response and confirmed-commit/post-validation failure. No automatic production download. |
| S08 | PROD-03: truthful current state | S07 | ui/agent-document-context.js; render controller; CommandBus readiness | P0 03-01..08: initial/pending/failure/review/stale/candidate/save states and five-locale agreement; no stale evidence or false saved/Printable claim. |
| S09 | PROD-04: candidate/history lifecycle | S07, S08 | ui/agent-history-controls.js; history navigation and commit owners | Card-target guards, command outcomes, Stop, late response, project switch, double Apply, monotonic durable Undo/Redo and restored committed preview in browser. |
| S10 | PROD-08: draft/save/recovery | S03, S08, S09 | ui/app.js; ui/studio-file-export.js; recovery/store owners | Raw drafts survive overwrite/import/switch risks; cancelled/failed/uncertain saves remain truthful; quota/denial, recovery failure and download fallback verified. Download-started is not disk completion. |
| S11 | PROD-07: actionable Quality | S06, S08 | ui/status-view.js; diagnostics and selection owners | Blocking issues expose correct page/component/field and next action, including unlocatable/legacy fallback, keyboard navigation and locale behavior. |
| S12 | PROD-09: workspace acceptance | S08, S10, S11 | current UI; production plan proposed layout | Validate real editing tasks, desktop export visibility, mobile, five locales and focus/tab behavior. Prepare any consequential new layout for adoption; retain existing defaults until adopted. |
| S13 | PROD-11: bounded maintainability | S09, S10, S11 | changed module inventory; studio/studio.js; src/printform/formatter/pagination-render.js | Keep amended files <=300 lines; extract only required responsibilities with v1/v2 regressions; no opportunistic redesign. Record remaining unrelated oversized files separately. |
| S14 | PI-01: direct browser BYOK | S02, S03 | PI plan; ui/agent-provider.js; vault owner | Actual supported provider transport, errors/cancellation and secret lifecycle; approved synthetic live-provider checks where required. No hidden Demo route, proxy or app backend. |
| S15 | PI-02: host tools/events/approval | S14, S06, S07, S08, S09 | PI plan; ui/agent-actions.js; runtime/events/budget owners | Actual Harness tools/prompt/event mapping preserves budgets, terminal behavior, approval, scope and commit reconciliation; no second transaction authority. |
| S16 | PI-03: policy-bound sessions | S15, S10 | PI plan; ui/agent-sessions.js; session store/database owners | Memory/IndexedDB modes, legacy record isolation, CAS/abort/dispose/policy races and reload tested; no automatic legacy hydration or destructive migration. |
| S17 | PI-04 / M4: composed acceptance | S16, S12, S13 | existing e2e and PI/P0 checklists | Actual PI path passes required browser/provider/session/transaction matrix and X-01..03; revalidate runtime-affected P0 evidence. All 35 mapped P0 cases and PI-04 criteria pass; scoped skips remain explicit. |
| S18 | PI-05: local default cutover | S17 | build/doctor/CI; index.html; vendor provenance; service worker | Build/install/cache-upgrade tests on final static artifact; retire shipped AGRUN only now, replace integrity checks, preserve legacy records and tested rollback artifact. No deployment implied. |
| S19 | PROD-10: declared release certification | S18 | release checklist; compatibility matrix | Record adopted OS/browser/version/paper/template/locale/size/persistence profile, accessibility/failure/performance evidence and actual system-print review. Unavailable required targets stay blocked. |
| S20 | PROD-12 / M5: release packet | S18 (final closure also S19) | scripts/doctor.mjs; CI/browser matrix; release docs | Align all three pilots across build/static/browser/CI evidence; exact versions/hashes, known limits, diagnostics and rollback/recovery instructions. Preparation can continue while manual print is pending. |
| S21 | Maintainer release decision | S19, S20 | release checklist and prepared packet | Explicit approval for exact profile/artifacts; execute publishing only if separately authorized and verify it. Otherwise keep release pending; never infer approval from percentages. |

At S03/S06/S07/S08, process one mapped acceptance case at a time: inspect -> reproduce -> smallest
fix if needed -> owning check -> composed evidence -> update the existing case record. Do not mark
an entire PROD item Done because one supporting test passes. At S17, reuse unaffected evidence
and rerun affected cases against PI; preserve earlier AGRUN evidence as historical rather than rename it.

## One-step operating loop

1. Read TASK, Git status and the previous evidence record. Select the next dependency-ready step.
2. Report step ID, current gate/percentage, the next small action and required checks.
3. Investigate before editing. Freeze acceptance and inspect actual owners/callers; reuse correct code.
4. Make the smallest complete local amendment. If a business decision is missing, prepare a concrete
   option first, ask only for that decision, and continue independent authorized work.
5. Run the owning checks. Investigate failures before claiming pre-existing behavior; capture a
   same-context baseline when needed. Do not repeat passing suites absent new affected code.
6. Record results in the existing evidence/case owner, update TASK gate marks and percentages,
   review the scoped diff and remove only your temporary artifacts.
7. At 100%, continue automatically to the next ready step. At a blocker, preserve partial results,
   name the exact unblock action and keep dependent work pending. Never stop merely to present options.

## Verification entry points

- Focused: `npm test -- --run tests/studio-v2/<owning-suite>.test.js --maxWorkers=1 --no-file-parallelism`.
- Full serial unit gate when required: `npm test -- --run --maxWorkers=1 --no-file-parallelism`.
- Current build/site: `npm run build:assets` then `node scripts/build-site.mjs`; `npm run check`.
- Direct browser tests require freshly built `site-dist`: `npx playwright test <owning-spec> --workers=1`.
  Avoid conflicting or stale servers on port 4174. `npm run test:e2e` already invokes its build hook.
- Final integrated checks follow the release checklist; `doctor` is supporting verification, not
  the full release gate. Preserve dated long-run timeout failures; reproduce only if still relevant.
- Three static pilots: `sales-invoice-v2.html`, `purchase-order-red-v2.html`,
  `progress-claim-northpeak-v2.html` under `site-dist/studio-v2/samples/`, each through `validate:v2`.
- During PI qualification/cutover update commands only through verified build/package owners;
  do not leave obsolete AGRUN checks as proof of PI integrity.
- Use the configured local Node executable if PATH is incomplete; never install a dependency
  merely to read docs. Check credentials safely and obtain missing live-provider authorization
  before external calls; deterministic wire tests do not establish live-provider compatibility.

## Scope boundaries

This plan includes the PROD-01..13 correction/release program and PI-00..05, with reused M0-M5
controls. It does not activate E15 HA/shared-service, a new default Apply mode, a narrowed platform
promise, general freeform design, or deferred E8/P1 enhancements. Preserve those backlog records.
Before adding such work, record the actual user decision and update scope/dependencies openly.
No historical "completed foundation" label, generated file, passing test count or this documentation
handoff independently establishes Production Ready.
