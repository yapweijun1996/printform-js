# Studio v2 Priority Acceptance Checklist

Prepared: 2026-09-07. Source baseline: `d2536999ae3edd3d94e315bb245ab94f8b74e65d` plus the uncommitted amendment snapshot.
Scope: PROD-13, PROD-01, PROD-02 and PROD-03. The implementation foundation is present, but every case below remains **Not run** until a case-specific evidence record is added.
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

Current implementation evidence: [app.js](../studio-v2/ui/app.js) classifies before CommandBus construction; restrictive policy creates a volatile store, memory-only sessions and blocks recovery writes. Recovery startup reads only safe metadata; full legacy records require an explicit Restore action and are reclassified before installation. [gateway.js](../studio-v2/adapters/gateway.js) and the [output projectors](../studio-v2/core/agent-output-projectors.js) enforce policy, references and closed results; [studio actions](../studio-v2/ui/studio-actions.js) classifies imports and keeps recovery cleanup explicit.
Owner boundary: host data policy before project installation, then storage adapters and Agent/evidence gateways.
Dependency: complete the [data classification and destination rules](STUDIO_V2_DATA_POLICY.md) evidence mapping, including browser reload, delayed callbacks, all sinks and transitions. Its acceptance mapping expands 13-01..13-08 without adding new case IDs.
Cases 13-02/04/06/07/08 use the [35-command output allowlist](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and its nested shapes. Targeted unit evidence exists for projection, scope, policy, direct-root transactions and undo project exclusion; no case is marked Pass until the full observable record is captured.
The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) sequences this work without adding case IDs. Include composed runtime outputs, adapter errors/version mismatch, final provider sends and post-commit delivery failures in the mapped cases; source or documentation checks alone do not satisfy them.

The target is no unauthorized persistent copies or automatic disclosure. An explicit user file save is a separate destination;
it must not silently enable recovery, chat or transaction persistence. Volatile sessions must be labeled as non-durable.

- [ ] **13-01 Unknown import and missing-policy default.** Import an unclassified canary document. Before installation, classify it as potentially real; no automatic payload-bearing durable/recovery/session write or raw Agent exposure occurs. Install the page gateway and WebMCP adapter without a policy getter and verify they also fail closed as Unknown. A trusted artifact signature or missing configuration does not certify synthetic data.
- [ ] **13-02 Persistent sinks.** In real-data mode, preview, edit, approve, apply and review. Inspect writes and persisted records in every inventoried sink; no new unauthorized canary copy occurs. Allowed safe metadata must match the documented destination policy.
- [ ] **13-03 Fresh reload.** Close/reload a fresh real-data session. No hidden project/chat restore comes from forbidden persistence; the UI explains the lack of automatic recovery. Explicitly saved files remain separate user-owned artifacts.
- [ ] **13-04 In-flight mode/document/no-policy change.** Start a delayed AI/review request in synthetic mode, then select real-data mode, replace the document, and separately make the host getter report no active policy. Old callbacks cannot use the old policy to persist or expose document values/pixels. Missing current policy rejects the old context instead of falling back to its previous Synthetic policy.
- [ ] **13-05 Existing records.** Seed old synthetic canary records, then switch classification to real. Stop new forbidden writes and automatic replay; show that old copies may remain. Do not silently delete records or claim historical copies have been erased. Any explicit cleanup identifies the exact affected project records.
- [ ] **13-06 Outbound evidence.** In real-data mode, request summaries, diagnostics, audit/recovery results and pixel evidence through each Agent entry point. Raw business values are absent from automatic outputs; pixel capture is rejected; permitted geometry is redacted. Caller-supplied synthetic flags cannot override host classification.
- [ ] **13-07 Explicit save and user prompts.** An intentional file save writes only the chosen artifact and does not enable other persistence. Separately verify the existing disclosure that user-entered prompt text is sent to the chosen provider; never describe real-data mode as anonymizing arbitrary user text. Use synthetic text for this test.
- [ ] **13-08 Control and failure paths.** A declared synthetic fixture retains supported recovery/session behavior. With storage denied/quota exceeded, no alternate forbidden sink is used; the UI states the actual persistence result. Importing a different unclassified document does not inherit synthetic classification.

