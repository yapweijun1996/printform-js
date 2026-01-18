import { describe, it, expect, beforeEach, vi } from 'vitest';
import { attachPtacSegmentMethods } from '../js/printform/formatter/segments-ptac.js';
import { attachPaddtSegmentMethods } from '../js/printform/formatter/segments-paddt.js';

// Mock MockFormatter class
class MockFormatter {
  constructor(formEl, config = {}) {
    this.formEl = formEl;
    this.config = config;
    this.paddtConfig = config; // PADDT often uses a separate config object, mirroring that behavior
  }
}

// Attach methods to the prototype
attachPtacSegmentMethods(MockFormatter);
attachPaddtSegmentMethods(MockFormatter);

describe('Segmentation Logic', () => {
  let formatter;
  let formEl;

  beforeEach(() => {
    formEl = document.createElement('div');
    formatter = new MockFormatter(formEl);
  });

  describe('PTAC Segmentation (expandPtacSegments)', () => {
    it('should mark form as expanded after processing', () => {
      // Setup a basic PTAC table structure
      formEl.innerHTML = `
        <table class="ptac">
          <tr><td><div><p>Some content</p></div></td></tr>
        </table>
      `;
      
      formatter.expandPtacSegments();
      
      expect(formEl.dataset.ptacExpanded).toBe("true");
    });

    it('should mark individual ptac tables with data-ptac-segment', () => {
      formEl.innerHTML = `
        <table class="ptac" id="t1">
          <tr><td>Content</td></tr>
        </table>
      `;
      
      formatter.expandPtacSegments();
      
      const table = formEl.querySelector('#t1');
      expect(table.dataset.ptacSegment).toBe("true");
      expect(table.classList.contains('ptac_segment')).toBe(true);
    });

    it('should not re-process if already expanded', () => {
      formEl.dataset.ptacExpanded = "true";
      // Add a table that is NOT marked, to see if it gets picked up
      formEl.innerHTML = `<table class="ptac" id="t2"><tr><td>New</td></tr></table>`;
      
      formatter.expandPtacSegments();
      
      const table = formEl.querySelector('#t2');
      // Should remain untouched because the form is marked as expanded
      expect(table.dataset.ptacSegment).toBeUndefined();
    });

    it('should skip individual tables that are already marked', () => {
      formEl.innerHTML = `
        <table class="ptac" id="t3" data-ptac-segment="true">
          <tr><td>Existing</td></tr>
        </table>
      `;
      // We spy on classList.add to see if it's called
      const table = formEl.querySelector('#t3');
      const spy = vi.spyOn(table.classList, 'add');
      
      formatter.expandPtacSegments();
      
      expect(spy).not.toHaveBeenCalled();
      expect(formEl.dataset.ptacExpanded).toBe("true");
    });
  });

  describe('PADDT Segmentation (expandPaddtSegments)', () => {
    it('should mark form as expanded after processing', () => {
      formEl.innerHTML = `
        <table class="paddt">
          <tr><td><p>Content</p></td></tr>
        </table>
      `;
      
      formatter.expandPaddtSegments();
      
      expect(formEl.dataset.paddtExpanded).toBe("true");
    });

    it('should mark individual paddt tables with data-paddt-segment', () => {
      formEl.innerHTML = `
        <table class="paddt" id="p1">
          <tr><td>Content</td></tr>
        </table>
      `;
      
      formatter.expandPaddtSegments();
      
      const table = formEl.querySelector('#p1');
      expect(table.dataset.paddtSegment).toBe("true");
      expect(table.classList.contains('paddt_segment')).toBe(true);
    });

    it('should respect custom word limit from config', () => {
       // This test indirectly verifies config usage by setting up a very small limit
       // that would force a split if logic works, or just verify it runs without error.
       // Truly verifying the split logic requires testing the interaction with 'splitPaddtParagraphIntoHtmlChunks'
       // which is tested in text.test.js. Here we just ensure the config path doesn't crash.
       
       formatter = new MockFormatter(formEl, { paddtMaxWordsPerSegment: 5 });
       formEl.innerHTML = `
        <table class="paddt">
          <tr><td><p>One two three four five six</p></td></tr>
        </table>
      `;
      
      formatter.expandPaddtSegments();
      // If it ran successfully, we expect it to be expanded
      expect(formEl.dataset.paddtExpanded).toBe("true");
      
      // We can check if it actually split (6 words > 5 limit)
      // The logic creates clones for overflow.
      const tables = formEl.querySelectorAll('.paddt');
      expect(tables.length).toBeGreaterThan(1); 
    });
  });
});
