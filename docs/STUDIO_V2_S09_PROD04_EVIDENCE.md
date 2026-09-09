# Studio v2 S09 / PROD-04 evidence

Date: 2026-09-09. Scope: the current uncommitted worktree after S08 closure.
Status: **Done, 100%**. G1-G5 are checked for the six frozen PROD-04 lifecycle cases.
This record does not change the P0 denominator or claim release-platform/provider evidence.

## Frozen acceptance cases

- **04-01 card target and command outcome:** an Applied card Undo/Redo uses its applied or reverted revision; a stale card cannot undo a later unrelated head and remains Applied.
- **04-02 candidate identity and Discard:** Apply/Discard keeps one candidate identity, leaves committed export/readiness bound to the base revision and restores the committed preview.
- **04-03 Stop and late result:** Stop cancels the active turn; late provider output cannot create or replace a candidate.
- **04-04 rapid request and double Apply:** repeated requests and duplicate Apply input produce at most one committed outcome; duplicate, lost and unknown outcomes remain truthful.
- **04-05 project replacement:** document/policy replacement invalidates the old session and candidate; stale output cannot mutate the new project.
- **04-06 durable history and restore:** monotonic durable Undo/Redo, reload reconstruction and restored committed preview retain CAS, hash and review invalidation rules.

Required checks are focused history/card/runtime tests plus real browser coverage in the configured
Chromium, Firefox and WebKit projects. Edge, Safari.app, physical print, live Provider and deployment
retention are release-level evidence boundaries, not silently substituted by this step.

## G1 investigation and current/target

- Owners traced: `ui/agent-history-controls.js` owns global controls; `ui/agent-card-controller.js` owns card target/result projection; `core/history.js` owns the logical cursor and monotonic revision allocation; `core/history-navigation-service.js` owns current-context checks, durable CAS, journal entries, receipt invalidation and `change`; `ui/app.js` owns command results, preview restore and control refresh.
- Current: card Undo/Redo passes `expectedRevision` and changes the card only after an `{ ok: true, changed: true }` result. The durable service rejects a stale head before navigation. Candidate cleanup, Stop, session invalidation, project replacement and reload reconstruction are composed in the browser cases below.
- Target: prove the six frozen cases without weakening canonical project/hash ownership, private approval, policy/session boundaries, existing records or truthful preview state.
- G1 result: dependencies S07/S08 are Done; impact and required checks were frozen before the case runs. No unresolved product decision was needed for the local cases; release-platform/provider evidence remains outside this step.

## Case 04-01 result

`e2e/studio-v2-s09-prod04-01.spec.js` passed **3/3** serially across Windows Chromium, Firefox and WebKit.
The actual chat panel produced and privately applied a candidate at r1. Card Undo called
`undo_revision(expectedRevision: 1)` and committed canonical r2 with the baseline content; card Redo
called `redo_revision(expectedRevision: 2)` and committed r3 with the applied content. An unrelated
Auto-eligible font change advanced the durable head to r4. The old card stayed visibly Applied at r3;
clicking its Undo returned `REVISION_CONFLICT` with `actualRevision: 4`, left r4/project hash/content
unchanged and did not relabel the card Reverted. No functional pageerror or unknown browser diagnostic
occurred; the known Firefox AGRUN CSP eval diagnostic remains the documented exception.

Focused owning tests passed **20/20**:
`history.test.js` 6/6, `history-durable-boundary.test.js` 3/3,
`agent-card-controller.test.js` 2/2, `agent-change-cards.test.js` 5/5 and
`commit-boundary.test.js` 4/4. The first browser attempt used Preview mode to create the unrelated
revision and correctly received `HUMAN_APPROVAL_REQUIRED`; the test was corrected to use the existing
Auto policy for the safe font change. This was a test setup failure, not a product failure.

## Case 04-02 result

