# Studio v3 published artifact recheck · 2026-11-20

The [public Studio page](https://yapweijun1996.github.io/printform-js/studio-v3/) served release `da4fc4236364d39ffc0db8feba5d109dd809534b`. This recheck covers G9 REL-01 publication identity and read-only browser smoke. It does not qualify real inference, human reconstruction review, release operations or physical printing.

## Artifact evidence

The live page revision, immutable asset base, app module URL and Service Worker build all named the same release. The current manifest bytes equaled the immutable manifest bytes. The manifest and 39 dependency-index entries matched the output regenerated from the exact checkout. All 25 Service Worker shell files independently matched their published SHA-256 values, including each of the six Agent manifest files. The downloaded app contained the complete published release, contract, knowledge, package and source-runner identity.

| Artifact | SHA-256 |
| --- | --- |
| Immutable app | `0dd193b9acb6ad585882cdf15d21433c44b2f894787e4f09dbcf04df779e9b68` |
| Immutable Agent manifest | `4c14b985a00a6291dc9f30bf029d4439911c8f11699c911c2ff30827958bf452` |
| Published dependency index | `4298a58697465c4101768c0dbfd4a9507ca51d538ca757b987f1bee53e903219` |
| Published Service Worker | `e0ef6549adcfe0c79b5855f29e84546dc832d28397fdff78367546b5aa668bfa` |

The published Agent package hash is `b341cd5b6f61fc8ce3f9f10f87e25441cbe73983b6bf1f7c37de7fb45f8b7b97`. The offline G8 preflight, given that live manifest via a local evidence index, found mismatches in all four profile identity fields against the historical qualification profile. It exited 1 with `qualified:false`, 3/180 recorded slots, zero supplied envelopes verified, no confidence interval, zero model calls and zero attempts written.

## Browser evidence

Fresh Chromium 151.0.7922.173 profiles at 1440×900 and 390×844 both loaded the exact immutable app. Their active Service Workers reported the exact build through the existing `VERSION` message. Both views exposed the eleven singular Open, export, file-input, data-source, AI-toggle, composer, answer-only, text-observation, pixel-observation, note-dialog and form-adoption selectors. The AI settings showed both observation permissions unchecked. The document stayed at `r0` throughout.

The preview frame's ordered source JSON was compared with the rendered page messages from that frame. Both viewports retained 45 rows across three pages, source indices 0–44, exact SKU and description text, and the same six field IDs on each row. Each page had one document header and one page-number footer. The ordered row projection SHA-256 was `82842c4b0d1750fb41602d266398d73ab501f2a413204845cf6ea800a8741335` in both views. All third-party requests and non-read HTTP methods were blocked by the browser harness. It observed zero attempted provider or other third-party requests and zero page errors in the final run.

The first browser harness run used Playwright `serviceWorkers:'block'`. On this host that setting caused Navigator accessor errors in the sandboxed preview frames. The final run restored the default Service Worker behavior and verified active worker identity. A first direct Node fetch hit this environment's egress restriction. The static verifier retried with the environment's working curl transport. The release files, browser assertions and evidence scope remained the same.

## Reproduction

Use the exact checkout to regenerate the Agent package without setting a publication baseline. Compare the local files with their public counterparts while the deployment still serves this release.

```sh
revision=da4fc4236364d39ffc0db8feba5d109dd809534b
root=https://yapweijun1996.github.io/printform-js/studio-v3
base="$root/releases/$revision"
out=$(mktemp -d)
GITHUB_SHA="$revision" node scripts/generate-studio-v3-agent.mjs --output "$out"
curl -fsS "$base/agent/agent-manifest.json" > "$out/live-manifest.json"
cmp "$out/studio-v3/agent/agent-manifest.json" "$out/live-manifest.json"
curl -fsS "$root/agent-index/dependency-index.json" > "$out/live-index.json"
cmp "$out/studio-v3/agent-index/dependency-index.json" "$out/live-index.json"
curl -fsS "$base/app.js" | sha256sum
curl -fsS "$root/sw.js" > "$out/sw.js"
sha256sum "$out/sw.js"
printf '%s\n' '{"schema":"studio-g8-preflight-index-v1","liveRelease":"live-manifest.json"}' > "$out/evidence-index.json"
node scripts/studio-v3-g8.mjs preflight docs/acceptance/STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json "$out/evidence-index.json"
```

For browser repetition, use a fresh context at each viewport, with external requests denied. Verify the active worker identity, then open the settings and Data sharing controls without dispatching a prompt. Capture rendered messages only from the live preview iframe. Use its `pf-sample-data` source and the `data-pf-row-index` and `data-v3-id` rendered attributes for the row comparison, as exercised in the [Studio pagination fixture](../../e2e/studio-v3-stu05.spec.js). This smoke does not exercise candidate mutations, rollback between supported production releases or provider attribution.
