import { describe, expect, it } from "vitest";
import { CdpStudioClient } from "../../mcp/cdp-client.mjs";
import { installAgentGateway } from "../../studio-v2/adapters/gateway.js";
import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "../../studio-v2/core/constants.js";
import { installWebMcpAdapter } from "../../studio-v2/adapters/webmcp.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifyRealDocument, classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { createRedactedLayoutSnapshot } from "../../studio-v2/ui/layout-snapshot.js";

const PREVIEW_INPUT = {
  expectedRevision: 0,
  operations: [{ type: "set_brand_color", hex: "#854d0e" }]
};

function createEntryHarness({ scope = { kind: "document" }, applyMode = "auto", renderCandidate, policy = classifySyntheticDocument("entry-parity-doc") } = {}) {
  let currentPolicy = policy;
  let currentScope = scope;
  let currentApplyMode = applyMode;
  const bus = new CommandBus(createSalesInvoiceProject(), {
    dataPolicy: currentPolicy,
    renderCandidate
  });
  const page = {};
  const gateway = installAgentGateway(bus, page, {
    getDataPolicy: () => currentPolicy,
    getScopeContext: () => currentScope,
    getApplyMode: () => currentApplyMode,
    sessionId: "embedded-entry-parity"
  });
  const tools = [];
  const adapter = installWebMcpAdapter(bus, {
    modelContext: { registerTool(tool) { tools.push(tool); } }
  }, {
    getDataPolicy: () => currentPolicy,
    getScopeContext: () => currentScope,
    getApplyMode: () => currentApplyMode,
    isRealData: () => currentPolicy.classification === "real",
    sessionId: "webmcp-entry-parity"
  });
  const cdp = new CdpStudioClient();
  cdp.evaluateGateway = (name, input) => gateway.execute(name, input);
  cdp.evaluateAdmission = () => gateway.admitClient({
    protocolVersion: PROTOCOL_VERSION,
    contractVersion: AGENT_CONTRACT_VERSION,
    tools: TOOL_CONTRACTS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
  });

  return {
    bus,
    gateway,
    cdp,
    tool(name) { return tools.find((tool) => tool.name === name); },
    setPolicy(policy) { currentPolicy = policy; },
    setScope(nextScope) { currentScope = nextScope; },
    setApplyMode(nextMode) { currentApplyMode = nextMode; },
    dispose() { adapter.dispose(); }
  };
}

