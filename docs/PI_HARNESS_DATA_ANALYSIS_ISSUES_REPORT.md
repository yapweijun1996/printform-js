# Pi Harness Production Data Analysis Review

> Review baseline: `main` at `0bf5eb4197e2ee3b33ec01e45e0339d0dda34309`, 2026-10-08, Asia/Singapore. Status: baseline findings with runtime-fix status below; no external issues created.

At the review baseline, Studio v3 uses the real pinned Pi `AgentHarness` and supports a tool-driven form authoring loop. It isolates draft changes, validates scope, supports cancellation, and requires human Preview and Apply. It is not yet a production data analysis agent: its tools cannot retrieve governed business datasets, execute calculations, validate analytical conclusions, or preserve the evidence behind a report.

The recommended direction is to retain Pi as the execution loop and add a separate analytics capability with controlled data access and deterministic calculation. Changing the system prompt or increasing iteration limits would not supply those capabilities. Resolve the runtime defects below before extending long-running execution.

## Review scope and priority

This review covers v3 runtime/provider/tools/draft/memory, v2 Pi qualifications and reusable host controls, dataset contracts, the transaction server, relevant tests and release configuration. It is not a line-by-line review of the entire repository.

The proposed target is read-only analysis of authorized business datasets, with reproducible quantitative results and a reviewable report. Dataset size, deployment, retention and operational targets remain product decisions. Warehouse-wide analysis and isolated Python execution are proposed extensions, not existing product commitments.

- **P1**: resolve before enabling the affected production analytics capability or migrating the affected adapter.
- **P2**: correctness or reliability issue with a narrower current impact.
- **Confirmed defect**: observed in a local synthetic probe or directly established by source behavior.
- **Capability gap**: required for the proposed analytics target, not a regression in the current form designer.

The 14 issues below comprise 6 analytics gaps, 5 v3 defects and 3 isolated Pi migration defects. Priorities refer to the stated target; no production outage or customer-data exposure is claimed.

## Runtime fixes in this change

RT01–RT05 are implemented and verified in this change; their findings below remain the baseline evidence. Analytics gaps and isolated v2 Pi migration defects remain open. Merge, deployment and live gateway qualification are outside this change.

| Issue | Resolution | Regression evidence |
| --- | --- | --- |
| RT01 | Validate safe-integer usage, derive a missing total, preserve unavailable counts as null, and stop on unreliable accounting. Existing pre-turn budget semantics remain; exact billing enforcement is outside this change. | `tests/studio-v3-agent-usage.test.js`; gateway-loop tests. |
| RT02 | Select the agent deadline at multi-step entry; re-arm the short deadline on fallback; preserve immediate Stop and reject stale timer reconfiguration. | `tests/studio-v3-chat-panel-deadlines.test.js`; cross-browser agent steps. |
| RT03 | Require a ready inspection of the exact final candidate before finish; return recoverable errors otherwise. | `tests/studio-v3-agent-finish.test.js`; repaired stale/undo loop tests. |
| RT04 | Merge label/field aliases using the same canonical target identity as field selection, preserving one net property diff. | Bidirectional alias change/restore cases in `tests/studio-v3-agent-draft.test.js`. |
| RT05 | Use the image stream setting while pixels are present and text stream setting afterward. | Transport, panel and browser image-turn assertions. |

Verification: eight focused files passed **82 tests**; the complete unit suite passed **177 files / 1,478 tests**. The agent-steps and boss-demo browser suites passed **48 scenarios** across Chromium, Firefox and WebKit. Three additional engine-specific Apply/Undo checks passed with no pageerror or console error. Runtime/site builds, diff whitespace checks and the 300-line limit for every amended/new file passed. All model traffic in these tests was synthetic; live gateway qualification remains separate.

## Current architecture and reusable controls

| Surface | Current behavior | Review implication |
| --- | --- | --- |
| Studio v3 agent | `runPanelAgent` creates a gateway provider, a draft, an in-memory session and one sequential Pi lane. Seven tools operate on the draft. | Real agentic execution exists; its domain remains form authoring. |
| Studio v3 single-step flow | A transport response becomes a validated local answer/proposal tool call; local inspection can trigger bounded repair. | Preserve this fallback and distinguish it from native multi-step tool execution. |
| Studio v2 embedded UI | `ui/agent-runtime.js:82–87` still uses AGRUN. `pi-00` through `pi-04` are isolated qualifications; PI-05 cutover is not complete. | v2 qualification evidence does not prove v3 inherits v2 policy, vault or durability controls. |
| Existing host controls | v2 has classification and stale-context guards, closed tool schemas, private human capabilities, revision/CAS checks, uncertain-commit reconciliation, safe event projections and an encrypted BYOK vault. | Adapt these controls explicitly to analytics; retain one authoritative permission and state owner. |
| Existing durable storage | Document transactions and evidence can use a durable backend. | Document revision durability does not establish resumable analysis-job durability. |

