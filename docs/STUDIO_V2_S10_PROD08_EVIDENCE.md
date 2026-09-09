# Studio v2 S10 / PROD-08 evidence

Date: 2026-09-09. Scope: the current uncommitted worktree after S10 closure.
Status: **Done, 100%**. G1-G5 are checked. This record does not
change the P0 denominator or substitute local browser evidence for print/provider/release evidence.

## Frozen acceptance cases

- **08-01 overwrite/import/switch guard:** a dirty current draft survives cancelled sample switching and cancelled HTML import; an explicitly confirmed replacement clears only the old active context and cannot receive stale work.
- **08-02 recovery round-trip:** a Synthetic committed change creates a recovery copy; reload keeps it dormant until explicit restore, then reconstructs the project without falsely certifying the recovered content or deleting the record implicitly.
- **08-03 storage and privacy boundary:** quota/denied recovery is best-effort and non-throwing; Unknown/Real documents do not create new durable snapshots, recovery copies or sessions, while existing records remain intact.
- **08-04 picker cancellation/failure/uncertain close:** picker cancellation, write failure and unconfirmed close stay truthful, do not fall back to a download or retry automatically, and do not claim Saved.
- **08-05 confirmed write/download fallback:** only a confirmed file close reports Saved; a browser download reports started/not confirmed saved; an edit during a held save leaves the newer revision unsaved and the artifact bound to the older revision.
- **08-06 recovery failure/import fallback:** corrupt, expired or rejected recovery input fails closed without crashing the editor; import validation/migration failure leaves the current document and its save state unchanged.

Required checks are the draft-cache, file-IO/export, recovery and app-boundary unit/runtime suites,
plus real Chromium, Firefox and WebKit browser coverage for each composed case. Edge, Safari.app,
physical print, live Provider and deployment retention remain release-level evidence boundaries.

## G1 investigation and current/target

- Owners traced: `ui/app.js` owns dirty/save state, sample replacement, recovery setup and bus installation; `ui/studio-actions.js` owns HTML import and export actions; `ui/draft-cache.js` owns the Synthetic-only recovery copy; `ui/file-io.js` owns picker/download sinks; `ui/studio-file-export.js` owns save outcome projection; `service-worker-upgrade.js` owns update-time draft fallback.
- Investigation finding and resolution: standard sample switching already asked before replacing a dirty draft, while HTML import lacked the same guard. `studio-actions.js` now confirms dirty import replacement and clears the cancelled file input; `app.js` now preserves a held `saving` state while marking newer changes Unsaved. Recovery writes remain Synthetic-only and best-effort; file outcomes distinguish saved, cancelled, failed, unconfirmed and download-started.
- Target: preserve the current project until explicit replacement consent, keep recovery and file outcomes truthful across asynchronous boundaries, and preserve canonical revision/CAS, privacy, existing records and protocol compatibility.
- G1 result: dependencies S03, S08 and S09 are Done; the six cases, owners, impact and required checks are frozen. The first implementation action is the import replacement guard and its actual browser case.

## Case 08-01 result

`e2e/studio-v2-s10-prod08-01.spec.js` passed **3/3** serially across Windows Chromium, Firefox and
WebKit. A real Manifest edit created revision 1 and a Synthetic recovery copy. Cancelling standard
sample replacement preserved the current revision, Manifest/template source, recovery payload and
visible Unsaved state. Cancelling HTML import showed the new localized confirmation, preserved the same
state and cleared the file input; only after explicit confirmation did the imported document replace the
active project, reset to revision 0 and enter Unknown policy. The actual page had no functional errors;
Firefox emitted only the existing AGRUN CSP eval diagnostic, which is explicitly annotated.

The focused action/i18n unit set passed **2 files / 9 tests**. The case exposed and fixed two state-owner
issues: import had no dirty replacement guard, and the app change/sample paths bypassed `setDirty()`,
leaving the visible save state falsely at Saved or stale after a replacement.

## Case 08-02 result

`e2e/studio-v2-s10-prod08-02.spec.js` passed **3/3** serially across Windows Chromium, Firefox and
WebKit. A real Synthetic Manifest edit created revision 1 and an auto recovery copy. After reload the
copy remained dormant and the current sample stayed active until the user clicked Restore. Restore
recovered the canary content under a freshly reclassified Unknown policy, with a new volatile revision 0,
no durable transaction key and the recovery record still present. This preserves content without claiming
that Unknown data has durable cross-refresh history. No functional pageerror or unknown browser diagnostic
occurred; Firefox's existing AGRUN CSP eval diagnostic was explicitly annotated.

