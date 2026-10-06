import { test } from './studio-v3-test.js';
import { readFileSync } from 'node:fs';
import { runRedesignLifecycle } from './studio-v3-redesign-lifecycle.js';
const fixtures=JSON.parse(readFileSync('e2e/fixtures/studio-v3-captured-real-redesigns.json','utf8'));
// Unmodified accepted replies from the registered public-origin synthetic run:
// first proposal repaired (reply index 1); second redesign reply index 2.
// This named CI case always covers real captured structures without inference.
test.use({viewport:{width:1440,height:900}});
test.setTimeout(120000);
test('captured actual two-round redesigns: standalone HTML data, every page, row order, header counts and margins', async({page,context},info)=> {
  const prior=process.env.PRINTFORM_LIVE_REDESIGN;process.env.PRINTFORM_LIVE_REDESIGN='1';
  try { await runRedesignLifecycle({page,context},info,fixtures); }
  finally { if(prior===undefined)delete process.env.PRINTFORM_LIVE_REDESIGN;else process.env.PRINTFORM_LIVE_REDESIGN=prior; }
});
