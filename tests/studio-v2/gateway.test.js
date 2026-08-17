import { describe, it, expect } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { executeAgentCommand, installAgentGateway } from "../../studio-v2/adapters/gateway.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("installAgentGateway JSON input handling", () => {
  it("resolves the uniform {ok:false, error} shape for malformed JSON input instead of rejecting", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const scope = {};
    const gateway = installAgentGateway(bus, scope);
    const result = await gateway.execute("get_project_summary", "{not valid json");
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID_INPUT_JSON");
  });

  it("still executes normally for a valid JSON string input", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const scope = {};
    const gateway = installAgentGateway(bus, scope);
    const result = await gateway.execute("get_project_summary", "{}");
    expect(result.ok).toBe(true);
    expect(result.result.revision).toBe(0);
  });

  it("still executes normally for an object input (no JSON parsing involved)", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const scope = {};
    const gateway = installAgentGateway(bus, scope);
    const result = await gateway.execute("get_project_summary", {});
    expect(result.ok).toBe(true);
  });

  it("exposes the gateway on the given global scope as PrintFormStudioAgent", () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const scope = {};
    installAgentGateway(bus, scope);
    expect(scope.PrintFormStudioAgent).toBeDefined();
    expect(typeof scope.PrintFormStudioAgent.execute).toBe("function");
  });

  it("rejects pixel evidence before rendering when the session is real-data", async () => {
    let rendered = false;
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate: async () => { rendered = true; return { status: "ready" }; } });
    const result = await executeAgentCommand(bus, "capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "pixels" }, { realData: true });
    expect(result).toMatchObject({ ok: false, error: { code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY" } });
    expect(rendered).toBe(false);
    expect(bus.revision).toBe(0);
  });

  it("blocks raw source and non-semantic operations at the Agent gateway", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const raw = await executeAgentCommand(bus, "preview_source_edit", { expectedRevision: 0, section: "template", content: "<div>raw</div>" });
    expect(raw.error.code).toBe("AGENT_RAW_SOURCE_BLOCKED");
    const arbitrary = await executeAgentCommand(bus, "preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "replace_template", value: "<div>raw</div>" }]
    });
    expect(arbitrary.error.code).toBe("AGENT_OPERATION_NOT_ALLOWED");
    expect(bus.revision).toBe(0);
  });
});
