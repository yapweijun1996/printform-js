import {test,expect} from './studio-v3-test.js';
import {clickHeaderAction} from './header-action.js';
import {expectApplied} from './ai-applied.js';
import {pageSettings} from '../studio-v3/paper-settings.js';
import fs from 'node:fs/promises';

test.use({workInSteps:true});
test.setTimeout(90000);
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled();
const patch = {color:'#123456',font:10.25,padding:12.25,striped:false,borders:false,pageNumbers:false};
const normalize = project => {
  const {revision,...content} = project, design = content.manifest.studioV3;
  return {...content,manifest:{...content.manifest,studioV3:{...design,page:pageSettings(design)}}};
};
async function save(page,info,name) {
  const pending = page.waitForEvent('download'); await clickHeaderAction(page,'save');
  const download = await pending, file = info.outputPath(name); await download.saveAs(file);
  return JSON.parse(await fs.readFile(file,'utf8')).project;
}
async function gateway(page) {
  await page.addInitScript(patch=> {
    const original = window.fetch.bind(window), json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const steps = [['apply_operations',{summary:'Global style',operations:[{type:'set_style',patch}]}],['inspect_draft',{}],['finish',{summary:'Global style'}]];
    let turn = 0; window.__globalStyleWire = [];
    window.fetch = async(input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url,location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body = JSON.parse(init.body); window.__globalStyleWire.push(body);
      const [name,args] = steps[turn++] || ['report_blocked',{reason:'Unexpected extra tool turn'}];
      const response = {status:'completed',output:[{type:'function_call',call_id:`global_${turn}`,name,arguments:JSON.stringify(args)}],usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },patch);
}
test('global style inspector and real Pi preserve content, render the same style, and undo',async({page},info)=> {
  const errors = []; page.on('pageerror',error=>errors.push(error.message));
  await gateway(page); await page.goto('/studio-v3/'); await ready(page);
  const before = await save(page,info,'before.json');
  const structure = page.locator('[data-layout=structure]').first();
  if (await structure.getAttribute('aria-expanded') !== 'true') await structure.click();
  await page.locator('[data-action=go-style]').click();
  const form = page.locator('form[data-form=style]');
  await form.locator('[name=font]').fill('15');
  await form.getByRole('button',{name:'Apply style',exact:true}).click();
  await expect(page.locator('#revision')).toHaveText('r0');
  for (const [key,value] of Object.entries(patch)) {
    const input = form.locator(`[name=${key}]`);
    if (typeof value === 'boolean') await input.setChecked(value); else await input.fill(String(value));
  }
  await form.getByRole('button',{name:'Apply style',exact:true}).click(); await ready(page);
  await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  const ui = await save(page,info,'ui.json'), expected = normalize(before);
  Object.assign(expected.manifest.studioV3,patch);
  expect(normalize(ui)).toEqual(expected);
  await expect(page.frameLocator('#preview-frame').locator('.brand-mark').first()).toHaveCSS('color','rgb(18, 52, 86)');
  await page.locator('[data-action=undo]').click(); await ready(page);
  expect(normalize(await save(page,info,'undone.json'))).toEqual(normalize(before));
  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill('Use blue #123456, font 10.25pt, padding 12.25; disable stripes, borders and page numbers.');
  await page.locator('[data-ai-send]').click(); await expectApplied(page,3,{timeout:60000}); await ready(page);
  const pi = await save(page,info,'pi.json'); expect(normalize(pi)).toEqual(normalize(ui));
  await expect(page.frameLocator('#preview-frame').locator('.brand-mark').first()).toHaveCSS('color','rgb(18, 52, 86)');
  const wire = await page.evaluate(()=>window.__globalStyleWire);
  expect(wire).toHaveLength(3);
  const inspection = JSON.parse(wire[2].input.find(item=>item.call_id === 'global_2' && item.type === 'function_call_output').output);
  expect(inspection.ready).toBe(true); expect(inspection.observation).toMatchObject({baseRevision:2,candidateVersion:1});
  await page.screenshot({path:info.outputPath('global-style.png')});
  await page.locator('[data-ai=undo]').click(); await ready(page);
  expect(normalize(await save(page,info,'ai-undone.json'))).toEqual(normalize(before));
  expect(errors).toEqual([]);
});
