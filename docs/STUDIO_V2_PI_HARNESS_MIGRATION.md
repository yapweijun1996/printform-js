# Studio v2 PI Agent Harness Migration Plan

Prepared: 2026-09-08. Current handoff: PI-00..03 retain isolated Done; PI-04 waits at G1; PI-05 not started. [TASK](../TASK.md#sequential-execution-ledger) owns current credit.
The embedded Designer currently uses AGRUN. Its current browser default is the
reviewed origin-bound Demo Gateway; this plan does not claim a working PI
integration and does not authorize retaining the Demo route after a future
direct-BYOK cutover.
User requirements: PI Agent Harness, browser first, BYOK, frontend only, no Node.js server.
This document owns the harness replacement design and acceptance gates; [TASK](../TASK.md) owns execution status.

## 1. Scope and hard constraints

- Run the actual upstream `AgentHarness` in the browser, with `pi-ai` for model transport.
- Deliver static assets over HTTPS. No application backend, local Node process, CLI daemon,
  serverless function, WebSocket relay, server-managed key or proxy is required for Designer use.
- Users supply their own provider key. Requests go directly from the browser to the selected
  provider's supported HTTPS API. Static hosting is asset delivery, not an inference service.
- Keep existing build-time npm/Vite tooling; end users install nothing. Node used by developers
  to build/test does not become a deployed runtime dependency.
- Preserve Studio UI, semantic operations, document protocol, rendering, approval/hash/revision
  checks, data policy and human production export. Exported printforms remain AI-independent.
- Existing MCP and transaction-server code remains a separate optional legacy integration;
  neither is a dependency or acceptance prerequisite for the PI Designer. Do not delete it here.
- Do not install the coding-agent CLI, add shell/filesystem/CDP tools, replace the UI with Pi UI,
  or introduce multi-agent, branching UI or an application service as part of this replacement.
- A wrapper around AGRUN, or only the lower-level Pi `Agent`, does not satisfy this target.
  If the actual Harness cannot work within these constraints, record the exact blocker.

## 2. Upstream evidence and qualification

Reviewed upstream commit: [`b2602be77cb7b0de45dd616407fd210daa48aa75`](https://github.com/earendil-works/pi/commit/b2602be77cb7b0de45dd616407fd210daa48aa75).
The historical `badlogic/pi-mono` URL redirects to `earendil-works/pi`.

| Primary source at the reviewed commit | Verified fact / implication |
|---|---|
| [Project README](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/README.md) | Current package family is `@earendil-works/pi-*`; do not assume old `@mariozechner` instructions describe the selected release. Pi is not the application's permission boundary. |
| [Agent package manifest](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/packages/agent/package.json) | Source manifest names the published package `@earendil-works/pi-agent-core`, version `0.85.1`, ESM, Node engine `>=22.19.0`. The old shorthand `@earendil-works/pi-agent` is not a published package name. |
| [Public exports](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/packages/agent/src/index.ts) and [session exports](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/packages/agent/src/harness/session/index.ts) | Export `AgentHarness` and `MemorySessionRepo`. Export availability alone does not prove the complete browser import graph is usable. |
| [Harness specification](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/packages/agent/docs/harness.md) | Defines session/lane execution, explicit Context, hooks, recovery and terminal results. Includes incomplete surfaces; qualify the exact methods used. |
| [Provider library](https://github.com/earendil-works/pi/blob/b2602be77cb7b0de45dd616407fd210daa48aa75/packages/ai/README.md#browser-usage) | Documents browser usage and explicit API keys. Bedrock and Node-only OAuth are excluded. Selective provider imports reduce the bundle. |

PI-00 records exact published package versions, lockfile integrity, matching source commit,
license notices and supported public exports in the [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md).
Never resolve `latest` during a site load. Do not mix API examples from older Pi releases with
the reviewed Harness surface. The package Node engine applies to dependency/build qualification;
it is not proof of a server requirement. PI-01 now qualifies direct browser transport through
synthetic intercepted Responses, Chat, Gemini, image, no-key, error and abort cases; live BYOK,
provider CORS/preflight and the PI session adapter remain untested and are not release claims.

## 3. Current integration and replacement owners

| Current source / responsibility | Planned change |
|---|---|
| [index.html](../studio-v2/index.html), [app.js](../studio-v2/ui/app.js), `vendor/agrun.*` | Replace global `window.Agrun` loading with a built, same-origin browser ESM entry; report initialization failure through the existing panel. |
| [agent-runtime.js](../studio-v2/ui/agent-runtime.js) | Preserve Designer controller responsibilities; delegate execution to one Pi adapter using actual Harness/session/lane APIs. |
| [agent-runtime-consume.js](../studio-v2/ui/agent-runtime-consume.js), `agent-runtime-events.js`, `agent-runtime-output.js` | Replace AGRUN stream/result normalization; retain stable UI outcomes, cancellation and budget checks. |
| [agent-actions.js](../studio-v2/ui/agent-actions.js) | Replace `Agrun.defineAction` and AGRUN result envelopes with explicit Harness tools; reuse command/operation schemas and gateway projections. |
| [agent-provider.js](../studio-v2/ui/agent-provider.js), `agent-vault.js`, `agent-panel-runtime.js` | Map BYOK profiles to Pi providers; retire credential-free/default gateway behavior from the embedded Designer. Keep the encrypted vault owner. |
| [agent-sessions.js](../studio-v2/ui/agent-sessions.js), `agent-session-store.js`, `agent-session-database.js` | Separate legacy AGRUN storage from Pi session storage; preserve policy generation, disposal and atomic failure semantics. |
| [agent-runtime-skills.js](../studio-v2/ui/agent-runtime-skills.js), `agent-designer-prompt.js`, `agent-skills/printform-designer.md` | Load shipped prompt resources in the browser; replace AGRUN Markdown parsing without filesystem discovery or remote skill execution. |
| `agent-budget.js`, `agent-terminal-state.js`, `agent-layout-loop.js`, `agent-approval.js`, `agent-commit-resolution.js` | Preserve host budgeting, terminal behavior, review and approval/commit reconciliation rather than duplicating them in Pi. |
| `scripts/build-site.mjs`, `scripts/sync-agrun.mjs`, `scripts/doctor.mjs`, package scripts, CI, `sw.js` | Build/cache the Pi browser assets and replace vendor integrity checks at cutover; remove obsolete AGRUN-only machinery after acceptance. |

PI-00 confirmed exact module names and current AGRUN callers before the isolated qualification edit. New or amended source files
must stay within 300 lines; split by responsibility, not arbitrary line ranges.

## 4. Target ownership and data flow

```text
Studio panel + encrypted BYOK vault
  -> Designer controller (policy, scope, candidates, budgets, lifecycle)
  -> Pi browser adapter
       -> AgentHarness + one active lane + policy-bound Session
       -> pi-ai -> selected provider HTTPS API (user key, direct browser request)
       -> explicit PrintForm tools -> bound Agent gateway -> CommandBus
  <- projected events / validated proposal / usage / terminal outcome

Private host approval -> existing transaction checks -> commit
Human export -> existing trusted export checks -> standalone printform
```

Keep one authoritative project/revision owner in CommandBus. Pi session state records conversation
and execution, never replaces project transactions, approvals or receipts. Inject only the bound
ordinary Agent gateway into tools; the private human capability stays in the host UI.

Implement a narrow project adapter for initialization, submit, abort, dispose and safe event delivery.
Use actual `AgentHarness.create`, a configured lane and the selected release's public contracts.
Avoid a generic multi-runtime plugin framework. Migration builds may select one engine at startup;
never run both on the same turn or retry failed Pi writes through AGRUN.

Use one active lane per chat and sequential tools initially. A terminal preview/review result
must stop further effects in the same batch as well as later model turns. Validate this against
Harness hooks/results, not the older `Agent` event API. Check Result success/error branches explicitly.
Plain prose does not prove a design action completed. Preserve the bounded safe proposal-recovery
behavior or document and test an intentional replacement before cutover.

## 5. Browser BYOK and provider compatibility

- Fresh installations require provider/model selection and a user-supplied key before AI runs.
  An existing unlocked BYOK profile may be reused after endpoint/model validation.
- Preserve encrypted at-rest key storage and unlock lifecycle. Decrypted keys stay in memory,
  travel only in provider authentication fields, and are released on lock/disposal.
- Never store keys in source, URLs, Pi transcripts, telemetry, localStorage or service-worker caches.
  Do not copy the upstream plaintext credential-store example into this application.
- No automatic credential-free gateway, server-auth mode or hidden provider fallback. Migrate such
  profiles to a visible needs-BYOK state without deleting user settings or sending a request.
- Initially qualify existing provider families: OpenAI Chat Completions, OpenAI Responses,
  Google Gemini and explicitly configured compatible endpoints. Preserve the selected model and
  API variant; never assume every model/endpoint supports tools, images or streaming.
- Verify CORS/preflight, streaming, authentication headers, tool schemas, cancellation, usage,
  errors and image bytes from the deployed static origin. Library support alone is insufficient.
- CORS/auth incompatibility produces a clear unsupported-endpoint result. No proxy, browser
  security bypass, Node OAuth flow or shared project credential is a migration fallback.
- Retain user-configured pricing and current token/action limits. Unknown pricing remains unknown;
  Pi catalog pricing must not silently replace the application's USD budget contract.
- Inspect actual request bodies on first, follow-up, Review and resumed turns. Host projections and
  prompts must be applied every time, including compaction if enabled; no raw automatic document upload.

BYOK protects each user's key from being shipped to other users; it does not conceal that key from
the owning browser. Existing same-origin trust assumptions and data transmission rules still apply.

## 6. Session compatibility and effect safety

Start the browser qualification with upstream `MemorySessionRepo`. Real/Unknown document-bearing
state must remain volatile, including transcript, tool data, partial streams, usage metadata tied
to the document and queued work. Disable external telemetry and automatic background work.

For supported Synthetic persistence, implement a browser IndexedDB backend against the pinned
Pi Session/Storage contract, with atomic commits and conformance tests. Do not serialize an entire
live Harness or wrap the old AGRUN store as if the schemas were equivalent. This is a required
parity gate before default cutover, not an assumed built-in IndexedDB capability.

Use a separate versioned Pi namespace. Legacy AGRUN records are never silently replayed into Pi.
Offer existing permitted Synthetic chats as labeled legacy read-only history; continuing starts
a fresh Pi session. Reclassification, stale policy, missing provenance and old opaque references
cannot broaden access. Do not delete old records automatically or duplicate restricted records.

Document/session changes, vault lock and disposal cancel active requests, detach listeners and
invalidate late results before any render, store or tool effect. Recheck policy at each asynchronous
delivery and storage boundary. Cross-tab Synthetic writes need tested concurrency protection;
otherwise reject a second writer explicitly, with no multi-tab durability claim.

Mark side-effecting PrintForm tools as non-replayable on uncertain execution using the qualified
Harness recovery contract. Before resuming, reconcile the original transaction through the host.
Abort/timeout does not prove no commit. Never auto-apply twice, blindly retry or auto-rollback a
possibly committed revision. Approval stays bound to the current session, candidate and hash.

The [data policy](STUDIO_V2_DATA_POLICY.md), [boundary plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md),
[output fields](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and [output shapes](STUDIO_V2_AGENT_OUTPUT_SHAPES.md)
remain authoritative. Their current incomplete acceptance is not cured by a harness swap.

## 7. Ordered implementation packages

PI-00..03 retain isolated qualification. PI-03's deferred-close and pending-open lifecycle corrections are closed in current S16 evidence; proceed to S17. X-01..03 isolated supporting passes do not by themselves close P0; separate production-shell browser evidence now closes all three P0 cases, while the final PI-04 matrix and PI-05 remain open. Follow [handoff](STUDIO_V2_AGENT_HANDOFF.md), [DoD](STUDIO_V2_DEFINITION_OF_DONE.md) and [TASK](../TASK.md#sequential-execution-ledger); this document does not duplicate live gate credit.

| ID | Work / dependency | Required exit evidence |
|---|---|---|
| PI-00 | Pin upstream packages, public API and browser import graph; inventory current AGRUN callers and contract tests | Reproducible static build creates actual `AgentHarness` + memory session + lane; deterministic provider/tool cycle and abort work in a browser with no Node globals, server, eval workaround or unsupported deep import. Record bundle sizes and exact dependency provenance. |
| PI-01 | BYOK transport and browser entry; depends on PI-00 | Direct browser request with user key works for each retained provider/API variant from the target HTTPS origin. No-key/locked-vault paths send nothing; incompatible CORS fails visibly; no default gateway request. Test tools, streaming, images, usage and error/abort handling. |
| PI-02 | Tools, events, prompt resources and host adapter; depends on PI-01 | Existing design/Review/proposal/apply outcomes work with real Pi execution. Negative cases cover terminal-plus-other-tool batches, missing terminal, malformed args/results, budgets and stale candidate. Domain and private approval boundaries stay intact. |
| PI-03 | Policy-bound sessions and legacy history; depends on PI-02 | Memory isolation, IndexedDB conformance/atomicity, storage failure, reload, legacy read-only behavior, disposal, policy races and cross-tab rejection/protection pass. No implicit replay, key persistence or restricted backfill. |
| PI-04 | Composed acceptance; depends on PI-03 and relevant M1-M4 boundary evidence | Browser tests cover all retained providers with deterministic fixtures; authorized live BYOK smoke proves real transport. Chat/Review/second-request payloads, privacy sinks, commit uncertainty and manual non-AI workflows pass. Applicable P0 failures remain visible until individually closed. |
| PI-05 | Default cutover and AGRUN retirement; depends on PI-04 | Published build configuration selects Pi only; no AGRUN runtime references/assets in generated app, cache or dependencies. CI/doctor/docs reflect Pi. Clean install and old-worker upgrade pass; rollback rehearsal restores a known-good static artifact without session conversion. |

PI-00 qualification can proceed while existing host-policy acceptance is completed. Integrate with
those corrections at their existing owners; do not branch a second policy implementation.
Stop a dependent package on an unmet gate, rather than adding a backend or downgrading to `Agent`.

## 8. Verification, cutover and rollback

- Port `agent-agrun-contract`, provider transport/media, runtime-consume, workflow, layout-review,
  session/store/lifecycle, prompt-policy and commit-boundary tests to exercise the actual Pi runtime.
  Fake-runtime tests alone are insufficient. Preserve useful public-contract tests unchanged.
- Retain composed browser coverage for provider-wire, panel-session lifecycle, session-policy,
  P0 PROD-13, production-boundary and service-worker upgrade. Test Chromium, Firefox and WebKit
  under the existing browser matrix; WebKit does not certify Safari.app or the physical print chain.
- Build static assets, run the owning unit suite, `check`, the replacement runtime-integrity check
  and all three `validate:v2` pilot checks. Record measured outcomes, failures and unrun cases.
- Verify no application API/server route is contacted with the transaction server and MCP stopped.
  Network allowlist: static app resources plus the user's selected provider; no telemetry, OAuth,
  hidden gateway, runtime package CDN or downloaded executable skills.
- Offline mode retains existing manual editing/preview/export behavior; AI reports unavailable.
- Preserve last-known-good project/revision on failed initialization or transport. Rollback is an
  operator-selected previously verified static artifact with its matching cache manifest, not an
  automatic per-turn fallback. Old code must not deserialize Pi records; no lossy reverse migration.
- Remove AGRUN bundles/provenance, sync/check scripts and drift workflow only after PI-04. Replace
  supply-chain checks and update CI/doctor, build sources and service-worker resources together.
- Synchronize Current claims in SPEC, DESIGN, setup, README, machine discovery, data-policy store
  notes and developer/build guidance only when implementation evidence supports the change.
  Keep historical AGRUN evidence labeled historical instead of renaming past test results.

Completion means the actual PI Harness powers browser BYOK design and review, all required
compatibility gates pass, AGRUN is retired from the shipped app, and no Node/server runtime is
needed. Planning completion does not imply migration completion or production release approval.
