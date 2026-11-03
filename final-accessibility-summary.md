# Final accessibility regression batch

- The document navigation test now handles a rendered single sheet without interacting with hidden page controls; multi-sheet last-page assertions remain unchanged.
- Escape from the active source iframe closes an open preset menu first; without a menu it still closes the dialog. Obsolete frame documents are guarded.
- Returning from Settings focuses the reading viewport, enabling keyboard panning. The Settings flow and hidden Read control are unchanged.
- RED: both new Chromium regression tests failed on the original behavior (modal closed, viewport not focused). GREEN: fresh `node scripts/build-site.mjs`, then the new tests, `gallery-document-navigation.spec.js`, and `gallery-compact-focus.spec.js` passed on Chromium and WebKit: 24/24. No full suite was run.
- Logs: `/tmp/final-accessibility-scratch/red.log`, `green.log`, `build-red.log`, and `build-green.log`. Tests used the existing server on port 4187 and `controls-playwright.config.cjs`; the local Chromium executable override used the installed revision 1248 because revision 1234 was unavailable.
