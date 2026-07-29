# Codex / Claude Code agent setup

PrintForm Studio v2 exposes one versioned command contract through two thin bridges. Both routes modify only the Studio draft. A person must still approve the final production export in the PWA.

## Safety boundary

- Use the dedicated Chrome profile launched by this repository. Do not connect the bridge to a daily authenticated browser profile.
- The bridge accepts exactly one tab whose origin is allowlisted and whose path contains `/studio-v2/`.
- WebMCP and CDP tools never return sample row values. Enable real-data mode only for the current session; it disables draft recovery caching.

## First-party CDP bridge

From the repository:

```bash
npm run studio:agent-browser
npm run studio:mcp
```

Configure an MCP client with an absolute repository path:

```json
{
  "mcpServers": {
    "printform-studio": {
      "command": "node",
      "args": ["/absolute/path/printform-js/mcp/server.mjs"]
    }
  }
}
```

For local development, launch the browser with `PRINTFORM_STUDIO_URL=http://127.0.0.1:5173/studio-v2/`. A non-default origin must also be passed to the server with `--studio-origin`.

## Official Chrome DevTools MCP WebMCP bridge

Studio progressively registers `document.modelContext` tools when the browser enables WebMCP. The configuration below was verified against Chrome 150 and `chrome-devtools-mcp` 1.6.0 on 2026-07-29. Start the repository's isolated browser first so the required `WebMCPTesting,DevToolsWebMCPSupport` Chrome features and non-default profile are always present:

```bash
npm run studio:agent-browser
```

Then pin the MCP bridge and connect it to that dedicated debugging port:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@1.6.0",
        "--browser-url=http://127.0.0.1:9222",
        "--category-experimental-webmcp=true",
        "--usage-statistics=false",
        "--performance-crux=false"
      ]
    }
  }
}
```

Chrome 149 or newer currently requires `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`. Verify the official flag names before upgrading Chrome DevTools MCP; the Studio core remains usable through UI and the first-party bridge if the experimental API changes. The usage-statistics and CrUX switches are disabled above to preserve Studio's no-default-telemetry policy.

## Connection check

1. Open the Studio v2 PWA in the isolated profile.
2. Call `get_capabilities`.
3. Call `get_project_summary` and confirm `protocolVersion` is `2.0.0`.
4. Use `preview_changes` with the current revision before `apply_changes`.
5. Resolve validation errors in Studio, then ask the engineer to click **生产导出**.
