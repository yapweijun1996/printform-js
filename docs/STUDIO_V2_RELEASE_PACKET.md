# Studio v2 Local Release Review Packet (Draft)

Status: **Reviewable local packet; release not approved.** This packet is an evidence index and
completion audit, not a Production Ready declaration, deployment authorization, or maintainer decision.

Prepared: 2026-09-10; last audited after the local application/browser-matrix commit. Current review revision: `a4caf93857669e05d0d521567ecf5ab6f4389df5`; prior application review revision: `e4302009e461ae398476ec63043c888cd19a07a`; Windows Firefox runner commit: `93a4f2055f9e30dc75f7df06c9e4ba3c1baebff0`; P0 confirmation-test commit: `59f4fe7`.
The current source/runner delta is exactly `a4caf93857669e05d0d521567ecf5ab6f4389df5`; its path list is reviewable with `git show --stat`.
The runner-only configuration and P0 confirmation-test commits are recorded separately as test provenance.
The S16/S17 application changes are committed in the application review revision; the
Windows-only Firefox `--disable-gpu` runner adjustment is a separate test-only local commit and keeps
content sandboxing enabled. `main` is ahead of `origin/main` by local review commits. No PR
metadata or outgoing push is present in this checkout. No deployment, publish, user-data deletion, or direct-BYOK
Provider acceptance is claimed. The current Demo Gateway run is recorded below as supporting evidence.

## 1. Prompt-to-artifact completion checklist

| Requirement | Evidence owner | Current result and limitation |
|---|---|---|
| Sequential TASK ledger and dependency order | `TASK.md`, `docs/STUDIO_V2_DEFINITION_OF_DONE.md`, `docs/STUDIO_V2_EXECUTION_PLAN.md` | S01-S16 are Done; S17 is the only active step at G1/10%. S18-S21 remain dependent/open. |
| Requalify S16 deferred-close, CAS, lifecycle and browser boundaries | `docs/STUDIO_V2_S16_PI03_EVIDENCE.md` | G1-G5/100%; 16-01..06 passed 18/18 across Chromium, Firefox and WebKit, with focused lifecycle/privacy regressions. |
| Actual browser Harness acceptance | `e2e/studio-v2-pi-04.spec.js`, `e2e/studio-v2-pi-04-privacy.spec.js`, `e2e/studio-v2-pi-04-transaction.spec.js` | 17-01..09 passed 27/27 across three configured engines. These are isolated PI supporting cases with synthetic Provider interception; they do not close S17 live-provider or cutover gates. |
| Production-shell X-01..03 | `e2e/studio-v2-p0-x01.spec.js`, `e2e/studio-v2-p0-x02-x03.spec.js`, `docs/STUDIO_V2_P0_ACCEPTANCE.md` | Combined command passed 9/9 across Chromium, Firefox and WebKit; current P0 register is 35/35 Pass after the focused 13-07 Demo-origin requalification. Controlled AGRUN/BYOK is not PI live-provider evidence. |
| Canonical revisions, CAS and stale-result rejection | `docs/STUDIO_V2_S16_PI03_EVIDENCE.md`, `docs/STUDIO_V2_S17_PI04_EVIDENCE.md`, `docs/STUDIO_V2_P0_ACCEPTANCE.md` | Current revision/hash ownership, atomic commit recovery, delayed policy/scope rejection and cross-document isolation are evidenced. |
| Scope isolation | P0 X-02/X-03 and PI 17-02/17-03 browser cases | Old policy/mode/scope result and document-A callback do not change the current document; no candidate/evidence leak was observed. |
| Private human approval/export and no automatic download | P0 X-01 and PI 17-01/17-08 evidence | Human Apply/review/export boundaries and uncertain-commit recovery are covered; export is confirmed-only. |
| Unknown/Real privacy semantics and canary sinks | P0 X-01/X-02, PI 17-09, `docs/STUDIO_V2_DATA_POLICY.md` | Synthetic canary is absent from storage, prompts, bodies and qualification output; authorized export sink is the only confirmed sink. Provider retention is unverified. |
| Old-record/protocol compatibility | S16 evidence and `docs/STUDIO_V2_PI_HARNESS_MIGRATION.md` | Legacy records remain read-only/isolated and AGRUN remains the production entry; PI cutover is deliberately not started. |
| Frontend-only direct BYOK | `site-dist/studio-v2/pi-04/qualification-manifest.json`, PI 17-04..07 | `appBackend:false`, `providerProxy:false`, direct Chat/Responses/Gemini and follow-up cases are recorded. Direct-BYOK live CORS/quota/reliability is unrun; the separate Demo route is supporting-only. |
| Focused and repository checks | `docs/STUDIO_V2_IMPLEMENTATION_EVIDENCE.md` | Recorded: `npm run doctor` 5/5 with 106 files/571 tests, focused 57/57, current local browser matrix 88/88, `npm run check`, JS syntax checks, `git diff --check`, and <=300-line inventory passed. |
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

