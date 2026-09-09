# S16 / PI-03 Policy-Bound Sessions and Legacy Isolation Evidence

Date: 2026-09-09. Status: **Done (100%; G1-G5 complete)**. The deferred-close and pending-open lifecycle corrections are requalified against the current source and generated artifact. This is an isolated
qualification record for the actual PI session path; the embedded production entry remains AGRUN.

## G1 — investigation and frozen acceptance

Original investigation source identity: `main` at `3a1a7dbb93de5edd7984842896afdaab42a92bed` plus the existing shared
uncommitted worktree; the current requalification HEAD and hashes are recorded per case below. No unrelated user changes were reverted or overwritten. `agent-impact` file
analysis remains partial because the repository has no `tsconfig.json`; bounded source tracing and
Code Slice inspection were used as the fallback.

Owners inspected: current AGRUN `agent-sessions.js`, `agent-session-store.js` and
`agent-session-database.js`; `core/data-policy.js` and `agent-context.js`; existing session/policy
unit and browser regressions; and the pinned public PI `MemorySessionRepo`, `StorageBackedSession`,
`Storage` and `SessionRepo` exports. The AGRUN namespace `printform-agrun-session-*` is not reused.

Frozen cases: 16-01 policy modes; 16-02 PI storage contract and reload/CAS; 16-03 labeled read-only
AGRUN history and fresh continuation; 16-04 fail-closed storage/open errors; 16-05 disposal and
policy-generation/document/mode races; 16-06 explicit same-session Synthetic writer rejection.

## Current requalification log

### Case 16-01 — policy mode selection

Date: 2026-09-09; branch `main`; HEAD `86591663fc6f655622ea1244e83fa8803e8685e9`; current `policy-session-repo.js` SHA-256 `19c1f918c164de951dce494e984d044ce531cec4ae1e84e8fc61ee1557bf84f9`.

Expected: Unknown and Real must use volatile memory without opening IndexedDB; Synthetic may use only the versioned IndexedDB namespace; the actual PI Harness must complete one turn without external requests. Actual: Playwright `e2e/studio-v2-pi-03.spec.js --grep "16-01" --workers=1` passed 3/3 configured browsers (Chromium, Firefox, WebKit). The browser result reported `unknown.mode: memory`, `real.mode: memory`, `synthetic.mode: indexeddb`, `storageOpens: 0` for the Unknown/Real phase, non-empty Harness transcripts for both volatile runs, the `printform-pi-session-v1-*` namespace for Synthetic, and no external requests.

Artifact preparation: `node scripts/build-site.mjs` passed and generated the current static site; PI-03 entry SHA-256 `5b0e37108f0f9dad9adfdfa175d387b84222d32d55fd323b18b9da8152b31f13`, manifest SHA-256 `f71f77a1777349fd04d8e93d3f7b17ff2abf0cc1567e8c6fe2c6dd1cca684e92`. An earlier `npm run build:site` attempt timed out at 120 seconds before completion; the later full build is the counted result. This case is one of the six current-source browser acceptance cases.

### Case 16-02 — persistent Synthetic session, replay and CAS

Date: 2026-09-09; same source and generated PI-03 artifact identity as 16-01. Expected: a Synthetic session must attach the actual `StorageBackedSession` to policy-permitted IndexedDB, survive close/reopen with ordered entries and stats, and reject a second commit from one mutation after the first commit has completed. Actual: Playwright `e2e/studio-v2-pi-03.spec.js --grep "16-02" --workers=1` passed 3/3 (Chromium, Firefox, WebKit). The case assertions observed `mode: indexeddb`, schema `storageVersion: 1`, a successful actual Harness first run with non-empty transcript, increasing reopened sequence numbers and non-zero message count; the second mutation commit was rejected as an error after the first empty commit. No external-request assertion failed. This case contributes the current persistence/replay/CAS evidence to S16.

### Case 16-03 — AGRUN history isolation

Date: 2026-09-09; same source and generated PI-03 artifact identity as 16-01. Expected: imported AGRUN history is labeled read-only and must not appear in the PI session repository; continuing it must create a fresh empty PI transcript in the separate PI namespace. Actual: Playwright `e2e/studio-v2-pi-03.spec.js --grep "16-03" --workers=1` passed 3/3 (Chromium, Firefox, WebKit). The assertions observed one `legacy: true`, `readOnly: true`, `source: AGRUN` record, zero existing PI sessions before continuation, zero entries in the fresh session, exactly one fresh ID afterward, no AGRUN ID in the PI list, and a `printform-pi-session-v1-*` namespace. No external-request assertion failed. This case contributes the current AGRUN-isolation evidence to S16.

### Case 16-04 — storage failure fail-closed

Date: 2026-09-09; same source and generated PI-03 artifact identity as 16-01. Expected: a failed persistent commit must not retry, silently fall back to memory, or expose the failed value; an IndexedDB open failure must terminate within the configured timeout and make one attempt. Actual: Playwright `e2e/studio-v2-pi-03.spec.js --grep "16-04" --workers=1` passed 3/3 (Chromium, Firefox, WebKit). The assertions observed `PI_SESSION_COMMIT_FAILED`, no name after the failed commit, one persisted session record, `PI_SESSION_OPEN_TIMEOUT`, and one open attempt; no external-request assertion failed. This case contributes the current fail-closed storage/open evidence to S16.

### Case 16-05 — disposal and policy freshness

