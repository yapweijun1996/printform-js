# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Version numbers below track the **pagination engine** (`dist/printform.js`).
Studio v2, the single-HTML protocol, and the Agent Contract version separately —
see the [compatibility matrix](docs/COMPATIBILITY_MATRIX.zh-CN.md) for why, and
for the current number on each line.

See [TASK.md](TASK.md) for the full engineering log with commit hashes, test
counts, and verification detail; this file only lists what changed, for readers
who don't need the diary.

## [Unreleased]

Current working-tree versions: runtime `1.0.0`, Studio `0.11.0`, Protocol `2.0.0`, Agent Contract `3.0.0`.
E13-SERVER provides a bounded single-writer SQLite backend; the browser UI still uses localStorage.
E14 UI includes four layers, context badges, structured change cards, apply-mode controls,
batch history controls, session/settings/trace surfaces and a resizable rail.

### Documentation — 2026-09-07

- Reconciled architecture, current behavior, epic/task status, roadmap, product strategy,
  trust model and release checks against code.
- Corrected blanket E14 completion claims: scope, Review apply policy, readiness display,
  card-history semantics and real-data persistence remain incomplete.
- Added the [production plan](docs/STUDIO_V2_PRODUCTION_PLAN.md) with requirement IDs,
  dependencies, evidence limits, proposed layout and release-profile decisions.
- Earlier session evidence: 72 files / 385 tests, doctor 5/5, three static pilot validations,
  bundle syntax and Windows Chromium 60/60 passed. Full application suites were not rerun
  for this documentation amendment; no new full browser/print/HA/network-audit result is claimed.
- No source, runtime-loaded Agent prompt, behavior, version, supported-platform promise or release change.

## [1.0.0] — 2026-07-31

First tagged release. The engine itself long predates this tag — it has been in
production ERP use for years — so 1.0.0 states its actual stability rather than
implying it is new. At that release time it shipped alongside Studio v2 0.9.0,
protocol 2.0.0 and Agent Contract 2.0.0; see `[Unreleased]` above and the
compatibility matrix for the current version lines.

### Added

- **Studio v2**: a single self-contained-HTML "Production Pilot" editor for the
  two standard templates (Sales Invoice, Purchase Order), with a transactional
  Agent Contract command bus shared across the UI, WebMCP, and a CDP gateway —
  so AI agents and humans go through the same validated command path.
- Studio v2 engineer panels: table column widths, print font scale, page
  settings (paper size), repeated-areas (header/footer/docinfo repeat
  flags), brand heading color, and a data contract panel (view schema
  structure, edit sample values and existing field constraints), all
  applying directly against the live preview with no raw-JSON editing
  required for common changes.
- Side-by-side diff review before applying a manual source edit, replacing a
  single-line `confirm()` dialog.
- Studio-issued layout evidence receipts (geometric fingerprints, not pixel
  screenshots) and dual-runtime attestation hashes, so a production export's
  trust claims are independently verifiable rather than self-declared.
- A release-acceptance script (`scripts/browser-matrix.mjs`) covering both
  templates across four browser targets, every boundary row-count scenario,
  and five print locales — plus an on-demand `workflow_dispatch` CI job to
  reproduce it on a Linux runner.
- MIT license.
- Independent SemVer for each of the four contracts, with a
  [compatibility matrix](docs/COMPATIBILITY_MATRIX.zh-CN.md) explaining the
  split and machine checks preventing the derived copies from drifting.
  `PrintForm.version` now reports the engine version at runtime.
- `npm run doctor`: a one-command local health check (unit tests, the
  production build, and protocol validation for both pilot exports) with
  a one-page pass/fail summary.

### Changed

- Cross-engine pagination divergence in the Purchase Order template resolved:
  non-row page area now has enough padding that every browser engine and
  print locale converges on the same rows-per-page count.
- The service worker's offline precache manifest is now generated at build
  time from the actual build output, instead of hand-maintained (the
  hand-written list had silently drifted twice).
- Large documents with an enlarged font paginate substantially faster: row
  heights are now pre-measured in one batch and the common case skips a
  redundant layout reflow per row. Pagination output is unchanged.

### Fixed

- A script injected into the page after `DOMContentLoaded` failed to run;
  auto-init now checks `document.readyState`.
- PTAC/PADDT long-text continuation segments could force an extra page break
  after being cloned.
- Studio v1: structure-mode block indexing could point at the wrong element
  after edits; preview `postMessage` handling lacked origin/level validation.
- Studio v2 diagnostics bundles reported a `studio` version that never
  existed — the protocol version had been hardcoded into a field naming the
  Studio.

### Security

- Studio v2 preview messages are verified against `event.source`, print
  preview windows sever `window.opener`, `set_manifest_value` rejects
  prototype-pollution path segments, and revision numbers are monotonic
  (never reused after an undo).
