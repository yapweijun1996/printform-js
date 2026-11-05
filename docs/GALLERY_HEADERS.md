# Gallery header patterns

This note records the supported header model used by the Gallery payment
certificate and the border rule that keeps its repeated headings readable.

## PF-068 boundary ownership

`pdocinfo002` is the main `DESCRIPTION / AMOUNT (S$)` heading. The recovery
detail table has its own `.prowheader.recovery-detail-heading` with
`data-pf-table-id="recovery"`.

When PrintForm starts a continuation page, the processed DOM places the
repeated main heading directly before the repeated recovery heading. Both
headings still own their normal borders elsewhere, but the shared boundary is
owned by the main heading in this one adjacency case:

```css
.printform_page > .pdocinfo002_processed
  + .recovery-detail-heading.prowheader_processed
  > tbody > tr > td:nth-child(2) > table > tbody > tr > td {
  border-top: 0;
}
```

The recovery heading keeps its top border when it follows ordinary recovery
rows mid-page. Therefore the rule removes only the duplicate line between the
two repeated headings; it does not remove the section edge on the first page.
The source selector remains stable and applies only to the PF-068 fixture.

## Multiple subtables

Use one stable table ID for each logical table. The header and all rows in that
table share the ID:

```html
<table class="prowheader" data-pf-table-id="claims">
  <tr><th>Claim no.</th><th>Amount</th></tr>
</table>
<table class="prowitem" data-pf-table-id="claims">
  <tr><td>CLM-001</td><td>100.00</td></tr>
</table>

<table class="prowheader" data-pf-table-id="recoveries"
       data-pf-keep-with-next="true">
  <tr><th>Recovery no.</th><th>Amount</th></tr>
</table>
<table class="prowitem" data-pf-table-id="recoveries">
  <tr><td>REC-001</td><td>(25.00)</td></tr>
</table>
```

A repeating `.pdocinfo002` (for example the PF-068
`DESCRIPTION / AMOUNT (S$)` heading) is a global document heading, not a
child table ID. Set `data-repeat-docinfo002="y"` when it must precede the
active child header on continuation pages; the child table IDs remain flat and
ordered below it.

The formatter collects the first `.prowheader` for each table ID. On a
continuation page it repeats only the header belonging to the next row's
active ID; a completed `claims` header is not carried into `recoveries`.
`data-pf-keep-with-next="true"` additionally keeps a repeating or otherwise
one-time header with the first row of its table when a page break would orphan
it. Repetition and keep-with-first-row are independent controls.

This is a flat, ordered model. Nested table-header hierarchies and multiple
headers with the same `data-pf-table-id` are not a supported hierarchy API;
the first header wins. Applications needing nested groups should give each
independent table its own ID and place the blocks in document order.

Legacy documents without a table-ID map retain the existing default behavior:
the first `.prowheader` is used as the default header. Once any table-ID map is
present, an unknown ID has no fallback header, preventing a previous table's
header from leaking into a different table.

## Executable coverage

The focused unit coverage in `tests/active-table-context.test.js` proves:

- an active table repeats its own header;
- a completed table header does not leak into the next table;
- keep-with-first-row behavior remains opt-in; and
- legacy default fallback remains available only when no table map exists.

`e2e/payment-certificate.spec.js` uses the public Gallery fixture and checks
all 200 recovery IDs, six logical pages, one signature area, page numbers, and
the border boundary on the first, continuation, and final pages. Its PDF test
checks the six-page A4 output. A second browser fixture uses one repeated
`pdocinfo002` main heading followed by `claims` and `recoveries` child tables;
it checks the main-before-child order, active-child transitions, no old-child
leakage, and keep-with-first-row attributes. The same spec covers 0-, 1-, and
20-row variants (including their page and processed-row counts).

The initial focused run used Chromium. The manager subsequently verified the
header browser cases in Chromium, Firefox and WebKit; PDF generation remained
Chromium-only. See [aggregate evidence](GALLERY_FOLLOWUP_VERIFICATION.md).
Physical printer output remains unverified.
