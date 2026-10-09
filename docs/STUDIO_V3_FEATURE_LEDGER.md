# Studio v3 Feature Ledger (CA-01 draft)

Status: first reconciliation pass, 2026-10-09, against branch `codex/studio-v3-coding-agent-plan` (base `a1f0da3`). It is a proposal for owner review; COV-01 is **not** closed until a reviewer confirms every row. Product and runtime code is unchanged.

Method: enumerate real UI entry points (`studio-v3/index.html`, `studio-v3/app.js` dispatcher, `studio-v3/database-controller.js`, `studio-v3/ai-panel.js`), then compare with the 66-row [historical inventory](STUDIO_V3_AGENT_COVERAGE_INVENTORY.csv) and the current [registry](../studio-v3/agent-registry.js) (nine tools, thirteen operations). Counts workflows, not private helpers.

Dispositions: `agent-callable` (eligible, needs service/adapter), `human-mediated` (agent prepares or explains, human completes), `intentionally-unavailable` (reason required). `Now` = reachable by the current registry.

## 1. Observed UI entry points

| Source | Entry IDs |
| --- | --- |
| `data-action` (app.js `action`) | `new`, `cancel-new`, `open`, `save`, `export`, `print`, `preview`, `previous`, `next`, `undo`, `redo`, `properties`, `binding`, `go-data`, `go-style`, `rerender`, `validate-all`, `add-field`, `remove-field`, `move-up`, `move-down`, `review-drafts`, `cancel-draft` |
| Selectors | `data-mode` (design/data/validate), `data-sample`, `data-template` (blank/invoice/purchase/delivery), `data-demo-template`, `data-issue`, `data-tree-path`, `data-fold`, `data-layout` (structure/properties/thumbnails/zoom) |
| Database (`data-db-action`) | `choose`, `database`, `add-row`, `delete-row`, `next-rows`, `previous-rows`, `apply-draft`, `save`, `copy`, `reload`, `refresh`, `reset`, `delete`, `import`, `import-data`, `preview` |
| Files and form controls | `#open-file`, `#dataset-file`, `#document-name` (rename), locale/currency form, `#zoom`, Ctrl/Cmd+S, Ctrl/Cmd+Z |
| AI panel | `data-ai` (`models`, `clear`, `close`, `attach`, `cancel`), `data-ai-send`, `data-ai-add`, `data-ai-return`, `data-ai-discard`, `data-ai-scope`, element tags, model alias, steps toggle |
| Update / recovery | `#update-button`, `data-update-choice` (keep/discard/stay), recovery download/discard |
| Draft dialog | `data-draft-choice` (apply/discard/stay) |

## 2. Reconciliation findings

Rows below are workflows absent from, or only implicit in, the 66-row inventory. Each needs a stable ID in the final ledger.

| Proposed ID | Workflow | Evidence | Disposition | Reason / human path |
| --- | --- | --- | --- | --- |
| `printform.project.rename` | Rename template (`#document-name` -> `set_manifest_value /title`) | app.js `document-name` change | agent-callable | Reversible title edit through the existing CommandBus; not in `set_heading` |
| `printform.draft.review` | Unapplied-edit dialog: Apply / Discard / Stay | `index.html` draft-dialog, `form-drafts.js` | human-mediated | Guards user work; agent must never resolve it |
| `printform.project.replace-guard` | New/Open discard confirmation | app.js `new`, `open` | human-mediated | Destructive; preserves unsaved form, table, JSON |
| `printform.history.shortcuts` | Ctrl/Cmd+S and Ctrl/Cmd+Z | app.js keydown | intentionally-unavailable | Input shortcut, equal to `save` / `undo` ledger rows |
| `printform.issue.locate` | Jump from quality issue to element (`data-issue`) | app.js click | agent-callable | Read-only selection; part of observation family |
| `printform.validate.all` | Run all synthetic samples (`validate-all`) | app.js `validateAll` | agent-callable | Already listed as `validation.matrix` (Unexposed); confirm ID |
| `printform.preview.rerender` | Force re-render (`rerender`) | app.js, also stops run | human-mediated | Cancels active run; not model-driven |
| `printform.data.rows-page` | Page and add/delete table rows | `database-controller.js` | agent-callable (draft only) | Folded into `dataset.edit`; keep explicit draft vs save effect |
| `printform.data.draft-apply` | Apply table draft to active data | `apply-draft` | agent-callable (draft only) | Separate from persistence (`dataset.save-copy`) |
| `printform.ai.model-discovery` | Discover models, choose alias, steps toggle | `data-ai=models`, `#ai-model`, `#ai-agent` | human-mediated | Provider choice and consent stay with the user |
| `printform.ai.preview-banner` | Return to / discard unapplied AI preview | `data-ai-return`, `data-ai-discard` | human-mediated | Review gate; agent cannot self-approve |
| `printform.ai.clear-conversation` | Clear conversation | `data-ai=clear` | human-mediated | Memory control |
| `printform.update.choice` | Keep or discard work on update | `data-update-choice` | human-mediated | Already `release.update`; choice row not enumerated |
| `printform.workspace.layout-toggles` | Panel toggles, zoom, fold | `data-layout`, `data-fold` | intentionally-unavailable | View preference only, no effect on form |

## 3. Reconciled counts (draft)

| Item | Count |
| --- | --- |
| Historical inventory rows | 66 (20 Tool, 11 Limited, 20 Unexposed, 15 Host) |
| New rows from this pass | 14 (above) |
| Candidate total | 80 |
| Current registry coverage | 9 tools + 13 operations; none of the 14 new rows is callable |

The 66 historical rows were not re-verified one by one in this pass; the candidate total is provisional.

## 4. Eligible gaps (core workflows not callable today)

Ordered by task-family value. Each needs a service, guide, fixture and evaluation owner before CA-01 exit.

1. Create blank/starter project (`project.blank`, `project.starter`, `design.preset`) -> CA-04 service, CA-06 adapter.
2. Locale and currency, rename -> CA-04/06, small reversible operations.
3. Asset import with human file selection -> CA-06, host-mediated picker.
4. Dataset list/read/schema/edit/import/export (draft vs save separated) -> CA-04/06 with explicit data boundary.
5. Scenario-matrix validation and issue locate -> CA-05 observation family.
6. Save/export preparation -> CA-06, human-mediated completion.
7. Source workspace tools -> CA-07 (outside this ledger's Studio rows).

## 5. Initial task families (seed for the CA-09 corpus)

Names only; oracles and inputs are not frozen here.

| Family | Seed content | Oracle owner |
| --- | --- | --- |
| Product Q&A | Read-only answers about current release | Independent reviewer |
| Form edit | Style, fields, sections, page geometry | Deterministic design diff plus human render check |
| Create / import | Blank, starter, imported project | Independent reviewer |
| Data | Binding, collection, dataset draft | Data fixture comparison |
| Photo reconstruction | Reference image to form | Independent visual oracle |
| Print repair | Overflow, pagination, quality fixes | Print diagnostics plus pixel receipt |
| Source coding | Fix, test, build, diff | Runner build and test receipts |

## 6. Open decisions and next steps

- Reviewer confirms or rejects each of the 14 new rows and the 66 historical rows (COV-01).
- Confirm that `rename` and `data.rows-page` fold into existing IDs rather than becoming new ones.
- Name an owner for each family's oracle; do not let the model judge its own results.
- Next small step: convert this table and the CSV into one machine-checkable ledger file and add a check that every `data-action` / `data-db-action` ID appears in it (supports COV-04).
- Local companion vs hosted runner and cost profiles stay undecided; they gate CA-07/CA-10, not CA-01.
