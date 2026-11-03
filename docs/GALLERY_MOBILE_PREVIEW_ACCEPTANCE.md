# Gallery mobile preview acceptance

## Scope

This change fixes the Gallery viewer lifecycle and improves mobile presentation of the school-invoice previews (PF-058 through PF-063). It does not certify every design as responsive or production-qualified.

## Delivery plan

1. Reproduce synchronous close/reopen blanking before changing production code.
2. Give each preview an owned iframe/session and prevent stale close, load, error and timeout work from changing a newer preview.
3. Compact the outer viewer on narrow/short viewports, keeping accessible titles and reachable actions.
4. Adapt only the explicitly identified school-invoice navigation outside generated paper. Collapse Paper/Dataset controls behind Preview options and remove the duplicate inner Print on mobile.
5. Keep outer Print synchronized with the actual school-controller busy/error/ready state, including programmatic rerenders.
6. Preserve standalone controls and print-media geometry. Include the adapter in the version-pinned offline shell.
7. Independently review, rebuild and rerun focused browser/unit checks before release.

## Observed root cause

Native dialog close notifications are queued. A close followed synchronously by a new open previously allowed the old close handlers to clear the active iframe and restore background state. Each open now receives a separate iframe/session. Queued close notifications are ignored while reopened, and the original background snapshot is retained until a real close.

The school's own Print button also carries readiness information that the general processed flag does not: it disables synchronously while Paper/Dataset changes are recalculated. The outer action now observes that state and checks it again before printing.

## Test-first evidence

- The synchronous reopen regression failed on the original implementation because the second preview never enabled Print, then passed after lifecycle changes.
- PF-063 paper-space checks failed before the mobile adaptation: first-paper top was 237px at 320/360px and 223px at 390px, against a 100px budget.
- The held real formatting-promise regression demonstrated stale `processed=true` while `SCHOOL_READY=false` and the outer Print was incorrectly enabled. It passed after readiness synchronization.

## Independent local verification

- Asset/runtime build and assembled Pages artifact generation passed separately: `npm run build:assets` and `node scripts/build-site.mjs`.
- Chromium: **29/29** focused browser cases passed across mobile preview, offline preview, modal controls, masonry, lazy images and offline masonry.
- Vitest: **32/32** cases passed across Gallery PWA, compact controls, filtering, manifest and update tests.
- Separate Codex final static review reported no confirmed P0/P1/P2 findings after the two initial findings were fixed.
- Browser verification used an installed Chromium executable through a scratch configuration, because the repository-default browser executable is absent locally. No browsers or dependencies were installed.

Coverage includes 320/360/390px phones, short landscape, desktop modal controls, Chinese/dark presentation, rapid same/different reopen, late detached events, failed-load recovery, Tab/Escape and focus/scroll restoration, Paper/Dataset rerender success/failure/recovery, intercepted print invocation, PF-063 default print-media geometry/page-count parity with standalone, and a real service-worker-controlled offline reload.

## Final-source 67-design audit

A sequential default-preview scan at 390x664 was repeated after the readiness follow-up:

- 67 expected, 67 collected, 67 ready.
- No outer viewport horizontal overflow and no recorded browser console/page errors.
- PF-063 iframe was 364x516, with the first paper starting 75px below the iframe top.

This is a load/geometry audit, not PDF or physical-printer acceptance for every form.

## Remaining limitations

- PF-001 through PF-054 retain pre-existing horizontal scrolling inside their iframes. They were not blindly scaled or restyled in this change.
- PF-064 and PF-067 retain large pre-paper control regions and need a separate controller-specific mobile adaptation.
- Real iPhone Safari, Firefox, WebKit, native print dialogs, physical printing and PDF pixel parity across all 67 designs have not been verified.
- The complete local unit suite was not certified green. Earlier local runs encountered broken `fc-scan`/fontconfig and stale legacy browser expectations of 64 designs; this change does not disable those tests or repair unrelated environment issues.
- Pages deployment and live acceptance must be verified separately from a successful merge.
