# Studio v2 Direction and Conformance Review

Reviewed: 2026-09-08, after the user paused coding.
Status: review/documentation correction completed; implementation **Partial**.
Review-time SCMC implementation decision: **FAIL**. The policy direction is retained, not weakened.
The user explicitly resumed coding on 2026-09-08. R1-R3/R5-R6 now have bounded code corrections and verified controls;
see [resumed implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md). Full acceptance remains open; no release is authorized.

## Scope and authority

- Review the current dirty worktree against PROD-13, coordinated PROD-01/02/03 and M0-M5.
- Data policy owns classification, destinations and lifecycle requirements; output fields/shapes own Agent projections.
- The production plan owns acceptance criteria, the P0 register owns case evidence, and TASK owns execution status.
- This report records findings and corrective sequencing; it is not another source of policy rules.
- Evidence: root instructions, current policy/plan/status documents, host/session/gateway/domain/runtime sources, existing test scope, and isolated Node probes.
- No production data, real Provider, real database write, deployment, push or user-data deletion was used.

## Direction retained

Keep one host-owned current-document policy; Unknown/Real stays restrictive.
Enforce storage/send/commit permissions at their existing owners, with checks before side effects and after asynchronous work.
Use the existing gateway and closed per-command projections; references do not grant scope or approval.
Preserve canonical projects, internal IDs, revision/CAS, leases, candidate hashes, evidence signatures and truthful commit outcomes.
Keep explicit human export confirmation and separate file authorization from automatic chat/recovery persistence.
Do not introduce services, additional public commands, product-default changes or a reduced release profile to make acceptance easier.

## Review-time confirmed gaps (historical reproductions)

The following rows describe the pre-correction source/probes, not claims that the same defects still reproduce.
The linked implementation record owns the resumed correction and retest evidence.

| ID / severity | Evidence and consequence | Required correction / acceptance |
|---|---|---|
| R1 / High | app.js retained activeSampleKey on import. Its exact onDataPolicyToggle function, invoked with an imported document and that retained key, returned Synthetic with allowDurable=true. Initial Unknown import did not protect a later loosening transition. | Host must use current-document provenance/declaration, not prior sample UI state. DP-C07/DP-L03; this review-time defect is corrected and 13-08 now passes its mapped case. |
| R2 / High | AgentSessionManager.create started index opening under Synthetic, awaited it, then issued put without checking the new policy. A fake IndexedDB sink observed a label write after switching to Real. | Bind work to document/session/policy generation and recheck before actual store admission and after awaits. DP-L02/04; this review-time defect is corrected and 13-04 now passes its mapped case. |
| R3 / High | new AgentSessionManager() assigned Synthetic without an explicit policy. Gateway defaults could not compensate for a different session-owner default. | Missing policy must be restrictive at the session owner. Preserve explicit synthetic positive controls. This review-time defect is corrected and 13-08 now passes its mapped case. |
| R4 / Medium | Previous status summaries described six closed privacy cases and a conformant foundation. They did not account for R1-R3; the root roadmap also still named new AI Designer UI work as next priority. | Correct Current versus Target, reopen affected records, and steer the next implementation back to M1 lifecycle. This documentation correction does not fix the code. |

The probes used the actual imported session module and the exact source returned by code-slice for the host toggle.
They used synthetic labels and in-memory replacements only. They establish the observed control-flow defects,
not full browser storage behavior or proof that any real user data was disclosed.

## Additional unclosed boundaries

- Session fallback: resumed tests cover delayed index/runtime opening, transaction abort after request success,
  and asynchronous runtime-write failure. The composed control set passes serially, but the complete storage/destination
  P0 mapping remains open. A synchronous factory catch is not sufficient evidence for asynchronous persistence.
- Session/UI lifecycle: resumed code guards controller creation, new/open/list and callbacks in one owner; delayed/Stop unit controls and the actual panel policy-switch browser case pass. Complete acceptance remains broader than these controls.
- Recipient lifecycle: bounded endpoint/credential replacement now invalidates the old session context, and the final wire/storage
  checks pass 6/6 serially across three engines. Full external-client admission and remaining recipient/P0 combinations remain open.
- Explicit save: bounded policy checks now cover picker, writable stream, write and close boundaries; save/download/uncertain-close
  controls pass 24/24 serially across three engines. Full overwrite/recovery/production-export receipt acceptance remains open.
- Compatibility: first-party CDP preflight is not the same as host-side admission of every old external client. The migration document's required bootstrap/admission evidence remains open.
- All-35 command coverage is useful supporting evidence, not all-35 acceptance-case closure. The resumed implementation now re-audits the high-risk return variants (undo, direct transactions, history, FormSpec/business labels and malformed envelopes) with focused tests and a fresh 97/504 unit run; it still does not prove every return variant or P0 case.
- The resumed session-lifecycle extraction brought agent-panel-runtime.js below 300 lines. The pre-existing modified legacy studio/studio.js still has 1491 lines; no exception was authorized. Resolve through bounded responsibility-based extraction, not an unrelated rewrite.

## Evidence correction

Current P0 register: **8 Pass, 0 Fail, 27 Not run** (35 total).

