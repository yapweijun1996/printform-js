const DEMO_PLANNER_BY_ACTION = Object.freeze({
  printform_preview_brand_color: {
    description: "Preview one accessible brand colour.",
    argsSchema: { hex: { type: "string", required: true } },
    argsExample: { hex: "#854d0e" },
    guidance: "Use once for a simple colour request, then stop."
  },
  printform_preview_changes: {
    description: "Preview the complete semantic change set.",
    argsSchema: { expectedRevision: { type: "number", required: true }, operations: { type: "array", required: true } },
    argsExample: { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] },
    guidance: "Use once with the complete safe operation set, then stop."
  },
  printform_preview_layout_repair: {
    description: "Preview one safe layout repair.",
    argsSchema: { operations: { type: "array", required: true }, findings: { type: "array", required: true }, summary: { type: "string", required: true } },
    argsExample: { operations: [{ type: "set_column_widths" }], findings: [{ code: "COLUMN_BALANCE", severity: "major", status: "open", message: "Columns need review" }], summary: "Rebalance columns" },
    guidance: "Use once for a safe repair before the final pass, then stop."
  },
  printform_complete_current_layout_review: {
    description: "Complete the current layout review.",
    argsSchema: { findings: { type: "array", required: true }, summary: { type: "string", required: true } },
    argsExample: { findings: [], summary: "All required scenarios are clean" },
    guidance: "Use once only when every required scenario is clean."
  },
  printform_report_layout_blocked: {
    description: "Report a blocking layout finding.",
    argsSchema: { findings: { type: "array", required: true }, summary: { type: "string", required: true } },
    argsExample: { findings: [{ code: "OVERFLOW_REMAINS", severity: "major", status: "open", message: "Overflow remains" }], summary: "Manual layout work is required" },
    guidance: "Use once when no safe repair can resolve the review."
  }
});

export function compactDemoActions(actions) {
  return (Array.isArray(actions) ? actions : []).map((action) => {
    const compact = DEMO_PLANNER_BY_ACTION[action?.name];
    if (!compact) return action;
    return { ...action, description: compact.description, planner: compact };
  });
}
