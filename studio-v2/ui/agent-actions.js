import { OPERATION_DEFINITIONS } from "../core/operation-schemas.js";

function clone(value) { return structuredClone(value); }

function actionError(name, output) {
  const code = output?.error?.code || "PRINTFORM_ACTION_FAILED";
  return Object.assign(new Error(`${name} failed (${code}).`), { code });
}

function operationSchemas() {
  return Object.entries(OPERATION_DEFINITIONS).map(([type, definition]) => ({
    ...clone(definition.schema),
    properties: { ...clone(definition.schema.properties), type: { type: "string", const: type } }
  }));
}

function findingSchema() {
  return {
    type: "object", required: ["code", "severity", "status", "message"], additionalProperties: false,
    properties: {
      code: { type: "string", minLength: 1 },
      severity: { type: "string", enum: ["critical", "major", "minor", "info"] },
      status: { type: "string", enum: ["open", "fixed", "accepted"] },
      message: { type: "string", minLength: 1, maxLength: 500 }
    }
  };
}

function normalizeOperations(operations) {
  if (!Array.isArray(operations)) return operations;
  return operations.map((operation) => {
    if (typeof operation !== "string") return operation;
    try { return JSON.parse(operation); }
    catch { return operation; }
  });
}

function defineAction(Agrun, spec, onFailure, onAction) {
  return Agrun.defineAction({
    name: spec.name,
    description: spec.description,
    planner: { argsSchema: spec.argsSchema, argsExample: spec.argsExample, guidance: spec.guidance },
    tier: spec.tier || 1,
    outputSchema: { kinds: ["printform_result"], controls: spec.controls || ["continue"] },
    async execute(context, args) {
      const control = spec.control || "continue";
      onAction?.({ name: spec.name, control, phase: "started" });
      try {
        const output = await spec.execute(context, args || {});
        if (output?.ok === false) throw actionError(spec.name, output);
        onAction?.({ name: spec.name, control, phase: "completed", ok: true });
        return { control, output: { kind: "printform_result", ...output }, summary: `${spec.name} completed` };
      } catch (error) {
        onAction?.({ name: spec.name, control, phase: "completed", ok: false });
        onFailure(error);
        throw error;
      }
    }
  });
}

