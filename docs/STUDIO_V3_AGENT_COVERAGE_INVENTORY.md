# Studio v3 Agent Capability and Knowledge Coverage Inventory

Status: investigation only. Product/runtime code is unchanged. Snapshot: `86db88c8eea242f6a83b7a4a519e6ae3b3132019` on local `main`, 2026-10-09 (Asia/Singapore).

This is the pre-implementation baseline. The subsequent [first registry implementation](STUDIO_V3_AGENT_REGISTRY.md) adds discovery/knowledge/version binding and resolves the lane-limit and original-binding issues; the counts below intentionally retain the inspected snapshot.

The objective is a built-in agent that understands and operates the evolving Studio product. This inventory covers user workflows and integration boundaries, rather than counting every JavaScript export. Image reconstruction is one scenario within that product scope.

The [CSV inventory](STUDIO_V3_AGENT_COVERAGE_INVENTORY.csv) is the row-level review and implementation input. Each row includes proposed capability ID, present access, knowledge delivery, implementation/document/test references, gap and next action. IDs are proposed catalog identifiers; they are not currently registered tools. The [architecture plan](STUDIO_V3_AGENT_ARCHITECTURE_PLAN.md) describes the proposed tracking method.

## What is currently connected

This inventory groups 66 implemented product/runtime capabilities: **20 Tool**, **11 Limited**, **20 Unexposed**, **15 Host**. These categories describe access, not completion percentages. Granularity is intentional and can change when the registry is designed.

- **Tool**: callable by the current Pi loop, sometimes through an operation inside `apply_operations`.
- **Limited**: part of the capability is reachable through tools/request context, with the missing subset recorded in the CSV.
- **Unexposed**: implemented in UI/services, without a model-visible adapter for that workflow.
- **Host**: controlled by the user/application. Confirmation, downloads, printer dialogs, model selection and release updates need not become autonomous tools.

Knowledge labels describe what reaches the model today: **Inline** = fixed prompt/tool description; **Context** = host-projected facts/constraints; **Partial** = model-facing guidance exists but is incomplete or inconsistent; **Human** = repository/product documentation, not an agent-readable resource. No current v3 tool loads these Markdown documents as skills.

Knowledge distribution: 15 Inline, 6 Context, 15 Partial, 30 Human. A filename in the evidence columns is not proof that the model has read it.

The Pi loop exposes exactly seven tools: `get_context`, `apply_operations`, `inspect_draft`, `undo_step`, `take_notes`, `finish`, `report_blocked`. The generic operation input is `Array<Record<string, Any>>`; handwritten local validators restrict the actual operation union. There is no v3 tool registry, skill loader or capability discovery tool.

## Implemented capability map

Profile letters refer to the evidence index below. The CSV holds the complete per-row source/test references and limitations.

### Authoring

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.style.global` | Global accent, base font, padding and switches | Tool | Inline | A |
| `printform.style.element` | Heading and page-number typography | Tool | Inline | A |
| `printform.table.row-fill` | Table body background and default reset | Tool | Inline | A |
| `printform.field.properties` | Labels, format, show-label and field typography | Tool | Partial | A |
| `printform.field.binding` | Choose compatible scalar binding | Limited | Partial | H |
| `printform.field.static` | Static text authoring | Tool | Partial | A |
| `printform.field.image` | Image fields using existing assets | Limited | Partial | A |
| `printform.field.add` | Add fields and table columns | Tool | Inline | A |
| `printform.field.remove` | Remove fields and table columns | Tool | Inline | A |
| `printform.field.reorder` | Reorder all fields or columns in a section | Tool | Inline | A |
| `printform.table.column-width` | Adjust table column width | Tool | Inline | A |
| `printform.section.properties` | Enable, label, break and keep sections together | Tool | Partial | A |
| `printform.section.grid` | Non-table section grid and gap | Tool | Inline | A |
| `printform.section.reorder` | Reorder the five sections | Tool | Inline | A |
| `printform.page.geometry` | Paper, orientation and margins | Tool | Inline | A |
| `printform.table.collection` | Select an available row collection | Limited | Partial | H |
| `printform.heading.text` | Set explicit requested heading | Tool | Partial | A |
| `printform.logo.reference` | Set, resize or remove an existing logo | Limited | Partial | A |

### Project

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.project.blank` | Start a blank form | Unexposed | Human | C |
| `printform.project.starter` | Start a business demo/template | Unexposed | Human | C |
| `printform.design.preset` | Use business-specific A4 layout presets | Unexposed | Human | C |
| `printform.asset.import` | Import local raster design assets | Unexposed | Human | B |
| `printform.project.locale-currency` | Choose locale and currency | Unexposed | Human | B |

