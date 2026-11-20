import { test, expect } from './studio-v3-test.js';
import { expectApplied } from './ai-applied.js';
import { gateway, normalized, save } from './studio-v3-element-style.js';
import { compileProject, designOf, newProject, sampleData } from '../studio-v3/model.js';
import { saveProject } from '../studio-v3/file-io.js';

test.use({workInSteps:true});
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled();
const margins = {top:8,right:20,bottom:8,left:20};
const scenarios = ['0','1','45','100','500','long'];

async function observePaper(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    window.addEventListener('message',event => {
      if (event.source !== document.querySelector('#preview-frame')?.contentWindow) return;
      const message = event.data;
      if (message?.source !== 'printform-studio-v3-preview' || message.type !== 'rendered') return;
      window.stu05Paper = message.payload.pages.map(({html}) => {
        const sheet = new DOMParser().parseFromString(html,'text/html');
        const rows = [...sheet.querySelectorAll('.prowitem_processed')].map(row => ({
          index:Number(row.dataset.pfRowIndex),
          sku:row.querySelector('[data-v3-id=items-sku]')?.textContent.trim(),
          description:row.querySelector('[data-v3-id=items-description]')?.textContent.trim(),
          amount:row.querySelector('[data-v3-id=items-amount]')?.textContent.trim()
        }));
        return {
          rows,
          headers:sheet.querySelectorAll('.pheader_processed').length,
          tableHeaders:sheet.querySelectorAll('.prowheader_processed').length,
          footers:sheet.querySelectorAll('.pfooter_pagenum_processed').length
        };
      });
    });
  });
}

function verifyRows(sheets,expected) {
  expect(sheets.flatMap(sheet=>sheet.rows)).toEqual(expected);
  for (const sheet of sheets) {
    expect(sheet.headers).toBe(1);
    expect(sheet.footers).toBe(1);
    if (sheet.rows.length) expect(sheet.tableHeaders).toBe(1);
  }
}

test('G5 STU-05 checks the repaired draft and preserves every supplied bilingual row on Apply and Undo',async({page},info) => {
  test.setTimeout(180000);
  const project = newProject('invoice'), design = designOf(project);
  design.title = 'STU-05 bilingual pagination fixture';
  design.page = {paper:'A4',orientation:'portrait',margins:{top:72,right:20,bottom:72,left:20}};
  project.sampleData = sampleData('invoice',100,true);
  // Distinct supplied amounts expose swaps or recalculation even when quantity and unit price are equal.
  project.sampleData.items.forEach((row,index)=> {row.amount = 300 + index;});
  const expected = project.sampleData.items.map((row,index)=> ({
    index,sku:row.sku,description:row.description.trim(),amount:`RM\u00a0${row.amount}.00`
  }));
  const opened = compileProject(project,design);
  await observePaper(page);
  await gateway(page,[
    ['apply_operations',{summary:'Recover vertical print space',operations:[{type:'set_page',patch:{margins}}]}],
    ['validate_scenarios',{scenarios}],
    ['inspect_draft'],
    ['finish',{summary:'Review smaller top and bottom margins'}]
  ]);
  await page.goto('/studio-v3/');
  await ready(page);
  await page.locator('#open-file').setInputFiles({name:'bilingual-rows.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(opened))});
  await expect.poll(async()=>page.evaluate(()=>window.stu05Paper?.flatMap(sheet=>sheet.rows).length)).toBe(100);
  await ready(page);
  const before = normalized((await save(page,info,'before.json')).project);
  const original = await page.evaluate(()=>window.stu05Paper);
  verifyRows(original,expected);

  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill('Reduce only the top and bottom margins to 8px. Validate all built-in scenarios and let me review the exact form before applying.');
  await page.locator('[data-ai-send]').click();
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:120000});
  const wire = await page.evaluate(()=>window.__elementStyleWire);
  expect(wire).toHaveLength(4);
  const result = JSON.parse(wire[2].input.filter(item=>item.type === 'function_call_output').at(-1).output);
  expect(result.scenarios.map(entry=>entry.id)).toEqual(scenarios);
  expect(result.scenarios.map(entry=>entry.metrics.rows)).toEqual([0,1,45,100,500,45]);
  expect(result.ready).toBe(true);
  await page.locator('[data-ai=preview]').click();
  await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText('r0');
  expect(normalized((await save(page,info,'preapproval.json')).project)).toEqual(before);
  const candidate = await page.evaluate(()=>window.stu05Paper);
  expect(candidate.length).toBeLessThan(original.length);
  verifyRows(candidate,expected);

  await page.locator('[data-ai=apply]').click();
  await expectApplied(page,1);
  await ready(page);
  expect(await page.evaluate(()=>window.stu05Paper)).toEqual(candidate);
  const approved = normalized((await save(page,info,'approved.json')).project);
  expect(approved).toEqual({
    ...before,manifest:{...before.manifest,studioV3:{...before.manifest.studioV3,page:{...design.page,margins}}}
  });
  await page.locator('[data-ai=undo]').click();
  await expect(page.locator('#revision')).toContainText(/^r2\b/);
  await ready(page);
  expect(await page.evaluate(()=>window.stu05Paper)).toEqual(original);
  expect(normalized((await save(page,info,'undone.json')).project)).toEqual(before);
});
