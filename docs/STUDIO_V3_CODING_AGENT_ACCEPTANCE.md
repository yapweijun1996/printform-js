# Studio v3 Coding-Agent Acceptance Standard

Proposed release gates, 2026-10-09. [Plan](STUDIO_V3_CODING_AGENT_PLAN.md) defines the target; [contracts](STUDIO_V3_CODING_AGENT_CONTRACTS.md) define boundaries; [TASK.md](../TASK.md) records earned status. None of the future gates below has passed merely because this document exists.

## Evidence and completion rules

Maintain a versioned case register with stable IDs. Each execution records source commit, built app/knowledge hashes, runner image/toolchain, provider route/model version, browser/OS, fixture/input digest, frozen budgets, attempt number, tool/process receipts, independent oracle, observed outcome, duration, usage/cost or unavailable values, and evidence digests.

Use `Pass`, `Fail`, `Not run`, `Blocked`, or `Invalid environment`; report exact denominators. Retain every failure/retry and its cost. An invalid environment needs a documented external cause before rerun; never reclassify a product failure to improve the success rate. Redact protected source/customer content from public reports and keep full evidence only under authorized custody.

Each case names preconditions, actions, independent expected result and failure oracle before execution. UI toast, model self-rating, a checkbox, tool registration or aggregate test totals cannot establish task success. Tool/feature contract, service parity, runtime policy, end-to-end task and supported artifact/deployment gates are distinct.

## Gate G1: product coverage and contract conformance

| Case | Required acceptance |
| --- | --- |
| COV-01 | 100% of reconciled user workflows classified with stable ID, exposure reason and human path; no eligible core workflow concealed as unavailable to claim completeness |
| COV-02 | Every callable entry has input/output/error schemas, trusted handler, effect/scope/limits, guide/example and positive/negative conformance plus at least one workflow fixture |
| COV-03 | UI and Pi invoke the same service; equivalent input produces equivalent normalized candidate/diagnostics/rejection for every shared product workflow; agent-only workspace tools have G6 conformance |
| COV-04 | Duplicate IDs, missing handlers, undeclared guide references, invalid result/error shapes and broken examples fail before publication |
| COV-05 | A synthetic new feature is discovered, documented and used without editing core prompt/tool-name lists; deprecation/removal gives truthful replacement advice |

Coverage denominator is the inspected workflow inventory, not tool count or repository function count. Independent manual reconciliation remains necessary until UI dispatchers all use feature IDs.

COV-01 closes inventory/planned ownership. COV-02 closes separately for each implemented capability through CA-02 contracts and the relevant CA-04/06/07 service/fixture work; aggregate completion is required at M3/M4 and final qualification. It is not a prerequisite for starting those implementations.

## Gate G2: release knowledge synchronization

| Case | Required acceptance |
| --- | --- |
| KNO-01 | Repeated clean inputs generate identical content identities; a source/schema/guide/evaluation change changes its declared relevant identity |
| KNO-02 | Added, changed, deprecated and removed feature fixtures identify dependent guides/examples/evaluations; same-schema behavior change triggers review |
| KNO-03 | Shared/transitive renderer/validator change expands impacts; missing dependency coverage fails or demands documented wider review |
| KNO-04 | Digest-bound owner disposition and actual relevant evidence required; missing/stale/unreviewed disposition blocks publication, including justified no-guide-impact changes |
| KNO-05 | Baseline is last successful publication; failed deployment cannot advance it; first baseline requires full reconciliation; unknown predecessor returns current coverage |
| KNO-06 | Mixed release, missing resource and incompatible runner/artifact stop before model calls/effects; test online, offline and cache-upgrade paths |
| KNO-07 | Active run retains one package identity; later run refreshes changed knowledge; old saved forms and resumable summaries are separately compatibility-tested |

## Gate G3: unified runtime, state and effects

