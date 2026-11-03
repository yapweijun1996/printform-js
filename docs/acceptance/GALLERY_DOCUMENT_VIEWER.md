# Shared Gallery Document Viewer

## Behavior

- Preview is the initial mode on mobile and desktop. Settings is separate and retains the original source controls and event handlers.
- Fit width uses actual rendered physical-sheet bounds, including paper padding, and never enlarges beyond 100%. Fit can be below 50%; manual zoom is 50–200%.
- Zoom transforms the source iframe's screen presentation, not the page nodes. Source column widths, pagination inputs and source settings remain unchanged.
- The reading viewport owns scrolling and panning. An absolutely positioned iframe is clipped inside a stage whose layout extents equal the measured paper union times the presentation scale.
- Previous/Next and page input use the current rendered physical sheets, not manifest page counts. Fit responds to viewport and source-layout changes.
- Page jumps accept only finite integers within the rendered page range; invalid, empty, fractional and out-of-range entries restore the current page.
- Layout/font observers preserve an actively edited page input until commit, so a late measurement cannot silently replace a pending jump with the previous page.
- Settings can reflow the source; zoom cannot. The settings hint states this distinction in English and Chinese.
- Only known source chrome (`body > .toolbar`, `body > nav.controls`) is marked. Duplicate source Print is hidden only there. Injected overrides are exclusively `@media screen` and scoped to viewer markers.
- The original source document, annotations, form fields, scripts and print page order remain intact. No projected document, cloned script, or rewritten financial table is used.
- The source context is held at 1440 CSS pixels to avoid inheriting mobile preview layout constraints. Source paper rectangles account for existing screen zoom, padding and centered ancestors.
- Print requires the processed flag, available controller readiness flags, an enabled source Print control, no source error, and ready body state where supplied. Busy/error states disable outer Print; changes and recovery are observed.
- The existing session-owned iframe replacement, stale-event guard, native modal, cross-document Escape, focus trap and background restoration remain in place.
- Mobile uses the safe-area-adjusted dynamic viewport. Controls have 44px minimum targets. Short landscape uses a horizontally scrollable control strip.
- `js/document-viewer.js` is in the version-pinned Gallery precache.

## Verification entry points

Use the installed browsers and a freshly built site artifact:

```sh
npm run build:assets
node scripts/build-site.mjs
npx playwright test e2e/gallery-document-viewer.spec.js \
  e2e/gallery-document-state.spec.js \
  e2e/gallery-document-accessibility.spec.js \
  e2e/gallery-mobile-preview.spec.js \
  e2e/gallery-preview.spec.js \
  e2e/gallery-modal-controls.spec.js
npx playwright test e2e/gallery-mobile-offline.spec.js
```

The browser runner's base URL and installed browser executable must match the local verification environment. No browser download is necessary.

Coverage:

- PF065/PF066 real left/right paper edges at 375×667 and 390×844; visible document on initial open.
- Atlas 50/100/200% zoom, right pan boundary, last-page navigation and rendered count.
- Desktop narrow-paper default 100%, manual 200%, phone landscape fit below 50%; invalid page inputs and fresh/sequential PF048 last-sheet visibility after Tab, including resize during editing.
- School A4→A5 changes, long/short datasets and preserved field values.
- Aster/Atlas source formatter failure, disabled outer Print, original Reset handlers, recovery and current rendered count.
- PF063/PF065/PF066 `@media print` paper geometry and full paper text compared with unmodified standalone pages after 200% viewer zoom.
- Real wheel, keyboard and Chromium touch scrolling; modal lifecycle, late source events, focus/scroll restoration, language changes, short landscape and enlarged text.
- Version-pinned offline reload.

Print evidence is browser print-media geometry/content parity, not physical printer testing. Full release gates, independent catalogue acceptance and deployment remain manager-owned. Firefox's known host launch failure must not be bypassed by disabling its sandbox.

## Changed semantics in existing tests

The source iframe is now the scaled browsing context, not the reading viewport. Scroll assertions therefore target `.document-viewport`; its scroll height must match the scaled stage (or the available viewport when the document is shorter). Source settings assertions open the outer Settings UI. Asynchronous native dialog close is awaited before checking the exact saved scroll position. The mobile viewport budget includes the explicit 44px viewer controls; real paper-edge tests prevent an iframe-bounds-only false pass.

## Independent acceptance evidence

Verified against source `9deeedb` before release, using browser emulation rather than physical phones:

- [x] 375×667 and 390×844: PF065/PF066 actual paper edges fit the first reading viewport.
- [x] PF065: source settings are separate; the document is visible immediately.
- [x] PF066: 50/100/200% zoom reaches the horizontal boundary and last sheet; a real numeric amount was brought fully into view at 200%, followed by Chromium touch panning.
- [x] A4 portrait/landscape and a real A4→A5 source setting change fit correctly. A5 preview and print-media parity were checked in Chromium and WebKit.
- [x] Scaled stage extents match the paper union; resize, invalid input, editing races and Previous/Next at the clamped scroll limit have regression coverage.
- [x] All 67 print-media page counts/dimensions and canonical paper text match the original standalone baseline. Eight PDF comparisons (four documents × 50/200%) also match page size, all extracted text and text positions.
- [x] Keyboard, touch emulation, wheel scrolling, Escape, focus/scroll restoration, 44px targets, enlarged text and lifecycle recovery pass.
- [x] 67 expected, 67 unique, 67 passed in the independent final catalogue audit: fit, first-sheet visibility, full paper-text hash, last-page navigation and print geometry; no page errors.

Final browser runs: 38 new-viewer cases across Chromium/WebKit plus 39 Chromium regression cases, all passing without retries/skips; a separate real service-worker-controlled offline reload also passed. No design HTML, authoring assets or pagination-engine files changed.

The PDF method uses an actual rendered iframe DOM snapshot with viewer screen styles retained and scripts removed to prevent a second render. It is not a native OS print-dialog or physical-printer test. Real iOS/Android, actual browser-chrome zoom and the host-blocked Firefox remain unverified; 200% root text and application zoom are separate tested surfaces. Card typography/scanability and update-feedback polish are not part of this P0 viewer delivery.