This packet is independent S20 preparation only. The packet/index/checklist edits record current source commit
`a4caf93857669e05d0d521567ecf5ab6f4389df5` and do not grant gate credit. It does not bypass S17 or authorize AGRUN retirement,
deployment, publishing, physical print, or maintainer approval.

## 3. Recorded verification commands and results

- `npx playwright test e2e/studio-v2-p0-x01.spec.js e2e/studio-v2-p0-x02-x03.spec.js --workers=1`
  — **9/9**, Chromium/Firefox/WebKit.
- `npx playwright test e2e/studio-v2-pi-04.spec.js e2e/studio-v2-pi-04-privacy.spec.js e2e/studio-v2-pi-04-transaction.spec.js --workers=1`
  — **27/27**, Chromium/Firefox/WebKit; synthetic direct-provider wire.
- Current-source combined local target run for P0 X-01..03 and PI-04 supporting cases — **36/36**, Chromium/Firefox/WebKit;
  synthetic provider interception remains supporting evidence and does not close S17. The earlier **54/54** command
  also included PI-03 and used the pre-a4caf93 runner/source baseline, so it is historical.
- Latest full P0 browser sweep before Gateway origin registration: **102/105** passed; the only three failures were
  13-07 across Chromium, Firefox and WebKit because the local Demo project origin was not registered. The no-secret
  `/demo/session` probe returned HTTP **403** at that time; per the Gateway guide this denoted an unregistered project
  origin, before any `/demo/v1/responses` request. This historical failure is superseded for 13-07 by the registered-origin
  requalification below; no provider failure was converted into a mock Pass.
- After the Gateway admin registration, `npm run test:e2e -- --grep "PROD-13 13-07"` passed **3/3** across Chromium,
  Firefox and WebKit on the current source. The real browser session returned `201 Created` and models returned `200`
  for the registered local origins; the test captured the synthetic final `/demo/v1/responses` request body before sending
  a provider turn. No token or credential was recorded, and this remains browser transport/disclosure evidence rather than
  live Provider reliability or retention certification.
- A current-source one-turn Chromium probe against the registered local origin reached `Printable`, issued
  `/demo/session` with no Authorization and received **201**, then observed two `/demo/v1/responses` requests returning
  **200** with an in-memory Demo-session Authorization header. Default Auto mode committed one safe proposal (`r0` → `r1`),
  showed Applied/Undo, and completed layout review while keeping human print-preview/export confirmation required. No
  manual Apply, export, deletion, token, credential or response body was recorded. This is supporting Demo reachability
  evidence only and earns no S17/PI-04 direct-BYOK credit.
- Prior application-baseline Demo Gateway browser run (commit `e4302009e461ae398476ec63043c888cd19a07a`):
  `demo-fast` design and layout-review Responses streams returned **200**; Preview mode showed a pending candidate,
  one real UI Apply produced revision 1, `request_export` kept human confirmation required, and text-only,
  single-image and all-image original/resized variants passed **7/7** with validated Synthetic pixels. Ten Demo request
  bodies had no key/session/canary markers or forbidden top-level fields; private `/v1` request count was **0**, with
  no page or console errors. Since current commit `a4caf93857669e05d0d521567ecf5ab6f4389df5` changes preview source
  assignment, this broad flow is baseline supporting evidence, not current-source acceptance or direct-BYOK PI-04
  closure; current-source Demo evidence is limited to the focused 13-07 rerun above. Details are in [S17 evidence](STUDIO_V2_S17_PI04_EVIDENCE.md).
