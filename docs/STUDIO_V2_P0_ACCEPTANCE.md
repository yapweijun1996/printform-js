# Studio v2 Priority Acceptance Checklist

Prepared: 2026-09-08. Source baseline: `d2536999ae3edd3d94e315bb245ab94f8b74e65d` plus the uncommitted amendment snapshot.
Scope: PROD-13, PROD-01, PROD-02 and PROD-03; 35 cases: **5 Pass (13-01/02/03/05/06), 2 Fail (13-04/08), and 28 Not run**. The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) reopens lifecycle acceptance; retained browser results prove only their recorded sequences, not the latest worktree or all transitions.
These are release acceptance criteria, not a Production Ready declaration or permission to deploy.

## Authority and execution rules

- The [production plan](STUDIO_V2_PRODUCTION_PLAN.md) owns requirements, code evidence and release dependencies.
- This checklist expands those four requirements into observable cases; [TASK](../TASK.md) owns implementation status.
- Check a box only after the expected result is demonstrated and a case-specific evidence record exists.
- Record results as Pass, Fail, Not run or Blocked. Missing evidence is never Pass; Blocked requires a stated unavailable prerequisite.
- Preserve single HTML, the existing pagination engine, semantic Agent operations, revision/hash checks and human production export.
- A rejected operation must leave the committed project content/hash and revision unchanged; safe rejection audit metadata is allowed.
- UI labels, command responses and stored state are observed separately. A screenshot alone cannot establish persistence or transaction safety.
- Proposed defaults and deployment limits in the production plan remain Proposed. This checklist does not adopt them.

## Fixtures and evidence

- Use synthetic Sales Invoice, Purchase Order and Progress Claim fixtures; include legacy HTML without explicit FormSpec.
- Use two independently identified tables, a shared theme, a header and a footer to expose effects beyond a selected component.
- Place unique synthetic canaries in document title, sample values, rendered text and proposal content. Never use actual ERP data.
- Record initial document ID, committed revision/content hash, candidate ID/hash and selected scope before each case.
- Inventory application-owned persistence: durable head, revisions, transactions, evidence, recovery, sessions and other stores actually used.
- Inspect writes from before import/CommandBus construction through asynchronous completion, then reload and inspect stored content.
- Inspect the decoded application-owned payloads, not only storage key names or the final storage snapshot; transient forbidden writes also fail.
- Capture provider-bound requests with a controlled test transport. Use deterministic proposals, delayed responses and injected failures.
- Use real browser rendering for UI/evidence cases. Controlled AI responses test host enforcement, not live-provider reliability.
- Run entry-point cases through embedded AI, WebMCP and the first-party CDP gateway with equivalent host context; exercise the underlying domain guard too.
- Evidence record: case ID, date, tester, source commit/worktree delta, fixture, environment, steps, expected/actual result and artifact/test reference.
- Application/privacy evidence must use synthetic fixtures and omit credentials. Server persistence checks apply when that adapter is in the tested profile.

## PROD-13: real-data classification and persistence

Current foundation: explicit restrictive host policies select volatile transactions and session stores; imports initially use Unknown; recovery requires an explicit action; Agent results use closed projections. Known exceptions: stale sample provenance can broaden an imported policy, the session constructor without a policy defaults to Synthetic, and a delayed session-index open can write after a switch to Real. See [direction review](STUDIO_V2_DIRECTION_REVIEW.md); a fallback status label is not proof that every storage path is guarded.
Owner boundary: host data policy before project installation, then storage adapters and Agent/evidence gateways.
Dependency: complete the [data classification and destination rules](STUDIO_V2_DATA_POLICY.md) evidence mapping, including browser reload, delayed callbacks, all sinks and transitions. Its acceptance mapping expands 13-01..13-08 without adding new case IDs.
Cases 13-02/04/06/07/08 use the [35-command output allowlist](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and its nested shapes. Targeted unit evidence exists for projection, scope, policy, direct-root transactions and undo project exclusion; no case is marked Pass until the full observable record is captured.
The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) sequences this work without adding case IDs. Include composed runtime outputs, adapter errors/version mismatch, final provider sends and post-commit delivery failures in the mapped cases; source or documentation checks alone do not satisfy them.

The target is no unauthorized persistent copies or automatic disclosure. An explicit user file save is a separate destination;
it must not silently enable recovery, chat or transaction persistence. Volatile sessions must be labeled as non-durable.

