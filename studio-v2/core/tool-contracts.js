const objectSchema = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const revision = { type: "integer", minimum: 0 };
const locale = { type: "string", enum: ["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"] };
const stringList = { type: "array", minItems: 1, items: { type: "string" } };

export const TOOL_CONTRACTS = Object.freeze([
  { name: "get_capabilities", description: "Return the Studio protocol, command contract and safety capabilities.", inputSchema: objectSchema() },
  { name: "get_project_summary", description: "Return document metadata, trust state, revision and validation summary without business row values.", inputSchema: objectSchema() },
  { name: "inspect_document", description: "Inspect template structure and declarative bindings without returning sample values.", inputSchema: objectSchema() },
  { name: "preview_changes", description: "Dry-run an atomic semantic change set against an expected revision. When a real browser preview is available (see get_capabilities().capabilities.candidateRealRender), the returned validation reflects REAL pagination for the candidate, not just schema checks, and the response carries a candidateHash.", inputSchema: objectSchema({ expectedRevision: revision, operations: { type: "array", minItems: 1, items: { type: "object" } } }, ["expectedRevision", "operations"]) },
  { name: "apply_changes", description: "Atomically commit a semantic change set to the isolated draft. If the same operations were just passed to preview_changes against this revision, the cached real render report is reused (its candidateHash is echoed back); otherwise a real render still happens inline before commit when candidateRealRender is available.", inputSchema: objectSchema({ expectedRevision: revision, operations: { type: "array", minItems: 1, items: { type: "object" } }, reason: { type: "string" } }, ["expectedRevision", "operations"]) },
  { name: "validate_project", description: "Run protocol, schema, data, trust and capacity quality checks.", inputSchema: objectSchema() },
  { name: "set_locale", description: "Set the active print locale from the supported five-language profile and invalidate prior review evidence.", inputSchema: objectSchema({ expectedRevision: revision, locale }, ["expectedRevision", "locale"]) },
  { name: "set_asset_source", description: "Replace one declarative image asset slot in the isolated draft and revalidate it.", inputSchema: objectSchema({ expectedRevision: revision, slot: { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, source: { type: "string", minLength: 1 } }, ["expectedRevision", "slot", "source"]) },
  { name: "set_sample_scenario", description: "Replace sample rows with a generated boundary scenario.", inputSchema: objectSchema({ expectedRevision: revision, scenario: { type: "string", enum: ["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"] } }, ["expectedRevision", "scenario"]) },
  { name: "undo_revision", description: "Undo the latest draft revision.", inputSchema: objectSchema({ expectedRevision: revision }, ["expectedRevision"]) },
  { name: "preview_source_edit", description: "Dry-run a gated raw section replacement without committing it.", inputSchema: objectSchema({ expectedRevision: revision, section: { type: "string", enum: ["manifest", "schema", "i18n", "theme", "template", "sampleData"] }, content: { type: "string" } }, ["expectedRevision", "section", "content"]) },
  { name: "get_layout_review_status", description: "Return the mandatory print-engineer review checklist and current revision-bound status.", inputSchema: objectSchema() },
  { name: "begin_layout_review", description: "Start one of at most three visual review passes for the current rendered revision.", inputSchema: objectSchema({ expectedRevision: revision }, ["expectedRevision"]) },
  { name: "complete_layout_review", description: "Submit AI full-page review evidence; open major or critical issues block completion.", inputSchema: objectSchema({
    expectedRevision: revision,
    reviewer: { type: "string", const: "ai-agent" },
    browser: { type: "string", minLength: 1 },
    scenarios: stringList,
    evidence: stringList,
    findings: { type: "array", items: objectSchema({ code: { type: "string" }, severity: { type: "string", enum: ["minor", "major", "critical"] }, status: { type: "string", enum: ["fixed", "accepted", "open"] }, message: { type: "string" } }, ["code", "severity", "status", "message"]) },
    summary: { type: "string", minLength: 1 }
  }, ["expectedRevision", "reviewer", "browser", "scenarios", "evidence", "findings", "summary"]) },
  { name: "request_export", description: "Check export readiness. Final production export always requires a human UI confirmation.", inputSchema: objectSchema() }
]);
