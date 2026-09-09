# S15 / PI-02 Host Tools, Events and Approval Evidence

Date: 2026-09-09. Status: **Done, 100%** (`G1/G2/G3/G4/G5 = 10/50/80/95/100`). This is a bounded qualification record for the actual PI Harness; the embedded production entry remains AGRUN.

## G1 — investigation and frozen acceptance

Source identity: `main` at `3a1a7dbb93de5edd7984842896afdaab42a92bed` plus the existing shared uncommitted worktree. No unrelated user changes were reverted or overwritten. `agent-impact` capabilities passed, but file analysis was partial because the repository has no `tsconfig.json`; bounded source tracing and Code Slice inspection supplied the fallback evidence.

The investigation traced the current AGRUN action/runtime/event/budget/terminal/approval/commit-resolution owners, the gateway and CommandBus scope/revision/CAS boundary, and the pinned upstream PI APIs. The six frozen cases were retained:

| Case | Required observation |
|---|---|
| 15-01 Design preview | Actual Harness prompt emits an explicit PrintForm tool; the host delegates a redacted preview, creates one proposal, emits stable events and stops after the terminal result. |
| 15-02 Review completion | Actual Harness maps Review completion/blocked outcomes through existing review hooks and preserves current-revision evidence binding. |
| 15-03 Terminal batch | A successful terminal tool prevents later tool effects in the same model batch and prevents a later provider turn; blocked calls are visible as safe errors. |
| 15-04 Terminal/protocol negatives | Missing terminal, malformed arguments/results and provider/runtime errors fail closed without claiming a proposal or commit. |
| 15-05 Host budgets | Existing action, token and repeated-action limits stop the turn through the host guard; no blind retry or AGRUN fallback occurs. |
| 15-06 Approval/commit boundary | Stale revision/candidate is rejected; ordinary PI tools cannot approve/apply; only the private human gateway applies, and uncertain apply queries the existing transaction owner. |

## G2 — bounded implementation

- Added isolated `studio-v2/pi-02/` sources with actual `AgentHarness`, `MemorySessionRepo`, one configured lane and `toolExecution: "sequential"`; the production `studio-v2/index.html` and AGRUN runtime were not cut over.
- Exposed explicit safe read/preview/review tools and private host callbacks. Ordinary agent tools have no approve/apply capability; approval/apply remains behind the private human path and existing gateway/CommandBus transaction owner.
- Projected Harness events to stable redacted events (`turn_start`, `tool_start`, `tool_result`, `usage`, `completed`, `runtime_error`) without raw arguments, provider content, credentials or arbitrary output. Host hooks enforce terminal-first behavior and existing action/token/repeat budgets.
- Reused existing proposal, scope, canonical revision/CAS, review receipt and uncertain-commit reconciliation owners. No second transaction authority, app backend, provider proxy, hidden Demo route, credential persistence or data migration was introduced.

## G3 — static and regression verification

- Final `npm run build:site` passed: **105 files / 564 tests**, assets passed, PI-00 **823439** bytes, PI-01 **14270** bytes, PI-02 **1122557** bytes, and the service-worker precache contains **180** entries.
- `node --check` passed for every PI-02 source, build script and browser acceptance spec. `npm run check` passed. `git diff --check` exited 0; the only output was the repository's LF/CRLF warning.
- Final PI-02 bundle/manifest inspection found no bare `@earendil-works/pi-*` import, `node:` import, `eval(` or `new Function`; the manifest records `static: true`, `appBackend: false`, `providerProxy: false`, `actualHarness: true`, `memorySession: true`, `toolExecution: "sequential"`, and upstream source commit `b2602be77cb7b0de45dd616407fd210daa48aa75`.
- The full build included the existing gateway/transaction/approval/budget/runtime regressions. The earlier G1 impact-analysis limitation remains disclosed above; syntax, build and runtime checks provide the applicable fallback evidence.

## G4 — browser acceptance

Final command: `npx playwright test e2e/studio-v2-pi-02.spec.js --workers=1`.

Cases 15-01 through 15-06 passed **18/18** serially: Chromium **6/6**, Firefox **6/6**, and WebKit **6/6**. The run verified design preview/proposal, Review receipts for default and long text, terminal-first same-batch blocking, malformed/protocol/provider negatives, action/token/repeat budgets, private approval, lost-response reconciliation and stale CAS. The browser captured no external request for the static PI-02 artifact and observed no agent approve/apply tool.

## G5 — evidence and release-boundary synchronization

`TASK.md`, the execution plan, PI migration plan, implementation evidence, index, direction/roadmap and production-plan status summaries were synchronized to S15 Done and S16/PI-03 next. The release checklist remains intentionally open. No deployment, push, commit, release approval or user-data deletion was performed; no live Provider/CORS/quota/model-reliability, Edge, Safari.app, physical-print or deployed-retention evidence is claimed.

Initial direct PI-02 build testing exposed a copied-entry precondition failure (18 entry-load failures because the isolated `index.html` had not yet been copied by the site build). The site build copy path was corrected and the final full-build/browser run passed 18/18. An early fixture run also exposed test-fixture repeat/token limits; the fixture was corrected to isolate the intended action-limit case before the final run. These intermediate failures are not release failures, and the final required checks have no failures.

Current counters: plan closure **71.4% (1500/21)** with **15/21** steps Done; P0 **32/35 Pass (91.4%)**, Fail 0, Not run 3; PI **3/6 Done (50%)**. Release is not approved or Production Ready.

Next action: continue **S16 / PI-03** from G1, one frozen session/legacy-isolation case at a time, while preserving the current AGRUN entry and all canonical privacy, revision/CAS and approval boundaries.
