# Developer Handbook

## Quick Setup
- Serve the repo with `python -m http.server 8000` and review pages at `http://localhost:8000/`.
- Use Chromium print preview as the source of truth; confirm widths stay below 750px.
- Run `npx eslint js/printform.js` (ES5 style, tabs, double quotes) ahead of every commit.

## Layout Processing Pipeline
- Printable layouts (`index001.html`–`indexXXX.html`, `example.html`) reside at the repo root; treat them as production assets.
- `formatAllPrintForms()` in `js/printform.js` clones the `.printform`, resolves `data-*` config, and stitches the output page by page.
- Sections map to headers (`.pheader`), doc info (`.pdocinfo*`), row headers (`.prowheader`), rows (`.prowitem`), PTAC rows (`.ptac-rowitem`), and footers (`.pfooter*`, `.pfooter_logo`, `.pfooter_pagenum`). Add new blocks within this taxonomy so pagination logic can detect them.
- Dummy fillers (`data-insert-dummy-row-item-while-format-table`, `data-insert-dummy-row-while-format-table`) smooth the last page. Update `data-height-of-dummy-row-item` whenever row height changes.

- Place the PTAC table after the final `.prowitem` and before footers. Keep the markup simple—`class="paper_width ptac"` plus a heading paragraph and successive `<p>` blocks, for example:
  ```html
  <table class="paper_width ptac">
    …
    <div style="padding:10px 0 15px 0;">
      <p style="font-weight:600;">Purchase Terms and Conditions (PTAC)</p>
      <p>Paragraph 1…</p>
      <p>Paragraph 2…</p>
    </div>
    …
  </table>
  ```
- `expandPtacSegments()` (`js/printform.js:438`) clones the PTAC for every content paragraph (splitting long paragraphs into ~200-word chunks), leaves the heading on the first block, and flags each clone as a `.ptac-rowitem`. Pagination then treats PTAC segments like any other row while keeping their class distinct.
- For a forced break, give the relevant clone (or upstream block) the `tb_page_break_before` class.
- If PTAC is absent the formatter skips expansion; no additional config is necessary.
- Set `data-repeat-ptac-rowheader="n"` when PTAC blocks should appear without the repeating `.prowheader`; pair it with `data-insert-ptac-dummy-row-items="n"` to suppress dummy fillers on PTAC-only pages. Leave both at `y` to retain legacy row layout (each `.ptac-rowitem` will inherit `.prowheader` just like `.prowitem`).

## Maintaining printform.js
- Follow ES5 syntax, tabs, and double quotes. New globals belong in `CONFIG_DESCRIPTORS` plus the `.printform` comment block.
- Extend `collectSections()` and the inline documentation any time you invent a new section class or `data-*` flag.
- Enable `data-debug="y"` for verbose logs while troubleshooting, then turn it off before pushing.

## Workflow Tips
- Use a new `indexXXX.html` variant for smoke demos and document fresh flags in the `.printform` comment.
- Collect Chromium print preview screenshots (first/last page) plus testing notes for every PR.
- Leave `js/printform - Copy.js` untouched; it is the regression reference.
