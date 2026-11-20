# Studio v3 Pilot release evidence, 2026-11-20

The supported evidence here is for the existing browser Pilot and local verification fixtures.
The G9 release decision remains open. The retired Studio v2 acceptance ledger is historical.

| G9 case | Evidence | Remaining acceptance |
| --- | --- | --- |
| REL-01 | Live Pages release `065adfb5c1dd0b28a1d51537edf19de1284c0257` has matching Studio asset, manifest and dependency-index identities. The published package hash is `9c31e23aba75b605dd80e87f34317816bab5c8656b348a8711dd6586612952e8`. | Bind each applicable qualification result to the final matched app, knowledge, runner and provider artifacts. Existing historical model attempts retain their own identities. |
| REL-02 | Browser checks exercise Studio rendering, working-copy recovery and immutable shell identity. | Complete deterministic supported-browser coverage and real provider tool/image/usage/cancel conformance for the declared profile. |
| REL-03 | Chromium, Firefox and WebKit rollback preserves committed revision, rendered field label and an unapplied inspector draft after explicit Keep. The exact release-pair drill is recorded below. | Extend to the approved browser, OS and physical print profile. |
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

### Exact published Pilot pair

The local drill switched from `481e12e78a2e5f3d6a664726cbf52e6043877ce7` to `d97813922b85420edfc7a2e721998b242104551d` at one loopback origin. The reconstructed Studio service worker, app, Agent manifest and dependency index matched the hashes captured from each public release. Each worker's own hash list verified all 25 shell files. Both releases use runner source hash `b6a89aa87b2f8ae3f17adc436fed6e47ef22c7862599bc3a76b5c509b69ef23b`. Chromium, Firefox and WebKit each passed with one worker and zero retries. The browser checked the active worker's reported build, the app URL, the committed revision and rendered label, the unapplied draft, and consumption of the recovery record.

| Published commit | App SHA-256 | Worker SHA-256 |
| --- | --- | --- |
| `481e12e` | `7cf9fe7d47a261104f1fe071c29c3bccc9c95eeda94321cf7913d2c4607178d6` | `905fea3d5c4b256bc523f19b19d5925d41bf3ab0cbfc9499b312ab4544defc71` |
| `d978139` | `24bddea67ab58596cbc7f0ca9bcc627ef5465c75f992ae0365a36e582cacaeab` | `7ad43f2540906a81801d44cd66df2cef7fdf34439708828fbc9f324f8496ac1a` |

The Actions artifact download returned HTTP 403. The first rebuild reused another checkout's dependency tree by symlink and produced different PDF chunk and app hashes. A fresh `npm ci` in each checkout reproduced both fingerprints. To repeat, run `npm ci`, `npm run build:assets` and `GITHUB_SHA=<full-commit> node scripts/build-site.mjs` in each exact checkout. Supply both resulting `site-dist` paths to the same browser test.

```sh
PRINTFORM_ROLLBACK_OLD=/path/to/d978139/site-dist \
PRINTFORM_ROLLBACK_NEXT=/path/to/481e12e/site-dist \
npx playwright test e2e/studio-v3-upgrade.spec.js -g 'rollback to a previous' --workers=1 --retries=0
```

### Transition across companion identities

The next drill used `481e12e` and `6e9fd0efaffabdca36ec55b579fc02cdc45e5b37`, with companion source hashes `b6a89aa87b2f8ae3f17adc436fed6e47ef22c7862599bc3a76b5c509b69ef23b` and `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b` respectively. Fresh builds matched each release's public app, worker, manifest and dependency-index fingerprints. Each worker's 25 shell entries were independently verified. The newer app SHA-256 is `10ad205b48da9c9fa502d32b0ff702eacebf6c87033699d9c6fd9cbb6c1f8146` and its worker SHA-256 is `e78b7f5977688afc4556ac5b21970e41641e675c855e5a055ded2fa75d4c95e8`.

The same three browsers passed both the desktop offline upgrade and the reverse rollback, 6/6 in one serial run with zero retries. The upgrade checks Stay, offline Keep, reconnect, restored draft and revision, exact committed header before Undo, rendered header after Undo, zoom, unchanged IndexedDB and automatic activation in the second clean tab. The initial five-pass run stopped at a direct Firefox iframe read after Undo, with Export already enabled. Both paths now assert the header in the native rendered page reported by the existing preview bridge. The original timeout and failing trace are preserved. This drill served public shell bytes at a loopback origin. It did not roll back the public site or switch an active source workspace between companion images.

Use the same Playwright command with the `481e12e` and `6e9fd0e` roots and select `rollback to a previous|two real builds: desktop` to reproduce both paths.

For a supported deployment rollback, record the current and target artifact identities and the runner compatibility before republishing the previously verified bundle. Keep the existing service-worker and recovery workflow in place. If an unsaved-work dialog appears, choose Keep to preserve the draft, or Stay to defer the switch. Verify the active revision, data and pending edits after reload. Use the existing recovery backup path if automatic restoration reports incompatibility. Browser storage deletion is not part of the drill.