- [x] **13-01 Unknown import and missing-policy default — Pass.** Import an unclassified canary document. Before installation, classify it as potentially real; no automatic payload-bearing durable/recovery/session write or raw Agent exposure occurs. Install the page gateway and WebMCP adapter without a policy getter and verify they also fail closed as Unknown. A trusted artifact signature or missing configuration does not certify synthetic data.
- [x] **13-02 Persistent sinks — Pass.** In real-data mode, preview, edit, approve, apply and review. Inspect writes and persisted records in every inventoried sink; no new unauthorized canary copy occurs. Allowed safe metadata matches the documented destination policy.
- [x] **13-03 Fresh reload — Pass.** Close/reload a fresh real-data session. No hidden project/chat restore comes from forbidden persistence; the UI explains the lack of automatic recovery. Explicitly saved files remain separate user-owned artifacts.
- [ ] **13-04 In-flight mode/document/no-policy change — Fail (reopened).** Start delayed controlled AI requests in synthetic mode, then select real-data mode, replace the document, and separately make the host getter report no active policy. Old callbacks cannot use the old policy to persist or expose document values/pixels. Missing current policy rejects the old context instead of falling back to its previous Synthetic policy.
- [x] **13-05 Existing records — Pass.** Seed old synthetic canary records, then switch classification to real. Stop new forbidden writes and automatic replay; show that old copies may remain. Do not silently delete records or claim historical copies have been erased. Any explicit cleanup identifies the exact affected project records.
- [x] **13-06 Outbound evidence — Pass.** In real-data mode, request summaries, diagnostics, audit/recovery results and pixel evidence through each Agent entry point. Raw business values are absent from automatic outputs; pixel capture is rejected; permitted geometry is redacted. Caller-supplied synthetic flags cannot override host classification.
- [ ] **13-07 Explicit save and user prompts.** An intentional file save writes only the chosen artifact and does not enable other persistence. Separately verify the existing disclosure that user-entered prompt text is sent to the chosen provider; never describe real-data mode as anonymizing arbitrary user text. Use synthetic text for this test.
- [ ] **13-08 Control and failure paths — Fail.** A declared synthetic fixture retains supported recovery/session behavior. With storage denied/quota exceeded, no alternate forbidden sink is used; the UI states the actual persistence result. Importing a different unclassified document does not inherit synthetic classification.

Pass evidence: import/write ordering, destination inventory, canary scan, controlled outgoing payloads and reload traces.
For an enabled server adapter, run the same destination rules against its persisted project/transaction/evidence records. The current boundary test proves Unknown and Real reject the document HTTP route before SQLite initialization and do not create a database file; Synthetic persistence remains a separate positive control. This does not close the complete server deployment/privacy record.

### Current targeted M4 evidence (not P0 case closure)

Resumed correction evidence is recorded in [implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md).
R1-R3 and R5-R7 have code fixes and bounded passing controls; 13-04/08 retain Fail pending complete mapped
reverification. Do not read the historical failure descriptions below as proof those exact defects still reproduce.

`e2e/studio-v2-production-boundary.spec.js` passes eight Chromium cases in the current worktree. The explicit export, decoded Cache Storage, session-policy and final Provider wire cases are in `e2e/studio-v2-production-export.spec.js`, `e2e/studio-v2-service-worker.spec.js`, `e2e/studio-v2-session-policy.spec.js`, and `e2e/studio-v2-provider-wire.spec.js`; those files add four targeted Chromium cases to the boundary set:

Pre-review evidence: the full Windows Playwright run passed 190/222 with 32 expected skips; the targeted set passed 54/54 and the earlier 13-01..06 sequences passed in three engines. These runs predate the latest session edits and do not close the failures found by the direction review. They are not Edge, Safari.app or system-print certification.

