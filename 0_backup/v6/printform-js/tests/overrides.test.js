import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from '../js/printform.js';
import { DomHelpers } from '../js/printform/dom.js';
import { PrintFormFormatter } from '../js/printform/formatter.js';

// Mock dependencies
vi.mock('../js/printform/dom.js', () => ({
  DomHelpers: {
    createPageBreakDivider: vi.fn((className) => {
      const div = document.createElement('div');
      div.className = className || 'default-divider';
      return div;
    }),
    appendClone: vi.fn(),
    measureHeight: vi.fn(() => 100),
  }
}));

vi.mock('../js/printform/formatter.js', () => ({
  PrintFormFormatter: vi.fn(() => ({
    format: vi.fn(() => {
      // Create a mock element that appears to be in the DOM
      const el = document.createElement('div');
      const parent = document.createElement('div');
      parent.appendChild(el);
      return el;
    })
  }))
}));

describe('Special Overrides Integration', () => {
  const { formatAll } = api;

  beforeEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    // Reset mocks
    vi.clearAllMocks();
    // Reset global flags if any
    delete window.__printFormProcessing;
    delete window.__printFormProcessed;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should read divPageBreakBeforeClassAppend from dataset and pass to divider', async () => {
    // Setup 2 forms to trigger the divider insertion (index > 0 logic)
    const form1 = document.createElement('div');
    form1.className = 'printform';
    document.body.appendChild(form1);

    const form2 = document.createElement('div');
    form2.className = 'printform';
    // This attribute is converted to camelCase: divPageBreakBeforeClassAppend
    form2.dataset.divPageBreakBeforeClassAppend = 'custom-break-class';
    document.body.appendChild(form2);

    await formatAll({ force: true });

    // formatAll logic inserts divider before the formatted element if index > 0
    // We expect createPageBreakDivider to be called for the second form
    // The loop iterates form1 (index 0) -> no divider
    // Then form2 (index 1) -> divider with custom class
    
    // Check calls to createPageBreakDivider
    // Depending on implementation, it might be called multiple times.
    // We specifically look for the call with our custom class.
    expect(DomHelpers.createPageBreakDivider).toHaveBeenCalledWith('custom-break-class');
  });

  it('should ignore empty dataset override', async () => {
    const form1 = document.createElement('div');
    form1.className = 'printform';
    document.body.appendChild(form1);

    const form2 = document.createElement('div');
    form2.className = 'printform';
    form2.dataset.divPageBreakBeforeClassAppend = '   '; // Empty/whitespace
    document.body.appendChild(form2);

    await formatAll({ force: true });

    // Should be called with undefined or empty, but NOT a whitespace string if trimmed correctly
    // The code logic: if (typeof datasetValue === "string" && datasetValue.trim()) { ... }
    // So if it's whitespace, it won't override.
    // The default pass-through in formatAll is: const dividerClassAppend = perFormOverrides.divPageBreakBeforeClassAppend;
    // Since we didn't provide one in perFormOverrides, it stays undefined.
    expect(DomHelpers.createPageBreakDivider).toHaveBeenCalledWith(undefined);
  });
});
