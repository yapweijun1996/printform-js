import { describe, it, expect, beforeEach } from 'vitest';
import { updatePageNumberContent, updatePhysicalPageNumberContent } from '../js/printform/helpers.js';

describe('Helpers: Page Numbering Logic', () => {
  
  describe('updatePageNumberContent', () => {
    it('should update specific data-page-number and data-page-total elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div>
          Page <span data-page-number></span> of <span data-page-total></span>
        </div>
      `;
      
      updatePageNumberContent(container, 3, 10);
      
      const numEl = container.querySelector('[data-page-number]');
      const totalEl = container.querySelector('[data-page-total]');
      
      expect(numEl.textContent).toBe('3');
      expect(totalEl.textContent).toBe('10');
    });

    it('should handle missing total pages gracefully', () => {
      const container = document.createElement('div');
      container.innerHTML = '<span data-page-total></span>';
      
      updatePageNumberContent(container, 3, null);
      
      const totalEl = container.querySelector('[data-page-total]');
      expect(totalEl.textContent).toBe('');
    });

    it('should create a placeholder in data-page-number-container if specific targets missing', () => {
      const container = document.createElement('div');
      container.innerHTML = '<div data-page-number-container></div>';
      const targetContainer = container.querySelector('[data-page-number-container]');

      updatePageNumberContent(container, 2, 5);

      const placeholder = targetContainer.querySelector('.printform_page_number_placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder.textContent).toBe('Page 2 of 5');
    });

    it('should fallback to creating placeholder in last td if no attributes found', () => {
      const container = document.createElement('tr');
      container.innerHTML = '<td>Cell 1</td><td>Cell 2</td>';
      
      updatePageNumberContent(container, 4, 8);

      const lastTd = container.querySelectorAll('td')[1];
      const placeholder = lastTd.querySelector('.printform_page_number_placeholder');
      
      expect(placeholder).not.toBeNull();
      expect(placeholder.textContent).toBe('Page 4 of 8');
    });

    it('should format placeholder correctly when total pages is missing', () => {
      const container = document.createElement('div');
      container.innerHTML = '<div data-page-number-container></div>';
      
      updatePageNumberContent(container, 1, null);
      
      const placeholder = container.querySelector('.printform_page_number_placeholder');
      expect(placeholder.textContent).toBe('Page 1');
    });
  });

  describe('updatePhysicalPageNumberContent', () => {
    it('should update specific data-physical-page-number elements', () => {
      const container = document.createElement('div');
      container.innerHTML = '<span data-physical-page-number></span>';
      
      updatePhysicalPageNumberContent(container, 5, 20);
      
      const el = container.querySelector('[data-physical-page-number]');
      expect(el.textContent).toBe('5');
    });

    it('should update specific data-physical-page-total elements', () => {
        const container = document.createElement('div');
        container.innerHTML = '<span data-physical-page-total></span>';
        
        updatePhysicalPageNumberContent(container, 5, 20);
        
        const el = container.querySelector('[data-physical-page-total]');
        expect(el.textContent).toBe('20');
      });

    it('should create placeholder with "Sheet" prefix for physical pages', () => {
      const container = document.createElement('div');
      container.innerHTML = '<div data-physical-page-number-container></div>';
      
      updatePhysicalPageNumberContent(container, 2, 4);
      
      const placeholder = container.querySelector('.printform_physical_page_number_placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder.textContent).toBe('Sheet 2 of 4');
    });
  });
});
