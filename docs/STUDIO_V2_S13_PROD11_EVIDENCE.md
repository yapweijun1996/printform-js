# Studio v2 S13 / PROD-11 evidence

Date: 2026-09-09
Step: S13 / PROD-11 bounded maintainability
Status: **Done, 100% (G1/G2/G3/G4/G5)**
Source baseline: `main` at `3a1a7dbb93de5edd7984842896afdaab42a92bed` plus the shared worktree delta

## G1 — investigation and frozen acceptance

At G1 (before the bounded extraction), the implementation had two separate
maintainability boundaries:

- `studio/studio.js` was the frozen Studio v1 browser entry, loaded only by
  `studio/index.html`. It was 1491 lines and owned state, i18n,
  configuration controls, HTML synthesis, structure editing, data binding,
  preview/inspector messages, export, template loading, responsive controls
  and boot wiring.
- `src/printform/formatter/pagination-render.js` was imported only by
  `src/printform/formatter/PrintFormFormatter.js`. It was 389 lines and owned
  the row loop plus the empty-document path. The existing formatter modules
  already establish attach-method ownership.

The target is a bounded responsibility split, not a product redesign:

1. Keep the legacy v1 entry behavior and its HTML protocol unchanged while
   moving state, config/document/preview/template/action/responsive owners into
   small browser modules. Keep every amended file at most 300 lines.
2. Keep `PrintFormFormatter` and pagination output unchanged while moving the
   special-row branch behind a focused helper and retaining the public attach
   contract. Do not introduce a `PaginationSession` or alter page policy.
3. Record any remaining oversized non-target documents separately; do not use
   them to waive the amended-file rule.

Frozen acceptance cases:

- 11-01: all amended S13 modules are <=300 lines and the import/attach graph
  remains single-owner.
- 11-02: v1 plain preview and raw structure mode keep the existing two-test
  browser contract across Chromium, Firefox and WebKit.
- 11-03: formatter golden samples and core pagination smoke keep page, row,
  PTAC/PADDT and late-script invariants.
- 11-04: focused unit/static/build checks pass and no canonical revision,
  scope, privacy, approval, export or protocol behavior is changed.

Required checks: focused syntax and unit checks, v1 and formatter browser
regressions in the configured three engines, `npm run check`, a final build/site
copy check, line counts for all amended files, `git diff --check`, and a scoped
diff review. Full release/platform/print/provider evidence remains outside S13.

## G2 — bounded implementation

- The public v1 HTML entry is unchanged in structure; `studio/index.html` now
  loads the same entry as an ES module. `studio/studio.js` is a 162-line
  composition entry, with state, DOM, i18n, config, data, document, preview,
  template, action and responsive owners split into focused modules.
- `pagination-render.js` is a 6-line attach adapter. Row placement and the
  empty-document path are in `pagination-render-rows.js`; the subtotal/footer
  branch is in `pagination-render-special.js`. `PrintFormFormatter` keeps the
  same import and attach contract.
- No canonical revision/CAS, FormSpec scope, Unknown/Real privacy, human
  approval/export or public protocol behavior was changed.

## G3 — verification

- `npm run check`, `node --check` for every amended S13 JavaScript module and
  `git diff --check` passed. The final `npm run build:site` passed **105 test
  files / 564 tests**, then `npm run build:assets` and `node
  scripts/build-site.mjs` passed; the generated PI-00 qualification bundle is
  **823,439 bytes** and the service-worker manifest contains 162 entries.
- Every amended S13 source and evidence file is <=300 lines. Existing
  unrelated oversized documents are not used as an exception or release claim.

## G4 — browser acceptance

- 11-02: `e2e/studio-v1.spec.js` passed **6/6** (two v1 cases across
  Chromium, Firefox and WebKit), covering plain preview and raw structure mode.
- 11-03: `e2e/golden-pagination.spec.js` and
  `e2e/core-pagination.spec.js` passed **16** with **2 expected skips** in the
  configured three-engine matrix; page, row, PTAC/PADDT and late-script
  invariants executed successfully.

## G5 — handoff

S13 evidence and affected authority documents are synchronized. Plan closure is
**61.9% (1300/21)** with **13/21** steps Done; P0 remains **32/35 Pass, 0 Fail,
3 Not run**; PI remains **1/6 Done**. S14/PI-01 direct browser BYOK is the next
dependency-ready step. Release approval, live Provider, platform, physical
print and deployment evidence remain open; no deploy, push or Production Ready
claim was made.
