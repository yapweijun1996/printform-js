# Gallery follow-up verification

Scope: GAL-01 through GAL-04 from the 2026-11-05 Gallery task board.
These results do not close historical Studio release gates or certify physical
printing, Safari.app, or iOS standalone behavior. Implementation is local;
the modified code has not been deployed.

## Delivered behavior

| Task | Result | Owning documentation |
| --- | --- | --- |
| GAL-01 | PF-068 has one shared border between adjacent repeated main/recovery headings. A recovery heading elsewhere retains its top edge. | [Header patterns](GALLERY_HEADERS.md) |
| GAL-02 | Existing repeated document headings and per-table child headers support a main heading above the active child on continuation pages. No engine API change was needed. Arbitrary nested hierarchies and multiple headers sharing one ID remain unsupported. | [Header patterns](GALLERY_HEADERS.md) |
| GAL-03 | Checking, preparing, prolonged preparation, ready, failure and offline states are distinct. Registration/update waits are bounded; late installation success/failure remains observable. Six concurrent precache workers retain every SHA-256 check and drain before failed-cache cleanup. | [Update evidence and limits](GALLERY_UPDATE_PERFORMANCE.md) |
| GAL-04 | Desktop preview controls occupy one row: modes left, zoom center, pagination right. Narrow layouts retain all controls, keyboard operation and 44px targets. Canvas surfaces and shadow separate the paper visually. | [Viewer contract](GALLERY_VIEWER_TOOLBAR.md) |

## Independent manager checks

- Windows Chromium: 46 viewer, focus, presets, source-setting, print-geometry
  and toolbar cases passed.
- Windows Firefox/WebKit: all 42 selected viewer/state/accessibility cases
  were covered by passing runs. The first Firefox accessibility attempt exposed
  `43.999984px` versus `44px` floating-point precision; rounding geometry to
  two decimal places preserved the 44px requirement and its rerun passed.
- Header/payment/accessibility selection: 13 passed across Chromium, Firefox
  and WebKit; two PDF cases were explicitly skipped because Playwright PDF
  generation is Chromium-only. The Chromium PDF contains six pages. All 200
  source/rendered recovery IDs, text and order match, with one signature area.
- Header proof covers one repeated global main heading plus two child tables,
  active-child transitions, keep-with-first-row, and 0/1/20-row variants.
- Chromium active-table, original-worker migration, update, offline, failed
  asset/integrity, retry and old-tab regressions: nine passed. After the final
  slow-update edge fix, the actual A-to-B lifecycle passed again.
- Focused controller/precache/active-table units: 28 passed.
- Isolated Ubuntu WSL, locked dependencies, Node 24.22.2: runtime build and
  complete site build passed. Full Vitest: 313 files / 3754 tests passed;
  one Docker integration file / nine tests skipped. Duration: 519.39 seconds.

The fresh production observation is recorded separately from local fixes:
the existing live build still showed checking at 47.3 seconds while its worker
was installing. A partial cache sampled during that installation is not a
complete-release payload measurement. No production speedup is claimed.

## Reproduction and artifacts

Use `npm ci`, `npm run build:assets`, then the focused Playwright files with
an isolated server/config. Build the site before exercising its real offline
worker; an unbuilt source worker intentionally refuses installation.

The manager's external config, live timing JSON, source patches and worker
summaries/screenshots are under `../output/gallery-followup/` relative to the
repository root. Browser checks used isolated local ports and fresh contexts.

Relevant test files:

- `e2e/payment-certificate.spec.js`
- `e2e/gallery-viewer-toolbar.spec.js`
- `e2e/gallery-document-state.spec.js`
- `e2e/gallery-document-accessibility.spec.js`
- `e2e/gallery-upgrade.spec.js`
- `e2e/gallery-legacy-migration.spec.js`
- `e2e/gallery-topbar-update.spec.js`
- `tests/gallery/update.test.js`
- `tests/gallery/sw-precache.test.js`
- `tests/active-table-context.test.js`

Rollback is a focused revert of this follow-up's source changes. Do not clear
user storage or delete old Gallery caches as a default recovery action.
