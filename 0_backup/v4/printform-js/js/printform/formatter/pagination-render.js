/* eslint-disable no-console */

import { normalizeHeight } from "../helpers.js";
import { DomHelpers, applyDummyRowItemsStep, applyDummyRowStep, applyFooterSpacerWithDummyStep, applyFooterSpacerStep } from "../dom.js";

export function attachPaginationRenderMethods(FormatterClass) {
  FormatterClass.prototype.initializePageContext = function initializePageContext(heightPerPage) {
    return {
      baseLimit: heightPerPage,
      limit: heightPerPage,
      skipRowHeader: false,
      isPtacPage: false,
      isPaddtPage: false
    };
  };

  FormatterClass.prototype.refreshPageContextForRow = function refreshPageContextForRow(pageContext, row, heights) {
    if (!pageContext) {
      return pageContext;
    }
    const skipRowHeader = this.shouldSkipRowHeaderForRow(row);
    const rowHeaderHeight = heights.rowHeader || 0;
    pageContext.skipRowHeader = skipRowHeader;
    pageContext.isPtacPage = this.isPtacRow(row);
    pageContext.isPaddtPage = this.isPaddtRow(row);
    pageContext.limit = pageContext.baseLimit + (skipRowHeader ? rowHeaderHeight : 0);
    return pageContext;
  };

  FormatterClass.prototype.renderRows = function renderRows(outputContainer, sections, heights, footerState, heightPerPage, footerSpacerTemplate, logFn) {
    let currentHeight = 0;
    const pageContext = this.initializePageContext(heightPerPage);
    if (this.debug) {
      console.log(`[printform] ===== renderRows START =====`);
      console.log(`[printform] Total rows: ${sections.rows.length}, heightPerPage: ${heightPerPage}px`);
    }
    sections.rows.forEach((row, index) => {
      const rowHeight = DomHelpers.measureHeight(row);
      const baseClass = this.getRowBaseClass(row);
      const isPtacRow = this.isPtacRow(row);
      const isPaddtRow = this.isPaddtRow(row);
      if (!rowHeight) {
        DomHelpers.markAsProcessed(row, baseClass);
        return;
      }

      if (currentHeight === 0) {
        this.refreshPageContextForRow(pageContext, row, heights);
        const container = this.getCurrentPageContainer(outputContainer);
        currentHeight += this.ensureFirstPageSections(
          container,
          sections,
          heights,
          logFn,
          pageContext.skipRowHeader
        );
        if (this.debug) {
          console.log(`[printform] Page ${this.currentPage} start: firstSectionHeight=${currentHeight}px, pageLimit=${pageContext.limit}px`);
        }
      }

      currentHeight += rowHeight;
      if (this.debug) {
        console.log(`[printform]   row[${index}] height=${rowHeight}px, currentHeight=${currentHeight}px, limit=${pageContext.limit}px`);
      }
      DomHelpers.markAsProcessed(row, baseClass);

      if (row.classList.contains("tb_page_break_before")) {
        if (this.debug) {
          console.log(`[printform]   >> PAGE BREAK (tb_page_break_before) at row[${index}]`);
        }
        currentHeight -= rowHeight;
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
          skipDummyRowItems
        );
        this.refreshPageContextForRow(pageContext, row, heights);
        const container = this.getCurrentPageContainer(outputContainer);
        DomHelpers.appendRowItem(container, row, logFn, index, baseClass);
        currentHeight = rowHeight;
        if (this.debug) {
          console.log(`[printform] Page ${this.currentPage} start: currentHeight=${currentHeight}px, limit=${pageContext.limit}px`);
        }
        if (!isPtacRow) {
          pageContext.isPtacPage = false;
        }
        if (!isPaddtRow) {
          pageContext.isPaddtPage = false;
        }
      } else if (currentHeight <= pageContext.limit) {
        const container = this.getCurrentPageContainer(outputContainer);
        DomHelpers.appendRowItem(container, row, logFn, index, baseClass);
        if (!isPtacRow) {
          pageContext.isPtacPage = false;
        }
        if (!isPaddtRow) {
          pageContext.isPaddtPage = false;
        }
      } else {
        currentHeight -= rowHeight;
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
          currentHeight,
          footerState,
          footerSpacerTemplate,
          nextSkipRowHeader,
          skipDummyRowItems
        );
        this.refreshPageContextForRow(pageContext, row, heights);
        const container = this.getCurrentPageContainer(outputContainer);
        DomHelpers.appendRowItem(container, row, logFn, index, baseClass);
        currentHeight = rowHeight;
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
    });
    if (this.debug) {
      console.log(`[printform] ===== renderRows END (page ${this.currentPage}, finalHeight=${currentHeight}px) =====`);
    }
    return {
      currentHeight,
      pageLimit: pageContext.limit,
      isPtacPage: pageContext.isPtacPage,
      isPaddtPage: pageContext.isPaddtPage
    };
  };

  FormatterClass.prototype.prepareNextPage = function prepareNextPage(
    outputContainer,
    sections,
    logFn,
    pageLimit,
    currentHeight,
    footerState,
    spacerTemplate,
    skipRowHeader,
    skipDummyRowItems
  ) {
    const container = this.getCurrentPageContainer(outputContainer);
    const filledHeight = this.applyRemainderSpacing(
      container,
      pageLimit,
      currentHeight,
      footerState,
      spacerTemplate,
      {
        skipDummyRowItems
      }
    );
    this.appendRepeatingFooters(container, sections, logFn);
    this.currentPage += 1;
    this.currentPageContainer = null;
    this.createNewLogicalPage(outputContainer);
    const nextContainer = this.getCurrentPageContainer(outputContainer);
    this.appendRepeatingSections(nextContainer, sections, logFn, skipRowHeader);
    return filledHeight;
  };

  FormatterClass.prototype.applyRemainderSpacing = function applyRemainderSpacing(container, heightPerPage, currentHeight, footerState, spacerTemplate, options) {
    const skipDummyRowItems = options && options.skipDummyRowItems;
    let workingHeight = normalizeHeight(currentHeight);
    if (this.debug) {
      console.log(`[printform] ----- applyRemainderSpacing (page ${this.currentPage}) -----`);
      console.log(`[printform]   heightPerPage: ${heightPerPage}px, currentHeight: ${currentHeight}px`);
      console.log(`[printform]   skipDummyRowItems: ${skipDummyRowItems}`);
    }
    if (!skipDummyRowItems) {
      workingHeight = applyDummyRowItemsStep(this.config, container, heightPerPage, workingHeight, this.debug);
    }
    workingHeight = applyDummyRowStep(this.config, container, heightPerPage, workingHeight, this.debug);
    const spacerState = applyFooterSpacerWithDummyStep(
      this.config,
      container,
      heightPerPage,
      workingHeight,
      skipDummyRowItems,
      this.debug
    );
    workingHeight = spacerState.currentHeight;
    if (!spacerState.skipFooterSpacer) {
      applyFooterSpacerStep(
        this.config,
        container,
        heightPerPage,
        workingHeight,
        footerState,
        spacerTemplate,
        this.debug
      );
    }
    if (this.debug) {
      console.log(`[printform]   finalHeight after spacing: ${workingHeight}px`);
      console.log(`[printform] -----------------------------------------`);
    }
    return normalizeHeight(workingHeight);
  };
}

