# Studio v2 Local Release Review Packet (Draft)

Status: **Reviewable local packet; release not approved.** This packet is an evidence index and
completion audit, not a Production Ready declaration, deployment authorization, or maintainer decision.

Prepared: 2026-09-09T16:44:39+08:00; last audited 2026-09-10T09:20:25+08:00. Application review revision: `7361f3e9d422861dbce38b54ef10b7945de923b0`; Windows Firefox runner commit: `93a4f2055f9e30dc75f7df06c9e4ba3c1baebff0`.
Application delta manifest for the application review revision (non-doc tracked/untracked source, test and build paths):
`5ba8a9d695f80b739b90b94394c6a156e0907b814b4bb2a92d5fa1a88e66357e`.
The runner-only configuration commit is intentionally outside this application manifest and is recorded separately as test provenance.
The S16/S17 implementation and evidence changes are committed in the application review revision; the
Windows-only Firefox `--disable-gpu` runner adjustment is a separate test-only local commit and keeps
content sandboxing enabled. `main` tracks `origin/main` and contains the local review commits. No PR
metadata or outgoing push is present in this checkout. No deployment, publish, user-data deletion, or
live Provider request was made.

## 1. Prompt-to-artifact completion checklist

| Requirement | Evidence owner | Current result and limitation |
|---|---|---|
| Sequential TASK ledger and dependency order | `TASK.md`, `docs/STUDIO_V2_DEFINITION_OF_DONE.md`, `docs/STUDIO_V2_EXECUTION_PLAN.md` | S01-S16 are Done; S17 is the only active step at G1/10%. S18-S21 remain dependent/open. |
| Requalify S16 deferred-close, CAS, lifecycle and browser boundaries | `docs/STUDIO_V2_S16_PI03_EVIDENCE.md` | G1-G5/100%; 16-01..06 passed 18/18 across Chromium, Firefox and WebKit, with focused lifecycle/privacy regressions. |
| Actual browser Harness acceptance | `e2e/studio-v2-pi-04.spec.js`, `e2e/studio-v2-pi-04-privacy.spec.js`, `e2e/studio-v2-pi-04-transaction.spec.js` | 17-01..09 passed 27/27 across three configured engines. These are isolated PI supporting cases with synthetic Provider interception; they do not close S17 live-provider or cutover gates. |
| Production-shell X-01..03 | `e2e/studio-v2-p0-x01.spec.js`, `e2e/studio-v2-p0-x02-x03.spec.js`, `docs/STUDIO_V2_P0_ACCEPTANCE.md` | Combined command passed 9/9 across Chromium, Firefox and WebKit; P0 register is 35/35. Controlled AGRUN/BYOK is not PI live-provider evidence. |
| Canonical revisions, CAS and stale-result rejection | `docs/STUDIO_V2_S16_PI03_EVIDENCE.md`, `docs/STUDIO_V2_S17_PI04_EVIDENCE.md`, `docs/STUDIO_V2_P0_ACCEPTANCE.md` | Current revision/hash ownership, atomic commit recovery, delayed policy/scope rejection and cross-document isolation are evidenced. |
| Scope isolation | P0 X-02/X-03 and PI 17-02/17-03 browser cases | Old policy/mode/scope result and document-A callback do not change the current document; no candidate/evidence leak was observed. |
| Private human approval/export and no automatic download | P0 X-01 and PI 17-01/17-08 evidence | Human Apply/review/export boundaries and uncertain-commit recovery are covered; export is confirmed-only. |
| Unknown/Real privacy semantics and canary sinks | P0 X-01/X-02, PI 17-09, `docs/STUDIO_V2_DATA_POLICY.md` | Synthetic canary is absent from storage, prompts, bodies and qualification output; authorized export sink is the only confirmed sink. Provider retention is unverified. |
| Old-record/protocol compatibility | S16 evidence and `docs/STUDIO_V2_PI_HARNESS_MIGRATION.md` | Legacy records remain read-only/isolated and AGRUN remains the production entry; PI cutover is deliberately not started. |
| Frontend-only direct BYOK | `site-dist/studio-v2/pi-04/qualification-manifest.json`, PI 17-04..07 | `appBackend:false`, `providerProxy:false`, direct Chat/Responses/Gemini and follow-up cases are recorded. Live CORS/quota/reliability is unrun. |
| Focused and repository checks | `docs/STUDIO_V2_IMPLEMENTATION_EVIDENCE.md` | Recorded: `npm run doctor` 5/5 with 106 files/567 tests, `npm run check`, focused 30/30, JS syntax checks, `git diff --check`, and <=300-line inventory passed. |
| DoD/release evidence | `docs/STUDIO_V2_DEFINITION_OF_DONE.md`, `docs/STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md` | This packet indexes current evidence and open gates; it does not grant S20/S21 credit. |
| File-size boundary | Current amended source, E2E, script and packet inventory | Every amended file is at or below 300 lines; generated ignored artifacts are tracked by their owning build. |

