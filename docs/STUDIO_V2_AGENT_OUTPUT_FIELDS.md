# Studio v2 Agent Output Field Allowlist

Prepared: 2026-09-07. Baseline: `fb1a641450c2266a712a7b644b32609bea7c0e73` plus documentation worktree.
Status: **Target contract; not implemented or behaviorally verified**. PROD-13 remains Pending.
Scope: the 35 names in [TOOL_CONTRACTS](../studio-v2/core/tool-contracts.js); mappings use the current
[dispatcher](../studio-v2/core/command-bus-dispatch.js) and its result producers, not tool descriptions alone.

## Authority and notation

- [Data policy](STUDIO_V2_DATA_POLICY.md) owns classification/destination permission.
- This document owns each command's output roots; [field shapes](STUDIO_V2_AGENT_OUTPUT_SHAPES.md) own every permitted nested field and type.
- [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md) owns cases 13-02/04/06/07/08; [TASK](../TASK.md) owns status.
- [Boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) owns enforcement placement, client adoption order and rollback; the closed field definitions remain here and in the companion shapes.
- R = nonnegative integer revision; H = validated host-derived hash or explicitly nullable hash; Ref = scoped host reference.
- A row lists the entire allowed result, not additions to a copied result. No root or nested field passes merely because it exists today.
- Existing field names/casing are preserved unless explicitly discussed as a compatibility change. Shape names are documentation shorthand.
- The default applies to Synthetic, Real and Unknown. Only synthetic pixel evidence has the stated additional allowance.
- Success envelope: exactly `ok: true, result: <command projection>`; error envelope: exactly `ok: false, error: Error`.
- Preserving a field does not grant execution authority: scope, trust, approval, privacy and export checks remain independent.

## Current findings to correct or preserve

| Observed path | Verified source fact | Target action |
|---|---|---|
| get_revision | Dispatch calls getRevision() without an argument; returns revision/projectHash/transactionId/committedAt only | Preserve this bounded metadata shape; the earlier data-policy wording implying a full project response is corrected |
| undo_revision | History returns changed/revision/project; current sanitizer does not remove root project | Keep changed/revision; omit the project at the Agent boundary |
| Direct transaction results | begin/approve/lease/takeover/recover/rollback return a transaction at result root | Apply Transaction shape directly; nested-transaction-only sanitization is insufficient |
| get_transaction_history | entries and auditEvents bypass dedicated nested projections today | Project Journal and Audit item shapes individually |
| inspect_design_state | Column inspection returns translated header labels and width strings | Generate neutral column labels and validate widths; exclude original business labels |
| FormSpec and inspection | Explicit specs, component labels and binding/selector strings can carry imported content | Rebuild structural shapes; reference unsafe identifiers instead of forwarding them |
| Review status | layoutReviewStatus uses reviewedRevision, whereas current sanitizeReview selects revision | Preserve the actual reviewedRevision meaning; never fabricate a current revision from a missing field |
| Global sanitizer | Starts with structuredClone(result) and selectively changes recognized fields | Build per-command projections; reject an unregistered command/output variant |

These are source-level observations; no live data disclosure test or implementation is claimed.

## Complete public command mapping

Every row permits only the following result fields. `?` means optional; `null` is allowed only where stated in the shapes.
Static means exact repository-owned constants/schema projections, never document- or caller-supplied strings.

