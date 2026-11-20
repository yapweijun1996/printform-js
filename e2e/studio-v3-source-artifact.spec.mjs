import { createHash } from 'node:crypto';
import { createCodingServer } from '../coding-runner/server.mjs';
import { SOURCE_RUNNER_URL } from '../studio-v3/source-workspace-client.js';
import { closeSettings, openSharing } from './ai-sharing.js';
import { expectApplied } from './ai-applied.js';
import { expect, test } from './studio-v3-test.js';

const heading = 'FICTIONAL CHILDCARE INVOICE FORM';
const artifactPath = 'artifacts/form.printform-operations.json';

test.skip(process.env.PF_CODING_BROWSER_INTEGRATION !== '1', 'requires a sealed local Docker image');
test.use({
  workInSteps:true, viewport:{width:800,height:900}, launchOptions:{chromiumSandbox:true},
  // Pairing screenshots and network traces can contain short-lived credentials.
  trace:'off', screenshot:'off', video:'off'
});

async function useFictionalProvider(page) {
  await page.addInitScript(({heading,artifactPath})=> {
    const native = window.fetch.bind(window);
    const json = (body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const receipts = []; window.sourceArtifactReceipts = receipts;
    const steps = [
      ()=>['workspace_read',{path:'src/form.mjs'}],
      read=>['workspace_write',{path:'src/form.mjs',expectedDigest:read.result.digest,content:read.result.content.replace('GENERATED FORM',heading)}],
      ()=>['workspace_run',{command:'node --test test/form.test.mjs',cwd:''}],
      ()=>['workspace_run',{command:'node build.mjs',cwd:''}],
      build=>['workspace_artifacts',{callId:build.callId,path:artifactPath}],
      artifact=>['import_artifact',{artifactId:artifact.id}],
      ()=>['inspect_draft',{}],
      ()=>['finish',{summary:'Review the fictional source-generated heading.'}]
    ];
    let turn = 0;
    window.fetch = async (input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return native(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body = JSON.parse(init.body), previous = turn ? body.input.findLast(item=>item.type === 'function_call_output' && item.call_id === `source_fixture_${turn-1}`) : null;
      const receipt = previous ? JSON.parse(typeof previous.output === 'string' ? previous.output : previous.output.find(item=>typeof item.text === 'string').text) : null;
      if (turn) receipts.push(receipt);
      const [name,args] = steps[turn](receipt);
      const response = {status:'completed',output:[{type:'function_call',id:`fc_${turn}`,call_id:`source_fixture_${turn}`,name,arguments:JSON.stringify(args)}],
        usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      turn++;
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },{heading,artifactPath});
}

test('sealed Docker builds a source artifact for independent inspection and human Apply',async({page,baseURL,browserName},info)=> {
  test.skip(browserName !== 'chromium','the local companion profile is exercised with Chromium');
  test.setTimeout(150_000);
  const origin = new URL(baseURL).origin;
  const runner = createCodingServer({origin,port:Number(new URL(SOURCE_RUNNER_URL).port),image:process.env.PF_CODING_IMAGE || 'printform-coding-runner:local'});
  const timings = [];
  page.on('response', response=> {
    const url = new URL(response.url());
    if (url.origin !== SOURCE_RUNNER_URL) return;
    const request = response.request();
    const path = url.pathname.replace(/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/g,':id');
    timings.push({method:request.method(),path,status:response.status(),elapsedMs:Math.round(request.timing().responseStart)});
  });
  try {
    const identity = await runner.listen();
    await useFictionalProvider(page);
    await page.goto('/studio-v3/');
    await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30_000});
    await page.locator('[data-ai-toggle]').click();
    await page.locator('.ai-settings > summary').click();
    await page.locator('.ai-source-setup > summary').click();
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),page.getByRole('link',{name:'Open local pairing page'}).click()
    ]);
    const code = (await popup.locator('#pair-code').textContent()).trim();
    await popup.close();
    // Keep the native input event and user click, without putting the code in Playwright's action log.
    await page.locator('#ai-source-code').evaluate((input,value)=> { input.value = value; input.dispatchEvent(new Event('input',{bubbles:true})); },code);
    await page.locator('[data-source-pair]').click();
    await expect(page.locator('[data-source-status]')).toContainText('Paired locally');
    await openSharing(page);
    await expect(page.locator('#ai-source-enabled')).not.toBeChecked();
    await page.locator('#ai-source-enabled').check();
    await closeSettings(page);
    await page.locator('#ai-prompt').fill(`Use fictional source to set the printed heading to ${heading}. Run the tests and build the artifact.`);
    await page.locator('[data-ai-send]').click();

    await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:90_000});
    await expect(page.locator('[data-source-status]')).toContainText('Isolated workspace closed',{timeout:30_000});
    await expect(page.locator('#revision')).toHaveText(/^r0\b/);
    await page.locator('[data-ai=preview]').click();
    await expect(page.locator('#ai-preview-banner')).toBeVisible();
    await expect(page.locator('#revision')).toHaveText(/^r0\b/);
    const paper = page.frameLocator('#preview-frame').locator('h1').first();
    await expect(paper).toHaveText(heading);
    await page.locator('[data-ai-return]').click();
    await page.locator('[data-ai=apply]').click();
    await expectApplied(page,1);
    await expect(paper).toHaveText(heading);

    const [,,tested,built,artifact,imported] = await page.evaluate(()=>window.sourceArtifactReceipts);
    expect(tested).toMatchObject({exitCode:0,beforeDigest:tested.afterDigest,imageDigest:identity.imageDigest});
    expect(built).toMatchObject({exitCode:0,imageDigest:identity.imageDigest});
    const generated = built.changes.find(change=>change.path === artifactPath);
    const expected = {format:'printform-operation-artifact',version:1,summary:'Source-generated heading; review the actual paper before Apply.',
      operations:[{type:'set_section',target:'header',patch:{enabled:true}},{type:'set_heading',value:heading}]};
    const digest = createHash('sha256').update(JSON.stringify(expected,null,2)+'\n').digest('hex');
    expect(generated).toMatchObject({type:'added',afterDigest:digest});
    expect(artifact).toMatchObject({contentDigest:digest,buildCallId:built.callId,treeDigest:built.afterDigest,sourceRevision:built.afterRevision});
    expect(imported).toMatchObject({accepted:true,artifactId:artifact.id});
  } finally {
    await runner.close();
    await info.attach('local-runner-timings',{contentType:'application/json',body:JSON.stringify(timings)});
  }
});
