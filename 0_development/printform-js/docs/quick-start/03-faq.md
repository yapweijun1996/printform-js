# Quick Start: FAQ and Checklist

## FAQ

**Q1: Why do I need a local server?**
A: Browsers block local file access for scripts. A local server avoids this.

**Q2: Content is cut off. What should I check?**
A: A single `.prowitem` must not exceed the available page height.

**Q3: How do I hide the row header on a specific page?**
A: Add `without_prowheader` or `tb_without_rowheader` to the row that starts
that page.

**Q4: How do I force a page break?**
A: Add `tb_page_break_before` to the row.

**Q5: Printing margins look wrong.**
A: Check browser print settings and enable background graphics.

---

## Checklist

- [ ] `.printform` container exists and wraps all print content
- [ ] `.prowitem` rows are the smallest units and do not exceed page height
- [ ] Page number placeholders are present if needed
- [ ] `_processed` class variants are styled
- [ ] Config flags match your use case

