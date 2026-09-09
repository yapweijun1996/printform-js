import { spawn } from "node:child_process";
import readline from "node:readline";
import { describe, expect, it } from "vitest";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";

function startServer() {
  const child = spawn(process.execPath, ["mcp/server.mjs"], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const lines = readline.createInterface({ input: child.stdout });
  const queue = [];
  const waiters = [];
  lines.on("line", (line) => {
    const value = JSON.parse(line);
    const waiter = waiters.shift();
    if (waiter) waiter(value); else queue.push(value);
  });
  return {
    child,
    send(message) { child.stdin.write(`${JSON.stringify(message)}\n`); },
    receive() { return queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve) => waiters.push(resolve)); },
    close() { child.stdin.end(); lines.close(); }
  };
}

describe("printform-studio-mcp stdio contract", () => {
  it("initializes without advertising business tools before CDP admission", async () => {
    const server = startServer();
    try {
      server.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
      const initialized = await server.receive();
      expect(initialized.result.serverInfo.name).toBe("printform-studio-mcp");
      server.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      const tools = await server.receive();
      expect(tools.error).toMatchObject({ code: -32001, data: { code: expect.any(String) } });
      expect(tools.result).toBeUndefined();
      expect(TOOL_CONTRACTS).toHaveLength(35);
    } finally { server.close(); }
  });
});
