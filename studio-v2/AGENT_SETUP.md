# Codex / Claude Code agent setup

PrintForm Studio v2 exposes one versioned command contract through two thin bridges. Both routes modify only the Studio draft. A person must still approve the final production export in the PWA.

## Safety boundary

- Prefer an isolated Chrome profile managed automatically by Chrome DevTools MCP. No manual profile command is required, and the temporary profile is removed when the MCP session ends.
- Do not auto-connect the bridge to a daily authenticated browser profile unless access to every open tab is explicitly acceptable.
- The first-party bridge accepts exactly one tab whose origin is allowlisted and whose path contains `/studio-v2/`; the official MCP route restricts network access to the published Studio path.
- WebMCP and CDP tools never return sample row values. Enable real-data mode only for the current session; it disables draft recovery caching.

## Recommended Chrome DevTools MCP WebMCP route

Studio progressively registers `document.modelContext` tools when the browser enables WebMCP. The configuration below was verified against Chrome 150 and `chrome-devtools-mcp` 1.6.0 on 2026-07-30. Chrome DevTools MCP launches Chrome itself, injects the required feature flags, and creates an isolated temporary profile; engineers do not run or clean up a separate browser profile.

```toml
[mcp_servers.chrome-devtools]
command = "npx"
args = [
  "-y",
  "chrome-devtools-mcp@1.6.0",
  "--isolated=true",
  "--categoryExperimentalWebmcp=true",
  "--chromeArg=--enable-features=WebMCP,DevToolsWebMCPSupport",
  "--allowedUrlPattern=https://yapweijun1996.github.io/printform-js/*",
  "--usageStatistics=false",
  "--performanceCrux=false",
]
```

Restart the MCP client after changing its configuration. Then open the production Studio with the Chrome DevTools `new_page` tool and call `list_webmcp_tools`; execute `get_capabilities` before any revision-bound command.

`--autoConnect` can attach to a running Chrome 144+ profile after the user enables remote debugging at `chrome://inspect/#remote-debugging`. It is not the production default: it exposes every open tab in the selected profile, and `--chromeArg` cannot inject WebMCP feature flags into a browser that MCP did not launch.

## First-party CDP fallback

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

The fallback launcher now uses Chrome 150's `WebMCP,DevToolsWebMCPSupport` features and an explicit repository-local profile on port 9222. Use it when an MCP client cannot launch Chrome directly. Verify the official flag names before upgrading Chrome DevTools MCP; the Studio core remains usable through UI and the first-party bridge if the experimental API changes.

## Connection check

1. Open the Studio v2 PWA in the isolated profile. Use `?sample=purchase-order-red` for the Crimson purchase-order pilot or select it from **Standard sample**.
2. Call `get_capabilities`.
3. Call `get_project_summary` and confirm `protocolVersion` is `2.0.0`.
4. Use `preview_changes` with the current revision before `apply_changes`.
5. Exercise `default` and `long-text`, then inspect full-page screenshots rather than relying on metrics alone.
6. Call `begin_layout_review`, repair every major or critical finding, and call `complete_layout_review` with screenshot and layout-metric evidence for the current revision.
7. Confirm `request_export` returns `ready: true`, then ask the engineer to click **Production export**.

Any project, locale, sample, theme, template, or asset change invalidates the prior review receipt. The agent must repeat the visual review before claiming completion. Studio limits automated review to three passes per revision.

## Production sample artifacts

`npm run build:site` emits two self-contained reference documents under `site-dist/studio-v2/samples/`: `sales-invoice-v2.html` and `purchase-order-red-v2.html`. They are generated from the same structured source modules loaded by Studio; do not hand-edit a generated artifact and expect its trusted attestation to remain valid.
