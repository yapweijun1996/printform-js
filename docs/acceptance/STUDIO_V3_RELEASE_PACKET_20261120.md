# Studio v3 Pilot release evidence, 2026-11-20

The supported evidence here is for the existing browser Pilot and local verification fixtures.
The G9 release decision remains open. The retired Studio v2 acceptance ledger is historical.

| G9 case | Evidence | Remaining acceptance |
| --- | --- | --- |
| REL-01 | Live Pages release `065adfb5c1dd0b28a1d51537edf19de1284c0257` has matching Studio asset, manifest and dependency-index identities. The published package hash is `9c31e23aba75b605dd80e87f34317816bab5c8656b348a8711dd6586612952e8`. | Bind each applicable qualification result to the final matched app, knowledge, runner and provider artifacts. Existing historical model attempts retain their own identities. |
| REL-02 | Browser checks exercise Studio rendering, working-copy recovery and immutable shell identity. | Complete deterministic supported-browser coverage and real provider tool/image/usage/cancel conformance for the declared profile. |
| REL-03 | Chromium, Firefox and WebKit rollback from fixture B to fixture A preserves committed revision, rendered field label and unapplied inspector draft after explicit Keep. Recovery storage is consumed only after restoring the work. | Repeat against the exact compatible supported release pair and platform scope. |
| REL-04 | The local drill publishes an older verified shell at the same origin and checks explicit approval while work is unsaved. | Confirm actual deployment rollback ownership, compatible previous runner, cancellation and reconciliation. |
| REL-05 | The automated fixtures exercise local policy and recovery without production data or live inference. | Exercise profile-specific redacted telemetry, quota/cost saturation, incident response, authentication and retention. |
| REL-06 | The active task ledger records implemented slices and unqualified gates. | Approve the exact provider, runner, browser/OS and print profile and record the maintainer's decision. |

## Published homepage

[Pages run 44713918035](https://github.com/yapweijun1996/printform-js/actions/runs/44713918035) completed both build and deploy. A fresh Chromium context at 1440px and 390px followed the public homepage button to the childcare invoice, rendered the form and opened the Studio preview without page errors. The live identity was read from the Studio asset metadata and confirmed against the public agent manifest and dependency index. This is smoke evidence and does not exercise inference, provider retention or physical printing.

The homepage now uses the [stable childcare invoice URL](https://yapweijun1996.github.io/printform-js/gallery/designs/preschool-childcare-invoice.html), which returned HTTP 200 in the live recheck. The requested `0805b35fe46a` Gallery release URL returned HTTP 404. The Pages build ships Gallery assets for the current release.

The [later public Pilot recheck](STUDIO_V3_PILOT_RECHECK_20261120.md) identifies `d978139`, audits the published assets and records desktop/mobile preview and actual HTTPS companion pairing. The physical print, inference and maintainer decision gates remain open.

## Rollback drill

Build the site and run:

```sh
npx playwright test e2e/studio-v3-upgrade.spec.js -g 'rollback to a previous'
```

For a supported deployment rollback, record the current and target artifact identities and the runner compatibility before republishing the previously verified bundle. Keep the existing service-worker and recovery workflow in place. If an unsaved-work dialog appears, choose Keep to preserve the draft, or Stay to defer the switch. Verify the active revision, data and pending edits after reload. Use the existing recovery backup path if automatic restoration reports incompatibility. Browser storage deletion is not part of the drill.
