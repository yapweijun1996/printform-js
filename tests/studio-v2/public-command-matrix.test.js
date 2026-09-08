// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { installAgentGateway } from "../../studio-v2/adapters/gateway.js";
import { createAgentContext, createPassthroughReferences } from "../../studio-v2/core/agent-context.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifyRealDocument, classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { hashRenderProject } from "../../studio-v2/core/render-provenance.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";
import { sanitizeAgentResponse } from "../../studio-v2/core/agent-sanitize.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { createRedactedLayoutSnapshot } from "../../studio-v2/ui/layout-snapshot.js";

const COMMANDS = TOOL_CONTRACTS.map((tool) => tool.name);
const CANARY = "BUSINESS CANARY 20260907";
const TRANSACTION_FIELDS = [
  "transaction_id", "form_id", "base_revision", "working_revision", "owner", "agent_id", "status", "state",
  "patches", "changes", "preview_hash", "candidate_content_hash", "candidate_form_spec_hash", "validation_result",
  "approval", "lease", "created_at", "updated_at", "previewed_at", "approved_at", "committed_at", "rolled_back_at",
  "expired_at", "commit_result", "evidence_pack_ref", "conflict", "supersedes_transaction_id"
];
const RESULT_FIELDS = {
  get_capabilities: ["protocolVersion", "contractVersion", "studioVersion", "capabilities", "tools", "sampleScenarios", "locales", "humanExportRequired", "completionPolicy"],
  get_project_summary: ["revision", "locale", "trust", "protocolVersion", "review", "validation"],
  inspect_document: ["revision", "blocks", "bindings"],
  get_form_spec: ["revision", "spec"],
  list_components: ["revision", "components"],
  get_component: ["revision", "component"],
  inspect_design_state: ["revision", "page", "typography", "branding", "tables", "repeatedAreas", "assets", "supportedOperations"],
  get_operation_catalog: ["revision", "operations"],
  get_transaction: ["transaction"],
  list_active_transactions: ["transactions"],
  get_revision: ["revision", "projectHash", "transactionId", "committedAt"],
  get_audit_events: ["events"],
  preview_changes: ["revision", "transactionId", "diff", "validation", "candidateHash"],
  apply_changes: ["revision", "already_committed", "committed_revision", "diff", "validation", "candidateHash", "transaction"],
  set_sample_scenario: ["revision", "already_committed", "committed_revision", "diff", "validation", "candidateHash", "transaction"],
  set_locale: ["revision", "already_committed", "committed_revision", "diff", "validation", "candidateHash", "transaction", "locale"],
  set_asset_source: ["revision", "already_committed", "committed_revision", "diff", "validation", "candidateHash", "transaction", "slot"],
  compare_revision: ["fromRevision", "toRevision", "diff"],
  get_transaction_history: ["revision", "entries", "transactions", "auditEvents"],
  get_evidence_pack: ["revision", "evidencePack", "anchor"],
  validate_project: ["revision", "validation"],
  undo_revision: ["changed", "revision"],
  get_layout_review_status: ["revision", "review", "checklist"],
  begin_layout_review: ["revision", "attempt", "checklist", "requiredScenarios", "metrics", "issues"],
  capture_layout_evidence: ["revision", "scenario", "evidence", "requiredScenarios", "capturedScenarios", "observation", "validation", "metrics", "pixelCapture"],
  complete_layout_review: ["revision", "review"],
  request_export: ["revision", "ready", "validation", "requiresUserConfirmation"]
};

function injectNestedCanaries(value) {
  if (Array.isArray(value)) return value.map(injectNestedCanaries);
  if (!value || typeof value !== "object") return value;
  return { ...Object.fromEntries(Object.entries(value).map(([key, item]) => [key, injectNestedCanaries(item)])), nestedCanary: CANARY };
}

for (const name of ["begin_transaction", "renew_lease", "release_lease", "takeover_transaction", "recover_transaction", "resolve_conflict", "rollback_transaction", "approve_transaction"]) {
  RESULT_FIELDS[name] = TRANSACTION_FIELDS;
}

