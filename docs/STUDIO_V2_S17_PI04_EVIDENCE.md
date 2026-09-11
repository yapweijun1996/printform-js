# S17 / PI-04 Composed Acceptance Evidence

Date: 2026-09-11. Status: **Pending closure, G1 Investigated (10%); S16 prerequisite closed, X-01..03 supporting cases recorded**. This record covers the
isolated composed PI path; the embedded production entry remains AGRUN.

## G1 — investigation and frozen acceptance

Source identity: current review revision `a4caf93857669e05d0d521567ecf5ab6f4389df5` (including the browser-matrix/preview-source correction); prior application review
revision `e4302009e461ae398476ec63043c888cd19a07a`; Windows Firefox runner
verification commit `93a4f2055f9e30dc75f7df06c9e4ba3c1baebff0`; this evidence and the release packet are refreshed
against that source revision; documentation-only follow-ups are tracked separately in Git and KB-MCP provenance. S16/PI-03, S12/PROD-09 and
S13/PROD-11 are Done. No unrelated user changes were reverted or overwritten.

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

## Current requalification log

### Case 17-02 — interleaved policy, mode and scope

Date: 2026-09-09; current PI-03 and PI-02 host sources plus generated PI-04 artifact. Expected: while an actual
Provider response is in flight, switching Unknown→Real, Auto→Preview and table-A→component scope must reject the
old result without a stale commit, canary disclosure or ready/saved misreport; committed content remains available.
The first browser attempt failed 3/3 because the host adapter replaced an upstream Harness failure with
`TERMINAL_ACTION_REQUIRED`. After the minimal envelope-preservation fix, `npx playwright test
e2e/studio-v2-pi-04.spec.js --grep "17-02" --workers=1` passed **3/3** (Chromium, Firefox, WebKit), and the
composed 17-01..02 run passed **6/6**. The final result observed `policy: real`, `applyMode: preview`, component
scope `table-a-header`, `run.ok: false`, `run.error: HARNESS_HANDLER_ERROR`, one projected runtime error,
`revision: 0`, unchanged committed project hash, `PREVIEW_REQUIRED`/`LAYOUT_REVIEW_REQUIRED`, and memory session
mode. Provider context and qualification output contained no canary; no external request occurred.

X-02 run artifact: `site-dist/studio-v2/pi-04/qualification-entry.js`, **1,212,252 bytes**, SHA-256
`165de582678b90395b25ad5b78f538b615fde3186af7dc76f3fbaef43ce164d7`; manifest SHA-256
`46701249fe242b338b3c205574e2fd8833ec2f35fbd672d10d4e7f7e184e5a0b`. Current generated artifact 17-02 Chromium requalification passed **1/1**. This remains supporting X-02 evidence;
the later X-03 result is recorded below, while the full provider/render/privacy/transaction matrix and final S17 gates remain open.

### Case 17-03 — cross-document isolation

Date: 2026-09-09; current PI-04 qualification source. Expected: an actual review callback captured for document A must not
write into unclassified document B after the active document changes; B must retain its policy, scope, revision,
project, evidence and chat state. The first browser attempt failed 3/3 because the qualification module omitted its
`BACKGROUND_CONTEXT` import; after the import correction, `npx playwright test e2e/studio-v2-pi-04.spec.js --grep
"17-03" --workers=1` passed **3/3**, and the composed 17-01..03 run passed **9/9**. The actual result started a
review on A, deactivated A on switch, rejected A's delayed callback as `HARNESS_HANDLER_ERROR`, kept A at revision 0
with a stable project hash, and left B as `unknown`, table-A scoped, Preview, revision 0, stable project hash,
no Evidence Pack and zero chat entries. B remained readiness-blocked with `PREVIEW_REQUIRED` and
`LAYOUT_REVIEW_REQUIRED`; no canary appeared in the qualification output and no external request occurred.

