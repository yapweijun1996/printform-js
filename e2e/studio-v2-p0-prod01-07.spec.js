import { expect, test } from "@playwright/test";
import { CdpStudioClient } from "../mcp/cdp-client.mjs";
import { admitPublicGateway } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

function summarize(result) {
  return {
    ok: result?.ok === true,
    code: result?.error?.code || null,
    hasTransactionId: Boolean(result?.result?.transactionId),
    hasCandidateHash: Boolean(result?.result?.candidateHash),
  };
}

async function installParityHarness(page) {
  return page.evaluate(async () => {
    const { CommandBus } = await import("/studio-v2/core/command-bus.js");
    const { assertOperationsInScope } = await import("/studio-v2/core/agent-scope.js");
    const { installAgentGateway } = await import("/studio-v2/adapters/gateway.js");
    const { installWebMcpAdapter } = await import("/studio-v2/adapters/webmcp.js");
    const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
    const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");

    const policy = classifySyntheticDocument("p0-prod01-07-entry-parity");
    const project = createSalesInvoiceProject();
    let scope = { kind: "table", tableId: "default" };
    const baseOptions = {
      getDataPolicy: () => policy,
      getScopeContext: () => scope,
      getApplyMode: () => "preview",
      requireAdmission: true,
    };
    const bus = new CommandBus(project, { dataPolicy: policy });
    const originalGateway = window.PrintFormStudioAgent;
    const gateway = installAgentGateway(bus, window, {
      ...baseOptions,
      sessionId: "p0-prod01-07-embedded",
    });
    const webTools = [];
    const webAdapter = installWebMcpAdapter(bus, {
      modelContext: { registerTool(tool) { webTools.push(tool); } },
    }, {
      ...baseOptions,
      requireAdmission: false,
      sessionId: "p0-prod01-07-webmcp",
    });
    window.__p0Prod0107 = {
      bus,
      gateway,
      webTools,
      webAdapter,
      originalGateway,
      setScope(nextScope) { scope = nextScope; },
      assertOperationsInScope,
      project,
    };
    return { webToolNames: webTools.map((tool) => tool.name) };
  });
}

async function runCdpParity(page) {
  const transport = await page.context().newCDPSession(page);
  const client = new CdpStudioClient({ origins: ["http://127.0.0.1:4174"] });
  client.send = (method, params = {}) => transport.send(method, params);
  const allowedInput = {
    expectedRevision: 0,
    operations: [{ type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["12%", "43%", "11%", "16%", "18%"] }],
  };
  const forgedForbiddenInput = {
    expectedRevision: 0,
    scope: { kind: "document" },
    tableId: "default",
    componentId: "document-header-1",
    operations: [{ type: "set_brand_color", hex: "#854d0e" }],
  };
  try {
    const preview = await client.execute("preview_changes", allowedInput);
    const rollback = await client.execute("rollback_transaction", { transactionId: preview.result.transactionId });
    const forbidden = await client.execute("preview_changes", forgedForbiddenInput);
    const rawSource = await client.execute("preview_source_edit", { expectedRevision: 0, sourceHtml: "<p>blocked</p>" });
    const revision = await client.execute("get_revision");
    return {
      allowed: { preview: summarize(preview), rollback: summarize(rollback) },
      forbidden: summarize(forbidden),
      rawSource: summarize(rawSource),
      revision: revision.result.revision,
    };
  } finally {
    client.close();
    await transport.detach().catch(() => {});
  }
}

