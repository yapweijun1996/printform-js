// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { bindAgentSession, installAgentGateway } from "../../studio-v2/adapters/gateway.js";
import { classifyImportedDocument, classifyRealDocument, classifySyntheticDocument, createDataPolicy } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { sanitizeAgentResponse, sanitizeAgentResult } from "../../studio-v2/core/agent-sanitize.js";
import { buildProviderInput } from "../../studio-v2/ui/agent-provider.js";
import { AgentSessionManager } from "../../studio-v2/ui/agent-sessions.js";
import { inlineProjectAssets } from "../../studio-v2/core/assets.js";
import { createRedactedLayoutSnapshot } from "../../studio-v2/ui/layout-snapshot.js";
import { hashRenderProject } from "../../studio-v2/core/render-provenance.js";

afterEach(() => vi.restoreAllMocks());

function policyBus(policy, options = {}) {
  const values = new Map();
  const storage = options.storage || { getItem: vi.fn((key) => values.get(key) || null), setItem: vi.fn((key, value) => values.set(key, value)), removeItem: vi.fn((key) => values.delete(key)) };
  const bus = new CommandBus(createSalesInvoiceProject(), { transactionStorage: storage, dataPolicy: policy, renderCandidate: options.renderCandidate });
  const scope = {};
  let uiSessionFactory;
  const gateway = installAgentGateway(bus, scope, {
    getDataPolicy: () => policy,
    getScopeContext: () => options.scope || { kind: "document" },
    getApplyMode: () => options.applyMode || "auto",
    sessionId: "test-session",
    onUiSessionFactory: (factory) => { uiSessionFactory = factory; }
  });
  return { bus, gateway, uiGateway: uiSessionFactory("test-session"), storage };
}

