import {test, expect} from './studio-v3-test.js';
import {normalized, save} from './studio-v3-element-style.js';

test.use({workInSteps:true});
const responseTools = {responses:true,tools:true,multimodal:false};
const responseText = {responses:true,multimodal:false};
const readOnlyMessage = 'The form contains a heading. I did not change its text.';
const errorCard = page => page.locator('.ai-message[data-state=error]').last();

async function interceptGateway(page,{capabilities=[responseTools],result='tools'}={}) {
  await page.addInitScript(({capabilities,result,readOnlyMessage}) => {
    const original = window.fetch.bind(window);
    const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const call = (name,args={}) => ({type:'function_call',id:`fc_${attempts.length}`,call_id:`call_${attempts.length}`,name,arguments:JSON.stringify(args)});
    const attempts = []; window.answerOnlyWire = attempts;
    window.fetch = async (input,init) => {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:capabilities.map(capabilities=>({id:'demo-fast',capabilities}))});
      if (!url.pathname.endsWith('/responses')) return json({},404);
      attempts.push(JSON.parse(init.body));
      if (result === 'refused') return json({error:{code:'DEMO_AGENT_TOOLS_DISABLED'}},400);
      const output = result === 'ignored' ? [{type:'message',content:[{type:'output_text',text:'Unvalidated answer.'}]}] : [
        call('apply_operations',{summary:'Unauthorized title write',operations:[{type:'set_heading',value:'Must stay unapplied'}]}),
        call('get_context'),
        call('finish_answer',{message:readOnlyMessage})
      ].slice(attempts.length-1,attempts.length);
      const response={status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}});
    };
  },{capabilities,result,readOnlyMessage});
}

async function enable(page) {
  await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
  await page.locator('[data-ai-toggle]').click();
  await page.getByLabel('More settings',{exact:true}).click();
  await page.getByLabel('Answer only (requires Work in steps)',{exact:true}).check();
  await expect(page.locator('.ai-scope-help')).toContainText('Answer only');
}
async function send(page) {
  await page.locator('#ai-prompt').fill('Check the current form heading.');
  await page.locator('[data-ai-send]').click();
}
const wire = page => page.evaluate(() => window.answerOnlyWire);

test('Answer only withholds write tools and rejects a forced mutation on the real browser path',async({page},info)=>{
  await interceptGateway(page);
  await enable(page);
  const before = normalized((await save(page,info,'answer-before.printform.json')).project);
  // A stale source-consent DOM value must never take precedence over the host answer route.
  await page.locator('#ai-source-enabled').evaluate(input => { input.checked = true; });
  await send(page);
  await expect(page.locator('.ai-assistant[data-state=answer]')).toContainText(readOnlyMessage);
  const bodies = await wire(page);
  expect(bodies).toHaveLength(3);
  for (const body of bodies) {
    expect(body.tools.map(tool=>tool.name)).toEqual(expect.arrayContaining(['get_context','inspect_draft','finish_answer']));
    expect(body.tools.some(tool=>/^(apply_operations|finish|undo_step|workspace_)/.test(tool.name) && tool.name !== 'finish_answer')).toBe(false);
  }
  expect(bodies[1].input.find(item=>item.type === 'function_call_output')?.output).toMatch(/unavailable/i);
  await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
  await expect(page.locator('#ai-source-enabled')).not.toBeChecked();
  await expect(page.locator('#revision')).toHaveText('r0');
  expect(normalized((await save(page,info,'answer-after.printform.json')).project)).toEqual(before);
});

for (const [name,capabilities] of [['unreported',[responseText]],['conflicting alias',[responseTools,responseText]]]) {
  test(`Answer only sends no inference for ${name} tool capability`,async({page})=>{
    await interceptGateway(page,{capabilities});
    await enable(page);
    await send(page);
    await expect(errorCard(page)).toContainText('confirmed tool support');
    expect(await wire(page)).toHaveLength(0);
    await expect(page.locator('#revision')).toHaveText('r0');
  });
}

test('Answer only requires Work in steps before any inference',async({page})=>{
  await interceptGateway(page);
  await enable(page);
  await page.locator('#ai-agent').uncheck();
  await send(page);
  await expect(page.locator('[data-ai-status]')).toContainText('Answer only needs Work in steps');
  expect(await wire(page)).toHaveLength(0);
});

for (const result of ['refused','ignored']) {
  test(`Answer only does not retry without tools when the tool turn is ${result}`,async({page})=>{
    await interceptGateway(page,{result});
    await enable(page);
    await send(page);
    await expect(errorCard(page)).toContainText(result === 'refused' ? 'does not allow step-by-step runs' : 'could not complete a validated answer');
    const bodies = await wire(page);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].tools.length).toBeGreaterThan(0);
    await expect(page.locator('[data-ai=apply]')).toHaveCount(0);
    await expect(page.locator('#revision')).toHaveText('r0');
  });
}
