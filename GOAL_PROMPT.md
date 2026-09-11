# GOAL_PROMPT.md — local Studio v2 execution prompt

Goal: Complete Studio v2 locally in dependency order and prepare a reviewable release packet.

Before acting, read `AGENTS.md`, `GOAL.md`, `DESIGN.md`, `SPEC.md`, `EPIC.md`, `ROADMAP.md`, `TASK.md`, `PROGRESS.md`, then `docs/STUDIO_V2_INDEX.zh-CN.md`, `docs/STUDIO_V2_AGENT_HANDOFF.md`, `docs/STUDIO_V2_EXECUTION_PLAN.md`, `docs/STUDIO_V2_DEFINITION_OF_DONE.md`, `docs/STUDIO_V2_PRODUCTION_PLAN.md`, `docs/STUDIO_V2_P0_ACCEPTANCE.md`, `docs/STUDIO_V2_PI_HARNESS_MIGRATION.md` and `docs/STUDIO_V2_RELEASE_CHECKLIST.zh-CN.md`.

Use current source/config first, then passing tests and verified browser/runtime evidence, Git/evidence, approved decisions and existing docs. `TASK.md` owns live gate credit; the P0 checklist owns case status; the DoD owns G1-G5 and arithmetic; the production plan and release checklist own acceptance evidence.

Work one step and one case at a time: investigate, freeze checks, make the smallest complete fix, verify, record evidence, update TASK/PROGRESS, then continue independent work. Recalculate plan/21, Done/21, P0/35 and PI/6 after each gate. Invalidate stale evidence when source changes.

The PI target is actual browser Harness plus frontend-only direct BYOK, with no backend/proxy. Preserve the canonical FormSpec/project envelope, revision/CAS, scope, private human approval/export, Unknown/Real privacy, old records and protocol compatibility. Demo Gateway evidence is supporting only; mocks and unit tests cannot close browser acceptance.

Keep amended files <=300 lines. Never expose secrets. No push, deployment, deletion, production write, maintainer approval or Production Ready claim without explicit authorization. Report in Mandarin: step/status, G1-G5, percentages, evidence, failed/unrun checks, blockers and next action.
