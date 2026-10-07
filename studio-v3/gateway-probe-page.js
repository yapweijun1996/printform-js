import { createDemoTransport } from './ai-demo-transport.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { runGatewayProbe } from './gateway-probe.js';

const run = document.querySelector('#run'), list = document.querySelector('#checks'), result = document.querySelector('#result');
run.addEventListener('click',async()=> {
  run.disabled = true; list.replaceChildren(); result.value = '';
  const transport = createDemoTransport(), controller = new AbortController(), timer = setTimeout(()=>controller.abort(),DEMO_CONFIG.sendTimeoutMs);
  let report;
  try { report = await runGatewayProbe({transport,signal:controller.signal}); }
  catch (error) { report = {checks:[{id:'probe',ok:false,detail:error?.code || error?.name || 'UNKNOWN'}]}; }
  finally { clearTimeout(timer); transport.clear(); run.disabled = false; }
  for (const check of report.checks) {
    const item = document.createElement('li');
    item.className = check.ok ? 'ok' : 'bad';
    item.textContent = `${check.ok ? 'PASS' : 'FAIL'} · ${check.id} · ${check.detail}`;
    list.append(item);
  }
  result.value = report.checks.map(check=>`${check.ok ? 'PASS' : 'FAIL'} ${check.id}: ${check.detail}`).join('\n');
});
