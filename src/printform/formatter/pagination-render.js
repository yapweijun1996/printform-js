/* eslint-disable no-console */

import { DomHelpers } from "../dom.js";

// P2 perf investigation (spike/perf-500-rows.html, see ROADMAP.md/EPIC.md E9):
// profiling a 500-row document found getBoundingClientRect calls -- almost all
// of them the append-then-measureContentHeight(container) round trip below --
// accounted for ~72% of total format() time (3.6s of 5s), each one forcing a
// synchronous reflow of the whole growing page container. rowHeight is already
// measured standalone per row (line ~17) regardless of whether the fast path
// below fires, so predicting the post-append height arithmetically costs
// nothing extra. This is a safe upper-bound prediction, not a guess: rows
// carry their own fixed width (the `paper_width` class / explicit `width`,
// never a percentage of a variable-width ancestor), so a row measured
// standalone renders at the same height once cloned into a same-width page
// container -- text wrapping cannot differ between the two contexts. The
// margin below exists only as a hedge against templates this reasoning
// doesn't anticipate; it does not paper over a known gap.
const ROW_HEIGHT_PREDICTION_SAFETY_MARGIN_PX = 50;

export function attachPaginationRenderMethods(FormatterClass) {
  FormatterClass.prototype.renderRows = function renderRows(outputContainer, sections, heights, footerState, heightPerPage, footerSpacerTemplate, logFn) {
    let currentHeight = 0;
    const pageContext = this.initializePageContext(heightPerPage);
    if (this.debug) {
      console.log(`[printform] ===== renderRows START =====`);
      console.log(`[printform] Total rows: ${sections.rows.length}, heightPerPage: ${heightPerPage}px`);
    }

    // Pre-measure every row's own height in one batch, before any row is
    // cloned/appended into a page container. This is the other half of the P2
    // perf fix above: measuring one row at a time INSIDE the loop still forces
    // a synchronous layout flush every iteration even when the container
    // measurement itself is skipped, because a forced layout read anywhere
    // flushes ALL pending DOM mutations, not just the queried element's own
    // subtree -- so interleaving one read per write defeats the fast path
    // above almost entirely. Measuring everything up front, before the loop's
    // first append, means these reads never interleave with the loop's writes.
    const rowHeightCache = sections.rows.map((row) => DomHelpers.measureHeight(row));

    for (let index = 0; index < sections.rows.length; index++) {
      const row = sections.rows[index];
      const nextRow = sections.rows[index + 1];
      const rowHeight = rowHeightCache[index];
      const baseClass = this.getRowBaseClass(row);
      const isPtacRow = this.isPtacRow(row);
      const isPaddtRow = this.isPaddtRow(row);
      const isSubtotal = this.isSubtotalRow(row);
      const isFooter = this.isFooterRow(row);
      const hasFooterCombo = isSubtotal && nextRow && this.isFooterRow(nextRow);
      const footerRow = hasFooterCombo ? nextRow : null;
      const footerBaseClass = footerRow ? this.getRowBaseClass(footerRow) : null;
      const footerHeight = footerRow ? rowHeightCache[index + 1] : 0;
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
      const predictedHeight = currentHeight + rowHeight;

      if (predictedHeight + ROW_HEIGHT_PREDICTION_SAFETY_MARGIN_PX <= pageContext.limit) {
        DomHelpers.appendRowItem(container, row, null, index, baseClass);
        if (this.debug) {
          console.log(`[printform]   row[${index}] height=${rowHeight}px, predictedHeight=${predictedHeight}px, limit=${pageContext.limit}px (fast path, no reflow)`);
        }
        if (logFn) {
          const resolvedLabel = baseClass || "prowitem";
          logFn(`append ${resolvedLabel} ${index}`);
        }
        currentHeight = predictedHeight;
        if (!isPtacRow) {
          pageContext.isPtacPage = false;
        }
        if (!isPaddtRow) {
          pageContext.isPaddtPage = false;
        }
        continue;
      }

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
