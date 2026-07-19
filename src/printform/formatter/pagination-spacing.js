/* eslint-disable no-console */

import { normalizeHeight } from "../helpers.js";
import { DomHelpers, applyDummyRowItemsStep, applyDummyRowStep, applyFooterSpacerWithDummyStep, applyFooterSpacerStep } from "../dom.js";

export function attachPaginationSpacingMethods(FormatterClass) {
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
      const measuredTotal = DomHelpers.measureHeightRaw(container);
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
