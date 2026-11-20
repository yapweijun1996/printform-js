import {test,expect} from './studio-v3-test.js';
import {expectApplied} from './ai-applied.js';
import {gateway,save,normalized,diagnostics} from './studio-v3-element-style.js';

test.use({workInSteps:true});
test.setTimeout(90000);
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled();
const target = 'customer-bill';
const patch = {label:'配送 / Delivery',showLabel:true,labelStyle:{fontSize:12.25,bold:true,color:'#163a65',align:'left'},valueStyle:{fontSize:10.75}};
const steps = [['apply_operations',{summary:'Style the bill field',operations:[{type:'set_field',target,patch}]}],['inspect_draft'],['finish',{summary:'Style the bill field'}]];

test('field properties match across native inspector and Pi, including fractional typography and Undo',async({page},info)=> {
  const errors = []; page.on('pageerror',error=>errors.push(error.message));
  await gateway(page,steps); await page.goto('/studio-v3/'); await ready(page);
  const before = (await save(page,info,'before.json')).project;
  const structure = page.locator('[data-layout=structure]').first();
  if (await structure.getAttribute('aria-expanded') !== 'true') await structure.click();
  await page.locator(`#left-panel [data-select="${target}"]`).click();
  const form = page.locator('form[data-form=field]');
  await form.locator('summary').filter({hasText:/^Label$/}).click();
  await form.locator('[name="label"]').fill(patch.label);
  await form.locator('[name="labelStyle.fontSize"]').fill('5');
  await form.getByRole('button',{name:'Apply field',exact:true}).click();
  await expect(page.locator('#revision')).toHaveText(/^r0\b/);
  for (const [name,value] of Object.entries(patch.labelStyle)) {
    const control = form.locator(`[name="labelStyle.${name}"]`);
    if (name === 'bold' || name === 'align') await control.selectOption({value:String(value)});
    else await control.fill(String(value));
  }
  await form.locator('[name="valueStyle.fontSize"]').fill(String(patch.valueStyle.fontSize));
  await form.getByRole('button',{name:'Apply field',exact:true}).click();
  await expect(page.locator('#revision')).toHaveText(/^r1\b/); await ready(page);
  const preview = page.frameLocator('#preview-frame');
  const label = preview.locator(`[data-v3-id="label-${target}"]`).first(), value = preview.locator(`[data-v3-id="${target}"]`).first();
  await expect(label).toHaveText(patch.label); await expect(label).toHaveCSS('font-weight','700');
  await expect(label).toHaveCSS('color','rgb(22, 58, 101)'); await expect(label).toHaveAttribute('style',/font-size:12\.25pt/);
  await expect(value).toHaveAttribute('style',/font-size:10\.75pt/);
  const ui = (await save(page,info,'ui.json')).project, expected = normalized(before);
  Object.assign(expected.manifest.studioV3.customer.find(field=>field.id==='bill'),patch);
  expect(normalized(ui)).toEqual(expected);
  const uiDiagnostics = (await diagnostics(page,ui)).diagnostics; expect(uiDiagnostics.ready).toBe(true);
  await page.locator('[data-action=undo]').click(); await ready(page);
  expect(normalized((await save(page,info,'undo.json')).project)).toEqual(normalized(before));
  await page.locator('[data-ai-toggle]').click(); await page.locator('#ai-prompt').fill('Update the selected customer field label and typography.');
  await page.locator('[data-ai-send]').click(); await expectApplied(page,3,{timeout:60000}); await ready(page);
  const pi = (await save(page,info,'pi.json')).project;
  expect(normalized(pi)).toEqual(normalized(ui)); expect((await diagnostics(page,pi)).diagnostics).toEqual(uiDiagnostics);
  await expect(label).toHaveText(patch.label); await expect(value).toHaveAttribute('style',/font-size:10\.75pt/);
  await page.locator('[data-ai=undo]').click(); await ready(page);
  expect(normalized((await save(page,info,'ai-undo.json')).project)).toEqual(normalized(before)); expect(errors).toEqual([]);
});