- Retained bounded Pass records: 13-01/02/03/05/06, only for their documented tested sequences.
- 13-04: Pass after the latest serial three-engine mode/document/no-policy Provider and delayed IndexedDB admission cases; the original delayed-write probe remains Historical evidence.
- 13-08: Pass after the latest serial three-engine storage-denial, volatile-fallback, runtime-write and imported-Unknown cases; the original provenance/default-policy probe remains Historical evidence.
- 13-07: Pass after the latest serial three-engine explicit-save and final Provider-body case; operating-system file history and external-provider retention remain outside application evidence.
- Prior 86 files / 454 unit tests, 54/54 targeted browser tests, 190/222 combined browser tests and doctor 5/5 are historical snapshot evidence.
  Current resumed evidence is recorded in the implementation record: 97/504 unit tests, 36/36 serial composed browser controls,
  24/24 explicit-save controls and 6/6 recipient controls. The current doctor run is 5/5; an earlier 4/5 timeout result remains
  historical and was not hidden.
- Tests that passed do not need to be erased. Their coverage must be stated narrowly enough that known failures cannot hide behind aggregate totals.

## Agent guidance follow-through (historical documentation-only supplement)

R5/R6 below were subsequently corrected in runtime/MCP code. Actual wire verification also found and corrected
R7: the pinned runtime ignored the constructor systemPrompt option. The resumed evidence record distinguishes
the original browser failures from the passing final-payload checks; this supplement alone never proved delivery.

The engineering policy documents are not automatically loaded into the embedded Agent. Source inspection
confirms that agent-runtime.js passes DESIGNER_PROMPT and separately fetches the designer skill Markdown;
layout review supplies its own prompt, while MCP initialize supplies another instruction string.

- R5 / High / Consistent: mcp/server.mjs required full-page browser screenshots without a Synthetic condition. This conflicted with DP-T02 for Unknown/Real and must not encourage a screenshot bypass. The runtime guidance is now restrictive, with controlled prompt/entry tests; no real screenshot disclosure was executed.
- R6 / Medium / Clear: agent-designer-prompt.js allowed raw source replacement when explicitly requested, whereas the gateway rejects that Agent surface unconditionally. The prompt now preserves the semantic/human-editor boundary; actual host enforcement remains authoritative.
- AGENT_SETUP.md and llms.txt now distinguish pending human approval, host-eligible Auto behavior, restrictive geometry, volatile reconciliation and the known privacy defects. This is source documentation only; no generated site, live page or code-defined runtime prompt was updated.
- The exact composed/loaded instructions, host decisions and final Provider requests now have controlled evidence, including the
  actual prompt location used by the pinned runtime. A document update or a cooperative model response cannot establish enforcement.
  The P0 register now records 13-04/07/08 as case-specific Passes; model obedience and complete prompt/host agreement remain unverified.
- Supplement verification: agent-bootstrap.test.js and chrome-devtools-setup.test.js passed 7/7 tests in two files after the guide edits; version/count/discovery/setup assertions passed. These tests do not assert model obedience, full prompt consistency or privacy lifecycle correctness. Changed-document line limits and diff whitespace checks passed; no build, browser or Provider run was performed for this supplement.

## Bounded resume order

The user resumed coding on 2026-09-08; proceed in this order:

1. Retain the implemented R1-R3 corrections and complete the remaining side-effect, late-result and destination acceptance. Do not replace actual store admission guards with factory-only checks or discard committed memory state.
2. Retain the bounded recipient and explicit-save controls, then complete remaining transport, overwrite/recovery and commit-receipt acceptance. Preserve confirmed writes and query uncertain transaction outcomes. Retain corrected R5/R6/R7 delivery and host enforcement. Scope/apply checks remain in domain operations, not duplicated in UI controls.
3. Investigate the long-run transaction timeout, finish the remaining M4 cases and necessary build/version regressions, and inspect decoded storage plus final outbound requests. M5 records evidence and rollback readiness only; it is not permission to release.

Do not treat moving to the next case number as progress while a shared lifecycle invariant is known to fail.
Do not add a second policy source, silently erase old records, widen failed references to document scope,
retry an uncertain commit blindly or restore raw Real/Unknown output for compatibility.
Do not continue expanding plans or new UI features in place of the bounded fixes.

## Review-time SCMC result (superseded for corrected paths by resumed evidence)

- Simple: PASS. Existing host, gateway, domain and storage owners remain the right architecture.
- Clear: FAIL, High. A restrictive classification or memory-only status can disagree with an actual delayed write.
- Modular: WARN, Medium. Sample state, panel classification and session defaults make overlapping policy decisions.
- Consistent: FAIL, High. R1-R3 violate the retained classification/lifecycle rules.
- Smallest correction: use the existing authoritative policy at each owner and actual side-effect boundary; avoid a framework or service rewrite.
- Preserve: canonical transaction/evidence semantics, private human approval, explicit save/export controls and existing user data.
- Verify: negative lifecycle probes plus current browser storage/payload observations, then relevant regression/build/version gates.
- Overall: Partial for implementation conformance, not a call for automatic rollback. Highest-value next action is to finish the remaining M1/M3 destination, scope/apply/state and client acceptance at existing owners, then close M4 evidence.