function readyReport(overrides = {}) {
  const report = {
    status: "ready",
    validation: { valid: true, productionValid: true, errors: [], warnings: [] },
    metrics: { logicalPages: 1, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 },
    pageGeometry: [{ width: 794, height: 1123, children: [{ x: 0, y: 0, width: 794, height: 160 }] }],
    issues: [],
    pixelSnapshot: { source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: "image/png", dataUrl: "data:image/png;base64,AAAA", width: 794, height: 1123, pageCount: 1 },
    ...overrides
  };
  return { ...report, safeSnapshot: createRedactedLayoutSnapshot(report) };
}

function createHarness({ renderCandidate = null } = {}) {
  const policy = classifySyntheticDocument(`matrix-${Math.random().toString(36).slice(2)}`);
  const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy, renderCandidate });
  let uiSessionFactory;
  const gateway = installAgentGateway(bus, {}, {
    getDataPolicy: () => policy,
    getApplyMode: () => "auto",
    sessionId: "matrix-session",
    onUiSessionFactory: (factory) => { uiSessionFactory = factory; }
  });
  return { bus, gateway, uiGateway: uiSessionFactory("matrix-ui-session") };
}

function assertSafeResponse(name, response, invoked) {
  invoked.add(name);
  expect(response).toEqual(expect.objectContaining({ ok: expect.any(Boolean) }));
  if (!response.ok) {
    expect(response.error).toEqual(expect.objectContaining({ code: expect.any(String), message: "Command failed" }));
    expect(Object.keys(response.error)).not.toContain("stack");
  }
  expect(JSON.stringify(response)).not.toContain(CANARY);
  return response;
}

function assertResultShape(name, response) {
  expect(response.ok).toBe(true);
  const allowed = new Set(RESULT_FIELDS[name]);
  expect(allowed, `${name} must have a test oracle`).not.toEqual(new Set());
  expect(Object.keys(response.result).every((key) => allowed.has(key))).toBe(true);
}

async function run(gateway, invoked, name, input = {}, human = false, approvalGateway = gateway) {
  const response = await (human ? approvalGateway.executeHuman(name, input) : gateway.execute(name, input));
  assertSafeResponse(name, response, invoked);
  if (response.ok) assertResultShape(name, response);
  return response;
}

