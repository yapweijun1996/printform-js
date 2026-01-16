/* eslint-disable no-console */

import { DomHelpers } from "../dom.js";

export function attachPageMethods(FormatterClass) {
  FormatterClass.prototype.initializeOutputContainer = function initializeOutputContainer() {
    const container = document.createElement("div");
    container.classList.add("printform_formatter");
    this.formEl.parentNode.insertBefore(container, this.formEl);
    return container;
  };

  FormatterClass.prototype.initializePhysicalWrapper = function initializePhysicalWrapper(outputContainer) {
    if (this.currentPhysicalWrapper) {
      outputContainer.appendChild(DomHelpers.createPageBreakDivider());
      this.currentPhysicalPage += 1;
    } else {
      this.currentPhysicalPage = 1;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("physical_page_wrapper");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "flex-start";
    wrapper.style.width = `${this.config.papersizeWidth}px`;
    outputContainer.appendChild(wrapper);
    this.currentPhysicalWrapper = wrapper;
    this.pagesInCurrentPhysical = 0;
    return wrapper;
  };

  FormatterClass.prototype.ensureCurrentPageContainer = function ensureCurrentPageContainer(outputContainer) {
    if (!this.currentPhysicalWrapper) {
      this.initializePhysicalWrapper(outputContainer);
    }
    if (!this.currentPageContainer) {
      this.createNewLogicalPage(outputContainer);
    }
    return this.currentPageContainer;
  };

  FormatterClass.prototype.createNewLogicalPage = function createNewLogicalPage(outputContainer) {
    if (!this.currentPhysicalWrapper || this.pagesInCurrentPhysical >= this.nUp) {
      this.initializePhysicalWrapper(outputContainer);
    }

    const page = document.createElement("div");
    page.classList.add("printform_page");
    page.style.width = `${this.config.papersizeWidth}px`;
    page.style.minHeight = `${this.config.papersizeHeight}px`;
    this.currentPhysicalWrapper.appendChild(page);
    this.currentPageContainer = page;
    this.pagesInCurrentPhysical += 1;
    this.logicalPageToPhysicalPage[this.currentPage] = this.currentPhysicalPage;
    return page;
  };

  FormatterClass.prototype.getCurrentPageContainer = function getCurrentPageContainer(outputContainer) {
    return this.ensureCurrentPageContainer(outputContainer);
  };
}

