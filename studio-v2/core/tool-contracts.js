import { OPERATION_DEFINITIONS } from "./operation-schemas.js";

const objectSchema = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const revision = { type: "integer", minimum: 0 };
const locale = { type: "string", enum: ["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"] };
const stringList = { type: "array", minItems: 1, items: { type: "string" } };
const operationItems = { oneOf: Object.entries(OPERATION_DEFINITIONS).map(([type, definition]) => ({
  ...structuredClone(definition.schema),
  properties: { ...structuredClone(definition.schema.properties), type: { type: "string", const: type } }
})) };
const operations = { type: "array", minItems: 1, items: operationItems };

export const TOOL_CONTRACTS = Object.freeze([
  { name: "get_capabilities", description: "Return the Studio protocol, command contract and safety capabilities.", inputSchema: objectSchema() },
  { name: "get_project_summary", description: "Return document metadata, trust state, revision and validation summary without business row values.", inputSchema: objectSchema() },
  { name: "inspect_document", description: "Inspect template structure and declarative bindings without returning sample values.", inputSchema: objectSchema() },
  { name: "inspect_design_state", description: "Inspect safe semantic layout state: page, typography, brand color, tables, repeated areas and configured asset slots without values or asset sources.", inputSchema: objectSchema() },
  { name: "get_operation_catalog", description: "Return the 13 supported semantic operation definitions, JSON schemas, examples and risk levels.", inputSchema: objectSchema() },
  { name: "preview_changes", description: "Dry-run an atomic semantic change set against an expected revision. When a real browser preview is available (see get_capabilities().capabilities.candidateRealRender), the returned validation reflects REAL pagination for the candidate, not just schema checks, and the response carries a candidateHash.", inputSchema: objectSchema({ expectedRevision: revision, operations }, ["expectedRevision", "operations"]) },
  { name: "apply_changes", description: "Atomically commit a semantic change set to the isolated draft. Optional expectedCandidateHash pins the apply to the approved preview and requireValid prevents committing an invalid candidate.", inputSchema: objectSchema({ expectedRevision: revision, operations, reason: { type: "string" }, expectedCandidateHash: { type: "string", minLength: 1 }, requireValid: { type: "boolean" } }, ["expectedRevision", "operations"]) },
  { name: "validate_project", description: "Run protocol, schema, data, trust and capacity quality checks.", inputSchema: objectSchema() },
  { name: "set_locale", description: "Set the active print locale from the supported five-language profile and invalidate prior review evidence.", inputSchema: objectSchema({ expectedRevision: revision, locale }, ["expectedRevision", "locale"]) },
  { name: "set_asset_source", description: "Replace one declarative image asset slot in the isolated draft and revalidate it.", inputSchema: objectSchema({ expectedRevision: revision, slot: { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, source: { type: "string", minLength: 1 } }, ["expectedRevision", "slot", "source"]) },
  { name: "set_sample_scenario", description: "Replace sample rows with a generated boundary scenario.", inputSchema: objectSchema({ expectedRevision: revision, scenario: { type: "string", enum: ["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"] } }, ["expectedRevision", "scenario"]) },
  { name: "undo_revision", description: "Undo the latest draft revision.", inputSchema: objectSchema({ expectedRevision: revision }, ["expectedRevision"]) },
  { name: "preview_source_edit", description: "Dry-run a gated raw section replacement without committing it.", inputSchema: objectSchema({ expectedRevision: revision, section: { type: "string", enum: ["manifest", "schema", "i18n", "theme", "template", "sampleData"] }, content: { type: "string" } }, ["expectedRevision", "section", "content"]) },
  { name: "get_layout_review_status", description: "Return the mandatory print-engineer review checklist and current revision-bound status.", inputSchema: objectSchema() },
  { name: "begin_layout_review", description: "Start one of at most three visual review passes for the current rendered revision.", inputSchema: objectSchema({ expectedRevision: revision }, ["expectedRevision"]) },
  { name: "capture_layout_evidence", description: "Render one scenario as an uncommitted candidate and issue a Studio-signed, full-page evidence receipt. visualMode=pixels is privacy-gated to synthetic data; geometry is the safe fallback. Broken scenarios return unsigned safe observation data for diagnosis, never a completion receipt. Receipts are invalidated by any mutation.", inputSchema: objectSchema({ expectedRevision: revision, scenario: { type: "string", enum: ["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"] }, visualMode: { type: "string", enum: ["geometry", "pixels"] } }, ["expectedRevision", "scenario"]) },
  { name: "complete_layout_review", description: "Submit AI full-page review findings backed by fresh Studio-issued evidenceIds. Self-declared evidence labels and any major or critical finding block completion; repaired layouts require a new revision and fresh evidence.", inputSchema: objectSchema({
    expectedRevision: revision,
    reviewer: { type: "string", const: "ai-agent" },
    evidenceIds: stringList,
    findings: { type: "array", items: objectSchema({ code: { type: "string" }, severity: { type: "string", enum: ["minor", "major", "critical"] }, status: { type: "string", enum: ["fixed", "accepted", "open"] }, message: { type: "string" } }, ["code", "severity", "status", "message"]) },
    summary: { type: "string", minLength: 1 }
  }, ["expectedRevision", "reviewer", "evidenceIds", "findings", "summary"]) },
  { name: "request_export", description: "Check export readiness. Final production export always requires a human UI confirmation.", inputSchema: objectSchema() }
]);
