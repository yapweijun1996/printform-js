import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
test.use({serviceWorkers:'block'});
test('currency vertical clipping is rejected at the value and its wrappers; normal A4 and multiline labels remain readable',async({page},info)=> {
  await page.goto('/studio-v3/');
  await page.setContent('<html lang="en"><head><title>Financial clip fixture</title></head><body><div class="printform_page" style="width:794px;height:1123px"><div class="field" style="height:120px;width:400px;display:flex;justify-content:space-between;align-items:flex-start"><span data-v3-role="label">Legitimate<br>multiline label</span><div id="wrapper"><span data-pf-format="currency" style="display:block">RM 12,150.00</span></div></div></div></body></html>');
  const results=[];
  const check=async(name,unreadable)=> {
    const codes=await page.evaluate(async()=> {
      const {inspectRenderedDocument}=await import('/studio-v2/core/acceptance.js');
      return inspectRenderedDocument(document,{}).errors.map(e=>e.code);
    });results.push({name,codes});expect(codes.includes('MONETARY_TOKEN_UNREADABLE')).toBe(unreadable);
  };
  await check('normal A4 and multiline label',false);
  const currency=page.locator('[data-pf-format=currency]'),wrapper=page.locator('#wrapper');
  for(const overflow of ['hidden','clip']) {
    await currency.evaluate((n,overflow)=>n.style.cssText=`display:block;height:5px;overflow-y:${overflow};white-space:nowrap`,overflow);
    await check(`5px value overflow-y ${overflow}`,true);
  }
  await currency.evaluate(n=>n.style.cssText='display:block;height:5px;overflow:visible;white-space:nowrap');
  await check('visible overflow within tall owner',false);
  await currency.evaluate(n=>n.style.cssText='display:block;white-space:nowrap;line-height:48px');
  await wrapper.evaluate(n=>n.style.cssText='height:5px;overflow:hidden');await check('wrapper clips tall line-height',true);
  await wrapper.evaluate(n=>n.style.cssText='height:70px;overflow:hidden;border:3px solid transparent;padding:4px;transform:translate(-12px,8px) scale(.8);transform-origin:top right');
  await check('scaled translated padded wrapper contains line',false);
  await wrapper.evaluate(n=>n.style.height='5px');await check('scaled wrapper clips line',true);
  await currency.evaluate(n=>n.style.cssText='display:block;white-space:nowrap;transform:translateY(-10px)');
  await wrapper.evaluate(n=>n.style.cssText='height:24px;margin-top:30px;overflow-y:clip');
  await check('wrapper clips glyph top inside tall field',true);
  await wrapper.evaluate(n=>n.style.overflow='visible');await check('visible wrapper glyph offset',false);
  await fs.writeFile(info.outputPath('vertical-clip-evidence.json'),JSON.stringify(results,null,2));
});