test.describe("Studio v2 PROD-01 01-07 adapter parity", () => {
  test("keeps host scope and raw-source restrictions across embedded, WebMCP, CDP and domain guard", async ({ page, browserName }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => browserName === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const harness = await installParityHarness(page);
    const admissionId = await admitPublicGateway(page);
    expect(admissionId).toMatch(/^admission:/);

    let browserResults;
    let cdpResults = null;
    try {
      browserResults = await page.evaluate(async () => {
        const control = window.__p0Prod0107;
        const allowedInput = {
          expectedRevision: 0,
          operations: [{ type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["12%", "43%", "11%", "16%", "18%"] }],
        };
        const forgedForbiddenInput = {
          expectedRevision: 0,
          scope: { kind: "document" },
          tableId: "default",
          componentId: "document-header-1",
          operations: [{ type: "set_brand_color", hex: "#854d0e" }],
        };
        const summarizeResult = (result) => ({
          ok: result?.ok === true,
          code: result?.error?.code || null,
          hasTransactionId: Boolean(result?.result?.transactionId),
          hasCandidateHash: Boolean(result?.result?.candidateHash),
        });
        const invokeEmbedded = (name, input) => control.gateway.execute(name, input);
        const invokeWebMcp = async (name, input) => {
          const tool = control.webTools.find((candidate) => candidate.name === name);
          if (!tool) return { ok: false, error: { code: "TOOL_NOT_REGISTERED" } };
          return (await tool.execute(input)).structuredContent;
        };
        async function run(invoke) {
          const preview = await invoke("preview_changes", allowedInput);
          const rollback = await invoke("rollback_transaction", { transactionId: preview.result.transactionId });
          const forbidden = await invoke("preview_changes", forgedForbiddenInput);
          return { allowed: { preview: summarizeResult(preview), rollback: summarizeResult(rollback) }, forbidden: summarizeResult(forbidden) };
        }
        const direct = {};
        try {
          control.assertOperationsInScope(control.project, allowedInput.operations, { kind: "table", tableId: "default" });
          direct.allowed = true;
        } catch (error) {
          direct.allowed = false;
          direct.allowedCode = error.code || null;
        }
        try {
          control.assertOperationsInScope(control.project, forgedForbiddenInput.operations, { kind: "table", tableId: "default" });
          direct.forbidden = { ok: true, code: null };
        } catch (error) {
          direct.forbidden = { ok: false, code: error.code || null };
        }
        const embedded = await run(invokeEmbedded);
        const webmcp = await run(invokeWebMcp);
        const rawSource = summarizeResult(await invokeEmbedded("preview_source_edit", { expectedRevision: 0, sourceHtml: "<p>blocked</p>" }));
        return {
          embedded,
          webmcp,
          rawSource,
          webmcpToolCount: control.webTools.length,
          webmcpHasRawSourceTool: control.webTools.some((tool) => tool.name === "preview_source_edit"),
          revision: control.bus.revision,
          transactionCount: control.bus.transactionStore.listTransactions().length,
          direct,
        };
      });
      if (browserName === "chromium") cdpResults = await runCdpParity(page);

      const entries = [browserResults.embedded, browserResults.webmcp];
      if (cdpResults) entries.push(cdpResults);
      expect(entries.every((entry) => entry.allowed.preview.ok && entry.allowed.preview.hasTransactionId)).toBe(true);
      expect(entries.every((entry) => entry.allowed.rollback.ok)).toBe(true);
      expect(entries.map((entry) => entry.forbidden.code)).toEqual(entries.map(() => "SCOPE_VIOLATION"));
      expect(entries.every((entry) => !entry.forbidden.ok)).toBe(true);
      expect(browserResults.rawSource.code).toBe("AGENT_RAW_SOURCE_BLOCKED");
      if (cdpResults) expect(cdpResults.rawSource.code).toBe("AGENT_RAW_SOURCE_BLOCKED");
      expect(browserResults.webmcpToolCount).toBe(35);
      expect(browserResults.webmcpHasRawSourceTool).toBe(false);
      expect(browserResults.direct).toEqual({ allowed: true, forbidden: { ok: false, code: "SCOPE_VIOLATION" } });
      expect(browserResults.revision).toBe(0);
      expect(browserResults.transactionCount).toBe(2);
      if (cdpResults) expect(cdpResults.revision).toBe(0);
      expect(browserErrors).toEqual([]);
      expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
      if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
        type: "known-browser-diagnostic",
        description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed.",
      });
    } finally {
      await page.evaluate(() => {
        const control = window.__p0Prod0107;
        control?.webAdapter.dispose();
        if (control?.originalGateway) Object.defineProperty(window, "PrintFormStudioAgent", { configurable: true, value: control.originalGateway });
        delete window.__p0Prod0107;
      });
    }
  });
});