## 2. TASK and gate snapshot

- Plan: **1610/21 = 76.7%; 16/21 steps Done**.
- P0: **35/35 Pass, 0 Fail, 0 Not run**.
- PI packages: **4/6 Done** (PI-00..03); PI-04 and PI-05 are not Done.
- S16: `xxxxx`, 100%, Done.
- S17: `x----`, 10%, Pending closure. G2-G5 receive no credit until the remaining matrix is complete.
- S18-S20: `-----`, 0%; S21: `-----`, pending approval.
- Release: **not approved**; Production Ready is not established.

This packet is independent S20 preparation only. The packet/index/checklist edits are documentation-only
and do not change the application delta manifest. It does not bypass S17 or authorize AGRUN retirement,
deployment, publishing, physical print, or maintainer approval.

## 3. Recorded verification commands and results

- `npx playwright test e2e/studio-v2-p0-x01.spec.js e2e/studio-v2-p0-x02-x03.spec.js --workers=1`
  — **9/9**, Chromium/Firefox/WebKit.
- `npx playwright test e2e/studio-v2-pi-04.spec.js e2e/studio-v2-pi-04-privacy.spec.js e2e/studio-v2-pi-04-transaction.spec.js --workers=1`
  — **27/27**, Chromium/Firefox/WebKit; synthetic direct-provider wire.
- Latest combined local target run for P0 X-01..03 and PI-04 supporting cases — **54/54**, Chromium/Firefox/WebKit;
  synthetic provider interception remains supporting evidence and does not close S17.
- The 2026-09-10 repeat of that 54-test command reached Chromium **18/18** and WebKit **18/18**, while all Firefox cases
  failed before page creation with `browserContext.newPage`; teardown then hung and the test session was interrupted. This is
  environment diagnostics only; the last complete 54/54 run remains the authoritative local target result.
- A no-page Firefox launch smoke reproduced the same error: the main process launched, but `GeckoChildProcessHost`
  repeatedly failed to start tab/utility subprocesses and `remoteTab` became null. This confirms an external Firefox
  process/runtime condition before project code executes; no PI code change or gate credit was made.
- A Firefox-only diagnostic with `MOZ_DISABLE_CONTENT_SANDBOX=1` then passed **18/18** for the same target cases. The
  variable weakens browser isolation, so it was not committed or added to the default test configuration; this is not
  native Firefox acceptance evidence and earns no gate credit.
- After the Windows-only Firefox runner adjustment in commit `93a4f2055f9e30dc75f7df06c9e4ba3c1baebff0`, the standard
  54-test command passed **54/54** across Chromium, Firefox and WebKit with content sandboxing enabled. One preceding
  run was **53/54** because Firefox teardown raised a protocol error after page assertions passed; a standalone retry
  passed **1/1**, followed by the complete **54/54** run.
- `npm run doctor` — **5/5**, including **106 files / 567 tests** and three static validators.
- `npm run check` — pass; PI-04 source/build `node --check` — pass; `git diff --check` — pass.
- Sequential `npm run validate:v2 -- ...` passed for `sales-invoice-v2.html`,
  `purchase-order-red-v2.html` and `progress-claim-northpeak-v2.html`: all had valid attestation/runtime/content
  hashes and no external network or arbitrary JavaScript. Each report explicitly had `layout.verified:false`,
  so these static checks do not replace browser layout or print evidence.
- `.github/workflows/ci.yml` now declares all three static pilot validators; a local structural check found exactly three entries. A remote CI run is intentionally unrun.
- `npx playwright test e2e/production-verification.spec.js --grep "opens the required progress claim" --project=chromium --workers=1` passed **1/1**. The real browser observed Printable, non-overflow metrics, a non-empty page count, the Progress Claim heading and no browser errors. This is one Chromium smoke case, not the full platform/scenario matrix.
- `node scripts/browser-matrix.mjs` (full, not `--quick`) was attempted against the current `site-dist`: **88 cells, 88 with problems**. Chromium, Firefox and WebKit reported missing `result.result` values during `validate_project`/revision calls; branded Chrome timed out waiting for the settled render status. This is failed diagnostic evidence, not a browser pass or S20 credit. The ignored `browser-matrix-result.json` is retained for the next investigation; historical 88/88 claims are not substituted.
- The latest repository-wide Chromium run was **159/169 passed** with 10 failures; a serial rerun of the affected files was **17/22 passed**. The five reproduced failures are existing/environment-sensitive file-save, P0 control/pixel, and session-lifecycle cases outside the amended PI-03/PI-04 target set; this run is not release evidence and no unrelated fix was introduced.
- Current toolchain: Node `v25.2.1`, npm `11.6.2`, Playwright `1.62.0`.