- An imported Unknown canary remains volatile after switching to Real, including localStorage, sessionStorage, IndexedDB database names and Cache Storage URLs; reload starts without hidden recovery and without the canary.
- Unconfigured page gateway and WebMCP adapters default to Unknown before durable storage or pixel capture; the local durable key set remains unchanged and pixel evidence is rejected.
- A controlled runtime captures the final Real-mode Provider input. The payload contains geometry SVG parts only; pixel evidence is rejected by the gateway.
- Direct document mutations remain blocked until explicit human approval, and transaction previews do not create browser durable records.
- A controlled delayed Provider result is rejected with `STALE_POLICY_CONTEXT` after the browser switches from synthetic to Real mode; the stale canary is absent from the returned outcome.
- A controlled delayed Provider result is rejected with `STALE_POLICY_CONTEXT` after the browser switches documents; the wrong-document canary is absent from the returned outcome.
- An explicit Real-mode Untrusted file export produces a browser download without adding localStorage, sessionStorage, IndexedDB or Cache Storage entries.
- The browser storage inspector decodes every IndexedDB object store and Cache Storage response body; an arbitrary same-origin navigation is not cached, an old Synthetic session record remains, and a new Real session canary is absent from persisted IndexedDB.
- The controlled Provider wire case captures the actual second Chat Completions request after `printform_get_project_summary`; the safe Agent result and the follow-up preview call are present, while the Real-document canary, business-value canaries and credential are absent from the JSON body. The synthetic credential appears only in the Authorization header of the controlled request.
- Unknown and Real server policies reject the document HTTP route before SQLite initialization; no database file is created, while the explicit Synthetic server acceptance remains covered by E13-SERVER tests.
- `e2e/studio-v2-apply-policy.spec.js` passes in Chromium, Firefox and WebKit. A delayed chat proposal remains pending for both Preview→Auto and Auto→Preview switches; it is not retroactively approved.
- `render-controller.test.js` passes three request-ownership cases. A late committed-render failure and late candidate failure/frame error cannot overwrite the newer render state or hide the newer candidate.
- The Real-policy public command matrix executes all 35 commands with document canaries and verifies safe success/error envelopes contain no canary; `agent-entry-parity.test.js` separately checks embedded, WebMCP and first-party CDP diagnostics, redacted geometry and pixel rejection. This is supporting 13-06 evidence, not its final browser-level Pass record.
- `e2e/studio-v2-p0-prod13-existing-records.spec.js` decodes old durable head/transaction/audit, recovery, IndexedDB session, Cache Storage, sessionStorage and unrelated-project records across all three engines. Switching to Real adds no storage keys, databases or caches; explicit discard removes only the named recovery record and leaves the other records intact.
- `e2e/studio-v2-p0-prod13-outbound.spec.js` projects the same Real canary through embedded and WebMCP in all three engines and through the first-party CdpStudioClient over Chromium CDP. Summaries, FormSpec, components, design state, transactions, history, audit, Evidence Pack, validation and geometry omit the canary; geometry is redacted and `synthetic: true` cannot enable pixels. This closes 13-06's mapped browser entry paths; live provider and remote-store retention remain out of scope.

### Case-specific evidence: PROD-13 13-01 — Pass

- Date: 2026-09-08; source: current uncommitted worktree; environment: Windows Playwright Chromium, Firefox and WebKit, one worker.
- Fixture: generated synthetic Sales Invoice HTML with `UNKNOWN-CANARY-20260908` inserted into sample data; no credentials, business data or live provider.
- Steps: snapshot localStorage, sessionStorage, IndexedDB and Cache Storage; import the canary file; observe Unknown policy; request safe summary/document inspection/preview and pixel evidence; install page gateway and WebMCP against a Synthetic Bus without a host policy getter; repeat capability/pixel probes; inspect decoded storage and cache entries.
- Expected/actual: import remains Unknown; preview stays volatile; pixel evidence is rejected; safe Agent payloads and every inspected sink omit the canary; the unconfigured adapters reject the Synthetic Bus as `STALE_POLICY_CONTEXT` or reject pixels as `PIXEL_EVIDENCE_SYNTHETIC_ONLY`; no imported file is cached. Actual result matched in all three engines.
- References: `e2e/studio-v2-p0-prod13.spec.js`; `tests/studio-v2/gateway.test.js` and `tests/studio-v2/webmcp.test.js` missing-policy cases; the 17/17 targeted adapter unit run.

### Case-specific evidence: PROD-13 13-02 — Pass

- Date: 2026-09-08; source: current uncommitted worktree; environment: Windows Playwright Chromium, Firefox and WebKit, one worker.
- Fixture and canary: shipped synthetic Sales Invoice sample; after an explicit Real-mode switch, the human source editor changed the in-memory manifest title to `REAL-SINK-CANARY-20260908`; no credentials, business data or live provider.
- Steps: inspect browser storage; perform the human edit; run public gateway `preview_changes`, `approve_transaction` and `apply_changes`; run default and long-text geometry evidence capture and `complete_layout_review`; inspect decoded localStorage, sessionStorage, every IndexedDB store and Cache Storage.
- Expected/actual: committed revision advanced only in memory; geometry evidence and review passed; document-associated `printform:` keys, recovery state, session records, cache URLs/bodies and decoded transaction/review outputs contained no canary. The existing enabled-server boundary test also rejected Unknown and Real document persistence before SQLite initialization and left no database file.
- References: `e2e/studio-v2-p0-prod13-persistent-sinks.spec.js` (3/3 browser engines); `tests/studio-v2/server-policy.test.js` (Unknown/Real pre-SQLite rejection).

