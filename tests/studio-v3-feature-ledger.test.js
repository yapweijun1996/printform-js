import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

const read = file => fs.readFileSync(file,'utf8');
const LEDGER = read('docs/STUDIO_V3_FEATURE_LEDGER.md');
const ledgerSection = LEDGER.split('## 1.')[1]?.split('## 2.')[0] ?? '';
const ledgerIds = new Set([...ledgerSection.matchAll(/`([a-z][a-z0-9-]*)`/g)].map(m => m[1]));
const sourceFiles = ['studio-v3/index.html','studio-v3/app.js','studio-v3/database-controller.js','studio-v3/database-view.js','studio-v3/views.js','studio-v3/workspace-views.js','studio-v3/form-drafts.js'];
const between = (text,start,end) => text.slice(text.indexOf(start),end ? text.indexOf(end,text.indexOf(start)) : undefined);
const names = text => [...text.matchAll(/name === '([a-z-]+)'/g)].map(m => m[1]);

function uiActionIds() {
  const ids = new Set();
  for (const file of sourceFiles) for (const m of read(file).matchAll(/data-(?:db-)?action="([a-z-]+)"/g)) ids.add(m[1]);
  for (const id of names(between(read('studio-v3/app.js'),'async function action(name)','document.querySelectorAll'))) ids.add(id);
  for (const id of names(between(read('studio-v3/database-controller.js'),'async action(')) ) ids.add(id);
  return [...ids].sort();
}

describe('Studio v3 feature ledger (COV-01 drift guard)', () => {
  it('lists every UI data-action and database action ID in the ledger', () => {
    const ids = uiActionIds();
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter(id => !ledgerIds.has(id))).toEqual([]);
  });
  it('keeps the ledger within the 300-line limit', () => {
    expect(LEDGER.split('\n').length).toBeLessThanOrEqual(300);
  });
});