Pass evidence: import/write ordering, destination inventory, canary scan, controlled outgoing payloads and reload traces.
For an enabled server adapter, run the same destination rules against its persisted project/transaction/evidence records. The current boundary test proves Unknown and Real reject the document HTTP route before SQLite initialization and do not create a database file; Synthetic persistence remains a separate positive control. This does not close the complete server deployment/privacy record.

### Current targeted M4 evidence (not P0 case closure)

`e2e/studio-v2-production-boundary.spec.js` passes seven Chromium cases in the current worktree:

- An imported Unknown canary remains volatile after switching to Real, including localStorage, sessionStorage, IndexedDB database names and Cache Storage URLs; reload starts without hidden recovery and without the canary.
- A controlled runtime captures the final Real-mode Provider input. The payload contains geometry SVG parts only; pixel evidence is rejected by the gateway.
- Direct document mutations remain blocked until explicit human approval, and transaction previews do not create browser durable records.
- A controlled delayed Provider result is rejected with `STALE_POLICY_CONTEXT` after the browser switches from synthetic to Real mode; the stale canary is absent from the returned outcome.
- A controlled delayed Provider result is rejected with `STALE_POLICY_CONTEXT` after the browser switches documents; the wrong-document canary is absent from the returned outcome.
- An explicit Real-mode Untrusted file export produces a browser download without adding localStorage, sessionStorage, IndexedDB or Cache Storage entries.
- Unknown and Real server policies reject the document HTTP route before SQLite initialization; no database file is created, while the explicit Synthetic server acceptance remains covered by E13-SERVER tests.

These observations strengthen the evidence for 13-02, 13-03, 13-04, 13-06 and 13-07 but do not mark them Pass: delayed callback variants across commit boundaries, every Agent entry point, and the complete destination inventory remain unverified.

`tests/studio-v2/agent-entry-parity.test.js` passes three controlled synthetic cases:

- Embedded gateway, WebMCP and CDP return the same `SCOPE_VIOLATION` for an out-of-scope operation and the same `HUMAN_APPROVAL_REQUIRED` for a direct mutation in Preview mode; revision and transactions remain unchanged.
- CDP can use the page gateway's opaque transaction reference, while WebMCP cannot reuse that reference from its distinct Agent session; no raw transaction ID is exposed.
- Three delayed previews started through the three paths all return `STALE_POLICY_CONTEXT` after a Synthetic-to-Real switch; the started draft traces remain draft-only, with no preview result or commit.

This is controlled adapter/domain evidence for 01-07, 02-01/02-02, 13-04/13-06 and X-02. It does not close the browser transport, reconnect/page-replacement, complete sink inventory or any P0 case; all 35 case records remain **Not run**.

The first-party CDP admission evidence now includes five compatibility tests and two controlled local HTTP/WebSocket transport tests. The client compares the complete live `get_capabilities.result.tools` catalog, rechecks it after target replacement/reconnect, and rejects a replaced page with a changed catalog before issuing a business command. WebMCP evidence verifies that registered tools equal the gateway catalog and that old registrations are aborted before a replacement registration. These are controlled transport/lifecycle records, not a browser WebMCP implementation or a P0 Pass.