| # | Public command | Allowed result fields / nested shape | Exclude or transform |
|---|---|---|---|
| 01 | `get_capabilities` | protocolVersion, contractVersion, studioVersion: Version; capabilities: Capabilities; tools: StaticTools; sampleScenarios/locales: Static; humanExportRequired: true; completionPolicy: Static | No project metadata or provider endpoint; durability flags must reflect actual adapter |
| 02 | `get_project_summary` | revision: R; locale: Locale; trust: Trust; protocolVersion: Version; review: ReviewStatus; validation: Validation | Remove title/projectName and any added document metadata |
| 03 | `inspect_document` | revision: R; blocks: Count; bindings: InspectionBinding[] | Original IDs/classes/pointers/translation keys/slots become scoped references |
| 04 | `get_form_spec` | revision: R; spec: FormSpec | No arbitrary extension objects, literals, sample data or labels |
| 05 | `list_components` | revision: R; components: Component[] | Project each component; no raw selectors or user labels |
| 06 | `get_component` | revision: R; component: Component or null | Null means no match; do not invent an empty valid component |
| 07 | `inspect_design_state` | revision: R; page: Page or null; typography: Typography; branding: Branding; tables: Table[]; repeatedAreas: RepeatedAreas; assets: Asset[]; supportedOperations: Static | Replace translated column labels; never return asset URLs or CSS text |
| 08 | `get_operation_catalog` | revision: R; operations: StaticOperations | Static schema/examples only; do not interpolate document values |
| 09 | `begin_transaction` | Transaction at result root | No changes/patch values, candidate_report or last_error messages |
| 10 | `get_transaction` | transaction: Transaction | Same projection as root transaction; no nested project |
| 11 | `list_active_transactions` | transactions: Transaction[] | No unprojected list entries; retain actual state after existing expiry logic |
| 12 | `renew_lease` | Transaction at result root | Owner/lease references are scoped; no raw caller identities |
| 13 | `release_lease` | Transaction at result root | Preserve lease:null and actual expired/terminal status |
| 14 | `takeover_transaction` | Transaction at result root | Preserve new transaction identity and supersedes reference; no inherited raw draft |
| 15 | `recover_transaction` | Transaction at result root | Preserve committed/rolled_back/conflicted/recovery_required distinctions |
| 16 | `resolve_conflict` | Transaction at result root | Actual result, not a fabricated successful rollback |
| 17 | `get_revision` | revision: R; projectHash: H/null; transactionId: Ref/null; committedAt: Time/null | No project; numeric historical getRevision(n) is an internal store API, not this public call |
| 18 | `get_audit_events` | events: Audit[] | Exclude arbitrary details, payloads, raw identities and free-text reasons |
| 19 | `preview_changes` | revision: R; transactionId: Ref; diff: Diff; validation: Validation; candidateHash: H/null | No candidate/project or operation values; null hash retains current static-only meaning |
| 20 | `approve_transaction` | Transaction at result root | No approval token; actor reference is not evidence of human approval |
| 21 | `apply_changes` | revision: R; diff: Diff; validation: Validation; candidateHash: H/null; transaction: Transaction | Preserve no-op outcome and exact committed revision; no candidate report |
| 22 | `rollback_transaction` | Transaction at result root | Do not return project/changes as a rollback preview |
| 23 | `compare_revision` | fromRevision/toRevision: R; diff: Diff | No raw before/after content; current diff operationCount counts changed sections |
| 24 | `get_transaction_history` | revision: R; entries: Journal[]; transactions: Transaction[]; auditEvents: Audit[] | Project all three arrays; do not pass through stored pack/event objects |
| 25 | `get_evidence_pack` | revision: R; evidencePack: EvidencePack/null; anchor: Anchor/null | Exclude documentType, free metadata and any artifact HTML/blob |
| 26 | `validate_project` | revision: R; validation: Validation | Errors/issues contain safe codes/references/geometry, not messages with business values |
| 27 | `set_locale` | ApplyResult plus locale: Locale | Same nested projection as apply_changes; no-op must retain existing revision |
| 28 | `set_asset_source` | ApplyResult plus slot: Ref | Source URL/data URL, alt text and fetched bytes never echoed |
| 29 | `set_sample_scenario` | ApplyResult | Generated data remains local; generation does not certify the whole document synthetic |
| 30 | `undo_revision` | changed: boolean; revision: R | Omit root project even for changed:false; host UI can consume its internal project result |
| 31 | `get_layout_review_status` | revision: R; review: ReviewStatus; checklist: Static | Preserve reviewedRevision/null; no free-text receipt summary |
| 32 | `begin_layout_review` | revision: R; attempt: Count; checklist/requiredScenarios: Static; metrics: Metrics; issues: Issue[] | No raw render report or issue text |
| 33 | `capture_layout_evidence` | Success: revision: R, scenario: Scenario, evidence: Evidence, requiredScenarios/capturedScenarios: Scenario[]; observation variant: revision, scenario, evidence:null, observation: Observation/null, validation?: Validation, metrics?: Metrics, pixelCapture?: PixelFailure | Observation never becomes a signed receipt; Pixel fields require current Synthetic policy |
| 34 | `complete_layout_review` | revision: R; review: ReviewReceipt | Exclude summary/findings[].message; keep evidence references and reviewedRevision |
| 35 | `request_export` | revision: R; ready: boolean; validation: Validation; requiresUserConfirmation: true | Readiness only; no download URL, HTML, token or automatically initiated export |

