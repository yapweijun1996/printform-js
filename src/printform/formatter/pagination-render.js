/* eslint-disable no-console */

import { DomHelpers } from "../dom.js";

export function attachPaginationRenderMethods(FormatterClass) {
  FormatterClass.prototype.renderRows = function renderRows(outputContainer, sections, heights, footerState, heightPerPage, footerSpacerTemplate, logFn) {
    let currentHeight = 0;
    const pageContext = this.initializePageContext(heightPerPage);
    if (this.debug) {
      console.log(`[printform] ===== renderRows START =====`);
      console.log(`[printform] Total rows: ${sections.rows.length}, heightPerPage: ${heightPerPage}px`);
    }

    for (let index = 0; index < sections.rows.length; index++) {
      const row = sections.rows[index];
      const nextRow = sections.rows[index + 1];
      const rowHeight = DomHelpers.measureHeight(row);
      const baseClass = this.getRowBaseClass(row);
      const isPtacRow = this.isPtacRow(row);
      const isPaddtRow = this.isPaddtRow(row);
      const isSubtotal = this.isSubtotalRow(row);
      const isFooter = this.isFooterRow(row);
      const hasFooterCombo = isSubtotal && nextRow && this.isFooterRow(nextRow);
      const footerRow = hasFooterCombo ? nextRow : null;
      const footerBaseClass = footerRow ? this.getRowBaseClass(footerRow) : null;
      const footerHeight = footerRow ? DomHelpers.measureHeight(footerRow) : 0;
      const comboHeight = rowHeight + footerHeight;

      if (!rowHeight && (!hasFooterCombo || !footerHeight)) {
        DomHelpers.markAsProcessed(row, baseClass);
        if (hasFooterCombo) {
          DomHelpers.markAsProcessed(footerRow, footerBaseClass);
          index += 1;
        }
        continue;
      }

      if (currentHeight === 0) {
        this.refreshPageContextForRow(pageContext, row, heights);
        const container = this.getCurrentPageContainer(outputContainer);
        this.ensureFirstPageSections(
          container,
          sections,
          heights,
          logFn,
          pageContext.skipRowHeader
        );
        pageContext.repeatingHeight = this.computeRepeatingHeightForPage(sections, heights, pageContext.skipRowHeader);
        currentHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
        if (this.debug) {
          console.log(`[printform] Page ${this.currentPage} start: firstSectionHeight=${currentHeight}px, pageLimit=${pageContext.limit}px`);
        }
      }

      DomHelpers.markAsProcessed(row, baseClass);
      if (footerRow) {
        DomHelpers.markAsProcessed(footerRow, footerBaseClass);
      }

      if (hasFooterCombo || isSubtotal || isFooter) {
        const priorHeight = currentHeight;
        const footerLabel = hasFooterCombo ? "subtotal+footer" : (isSubtotal ? "subtotal" : "footer");
        if (this.debug) {
          console.log(`[printform]   >> ${footerLabel.toUpperCase()} ROW detected at row[${index}]`);
        }

        if (row.classList.contains("tb_page_break_before")) {
          if (this.debug) {
            console.log(`[printform]   >> PAGE BREAK (tb_page_break_before) at row[${index}]`);
          }
          const skipDummyRowItems = this.shouldSkipDummyRowItemsForContext(pageContext);
          const nextSkipRowHeader = this.shouldSkipRowHeaderForRow(row);
          currentHeight = this.prepareNextPage(
            outputContainer,
            sections,
            logFn,
            pageContext.limit,
            currentHeight,
            footerState,
            footerSpacerTemplate,
            nextSkipRowHeader,
            skipDummyRowItems,
            pageContext.repeatingHeight
          );
          this.refreshPageContextForRow(pageContext, row, heights);
          const container = this.getCurrentPageContainer(outputContainer);
          pageContext.repeatingHeight = this.computeRepeatingHeightForPage(sections, heights, pageContext.skipRowHeader);
          currentHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
        }

        const container = this.getCurrentPageContainer(outputContainer);
        const testClone = DomHelpers.appendRowItem(container, row, null, index, baseClass);
        const testFooterClone = footerRow
          ? DomHelpers.appendRowItem(container, footerRow, null, index + 1, footerBaseClass)
          : null;
        const testHeight = this.measureContentHeight(container, pageContext.repeatingHeight);

        if (testFooterClone && testFooterClone.parentNode === container) {
          container.removeChild(testFooterClone);
        }
        if (testClone && testClone.parentNode === container) {
          container.removeChild(testClone);
        }

        if (testHeight > pageContext.limit) {
          if (this.debug) {
            console.log(`[printform]   >> ${footerLabel.toUpperCase()} would overflow, moving to next page`);
          }
          const skipDummyRowItems = this.shouldSkipDummyRowItemsForContext(pageContext);
          const nextSkipRowHeader = this.shouldSkipRowHeaderForRow(row);
          currentHeight = this.prepareNextPage(
            outputContainer,
            sections,
            logFn,
            pageContext.limit,
            priorHeight,
            footerState,
            footerSpacerTemplate,
            nextSkipRowHeader,
            skipDummyRowItems,
            pageContext.repeatingHeight
          );
          this.refreshPageContextForRow(pageContext, row, heights);
          const nextContainer = this.getCurrentPageContainer(outputContainer);
          pageContext.repeatingHeight = this.computeRepeatingHeightForPage(sections, heights, pageContext.skipRowHeader);
          currentHeight = this.measureContentHeight(nextContainer, pageContext.repeatingHeight);
        }

        const skipDummyRowItems = this.shouldSkipDummyRowItemsForContext(pageContext);
        if (!skipDummyRowItems) {
          const currentContainer = this.getCurrentPageContainer(outputContainer);
          const reservedHeight = footerRow ? comboHeight : rowHeight;
          currentHeight = this.insertFooterDummyRows(currentContainer, pageContext, currentHeight, reservedHeight, footerLabel);
        }

        const finalContainer = this.getCurrentPageContainer(outputContainer);
        DomHelpers.appendRowItem(finalContainer, row, null, index, baseClass);
        if (footerRow) {
          DomHelpers.appendRowItem(finalContainer, footerRow, null, index + 1, footerBaseClass);
        }
        if (logFn) {
          logFn(`append ${footerLabel} ${index}`);
        }
        currentHeight = this.measureContentHeight(finalContainer, pageContext.repeatingHeight);
        if (this.debug) {
          console.log(`[printform]   ${footerLabel} row[${index}] added, currentHeight=${currentHeight}px`);
        }

        const footerIsPtac = footerRow ? this.isPtacRow(footerRow) : false;
        const footerIsPaddt = footerRow ? this.isPaddtRow(footerRow) : false;
        if (!isPtacRow && !footerIsPtac) {
          pageContext.isPtacPage = false;
        }
        if (!isPaddtRow && !footerIsPaddt) {
          pageContext.isPaddtPage = false;
        }
        if (hasFooterCombo) {
          index += 1;
        }
        continue;
      }

      if (row.classList.contains("tb_page_break_before")) {
        if (this.debug) {
          console.log(`[printform]   >> PAGE BREAK (tb_page_break_before) at row[${index}]`);
        }
        const skipDummyRowItems = this.shouldSkipDummyRowItemsForContext(pageContext);
        const nextSkipRowHeader = this.shouldSkipRowHeaderForRow(row);
        currentHeight = this.prepareNextPage(
          outputContainer,
          sections,
          logFn,
          pageContext.limit,
          currentHeight,
          footerState,
          footerSpacerTemplate,
          nextSkipRowHeader,
          skipDummyRowItems,
          pageContext.repeatingHeight
        );
        this.refreshPageContextForRow(pageContext, row, heights);
        const container = this.getCurrentPageContainer(outputContainer);
        pageContext.repeatingHeight = this.computeRepeatingHeightForPage(sections, heights, pageContext.skipRowHeader);
        currentHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
        DomHelpers.appendRowItem(container, row, null, index, baseClass);
        if (logFn) {
          const resolvedLabel = baseClass || "prowitem";
          logFn(`append ${resolvedLabel} ${index}`);
        }
        currentHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
        if (this.debug) {
          console.log(`[printform] Page ${this.currentPage} start: currentHeight=${currentHeight}px, limit=${pageContext.limit}px`);
        }
        if (!isPtacRow) {
          pageContext.isPtacPage = false;
        }
        if (!isPaddtRow) {
          pageContext.isPaddtPage = false;
        }
        continue;
      }

      const container = this.getCurrentPageContainer(outputContainer);
      const priorHeight = currentHeight;

      const clone = DomHelpers.appendRowItem(container, row, null, index, baseClass);
      const measuredHeight = this.measureContentHeight(container, pageContext.repeatingHeight);
      if (this.debug) {
        console.log(`[printform]   row[${index}] height=${rowHeight}px, currentHeight=${measuredHeight}px, limit=${pageContext.limit}px`);
      }
      if (measuredHeight <= pageContext.limit) {
        if (logFn) {
          const resolvedLabel = baseClass || "prowitem";
          logFn(`append ${resolvedLabel} ${index}`);
        }
        currentHeight = measuredHeight;
        if (!isPtacRow) {
          pageContext.isPtacPage = false;
        }
        if (!isPaddtRow) {
          pageContext.isPaddtPage = false;
        }
        continue;
      }

      if (clone && clone.parentNode === container) {
        container.removeChild(clone);
      }
      if (this.debug) {
        console.log(`[printform]   >> PAGE BREAK (overflow) at row[${index}]`);
      }
      const skipDummyRowItems = this.shouldSkipDummyRowItemsForContext(pageContext);
      const nextSkipRowHeader = this.shouldSkipRowHeaderForRow(row);
      currentHeight = this.prepareNextPage(
        outputContainer,
        sections,
        logFn,
        pageContext.limit,
        priorHeight,
        footerState,
        footerSpacerTemplate,
        nextSkipRowHeader,
        skipDummyRowItems,
        pageContext.repeatingHeight
      );
      this.refreshPageContextForRow(pageContext, row, heights);
      const nextContainer = this.getCurrentPageContainer(outputContainer);
      pageContext.repeatingHeight = this.computeRepeatingHeightForPage(sections, heights, pageContext.skipRowHeader);
      currentHeight = this.measureContentHeight(nextContainer, pageContext.repeatingHeight);
      DomHelpers.appendRowItem(nextContainer, row, null, index, baseClass);
      if (logFn) {
        const resolvedLabel = baseClass || "prowitem";
        logFn(`append ${resolvedLabel} ${index}`);
      }
      currentHeight = this.measureContentHeight(nextContainer, pageContext.repeatingHeight);
      if (this.debug) {
        console.log(`[printform] Page ${this.currentPage} start: currentHeight=${currentHeight}px, limit=${pageContext.limit}px`);
      }
      if (!isPtacRow) {
        pageContext.isPtacPage = false;
      }
      if (!isPaddtRow) {
        pageContext.isPaddtPage = false;
      }
    }

    if (this.debug) {
      console.log(`[printform] ===== renderRows END (page ${this.currentPage}, finalHeight=${currentHeight}px) =====`);
    }
    return {
      currentHeight,
      pageLimit: pageContext.limit,
      isPtacPage: pageContext.isPtacPage,
      isPaddtPage: pageContext.isPaddtPage,
      repeatingHeight: pageContext.repeatingHeight
    };
  };

  FormatterClass.prototype.renderEmptyDocument = function renderEmptyDocument(outputContainer, sections, heights, heightPerPage, logFn) {
    const container = this.getCurrentPageContainer(outputContainer);
    const skipRowHeader = false;
    if (this.debug) {
      console.log(`[printform] ===== renderEmptyDocument START =====`);
    }
    this.ensureFirstPageSections(container, sections, heights, logFn, skipRowHeader);
    const repeatingHeight = this.computeRepeatingHeightForPage(sections, heights, skipRowHeader);
    const currentHeight = this.measureContentHeight(container, repeatingHeight);
    if (this.debug) {
      console.log(`[printform] Empty document currentHeight=${currentHeight}px, pageLimit=${heightPerPage}px`);
      console.log(`[printform] ===== renderEmptyDocument END =====`);
    }
    return {
      currentHeight,
      pageLimit: heightPerPage,
      isPtacPage: false,
      isPaddtPage: false,
      repeatingHeight
    };
  };
}
