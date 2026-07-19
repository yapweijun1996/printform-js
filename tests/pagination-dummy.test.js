import { describe, it, expect, beforeEach } from 'vitest';
import { attachPaginationDummyMethods } from '../src/printform/formatter/pagination-dummy.js';

describe('insertFooterDummyRows (customDummyRowItemContent parsing)', () => {
  let FormatterClass;
  let formatter;
  let container;

  // Matches the documented convention in index001.html / index_subtotal_test.html:
  // an outer 15px/inherit/15px padding wrapper row, then a content row, as two
  // sibling <tr> elements with NO enclosing <table>.
  const barePairOfRows = `
    <tr>
      <td style="box-sizing:border-box;width:15px;" class="pad-left"></td>
      <td style="box-sizing:border-box;width:inherit;"></td>
      <td style="box-sizing:border-box;width:15px;" class="pad-right"></td>
    </tr>
    <tr>
      <td class="content-left"></td>
      <td><table class="inner"><tr><td>x</td></tr></table></td>
      <td class="content-right"></td>
    </tr>
  `;

  beforeEach(() => {
    FormatterClass = class MockFormatter {
      constructor(config) {
        this.config = config;
        this.debug = false;
      }

      measureContentHeight() {
        return 0;
      }
    };
    attachPaginationDummyMethods(FormatterClass);
    container = document.createElement('div');
  });

  function makePageContext(numRows, dummyHeight) {
    return { limit: numRows * dummyHeight, skipDummyRowItems: false };
  }

  it('preserves sibling <tr> rows (padding wrapper + content) instead of dropping them', () => {
    formatter = new FormatterClass({ customDummyRowItemContent: barePairOfRows, heightOfDummyRowItem: 20 });
    formatter.insertFooterDummyRows(container, makePageContext(1, 20), 0, 0, 'footer');

    const dummy = container.querySelector('.prowitem_dummy');
    expect(dummy).not.toBeNull();
    // The bug this guards against: div.innerHTML silently drops bare <tr>
    // elements, leaving only the accidentally-legal nested <table> behind.
    expect(dummy.querySelector('.pad-left')).not.toBeNull();
    expect(dummy.querySelector('.pad-right')).not.toBeNull();
    expect(dummy.querySelector('.content-left')).not.toBeNull();
    expect(dummy.querySelector('table.inner')).not.toBeNull();
    expect(dummy.tagName).toBe('TABLE');
  });

  it('keeps a single full <table> root element unchanged (dom.js-style content)', () => {
    const fullTable = '<table class="my-dummy-row"><tr><td style="width:15px;"></td><td>content</td><td style="width:15px;"></td></tr></table>';
    formatter = new FormatterClass({ customDummyRowItemContent: fullTable, heightOfDummyRowItem: 20 });
    formatter.insertFooterDummyRows(container, makePageContext(1, 20), 0, 0, 'footer');

    const dummy = container.querySelector('.prowitem_dummy');
    expect(dummy).not.toBeNull();
    expect(dummy.classList.contains('my-dummy-row')).toBe(true);
    expect(dummy.querySelectorAll('td').length).toBe(3);
  });

  it('falls back to the default single-row table when no custom content is configured', () => {
    formatter = new FormatterClass({ heightOfDummyRowItem: 20 });
    formatter.insertFooterDummyRows(container, makePageContext(1, 20), 0, 0, 'footer');

    const dummy = container.querySelector('.prowitem_dummy');
    expect(dummy).not.toBeNull();
    expect(dummy.tagName).toBe('TABLE');
  });

  it('inserts the correct number of dummy rows for the available space', () => {
    formatter = new FormatterClass({ customDummyRowItemContent: barePairOfRows, heightOfDummyRowItem: 20 });
    formatter.insertFooterDummyRows(container, makePageContext(3, 20), 0, 0, 'footer');

    expect(container.querySelectorAll('.prowitem_dummy').length).toBe(3);
  });
});
