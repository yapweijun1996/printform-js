/* eslint-disable no-console */

import { FOOTER_LOGO_VARIANT, FOOTER_PAGENUM_VARIANT, FOOTER_VARIANTS } from "../config.js";
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
    // Note: min-height removed - height will be calculated precisely by JavaScript
    this.currentPhysicalWrapper.appendChild(page);
    this.currentPageContainer = page;
    this.pagesInCurrentPhysical += 1;
    this.logicalPageToPhysicalPage[this.currentPage] = this.currentPhysicalPage;
    return page;
  };

  FormatterClass.prototype.getCurrentPageContainer = function getCurrentPageContainer(outputContainer) {
    return this.ensureCurrentPageContainer(outputContainer);
  };

  /**
   * Finalize the height of a page by calculating its actual content height
   * and setting it precisely instead of relying on min-height.
   * This ensures accurate page dimensions for printing.
   */
  FormatterClass.prototype.finalizePageHeight = function finalizePageHeight(pageContainer) {
    if (!pageContainer) return;

    const configuredHeight = this.config.papersizeHeight;
    const fillPageHeightAfterFooter = this.config.fillPageHeightAfterFooter !== false;
    let appendedSpacerHeight = 0;

    if (fillPageHeightAfterFooter) {
      const currentHeight = DomHelpers.measureHeight(pageContainer);
      const remaining = Math.max(0, configuredHeight - currentHeight);
      if (remaining > 0) {
        const spacer = DomHelpers.createDummyRowTable(this.config, remaining);
        spacer.classList.add("dummy_spacer");
        const footerSelectors = FOOTER_VARIANTS
          .map((variant) => `.${variant.className}_processed`)
          .concat([
            `.${FOOTER_LOGO_VARIANT.className}_processed`,
            `.${FOOTER_PAGENUM_VARIANT.className}_processed`
          ]);
        const firstFooter = pageContainer.querySelector(footerSelectors.join(", "));
        if (firstFooter && firstFooter.parentNode === pageContainer) {
          pageContainer.insertBefore(spacer, firstFooter);
        } else {
          pageContainer.appendChild(spacer);
        }
        appendedSpacerHeight = remaining;
      }
    }

    if (this.debug) {
      console.log(`\n[printform] ========== PAGE HEIGHT CALCULATION ==========`);
      console.log(`[printform] Configured page height: ${configuredHeight}px`);
      console.log(`[printform] -------------------------------------------`);

      // Show each child element's height with chain reasoning
      const children = Array.from(pageContainer.children);
      let cumulativeHeight = 0;

      console.log(`[printform] Elements breakdown (${children.length} elements):`);
      children.forEach((child, index) => {
        const childHeight = DomHelpers.measureHeight(child);
        cumulativeHeight += childHeight;
        const className = child.className || '(no class)';
        const tagName = child.tagName.toLowerCase();

        console.log(`[printform]   ${index + 1}. <${tagName}.${className}>`);
        console.log(`[printform]      Height: ${childHeight}px`);
        console.log(`[printform]      Cumulative: ${cumulativeHeight}px`);
        console.log(`[printform]      Remaining: ${Math.max(0, configuredHeight - cumulativeHeight)}px`);

        // Show warning if element is unexpectedly tall
        if (childHeight > configuredHeight * 0.5) {
          console.log(`[printform]      ⚠️  WARNING: Element height is > 50% of page height`);
        }
      });

      console.log(`[printform] -------------------------------------------`);
      console.log(`[printform] Total content height: ${cumulativeHeight}px`);

      if (cumulativeHeight < configuredHeight) {
        const shortfall = configuredHeight - cumulativeHeight;
        console.log(`[printform] ✓ Content fits (${shortfall}px under limit)`);
      } else if (cumulativeHeight > configuredHeight) {
        const overflow = cumulativeHeight - configuredHeight;
        console.log(`[printform] ⚠️  Content overflow (${overflow}px over limit)`);
      } else {
        console.log(`[printform] ✓ Perfect fit (exactly matches configured height)`);
      }
      if (appendedSpacerHeight > 0) {
        console.log(`[printform] ✓ Final spacer appended: ${appendedSpacerHeight}px`);
      }
    }

    // Note: We do NOT set height here - let the content determine natural height
    // pageContainer.style.height is intentionally not set

    if (this.debug) {
      const actualHeight = DomHelpers.measureHeight(pageContainer);
      console.log(`[printform] -------------------------------------------`);
      console.log(`[printform] Actual measured height: ${actualHeight}px`);
      console.log(`[printform] ℹ️  Height NOT set - using natural content height`);
      console.log(`[printform] ===============================================\n`);
    }
  };
}
