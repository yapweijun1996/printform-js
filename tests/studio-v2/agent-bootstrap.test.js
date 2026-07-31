import fs from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "../../studio-v2/core/constants.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";

const manifest = JSON.parse(fs.readFileSync("studio-v2/agent-setup.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("studio-v2/agent-setup.schema.json", "utf8"));
const html = fs.readFileSync("studio-v2/index.html", "utf8");
const serviceWorker = fs.readFileSync("studio-v2/sw.js", "utf8");
const llmsText = fs.readFileSync("studio-v2/llms.txt", "utf8");

describe("link-only AI agent bootstrap", () => {
  it("matches the published versioned schema contract", () => {
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(Object.keys(manifest).sort()).toEqual(["$schema", ...schema.required].sort());
    expect(manifest.schemaVersion).toBe(schema.properties.schemaVersion.const);
    expect(manifest.kind).toBe(schema.properties.kind.const);
    expect(Object.keys(manifest.clients).sort()).toEqual(schema.properties.clients.required.sort());
  });

  it("keeps every hand-maintained copy of the contract version and tool count in sync with the code", () => {
    // These facts are duplicated across constants.js, agent-setup.json (three
    // places) and llms.txt. The 1.1.0 -> 1.2.0 bump already missed
    // verification.expectedCommandContractVersion, which would have told an
    // onboarding agent to reject a perfectly correct Studio. Assert the code
    // is the source of truth instead of trusting hand-sync next time.
    expect(manifest.studio.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(manifest.studio.commandContractVersion).toBe(AGENT_CONTRACT_VERSION);
    expect(manifest.verification.expectedProtocolVersion).toBe(PROTOCOL_VERSION);
    expect(manifest.verification.expectedCommandContractVersion).toBe(AGENT_CONTRACT_VERSION);
    expect(manifest.verification.expectedWebMcpToolCount).toBe(TOOL_CONTRACTS.length);
    expect(manifest.procedure.find((step) => step.id === "discover-webmcp").expectedToolCount).toBe(TOOL_CONTRACTS.length);
    expect(llmsText).toContain(`contract ${AGENT_CONTRACT_VERSION}, and ${TOOL_CONTRACTS.length} Studio WebMCP tools`);
    // Tools the manifest tells agents to require must actually exist.
    const toolNames = new Set(TOOL_CONTRACTS.map((tool) => tool.name));
    manifest.verification.requiredStudioTools.forEach((name) => expect(toolNames).toContain(name));
  });

  it("pins a restricted isolated Chrome DevTools MCP for both clients", () => {
    expect(manifest.mcpServer.args).toContain("chrome-devtools-mcp@1.6.0");
    expect(manifest.mcpServer.args).toContain("--isolated=true");
    expect(manifest.mcpServer.args).toContain("--categoryExperimentalWebmcp=true");
    expect(manifest.mcpServer.args.join(" ")).not.toMatch(/@latest|autoConnect|browserUrl/);
    expect(manifest.clients.codex.installCommand).toMatch(/^codex mcp add chrome-devtools -- /);
    expect(manifest.clients.claudeCode.installCommand).toMatch(/^claude mcp add --scope user chrome-devtools -- /);
    expect(manifest.clients.codex.installCommand).toContain("'--allowedUrlPattern=https://yapweijun1996.github.io/printform-js/*'");
    expect(manifest.safety).toMatchObject({ dailyChromeAutoConnectAllowed: false, humanProductionExportRequired: true });
  });

  it("publishes visible and machine-readable discovery links offline", () => {
    const document = new JSDOM(html).window.document;
    expect(document.querySelector('link[rel="help"][href="./agent-setup.json"]')).not.toBeNull();
    expect(document.querySelector('link[rel="alternate"][href="./llms.txt"]')).not.toBeNull();
    expect(document.querySelector('.agent-bootstrap a[href="./AGENT_SETUP.md"]')).not.toBeNull();
    expect(document.querySelector('.agent-bootstrap a[href="./agent-setup.json"]')).not.toBeNull();
    for (const asset of ["agent-setup.json", "agent-setup.schema.json", "AGENT_SETUP.md", "llms.txt"]) {
      expect(serviceWorker).toContain(`./${asset}`);
    }
  });
});
