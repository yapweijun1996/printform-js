/* eslint-disable no-console */

import { normalizeHeight, updatePageNumberContent, updatePhysicalPageNumberContent } from "./helpers.js";
import { getPaddtConfig, DOCINFO_VARIANTS, FOOTER_VARIANTS, FOOTER_LOGO_VARIANT, FOOTER_PAGENUM_VARIANT } from "./config.js";
import { DomHelpers, applyDummyRowItemsStep, applyDummyRowStep, applyFooterSpacerWithDummyStep, applyFooterSpacerStep } from "./dom.js";
import { ROW_SELECTOR, PTAC_MAX_WORDS_PER_SEGMENT, PADDT_MAX_WORDS_PER_SEGMENT, splitParagraphIntoHtmlChunks, splitPaddtParagraphIntoHtmlChunks } from "./text.js";

export class PrintFormFormatter {
  constructor(formEl, config) {
    this.formEl = formEl;
    this.config = config;
    this.debug = Boolean(config.debug);
    this.nUp = Math.max(1, Math.floor(Number(config.nUp || 1)));
    this.showLogicalPageNumber = config.showLogicalPageNumber !== false;
    this.showPhysicalPageNumber = Boolean(config.showPhysicalPageNumber);
    // paddt 独立配置 (中文解释: paddt 专用配置)
    this.paddtConfig = getPaddtConfig(formEl, {});
    this.paddtDebug = Boolean(this.paddtConfig.paddtDebug);
    this.currentPage = 1;
    this.currentPhysicalPage = 0;
    this.pagesInCurrentPhysical = 0;
    this.currentPhysicalWrapper = null;
    this.currentPageContainer = null;
    this.logicalPageNumberClones = [];
    this.physicalPageNumberClones = [];
    this.logicalPageToPhysicalPage = [];
  }

  log(message) {
    if (this.debug) {
      console.log(`[printform] ${message}`);
    }
  }

  initializeOutputContainer() {
    const container = document.createElement("div");
    container.classList.add("printform_formatter");
    this.formEl.parentNode.insertBefore(container, this.formEl);
    return container;
  }

  initializePhysicalWrapper(outputContainer) {
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
  }

  ensureCurrentPageContainer(outputContainer) {
    if (!this.currentPhysicalWrapper) {
      this.initializePhysicalWrapper(outputContainer);
    }
    if (!this.currentPageContainer) {
      this.createNewLogicalPage(outputContainer);
    }
    return this.currentPageContainer;
  }

  createNewLogicalPage(outputContainer) {
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
  }

  getCurrentPageContainer(outputContainer) {
    return this.ensureCurrentPageContainer(outputContainer);
  }

  collectSections() {
    // paddt 段落扩展先执行，确保 .paddt 转换为 .paddt-rowitem (中文解释: 先展开 paddt)
    this.expandPaddtSegments();
    this.expandPtacSegments();
    const docInfos = DOCINFO_VARIANTS.map((variant) => {
      const element = this.formEl.querySelector(`.${variant.className}`);
      if (!element) return null;
      return {
        key: variant.key,
        className: variant.className,
        repeatFlag: variant.repeatFlag,
        element
      };
    }).filter(Boolean);

    const footerVariants = FOOTER_VARIANTS.map((variant) => {
      const element = this.formEl.querySelector(`.${variant.className}`);
      if (!element) return null;
      return {
        key: variant.key,
        className: variant.className,
        repeatFlag: variant.repeatFlag,
        element
      };
    }).filter(Boolean);

    // 分离 paddt 行，主流程不渲染 paddt（paddt 将在页脚之后另起分页渲染）
    const allRows = Array.from(this.formEl.querySelectorAll(ROW_SELECTOR));
    const paddtRows = allRows.filter((row) => this.isPaddtRow(row));
    const mainRows = allRows.filter((row) => !this.isPaddtRow(row));
    this.paddtRows = paddtRows;

    return {
      header: this.formEl.querySelector(".pheader"),
      docInfos,
      rowHeader: this.formEl.querySelector(".prowheader"),
      footerVariants,
      footerLogo: this.formEl.querySelector(`.${FOOTER_LOGO_VARIANT.className}`),
      footerPagenum: this.formEl.querySelector(`.${FOOTER_PAGENUM_VARIANT.className}`),
      rows: mainRows
    };
  }

