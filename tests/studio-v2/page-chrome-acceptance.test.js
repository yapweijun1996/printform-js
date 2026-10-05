import { it, expect } from 'vitest';
import { inspectRenderedDocument } from '../../studio-v2/core/acceptance.js';
import { safeRunDiagnostics } from '../../studio-v3/ai-inspection.js';

function inspect(chrome, flags = '', expectedRows = 1) {
  document.documentElement.lang = 'en'; document.title = 'Synthetic invoice';
  document.body.innerHTML = `<template id="pf-template"><section class="printform" ${flags}></section></template><section class="printform_page">${chrome}<div class="prowheader_processed"><table><tr><th>Item</th></tr></table></div><div class="prowitem_processed" data-pf-row-index="${expectedRows - 1}">Unique row</div></section>`;
  return inspectRenderedDocument(document, {}, { expectedRowCount: expectedRows });
}
it.each(['y','n'])('rejects two full headers even with correct data rows and repeatHeader=%s', flag => {
  const report = inspect('<div class="pheader_processed">Company INVOICE</div>'.repeat(2), `data-repeat-header="${flag}"`);
  expect(report.valid).toBe(false);
  expect(report.errors.find(e=>e.code==='HEADER_DUPLICATE')).toMatchObject({path:'/render/page/1',details:{count:2,expected:1}});
  expect(report.errors.some(e=>e.code.startsWith('ROW_'))).toBe(false);
  expect(safeRunDiagnostics({validation:{errors:report.errors}}, {}).errors).toContain('HEADER_DUPLICATE');
});
it('allows one header and distinct docinfo variants and legitimate table headings', () => {
  const report = inspect('<div class="pheader_processed">Company INVOICE</div><div class="pdocinfo_processed">D</div><div class="pdocinfo002_processed">D2</div><div class="prowheader_processed" data-pf-table-id="other"><table><tr><th>Other table</th></tr></table></div><div class="prowitem_processed" data-pf-table-id="other" data-pf-row-index="0">Other row</div>', '', 2);
  expect(report.errors).toEqual([]);
});
it('rejects a duplicate docinfo variant and retains the specific repair diagnostic', () => {
  const report = inspect('<div class="pdocinfo002_processed">D2</div>'.repeat(2));
  expect(report.errors.map(e=>e.code)).toContain('DOCINFO_DUPLICATE');
  expect(safeRunDiagnostics({validation:{errors:report.errors}}, {}).errors).toContain('DOCINFO_DUPLICATE');
});
