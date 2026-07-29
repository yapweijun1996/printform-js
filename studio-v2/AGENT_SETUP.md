# Codex / Claude Code agent setup

> Maturity: **Production Pilot**. This file documents the current Agent Contract returned by `get_capabilities`; the Production Ready target is documented in the [Chinese v2 index](../docs/STUDIO_V2_INDEX.zh-CN.md) and [trust model](../docs/STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md).

PrintForm Studio v2 exposes one versioned command contract through two thin bridges. Both routes modify only the Studio draft. A person must still inspect system print preview and approve the final export in the PWA.

## Link-only agent bootstrap

An end user may provide only this URL:

```text
https://yapweijun1996.github.io/printform-js/studio-v2/
```

The page exposes `agent-setup.json` through a visible link, an HTML `rel="help"` link and `llms.txt`. Codex CLI and Claude Code should read the machine manifest first; it is the versioned source for prerequisites, commands, restart instructions, verification and safety rules.

Recommended user handoff:

```text
Open this Studio URL. Read its linked agent-setup.json, explain any MCP configuration change before applying it, restart when instructed, then verify WebMCP with get_capabilities before editing the print form.
```

## Safety boundary

- Prefer an isolated Chrome profile managed automatically by Chrome DevTools MCP. No manual profile command is required, and the temporary profile is removed when the MCP session ends.
- Do not auto-connect the bridge to a daily authenticated browser profile unless access to every open tab is explicitly acceptable.
- The first-party bridge accepts exactly one tab whose origin is allowlisted and whose path contains `/studio-v2/`; the official MCP route restricts network access to the published Studio path.
- WebMCP and CDP tools never return sample row values. In the current Pilot UI, engineers must enable real-data mode for the current session to disable draft recovery caching. The Production Ready target treats every unknown import as possible real ERP data by default.

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

Codex CLI installation:

```bash
codex mcp list
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@1.6.0 --isolated=true --categoryExperimentalWebmcp=true --chromeArg=--enable-features=WebMCP,DevToolsWebMCPSupport '--allowedUrlPattern=https://yapweijun1996.github.io/printform-js/*' --usageStatistics=false --performanceCrux=false
```

Claude Code user-scope installation:

```bash
claude mcp list
claude mcp add --scope user chrome-devtools -- npx -y chrome-devtools-mcp@1.6.0 --isolated=true --categoryExperimentalWebmcp=true --chromeArg=--enable-features=WebMCP,DevToolsWebMCPSupport '--allowedUrlPattern=https://yapweijun1996.github.io/printform-js/*' --usageStatistics=false --performanceCrux=false
```

If `chrome-devtools` already exists, compare it with the manifest. Explain the difference and get user approval before running the matching `mcp remove` command. Restart Codex or Claude Code after installation; a running client does not automatically gain the new tool category.

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

The steps below exercise the **current Pilot contract**. Its review evidence values are Agent-submitted labels, not Studio-issued screenshot receipts; passing them does not by itself prove Production Ready.

1. Open the Studio v2 PWA in the isolated profile. Use `?sample=purchase-order-red` for the Crimson purchase-order pilot or select it from **Standard sample**.
2. Call `get_capabilities`.
3. Call `get_project_summary` and confirm `protocolVersion` is `2.0.0`.
4. Use `preview_changes` with the current revision before `apply_changes`.
5. Exercise `default` and `long-text`, then manually inspect full-page screenshots rather than relying on metrics alone.
6. Call `begin_layout_review`, repair every major or critical finding, and call the current `complete_layout_review` with `full-page-screenshot` and `layout-metrics` evidence labels for the current revision.
7. Treat the resulting receipt as Pilot evidence only. Confirm `request_export` returns `ready: true`, then ask the engineer to inspect system print preview and click **Production export**.

Any project, locale, sample, theme, template, or asset change invalidates the prior review receipt. The agent must repeat the visual review before claiming Pilot completion. Studio limits automated review to three passes per revision. Studio can block readiness and export, but it cannot force an external Agent to continue working or prevent it from sending a response.

Agent Contract 2.0 will replace self-declared evidence labels with Studio-issued evidence IDs and make `apply_changes` consume a real preview receipt. This is Target behavior and is not available until `get_capabilities` reports the 2.0 contract.

## Production sample artifacts

`npm run build:site` emits two self-contained reference documents under `site-dist/studio-v2/samples/`: `sales-invoice-v2.html` and `purchase-order-red-v2.html`. They are generated from the same structured source modules loaded by Studio; do not hand-edit a generated artifact and expect its trusted attestation to remain valid.
