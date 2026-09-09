Goal: Complete Studio v2 locally in dependency order and prepare a reviewable release packet.

Read [handoff](STUDIO_V2_AGENT_HANDOFF.md), [TASK](../TASK.md#sequential-execution-ledger), [step checklists](STUDIO_V2_STEP_CHECKLISTS.md), [DoD](STUDIO_V2_DEFINITION_OF_DONE.md), [execution plan](STUDIO_V2_EXECUTION_PLAN.md), [requirements](STUDIO_V2_PRODUCTION_PLAN.md), [P0](STUDIO_V2_P0_ACCEPTANCE.md), [PI](STUDIO_V2_PI_HARNESS_MIGRATION.md), and [release](STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md). Follow AGENTS and linked data/output policies.

Inspect Git status, current source, diffs and tests before edits. Preserve user work. S16/PI-03 is closed on current-source deferred-close and pending-open evidence; continue S17/PI-04 through its remaining final provider/render/privacy/transaction matrix. Reuse valid unaffected evidence, not historical passes against changed code.

Work one step and one case at a time: investigate, freeze checks, make the smallest complete fix, verify, record evidence, update TASK, then continue automatically. TASK alone owns gate credit. Follow G1-G5; partial gates earn no points. Recalculate plan sum/21, Done/21, P0 Pass/35 and PI Done/6 separately after every gate; invalidate stale credit. Current snapshot: 76.7%, Done 16/21, P0 35/35, PI 4/6; verify before reuse.

Use actual browser Harness and frontend-only direct BYOK, no app backend/proxy. Preserve canonical revisions/CAS, scope, private human approval/export, Unknown/Real privacy, old records and protocol compatibility. Keep amended files <=300 lines. Mocks/unit passes are not browser acceptance.

Report in Mandarin: step/status, G1-G5, percentages, evidence, failed/unrun checks, blocker and next action. Missing provider/print/platform evidence stays open; continue only independent authorized work. No push, deployment, user-data deletion or Production Ready claim without applicable explicit authorization.
