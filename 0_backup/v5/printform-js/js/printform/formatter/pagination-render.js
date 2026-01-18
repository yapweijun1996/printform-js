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
      isPaddtPage: false,
      repeatingHeight: 0
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

  FormatterClass.prototype.computeRepeatingHeightForPage = function computeRepeatingHeightForPage(sections, heights, skipRowHeader) {
    let total = 0;
    if (this.config.repeatHeader && sections.header) {
      total += heights.header || 0;
    }
    sections.docInfos.forEach((docInfo) => {
      if (this.config[docInfo.repeatFlag]) {
        total += heights.docInfos[docInfo.key] || 0;
      }
    });
    if (this.config.repeatRowheader && sections.rowHeader && !skipRowHeader) {
      total += heights.rowHeader || 0;
    }
    return normalizeHeight(total);
  };

  FormatterClass.prototype.measureContentHeight = function measureContentHeight(container, repeatingHeight) {
    const total = DomHelpers.measureHeight(container);
    return normalizeHeight(total - (repeatingHeight || 0));
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
      } else {
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
          return;
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
    });
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

  FormatterClass.prototype.prepareNextPage = function prepareNextPage(
    outputContainer,
    sections,
    logFn,
    pageLimit,
    currentHeight,
    footerState,
    spacerTemplate,
    skipRowHeader,
    skipDummyRowItems,
    repeatingHeight
  ) {
    const container = this.getCurrentPageContainer(outputContainer);
    const filledHeight = this.applyRemainderSpacing(
      container,
      pageLimit,
      currentHeight,
      footerState,
      spacerTemplate,
      {
        skipDummyRowItems,
        repeatingHeight
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
    const repeatingHeight = options && Number.isFinite(options.repeatingHeight) ? options.repeatingHeight : null;
    const useCurrentHeight = options && options.useCurrentHeight === true;
    let workingHeight = normalizeHeight(currentHeight);
    if (repeatingHeight !== null && !useCurrentHeight) {
      const measuredTotal = DomHelpers.measureHeight(container);
      workingHeight = normalizeHeight(measuredTotal - repeatingHeight);
    }
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
