#!/usr/bin/env node
import readline from "node:readline";
import { CdpStudioClient, DEFAULT_ORIGINS } from "./cdp-client.mjs";
import { AGENT_CONTRACT_VERSION } from "../studio-v2/core/constants.js";
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
      serverInfo: { name: "printform-studio-mcp", version: "1.1.0" },
      instructions: `PrintForm Agent Contract ${AGENT_CONTRACT_VERSION}. Act as a PrintForm engineer. Verify the compatible contract and current host data policy before work. Unknown and Real require geometry-only redacted evidence: do not request browser screenshots or reuse earlier Synthetic pixels. Synthetic pixels may be used only while the current policy permits them. For layout review, call capture_layout_evidence for the default and long-text scenarios, begin_layout_review, address major and critical issues within the authorized scope, and complete_layout_review for the current revision with the Studio-issued evidence references. Self-declared evidence labels are rejected. Safe references bind document, session and policy context; they never grant scope or apply permission. On expiry, reacquire within the authorized scope, never widen to the whole document. Raw source replacement is human-only, even when requested in chat. A timeout or disconnect does not prove a commit failed: query transaction status, do not blindly retry or roll back, and do not promise refresh recovery for volatile state. Confirm request_export readiness through the host; do not infer production readiness from metrics or screenshots. Production export still requires a human click.`
    });
  }
  if (method === "ping") return success(id, {});
  if (method === "tools/list") {
    return success(id, { tools: TOOL_CONTRACTS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })) });
  }
  if (method === "tools/call") {
    const tool = TOOL_CONTRACTS.find((candidate) => candidate.name === params.name);
    if (!tool) return failure(id, -32602, "Unknown tool");
    try {
      const response = await client.execute(params.name, params.arguments || {});
      return success(id, {
        content: [{ type: "text", text: JSON.stringify(response) }],
        structuredContent: response,
        isError: !response?.ok
      });
    } catch (error) {
      return success(id, { content: [{ type: "text", text: "Tool execution failed" }], isError: true, structuredContent: { ok: false, error: { code: error.code || "TOOL_EXECUTION_FAILED", message: "Tool execution failed" } } });
    }
  }
  if (method?.startsWith("notifications/")) return;
  failure(id, -32601, "Method not found");
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  if (!line.trim()) return;
  try { Promise.resolve(handle(JSON.parse(line))).catch(() => console.error("MCP request failed")); }
  catch { failure(null, -32700, "Parse error"); }
});
input.on("close", () => { client.close(); process.exit(0); });
process.on("SIGINT", () => { client.close(); process.exit(0); });
