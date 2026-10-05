import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('financial acceptance rejects wrapped, clipped and overlapping tokens without rejecting multiline labels',async({page})=> {
  await page.goto('/studio-v3/');
  await page.setContent('<html lang="en"><head><title>Synthetic financial readability</title></head><body><div class="printform_page" style="width:700px"><div class="field" style="width:240px;display:flex;justify-content:space-between"><span data-v3-role="label">Long legitimate<br>label</span><span data-pf-format="currency">RM 12,150.00</span></div></div></body></html>');
  const codes=()=>page.evaluate(async()=> {
    const {inspectRenderedDocument}=await import('/studio-v2/core/acceptance.js');
    return inspectRenderedDocument(document,{}).errors.map(e=>e.code);
  });
  expect(await codes()).not.toContain('MONETARY_TOKEN_UNREADABLE');
  const value=page.locator('[data-pf-format=currency]');
  await value.evaluate(n=>n.style.cssText='width:35px;overflow-wrap:anywhere');
  expect(await codes()).toContain('MONETARY_TOKEN_UNREADABLE');
  await value.evaluate(n=>n.style.cssText='width:35px;flex-shrink:0;white-space:nowrap;overflow-x:hidden');
  expect(await codes()).toContain('MONETARY_TOKEN_UNREADABLE');
  await value.evaluate(n=>n.style.cssText='white-space:nowrap;font-size:64px');
  expect(await codes()).toContain('MONETARY_TOKEN_UNREADABLE');
  await value.evaluate(n=>n.style.cssText='position:absolute;left:8px;top:8px');
  expect(await codes()).toContain('MONETARY_TOKEN_UNREADABLE');
});
