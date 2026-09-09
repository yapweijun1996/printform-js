import { DomHelpers } from "../dom.js";

export function renderSpecialRow(formatter, context) {
  const {
    outputContainer, sections, heights, footerState, footerSpacerTemplate, logFn,
    pageContext, row, nextRow, index, rowHeight, footerHeight, comboHeight,
    currentHeight: startingHeight, hasFooterCombo, isPtacRow, isPaddtRow, baseClass, footerBaseClass
  } = context;
  const footerRow = hasFooterCombo ? nextRow : null;
  let currentHeight = startingHeight;
  const priorHeight = currentHeight;
  const isSubtotal = formatter.isSubtotalRow(row);
  const isFooter = formatter.isFooterRow(row);
  const footerLabel = hasFooterCombo ? "subtotal+footer" : (isSubtotal ? "subtotal" : "footer");

  if (formatter.debug) {
    console.log(`[printform]   >> ${footerLabel.toUpperCase()} ROW detected at row[${index}]`);
  }

  if (row.classList.contains("tb_page_break_before")) {
    if (formatter.debug) {
      console.log(`[printform]   >> PAGE BREAK (tb_page_break_before) at row[${index}]`);
    }
    const skipDummyRowItems = formatter.shouldSkipDummyRowItemsForContext(pageContext);
    const nextSkipRowHeader = formatter.shouldSkipRowHeaderForRow(row);
    currentHeight = formatter.prepareNextPage(
      outputContainer, sections, logFn, pageContext.limit, currentHeight,
      footerState, footerSpacerTemplate, nextSkipRowHeader, skipDummyRowItems,
      pageContext.repeatingHeight, formatter.getRowTableId(row)
    );
    formatter.refreshPageContextForRow(pageContext, row, heights, sections);
    const container = formatter.getCurrentPageContainer(outputContainer);
    pageContext.repeatingHeight = formatter.computeRepeatingHeightForPage(
      sections, heights, pageContext.skipRowHeader, pageContext.tableId
    );
    currentHeight = formatter.measureContentHeight(container, pageContext.repeatingHeight);
  }

  const container = formatter.getCurrentPageContainer(outputContainer);
  const testClone = DomHelpers.appendRowItem(container, row, null, index, baseClass);
  const testFooterClone = footerRow
    ? DomHelpers.appendRowItem(container, footerRow, null, index + 1, footerBaseClass)
    : null;
  const testHeight = formatter.measureContentHeight(container, pageContext.repeatingHeight);
  if (testFooterClone && testFooterClone.parentNode === container) container.removeChild(testFooterClone);
  if (testClone && testClone.parentNode === container) container.removeChild(testClone);

  if (testHeight > pageContext.limit) {
    if (formatter.debug) {
      console.log(`[printform]   >> ${footerLabel.toUpperCase()} would overflow, moving to next page`);
    }
    const skipDummyRowItems = formatter.shouldSkipDummyRowItemsForContext(pageContext);
    const nextSkipRowHeader = formatter.shouldSkipRowHeaderForRow(row);
    currentHeight = formatter.prepareNextPage(
      outputContainer, sections, logFn, pageContext.limit, priorHeight,
      footerState, footerSpacerTemplate, nextSkipRowHeader, skipDummyRowItems,
      pageContext.repeatingHeight, formatter.getRowTableId(row)
    );
    formatter.refreshPageContextForRow(pageContext, row, heights, sections);
    const nextContainer = formatter.getCurrentPageContainer(outputContainer);
    pageContext.repeatingHeight = formatter.computeRepeatingHeightForPage(
      sections, heights, pageContext.skipRowHeader, pageContext.tableId
    );
    currentHeight = formatter.measureContentHeight(nextContainer, pageContext.repeatingHeight);
  }

  const skipDummyRowItems = formatter.shouldSkipDummyRowItemsForContext(pageContext);
  if (!skipDummyRowItems) {
    const currentContainer = formatter.getCurrentPageContainer(outputContainer);
    const reservedHeight = footerRow ? comboHeight : rowHeight;
    currentHeight = formatter.insertFooterDummyRows(
      currentContainer, pageContext, currentHeight, reservedHeight, footerLabel
    );
  }

  const finalContainer = formatter.getCurrentPageContainer(outputContainer);
  DomHelpers.appendRowItem(finalContainer, row, null, index, baseClass);
  if (footerRow) DomHelpers.appendRowItem(finalContainer, footerRow, null, index + 1, footerBaseClass);
  if (logFn) logFn(`append ${footerLabel} ${index}`);
  currentHeight = formatter.measureContentHeight(finalContainer, pageContext.repeatingHeight);
  if (formatter.debug) {
    console.log(`[printform]   ${footerLabel} row[${index}] added, currentHeight=${currentHeight}px`);
  }

  const footerIsPtac = footerRow ? formatter.isPtacRow(footerRow) : false;
  const footerIsPaddt = footerRow ? formatter.isPaddtRow(footerRow) : false;
  if (!isPtacRow && !footerIsPtac) pageContext.isPtacPage = false;
  if (!isPaddtRow && !footerIsPaddt) pageContext.isPaddtPage = false;
  return { currentHeight, consumedNextRow: Boolean(hasFooterCombo) };
}
