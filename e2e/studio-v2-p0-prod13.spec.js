import { expect, test } from "@playwright/test";
import { admitPublicGateway } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY = "UNKNOWN-CANARY-20260908";

test("PROD-13 13-01 classifies an imported canary before persistence and fails closed without host policy", async ({ page, request }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const fixture = await request.get("/studio-v2/samples/sales-invoice-v2.html");
  expect(fixture.ok()).toBe(true);
  const importedHtml = (await fixture.text()).replace("Example Business Sdn. Bhd.", CANARY);
  expect(importedHtml).toContain(CANARY);
  const before = await readClientStorage(page);

  await page.locator("#import-file").setInputFiles({
    name: "unknown-canary.html", mimeType: "text/html", buffer: Buffer.from(importedHtml)
  });
  await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据|restrictive|kandungan tidak diketahui|不明なデータ|dữ liệu không xác định/i);
  await admitPublicGateway(page);

  const result = await page.evaluate(async () => {
    const run = (name, input = {}) => window.PrintFormStudioAgent.execute(name, input);
    const summary = await run("get_project_summary");
    const inspect = await run("inspect_document");
    const preview = await run("preview_changes", {
      expectedRevision: summary.result.revision,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });
    const pixels = await run("capture_layout_evidence", {
      expectedRevision: summary.result.revision, scenario: "default", visualMode: "pixels"
    });

    const { CommandBus } = await import("/studio-v2/core/command-bus.js");
    const { installAgentGateway } = await import("/studio-v2/adapters/gateway.js");
    const { installWebMcpAdapter } = await import("/studio-v2/adapters/webmcp.js");
    const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
    const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
    const unconfiguredBus = new CommandBus(createSalesInvoiceProject(), {
      dataPolicy: classifySyntheticDocument("adapter-fixture")
    });
    const unconfiguredGateway = installAgentGateway(unconfiguredBus, {});
    const tools = [];
    const unconfiguredWebMcp = installWebMcpAdapter(unconfiguredBus, {
      modelContext: { registerTool(tool) { tools.push(tool); } }
    });
    const gatewayCapabilities = await unconfiguredGateway.execute("get_capabilities");
    const gatewayPixels = await unconfiguredGateway.execute("capture_layout_evidence", {
      expectedRevision: 0, scenario: "default", visualMode: "pixels"
    });
    const webCapabilities = await tools.find((tool) => tool.name === "get_capabilities").execute();
    const webPixels = await tools.find((tool) => tool.name === "capture_layout_evidence").execute({
      expectedRevision: 0, scenario: "default", visualMode: "pixels"
    });
    unconfiguredWebMcp.dispose();
    return {
      summary, inspect, preview, pixels, gatewayCapabilities, gatewayPixels, webCapabilities, webPixels,
      payloads: JSON.stringify({ summary, inspect, preview, pixels })
    };
  });
  const after = await readClientStorage(page);

  expect(result.summary.ok).toBe(true);
  expect(result.preview.ok).toBe(true);
  expect(result.pixels.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
  expect(result.gatewayCapabilities.error.code).toBe("STALE_POLICY_CONTEXT");
  expect(result.gatewayPixels.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
  expect(result.webCapabilities.structuredContent.error.code).toBe("STALE_POLICY_CONTEXT");
  expect(result.webPixels.structuredContent.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
  expect(result.payloads).not.toContain(CANARY);
  expect(JSON.stringify(after)).not.toContain(CANARY);
  expect(after.local).toEqual(before.local);
  expect(after.session).toEqual(before.session);
  expect(after.databases).toEqual(before.databases);
  expect(JSON.stringify(after.cacheEntries)).not.toContain(CANARY);
  expect(after.cacheEntries.some(({ url }) => url.endsWith("/unknown-canary.html"))).toBe(false);
});
