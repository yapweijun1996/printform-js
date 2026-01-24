# Code Structure: Pagination Pipeline

This file describes the end-to-end pagination flow.

---

## 1) Entry and auto-init

- Entry: `js/printform.js`
- Auto-runs after `load` (with a small delay; longer on mobile)
- Exposes `PrintForm.formatAll()` and `PrintForm.format()`

---

## 2) Config resolution

`getPrintformConfig(formEl, overrides)` merges:

```
DEFAULT_CONFIG
  < legacy globals (window.*)
  < data-* attributes
  < overrides (JS API)
```

If `data-papersize-width/height` are not supplied, it resolves
`data-paper-size` + `data-dpi` + `data-orientation` to pixels.

---

## 3) Section collection

`collectSections()` finds:
- `.pheader`
- `.pdocinfo`..`.pdocinfo005`
- `.prowheader`
- `.pfooter`..`.pfooter005`
- `.pfooter_logo`, `.pfooter_pagenum`
- rows: `.prowitem`, `.ptac-rowitem`, `.paddt-rowitem`

PTAC/PADDT tables (`.ptac`, `.paddt`) are expanded into row segments first.

---

## 4) Height measurement

`measureSections()` measures section heights using `getBoundingClientRect`
with mobile-safe normalization.

---

## 5) Rendering and pagination

`renderRows()`:
- starts a logical page
- appends rows one by one
- checks height against the per-page limit
- creates new pages on overflow or `tb_page_break_before`

Row header repeat logic respects:
- global flags (`data-repeat-rowheader`)
- per-row overrides (`without_prowheader`, `tb_without_rowheader`)
- PTAC/PADDT-specific toggles

---

## 6) Finalization

`finalizeDocument()`:
- inserts dummy rows and footer spacers
- applies repeating footers
- updates logical/physical page numbers
- sets final page heights without forcing `min-height`

Output:
- original `.printform` is removed
- new `.printform_formatter_processed` container is inserted
- each page is `.printform_page` inside `.physical_page_wrapper`

---

## 7) PADDT flow

If PADDT rows exist:
- they render after all main pages and footers
- PADDT pages only include logo + page number footers
- PADDT-specific docinfo flags are applied