Date: 2026-09-09; current source includes the deferred-close and pending-open lifecycle corrections; generated PI-03 artifact was rebuilt after both corrections. Expected: a session captured under an old policy must reject later calls after a policy generation/classification change; a disposed session must reject later calls; the repository must expose the new policy mode rather than retain the old persistent mode; a delayed actual Harness result must not persist or leak retired resources. Actual: Playwright `e2e/studio-v2-pi-03.spec.js --grep "16-05" --workers=1` passed 3/3 (Chromium, Firefox, WebKit). The assertions observed `STALE_POLICY_CONTEXT` for the policy-raced session, `PI_SESSION_CLOSED` for the disposed session, and `nextMode: memory` after Synthetic→Real. The delayed actual `AgentHarness` made one Provider call, rejected the stale storage delivery as outer `HarnessFault` with preserved cause `STALE_POLICY_CONTEXT`, restored one original entry, persisted no stale canary, and left both retired-session and retired-database counts at zero after close; no external-request assertion failed. The outer wrapper is the pinned Harness error contract for a storage rejection; any future host adapter must map the preserved policy cause to its safe public stale-policy envelope rather than expose raw fault text.

### Case 16-06 — Synthetic writer lock and release

Date: 2026-09-09; same source and generated PI-03 artifact identity as 16-01. Expected: two repositories opening the same Synthetic session must not write concurrently; after the first writer closes, the second repository may reopen and write, while the PI namespace remains separate from AGRUN. Actual: Playwright `e2e/studio-v2-pi-03.spec.js --grep "16-06" --workers=1` passed 3/3 (Chromium, Firefox, WebKit). The assertions observed `PI_SESSION_WRITER_CONFLICT`, successful reopen and name write by the second writer, the versioned PI namespace, and `multiTabDurability: false`; no external-request assertion failed. This case contributes the current lock ownership/release evidence to S16.

## G2 — implementation and boundary

- `PolicySessionRepo` uses the public `MemorySessionRepo` for volatile Unknown/Real state and the
  public `StorageBackedSession` against a local `PiMemoryStorage`/IndexedDB `Storage` adapter for
  permitted Synthetic state. The pinned package root does not export `MemoryStorage`, so the small
  local materializer implements the public Storage contract instead of using a deep import.
- The IndexedDB adapter uses the separate versioned namespace `printform-pi-session-v1-*`, with
  session/state/lock/commit stores. Raw write batches, sequence and usage are committed atomically
  with an expected-version CAS; a session writer lock rejects a second browser context explicitly.
  No provider key, live Harness or AGRUN record is persisted or replayed.
- Every repository/session async boundary checks the current policy and disposal state. Legacy AGRUN
  records are returned only as labeled read-only history; continue creates a fresh PI session. Policy
  changes retire old wrappers immediately; their storage/database remains owned until the wrapper or repository closes, then releases the old database.

## G3 — verification

- `npx vitest run tests/studio-v2/pi-03-memory.test.js --maxWorkers=1 --no-file-parallelism`: **3/3**.
- `npm run build:site`: **106 test files / 567 tests passed**; assets and site generation passed.
  Bundles: PI-00 **823,439**, PI-01 **14,270**, PI-02 **1,123,184**, PI-03 **867,676** bytes;
  Service Worker precache: **193** entries.
- All PI-03 source, script, E2E and focused-test files passed `node --check`; `npm run check` passed.
  The final entry boundary scan found no bare PI/Node imports, `fetch`, XHR or WebSocket; the
  qualification manifest records `actualHarness: true`, `appBackend: false`, `providerProxy: false`,
  `policyBound: true` and `crossTabWriterGuard: true`. A corrected bundle scan found zero bare PI/Node
  imports, `fetch`, XHR, WebSocket, `eval` or `new Function` matches; the bundle's third-party optional
  Node capability strings are not executable imports on the qualified path.
- Affected existing AGRUN/session/policy regressions: **31/31** focused tests passed; the full build also passed all 567 unit tests.
  `npm run check` passed. `npm run doctor` passed **5/5** steps (including build and three `validate:v2` checks).
  Non-counted attempts were recorded: the first `npm run build:site` and first `npm run doctor`
  each hit the 120-second harness timeout; both were rerun with sufficient timeout and passed.
  `git diff --check` completed with exit 0; its only output is existing line-ending warnings.
- Final bounded line inventory: PI-03 source/script/E2E/test files are 5–281 lines; `TASK.md` is
  297 lines and the shared implementation evidence remains 300 lines.

## G4 — browser acceptance

PI-03 cases 16-01..06 passed **18/18** on the final source/artifact state: Chromium 6/6, Firefox 6/6 and WebKit 6/6. Case 16-05 additionally exercised a delayed actual Provider result, abort, repeated policy changes, missing-policy fallback and a subsequent permitted run. The run proves actual `AgentHarness` attachment, volatile policy modes, persistent Synthetic reopen, atomic CAS, legacy isolation, fail-closed storage/lifecycle behavior, retired-resource cleanup and explicit cross-tab writer protection. The delayed raw Harness rejection is `HarnessFault` with preserved `STALE_POLICY_CONTEXT` cause, which is recorded as the pinned upstream storage-fault envelope; no stale canary was persisted.

## G5 — release-boundary decision

S16 is locally closed in its isolated artifact. The production AGRUN entry, canonical project/revision
owner, CAS, private human approval/export, Unknown/Real restrictions, existing records and protocol
compatibility remain unchanged. No deployment, publish, push, release approval, real business data,
live provider, Edge/Safari.app, physical print or user-data deletion was performed. PI-04 composed
acceptance is the next dependency-ready step; PI-05 cutover and release certification remain open.
