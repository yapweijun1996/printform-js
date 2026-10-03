import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runRedesignLifecycle } from './studio-v3-redesign-lifecycle.js';
const fixtures=JSON.parse(readFileSync('e2e/fixtures/studio-v3-captured-real-redesigns.json','utf8'));
// Unmodified accepted replies from the registered public-origin synthetic run:
// first proposal repaired (reply index 1); second redesign reply index 2.
// This named CI case always covers real captured structures without inference.
test.use({serviceWorkers:'block',viewport:{width:1440,height:900}});
test.setTimeout(120000);
test('captured actual two-round redesigns: standalone HTML data, every page, row order, header counts and margins', ({page,context},info)=>runRedesignLifecycle({page,context},info,fixtures));