  // paddt 行识别 (中文解释: paddt 行判断)
  isPaddtRow(row) {
    if (!row) {
      return false;
    }
    return (
      row.classList.contains("paddt_segment") ||
      row.classList.contains("paddt") ||
      row.classList.contains("paddt-rowitem") ||
      row.classList.contains("paddt-rowitem_processed")
    );
  }

  isPtacRow(row) {
    if (!row) {
      return false;
    }
    return (
      row.classList.contains("ptac_segment") ||
      row.classList.contains("ptac") ||
      row.classList.contains("ptac-rowitem") ||
      row.classList.contains("ptac-rowitem_processed")
    );
  }

  getRowBaseClass(row) {
    if (!row) {
      return "prowitem";
    }
    if (this.isPaddtRow(row)) return "paddt-rowitem";
    return this.isPtacRow(row) ? "ptac-rowitem" : "prowitem";
  }

  shouldSkipRowHeaderForRow(row) {
    if (!row) {
      return false;
    }
    if (!this.config.repeatRowheader) {
      return false;
    }
    // PTAC
    if (this.isPtacRow(row)) {
      if (this.config.repeatPtacRowheader) return false;
      return true;
    }
    // PADDT
    if (this.isPaddtRow(row)) {
      if (this.paddtConfig && this.paddtConfig.repeatPaddtRowheader) return false;
      return true;
    }
    return false;
  }

  initializePageContext(heightPerPage) {
    return {
      baseLimit: heightPerPage,
      limit: heightPerPage,
      skipRowHeader: false,
      isPtacPage: false,
      isPaddtPage: false
    };
  }

  refreshPageContextForRow(pageContext, row, heights) {
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
  }

  shouldSkipDummyRowItemsForContext(pageContext) {
    return Boolean(
      pageContext &&
      (
        (pageContext.isPtacPage && !this.config.insertPtacDummyRowItems) ||
        (pageContext.isPaddtPage && !(this.paddtConfig && this.paddtConfig.insertPaddtDummyRowItems))
      )
    );
  }

