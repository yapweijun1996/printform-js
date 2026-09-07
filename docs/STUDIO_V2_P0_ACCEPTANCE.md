# Studio v2 Priority Acceptance Checklist

Prepared: 2026-09-07. Source baseline: `fb1a641450c2266a712a7b644b32609bea7c0e73` plus the reviewed documentation worktree.
Scope: PROD-13, PROD-01, PROD-02 and PROD-03. Documentation only; every case below is **Not run**.
These are Target acceptance criteria, not Current capabilities or permission to implement them.

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

Current evidence: [app.js](../studio-v2/ui/app.js) injects localStorage in installBus;
[durable store](../studio-v2/core/durable-transaction-store.js) initializes full project snapshots;
[studio actions](../studio-v2/ui/studio-actions.js) imports without first classifying data.
Owner boundary: host data policy before project installation, then storage adapters and Agent/evidence gateways.
Dependency: implement the [data classification and destination rules](STUDIO_V2_DATA_POLICY.md), including the complete sink inventory, safe projections and transitions. Its acceptance mapping expands 13-01..13-08 without adding new case IDs.
Cases 13-02/04/06/07/08 use the [35-command output allowlist](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and its nested shapes. Check direct-root transactions and undo project exclusion; public get_revision is already metadata-only. No additional case has been executed.
The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) sequences this work without adding case IDs. Include composed runtime outputs, adapter errors/version mismatch, final provider sends and post-commit delivery failures in the mapped cases; source or documentation checks alone do not satisfy them.

The target is no unauthorized persistent copies or automatic disclosure. An explicit user file save is a separate destination;
it must not silently enable recovery, chat or transaction persistence. Volatile sessions must be labeled as non-durable.

- [ ] **13-01 Unknown import.** Import an unclassified canary document. Before installation, classify it as potentially real; no automatic payload-bearing durable/recovery/session write or raw Agent exposure occurs. A trusted artifact signature does not certify synthetic data.
- [ ] **13-02 Persistent sinks.** In real-data mode, preview, edit, approve, apply and review. Inspect writes and persisted records in every inventoried sink; no new unauthorized canary copy occurs. Allowed safe metadata must match the documented destination policy.
- [ ] **13-03 Fresh reload.** Close/reload a fresh real-data session. No hidden project/chat restore comes from forbidden persistence; the UI explains the lack of automatic recovery. Explicitly saved files remain separate user-owned artifacts.
- [ ] **13-04 In-flight mode change.** Start a delayed AI/review request in synthetic mode, then select real-data mode. Old callbacks cannot use the old policy to persist or expose document values/pixels. Recheck policy at use time or cancel the request.
- [ ] **13-05 Existing records.** Seed old synthetic canary records, then switch classification to real. Stop new forbidden writes and automatic replay; show that old copies may remain. Do not silently delete records or claim historical copies have been erased. Any explicit cleanup identifies the exact affected project records.
- [ ] **13-06 Outbound evidence.** In real-data mode, request summaries, diagnostics, audit/recovery results and pixel evidence through each Agent entry point. Raw business values are absent from automatic outputs; pixel capture is rejected; permitted geometry is redacted. Caller-supplied synthetic flags cannot override host classification.
- [ ] **13-07 Explicit save and user prompts.** An intentional file save writes only the chosen artifact and does not enable other persistence. Separately verify the existing disclosure that user-entered prompt text is sent to the chosen provider; never describe real-data mode as anonymizing arbitrary user text. Use synthetic text for this test.
- [ ] **13-08 Control and failure paths.** A declared synthetic fixture retains supported recovery/session behavior. With storage denied/quota exceeded, no alternate forbidden sink is used; the UI states the actual persistence result. Importing a different unclassified document does not inherit synthetic classification.

Pass evidence: import/write ordering, destination inventory, canary scan, controlled outgoing payloads and reload traces.
For an enabled server adapter, run the same destination rules against its persisted project/transaction/evidence records.
Until that adapter is covered, do not claim server-mode privacy acceptance.