describe("Studio v2 public command matrix", () => {
  it("keeps all 35 registered commands behind one safe envelope", async () => {
    expect(COMMANDS).toHaveLength(35);
    const { gateway } = createHarness();
    const invoked = new Set();
    expect(gateway.listTools().map((tool) => tool.name)).toEqual(COMMANDS);
    for (const name of COMMANDS) await run(gateway, invoked, name);
    const unknown = await gateway.execute("not-a-public-command", {});
    assertSafeResponse("not-a-public-command", unknown, invoked);
    expect(unknown.error.code).toBe("UNKNOWN_TOOL");
    expect([...invoked].filter((name) => COMMANDS.includes(name))).toEqual(COMMANDS);
  });

  it("projects every public command without real-data canaries", async () => {
    const policy = classifyRealDocument("real-command-matrix");
    const project = createSalesInvoiceProject();
    project.manifest.title = CANARY;
    project.sampleData.invoiceNumber = CANARY;
    const bus = new CommandBus(project, { dataPolicy: policy });
    const gateway = installAgentGateway(bus, {}, { getDataPolicy: () => policy, getApplyMode: () => "auto" });
    const invoked = new Set();

    for (const name of COMMANDS) {
      const response = await gateway.execute(name, {});
      assertSafeResponse(name, response, invoked);
      expect(JSON.stringify(response), name).not.toContain(CANARY);
    }
    expect(invoked).toEqual(new Set(COMMANDS));
  });

  it("proves successful command shapes, opaque reference round-trips and transaction outcomes", async () => {
    const { bus, gateway } = createHarness();
    const invoked = new Set();
    for (const name of ["get_capabilities", "get_project_summary", "inspect_document", "get_form_spec", "list_components", "inspect_design_state", "get_operation_catalog", "list_active_transactions", "get_revision", "get_audit_events", "get_transaction_history", "get_evidence_pack", "validate_project", "get_layout_review_status", "request_export"]) {
      await run(gateway, invoked, name);
    }
    const components = await run(gateway, invoked, "list_components");
    const component = await run(gateway, invoked, "get_component", { componentId: components.result.components[0].id });
    expect(component.result.component.id).toMatch(/^ref:component:/);

    const started = await run(gateway, invoked, "begin_transaction", { baseRevision: 0, agentId: CANARY, owner: "studio-ui" });
    const transactionId = started.result.transaction_id;
    const leaseId = started.result.lease.lease_id;
    const owner = started.result.lease.owner;
    await run(gateway, invoked, "get_transaction", { transactionId });
    await run(gateway, invoked, "renew_lease", { transactionId, leaseId, owner, durationMs: 1000 });
    await run(gateway, invoked, "recover_transaction", { transactionId });
    await run(gateway, invoked, "resolve_conflict", { transactionId, action: "rollback" });

    const preview = await run(gateway, invoked, "preview_changes", {
      expectedRevision: 0, transactionId, operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });
    const approved = await run(gateway, invoked, "approve_transaction", {
      expectedRevision: 0, transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash, requireValid: true
    });
    expect(approved.result.transaction_id).toMatch(/^ref:transaction:/);
    const applied = await run(gateway, invoked, "apply_changes", {
      expectedRevision: 0, transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash, reason: "matrix commit", requireValid: true
    });
    expect(applied.result.revision).toBe(1);
    const repeated = await run(gateway, invoked, "apply_changes", {
      expectedRevision: 0, transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash, reason: "matrix duplicate", requireValid: true
    });
    expect(repeated.result.already_committed).toBe(true);
    await run(gateway, invoked, "compare_revision", { fromRevision: 0, toRevision: 1 });
    await run(gateway, invoked, "get_revision");
    await run(gateway, invoked, "get_audit_events");
    await run(gateway, invoked, "get_transaction_history");

    const released = await run(gateway, invoked, "begin_transaction", { baseRevision: 1, agentId: CANARY, owner: CANARY });
    const releasedId = released.result.transaction_id;
    await run(gateway, invoked, "release_lease", { transactionId: releasedId, leaseId: released.result.lease.lease_id, owner: released.result.lease.owner });
    const takeover = await run(gateway, invoked, "takeover_transaction", { transactionId: releasedId, baseRevision: 1, agentId: CANARY, owner: CANARY });
    const takeoverId = takeover.result.transaction_id;
    await run(gateway, invoked, "recover_transaction", { transactionId: takeoverId });
    await run(gateway, invoked, "release_lease", { transactionId: takeoverId, leaseId: takeover.result.lease.lease_id, owner: takeover.result.lease.owner });
    await run(gateway, invoked, "rollback_transaction", { transactionId: takeoverId });
    expect(bus.revision).toBe(1);
    expect([...invoked]).toEqual(expect.arrayContaining([
      "get_capabilities", "get_project_summary", "inspect_document", "get_form_spec", "list_components", "get_component",
      "inspect_design_state", "get_operation_catalog", "list_active_transactions", "get_revision", "get_audit_events",
      "get_transaction_history", "get_evidence_pack", "validate_project", "get_layout_review_status", "request_export",
      "begin_transaction", "get_transaction", "renew_lease", "recover_transaction", "resolve_conflict", "preview_changes",
      "approve_transaction", "apply_changes", "compare_revision", "release_lease", "takeover_transaction", "rollback_transaction"
    ]));
  });

  it("covers no-op and human-approved document mutations plus both layout capture variants", async () => {
    const direct = createHarness();
    const invoked = new Set();
    const noOp = await run(direct.gateway, invoked, "set_sample_scenario", { expectedRevision: 0, scenario: "default" }, true, direct.uiGateway);
    expect(noOp.result.diff.changed).toBe(false);
    const locale = await run(direct.gateway, invoked, "set_locale", { expectedRevision: 0, locale: "zh-CN" }, true, direct.uiGateway);
    const asset = await run(direct.gateway, invoked, "set_asset_source", { expectedRevision: locale.result.revision, slot: "letterhead-logo", source: "data:image/png;base64,AAAA" }, true, direct.uiGateway);
    const scenario = await run(direct.gateway, invoked, "set_sample_scenario", { expectedRevision: asset.result.revision, scenario: "one" }, true, direct.uiGateway);
    const undo = await run(direct.gateway, invoked, "undo_revision", { expectedRevision: scenario.result.revision }, true, direct.uiGateway);
    expect(undo.result.changed).toBe(true);

    const review = createHarness({ renderCandidate: async (_candidate, _revision, options) => readyReport({ visualMode: options.visualMode }) });
    const projectHash = await hashRenderProject(review.bus.project);
    review.bus.recordRenderReport(readyReport(), { revision: 0, candidateHash: projectHash, baseProjectHash: projectHash, source: "committed" });
    await run(review.gateway, invoked, "begin_layout_review", { expectedRevision: 0 });
    const defaultEvidence = await run(review.gateway, invoked, "capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "geometry" });
    const pixelEvidence = await run(review.gateway, invoked, "capture_layout_evidence", { expectedRevision: 0, scenario: "long-text", visualMode: "pixels" });
    expect(defaultEvidence.result.evidence.visualMode).toBe("geometry");
    expect(pixelEvidence.result.evidence.visualMode).toBe("pixels");
    const completed = await run(review.gateway, invoked, "complete_layout_review", {
      expectedRevision: 0, reviewer: "ai-agent", evidenceIds: [defaultEvidence.result.evidence.evidenceId, pixelEvidence.result.evidence.evidenceId], findings: [], summary: "Controlled matrix review"
    });
    expect(completed.result.review.status).toBe("pass");
    const ready = await run(review.gateway, invoked, "request_export");
    expect(ready.result).toMatchObject({ ready: true, requiresUserConfirmation: true });
    expect([...invoked]).toEqual(expect.arrayContaining([
      "set_sample_scenario", "set_locale", "set_asset_source", "undo_revision",
      "begin_layout_review", "capture_layout_evidence", "complete_layout_review", "request_export"
    ]));
  });

  it("returns safe error fields for malformed operations and rejects a stale revision", async () => {
    const { gateway, uiGateway } = createHarness();
    const invoked = new Set();
    const malformed = await run(gateway, invoked, "preview_changes", { expectedRevision: 0, operations: [{ type: "raw_html" }] });
    expect(malformed.error.code).toBe("AGENT_OPERATION_NOT_ALLOWED");
    const stale = await run(gateway, invoked, "set_locale", { expectedRevision: 99, locale: "zh-CN" });
    expect(stale.error.code).toBe("HUMAN_APPROVAL_REQUIRED");
    const approvedStale = await run(gateway, invoked, "set_locale", { expectedRevision: 99, locale: "zh-CN" }, true, uiGateway);
    expect(approvedStale.error.code).toBe("REVISION_CONFLICT");
    expect(approvedStale.error).toMatchObject({ expectedRevision: 99, actualRevision: 0 });
  });

  it("drops recursive unknown fields from every public success and error variant", async () => {
    const { bus, gateway } = createHarness();
    const context = createAgentContext({ dataPolicy: bus.dataPolicy, sessionId: "projection-canary", references: createPassthroughReferences() });
    for (const name of COMMANDS) {
      const response = await gateway.execute(name, {});
      const poisoned = response.ok
        ? { ok: true, result: injectNestedCanaries(response.result) }
        : { ok: false, error: injectNestedCanaries(response.error) };
      const projected = sanitizeAgentResponse(name, poisoned, { context });
      expect(JSON.stringify(projected), name).not.toContain(CANARY);
      expect(JSON.stringify(projected), name).not.toContain("nestedCanary");
      expect(projected.ok).toBe(response.ok);
    }
  });

  it("keeps null and malformed JSON inputs safe for every public command", async () => {
    const { gateway } = createHarness();
    for (const name of COMMANDS) {
      const nullInput = await gateway.execute(name, null);
      assertSafeResponse(name, nullInput, new Set());
      const malformedJson = await gateway.execute(name, "{malformed-json");
      assertSafeResponse(name, malformedJson, new Set());
      expect(malformedJson.error.code).toBe("INVALID_INPUT_JSON");
    }
  });
});
