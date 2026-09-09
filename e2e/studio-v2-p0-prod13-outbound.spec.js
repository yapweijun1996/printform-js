import { expect, test } from "@playwright/test";
import { CdpStudioClient } from "../mcp/cdp-client.mjs";
import { admitPublicGateway } from "./studio-v2-helpers.js";

const CANARY = "REAL-OUTBOUND-CANARY-20260908";

async function installRealEntryHarness(page) {
  return page.evaluate(async (canary) => {
    const { CommandBus } = await import("/studio-v2/core/command-bus.js");
    const { installAgentGateway } = await import("/studio-v2/adapters/gateway.js");
    const { installWebMcpAdapter } = await import("/studio-v2/adapters/webmcp.js");
    const { classifyRealDocument } = await import("/studio-v2/core/data-policy.js");
    const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
    const { createRedactedLayoutSnapshot } = await import("/studio-v2/ui/layout-snapshot.js");
    const policy = classifyRealDocument("browser-outbound-document");
    const project = createSalesInvoiceProject();
    project.manifest.title = canary;
    project.sampleData.invoiceNumber = canary;
    project.sampleData.customer.name = canary;
    const renderReport = {
      status: "ready",
      validation: { valid: true, productionValid: true, errors: [], warnings: [] },
      metrics: { logicalPages: 1, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 },
      pageGeometry: [{ width: 794, height: 1123, children: [{ x: 0, y: 0, width: 794, height: 160 }] }],
      issues: []
    };
    const bus = new CommandBus(project, {
      dataPolicy: policy,
      renderCandidate: async () => ({ ...renderReport, safeSnapshot: createRedactedLayoutSnapshot(renderReport) })
    });
    const options = {
      getDataPolicy: () => policy,
      getScopeContext: () => ({ kind: "document" }),
      getApplyMode: () => "preview",
      requireAdmission: true,
      isRealData: () => true
    };
    const gateway = installAgentGateway(bus, {}, options);
    const webTools = [];
    const webAdapter = installWebMcpAdapter(bus, { modelContext: { registerTool(tool) { webTools.push(tool); } } }, options);
    const originalGateway = window.PrintFormStudioAgent;
    Object.defineProperty(window, "PrintFormStudioAgent", { configurable: true, value: gateway });
    window.__p0OutboundHarness = { originalGateway, webAdapter, webTools };
    return { webToolNames: webTools.map((tool) => tool.name) };
  }, CANARY);
}

async function runDiagnostics(invoke) {
  const started = await invoke("begin_transaction", { baseRevision: 0, agentId: "real-agent", owner: "real-owner" });
  expect(started.ok).toBe(true);
  const transactionId = started.result.transaction_id;
  const listed = await invoke("list_components");
  const componentId = listed.result.components[0]?.id;
  const names = [
    ["capabilities", "get_capabilities"], ["summary", "get_project_summary"], ["inspection", "inspect_document"],
    ["formSpec", "get_form_spec"], ["components", "list_components"], ["component", "get_component", { componentId }],
    ["design", "inspect_design_state"], ["catalog", "get_operation_catalog"], ["transaction", "get_transaction", { transactionId }],
    ["active", "list_active_transactions"], ["revision", "get_revision"], ["audit", "get_audit_events"],
    ["compare", "compare_revision", { fromRevision: 0, toRevision: 0 }], ["history", "get_transaction_history"],
    ["evidencePack", "get_evidence_pack"], ["validation", "validate_project"], ["review", "get_layout_review_status"],
    ["geometry", "capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "geometry" }]
  ];
  const outputs = { started, listed };
  for (const [key, name, input = {}] of names) outputs[key] = await invoke(name, input);
  outputs.pixels = await invoke("capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "pixels", synthetic: true });
  return outputs;
}

test("PROD-13 13-06 keeps Real outbound diagnostics closed across embedded, WebMCP and CDP", async ({ page, browserName }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const harness = await installRealEntryHarness(page);
  await admitPublicGateway(page);
  expect(harness.webToolNames).toContain("get_project_summary");
  const browserOutputs = await page.evaluate(async () => {
    async function run(invoke) {
      const started = await invoke("begin_transaction", { baseRevision: 0, agentId: "real-agent", owner: "real-owner" });
      const transactionId = started.result.transaction_id;
      const listed = await invoke("list_components");
      const componentId = listed.result.components[0]?.id;
      const calls = [
        ["capabilities", "get_capabilities"], ["summary", "get_project_summary"], ["inspection", "inspect_document"],
        ["formSpec", "get_form_spec"], ["components", "list_components"], ["component", "get_component", { componentId }],
        ["design", "inspect_design_state"], ["catalog", "get_operation_catalog"], ["transaction", "get_transaction", { transactionId }],
        ["active", "list_active_transactions"], ["revision", "get_revision"], ["audit", "get_audit_events"],
        ["compare", "compare_revision", { fromRevision: 0, toRevision: 0 }], ["history", "get_transaction_history"],
        ["evidencePack", "get_evidence_pack"], ["validation", "validate_project"], ["review", "get_layout_review_status"],
        ["geometry", "capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "geometry" }]
      ];
      const outputs = { started, listed };
      for (const [key, name, input = {}] of calls) outputs[key] = await invoke(name, input);
      outputs.pixels = await invoke("capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "pixels", synthetic: true });
      return outputs;
    }
    const embedded = await run((name, input) => window.PrintFormStudioAgent.execute(name, input));
    const web = await run(async (name, input) => {
      const tool = window.__p0OutboundHarness.webTools.find((candidate) => candidate.name === name);
      return (await tool.execute(input)).structuredContent;
    });
    return { embedded, web };
  });
  const outputs = [browserOutputs.embedded, browserOutputs.web];
  for (const output of outputs) {
    expect(JSON.stringify(output)).not.toContain(CANARY);
    expect(output.geometry.result.evidence).toMatchObject({ visualMode: "geometry", snapshot: { source: "geometry-only", redacted: true } });
    expect(output.pixels).toMatchObject({ ok: false, error: { code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY" } });
  }

  if (browserName === "chromium") {
    const cdpTransport = await page.context().newCDPSession(page);
    const client = new CdpStudioClient({ origins: ["http://127.0.0.1:4174"] });
    client.send = (method, params = {}) => cdpTransport.send(method, params);
    try {
      const cdpOutput = await runDiagnostics((name, input) => client.execute(name, input));
      expect(JSON.stringify(cdpOutput)).not.toContain(CANARY);
      expect(cdpOutput.geometry.result.evidence).toMatchObject({ visualMode: "geometry", snapshot: { source: "geometry-only", redacted: true } });
      expect(cdpOutput.pixels).toMatchObject({ ok: false, error: { code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY" } });
    } finally {
      client.close();
      await cdpTransport.detach().catch(() => {});
    }
  }
  await page.evaluate(() => {
    const harness = window.__p0OutboundHarness;
    harness?.webAdapter.dispose();
    if (harness?.originalGateway) Object.defineProperty(window, "PrintFormStudioAgent", { configurable: true, value: harness.originalGateway });
    delete window.__p0OutboundHarness;
  });
});
