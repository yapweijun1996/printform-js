import fs from "node:fs";
import { describe, expect, it } from "vitest";

const launcher = fs.readFileSync("scripts/launch-studio-agent-browser.mjs", "utf8");
const setupGuide = fs.readFileSync("studio-v2/AGENT_SETUP.md", "utf8");

describe("Chrome DevTools MCP WebMCP setup", () => {
  it("uses the current Chrome WebMCP feature flags", () => {
    expect(launcher).toContain("--enable-features=WebMCP,DevToolsWebMCPSupport");
    expect(setupGuide).toContain("--enable-features=WebMCP,DevToolsWebMCPSupport");
    expect(`${launcher}\n${setupGuide}`).not.toContain("WebMCPTesting");
  });

  it("documents the MCP-managed isolated profile workflow", () => {
    expect(setupGuide).toContain("--isolated=true");
    expect(setupGuide).toContain("--categoryExperimentalWebmcp=true");
    expect(setupGuide).not.toContain("--browser-url=http://127.0.0.1:9222");
    expect(setupGuide).toContain("list_webmcp_tools");
  });
});
