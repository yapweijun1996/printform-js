const objectSchema = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const revision = { type: "integer", minimum: 0 };

export const TOOL_CONTRACTS = Object.freeze([
  { name: "get_capabilities", description: "Return the Studio protocol, command contract and safety capabilities.", inputSchema: objectSchema() },
  { name: "get_project_summary", description: "Return document metadata, trust state, revision and validation summary without business row values.", inputSchema: objectSchema() },
  { name: "inspect_document", description: "Inspect template structure and declarative bindings without returning sample values.", inputSchema: objectSchema() },
  { name: "preview_changes", description: "Dry-run an atomic semantic change set against an expected revision.", inputSchema: objectSchema({ expectedRevision: revision, operations: { type: "array", minItems: 1, items: { type: "object" } } }, ["expectedRevision", "operations"]) },
  { name: "apply_changes", description: "Atomically commit a semantic change set to the isolated draft.", inputSchema: objectSchema({ expectedRevision: revision, operations: { type: "array", minItems: 1, items: { type: "object" } }, reason: { type: "string" } }, ["expectedRevision", "operations"]) },
  { name: "validate_project", description: "Run protocol, schema, data, trust and capacity quality checks.", inputSchema: objectSchema() },
  { name: "set_sample_scenario", description: "Replace sample rows with a generated boundary scenario.", inputSchema: objectSchema({ expectedRevision: revision, scenario: { type: "string", enum: ["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"] } }, ["expectedRevision", "scenario"]) },
  { name: "undo_revision", description: "Undo the latest draft revision.", inputSchema: objectSchema({ expectedRevision: revision }, ["expectedRevision"]) },
  { name: "preview_source_edit", description: "Dry-run a gated raw section replacement without committing it.", inputSchema: objectSchema({ expectedRevision: revision, section: { type: "string", enum: ["manifest", "schema", "theme", "template", "sampleData"] }, content: { type: "string" } }, ["expectedRevision", "section", "content"]) },
  { name: "request_export", description: "Check export readiness. Final production export always requires a human UI confirmation.", inputSchema: objectSchema() }
]);
