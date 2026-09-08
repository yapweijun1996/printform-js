# Studio v2 Resumed Implementation Evidence

Date: 2026-09-08. Scope: the current uncommitted worktree after explicit coding resume.
Status: **Partial**. This is a bounded implementation/run record, not a release decision.
The [P0 register](STUDIO_V2_P0_ACCEPTANCE.md) alone owns case closure.

## Implemented corrections

| Review item | Current correction | Boundary preserved |
|---|---|---|
| R1 | Import clears sample provenance. Real/Unknown to Synthetic requires confirmation of the entire current document and uses a fresh transaction namespace | Canonical document ID, current project/revision and old durable records remain intact; no old snapshot hydration/backfill |
| R2/R3 | Missing session policy is Unknown. Index and runtime stores bind document/session/policy generation, check actual transaction admission, abort active stale work and reject late results | Old records are not silently deleted; storage failure does not redirect to another persistent sink |
| Session UI | One session-lifecycle owner guards new/open/list/controller initialization and callbacks. Stop and project changes invalidate old work | Old callbacks cannot replace current UI state; an uncertain commit is not retried or rolled back |
| R5/R6 | MCP initialization and embedded instructions prohibit restrictive screenshots and Agent raw-source replacement, and state reference/commit limits | Human editor/export authority remains separate from Agent permissions |
| R7, found during resumed browser verification | The pinned runtime ignored the constructor's systemPrompt option. DESIGNER_PROMPT now enters each consume input, the actual provider-supported location | No vendor patch or Provider change; host enforcement remains mandatory regardless of model cooperation |
| Storage status regression | A replacement document refreshes the current session list/status; an invalidated boot callback no longer suppresses storage-unavailable feedback | New chats report volatile fallback without claiming saved records were erased |

The policy-aware runtime session adapter uses the pinned Agrun v4 IndexedDB schema. A generic wrapper
could not guard its lazy internal database open/transaction admission. The adapter stays in the existing
session-storage owner; it does not add a service or patch global IndexedDB in production.
It preserves atomic session version checks and waits for transaction completion, not request success.
Incompatible existing schemas fail closed without deleting stores. Vendor upgrades require renewed schema/API parity checks.

## Verified runs

- Initial index lifecycle regression: 4 failed / 1 passed before correction, then 5/5 passed.
- First classification/ownership/boundary set: 24/24 unit tests passed.
- Session database tests cover request-success followed by abort, stale transaction cancellation,
  blocked/timed-out open with late success, and disposed memory stores.
- Panel lifecycle tests cover delayed creation/list/controller results, Stop, shared initialization,
  and policy change across the awaited skill step. A 36-test focused set passed.
- Serial full unit run: **92 files / 475 tests passed**, repeated successfully after the final R7/status correction.
- Doctor: **5/5 passed**, including the same full unit set, vendor integrity, production build and three pilot validators;
  `npm run check` passed. Static pilot validation does not certify browser layout or physical printing.
- R7/status correction: **29/29 targeted unit tests passed**, assets/site rebuilt.
- Initial 33-test browser composition: **27 passed / 6 failed**. The failures reproduced missing actual
  prompt delivery and missing storage-status feedback in all three engines; they were not discarded as flakes.
- After those corrections: **12/12 browser tests passed** across Chromium, Firefox and WebKit for actual
  panel session/store/wire isolation, explicit-save/prompt disclosure, storage-denial controls and the second Provider wire request.
- Classification confirmation: **3/3 browser tests passed**. Session schema/CAS and delayed runtime open:
  **12/12 browser tests passed** in the earlier bounded run.
- Expanded 36-test composition: **34 passed / 2 failed**. Both failures were Firefox browser-context teardown
  protocol errors (`_maybeDontRestoreTabs`), not assertion failures. Keep this failed run visible; a serialized
  repeat is in progress to distinguish runner instability from reproducible product behavior.

Reproduction entry points: `tests/studio-v2/agent-session-lifecycle.test.js`, `agent-session-database.test.js`,
`agent-panel-lifecycle.test.js`, `agent-policy-owners.test.js`, `agent-prompt-policy.test.js`,
and `e2e/studio-v2-classification-lifecycle.spec.js`, `studio-v2-session-store.spec.js`,
`studio-v2-panel-session-lifecycle.spec.js`, `studio-v2-provider-wire.spec.js`.
Browser tests decode actual IndexedDB/store/cache content and capture controlled final Provider bodies;
they do not rely solely on a response, a status label or a screenshot.

## Remaining work and safe continuation

1. Finish the expanded current composition, including asynchronous runtime-write failure, and review the complete mapped cases.
2. Close explicit-save side-effect/policy races and recipient replacement. Preserve confirmed writes and committed results.
3. Continue full external-client admission, scope/apply/state and all-35 P0 case acceptance. Public-command coverage is not P0 closure.
4. Resolve the pre-existing modified legacy `studio/studio.js` size violation (1491 lines) by bounded extraction;
   no size exception is authorized. All resumed Studio v2 changes are at most 300 lines per file.
5. Prepare M5 evidence and rollback instructions only after applicable gates; do not deploy, publish or push.

Rollback must preserve canonical committed data and existing records. Do not restore permissive Unknown/Real defaults,
raw output, unconditional pixel prompts or an unguarded session store as a compatibility fallback.
No real business data, live Provider test, deployment, release, push or user-data deletion was performed.
New confirmation/status keys currently use English fallback outside English; localized copy requires verification.

## SCMC review of this bounded correction

- Simple: WARN, Medium. The pinned runtime schema is necessarily mirrored because its factory has no side-effect guard hook;
  upgrade drift would break session compatibility. Keep the adapter narrow and rerun real-browser parity/CAS tests on vendor change.
- Clear: PASS. Host classification, volatile state, initialization versus completed writes and instruction delivery are explicit.
- Modular: PASS. Session lifecycle, IndexedDB execution and runtime-compatible record operations have separate reasons to change.
- Consistent: PASS for the verified corrections. They follow the retained policy, transaction and human-approval boundaries.
- Overall: **PASS WITH WARNINGS for this bounded design**, not global privacy conformance or Production Ready.
