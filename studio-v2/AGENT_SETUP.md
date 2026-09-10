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
- Unknown/Real must not automatically persist document snapshots, recovery drafts or chat records. Imported-policy loosening and delayed session writes have bounded fixes; complete privacy acceptance remains open in the [resumed evidence](../docs/STUDIO_V2_IMPLEMENTATION_EVIDENCE.md). Do not use the mode label as proof of complete privacy enforcement or introduce real business data to test it. Existing records must not be silently deleted.
- Host classification, scope and apply policy override model-supplied flags. A table scope using only `tableSelector` must resolve to one semantic table identity; reject selectors spanning different table IDs or unresolved selectors before creating a transaction. Raw source replacement remains human-editor-only, even if a user requests it through chat. Missing safe fields or rejected references do not authorize browser/DOM inspection, screenshots or whole-document scope as a fallback.
- Screenshots/pixel evidence are permitted only for a currently confirmed Synthetic document. Unknown/Real uses approved geometry; if that cannot support a visual judgment, report incomplete evidence and leave human inspection separate. A prompt requesting screenshots does not broaden this permission.

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
4. Use `inspect_design_state` and `get_operation_catalog`, then `preview_changes` with the current revision and permitted scope. In Preview mode, stop at the pending candidate and wait for the human UI; do not claim approval in tool input. Auto mode permits only host-eligible operations through the existing approval/apply transaction sequence with the exact transaction ID and candidate hash. A permission error is not a reason to bypass the gateway.
5. Exercise `default` and `long-text`. In synthetic-data mode the embedded AI review receives bounded, complete-page pixel rasters plus safe metrics. In real-data mode the host can produce complete-page geometry-only SVG snapshots for a compatible recipient, but the built-in Demo Gateway accepts only PNG/JPEG/WebP and therefore rejects that evidence before sending. A broken or unsupported scenario returns an unsigned safe observation or transport error for diagnosis, never a completion receipt. A human should still inspect the actual browser/system print preview rather than relying on agent evidence alone.
6. Call `begin_layout_review` and `capture_layout_evidence` for required scenarios. Any major or critical finding blocks completion even if the caller labels it `fixed`; apply a revision-bound repair, capture fresh evidence, then call `complete_layout_review` with the new clean `evidenceIds`.
7. Treat the resulting receipt as Studio-issued layout evidence. Confirm `request_export` returns `ready: true`, then ask the engineer to inspect system print preview and click **Production export**.

Any project, locale, sample, theme, template, or asset change invalidates the prior review receipt. The agent must repeat the visual review before claiming Pilot completion. The embedded loop permits at most three passes and two approved repairs; repeated repairs are rejected. Studio can block readiness and export, but it cannot force an external Agent to continue working or prevent it from sending a response.

Agent Contract 4.0 exposes semantic FormSpec/components and retains the preview/approval/apply transaction sequence. That sequence does not grant an Agent human approval permission. Results use closed projections and context-bound opaque references; `apply_changes` does not accept `operations[]`, and raw source preview is human-editor-only. Query transaction/revision/audit/history/evidence tools to reconcile outcomes, but Unknown/Real records and references are volatile, not recoverable after reload. Timeout or cancellation does not prove no commit: query the same transaction when its context remains available, or report reconciliation required without blind retry or automatic rollback. Lease takeover creates a fresh transaction; stale/conflicted drafts require explicit resolution. `request_export` is readiness-only; Production Export remains human-controlled.

## Embedded AI Designer and BYOK

**Future runtime direction:** [PI Agent Harness migration](../docs/STUDIO_V2_PI_HARNESS_MIGRATION.md) selects actual `AgentHarness`, browser-first execution and direct BYOK with no Node.js/server runtime. It remains a future replacement and must qualify provider, session, privacy and transaction parity before retiring the current AGRUN path. The current embedded Designer uses the browser Demo Gateway described below; MCP setup elsewhere in this guide is not a prerequisite for the embedded Designer.

The Studio includes a collapsible AI Designer panel backed by the pinned
same-origin `agrun.min.js` bundle. It supports OpenAI, Gemini and an
OpenAI-compatible Custom LLM. Provider keys are stored only as PBKDF2-HMAC-
SHA256 (600,000 iterations) + AES-256-GCM ciphertext in IndexedDB; the
derived key and decrypted credential exist only while the vault is unlocked.

### Current browser Demo Gateway