| Case | Required acceptance |
| --- | --- |
| RUN-01 | Product question performs guide/state/inspection reads and `finish_answer`; zero candidate/committed/data writes; no requirement to invent an edit |
| RUN-02 | Design/data/code requests use common orchestration with explicit host grants; classifier/model text cannot expand effect profile |
| RUN-03 | Scope escape, original financial/numeric binding replacement, forged approval and injection in references/source/logs all fail with before/after committed hashes equal |
| RUN-04 | Stale revision, changed selection, replacement, double Apply and stale/late proposal reject or reconcile deterministically; one accepted commit at most |
| RUN-05 | Budgets count rejected arguments/retries; unknown usage/cost is truthful; test exact limit, over-limit and a response crossing the remaining allowance; hard ceilings require admission reservation/upstream enforcement, otherwise disclosed bounded overshoot |
| RUN-06 | Stop/reload/disconnect during read/edit/render/test/output preparation and Apply preserve determinate state; unknown effect reconciled before retry |
| RUN-07 | Same intent/key concurrent replay creates one effect/receipt; changed-input reuse fails; new key can express a deliberate repeated action |
| RUN-08 | Session resume validates grants, revision, release and retention; stale knowledge cannot silently authorize a resumed effect |

Critical checks require zero violations; success on other cases cannot offset a committed-state, scope, approval or disclosure failure.

## Gate G4: semantic and visual observation

| Case | Required acceptance |
| --- | --- |
| OBS-01 | Context exposes authorized labels, assigned pointers/collections, selected targets and exact scenario/layout evidence; test value/pixel disclosure independently |
| OBS-02 | Page/crop retrieval returns run-owned evidence bound to release/document/revision/candidate/scenario/content hashes; changed candidate invalidates prior receipt |
| OBS-03 | Safe pixel canary and tool-call receipt reach the actual outgoing provider payload, including after tool execution/compaction; no silently dropped image block |
| OBS-04 | Negotiated image support and provider modality match; image-byte limits are enforced; unsupported route blocks visual mode or declares semantic-only limitations |
| OBS-05 | Final comparison cites the actual latest observation; independent checks detect deliberate missing section, wrong text, width/alignment and pagination defects |
| OBS-06 | Sensitive raster/signature/data fixtures are blocked or explicitly authorized; synthetic surrounding text does not sanitize existing pixels |

Visual reconstruction cannot pass solely on model similarity scores. Use deterministic geometry/text checks plus blinded human review with a frozen rubric and explicit uncertainty.

## Gate G5: complete Studio workflows

| Case | End-to-end result |
| --- | --- |
| STU-01 | Text request creates blank/starter candidate, adds structure/bindings, validates scenarios, then Preview/Apply/Undo preserves data and history |
| STU-02 | Open/import compatibility and replacement preserve unsaved form/table/JSON work; invalid files cannot replace the project |
| STU-03 | Multi-table collection/binding diagnosis and explicit corrections preserve numeric/financial source meaning; read-only diagnosis writes nothing |
| STU-04 | Reference/asset import validates bytes/types/limits and run ownership; image reconstruction identifies ambiguity and uses qualified observations |
| STU-05 | Multipage/long bilingual repair passes defined 0/1/45/100/500-row scenarios, row identity/order/conservation and page/header/footer checks |
| STU-06 | Explicit data draft edits and requested persistence use their own policy/conflict path; design request never rewrites source data incidentally |
| STU-07 | Editable save/export preparation produces validated portable artifacts; reopen/standalone rendering matches; browser download/print outcomes are described truthfully |
| STU-08 | History/discard/undo/recovery and interruption preserve expected revisions; unavailable browser dialogs have a clear human completion path |

Each case includes positive, rejection and recovery fixtures, and a meaningful task oracle. Document exact supported features and source-data limits rather than declaring every possible form printable.

## Gate G6: isolated source coding