### Lifecycle

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.project.open` | Open editable v3 JSON or exported HTML | Unexposed | Human | B |
| `printform.project.save` | Save editable template including active data | Unexposed | Human | B |
| `printform.project.export-html` | Export validated standalone HTML | Unexposed | Human | B |
| `printform.project.print` | Native browser print | Host | Human | B |
| `printform.project.history` | Committed form Undo/Redo | Host | Human | B |
| `printform.proposal.review-apply` | Preview, Apply and Undo proposal | Host | Partial | I |

### Data

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.data.json-edit` | Edit active JSON form data | Unexposed | Human | B |
| `printform.data.sample-switch` | Switch synthetic validation samples and restore source | Unexposed | Human | E |
| `printform.dataset.list` | List compatible saved datasets | Unexposed | Human | D |
| `printform.dataset.read` | Read a specific dataset revision | Unexposed | Human | D |
| `printform.dataset.schema` | Read local dataset schema | Unexposed | Human | D |
| `printform.dataset.edit` | Edit typed data fields and item rows | Unexposed | Human | D |
| `printform.dataset.save-copy` | Save and Apply or create dataset copy | Unexposed | Human | D |
| `printform.dataset.load` | Load/reload compatible saved dataset | Unexposed | Human | D |
| `printform.dataset.import` | Import dataset JSON | Unexposed | Human | D |
| `printform.dataset.export` | Export active or pending dataset JSON | Unexposed | Human | D |
| `printform.dataset.delete` | Delete saved record while retaining current form | Host | Human | D |
| `printform.dataset.restore` | Restore known starter records | Host | Human | D |
| `printform.dataset.refresh` | Refresh local list and cross-tab notices | Unexposed | Human | D |

### Observation

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.context.structure` | Read semantic structure and binding catalog | Limited | Context | H |
| `printform.context.selection` | Apply only explicit selected/reference scope | Limited | Context | H |
| `printform.preview.inspect` | Inspect current candidate print geometry and quality | Tool | Context | E |
| `printform.preview.typography` | Answer measured current print font sizes | Limited | Context | H |
| `printform.validation.matrix` | Validate across multiple synthetic samples | Unexposed | Human | E |

### Workspace

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.workspace.mode` | Design/Data/Validate and inspector tabs | Host | Human | F |
| `printform.workspace.structure` | Search/fold/select structure and locate elements | Host | Human | F |
| `printform.workspace.pages` | Paper zoom, page navigation and thumbnails | Host | Human | F |

### References

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.reference.attach` | Attach, choose sharing mode, remove or cancel files | Host | Human | G |
| `printform.reference.pdf-text` | Read PDF extracted text and positions | Limited | Context | G |
| `printform.reference.visual` | Use raster or PDF-page reference images | Limited | Partial | G |
| `printform.reference.element-tags` | Add to chat with per-element comments | Limited | Context | H |

### Agent runtime

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.agent.draft` | Apply multi-step edits on private draft | Tool | Inline | I |
| `printform.agent.undo-step` | Retract the last private draft step | Tool | Inline | I |
| `printform.agent.notes` | Keep notes while old context is folded | Tool | Inline | I |
| `printform.agent.finish` | Finish only a successfully inspected current draft | Tool | Inline | I |
| `printform.agent.blocked` | Report unsupported work explicitly | Tool | Inline | I |
| `printform.agent.stop` | Stop, invalidate stale runs and preserve committed form | Host | Partial | I |
| `printform.agent.budgets` | Time, tool-call, repeated-error and token controls | Host | Partial | J |
| `printform.agent.provider` | Discover model aliases and confirmed image capability | Host | Partial | J |
| `printform.agent.transport` | Text streaming, image requests and fallback lane | Host | Partial | J |
| `printform.agent.question-route` | Read-only questions and unavailable-tools fallback | Limited | Partial | I |

### Release

| Proposed ID | Capability | Access | Knowledge | Evidence |
| --- | --- | --- | --- | --- |
| `printform.release.offline` | Install hash-verified offline Studio shell | Host | Human | K |
| `printform.release.update` | Check/update release and recover unsaved work | Host | Human | K |

## Present authoring operation contract

All operations mutate a private candidate and remain subject to identity, scope, design validation and proposal review. Structural editing is already implemented; complete Studio workflow access is not.

| Operation | Supported boundary |
| --- | --- |
| `set_style` | Accent, global font/padding and existing boolean switches. |
| `set_element_style` | Title and page-number font size, weight, color and alignment. |
| `set_table_style` | Items `rowBackground` only, including reset to default. |
| `set_field` | Field/label properties, typography, binding, width and existing image reference; financial restrictions apply. |
| `add_field` / `remove_field` / `reorder_fields` | Section fields and item columns; stable IDs, exact order and count/width bounds. |
| `set_section` / `reorder_sections` | Five fixed sections; non-items grids; breaks/repetition constraints. |
| `set_page` | A4/A5/LETTER/LEGAL, portrait/landscape, bounded margins. |
| `set_logo` | Existing asset or removal; no file import. |
| `set_collection` | Available array path and compatible row bindings. |
| `set_heading` | Explicit user-requested static heading. |

