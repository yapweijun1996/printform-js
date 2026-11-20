import {test,expect} from './studio-v3-test.js';
import {newProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';

test.use({workInSteps:true});
test.setTimeout(120000);
const PRIVATE = 'ORIGINAL_PRIVATE_SOURCE_CANARY';
const title = 'DELIVERY WINDOW';
const request = 'Retitle the invoice Delivery Window and add the supplied delivery address to the footer.';
const steps = [['apply_operations',{summary:'Retitle and bind delivery address',operations:[
  {type:'set_heading',value:title},
  {type:'add_field',section:'footer',field:{id:'window-address',kind:'bound',label:'Delivery address',pointer:'/shipTo/address'}}
]}],['inspect_draft'],['finish',{summary:'Retitle and bind delivery address'}]];
const locator = (page,selector)=>page.locator(selector);
async function source(page) {
  const frame = locator(page,'#preview-frame');
  await expect(frame).toHaveAttribute('srcdoc',/id="pf-sample-data"/);
  return frame.evaluate(node=>{
    const doc = new DOMParser().parseFromString(node.srcdoc,'text/html');
    const section = id=>JSON.parse(doc.getElementById(id).textContent);
    return {manifest:section('pf-manifest'),data:section('pf-sample-data'),schema:section('pf-schema')};
  });
}
async function send(page,value) {
  await locator(page,'#ai-prompt').fill(value);
  await locator(page,'[data-ai-send]').click();
}
async function fixedProvider(context) {
  await context.addInitScript(steps=>{
    if (window !== window.top || new URLSearchParams(location.hash.slice(1)).get('mode') !== 'draft') return;
    const original = window.fetch.bind(window), json = (value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
    const open = indexedDB.open.bind(indexedDB); window.draftDatabaseOpens = 0;
    indexedDB.open = (...args)=> { window.draftDatabaseOpens++; return open(...args); };
    window.draftWire = [];
    window.fetch = async(input,init)=>{
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,tools:true,multimodal:false}}]});
      if (!url.pathname.endsWith('/responses')) return json({},404);
      const body = JSON.parse(init.body); window.draftWire.push(body);
      const index = window.draftWire.length, [name,args={}] = steps[index-1];
      const output = [{type:'function_call',call_id:`draft_${index}`,name,arguments:JSON.stringify(args)}];
      const response = {status:'completed',output,usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },steps);
}

test('fictional draft requires human Apply, exact scenario review and explicit independent adoption',async({page,context},info)=>{
  const leaked = [];
  await context.route('https://gpt.yapweijun1996.com/**',route=>{leaked.push(route.request().url());return route.abort();});
  await fixedProvider(context);
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/studio-v3/'); await expect(locator(page,'[data-action=export]')).toBeEnabled();
  const parent = newProject();
  parent.manifest.title = 'Original company form';
  parent.sampleData.company.name = PRIVATE;
  const privateFile = {name:'private.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(parent))};
  await locator(page,'#open-file').setInputFiles(privateFile);
  await expect(locator(page,'#document-name')).toHaveValue(parent.manifest.title);
  await expect(locator(page,'[data-action=export]')).toBeEnabled();
  const original = await source(page);

  await locator(page,'[data-ai-toggle]').click();
  await send(page,'/new invoice');
  const refine = page.getByRole('link',{name:'Refine in draft tab'});
  await expect(refine).toBeVisible();
  const popup = context.waitForEvent('page');
  await refine.click();
  const draft = await popup;
  const adopt = draft.getByRole('button',{name:'Adopt this form'});
  const notice = locator(draft,'[data-new-form-return-status]');
  await expect(adopt).toBeVisible();
  await expect(locator(draft,'#status')).toContainText('current layout passed');
  const seed = await source(draft);
  expect(seed.manifest.documentId).not.toBe(original.manifest.documentId);
  expect(seed.data).toEqual(newProject().sampleData);
  expect(await draft.evaluate(()=>window.opener)).toBeNull();
  expect(await draft.evaluate(()=>window.draftDatabaseOpens)).toBe(0);
  await expect(locator(draft,'[data-action=export]')).toBeHidden();
  await expect(locator(draft,'[data-mode=data]')).toBeHidden();
  await locator(draft,'#open-file').setInputFiles(privateFile);
  await locator(draft,'[data-mode=data]').dispatchEvent('click');
  await expect(locator(draft,'[data-mode=design]')).toHaveAttribute('aria-current','page');
  expect(await source(draft)).toEqual(seed);
  await adopt.click();
  await expect(notice).toContainText('Run all synthetic samples successfully');

  await locator(draft,'[data-ai-toggle]').click();
  await expect(locator(draft,'[data-ai=attach]')).toBeHidden();
  await locator(draft,'.ai-reference-files input[type=file]').setInputFiles({name:'private.pdf',mimeType:'application/pdf',buffer:Buffer.from(PRIVATE)});
  await locator(draft,'#ai-source-enabled').evaluate(node=>{node.checked=true;});
  await locator(draft,'#ai-observation-pixels').evaluate(node=>{node.checked=true;});
  await send(draft,request);
  const proposed = locator(draft,'[data-ai=apply]');
  await expect(proposed).toBeVisible({timeout:45000});
  if (!await proposed.isEnabled()) await locator(draft,'[data-ai=preview]').click();
  await expect(proposed).toBeEnabled();
  await expect(locator(draft,'#revision')).toHaveText('r0');
  await adopt.click();
  await expect(notice).toContainText('Resolve pending draft edits or previews');
  await proposed.click();
  await expect(locator(draft,'#revision')).toContainText('r1');
  const candidate = await source(draft);
  expect(candidate.manifest.studioV3.title).toBe(title);
  expect(candidate.manifest.studioV3.footer.at(-1)).toMatchObject({id:'window-address',pointer:'/shipTo/address'});
  expect(candidate.data).toEqual(seed.data);
  expect(candidate.schema).toEqual(seed.schema);
  await expect(locator(draft,'[data-action=export]')).toBeHidden();
  const wire = await draft.evaluate(()=>window.draftWire);
  expect(wire).toHaveLength(3);
  expect(wire.every(body=>body.tools.every(tool=>!tool.name.startsWith('workspace_')))).toBe(true);
  expect(JSON.stringify(wire)).not.toMatch(new RegExp(`${PRIVATE}|input_image|private\\.pdf`));
  expect(JSON.stringify(wire)).toContain(request);
  expect(leaked).toEqual([]);

  await locator(draft,'[data-ai=close]').click();
  await locator(draft,'[data-mode=validate]').click();
  await draft.getByRole('button',{name:'Run all synthetic samples',exact:true}).click();
  await expect(locator(draft,'#right-panel').getByText(/pages? · passed/)).toHaveCount(6,{timeout:60000});
  await expect(locator(draft,'#status')).toContainText('45 rows');
  await draft.screenshot({path:info.outputPath('draft-scenario-review.png')});
  await adopt.click();
  await expect(notice).toContainText('Adopted.');
  await expect(adopt).toBeHidden();
  expect(await draft.evaluate(()=>window.draftDatabaseOpens)).toBe(1);
  await expect(locator(draft,'[data-action=export]')).toBeEnabled();
  expect(await source(draft)).toEqual(candidate);
  expect(await source(page)).toEqual(original);
  await expect(locator(page,'#revision')).toHaveText('r0');
  await locator(draft,'[data-action=undo]').click();
  await expect(locator(draft,'#revision')).toContainText('r2');
  const undone = await source(draft);
  expect(undone.manifest.studioV3).toEqual(seed.manifest.studioV3);
  expect(undone.manifest.documentId).toBe(seed.manifest.documentId);
});