ApplyResult is exactly the result shape for apply_changes. A catalog row never authorizes a new operation or changes its mutating/read-only semantics.
`redo_revision` and `preview_source_edit` appear in dispatch but are absent from the 35 public contracts.
Do not silently advertise them. The existing raw-source Agent rejection remains; internal UI source editing is unaffected.
If redo remains reachable through a supported Agent gateway, project only changed/revision like undo and test that path;
catalog registration/access policy is a separate compatibility decision. Any other unregistered command fails at the Agent boundary.

## References and public input compatibility

1. Host creates random, opaque, typed references for component/table/section IDs, paths, selectors, slots, identities and sessions when raw values are unsafe.
2. Existing semantic input fields consume those references via a host-local reverse map. Resolve before domain lookup and recheck PROD-01 scope; a reference is not authority.
3. References bind to document, Agent session, policy generation and target identity. New document/provider contexts cannot reuse them.
4. Component references expire when their source mapping changes. Transaction/evidence references needed to resolve an in-flight outcome remain read-resolvable for that same context, but never preserve obsolete write permission.
5. Retain raw host-issued transaction/evidence IDs only when provenance proves they are opaque and needed by the current workflow. Otherwise map consistently across all wrappers, history and errors.
6. Keep underlying project IDs, candidate hashes, approval signatures and evidence receipts unchanged. Do not sign a redacted substitute as original evidence.
7. Where input syntax requires a JSON Pointer or selector, use a syntactically valid opaque surrogate resolved only by the host; never forward it to DOM lookup directly.
8. Resolve only designated target-reference fields, not arbitrary prompt/operation text. Missing/ambiguous mappings yield a safe actionable error, never whole-document fallback.

This is a Target Agent-facing projection. Dropping fields and changing identifier semantics can break existing clients even if JSON field names remain unchanged.
Before implementation release, review embedded Agent actions, WebMCP/CDP consumers, tool schemas/examples, version tests and runtime prompts together.
Use a versioned migration if required. Do not keep a raw-output compatibility path for Real/Unknown data; unsupported clients must receive a clear safe error.
Fixed catalog examples stay synthetic and static; they are examples, not valid live opaque references. Live targets must be obtained by inspection.

## Verification and closure

- Compare these 35 rows with TOOL_CONTRACTS; newly added commands require an output row and nested shape before exposure.
- For every command, test success, null/no-op/empty variants where supported, malformed output and the common error envelope.
- Add synthetic canaries to every omitted field and document-controlled ID/path/label; inspect the entire decoded result and provider request.
- In particular test undo root project, direct-root transactions after preview, history arrays, FormSpec extensions and translated table labels.
- Verify get_revision remains metadata-only, and review results retain reviewedRevision correctly rather than a fabricated revision.
- Round-trip safe component, transaction, lease and evidence references through their consuming commands; preserve conflict/hash checks and late-outcome recovery.
- Exercise Real, Unknown and Synthetic, mode switch during requests, plus embedded/WebMCP/CDP paths. No real provider or private data is needed.
- Output validation after a successful mutation must not report that nothing committed. Keep the committed outcome in the host and use the recovery procedure described in field shapes.
- Evidence belongs to P0 cases 13-02/04/06/07/08 and X-02/03; this document adds no executed tests and changes no Pending status.

## SCMC review

- Scope/evidence: public command roots and actual producers; constraints: docs only, privacy, transaction integrity and backward compatibility.
- Simple: PASS; reuse nested shapes instead of 35 independent policies. Clear: PASS; root/wrapped variants and omissions are explicit.
- Modular: PASS; domain results remain internal, Agent projection has one owner. Consistent: PASS; all 35 catalog entries have exactly one row.
- Findings: no material documentation design issue; safe schemas, reference plumbing and client migration remain implementation work.
- Overall: PASS for design only. The implementation/migration sequence is documented; M0 consumer/variant inventory and every implementation package remain Pending.
