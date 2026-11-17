# Gallery SVG and Studio AI layout — logic review

Date: 2026-11-17. Scope: user-requested Gallery SVG consistency and Studio v3 AI-panel layout improvements. The user requested an independent advisor review, documentation, task tracking and a separate main-branch push after each completed task.

## Current task state

| Task | Implementation | Verification / publication |
| --- | --- | --- |
| GALLERY-SVG | Fixed SVG paths replace settings, zoom, page-navigation and disclosure glyphs; update status and spinner use SVG. `js/icons.js` is explicitly included in the versioned Gallery shell. | Task-specific Chromium/Firefox checks passed; accepted for its separate main-branch commit. Broader residual failures are recorded below. |
| STUDIO-AI-LAYOUT | Removed full-height conversation placeholder; compact reference cards and contextual empty-state text; retained a single scroll surface and fixed composer. | All six Chromium/Firefox, three-size reference-layout scenarios passed. Ready for its separate task commit after Gallery; publication is independently checked. |

## Independent review method

The advisor read the source and full current diff, inspected the 1440px and 390px two-reference browser screenshots, and reviewed both new browser specs. This review does not execute a model, certify coding-agent readiness or replace test-run results. Test counts below are explicitly attributed to the implementation agent unless directly inspected.

## Logic assessment

### Gallery

- `gallery/js/icons.js` contains fixed artwork only. No user values are interpolated into SVG paths. Owning controls retain accessible names, while SVGs are hidden from assistive technology.
- `document-viewer.js` retains its click handlers and localized labels. Removing the settings `textContent` assignment prevents language changes from deleting the SVG.
- Existing print, close and scroll-to-top SVGs remain. Document artwork, mathematical symbols and catalogue thumbnail images are outside the interface-glyph replacement scope.
- The first build omitted the new module from the versioned shell. `scripts/gallery-pwa-build.mjs` now adds `js/icons.js` to the explicit shell inventory, preserving version pinning, file existence checks, hash verification and precaching. Recursive enumeration covers design assets, not arbitrary `gallery/js` modules; an earlier advisor assumption to the contrary was corrected.

### Studio AI panel

- `[data-ai-log]` previously consumed at least the entire shared scroll height, then placed context after it. Removing that minimum lets references follow actual conversation content; `.ai-conversation-scroll` remains the sole content scrollbar.
- Composer remains a non-shrinking sibling, with a top border. The short-window and safe-area rules remain; mobile reference actions now have 44px targets.
- Reference comments retain nested labels, explicit accessible names, maxlength and existing values. Payload validation, scope/revision checks, invalid-reference blocking, busy state and apply authority are unchanged.
- The count and contextual introduction are display projections only. Conversation rerendering replaces the log, not reference inputs, preserving their focus and values.
- The two inspected screenshots show readable references at the top of the content area and a fully visible composer. Remaining blank space follows short content and does not obstruct controls. Screenshot evidence does not cover a real mobile keyboard or all eight-reference states.
- `docs/studio-v3-agent-release/review.json` preserves its baseline, version and 39 disposition slots. The updated evidence describes the transitive UI impact rather than granting new tool authority. Its automated digest checks passed: 22 tools, 13 operations, four skills, 129 examples and 39 reviewed changes.

## Findings by severity

### Blocker resolved — fractional measurement checks rerun

The interim test diff replaced fractional `DOMRect` heights/gaps with integer `offsetHeight`/`offsetLeft`/`offsetWidth`. The advisor rejected that method because integer rounding can both accept genuinely undersized controls and reject valid spacing. The final diff restores `DOMRect` and explicitly permits only 0.0001 CSS px of subtraction noise for the existing 44px-height and 8px-gap checks. This addresses observed values such as 43.999969 and 7.999954 without accepting the materially smaller 43.6px/7.6px cases. This is a documented precision tolerance, not a claim that every original assertion is byte-identical. The corrected modal and filter checks passed in the focused rerun.

### Consider — input and scrolling coverage

- Test existing conversation plus eight references while editing comments: old automatic follow-to-end logic also sees the shared context area. The new no-message layout test preserves comment values but does not establish every populated-conversation path.
- A single wheel delta of 100000 reportedly scrolls only 449px of a 21915px page in Firefox on both baseline and changed code; repeated ordinary 1000px gestures reach the bottom. The reviewed final test uses at most 80 ordinary 1000px wheel gestures with 50ms rendering intervals, preserving the original bottom-distance <2px and exact top=0 assertions. No direct scroll assignment or success shortcut was introduced. The original failure remains in the history; ordinary-wheel checks passed in both browsers.
- The final settings artwork uses a standard gear silhouette.

### Noted — valid test maintenance

- The unchanged source manifest has 68 entries including PF-068. Replacing stale hardcoded 67 counts with independent manifest-derived expectations is appropriate; `e2e/gallery-catalog.js` does not import the product sorter. Catalogue order, offline filtering, lazy-loading and geometry assertions remain present.
- Reading topbar and status bounds in one browser evaluation prevents two snapshots straddling a sticky-bar transition. Waiting for the update control to be enabled and focused verifies the real keyboard preconditions.
- The SVG test exercises accessible names, EN/ZH transitions, zoom, preset Escape and focus restoration. The reference test covers three viewport sizes, two/eight references, comment retention, removal, composer visibility and unchanged revision without making model requests.

## Verification and acceptance boundaries

- Full unit run: 313 files passed, one skipped; 3754 tests passed, nine skipped. Assets and site build passed after explicitly packaging the new icon module. Release review digests passed without resetting the baseline.
- Broad Chromium/Firefox regression: 294 cases, 282 passed, 11 failed and one not run. This is not an all-green suite. Gallery SVG passed in both browsers; Studio two/eight-reference checks passed at 1440x900, 390x844 and 768x600 in both browsers (six cases).
- Focused final measurement/keyboard/scroll rerun: 46 cases, 42 passed and four PF062 failures. All 12 modal-control, four topbar-update, filter-height and ordinary-wheel checks passed. PF062 keyboard-end failures occurred in Chromium desktop/short and Firefox short; Firefox mobile relies on unavailable CDP.
- Bounded PF062 A/B used the same Arial-compatible font configuration and routed original `83654c7` viewer source/styles versus the candidate. Original: three passed, Chromium short failed the same bottom-distance assertion. Candidate: four passed. This demonstrates an existing intermittent failure, not universal scroll qualification; earlier failures remain recorded.
- Firefox touch-emulation pointer tests remain limited: an isolated plain HTML button with `hasTouch`/`isMobile` emitted mousedown/click without pointerdown, unlike the non-touch context. The broad run also failed Firefox service-worker enumeration and the CDP-only native-mobile path; these surfaces remain unverified.
- The existing Studio mobile-shell test failed at 320x568 (toolbar width 324px). This is outside the changed AI-context layout and its cause remains unclassified; it is not closed by the new three-size tests.
- WebKit cannot launch because required host libraries are absent. Physical/mobile keyboards, populated-conversation/eight-reference interaction, real-model output, physical printing and coding-runner operation are not qualified by this change.
- Initial missing-module, stale 67-item fixtures, floating-point geometry, disabled-control focus and oversized-wheel failures were retained in test history and addressed as described above. No assertions were removed to claim a green broad suite.
- Advisor reviewed logic and desktop/mobile screenshots. Acceptance is bounded to SVG controls/PWA packaging and reference-panel layout. Each task is committed/pushed separately; hosted release identity and smoke results are checked after publication.
