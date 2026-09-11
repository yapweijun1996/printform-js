import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DEMO_DESIGNER_PROMPT, DESIGNER_PROMPT } from "../../studio-v2/ui/agent-designer-prompt.js";
import { AGENT_CONTRACT_VERSION } from "../../studio-v2/core/constants.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";

function assertPolicyInstructions(prompt) {
  expect(prompt).toContain("Unknown and Real require geometry-only redacted");
  expect(prompt).toContain("do not request browser screenshots or reuse earlier Synthetic pixels");
  expect(prompt).toContain("human-only");
  expect(prompt).toContain("even when requested in chat");
  expect(prompt).toContain("never grant scope or apply permission");
  expect(prompt).toContain("query transaction status, do not blindly retry or roll back");
  expect(prompt).toContain("do not promise refresh recovery for volatile state");
  expect(prompt).not.toContain("unless the user explicitly requests it");
}

describe("Agent runtime instructions follow production policy", () => {
  it("keeps the embedded runtime prompt inside host permissions", () => {
    assertPolicyInstructions(DESIGNER_PROMPT);
    expect(DESIGNER_PROMPT).toContain("human must use the Studio Production export UI");
  });

  it("keeps the Demo planner prompt compact and policy-bound", () => {
    expect(DEMO_DESIGNER_PROMPT.length).toBeLessThan(DESIGNER_PROMPT.length);
    expect(DEMO_DESIGNER_PROMPT).toContain("review context lists allowed operation types and field names");
    expect(DEMO_DESIGNER_PROMPT).toContain("Demo session grants no scope or apply permission");
    expect(DEMO_DESIGNER_PROMPT).toContain("do not request browser screenshots or reuse earlier Synthetic pixels");
    expect(DEMO_DESIGNER_PROMPT).toContain("Human export remains required");
  });

  it("publishes restrictive MCP initialization instructions and all 35 tools without connecting CDP", () => {
    // Keep the negative-path assertion independent of any runner service on the default CDP port.
    const process = spawnSync(globalThis.process.execPath, ["mcp/server.mjs", "--cdp-url", "http://127.0.0.1:0"], {
      input: [{ jsonrpc: "2.0", id: 1, method: "initialize" }, { jsonrpc: "2.0", id: 2, method: "tools/list" }].map(JSON.stringify).join("\n") + "\n",
      encoding: "utf8", timeout: 5000, windowsHide: true
    });
    expect(process.status).toBe(0);
    const replies = process.stdout.trim().split("\n").map(JSON.parse);
    const prompt = replies.find((reply) => reply.id === 1).result.instructions;
    assertPolicyInstructions(prompt);
    expect(prompt).toContain(`PrintForm Agent Contract ${AGENT_CONTRACT_VERSION}`);
    expect(prompt).toContain("Production export still requires a human click");
    const compatibility = replies.find((reply) => reply.id === 2);
    expect(compatibility).toBeDefined();
    expect(compatibility.error).toMatchObject({ code: -32001, data: { code: expect.any(String) } });
    expect(TOOL_CONTRACTS).toHaveLength(35);
  });
});
