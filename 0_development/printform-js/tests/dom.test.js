import { describe, it, expect, vi } from 'vitest';
import { DomHelpers } from '../js/printform/dom.js';

describe('DomHelpers', () => {
  describe('measureHeight', () => {
    it('should return 0 for null/undefined', () => {
      expect(DomHelpers.measureHeight(null)).toBe(0);
      expect(DomHelpers.measureHeight(undefined)).toBe(0);
    });

    it('should use offsetHeight if available', () => {
      const el = {
        offsetHeight: 100,
        ownerDocument: { defaultView: { getComputedStyle: () => ({ marginTop: '0', marginBottom: '0' }) } }
      };
      expect(DomHelpers.measureHeight(el)).toBe(100);
    });

    it('should fallback to getBoundingClientRect if offsetHeight is 0', () => {
      const el = {
        offsetHeight: 0,
        getBoundingClientRect: () => ({ height: 50 }),
        ownerDocument: { defaultView: { getComputedStyle: () => ({ marginTop: '0', marginBottom: '0' }) } }
      };
      expect(DomHelpers.measureHeight(el)).toBe(50);
    });

    it('should include margins in calculation', () => {
      const el = {
        offsetHeight: 100,
        ownerDocument: {
          defaultView: {
            getComputedStyle: () => ({
              marginTop: '10px',
              marginBottom: '20px'
            })
          }
        }
      };
      // 100 + 10 + 20 = 130
      expect(DomHelpers.measureHeight(el)).toBe(130);
    });
    
    it('should handle fractional margins', () => {
       const el = {
        offsetHeight: 100,
        ownerDocument: {
          defaultView: {
            getComputedStyle: () => ({
              marginTop: '10.5px',
              marginBottom: '20.5px'
            })
          }
        }
      };
      // 100 + 10.5 + 20.5 = 131
      expect(DomHelpers.measureHeight(el)).toBe(131);
    });
  });

  describe('createPageBreakDivider', () => {
    it('should create a div with correct inline styles', () => {
      const div = DomHelpers.createPageBreakDivider();
      expect(div.tagName).toBe('DIV');
      expect(div.classList.contains('div_page_break_before')).toBe(true);
      expect(div.getAttribute('style')).toContain('page-break-before: always');
    });

    it('should append extra class names', () => {
      const div = DomHelpers.createPageBreakDivider('custom-class extra-one');
      expect(div.classList.contains('custom-class')).toBe(true);
      expect(div.classList.contains('extra-one')).toBe(true);
    });
  });

  describe('markAsProcessed', () => {
    it('should swap class names', () => {
      const div = document.createElement('div');
      div.classList.add('pheader');
      
      DomHelpers.markAsProcessed(div, 'pheader');
      
      expect(div.classList.contains('pheader')).toBe(false);
      expect(div.classList.contains('pheader_processed')).toBe(true);
    });

    it('should not process if already processed', () => {
      const div = document.createElement('div');
      div.classList.add('pheader_processed');
      
      DomHelpers.markAsProcessed(div, 'pheader');
      
      expect(div.classList.contains('pheader_processed')).toBe(true);
      // 确保没有被错误地移除或添加多余的
      expect(div.classList.length).toBe(1);
    });
  });
});