describe("Studio v2 production boundary", () => {
  it("uses restrictive policy flags for unknown and real documents", () => {
    const unknown = classifyImportedDocument("imported");
    const real = classifyRealDocument("erp");
    const synthetic = classifySyntheticDocument("fixture");
    expect(unknown).toMatchObject({ classification: "unknown", allowDurable: false, allowRecovery: false, allowPersistentSessions: false, allowPixelEvidence: false });
    expect(real).toMatchObject({ classification: "real", allowExternalAssetFetch: false, allowProviderDocumentContext: false });
    expect(synthetic).toMatchObject({ classification: "synthetic", allowDurable: true, allowRecovery: true, allowPersistentSessions: true, allowPixelEvidence: true });
  });

  it("does not initialize durable storage for an unknown document", async () => {
    const { bus, gateway, storage } = policyBus(classifyImportedDocument("unknown-doc"));
    expect(bus.transactionStore.persistent).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    const capabilities = await gateway.execute("get_capabilities");
    expect(capabilities.result.capabilities.durableTransactions).toBe(false);
  });

  it("round-trips opaque transaction references through preview, approval and apply", async () => {
    const { bus, gateway } = policyBus(classifySyntheticDocument("fixture"));
    const preview = await gateway.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
    expect(preview.ok).toBe(true);
    expect(preview.result.transactionId).toMatch(/^ref:transaction:/);
    const approval = await gateway.execute("approve_transaction", { expectedRevision: 0, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, requireValid: true });
    expect(approval.ok).toBe(true);
    const applied = await gateway.execute("apply_changes", { expectedRevision: 0, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, requireValid: true, reason: "synthetic boundary test" });
    expect(applied).toMatchObject({ ok: true, result: { revision: 1 } });
    expect(JSON.stringify(applied)).not.toContain(bus.transactionStore.listTransactions()[0].transaction_id);
  });

  it("round-trips opaque evidence references through layout review", async () => {
    const report = {
      status: "ready",
      validation: { errors: [], warnings: [] },
      metrics: { logicalPages: 1, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 },
      pageGeometry: [{ width: 794, height: 1123, children: [] }]
    };
    const scoped = policyBus(classifySyntheticDocument("fixture"), {
      renderCandidate: async () => ({ ...report, safeSnapshot: createRedactedLayoutSnapshot(report) })
    });
    const captured = await scoped.gateway.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "default" });
    const longText = await scoped.gateway.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "long-text" });
    const evidenceIds = [captured.result.evidence.evidenceId, longText.result.evidence.evidenceId];
    expect(evidenceIds.every((value) => value.startsWith("ref:evidence:"))).toBe(true);
    const projectHash = await hashRenderProject(scoped.bus.project);
    scoped.bus.recordRenderReport(report, { revision: 0, candidateHash: projectHash, baseProjectHash: projectHash, source: "committed" });
    await scoped.gateway.execute("begin_layout_review", { expectedRevision: 0 });
    const completed = await scoped.gateway.execute("complete_layout_review", {
      expectedRevision: 0, reviewer: "ai-agent", evidenceIds, findings: [], summary: "opaque evidence boundary test"
    });
    expect(completed).toMatchObject({ ok: true, result: { review: { status: "pass" } } });
  });

  it("enforces scope and explicit human approval at the domain boundary", async () => {
    const scoped = policyBus(classifySyntheticDocument("fixture"), { scope: { kind: "theme" } });
    const outOfScope = await scoped.gateway.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_column_widths", tableSelector: ".prowheader", widths: ["10%"] }] });
    expect(outOfScope.error.code).toBe("SCOPE_VIOLATION");

    const previewOnly = policyBus(classifySyntheticDocument("fixture"), { applyMode: "preview" });
    const preview = await previewOnly.gateway.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
    const blocked = await previewOnly.gateway.execute("approve_transaction", { expectedRevision: 0, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, requireValid: true });
    expect(blocked.error.code).toBe("HUMAN_APPROVAL_REQUIRED");
    const approved = await previewOnly.uiGateway.executeHuman("approve_transaction", { expectedRevision: 0, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, requireValid: true });
    expect(approved.ok).toBe(true);
  });

  it("fails closed for ambiguous table scopes and component-shaped global pagination flags", async () => {
    const ambiguous = policyBus(classifySyntheticDocument("fixture"), { scope: { kind: "table" } });
    const ambiguousResult = await ambiguous.gateway.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["10%"] }]
    });
    expect(ambiguousResult.error.code).toBe("SCOPE_VIOLATION");

    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: classifySyntheticDocument("fixture") });
    const component = (await bus.execute("list_components")).result.components.find((item) => item.role === "table-header");
    const scoped = policyBus(classifySyntheticDocument("fixture"), { scope: { kind: "component", componentId: component.id } });
    const result = await scoped.gateway.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_pagination_rule", componentId: component.id, rule: "repeatHeader", value: false }]
    });
    expect(result.error.code).toBe("SCOPE_VIOLATION");
  });

  it("binds policy context and opaque references to the document identity", async () => {
    const policyA = createDataPolicy({ classification: "synthetic", documentId: "doc-a", context: "shared-context" });
    const policyB = createDataPolicy({ classification: "synthetic", documentId: "doc-b", context: "shared-context" });
    let currentPolicy = policyA;
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policyA });
    const gateway = installAgentGateway(bus, {}, {
      getDataPolicy: () => currentPolicy,
      getApplyMode: () => "auto"
    });
    const preview = await gateway.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
    expect(preview.ok).toBe(true);
    currentPolicy = policyB;
    const stale = await gateway.execute("approve_transaction", {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true
    });
    expect(stale.error.code).toBe("REFERENCE_NOT_FOUND");
    expect(bus.revision).toBe(0);
  });

  it("rejects commands from an old gateway after the host policy changes", async () => {
    const synthetic = classifySyntheticDocument("mode-switch-doc");
    const real = classifyRealDocument("mode-switch-doc");
    let currentPolicy = synthetic;
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: synthetic });
    const gateway = installAgentGateway(bus, {}, {
      getDataPolicy: () => currentPolicy,
      getApplyMode: () => "auto"
    });

    currentPolicy = real;
    const stale = await gateway.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });

    expect(stale.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(bus.revision).toBe(0);
    expect(bus.transactionStore.listTransactions()).toHaveLength(0);
  });

  it("does not persist a delayed preview after the policy changes", async () => {
    const synthetic = classifySyntheticDocument("delayed-mode-doc");
    const real = classifyRealDocument("delayed-mode-doc");
    let currentPolicy = synthetic;
    let releaseRender;
    let renderStarted;
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    const bus = new CommandBus(createSalesInvoiceProject(), {
      transactionStorage: storage,
      dataPolicy: synthetic,
      renderCandidate: async () => {
        renderStarted();
        await new Promise((resolve) => { releaseRender = resolve; });
        return { status: "ready", validation: { valid: true, productionValid: true, errors: [], warnings: [] }, issues: [], metrics: {} };
      }
    });
    const gateway = installAgentGateway(bus, {}, { getDataPolicy: () => currentPolicy, getApplyMode: () => "auto" });
    const started = new Promise((resolve) => { renderStarted = resolve; });
    const pending = gateway.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });

    await started;
    const writesBeforeSwitch = storage.setItem.mock.calls.length;
    currentPolicy = real;
    releaseRender();
    const stale = await pending;

    expect(stale.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(storage.setItem.mock.calls.length).toBe(writesBeforeSwitch);
    expect(bus.revision).toBe(0);
  });

  it("binds references and transaction permission to the Agent session", async () => {
    const policy = classifySyntheticDocument("session-bound-doc");
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy });
    const gateway = installAgentGateway(bus, {}, { getDataPolicy: () => policy, getApplyMode: () => "auto" });
    const sessionA = bindAgentSession(gateway, "session-a");
    const sessionB = bindAgentSession(gateway, "session-b");
    const preview = await sessionA.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
    await sessionB.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_font_scale", basePt: 10 }] });
    const sameSession = await sessionA.execute("approve_transaction", {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true
    });
    expect(sameSession.ok).toBe(true);

    const missingReference = await sessionB.execute("approve_transaction", {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true
    });
    expect(missingReference.error.code).toBe("REFERENCE_NOT_FOUND");

    const rawTransactionId = bus.transactionStore.listTransactions().find((item) => item.changes?.some((operation) => operation.type === "set_brand_color")).transaction_id;
    const rawBypass = await sessionB.execute("approve_transaction", {
      expectedRevision: 0,
      transactionId: rawTransactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true
    });
    expect(rawBypass.error.code).toBe("STALE_POLICY_CONTEXT");
  });

  it("rebuilds safe output without raw project fields or error messages", () => {
    const summary = sanitizeAgentResult("get_project_summary", { revision: 0, title: "BUSINESS CANARY", locale: "en-MY", trust: "trusted", protocolVersion: "2.0.0", review: { status: "required" }, validation: { valid: true, productionValid: true, errors: [], warnings: [] } });
    expect(summary).not.toHaveProperty("title");
    const undo = sanitizeAgentResult("undo_revision", { changed: true, revision: 1, project: { secret: "BUSINESS CANARY" } });
    expect(undo).toEqual({ changed: true, revision: 1 });
    const error = sanitizeAgentResponse("preview_changes", { ok: false, error: { code: "REVISION_CONFLICT", message: "raw business error", secret: "BUSINESS CANARY" } });
    expect(error).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT", message: "Command failed" } });
    expect(JSON.stringify(error)).not.toContain("BUSINESS CANARY");
  });

  it("blocks pixel Provider parts for restrictive policy and permits redacted geometry", () => {
    const profile = { provider: "openai", model: "test", apiKey: "canary-key", apiVariant: "responses" };
    const pixel = { type: "image", url: "data:image/png;base64,AAAA", mimeType: "image/png", filename: "layout.png", source: "sandbox-pixel", syntheticData: true, redacted: false };
    const geometry = { type: "image", url: "data:image/svg+xml;base64,PHN2Zy8+", mimeType: "image/svg+xml", filename: "layout.svg", source: "geometry-only", redacted: true };
    expect(() => buildProviderInput(profile, "review", [pixel], { dataPolicy: classifyRealDocument() })).toThrowError(/Pixel evidence/);
    expect(buildProviderInput(profile, "review", [geometry], { dataPolicy: classifyRealDocument() }).parts).toHaveLength(1);
    expect(() => buildProviderInput(profile, "review", [{ ...geometry, source: undefined }], { dataPolicy: classifyRealDocument() })).toThrowError(/provenance/);
    expect(() => buildProviderInput(profile, "review", [{ ...geometry, secret: "BUSINESS CANARY" }])).toThrowError(/unknown field/);
  });

  it("keeps Unknown sessions memory-only and blocks imported asset fetches", async () => {
    const policy = classifyImportedDocument("unknown-doc");
    const manager = new AgentSessionManager({ dataPolicy: policy });
    await expect(manager.index()).rejects.toMatchObject({ code: "DATA_POLICY_STORAGE_BLOCKED" });
    const created = await manager.create("canary");
    expect(await manager.list()).toEqual([expect.objectContaining({ id: created.id, label: "canary" })]);
    const project = createSalesInvoiceProject();
    project.themeCss += ".asset{background:url(https://example.invalid/canary.png)}";
    await expect(inlineProjectAssets(project, "https://example.invalid/", { dataPolicy: policy })).rejects.toMatchObject({ code: "ASSET_FETCH_POLICY_BLOCKED" });
  });

  it("applies one human-approval boundary to direct document mutations", async () => {
    const scoped = policyBus(classifySyntheticDocument("direct-mutation-doc"));
    const commands = [
      ["set_locale", { expectedRevision: 0, locale: "zh-CN" }],
      ["set_asset_source", { expectedRevision: 0, slot: "letterhead-logo", source: "data:image/png;base64,AAAA" }],
      ["set_sample_scenario", { expectedRevision: 0, scenario: "one" }],
      ["undo_revision", { expectedRevision: 0 }],
    ];
    for (const [name, input] of commands) {
      const blocked = await scoped.gateway.execute(name, input);
      expect(blocked.error.code).toBe("HUMAN_APPROVAL_REQUIRED");
    }
    expect(scoped.bus.revision).toBe(0);
    expect(scoped.bus.transactionStore.listTransactions()).toHaveLength(0);
    const approved = await scoped.uiGateway.executeHuman("set_locale", { expectedRevision: 0, locale: "zh-CN" });
    expect(approved).toMatchObject({ ok: true, result: { revision: 1, locale: "zh-CN" } });
  });

  it("keeps human approval off the public gateway and bound Agent sessions", async () => {
    const scoped = policyBus(classifySyntheticDocument("human-capability-doc"));
    const bound = bindAgentSession(scoped.gateway, "external-session");
    expect(scoped.gateway).not.toHaveProperty("executeHuman");
    expect(bound).not.toHaveProperty("executeHuman");
    expect(scoped.uiGateway).toHaveProperty("executeHuman");
  });

  it("keeps direct mutations document-scoped", async () => {
    const scoped = policyBus(classifySyntheticDocument("direct-scope-doc"), { scope: { kind: "theme" } });
    const result = await scoped.gateway.execute("set_locale", { expectedRevision: 0, locale: "zh-CN" });
    expect(result.error.code).toBe("SCOPE_VIOLATION");
    expect(scoped.bus.revision).toBe(0);
  });
});
