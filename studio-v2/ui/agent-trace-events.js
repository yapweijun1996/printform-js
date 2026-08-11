export const SAFE_TRACE_TYPES = new Set([
  "runtime_config", "turn_start", "phase", "tool_start", "tool_result",
  "action-executed", "action-error", "planner-native-parallel-batch",
  "approval_required", "budget_warning", "repair_attempt",
  "circuit_breaker_tripped", "usage", "completed", "runtime_error",
  "assistant_text", "stopped", "terminal_action_required", "proposal_recovered", "proposal_ready", "proposal_applied", "layout_readiness",
  "terminal_state",
  "layout_review_started", "layout_evidence_ready", "layout_multimodal_started",
  "layout_repair_proposed", "layout_repair_applied", "layout_review_passed",
  "layout_review_blocked", "layout_review_stopped"
]);

export const AUDIT_TRACE_TYPES = new Set([
  "runtime_config", "turn_start", "approval_required", "budget_warning", "repair_attempt",
  "action-executed", "action-error", "planner-native-parallel-batch",
  "circuit_breaker_tripped", "usage", "completed", "runtime_error", "stopped", "terminal_action_required",
  "proposal_recovered", "proposal_ready", "proposal_applied", "layout_readiness", "layout_review_started",
  "terminal_state",
  "layout_evidence_ready", "layout_multimodal_started", "layout_repair_proposed",
  "layout_repair_applied", "layout_review_passed", "layout_review_blocked", "layout_review_stopped"
]);

export const TRACE_LIFECYCLE_LABELS = Object.freeze({
  runtime_config: "Runtime configured", turn_start: "Turn started", approval_required: "Approval required",
  "action-executed": "Action executed", "action-error": "Action error", "planner-native-parallel-batch": "Parallel planner batch",
  budget_warning: "Budget warning", repair_attempt: "Repair attempt", circuit_breaker_tripped: "Safety stop",
  usage: "Usage", completed: "Run completed", runtime_error: "Runtime error", stopped: "Run stopped",
  terminal_action_required: "Terminal action required", proposal_recovered: "Text proposal recovered", proposal_ready: "Proposal ready", proposal_applied: "Proposal applied", layout_readiness: "Layout readiness",
  layout_review_started: "Layout review started", layout_evidence_ready: "Layout evidence ready",
  layout_multimodal_started: "Multimodal analysis started", layout_repair_proposed: "Layout repair proposed",
  layout_repair_applied: "Layout repair applied", layout_review_passed: "Layout review passed",
  layout_review_blocked: "Layout review blocked", layout_review_stopped: "Layout review stopped", terminal_state: "Terminal state"
});
