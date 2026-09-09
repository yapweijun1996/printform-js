# Studio v2 Direction and Conformance Review

Reviewed: 2026-09-09, after the user resumed coding following a direction review.
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
  M4 mapping remains open. A synchronous factory catch is not sufficient evidence for asynchronous persistence.
- Session/UI lifecycle: resumed code guards controller creation, new/open/list and callbacks in one owner; delayed/Stop unit controls and the actual panel policy-switch browser case pass. Complete acceptance remains broader than these controls.
- Recipient lifecycle: bounded endpoint/credential replacement now invalidates the old session context, and the final wire/storage
  checks pass 6/6 serially across three engines. Host-bound external-client admission is now implemented and bounded by focused transport/browser evidence; remaining recipient/PI combinations remain open.
 - Explicit save: bounded policy checks now cover picker, writable stream, write and close boundaries; save/download/uncertain-close
   controls pass 24/24 serially across three engines. S10/PROD-08 now closes overwrite/recovery and production-export receipt
   acceptance for its six local cases; browser download remains started-only and has no disk-completion receipt.
- Compatibility: first-party CDP now performs exact protocol/contract/catalog preflight and host admission, while MCP gates `tools/list` until that handshake succeeds. The admission is memory-only and document/session-bound; PI/client compatibility coverage and hostile-browser isolation remain open.
- All-35 command coverage is useful supporting evidence, not all-35 acceptance-case closure. The resumed implementation now re-audits the high-risk return variants (undo, direct transactions, history, FormSpec/business labels and malformed envelopes) with focused tests and a current 103/537 unit run; it still does not prove every return variant or every non-P0 release boundary.
- S13/PROD-11 completed the bounded responsibility extraction: the v1 composition entry is 162 lines, the pagination attach adapter is 6 lines, and the extracted formatter helpers and Studio modules are all <=300 lines. The v1 and formatter browser contracts pass; canonical revision/CAS, scope, privacy, approval/export and public protocol behavior were not changed.

## Evidence correction

Current P0 register: **35 Pass, 0 Fail, 0 Not run** (35 total). PROD-03 03-01 through 03-08, S09/PROD-04 04-01 through 04-06, S10/PROD-08 08-01 through 08-06, S11/PROD-07 actionable Quality and production-shell X-01..03 are now case-specific Passes; isolated PI X-01..03 and PI/release gates remain open.

