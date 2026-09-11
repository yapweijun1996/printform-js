# PROGRESS.md — Studio v2 derived progress

> Read-only projection reviewed 2026-09-11. [TASK.md](TASK.md) owns the numbers; this file must never award gate credit.

## Dashboard

| Metric | Current | Meaning |
|---|---:|---|
| Plan closure | 76.7% (1610/21) | Sum of delivery percentages / 21 |
| Done steps | 16/21 (76.2%) | Fully closed execution steps |
| P0 cases | 35/35 (100%) | Case register only; not Production Ready |
| PI steps | 4/6 (66.7%) | PI-00 through PI-03 closed; PI-04/05 remain |
| S17 delivery | 10% | G1 only; `x----` |

## Step state

- **Done:** S01-S16, including PI-00 through PI-03.
- **Active:** S17 / PI-04 / M4. Current-source Demo Gateway browser checks are supporting-only; direct-BYOK/provider/platform closure remains open.
- **Pending:** S18 / PI-05, S19 / PROD-10, S20 / PROD-12 and S21 / release decision.

## S17 closure breakdown

| Area | Status | Evidence boundary |
|---|---|---|
| G1 entry/build/cache/rollback | Pass | Current-source handoff and packet inventory |
| Provider authorization/input | Open | No authorized live direct-BYOK provider window |
| Chat/Responses provider wire | Supporting | Synthetic adapter cases; Demo Gateway route is not provider certification |
| Render/follow-up/cancel/error | Supporting | Browser harness evidence exists; final provider-backed matrix is open |
| Unknown/Real privacy/retention | Partial | Application controls exist; sink/deployment retention is unverified |
| Commit/recovery/private approval | Supporting | Transaction controls pass in bounded runs; final matrix remains open |
| Platform/print/export | Open | Edge/Safari.app, native print preview, Save As and physical print remain unrun |

## Verified checks

- `npm run doctor`: 5/5, 106 files / 571 tests.
- `node scripts/browser-matrix.mjs`: 88/88 current local render matrix.
- Current-source 13-07: 3/3 across Chromium, Firefox and WebKit.
- S17 cases 17-01..09: 27/27 supporting evidence across three engines.
- Service Worker response-clone regression: policy unit 2/2 and Chromium cache-boundary E2E 1/1; no gate credit.
- Topbar language control: SVG globe-only button, five-locale listbox, ARIA state and keyboard navigation verified in the Chromium AI/localization regression 10/10; no gate credit.
- P0 register: 35 Pass, 0 Fail, 0 Not run.

## Blockers and next action

No local implementation blocker is recorded. Remaining blockers are authorized live provider/quota/retention evidence, unavailable or unrun platform/print surfaces, deployment-retention proof and maintainer approval. Next: execute S17/PI-04 one case at a time, starting with the remaining final provider/render/privacy/transaction matrix; update [TASK.md](TASK.md) after each gate.
