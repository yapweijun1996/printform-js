# S17 / PI-04 Composed Acceptance Evidence

Date: 2026-09-09. Status: **In progress, G1 Investigated (10%)**. This record covers the
isolated composed PI path; the embedded production entry remains AGRUN.

## G1 — investigation and frozen acceptance

Source identity: `main` at `3a1a7dbb93de5edd7984842896afdaab42a92bed` plus the existing shared
uncommitted worktree. S16/PI-03, S12/PROD-09 and S13/PROD-11 are Done. No unrelated user changes
were reverted or overwritten.

Owners inspected:

- PI-02 `host-adapter.js`, `harness-tools.js` and `harness-events.js`: actual `AgentHarness`,
  sequential terminal guard, proposal/approval flow and safe event projection.
- PI-03 `PolicySessionRepo`: policy-bound volatile/persistent sessions, lifecycle guards and the
  separate IndexedDB namespace. The existing PI-02 host factory currently creates its own
  `MemorySessionRepo`; composed acceptance therefore needs an optional injected PI session without
  changing its existing default.
- Existing `CommandBus`, gateway adapter, transaction/approval/CAS services, render provenance and
  `studio-file-export.js`: canonical revision owner, private human approval, current review gates,
  Evidence Pack and truthful saved/download-started outcomes.
- P0 combined cases X-01..03 and the existing three-engine P0/PI fixtures. `STUDIO_V2_P0_ACCEPTANCE.md`
  remains the case authority; unit or prior AGRUN runs cannot be renamed as PI evidence.

Current versus target: production still uses AGRUN and its existing Demo Gateway pilot route. The
isolated target composes the actual PI Harness, policy-bound PI session, existing safe PrintForm
gateway, existing CommandBus transaction/CAS owner, private human approval and human export. The
target must preserve canonical revisions, Unknown/Real restrictions, existing records, protocol
compatibility and no automatic download.

## Frozen first case — X-01 Safe happy path

Import a synthetic canary fixture as Unknown; retain the restrictive document policy; select table A;
run in Preview mode; request one valid semantic edit; inspect the diff; apply only through private
human approval; render and review the current revision; then perform human export. Assert no
unauthorized canary persistence/exposure, exactly one edit revision, and an exported artifact whose
Evidence Pack identifies that revision. X-02 policy interleaving and X-03 cross-document isolation
remain subsequent cases and are not credited by X-01.

Required checks: focused composed unit coverage where a missing owner is found, isolated static build,
X-01 in Chromium/Firefox/WebKit, no external provider request in deterministic runs, existing PI-02
and PI-03 browser regressions, `npm run check`, `node --check`, `git diff --check` and <=300-line
inventory. Live BYOK/provider reliability, Edge, Safari.app, physical print, deployment and release
approval remain outside local qualification unless separately authorized.

Decision: add only the session injection needed to reuse the PI-02 host controls with PI-03, then
implement the PI-04 qualification environment and X-01 case. Keep later cases and any runtime cutover
pending until this first composed case has its own observed evidence.
