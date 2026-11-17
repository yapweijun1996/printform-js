import {test,expect} from './studio-v3-test.js';
import {expectApplied} from './ai-applied.js';
import {gateway,save,normalized,diagnostics} from './studio-v3-element-style.js';

test.use({workInSteps:true});
test.setTimeout(90000);
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled();
const order=['header','footer','customer','items','totals'];
const normalize=project=>{const next=normalized(project);next.manifest.studioV3.blocks.footer.keepTogether??=false;next.manifest.studioV3.blocks.footer.breakBefore??=false;return next;};
async function paperOrder(page) {
  const frame=page.frameLocator('#preview-frame');
  await expect.poll(async()=> {
    const footer=await frame.locator('[data-v3-id=footer]').first().boundingBox(),customer=await frame.locator('[data-v3-id=customer]').first().boundingBox();
    return footer && customer ? footer.y-customer.y : Infinity;
  }).toBeLessThan(0);
}
test('section ordering agrees between inspector and Pi, including rendered order and Undo',async({page},info)=> {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await gateway(page,[['apply_operations',{summary:'Section order',operations:[{type:'reorder_sections',order}]}],['inspect_draft'],['finish',{summary:'Section order'}]]);
  await page.goto('/studio-v3/');await ready(page);const before=(await save(page,info,'before.json')).project;
  const structure=page.locator('[data-layout=structure]').first();if(await structure.getAttribute('aria-expanded')!=='true')await structure.click();
  await page.locator('#left-panel [data-select=footer]').click();const form=page.locator('form[data-form=block]');
  await form.locator('[name=sectionPosition]').selectOption({value:'1'});await form.getByRole('button',{name:'Apply section',exact:true}).click();await expect(page.locator('#revision')).toHaveText(/^r1\b/);await ready(page);await paperOrder(page);
  const ui=(await save(page,info,'ui.json')).project,expected=normalize(before);expected.manifest.studioV3.sectionOrder=order;
  expect(normalize(ui)).toEqual(expected);const uiDiagnostics=await diagnostics(page,ui);expect(uiDiagnostics.diagnostics.ready).toBe(true);
  await page.locator('[data-action=undo]').click();await ready(page);expect(normalize((await save(page,info,'undone.json')).project)).toEqual(normalize(before));
  await page.locator('[data-ai-toggle]').click();await page.locator('#ai-prompt').fill('Move the footer section directly after the header, before the customer section.');await page.locator('[data-ai-send]').click();
  await expectApplied(page,3,{timeout:60000});await ready(page);await paperOrder(page);
  const pi=(await save(page,info,'pi.json')).project;expect(normalize(pi)).toEqual(normalize(ui));expect((await diagnostics(page,pi)).diagnostics).toEqual(uiDiagnostics.diagnostics);
  await page.screenshot({path:info.outputPath('section-order.png')});await page.locator('[data-ai=undo]').click();await ready(page);
  expect(normalize((await save(page,info,'ai-undone.json')).project)).toEqual(normalize(before));expect(errors).toEqual([]);
});
