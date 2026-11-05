# Gallery update performance

## Scope and evidence

The original screenshot did not include a start time, connection type, browser
cache state, or whether the tab already had a service worker. Its duration is
therefore not treated as a production measurement.

The following read-only observation was made against the affected URL:

`https://yapweijun1996.github.io/printform-js/gallery/index.html`

- Date: 2026-11-05 (UTC+8), manager-run headless Chromium, fresh browser context.
- `index.html` reached DOMContentLoaded in 1,267 ms.
- The loaded page reported running build `e29a6c14135e`.
- At 47,326 ms the status still read `Checking for updates` and the registration
  still had an `installing` worker. This bounded run ended without observing completion.
- The in-progress shell cache held 146 entries / 3,053,824 actual response-body
  bytes. These are partial installation counts, not the release's total payload.
- A separate read-only request measured `build-info.json` at 366 ms; this was a
  different request, not a timing for the manager's browser context.

Primary observation: `../output/gallery-followup/manager-live-timing.json`.
Supplementary HTTP/manifest observations: `../output/gallery-followup/raw-live-timing-20261105.json`.
Both artifacts are local verification output outside the repository.

This separates the quick metadata check from the slower browser-managed shell
installation. It does not reproduce the user's exact session or network.

## Controlled reproduction

`tests/gallery/sw-precache.test.js` evaluates the built worker with a local
fixture containing 12 resources. Each resource is fetched, SHA-256 verified,
and written to Cache Storage. The fixture asserts that:

- at least two requests overlap and no more than six are in flight;
- all 12 resources are written before a successful install resolves;
- when one resource fails, all in-flight workers settle before the incomplete
  cache is deleted (`deleteAtActive === 0`).

This is a concurrency/integrity fixture, not a production throughput claim.
The repository's real shell can still be dominated by large fonts or slow
network responses; those resources remain in the immutable release and are not
skipped or weakened.

For scale, a local `finalizeGalleryPwa` build emitted 259 verified release
entries totaling 15,796,612 bytes. The largest entry was
`NotoSansCJKsc-Regular.woff2` at 11,425,676 bytes. The pool removes the
request waterfall around that asset; it cannot remove the asset's transfer.

## Changes

- `gallery/sw.js` uses a bounded pool of six workers for precache fetch,
  verification, and cache writes. `Promise.all` waits for every worker before a
  failed shell cache is deleted, preventing late writes from recreating a
  partial cache. Each release resource has a generous 120 s abort budget so a
  stalled request eventually reaches the same cleanup path; this is separate
  from the 25 s UI observation deadline.
- `gallery/js/pwa-update.js` reports `checking` while retrieving release
  metadata and `preparing` while an installing worker downloads and verifies the
  offline shell. The UI wait has a 10 s update-check deadline and a 25 s
  install-observation deadline. A deadline expiry is shown as `preparingSlow`,
  rather than as a false install failure. These deadlines do not cancel a
  browser service-worker install; a late `installed` event is still observed
  and can produce an update offer.
- `gallery/js/pwa.js` publishes the actual state and `aria-busy` metadata. The
  check button is disabled during the bounded check/installation observation;
  after prolonged preparation it permits retry while installation continues.
  Activation remains explicit and blocked while a preview dialog is open.
- English and Simplified Chinese labels explain the preparation phase.

Activation and reload remain user-driven. Hash verification, build-identity
checks and old-shell retention are preserved.

## Verification

Focused checks:

```text
npx vitest run tests/gallery/update.test.js tests/gallery/sw-precache.test.js --maxWorkers=1 --no-file-parallelism
```

The final focused updater/precache run passed 24 tests. Full Linux verification
also passed `tests/gallery/pwa.test.js`, including its symlink-based precache
fixture. The Windows symlink setup had required a Linux verification surface;
no application permission or test requirement was weakened.

See [aggregate verification](GALLERY_FOLLOWUP_VERIFICATION.md) for manager-run integration checks.
