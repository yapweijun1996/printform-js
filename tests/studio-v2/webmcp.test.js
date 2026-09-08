import { describe, expect, it } from "vitest";
import { installWebMcpAdapter } from "../../studio-v2/adapters/webmcp.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { classifyRealDocument, classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";

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
    expect(tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))).toEqual(response.structuredContent.result.tools);
    adapter.dispose();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("disposes the old registration before a page replacement installs the shared catalog", () => {
    const registrations = [];
    const host = { modelContext: { registerTool(tool, options) { registrations.push({ tool, signal: options.signal }); } } };
    const first = installWebMcpAdapter(new CommandBus(createSalesInvoiceProject()), host);
    first.dispose();
    const replacement = installWebMcpAdapter(new CommandBus(createSalesInvoiceProject()), host);

    expect(registrations.slice(0, first.registered.length).every(({ signal }) => signal.aborted)).toBe(true);
    expect(replacement.registered).toEqual(TOOL_CONTRACTS.map((tool) => tool.name));
    replacement.dispose();
  });

  it("falls back to provideContext when registerTool is unavailable", async () => {
    const provided = [];
    const host = { modelContext: { provideContext(context) { provided.push(context); } } };
    const adapter = installWebMcpAdapter(new CommandBus(createSalesInvoiceProject()), host);
    expect(adapter.supported).toBe(true);
    expect(adapter.api).toBe("provideContext");
    expect(provided[0].tools.map((tool) => tool.name)).toContain("apply_changes");
    const response = await provided[0].tools.find((tool) => tool.name === "get_capabilities").execute();
    expect(response.structuredContent.result.protocolVersion).toBe("2.0.0");
    adapter.dispose();
    expect(provided.at(-1).tools).toHaveLength(0);
  });

  it("reports unsupported when no modelContext API exists", () => {
    const adapter = installWebMcpAdapter(new CommandBus(createSalesInvoiceProject()), { modelContext: {} });
    expect(adapter.supported).toBe(false);
    expect(adapter.registered).toHaveLength(0);
  });

  it("reuses restrictive policy and the shared human-approval boundary", async () => {
    const tools = [];
    const policy = classifyRealDocument("webmcp-real-doc");
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy });
    const adapter = installWebMcpAdapter(bus, { modelContext: { registerTool(tool) { tools.push(tool); } } }, {
      getDataPolicy: () => policy,
      getScopeContext: () => ({ kind: "document" }),
      getApplyMode: () => "auto",
      isRealData: () => true
    });
    const find = (name) => tools.find((tool) => tool.name === name);
    const pixels = await find("capture_layout_evidence").execute({ expectedRevision: 0, scenario: "default", visualMode: "pixels" });
    const locale = await find("set_locale").execute({ expectedRevision: 0, locale: "zh-CN" });

    expect(pixels.structuredContent.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
    expect(locale.structuredContent.error.code).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(bus.revision).toBe(0);
    adapter.dispose();
  });

  it("does not infer Synthetic from the CommandBus when host policy is missing", async () => {
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: classifySyntheticDocument("unconfigured-synthetic") });
    const tools = [];
    const adapter = installWebMcpAdapter(bus, { modelContext: { registerTool(tool) { tools.push(tool); } } });

    const capabilities = await tools.find((tool) => tool.name === "get_capabilities").execute();
    const pixels = await tools.find((tool) => tool.name === "capture_layout_evidence").execute({ expectedRevision: 0, scenario: "default", visualMode: "pixels" });

    expect(capabilities.structuredContent.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(pixels.structuredContent.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
    adapter.dispose();
  });

  it("rejects a WebMCP command after the host policy changes", async () => {
    const synthetic = classifySyntheticDocument("webmcp-mode-doc");
    const real = { ...classifyRealDocument("webmcp-mode-doc"), contextId: "webmcp-real-context" };
    let currentPolicy = synthetic;
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: synthetic });
    const tools = [];
    const adapter = installWebMcpAdapter(bus, { modelContext: { registerTool(tool) { tools.push(tool); } } }, {
      getDataPolicy: () => currentPolicy,
      getScopeContext: () => ({ kind: "document" }),
      getApplyMode: () => "auto"
    });
    const preview = await tools.find((tool) => tool.name === "preview_changes").execute({
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });
    currentPolicy = real;
    const stale = await tools.find((tool) => tool.name === "preview_changes").execute({
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });

    expect(preview.structuredContent.ok).toBe(true);
    expect(stale.structuredContent.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(bus.revision).toBe(0);
    adapter.dispose();
  });

  it("does not reuse a Synthetic policy when the host policy disappears", async () => {
    const synthetic = classifySyntheticDocument("webmcp-missing-policy-doc");
    let currentPolicy = synthetic;
    const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: synthetic });
    const tools = [];
    const adapter = installWebMcpAdapter(bus, { modelContext: { registerTool(tool) { tools.push(tool); } } }, {
      getDataPolicy: () => currentPolicy,
      getScopeContext: () => ({ kind: "document" }),
      getApplyMode: () => "auto"
    });
    const preview = await tools.find((tool) => tool.name === "preview_changes").execute({
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });
    currentPolicy = null;
    const stale = await tools.find((tool) => tool.name === "preview_changes").execute({
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });

    expect(preview.structuredContent.ok).toBe(true);
    expect(stale.structuredContent.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(bus.revision).toBe(0);
    adapter.dispose();
  });
});
