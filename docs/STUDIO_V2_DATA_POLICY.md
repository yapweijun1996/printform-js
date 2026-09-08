# Studio v2 Data Classification and Destination Rules

Prepared: 2026-09-08. Baseline: `d2536999ae3edd3d94e315bb245ab94f8b74e65d` plus the uncommitted amendment snapshot.
Status: **Policy requirements retained; implementation Partial.** Review-time classification/session violations now have bounded corrections; complete acceptance remains open. See [resumed evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md), [direction review](STUDIO_V2_DIRECTION_REVIEW.md) and the P0 register.
This document specifies application behavior, not a claim about provider retention or an authorization to send data now.
Rule IDs below specify required behavior. The implemented classification fields do not establish compliance with every rule.

## Authority and recommendation

The [production plan](STUDIO_V2_PRODUCTION_PLAN.md) owns requirements and release status;
the [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md) owns observable cases; [TASK](../TASK.md) owns execution status.
This document owns PROD-13 classification, destination permissions, lifetime and transition rules.
The [35-command output table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and [nested shapes](STUDIO_V2_AGENT_OUTPUT_SHAPES.md) define the per-command projections and local reference rules; the public gateway implementation now enforces the foundation, with full matrix evidence still open.

Use one host-owned classification per document context. Unknown and real documents receive the same restrictive treatment.
Separate document data from application preferences and provider credentials. Decide permission at the destination boundary
before constructing a persistent store, capturing sensitive evidence or sending a request.
Retain existing single-HTML, semantic editing, hash/approval and final human production-export requirements.

## Verified current behavior and limits

| Source | Current observation | Consequence for this design |
|---|---|---|
| [app.js](../studio-v2/ui/app.js), [durable store](../studio-v2/core/durable-transaction-store.js) | Import is Unknown before bus construction and clears sample provenance. Real/Unknown to Synthetic requires current-whole-document confirmation and a fresh persistence context | Three-engine confirmation/cancellation and no-old-head/backfill controls pass; retain DP-C07/DP-L03 and finish complete M1 acceptance |
| [gateway.js](../studio-v2/adapters/gateway.js), [webmcp.js](../studio-v2/adapters/webmcp.js), [agent context](../studio-v2/core/agent-context.js) | Main-app installs receive an explicit policy; standalone gateway/WebMCP now default a missing policy to Unknown, and a missing current policy rejects the old context instead of reusing the prior active policy | Preserve DP-C05/DP-L04 fail-closed behavior; adapter initialization and no-active-document transitions still need case-specific evidence |
| [draft-cache.js](../studio-v2/ui/draft-cache.js) | Full recovery project/fingerprint stored; seven-day age checked on read | Read-time expiry is not scheduled deletion or a privacy guarantee |
| [agent-sessions.js](../studio-v2/ui/agent-sessions.js), [runtime store](../studio-v2/ui/agent-session-store.js) | Missing policy is Unknown. Index/runtime transactions recheck current policy after opening and before store work; stale stores are disposed and active work aborted | Preserve DP-C05/DP-L02/04, pinned Agrun schema and atomic version semantics; complete mapped storage-failure/late-result acceptance remains required |
| [gateway](../studio-v2/adapters/gateway.js), [agent-output-projectors](../studio-v2/core/agent-output-projectors.js) | Public responses are rebuilt from command-specific closed projections; unsafe IDs/paths/selectors use context references; the all-35 dispatch matrix is green | Combined destination, provider-payload and cross-entry acceptance evidence remains required |
| [command dispatch](../studio-v2/core/command-bus-dispatch.js) | Internal get_revision returns metadata; internal undo_revision can include project. The Agent projection excludes that project and reconstructs permitted fields | Keep full canonical results private; do not confuse internal return shapes with Agent outputs |
| [layout-snapshot.js](../studio-v2/ui/layout-snapshot.js), [gateway](../studio-v2/adapters/gateway.js) | Geometry-only SVG exists; real-data pixel requests are rejected | Preserve pixel rejection; geometry still requires a bounded approved projection |
| [agent-vault.js](../studio-v2/ui/agent-vault.js) | Encrypted profiles in IndexedDB; provider/model/endpoint and other profile metadata also stored outside ciphertext | Do not describe every profile field as encrypted; endpoints/IDs must contain no secrets |
| [agent-provider.js](../studio-v2/ui/agent-provider.js), [runtime](../studio-v2/ui/agent-runtime.js) | User prompt and optional parts go to selected provider through the runtime; global memory is disabled. The controlled browser wire case captures the second Provider request after a safe Agent result and checks the decoded JSON body for Real/business canaries and credentials | Local memory-only mode does not imply zero external transmission; the case covers one composed result path, not every command or backend sink |
| [sw.js](../studio-v2/sw.js), [assets.js](../studio-v2/core/assets.js) | Service worker caches only generated shell paths; arbitrary same-origin document navigations are not cache entries; the browser test decodes Cache Storage response bodies and checks that arbitrary navigation is absent; restrictive asset/export paths reject fetchable imported URLs before fetch/HEAD | Browser/network evidence must still confirm no stale worker or delayed request bypass |
| [SQLite adapter](../studio-v2/server/sqlite-durable-backend.mjs), [HTTP server](../studio-v2/server/transaction-http-server.mjs) | Separate durable backend uses SQLite WAL/FULL; the server now defaults to Unknown and refuses restrictive document routes before opening SQLite | Browser policy does not automatically cover database files, WAL, backups or server logs; the explicit Synthetic server path still needs its deployment sink inventory |

These observations establish review targets, not proof that every described leak scenario has occurred.
Provider/backend operational retention and browser-managed disk behavior were not tested in this documentation task.

## Classification rules

| Classification | When assigned | Host behavior | Who may change it |
|---|---|---|---|
| Unknown | Imported HTML, recovered content without valid classification, external asset or mixed content of uncertain origin | Treat as real before installation, persistence and automatic AI context construction | Host records explicit user classification for this document |
| Synthetic | Repository fixture verified to contain no real values, or a user explicitly confirms the current document is entirely synthetic | Supported local recovery/session persistence; bounded AI review under transmission rules | User declaration or verified fixture provenance; never an Agent response or imported flag alone |
| Real | Known ERP/customer/personal/business content, or a user marks content as real | Document-bearing state stays in application memory except explicit file/print actions | Host accepts restrictive changes immediately; loosening requires deliberate reclassification |

- **DP-C01:** Artifact trust and data classification are independent. Valid hashes or removal of scripts do not establish synthetic data.
- **DP-C02:** Classification covers the whole envelope: title, IDs, template literals, schema defaults, translations, sample values, logos, URLs and FormSpec.
- **DP-C03:** Copies, candidates, diffs, chat history and tool responses inherit the most restrictive source classification. Encoding/encryption/compression does not downgrade it.
- **DP-C04:** Redacted output is a permitted projection, not a relabeling of the original document as synthetic. Hashes may identify a document and are not automatic anonymization.
- **DP-C05:** Host policy is bound to document identity and its policy generation. Model-supplied flags, filenames, old sessions and revision hashes cannot broaden permission.
- **DP-C06:** For mixed/uncertain additions, apply Unknown restrictions before side effects. Do not claim automated personal-data detection; manual input still needs truthful classification and prompt disclosure.
- **DP-C07:** Switching to a new document resets classification unless verified fixture provenance applies. Reopening a file starts Unknown even if its embedded metadata says synthetic.

## Data kinds and safe projections

| Data kind | Examples | Permitted treatment |
|---|---|---|
| Document payload | ERP values, customer title, literal text, images, HTML/CSS/JSON, proposal values, conversation text | Apply document classification and destination matrix |
| Structural context | Component type, geometry, field structure, operation type | Project only necessary fields; imported labels/paths/IDs may contain business values |
| Operational metadata | Error code, revision, page count, duration, transaction/evidence reference | Allow only bounded approved types/values; no full error objects, arbitrary strings or nested project payloads |
| Credentials | BYOK key, vault passphrase, private Gateway token, authorization headers | Credential-only path; never document/chat/evidence/diagnostic content |
| App resources/preferences | Shipped runtime, verified sample assets, locale, panel width | Cache/persist independently; no document name, recent-file path or prompt in preference fields |

For automatic AI output, use a per-command allowlist rather than clone-and-delete as the target contract.
Permit bounded numbers, fixed statuses/codes and necessary receipt hashes/references only after reviewing their provenance and purpose.
Map unsafe component IDs/selectors/paths to request-scoped opaque references in host memory; preserve reverse lookup for semantic edits.
Do not alter IDs in the actual project or change its hashes for redaction. Reject unsupported projections instead of returning raw content.
Treat a registry ID matching a technical-looking pattern as untrusted if it originated in the document.
Geometry must contain only approved numeric shapes: no text/image/foreignObject, document labels, external URLs or hidden payload fields.
Geometry can reveal document structure and counts; it is minimized context, not a promise of complete anonymity.

## Storage rules

Allowed means permitted by this policy, not automatically executed. Explicit means a user action for that destination and snapshot.
Real/Unknown restrictions apply to new application-owned writes, including temporary writes and background retries.

| ID / destination | Synthetic document | Real or Unknown document | Lifetime / owner |
|---|---|---|---|
| DP-S01 Active project, candidate, revision/transaction state in memory | Allowed for editing | Allowed; local transaction/hash controls remain, but no crash durability promise | Host/CommandBus; release references on document/session disposal |
| DP-S02 localStorage durable head/revisions/transactions/evidence | Allowed under existing local single-session contract | No document-associated writes, including initial snapshots and patches; use a supported volatile path or block that operation | Durable adapter; bounded history is not time-based erasure |
| DP-S03 localStorage recovery draft/fingerprint | Allowed; existing seven-day read-time expiry remains; startup may inspect metadata only and full recovery needs an explicit user action | No new writes or automatic restore of unclassified/real records; an explicit restore is reclassified before installation and stays volatile | Recovery owner; no claim of expiry while the app is closed |
| DP-S04 IndexedDB session index and runtime chat/tool history | Allowed for explicitly synthetic conversations | Memory-only; no titles, prompts, responses, tool arguments or session labels persisted | Session manager; mode switch does not erase old databases |
| DP-S05 Cache Storage / service worker | Only approved static resources and verified shipped fixtures; not arbitrary document GETs | Same static-only rule; no document, remote asset, provider or authenticated response caching by the app | Service worker allowlist; browser evidence still owns deployment-specific cache inspection |
| DP-S06 UI preferences | Locale/panel sizing may persist | Same; no document identifiers, filenames, content or prompts | Existing preference owners; privacy mode does not require wiping harmless settings |
| DP-S07 Provider vault | Explicit encrypted credential save permitted | Same credential-only exception; real document data is never put in profiles | Vault owner; user lock/delete controls; locking is not deletion |
| DP-S08 Explicit draft/production HTML or diagnostics file | Allowed after action-specific checks | Explicit save allowed with content/destination identified; production gate unchanged; diagnostics use safe projection | File action; file belongs to user, no hidden extra copy or upload |
| DP-S09 Separate SQLite durable service | Only if configured in the tested deployment; no automatic server routing | Deny document persistence under this restrictive profile; real-data server storage needs a separate approved deployment policy | Server adapter; account for DB/WAL/backups/logs before acceptance |
| DP-S10 Application logs, traces, analytics or support upload | Bounded metadata only; no credentials or full prompts/project dumps | Bounded non-payload metadata in memory; no new document-associated persisted logs or automatic support uploads | Each producer/destination; no diagnostic fallback to raw payload |

Credential exception: persist secret material only in the existing explicit encrypted vault workflow; never store passphrase or
decryption key. Keep private tokens only in memory unless the user explicitly saves an applicable credential profile.
Plaintext profile IDs, endpoints and labels must not embed credentials or business data. Use credentials only for the selected service's authentication.
This rule does not assert that an encrypted vault defeats a compromised browser or that clearing references securely erases RAM.

Real-data export still needs transaction/evidence identity. Keep those controls in the supported in-memory path and embed required
evidence in the explicitly requested artifact; do not claim durable anchoring across reloads without approved persistence.
If the current export path cannot honor that rule, report the incompatibility and block that path until implemented.
An explicit file save permits that artifact only; it does not opt the document into DP-S02/03/04/09.

## Sending rules

AI use sends data to the configured provider/Gateway; HTTPS, a localhost endpoint or an owner-operated Gateway does not change classification.
Authorization is scoped to the chosen recipient, task and data kind. Selecting a provider does not authorize a raw document upload.

| ID / destination and trigger | Synthetic document | Real or Unknown document | Required guard |
|---|---|---|---|
| DP-T01 AI context/tool responses during a requested task | Minimal per-command structural context; retain existing semantic restrictions | Only approved projection; exclude raw values, full envelope/revision, literals, URLs, arbitrary audit fields and free-form errors | Shared Agent gateway plus final provider-bound payload check |
| DP-T02 Pixel layout evidence for requested review | Bounded pixels only when the entire captured document is synthetic | Reject capture/send; cannot fall back to pixel image when geometry review fails | Capture boundary and all embedded/WebMCP/CDP gateway paths |
| DP-T03 Geometry review evidence | Bounded validated geometry allowed | Same minimized geometry, metrics and necessary references; no text-bearing or linked image content | Snapshot producer and receiver validation; current document/policy binding |
| DP-T04 User-authored prompt sent by pressing Send | Exact composed text goes to selected provider | Same explicit action, with visible recipient/disclosure; do not silently append raw document values or old real-data history | Composer/runtime; sending text does not authorize persistence or attachments |
| DP-T05 Asset URL fetch/HEAD, fonts and images | Only asset requests allowed by content/network policy | No automatic request to an imported unresolved URL; use inline/local assets or an explicit resource action for the shown destination | Asset/network boundary before any request, including validation HEAD |
| DP-T06 Explicit save/print/download | User-requested destination/artifact only | Same, with real content disclosed; production export remains human-controlled | File/print action; browser download start is not file-write completion |
| DP-T07 Server, telemetry, support, KB or other third party | Only a separately configured/authorized workflow; no implicit forwarding | Deny raw document forwarding in this profile; any new workflow requires its own data/destination contract | Integration owner; never use a second destination after rejection |

User prompts remain a deliberate disclosure channel, not an anonymizer. Do not automatically replay unrelated conversations;
continuing a real-data conversation with the same provider uses only that session's intended context in memory.
Changing provider/Gateway requires a fresh sending context; do not forward previous conversation history silently.
Credentials belong in the chosen transport's authentication mechanism, never the model prompt or tool arguments.
Private keys/tokens must not appear in URL queries, diagnostic links, screenshots or exported HTML.
The shipped public Gateway client identifier is not a secret or a tenant authorization boundary; never document its value here.

External asset requests disclose the requested URL and network metadata even with credentials omitted.
Validate the full target and redirects against the resource authorization; if that cannot be enforced, require inline/local data instead.
Do not relax sandbox/CSP, trusted-export resource rules or semantic-operation allowlists to make an asset load.
If geometry-only review cannot judge an issue such as text legibility, report incomplete evidence; do not claim full visual verification
or bypass existing export requirements.

## Mode changes, existing records and failures

| ID / event | Required order and result |
|---|---|
| DP-L01 Fresh import | Assign Unknown before installBus/storage creation and before any document-derived network request; verify trust separately |
| DP-L02 Synthetic to Real/Unknown | Restrict policy immediately; stop persistent writers; cancel/recheck queued requests and callbacks; establish volatile state while retaining current committed content |
| DP-L03 Real/Unknown to Synthetic | Require deliberate current-document classification; a checkbox change alone must not replay/backfill old real-data chats, transactions or evidence. Start new synthetic persistence context and retain only data confirmed synthetic |
| DP-L04 Replace/reopen document | Discard obsolete callbacks and policy permissions; old content cannot enter the new document's stores, AI context or readiness state |
| DP-L05 Existing persistent records | Identify stores/project records and disclose that they may remain; block automatic replay. No automatic broad deletion. An explicit cleanup must identify targets and retain unrelated projects/preferences/vault |
| DP-L06 Cleanup failure or unknown origin | If record-to-project mapping is ambiguous, do not guess deletion targets. Report remaining copies/blocked databases; do not call cleanup complete until affected stores are inspected |
| DP-L07 Storage/network failure | Never fallback to a forbidden store/recipient. Report volatile, failed or unknown outcome accurately; retain usable committed content in memory where possible |
| DP-L08 Save/mode-change race | Bind the explicit action to document, revision and selected destination. Recheck policy before side effects; newer edits remain unsaved. Do not cancel a confirmed completed write by merely relabeling UI state |

Historical source content, provider-side logs, external backups, downloaded files and printer spools are not erased by a mode toggle.
Do not claim that switching mode revokes requests already sent. Stop further unauthorized sends and report the known boundary.
No new time-based retention value is invented here: supported synthetic retention must be disclosed as implemented;
real/unknown application payload state is volatile under this target policy.
Application-managed no-persistence does not control browser session restoration, OS swap, extensions, screenshots or user cloud-synced folders.
These limits belong in product wording without weakening the application's own write restrictions.

## Implementation responsibilities and dependencies

1. Host import/classification: resolve policy before installing project/session/store; maintain policy identity across async work. The main app, server, page gateway and WebMCP now default a missing policy to Unknown. A no-active-document or missing-current-policy state invalidates old async work rather than reusing the prior policy.
2. Existing storage adapters: enforce DP-S rules at initialization and each write; select supported volatile behavior, never pretend it is durable.
3. Shared Agent boundary: define per-command safe projections, including get_revision, FormSpec/components and audit/recovery; keep opaque-ID reverse mappings local.
4. Provider/asset transport: verify final payload, recipient and current policy; distinguish user text, automatic context and images.
5. UI/file actions: report recipient, classification, volatile/recovery/save state and existing-copy limitations from authoritative outcomes.

Reuse existing owners. No new service or public protocol field is mandated by this document.
The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) expands this ownership into admission/delivery ordering, M0-M5 dependencies, client migration and rollback. Policy must apply before domain/storage side effects, not only when sanitizing the final result.
The linked output table now has closed-schema enforcement and host/reference plumbing in the current gateway. Full 35-command behavioral evidence and M4 acceptance remain open; any public contract change needs compatibility/version review.
Encrypted real-data databases, multi-user retention and automated confidential-data detection are outside this local restrictive profile.
If shared real-data service is selected later, document access, persistence, retention, backups and recovery before enabling its writes.

