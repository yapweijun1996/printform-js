# S16 / PI-03 Policy-Bound Sessions and Legacy Isolation Evidence

Date: 2026-09-09. Status: **Done (100%; G1-G5 complete)**. This is an isolated
qualification record for the actual PI session path; the embedded production entry remains AGRUN.

## G1 — investigation and frozen acceptance

Source identity: `main` at `3a1a7dbb93de5edd7984842896afdaab42a92bed` plus the existing shared
uncommitted worktree. No unrelated user changes were reverted or overwritten. `agent-impact` file
analysis remains partial because the repository has no `tsconfig.json`; bounded source tracing and
Code Slice inspection were used as the fallback.

Owners inspected: current AGRUN `agent-sessions.js`, `agent-session-store.js` and
`agent-session-database.js`; `core/data-policy.js` and `agent-context.js`; existing session/policy
unit and browser regressions; and the pinned public PI `MemorySessionRepo`, `StorageBackedSession`,
`Storage` and `SessionRepo` exports. The AGRUN namespace `printform-agrun-session-*` is not reused.

Frozen cases: 16-01 policy modes; 16-02 PI storage contract and reload/CAS; 16-03 labeled read-only
AGRUN history and fresh continuation; 16-04 fail-closed storage/open errors; 16-05 disposal and
policy-generation/document/mode races; 16-06 explicit same-session Synthetic writer rejection.

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
  changes close old sessions and release the old database before it is closed.

## G3 — verification

- `npx vitest run tests/studio-v2/pi-03-memory.test.js --maxWorkers=1 --no-file-parallelism`: **3/3**.
- `npm run build:site`: **106 test files / 567 tests passed**; assets and site generation passed.
  Bundles: PI-00 **823,439**, PI-01 **14,270**, PI-02 **1,122,557**, PI-03 **856,838** bytes;
  Service Worker precache: **188** entries.
- All PI-03 source, script, E2E and focused-test files passed `node --check`; `npm run check` passed.
  The final entry boundary scan found no bare PI/Node imports, `fetch`, XHR or WebSocket; the
  qualification manifest records `actualHarness: true`, `appBackend: false`, `providerProxy: false`,
  `policyBound: true` and `crossTabWriterGuard: true`. The bundle's third-party optional Node
  capability strings are not executable imports on the qualified path.
- Existing AGRUN session/policy regressions: **18/18** across Chromium, Firefox and WebKit.
  `git diff --check` completed with exit 0; its only output is existing line-ending warnings.
- Final bounded line inventory: PI-03 source/script/E2E/test files are 5–227 lines; `TASK.md` is
  297 lines and the shared implementation evidence remains 300 lines.

## G4 — browser acceptance

PI-03 cases 16-01..06 passed **18/18**: Chromium 6/6, Firefox 6/6 and WebKit 6/6. The run proves
actual `AgentHarness` attachment, volatile policy modes, persistent Synthetic reopen, atomic CAS,
legacy isolation, fail-closed storage/lifecycle behavior and explicit cross-tab writer protection.

## G5 — release-boundary decision

S16 is locally closed in its isolated artifact. The production AGRUN entry, canonical project/revision
owner, CAS, private human approval/export, Unknown/Real restrictions, existing records and protocol
compatibility remain unchanged. No deployment, publish, push, release approval, real business data,
live provider, Edge/Safari.app, physical print or user-data deletion was performed. PI-04 composed
acceptance is the next dependency-ready step; PI-05 cutover and release certification remain open.