### Case-specific evidence: PROD-13 13-03 — Pass

- Date: 2026-09-08; source: current uncommitted worktree; environment: Windows Playwright Chromium, Firefox and WebKit, one worker.
- Fixture and canary: shipped synthetic Sales Invoice sample; after switching to Real mode, the human source editor changed the in-memory manifest title to `REAL-RELOAD-CANARY-20260908`; no credentials, business data or live provider.
- Steps: inspect decoded browser storage; perform an explicit Untrusted export and wait for the browser download; confirm the save state reports download started; reload the page; query the public summary, recovery banner, policy and decoded storage.
- Expected/actual: the export filename ended in `-untrusted.html` and did not change application storage; after reload the session returned to Synthetic revision 0 with no recovery banner, no canary and no hidden Real-data restoration. Actual result matched in all three engines.
- References: `e2e/studio-v2-p0-prod13-fresh-reload.spec.js` (3/3 browser engines).

### Case-specific evidence: PROD-13 13-04 — Fail (reopened)

- Date: 2026-09-08; source: current uncommitted worktree; environment: Windows Playwright Chromium, Firefox and WebKit, one worker.
- Steps: run controlled delayed Provider responses while switching Synthetic to Real and while replacing the selected document; separately run a delayed response whose host policy getter changes from Synthetic to no current policy; inspect the final runtime outcome and canary exposure.
- Expected/actual: mode-switch, document-switch and missing-policy callbacks all return `STALE_POLICY_CONTEXT`; the final result is null and delayed canaries are absent. A missing current policy is rejected rather than replaced with the previous Synthetic policy. Actual result matched in all three engines; no live provider or private data was used.
- References: `e2e/studio-v2-production-boundary.spec.js`, `e2e/studio-v2-p0-prod13-policy-race.spec.js` (combined 9/9 relevant browser cases across three engines); `tests/studio-v2/agent-workflow.test.js` (missing-current-policy unit case).
- Reopening evidence (2026-09-08 direction review): a Node probe imported the actual session manager, delayed a fake IndexedDB open, switched Synthetic to Real, then released the open. The fake sink observed one label write under Real; expected zero. No real database was used. Earlier Provider-delivery passes remain valid only for their narrower sequences.
- Closure requires current-policy checks at storage admission and after awaits, followed by delayed index/runtime-store and document/session/policy replacement browser cases; do not infer storage safety from a rejected final Provider result.
- Resumed update: index/runtime admission guards, active-write cancellation and panel callback invalidation are implemented. Unit controls and three-engine runtime-open/panel tests pass; complete mapped case review is still required.

### Case-specific evidence: PROD-13 13-05 — Pass

- Date: 2026-09-08; source: current uncommitted worktree; environment: Windows Playwright Chromium, Firefox and WebKit, one worker.
- Fixture and canaries: two old synthetic durable projects with transaction/audit records, one synthetic recovery project, one IndexedDB session plus runtime message, one legacy Cache Storage response, one sessionStorage record and one unrelated project; all values are synthetic canaries and no credentials or live data.
- Steps: seed the records through the existing DurableTransactionStore, recovery helper, AgentSessionManager, Agrun IndexedDB session store and Cache Storage; reload and verify the recovery payload stays dormant; switch the active policy to Real; create a new Real session; inspect decoded local/session/IndexedDB/cache payloads; explicitly discard the visible recovery record and inspect again.
- Expected/actual: the current UI/Agent summary did not replay the old recovery project; Real mode added no local/session keys, IndexedDB databases or cache names, and the new Real session remained memory-only. The old durable, transaction/audit, session, cache, sessionStorage and unrelated-project canaries remained. Explicit discard removed only `printform-studio-v2-recovery`; no historical record was silently deleted or represented as erased. Actual result matched in all three engines.
- References: `e2e/studio-v2-p0-prod13-existing-records.spec.js` (3/3 browser engines); `e2e/studio-v2-recovery-boundary.spec.js` and `e2e/studio-v2-session-policy.spec.js` (supporting 6/6).