## Acceptance mapping and evidence

PROD-13 records: 13-01/02/03/04/05/06/07/08 now have case-specific Pass evidence. The [direction review](STUDIO_V2_DIRECTION_REVIEW.md) retains the historical findings and current evidence boundary. These mappings do not add case IDs.

| Existing case | Rule coverage | Required additional evidence |
|---|---|---|
| 13-01 | DP-C01/02/05/07, DP-L01 | **Pass:** `e2e/studio-v2-p0-prod13.spec.js` imports a canary before installation, inspects decoded browser sinks and verifies missing-policy page/WebMCP adapters fail closed; no trust-based Synthetic classification |
| 13-02 | DP-C02/03/04, DP-S01..10 | **Pass:** `e2e/studio-v2-p0-prod13-persistent-sinks.spec.js` performs Real-mode edit/preview/approve/apply and geometry review, then decodes localStorage, session IndexedDB and Cache Storage; `tests/studio-v2/server-policy.test.js` proves restrictive server routes reject before SQLite initialization |
| 13-03 | DP-S01/03/04, DP-L04 | **Pass:** `e2e/studio-v2-p0-prod13-fresh-reload.spec.js` proves Real canary content is not restored after reload; explicit Untrusted download starts separately and does not change application storage |
| 13-04 | DP-C05, DP-L02/04/08 | **Pass for the mapped case:** review-time delayed index write was corrected; serial three-engine mode/document/no-policy Provider and index/runtime/panel lifecycle controls reject stale work and inspect actual storage. Retain original failure evidence as Historical; broader P0 acceptance remains open |
| 13-05 | DP-L03/05/06 | **Pass:** `e2e/studio-v2-p0-prod13-existing-records.spec.js` decodes old durable, transaction/audit, recovery, IndexedDB session, Cache Storage and sessionStorage records plus an unrelated project; Real adds no destination and explicit discard removes only the named recovery record |
| 13-06 | DP-T01/02/03/05/07 | **Pass:** `e2e/studio-v2-p0-prod13-outbound.spec.js` checks summaries, diagnostics, audit/recovery/history, Evidence Pack, geometry and pixels through embedded/WebMCP in all three engines and first-party CDP in Chromium; no canary or unknown field leaves the closed projection |
| 13-07 | DP-S07/08, DP-T04/06 | **Pass for the mapped case:** controlled file save and final Provider-body evidence show only the selected artifact and user-entered prompt crossing their explicitly chosen destinations; no implicit persistence, secret export or old-session forwarding |
| 13-08 | DP-C06, DP-L03/07, DP-S05/06 | **Pass for the mapped case:** imported provenance and permissive defaults were corrected. Serial three-engine classification, storage-denial, volatile-fallback, asynchronous runtime-store and recovery-support controls pass; broader destination acceptance remains open |