Sources: [v3 loop](../studio-v3/agent-loop.js), [v3 tools](../studio-v3/agent-tools.js), [v2 runtime](../studio-v2/ui/agent-runtime.js), [PI migration status](STUDIO_V2_PI_HARNESS_MIGRATION.md), [PI-04 evidence](STUDIO_V2_S17_PI04_EVIDENCE.md).

Pi's pinned upstream specification separates session storage, lane execution and external-effect settlement, and identifies specified surfaces that are not implemented. Use the selected release's tested public APIs; application authorization, data semantics and release acceptance remain host responsibilities. See the [pinned Harness specification](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/packages/agent/docs/harness.md).

## Analytics capability gaps

### DA01 P1 Analysis tools and task routing are absent

**Evidence:** `studio-v3/agent-tools.js:31–65` exposes context, draft operations, print inspection, undo, notes, finish and blocked. `ai-chat-protocol.js:14` prohibits computing ERP values and executing code. `ai-panel.js:138` routes read-only questions away from the multi-step loop.

**Impact:** A question such as “Why did revenue fall?” cannot execute a governed query, group records, test join cardinality or calculate a trend. A prose answer cannot establish a verified numerical conclusion.

**Change:** Introduce an analytics task contract and explicit tools such as `list_datasets`, `profile_dataset`, `execute_analysis`, `verify_result` and `build_report`. Start with bounded declarative calculations or authorized read-only SQL. Add isolated Python only when required; never add arbitrary execution inside the page. Keep designer rules intact and route analytical questions deliberately.

**Acceptance:** Synthetic group-by, join and trend tasks match golden results; unsupported calculations stop clearly; each numerical claim depends on a successful computation artifact. Source text containing instructions cannot enlarge tool authority.

### DA02 P1 Production source authorization and data policy are missing

**Evidence:** `studio-v3/data-source-adapter.js:3–10` describes a future authenticated service but implements only `local-demo`; line 12 limits families to invoice/purchase/delivery. The optional transaction server defaults to loopback, allows an empty auth token at `studio-v2/server/transaction-http-server.mjs:38–42,106–110`, and reads owner/agent identity from caller headers at `124–126`.

**Impact:** Browser-local samples do not provide tenant, dataset or row authorization. Publishing the existing fixture server as an analytics service would not establish trusted user identity. Its current loopback deployment and restrictive persistence policy mitigate present exposure.

**Change:** Add one authenticated read-only data adapter. Derive identity and audit actor from authentication; authorize datasets, rows and export destinations server-side. Define a separate analytics data policy: what real data may be computed locally, sent to a provider, retained or exported. Do not relax the existing v2 Real/Unknown restrictions globally.

**Acceptance:** Forged owner headers, cross-tenant reads and forbidden rows fail before execution; remote production startup without required authentication fails closed. Unknown classification blocks unapproved external disclosure. Dataset access never hands database credentials to the model or browser.

### DA03 P1 Metric semantics and analytical quality checks are absent

**Evidence:** `studio-v3/database-model.js:67–88` validates shape, finite values and size, not business grain or correctness; `scalarFields` maps null to text at `27–35`. Source schema exposes pointer/type metadata at `data-source-adapter.js:27–35`. Input is bounded to 500 items and 2 MB.

**Impact:** A valid transport dataset can contain duplicate transaction IDs, invalid dates and inconsistent supplied totals. Without metric definitions, analysis may double-count revenue, combine incompatible currencies or use an incorrect population. Existing preservation of supplied monetary values is intentional and must remain.

**Change:** Add dataset and metric contracts covering grain, keys, units/currency, timezone, period, numerator/denominator and join cardinality. Run completeness, uniqueness, freshness and applicable reconciliation checks before calculation. Report exclusions and uncertainty; do not silently repair business values. Negative quantities may be valid under a return/refund contract.

