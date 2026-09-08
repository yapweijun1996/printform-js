import { expect, test } from "@playwright/test";

test("WebMCP rejects a command when the current host policy disappears", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

  const result = await page.evaluate(async () => {
    const { CommandBus } = await import("/studio-v2/core/command-bus.js");
    const { installWebMcpAdapter } = await import("/studio-v2/adapters/webmcp.js");
    const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
    const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
    const policy = classifySyntheticDocument("browser-webmcp-policy");
    let currentPolicy = policy;
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy });
    const tools = [];
    const adapter = installWebMcpAdapter(bus, { modelContext: { registerTool(tool) { tools.push(tool); } } }, {
      getDataPolicy: () => currentPolicy,
      getScopeContext: () => ({ kind: "document" }),
      getApplyMode: () => "auto"
    });
    const run = (name, input) => tools.find((tool) => tool.name === name).execute(input);
    const preview = await run("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
    currentPolicy = null;
    const stale = await run("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
    adapter.dispose();
    return { preview: preview.structuredContent, stale: stale.structuredContent, revision: bus.revision };
  });

  expect(result.preview.ok).toBe(true);
  expect(result.stale.error.code).toBe("STALE_POLICY_CONTEXT");
  expect(result.revision).toBe(0);
});