The controlled Chromium recovery case seeds a synthetic canary as an old Real-classified record. Reload shows the recovery banner without installing the canary; an explicit Restore installs it under the restrictive Real policy, creates no new `printform:` durable key, and leaves the old record intact. This is evidence for the recovery ordering and no-automatic-replay rule, not a complete 13-05 existing-record inventory.

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
low-risk operation allowlist for chat and Review auto-apply. Preview mode routes Apply through the
gateway's privileged `executeHuman` method after the panel verifies its approval token. That method
is also present on the page-global gateway and bound session objects, so its provenance is not yet
protected from arbitrary same-origin script or raw CDP execution. [Commit-boundary tests](../tests/studio-v2/commit-boundary.test.js) cover
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
- [ ] **02-03 Approval bypass and provenance.** From each registered Agent entry point, attempt approve/apply directly or claim that the user approved. Also inspect page-global and bound-session gateway objects and attempt to invoke any privileged approval method through same-origin script/raw CDP. In preview mode, missing trusted human approval cannot be supplied by the model or an untrusted caller. Tampered approval capability, hash, expired transaction and stale revision remain rejected. If arbitrary page/CDP execution remains explicitly out of scope, record that limitation and avoid an unqualified human-approval security claim.
- [ ] **02-04 Mode changes.** Start in auto and switch to preview while a response is delayed. The resulting proposal remains pending. Switching preview to auto does not retroactively approve an existing pending candidate without a new explicit action; capture the applied policy at commit time.
- [ ] **02-05 Cancel and retry.** Stop/discard before Apply, then deliver late responses and retry callbacks. Nothing commits; the card does not say Applied. Distinguish cancellation before commit from a confirmed completed commit; Stop must not falsely claim to reverse completed work.
- [ ] **02-06 Duplicate Apply/unknown outcome.** Double-click Apply and simulate a lost commit response. Resolve using the existing transaction identity and durable state; at most one revision commits. If the outcome is still unknown, show recovery required instead of success or automatic resubmission.
- [ ] **02-07 Auto-mode control.** An explicitly eligible in-scope operation can auto-apply once through existing validation/hash gates. An ineligible, mixed, invalid or out-of-scope batch cannot. Preserve allowed human source-edit workflows and untrusted-project restrictions.
- [ ] **02-08 Host/prompt/export agreement.** Inspect runtime-loaded prompts and verify UI pending/applying/applied states follow actual policy/results. Neither AI approval nor a passing review initiates a production download; final human export confirmation remains required.

Pass evidence: controlled chat and Review repairs, host approval provenance, transaction results, duplicate/lost-response traces and revision history.

Targeted M4 evidence is not case closure: the current unit tests prove that a duplicate Apply returns
the existing committed revision without a second CAS, a lost response queries the same transaction,
an unresolved recovery state is retained without automatic resubmission, and Stop prevents a delayed
provider result from creating a proposal. They do not prove approval provenance against the exposed
`executeHuman` method. The full 02-01..02-08 evidence record remains Not run.

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
All 35 cases are Not run. Documentation completion closes none of the four PROD requirements.
For every Pass, attach evidence; for every Fail, record the observed result and linked fix task. Required cases cannot be waived by a green aggregate suite.
Run relevant existing regressions after implementation and record the exact supported environment; wider browser/print release work remains PROD-10/12.
Rollback must retain user projects and durable records. Disable the affected AI path or revert the bounded change; never use blanket storage deletion.

## SCMC review

- Scope: four P0 acceptance contracts; evidence: linked code, targeted tests and the production plan; constraints: no deployment/provider authorization, existing trust/transaction/privacy invariants.
- Simple: PASS. Cases extend existing workflows and add no new service or protocol.
- Clear: PASS. Each case has a trigger, observable expected result and evidence requirement; all remain Not run.
- Modular: PASS. Host policy, command enforcement, storage, rendering and save outcome ownership are explicit.
- Consistent: PASS. Existing PROD IDs/status ownership and current-versus-target distinctions are retained.
- Findings: no material SCMC issue in the checklist; scope mappings and auto eligibility still need concrete implementation specifications.
- Overall: PASS for checklist design and evidence governance only. Host policy, closed projections, scope/apply gates and first-party CDP version checks are implemented foundations; all 35 case records remain Not run and M4/M5 evidence is still required.
