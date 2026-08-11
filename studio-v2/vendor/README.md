# Vendored AGRUN runtime

`agrun.min.js` is a reviewed, same-origin copy of the user-owned
[Agent-Runtime-JavaScript](https://github.com/yapweijun1996/Agent-Runtime-JavaScript)
bundle. The exact upstream commit, SHA-256 and script-integrity value are kept
in `agrun.provenance.js` and `studio-v2/index.html`.

## Update

Review the upstream diff, then run:

```bash
npm run sync:agrun -- --apply --commit <40-character-commit-sha>
npm run check:agrun
```

Omitting `--commit` resolves the current `main` commit from GitHub when
`--apply` is present. The normal CI build does not download upstream code; it
only verifies the checked-in bundle. A scheduled drift check reports when
`main` has changed so an update is deliberate and reviewable.

The bundle must contain AGRUN's inline media mapper. `data:image` evidence is
decoded inside the runtime and sent as image bytes, so provider adapters do not
call `fetch(data:)`.