Current PI-04 artifact: `site-dist/studio-v2/pi-04/qualification-entry.js`, **1,212,669 bytes**, SHA-256
`f6940ab8c9c28307e43fcb70040e2d92165d7780da6624bdcfbbcb5d9a3c4856`; manifest SHA-256
`5ee8d01dbcb4443e6bc2a4fc0fe7b50299223a23b8c91b2787521e44363dad95`; the manifest records `x01`, `x02`, `x03`,
`directProviderChat`, `directProviderResponses`, `directProviderGemini`, `directProviderFollowUp`,
`directProviderCommitRecovery`, `directProviderRealPrivacy` and `providerMatrixSynthetic` as isolated supporting capabilities. The current generated artifact requalification for 17-01 passed **1/1** in Chromium; the prior current-source P0 X-01..03 plus PI-04 target command passed **36/36** across Chromium, Firefox and WebKit. The earlier 54/54 combined command included PI-03 and used the pre-a4caf93 runner/source baseline. This remains isolated supporting artifact evidence; the direct-BYOK provider/privacy/transaction matrix and final S17 gates remain open.

The pre-a4caf93 2026-09-10 repeat of the combined target command passed Chromium **18/18** and WebKit **18/18**, but all Firefox cases failed before page creation with `browserContext.newPage: Cannot read properties of undefined (reading '_page')`; Playwright then hung during teardown and was interrupted. This is a browser-runner diagnostic; the resulting 54/54 baseline is historical and does not add S17 credit. The current a4caf93 command is recorded as 36/36 below.

A no-page Firefox launch smoke reproduced the error before any project page or fixture ran: the main process launched, but `GeckoChildProcessHost` repeatedly failed to start tab/utility subprocesses and `remoteTab` became null. This identifies an external Firefox process/runtime condition; no PI code change or S17 credit is justified.

A Firefox-only diagnostic rerun with `MOZ_DISABLE_CONTENT_SANDBOX=1` passed **18/18**, covering P0 X-01..03, PI-03 16-01..06 and PI-04 17-01..09. The variable weakens browser isolation, so it was not committed or added to the default test configuration; this result is diagnostic only, does not replace native Firefox evidence, and earns no gate credit.

A Windows-only Playwright runner adjustment in `playwright.config.js` adds `--disable-gpu` only to Firefox and leaves content sandboxing enabled. The pre-a4caf93 standard three-engine target command then passed **54/54**. One preceding full run was **53/54** because Firefox teardown raised a protocol error after page assertions passed; a standalone retry passed **1/1**, followed by the complete **54/54** run. The current a4caf93 P0 X-01..03 plus PI-04 command passed **36/36**. These synthetic Provider results resolve local runner startup evidence only; live Provider/platform/print evidence remains open.

### Related Demo Gateway origin requalification (P0 only; does not close S17)

Date: 2026-09-10; the Gateway admin preserved `github-pages` public origins and added
`http://127.0.0.1:4174` plus `http://localhost:4174`. Real browser session issuance returned
`201 Created` and `/demo/v1/models` returned `200` for both local origins; no token was recorded.
The current-source `e2e/studio-v2-p0-prod13-controls.spec.js --grep "13-07"` rerun passed
**3/3** across Chromium, Firefox and WebKit. This closes P0 13-07 browser transport/disclosure
evidence only; it does not convert the synthetic PI provider matrix into live reliability evidence
or award S17 gate credit.

A 2026-09-11 repeat of the same current-source browser case also passed **3/3** across Chromium,
Firefox and WebKit. This reconfirms the registered-origin Demo session/disclosure path without
adding direct-BYOK or provider-retention evidence.

### Current-source Demo Gateway live Studio probes (supporting; does not close S17)

