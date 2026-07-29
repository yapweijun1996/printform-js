#!/usr/bin/env node
import readline from "node:readline";
import { CdpStudioClient, DEFAULT_ORIGINS } from "./cdp-client.mjs";
import { TOOL_CONTRACTS } from "../studio-v2/core/tool-contracts.js";

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const cdpUrl = readOption("--cdp-url", process.env.PRINTFORM_CDP_URL || "http://127.0.0.1:9222");
const extraOrigin = readOption("--studio-origin", process.env.PRINTFORM_STUDIO_ORIGIN || "");
const origins = extraOrigin ? [...DEFAULT_ORIGINS, extraOrigin] : DEFAULT_ORIGINS;
const client = new CdpStudioClient({ cdpUrl, origins });

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function success(id, result) { write({ jsonrpc: "2.0", id, result }); }
function failure(id, code, message, data) { write({ jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } }); }

async function handle(request) {
  const { id, method, params = {} } = request;
  if (method === "initialize") {
    return success(id, {
      protocolVersion: params.protocolVersion || "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "printform-studio-mcp", version: "1.0.0" },
      instructions: "Connects only to an isolated Chrome tab whose URL contains /studio-v2/. Production export still requires a human click."
    });
  }
  if (method === "ping") return success(id, {});
  if (method === "tools/list") {
    return success(id, { tools: TOOL_CONTRACTS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })) });
  }
  if (method === "tools/call") {
    const tool = TOOL_CONTRACTS.find((candidate) => candidate.name === params.name);
    if (!tool) return failure(id, -32602, `Unknown tool: ${params.name}`);
    try {
      const response = await client.execute(params.name, params.arguments || {});
      return success(id, {
        content: [{ type: "text", text: JSON.stringify(response) }],
        structuredContent: response,
        isError: !response?.ok
      });
    } catch (error) {
      return success(id, { content: [{ type: "text", text: error.message }], isError: true });
    }
  }
  if (method?.startsWith("notifications/")) return;
  failure(id, -32601, `Method not found: ${method}`);
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  if (!line.trim()) return;
  try { Promise.resolve(handle(JSON.parse(line))).catch((error) => console.error(error)); }
  catch (error) { failure(null, -32700, "Parse error", error.message); }
});
input.on("close", () => { client.close(); process.exit(0); });
process.on("SIGINT", () => { client.close(); process.exit(0); });
