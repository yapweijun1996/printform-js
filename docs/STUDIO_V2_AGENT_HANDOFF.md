# Studio v2 Agent Handoff

Prepared: 2026-09-10. This handoff records the completed S16 requalification, the current supporting S17/PI-04 browser cases, the real Demo Gateway pilot run and the current-source local render matrix; the direct-BYOK provider/privacy/transaction matrix is still the next scoped step.
The continuation prompt authorizes the next agent's scoped local implementation.
Intended operator: PI coding agent, user-selected GPT 5.6 Luna / max.
Model choice does not change evidence, privacy or approval requirements.

## Authority and read order

1. Read repository and applicable directory AGENTS instructions.
2. Read [TASK](../TASK.md#sequential-execution-ledger), [DoD](STUDIO_V2_DEFINITION_OF_DONE.md)
   and [execution plan](STUDIO_V2_EXECUTION_PLAN.md).
3. Read [step worksheets](STUDIO_V2_STEP_CHECKLISTS.md) and the selected step's owners.
4. Read [production requirements](STUDIO_V2_PRODUCTION_PLAN.md),
   [P0 cases](STUDIO_V2_P0_ACCEPTANCE.md), [PI migration](STUDIO_V2_PI_HARNESS_MIGRATION.md),
   [data policy](STUDIO_V2_DATA_POLICY.md),
   [output boundary](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) and linked field/shape contracts.
5. Read [release checklist](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md).

TASK alone owns live gate credit. Worksheets define acceptance, not duplicate live status.
Case registers own case results; evidence records own commands and observations.
Preserve conflicting dated paragraphs as history and investigate the current delta.

## Dated snapshot

- Observed current application review revision: `a4caf93857669e05d0d521567ecf5ab6f4389df5`; documentation follow-up HEAD is `00e2252e8acfc154205f4ccf7e8191cee5b4ffa6`. The prior application review baseline is `e4302009e461ae398476ec63043c888cd19a07a`.
- S01-S16 retain Done; S17 is at G1 only and is now the next dependency-ready step.
- S18-S21 have no gate credit. Done: 16/21.
- Plan: `(16*100 + 10)/21 = 76.7%`, rounded to one decimal.
- P0: 35/35 Pass = 100%; 0 Fail; 0 Not run. X-01..03 are closed by `e2e/studio-v2-p0-x01.spec.js` and `e2e/studio-v2-p0-x02-x03.spec.js` through the production Studio shell; isolated PI X-01..03 runs remain supporting evidence for S17.
- PI: PI-00..03 Done, 4/6 = 66.7%; PI-04/05 incomplete.
- The temporary 72.4% total while S16 was reopened is superseded by current TASK credit.
- No release approval or completed direct-BYOK live-provider/platform/actual-print certification; the Demo Gateway run is supporting evidence only.
- Earlier local S20 matrix attempt produced 88/88 problem cells from runner admission/mutation and branded-Chrome first-render issues. After the smallest correction in `a4caf93857669e05d0d521567ecf5ab6f4389df5`, `node scripts/browser-matrix.mjs` passed **88/88** across Chromium, branded Chrome, Firefox and WebKit. This is current local render evidence only and earns no S17/S20 closure by itself.

## First action: preserve and identify the working tree

- Run `git status --short` and `git rev-parse HEAD`; inspect relevant diffs before editing.
- Preserve documentation and source changes, including `studio-v2/pi-03/policy-session-repo.js`,
  `studio-v2/pi-02/host-adapter.js`, `studio-v2/pi-04/qualification-cases.js`, `studio-v2/pi-04/qualification-env.js`
  and `e2e/studio-v2-pi-04.spec.js`. Do not blindly revert or reimplement them.
- Inspect sizes, applicable instructions, current owners/callers/tests and bundle provenance.
- An old passing generated bundle does not qualify changed source. Keep amended files <=300 lines.
- Never read/print provider secrets or reuse another environment's credentials.

## Completed S16 / PI-03 requalification

Read [S16 evidence](STUDIO_V2_S16_PI03_EVIDENCE.md) for the current-source record and
[S17 evidence](STUDIO_V2_S17_PI04_EVIDENCE.md) for the current PI-04 limits and supporting cases.
The deferred-close and pending-open corrections were traced, implemented and requalified in the
actual browser Harness. Six frozen cases passed 18/18 across Chromium, Firefox and WebKit;
focused lifecycle/privacy regressions passed 31/31, the full build passed 106 files / 571 tests,
and the final static artifact hashes are recorded in S16 evidence. Writer locks, retired sessions,
retired databases and failed initialization paths are released without deleting user data.

S16 G1-G5 is complete. The production AGRUN entry, existing records, protocol compatibility,
canonical CAS, private approval/export and Unknown/Real restrictions remain unchanged.

## Continue S17 / PI-04

X-01, X-02 and X-03 each have isolated three-engine supporting results; read each P0 case verbatim
before attempting the remaining final matrix. P0 X-01..03 additionally have separate three-engine production-shell
browser results recorded in the P0 register and S17 evidence.

- The isolated PI X-01 remains supporting evidence: candidate and committed revisions now render through the actual
  sandboxed iframe/runtime with geometry reports. Its approval/export path is not PI cutover evidence; the separate
  production-shell cases use real UI actions with controlled in-page AGRUN/BYOK setups and do not prove live Provider.
- X-02's earlier Node probes returned `HARNESS_HANDLER_ERROR` / `TERMINAL_ACTION_REQUIRED` with no
  proposal/revision; the later browser case passed after the minimal host-envelope correction. This
  supporting result does not establish full P0 closure or session-close timing as the cause.
- X-03's browser case passed cross-document delayed-callback isolation; it remains supporting evidence.
- PI-04 cases 17-04..09 now cover synthetic direct Chat/Responses/Gemini, follow-up, commit recovery and Real-policy privacy; all remain supporting evidence.
- The prior application-baseline Demo Gateway run at `e4302009e461ae398476ec63043c888cd19a07a` covers registered-origin session/models, a 200 SSE design turn, a 200 SSE layout review, preview/apply transaction read-back, seven synthetic media request variants and no-key/private-route privacy checks. Current `a4caf93857669e05d0d521567ecf5ab6f4389df5` changed preview source assignment, so retain that broad run as baseline supporting evidence; current-source Demo evidence now includes the focused 13-07 rerun, a transport probe and a fresh Chromium UI transaction probe (session 201, two Demo Responses 200, Preview/UI Apply `r0` → `r1`, layout review, production download fallback with revision-1 attestation PASS, no raw secret retained). See [S17 evidence](STUDIO_V2_S17_PI04_EVIDENCE.md). Neither qualifies the PI direct-BYOK route.
- Other historical probes stopped before rendering at `SCOPE_VIOLATION` or `COMMAND_FAILED`.
  Unsettled top-level await is incomplete evidence, not proof of a deadlock.
- Use actual Harness tools/events, actual rendering and final provider-wire evidence including
  follow-up requests; verify policy sinks, races, transaction scope and private approval.
- Separate deterministic adapter tests from live HTTPS provider qualification. Record redacted
  request shape, provider/model, allowed origin and CORS behavior, never keys or Real payloads.
- Missing direct-BYOK key/provider access/target origin/authorization is a precise blocker, not permission
  to add an application backend, proxy or mock Pass; the available Demo Gateway remains supporting-only.

## Command entry points: instructions, not new passing results

Inspect current package scripts and Playwright configuration before executing these commands.

```powershell
git status --short
git rev-parse HEAD
npx vitest run tests/studio-v2/pi-03-memory.test.js --maxWorkers=1 --no-file-parallelism
npm run build:site
npx playwright test e2e/studio-v2-pi-03.spec.js --workers=1
npx playwright test e2e/studio-v2-pi-02.spec.js --workers=1
npx playwright test e2e/studio-v2-pi-04.spec.js --workers=1
```

`npm run check` checks dist/printform.js, not every amended source file.
A passing isolated X-01..03 suite cannot qualify the remaining PI-04 provider/render/privacy/transaction matrix by its total.
The focused builder exports a function; executing the module alone does not build:
`node --input-type=module -e "import { buildPi04 } from './scripts/build-pi-04.mjs'; await buildPi04()"`.
Check configured static server (historically port 4174), bundle hashes and stale artifacts.
Use synthetic fixtures; do not publish generated output.

## Operating loop and tracking

1. Select the first unfinished dependency-ready step; keep only one active step.
2. Select one case; inspect existing controls/evidence and freeze expected checks at G1.
3. Make the smallest complete correction or prove existing implementation sufficient.
4. Run focused and composed checks; record failures, skips and unrun checks explicitly.
5. Record date, HEAD plus relevant dirty delta/hash, owners, command, runtime/browser/version,
   synthetic fixture, expected/actual, artifact link, reuse limits, blocker and next action.
6. Update owning case register and TASK before continuing. Partial gates earn no points.
7. Recompute every row: G1/G2/G3/G4/G5 = 10/40/30/15/5; cumulative 0/10/50/80/95/100.
   Keep plan sum/21, fully Done/21, P0 Pass/35 and PI Done/6 separate. Invalidate stale credit.
8. Continue automatically within authorization; on a real blocker do only independent work.

Report in Mandarin: step/status, G1-G5, earned points, plan/P0/PI percentages, evidence,
failed/unrun checks, precise blocker and next bounded action. Use DoD templates.
Do not copy this dated snapshot forward without recalculating TASK.

## Release packet and stopping boundary

The current local draft is [STUDIO_V2_RELEASE_PACKET.md](STUDIO_V2_RELEASE_PACKET.md); it must link exact revision/worktree/artifact hashes, adopted scope/profile, dependency gates,
case matrix, provider/browser/OS versions, actual-print evidence, privacy/security verification,
diagnostics, failures/unrun checks, known limitations, rollback and explicit approval request. The earlier
full matrix failure is superseded by the current 88/88 local render result; do not treat it as provider or
print certification.
Unavailable provider/platform/printer evidence stays open; do not silently waive or simulate it.
S18 cannot bypass S17. Independent S20 packet drafting is allowed but does not close later gates.
S21 requires explicit maintainer approval for exact profile/version/artifacts.
Do not deploy, push, delete user data, click a user's production export approval or declare
Production Ready without applicable authorization and evidence.
