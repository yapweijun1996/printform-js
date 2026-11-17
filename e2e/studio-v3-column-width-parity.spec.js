import {test,expect} from './studio-v3-test.js';
import {expectApplied} from './ai-applied.js';
import {gateway,save,normalized,diagnostics} from './studio-v3-element-style.js';

test.use({workInSteps:true});test.setTimeout(90000);
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled();
// The existing field form materializes the default true label visibility.
function content(project,id) {const value=normalized(project),field=value.manifest.studioV3.columns.find(f=>f.id===id);field.showLabel=field.showLabel!==false;return value;}
test('column width inspector and Pi accept fractions and preserve printed geometry and Undo',async({page},info)=> {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const target='items-sku',width=12.25;
  await gateway(page,[['apply_operations',{summary:'Column width',operations:[{type:'set_field',target,patch:{width}}]}],['inspect_draft'],['finish',{summary:'Column width'}]]);
  // Install gateway/report instrumentation on a fresh navigation before editing.
  await page.goto('/studio-v3/');await ready(page);const before=(await save(page,info,'before.json')).project,column=before.manifest.studioV3.columns[1];expect(column.id).toBe('sku');
  const structure=page.locator('[data-layout=structure]').first();if(await structure.getAttribute('aria-expanded')!=='true')await structure.click();
  await page.locator(`#left-panel [data-select="${target}"]`).click();const form=page.locator('form[data-form=field]');
  await form.locator('[name=width]').fill('0');await form.getByRole('button',{name:'Apply field',exact:true}).click();await expect(page.locator('#revision')).toHaveText('r0');
  await form.locator('[name=width]').fill(String(width));await form.getByRole('button',{name:'Apply field',exact:true}).click();await expect(page.locator('#revision')).toHaveText(/^r1\b/);await ready(page);
  const cell=page.frameLocator('#preview-frame').locator(`[data-v3-id="${target}"]`).first().locator('..');await expect(cell).toHaveAttribute('style',/width:12.25%/);const uiWidth=await cell.evaluate(node=>parseFloat(getComputedStyle(node).width));
  const ui=(await save(page,info,'ui.json')).project,expected=content(before,column.id);expected.manifest.studioV3.columns[1].width=width;expect(content(ui,column.id)).toEqual(expected);const report=await diagnostics(page,ui);expect(report.diagnostics.ready).toBe(true);
  await page.locator('[data-action=undo]').click();await ready(page);expect(content((await save(page,info,'undone.json')).project,column.id)).toEqual(content(before,column.id));
  await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Set the selected column width to 12.25 percent.');await page.locator('[data-ai-send]').click();await expectApplied(page,3,{timeout:60000});await ready(page);
  const pi=(await save(page,info,'pi.json')).project;expect(content(pi,column.id)).toEqual(content(ui,column.id));expect((await diagnostics(page,pi)).diagnostics).toEqual(report.diagnostics);await expect(cell).toHaveAttribute('style',/width:12.25%/);expect(await cell.evaluate(node=>parseFloat(getComputedStyle(node).width))).toBeCloseTo(uiWidth,1);
  await page.screenshot({path:info.outputPath('column-width.png')});await page.locator('[data-ai=undo]').click();await ready(page);expect(content((await save(page,info,'ai-undone.json')).project,column.id)).toEqual(content(before,column.id));expect(errors).toEqual([]);
});
