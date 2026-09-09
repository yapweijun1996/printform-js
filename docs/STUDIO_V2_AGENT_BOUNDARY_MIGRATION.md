# Studio v2 Agent Boundary and Compatibility Migration

Prepared: 2026-09-09. Source baseline: `d2536999ae3edd3d94e315bb245ab94f8b74e65d` plus the uncommitted amendment snapshot.
Status: **M0 inventory exists; M1 case acceptance is partially closed; M2/M3 acceptance Partial; M4/M5 incomplete.** The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) steers the next authorized implementation; coding resumed by explicit user instruction on 2026-09-08.
This document sequences PROD-13 with PROD-01/02/03; it records the authorized implementation foundation
in this worktree and does not authorize deployment.

## Authority and invariants

- [PI Agent Harness migration](STUDIO_V2_PI_HARNESS_MIGRATION.md) owns the selected embedded-runtime replacement: browser-first, frontend-only BYOK, no Node.js/server runtime. That plan changes runtime ownership without weakening the policy, projection or transaction requirements here. PI-00 is browser-qualified in isolation; PI-01..05 remain Not started and existing boundary corrections remain required.
- [Data policy](STUDIO_V2_DATA_POLICY.md) owns classification, destinations and lifetime.
- [Command fields](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and [nested shapes](STUDIO_V2_AGENT_OUTPUT_SHAPES.md) own allowed outputs; do not duplicate their schemas here.
- This document owns enforcement placement, client migration, failure handling and rollout gates.
- [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md) owns the 35 acceptance cases; [TASK](../TASK.md) owns status; the [engineering roadmap](STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md) owns overall priority.
- Preserve canonical projects, existing revision/CAS/hash/lease checks, evidence provenance, semantic operation restrictions and human export confirmation.
- Agent projections are derived views, never canonical projects, replacement receipts or authority to mutate.
- Unknown/Real remains restrictive. A classification change cannot recall bytes already sent or remove existing copies.
- This local application boundary does not protect against arbitrary browser debugging, hostile same-origin scripts or privileged extensions. First-party CDP coverage means the provided gateway client, not sandboxing the whole CDP protocol.

## Verified current paths

| Boundary | Source-backed current behavior | Migration consequence |
|---|---|---|
| Host installation | Initial import is classified before CommandBus construction; recovery metadata is advisory and an explicit restore installs the recovered project as Unknown using its current project identity; reclassification uses the current document and requires whole-document confirmation before Synthetic persistence is enabled | Preserve current-document provenance and the fresh persistence namespace; do not reuse prior sample selection or trust a stored recovery label |
| Shared command entry | [gateway.js](../studio-v2/adapters/gateway.js) resolves context references, checks policy/scope/apply, calls bus.execute, then sanitizes the result | Reuse this single boundary; do not add parallel command services |
| Early errors | Gateway JSON parsing, policy, dispatch and projection failures return fixed safe errors; direct human UI retains full internal errors. Runtime events also require a reviewed event type before reaching UI consumers | Keep the safe boundary stable and never fall back to a raw domain result |
| Embedded actions | [agent-actions.js](../studio-v2/ui/agent-actions.js) calls gateway.execute but also wraps previews and returns local review-hook results | The 35 command schemas do not cover every runtime action envelope; inventory and validate these compositions too |
| Review transport | [agent-layout-loop.js](../studio-v2/ui/agent-layout-loop.js) builds prompts and image parts after collecting gateway evidence; `buildProviderInput()` defaults a missing policy to imported Unknown and reconstructs only validated media parts. Runtime/layout paths can bind the current-policy check to the actual fetch, rejecting stale context before send and after an asynchronous response | Recheck final composed context and images immediately before provider handoff; sanitizing a command is insufficient |
| WebMCP | [webmcp.js](../studio-v2/adapters/webmcp.js) uses executeAgentCommand; response is serialized into text and structuredContent | Both representations must contain the same safe payload; handle adapter failures without raw errors |
| MCP/CDP | [server.mjs](../mcp/server.mjs) loads its local TOOL_CONTRACTS; [cdp-client.mjs](../mcp/cdp-client.mjs) preflights the live protocol, Agent Contract and complete tool catalog, then uses one admission check per connection generation before business commands | Version/catalog mismatches fail before business calls; the opaque admission is memory-only, bound to the session and document, and reset on target replacement/reconnect. Concurrent business calls share the check; `tools/list` is also gated by the same handshake |
| MCP failure output | Server uses fixed safe text and CDP performs a `get_capabilities` contract handshake before business calls | Keep transport exceptions generic and reject incompatible page/server combinations before business calls |
| Human UI | app.js uses bus.execute and internal project-bearing change events for editing/history; Agent panel receives only projected gateway results | Keep full local domain results available to human UI; never route them into AI context automatically |
| Human approval capability | The panel verifies its candidate approval token before calling `executeHuman`; `installAgentGateway()` supplies that method only on an app-local UI session factory. Page-global and ordinary bound sessions expose only normal `execute`, and registered MCP/WebMCP tools do the same | The concrete public gateway bypass is closed by implementation and targeted gateway/Chromium checks. The browser is not a hostile-code sandbox; the complete PROD-02 02-01..02-08 case matrix is evidenced, while later PI/release gates remain |
| Missing-policy fallback | Main-app, server, page-gateway and WebMCP paths now establish Unknown/Real/Synthetic policy consistently; missing-current-policy checks reject stale/no-active-document work instead of reusing the old policy | Preserve the fail-closed rule through PI/client migration checks and later release evidence |
| Resource requests | [assets.js](../studio-v2/core/assets.js) defaults a missing policy to imported Unknown before URL/CSS asset fetch or HEAD validation; explicit restrictive policies reject before the request | Keep resource admission at the asset owner; callers must pass the current policy and recheck after asynchronous work |
| Agent operation set | Strict Agent preview rejects a missing, non-array or empty `operations` set before creating a transaction; internal non-Agent evidence paths retain their existing empty-array anchor | Keep the public `minItems: 1` contract aligned with domain admission and do not turn malformed batches into auto-apply candidates |
| Undo/Redo canonical revision | [history-navigation-service.js](../studio-v2/core/history-navigation-service.js) selects a logical history target, writes it through the existing durable CAS and assigns a new `history:undo`/`history:redo` revision before emitting the change | Keep durable head, `get_revision`, project revision and CAS aligned; a logical navigation must not restore an old durable revision number |
| Command-bus lifecycle | [app.js](../studio-v2/ui/app.js) deactivates the previous bus on document/policy replacement; the bus rejects later commands, transaction/audit/evidence writes and the actual CAS, while UI listeners ignore old change/review events | Do not let an in-flight old document operation write into the new policy/document context or relabel its state |

These are source observations plus the implementation boundary now in the worktree; combined release evidence remains separate.
Current versions are Runtime 1.0.0 / Studio 0.11.0 / Protocol 2.0.0 / Agent Contract 4.0.0.

## Target ownership and dependency direction

| Owner | Responsibility | Must not own |
|---|---|---|
| Host document/session lifecycle | Authoritative classification, policy generation, document/session identity, selected scope and apply mode; inject current context into adapters | Trusting caller policy flags or allowing adapters to choose independent defaults |
| Existing Agent gateway | Validate registered command/input, resolve scoped references, invoke domain guards, project success/error once | Canonical project persistence, business commit logic or UI-derived readiness |
| Projection helpers | Pure closed-field construction and validation using shared nested shapes | Reads from storage/network, mutation, prompt generation or fallback to copied raw results |
| Host-local reference map | Typed forward/reverse mapping, context binding, expiry and same-context recovery lookup | Persisting real-data mappings, rewriting canonical IDs or treating a reference as permission |
| Command/domain layer | Effective operation scope, trust/apply eligibility and transaction/lease/revision/hash invariants; guard the actual mutation | Trusting that a hidden UI button or earlier preview authorized this commit |
| Storage adapters | Enforce allowed initialization, reads/hydration and writes under current policy; honestly expose volatile/durable capability | Inferring Synthetic from artifact trust or falling back to a forbidden store |
| Runtime/provider and asset transports | Validate final destination and assembled payload, including wrappers, history, images and errors | Expanding safe tool results with raw project/context or replaying an old provider session |
| Human UI | Display actual committed/candidate/recovery/save outcomes; explicit allowed file action | Inventing success from missing output or using a file save as consent to hidden persistence |

Keep ownership in existing modules; use focused helpers only where needed to keep changed files <=300 lines.
Domain guards accept host-established context without importing DOM/UI code. Transport adapters depend on the gateway, not the reverse.
No new server, generic middleware framework, encryption database or public policy argument is required by this plan.
Same-context references must work across first-party adapters; the gateway registry now keys mappings by
document, policy generation and host-bound Agent session. Embedded runtime sessions use a private bound
gateway, while WebMCP and the page gateway receive distinct host session contexts. Cross-client authorization
is still out of scope; never use a caller-supplied owner string as authentication.

## Admission, execution and delivery order

1. Resolve document classification before store hydration, import asset fetches or Agent exposure. Missing policy is Unknown, never Synthetic.
2. Establish a host-bound context: document, Agent session, policy generation, scope, mode and supported contract. This is internal context, not new trusted caller JSON.
3. Parse input; require a registered command and supported variant. Resolve only designated reference fields, then validate semantic input and effective scope.
4. Before work with side effects, recheck current policy/mode and domain authority. Preserve preview/approval/lease/hash/revision requirements.
5. Run the existing command/domain operation. Storage and resource sinks also enforce their own destination rules; output filtering cannot undo an earlier write or fetch.
6. Re-read context after asynchronous work; construct only the allowed response. Reject stale evidence or unsafe required fields, never fabricate a pass or silently relabel pixels.
7. Adapters serialize the safe result. Embedded action compositions and runtime history must not add raw fields back; transport-level errors use fixed safe text.
8. Immediately before each provider send, check current recipient/context and final prompt/image parts. If transport is asynchronous, recheck after the response before delivering the result. At persistence sinks, independently check whether even that safe result may be stored.

Coordinate a policy switch with mutation admission and storage side effects: define one observable ordering, not two unrelated checkbox reads.
If the switch wins, old work cannot start a forbidden write/send. If a commit has already completed, preserve and report its actual outcome;
revoke future permission without claiming that the prior commit or disclosure was undone. Exercise delayed render, apply, storage and transport callbacks.
Abort is best effort: discard obsolete callbacks, but query uncertain transaction outcomes before deciding what happened.

## Compatibility decisions

The narrowed outputs and opaque-reference semantics are breaking Agent changes under the [version matrix](COMPATIBILITY_MATRIX.zh-CN.md).
Agent Contract 4.0.0 is the implemented migration major for the closed projections, opaque references and policy/scope gates. Full M4 acceptance evidence remains open.
Do not advance the single-HTML protocol or engine merely because Agent JSON changes. Studio release version follows its own rules;
the MCP server implementation version is independent and must not masquerade as the Agent Contract version.

| Consumer/surface | Required migration | Release gate |
|---|---|---|
| Embedded runtime | Adapt reads, preview proposal composition, review-hook outputs, safe error handling and reference round-trips | No direct bus/project fallback when a safe field is unavailable; internal proposal state remains local |
| Layout review | Consume projected reviewedRevision, evidence IDs and safe design references; validate derived image/context metadata | Geometry/Synthetic pixel rules survive composition, mode changes and repeated passes |
| WebMCP | Register reviewed catalog/schema for the loaded page and route all calls through shared checks | Text and structuredContent agree; old registrations are disposed on document/app replacement |
| MCP/CDP | Compare supported local contract/version/catalog to the live page before advertising business tools or calling them; complete host admission and recheck on reconnect/page replacement | The CDP client performs the exact preflight, obtains an opaque memory-only admission, carries it on business calls and resets it on target replacement/reconnect. MCP `tools/list` refuses to advertise the business catalog when the live page is unavailable or incompatible |
| Public window gateway | Apply the closed registry rule to execute as well as listTools; provide safe compatibility/bootstrap failure | No hidden dispatch-only access; get_capabilities or read-only version metadata remains usable for diagnosis |
| Setup and guidance | Update constants-derived copies, agent-setup manifest/schema as needed, llms.txt, setup docs, runtime-loaded designer guidance, action examples and MCP instructions together | Examples distinguish static synthetic examples from live references; no obsolete raw output or auto-apply promise |
| Human editor / saved HTML | Keep full internal results, canonical identifiers and explicit-save behavior under the data policy | Open/edit/undo/save/export regressions pass; redacted FormSpec is never saved as the full project |

Version bootstrap remains metadata-only and must not become a persisted per-client permission database. The page gateway now requires a host-bound in-memory compatibility session before business calls: `get_capabilities` is a diagnostic/bootstrap read, not permission to execute business commands. `admitClient` requires the exact protocol, Agent Contract and complete catalog, binds the resulting opaque admission to the current session/document, and invalidates the prior admission on replacement.
External version claims indicate compatibility, not trust or identity. Block unsupported clients with a safe explanation to update/reconnect.
The first-party CDP client implements the preflight, host admission and token carry-through with stable mismatch codes; it resets the check and re-admits on target replacement/reconnect. MCP does not advertise the business catalog until that handshake succeeds. WebMCP derives its registered catalog from the same source and disposes old registrations on replacement; its registration is host-bound and does not expose a caller-supplied identity or a persisted admission token.
`redo_revision` remains a separately reviewed reachability/catalog decision; raw-source Agent rejection remains mandatory.
Never retain a raw-output compatibility path for Real/Unknown. Prefer one new safe contract across all modes, with only the documented Synthetic pixel extension.

## Ordered implementation packages

M0 inventory and the private UI approval-capability correction are retained. The isolated M1
PI-03 classification/session-lifecycle path is requalified in S16; broader M1 and M2/M3 acceptance
remains **Partial**. M4 is incomplete; M5 release evidence is **Pending**. Historical aggregate runs
do not override case-specific current evidence.
Role names below identify responsibilities, not assigned people. No deployment is authorized.

| Order / owner role | Bounded work package | Dependency and exit evidence |
|---|---|---|
| M0 / Tech Lead + QA | Freeze reviewed 35-command variants, runtime wrapper inventory, compatibility decision and controlled canary fixtures; assign implementation/review owners | Implemented inventory, version baseline and public matrix foundation; case-specific privacy evidence remains open |
| M1 / Host + storage owner | Authoritative classification before install/hydrate and at every side effect; durable/recovery/session/cache/resource/file boundaries | Partial: the application-controlled destination inventory is reconciled to 13-01..13-08, with imported provenance, missing session policy, delayed store admission, explicit-save and recipient replacement controls evidenced. Complete overwrite/recovery and mapped P0 cases are now evidenced; provider/OS/deployment retention needs separate evidence before claiming the milestone |
| M2 / Gateway + domain owner | Closed projections/errors and reference resolution through existing gateway; couple scope/apply checks to domain admission and late-result handling | Partial: closed projections, malformed required-shape rejection, transaction document/session/policy binding, focused direct-transaction/history/FormSpec boundary tests, fail-closed host scope construction, project-replacement scope reset, session/document/policy references, scope/apply guards and a private UI-owned approval capability exist; PI/provider compatibility and broader M2 regression evidence remain before the M2 exit claim |
| M3 / Runtime + adapter owner | Migrate embedded wrappers/review/provider payloads, WebMCP and MCP/CDP; synchronize versions, schemas and guidance | Partial: R5/R6 prompt wording, R7 actual prompt delivery and host-bound MCP/CDP admission are corrected. The browser default now uses the reviewed origin-bound Demo session (`/demo/session` → provider-tool-free `/demo/v1/responses`) without a private key, rejects Demo-incompatible SVG evidence and keeps the host catalog local; model-alias compatibility remains unverified. Three-engine panel, recipient replacement, second-wire and admission checks pass against controlled substitutes; PI direct-provider, deployment and release compatibility remain open |
| M4 / QA + reviewer | Combined privacy/scope/apply/state races, no-op/recovery and human-editor regressions | Bounded M1 controls pass serially, including actual browser sink/payload checks; complete the relevant PI/M4 regressions. The mapped P0 cases are now closed in the register; earlier 190/222, 54/54 and Provider-delay sequences remain historical evidence |
| M5 / Release owner | Record build/client versions, supported environment, remaining limitations, rollback drill and release decision | M4 and all applicable PROD-10/12 gates; maintainer authorization required before rollout |

M1 and M2 helper tests can be developed in parallel once the shared context contract is fixed; integration activation waits for both.
Deliver incremental patches behind an unavailable Agent path or a controlled synthetic test fixture until M1-M3 gates pass.
Do not release partial privacy protection as Real/Unknown support. Full PROD-13 closure also needs all storage/cache/asset checks, not merely M2.
PROD-01/02/03 remain independent acceptance obligations; M2 cannot mark them complete from schema tests alone.

## Failure, rollback and recovery

| Situation | Required behavior | Forbidden fallback |
|---|---|---|
| Unsupported client / invalid reference / preflight failure | Reject before new work; fixed safe code/text, actionable reconnect or re-inspect instruction | Raw identifiers/results, whole-document scope, fabricated empty valid result |
| Projection fails after known successful commit | Host retains committed state and same-context transaction outcome; mark response unavailable and query transaction/revision before retry | Reporting not applied, repeating apply, rewriting receipts or automatic rollback |
| Disconnect/timeout with uncertain outcome | Stop automatic mutations; use existing same-context transaction/revision recovery when possible, otherwise require human reconciliation | Treating timeout as proof of no commit or replaying convenience mutations |
| Document/provider/policy replacement | Reject stale delivery; invalidate write references; preserve restricted host-local old-context reconciliation while the context exists | Sending old results into a new document/provider session |
| Reload of volatile Real/Unknown session | Explain that unsaved state and local reference maps are not recoverable from prohibited stores | Silently hydrating legacy real-data records to provide seamless recovery |
| New safe Agent path fails in rollout | Disable affected Agent access; retain permitted human editing and explicit saving; investigate using synthetic reproduction | Downgrading to raw legacy gateway, deleting projects/stores, or labeling disabled protection as success |

For a volatile context, recovery is bounded by its lifetime. Do not promise durable post-reload reconciliation without an explicitly permitted record.
Before an app reload/rollback that would lose volatile work, give the user an explicit permitted save opportunity or a clear loss warning.
Roll back only compatible app/client artifacts; stale Service Worker/page/MCP combinations must fail closed, not silently mix contracts.
Existing user HTML and durable synthetic records are not schema-migrated by an Agent projection change. Inventory before any future cleanup; deletion needs separate explicit scope.
Operational diagnostics use fixed codes/counts/version metadata; do not log failed payloads, prompts, credentials or real-data reference maps.

## Verification and closure

- Extend existing gateway, webmcp, cdp-client, agent-workflow, agent-layout-review, agent-provider-media/transport and transaction-recovery tests; add focused cases where coverage is absent.
- Check bootstrap/version copies with agent-bootstrap and tests/version.test.js; test new-server/old-page, old-server/new-page, reconnect and cached-page combinations.
- Assert actual mutations/persistence/provider requests as well as response fields. Use real browser capture for visual evidence, controlled transports and synthetic canaries.
- Cover parse/preflight/dispatch/projection/adapter errors, direct/wrapped transactions, unknown variants, malformed required fields and duplicate deliveries.
- Map M1-M4 evidence to existing 13-01..08, 01-01..08, 02-01..08, 03-01..08 and X-01..03; retain the 35-case total.
- Record source/build/client versions, test owner, fixture, expected/actual result and safe evidence reference. Do not attach private documents or raw provider payloads.
- Run applicable regressions/build checks when implementing; doc-only link/diff checks are not behavioral acceptance.
- Update TASK only after observed results; neither a completed plan nor a new contract version declares Production Ready.

## SCMC review

- Scope: enforcement and migration plan; evidence: current first-party host/gateway/domain/runtime/adapters; constraints: no deployment/provider authorization, privacy, compatibility and transaction integrity.
- Simple: PASS. Reuse the gateway and current domain/store owners; no new service or duplicate schema catalog.
- Clear: PASS. Admission, commit, output delivery and rollback outcomes have distinct owners and gates.
- Modular: PASS. Canonical domain results stay internal; projection, transport and persistence enforce separate responsibilities.
- Consistent: PASS. Shared shapes, four version lines and existing acceptance IDs remain authoritative.
- Findings: review-time High classification/session failures and the host admission gap have bounded fixes, not complete milestone acceptance. See [resumed evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md); bounded overwrite/recovery, scope/apply/state and all 35 P0 case records are closed within their documented scope, while PI/M4 evidence remains.
- Overall: PASS for the required owner/dependency design, FAIL for treating the current foundation as conformant. Highest-value next action in the resumed implementation: finish the remaining M1/M3 acceptance at existing owners, then close M4 evidence.