**Acceptance:** Golden cases detect duplicate-key fan-out, missing periods, invalid dates, timezone boundaries and mixed currencies. Required violations block or qualify conclusions. A shape-validation PASS never becomes an analytical quality PASS.

### DA04 P1 Reports lack calculation lineage and claim evidence

**Evidence:** `studio-v3/data-provenance.js:2–7` stores an origin label/name/row count. `database-model.js:118–129` exports type/title/data without source snapshot, query or execution identity. `studio-v2/core/evidence-pack.js:18–45` attests document/render/export properties rather than analytical execution.

**Impact:** A reviewer cannot reproduce “revenue dropped 12%” or identify which source version, filters and metric definition produced it. A valid form export or attractive chart does not validate the calculation.

**Change:** Introduce immutable analysis-result artifacts with run ID, authorized snapshot identity/hash, plan/query, parameters, metric definition, engine/version, quality outcome and result hash. Link claims and charts to result IDs. Keep approved metadata separate from protected raw data.

**Acceptance:** Replaying an artifact reproduces the values within declared tolerance. Changed snapshots or parameters invalidate prior verification. Every quantitative report claim resolves to a verified result, and safe lineage survives export/reimport.

### DA05 P1 Analysis jobs cannot recover after interruption

**Evidence:** `studio-v3/agent-loop.js:22–26` creates a new draft and `MemorySessionRepo` per run; `ai-agent-run.js:11` creates fresh notes. `ai-panel.js:229–235` recovers conversation UI, not the running session/draft/checkpoints. `agent-wire.js:50–55,68` drops older turns and folds tool output.

**Impact:** Refresh or process loss discards execution state. Model notes cannot prove a query completed against a particular snapshot. Long analyses may repeat expensive work or lose evidence after context compaction.

**Change:** Add stable job/step IDs, policy-controlled checkpoints and durable result references. Record accepted, running, cancelled, completed and unknown outcomes. Use idempotency for execution/export effects and recheck permission/snapshot on resume. Retain artifact references during compaction rather than relying on model-written notes.

**Acceptance:** Refresh, worker failure and lost replies resume or resolve the original job without duplicate settled effects. Cancellation stops the execution unit; subsequent ordinary work succeeds. Protected data is retained only under the approved policy. The PI02 lock issue must be resolved before reusing that adapter.

### DA06 P1 Analytical evaluation and operational release gates are absent

**Evidence:** `tests/studio-v3-agent-loop.test.js:9–20` uses a faux provider and a dummy ready print report. `docs/STUDIO_V3_AI_CHAT.md:198–209` separates the small live gateway probe from scripted long-run evidence. `.github/workflows/pages.yml:31–35` builds the site; `package.json` build runs unit tests, but no PR browser or analytical-evaluation gate is configured here.

**Impact:** Green authoring tests do not establish calculation correctness, real provider reliability, privacy behavior or production latency/cost. The workflow's “tests run locally” comment is misleading because the build does run unit tests; the missing gates concern browser and analytics acceptance.

**Change:** Create versioned golden analysis tasks plus adversarial authorization/data-instruction cases. Gate the relevant release on numeric correctness, evidence coverage, refusals, recovery and defined cost/latency limits. Record redacted run/step/result IDs, actual or unavailable usage, failure codes and durations; define alerts and recovery procedures for the chosen deployment.

**Acceptance:** CI catches wrong joins, stale snapshots, unsupported conclusions and forbidden disclosure. Authorized synthetic live-provider runs separately qualify the end-to-end workflow. Thresholds have declared denominators and approved targets; no invented score or model-summary self-grading counts as acceptance.

## Confirmed Studio v3 runtime defects

### RT01 P1 Missing usage defeats the token budget

**Evidence:** `studio-v3/agent-provider.js:21,26–28` checks `totals.total` but only increments it from `total_tokens`; absent values remain zero. `ai-responses-wire.js:33–35` simply maps usage fields. Model cost is configured as zero at `agent-provider.js:12`.

**Reproduction:** With `maxTokens=1`, two synthetic turns each reported 100 input and 100 output tokens but omitted total. The loop completed a proposal after two requests and reported `{input:200,output:200,total:0}`.

