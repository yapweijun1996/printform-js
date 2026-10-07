import { test, expect } from '@playwright/test';

// The diagnostic page runs the real transport against a fake Demo gateway: three requests, codes and counts only.
const sse = output => `event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response:{status:'completed',output,usage:{input_tokens:3,output_tokens:2,total_tokens:5}}})}\n\n`;
const call = {id:'fc_1',type:'function_call',status:'completed',call_id:'call_1',name:'read_skill',arguments:'{"name":"layout"}'};
const reply = {id:'msg_1',type:'message',status:'completed',role:'assistant',content:[{type:'output_text',text:'Done.'}]};

test('the probe page reports each check from a fake gateway',async({page})=> {
  const bodies = [];
  await page.route('https://gpt.yapweijun1996.com/demo/**',async route=> {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session')) return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({token:'dmo_synthetic_probe1',expires_in:900})});
    if (path.endsWith('/models')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:'demo-fast'}]})});
    bodies.push(route.request().postDataJSON());
    return route.fulfill({status:200,contentType:'text/event-stream',body:sse(bodies.length === 1 ? [call] : [reply])});
  });
  await page.goto('/studio-v3/gateway-probe.html');
  await page.locator('#run').click();
  await expect(page.locator('#checks li')).toHaveCount(3);
  await expect(page.locator('#checks li.ok')).toHaveCount(3);
  await expect(page.locator('#result')).toHaveValue(/PASS replay: accepted/);
  expect(bodies).toHaveLength(2);
  expect(JSON.stringify(bodies)).not.toMatch(/dmo_synthetic/);
});
test('the probe page shows a failed check and still enables another run',async({page})=> {
  await page.route('https://gpt.yapweijun1996.com/demo/**',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:'DEMO_ORIGIN_FORBIDDEN'}})}));
  await page.goto('/studio-v3/gateway-probe.html');
  await page.locator('#run').click();
  await expect(page.locator('#checks li.bad')).toHaveCount(1);
  await expect(page.locator('#run')).toBeEnabled();
});
