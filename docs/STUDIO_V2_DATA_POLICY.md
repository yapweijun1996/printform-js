# Studio v2 Data Classification and Destination Rules

Prepared: 2026-09-07. Baseline: `fb1a641450c2266a712a7b644b32609bea7c0e73` plus reviewed documentation changes.
Status: **Target design for PROD-13; implementation Pending; acceptance Not run**.
This document specifies application behavior, not a claim about provider retention or an authorization to send data now.
Classification labels and rule IDs below are design vocabulary, not newly implemented API fields.

## Authority and recommendation

The [production plan](STUDIO_V2_PRODUCTION_PLAN.md) owns requirements and release status;
the [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md) owns observable cases; [TASK](../TASK.md) owns execution status.
This document owns PROD-13 classification, destination permissions, lifetime and transition rules.
The [35-command output table](STUDIO_V2_AGENT_OUTPUT_FIELDS.md) and [nested shapes](STUDIO_V2_AGENT_OUTPUT_SHAPES.md) define the Target per-command projections and local reference rules; implementation remains Pending.

Use one host-owned classification per document context. Unknown and real documents receive the same restrictive treatment.
Separate document data from application preferences and provider credentials. Decide permission at the destination boundary
before constructing a persistent store, capturing sensitive evidence or sending a request.
Retain existing single-HTML, semantic editing, hash/approval and final human production-export requirements.

## Verified current behavior and limits

| Source | Current observation | Consequence for this design |
|---|---|---|
| [app.js](../studio-v2/ui/app.js), [durable store](../studio-v2/core/durable-transaction-store.js) | installBus always injects localStorage; constructor can write the initial full project | Classification must precede construction, including initial import |
| [draft-cache.js](../studio-v2/ui/draft-cache.js) | Full recovery project/fingerprint stored; seven-day age checked on read | Read-time expiry is not scheduled deletion or a privacy guarantee |
| [agent-sessions.js](../studio-v2/ui/agent-sessions.js) | Synthetic sessions use IndexedDB; real mode uses memory; toggling clears memory references, not old IndexedDB records | Existing records and delayed writes require explicit handling |
| [agent-sanitize.js](../studio-v2/core/agent-sanitize.js) | Known fields are sanitized, but the result starts as a clone; some path/selector/ID fields are preserved | All command results and user-controlled identifiers need a destination-specific review |
| [command dispatch](../studio-v2/core/command-bus-dispatch.js) | Public get_revision returns only revision/projectHash/transactionId/committedAt; undo_revision includes project; FormSpec/component and audit commands expose domain results | Corrected after tracing getRevision() without arguments; inspect undo/project and nested event payloads; no blanket safe-result claim |
| [layout-snapshot.js](../studio-v2/ui/layout-snapshot.js), [gateway](../studio-v2/adapters/gateway.js) | Geometry-only SVG exists; real-data pixel requests are rejected | Preserve pixel rejection; geometry still requires a bounded approved projection |
| [agent-vault.js](../studio-v2/ui/agent-vault.js) | Encrypted profiles in IndexedDB; provider/model/endpoint and other profile metadata also stored outside ciphertext | Do not describe every profile field as encrypted; endpoints/IDs must contain no secrets |
| [agent-provider.js](../studio-v2/ui/agent-provider.js), [runtime](../studio-v2/ui/agent-runtime.js) | User prompt and optional parts go to selected provider through the runtime; global memory is disabled | Local memory-only mode does not imply zero external transmission |
| [sw.js](../studio-v2/sw.js), [assets.js](../studio-v2/core/assets.js) | Service worker caches successful same-origin GETs beyond shell entries; asset handling may fetch/HEAD URLs | Cache and asset fetch are additional destinations; credentials omitted does not hide URL content |
| [SQLite adapter](../studio-v2/server/sqlite-durable-backend.mjs) | Separate durable backend uses SQLite WAL/FULL | Browser policy does not automatically cover database files, WAL, backups or server logs |

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
| DP-S03 localStorage recovery draft/fingerprint | Allowed; existing seven-day read-time expiry remains | No new writes or automatic restore of unclassified/real records | Recovery owner; no claim of expiry while the app is closed |
| DP-S04 IndexedDB session index and runtime chat/tool history | Allowed for explicitly synthetic conversations | Memory-only; no titles, prompts, responses, tool arguments or session labels persisted | Session manager; mode switch does not erase old databases |
| DP-S05 Cache Storage / service worker | Only approved static resources and verified shipped fixtures; not arbitrary document GETs | Same static-only rule; no document, remote asset, provider or authenticated response caching by the app | Service worker; tighten current generic same-origin GET behavior |
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