export function makePrintFormActions({ Agrun, gateway, createProposal, onFailure, onAction, reviewHooks = {} }) {
  const command = (name, input = {}) => gateway.execute(name, input);
  const action = (spec) => defineAction(Agrun, spec, onFailure, onAction);
  const read = (name, description, guidance) => action({
    name: `printform_${name}`, description, guidance, argsSchema: {}, argsExample: {},
    execute: async () => command(name)
  });
  const actions = [
    read("get_capabilities", "Read PrintForm capabilities and safety contract.", "Use only when contract details are missing."),
    read("get_project_summary", "Read the current redacted project summary.", "Use to obtain the current revision or recover from a conflict."),
    read("inspect_document", "Inspect declarative template bindings without sample values.", "Use only when the requested change needs template structure."),
    read("inspect_design_state", "Inspect semantic page, table and design state without values or asset sources.", "Use for semantic design decisions; do not repeat at the same revision."),
    read("get_operation_catalog", "Read all supported semantic operation schemas and examples.", "Use at most once per revision and only if the embedded action schema is insufficient."),
    read("validate_project", "Validate the current PrintForm project.", "Use for diagnosis; the host validates automatically after Apply.")
  ];

  async function preview(expectedRevision, operations, proposalMeta = {}) {
    const normalized = normalizeOperations(operations);
    const response = await command("preview_changes", { expectedRevision, operations: normalized });
    if (!response.ok) return response;
    const proposal = await createProposal({
      proposalId: crypto.randomUUID(), revision: response.result.revision,
      operations: clone(normalized), candidateHash: response.result.candidateHash,
      diff: clone(response.result.diff), validation: clone(response.result.validation), ...clone(proposalMeta)
    });
    return { ok: true, proposalId: proposal.proposalId, ...response.result };
  }

  actions.push(action({
    name: "printform_preview_brand_color",
    description: "Preview one accessible semantic brand-colour change for automatic host application.",
    argsSchema: { hex: { type: "string", pattern: "^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$", required: true } },
    argsExample: { hex: "#854d0e" },
    guidance: "Use directly for a simple colour request. Call once, then stop after preview.",
    controls: ["complete"], control: "complete",
    execute: async (_context, args) => {
      reviewHooks.guardGeneralPreview?.();
      const summary = await command("get_project_summary");
      if (!summary.ok) return summary;
      return preview(summary.result.revision, [{ type: "set_brand_color", hex: args.hex }]);
    }
  }));
  actions.push(action({
    name: "printform_preview_changes",
    description: "Preview semantic PrintForm operations for automatic host application.",
    argsSchema: {
      expectedRevision: { type: "number", required: true },
      operations: { type: "array", minItems: 1, items: { oneOf: operationSchemas() }, required: true }
    },
    argsExample: { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] },
    guidance: "Call exactly once with the complete operation set, then stop; the host validates and applies it automatically.",
    controls: ["complete"], control: "complete",
    execute: async (_context, args) => {
      reviewHooks.guardGeneralPreview?.();
      return preview(args.expectedRevision, args.operations);
    }
  }));
  actions.push(action({
    name: "printform_preview_layout_repair",
    description: "Preview one multimodal layout repair; the host binds revision and applies it after validation.",
    argsSchema: {
      operations: { type: "array", minItems: 1, items: { oneOf: operationSchemas() }, required: true },
      findings: { type: "array", minItems: 1, items: findingSchema(), required: true },
      summary: { type: "string", minLength: 1, maxLength: 500, required: true }
    },
    argsExample: {
      operations: [{ type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["7%", "48%", "11%", "16%", "18%"] }],
      findings: [{ code: "COLUMN_BALANCE", severity: "major", status: "open", message: "Description is too narrow" }],
      summary: "Rebalance the print table columns"
    },
    guidance: "Use exactly once when attached evidence needs repair, then stop; the host applies it automatically after validation.",
    controls: ["complete"], control: "complete",
    execute: async (_context, args) => {
      const operations = normalizeOperations(args.operations);
      const prepared = reviewHooks.prepareRepair?.({ ...args, operations });
      if (!prepared) throw Object.assign(new Error("No multimodal review is active"), { code: "LAYOUT_REVIEW_NOT_ACTIVE" });
      return preview(prepared.expectedRevision, operations, prepared.proposalMeta);
    }
  }));
  actions.push(action({
    name: "printform_complete_current_layout_review",
    description: "Complete the active review using host-bound revision and clean evidence receipts.",
    argsSchema: {
      findings: { type: "array", items: findingSchema(), required: true },
      summary: { type: "string", minLength: 1, maxLength: 500, required: true }
    },
    argsExample: { findings: [], summary: "All required scenarios are visually sound" },
    guidance: "Use only when every required scenario has a clean receipt and no blocking issue remains.",
    controls: ["complete"], control: "complete",
    execute: async (_context, args) => {
      const input = reviewHooks.completeInput?.(args);
      if (!input) throw Object.assign(new Error("No multimodal review is active"), { code: "LAYOUT_REVIEW_NOT_ACTIVE" });
      const response = await command("complete_layout_review", input);
      if (response.ok) reviewHooks.markComplete?.(response.result);
      return response;
    }
  }));
  actions.push(action({
    name: "printform_report_layout_blocked",
    description: "Stop the bounded review safely when blocking findings remain or no safe repair exists.",
    argsSchema: {
      findings: { type: "array", minItems: 1, items: findingSchema(), required: true },
      summary: { type: "string", minLength: 1, maxLength: 500, required: true }
    },
    argsExample: { findings: [{ code: "OVERFLOW_REMAINS", severity: "major", status: "open", message: "Long text still overflows" }], summary: "Manual design work is required" },
    guidance: "Use on the final pass or when no safe semantic repair can resolve the evidence.",
    controls: ["complete"], control: "complete",
    execute: async (_context, args) => ({ ok: true, blocked: reviewHooks.markBlocked?.(args) })
  }));
  return actions;
}