Dates: 2026-09-10 to 2026-09-11; source/artifact: current local `site-dist` from application revision `a4caf93857669e05d0d521567ecf5ab6f4389df5`; environment: real Chromium browser contexts
against `http://127.0.0.1:4174/studio-v2/`, served by `scripts/serve-site.mjs`, with the
registered `github-pages` Demo origin. The focused transport probe and the later fresh
transaction probe both used the current source; no provider credential was supplied to the page. The 2026-09-11 real Chromium smoke also used this origin and supplied no credential. The later `5341d7a` Service Worker correction was verified separately with policy unit **2/2**, Chromium cache-boundary E2E **1/1**, and a rebuilt artifact; these checks add no S17 gate credit.

- Both probes reached `Printable`; the session request was observed without Authorization and
  returned **201**, and the design/review requests to `/demo/v1/responses` returned **200** with
  only the in-memory Demo-session Authorization header. No raw token, credential or provider body
  was retained.
- The fresh transaction probe selected Preview mode and requested an explicit `#0000ff` heading
  color. The actual UI proposal card showed revision 0, the user-facing Apply control committed
  exactly `r0` -> `r1`, the card showed Applied and Undo, and the committed state remained visible.
  The UI then ran the Demo multimodal layout review and reported: layout review passed; human print
  preview and export confirmation remain required.
- After the passed review, the user-facing Production export button started the normal browser
  download fallback as `sales-invoice-pilot.html`; the embedded attestation reported revision 1
  and validation **PASS**. Download completion was intentionally not treated as confirmed file save.
  The headless native Save As picker and system print preview were not run; no deletion occurred,
  and the exported HTML was inspected in memory only and not retained.

These probes confirm that the current source traverses the registered credential-free
session-to-Responses path and the production-shell UI transaction boundary. They remain Demo
supporting evidence only: they do not replace direct-BYOK provider CORS/quota/reliability/retention evidence,
the final provider/render/privacy/transaction matrix, platform/print checks or release approval, and earn no
S17 G2-G5 credit.

### Prior application-baseline Demo Gateway browser run (supporting; superseded for changed preview path)

Date: 2026-09-10; application baseline: `e4302009e461ae398476ec63043c888cd19a07a`; environment: Windows Chromium through the local static Studio at
`http://127.0.0.1:4174`, with the registered `github-pages` Demo project. The real browser obtained a
short-lived Demo session with **201**, read `/demo/v1/models` with **200**, and did not record the token.

- The default `demo-fast` Responses design turn returned **200 SSE** and produced a bounded PrintForm
  action; the current host applied one revision in Auto mode. A separate layout review returned **200 SSE**,
  completed the dedicated review action, and left human print-preview/export confirmation required.
- Preview mode kept a candidate visible before UI Apply; one real UI Apply moved revision 0 to revision 1.
  `request_export` reported `exportReady: false` and `requiresUserConfirmation: true`; no automatic download occurred.
- The same browser exercised text-only, single-image and all-image original/resized variants (**7/7 HTTP 200**)
  using validated Synthetic PNG/JPEG/WebP pixels, including two-image and multi-page captures. The final payload
  used only `/demo/v1/responses`; private `/v1` request count was **0**.
- Ten Demo requests contained no key/session/canary markers and no forbidden top-level fields (`tools`,
  `tool_choice`, `files`, `audio`, `background`, `web_search`, `store`); page and console error lists were empty.

This validates the credential-free Demo Gateway flow and its host-side transaction/privacy boundaries for the
e430 application baseline. Current commit `a4caf93857669e05d0d521567ecf5ab6f4389df5` changes preview source
assignment, so the broad design/layout/media flow above is retained as baseline supporting evidence and is not
reused as current-source acceptance. Current-source Demo evidence also includes the live Chromium probes recorded
above. It is not direct PI BYOK evidence: provider-key CORS/quota/reliability, Edge, Safari.app, physical printing,
deployment retention and release approval remain unrun. It earns no S17 G2-G5 credit; TASK remains `x----`,
10%, plan **76.7%**, Done **16/21**, P0 **35/35**, PI **4/6**.

### Current-source browser matrix (supporting render evidence; not PI-04 closure)

