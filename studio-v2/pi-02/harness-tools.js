import { Type } from "@earendil-works/pi-ai";
import { AGENT_OPERATION_DEFINITIONS } from "../core/operation-schemas.js";
import { TOOL_CONTRACTS } from "../core/tool-contracts.js";

const READ_ACTIONS = Object.freeze([
  "get_capabilities", "get_project_summary", "inspect_document", "inspect_design_state",
  "get_operation_catalog", "validate_project"
]);
const COMPLETE_ACTIONS = new Set([
  "printform_preview_brand_color", "printform_preview_changes", "printform_preview_layout_repair",
  "printform_complete_current_layout_review", "printform_report_layout_blocked"
]);

function clone(value) { return structuredClone(value); }

function contractSchema(name) {
  const contract = TOOL_CONTRACTS.find((item) => item.name === name);
  if (!contract) throw new Error(`Missing PrintForm contract: ${name}`);
  return Type.Unsafe(clone(contract.inputSchema));
}

function operationSchemas() {
  return Object.entries(AGENT_OPERATION_DEFINITIONS).map(([type, definition]) => ({
    ...clone(definition.schema),
    properties: { ...clone(definition.schema.properties), type: { type: "string", const: type } }
  }));
}

const findingSchema = {
  type: "object", required: ["code", "severity", "status", "message"], additionalProperties: false,
  properties: {
    code: { type: "string", minLength: 1 },
    severity: { type: "string", enum: ["critical", "major", "minor", "info"] },
    status: { type: "string", enum: ["open", "fixed", "accepted"] },
    message: { type: "string", minLength: 1, maxLength: 500 }
  }
};

function normalizeOperations(operations) {
  if (!Array.isArray(operations)) return operations;
  return operations.map((operation) => {
    if (typeof operation !== "string") return operation;
    try { return JSON.parse(operation); } catch { return operation; }
  });
}

function errorFromResponse(name, response, onFailure) {
  const code = response?.error?.code || "PRINTFORM_ACTION_FAILED";
  const error = Object.assign(new Error(`${name} failed (${code}).`), { code });
  onFailure?.(error);
  return error;
}

function resultText(response) {
  return JSON.stringify({ ok: true, result: response.result ?? null });
}

function actionResult(name, response, { control = "continue", terminal = false } = {}, onFailure) {
  if (!response?.ok) throw errorFromResponse(name, response, onFailure);
  return {
    content: [{ type: "text", text: resultText(response) }],
    details: {
      actionName: name, control, terminal,
      kind: "printform_result", resultEnvelopeVersion: "v1"
    },
    ...(terminal ? { terminate: true } : {})
  };
}

