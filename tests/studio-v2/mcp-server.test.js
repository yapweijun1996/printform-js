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
  it("initializes and lists the shared Studio tools without opening CDP", async () => {
    const server = startServer();
    try {
      server.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
      const initialized = await server.receive();
      expect(initialized.result.serverInfo.name).toBe("printform-studio-mcp");
      server.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      const tools = await server.receive();
      expect(tools.result.tools.map((tool) => tool.name)).toContain("preview_changes");
      expect(tools.result.tools.map((tool) => tool.name)).toContain("request_export");
      // Derived, not hardcoded: the CDP bridge must expose exactly the shared
      // contract, so adding a tool there should never need an edit here.
      expect(tools.result.tools).toHaveLength(TOOL_CONTRACTS.length);
    } finally { server.close(); }
  });
});
