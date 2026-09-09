Goal: Complete Studio v2 sequentially, preserving user work and release gates.

Read and follow:
- [TASK](../TASK.md#sequential-execution-ledger): live status and next step.
- [Execution plan](STUDIO_V2_EXECUTION_PLAN.md): S01-S21 dependencies and owners.
- [DoD](STUDIO_V2_DEFINITION_OF_DONE.md): checklist, evidence and percentage rules.
- [Production plan](STUDIO_V2_PRODUCTION_PLAN.md): requirements.
- [P0 checklist](STUDIO_V2_P0_ACCEPTANCE.md): case evidence.
- [PI migration](STUDIO_V2_PI_HARNESS_MIGRATION.md): actual browser Harness/BYOK.
- [Release checklist](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md): certification and approval.

Follow AGENTS.md and linked data/output policies. Inspect Git status, current code and tests before edits. Resume the first dependency-ready unfinished step; S01 is the documentation handoff, then S02 qualifies PI-00. Reuse implemented controls and valid evidence.

Work one step and one acceptance case at a time: investigate, make the smallest complete fix, verify, record evidence, update TASK, then continue automatically. Do not stop for routine permission. If blocked, name the missing prerequisite and continue only independent authorized work.

Report in Mandarin: step ID/status, G1-G5, earned percentage, evidence, failures/unrun checks, blocker and next action. Calculate percentages exactly per DoD; keep plan closure, P0 Pass/35 and PI Done/6 separate. Never invent progress or treat unit passes as browser acceptance.

Preserve canonical revisions/CAS, scope, private human approval/export, Unknown/Real privacy, existing records and protocol compatibility. PI must use the actual Harness, frontend-only direct BYOK, without an app backend/proxy. Keep amended files <=300 lines.

Finish required local work and prepare a reviewable release packet. Missing print/provider/platform evidence stays open. Do not deploy, push, delete user data or declare Production Ready without applicable explicit authorization.