### Case-specific evidence: PROD-13 13-06 — Pass

- Date: 2026-09-08; source: current uncommitted worktree; environment: Windows Playwright Chromium, Firefox and WebKit, one worker; Chromium additionally used the first-party `CdpStudioClient` over a real Playwright CDP transport.
- Fixture and canary: an isolated Real-policy Sales Invoice project with the canary in the manifest title, invoice number and customer name; no credentials, business data or live provider.
- Steps: execute the diagnostic set through the embedded gateway and a registered WebMCP tool in each engine; execute the same set through the first-party CDP client in Chromium; request summaries, inspection/FormSpec/components/design state, transaction/audit/history/revision/Evidence Pack, validation, geometry evidence and pixel evidence with `synthetic: true`.
- Expected/actual: every successful and rejected response omitted the canary and unknown business fields; geometry returned the `geometry-only` redacted snapshot; pixel capture returned `PIXEL_EVIDENCE_SYNTHETIC_ONLY` despite the caller flag. The three entry paths returned equivalent safe outcomes. Actual result matched in all three engines, with CDP transport coverage in Chromium.
- References: `e2e/studio-v2-p0-prod13-outbound.spec.js` (3/3 browser engines); `tests/studio-v2/agent-entry-parity.test.js` and `tests/studio-v2/public-command-matrix.test.js` (supporting closed projection and all-35 Real-policy canary evidence).

The earlier observations support only the recorded paths. 13-04 is reopened by the delayed session-write failure; explicit-save/prompt separation, additional commit boundaries and complete application-controlled destination coverage remain open.

`tests/studio-v2/agent-entry-parity.test.js` passes four controlled cases: three Synthetic parity cases and one Real-data diagnostic/redaction case:

- Embedded gateway, WebMCP and CDP return the same `SCOPE_VIOLATION` for an out-of-scope operation and the same `HUMAN_APPROVAL_REQUIRED` for a direct mutation in Preview mode; revision and transactions remain unchanged.
- CDP can use the page gateway's opaque transaction reference, while WebMCP cannot reuse that reference from its distinct Agent session; no raw transaction ID is exposed.
- Three delayed previews started through the three paths all return `STALE_POLICY_CONTEXT` after a Synthetic-to-Real switch; the started draft traces remain draft-only, with no preview result or commit.
- Real-data summary, validation, transaction, audit, history, Evidence Pack and geometry-evidence requests hide a canary consistently through embedded, WebMCP and CDP; geometry remains redacted, while a caller-supplied `synthetic: true` does not bypass the Real-mode pixel rejection.

This is controlled adapter/domain evidence for 01-07, 02-01/02-02, 13-04/13-06 and X-02. The dedicated 13-06 browser case now closes the three mapped entry paths; CDP target replacement/reconnect, complete sink inventory and the remaining P0 cases are still open. Current register: 5 Pass (13-01/02/03/05/06), 2 Fail (13-04/08), and 28 Not run.

The first-party CDP admission evidence now includes five compatibility tests and two controlled local HTTP/WebSocket transport tests. The client compares the complete live `get_capabilities.result.tools` catalog, rechecks it after target replacement/reconnect, and rejects a replaced page with a changed catalog before issuing a business command. WebMCP evidence verifies that registered tools equal the gateway catalog and that old registrations are aborted before a replacement registration. These are controlled transport/lifecycle records, not a browser WebMCP implementation or a P0 Pass.

Supporting 13-05 evidence: `e2e/studio-v2-recovery-boundary.spec.js` and `e2e/studio-v2-session-policy.spec.js` pass 6/6 across Chromium, Firefox and WebKit. The dedicated existing-record case adds exact cross-store/project mapping, no-new-destination checks and scoped explicit cleanup; credential-vault contents remain a separate preference/secret destination and were not treated as document records.

### Case-specific evidence: PROD-13 13-08 — Fail

