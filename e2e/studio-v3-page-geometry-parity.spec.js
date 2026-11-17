import {test,expect} from './studio-v3-test.js';
import {expectApplied} from './ai-applied.js';
import {gateway,save,normalized,diagnostics} from './studio-v3-element-style.js';

test.use({workInSteps:true});test.setTimeout(90000);
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled();
const settings={paper:'LETTER',orientation:'landscape',margins:{top:8.25,right:8.25,bottom:8.25,left:8.25}};
async function geometry(page) {
  await expect(page.locator('#paper-kind')).toHaveText('LETTER');
  const sheet=page.frameLocator('#preview-frame').locator('.physical_page_wrapper').first();await expect(sheet).toHaveCSS('width','1056px');await expect(sheet).toHaveCSS('height','816px');
}
test('page inspector and Pi agree on geometry while preserving manual Apply and Undo',async({page},info)=> {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await gateway(page,[['apply_operations',{summary:'Paper geometry',operations:[{type:'set_page',patch:settings}]}],['inspect_draft'],['finish',{summary:'Paper geometry'}]]);
  await page.goto('/studio-v3/');await ready(page);const before=(await save(page,info,'before.json')).project;
  const structure=page.locator('[data-layout=structure]').first();if(await structure.getAttribute('aria-expanded')!=='true')await structure.click();await page.locator('[data-action=go-style]').click();const form=page.locator('form[data-form=style]');
  await form.locator('[name=margin-top]').fill('73');await form.getByRole('button',{name:'Apply style',exact:true}).click();await expect(page.locator('#revision')).toHaveText('r0');
  await form.locator('[name=paper]').selectOption({value:'LETTER'});await form.locator('[name=orientation]').selectOption({value:'landscape'});for(const side of ['top','right','bottom','left'])await form.locator(`[name=margin-${side}]`).fill('8.25');
  await form.getByRole('button',{name:'Apply style',exact:true}).click();await expect(page.locator('#revision')).toHaveText(/^r1\b/);await ready(page);await geometry(page);
  const ui=(await save(page,info,'ui.json')).project,expected=normalized(before);expected.manifest.studioV3.page=settings;expect(normalized(ui)).toEqual(expected);const uiDiagnostics=await diagnostics(page,ui);expect(uiDiagnostics.diagnostics.ready).toBe(true);
  await page.locator('[data-action=undo]').click();await ready(page);expect(normalized((await save(page,info,'undone.json')).project)).toEqual(normalized(before));
  await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Use Letter landscape with 8.25px margins on all sides.');await page.locator('[data-ai-send]').click();
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:60000});await page.locator('[data-ai=preview]').click();await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect(page.locator('#revision')).toHaveText(/^r2\b/);expect(normalized((await save(page,info,'before-approval.json')).project)).toEqual(normalized(before));
  await page.locator('[data-ai=apply]').click();await expectApplied(page,3);await ready(page);await geometry(page);
  const pi=(await save(page,info,'pi.json')).project;expect(normalized(pi)).toEqual(normalized(ui));expect((await diagnostics(page,pi)).diagnostics).toEqual(uiDiagnostics.diagnostics);
  await page.screenshot({path:info.outputPath('paper-geometry.png')});await page.locator('[data-ai=undo]').click();await ready(page);expect(normalized((await save(page,info,'ai-undone.json')).project)).toEqual(normalized(before));expect(errors).toEqual([]);
});
