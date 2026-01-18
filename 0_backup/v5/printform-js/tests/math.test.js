import { describe, it, expect, beforeEach } from 'vitest';
import { attachPaginationFinalizeMethods } from '../js/printform/formatter/pagination-finalize.js';

describe('Math Logic (Pagination Calculations)', () => {
  let FormatterClass;
  let formatter;

  beforeEach(() => {
    // 1. 创建一个模拟类
    FormatterClass = class MockFormatter {
      constructor(config) {
        this.config = config;
        this.debug = false;
      }
    };
    // 2. 注入我们要测试的方法
    attachPaginationFinalizeMethods(FormatterClass);
  });

  describe('computeHeightPerPage', () => {
    const mockSections = {
      header: true,
      rowHeader: true,
      docInfos: [
        { key: 'docInfo', repeatFlag: 'repeatDocInfo' }
      ],
      footerVariants: [
        { key: 'footer', repeatFlag: 'repeatFooter' }
      ],
      footerLogo: true,
      footerPagenum: true
    };

    const mockHeights = {
      header: 100,
      rowHeader: 50,
      docInfos: { docInfo: 40 },
      footerVariants: { footer: 60 },
      footerLogo: 30,
      footerPagenum: 20
    };

    it('should subtract repeating elements from available height', () => {
      // 场景: Header, DocInfo, RowHeader 都重复
      formatter = new FormatterClass({
        papersizeHeight: 1000,
        papersizeWidth: 750,
        repeatHeader: true,
        repeatDocInfo: true,
        repeatRowheader: true,
        repeatFooter: false, // Footer 不重复
        repeatFooterLogo: false,
        repeatFooterPagenum: false
      });

      const height = formatter.computeHeightPerPage(mockSections, mockHeights);
      
      // 1000 - 100(Header) - 40(DocInfo) - 50(RowHeader) = 810
      expect(height).toBe(810);
    });

    it('should NOT subtract non-repeating elements', () => {
      // 场景: Header 不重复 (只在第一页占位，不影响每页可用高度)
      // 注意: computeHeightPerPage 计算的是"每页都能用的安全高度"
      // 或者说 "每页重复元素占用的高度"
      // 仔细看代码逻辑: available -= heights.header (if repeatHeader)
      
      formatter = new FormatterClass({
        papersizeHeight: 1000,
        repeatHeader: false, // 不重复
        repeatDocInfo: false,
        repeatRowheader: false
      });

      const height = formatter.computeHeightPerPage(mockSections, mockHeights);
      expect(height).toBe(1000);
    });

    it('should subtract repeating footer elements', () => {
      formatter = new FormatterClass({
        papersizeHeight: 1000,
        repeatHeader: false,
        repeatFooter: true, // Footer 重复
        repeatFooterLogo: true,
        repeatFooterPagenum: true
      });

      const height = formatter.computeHeightPerPage(mockSections, mockHeights);
      // 1000 - 60(Footer) - 30(Logo) - 20(PageNum) = 890
      expect(height).toBe(890);
    });
  });

  describe('computeFooterState', () => {
    const mockSections = {
      footerVariants: [
        { key: 'f1', repeatFlag: 'repeatF1' },
        { key: 'f2', repeatFlag: 'repeatF2' }
      ],
      footerLogo: true,
      footerPagenum: true
    };

    const mockHeights = {
      footerVariants: { f1: 50, f2: 50 },
      footerLogo: 30,
      footerPagenum: 20
    };

    it('should calculate total and repeating heights correctly', () => {
      formatter = new FormatterClass({
        repeatF1: true,  // f1 重复
        repeatF2: false, // f2 不重复
        repeatFooterLogo: true,
        repeatFooterPagenum: false
      });

      const state = formatter.computeFooterState(mockSections, mockHeights);

      // Total Final = f1(50) + f2(50) + logo(30) + pagenum(20) = 150
      expect(state.totalFinal).toBe(150);

      // Repeating = f1(50) + logo(30) = 80
      // (f2 和 pagenum 不重复)
      expect(state.repeating).toBe(80);

      // NonRepeating = Total - Repeating = 150 - 80 = 70
      expect(state.nonRepeating).toBe(70);
    });
  });
});