**Change:** Validate usage, derive total from valid components where appropriate, otherwise record unavailable consumption and apply an explicit conservative admission policy. Track run/session budgets and approved spend at the trusted execution boundary. Reserve a bounded next response if a strict ceiling is required; the current pre-turn check can overshoot by one response even with complete usage.

**Acceptance:** Missing, partial, negative and inconsistent usage cannot be treated as free. Overshoot behavior is bounded and documented. Reports distinguish zero from unavailable usage, and failed requests remain represented in consumption accounting.

### RT02 P2 The panel cancels multi-step runs after 225 seconds

**Evidence:** `studio-v3/ai-panel.js:118–122` always starts `DEMO_CONFIG.sendTimeoutMs`. `ai-gateway-config.js:7,23` computes 225,000 ms; its agent allowance at line 27 is 3,600,000 ms. `docs/STUDIO_V3_AI_CHAT.md:55–56` describes the longer run.

**Reproduction:** Capturing the real `begin()` timer yields 225,000 ms; invoking its callback aborts the returned signal. Multi-step execution cannot reach its stated 60-minute allowance through this panel.

**Change:** Select a mode-specific total deadline before the run and align panel, lane and request limits. The appropriate production duration is a product target, not automatically 60 minutes.

**Acceptance:** With a fake clock, a configured multi-step run survives the single-step deadline and stops at its own deadline; Stop still cancels immediately. Single-step behavior remains bounded.

### RT03 P2 Finish accepts an absent or failed final inspection

**Evidence:** `studio-v3/agent-tools.js:57–62` returns a proposal and terminates without requiring a current inspection with `ready=true`. A stale inspection is omitted. `tests/studio-v3-agent-loop.test.js:83–89` currently accepts that omission.

**Reproduction:** Inspecting a blocked candidate and then calling `finish` produces `proposalAccepted=true, inspectionReady=false`. A run can also finish without inspection.

**Impact and mitigation:** The repair loop ends prematurely. The current UI separately checks Preview and rejects Apply without `checked` at `ai-panel.js:198–207`; this is not proof of bypassing the human commit gate.

**Change and acceptance:** Return a recoverable tool error for missing, stale or blocked inspection. None may terminate successfully; only a passing inspection of the exact final candidate completes the run. Analytics needs its own result verifier rather than the print inspector.

### RT04 P2 Alias targets produce an incorrect net change list

**Evidence:** `studio-v3/agent-draft.js:9–15,39` merges by raw target/property. `model.js:94–99` resolves label and field aliases to the same underlying field.

**Reproduction:** Start with `labelStyle.fontSize=9`; set `label-customer-ship` to 12, then restore it through `customer-ship` to 9. Final design equals the original, but the proposal contains two cancelling diffs rather than `NO_CHANGES`.

**Change and acceptance:** Merge using canonical field/property identity or derive the final semantic diff from baseline and candidate. Restoring through an alias yields no changes; a remaining change appears once with the correct before/after values.

### RT05 P2 Image turns ignore the configured streaming restriction

**Evidence:** `studio-v3/ai-gateway-config.js:34–37` sets `stream.images=false`. `ai-demo-transport.js:96` honors it in single-step requests, while `agentTurn` always uses `stream.text` at line 80 even when `usesImages(context)` is true.

**Reproduction:** After synthetic image-capability discovery, an image-bearing agent request has `stream=true` despite `configuredImageStream=false`. Image support alone does not qualify image streaming.

**Change and acceptance:** Select stream mode from the actual outgoing media. Image turns use the configured image mode; later text-only turns use text mode. Retain the dispatch-time image capability guard.

## Isolated Pi adapter migration defects

These findings affect qualification adapters that could be reused for analytics. They do not establish defects in the currently shipped v3 gateway path.

### PI01 P1 BYOK adapter skips endpoint validation

**Evidence:** `studio-v2/pi-01/provider-transport.js:103–107` creates a model without calling the existing `validateProviderProfile`; `ui/agent-provider.js:74–81` rejects unsafe endpoint schemes.

**Reproduction:** Without sending a request or supplying a real key, `createPiByokAdapter` accepts `http://untrusted.example/v1`; the existing profile validator rejects it.

**Change and acceptance:** Reuse the endpoint/provider/model validator at adapter admission. Non-localhost HTTP, unknown providers and unsupported API variants fail before any request. Keys never appear in diagnostics. No credential disclosure was reproduced.

### PI02 P1 Persistent writer ownership cannot recover from a crash