The default browser profile uses the server-side Demo contract from the reviewed
OpenAI Gateway Admin/User Guide Reports Admin v0.1. It first sends
`POST https://gpt.yapweijun1996.com/demo/session` with `{ "project_id": "github-pages" }`
and no Gateway or Provider key. The server returns a short-lived `dmo_...`
session token; Studio keeps it in memory, sends it only as `Bearer` authentication
to `https://gpt.yapweijun1996.com/demo/v1/responses`, refreshes once after a 401,
and never persists, logs, exports or puts it in an Agent payload. The browser's
normal CORS request supplies the registered Origin; application code must not
invent an `Origin` header.

The private `/v1/*` route and `gw_...` credentials are server-side only. Never
embed a private Gateway key, call `/v1/*` from the browser, pass a Demo token to
Studio commands, or use a rejected session as permission to broaden document
scope. The guide advertises model discovery and `demo-auto`/`demo-fast`, while
also documenting `gpt-5.4-mini`; this client keeps that default, while model-alias
discovery remains unverified in this worktree. A no-secret local Harness probe on
2026-09-10 returned HTTP 403 from `/demo/session` for the local origin; the guide
maps that status to an unregistered Demo project origin, with CORS allow-origin
present. Full live Provider compatibility remains open.

The default auto-apply flow is shown below. Ordinary chat and Review-generated repairs use the same apply-mode decision: preview-first leaves the proposal pending human Apply, while Auto mode is limited to the explicit low-risk operation allowlist. Scope selection and card-target Undo still require the remaining PROD-01/04 acceptance evidence. All paths still use the existing transaction/hash checks.

Security boundary: the supported MCP/WebMCP catalogs expose only normal Agent `execute` calls. The
page-global gateway and ordinary bound sessions also expose only `execute`; the UI's privileged
`executeHuman` method is created on an app-local session factory and is not attached to the public
gateway. The panel verifies its candidate approval token before using that private path. This does
not sandbox hostile extensions, arbitrary debugging or untrusted same-origin code; do not grant a
model unrestricted page/CDP execution, and keep the remaining PROD-02/02-03 acceptance evidence.

```text
inspect → operation catalog → preview_changes → host auto-apply (candidate hash + requireValid) → validate
review → full-page evidence/observation → multimodal decision
       → repair proposal → host auto-apply after validation → fresh evidence → pass or block
```

The embedded controller selects its planner mode by recipient. The built-in
browser Demo Gateway uses provider-tool-free `envelope` mode: the host keeps its
PrintForm action registry locally, but the final `/demo/v1/responses` payload
contains neither `tools` nor `tool_choice`. The Provider must return one strict
JSON action envelope; if that envelope is invalid, an unambiguous safe JSON
semantic operation can be recovered into the same host `preview_changes` path.
BYOK profiles retain `native_tools` with `nativeToolsFailurePolicy: "hard_fail"`.
In both modes, a design turn must finish through a terminal PrintForm action;
ordinary provider prose is stopped with `TERMINAL_ACTION_REQUIRED`, and
high-risk raw replacement text is ignored.

The host-side MCP/WebMCP catalog remains separate from the Provider payload. Its
35 commands and their permission checks are not sent as Demo `tools`; a Demo
session is transport-only and never authorizes command, scope or apply.

The AI runtime cannot production-export, cannot use Web search/URL/workspace
actions, and cannot mutate an untrusted document. Restrictive chat stores are
intended to remain memory-only, subject to the incomplete lifecycle acceptance above. User-entered
values or raw replacement text can still be intentionally sent to the chosen
provider. The default runtime step limit is 100 (bounded to 4–100). The panel
always reports token usage; a USD cap is enabled only when the user supplies
both input and output prices for the selected model, so the Studio never
guesses current provider pricing.

Agrun stream events are projected at the controller boundary. The UI and its
memory-only trace receive action names, phases, statuses, error codes and
numeric usage, but not raw prompts, image data URLs, credentials, normalized
provider input or terminal run state.

Runtime guidance is loaded separately from these engineering documents: the embedded controller uses
`ui/agent-designer-prompt.js`, the fetched `agent-skills/printform-designer.md`, and pass-specific review
prompts; MCP clients also receive `mcp/server.mjs` instructions. The direction review records remaining
raw-source and unconditional-screenshot wording conflicts in those code-defined prompts. This guide
does not fix them, prove a model followed it, or substitute for host enforcement and final payload tests.

## Production sample artifacts

`npm run build:site` emits three self-contained reference documents under `site-dist/studio-v2/samples/`: `sales-invoice-v2.html`, `purchase-order-red-v2.html`, and `progress-claim-northpeak-v2.html`. They are generated from the same structured source modules loaded by Studio; do not hand-edit a generated artifact and expect its trusted attestation to remain valid.
