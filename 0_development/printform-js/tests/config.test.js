import { describe, it, expect } from 'vitest';
import { getPrintformConfig, DEFAULT_CONFIG } from '../js/printform/config.js';

describe('Configuration System', () => {
  // 模拟 DOM 元素
  const createMockElement = (dataset = {}) => ({
    dataset,
    querySelector: () => null // 模拟 template 查找
  });

  describe('Priority Logic', () => {
    it('should use default values when no config provided', () => {
      const el = createMockElement();
      const config = getPrintformConfig(el);
      expect(config.papersizeWidth).toBe(750); // 默认值
      expect(config.repeatHeader).toBe(true);
    });

    it('should allow dataset attributes to override defaults', () => {
      const el = createMockElement({
        papersizeWidth: '800',
        repeatHeader: 'false'
      });
      const config = getPrintformConfig(el);
      expect(config.papersizeWidth).toBe(800);
      expect(config.repeatHeader).toBe(false);
    });

    it('should allow function overrides to have highest priority', () => {
      const el = createMockElement({ papersizeWidth: '800' });
      const overrides = { papersizeWidth: 900 };
      const config = getPrintformConfig(el, overrides);
      expect(config.papersizeWidth).toBe(900);
    });
  });

  describe('Data Parsing', () => {
    it('should parse "y"/"n" strings as booleans', () => {
      const el = createMockElement({
        repeatHeader: 'n',
        repeatFooter: 'y'
      });
      const config = getPrintformConfig(el);
      expect(config.repeatHeader).toBe(false);
      expect(config.repeatFooter).toBe(true);
    });

    it('should fallback to default if number is invalid', () => {
      const el = createMockElement({ papersizeWidth: 'invalid' });
      const config = getPrintformConfig(el);
      expect(config.papersizeWidth).toBe(750); // 应该回退到默认值
    });
  });

  describe('Paper Size Resolution', () => {
    it('should auto-calculate A4 dimensions', () => {
      const el = createMockElement({
        paperSize: 'A4',
        orientation: 'portrait'
        // 不提供 papersizeWidth/Height
      });
      const config = getPrintformConfig(el);
      // A4 @ 96dpi = 210mm * 96 / 25.4 ≈ 794px
      expect(config.papersizeWidth).toBeCloseTo(794, -1); // 允许1px误差
    });
  });
});
