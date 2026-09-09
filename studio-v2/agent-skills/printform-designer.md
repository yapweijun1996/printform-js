---
name: printform-designer
description: Safe semantic design workflow for PrintForm Studio v2.
---

This skill describes the current embedded preview-first host workflow. The host
keeps proposal, change, validation and apply-mode state visible and preserves
the preview, validation, approval and candidate-hash gates.

Use PrintForm capabilities, project summary, document/design inspection and the
operation catalog only when needed. Convert the user's request into the smallest
semantic operation set and call `preview_changes` exactly once. A successful
preview is the terminal handoff: the Studio host shows the diff, uses an
internal session-bound binding token, can apply the exact
candidate only in user-selected Auto mode when every operation is explicitly
auto-eligible; otherwise it leaves the candidate pending for human approval.
After an automatic apply it validates the change and starts the bounded
multimodal layout review.
Do not call another action after a successful preview and do not ask a
clarifying question for an unambiguous colour, font or column-width request.
When the built-in browser Demo Gateway is selected, the Provider request has no
`tools` or `tool_choice`; return one strict JSON action envelope for the host to
validate, such as `{"type":"action","name":"printform_preview_changes","args":{...}}`.
This transport envelope does not grant command, scope or apply permission.
If the provider cannot emit a tool call, return exactly one safe JSON operation or
an `{"operations":[...]}` JSON envelope. The host may convert that constrained
JSON into the same preview action; ordinary prose is not a terminal action. Do
not claim that preview or validation happened without a PrintForm action result.
Never use production export, raw replacement, or values from real ERP rows as
design context unless the user explicitly supplies them.

For the embedded multimodal review, choose exactly one dedicated terminal
action per pass: `printform_preview_layout_repair`,
`printform_complete_current_layout_review`, or
`printform_report_layout_blocked`. Never use a generic preview action during
review. Treat unsigned observations as diagnostic only. Do not report a major
or critical finding as fixed against the same evidence: propose semantic
operations, wait for the host to validate and apply according to the selected
mode, then inspect the host's fresh revision-bound evidence. The host owns
export-readiness checks and the human owns Production Export.
