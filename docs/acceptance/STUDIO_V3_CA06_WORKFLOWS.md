# Studio v3 workflow acceptance (CA-06 / G5)

This review maps the eight [G5 acceptance cases](../STUDIO_V3_CODING_AGENT_ACCEPTANCE.md#gate-g5-complete-studio-workflows) to current source and existing tests. G5 remains open. The focused run below verifies the file and print request handling change.

| Case | Current path and test evidence | Remaining acceptance |
| --- | --- | --- |
| STU-01 · Create | Human New uses the shared blank and starter factories in [model.js](../../studio-v3/model.js) and [demo-templates.js](../../studio-v3/demo-templates.js). [The Studio browser suite](../../e2e/studio-v3.spec.js) covers New, structure, binding and export. [The agent loop](../../tests/studio-v3-agent-loop.test.js) exercises structured authoring on an existing private draft with rejection and recovery. | The local `/new` [starter command](#local-a4-starter-commands) prepares and validates a fictional candidate. Apply opens a separate document with the reviewed identity and keeps the original tab and its work intact. The [private refinement workflow](../../e2e/studio-v3-new-form-refine.spec.js) runs free-form fictional authoring, manual preview and Apply, all six synthetic scenarios and a separate Adopt on the ready revision. Live provider and full supported-profile acceptance remain open. The host’s A4 preset chooser and Template name control have their own [portable handoff coverage](#a4-portable-handoff). The A4 command chooses a preset for a new fictional form. Model-driven in-place preset changes and project metadata renaming remain open. The existing agent heading operation edits printed text. |
| STU-02 · Open/import | [File intake](../../studio-v3/workspace-file-reads.js) protects the committed project and active drafts across an asynchronous read. [File workflow tests](../../tests/studio-v3-file-workflows.test.js) cover delayed and malformed files, switch races and retry. [The draft browser suite](../../e2e/studio-v3-drafts.spec.js) covers Open/New with pending controls and invalid JSON. [Structured import](../../e2e/studio-v3-structured-import.spec.js) covers mapped CSV/JSON review and explicit Apply. | Chromium, Firefox and WebKit passed approved Open/replacement, exact nested identifiers and invalid UTF-8 checks. Firefox initially lost the recreated iframe context during the nested-ID DOM read. The recheck reads the renderer’s actual page HTML through the existing preview bridge. Native pickers and replacement remain with the host. |
| STU-03 · Multiple collections | [Typed authoring tests](../../tests/studio-v3-ai-authoring.test.js) and [binding invariants](../../tests/studio-v3-agent-binding-invariants.test.js) cover authority, pointer and source-value boundaries. [Additional tables](../../tests/studio-v3-additional-tables.test.js) cover independent collection binding and column limits. The current agent context in [ai-authoring.js](../../studio-v3/ai-authoring.js) derives a bounded pointer/type catalog from declared schema and permitted binding metadata. | The [composed browser case](../../e2e/studio-v3-stu03.spec.js) checks read-only diagnosis, protected values, paper row identity, reviewed Apply and exact Undo. Repeat on the declared supported profile for release qualification. |
| STU-04 · References/assets | [Reference intake](../../tests/studio-v3-ai-reference-intake.test.js), [reference sharing](../../tests/studio-v3-reference-sharing.test.js), and [logo parity](../../e2e/studio-v3-logo-reference-parity.spec.js) cover admission and bounded use of references and existing assets. Local raster bytes enter through the host-owned picker and validation. | Full visual reconstruction depends on CA-05 receipt-bound comparison and independent human rubric. Raster assets and user-owned files remain subject to explicit host admission. |
| STU-05 · Long form repair | [Scenario matrix](../../studio-v3/scenario-matrix.js) is already shared across Validate and agent validate_scenarios. [Scenario tests](../../tests/studio-v3-scenario-matrix.test.js) cover consistency, bounded results, cancellation and no source mutation. [The Studio browser suite](../../e2e/studio-v3.spec.js) covers 0/1/45/100/500 and long bilingual data across the three starters. | The [reviewed repair case](../../e2e/studio-v3-stu05.spec.js) runs all six synthetic scenarios, then separately checks 100 supplied bilingual rows, exact amounts and order, repeated headers and footers, lower page count, explicit Apply and exact Undo. This case passed Chromium, Firefox and WebKit. |
| STU-06 · Data and persistence | [Database browser tests](../../e2e/studio-v3-database.spec.js) cover applied typed changes, explicit persistence, supplied totals, stale cross-tab saves and retained drafts. [Database failure tests](../../e2e/studio-v3-database-failure.spec.js) cover fallback and rollback. [The agent data grant](../../studio-v3/agent-effects.js) remains unavailable. | A [host review case](../../e2e/studio-v3-fictional-note-review.spec.js) stages one note in a fresh fictional form, renders it locally, requires Apply and preserves Undo, schema, canonical rows and IndexedDB. The same review offers one explicit Demo suggestion for exact built-in fictional data. The model receives only the built-in form type and predefined note IDs. The host accepts only an allowed ID, maps it to local text, and requires separate Preview and Apply. The resulting edit is classified as imported data. General model data drafts still need separate authority and reviewed persistence. Existing schema binding metadata and isolated validation scenarios cover part of read-only diagnosis. Stored dataset enumeration and value reads still need their own admission policy. |
| STU-07 · Save/export/print | [File preparation](../../studio-v3/file-io.js) reuses the portable serializer, ready report and trusted standalone builder. [Host actions](../../studio-v3/project-file-actions.js) now disclose the browser handoff as a request and suppress stale async exports. [Export privacy tests](../../tests/studio-v3-export-privacy.test.js) cover editable reopen and share copy data policy. The focused browser case observes actual editable and HTML downloads and intercepts the print invocation inside the preview. | The [A4 portable handoff](#a4-portable-handoff) checks the actual downloads, cold reopen and standalone rendering in three local engines. Native print dialog and physical output remain unverified. |
| STU-08 · History/recovery | [Draft browser tests](../../e2e/studio-v3-drafts.spec.js), [agent steps](../../e2e/studio-v3-agent-steps.spec.js), and [update draft tests](../../e2e/studio-v3-upgrade-drafts.spec.js) cover guarded Apply/Discard/Stay, Preview/Apply/Undo and staged recovery. [Agent loop tests](../../tests/studio-v3-agent-loop.test.js) cover Stop and stale result rejection. | Compose interruption and recovery with the remaining CA-06 workflows. Destructive actions stay with the host. |

## Scope of the focused change

- Save, standalone export and share copy report when the browser download has been requested. The current Save dirty-state transition still occurs after dispatch. A dispatch error preserves unsaved state. Share copies retain the source form's dirty state.
- If the document, revision or ready layout changes during standalone HTML preparation, the host rejects the stale result before any download request. Current-revision retry remains available.
- Print reports when the host requests print from the current ready preview. The browser owns the dialog and the user completes it.

## Focused verification

- Runtime and site builds passed. The packaged agent check passed all 129 contract examples.
- File actions, export privacy, file workflows, document round-trip and scenario matrix passed 38 Vitest cases. The initial revision-race fixture attempted to write a read-only bus property. The corrected test advances revision through the real edit operation and verifies rejection and retry.
- Chromium passed the file actions browser case, including editable JSON content, standalone HTML bytes and print-request dispatch from the preview. The fixture intercepts the native print call.

## Open and import regression

Open used to resolve the form-draft dialog before choosing or reading a file. A user could discard a draft and then select an invalid file or cancel the picker. The host now asks for replacement approval only after parsing a valid project and rechecking the current read ticket. Invalid input and a declined replacement preserve the current draft.

Vitest passed 52 cases across file workflows, import safety, structured import and scenario matrix. Chromium passed five selected draft and import cases, including the native file chooser with malformed input, a declined valid replacement and an approved retry. Nested JSON malformed replacement, cancellation and invalid UTF-8 cases also passed. The site build passed with the corrected Open flow.

## Scenario and navigation verification

- The Chromium scenario-matrix browser case passed. It drove the real Validate panel and agent tool through all six cases, compared page/issue results and checked the unchanged revision. The provider response was scripted.
- The three native invoice, purchase order and delivery note pagination tests passed in Chromium. Each covered 0/1/45/100/500 rows and the long bilingual data, including exact printed row indices in order, document headers, table headers on pages with rows, page footers and longer pagination for bilingual content. A new real-model repair is still required for qualification.
- Two Chromium workspace cases used the real row pager and the real quality issue locator. The visible row range and inspector selection changed while the form revision and undo state stayed unchanged. The feature ledger records these as workspace navigation and retains their stable IDs.
- Ledger/register/discovery and knowledge synchronization Vitest tests passed 15 cases. The regenerated navigation guide changes 26 transitive release digests. These require combined review before publishing.

## STU-03 composed source check

Chromium passed a [two-table workflow](../../e2e/studio-v3-stu03.spec.js) on the integrated tree. The read-only portion uses the actual host grant and registered tools with the real browser renderer. The visible tool catalog excludes writes, a forced write returns GRANT_DENIED, and the answer cites its measured receipt. The deployed composer correction uses a scripted provider and requires human Apply. Before approval the saved project still matches the original. After approval, the primary source IDs, text and quantities match the alternate source array in its supplied order. The separate charges table retains both ordered IDs and amounts. Exact saved-project comparison confirms that sample data, schema and all other design settings are preserved. Undo restores the original saved project and both rendered streams. The initial export comparison omitted the expected last-bound pointer used for field restoration. The corrected oracle asserts it explicitly.

G5 remains open for a supported-profile run with an independent real-model oracle, project preparation, and data-grant workflows.

## Answer only in the Studio composer

Open More settings and select **Answer only (requires Work in steps)** to inspect the current form under the existing read-only grant. The host requires the selected alias to advertise tool support and Responses explicitly in every matching model record. If the capability is unknown or the stepped route fails, the host blocks the request or reports the failed tool turn. Changing the setting expires any earlier unapplied suggestion and resets source consent. Answer only never consumes source authorization. Update recovery retains the restriction with the prompt.

The focused unit suite passed 42 cases. A [Chromium browser suite](../../e2e/studio-v3-answer-only.spec.js) passed six scripted-gateway cases. It covers a forced write tool rejected by the actual model wire path, unchanged saved project content, source consent isolation, zero inference when Work in steps is off or capability metadata is missing or contradictory, and no fallback when a tool turn is refused or ignored. The local site build and all 129 packaged agent contract examples passed with the tested release review.

The forced-write and missing-tool-capability cases also passed Firefox and WebKit on the final build. WebKit initially failed Playwright host preflight. The retry used the installed shared libraries with the same browser binary and passed both cases. I inspected Chromium screenshots at 1440 and 390 px and verified the checked control and its read-only hint.

Live-model and deployment-profile qualification remain open. Dataset writes still require a separate host grant and review flow.

## STU-08 independent-tab update and Undo

A compiled A-to-B regression reproduced a clean independent tab losing the Answer only restriction during an automatic worker update. The tab had no unsaved work, so a project recovery snapshot was correctly unnecessary. The restriction now uses a tab-local preference. Legacy recovery snapshots that lack the setting retain the current tab choice. Source sharing and other permissions retain their existing per-run controls.

The Chromium regression opened an independent purchase form, selected Answer only, and verified automatic activation retained the same form and read-only restriction at revision zero. The original tab separately chose Stay and kept its title, revision, edit history and own mode. Undo there restored the original title. An earlier retry reached the correct child setting but encountered the original tab's expected update dialog before Undo. The final test resolves the real dialog explicitly. Site and 129 agent contracts passed after local digest review. Five focused unit suites passed 79 cases. Seven existing Chromium cases passed the latest main build before the fix, covering forced-write rejection, independent blank/starter tabs, obsolete launch links, pending native reads, pending AI cancellation and conversation recovery. All six Answer only wire cases also passed with the fix.

The same final A-to-B regression also passed Firefox and WebKit with their isolated local browser setup.

## A4 portable handoff

The [portable handoff case](../../e2e/studio-v3-portable-handoff.spec.js) selects the built-in A4 Sales Invoice and the 64-row fictional Campus dataset. A Template name edit changes the revision, metadata and download filenames. The printed heading, indexed bilingual rows, formatted amounts, repeated table headers and pagination stay identical. Save and Export download the editable JSON and standalone HTML at the same ready revision. Each download reopens in a fresh browser context with a new workspace identity and empty Undo history. The saved data, schema and design match and Undo in the original context restores the exact prior title and paper.

Chromium, Firefox and WebKit passed on the local Linux build. The exact downloaded HTML rendered in screen and print media in each engine with every follow-up request blocked and zero attempted follow-up requests. Its embedded data, schema, manifest and attested revision matched the saved JSON. All three engines also rendered the original download through `file://` while offline. Chromium and Firefox used their browser context offline controls. Chromium generated a PDF with the expected A4 page count and dimensions, ordered SKU rows and supplied amounts.

In Playwright WebKit 26.5 on Linux, `offline: true` rejects native navigation before loading both a minimal static HTML control and the downloaded invoice. The browser remains at `about:blank` in both cases. The same files load inside an unprivileged Linux network namespace with no configured interfaces. The regression launches a separate WebKit instance in that namespace, checks the original file bytes, screen and print layouts, embedded source and CSP, and observes zero network attempts from the file. A separate page in that instance fails to connect to the Studio URL that the regular browser reached. If the host cannot create that namespace, the test records the missing native file control and still exercises the same bytes with the existing controlled navigation. Native print dialog completion, physical output and release-profile qualification remain open.

## Local A4 starter commands

Enter `/new invoice-ledger` in the Studio composer to preview the built-in A4 Sales Invoice and its fictional dataset. The same command accepts each of the existing business A4 preset IDs.

| Form | Preset ID |
| --- | --- |
| Sales quotation | `quotation-letter` |
| Sales order | `order-register` |
| Delivery order | `dispatch-manifest` |
| Sales invoice | `invoice-ledger` |
| Purchase order | `procurement-order` |
| Purchase invoice | `payable-voucher` |
| Bank receipt | `receipt-advice` |
| Bank payment | `payment-authority` |
| Enterprise project | `project-brief` |
| Progress claim | `progress-certificate` |

The aliases `/new blank`, `/new invoice`, `/new purchase` and `/new delivery` still open their original starters. The command and preview run locally. **Apply & open in new tab** opens the reviewed form at a separate identity. **Refine in draft tab** opens a private fictional draft that requires a current preview and six successful synthetic scenarios before Adopt. The original tab retains its source, pending edits and history. To rename a project, use **Template name**. To edit the heading printed on the form, use the heading control.

The workspace and private refinement browser suites passed 21 cases across Chromium, Firefox and WebKit. Each engine previewed all ten commands and compared the design, schema and fictional data with the built-in factory. The Sales Invoice path preserved an original form with pending edits through Cancel, independent Apply, reload and return. The Purchase Order path refused early Adopt, ran all six synthetic scenarios and restored the exact reviewed starter before Adopt. The local starter cases dispatched no Demo gateway requests. Six focused unit suites passed 110 cases. The site build and 129 packaged agent contract examples passed with the transitive Composer dependency review.

### Fictional note review and update

The browser update regression opens an independent delivery form and previews a fictional note before installing a second verified shell. The open review blocks the automatic reload. The baseline revision and data stay intact, the unapproved note remains visible, and no recovery record is written. After explicit Apply and Keep, the note and its revision survive reload. Undo restores the exact earlier data, schema and document identity. The original tab retains its source, and the provider counter stays at zero. Chromium, Firefox and WebKit passed with one worker and zero retries. [Browser regression](../../e2e/studio-v3-upgrade-drafts.spec.js)

### Adopted A4 draft update

The browser regression opens `/new invoice-ledger` in a private draft, refuses early Adopt, applies a printed-heading edit and verifies all six synthetic scenarios. After Adopt, a pending column label remains unapplied through Keep and reload into the verified second shell. The recovered document matches the approved document identity, A4 preset, schema, data and rendered heading, label and SKU order. Applying the pending label creates its own revision. Two Undo actions restore the earlier paper and source states exactly. The parent tab chooses Stay and retains its earlier revision. A read-only IndexedDB comparison shows identical datasets and preferences, and the Demo gateway counter stays at zero. Chromium, Firefox and WebKit passed on the build from `d2412e8`. [Browser regression](../../e2e/studio-v3-upgrade-adopted-a4.spec.js)