- Date: 2026-09-08; evidence: read-only source review plus isolated Node probes using synthetic values and in-memory replacements, not a full browser case rerun.
- Actual: invoking the exact host policy-toggle function with an imported document and the retained sample key returned Synthetic with durable storage enabled. An unconfigured session manager also returned Synthetic. Both violate the restrictive missing/uncertain-origin rules.
- The isolated Chromium storage-denial subcase passed before this review; it does not cover import followed by mode loosening, delayed writes or asynchronous runtime-store failure. Fix and rerun these controls before changing this record to Pass.
- Resumed update: omitted policy now means Unknown, imported sample provenance is cleared, and loosening requires current-document confirmation/new storage context. Three-engine confirmation and storage-denial controls pass; expanded runtime-write failure/recovery acceptance remains under review.

## PROD-01: enforced operation and component scope

Current evidence: [agent panel](../studio-v2/ui/agent-panel.js) stores a structured activeScope;
[scope options](../studio-v2/core/agent-scope-options.js) derives stable FormSpec table IDs;
the shared [scope guard](../studio-v2/core/agent-scope.js) rejects ambiguous selectors and document-wide
repeatHeader mutations outside document scope. Full component selection and cross-entry browser evidence remain open.
Owner boundary: host selection maps to stable FormSpec IDs; the shared command/domain path enforces effective effects.
Dependency: define the operation-category allowlist and the component target set as separate dimensions.

Before implementing, record the supported category-to-operation mapping and document-wide operations.
The effective scope must come from trusted host context, remain bound to the proposal and be checked again before commit.
Missing or ambiguous scope must not silently broaden into whole-document permission.

- [ ] **01-01 Selection agreement.** Select table A in the preview or structure view. Both identify the same stable component; properties, context label and AI target agree. Changing the operation category does not silently change the selected component.
- [ ] **01-02 Allowed edit.** Permit a table-column edit for table A. Preview shows only allowed source changes; Apply commits once. Table B and unrelated source sections are unchanged. Normal derived page reflow is allowed and must not be mistaken for a source edit.
- [ ] **01-03 Wrong target/category.** Request table B or a theme mutation when only table A column edits are allowed. The command rejects it with an actionable error; no forbidden candidate is accepted and no revision commits.
- [ ] **01-04 Mixed batch.** Submit one allowed and one forbidden operation together. Reject the batch atomically; do not partially commit or silently remove an operation to change the requested intent.
- [ ] **01-05 Indirect global effects.** Attempt a shared theme/root flag, selector matching both tables or other document-wide source change under component-only scope. Reject unless its effective effects are inside the allowed boundary. A componentId field alone is not proof; include the known repeatHeader root-flag behavior.
- [ ] **01-06 Stale selection.** Create a candidate, then narrow scope, remove/replace the component or switch documents before Apply. The old candidate cannot commit using obsolete permission; show that a new preview/approval is needed. A stale base revision preserves the existing conflict behavior.
- [ ] **01-07 Adapter bypass.** Repeat allowed/forbidden requests through embedded AI, WebMCP, CDP and the domain guard. Removing/changing caller scope fields cannot broaden host permission; equivalent contexts produce equivalent decisions. Preserve the semantic Agent raw-source restriction.
- [ ] **01-08 Legacy and whole-document control.** Resolve legacy templates through the existing adapter. Ambiguous targets require explicit whole-document selection or remain blocked. An intentional whole-document edit can pass existing transaction/validation checks; switching back to component scope restores restrictions.

Pass evidence: selected IDs, host scope, effective source diffs, rejected mixed batch, adapter results and before/after revision hashes.

## PROD-02: one Apply policy for every AI path

Current evidence: [panel runtime](../studio-v2/ui/agent-panel-runtime.js) checks applyMode and the
low-risk operation allowlist for chat and Review auto-apply. Preview mode routes Apply through a
UI-owned session's privileged `executeHuman` method after the panel verifies its approval token.
The method is no longer present on the page-global gateway or ordinary bound session objects;
[gateway tests](../tests/studio-v2/gateway.test.js) and the Chromium production-boundary check cover
that negative surface. [Commit-boundary tests](../tests/studio-v2/commit-boundary.test.js) cover
duplicate Apply, lost Apply responses and recovery-required state; [runtime-consume tests](../tests/studio-v2/agent-runtime-consume.test.js)
cover Stop discarding a delayed provider result. Delayed responses across every entry point and the
complete retry matrix remain open.
Owner boundary: host Apply policy and transaction approval/commit boundary; UI projects the resulting decision.
Dependencies: PROD-01 scope eligibility and existing candidate/revision/transaction validation.

Keep the current auto default documented until a default change is adopted.
For auto mode, document the eligible operation/range rules before accepting the positive control; a risk label alone is insufficient.
Preview mode requires explicit human approval of the exact candidate, regardless of which AI path created it.