- The pre-a4caf93 2026-09-10 repeat of the 54-test command reached Chromium **18/18** and WebKit **18/18**, while all Firefox cases
  failed before page creation with `browserContext.newPage`; teardown then hung and the test session was interrupted. This is
  environment diagnostics only; the last complete pre-a4caf93 54/54 run is historical. The current a4caf93 P0/PI-04
  target command passed 36/36.
- A no-page Firefox launch smoke reproduced the same error: the main process launched, but `GeckoChildProcessHost`
  repeatedly failed to start tab/utility subprocesses and `remoteTab` became null. This confirms an external Firefox
  process/runtime condition before project code executes; no PI code change or gate credit was made.
- A Firefox-only diagnostic with `MOZ_DISABLE_CONTENT_SANDBOX=1` then passed **18/18** for the same target cases. The
  variable weakens browser isolation, so it was not committed or added to the default test configuration; this is not
  native Firefox acceptance evidence and earns no gate credit.
- After the Windows-only Firefox runner adjustment in commit `93a4f2055f9e30dc75f7df06c9e4ba3c1baebff0`, the pre-a4caf93 standard
  54-test command passed **54/54** across Chromium, Firefox and WebKit with content sandboxing enabled. One preceding
  run was **53/54** because Firefox teardown raised a protocol error after page assertions passed; a standalone retry
  passed **1/1**, followed by the complete **54/54** run. The current a4caf93 P0/PI-04 target command passed **36/36**.
- `npm run doctor` — **5/5**; its unit/build stage passed **106 files / 571 tests**, rebuilt the three PI bundles and produced a Service Worker with **203** entries.
- `npm run check` — pass; PI-04 source/build `node --check` — pass; `git diff --check` — pass.
- Current generated artifact hash readback matched the recorded PI-04 entry, PI-04 manifest, default Studio entry and Service Worker: **4/4**, with no hash drift.
- Sequential `npm run validate:v2 -- ...` passed for `sales-invoice-v2.html`,
  `purchase-order-red-v2.html` and `progress-claim-northpeak-v2.html`: all had valid attestation/runtime/content
  hashes and no external network or arbitrary JavaScript. Each report explicitly had `layout.verified:false`,
  so these static checks do not replace browser layout or print evidence.
- `.github/workflows/ci.yml` now declares all three static pilot validators; a local structural check found exactly three entries. A remote CI run is intentionally unrun.
- `npx playwright test e2e/production-verification.spec.js --grep "opens the required progress claim" --project=chromium --workers=1` passed **1/1**. The real browser observed Printable, non-overflow metrics, a non-empty page count, the Progress Claim heading and no browser errors. This is one Chromium smoke case, not the full platform/scenario matrix.
- An earlier `node scripts/browser-matrix.mjs` attempt against the current `site-dist` reported **88 cells with problems** because the runner had not admitted the host gateway, tried to mutate human-approved fields through the Agent surface, and exposed a branded-Chrome first-`srcdoc` render race. That is retained as superseded diagnostic history, not current acceptance.
- After the smallest runner/preview correction, `node scripts/browser-matrix.mjs` (full, not `--quick`) passed **88/88** with **0 problem cells** on Windows: Chromium, branded Chrome, Firefox and WebKit each passed 22/22 across both samples, seven boundary scenarios and four non-default locales. `empty` was expected `blocked`; all other cells were `ready` with no overflow, vertical overflow, contrast or row-count problems. This is current local render evidence only and earns no S17 direct-BYOK or S20 closure credit by itself.
- The latest repository-wide Chromium run was **159/169 passed** with 10 failures; a serial rerun of the affected files was **17/22 passed**. The five reproduced failures are existing/environment-sensitive file-save, P0 control/pixel, and session-lifecycle cases outside the amended PI-03/PI-04 target set; this run is not release evidence and no unrelated fix was introduced.
- Current toolchain: Node `v25.2.1`, npm `11.6.2`, Playwright `1.62.0`.

The spec audit confirms that 17-01..03 assert zero external requests, 17-04..07/17-09 use
Playwright route interception with request-count/header/body redaction assertions, and 17-08 asserts
private transaction recovery without a second Agent Apply. These are bounded local/browser results.
A green synthetic run is not a live Provider, Edge, Safari.app, physical-printer, deployment-retention,
or approval result.

