# Studio v2 Agent Output Nested Shapes

Prepared: 2026-09-07. Baseline: `d2536999ae3edd3d94e315bb245ab94f8b74e65d` plus the uncommitted amendment snapshot. Status: **Implemented as the public projection contract; targeted tests pass and full matrix acceptance remains open**. Companion to the
[35-command field table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and [data policy](STUDIO_V2_DATA_POLICY.md).
These are closed objects: only named fields are permitted, recursively. Shape names are not runtime types yet.

## Value rules and failure semantics

- Count/R: finite nonnegative safe integers; revision means actual source revision, not a fallback to zero.
- Number: finite measured numeric value, subject to the existing relevant metric/layout limit. Boolean means actual boolean, not truthiness conversion.
- Time: valid host-created ISO timestamp, or null only where the producer legitimately has no timestamp.
- Version: validated supported version string. Locale and Scenario: exact static values in i18n.js and sample-scenarios.js.
- Trust: trusted/untrusted. State/status/code: exact relevant repository-owned enumeration or a host-generated generic code; no arbitrary echoed string.
- Ref: host-scoped reference under the companion document; null only for an absent relationship. A regex-shaped imported ID is not automatically safe.
- H: host-computed or verified SHA-256, preserving the producer's raw-hex or sha256-prefixed representation; do not expose arbitrary strings named hash.
- Static: reconstruct from the source-owned constants, not copy the same-looking result member. StaticTools and StaticOperations follow the rules below.
- Optional fields are omitted when absent; do not invent zeros, passes, dates or empty receipts. Null is retained for genuine absent optional records.
- Drop unknown fields recursively. Missing/wrong-type required fields, invalid discriminants or an unsafe required reference block that Agent response.
- Optional unsafe display labels may be replaced with neutral labels; required control/evidence fields must not be silently removed to make validation pass.
- Never include raw source, sample values, arbitrary strings/objects, provider profiles, credentials, authorization/approval tokens or network addresses unless expressly allowed by a named shape.
- Do not infer allowed fields from regexes such as names ending in hash or at, or from a field name containing status/revision.
- Preserve complete control/validation/evidence information. Apply existing bounded collection/capture limits; if the response exceeds the supported transport budget, return an explicit incomplete/unavailable outcome, never silently truncate and claim complete coverage.
- There is no new pagination API in this document. Any future pagination must preserve completeness semantics and pass compatibility review.

Projection failure before mutation blocks execution where it can be detected in preflight. If mutation already committed,
retain its internal outcome and known transaction reference; report that its response is unavailable and query transaction/revision state before retrying.
Do not turn an output-redaction failure into automatic rollback or a second apply. An unknown outcome remains unknown until checked.
Error.code uses a registered generic output-validation code during implementation; this document does not claim that code already exists.

## Shared diagnostics and design shapes

| Shape | Entire allowed fields and constraints |
|---|---|
| Error | code: known code; message: fixed safe text chosen by host; expectedRevision/actualRevision?: R; expectedCandidateHash/actualCandidateHash?: H; transactionId/leaseId/owner?: Ref; phase?: fixed phase; validation?: Validation. Never stack/cause/request/response/raw message |
| Metrics | Numeric approved metrics only: rows, logicalPages, htmlBytes, pageCount, width, height, maxPageHeight, overflowPages, totalHeight, overflowElements, verticalOverflowPages, contrastFailures, renderedRows, expectedRows, durationMs. Count metrics are integers; duration/dimensions are finite nonnegative numbers |
| Rect | x, y, width, height, top, left, right, bottom: finite measured numbers when present; width/height nonnegative. Negative positions are valid diagnostics, not silently clamped into success |
| Issue | code: known code; severity: error/warning or the producer's registered severity; path/selector?: Ref; pageIndex?: valid page index; keyword?: known validator keyword; rect?: Rect. No message/text/value/url/HTML. Unknown codes map to a generic diagnostic while retaining severity |
| Validation | valid, productionValid: boolean; errors/warnings/issues: Issue[] when produced; metrics?: Metrics; reviewReceipt?: ReviewStatus. Error presence and current provenance remain authoritative; removing prose cannot make validation pass |
| Diff | changed: boolean; changedSections: subset of manifest/schema/i18n/themeCss/templateHtml/sampleData/trust; operationCount: Count. Current operationCount is changed-section count, not the number of submitted operations |
| ApplyResult | revision: R; already_committed: boolean; committed_revision?: R; diff: Diff; validation: Validation; candidateHash: H/null; transaction: Transaction. A duplicate Apply is an idempotent observation of the existing commit and must not create a second revision |
| Page | width, height: positive measured numbers |
| Typography | basePt: valid numeric print size from existing typography rules |
| Branding | primaryColor: canonical validated color or null when absent; no CSS expression, variable, URL or arbitrary string |
| Table | tableSelector: Ref; columns: Column[] |
| Column | label: host-generated neutral Column N; width: empty string for unspecified or a parsed numeric CSS length/percentage supported by the current operation schema. No translated/literal header value or arbitrary CSS |
| Asset | slot: Ref; configured: boolean. No src, alt, filename, embedded image or fetched response |
| RepeatedAreas | header, docinfo, rowheader, ptacRowheader, footer, footerLogo, footerPagenum: booleans only when the original producer has that setting |
| InspectionBinding | tag: standard HTML tag name; id/className/text/each/condition/href/i18nKey/assetSlot: Ref or null. text/href here describe bindings, not permission to transmit rendered text or target URLs |
| Binding | text, each, if, href, i18n: Ref when present. Do not dereference and include the bound value |
| Component | id: Ref; type: one of COMPONENT_TYPES; role?: registered semantic role or null; tableId/sourceSelector/styleToken?: Ref/null; binding?: Binding/null; keepTogether?: boolean. Omit label and all extensions |
| Section | id: Ref; componentIds: Ref[]. Omit titles, descriptions and arbitrary section payloads |
| FormDocument | paper: validated supported paper identifier; orientation: portrait/landscape. Omit arbitrary document.type and untyped margins; numeric page dimensions are available via inspect_design_state |
| Pagination | repeatDocumentHeader, repeatTableHeader, footer, pageNumbers: booleans when present; keepTogether: Ref[] |
| FormSpec | version: supported FORM_SPEC_VERSION; mode: canonical/legacy-adapter; document: FormDocument; sections: Section[]; components: Component[]; pagination?: Pagination. Omit tokens and root bindings dictionaries until separately typed; component binding uses Binding |

Fixed host messages and neutral labels may be localized. Source-owned enums are resolved against the reviewed code revision;
an imported/custom value must not be added to an allowlist simply to pass projection.
Unsupported structural fields must not be silently interpreted as defaults for edits; if the operation needs omitted context,
block that AI workflow with a safe explanation while preserving the human editor.
An incomplete projected FormSpec is an Agent view, never a replacement canonical project or a round-trip export document.

## Transaction, audit and history shapes

Transaction is the same shape whether returned at result root, under transaction, or inside transactions[].
The producer is [transaction-service](../studio-v2/core/transaction-service.js) and
[transaction-recovery-service](../studio-v2/core/transaction-recovery-service.js).

| Shape | Entire allowed fields and constraints |
|---|---|
| OperationSummary | type: registered operation; path/selector/slot/tableSelector/componentId?: Ref; bindingType?: text/each/if/href/i18n. Omit values, patches, source, literals and CSS. An operation named patch does not grant permission to send its body |
| Lease | owner, lease_id: Ref; lease_expires_at, heartbeat: Time |
| Approval | actor: Ref; approved_at: Time; preview_hash: H/null. Never approval token/signature/private credential; actor is not a human-click assertion |
| Conflict | code: registered conflict code; expected_revision/actual_revision: R; detected_at?: Time; resolved_at?: Time; resolution?: rollback. No arbitrary nested details |
| CommitResult | status: committing/committed/rolled_back; no_op?: boolean; revision/expected_revision?: R; candidate_content_hash?: H; started_at/committed_at/recovered_at?: Time |
| Transaction | transaction_id/form_id/owner/agent_id: Ref; base_revision/working_revision: R; status: TransactionStatus; state: corresponding uppercase state; patches/changes?: OperationSummary[]; preview_hash?: H/null; candidate_content_hash/candidate_form_spec_hash?: H; validation_result?: Validation/null; approval?: Approval/null; lease?: Lease/null; created_at/updated_at: Time; previewed_at/approved_at/committed_at/rolled_back_at/expired_at?: Time/null; commit_result?: CommitResult/null; evidence_pack_ref?: Anchor/null; conflict?: Conflict/null; supersedes_transaction_id?: Ref. No base project, candidate_report, raw last_error or record extensions |
| Audit | event_id: Ref; type: source-owned event type; timestamp: Time; actor/agent_id/form_id/transaction_id?: Ref/null; revision/base_revision?: R/null; base_project_hash/preview_hash/candidate_content_hash/candidate_form_spec_hash/form_spec_hash/evidence_pack_hash/artifact_hash?: H/null; changes?: OperationSummary[]; validation?: AuditValidation; approval?: Approval; lease_id/supersedes_transaction_id?: Ref; lease_expires_at?: Time; no_op/takeover?: boolean; expected_revision/actual_revision?: R; code/phase/reason/outcome?: known source-owned enum. Omit arbitrary details and free strings |
| AuditValidation | valid: boolean; error_count/warning_count: Count |
| Journal | type: source-owned journal type; timestamp: Time; transaction_id/agent_id/lease_id/supersedes_transaction_id?: Ref; revision/expected_revision/actual_revision?: R; changes?: OperationSummary[]; preview_hash/candidate_content_hash/evidence_pack_hash/artifact_hash?: H/null; validation?: AuditValidation; approval?: Approval; lease_expires_at?: Time; no_op?: boolean; code/phase/reason/outcome?: known enum; pack?: EvidencePack. Omit all other spread details |

TransactionStatus is exactly draft, previewed, validated, approved, committing, committed, rolled_back, expired, conflicted or recovery_required.
State is derived from the accepted status, not independently trusted. Preserve no-op, expired and recovery-required outcomes.
Metadata can still identify people/documents: references and source validation apply even to IDs supplied by an existing transaction store.
Hashes are included only for traceability in the active workflow; the data policy's persistence restrictions still apply to these projections.
Known field sets for Audit/Journal are explicit above; enum values come only from reviewed first-party event producers.
Unknown event kinds must produce an explicit incomplete/unavailable history result rather than vanish from a supposedly complete audit.

## Review and evidence shapes

Use [layout-review](../studio-v2/core/layout-review.js), [review commands](../studio-v2/core/command-bus-review.js),
[evidence pack](../studio-v2/core/evidence-pack.js) and [durable store](../studio-v2/core/durable-transaction-store.js) as producer evidence.

| Shape | Entire allowed fields and constraints |
|---|---|
| Browser | name/version: normalized host-detected browser identity; no full user agent or caller-supplied text |
| ReviewStatus | status: required/stale/pass or registered failing state; reviewedRevision: R/null; browsers?: Browser[]; reviewedAt?: Time. For Validation.reviewReceipt project from the original reviewedRevision, never manufacture revision |
| Finding | code: registered finding code or generic safe finding code; severity: minor/major/critical; status: fixed/accepted/open. No message |
| ReviewReceipt | status: pass; reviewedRevision: R; reviewer: ai-agent; browsers: Browser[]; scenarios: Scenario[]; evidence: EvidenceReference[]; findings: Finding[]; attempt: Count; reviewedAt: Time; metrics: Metrics. No summary |
| Coverage | capturedPages/totalPages: positive Count; complete: boolean derived from actual capture, never forced true by projection |
| Geometry | source: geometry-only; redacted: true; mimeType: image/svg+xml; dataUrl: validated host-generated SVG; width/height: positive finite dimensions; pageCount: positive Count. Decode/validate approved numeric shapes, reject text/images/URLs/foreignObject/scripts/extra attributes; retain existing 4,000,000-character bound |
| Pixels | Synthetic only: source: sandbox-pixel; syntheticData: true; redacted: false; mimeType: image/png, image/jpeg or image/webp; dataUrl: matching bounded raster data URL; width/height: positive finite dimensions; pageCount: positive Count. Preserve existing 5,000,000-character bound and actual capture provenance |
| EvidenceReference | evidenceId: Ref; scenario: Scenario; candidateHash/baseProjectHash/layoutFingerprint/renderReportHash/snapshotHash: H; visualMode: geometry/pixels per actual receipt and privacy policy; pixelSnapshotHash?: H only for Synthetic pixel receipt; coverage: Coverage; createdAt: Time |
| Evidence | EvidenceReference plus revision: R; browser: Browser; metrics: Metrics; snapshot?: Geometry; pixelSnapshot?: Pixels only for Synthetic. Keep original hashes/receipt linkage; no raw report |
| Observation | revision: R; scenario: Scenario; visualMode: geometry/pixels per policy; snapshot?: Geometry; pixelSnapshot?: Pixels only for Synthetic; metrics?: Metrics; issues?: Issue[]; validation?: Validation/null. Must contain an allowed image if non-null, but never evidenceId or receipt authority |
| PixelFailure | code: registered pixel-capture failure code; no messages, stack, source URLs or capture payload |
| PackValidation | status: PASS/FAIL; pageCount/errorCount: Count |
| Security | externalNetwork/arbitraryJavascript: boolean; status: PASS/FAIL |
| EvidencePack | artifactType: printform; protocolVersion/schemaVersion/runtimeVersion: Version; revision: R; transactionId: Ref/null; formSpecHash: H; validation: PackValidation; pageCount: Count; previewHash/exportHtmlHash: H/null; exportHtmlHashScope: html-with-embedded-export-hash-redacted; runtimeHash/printformRuntimeHash: H/null; security: Security; timestamp: Time; hash: H. Omit documentType and any extension |
| Anchor | artifact_hash: H/null; evidence_pack_hash: H; committed_revision: R; transaction_id: Ref; form_spec_hash/preview_hash/runtime_hash: H/null; validation: PackValidation; security: Security; anchored_at: Time |

The only literal data URLs allowed are explicitly projected Geometry/Pixels. Neither is permission to send an asset or document data URL elsewhere.
Real/Unknown requests for pixels fail at capture before output projection. A synthetic receipt must not be relabeled geometry after a mode switch;
invalidate it and recapture under the current policy when needed. Apply the restriction inside review.evidence[] as well as root evidence.
Projection removes fields but does not rewrite a receipt hash; hosts verify original evidence locally. The Agent cannot recompute or certify a full pack from its redacted projection.
Zero errors without current render/review provenance remains insufficient for readiness. Null evidence/observation are legitimate failure variants, not fabricated passes.

## Static contract shapes

| Shape | Allowed source-owned fields |
|---|---|
| Capabilities | candidateHash, candidateRealRender, layoutEvidenceReceipts, formSpec, transactions, persistentAudit, durableTransactions, atomicRevisionCas, leaseRecovery: booleans reflecting actual host/adapter support |
| StaticTools | Array reconstructed from TOOL_CONTRACTS: name, description, inputSchema. Schema tree must match the reviewed repository definition, with no runtime document substitutions |
| StaticOperations | Array from AGENT_OPERATION_DEFINITIONS: type, description, inputSchema, example, risk. Reconstruct from code; examples remain synthetic and include no live IDs/values |

Static schema objects are the narrow exception to flat field enumeration: compare them to the exact trusted source-owned schema tree.
Do not accept a caller-provided schema/description/default merely because a tool name matches.
No endpoint, API key, session prompt, imported schema default or user metadata may enter a static contract projection.

## Acceptance additions within existing cases

- 13-06: inject unexpected fields at every nesting level; safe projection excludes canaries, while malformed required fields fail safely.
- 13-06: test all 35 result roots, direct and wrapped transactions, reviewStatus.reviewedRevision, null component/evidence and no-op responses.
- 13-04/X-02: restrict classification while pixel/review output is delayed; reject stale pixel references as well as image bytes.
- 13-02/07: verify safe outputs do not authorize forbidden persistence; user prompt disclosure remains independent of tool-output redaction.
- 13-08: output failure after a committed mutation preserves outcome recovery and prevents blind retries; unknown audit types/oversized reports cannot silently become complete results.
- 13-06/X-03: forged, expired, cross-document and cross-provider references cannot resolve or broaden scope; legitimate transaction recovery remains possible.

All are Target assertions, Not run. The controlled three-engine Provider wire case is evidence for one composed safe-result path only; source inspection, aggregate command dispatch and documentation checks do not prove runtime privacy or compatibility for every command.