These are 13 operation types, not 13 independently discoverable tools. Bounds and semantics live across the prompt, contract, authoring implementation and design validation. Registry work must preserve their behavior before broadening the surface.

## Gaps to resolve first

1. **Runtime knowledge drift (P1).** `runPanelAgent` supplies `chatRequest` to `get_context`; that function always declares `maxModelRequests:3` and `maxPreviewInspections:3`. The actual step loop allows 1000 tool calls and a 60-minute deadline. Request count and tool-call count are different measures. Generate lane-specific limits from the runtime contract; do not substitute 1000 for model requests. Evidence: [context](../studio-v3/ai-chat-protocol.js), [caller](../studio-v3/ai-agent-run.js), [limits](../studio-v3/ai-gateway-config.js).

2. **Financial binding invariant gap (P1).** Direct `set_field` protects financial bindings, but deleting a field and re-adding the same ID with another compatible pointer bypasses that protection. A local synthetic probe reproduced this on the current snapshot: the final proposal changed `items-rate` from `./rate` to `./quantity`, while the original project/source data stayed unchanged. This is a display-binding integrity gap. Freeze the initial baseline and validate net changes before enabling broader reconstruction. Existing tests cover direct rebindings, not this complete invariant.

3. **Knowledge cannot be discovered (P1).** All seven tool names and the operation instructions are fixed. Product guides are human-readable only. New UI functions do not automatically enter the agent surface. The gateway probe function named `read_skill` is a stand-in, not a shipped v3 skill reader. Evidence: [tools](../studio-v3/agent-tools.js), [prompt assembly](../studio-v3/agent-loop.js), [current limitation](STUDIO_V3_AI_CHAT.md).

4. **Core workflow adapters are absent (P1).** Creating forms, asset import, locale/currency, template save/export preparation, dataset discovery and scenario-matrix validation already have implementations. Prioritize shared services and adapters; do not copy UI click logic or open every host action to the model.

5. **Observation does not support complete design understanding (P1).** Automatic context omits existing labels, static text, heading, current pointers and asset bytes. `inspect_draft` returns bounded numeric diagnostics, not preview pixels. Tool-result images are dropped by the wire serializer. Add consent-aware semantic reads and typed observations before claiming visual self-correction. Evidence: [projection](../studio-v3/ai-authoring.js), [inspection](../studio-v3/ai-inspection.js), [wire](../studio-v3/agent-wire.js).

6. **Reference continuity and read-only routing are limited (P2).** Reference images are removed after four assistant turns and cannot be re-read through a tool. Questions route to the single-step lane, so they cannot independently inspect tools/resources. Provide bounded reference handles and read-only discovery without widening edit authority.

7. **Human documentation drift (P2).** `STUDIO_V3.md` still describes every Send as at most three requests/inspections and claims the panel displays exact initial JSON. `STUDIO_V3_AI_CHAT.md` distinguishes step mode, but its bounded-run paragraph needs an explicit single-step qualifier. Older source audits and demo acceptance ledgers describe their historical snapshots, not the current feature set. Mark provenance and update guides from the same release contract.

8. **Feature-to-evaluation coverage is not tracked (P2).** Many unit/browser tests exist, but no release manifest maps every capability and skill to a task evaluation. Scripted provider and captured-response replay tests verify mechanics; they do not demonstrate autonomous model competence across new product releases.

## Foundation that is proposed, not implemented

These items are excluded from the implemented capability counts above. Existing v2/MCP prototypes are reusable evidence, not proof that Studio v3 has these integrations.

| Proposed capability | Required tracking artifact or behavior |
| --- | --- |
| `printform.agent.capabilities` | Feature-owned registry with stable IDs, schemas, services, exposure policy and error contracts. |
| `printform.agent.knowledge` | Indexed bundled guides/skills/examples with source dependencies and bounded readers. |
| `printform.agent.release-handshake` | Runtime, capability and knowledge identities from one immutable release. |
| `printform.agent.change-tracking` | Added/changed/deprecated/removed diff against last published manifest; semantic owner review. |
| `printform.agent.evaluations` | Capability/skill-to-fixture mapping and release task regressions. |
| `printform.agent.lessons` | Reviewed, source-backed reusable lessons; separate from temporary task notes. |
| `printform.preview.image-observation` | Approved rendered page observations plus multimodal result serialization. |
| `printform.agent.mcp-adapter` | Optional v3 MCP adapter to the same registry/services; MCP alone does not supply understanding. |
| `printform.agent.code-workspace` | Optional isolated source/files/build execution backend. Pi in the browser does not provide shell/source access. |