- [ ] **02-01 Chat preview.** In preview mode, generate a valid chat edit and wait for all callbacks. A pending candidate is visible; committed revision/hash remain unchanged until human Apply. Successful Apply commits exactly once and reports the real result.
- [ ] **02-02 Review repair.** In preview mode, make Review produce a repair. Review stops at pending approval, with no automatic commit. After Apply, a further repair requires its own candidate approval; the first approval cannot authorize later repairs.
- [ ] **02-03 Approval bypass and provenance.** From each registered Agent entry point, attempt approve/apply directly or claim that the user approved. Inspect page-global and ordinary bound-session gateway objects; the privileged method must be absent, while the UI-owned session path must still require the panel's approval token. In preview mode, missing trusted human approval cannot be supplied by the model or an untrusted Agent caller. Tampered approval capability, hash, expired transaction and stale revision remain rejected. Arbitrary browser debugging and hostile extensions are outside this app boundary and must not be described as sandboxed.
- [ ] **02-04 Mode changes.** Start in auto and switch to preview while a response is delayed. The resulting proposal remains pending. Switching preview to auto does not retroactively approve an existing pending candidate without a new explicit action; capture the applied policy at commit time.
- [ ] **02-05 Cancel and retry.** Stop/discard before Apply, then deliver late responses and retry callbacks. Nothing commits; the card does not say Applied. Distinguish cancellation before commit from a confirmed completed commit; Stop must not falsely claim to reverse completed work.
- [ ] **02-06 Duplicate Apply/unknown outcome.** Double-click Apply and simulate a lost commit response. Resolve using the existing transaction identity and durable state; at most one revision commits. If the outcome is still unknown, show recovery required instead of success or automatic resubmission.
- [ ] **02-07 Auto-mode control.** An explicitly eligible in-scope operation can auto-apply once through existing validation/hash gates. An ineligible, mixed, invalid or out-of-scope batch cannot. Preserve allowed human source-edit workflows and untrusted-project restrictions.
- [ ] **02-08 Host/prompt/export agreement.** Inspect runtime-loaded prompts and verify UI pending/applying/applied states follow actual policy/results. Neither AI approval nor a passing review initiates a production download; final human export confirmation remains required.

Pass evidence: controlled chat and Review repairs, host approval provenance, transaction results, duplicate/lost-response traces and revision history.

Targeted M4 evidence is not case closure: the current unit tests prove that a duplicate Apply returns
the existing committed revision without a second CAS, a lost response queries the same transaction,
an unresolved recovery state is retained without automatic resubmission, Stop prevents a delayed
provider result from creating a proposal, and the public gateway cannot expose the privileged method.
The full 02-01..02-08 evidence record remains Not run.

## PROD-03: truthful render, readiness and save state

Current evidence: [context view](../studio-v2/ui/agent-document-context.js) derives Printable from counts;
[CommandBus.readiness](../studio-v2/core/command-bus.js) also requires current committed render provenance and review.
Owner boundary: CommandBus owns committed state/export readiness; render controller owns render lifecycle;
the save operation owns save outcome. UI uses these existing owners instead of independent readiness calculations.
Dependency: identify document/revision/candidate on every asynchronous result. Display wording below is semantic, not a new API enum.

| Condition | Required visible meaning | Production export |
|---|---|---|
| No current committed render, or rendering | Waiting for preview / rendering | Unavailable |
| Current render failed or timed out | Preview failed with a retry action | Unavailable |
| Render succeeds but review is missing/stale/failed | Review required / blocked with reason | Unavailable |
| Candidate displayed | Candidate identity distinct from committed revision | Must not imply the candidate is the exportable committed artifact |
| Current committed readiness passes | Ready for human production-export confirmation | Eligible only for that exact committed revision |
| File write failed/cancelled or download merely started | Unsaved / cancelled / download started, as observed | No implied save success or readiness change |

