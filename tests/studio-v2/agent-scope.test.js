import { describe, expect, it } from "vitest";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { createAgentContext } from "../../studio-v2/core/agent-context.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function bus() {
  return new CommandBus(createSalesInvoiceProject(), { dataPolicy: classifySyntheticDocument("scope-fixture") });
}

describe("Agent scope boundary", () => {
  it("rejects malformed or incomplete scopes instead of broadening to the document", () => {
    expect(() => createAgentContext({ scope: { kind: "unsupported" } })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: {} })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: { kind: "" } })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: { kind: "table" } })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: { kind: "component" } })).toThrowError(/outside the active Agent scope/);
  });

  it("returns a safe error when a host supplies an invalid scope", async () => {
    const result = await executeAgentCommand(bus(), "get_project_summary", {}, { scope: { kind: "unsupported" } });
    expect(result).toEqual({ ok: false, error: { code: "SCOPE_VIOLATION", message: "Command failed" } });
  });
});
