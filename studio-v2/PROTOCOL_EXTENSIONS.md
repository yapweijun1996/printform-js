# PrintForm Studio v2 declarative extensions

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

Production readiness requires a layout review receipt bound to the current
revision. The agent must provide full-page screenshot and layout-metric evidence
for default and long-text scenarios. Major and critical findings must be fixed.
Any subsequent change invalidates the receipt; a person still performs the final
production export click and system print-preview confirmation.