Use controlled provider/resource transports and synthetic canaries; inspect decoded content, temporary writes and final persisted state. The current browser helper reads every IndexedDB object store and decodes cached response bodies, but it does not yet constitute a complete inventory of browser, server, provider or operating-system sinks.
Do not contact a live provider with private data to prove redaction. Check application/adapter outcomes and actual browser storage separately.
Document completion is not privacy acceptance. PROD-13 still needs the remaining application-controlled sink/transition evidence closed; operating-system and external-provider retention limits must be disclosed, not represented as application-enforced guarantees.

## SCMC review

- Scope: PROD-13 data/destination contract; evidence: linked current sources; constraints: documentation only, existing trust and transaction invariants.
- Simple: PASS for the policy design: one host-owned classification and restrictive missing-policy behavior remain required.
- Clear: PASS for the corrected Current/Target distinction; current implementation exceptions are identified above.
- Modular: PASS. Host classifies; storage/transport enforce; UI reports results. No new service is introduced.
- Consistent: PASS for the verified 13-04/07/08 paths; remaining unverified destinations must continue to follow the same rules.
- Findings: Historical High/Consistent R1/R2/R3 are corrected in the existing host/session owners. Actual write/send boundaries are verified for the mapped cases; do not weaken DP-C or DP-L to match any remaining code gap.
- Overall: policy direction retained; implementation conformance Partial. Lifecycle/save case paths 13-04/07/08 are verified; complete remaining destinations and broader M4 acceptance before closure.
