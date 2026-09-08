# Studio v2 Resumed Implementation Evidence

Date: 2026-09-08. Scope: the current uncommitted worktree after explicit coding resume.
Status: **Partial**. This is a bounded implementation/run record, not a release decision.
The [P0 register](STUDIO_V2_P0_ACCEPTANCE.md) alone owns case closure.
Latest P0 register: **8 Pass (13-01/02/03/04/05/06/07/08), 0 Fail, 27 Not run**. This closes only the
recorded case paths; PROD-01/02/03 and the remaining P0 cases are still incomplete.

## Implemented corrections

| Review item | Current correction | Boundary preserved |
|---|---|---|
| R1 | Import clears sample provenance. Real/Unknown to Synthetic requires confirmation of the entire current document and uses a fresh transaction namespace | Canonical document ID, current project/revision and old durable records remain intact; no old snapshot hydration/backfill |
| R2/R3 | Missing session policy is Unknown. Index and runtime stores bind document/session/policy generation, check actual transaction admission, abort active stale work and reject late results | Old records are not silently deleted; storage failure does not redirect to another persistent sink |
| Session UI | One session-lifecycle owner guards new/open/list/controller initialization and callbacks. Stop and project changes invalidate old work | Old callbacks cannot replace current UI state; an uncertain commit is not retried or rolled back |
| R5/R6 | MCP initialization and embedded instructions prohibit restrictive screenshots and Agent raw-source replacement, and state reference/commit limits | Human editor/export authority remains separate from Agent permissions |
| R7, found during resumed browser verification | The pinned runtime ignored the constructor's systemPrompt option. DESIGNER_PROMPT now enters each consume input, the actual provider-supported location | No vendor patch or Provider change; host enforcement remains mandatory regardless of model cooperation |
| PROD-01 scope fail-closed | Invalid or incomplete host scopes no longer normalize to document scope; gateway context-construction failures return the safe command envelope | Valid document/table/component scopes, scope fingerprints and domain operation checks remain unchanged |
| PROD-01 project replacement scope | The panel resets the active scope to the whole document for import/sample/recovery replacement, while a policy-only switch preserves the selected scope | The reset is owned by the existing panel/app lifecycle; no new scope authority or transaction path was added |
| Storage status regression | A replacement document refreshes the current session list/status; an invalidated boot callback no longer suppresses storage-unavailable feedback | New chats report volatile fallback without claiming saved records were erased |
| M2/M3 output variants | The Agent projection now keeps review provenance exact, whitelists repeated-area keys, rejects malformed response envelopes and wrong-type required arrays safely, and verifies local-only Review media provenance before rebuilding final Provider parts | Canonical projects, transaction results, opaque references and human approval remain owned by the existing domain/gateway boundary; provenance markers never enter the Provider payload |

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
- Serial full unit run: **95 files / 497 tests passed** after the final recipient/save corrections.
- Earlier resumed `npm run doctor`: **4/5 high-level checks passed**. Vendor integrity, the three pilot validators and the
  independent check/build portions passed, but the combined unit/build step hit the existing
  `server-transaction.test.js` crash-after-CAS case's 15-second timeout during the long run.
  An isolated rerun of that file passed **1 file / 8 tests**; this remains historical evidence.
  Static pilot validation does not certify browser layout or physical printing.
- R7/status correction: **29/29 targeted unit tests passed**, assets/site rebuilt.
- M2/M3 output-boundary correction: **3/3 focused tests passed** and the existing public matrix remained **7/7 passed**; direct transactions, history arrays, undo project omission, FormSpec extensions/business labels, neutral table labels, exact reviewedRevision handling and malformed envelopes were inspected from reconstructed outputs.
- Latest output/provenance targeted run: **35/35 tests passed across 5 files** (`visual-regression`, `production-boundary`, `agent-layout-review`, `agent-provider-media`, `agent-provider-transport`); wrong-type required arrays fail closed, restrictive media requires geometry provenance, and Provider transport receives rebuilt allowlisted parts.
- Scope boundary targeted run: **15/15 tests passed across 3 files** (`agent-scope`, `agent-entry-parity`, `gateway`); malformed/incomplete scopes fail closed and embedded/WebMCP/CDP scope decisions remain equivalent.
- Scope replacement browser run: **3/3 serially passed** across Chromium, Firefox and WebKit; a selected table scope survives a policy switch and resets after an imported project replaces the document.
- Latest serial full unit run: **97 files / 504 tests passed** after the output-boundary correction, fixture alignment and project-replacement scope guard. `npm run build:assets`, `node scripts/build-site.mjs` and `npm run check` also passed; generated artifacts were not published.
- Current `npm run doctor`: **5/5 high-level checks passed**, including the same serial unit/build path and all three static pilot validators. This is local verification only and does not close the P0 register or authorize release.
- Latest bounded browser smoke: **27/27 serially passed** across Chromium, Firefox and WebKit for the production boundary and final Provider wire; it rechecked policy/storage/approval/late-result controls and actual final request bodies after the projection change.
- Initial 33-test browser composition: **27 passed / 6 failed**. The failures reproduced missing actual
  prompt delivery and missing storage-status feedback in all three engines; they were not discarded as flakes.
