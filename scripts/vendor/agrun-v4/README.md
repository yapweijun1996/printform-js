# Compatible AGRUN V4 CSP-safe source build

The Studio retains the distribution commit `c631669ac927ff734a37eeef863941f040445182`
and its 119 exported names/types. This is a source-derived bundle, not a V5 upgrade
or an edit to minified upstream code. The original upstream bundle SHA-256 remains
`377b8fd0186fdef8e5e521c1b6fd69ebe4f2ed18538cb3c4c76948f34e906195`.

`inputs.json.gz` contains 675 fixed source files. `manifest.json` records the
original download URLs, archive hashes, source-map hash, and input/patch hashes:

- ESM modules come from that exact distribution commit. Each extracted file was
  compared with its Git tree blob SHA-1.
- Bundled dependencies come from that commit's `agrun.min.js.map` sourcesContent.
- Missing dependency barrels come from Zod 4.3.6 and OpenTelemetry API 1.9.0 npm
  archives. Every overlapping module was compared byte-for-byte with the map.
- The distribution's existing runtime build ID is `ee53fdabf-dirty`; this rebuild
  does not claim access to a clean authoring repository or its original lockfile.

The only behavior patch changes Zod's initial `globalConfig` to `{ jitless: true }`.
It runs before SDK schemas initialize. Merely setting that flag after importing
the SDK is too late: its `Function` probe has already produced a CSP violation.
Schema validation uses Zod's existing interpreter. The production CSP, sandbox,
transport, authorization and runtime session interface are unchanged.

The build uses the already installed Vite 8.1.5, Rolldown 1.1.5 and esbuild 0.28.1.
Its resolver rejects imports outside the fixed inputs. The final standard minify
pass encodes template literals as strings to keep the generated file within the
repository's line limit. There are no external imports in the resulting UMD.

From the repository root:

```sh
npm run build:agrun -- --check
npm run check:agrun
```

Both commands rebuild from local fixed inputs; no network or install is needed.
The integrity check verifies the original pin, exact approved patch, source and
recipe provenance, tool versions, byte-identical rebuilt output, derived SHA-256,
SRI and HTML script integrity. `build:agrun -- --apply` writes only the rebuilt
vendor bundle; a reviewed provenance/SRI update is still required if inputs change.

`check:agrun:upstream` still reports upstream drift against the original upstream
hash. `sync:agrun -- --apply` refuses to replace this derived bundle: the current
upstream V5 has incompatible exports and requires a separately reviewed migration.

Tests exercise all export names/types, strict no-eval initialization, the original
unpatched negative control, tampered provenance, the real streamed action-result
loop, media transport and provider policy rejection. The three-engine strict-CSP
probe compares real session initialization and valid/invalid provider schema
behavior between patched and unpatched full source builds. The unpatched control
must produce an eval violation; the patched build must have zero CSP violations
and zero console errors, with equal functional results.