## PROD-01: enforced operation and component scope

Current evidence: [agent panel](../studio-v2/ui/agent-panel.js) only stores activeScope;
[scope view](../studio-v2/ui/agent-panel-view.js) offers all/layout/table/theme categories;
app.js supplies the selection label Entire document.
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

Current evidence: [panel runtime](../studio-v2/ui/agent-panel-runtime.js) checks applyMode in send,
but runLayoutReview invokes autoApplyPending without that check. Transaction approval is not itself proof of a human click.
Owner boundary: host Apply policy and transaction approval/commit boundary; UI projects the resulting decision.
Dependencies: PROD-01 scope eligibility and existing candidate/revision/transaction validation.

Keep the current auto default documented until a default change is adopted.
For auto mode, document the eligible operation/range rules before accepting the positive control; a risk label alone is insufficient.
Preview mode requires explicit human approval of the exact candidate, regardless of which AI path created it.

- [ ] **02-01 Chat preview.** In preview mode, generate a valid chat edit and wait for all callbacks. A pending candidate is visible; committed revision/hash remain unchanged until human Apply. Successful Apply commits exactly once and reports the real result.
- [ ] **02-02 Review repair.** In preview mode, make Review produce a repair. Review stops at pending approval, with no automatic commit. After Apply, a further repair requires its own candidate approval; the first approval cannot authorize later repairs.
- [ ] **02-03 Approval bypass.** From each Agent entry point, attempt approve/apply directly or claim that the user approved. In preview mode, the missing trusted human approval cannot be supplied by the model. Tampered hash, expired transaction and stale revision remain rejected.
- [ ] **02-04 Mode changes.** Start in auto and switch to preview while a response is delayed. The resulting proposal remains pending. Switching preview to auto does not retroactively approve an existing pending candidate without a new explicit action; capture the applied policy at commit time.
- [ ] **02-05 Cancel and retry.** Stop/discard before Apply, then deliver late responses and retry callbacks. Nothing commits; the card does not say Applied. Distinguish cancellation before commit from a confirmed completed commit; Stop must not falsely claim to reverse completed work.
- [ ] **02-06 Duplicate Apply/unknown outcome.** Double-click Apply and simulate a lost commit response. Resolve using the existing transaction identity and durable state; at most one revision commits. If the outcome is still unknown, show recovery required instead of success or automatic resubmission.
- [ ] **02-07 Auto-mode control.** An explicitly eligible in-scope operation can auto-apply once through existing validation/hash gates. An ineligible, mixed, invalid or out-of-scope batch cannot. Preserve allowed human source-edit workflows and untrusted-project restrictions.
- [ ] **02-08 Host/prompt/export agreement.** Inspect runtime-loaded prompts and verify UI pending/applying/applied states follow actual policy/results. Neither AI approval nor a passing review initiates a production download; final human export confirmation remains required.

Pass evidence: controlled chat and Review repairs, host approval provenance, transaction results, duplicate/lost-response traces and revision history.

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

- Scope: four P0 acceptance contracts; evidence: linked code and the production plan; constraints: docs only, existing trust/transaction/privacy invariants.
- Simple: PASS. Cases extend existing workflows and add no new service or protocol.
- Clear: PASS. Each case has a trigger, observable expected result and evidence requirement; all remain Not run.
- Modular: PASS. Host policy, command enforcement, storage, rendering and save outcome ownership are explicit.
- Consistent: PASS. Existing PROD IDs/status ownership and current-versus-target distinctions are retained.
- Findings: no material SCMC issue in the checklist; scope mappings and auto eligibility still need concrete implementation specifications.
- Overall: PASS for checklist design only. Data-destination and safe-output field rules are specified as Target; runtime enforcement and client compatibility remain pending and coding requires authorization.
