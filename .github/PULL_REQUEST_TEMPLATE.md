## What & why

<!-- One or two sentences. Link an issue if there is one. -->

## Checklist

- [ ] `npm test -- --run` passes locally
- [ ] If this touches `studio-v2/core/**`: ran `npm run build:assets` and re-verified the Studio v2 preview — `core/*.js` is bundled into `dist/printform-document.js`, so editing the source alone does not change what the preview renders ([see DESIGN.md §4.3](../DESIGN.md#4-studio-v2production-pilotcurrent))
- [ ] If this adds a new file under `studio-v2/` that something else imports: added it to `APP_SHELL` in `studio-v2/sw.js` and ran `npm run test:e2e` (or at least the PWA-offline test) — a hand-maintained precache list silently 404s missing files offline; see ROADMAP.md §3 for the exact incident this happened once already
- [ ] If this changes behavior described in `DESIGN.md`/`SPEC.md`/the `docs/STUDIO_V2_*` files: updated the doc in the same PR, not as a follow-up
- [ ] If this closes or starts a `TASK.md` item: moved it between sections and recorded the commit