Date: 2026-09-10; command: `node scripts/browser-matrix.mjs`; source/runner commit:
`a4caf93857669e05d0d521567ecf5ab6f4389df5`; current rebuilt `site-dist`. The full local Windows
matrix passed **88/88** with **0 problem cells**: Chromium, branded Chrome, Firefox and WebKit each
passed 22/22 across both pilot samples, seven boundary scenarios and four non-default print locales.
`empty` was the expected `blocked` case; all other cells were `ready` with no overflow, vertical
overflow, contrast failure or row-count mismatch. The runner completed host admission and changed
scenario/locale through the real Editor UI, so it did not grant or forge Agent human approval.

This closes the current local render-matrix diagnostic only. It does not provide a live Provider request,
direct-BYOK CORS/quota/reliability window, Edge/Safari.app, system/physical print, deployment retention
or maintainer approval, and earns no S17 G2-G5 credit. The earlier 88/88-problem attempt is superseded
by this current-source rerun.

### Case 17-04 — direct browser Provider composition (supporting; synthetic response)

Date: 2026-09-09; environment: Chromium, Firefox and WebKit through the actual static PI-04 page. The case uses the
actual `createPiByokAdapter` and `AgentHarness` with an OpenAI-compatible Chat Completions profile; Playwright intercepts
the selected Provider URL with a deterministic tool-call SSE response. It does not use an application backend, Provider
proxy, faux model, live credential, or production AGRUN entry.

- Each engine issued exactly one direct `POST https://provider.test/v1/chat/completions`; the Authorization header carried
the synthetic key, while the JSON body carried the model, tool catalog and semantic preview request but neither the key
nor the PI-04 canary.
- The actual Harness executed `printform_preview_changes`, produced one bound proposal at revision 0, kept the session
in memory, and left the canonical revision unchanged. The qualification output contained neither canary nor credential.
- The generated manifest records `directProviderChat: true`, `providerMatrixSynthetic: true` and `liveByokSmoke: false`.
This is direct-browser adapter/Harness evidence only; it does not prove live CORS, quota, provider reliability, human
approval/export UI, or the separate production-shell P0 X-01 closure. The remaining provider variants and final privacy/transaction matrix stay open.

### Case 17-05 — direct OpenAI Responses composition (supporting; synthetic response)

Date: 2026-09-09; Chromium, Firefox and WebKit each issued one direct `POST https://api.openai.com/v1/responses` from
the static PI-04 page. The actual Responses adapter and Harness parsed a deterministic function-call SSE stream for
`printform_preview_changes`, produced one revision-0 proposal, kept the policy-bound session in memory, and exposed no
canary or credential in qualification output. The synthetic key appeared only in the intercepted Authorization header;
the body retained the tool request but excluded the key and canary. Manifest capability `directProviderResponses: true`
is recorded with `providerMatrixSynthetic: true` and `liveByokSmoke: false`. This remains supporting adapter/Harness
coverage, not live CORS/reliability, human UI approval/export, P0 closure, or final S17 gate credit.

### Case 17-06 — direct Google Gemini composition (supporting; synthetic response)

Date: 2026-09-09; Chromium, Firefox and WebKit each issued one direct `POST` to the configured Gemini
`streamGenerateContent` endpoint from the static PI-04 page. The actual Google adapter and Harness parsed a deterministic
function-call SSE event, produced one revision-0 proposal, retained the memory-only session and excluded the canary and
synthetic key from qualification output and JSON body. The key appeared only in the intercepted `x-goog-api-key` header.
Manifest capability `directProviderGemini: true` is recorded with `providerMatrixSynthetic: true` and `liveByokSmoke: false`.
This remains supporting adapter/Harness coverage, not live CORS/reliability, human UI approval/export, P0 closure, or
final S17 gate credit.

### Case 17-07 — direct-provider follow-up payload (supporting; synthetic response)

