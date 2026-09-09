# Studio v2 S12 / PROD-09 evidence

Date: 2026-09-09. Scope: the current uncommitted worktree after S11 closure.
Status: **Done, 100%** for the retained current workspace. This record validates the
current behavior without silently adopting the separate proposed reorganization or
changing the P0 denominator and release authorization.

## Frozen acceptance cases

- **09-01 real edit round-trip:** open the structured source editor, edit a real Manifest value, review the diff, apply it, observe one canonical revision advance and the new value in the isolated preview; cancellation must leave the draft unchanged.
- **09-02 desktop export visibility:** at the declared desktop viewport, the primary production export and readiness state remain visible and correctly positioned with the source editor and inspector states exercised.
- **09-03 resizable desktop rail:** the opened inspector remains a right-side rail; its keyboard resize bounds change the rail without covering the preview or moving the export action outside the topbar.
- **09-04 mobile workspace:** supported narrow viewports have no document-wide horizontal overflow; the stacked source/preview workspace and full-width inspector overlay remain reachable and usable.
- **09-05 five UI locales:** all five supported UI locales update the workspace labels and accessibility attributes without changing the document revision or print locale; the source editor remains usable.
- **09-06 focus and Tab behavior:** opening and closing source/inspector panels restores focus to the invoking control, inspector tabs remain keyboard-selectable, and the open narrow inspector keeps Tab traversal inside its active surface.

## G1 investigation and current/target

- Owners traced: `studio-v2/index.html` owns the workspace regions and stable controls;
  `styles/layout.css` owns desktop/tablet/mobile geometry; `ui/app-bindings.js` owns
  editor/inspector open state, focus restoration, tab selection and the narrow-panel
  focus loop; `ui/inspector-resize.js` owns the desktop rail width; `ui/editor-panel.js`
  owns source round-trip; `ui/app.js`/`ui/render-controller.js` own current revision,
  render and export-readiness propagation.
- Current: the source editor is on-demand, the central preview is isolated, the
  inspector is a fixed right rail on desktop and a full-width overlay below the
  desktop breakpoint, the topbar reserves rail space, and the existing tests already
  cover portions of responsive, locale and focus behavior.
- Target: prove the six composed cases against the actual built site while preserving
  canonical revision/CAS, private human export, Unknown/Real privacy, existing records,
  protocol compatibility and the existing defaults.
- Decision boundary: the production plan's alternative workspace reorganization is
  **not adopted** by this step. If current acceptance passes, the evidence will retain
  the current layout as the verified default and leave any consequential redesign
  pending explicit maintainer adoption.
- Dependencies S08, S10 and S11 are Done. Required checks are the six real-browser
  cases across configured Chromium, Firefox and WebKit, focused UI/i18n checks, the
  existing responsive/topbar regressions, syntax/build checks and a final line-count
  review. Edge, Safari.app, physical print, live Provider and deployment retention
  remain outside S12.

## Case 09-01 result

`e2e/studio-v2.spec.js` (`shows a side-by-side diff before applying a manual source edit`)
passed **3/3** serially across Windows Chromium, Firefox and WebKit. The actual structured
editor showed a real Manifest diff; cancelling left the canonical revision at r0, while the
explicit second Apply advanced it to r1 and rendered the edited title in the isolated preview.
The no-op reapply path remained a truthful no-change outcome. No functional pageerror or
unknown browser diagnostic occurred; no source/runtime change was needed for this case.

## Case 09-02 result

`e2e/studio-v2-topbar.spec.js` passed **3/3** serially across Windows Chromium, Firefox and
WebKit. The actual topbar stayed one row at the desktop/tablet breakpoints, kept the primary
export inside the actions region at the 1440px desktop viewport, and preserved the readiness
chip. The same run exercised the More/export menus and inspector launcher/close cycle; no
functional pageerror or unknown browser diagnostic occurred. No source/runtime change was
needed for this case.

## Case 09-03 result

The new `e2e/studio-v2-s12-prod09.spec.js` rail case passed **3/3** serially across
Windows Chromium, Firefox and WebKit. At 1440x900 the open inspector remained anchored
to the right edge, the preview stopped before the rail, and the production export stayed
inside the topbar. Keyboard ArrowLeft widened the rail and End returned it to the 320px
minimum without document-wide overflow. The first Chromium attempt read during the
open-panel CSS transition; the test now waits for the stable transform, and the corrected
single-engine plus three-engine runs passed. No product source change was needed.

## Case 09-04 result

The new `e2e/studio-v2-s12-prod09.spec.js` mobile case passed **3/3** serially across
Windows Chromium, Firefox and WebKit at 375x812. The stacked editor/preview remained
reachable, the document had no horizontal overflow, and the inspector opened as a
full-width overlay with its active controls available. Escape closed the overlay and
returned to the still-visible editor. The first run only exposed a test assertion that
expected `translateX(0)` to serialize as `none`; the corrected boundary assertion passed
without a product source change.

## Case 09-06 result

The new `e2e/studio-v2-s12-prod09.spec.js` focus case passed **3/3** serially across
Windows Chromium, Firefox and WebKit. Opening and closing the inspector and source
editor restored focus to their invoking controls; ArrowRight selected Quality then
Agent; and at 375px the active inspector's Tab sequence wrapped from its last
focusable element to its first. The first matrix run exposed two test-only timer and
anonymous-control assumptions; after waiting for the existing 400ms restore window and
using DOM markers rather than IDs, the corrected case passed without a product source
change.

## Case 09-05 result

`e2e/studio-v2.spec.js` (`switches the Studio UI across five languages without changing
the document`) passed **3/3** serially across Windows Chromium, Firefox and WebKit. The
actual UI switched through en-MY, zh-CN, ms-MY, ja-JP and vi-VN; editor labels and the
document language attribute changed, while the document revision and print locale stayed
unchanged. Focus remained on `manifest-editor` during each refresh and the source editor
remained usable after reload. No functional pageerror or unknown browser diagnostic
occurred; no source/runtime change was needed.

## Case status

09-01 through 09-06 are **Pass**. The six-case browser matrix is complete at **18/18**
configured-browser executions.

## Gate status and next action

- G1 **10/10 checked**: owners, dependencies, current/target behavior, six cases and
  required checks are recorded above.
- G2 **50/50 checked**: the retained current layout satisfies the six in-scope workspace
  behaviors; no layout redesign or alternate transaction/persistence authority was added.
- G3 **80/80 checked**: the focused UI/i18n set passed **5 files / 35 tests**; the new
  S12 spec passed syntax validation, `npm run check` passed and `git diff --check`
  reported no whitespace error.
- G4 **95/95 checked**: the six composed cases passed **18/18** across Chromium,
  Firefox and WebKit; the existing editor/inspector responsive regressions passed
  **12/12** across the same engines. Unit and mock results were not used as substitutes.
- G5 **100/100 checked**: this record, TASK, the production plan, release checklist,
  gap audit, direction/index/roadmap summaries and implementation evidence are
  synchronized. The retained current default is locally verified; the alternative
  proposed reorganization and release-profile adoption remain visibly open. No print,
  Edge/Safari.app, live Provider, deployment retention or Production Ready claim is made.

Next dependency-ready step: S13 / PROD-11 bounded maintainability. Preserve the current
defaults and all canonical/privacy/approval boundaries; do not deploy or publish.
