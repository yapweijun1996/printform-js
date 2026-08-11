# PrintForm Studio v2 declarative extensions

> Maturity: **Production Pilot**. The locale, print i18n and image-slot sections describe Current behavior. The review section distinguishes the current Pilot gate from the Production Ready target.

## Studio interface language

The Studio interface and the printed document have independent locale controls.
Studio defaults to `en-MY`, persists the engineer's explicit selection locally,
and lazy-loads `zh-CN`, `ms-MY`, `ja-JP`, or `vi-VN` before switching the UI in
place. A UI-language change does not modify the project revision, print locale,
sample data, editor focus, or layout-review receipt. Missing UI keys fall back to
English; exported HTML contains only the document locale catalogs it needs.

## Five-language print content

The optional `pf-i18n` JSON section stores flat, escaped message catalogs. A
template opts in with `data-pf-i18n`; no expressions or HTML translations run.

Supported locales are `en-MY`, `zh-CN`, `ms-MY`, `ja-JP`, and `vi-VN`.

```html
<script id="pf-i18n" type="application/json">
{"en-MY":{"po.title":"Purchase Order"},"zh-CN":{"po.title":"采购订单"}}
</script>
<h1 data-pf-i18n="po.title"></h1>
```

Declare `manifest.i18n.supportedLocales` and `fallbackLocale`. Trusted export
fails when a used key is missing from any declared locale, or when locale,
currency, or time-zone identifiers are invalid. Runtime callers may select a
declared locale with `PrintFormDocument.render(data, { locale: "ms-MY" })`.

## Image asset slots

Use a named image slot for replaceable letterhead and footer artwork:

```html
<img data-pf-asset-slot="letterhead-logo" src="data:image/svg+xml,..." alt="Company logo">
```

Studio accepts inline image data, relative paths, and HTTPS sources. Export
inlines reachable assets by default. `manifest.assets.requiredSlots` makes a
slot mandatory and unique. Replace assets in Studio and re-export so CSP and
the content attestation remain valid.

## AI layout review gate

Current behavior requires a layout review receipt bound to the current revision and
the current committed render provenance. Each scenario receipt also carries the
candidate hash and `baseProjectHash`, so a preview from another draft cannot be
reused for export readiness.
The agent calls `capture_layout_evidence` for each required scenario and passes
the returned Studio-issued `evidenceId` values to `complete_layout_review`.
Self-declared `evidence`, `browser`, or `scenarios` labels are rejected. A
broken scenario returns an unsigned safe observation so the reviewer can
diagnose it, but observations can never complete the gate. Any major or
critical finding in the fresh evidence blocks completion; a repair must create
a new revision and new evidence rather than relabeling an old finding as fixed.
Any subsequent change invalidates the receipt. Each receipt records complete
logical-page coverage, a geometry/layout fingerprint, render-report hash and
an optional geometry-only redacted SVG snapshot. In synthetic-data mode,
`visualMode: "pixels"` adds a bounded sandbox DOM-to-canvas pixel raster and
`pixelSnapshotHash`; real-data mode rejects that mode with
`PIXEL_EVIDENCE_SYNTHETIC_ONLY`. Pixel rasters omit source URLs and use safe
image placeholders. A person must still inspect system print preview and
perform the final production export click.

The embedded reviewer owns a bounded three-pass loop. The model must choose
one terminal action per pass: propose a semantic repair, complete with clean
fresh receipts, or report blocked. Repair proposals are automatically applied
by the host after the same validation guards. After Apply the host captures
fresh evidence automatically;
the model cannot apply or request export. Runtime events are projected to safe
operational metadata before reaching UI trace observers, so prompts, images,
credentials and provider payloads are not retained there.
