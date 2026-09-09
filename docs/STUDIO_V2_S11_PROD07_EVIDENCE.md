# Studio v2 S11 / PROD-07 evidence

Date: 2026-09-09. Scope: the current uncommitted worktree after S11 implementation.
Status: **Done, 100%**. G1-G5 are checked. This record closes actionable Quality
navigation only; it does not close the independent Changes/history search backlog.
It does not change the P0 denominator or substitute local browser evidence for
Edge, Safari.app, physical print, live Provider or deployment evidence.

## Frozen acceptance cases

- **07-01 source field routing:** a blocking `MIN_ITEMS` issue exposes `/sampleData/items`,
  focuses the owning source editor and explains the next action.
- **07-02 visual page/component routing:** a real overflow issue exposes page 1 and its
  FormSpec component, then selects the corresponding element in the isolated preview.
- **07-03 legacy/unlocatable fallback:** an issue with no source or visual target remains
  visible, is not given a false button, and says that the preview target is unavailable.
- **07-04 keyboard source navigation:** the source issue button accepts Enter and moves
  focus to the sample editor.
- **07-05 keyboard preview navigation:** the visual issue button accepts Space and marks
  the target inside the sandboxed iframe as selected.
- **07-06 locale behavior:** the issue message, location and next-action labels refresh in
  Simplified Chinese without changing the current diagnostic or target.

## G1 investigation and current/target

- Owners traced: `ui/status-view.js` owns Quality rendering and source-editor focus;
  `core/acceptance.js`, `core/render-diagnostics.js` and `core/runtime.js` produce
  page/component/selector details; `ui/render-controller.js` owns the current preview
  frame and revision/token; `ui/preview.js` owns the isolated bridge; `ui/app.js`
  connects Quality events to the renderer; `ui/agent-panel.js` already owns selection
  projection.
- Current gap: validation errors were category-level entries while the same render
  report kept element-level records in `validation.issues`; source-path routing existed,
  but visual targets were not rendered or navigable.
- Target: merge matching report issues at the UI boundary, preserve source fallback and
  unlocatable legacy behavior, and send only the current revision/token to the sandbox.
  No canonical project, revision/CAS, scope, privacy, approval/export or protocol owner
  changes are required.
- G1 result: S06 and S08 dependencies are Done; the six cases and required unit,
  browser, build and line-limit checks are frozen above.

## Implementation and compatibility

- `status-view.js` expands category errors with matching `validation.issues`, renders
  localized location/reason/next-action details, uses native keyboard-accessible buttons
  only for actionable targets, and retains the 30-entry display cap.
- `preview-issue-navigation.js` is injected into the existing isolated bridge. It checks
  revision and request token, resolves page-scoped selectors with component/table/id
  fallback, selects and scrolls the target, then reports selection through the existing
  preview channel.
- `render-controller.js` posts the navigation command only to the current iframe; `app.js`
  listens to the Quality event. Existing selection, candidate, report provenance and
  human export boundaries remain unchanged. All amended/new S11 files are at most 300
  lines; `preview.js` remains exactly 300 lines.
- The browser fixture places its overflow canary in the registered repeating header and
  scopes the assertion to the first page clone. The initial root-level canary was correctly
  dropped by pagination, and the intermediate duplicate-id assertion was corrected; neither
  failure is counted as a product pass.

## Case and focused results

- `npx playwright test e2e/studio-v2-s11-prod07.spec.js --workers=1` passed **6/6**:
  07-01 and 07-02 each passed in Chromium, Firefox and WebKit. The run took 47.5 seconds;
  it observed `/sampleData/items`, page 1/component metadata, Enter-to-editor focus,
  Space-to-preview selection, and the `zh-CN` labels. Firefox's known AGRUN CSP eval
  diagnostic remains explicitly filtered by the existing test policy; no functional
  pageerror or unknown browser diagnostic occurred.
- `npx vitest run tests/studio-v2/status-view.test.js tests/studio-v2/preview.test.js
  tests/studio-v2/render-controller.test.js --maxWorkers=1 --no-file-parallelism`
  passed **3 files / 20 tests**. This covers report-issue merging, unlocatable fallback,
  keyboard-capable source buttons, bridge revision/token checks and controller routing.

## Gate closure

- G1 **10/10**: owners, dependencies, current/target behavior, six frozen cases and
  required checks are recorded above.
- G2 **50/50 cumulative**: actionable source/visual routing, fallback, locale labels,
  keyboard behavior and revision/token-bound sandbox navigation are implemented and
  reviewed without changing canonical data or approval boundaries.
- G3 **80/80 cumulative**: the focused S11 set passed **3 files / 20 tests**; the final
  serial build passed **105 files / 564 tests**; `npm run check`, selected `node --check`,
  `git diff --check` and the <=300-line inventory passed after this record was synchronized.
- G4 **95/95 cumulative**: the required real-browser S11 matrix passed **6/6** across
  Chromium, Firefox and WebKit. No mock or unit result substituted for the browser cases.
- G5 **100/100 cumulative**: TASK, production plan, release checklist, gap audit,
  implementation evidence and navigation summaries are synchronized with this record.
  Production remains Pilot/not approved; print/provider/platform/deployment evidence is open.

## Remaining and next

S11/PROD-07 actionable Quality is closed for its declared scope. Independent
Changes/history search remains E14-UI-05 backlog. The next dependency-ready step is
S12/PROD-09 workspace acceptance. Preserve the current FormSpec scope, canonical
revision/CAS, Unknown/Real restrictions, existing records and private human export.
