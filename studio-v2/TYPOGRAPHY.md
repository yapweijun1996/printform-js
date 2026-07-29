# Print typography scale

PrintForm Studio v2 uses a 9pt body size and a fixed one-point hierarchy. Use the
tokens or utility classes instead of adding arbitrary font sizes to a template.

| Level | Token | Utility class | Size |
| --- | --- | --- | --- |
| -3 | `--pf-font-minus-3` | `.pf-font-minus-3` | 6pt |
| -2 | `--pf-font-minus-2` | `.pf-font-minus-2` | 7pt |
| -1 | `--pf-font-minus-1` | `.pf-font-minus-1` | 8pt |
| Default | `--pf-font-default` | `.pf-font-default` | 9pt |
| +1 | `--pf-font-plus-1` | `.pf-font-plus-1` | 10pt |
| +2 | `--pf-font-plus-2` | `.pf-font-plus-2` | 11pt |
| +3 | `--pf-font-plus-3` | `.pf-font-plus-3` | 12pt |

Example:

```html
<h1 class="pf-font-plus-3">Purchase Order</h1>
<p class="pf-font-default">Normal document content</p>
<small class="pf-font-minus-1">Registration number</small>
```

The body inherits 9pt from `#pf-mount`. The -2 and -3 levels are reserved for
non-essential annotations; do not use them for totals, legal terms, or primary
business data. Always confirm the final result in the system print preview.