## Case 08-03 result

`e2e/studio-v2-s10-prod08-03.spec.js` passed **3/3** serially across Windows Chromium, Firefox and
WebKit. In the actual browser, a forced `QuotaExceededError` during a Synthetic recovery write returned
false without throwing. Direct Unknown and Real recovery writes were rejected before storage access; a
real in-memory edit after switching to Real left the complete client-storage snapshot unchanged. The
existing `e2e/studio-v2-p0-prod13-existing-records.spec.js` was also re-run and passed **3/3**, preserving
durable, recovery, session, Cache Storage and sessionStorage records while blocking new Real persistence.
No functional pageerror or unknown browser diagnostic occurred; Firefox's existing AGRUN CSP eval
diagnostic was explicitly annotated.

## Case 08-04 result

The actual browser save matrix passed **15/15** serially across Windows Chromium, Firefox and WebKit
(`e2e/studio-v2-file-save-policy.spec.js`). The picker, stream-open, buffered-write and close policy
boundaries all stopped or aborted the uncommitted sink after a policy change without changing the
current save-state claim. The unconfirmed close case ran in all three engines and remained explicitly
unconfirmed with one close attempt, no retry and no alternate download. The final-build
`e2e/studio-v2-p0-prod03-07.spec.js` evidence also passes **3/3** and covers explicit picker
cancellation, write failure, confirmed close, download-started fallback and a held save overtaken by
a newer revision. No functional pageerror or unknown browser diagnostic occurred in the boundary
matrix.

## Case 08-05 result

The actual `e2e/studio-v2-p0-prod03-07.spec.js` composed save case passed **3/3** serially across
Windows Chromium, Firefox and WebKit on the final generated site. It observed a confirmed picker
close as **Saved**, an explicit browser download as **Download started** rather than a disk-complete
claim, and a held save whose artifact remained bound to revision 0 after a newer locale edit advanced
the live project to revision 1 and returned it to Unsaved. Cancellation and write failure remained
separate non-success outcomes with no retry or download side effect. The focused
`studio-file-export.test.js` and `file-save-policy.test.js` suites cover the same receipt/artifact and
sink failure ownership in Node.

## Case 08-06 result

The new actual `e2e/studio-v2-s10-prod08-06.spec.js` passed **3/3** serially across Windows
Chromium, Firefox and WebKit. Corrupt recovery JSON failed closed with the current Sales Invoice
still active and no recovery banner; an eight-day-old recovery record also stayed retained but dormant
and did not replace the current project. A malformed HTML import showed the localized rejection toast
and left Manifest source, Synthetic policy, revision 0, Saved state and the empty recovery slot
unchanged. No functional pageerror or unknown browser diagnostic occurred; Firefox's existing AGRUN
CSP eval diagnostic was explicitly annotated when present.

## Case status

08-01 through 08-06 are **Pass**. The S10 composed acceptance matrix is closed.

## Gate closure

- G1 **10/10**: owners, dependencies, six frozen cases, current/target behavior and required checks
  are recorded above.
- G2 **50/50 cumulative**: the import dirty-draft guard, localized confirmation, cancellation reset,
  `markDirty` save-state ownership and existing Synthetic-only recovery/file sink policies are scoped,
  reviewed and compatible with canonical revision/CAS, private approval/export, Unknown/Real privacy,
  existing records and protocol contracts.
- G3 **80/80 cumulative**: the focused S10 unit/runtime set passed **9 files / 82 tests**; seven
  changed/new JavaScript files passed `node --check`; `npm run check` and `git diff --check` passed.
- G4 **95/95 cumulative**: 08-01..03 and 08-06 each passed **3/3** across Chromium, Firefox and
  WebKit; 08-04's boundary matrix passed **15/15**, its final-build PROD-03-07 regression passed
  **3/3**, and 08-05's composed save case passed **3/3**. No unit or mock result substituted for the
  browser cases.
- G5 **100/100 cumulative**: this evidence, TASK, the production plan, release checklist, gap audit,
  implementation evidence and navigation summaries are synchronized after the S10 update. No print,
  Edge/Safari.app, live Provider, deployment, maintainer approval or Production Ready claim is made.

Next dependency-ready step: S11 / PROD-07 actionable Quality.