The spec audit confirms that 17-01..03 assert zero external requests, 17-04..07/17-09 use
Playwright route interception with request-count/header/body redaction assertions, and 17-08 asserts
private transaction recovery without a second Agent Apply. These are bounded local/browser results.
A green synthetic run is not a live Provider, Edge, Safari.app, physical-printer, deployment-retention,
or approval result.

## 4. Artifact and provenance record

- PI-04 entry: `site-dist/studio-v2/pi-04/qualification-entry.js`, 1,212,449 bytes,
  SHA-256 `acfe9ef8e2fab05797dddf72dbbcb73fc32332b3e9dc7156b62276d2cde9fdc0`.
- PI-04 manifest: `site-dist/studio-v2/pi-04/qualification-manifest.json`,
  SHA-256 `fd78fafd36bab247f353066264e5e40f66f7e35d8329c46b21f344d55737fea2`.
- Manifest flags: static, frontend-only, actual Harness, policy-bound, private human approval,
  canonical CommandBus, `appBackend:false`, `providerProxy:false`, `providerMatrixSynthetic:true`,
  `liveByokSmoke:false`.
- The manifest's `sourceCommit` value is the reviewed upstream pi commit
  `b2602be77cb7b0de45dd616407fd210daa48aa75`, as documented in
  `docs/STUDIO_V2_PI_HARNESS_MIGRATION.md`; it is intentionally not a local repository commit.
- The local application source identity is repository HEAD plus the intentionally dirty worktree
  listed by `git status --short`. The current generated artifact was rebuilt through
  `scripts/build-pi-04.mjs`; `site-dist/` remains
  ignored and unpublished. The production Studio entry remains AGRUN.

## 5. S18/PI-05 dependency inventory (preparation only)

- The current default source and generated entry are `studio-v2/index.html` and
  `site-dist/studio-v2/index.html`, both still load `./vendor/agrun.min.js` with the reviewed
  integrity value; generated entry SHA-256 is `cab56aecec5b68514cc9c586f8ed78b062e86f9183d53106524bcc566feb74dd`.
- `scripts/build-site.mjs` builds isolated PI-00..PI-04 qualification artifacts and then stamps
  `studio-v2/sw.js`; it does not wire PI into the default Studio entry. The generated Service Worker
  currently has 202 app-shell entries, includes both AGRUN and isolated PI assets, and uses local cache
  build id `local` (`site-dist/studio-v2/sw.js` SHA-256 `c9b09bbd7c99a4b605bb57fabcb5192779376b1c673ff82112809395c883cef3`).
- Cutover owners and rollback constraints are recorded in `docs/STUDIO_V2_PI_HARNESS_MIGRATION.md`:
  retire AGRUN only after PI-04, preserve legacy read-only history, test old-worker upgrade, and
  restore a previously verified static artifact with its matching cache manifest. No default cutover,
  cache migration or AGRUN retirement is authorized now; S18 receives no TASK credit.

## 6. Open gates and exact unblock inputs

1. **S17/PI-04:** an authorized live Provider profile: approved frontend origin/CORS behavior,
   credential supplied through the approved runtime store, model/quota/reliability window, and
   redacted request/response evidence. No key belongs in this packet or prompt.
2. **S18/PI-05:** only after S17 closure, locally test PI default entry, AGRUN retirement, service-worker
   upgrade, legacy reads and rollback; do not cut over now.
3. **S19/PROD-10:** adopt the exact OS/browser/version/template/paper/locale/size profile and obtain
   actual system-print/manual evidence. Playwright WebKit is not Safari.app and no physical printer
   evidence is currently available.
4. **S20/S21:** reconcile the final artifacts and obtain explicit maintainer approval for the exact
   profile/version/artifacts. CI configuration now declares three pilot validators; one Progress Claim
   Chromium smoke passes, while the full local matrix currently fails 88/88 (Harness result-shape and
   branded-Chrome render-settle symptoms), the remote CI run and final artifact alignment remain
   unverified. Investigate the current site/Harness/environment before rerunning; approval is not
   inferred from counters.

## 7. Rollback and decision boundary

Until the open dependencies are satisfied, keep the AGRUN production entry and canonical committed
records unchanged. A rejected qualification must roll back through the reviewed source/artifact change
set, never by deleting user records or weakening Unknown/Real, CAS, scope, approval, or export guards.

Decision requested from the maintainer when unblocked: approve or reject the exact source revision,
static artifact hashes, adopted platform/print profile, known limitations, and rollback procedure.
No deployment or publish action is included in this draft.
