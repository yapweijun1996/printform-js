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
- Standalone Print preview: inherited CSP nonce and runtime order corrected; the topbar action is now an inline printer SVG with localized accessible labeling; Chromium popup rendered populated `.printform_page` content with no page or console errors, 2/2 regression cases passed; no gate credit.
- Topbar Validate control: inline check SVG with localized accessible labeling; Chromium topbar regression including the click/Toast path passed; no gate credit.
- Inspector header actions: New, Review, Sessions, Settings and Close now use inline SVG icons; Settings uses a centered standard cog path; the redundant AI brand/status block is removed while hidden `#ai-status` remains the live region; focused panel/i18n unit suite 25/25 (UI i18n 7/7) and current Chromium E14/AI/Inspector regressions 16/16 passed; no gate credit.
- Current PI-04 generated artifact: cases 17-01..09 requalified serially in Chromium **9/9**; synthetic supporting evidence only, no S17 gate credit.
- AI Designer launcher: removed the bottom-right floating `#ai-floating-launcher` markup, styles and binding while preserving the topbar open/close/focus cycle; Chromium topbar/layout regression passed 4/4 and asserted zero floating nodes; no gate credit.
- CI repair: remote CI #50-#54 stopped at `npm ci` with npm 10 missing `@emnapi/core@2.0.0-alpha.5` and `@emnapi/runtime@2.0.0-alpha.5`; local repair commit `18fd2f8` adds the lock entries and npm 10 dry-run passes. CI #55 passed `npm ci` but exposed a test assumption about the shared default CDP port; CI #56 still failed after the test used explicit `http://127.0.0.1:0`, because `mcp/server.mjs` exited on stdin close before the asynchronous response was written. Local commit `3862047` drains pending requests before shutdown; Node 22/25 focused tests, 100-repeat RPC, and the full local build pass. Follow-up commit `0cb3cc0` aligns Demo isolated-runtime fixtures, synthetic pixel policy admission and cross-browser resize key dispatch; CI-mode full local run completed **475 passed, 1 flaky Service Worker cache-warm-up case, 34 skipped, 0 final failures**. The 2026-09-11 offline follow-up reran `npm run doctor` **5/5**, mock provider/privacy tests **39/39**, and `npm ci --dry-run --ignore-scripts` passed; package hygiene found one local extraneous dependency, npm pack warned that `.npmignore` is absent, and Secretlint was not runnable because no config exists. Remote rerun remains unrun. No gate credit.
- P0 register: 35 Pass, 0 Fail, 0 Not run.

## Blockers and next action

No local implementation blocker is recorded. Remaining blockers are authorized live provider/quota/retention evidence, unavailable or unrun platform/print surfaces, deployment-retention proof and maintainer approval. Next: execute S17/PI-04 one case at a time, starting with the remaining final provider/render/privacy/transaction matrix; update [TASK.md](TASK.md) after each gate.
