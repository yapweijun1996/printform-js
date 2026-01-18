/* eslint-disable no-console */

import { getPaddtConfig } from "../config.js";
import { attachPageMethods } from "./pages.js";
import { attachSectionMethods } from "./sections.js";
import { attachRowTypeMethods } from "./row-types.js";
import { attachPaddtSegmentMethods } from "./segments-paddt.js";
import { attachPtacSegmentMethods } from "./segments-ptac.js";
import { attachRenderingMethods } from "./rendering.js";
import { attachPaginationRenderMethods } from "./pagination-render.js";
import { attachPaginationFinalizeMethods } from "./pagination-finalize.js";

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
    // 初始化时输出 debug 状态
    if (this.debug) {
      console.log(`[printform] ===== PrintFormFormatter initialized =====`);
      console.log(`[printform] debug mode: ON`);
      console.log(`[printform] config.debug raw value: ${config.debug}`);
    }
  }

  log(message) {
    if (this.debug) {
      console.log(`[printform] ${message}`);
    }
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
      heights,
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
      var paddtDocInfos = sections.docInfos.filter(function (di) {
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
        heights,
        paddtFooterState,
        paddtHeightPerPage,
        paddtRenderState,
        footerSpacerTemplate,
        logFn
      );
    }

    this.updatePageNumberTotals();

    // Finalize all page heights with precise calculations instead of min-height
    const allPages = container.querySelectorAll('.printform_page');
    if (this.debug) {
      console.log(`[printform] Finalizing heights for ${allPages.length} pages...`);
    }
    allPages.forEach((page, index) => {
      this.finalizePageHeight(page);
      if (this.debug) {
        const heightStyle = page.style.height || "(auto)";
        console.log(`[printform]   Page ${index + 1}: height style = ${heightStyle}`);
      }
    });

    container.classList.remove("printform_formatter");
    container.classList.add("printform_formatter_processed");
    this.formEl.remove();
    return container;
  }
}

attachPageMethods(PrintFormFormatter);
attachSectionMethods(PrintFormFormatter);
attachRowTypeMethods(PrintFormFormatter);
attachPaddtSegmentMethods(PrintFormFormatter);
attachPtacSegmentMethods(PrintFormFormatter);
attachRenderingMethods(PrintFormFormatter);
attachPaginationRenderMethods(PrintFormFormatter);
attachPaginationFinalizeMethods(PrintFormFormatter);