- After those corrections: **12/12 browser tests passed** across Chromium, Firefox and WebKit for actual
  panel session/store/wire isolation, explicit-save/prompt disclosure, storage-denial controls and the second Provider wire request.
- Classification confirmation: **3/3 browser tests passed**. Session schema/CAS and delayed runtime open:
  **12/12 browser tests passed** in the earlier bounded run.
- Expanded 36-test composition: **36/36 passed serially** across Chromium, Firefox and WebKit with one worker.
  An earlier parallel run had 34 assertion passes and 2 Firefox browser-context teardown protocol errors
  (`_maybeDontRestoreTabs`); that runner result is retained as historical evidence, not current product failure.
- Recipient replacement controls: **6/6 passed serially** across the three engines for endpoint and credential
  replacement. The final wire request used the new recipient, excluded credentials and old prompt context,
  and the policy-aware session storage contained no prompt or credential.
- Explicit-save controls: **24/24 passed serially** across the three engines, including policy races, denied
  storage, uncertain close handling and the explicit-download path. These are bounded controls, not full
  overwrite, recovery and production-export acceptance.
- PROD-13 lifecycle cases: `e2e/studio-v2-production-boundary.spec.js` passed **24/24 serially** across the
  three engines, covering mode/document delayed Provider results, Unknown import, quota fallback, Real durable
  transaction admission and final Provider payloads. The combined lifecycle/session set passed **30/30 serially**,
  covering missing-policy callbacks, delayed IndexedDB mode/document/generation changes, asynchronous runtime
  write failure, panel session replacement and the actual wire request. These runs support the P0 Pass records
  for 13-04 and 13-08; the explicit-save/prompt case supports 13-07; they do not close the remaining P0 cases.

Reproduction entry points: `tests/studio-v2/agent-session-lifecycle.test.js`, `agent-session-database.test.js`,
  `agent-panel-lifecycle.test.js`, `agent-policy-owners.test.js`, `agent-prompt-policy.test.js`, `agent-output-boundary.test.js`,
and `e2e/studio-v2-classification-lifecycle.spec.js`, `studio-v2-session-store.spec.js`,
`studio-v2-panel-session-lifecycle.spec.js`, `studio-v2-provider-wire.spec.js`.
Browser tests decode actual IndexedDB/store/cache content and capture controlled final Provider bodies;
they do not rely solely on a response, a status label or a screenshot.

## Remaining work and safe continuation

1. Complete the remaining mapped P0 cases, including external-client admission, scope/apply/state, commit-result and remaining storage/destination coverage; 13-04/07/08 are now case-specific Passes.
2. Treat the bounded recipient and explicit-save controls as supporting evidence only; finish full overwrite/recovery,
   client-admission and all-35 acceptance without widening data access.
3. Resolve the long-run transaction timeout and continue targeted regressions without hiding it behind the isolated pass.
4. Resolve the pre-existing modified legacy `studio/studio.js` size violation (1491 lines) by bounded extraction;
   no size exception is authorized. All resumed Studio v2 changes are at most 300 lines per file.
5. Prepare M5 evidence and rollback instructions only after applicable gates; do not deploy, publish or push.

Rollback must preserve canonical committed data and existing records. Do not restore permissive Unknown/Real defaults,
raw output, unconditional pixel prompts or an unguarded session store as a compatibility fallback.
No real business data, live Provider test, deployment, release, push or user-data deletion was performed.
The five supported locale catalogs contain the new confirmation/status keys, and the browser i18n controls pass;
unsupported locale fallback behavior was not expanded by this work.

## SCMC review of this bounded correction

- Simple: WARN, Medium. The pinned runtime schema is necessarily mirrored because its factory has no side-effect guard hook;
  upgrade drift would break session compatibility. Keep the adapter narrow and rerun real-browser parity/CAS tests on vendor change.
- Clear: PASS. Host classification, volatile state, initialization versus completed writes and instruction delivery are explicit.
- Modular: PASS. Session lifecycle, IndexedDB execution and runtime-compatible record operations have separate reasons to change.
- Consistent: PASS for the verified corrections. They follow the retained policy, transaction and human-approval boundaries.
- Overall: **PASS WITH WARNINGS for this bounded design**, not global privacy conformance or Production Ready.