export function createPiPrintFormTools({ gateway, createProposal, reviewHooks = {}, onFailure }) {
  const command = (name, input = {}) => gateway.execute(name, input);
  const fail = (name, response) => errorFromResponse(name, response, onFailure);

  async function preview(name, expectedRevision, operations, proposalMeta = {}) {
    const normalized = normalizeOperations(operations);
    const response = await command("preview_changes", { expectedRevision, operations: normalized });
    if (!response?.ok) throw fail(name, response);
    const proposal = await createProposal({
      proposalId: crypto.randomUUID(), revision: response.result.revision,
      transactionId: response.result.transactionId, operations: clone(normalized),
      candidateHash: response.result.candidateHash, diff: clone(response.result.diff),
      validation: clone(response.result.validation), ...clone(proposalMeta)
    });
    return { ...response, result: { ...response.result, proposalId: proposal.proposalId } };
  }

  const tools = [];
  for (const name of READ_ACTIONS) {
    tools.push({
      name: `printform_${name}`, label: name, description: `Read the safe PrintForm ${name} result.`,
      parameters: contractSchema(name), replay: "safe",
      execute: async () => actionResult(`printform_${name}`, await command(name), {}, onFailure)
    });
  }
  tools.push({
    name: "printform_preview_brand_color", label: "preview_brand_color",
    description: "Preview one accessible semantic brand colour change.",
    parameters: Type.Object({ hex: Type.String({ pattern: "^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$" }) }),
    replay: "never",
    execute: async (_id, args) => {
      reviewHooks.guardGeneralPreview?.();
      const summary = await command("get_project_summary");
      if (!summary?.ok) throw fail("printform_preview_brand_color", summary);
      const response = await preview("printform_preview_brand_color", summary.result.revision, [{ type: "set_brand_color", hex: args.hex }]);
      return actionResult("printform_preview_brand_color", response, { control: "complete", terminal: true }, onFailure);
    }
  });
  tools.push({
    name: "printform_preview_changes", label: "preview_changes",
    description: "Preview the complete semantic PrintForm operation set.",
    parameters: contractSchema("preview_changes"), replay: "never",
    execute: async (_id, args) => {
      reviewHooks.guardGeneralPreview?.();
      const response = await preview("printform_preview_changes", args.expectedRevision, args.operations);
      return actionResult("printform_preview_changes", response, { control: "complete", terminal: true }, onFailure);
    }
  });
  tools.push({
    name: "printform_preview_layout_repair", label: "preview_layout_repair",
    description: "Preview one evidence-bound semantic layout repair.",
    parameters: Type.Unsafe({
      type: "object", required: ["operations", "findings", "summary"], additionalProperties: false,
      properties: { operations: { type: "array", minItems: 1, items: { oneOf: operationSchemas() } }, findings: { type: "array", minItems: 1, items: findingSchema }, summary: { type: "string", minLength: 1, maxLength: 500 } }
    }),
    replay: "never",
    execute: async (_id, args) => {
      const operations = normalizeOperations(args.operations);
      const prepared = reviewHooks.prepareRepair?.({ ...args, operations });
      if (!prepared) throw Object.assign(new Error("No multimodal review is active."), { code: "LAYOUT_REVIEW_NOT_ACTIVE" });
      const response = await preview("printform_preview_layout_repair", prepared.expectedRevision, operations, prepared.proposalMeta);
      return actionResult("printform_preview_layout_repair", response, { control: "complete", terminal: true }, onFailure);
    }
  });
  tools.push({
    name: "printform_complete_current_layout_review", label: "complete_layout_review",
    description: "Complete the active layout review using Studio-issued evidence receipts.",
    parameters: Type.Unsafe({
      type: "object", required: ["findings", "summary"], additionalProperties: false,
      properties: { findings: { type: "array", items: findingSchema }, summary: { type: "string", minLength: 1, maxLength: 500 } }
    }),
    replay: "never",
    execute: async (_id, args) => {
      const input = reviewHooks.completeInput?.(args);
      if (!input) throw Object.assign(new Error("No multimodal review is active."), { code: "LAYOUT_REVIEW_NOT_ACTIVE" });
      const response = await command("complete_layout_review", input);
      if (response?.ok) reviewHooks.markComplete?.(response.result);
      return actionResult("printform_complete_current_layout_review", response, { control: "complete", terminal: true }, onFailure);
    }
  });
  tools.push({
    name: "printform_report_layout_blocked", label: "report_layout_blocked",
    description: "Stop the bounded review with a safe blocked outcome.",
    parameters: Type.Unsafe({
      type: "object", required: ["findings", "summary"], additionalProperties: false,
      properties: { findings: { type: "array", minItems: 1, items: findingSchema }, summary: { type: "string", minLength: 1, maxLength: 500 } }
    }),
    replay: "never",
    execute: async (_id, args) => {
      const blocked = reviewHooks.markBlocked?.(args) ?? { status: "blocked" };
      return actionResult("printform_report_layout_blocked", { ok: true, result: blocked }, { control: "complete", terminal: true }, onFailure);
    }
  });
  return Object.freeze(tools);
}

export const PI02_COMPLETE_ACTIONS = COMPLETE_ACTIONS;
