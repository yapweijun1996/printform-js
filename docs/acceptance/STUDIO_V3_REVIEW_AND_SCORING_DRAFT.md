# Studio v3 visual review and qualification plan

This is a draft execution handoff for the [G4 and G8 gates](../STUDIO_V3_CODING_AGENT_ACCEPTANCE.md). The [November recheck](STUDIO_V3_QUALIFICATION_RECHECK_20261120.md) records the tests already run and the outstanding approvals. The existing corpus, oracles and attempts retain their identities and outcomes. This plan includes no model runs or reviewer results.

## G4 · two independent reviewers

Use the [deterministic comparison fixture](../../tests/support/observation-comparison.js) for coordinator rehearsal on fictional pages. The fixture includes injected defects and known repairs, so a rehearsal can catch missing pages, bad labels or unscorable questions before a formal review. Keep these public examples out of the independent holdout set.

**Coordinator packet before execution**

| Record | Freeze and retain |
| --- | --- |
| Review identity | Rubric version and digest, ordered page/scenario list, original reference and candidate byte digests, intended paper dimensions, CSS scale and geometry tolerances. |
| Scope and custody | Exact app/knowledge/runner and authorized route/profile, fictional data clearance or reference-specific consent, candidate revision/scenario and latest receipt IDs, render bytes and deterministic text/binding/geometry results. |
| Blinding | Use neutral case and sample IDs. Give both reviewers the same reference and acceptance criteria, with separately randomized candidate order. Retain the run-to-ID map and order privately until both submissions are locked. Exclude provider identity, fixture defect labels, model scores and the other reviewer's submission. |
| Accessibility | Supply page images at a consistent readable scale and a separate ordered text transcript for exact-text checks. Keep raw case bytes for disputes. |

**Independent reviewer sheet**, one per candidate

| Item | Fill in |
| --- | --- |
| Review ID | Reviewer pseudonym, frozen rubric digest, case ID, candidate ID, submitted time |
| Required sections and text | Meets expectation / defect / uncertain, with page and evidence |
| Binding correctness | Meets expectation / defect / uncertain, with field, displayed value and evidence |
| Alignment and width | Meets expectation / defect / uncertain, with page, anchor or measurement |
| Pagination | Meets expectation / defect / uncertain, with the affected page or continuation |
| Ambiguity | Meets expectation / defect / uncertain, with uncertain reference element and the candidate's disclosure |
| Independence | Confirm that the provider, candidate origin and the other reviewer's ratings were unavailable while scoring |

The coordinator records raw agreement as the number of identical dimension ratings divided by the number of dimensions jointly scored, alongside the two original sheets and all disagreements. Missing ratings or criteria with unresolved disagreement or uncertainty remain unverified. A reconciliation note can resolve an evidence misunderstanding with explicit justification while preserving both original scores. Pair the human records with the independent deterministic results and the run's custody evidence. The coordinator's statistics alone cannot approve a case.

## G8 · a coherent successor corpus

The old 60-task corpus has 12 tasks that correctly end `Blocked`, capping success at 144/180. Even one always-blocked task in a family removes three of its 18 possible successes, leaving at most 15/18 against the unchanged 16/18 minimum. An advertised success corpus needs six tasks per family with a genuinely reachable positive outcome. Keep mandatory refusal and recovery controls separate from the positive denominator, and include their critical violations in the release decision. A blocked or failed attempt in the 180 slots stays in its original slot. A passed refusal control earns no feature-success credit.

| Family | Positive task design for a future freeze | Prerequisite |
| --- | --- | --- |
| Product questions | Ground a design or layout answer in the selected artifact without writes. | Supported read-only route and current receipt. |
| Authoring | Build or revise an independently reviewed draft, validate it and use the intended Preview/Apply path. | Free-form independent form creation for the essential blank case. A local starter command cannot stand in for that essential case. |
| Layout/pagination | Repair measured multi-page defects with exact row conservation and correct text. | Independent geometry and source-data oracle. |
| Bindings | Correct typed field or table bindings with no change in source meaning. | Authorized fields and explicit binding intent. |
| Data intent | Propose and validate an explicitly scoped data draft, then exercise its separate reviewer and commit path. | Production-quality independent data grant and false-write protection. A field-label edit cannot stand in for a data operation. |
| References/assets | Reconstruct authorized fictional references or repair a hosted design asset selection. | Approved disclosure and two blinded reviewers for reconstruction cases. |
| Files/history/recovery | Prepare portable bytes through the real host selection and download path, reopen, or restore the correct revision. | Supported file and recovery interfaces with artifact receipts. |
| Source diagnosis/repair | Reproduce a benign document-build error, implement a scoped repair and rerun the real failing check. | Exact-release isolated runner and process evidence. |
| Multi-file source implementation | Deliver a benign document-project code change with real build/test evidence and a complete tree diff. | Exact-release isolated runner and independent tree oracle. |
| Source artifact integration | Build a document artifact and import its exact bytes through the valid source-bound candidate and host review flow. | G6/G7 evidence, artifact lineage and separate Apply authority. |

### Freeze order

1. Maintainer declares the supported route, fixed provider/snapshot or route-level scope, release identity, runner/toolchain, browser, per-attempt and aggregate budgets, approval boundaries and the independent evaluation owner. Resolve capability gaps before writing attempts.
2. The independent owner chooses six distinct positive cases per family, preassigns all six essentials and reserves 20 held-out cases to retain the historical holdout count. Freeze corpus, prompt, package, grants and case/threshold/oracle digests under a **new** version. Store holdout materials and private collector keys outside the model workspace, and record versions/digests without disclosing the held-out contents.
3. Validate in a separate successor directory before dispatch. Use the offline CLI with explicit paired `--corpus DIR` and `--register DIR` options, as described in the [preflight documentation](../STUDIO_V3_G8_PREFLIGHT.zh-CN.md). This checks matching case/input/oracle digests and retains the default historical commands. Preflight must surface an unattainable family or unsupported essential case before any paid calls.
4. After the profile and budget are approved, run three independent repetitions per case against the exact route. Keep signed run/wire/geometry/process evidence and all outcomes in the successor register. Retain 162/180 total, 16/18 per family, 3/3 for each essential, zero critical violations and the full-cohort binomial interval. Report cost only where measured and record unavailable usage honestly. A comparative advantage claim requires its separate paired held-out evaluation.

The next effective decision is the scope and budget for one exact supported profile, alongside separate approval of the reviewer rubric. The release packet still needs the exact provider, operational and hardware qualifications listed in [G9](STUDIO_V3_RELEASE_PACKET_20261120.md).