1. Host import/classification: resolve policy before installing project/session/store; maintain policy identity across async work.
2. Existing storage adapters: enforce DP-S rules at initialization and each write; select supported volatile behavior, never pretend it is durable.
3. Shared Agent boundary: define per-command safe projections, including get_revision, FormSpec/components and audit/recovery; keep opaque-ID reverse mappings local.
4. Provider/asset transport: verify final payload, recipient and current policy; distinguish user text, automatic context and images.
5. UI/file actions: report recipient, classification, volatile/recovery/save state and existing-copy limitations from authoritative outcomes.

Reuse existing owners. No new service or public protocol field is mandated by this document.
The [boundary/migration plan](STUDIO_V2_AGENT_BOUNDARY_MIGRATION.md) expands this ownership into admission/delivery ordering, M0-M5 dependencies, client migration and rollback. Policy must apply before domain/storage side effects, not only when sanitizing the final result.
The linked output table specifies Target safe fields. Implementation still needs closed-schema enforcement and host/reference plumbing; any public contract change needs compatibility/version review.
Encrypted real-data databases, multi-user retention and automated confidential-data detection are outside this local restrictive profile.
If shared real-data service is selected later, document access, persistence, retention, backups and recovery before enabling its writes.

## Acceptance mapping and evidence

All cases remain Not run; these rows refine the existing eight PROD-13 cases and do not increase the 35-case total.

| Existing case | Rule coverage | Required additional evidence |
|---|---|---|
| 13-01 | DP-C01/02/05/07, DP-L01 | Canary import before durable constructor or URL request; no trust-based synthetic classification |
| 13-02 | DP-C02/03/04, DP-S01..10 | Writes inspected across localStorage, session IndexedDB, Cache Storage and enabled server; decoded envelopes/patches/evidence checked |
| 13-03 | DP-S01/03/04, DP-L04 | Reload does not silently restore volatile content; explicit saved artifact remains separately available |
| 13-04 | DP-C05, DP-L02/04/08 | Delayed provider/image/session/cache callbacks cannot use prior policy or wrong document |
| 13-05 | DP-L03/05/06 | Exact old-record inventory, ambiguous/blocked cleanup result and no cross-project/vault deletion |
| 13-06 | DP-T01/02/03/05/07 | All 35 command projections: get_revision metadata-only control, undo project exclusion, direct/wrapped transactions, IDs/paths/URLs, FormSpec and audit canaries; no forbidden egress or asset/cache side effects |
| 13-07 | DP-S07/08, DP-T04/06 | Intentional prompt/save destination; no implicit persistence, secret export or old-session forwarding |
| 13-08 | DP-C06, DP-L03/07, DP-S05/06 | Synthetic positive control; quota/denied storage, mode downgrade and unrelated preference preservation |

Use controlled provider/resource transports and synthetic canaries; inspect decoded content, temporary writes and final persisted state.
Do not contact a live provider with private data to prove redaction. Check application/adapter outcomes and actual browser storage separately.
Document completion is not privacy acceptance. PROD-13 remains Pending until mapped cases and relevant regressions have evidence.

## SCMC review

- Scope: PROD-13 data/destination contract; evidence: linked current sources; constraints: documentation only, existing trust and transaction invariants.
- Simple: PASS. Three document classifications with one restrictive Unknown/Real policy; credentials/preferences are separate data kinds.
- Clear: PASS. Destination, trigger, lifetime and mode-change behavior are explicit; Current observations are separate from Target rules.
- Modular: PASS. Host classifies; storage/transport enforce; UI reports results. No new service is introduced.
- Consistent: PASS. Existing requirement IDs and eight acceptance cases are preserved; intentional save is not an opt-in to hidden persistence.
- Findings: no material SCMC issue in this design. Output fields/reference rules are now specified as Target; enforcement, volatile export integration and cache restrictions remain Pending.
- Overall: PASS for documentation design only. Boundary/migration planning is documented; highest-value next action is M0 owner/consumer inventory preparation before implementation authorization.