- Retained bounded Pass records: 01-01/01-02/01-03/01-04/01-05/01-06/01-07/01-08, 02-01/02-02/02-03/02-04/02-05/02-06/02-07/02-08 and 13-01/02/03/05/06, only for their documented tested sequences.
- 01-01: the current three-engine preview-to-FormSpec/context/AI-target selection case passes; the Firefox AGRUN CSP eval console diagnostic is recorded as a known runtime limitation, not hidden or treated as a selection failure.
- 01-02: the current three-engine allowed table-A edit case passes; the candidate changes only the approved template source, Apply increments the revision once, and table B/unrelated PTAC content remains unchanged. The deterministic in-page action is browser evidence, not live-provider certification.
- 01-03: the current three-engine wrong-target/category case passes; table-B and theme requests under table-A scope return `SCOPE_VIOLATION`, show an actionable scope message, create no candidate and commit no revision.
- 01-04: the current three-engine mixed-batch case passes; complete allowed-plus-forbidden arrays are rejected atomically before transaction creation, with no candidate or revision change.
- 01-05: the current three-engine indirect-effects case passes; Theme and cross-table selectors are rejected under component scope, while repeatHeader is proven local against the legacy root default.
- 01-06: the current three-engine stale-selection case passes; a scope change returns `SCOPE_CHANGED` and requires a fresh preview, while document replacement clears the candidate and resets scope before a fresh current-revision Apply.
- 01-07: the current three-engine adapter-parity case passes; embedded, WebMCP and direct domain calls agree, Chromium CDP repeats the result, forged caller scope fields do not broaden permission and raw source remains blocked.
- 01-08: the current three-engine legacy/whole-document case passes; the legacy sample resolves through the existing adapter, an ambiguous table selector remains blocked under table scope, explicit `all` passes the existing preview/validation/private Apply path, and component restrictions return after switching back.
- 02-01: the current three-engine chat-preview case passes; Preview mode holds the candidate and committed state unchanged until the private UI Apply, which commits once and leaves the applied revision/Undo state visible.
- 02-02: the current three-engine Review-repair case passes; each approved repair produces a distinct next candidate, and the first approval cannot commit the later repair.
- 02-03: the current three-engine approval-provenance case passes; page-global, ordinary bound-session, WebMCP and Chromium CDP callers cannot reach the private approval method, forged approval is rejected, and the UI-owned token/hash/lease/revision path commits only once.
- 02-04: the current three-engine mode-change case passes; a delayed Auto-started proposal remains pending after switching to Preview, switching back to Auto does not commit or authorize it, and a new explicit Preview-mode Apply commits once.
- 02-05: the current three-engine cancel/retry case passes; Stop cancels a delayed run before proposal creation, late stopped output does not become Applied, Discard removes the retry candidate before Apply, and late retry callbacks do not change the committed revision or brand color.
- 02-06: the current three-engine duplicate/unknown-outcome case passes; a double Apply dispatch produces one approval attempt and at most one committed revision, lost response recovery preserves the real Applied revision, unavailable post-commit validation stays visible as Applied with an unavailable status, and an unresolved post-write outcome stays recovery-required without resubmission.
- 02-07: the current three-engine Auto-mode case passes; one explicitly eligible in-scope brand-colour operation auto-applies once and completes a clean layout review, while ineligible/mixed pending work, invalid/out-of-scope operations, human source editing and the untrusted mutation boundary retain their required states.
- 02-08: the current three-engine host/prompt/export case passes; the real panel loads the runtime designer skill and host prompt, observes pending/applying/applied states, produces no download from AI Apply or review, and requires a human confirmation before the one accepted production HTML download.
- 03-02: the current three-engine render-failure case passes; held Rendering, current iframe failure and silent timeout show Preview failed/retry, blocked readiness and disabled export, while retry restores the committed Printable state. Candidate-report invalidation prevents a transient candidate from masking the failure.
- 03-03: the current three-engine review-lifecycle case passes; missing review, blocking findings and unavailable AI remain visibly blocked with next actions, editing and untrusted draft export remain policy-permitted, and only a current passing review enables the human-confirmed trusted export path. The focused render/controller/CommandBus/context/status set passes 30/30; the full build passes 105 files/557 tests.
- 03-04: the current three-engine invalidated-evidence case passes; a passing r0 review is cleared by a locale edit at r1 and by Undo/Redo at r2/r3, so each new committed revision returns to review-required and trusted export stays disabled until fresh evidence.
- 03-05: the current three-engine late-result case passes; r0 Studio-issued evidence delivered after a locale edit committed r1 returns `REVISION_CONFLICT`, and the current r1 readiness remains review-required/Blocked.
- 03-06: the current three-engine candidate-separation case passes; a reviewed committed r0 remains ready/exportable while an r1 candidate is visibly identified as not committed, the trusted export attestation names r0, and Discard restores the committed preview without changing revision or project hash.
- 03-07: the current three-engine save-independence case passes; picker cancellation and failed writes remain Cancelled/Failed, only a confirmed close becomes Saved, download fallback is reported as started but unconfirmed, and an edit during a held close leaves r1 Unsaved while the completed artifact remains bound to r0. The focused retry unit suite passes 11/11.
- 03-08: the current three-engine surface-agreement case passes; Context, Quality, export actions and `request_export` agree across pending, rendered-but-unreviewed, warning-only ready, candidate and human-cancelled-export states. All five UI locales refresh current readiness labels, and no automatic download occurs. The Chromium failure that found stale `lastValidation` reuse was fixed by refreshing from `bus.readiness()`.
- 13-04: Pass after the latest serial three-engine mode/document/no-policy Provider and delayed IndexedDB admission cases; the original delayed-write probe remains Historical evidence.
- 13-08: Pass after the latest serial three-engine storage-denial, volatile-fallback, runtime-write and imported-Unknown cases; the original provenance/default-policy probe remains Historical evidence.
- 13-07: Pass after the latest serial three-engine explicit-save and final Provider-body case; operating-system file history and external-provider retention remain outside application evidence.
- Prior 86 files / 454 unit tests, 54/54 targeted browser tests, 190/222 combined browser tests and doctor 5/5 are historical snapshot evidence.
  Current resumed evidence is recorded in the implementation record: 106/567 unit tests, 17/17 old-bus/commit-race controls, 36/36 serial composed browser controls,
  24/24 explicit-save controls and 6/6 recipient controls. The current doctor run is 5/5; an earlier 4/5 timeout result remains
  historical and was not hidden. The rebuilt E14/candidate history controls pass 21/21 across Chromium, Firefox and WebKit.
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

1. Retain the implemented R1-R3 corrections; S03/M1 maps the application-controlled destinations and S10/PROD-08 closes the bounded overwrite/recovery/file-outcome cases. Do not replace actual store admission guards with factory-only checks or discard committed memory state.
2. Retain bounded recipient/explicit-save controls and S12-S15 evidence. S16 has been requalified against the deferred-close and pending-open lifecycle deltas; resume S17 next. X-01..03 isolated evidence is supporting only. Follow [handoff](STUDIO_V2_AGENT_HANDOFF.md). Preserve confirmed writes, uncertain-outcome reconciliation, R5/R6/R7 delivery and domain-owned scope/apply enforcement.
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