**Evidence:** `studio-v2/pi-03/indexed-db-storage.js:130–134` rejects every different lock owner and never checks expiry. Only graceful `close()` releases the lock at `211–229`; `policy-session-repo.js:158–159` also blocks deletion while locked. `e2e/studio-v2-pi-03.spec.js:87–91` covers graceful release.

**Impact:** A tab/process crash that skips close leaves an IndexedDB lock that a new writer cannot reclaim. This is a source-established failure path; browser kill/restart was not run during this review.

**Change and acceptance:** Provide safe ownership recovery, for example bounded leases with fencing or a lifecycle-bound lock. Kill the owner and recover the same session; prove an old owner cannot write after recovery and an active owner cannot be displaced. Do not simply delete locks on conflict.

### PI03 P2 Normal cancellation becomes a missing terminal action error

**Evidence:** `studio-v2/pi-02/host-adapter.js:141–144` lacks a dedicated aborted-outcome branch before the missing-terminal fallback.

**Reproduction:** Actual Pi 0.85.1 with a slow faux provider and `lane.abort()` returns `status=aborted` but `terminal.state=blocked` and `error.code=TERMINAL_ACTION_REQUIRED`; its completed event reports `terminalKind=abort`.

**Change and acceptance:** Normalize cancellation consistently before blocked/error handling. Result, event and UI all report stopped/aborted; no repair, candidate or follow-up model request occurs.

## Proposed delivery order

| Stage | Scope | Exit condition |
| --- | --- | --- |
| 1 Stabilize the current loop | RT01–RT05; explicitly choose deadlines and budget policy. | Focused defect regressions and preserved Preview/Apply/Undo pass. |
| 2 Build a bounded analytics slice | DA01–DA04; one authorized source and one analytical task family. | A fictional revenue trend task produces correct computation, quality checks and cited result artifacts. |
| 3 Make jobs recoverable | DA05; resolve PI01–PI03 only if those adapters are selected for reuse. | Crash/disconnect/cancel tests preserve authorization and prevent duplicate settled effects. |
| 4 Qualify the chosen deployment | DA06 plus synthetic live-provider and operational evidence. | Applicable release gates, budgets, telemetry and recovery procedures are demonstrated. |

Recommended minimum flow:

```text
Question + analysis contract
  -> authenticated source + frozen snapshot
  -> quality profile + metric definition
  -> Pi analytics lane + bounded deterministic tools
  -> verified calculation artifacts
  -> report with claim/result references
  -> human review + authorized export
```

Pi owns the tool loop. The host owns permissions, budgets, job state and effect admission. The computation layer owns numerical results. PrintForm can remain the presentation/export surface. A separate multi-agent system or arbitrary shell access is not required for the first useful slice.

## Baseline review verification and limits

- This review reran 7 harness-focused test files: **72 tests passed**. Source/database verification reran 2 files: **8 tests passed**. Passing existing tests does not invalidate the reproduced defects.
- Synthetic local probes reproduced missing-usage budgeting, failed-inspection finish, panel deadline mismatch, alias net-diff behavior, image stream mismatch, unsafe endpoint admission and cancellation normalization. No real credentials, customer data or provider calls were used in these probes.
- The immediately preceding merge verification covered the same implementation baseline: **174 unit files / 1,448 tests**, **36 boss-demo browser scenarios** across Chromium/Firefox/WebKit, and asset/site builds passed. The full suite was not rerun for this documentation-only review.
- No live warehouse, isolated calculation worker, production authentication, browser crash recovery or long-session load qualification was performed. PI02 is supported by source analysis; its crash scenario still needs execution evidence.
- KB retrieval supplied historical v2 architecture/qualification context. Current source and tests determined this report's findings. Referenced `instruction-modules/investigation.md`, `architecture.md` and `verification.md` were absent; the supplied core/project rules were used.
- The original review added only this report. The subsequent option-A task changes the local v3 runtime and its tests as recorded above; dependencies, production release status and public issues remain unchanged. Proposed issue IDs are local review identifiers.

## Review decisions

1. Recommended: retain Pi and adopt the staged read-only analytics direction above.
2. Define the first dataset/source and business question before implementing DA01–DA04.
3. Choose whether execution is hosted or local, then set retention, latency and spend targets.
4. Treat isolated v2 Pi adapters as candidates for reuse after their relevant findings are resolved.

Last updated: 2026-10-09.
