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
    // Use the "raw" measurement here. `measureHeight()` may temporarily mutate styles
    // when it sees a 0 height (for hidden nodes). That behavior can destabilize layout
    // on mobile Safari/Chrome during tight pagination loops, causing 0-height reads and
    // repeated section appends.
    const total = DomHelpers.measureHeightRaw(container);
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
      const isSubtotal = this.isSubtotalRow(row);

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

        // 小计行特殊处理：先填充 dummy rows，再添加小计行
        if (isSubtotal) {
          if (this.debug) {
            console.log(`[printform]   \u003e\u003e SUBTOTAL ROW detected at row[${index}]`);
          }

          // 先尝试添加小计行，测量是否会溢出
          const testClone = DomHelpers.appendRowItem(container, row, null, index, baseClass);
          const testHeight = this.measureContentHeight(container, pageContext.repeatingHeight);

          // 移除测试的小计行
          if (testClone && testClone.parentNode === container) {
            container.removeChild(testClone);
          }

          // 如果加上小计行会溢出，先完成当前页，小计行移到下一页
          if (testHeight > pageContext.limit) {
            if (this.debug) {
              console.log(`[printform]   \u003e\u003e SUBTOTAL would overflow, moving to next page`);
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

          // 填充 dummy rows 将小计行推到页面底部
          const skipDummyRowItems = this.shouldSkipDummyRowItemsForContext(pageContext);
          // 只要不跳过 dummy items，就执行填充（移除 insertDummyRowItemWhileFormatTable 的强依赖，或者默认为 true）
          if (!skipDummyRowItems) {
            const currentContainer = this.getCurrentPageContainer(outputContainer);
            const availableSpace = pageContext.limit - currentHeight - rowHeight;
            const dummyHeight = this.config.heightOfDummyRowItem || 27;
            const numDummies = Math.floor(availableSpace / dummyHeight);

            if (numDummies > 0 && this.debug) {
              console.log(`[printform]   \u003e\u003e Inserting ${numDummies} dummy rows before subtotal`);
            }

            // 准备 Dummy 内容：如果配置为空，使用默认的空白行
            const defaultDummyContent = `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;" class="prowitem_dummy"><tr><td style="height:${dummyHeight}px;">&nbsp;</td></tr></table>`;
            const dummyContent = this.config.customDummyRowItemContent || defaultDummyContent;

            for (let i = 0; i < numDummies; i++) {
              // 确保 dummy content 是包裹在 table 结构中或直接可用的 HTML
              if (dummyContent) {
                const dummyDiv = document.createElement('div');
                dummyDiv.innerHTML = dummyContent;
                // 尝试获取第一个子元素，如果是 table 最好
                let dummyNode = dummyDiv.firstElementChild;

                // 如果为空（比如解析失败），使用简单的 div
                if (!dummyNode) {
                  dummyDiv.innerHTML = `<div style="height:${dummyHeight}px" class="prowitem_dummy">&nbsp;</div>`;
                  dummyNode = dummyDiv.firstElementChild;
                }

                if (dummyNode) {
                  // 确保有标记类以便调试
                  if (!dummyNode.classList.contains('prowitem_dummy')) {
                    dummyNode.classList.add('prowitem_dummy');
                  }
                  currentContainer.appendChild(dummyNode);
                }
              }
            }
            currentHeight = this.measureContentHeight(currentContainer, pageContext.repeatingHeight);
          }

          // 现在添加小计行
          const finalContainer = this.getCurrentPageContainer(outputContainer);
          DomHelpers.appendRowItem(finalContainer, row, null, index, baseClass);
          if (logFn) {
            logFn(`append subtotal ${index}`);
          }
          currentHeight = this.measureContentHeight(finalContainer, pageContext.repeatingHeight);
          if (this.debug) {
            console.log(`[printform]   subtotal row[${index}] added, currentHeight=${currentHeight}px`);
          }
          return;
        }

        // 普通行的处理逻辑
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
