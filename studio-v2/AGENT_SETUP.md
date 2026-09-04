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

Studio progressively registers `navigator.modelContext` tools when the browser enables WebMCP. The configuration below was verified against Chrome 150 and `chrome-devtools-mcp` 1.6.0 on 2026-07-30. Chrome DevTools MCP launches Chrome itself, injects the required feature flags, and creates an isolated temporary profile; engineers do not run or clean up a separate browser profile.

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

The steps below exercise the **current Pilot contract**. Layout evidence is issued by Studio: `capture_layout_evidence` renders the current draft scenario, returns a receipt with an `evidenceId`, and binds it to both the revision and `baseProjectHash`. Use `visualMode: "pixels"` only in synthetic-data mode; Studio then creates a bounded sandbox DOM-to-canvas pixel raster. Real-data mode is hard-gated to geometry-only evidence, while geometry remains the cross-browser fallback. Pixel rasterization omits source URLs and uses safe placeholders for image assets. `complete_layout_review` accepts only those IDs for the current revision and scenarios. The agent gateway also redacts rendered text, business amounts and raw validation messages before an external model sees them.

1. Open the Studio v2 PWA in the isolated profile. Use `?sample=purchase-order-red` for the Crimson purchase-order pilot or select it from **Standard sample**.
2. Call `get_capabilities`.
3. Call `get_project_summary` and confirm `protocolVersion` is `2.0.0`.
4. Use `inspect_design_state` and `get_operation_catalog`, then use `preview_changes` with the current revision, `approve_transaction` with the returned candidate hash, and only then `apply_changes`.
5. Exercise `default` and `long-text`. In synthetic-data mode the embedded AI review receives bounded, complete-page pixel rasters plus safe metrics; in real-data mode it receives complete-page geometry-only SVG snapshots. A broken scenario returns an unsigned safe observation for diagnosis, never a completion receipt. A human should still inspect the actual browser/system print preview rather than relying on agent evidence alone.
6. Call `begin_layout_review` and `capture_layout_evidence` for required scenarios. Any major or critical finding blocks completion even if the caller labels it `fixed`; apply a revision-bound repair, capture fresh evidence, then call `complete_layout_review` with the new clean `evidenceIds`.
7. Treat the resulting receipt as Studio-issued layout evidence. Confirm `request_export` returns `ready: true`, then ask the engineer to inspect system print preview and click **Production export**.

Any project, locale, sample, theme, template, or asset change invalidates the prior review receipt. The agent must repeat the visual review before claiming Pilot completion. The embedded loop permits at most three passes and two approved repairs; repeated repairs are rejected. Studio can block readiness and export, but it cannot force an external Agent to continue working or prevent it from sending a response.

Agent Contract 3.0 exposes a semantic FormSpec/component registry and requires `preview_changes` → `approve_transaction` → `apply_changes` with an exact transaction ID and candidate hash. `apply_changes` no longer accepts `operations[]`; raw source preview remains a Studio-internal command and is not an Agent tool. The embedded AI Designer follows the same transaction path. Use `get_transaction`, `get_revision`, `get_audit_events`, `get_transaction_history` and `get_evidence_pack` for durable audit/recovery state. Lease recovery uses `renew_lease`, `release_lease`, `takeover_transaction` and `recover_transaction`; releasing a lease expires the uncommitted record, and takeover creates a fresh transaction. Stale or conflicted drafts must be explicitly resolved before a new preview. End users can Undo or Redo committed revisions. `request_export` is readiness-only: AI never receives Production Export UI permission.

## Embedded AI Designer and BYOK

The Studio includes a collapsible AI Designer panel backed by the pinned
same-origin `agrun.min.js` bundle. It supports OpenAI, Gemini and an
OpenAI-compatible Custom LLM. Provider keys are stored only as PBKDF2-HMAC-
SHA256 (600,000 iterations) + AES-256-GCM ciphertext in IndexedDB; the
derived key and decrypted credential exist only while the vault is unlocked.

The embedded action flow is:

```text
inspect → operation catalog → preview_changes → host auto-apply (candidate hash + requireValid) → validate
review → full-page evidence/observation → multimodal decision
       → repair proposal → host auto-apply after validation → fresh evidence → pass or block
```

The embedded controller runs Agrun in `native_tools` mode with
`nativeToolsFailurePolicy: "hard_fail"`. A design turn must finish through a
terminal PrintForm action; ordinary provider prose is stopped with
`TERMINAL_ACTION_REQUIRED` instead of consuming the full step budget. If the
provider emits an unambiguous safe JSON semantic operation where the planner
envelope is invalid, the controller converts it into the same native
`preview_changes` action. High-risk raw replacement text is ignored.

The AI runtime cannot production-export, cannot use Web search/URL/workspace
actions, and cannot mutate an untrusted document. Real-data mode keeps chat
sessions in memory and applies the same gateway redaction, but user-entered
values or raw replacement text can still be intentionally sent to the chosen
provider. The default runtime step limit is 100 (bounded to 4–100). The panel
always reports token usage; a USD cap is enabled only when the user supplies
both input and output prices for the selected model, so the Studio never
guesses current provider pricing.

Agrun stream events are projected at the controller boundary. The UI and its
memory-only trace receive action names, phases, statuses, error codes and
numeric usage, but not raw prompts, image data URLs, credentials, normalized
provider input or terminal run state.

## Production sample artifacts

`npm run build:site` emits three self-contained reference documents under `site-dist/studio-v2/samples/`: `sales-invoice-v2.html`, `purchase-order-red-v2.html`, and `progress-claim-northpeak-v2.html`. They are generated from the same structured source modules loaded by Studio; do not hand-edit a generated artifact and expect its trusted attestation to remain valid.
