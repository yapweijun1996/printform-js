# Gallery Viewer Toolbar

The Gallery document viewer keeps the existing controls and selectors while presenting them as three intentional groups:

- Desktop (`>=768px`): Settings and Read are grouped at the left, zoom controls are centered, and page navigation is aligned right in one row.
- Compact (`<=767px`): multi-page documents use an ordered two-row layout (modes/pages, then zoom); single-page documents stay in one compact row.
- Every interactive toolbar target remains at least 44px high. The zoom field and percent unit share one compact visual control, while the native number input remains available to keyboard and assistive technology users.

The preview canvas now uses a light/dark surface token and a subtle stage shadow. These styles belong to the Gallery shell only; the embedded print document, page measurements, print action, and source settings are unchanged.

## Interaction contract

The public selectors remain `[data-settings]`, `[data-read]`, `[data-preview]`, `[data-out]`, `[data-zoom]`, `[data-in]`, `[data-presets]`, `[data-page]`, `[data-prev]`, `[data-next]`, and `[data-page-total]`. Settings/Read mode, page jumps, zoom commits and presets, Escape-to-close, focus return, and source-frame keyboard panning retain their existing behavior.

## Verification

The focused toolbar suite covers PF-042 (five pages) at 1024px, 1920px, 320px, 390px, and 767px, short viewports at 320x375, 568x320, and 667x375, PF-061 (single page), light/dark color schemes, English/Chinese accessible names, control bounds, no page overflow, page jumps, zoom commits, settings/read transitions, keyboard panning, and preset focus behavior.

Run the focused suite with a local server on an isolated port:

```text
npm run build:assets
npx playwright test e2e/gallery-viewer-toolbar.spec.js --config=<external viewer-playwright.config.mjs>
```

The implementation was also checked against the existing viewer, compact, focus, and accessibility suites. The before/after visual evidence is stored outside the repository at `C:\Users\tno\Documents\GitHub\output\gallery-followup\viewer\`.

See [aggregate verification](GALLERY_FOLLOWUP_VERIFICATION.md) for cross-browser results and limits.
