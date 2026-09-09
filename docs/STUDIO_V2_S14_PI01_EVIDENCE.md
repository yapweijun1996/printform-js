# Studio v2 S14 / PI-01 evidence

Date: 2026-09-09
Step: S14 / PI-01 direct browser BYOK transport
Status: **Done, 100% (G1/G2/G3/G4/G5)**
Baseline: `main` at `3a1a7dbb93de5edd7984842896afdaab42a92bed` plus the shared worktree delta

## G1 — investigation and frozen acceptance

The existing embedded Designer remains an unbundled AGRUN entry. Its
`studio-v2/ui/agent-provider.js` input is consumed by `agent-runtime.js` and
must not gain bare npm imports before the static asset cutover; doing so would
break the current browser entry. PI-01 therefore qualifies the actual pinned
`@earendil-works/pi-ai@0.85.1` transport in an isolated static browser entry.
PI-00 already qualified `AgentHarness` and `MemorySessionRepo`; PI-02 owns the
Harness tool/event/host adapter integration after this transport gate.

Frozen cases:

- 14-01: OpenAI Responses uses a direct browser request with the supplied key,
  streaming response and usage projection.
- 14-02: OpenAI Chat Completions uses the same direct transport contract,
  including a custom OpenAI-compatible HTTPS endpoint.
- 14-03: Google Gemini `generateContent` uses the direct browser request with
  the supplied key and response/error normalization.
- 14-04: no-key and locked-vault states do not send a provider request and do
  not fall back to the current Demo Gateway.
- 14-05: validated synthetic image evidence is sent inline only when the
  profile/model supports it; raw document content and credentials stay out of
  payloads, transcript and diagnostics.
- 14-06: HTTP/provider errors and AbortController cancellation are visible,
  deterministic and do not retain the decrypted key after the transport
  handle is disposed.

Required boundary: direct request from the configured static origin to the
selected provider only. No application backend, `/api`, MCP, transaction
server, proxy, hidden Demo route, OAuth, Node runtime or shared credential is
allowed. Synthetic intercepted provider responses are acceptable for local
wire qualification; no live provider authorization is inferred.

Required checks: focused adapter/unit tests, isolated static build and bundle
inspection, real browser requests through the actual `pi-ai` API adapters in
Chromium/Firefox/WebKit, no-key/error/abort cases, existing vault and provider
regressions, `npm run check`, line counts, `git diff --check`, and a scoped diff
review. Live provider CORS/preflight and reliability remain unrun because the
qualification uses approved synthetic intercepted responses. Release/platform/
physical-print evidence remains outside PI-01.

## G2 — bounded implementation

- `studio-v2/pi-01/provider-transport.js` uses the pinned `pi-ai` OpenAI
  Responses, OpenAI Chat Completions and Google Generative AI adapters. It
  normalizes default/custom endpoints, projects only policy-approved image
  evidence, resolves credentials from an in-memory BYOK callback and keeps the
  current unbundled AGRUN Designer entry unchanged.
- `qualification-entry.js`, the static qualification page and
  `scripts/build-pi-01.mjs` create a separate browser artifact. The manifest
  records the reviewed package source commit and explicitly marks
  `appBackend: false`, `providerProxy: false` and `directBrowserByok: true`.
- The adapter rejects missing credentials before transport, never puts the key
  on the model/context or request body, propagates provider/abort outcomes and
  clears the active key plus controllers on disposal. No Demo Gateway, `/api`,
  MCP, transaction server, OAuth or Node runtime was added to this path.

## G3 — focused verification

- `node --check` passed for the PI-01 adapter, qualification entry, build script
  and browser case file. `node scripts/build-site.mjs` passed with the isolated
  PI-01 entry at **14,270 bytes** and the generated qualification manifest.
- The qualification entry has no bare `@earendil-works/pi-*` import,
  `node:` import, `eval` or `new Function`; the generated site artifact is
  static and contains no provider credential. `npm run check` and
  `git diff --check` passed after the final amendment.
- The scoped PI-01 files and evidence are within the repository's 300-line
  amended-file limit. No canonical revision/CAS, scope, Unknown/Real privacy,
  private approval/export or public protocol contract was changed.

## G4 — browser acceptance

- `npx playwright test e2e/studio-v2-pi-01.spec.js --workers=1` passed **18/18**:
  14-01 through 14-06 each passed in Chromium, Firefox and WebKit. The cases
  observed direct endpoint URLs and auth headers, streamed/provider usage
  projection, custom Chat transport, Gemini transport, no-key and locked-vault
  no-send behavior, synthetic image projection without source metadata or key,
  HTTP failure, cancellation and post-disposal rejection.
- Provider responses were intercepted synthetic fixtures only. This proves the
  actual browser request/adapter boundary and its negative paths, not live
  provider CORS, preflight, quota, model availability or production reliability.

## G5 — handoff

PI-01 evidence and affected authority documents are synchronized. Plan closure
is **66.7% (1400/21)** with **14/21** steps Done; P0 remains **32/35 Pass, 0
Fail, 3 Not run**; PI is **2/6 Done (33.3%)**. The shipped Designer still uses
AGRUN until PI-02 through PI-05 integrate and qualify the replacement. Release
approval, live Provider, platform, physical print and deployment evidence remain
open; no deploy, push or Production Ready claim was made.

## Decision and next action

G1 through G5 are checked because the direct-transport owner, current AGRUN
callers, package imports, browser boundary, vault invariant and six acceptance
cases were identified, implemented, exercised in the three configured browser
engines and handed off without changing the shipped AGRUN Designer. The next
small action is S15 / PI-02 host tools, events, prompts, budgets and approval
integration.
