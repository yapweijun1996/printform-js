const MEANINGFUL_PAGE_CONTENT = [
  ".pheader_processed",
  ".pdocinfo_processed",
  ".prowheader_processed",
  ".prowitem_processed",
  ".ptac-rowitem_processed",
  ".paddt-rowitem_processed",
  ".pfooter_processed",
  ".pfooter_logo_processed",
  ".pfooter_pagenum_processed",
  ".signature-block",
  ".pfsign",
  "[data-pf-component-id]",
  "[data-pf-component-type='signature']",
  "[data-pf-component-type='total']",
];

function rectOf(node) {
  const rect = node?.getBoundingClientRect?.();
  return rect && Number.isFinite(rect.width) ? rect : { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
}

function componentId(node) {
  return node?.getAttribute?.("data-pf-component-id") ||
    node?.getAttribute?.("data-pf-table-id") ||
    node?.id || null;
}

function tableId(node) {
  return node?.getAttribute?.("data-pf-table-id") || node?.getAttribute?.("data-pf-table") || "default";
}

function issue(code, node, pageIndex, pageRect, reason, recommendedAction) {
  const measured = rectOf(node);
  const availableHeight = Math.max(0, pageRect.height);
  return {
    code,
    component_id: componentId(node),
    page: pageIndex + 1,
    pageIndex,
    measured_size: { width: Math.round(measured.width), height: Math.round(measured.height) },
    available_size: { width: Math.round(pageRect.width), height: Math.round(availableHeight) },
    reason,
    recommended_action: recommendedAction,
    selector: node?.className ? `.${String(node.className).split(/\s+/)[0]}` : "unknown",
  };
}

function pageIndexOf(node, pages) {
  return pages.indexOf(node?.closest?.(".printform_page"));
}

function flag(value) {
  return ["1", "true", "yes", "y"].includes(String(value || "").toLowerCase());
}

function isKeepTogetherNode(node) {
  const className = String(node.getAttribute?.("class") || "").toLowerCase();
  return node.getAttribute?.("data-pf-keep-together") === "true" ||
    node.getAttribute?.("data-pf-component-type") === "signature" ||
    className.includes("signature") || className.includes("pfsign") ||
    className.includes("pf-total") || className.includes("total-block");
}

function keepTogetherCode(node) {
  const className = String(node.getAttribute?.("class") || "").toLowerCase();
  if (className.includes("signature") || className.includes("pfsign") || node.getAttribute?.("data-pf-component-type") === "signature") return "SIGNATURE_SPLIT";
  if (className.includes("total")) return "TOTAL_BLOCK_SPLIT";
  return "KEEP_TOGETHER_FAILURE";
}

export function collectPaginationDiagnostics(doc, manifest = {}) {
  const pages = Array.from(doc.querySelectorAll(".printform_page"));
  const issues = [];
  const errors = [];
  const pageRects = pages.map(rectOf);
  const add = (entry) => {
    issues.push(entry);
    errors.push(entry);
  };

  pages.forEach((page, pageIndex) => {
    const pageRect = pageRects[pageIndex];
    const rows = Array.from(page.querySelectorAll(".prowitem_processed, .ptac-rowitem_processed, .paddt-rowitem_processed"));
    // PTAC/PADDT are continuation sections, not ordinary data tables. They
    // deliberately have no .prowheader, so treating them as table id
    // "default" creates a false ACTIVE_TABLE_HEADER_MISSING on valid
    // documents. Active-table identity is meaningful only for .prowitem rows.
    const tableRows = Array.from(page.querySelectorAll(".prowitem_processed"));
    const headers = Array.from(page.querySelectorAll(".prowheader_processed"));
    const rowTables = new Set(tableRows.map(tableId));
    const headerTables = new Set(headers.map(tableId));
    rowTables.forEach((table) => {
      if (!headerTables.has(table)) {
        add(issue("ACTIVE_TABLE_HEADER_MISSING", rows.find((row) => tableId(row) === table), pageIndex, pageRect,
          `Rows for active table ${table} have no matching repeated header on this page`,
          "Add a table header to the registry and repeat the active table header on page creation"));
      }
    });
    headers.forEach((header) => {
      const table = tableId(header);
      if (rowTables.size && !rowTables.has(table)) {
        add(issue("ACTIVE_TABLE_HEADER_INCORRECT", header, pageIndex, pageRect,
          `Header for completed or inactive table ${table} is repeated on a page containing ${Array.from(rowTables).join(", ")} rows`,
          "Use the next row's table id when creating a continuation page"));
      }
    });

    if (!page.querySelector(MEANINGFUL_PAGE_CONTENT.join(","))) {
      add(issue("BLANK_PAGE", page, pageIndex, pageRect,
        "Logical page has no document, table, footer, or page-number content",
        "Remove the extra page break or prevent an empty page from being created"));
    }

    rows.forEach((row) => {
      const measured = rectOf(row);
      if (measured.height > pageRect.height + 1 && pageRect.height > 0) {
        add(issue("ROW_TOO_TALL", row, pageIndex, pageRect,
          "A single row is taller than the usable logical page",
          "Split variable-height content, reduce typography, or move the row to a dedicated layout"));
      }
    });

    const keepNodes = Array.from(page.querySelectorAll("[data-pf-keep-together='true'], [data-pf-component-type='signature'], [data-pf-component-type='total'], .signature-block, .pfsign, .pf-total-block, .pf-total-claim"));
    keepNodes.forEach((node) => {
      const measured = rectOf(node);
      if (measured.bottom > pageRect.bottom + 1 || measured.height > pageRect.height + 1) {
        add(issue(keepTogetherCode(node), node, pageIndex, pageRect,
          "Keep-together component crosses the available page boundary",
          "Reserve the component height before placing it and start it on the next page when needed"));
      }
      if (node.getAttribute("data-pf-orphan-total") === "true" || node.getAttribute("data-pf-total-orphan") === "true") {
        add(issue("ORPHAN_TOTAL", node, pageIndex, pageRect,
          "Total block is explicitly marked as orphaned from its detail rows",
          "Bind the total block to the table section and apply keep-together"));
      }
    });
  });

  const repeatedComponents = new Map();
  pages.forEach((page, pageIndex) => {
    page.querySelectorAll("[data-pf-component-id]").forEach((node) => {
      const id = node.getAttribute("data-pf-component-id");
      const pagesForId = repeatedComponents.get(id) || new Set();
      pagesForId.add(pageIndex);
      repeatedComponents.set(id, pagesForId);
    });
  });
  repeatedComponents.forEach((pageSet, id) => {
    if (pageSet.size < 2) return;
    const firstPage = Array.from(pageSet)[0];
    const node = pages[firstPage]?.querySelector(`[data-pf-component-id="${id}"]`);
    if (node && isKeepTogetherNode(node)) {
      add(issue(keepTogetherCode(node), node, firstPage, pageRects[firstPage],
        `Component ${id} appears on more than one logical page`,
        "Keep the complete component on one page or split it into explicit semantic parts"));
    }
  });

  const templateRoot = doc.getElementById("pf-template")?.content?.querySelector(".printform");
  const pageNumberSelector = ".pfooter_pagenum_processed, [data-page-number], [data-page-total]";
  const hasPageNumber = Boolean(doc.querySelector(pageNumberSelector));
  if ((hasPageNumber || flag(templateRoot?.dataset.repeatFooterPagenum)) && flag(templateRoot?.dataset.repeatFooterPagenum)) {
    pages.forEach((page, pageIndex) => {
      if (!page.querySelector(pageNumberSelector)) {
        add(issue("PAGE_NUMBER_MISSING", page, pageIndex, pageRects[pageIndex],
          "Repeated footer/page-number component is missing from this page",
          "Repeat the footer page-number component and update logical/physical totals after pagination"));
      }
    });
  }
  const footerSelector = ".pfooter_processed, .pfooter_logo_processed, .pfooter_pagenum_processed";
  const footerExpected = flag(templateRoot?.dataset.repeatFooter) || flag(templateRoot?.dataset.repeatFooterLogo) || flag(templateRoot?.dataset.repeatFooterPagenum);
  if (footerExpected && doc.querySelector(footerSelector)) {
    pages.forEach((page, pageIndex) => {
      if (!page.querySelector(footerSelector)) {
        add(issue("FOOTER_MISSING", page, pageIndex, pageRects[pageIndex],
          "Configured repeated footer content is missing from this logical page",
          "Repeat the configured footer, logo, or page-number component before finalizing pagination"));
      }
    });
  }
  pages.forEach((page, pageIndex) => {
    page.querySelectorAll("[data-page-number], [data-page-total], [data-physical-page-number], [data-physical-page-total]").forEach((node) => {
      if (!String(node.textContent || "").trim()) {
        add(issue("PAGE_NUMBER_INVALID", node, pageIndex, pageRects[pageIndex],
          "Page-number placeholder was not resolved", "Resolve logical and physical page numbers after final page count is known"));
      }
    });
  });

  const pageHeight = Number(templateRoot?.dataset.papersizeHeight) || 0;
  return {
    valid: errors.length === 0,
    errors,
    issues,
    metrics: {
      rowTooTall: issues.filter((entry) => entry.code === "ROW_TOO_TALL").length,
      activeTableHeaderErrors: issues.filter((entry) => entry.code.startsWith("ACTIVE_TABLE_HEADER")).length,
      blankPages: issues.filter((entry) => entry.code === "BLANK_PAGE").length,
      keepTogetherFailures: issues.filter((entry) => ["KEEP_TOGETHER_FAILURE", "SIGNATURE_SPLIT", "TOTAL_BLOCK_SPLIT", "ORPHAN_TOTAL"].includes(entry.code)).length,
      pageHeight,
    },
  };
}
