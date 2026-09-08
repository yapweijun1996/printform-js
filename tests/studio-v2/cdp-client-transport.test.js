import http from "node:http";
import { describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { CdpStudioClient } from "../../mcp/cdp-client.mjs";
import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "../../studio-v2/core/constants.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";

const catalog = () => TOOL_CONTRACTS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

async function createCdpFixture() {
  const state = { targetId: "page-1", catalog: catalog(), capabilities: 0, businessCalls: 0, connections: 0 };
  const httpServer = http.createServer((request, response) => {
    if (request.url !== "/json/list") { response.writeHead(404); response.end(); return; }
    const port = httpServer.address().port;
    const target = {
      id: state.targetId,
      type: "page",
      url: `http://127.0.0.1:${port}/studio-v2/`,
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${state.targetId}`
    };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify([target]));
  });
  const socketServer = new WebSocketServer({ server: httpServer });
  socketServer.on("connection", (socket) => {
    state.connections += 1;
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      const capabilities = message.params?.expression?.includes('"get_capabilities"');
      if (capabilities) state.capabilities += 1;
      else state.businessCalls += 1;
      const value = capabilities
        ? { ok: true, result: { protocolVersion: PROTOCOL_VERSION, contractVersion: AGENT_CONTRACT_VERSION, tools: state.catalog } }
        : { ok: true, result: { revision: 0 } };
      socket.send(JSON.stringify({ id: message.id, result: { result: { type: "object", value } } }));
    });
  });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const port = httpServer.address().port;
  return {
    cdpUrl: `http://127.0.0.1:${port}`,
    origin: `http://127.0.0.1:${port}`,
    state,
    replace(targetId, nextCatalog = catalog()) { state.targetId = targetId; state.catalog = nextCatalog; },
    async close() {
      socketServer.clients.forEach((socket) => socket.close());
      await new Promise((resolve) => socketServer.close(resolve));
      await new Promise((resolve) => httpServer.close(resolve));
    }
  };
}

describe("CDP transport admission", () => {
  it("reconnects and rechecks the contract when the page target is replaced", async () => {
    const fixture = await createCdpFixture();
    const client = new CdpStudioClient({ cdpUrl: fixture.cdpUrl, origins: [fixture.origin] });
    try {
      await expect(client.execute("get_project_summary")).resolves.toMatchObject({ ok: true });
      fixture.replace("page-2");
      await expect(client.execute("get_project_summary")).resolves.toMatchObject({ ok: true });
      expect(fixture.state.connections).toBe(2);
      expect(fixture.state.capabilities).toBe(2);
      expect(fixture.state.businessCalls).toBe(2);
    } finally {
      client.close();
      await fixture.close();
    }
  });

  it("rejects a replaced page with a different catalog before business work", async () => {
    const fixture = await createCdpFixture();
    const client = new CdpStudioClient({ cdpUrl: fixture.cdpUrl, origins: [fixture.origin] });
    try {
      await client.execute("get_project_summary");
      fixture.replace("page-2", fixture.state.catalog.slice(0, -1));
      await expect(client.execute("get_project_summary")).rejects.toMatchObject({ code: "AGENT_TOOL_CATALOG_MISMATCH" });
      expect(fixture.state.capabilities).toBe(2);
      expect(fixture.state.businessCalls).toBe(1);
    } finally {
      client.close();
      await fixture.close();
    }
  });
});
