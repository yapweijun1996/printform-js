import { describe, expect, it } from "vitest";
import { installAgentGateway } from "../../studio-v2/adapters/gateway.js";
import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "../../studio-v2/core/constants.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

const catalog = () => TOOL_CONTRACTS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
const compatible = () => ({ protocolVersion: PROTOCOL_VERSION, contractVersion: AGENT_CONTRACT_VERSION, tools: catalog() });

function createGateway() {
  const bus = new CommandBus(createSalesInvoiceProject());
  return installAgentGateway(bus, {}, { requireAdmission: true });
}

describe("public Agent gateway admission", () => {
  it("allows capabilities before admission but rejects business commands", async () => {
    const gateway = createGateway();
    expect((await gateway.execute("get_capabilities")).ok).toBe(true);
    expect(await gateway.execute("get_project_summary")).toMatchObject({ ok: false, error: { code: "CLIENT_NOT_ADMITTED" } });
  });

  it("admits an exact compatible catalog and binds the token to the gateway session", async () => {
    const gateway = createGateway();
    const admission = gateway.admitClient(compatible());
    expect(admission).toMatchObject({ ok: true, result: { admissionId: expect.stringMatching(/^admission:/) } });
    const allowed = await gateway.execute("get_project_summary", {}, admission.result.admissionId);
    expect(allowed.ok).toBe(true);
    const replacement = gateway.admitClient(compatible());
    expect((await gateway.execute("get_project_summary", {}, admission.result.admissionId)).error.code).toBe("CLIENT_ADMISSION_INVALID");
    expect((await gateway.execute("get_project_summary", {}, replacement.result.admissionId)).ok).toBe(true);
  });

  it.each([
    ["protocolVersion", "STUDIO_PROTOCOL_VERSION_MISMATCH"],
    ["contractVersion", "AGENT_CONTRACT_VERSION_MISMATCH"],
  ])("rejects a mismatched %s before issuing an admission", (field, code) => {
    const gateway = createGateway();
    const request = compatible();
    request[field] = "9.9.9";
    expect(gateway.admitClient(request)).toMatchObject({ ok: false, error: { code } });
  });

  it("rejects a changed catalog without exposing the accepted catalog", () => {
    const gateway = createGateway();
    const request = compatible();
    request.tools = request.tools.slice(0, -1);
    const result = gateway.admitClient(request);
    expect(result).toMatchObject({ ok: false, error: { code: "AGENT_TOOL_CATALOG_MISMATCH", message: "Command failed" } });
    expect(JSON.stringify(result)).not.toContain("get_project_summary");
  });
});
