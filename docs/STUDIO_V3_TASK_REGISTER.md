# Studio v3 Real-Task Register (CA-09 skeleton)

Status: empty structure, 2026-10-09. No task is written or frozen and no attempt has run. G8 is open. The [acceptance standard](STUDIO_V3_CODING_AGENT_ACCEPTANCE.md) (Gate G8 and the evidence rules) owns the thresholds; this page describes how the register records them.

Files:

- [tasks.csv](studio-v3-task-register/tasks.csv): one row per task, header only today.
- [attempts.csv](studio-v3-task-register/attempts.csv): one row per attempt, header only today.
- [studio-v3-task-register.mjs](../scripts/studio-v3-task-register.mjs): `validateRegister` (structure and evidence rules) and `qualification` (G8 thresholds per profile). Checked by `tests/studio-v3-task-register.test.js`.

## Families and targets

Ten families, six tasks each, three attempts per task: 60 tasks and 180 attempts per advertised profile.

| Family ID | Scope (from G8) |
| --- | --- |
| `qa` | Product questions |
| `authoring` | Text and starter authoring |
| `layout` | Layout and pagination |
| `bindings` | Bindings |
| `data` | Data intent |
| `references` | References and assets |
| `files` | Files, history and recovery |
| `source-repair` | Source diagnosis and repair |
| `source-implement` | Multi-file source implementation |
| `source-artifact` | Source artifact integration |

Essential slots, each owned by exactly one task and required to pass 3/3: `ESS-QA` (read-only question), `ESS-BLANK` (blank creation), `ESS-SOURCE-EDIT` (source read/edit), `ESS-TEST-REPAIR` (failing-test repair), `ESS-BUILD` (real build), `ESS-ARTIFACT-IMPORT` (artifact import).

## Task rules

- ID `T-<family>-NN`; `holdout` is `yes` or `no`; at least 20% of frozen tasks are held out.
- `capabilities` lists feature-ledger IDs (semicolon-separated); the validator rejects unknown IDs when given the ledger.
- `status` is `draft`, `frozen` or `retired`. A frozen task needs title, capabilities, preconditions, actions, expected result, failure oracle, oracle type (`deterministic`, `reviewer`, `visual-blinded`, `runner-receipt`), oracle owner and a `sha256:` input digest.
- The oracle owner can never be the model or agent itself.

## Attempt rules

- Attempts may reference frozen tasks only; `(task_id, profile, attempt)` is unique.
- `outcome` is `Pass`, `Fail`, `Not run`, `Blocked` or `Invalid environment`.
- A `Pass` needs an oracle result and a `sha256:` evidence digest, and cannot carry a critical violation.
- `Invalid environment` needs a documented external cause in `note`.
- `usage` is a token count or `unavailable`, never blank or zero by default.
- Only attempts 1 to 3 count. A later whole-attempt rerun stays recorded (`extraAttempts`) but cannot replace a failed attempt.

## Qualification (per profile)

`qualification(register, profile)` reports `qualified: true` only when all of these hold: 60 frozen tasks with 6 per family; holdout at least 20%; exactly 180 counted attempts; at least 162 passes; at least 16/18 per family; every essential slot 3/3; zero critical violations. Otherwise it lists each unmet reason. The empty register reports `frozen tasks 0/60` and `attempts 0/180`.

Not covered yet: binomial confidence intervals, paired built-in-advantage comparison, blinded-reviewer agreement for reference reconstruction, and cost reporting. They belong to later CA-09 work.