## 4. Artifact and provenance record

- PI-04 entry: `site-dist/studio-v2/pi-04/qualification-entry.js`, 1,212,588 bytes,
  SHA-256 `4fdf656912895823ce1c2c67856d1e643a1a5eb4a8219b8262599a3e208f099c`.
- PI-04 manifest: `site-dist/studio-v2/pi-04/qualification-manifest.json`,
  SHA-256 `5ee8d01dbcb4443e6bc2a4fc0fe7b50299223a23b8c91b2787521e44363dad95`.
- Manifest flags: static, frontend-only, actual Harness, policy-bound, private human approval,
  canonical CommandBus, `appBackend:false`, `providerProxy:false`, `providerMatrixSynthetic:true`,
  `liveByokSmoke:false`.
- The manifest's `sourceCommit` value is the reviewed upstream pi commit
  `b2602be77cb7b0de45dd616407fd210daa48aa75`, as documented in
  `docs/STUDIO_V2_PI_HARNESS_MIGRATION.md`; it is intentionally not a local repository commit.
- The local application source identity is commit `a4caf93857669e05d0d521567ecf5ab6f4389df5`; the
  generated artifact was rebuilt through `scripts/build-pi-04.mjs`. `site-dist/` remains ignored and
  unpublished. The production Studio entry remains AGRUN.

## 5. S18/PI-05 dependency inventory (preparation only)

- The current default source and generated entry are `studio-v2/index.html` and
  `site-dist/studio-v2/index.html`, both still load `./vendor/agrun.min.js` with the reviewed
  integrity value; generated entry SHA-256 is `cab56aecec5b68514cc9c586f8ed78b062e86f9183d53106524bcc566feb74dd`.
- `scripts/build-site.mjs` builds isolated PI-00..PI-04 qualification artifacts and then stamps
  `studio-v2/sw.js`; it does not wire PI into the default Studio entry. The generated Service Worker
  currently has 203 app-shell entries, includes both AGRUN and isolated PI assets, and uses local cache
  build id `local` (`site-dist/studio-v2/sw.js` SHA-256 `c9572c9aeccbfada01346264ff8e08adb92a0d85f139e336dceb259bc400ba4b4`).
- Cutover owners and rollback constraints are recorded in `docs/STUDIO_V2_PI_HARNESS_MIGRATION.md`:
  retire AGRUN only after PI-04, preserve legacy read-only history, test old-worker upgrade, and
  restore a previously verified static artifact with its matching cache manifest. No default cutover,
  cache migration or AGRUN retirement is authorized now; S18 receives no TASK credit.

## 6. Open gates and exact unblock inputs

1. **S17/PI-04:** an authorized direct-BYOK Provider profile: approved frontend origin/CORS behavior,
   credential supplied through the approved runtime store, model/quota/reliability window, and
   redacted request/response evidence. Demo Gateway origin/session evidence is complete as supporting
   evidence only; no key belongs in this packet or prompt.
2. **S18/PI-05:** only after S17 closure, locally test PI default entry, AGRUN retirement, service-worker
   upgrade, legacy reads and rollback; do not cut over now.
3. **S19/PROD-10:** adopt the exact OS/browser/version/template/paper/locale/size profile and obtain
   actual system-print/manual evidence. Playwright WebKit is not Safari.app and no physical printer
   evidence is currently available.
4. **S20/S21:** reconcile the final artifacts and obtain explicit maintainer approval for the exact
   profile/version/artifacts. CI configuration now declares three pilot validators; one Progress Claim
   Chromium smoke passes, and the current local full matrix passes 88/88; the remote CI run, declared
   platform/print profile and final artifact alignment remain unverified. Approval is not inferred from
   counters.

## 7. Rollback and decision boundary

Until the open dependencies are satisfied, keep the AGRUN production entry and canonical committed
records unchanged. A rejected qualification must roll back through the reviewed source/artifact change
set, never by deleting user records or weakening Unknown/Real, CAS, scope, approval, or export guards.

Decision requested from the maintainer when unblocked: approve or reject the exact source revision,
static artifact hashes, adopted platform/print profile, known limitations, and rollback procedure.
No deployment or publish action is included in this draft.