describe("Studio v2 Agent entry parity", () => {
  it("keeps scope and apply decisions identical across embedded, WebMCP and CDP", async () => {
    const scoped = createEntryHarness({ scope: { kind: "theme" }, applyMode: "preview" });
    const outOfScopeInput = {
      expectedRevision: 0,
      operations: [{ type: "set_column_widths", tableSelector: ".prowheader", widths: ["10%"] }]
    };
    const scopeResults = await Promise.all([
      scoped.gateway.execute("preview_changes", outOfScopeInput),
      scoped.tool("preview_changes").execute(outOfScopeInput),
      scoped.cdp.execute("preview_changes", outOfScopeInput)
    ]);
    expect(scopeResults.map((result) => result.structuredContent?.error.code || result.error.code)).toEqual([
      "SCOPE_VIOLATION",
      "SCOPE_VIOLATION",
      "SCOPE_VIOLATION"
    ]);

    scoped.setScope({ kind: "document" });
    const mutationInput = { expectedRevision: 0, locale: "zh-CN" };
    const applyResults = await Promise.all([
      scoped.gateway.execute("set_locale", mutationInput),
      scoped.tool("set_locale").execute(mutationInput),
      scoped.cdp.execute("set_locale", mutationInput)
    ]);
    expect(applyResults.map((result) => result.structuredContent?.error.code || result.error.code)).toEqual([
      "HUMAN_APPROVAL_REQUIRED",
      "HUMAN_APPROVAL_REQUIRED",
      "HUMAN_APPROVAL_REQUIRED"
    ]);
    expect(scoped.bus.revision).toBe(0);
    expect(scoped.bus.transactionStore.listTransactions()).toHaveLength(0);
    scoped.dispose();
  });

  it("keeps opaque references within the embedded session while CDP forwards that same session", async () => {
    const entries = createEntryHarness();
    const preview = await entries.gateway.execute("preview_changes", PREVIEW_INPUT);
    expect(preview.result.transactionId).toMatch(/^ref:transaction:/);

    const approvedThroughCdp = await entries.cdp.execute("approve_transaction", {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true
    });
    expect(approvedThroughCdp.ok).toBe(true);

    const crossedSession = await entries.tool("approve_transaction").execute({
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true
    });
    expect(crossedSession.structuredContent.error.code).toBe("REFERENCE_NOT_FOUND");
    expect(entries.bus.revision).toBe(0);
    entries.dispose();
  });

  it("rejects delayed results from all entries after a policy transition", async () => {
    let releaseRender;
    let markStarted;
    let renderCount = 0;
    const started = new Promise((resolve) => { markStarted = resolve; });
    const renderGate = new Promise((resolve) => { releaseRender = resolve; });
    const entries = createEntryHarness({
      renderCandidate: async () => {
        renderCount += 1;
        if (renderCount === 3) markStarted();
        await renderGate;
        return { status: "ready", validation: { valid: true, productionValid: true, errors: [], warnings: [] }, issues: [], metrics: {} };
      }
    });
    const pending = [
      entries.gateway.execute("preview_changes", PREVIEW_INPUT),
      entries.tool("preview_changes").execute(PREVIEW_INPUT).then((result) => result.structuredContent),
      entries.cdp.execute("preview_changes", PREVIEW_INPUT)
    ];

    await started;
    entries.setPolicy(classifyRealDocument("entry-parity-doc"));
    releaseRender();
    const results = await Promise.all(pending);

    expect(results.map((result) => result.error.code)).toEqual([
      "STALE_POLICY_CONTEXT",
      "STALE_POLICY_CONTEXT",
      "STALE_POLICY_CONTEXT"
    ]);
    expect(entries.bus.revision).toBe(0);
    expect(entries.bus.transactionStore.listTransactions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "draft", preview_hash: null, committed_at: null })
      ])
    );
    expect(entries.bus.transactionStore.listTransactions().every((transaction) => transaction.status === "draft")).toBe(true);
    entries.dispose();
  });

  it("keeps real-data diagnostics and geometry safe across every entry point", async () => {
    const canary = "REAL-ENTRY-CANARY-20260908";
    const report = {
      status: "ready",
      validation: { valid: true, productionValid: true, errors: [], warnings: [] },
      metrics: { logicalPages: 1, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 },
      pageGeometry: [{ width: 794, height: 1123, children: [{ x: 0, y: 0, width: 794, height: 160 }] }],
      issues: []
    };
    const entries = createEntryHarness({
      policy: classifyRealDocument("entry-real-doc"),
      renderCandidate: async () => ({ ...report, safeSnapshot: createRedactedLayoutSnapshot(report) })
    });
    const paths = [
      (name, input) => entries.gateway.execute(name, input),
      async (name, input) => (await entries.tool(name).execute(input)).structuredContent,
      (name, input) => entries.cdp.execute(name, input)
    ];

    for (const invoke of paths) {
      const started = await invoke("begin_transaction", { baseRevision: 0, agentId: canary, owner: canary });
      expect(started.ok).toBe(true);
      const diagnostics = await Promise.all([
        invoke("get_project_summary"),
        invoke("validate_project"),
        invoke("get_transaction", { transactionId: started.result.transaction_id }),
        invoke("get_audit_events"),
        invoke("get_transaction_history"),
        invoke("get_evidence_pack"),
        invoke("capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "geometry", synthetic: true })
      ]);
      diagnostics.forEach((result) => {
        expect(result.ok).toBe(true);
        expect(JSON.stringify(result)).not.toContain(canary);
      });
      expect(diagnostics.at(-1).result.evidence.visualMode).toBe("geometry");
      expect(diagnostics.at(-1).result.evidence.snapshot).toMatchObject({ source: "geometry-only", redacted: true });

      const pixels = await invoke("capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "pixels", synthetic: true });
      expect(pixels).toMatchObject({ ok: false, error: { code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY" } });
      expect(JSON.stringify(pixels)).not.toContain(canary);
    }
    entries.dispose();
  });
});