Date: 2026-09-09; Chromium, Firefox and WebKit each completed two direct Chat Completions requests through the actual
Harness: `printform_get_project_summary` first, followed by `printform_preview_changes`. The first safe tool result was
carried into the second request; the second request produced one revision-0 proposal and no commit. Both intercepted
requests carried the synthetic key only in Authorization, and neither JSON body contained the PI-04 canary or key.
Manifest capability `directProviderFollowUp: true` is recorded with `providerMatrixSynthetic: true`. This proves the
composed follow-up/payload boundary only; provider live behavior, broader privacy sinks, approval/export UI and final
S17 PI credit remains open.

### Case 17-08 — direct-provider commit uncertainty and recovery (supporting; synthetic response)

Date: 2026-09-09; Chromium, Firefox and WebKit each used the actual direct Chat adapter and Harness to create one
revision-0 proposal, then exercised private human approval/apply with a synthetic lost Apply response. The existing
transaction resolver queried the same transaction, observed the committed candidate hash, and returned
`already_committed: true` at revision 1. Revision history was exactly `[0, 1]`; no second Apply or Agent approval path
was exposed. The intercepted request carried the synthetic key only in Authorization and its body contained neither
key nor canary. Manifest capability `directProviderCommitRecovery: true` is recorded with
`providerMatrixSynthetic: true`. This is supporting transaction-recovery evidence, not the separate production-shell P0 human UI acceptance,
live Provider reliability, or final S17 gate credit.

### Case 17-09 — direct-provider Real-policy privacy boundary (supporting; synthetic response)

Date: 2026-09-09; Chromium, Firefox and WebKit each initialized the actual direct Chat adapter and Harness under a
Real data policy. The policy-bound session remained `memory` with `allowPersistentSessions: false`; the request produced
one revision-0 candidate through the actual sandboxed candidate renderer and did not commit. The synthetic key appeared
only in Authorization; the intercepted JSON body and qualification output contained neither the key nor
`PI04-PRIVATE-CANARY-20260909`. This verifies local frontend policy/wire redaction only; it does not prove provider
retention, live CORS, live reliability, or final P0/S17 gate closure.

## Separate production-shell P0 X-01..03 evidence

`e2e/studio-v2-p0-x01.spec.js` passed **3/3** across Chromium, Firefox and WebKit on the existing `/studio-v2/` production shell. The test imported a valid synthetic canary fixture as Unknown, switched to Real memory-only policy, selected table A, used Preview mode, inspected the visible proposal diff, clicked the real UI Apply, rendered and completed the current geometry review, and confirmed the real production export picker path. Revision history had exactly one `REVISION_COMMIT` at r1; the saved artifact attested revision 1. Browser storage, prompts and controlled runtime output contained no canary; the canary appeared only in the explicitly confirmed export sink. `e2e/studio-v2-p0-x02-x03.spec.js` passed **6/6** across the same engines: X-02 rejected a delayed result after Unknown→Real, Auto→Preview and table→component changes without a candidate or revision, and X-03 rejected document-A review delivery after importing document B while preserving B's Unknown/revision-0/pending-review/no-evidence state. The combined command `npx playwright test e2e/studio-v2-p0-x01.spec.js e2e/studio-v2-p0-x02-x03.spec.js --workers=1` passed **9/9** across Chromium, Firefox and WebKit. These tests configure synthetic BYOK profiles and controlled in-page AGRUN sessions, so they are P0 production-shell/UI evidence only and do not prove live Provider transport, PI Harness cutover, CORS or release readiness. This closes P0 X-01..03, not S17/PI-04.

## Remaining S17 blockers

- The isolated PI-04 page has no production UI shell; visible approval/export still belongs to the AGRUN Studio entry. Replacing that runtime with PI would be S18/cutover work, not an authorized PI-04 fixture shortcut.
- Demo target-origin/CORS registration and a current Demo live run are verified for the local/public Studio origins, but no authorized direct-BYOK Provider credential, quota/reliability window, Edge/Safari.app, physical printer, deployment-retention or release-approval evidence is available. Demo and synthetic results remain explicitly supporting evidence.
- The available Windows Computer Use surface returned no targetable app or browser, and the three standard Edge executable paths were absent in this environment. Edge UI, Safari.app and physical-printer checks therefore remain unrun; this is an environment-capability observation, not a product failure or gate credit.

