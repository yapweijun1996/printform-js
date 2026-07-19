/* eslint-disable no-console */

// Parses a user-supplied dummy-row HTML string into a single DOM element.
//
// The documented convention for `customDummyRowItemContent` (see index001.html,
// index_subtotal_test.html) is two sibling <tr> elements with no enclosing
// <table> — an outer 15px/inherit/15px padding wrapper row, then a content
// row. `<tr>` is only a legal child of a table-related element; parsing via
// `div.innerHTML` silently drops such bare <tr> nodes (and their direct <td>
// children) per the HTML5 parsing algorithm, while any element nested deeper
// inside (e.g. an inner <table>) survives and gets hoisted to the top —
// producing a dummy row missing its outer padding columns, ~30px wider than
// the real data rows it's supposed to match.
//
// <template> parses its content fragment context-free, so bare <tr> siblings
// survive intact. If the content is already a single root element (a full
// <table>, as dom.js's createDummyRowItemTable expects), use it as-is; if
// it's multiple sibling rows, wrap them in a <table> so the whole unit —
// padding columns included — renders together.
function parseDummyRowContent(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const elements = Array.from(template.content.childNodes)
    .filter((node) => node.nodeType === Node.ELEMENT_NODE);

  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0];

  const table = document.createElement('table');
  table.setAttribute('cellpadding', '0');
  table.setAttribute('cellspacing', '0');
  table.setAttribute('border', '0');
  table.style.width = '100%';
  table.style.tableLayout = 'fixed';
  elements.forEach((el) => table.appendChild(el));
  return table;
}

export function attachPaginationDummyMethods(FormatterClass) {
  FormatterClass.prototype.insertFooterDummyRows = function insertFooterDummyRows(container, pageContext, currentHeight, reservedHeight, footerLabel) {
    const availableSpace = pageContext.limit - currentHeight - reservedHeight;
    const dummyHeight = this.config.heightOfDummyRowItem || 27;
    const numDummies = Math.floor(availableSpace / dummyHeight);

    if (numDummies > 0 && this.debug) {
      console.log(`[printform]   >> Inserting ${numDummies} dummy rows before ${footerLabel}`);
    }

    const defaultDummyContent = `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;" class="prowitem_dummy"><tr><td style="height:${dummyHeight}px;">&nbsp;</td></tr></table>`;
    const dummyContent = this.config.customDummyRowItemContent || defaultDummyContent;

    for (let i = 0; i < numDummies; i++) {
      if (dummyContent) {
        let dummyNode = parseDummyRowContent(dummyContent);

        if (!dummyNode) {
          dummyNode = parseDummyRowContent(`<div style="height:${dummyHeight}px" class="prowitem_dummy">&nbsp;</div>`);
        }

        if (dummyNode) {
          if (!dummyNode.classList.contains('prowitem_dummy')) {
            dummyNode.classList.add('prowitem_dummy');
          }
          container.appendChild(dummyNode);
        }
      }
    }

    return this.measureContentHeight(container, pageContext.repeatingHeight);
  };
}