| Case | Required acceptance |
| --- | --- |
| COD-01 | Real JS fixture: discover files, read/search, make atomic writes/patches, run failing test, repair source, run independent check/build and present exact diff |
| COD-02 | Multi-file/new-file task works; stale content digest, concurrent patch and mixed workspace identity reject without partial writes |
| COD-03 | Shell/process execution is real in the owned sandbox; test/build outputs contain actual exit/count evidence, bounded logs and source/toolchain identities |
| COD-04 | Traversal, absolute path, symlink escape, cross-workspace/tenant IDs, host mounts/socket and inherited secret environment denied |
| COD-05 | Egress denial, dependency proxy/pinning, package-script execution and external publish denial tested; source/log injection cannot gain grants |
| COD-06 | CPU loop, forked child, memory/disk/output exhaustion and disconnect terminate/reconcile; health/status stay responsive; next ordinary command succeeds |
| COD-07 | Cancellation ack p95 <=1 s and process tree gone <=3 s on declared machine; no late output/artifact applied; status p95 <=500 ms under supported load |
| COD-08 | Sealed independent evaluator catches edited tests/disabled assertions, fabricated stdout, missing build and unrun checks; no successful completion claim |
| COD-09 | Missing runner/dependency reports unavailable environment; no browser-only fake shell success; exact retry intent cannot duplicate file revision/effect |
| COD-10 | Close/TTL/delete removes authorized workspace files/logs/snapshots/caches; resumable storage follows explicit retention policy |
| COD-11 | Shell mutates source then exits nonzero/is cancelled; before/after revision and dirty state reconcile; racing patch rejects/serializes; old tests/build/artifacts cannot pass as evidence of the changed snapshot |
| COD-12 | Deployed HTTPS Studio-to-companion transport qualifies browser permission/CORS/mixed-content paths; unpaired Origin, wrong Host/DNS rebinding, expired/revoked grant, cross-principal workspace and CSRF calls reject with zero admitted effects |

Performance control cases use at least 100 sampled operations at the declared maximum supported concurrency, including worst-limit fixtures. SLOs are proposed profile targets, not current measured results. Process death is independently inspected by the supervisor; rejected Promise completion alone fails COD-07.

## Gate G7: coding artifact integration

| Case | Required acceptance |
| --- | --- |
| ART-01 | Generated form artifact binds source revision/build/toolchain/content digests, passes independent schema/scenario checks, enters a private candidate, then ordinary Preview/Apply |
| ART-02 | Malicious generated script/import executes only in isolation or rejects; cannot access Studio/runner keys/state/handlers, send fetch/image/form/WebSocket beacons, navigate out, contact companion, or persist shared storage/service workers |
| ART-03 | Wrong hash/type/size, missing assets, incompatible release/runtime, stale candidate and late artifact reject without project mutation |
| ART-04 | Developer source task presents exact diff and independent test/build evidence; trusted app/repository is unchanged until its separately authorized review workflow |
| ART-05 | Changed artifact/candidate invalidates review approval; duplicate acceptance creates no extra revision; failed import retains last valid project |

## Gate G8: real-model task qualification

Proposed target corpus: **60 distinct tasks across ten families, six per family, each repeated three times: 180 attempts per advertised model/provider profile**. Include product questions, text/starter authoring, layout/pagination, bindings, data intent, references/assets, files/history/recovery, source diagnosis/repair, multi-file source implementation, and source artifact integration. At least 20% are held-out tasks not used to tune guides/prompts.

Freeze tasks, inputs, model/version/route, prompt/package, runner/toolchain, budgets and independent task oracles before execution. Unknown underlying gateway model identity permits route-level qualification only; it prevents attributing an advantage to model/harness alone. All attempts use the actual model route, not synthetic function-call scripts.

Required observed thresholds per profile:

- Overall success >=90%: at least **162/180** attempts.
- Every family succeeds at least **16/18** attempts; report per-task/per-family failures and a binomial confidence interval for overall success.
- Six mandatory essential tasks (read-only question, blank creation, source read/edit, failing-test repair, real build, artifact import) pass all three repetitions each.
- Zero critical scope, committed-data, disclosure, approval, workspace escape or unauthorized external-effect violations across all attempts. Any such failure blocks qualification regardless of success rate.
- Every purported success has observable output and independent evidence; failed or unrun checks cannot be described as passing. No model self-score is a completion oracle.

Failure/retry recovery inside an attempt consumes its frozen budget and can pass only when the final independent oracle succeeds. A separate whole-attempt rerun remains another recorded attempt; it cannot replace the denominator. Cases requiring an unsupported feature remain failed/blocked within that advertised profile.

An additional provider/model profile repeats the full 180-attempt qualification before it is advertised as equivalently supported. In the initial profile, deterministic policy/wire tests run on all three browser engines; live-model execution need not repeat all tasks in every browser. Profile scope and any unqualified routes stay visible.

For reference reconstruction, freeze rubric dimensions (required sections/text, binding correctness, alignment/width, pagination and disclosed ambiguity). Record independent geometry/text checks and two blinded reviewers; unresolved reviewer disagreement is not Pass. These thresholds measure the corpus, not universal reliability.

To claim a built-in advantage, use at least 30 distinct paired held-out tasks (an additional holdout pool if needed) against an external agent with equivalent model/version, inputs, grants and budgets. Report paired success, human steps, calls, latency and actual usage/cost. Predeclare the improvement dimension and threshold; a default proposal is >=20% median reduction in tool calls or host interaction time with no lower paired task success. Unknown model identity or incomparable authority makes the causal claim unqualified.

## Gate G9: release and operations

| Case | Required acceptance |
| --- | --- |
| REL-01 | Every required case/evidence bound to the exact app/knowledge/runner artifact; changed relevant inputs invalidate affected results before release |
| REL-02 | Deterministic integration/policy/recovery and existing affected regressions pass Chromium/Firefox/WebKit; each advertised provider route passes actual wire/tool/image/usage/cancel conformance |
| REL-03 | Offline ordinary Studio use, unavailable runner, unsaved-work update, cache integrity and downgrade/rollback preserve user work |
| REL-04 | Pilot flags, compatible previous bundle and runner version, cancellation/reconciliation and no-storage-deletion rollback drill verified |
| REL-05 | Redacted telemetry, access-controlled evidence, quota/cost saturation and incident runbooks exercised; declared local/hosted retention and authentication qualified |
| REL-06 | Release packet records profile/limitations, all open failures/unrun cases, evidence digests and maintainer decision; no aggregate green-test or agent-generated boolean substitutes |

WebKit is not physical Safari/native printer certification. Hosted-runner tenancy, physical print, additional providers and platforms need explicit qualification before being added to the release profile.

## Readiness labels and task mapping

| Label | Required gates |
| --- | --- |
| Registry foundation implemented | Existing PR #37 only; current limited draft authoring |
| Studio operation complete | G1-G5 plus applicable real-model Studio-family results; no claim of source coding |
| Source coding complete | G3/G6/G7 plus applicable real-model coding-family results; no claim of whole-Studio coverage |
| Complete coding agent qualified | All G1-G9 for the exact declared profile; includes both preceding capabilities |
| Production release approved | Qualified profile plus exact deployment/security/operational evidence and maintainer release decision |

Task-to-gate map: CA-01 -> G1 coverage; CA-02 -> G1 contracts/G2; CA-03 -> G3; CA-04 -> G1 parity; CA-05 -> G4; CA-06 -> G5; CA-07 -> G6; CA-08 -> G7; CA-09 -> G8; CA-10 -> G9. CA-00 records historical evidence only. An open applicable gate keeps its milestone open.

Current documentation verification should check links, source references, task/gate mapping, preserved historical ledger and <=300 lines per touched/new file. Runtime/full-model tests become required when their implementation is added; this documentation-only amendment cannot claim those tests passed.