## X-01 — historical supporting case evidence (Pass; S17 remains in progress)

The isolated static PI-04 entry now composes the pinned `AgentHarness`, `PolicySessionRepo`, existing
table scope/gateway, CommandBus transaction/CAS, private approval/apply, current geometry review and
`createFileExport`. The production AGRUN entry was not changed.

- Chromium, Firefox and WebKit: `npx playwright test e2e/studio-v2-pi-04.spec.js --workers=1` — **3/3**.
- Observed policy and privacy: imported fixture is `unknown`; `PolicySessionRepo` reports `memory`,
  IndexedDB `open` count is **0**, provider contexts contain no canary marker, and the safe qualification
  result contains no canary content. No external provider request was observed.
- Observed workflow: table A scope `{kind: "table", tableId: "a"}`; Preview produced one semantic
  `set_column_widths` proposal at r0; private human approval/apply committed exactly r1; the
  committed r1 rendered through the actual sandboxed iframe/runtime with a ready geometry report
  and zero overflow; two Studio-issued evidence receipts completed a current review; human-confirmed
  picker export completed as `saved`. Candidate preview now uses the same sandboxed iframe/geometry renderer as committed content; the retained `readyReport()` helper is not used as acceptance evidence.
- Integrity: revision entries are `[0, 1]`; export Evidence Pack revision is **1**, embedded artifact
  evidence identifies **1**, and the export filename is `pi04-x01-canary.html`. No automatic download
  was used.
- Boundary/static checks: historical isolated `buildPi04` produced **1,207,086 bytes** before final S16 PI-03 bundle changes; the current
  manifest records `static`, `frontendOnly`, `actualHarness`, `policyBound`, `privateHumanApproval`,
  `canonicalCommandBus` and isolated `x01`/`x02`/`x03`, with `appBackend: false`,
  `providerProxy: false`, `liveByokSmoke: false`. The browser bundle has no bare PI package/Node
  imports, `eval` or `new Function`; the bundle's third-party websocket status labels are non-executable
  strings. `npm run check`, PI-04 JS `node --check`, and `git diff --check` passed. The full build baseline
  passed **106 files / 571 tests**; PI-02 host regression after the shared injection passed **18/18** across
  the three engines.

This records isolated X-01 supporting coverage only, not the separate production-shell P0 closure. DoD remains **G1 / 10%** (`x----`):
X-02/X-03 have supporting PI browser results and separate production-shell P0 passes, but the direct-BYOK provider/privacy/transaction matrix and step closure are still open.

## Historical interrupted X-02 investigation

At the earlier handoff, the checkout was `86591663fc6f655622ea1244e83fa8803e8685e9` plus dirty files.
The deferred-close change in PI-03 was then a proposed correction; S16 G2-G5 were temporarily reopened.
Node delayed-provider probes observed a blocked run with `HARNESS_HANDLER_ERROR` and
`TERMINAL_ACTION_REQUIRED`, no proposal and no revision. This did not prove the root cause.
Other Node probes never reached the delayed renderer: table scope needs browser DOM,
document-scope probes returned `COMMAND_FAILED`, and unsettled top-level await was
incomplete evidence, not proof of a deadlock. The current browser requalification is recorded in S16;
no X-02 browser case had yet run. At that point the X-01 fixture injected `readyReport()` and used
programmatic approval/save confirmations. The current isolated X-01 requalification now renders the committed
revision through the sandboxed iframe/runtime, but it remains supporting-only for PI because its production-shell
approval/export path is covered separately above and live provider transport remains outside it. See
[handoff](STUDIO_V2_AGENT_HANDOFF.md) for exact continuation and verification order.
