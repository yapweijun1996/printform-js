import { test } from './studio-v3-test.js';
import { runRedesignLifecycle } from './studio-v3-redesign-lifecycle.js';
test.use({trace:process.env.PRINTFORM_LIVE_REDESIGN ? 'off' : 'retain-on-failure',viewport:{width:1440,height:900}});
test.setTimeout(process.env.PRINTFORM_LIVE_REDESIGN ? 240000 : 120000);
test('structural redesign fixtures: Preview Apply Undo Save Open and standalone export preserve all pages and data', runRedesignLifecycle);