Remote ERP/SQL/warehouse execution, calculation generation, arbitrary HTML/CSS/script, arbitrary absolute layout, image cropping/generation and arbitrary table styling are not capabilities of the current v3 agent. Do not label them as existing UI actions missing only an adapter. Product/library additions require their own design and acceptance contract.

## Evidence index

Source, documentation and test paths are fully expanded per row in the CSV. Each profile below links representative implementations and verification. Test-file existence is a coverage lead, not a claim that every row has a dedicated or passing acceptance test.

| Profile | Boundary | Source | Verification lead |
| --- | --- | --- | --- |
| A | Authoring | [ai-authoring.js](../studio-v3/ai-authoring.js) | [studio-v3-authoring.test.js](../tests/studio-v3-authoring.test.js) |
| B | Project and assets | [controller.js](../studio-v3/controller.js) | [studio-v3-document-roundtrip.test.js](../tests/studio-v3-document-roundtrip.test.js) |
| C | Starters and presets | [demo-templates.js](../studio-v3/demo-templates.js) | [studio-v3-a4-presets.test.js](../tests/studio-v3-a4-presets.test.js) |
| D | Data workflows | [database-controller.js](../studio-v3/database-controller.js) | [studio-v3-database-controller.test.js](../tests/studio-v3-database-controller.test.js) |
| E | Preview and validation | [preview.js](../studio-v3/preview.js) | [studio-v3-preview-handshake.test.js](../tests/studio-v3-preview-handshake.test.js) |
| F | Workspace navigation | [canvas-controls.js](../studio-v3/canvas-controls.js) | [studio-v3-page-navigation.test.js](../tests/studio-v3-page-navigation.test.js) |
| G | References | [reference-files.js](../studio-v3/reference-files.js) | [studio-v3-reference-files.test.js](../tests/studio-v3-reference-files.test.js) |
| H | Context and targets | [ai-chat-protocol.js](../studio-v3/ai-chat-protocol.js) | [studio-v3-ai-authoring.test.js](../tests/studio-v3-ai-authoring.test.js) |
| I | Pi tools and draft | [agent-tools.js](../studio-v3/agent-tools.js) | [studio-v3-agent-loop.test.js](../tests/studio-v3-agent-loop.test.js) |
| J | Provider and limits | [ai-gateway-config.js](../studio-v3/ai-gateway-config.js) | [studio-v3-agent-gateway-loop.test.js](../tests/studio-v3-agent-gateway-loop.test.js) |
| K | Release and offline | [update.js](../studio-v3/update.js) | [studio-v3-update.test.js](../tests/studio-v3-update.test.js) |

## Verification and limits

**14 selected existing test files / 193 tests passed** using Vitest with one worker and no file parallelism. Selection covers authoring, AI authoring, Pi loop/wire/finish/usage, database controller/source adapter, document round trip, preview handshake, updates/offline release, A4 presets and panel agent routing. This is a targeted mechanical regression check, not a per-capability task acceptance score.

Three bounded in-memory Node probes also confirmed: (1) final-proposal financial binding removal/re-addition bypass with the original project unchanged; (2) context still reports three requests/checks while the step configuration allows 1000 tool calls; (3) an image block in a synthetic tool result is dropped while its text is retained. The probes make no provider request and modify no project file.

Source tracing confirms the seven tools, 13 operation types, host/service boundaries and lack of automatic v3 knowledge loading. All CSV source/document/test references and Markdown links resolve locally. The 66 IDs are unique and the table/counts agree with the CSV. The report and CSV are below 300 lines with no trailing whitespace.

No live provider run, supplied-photo reconstruction, browser-wide regression, production printer qualification or exhaustive model task evaluation was performed for this inventory. The existing unit tests may use synthetic provider responses. The report distinguishes implemented services from absent adapters; it does not claim production agent readiness.

The routed `instruction-modules/investigation.md`, `architecture.md` and `verification.md` files are absent in this checkout; the supplied core/project instructions were used. Prior architecture/photo plans are retained. No commit, push or product amendment is part of this inventory.

## Recommended first implementation slice

Correct lane-specific context limits and establish baseline binding invariants, then register the existing seven tools and 13 authoring operations. Use the CSV as the initial ownership checklist. Add capability discovery, one bundled form-authoring guide, generated schemas, and release/conformance checks. This makes future feature updates visible through one feature-owned contract.

After adapter parity, add draft-only project creation, approved semantic reads and scenario-matrix validation. Prepare file/export and asset actions for user confirmation. Dataset reads/writes need a separate explicit data boundary. Retain host review, printer/download and destructive confirmations.
