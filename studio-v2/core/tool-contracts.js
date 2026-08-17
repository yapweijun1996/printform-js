import { AGENT_OPERATION_DEFINITIONS } from "./operation-schemas.js";

const objectSchema = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const revision = { type: "integer", minimum: 0 };
const locale = { type: "string", enum: ["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"] };
const stringList = { type: "array", minItems: 1, items: { type: "string" } };
const operationItems = { oneOf: Object.entries(AGENT_OPERATION_DEFINITIONS).map(([type, definition]) => ({
  ...structuredClone(definition.schema),
  properties: { ...structuredClone(definition.schema.properties), type: { type: "string", const: type } }
})) };
const operations = { type: "array", minItems: 1, items: operationItems };
const transactionId = { type: "string", minLength: 1 };
const candidateHash = { oneOf: [{ type: "string", minLength: 1 }, { type: "null" }] };

export const TOOL_CONTRACTS = Object.freeze([
  { name: "get_capabilities", description: "Return the Studio protocol, command contract and safety capabilities.", inputSchema: objectSchema() },
  { name: "get_project_summary", description: "Return document metadata, trust state, revision and validation summary without business row values.", inputSchema: objectSchema() },
  { name: "inspect_document", description: "Inspect template structure and declarative bindings without returning sample values.", inputSchema: objectSchema() },
  { name: "get_form_spec", description: "Return the canonical FormSpec and its compatibility mode without sample row values.", inputSchema: objectSchema() },
  { name: "list_components", description: "List semantic components from the FormSpec registry.", inputSchema: objectSchema() },
  { name: "get_component", description: "Return one semantic component by registry id.", inputSchema: objectSchema({ componentId: { type: "string", minLength: 1 } }, ["componentId"]) },
  { name: "inspect_design_state", description: "Inspect safe semantic layout state: page, typography, brand color, tables, repeated areas and configured asset slots without values or asset sources.", inputSchema: objectSchema() },
  { name: "get_operation_catalog", description: "Return the supported semantic operation definitions, JSON schemas, examples and risk levels.", inputSchema: objectSchema() },
  { name: "begin_transaction", description: "Start an auditable draft transaction against the current revision and acquire its lease.", inputSchema: objectSchema({ baseRevision: revision, agentId: { type: "string", minLength: 1 }, owner: { type: "string", minLength: 1 } }) },
  { name: "get_transaction", description: "Read one durable transaction record, including state, lease, approval and recovery outcome.", inputSchema: objectSchema({ transactionId }, ["transactionId"]) },
  { name: "list_active_transactions", description: "List non-terminal durable transactions after deterministic stale-lease cleanup.", inputSchema: objectSchema() },
  { name: "renew_lease", description: "Renew the caller's transaction lease with an explicit heartbeat.", inputSchema: objectSchema({ transactionId, leaseId: { type: "string", minLength: 1 }, owner: { type: "string", minLength: 1 }, durationMs: { type: "integer", minimum: 1 } }, ["transactionId"]) },
  { name: "release_lease", description: "Release the caller's lease and expire the uncommitted transaction; takeover creates a fresh leased draft.", inputSchema: objectSchema({ transactionId, leaseId: { type: "string", minLength: 1 }, owner: { type: "string", minLength: 1 } }, ["transactionId"]) },
  { name: "takeover_transaction", description: "Create a fresh leased draft for an expired transaction; the expired record remains immutable audit history.", inputSchema: objectSchema({ transactionId, baseRevision: revision, agentId: { type: "string", minLength: 1 }, owner: { type: "string", minLength: 1 } }, ["transactionId"]) },
  { name: "recover_transaction", description: "Resolve a COMMITTING or RECOVERY_REQUIRED record from the durable revision head.", inputSchema: objectSchema({ transactionId }, ["transactionId"]) },
  { name: "resolve_conflict", description: "Explicitly discard a conflicted transaction; rebasing requires a new preview.", inputSchema: objectSchema({ transactionId, action: { type: "string", const: "rollback" } }, ["transactionId", "action"]) },
  { name: "get_revision", description: "Read the durable revision head and its committed transaction/hash anchor.", inputSchema: objectSchema() },
  { name: "get_audit_events", description: "Read the append-only durable transaction audit sequence.", inputSchema: objectSchema() },
  { name: "preview_changes", description: "Preview semantic FormSpec/project changes inside a transaction. The returned transactionId and candidateHash must be approved before commit.", inputSchema: objectSchema({ expectedRevision: revision, transactionId, operations }, ["expectedRevision", "operations"]) },
  { name: "approve_transaction", description: "Approve one exact preview hash after validation. Approval is required before apply_changes.", inputSchema: objectSchema({ expectedRevision: revision, transactionId, expectedCandidateHash: candidateHash, requireValid: { type: "boolean" } }, ["expectedRevision", "transactionId", "expectedCandidateHash"]) },
  { name: "apply_changes", description: "Commit only an approved transaction; direct mutation without a preview and matching hash is rejected.", inputSchema: objectSchema({ expectedRevision: revision, transactionId, expectedCandidateHash: candidateHash, reason: { type: "string" }, requireValid: { type: "boolean" } }, ["expectedRevision", "transactionId", "expectedCandidateHash"]) },
  { name: "rollback_transaction", description: "Roll back an uncommitted draft transaction and retain its audit record.", inputSchema: objectSchema({ transactionId }, ["transactionId"]) },
  { name: "compare_revision", description: "Compare two revisions still retained by the bounded history window.", inputSchema: objectSchema({ fromRevision: revision, toRevision: revision }, ["fromRevision", "toRevision"]) },
  { name: "get_transaction_history", description: "Return redacted persistent transaction and revision audit entries.", inputSchema: objectSchema() },
  { name: "get_evidence_pack", description: "Return the persistent evidence pack recorded for the current committed revision, if one exists.", inputSchema: objectSchema() },
  { name: "validate_project", description: "Run protocol, schema, data, trust and capacity quality checks.", inputSchema: objectSchema() },
  { name: "set_locale", description: "Set the active print locale from the supported five-language profile and invalidate prior review evidence.", inputSchema: objectSchema({ expectedRevision: revision, locale }, ["expectedRevision", "locale"]) },
  { name: "set_asset_source", description: "Replace one declarative image asset slot in the isolated draft and revalidate it.", inputSchema: objectSchema({ expectedRevision: revision, slot: { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, source: { type: "string", minLength: 1 } }, ["expectedRevision", "slot", "source"]) },
  { name: "set_sample_scenario", description: "Replace sample rows with a generated boundary scenario.", inputSchema: objectSchema({ expectedRevision: revision, scenario: { type: "string", enum: ["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"] } }, ["expectedRevision", "scenario"]) },
  { name: "undo_revision", description: "Undo the latest draft revision.", inputSchema: objectSchema({ expectedRevision: revision }, ["expectedRevision"]) },
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
