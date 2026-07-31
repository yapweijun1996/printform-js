import { describe, it, expect } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { installAgentGateway } from "../../studio-v2/adapters/gateway.js";
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
});
