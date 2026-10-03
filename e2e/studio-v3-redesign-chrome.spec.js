import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

test.use({serviceWorkers:'block',viewport:{width:1440,height:900}});
test.setTimeout(120000);
const frame = page => page.frameLocator('#preview-frame');
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const proposal = operations => ({kind:'proposal',summary:'Complete synthetic invoice redesign',operations});
const syntheticRedesigns = [
  proposal([
    {type:'set_style',patch:{font:10,padding:6,color:'#163a65',striped:false,borders:false}},
    {type:'set_section',target:'header',patch:{layout:{columns:1,gap:8}}},
    {type:'set_section',target:'customer',patch:{layout:{columns:2,gap:20}}},
    {type:'set_section',target:'items',patch:{breakBefore:true}},
    {type:'reorder_fields',section:'items',order:['items-no','items-description','items-sku','items-quantity','items-rate','items-amount']},
    {type:'set_field',target:'items-description',patch:{width:37,valueStyle:{fontSize:10}}},
    {type:'set_element_style',target:'header-title',patch:{fontSize:22,bold:true}},
    {type:'add_field',section:'footer',field:{id:'redesign-note',kind:'static',label:'',text:'Synthetic redesigned footer',format:''}}
  ]),
  proposal([
    {type:'set_style',patch:{font:9,padding:8,color:'#243b53',striped:true,borders:true}},
    {type:'set_section',target:'header',patch:{layout:{columns:2,gap:16}}},
    {type:'set_section',target:'customer',patch:{layout:{columns:1,gap:10}}},
    {type:'reorder_fields',section:'items',order:['items-no','items-sku','items-description','items-quantity','items-amount','items-rate']},
    {type:'set_section',target:'footer',patch:{layout:{columns:2,gap:12}}},
    {type:'set_heading',value:'REDESIGNED INVOICE'}
  ])
];
const redesigns = process.env.PRINTFORM_REAL_PROPOSALS
  ? JSON.parse(readFileSync(process.env.PRINTFORM_REAL_PROPOSALS,'utf8'))
  : syntheticRedesigns;
async function inspect(page) {
  const result = await frame(page).locator('.printform_page').evaluateAll(pages=>({
    pages:pages.map(p=>({headers:p.querySelectorAll('.pheader_processed').length,
      tableHeaders:p.querySelectorAll('.prowheader_processed').length,
      rows:[...p.querySelectorAll('.prowitem_processed')].map(n=>Number(n.dataset.pfRowIndex)),
      text:p.innerText.replace(/\s+/g,' ').trim()}))
  }));
  expect(result.pages.length).toBeGreaterThan(1);
  expect(result.pages.every(p=>p.headers===1)).toBe(true);
  expect(result.pages.filter(p=>p.rows.length).every(p=>p.tableHeaders===1)).toBe(true);
  expect(result.pages.flatMap(p=>p.rows)).toEqual(Array.from({length:45},(_,i)=>i));
  return result;
}
test('structural redesign fixtures: Preview Apply Undo Save Open preserve one header and all 45 rows', async ({page},info)=> {
  const requests = [], errors = []; let index = 0;
  page.on('pageerror', e=>errors.push(e.message)); page.on('dialog', d=>d.accept());
  // Deterministic model replies cover broad structural operations. No real
  // demo request, origin spoofing, credentials or server changes are involved.
  await page.route('https://gpt.yapweijun1996.com/demo/**', async route=> {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path.endsWith('/session')) body={token:'dmo_synthetic123456',expires_in:900};
    else if (path.endsWith('/models')) body={data:[{id:'demo-fast'},{id:'demo-auto'}]};
    else {
      requests.push(route.request().postDataJSON());
      body={choices:[{finish_reason:'stop',message:{content:JSON.stringify(redesigns[Math.min(index++,1)])}}],usage:{total_tokens:20}};
    }
    await route.fulfill({status:path.endsWith('/session')?201:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/studio-v3/'); await ready(page);
  const baseline = await inspect(page), total = await frame(page).locator('[data-v3-id=totals-total]').textContent();
  await page.locator('[data-ai-toggle]').click();
  const evidence = {baseline,rounds:[]};
  for (const prompt of ['Redesign this invoice freely. Rebuild its structure, layout and typography, not just its colors.','Redesign it again with a different structure and typography.'].slice(0,redesigns.length)) {
    await page.locator('#ai-prompt').fill(prompt); await page.locator('[data-ai-send]').click();
    await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:45000});
    await expect(page.locator('[data-ai=apply]')).toBeDisabled();
    await page.locator('[data-ai=preview]').click(); await expect(page.locator('[data-ai=apply]')).toBeEnabled();
    const preview = await inspect(page);
    await page.locator('[data-ai=apply]').click(); await ready(page);
    const applied = await inspect(page); expect(applied).toEqual(preview);
    expect(await frame(page).locator('[data-v3-id=totals-total]').textContent()).toBe(total);
    evidence.rounds.push({prompt,preview,applied});
  }
  expect(requests).toHaveLength(redesigns.length);
  await page.locator('[data-ai=undo]').click(); await ready(page);
  expect(await inspect(page)).toEqual(evidence.rounds.length > 1 ? evidence.rounds.at(-2).applied : baseline);
  await page.locator('[data-action=redo]').click(); await ready(page);
  const final = await inspect(page); expect(final).toEqual(evidence.rounds.at(-1).applied);
  const pending = page.waitForEvent('download'); await page.locator('[data-action=save]').click();
  const download = await pending, saved = info.outputPath('redesign.printform.json'); await download.saveAs(saved);
  await page.locator('[data-action=new]').click(); await page.locator('[data-template=purchase]').click(); await ready(page);
  const chooser = page.waitForEvent('filechooser'); await page.locator('[data-action=open]').click(); await (await chooser).setFiles(saved); await ready(page);
  expect(await inspect(page)).toEqual(final);
  await page.locator('[data-mode=validate]').click();
  await expect(page.locator('#right-panel')).toContainText('Current browser layout passed.');
  await page.locator('[data-ai-toggle]').click();
  await page.screenshot({path:info.outputPath('redesign-desktop.png'),fullPage:true});
  const previewFrame = await page.locator('#preview-frame').elementHandle();
  const doc = await previewFrame.contentFrame();
  await doc.locator('.printform_page').nth(1).screenshot({path:info.outputPath('redesign-page2.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('redesign-mobile.png'),fullPage:true});
  // Playwright's block-service-worker init script reads this getter inside
  // the intentionally opaque preview sandbox; preserve and classify that
  // runner-only error without weakening the application's sandbox.
  evidence.runnerErrors = errors.filter(e=>/service.?worker.*sandboxed.*allow-same-origin/i.test(e));
  expect(errors.filter(e=>!evidence.runnerErrors.includes(e))).toEqual([]);
  await fs.writeFile(info.outputPath('redesign-evidence.json'),JSON.stringify(evidence,null,2));
});
