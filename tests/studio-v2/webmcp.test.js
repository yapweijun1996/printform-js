import { describe, expect, it } from "vitest";
import { installWebMcpAdapter } from "../../studio-v2/adapters/webmcp.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("WebMCP adapter", () => {
  it("registers the shared command contracts and disposes them together", async () => {
    const tools = [];
    const signals = [];
    const doc = { modelContext: { registerTool(tool, options) { tools.push(tool); signals.push(options.signal); } } };
    const adapter = installWebMcpAdapter(new CommandBus(createSalesInvoiceProject()), doc);
    expect(adapter.supported).toBe(true);
    expect(tools.map((tool) => tool.name)).toContain("get_capabilities");
    const response = await tools.find((tool) => tool.name === "get_capabilities").execute();
    expect(response.structuredContent.result.protocolVersion).toBe("2.0.0");
    adapter.dispose();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
