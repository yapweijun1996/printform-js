# Gallery compact mobile reading acceptance

## Scope

Owner approved fixing the PF061 screenshot audit priorities UI-01/UI-02/UI-03/UI-10/UI-11 through KB-MCP Auto Manager and explicitly requested GPT-6.1 Terra as coding worker. The exact runtime metadata for every coding session returned `openai-codex / gpt-6.1-terra`; the manager independently inspected and exercised the results.

This is a shared Gallery viewer improvement, not a redesigned invoice or a reflow/extracted-data reader. It changes no design HTML, authoring assets, financial data, pagination engine, paper sizes, standalone print CSS, homepage, dependencies or workflows.

## Delivered behavior

- Single-page mobile toolbar fits one row at 320/375/390/430px without horizontal toolbar scrolling or offscreen primary controls. Interactive targets remain at least 44px and zoom entry is 16px.
- Single-page Previous/Next/page-jump controls are hidden. Multi-page controls retain actual rendered counts, direct jumps and Previous/Next, including clamped end positions.
- Read / 阅读 provides one-tap natural-size 100% reading, focuses the document viewport and shows a contextual bilingual pan/scroll hint without consuming another layout row. The hint is transient and resets with the viewing session.
- Minus, percentage and Plus remain visible. Zoom Presets offers Fit width, 100%, 150% and 200%; manual zoom remains clamped to 50–200%. Fit can be below 50% and is not marked invalid by numeric constraints.
- Fit/preset selection restores visible focus. Escape dismisses an open popup first, including when focus is inside the source iframe; otherwise Escape closes the viewer. Outside pointer interaction dismisses the popup without stealing the intended target's focus.
- Settings remains separate. Back to Preview restores focus to a pannable reading viewport. New/failed document loads synchronously clear previous Settings, reading, popup and page-selection state.
- Short-landscape preset menus are not clipped by toolbar overflow; tests use actual hit testing, not only bounding rectangles.
- Mobile bottom actions use compact padding with 44px targets; Print is primary and Open Design is secondary. No unsupported Download PDF action was introduced.
- Close remains 44px with keyboard-visible focus. Fixed A4 whitespace and invoice footer positions remain unchanged; Read zooms and pans the original document rather than removing blank space or guessing totals/payment fields.

## Independent before/after measurements

Baseline public build: `9b7f7eb2552e` (PR121). Tested the four widths in English and Chinese, Chromium and WebKit: 16 cases.

| Measurement | Before | After |
| --- | --- | --- |
| Single-page toolbar | 99px | 53px |
| Mobile action footer | 61px | 53px |
| Useful reading height | Baseline | About 54px more |
| Primary controls | Two rows | One visible row, no horizontal toolbar scrolling |
| Reading entry | Percentage editing | One tap to 100%, with pan/return-to-fit controls |

The 47% figure at 375px remains correct for faithful A4 Fit Width. It is an overview, not a claim that tiny text is readable. Read explicitly switches to natural-size detail viewing.

## Independent verification

- Final behavioral browser runs: 86 viewer/accessibility cases across Chromium/WebKit plus 39 Chromium Gallery regression cases, all passing without skipped/flaky results or retries.
- Actual UI matrix: 16 cases with fitted overview, readable 100% source scale, visible in-bounds controls, viewport focus, pan and unchanged source text. Mobile WebKit automation cannot send mouse-wheel events; keyboard panning was exercised instead. Chromium wheel/touch coverage is reported separately from real-device behavior.
- Real service-worker-controlled offline reload: PF061 opens, Read reaches 100%, the 200% preset works and Fit returns to the original overview percentage.
- Catalogue: 67 expected, 67 unique, 67 passed for fitted paper edges, visible first sheet, complete paper-text hash, actual last-page navigation and original standalone print-media geometry. Single sheets are checked without trying to operate intentionally hidden page inputs.
- PF061 Read 100% and 200% PDFs match untouched public standalone PDF page count, paper sizes, all extracted text and text positions.
- Independent final source review found no confirmed P0/P1/P2 issue after the reproduced fixes. Fresh runtime asset build and site assembly passed separately.
- The complete local suite retains the known unrelated `fc-scan` WOFF2 failure: 3,741 passed, 9 skipped, 1 failed. Existing Linux Pages build is the exact-release complete-suite gate; local failure is not described as green.

PDF comparison uses an actual rendered iframe DOM snapshot retaining viewer screen styles, with scripts removed to avoid a second render. It is not native OS print-dialog or physical-printer testing. Browser emulation is not a physical iPhone/Android test; actual browser-chrome zoom and host-blocked Firefox remain unverified. No WCAG certification is claimed.

## Regression entry points

```sh
npm run build:assets
node scripts/build-site.mjs
npx playwright test e2e/gallery-compact-reading.spec.js \
  e2e/gallery-compact-presets.spec.js e2e/gallery-compact-focus.spec.js \
  e2e/gallery-compact-final.spec.js e2e/gallery-accessibility-regression.spec.js
```

Use the actual installed-browser configuration and owned server. Existing document navigation, source readiness, modal lifecycle, masonry, offline and print-parity tests remain required; relocated controls are reached through the visible preset UI, never by forcing hidden inputs.
