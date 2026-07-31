# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This
project does not yet cut public SemVer releases (`package.json`'s `version` is a
placeholder) — everything below sits under `[Unreleased]` until that's decided.
See [TASK.md](TASK.md) for the full engineering log with commit hashes, test
counts, and verification detail; this file only lists what changed, for readers
who don't need the diary.

## [Unreleased]

### Added

- **Studio v2**: a single self-contained-HTML "Production Pilot" editor for the
  two standard templates (Sales Invoice, Purchase Order), with a transactional
  Agent Contract command bus shared across the UI, WebMCP, and a CDP gateway —
  so AI agents and humans go through the same validated command path.
- Studio v2 engineer panels: table column widths, print font scale, page
  settings (paper size), repeated-areas (header/footer/docinfo repeat
  flags), and a brand heading color, all applying directly against the
  live preview with no raw-JSON editing required.
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

### Fixed

- A script injected into the page after `DOMContentLoaded` failed to run;
  auto-init now checks `document.readyState`.
- PTAC/PADDT long-text continuation segments could force an extra page break
  after being cloned.
- Studio v1: structure-mode block indexing could point at the wrong element
  after edits; preview `postMessage` handling lacked origin/level validation.

### Security

- Studio v2 preview messages are verified against `event.source`, print
  preview windows sever `window.opener`, `set_manifest_value` rejects
  prototype-pollution path segments, and revision numbers are monotonic
  (never reused after an undo).