  // ===== paddt 段落扩展 (独立管道) =====
  expandPaddtSegments() {
    if (this.formEl.dataset.paddtExpanded === "true") {
      return;
    }
    const paddtTables = Array.from(this.formEl.querySelectorAll(".paddt"));
    if (paddtTables.length === 0) {
      this.formEl.dataset.paddtExpanded = "true";
      return;
    }

    var maxWords = (this.paddtConfig && this.paddtConfig.paddtMaxWordsPerSegment) || PADDT_MAX_WORDS_PER_SEGMENT;

    paddtTables.forEach((paddtRoot) => {
      if (!paddtRoot || paddtRoot.dataset.paddtSegment === "true") {
        return;
      }

      const contentWrapper = paddtRoot.querySelector("td > div") || paddtRoot.querySelector("td");
      if (!contentWrapper) {
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      const allParagraphs = Array.from(contentWrapper.querySelectorAll("p"));
      var headingNode = null;
      if (allParagraphs.length > 1) {
        headingNode = allParagraphs.shift();
      }
      const paragraphs = allParagraphs;

      if (paragraphs.length === 0) {
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      const headingHTML = headingNode ? headingNode.outerHTML : "";
      const paragraphHTML = paragraphs.reduce(function(accumulator, node) {
        const chunks = splitPaddtParagraphIntoHtmlChunks(node, maxWords);
        return accumulator.concat(chunks);
      }, []);

      if (paragraphHTML.length === 0) {
        contentWrapper.innerHTML = headingHTML;
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      const segments = [];
      if (headingHTML) {
        segments.push(headingHTML + paragraphHTML[0]);
        for (var segIndex = 1; segIndex < paragraphHTML.length; segIndex += 1) {
          segments.push(paragraphHTML[segIndex]);
        }
      } else {
        for (var segIndexAlt = 0; segIndexAlt < paragraphHTML.length; segIndexAlt += 1) {
          segments.push(paragraphHTML[segIndexAlt]);
        }
      }

      if (segments.length === 0) {
        contentWrapper.innerHTML = headingHTML;
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      contentWrapper.innerHTML = segments[0];
      paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
      paddtRoot.dataset.paddtSegment = "true";

      var lastNode = paddtRoot;
      for (var index = 1; index < segments.length; index += 1) {
        const clone = paddtRoot.cloneNode(true);
        clone.dataset.paddtSegment = "true";
        const cloneWrapper = clone.querySelector("td > div") || clone.querySelector("td");
        if (cloneWrapper) {
          cloneWrapper.innerHTML = segments[index];
        }
        lastNode.parentNode.insertBefore(clone, lastNode.nextSibling);
        lastNode = clone;
      }
    });

    this.formEl.dataset.paddtExpanded = "true";
  }

  // ===== 既有 PTAC 段落扩展 =====
  expandPtacSegments() {
    if (this.formEl.dataset.ptacExpanded === "true") {
      return;
    }
    const ptacTables = Array.from(this.formEl.querySelectorAll(".ptac"));
    if (ptacTables.length === 0) {
      this.formEl.dataset.ptacExpanded = "true";
      return;
    }

    ptacTables.forEach((ptacRoot) => {
      if (!ptacRoot || ptacRoot.dataset.ptacSegment === "true") {
        return;
      }

      const contentWrapper = ptacRoot.querySelector("td > div") || ptacRoot.querySelector("td");
      if (!contentWrapper) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const allParagraphs = Array.from(contentWrapper.querySelectorAll("p"));
      var headingNode = null;
      if (allParagraphs.length > 1) {
        headingNode = allParagraphs.shift();
      }
      const paragraphs = allParagraphs;

      if (paragraphs.length === 0) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const headingHTML = headingNode ? headingNode.outerHTML : "";
      const paragraphHTML = paragraphs.reduce(function(accumulator, node) {
        const chunks = splitParagraphIntoHtmlChunks(node, PTAC_MAX_WORDS_PER_SEGMENT);
        return accumulator.concat(chunks);
      }, []);

      if (paragraphHTML.length === 0) {
        contentWrapper.innerHTML = headingHTML;
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const segments = [];
      if (headingHTML) {
        segments.push(headingHTML + paragraphHTML[0]);
        for (var segIndex = 1; segIndex < paragraphHTML.length; segIndex += 1) {
          segments.push(paragraphHTML[segIndex]);
        }
      } else {
        for (var segIndexAlt = 0; segIndexAlt < paragraphHTML.length; segIndexAlt += 1) {
          segments.push(paragraphHTML[segIndexAlt]);
        }
      }

      if (segments.length === 0) {
        contentWrapper.innerHTML = headingHTML;
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      contentWrapper.innerHTML = segments[0];
      ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
      ptacRoot.dataset.ptacSegment = "true";

      var lastNode = ptacRoot;
      for (var index = 1; index < segments.length; index += 1) {
        const clone = ptacRoot.cloneNode(true);
        clone.dataset.ptacSegment = "true";
        const cloneWrapper = clone.querySelector("td > div") || clone.querySelector("td");
        if (cloneWrapper) {
          cloneWrapper.innerHTML = segments[index];
        }
        lastNode.parentNode.insertBefore(clone, lastNode.nextSibling);
        lastNode = clone;
      }
    });

    this.formEl.dataset.ptacExpanded = "true";
  }

  createFooterSpacerTemplate() {
    const spacer = document.createElement("div");
    spacer.classList.add("pfooter_spacer", "paper_width");
    spacer.style.height = "0px";
    return spacer;
  }

  ensureFirstPageSections(container, sections, heights, logFn, skipRowHeader) {
    let consumedHeight = 0;
    if (sections.header) {
      DomHelpers.appendClone(container, sections.header, logFn, "pheader");
      if (!this.config.repeatHeader) {
        consumedHeight += heights.header;
      }
    }
    sections.docInfos.forEach((docInfo) => {
      const clone = DomHelpers.appendClone(container, docInfo.element, logFn, docInfo.className);
      this.registerPageNumberClone(clone);
      if (!this.config[docInfo.repeatFlag]) {
        consumedHeight += heights.docInfos[docInfo.key] || 0;
      }
    });
    if (sections.rowHeader && !skipRowHeader) {
      DomHelpers.appendClone(container, sections.rowHeader, logFn, "prowheader");
      if (!this.config.repeatRowheader) {
        consumedHeight += heights.rowHeader;
      }
    }
    return consumedHeight;
  }

  appendRepeatingSections(container, sections, logFn, skipRowHeader) {
    if (this.config.repeatHeader) {
      DomHelpers.appendClone(container, sections.header, logFn, "pheader");
    }
    sections.docInfos.forEach((docInfo) => {
      if (this.config[docInfo.repeatFlag]) {
        const clone = DomHelpers.appendClone(container, docInfo.element, logFn, docInfo.className);
        this.registerPageNumberClone(clone);
      }
    });
    if (this.config.repeatRowheader && !skipRowHeader) {
      DomHelpers.appendClone(container, sections.rowHeader, logFn, "prowheader");
    }
  }

  registerPageNumberClone(node) {
    if (!node) {
      return false;
    }
    let registered = false;

    if (this.showLogicalPageNumber) {
      if (node.querySelector("[data-page-number], [data-page-total], [data-page-number-container]")) {
        updatePageNumberContent(node, this.currentPage, null);
        this.logicalPageNumberClones.push({ node, pageNumber: this.currentPage });
        registered = true;
      }
    }

    if (this.showPhysicalPageNumber) {
      if (node.querySelector("[data-physical-page-number], [data-physical-page-total], [data-physical-page-number-container]")) {
        const physicalPage = this.logicalPageToPhysicalPage[this.currentPage] || this.currentPhysicalPage || 1;
        updatePhysicalPageNumberContent(node, physicalPage, null);
        this.physicalPageNumberClones.push({ node, pageNumber: physicalPage });
        registered = true;
      }
    }

    return registered;
  }

  appendRepeatingFooters(container, sections, logFn) {
    sections.footerVariants.forEach((footer) => {
      if (this.config[footer.repeatFlag]) {
        DomHelpers.appendClone(container, footer.element, logFn, footer.className);
      }
    });
    if (this.config.repeatFooterLogo) {
      DomHelpers.appendClone(container, sections.footerLogo, logFn, FOOTER_LOGO_VARIANT.className);
    }
    if (this.config.repeatFooterPagenum) {
      this.appendFooterPageNumber(container, sections, logFn);
    }
  }

  appendFinalFooters(container, sections, logFn) {
    sections.footerVariants.forEach((footer) => {
      DomHelpers.appendClone(container, footer.element, logFn, footer.className);
    });
    DomHelpers.appendClone(container, sections.footerLogo, logFn, FOOTER_LOGO_VARIANT.className);
    this.appendFooterPageNumber(container, sections, logFn);
  }

  appendFooterPageNumber(container, sections, logFn) {
    if (!sections.footerPagenum) {
      return;
    }
    const clone = sections.footerPagenum.cloneNode(true);
    container.appendChild(clone);
    this.registerPageNumberClone(clone);
    if (logFn) {
      logFn(`append ${FOOTER_PAGENUM_VARIANT.className} page ${this.currentPage}`);
    }
  }

  updatePageNumberTotals() {
    if (!this.logicalPageNumberClones.length && !this.physicalPageNumberClones.length) {
      return;
    }
    const totalLogicalPages = this.currentPage;
    const totalPhysicalPages = this.currentPhysicalPage || 1;
    this.logicalPageNumberClones.forEach((entry) => {
      updatePageNumberContent(entry.node, entry.pageNumber, totalLogicalPages);
    });
    this.physicalPageNumberClones.forEach((entry) => {
      updatePhysicalPageNumberContent(entry.node, entry.pageNumber, totalPhysicalPages);
    });
  }

  measureSections(sections) {
    const heights = {
      header: DomHelpers.measureHeight(sections.header),
      docInfos: {},
      rowHeader: DomHelpers.measureHeight(sections.rowHeader),
      footerVariants: {},
      footerLogo: DomHelpers.measureHeight(sections.footerLogo),
      footerPagenum: DomHelpers.measureHeight(sections.footerPagenum)
    };
    sections.docInfos.forEach((docInfo) => {
      heights.docInfos[docInfo.key] = DomHelpers.measureHeight(docInfo.element);
    });
    sections.footerVariants.forEach((footer) => {
      heights.footerVariants[footer.key] = DomHelpers.measureHeight(footer.element);
    });
    return heights;
  }

  markSectionsProcessed(sections) {
    DomHelpers.markAsProcessed(sections.header, "pheader");
    sections.docInfos.forEach((docInfo) => {
      DomHelpers.markAsProcessed(docInfo.element, docInfo.className);
    });
    DomHelpers.markAsProcessed(sections.rowHeader, "prowheader");
    sections.footerVariants.forEach((footer) => {
      DomHelpers.markAsProcessed(footer.element, footer.className);
    });
    DomHelpers.markAsProcessed(sections.footerLogo, FOOTER_LOGO_VARIANT.className);
    DomHelpers.markAsProcessed(sections.footerPagenum, FOOTER_PAGENUM_VARIANT.className);
  }

  renderRows(outputContainer, sections, heights, footerState, heightPerPage, footerSpacerTemplate, logFn) {
    let currentHeight = 0;
    const pageContext = this.initializePageContext(heightPerPage);
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
      }

      currentHeight += rowHeight;
      DomHelpers.markAsProcessed(row, baseClass);

      if (row.classList.contains("tb_page_break_before")) {
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
        if (!isPtacRow) {
          pageContext.isPtacPage = false;
        }
        if (!isPaddtRow) {
          pageContext.isPaddtPage = false;
        }
      }
    });
    return {
      currentHeight,
      pageLimit: pageContext.limit,
      isPtacPage: pageContext.isPtacPage,
      isPaddtPage: pageContext.isPaddtPage
    };
  }

  prepareNextPage(
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
  }

  applyRemainderSpacing(container, heightPerPage, currentHeight, footerState, spacerTemplate, options) {
    const skipDummyRowItems = options && options.skipDummyRowItems;
    let workingHeight = normalizeHeight(currentHeight);
    if (!skipDummyRowItems) {
      workingHeight = applyDummyRowItemsStep(this.config, container, heightPerPage, workingHeight);
    }
    workingHeight = applyDummyRowStep(this.config, container, heightPerPage, workingHeight);
    const spacerState = applyFooterSpacerWithDummyStep(
      this.config,
      container,
      heightPerPage,
      workingHeight,
      skipDummyRowItems
    );
    workingHeight = spacerState.currentHeight;
    if (!spacerState.skipFooterSpacer) {
      applyFooterSpacerStep(
        this.config,
        container,
        heightPerPage,
        workingHeight,
        footerState,
        spacerTemplate
      );
    }
    return normalizeHeight(workingHeight);
  }

  computeHeightPerPage(sections, heights) {
    let available = this.config.papersizeHeight;
    if (this.config.repeatHeader && sections.header) {
      available -= heights.header;
    }
    sections.docInfos.forEach((docInfo) => {
      if (this.config[docInfo.repeatFlag]) {
        available -= heights.docInfos[docInfo.key] || 0;
      }
    });
    if (this.config.repeatRowheader && sections.rowHeader) {
      available -= heights.rowHeader;
    }
    sections.footerVariants.forEach((footer) => {
      if (this.config[footer.repeatFlag]) {
        available -= heights.footerVariants[footer.key] || 0;
      }
    });
    if (this.config.repeatFooterLogo && sections.footerLogo) {
      available -= heights.footerLogo;
    }
    if (this.config.repeatFooterPagenum && sections.footerPagenum) {
      available -= heights.footerPagenum || 0;
    }
    return Math.max(0, available);
  }

  computeFooterState(sections, heights) {
    const footerLogoHeight = heights.footerLogo || 0;
    const footerPagenumHeight = heights.footerPagenum || 0;
    const totalFooterHeight = sections.footerVariants.reduce((sum, footer) => {
      const height = heights.footerVariants[footer.key] || 0;
      return sum + height;
    }, 0);
    const totalFinal = totalFooterHeight + footerLogoHeight + footerPagenumHeight;
    const repeatingFooterHeight = sections.footerVariants.reduce((sum, footer) => {
      const height = heights.footerVariants[footer.key] || 0;
      return this.config[footer.repeatFlag] ? sum + height : sum;
    }, 0);
    let repeating = repeatingFooterHeight;
    if (this.config.repeatFooterLogo) {
      repeating += footerLogoHeight;
    }
    if (this.config.repeatFooterPagenum) {
      repeating += footerPagenumHeight;
    }
    const nonRepeating = Math.max(0, totalFinal - repeating);
    return {
      totalFinal,
      repeating,
      nonRepeating
    };
  }

  finalizeDocument(
    outputContainer,
    sections,
    footerState,
    defaultHeightPerPage,
    renderState,
    spacerTemplate,
    logFn
  ) {
    const baseHeight = renderState ? renderState.currentHeight : 0;
    const lastPageLimit = renderState && renderState.pageLimit
      ? renderState.pageLimit
      : defaultHeightPerPage;
    const skipDummyRowItems = Boolean(
      renderState &&
      (
        (renderState.isPtacPage && !this.config.insertPtacDummyRowItems) ||
        (renderState.isPaddtPage && !(this.paddtConfig && this.paddtConfig.insertPaddtDummyRowItems))
      )
    );
    const allowance = footerState.totalFinal - footerState.repeating;
    const heightWithFinalFooters = baseHeight + allowance;
    if (heightWithFinalFooters <= lastPageLimit) {
      const container = this.getCurrentPageContainer(outputContainer);
      this.applyRemainderSpacing(
        container,
        lastPageLimit,
        heightWithFinalFooters,
        footerState,
        spacerTemplate,
        {
          skipDummyRowItems
        }
      );
      this.appendFinalFooters(container, sections, logFn);
      return;
    }

    this.prepareNextPage(
      outputContainer,
      sections,
      logFn,
      lastPageLimit,
      baseHeight,
      footerState,
      spacerTemplate,
      false,
      skipDummyRowItems
    );

    const finalPageStartHeight = allowance;
    const container = this.getCurrentPageContainer(outputContainer);
    this.applyRemainderSpacing(
      container,
      defaultHeightPerPage,
      finalPageStartHeight,
      footerState,
      spacerTemplate,
      null
    );
    this.appendFinalFooters(container, sections, logFn);
  }

  format() {
    const logFn = this.debug ? this.log.bind(this) : null;
    const container = this.initializeOutputContainer();
    this.ensureCurrentPageContainer(container);
    const sections = this.collectSections();
    const heights = this.measureSections(sections);
    const footerSpacerTemplate = this.createFooterSpacerTemplate();
    this.markSectionsProcessed(sections);
    const footerState = this.computeFooterState(sections, heights);
    const heightPerPage = this.computeHeightPerPage(sections, heights);
    const renderState = this.renderRows(
      container,
      sections,
      heights,
      footerState,
      heightPerPage,
      footerSpacerTemplate,
      logFn
    );

    this.finalizeDocument(
      container,
      sections,
      footerState,
      heightPerPage,
      renderState,
      footerSpacerTemplate,
      logFn
    );

    // paddt after footer005: paddt 页面要有 footer logo 与页码（仅此两类），并在所有常规页脚之后开始
    if (this.paddtRows && this.paddtRows.length) {
      // 先强制换到新的物理页并推进逻辑页码（确保 paddt 出现在 footer005 之后）
      this.currentPage += 1;
      this.currentPageContainer = null;
      this.initializePhysicalWrapper(container);
      this.createNewLogicalPage(container);

      // PADDT: filter docInfos per PADDT-specific toggles (defaults to true for backward compatibility)
      var paddtDocinfoFlags = {
        docInfo: this.paddtConfig.repeatPaddtDocinfo,
        docInfo002: this.paddtConfig.repeatPaddtDocinfo002,
        docInfo003: this.paddtConfig.repeatPaddtDocinfo003,
        docInfo004: this.paddtConfig.repeatPaddtDocinfo004,
        docInfo005: this.paddtConfig.repeatPaddtDocinfo005
      };
      var paddtDocInfos = sections.docInfos.filter(function(di) {
        var flag = paddtDocinfoFlags[di.key];
        return flag === undefined ? true : !!flag;
      });

      const paddtSections = {
        header: sections.header,
        docInfos: paddtDocInfos,
        rowHeader: sections.rowHeader,
        // 不包含业务 footer（如 pfooter/pfooter002...），仅保留 logo 与页码
        footerVariants: [],
        footerLogo: sections.footerLogo,
        footerPagenum: sections.footerPagenum,
        rows: this.paddtRows
      };

      // 计算 paddt 页脚状态与可用高度（考虑 repeatFooterLogo/repeatFooterPagenum）
      const paddtFooterState = this.computeFooterState(paddtSections, heights);
      const paddtHeightPerPage = this.computeHeightPerPage(paddtSections, heights);

      const paddtRenderState = this.renderRows(
        container,
        paddtSections,
        heights,
        paddtFooterState,
        paddtHeightPerPage,
        footerSpacerTemplate,
        logFn
      );

      this.finalizeDocument(
        container,
        paddtSections,
        paddtFooterState,
        paddtHeightPerPage,
        paddtRenderState,
        footerSpacerTemplate,
        logFn
      );
    }

    this.updatePageNumberTotals();

    container.classList.add("printform_formatter_processed");
    this.formEl.remove();
    return container;
  }
}
