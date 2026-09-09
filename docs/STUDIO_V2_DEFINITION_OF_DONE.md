# Studio v2 Definition of Done

Status: execution contract, adopted for sequential engineering on 2026-09-08.
This document owns completion and progress rules, not product requirements or release permission.
[TASK](../TASK.md#sequential-execution-ledger) owns live progress; the
[execution plan](STUDIO_V2_EXECUTION_PLAN.md) maps steps to their requirement owners.

## Three different measurements

1. **Step delivery:** earned gate points below, from 0 to 100%.
2. **P0 acceptance:** Pass cases / 35, reported separately with Fail, Not run and Blocked counts.
   The [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md) is the sole case-status owner.
3. **Plan closure:** sum of S01-S21 delivery points / 21, rounded to one decimal place.
   Also show fully Done steps / 21. Steps have equal reporting weight, not equal effort.

The earlier 75% current-product and 60% PI-inclusive figures are rough engineering estimates.
They are not measured delivery credit, schedules or release authorization. Never blend them
with these counters. A new step at 0% means no gates credited in this execution ledger;
it does not mean its existing implementation or historical tests are absent.
The ledger starts with the documentation handoff; it is not a lifetime project completion metric.

## Per-step checklist and scoring

| Gate | Points | Required evidence before checking |
|---|---:|---|
| G1 Investigated | 10 | Trace owning code, callers and relevant tests; freeze the step's acceptance cases, dependencies, impact and required/optional checks. Record Current versus Target and unresolved decisions. |
| G2 Implemented | 40 | Every in-scope requirement is implemented or verified already present. Review the scoped diff, failure handling and compatibility. No partial implementation earns this gate. |
| G3 Focused verification | 30 | All required owning-runtime/unit/contract checks for this step pass, with exact commands, results and source identity. Meaningful negative and boundary cases are covered. |
| G4 Composed acceptance | 15 | Required real-browser, cross-entry, persistence, provider-wire, integration or manual checks pass on the declared environments; affected regressions pass. Mocks do not replace their owning runtime. |
| G5 Closed | 5 | All step exit criteria and this DoD pass; evidence, TASK, case register and affected authoritative docs agree; blockers and temporary artifacts are resolved. |

Credit gates in order, only when fully satisfied: valid cumulative percentages are
**0, 10, 50, 80, 95, 100**. Show the active gate's work in prose without inventing fractional credit.
For a documentation-only step, G2 is the actual documentation amendment, G3 is link/ID/count/line
validation and G4 is consistency plus preservation review; application build/browser tests are
not required if no behavior claim changes. Record that applicability at G1, never after a failure.

Existing code may satisfy G2 without edits. Reuse recorded verification only after checking its
source revision/worktree delta, runtime, fixtures and full acceptance coverage. A newer change
invalidating evidence reopens the affected gate and all later gates; percentages may decrease.
Do not rerun an unchanged passing check merely to increase a number. Unknown evidence earns no credit.

## Status and invariants

- Not started: no execution gates credited. Existing code can still be Partial or implemented.
- Pending closure: existing implementation or supporting evidence remains to be credited against this step's complete gates.
- Pending approval: engineering preparation or a consequential decision awaits explicit approval; preserve the actual earned gates.
- In progress: active investigation, amendment or verification; at most one active step.
- Partial: useful work exists but required criteria remain unmet.
- Blocked: name the missing fact, access, resource or authorization and the exact unblock action.
- Failed: observed behavior/check disproves the expected result; repair the cause within scope.
- Done: all five gates checked, 100%, with no required unrun check or unresolved failure.

Do not count expected skips as passed cases. A required skipped/unavailable platform remains
unverified unless an explicit adopted scope makes it inapplicable; preserve the reason and record.
Never shrink the denominator, move a failed case to optional, or silently adopt a proposed scope.
New scope must be recorded with its effect on dependencies and the reporting denominator.

Every implementation step must preserve:

- Canonical project/revision ownership, atomic CAS, candidate hash and evidence binding.
- Private human approval, host operation scope, stale-context rejection and human production export.
- Unknown/Real data restrictions, existing records, policy-bound sessions and closed Agent outputs.
- Supported template/protocol behavior, last-known-good content and truthful save/commit outcomes.
- Simple ownership boundaries; new or amended files at most 300 lines, with bounded extractions
  and focused regression coverage when needed; no unrelated source refactor or user-work overwrite.
- Generated artifacts changed through their owning build, with matching runtime/cache provenance.

## Evidence record template

Keep one concise record per completed gate in the existing
[implementation evidence](STUDIO_V2_IMPLEMENTATION_EVIDENCE.md), linking case records rather
than duplicating them. Split evidence by subject before exceeding 300 lines.

```text
Step / requirement IDs / gate:
Date; branch; commit; relevant uncommitted delta or source hash:
Acceptance criteria and owning source/test paths:
Command; runtime/browser/version; synthetic fixture:
Expected / actual; passed / failed / skipped / unrun:
Evidence or artifact reference; limitations and reuse validity:
Decision / blocker / rollback / next action:
```

## Progress report after each gate or material result

For this handoff use the [step worksheets](STUDIO_V2_STEP_CHECKLISTS.md) and
[resume instructions](STUDIO_V2_AGENT_HANDOFF.md). TASK remains the sole live ledger.
Current recomputation from every row, including partial steps, is 16*100 + 10 = 1610;
1610/21 = 76.7% rounded, with 16/21 steps Done. Neither value estimates remaining time.
Historical passes stay dated when a shared change invalidates current verification; do not delete
the evidence.

```text
Step Sxx/21 — <name> | <status> | <earned points>% | active gate Gx
G1 [ ] G2 [ ] G3 [ ] G4 [ ] G5 [ ]
Verified: <observable result and evidence reference>
Remaining/blocker: <specific criterion or None>
Plan closure: <sum/21>% | Done <n>/21
P0: <Pass>/35 (<percent>%), Fail <n>, Not run <n>, Blocked <n>
PI packages: <Done>/6 | Release: not approved / recorded approval
Next: <one bounded action>
```

Report briefly in Mandarin; maintain source, identifiers and technical documentation in English.
Update TASK before moving on. Do not stop after each step to seek permission for already-authorized
local work. For a real blocker, continue only dependency-independent authorized work and record why.

## Local completion versus release

S01-S20 Done means the bounded engineering plan is verified locally, including the selected PI
target and required acceptance. Report local closure separately as sum(S01-S20)/20 if useful.
It does not close S21, authorize a push/deployment, certify an unavailable printer/browser, or
authorize AI to click a user's production export confirmation.

S21 requires maintainer approval for the exact release profile, version and artifacts, plus explicit
authorization for any publishing action. Prepare the complete reviewable release packet first.
Without that approval, report **local engineering complete; release pending**, retain S21 below
100%, and do not claim Production Ready. Deferred E15/shared-service and unadopted backlog remain
visible outside this bounded plan and must not be described as completed.
