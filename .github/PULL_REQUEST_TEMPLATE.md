## What & why

<!-- One or two sentences. Link an issue if there is one. -->

## Checklist

- [ ] `npm test -- --run` passes locally
- [ ] If this touches `studio-v2/core/**`: ran `npm run build:assets` and re-verified the Studio v2 preview — `core/*.js` is bundled into `dist/printform-document.js`, so editing the source alone does not change what the preview renders ([see DESIGN.md §4.3](../DESIGN.md#4-studio-v2production-pilotcurrent))
- [ ] If this adds or removes files under `studio-v2/`: no action needed for the service worker — the precache manifest is generated from the built output by `scripts/app-shell.mjs`. (It used to be a hand-maintained list in `sw.js` that drifted twice; if you are changing what belongs in the shell, edit the generator and its tests in `tests/app-shell.test.js`.)
- [ ] If this changes behavior described in `DESIGN.md`/`SPEC.md`/the `docs/STUDIO_V2_*` files: updated the doc in the same PR, not as a follow-up
- [ ] If this closes or starts a `TASK.md` item: moved it between sections and recorded the commit
