import { describe, expect, it, vi } from "vitest";
import { CdpStudioClient } from "../../mcp/cdp-client.mjs";
import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "../../studio-v2/core/constants.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";

function clientWith(response, options = {}) {
  const client = new CdpStudioClient(options);
  client.evaluateGateway = vi.fn(async () => response);
  client.evaluateAdmission = vi.fn(async () => ({ ok: true, result: { admissionId: "admission:test" } }));
  return client;
}

const compatible = {
  ok: true,
  result: {
    protocolVersion: PROTOCOL_VERSION,
    contractVersion: AGENT_CONTRACT_VERSION,
    tools: TOOL_CONTRACTS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
  }
};

describe("first-party CDP compatibility admission", () => {
  it("admits a page only when Protocol and Agent Contract versions match", async () => {
    const client = clientWith(compatible);
    await client.ensureContract();
    await client.ensureContract();
    expect(client.contractChecked).toBe(true);
    expect(client.evaluateGateway).toHaveBeenCalledOnce();
    expect(client.evaluateAdmission).toHaveBeenCalledOnce();
    expect(client.admissionId).toBe("admission:test");
  });

  it("rechecks the catalog after the client is closed for a reconnect", async () => {
    const client = clientWith(compatible);
    await client.ensureContract();
    client.close();
    await client.ensureContract();
    expect(client.evaluateGateway).toHaveBeenCalledTimes(2);
    expect(client.evaluateAdmission).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight admission across concurrent business calls", async () => {
    const client = clientWith(compatible);
    const results = await Promise.all([
      client.execute("get_project_summary"),
      client.execute("get_project_summary"),
    ]);

    expect(results).toHaveLength(2);
    expect(client.evaluateGateway).toHaveBeenCalledTimes(3);
    expect(client.evaluateAdmission).toHaveBeenCalledOnce();
  });

  it("rejects a Protocol mismatch before any business command", async () => {
    const client = clientWith({ ok: true, result: { protocolVersion: "9.0.0", contractVersion: AGENT_CONTRACT_VERSION } });
    await expect(client.execute("get_project_summary")).rejects.toMatchObject({ code: "STUDIO_PROTOCOL_VERSION_MISMATCH" });
    expect(client.evaluateGateway).toHaveBeenCalledWith("get_capabilities", {});
    expect(client.evaluateGateway).toHaveBeenCalledOnce();
    expect(client.evaluateAdmission).not.toHaveBeenCalled();
  });

  it("rejects an Agent Contract mismatch before any business command", async () => {
    const client = clientWith({ ok: true, result: { protocolVersion: PROTOCOL_VERSION, contractVersion: "3.0.0" } });
    await expect(client.execute("get_project_summary")).rejects.toMatchObject({ code: "AGENT_CONTRACT_VERSION_MISMATCH" });
    expect(client.evaluateGateway).toHaveBeenCalledOnce();
    expect(client.evaluateAdmission).not.toHaveBeenCalled();
  });

  it("rejects a tool catalog mismatch before any business command", async () => {
    const response = structuredClone(compatible);
    response.result.tools = response.result.tools.slice(0, -1);
    const client = clientWith(response);
    await expect(client.execute("get_project_summary")).rejects.toMatchObject({ code: "AGENT_TOOL_CATALOG_MISMATCH" });
    expect(client.evaluateGateway).toHaveBeenCalledWith("get_capabilities", {});
    expect(client.evaluateGateway).toHaveBeenCalledOnce();
    expect(client.evaluateAdmission).not.toHaveBeenCalled();
  });

  it("rejects a page that exposes no admission method", async () => {
    const client = clientWith(compatible);
    client.evaluateAdmission.mockResolvedValue({ ok: false, error: { code: "CLIENT_ADMISSION_UNAVAILABLE" } });
    await expect(client.execute("get_project_summary")).rejects.toMatchObject({ code: "CLIENT_ADMISSION_UNAVAILABLE" });
  });
});