The existing `e2e/studio-v2-p0-prod03-06.spec.js` was re-run as valid evidence for this frozen case and
passed **3/3** serially across Windows Chromium, Firefox and WebKit. It completed a real r0 layout review,
rendered an r0 candidate with a distinct preview color, verified `request_export` and the trusted download
attestation still referenced committed r0, then used the actual Discard control. The restored preview returned
to the committed color with r0/project hash unchanged; no functional pageerror or unknown browser diagnostic
occurred. This evidence is reused without a source change and does not claim rapid-request or double-Apply
closure.

## Case 04-03 result

The existing `e2e/studio-v2-p0-prod02-05.spec.js` was re-run as valid evidence and passed **3/3**
serially across Windows Chromium, Firefox and WebKit. The first controlled turn was stopped while its
provider stream was held; releasing it later observed the late callback but no late phase/completion,
candidate, revision or committed-color change. A retry produced one candidate, Discard hid it, and the
released late retry again did not mutate the r0 committed project. The browser UI returned to a usable
send state and had no functional pageerror or unknown browser diagnostic. This reuses the existing
Stop/late-result implementation without a source change.

## Case 04-04 result

The existing `e2e/studio-v2-p0-prod02-06.spec.js` was re-run as valid evidence and passed **3/3** serially
across Windows Chromium, Firefox and WebKit. During a lost Apply response, two rapid Apply clicks were
dispatched while transaction recovery was pending; the UI made one approval and one Apply attempt and
committed exactly one revision. A later validation-unavailable commit remained Applied with its actual
revision, while an injected post-write interruption advanced the durable revision and left a Recovery card
without Apply or Discard. Duplicate/lost/unknown outcomes stayed truthful, with no functional pageerror or
unknown browser diagnostic. This closes the frozen rapid duplicate-Apply portion, not project replacement.

## Case 04-05 result

`e2e/studio-v2-s09-prod04-05.spec.js` passed **3/3** serially across Windows Chromium, Firefox and
WebKit. An actual active chat turn was held while the Purchase Order project was imported. The new
project showed the Purchase Order context, a fresh revision-0 state and different source; the old card
was hidden and its session was invalidated. Releasing the old provider response observed only the late
token and did not consume a late phase/completion or mutate the new project's source, revision or title.
The imported Unknown-policy fixture intentionally has a null project hash; the test verifies hash
stability rather than requiring a hash that the policy forbids. No functional pageerror or unknown
browser diagnostic occurred.

## Case 04-06 result

`e2e/studio-v2-s09-prod04-06.spec.js` passed **3/3** serially across Windows Chromium, Firefox and
WebKit. A real Auto-eligible candidate commit advanced the canonical history from r0 to r1; global/card
history Undo advanced to r2 and restored the baseline preview, then Redo advanced to r3 and restored the
applied preview. The durable head, project hash and computed preview color were captured before reload.
After reload and gateway re-admission, `get_revision`, design state, Printable iframe color and
Undo/Redo availability reconstructed the same committed r3 state. No functional pageerror or unknown
browser diagnostic occurred.

## Gate/status and next action

- G1 **10% checked**: ownership, dependencies, impact and six-case acceptance matrix were frozen before implementation/verification.
- G2 **40% checked**: the scoped owners already implement candidate token cleanup, Stop/session invalidation, project replacement, CAS-bound card history, truthful command outcomes and reload reconstruction; the final diff adds only case-specific evidence/docs and does not introduce a second transaction or history authority.
- G3 **30% checked**: the focused S09 unit/runtime set passed **8 files / 42 tests**; all three new browser specs passed `node --check`, and `npm run check` passed.
- G4 **15% checked**: 04-01 through 04-06 each passed **3/3** across Chromium, Firefox and WebKit (**18/18** browser case executions); reusable 04-02/03/04 evidence was re-run, not inferred from unit tests.
- G5 **5% checked**: TASK, the execution ledger, DoD counters, production plan, release checklist, gap audit and this evidence record agree. Pending independent Changes/history search remains the separate E14-UI-05/PROD-07 follow-up and is not silently claimed as a PROD-04 lifecycle requirement.

S09 is closed at **100%**. Next dependency-ready step: S10 / PROD-08 draft/save/recovery. Edge, Safari.app,
physical print, live Provider and deployment retention remain release-level evidence boundaries.
