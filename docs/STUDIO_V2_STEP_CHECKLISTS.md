# Studio v2 Step Acceptance Worksheets

Use [execution dependencies](STUDIO_V2_EXECUTION_PLAN.md), [DoD](STUDIO_V2_DEFINITION_OF_DONE.md)
and [resume runbook](STUDIO_V2_AGENT_HANDOFF.md). [TASK](../TASK.md#sequential-execution-ledger)
alone owns live gate checkmarks/status/percentages. These reusable boxes are requirements,
not a second live ledger or a claim that completed work is unfinished.
Record evidence against every criterion in the owning step record; update gates only in TASK.
G1/G2/G3/G4/G5 = 10/40/30/15/5; cumulative credit is only 0/10/50/80/95/100%.
All steps preserve CAS, scope, privacy, private approval, old records and protocol compatibility.
Reuse historical passes only after checking source delta, environment and actual coverage.

## S01 — Documentation | dependencies: none

- [ ] G1: Inventory requirements, owners, existing work and release restrictions.
- [ ] G2: Link live ledger, sequential dependencies, DoD and continuation prompt.
- [ ] G3: Validate links/IDs, gate arithmetic, prompt <=2000 characters and files <=300 lines.
- [ ] G4: Reconcile counters, historical evidence and user-work preservation; no runtime pass inferred.
- [ ] G5: Synchronize handoff and TASK; name first unfinished dependency-ready step.

## S02 — PI-00 | dependencies: S01

- [ ] G1: Inspect pinned Harness provenance, browser entry, memory session and tool cycle.
- [ ] G2: Use actual AgentHarness in static frontend without app backend or Node runtime globals.
- [ ] G3: Check bundle/import boundary, pinned identity, deterministic tool cycle and abort.
- [ ] G4: Run actual Harness/memory session and cancellation in three configured browser engines.
- [ ] G5: Record isolated qualification limits; preserve current production entry; close PI-00.

## S03 — PROD-13 / M1 | dependencies: S01

- [ ] G1: Inventory DP-S/DP-T/DP-L sinks and all 13-01..08 cases against data policy.
- [ ] G2: Guard import, persistence, reload, mode races, outbound/save/error paths and existing records.
- [ ] G3: Test Synthetic permission and Unknown/Real denial including applicable server boundaries.
- [ ] G4: Observe browser storage/network for all eight cases using redacted synthetic evidence.
- [ ] G5: Update P0 records; distinguish app-controlled evidence from external retention/deployment.

## S04 — PROD-05 | dependencies: S03

- [ ] G1: Trace bound table repeats versus arbitrary arrays; freeze aggregate/per-table limits.
- [ ] G2: Enforce maxRows/maxRowsPerTable on actual repeated rows without reordering data.
- [ ] G3: Check 400+400, exact limit, plus-one, multiple tables and nested non-table arrays.
- [ ] G4: Verify browser rendered counts/order and actionable aggregate/per-table rejection.
- [ ] G5: Record schema/runtime agreement and compatible treatment of unrelated arrays.

## S05 — PROD-06 | dependencies: S04

- [ ] G1: Trace table-header ownership, root legacy fallback and schema/operation consumers.
- [ ] G2: Implement table-local override with root flag retained as compatible default.
- [ ] G3: Check FormSpec/operation round-trip and missing/true/false override values.
- [ ] G4: Toggle table A without changing B; observe actual pagination and legacy fallback.
- [ ] G5: Record scoped compatibility and close requirement without global flag regression.

## S06 — PROD-01 / M2 | dependencies: S03, S05

- [ ] G1: Freeze 01-01..08; trace selection identity, admission and indirect effects.
- [ ] G2: Enforce allowed scope atomically for batches, stale contexts and all supported adapters.
- [ ] G3: Test allowed/forbidden operations, indirect globals, stale selection and no partial writes.
- [ ] G4: Exercise entry parity, legacy and whole-document controls in required browser cases.
- [ ] G5: Bind eight P0 records to current revision evidence; preserve private scope ownership.

## S07 — PROD-02 | dependencies: S06

- [ ] G1: Freeze 02-01..08; map chat/review/retry, approval token and commit outcome owners.
- [ ] G2: Unify Apply/reconciliation without exposing human approval or automatic export.
- [ ] G3: Check cancel, duplicate/lost response, mode race, post-commit validation and retry.
- [ ] G4: Observe host/prompt/export agreement and private candidate-bound human confirmation.
- [ ] G5: Update eight P0 cases and truthful uncertain-commit evidence without approval bypass.

## S08 — PROD-03 | dependencies: S07

- [ ] G1: Freeze 03-01..08 across context/render/quality/save states and visible surfaces.
- [ ] G2: Project authoritative readiness and refresh after locale/state changes.
- [ ] G3: Check matrix, stale/error/not-ready states and five locale projections.
- [ ] G4: Observe enabled actions and current composed readiness, not stale flags.
- [ ] G5: Update eight P0 cases; distinguish render-ready from permission to export.

## S09 — PROD-04 | dependencies: S07, S08

- [ ] G1: Freeze 04-01..06; trace canonical revision, candidate and durable history owners.
- [ ] G2: Preserve monotonic undo/redo, discard, late Stop rejection and project-switch isolation.
- [ ] G3: Check double Apply, stale revision, candidate lifecycle and durable restore contracts.
- [ ] G4: Run six cases in three engines including project replacement and reload/restore.
- [ ] G5: Reconcile S09 evidence/TASK without history deletion or revision rollback shortcut.

## S10 — PROD-08 | dependencies: S03, S08, S09

- [ ] G1: Freeze 08-01..06: draft/import/overwrite, cancel, error, uncertainty and recovery.
- [ ] G2: Preserve canonical CAS and truthful saved/downloaded outcomes.
- [ ] G3: Check quota/storage failure, import validation, uncertain outcome and last-known-good data.
- [ ] G4: Run six composed cases in three engines including persistence/reload and cancellation.
- [ ] G5: Reconcile S10 evidence; retain existing records, privacy and explicit download semantics.

## S11 — PROD-07 | dependencies: S06, S08

- [ ] G1: Map issue kinds to source fields, visual pages/components and missing-target fallback.
- [ ] G2: Route Quality issues to authoritative targets without scope or hidden state changes.
- [ ] G3: Check mappings, fallback, keyboard focus and locale behavior.
- [ ] G4: Observe actionable source/visual navigation and understandable browser feedback.
- [ ] G5: Record S11 evidence; do not turn every warning into an export blocker.

## S12 — PROD-09 | dependencies: S08, S10, S11

- [ ] G1: Confirm adopted current layout; proposed reorganization is not automatically authorized.
- [ ] G2: Reuse workspace controls and preserve editing/save/quality/export interactions.
- [ ] G3: Check responsive layout, focus, five locales and existing state contracts.
- [ ] G4: Run six real workspace cases across three engines including mobile layout.
- [ ] G5: Record retained-layout acceptance; leave unadopted alternatives outside closure.

## S13 — PROD-11 | dependencies: S09, S10, S11

- [ ] G1: Trace studio/studio.js and pagination-render.js callers and frozen v1 boundaries.
- [ ] G2: Extract bounded owners without changing formatter/v1 contracts.
- [ ] G3: Check amended files <=300 lines, focused formatter/v1 regressions and required build.
- [ ] G4: Verify composed pagination/studio compatibility after extraction.
- [ ] G5: Review scoped diff/S13 evidence; unrelated oversized files are separate work.

## S14 — PI-01 | dependencies: S02, S03

- [ ] G1: Map actual pi-ai adapters, provider/error/cancel matrix and secret lifecycle.
- [ ] G2: Use browser-direct BYOK without app proxy/backend or automatic Demo fallback.
- [ ] G3: Check credential handling, cancel/errors and deterministic transport adapter cases.
- [ ] G4: Run isolated actual-adapter browser cases; label live HTTPS provider evidence separately.
- [ ] G5: Record isolated PI-01 scope; this does not certify final live-provider matrix.

## S15 — PI-02 | dependencies: S14, S06-S09

- [ ] G1: Trace actual Harness tools/events, budgets, terminal actions and host approval.
- [ ] G2: Preserve safe event projection, sequential terminal guard and commit resolution.
- [ ] G3: Check budgets, forbidden output/tools, duplicates, stale context and approval denial.
- [ ] G4: Run 15-01..06 (historically 18/18) through actual Harness in three engines.
- [ ] G5: Record current source evidence/private approval; preserve production entry.

## S16 — PI-03 | dependencies: S15, S10

- [ ] G1: Reconcile historical six cases with deferred-close delta using handoff runbook.
- [ ] G2: Validate/fix policy admission, volatile/persistent storage and lifecycle ownership completely.
- [ ] G3: Check memory/storage/CAS, missing policy, races, locks/cleanup and affected regressions.
- [ ] G4: Re-run actual PI-03 browser 16-01..06 plus delayed-provider/policy-switch reproduction.
- [ ] G5: Prove no stale persistence/replay/leak; restore only earned gates and update PI status.

## S17 — PI-04 / M4 | dependencies: S16, S12, S13

- [ ] G1: Freeze full P0/PI matrix and X-01..03; distinguish mocked and actual boundaries.
- [ ] G2: Complete real host/render/Harness wiring, privacy/transaction cases and provider matrix.
- [ ] G3: Verify negative cases and affected PI regressions on current generated artifacts.
- [ ] G4: Qualify all 35 P0 cases and required actual rendering/provider-wire/browser paths.
- [ ] G5: Reconcile register/evidence; missing live-provider prerequisite stays open; no early cutover.

## S18 — PI-05 | dependencies: S17

- [ ] G1: Map default entry, bundle/cache owners, AGRUN runtime dependencies and rollback.
- [ ] G2: Make local build select PI; retire AGRUN runtime while retaining read-only history.
- [ ] G3: Check dependency/bundle scans, generated identity and compatible legacy reads.
- [ ] G4: Test clean install, old-Service-Worker upgrade, direct BYOK and rollback artifacts.
- [ ] G5: Record local cutover; no deploy/push or user-record deletion inferred.

## S19 — PROD-10 | dependencies: S18

- [ ] G1: Freeze adopted OS/browser/version/paper/template/locale/size/print acceptance profile.
- [ ] G2: Resolve certification defects without silently narrowing required scope.
- [ ] G3: Run required persistence, accessibility, performance and error checks.
- [ ] G4: Obtain actual system-print/manual and declared-platform evidence; WebKit is not Safari.app.
- [ ] G5: Link artifacts; unavailable hardware/platform remains blocked, never Pass.

## S20 — PROD-12 / M5 | dependencies: S18; final alignment with S19

- [ ] G1: Compare three pilots, doctor, CI, static/browser suites and release artifacts.
- [ ] G2: Align local verification/configuration and assemble diagnostics/rollback packet.
- [ ] G3: Run required checks on exact source/artifact hashes; retain failures/skips/unrun results.
- [ ] G4: Reconcile pilot results against S19 actual profile/certification evidence.
- [ ] G5: Finish known-limits and approval-request packet; early drafting is not final gate closure.

## S21 — Release decision | dependencies: S19, S20

- [ ] G1: Identify exact profile/version/artifacts and applicable maintainer approval authority.
- [ ] G2: Prepare complete decision packet and review questions without assuming approval.
- [ ] G3: Validate links, evidence consistency, rollback and unresolved-gate inventory.
- [ ] G4: Complete required review and obtain explicit human decision for exact artifacts.
- [ ] G5: Record approval scope; readiness requires all gates; deployment requires applicable authority.

## Tracking discipline

Read each owning requirement/case verbatim; these worksheets do not replace its detailed criteria.
For each case record expected/actual, source identity, command, runtime, evidence link and limits.
Do not rerun S01-S15 merely because reusable boxes are blank; inspect retained evidence validity.
Only full case criteria earn Pass; unit totals cannot replace browser or manual acceptance.
When blocked, name the missing prerequisite and continue only independent authorized preparation.
Update TASK and separate plan/P0/PI counters after each gate before advancing.
