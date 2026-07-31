import { translateFragment } from "./i18n.js";

// Discovers the repeating-row table groups in a template so the P1 table-
// columns panel can show real column labels and widths instead of a blank
// form the engineer has to reverse-engineer from raw HTML. Read-only: this
// never mutates templateHtml, only describes it.
//
// PrintForm templates commonly split what is conceptually one table into a
// `.prowheader` (the header row) and a sibling `.prowitem` (the repeating
// data row) — see set_column_widths in operations.js, which accepts a
// comma-separated tableSelector for exactly this reason. Both current
// standard samples (Sales Invoice, Purchase Order) have exactly one such
// pair, so groups are paired by document order; a template with more than
// one pair would need a more specific selector than this returns, which is
// out of scope until a real template actually has that shape.
export function inspectColumnGroups(templateHtml, project) {
  const template = document.createElement("template");
  template.innerHTML = templateHtml;
  const headerTables = Array.from(template.content.querySelectorAll("table.prowheader"));
  const itemTables = Array.from(template.content.querySelectorAll("table.prowitem"));
  const locale = project.manifest?.locale;
  const fallbackLocale = project.manifest?.i18n?.fallbackLocale || locale;
  return headerTables.map((headerTable, index) => {
    const headerRow = headerTable.rows[0];
    if (!headerRow) return null;
    const itemTable = itemTables[index];
    // Resolve data-pf-i18n keys on a detached clone — translateFragment
    // mutates textContent in place, and the real template must stay
    // untouched (it still holds the {{-style}} keys for every other locale).
    const clone = headerRow.cloneNode(true);
    translateFragment(clone, project.i18n || {}, locale, fallbackLocale);
    const cells = Array.from(headerRow.cells);
    const labels = Array.from(clone.cells);
    return {
      // The PrintForm.js convention, not an incidental detail of these two
      // templates: .prowheader/.prowitem are the semantic role markers a
      // template author sets regardless of what other styling classes (e.g.
      // .pf-grid) ride along on the same element.
      tableSelector: itemTable ? ".prowheader, .prowitem" : ".prowheader",
      columns: cells.map((cell, i) => ({
        label: labels[i]?.textContent.trim() || `Column ${i + 1}`,
        width: cell.style.width || ""
      }))
    };
  }).filter(Boolean);
}