- [ ] **03-01 Initial state.** Open a statically valid document with no current browser report. Context, Quality and export controls show missing preview/review requirements, never Printable solely because static error/warning counts are zero.
- [ ] **03-02 Render failure.** Delay, fail and time out the renderer. Every relevant surface shows pending/failure truthfully; a retry can restore progress, but failure cannot be overwritten by a static-valid result.
- [ ] **03-03 Review lifecycle.** Complete rendering, then simulate missing review, failed review, unavailable AI and a passing current review. Show the corresponding reason and next action; editing and policy-permitted draft saving remain possible while trusted export is blocked.
- [ ] **03-04 Invalidated evidence.** Apply an edit or Undo/Redo after a passing review. Old render/review evidence cannot make the new committed revision ready. Require the existing current-revision gates again.
- [ ] **03-05 Late/wrong result.** Deliver an old document report, old revision review or candidate render after a newer request/project switch. It cannot change current readiness or relabel the visible state as current committed output.
- [ ] **03-06 Candidate separation.** Display a candidate while the last committed revision is valid. Identify both states clearly. Any export of the last committed revision must explicitly identify it; never export or certify the candidate as committed. Discard restores the committed display/state.
- [ ] **03-07 Save independence.** Exercise failed/cancelled file writes, successful writes and download fallback. Only confirmed file-write completion marks that snapshot saved; an edit during save leaves the newer revision unsaved. Save/recovery success alone cannot mark production readiness. Full draft-overwrite coverage remains PROD-08.
- [ ] **03-08 Surface agreement.** For the states above, compare document context, Quality, action controls and request_export results, including five-language UI refresh. A warning-only count cannot override a blocking readiness condition; all gates passing allows human export without creating an automatic download.

Pass evidence: state-transition observations tied to document/revision/candidate, readiness responses, stale-result tests and actual save outcomes.

## Combined acceptance

- [ ] **X-01 Safe happy path.** Import a synthetic canary fixture as unknown, retain real-data policy, select table A, choose preview mode, request a valid edit, inspect diff, human Apply, render/review current revision, then human export. No unauthorized canary persistence/exposure; exactly one edit revision; exported artifact identifies that revision.
- [ ] **X-02 Interleaved policy changes.** With a candidate in flight, switch to real-data and preview mode, narrow scope and deliver the old result. No stale-policy commit, forbidden copy/disclosure or misleading ready/saved status occurs. Current committed content remains available in memory.
- [ ] **X-03 Cross-document isolation.** Start a review on document A, switch to unclassified document B and deliver A's callbacks. B retains its classification/scope/revision; A cannot overwrite B's project, evidence, save state or chat context.

## Verification ownership and completion

| Layer | Evidence required | Existing test areas to extend during implementation |
|---|---|---|
| Domain and adapters | Scope/policy rejection, atomicity, revision/hash and privacy response rules | command-bus, agent-workflow, transaction-recovery and server-transaction tests |
| Host/controller | Review/chat policy, mode changes, stale callbacks, save outcome projection | agent-panel-runtime, agent-layout-review, agent-document-context and agent-terminal-state tests |
| Real browser | Import-before-write, storage inspection, state/UI agreement, human actions | Existing Studio v2 E2E workflows; build site-dist first |

Reuse existing fixtures and test harnesses; do not replace domain tests with UI snapshots or certify live-provider behavior from mocks.
Each requirement needs named implementation and verification owners before execution; both are currently unassigned.
Current register: 5 Pass (13-01/02/03/05/06), 2 Fail (13-04/08), and 28 Not run. Documentation completion alone closes none of the four PROD requirements.
For every Pass, attach evidence; for every Fail, record the observed result and linked fix task. Required cases cannot be waived by a green aggregate suite.
Run relevant existing regressions after implementation and record the exact supported environment; wider browser/print release work remains PROD-10/12.
Rollback must retain user projects and durable records. Disable the affected AI path or revert the bounded change; never use blanket storage deletion.

## SCMC review

- Scope: four P0 acceptance contracts; evidence: linked code, targeted tests and the production plan; constraints: no deployment/provider authorization, existing trust/transaction/privacy invariants.
- Simple: PASS. Cases extend existing workflows and add no new service or protocol.
- Clear: PASS for the corrected register: 5 Pass (13-01/02/03/05/06), 2 Fail (13-04/08), and 28 Not run; earlier narrow evidence is retained without claiming complete lifecycle coverage.
- Modular: PASS. Host policy, command enforcement, storage, rendering and save outcome ownership are explicit.
- Consistent: PASS. Existing PROD IDs/status ownership and current-versus-target distinctions are retained.
- Findings: no material SCMC issue in the checklist; scope mappings and auto eligibility still need concrete implementation specifications.
- Overall: PASS for this corrected checklist, not for the implementation. The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) rates implementation conformance FAIL until the known classification/session gaps are fixed and verified; M4/M5 remain open.
