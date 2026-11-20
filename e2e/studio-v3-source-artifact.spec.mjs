import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createCodingServer } from '../coding-runner/server.mjs';
import { SOURCE_RUNNER_URL } from '../studio-v3/source-workspace-client.js';
import { closeSettings, openSharing } from './ai-sharing.js';
import { expectApplied } from './ai-applied.js';
import { expect, test } from './studio-v3-test.js';

const heading = 'FICTIONAL CHILDCARE INVOICE FORM';
const artifactPath = 'artifacts/form.printform-operations.json';
const startedMarker = 'Fictional source process started';
const stopCommand = `node -e "console.log('${startedMarker}');setTimeout(()=>{},60000)"`;
const docker = promisify(execFile);

test.skip(process.env.PF_CODING_BROWSER_INTEGRATION !== '1', 'requires a sealed local Docker image');
// Studio uses one fixed loopback port. Preserve independent tests without overlapping companions.
test.describe.configure({mode:'default'});
test.use({
  workInSteps:true, viewport:{width:800,height:900}, launchOptions:{chromiumSandbox:true},
  // Pairing screenshots and network traces can contain short-lived credentials.
  trace:'off', screenshot:'off', video:'off'
});

async function useFictionalProvider(page,{commandToStop=null,restoreSource=false}={}) {
  await page.addInitScript(({heading,artifactPath,commandToStop,restoreSource})=> {
    const native = window.fetch.bind(window);
    const json = (body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    const receipts = []; window.sourceArtifactReceipts = receipts;
    let originalSource;
    const steps = commandToStop ? [()=>['workspace_run',{command:commandToStop,cwd:''}]] : [
      ()=>['workspace_read',{path:'src/form.mjs'}],
      read=> {
        originalSource = read.result.content;
        return ['workspace_write',{path:'src/form.mjs',expectedDigest:read.result.digest,content:originalSource.replace('GENERATED FORM',heading)}];
      },
      ...(restoreSource ? [write=>['workspace_write',{path:'src/form.mjs',expectedDigest:write.result.changes[0].afterDigest,content:originalSource}]] : []),
      ()=>['workspace_run',{command:'node --test test/form.test.mjs',cwd:''}],
      ()=>['workspace_run',{command:'node build.mjs',cwd:''}],
      build=>['workspace_artifacts',{callId:build.callId,path:artifactPath}],
      artifact=>['import_artifact',{artifactId:artifact.id}],
      ...(restoreSource ? [()=>['report_blocked',{reason:'The source now matches the original starter.'}]] : [
        ()=>['inspect_draft',{}],
        ()=>['finish',{summary:'Review the fictional source-generated heading.'}]
      ])
    ];
    let turn = 0;
    window.fetch = async (input,init)=> {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.origin !== 'https://gpt.yapweijun1996.com') return native(input,init);
      if (url.pathname === '/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body = JSON.parse(init.body), previous = turn ? body.input.findLast(item=>item.type === 'function_call_output' && item.call_id === `source_fixture_${turn-1}`) : null;
      let receipt = null;
      if (previous) {
        const output = typeof previous.output === 'string' ? previous.output : previous.output.find(item=>typeof item.text === 'string').text;
        try { receipt = JSON.parse(output); } catch { receipt = output; }
      }
      if (turn) receipts.push(receipt);
      const [name,args] = steps[turn](receipt);
      const response = {status:'completed',output:[{type:'function_call',id:`fc_${turn}`,call_id:`source_fixture_${turn}`,name,arguments:JSON.stringify(args)}],
        usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      turn++;
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },{heading,artifactPath,commandToStop,restoreSource});
}

function observeStopTransport(page,server) {
  const entries = [];
  const route = pathname => pathname === '/v1/workspaces' ? '/v1/workspaces' :
    /^\/v1\/workspaces\/[a-f0-9-]{36}\/close$/.test(pathname) ? '/v1/workspaces/:id/close' : null;
  const record = (request,event,details={}) => {
    const url = new URL(request.url());
    const path = url.origin === SOURCE_RUNNER_URL && route(url.pathname);
    if (path) entries.push({event,path,method:request.method(),...details,ms:Math.round(performance.now())});
  };
  page.on('response',response=>record(response.request(),'browser-response',{status:response.status()}));
  page.on('requestfinished',request=>record(request,'browser-finished'));
  page.on('requestfailed',request=>record(request,'browser-failed',{error:request.failure()?.errorText}));
  server.prependListener('request',(request,response)=> {
    const path = route(new URL(request.url,SOURCE_RUNNER_URL).pathname);
    if (!path) return;
    const record = event=>entries.push({event,path,method:request.method,status:response.statusCode,finished:response.writableFinished,ms:Math.round(performance.now())});
    record('server-request');
    response.once('finish',()=>record('server-finished'));
    response.once('close',()=>record('server-closed'));
  });
  return entries;
}

async function enableFictionalSource(page) {
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
    await enableFictionalSource(page);
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

test('a build after restoring the starter source cannot hand off a form artifact',async({page,baseURL,browserName})=> {
  test.skip(browserName !== 'chromium','the local companion profile is exercised with Chromium');
  test.setTimeout(150_000);
  const origin = new URL(baseURL).origin;
  const runner = createCodingServer({origin,port:Number(new URL(SOURCE_RUNNER_URL).port),image:process.env.PF_CODING_IMAGE || 'printform-coding-runner:local'});
  try {
    await runner.listen();
    await useFictionalProvider(page,{restoreSource:true});
    await enableFictionalSource(page);
    await page.locator('#ai-prompt').fill('Build the fictional source artifact after restoring the starter source.');
    await page.locator('[data-ai-send]').click();
    await expect(page.locator('[data-source-status]')).toContainText('Isolated workspace closed',{timeout:45_000});
    const [read,edit,reverted,tested,built,artifact,denial] = await page.evaluate(()=>window.sourceArtifactReceipts);
    expect(edit.afterDigest).not.toBe(read.beforeDigest);
    expect(reverted.afterDigest).toBe(read.beforeDigest);
    expect(tested.exitCode).toBe(0);
    expect(built.exitCode).toBe(0);
    expect(artifact).toMatchObject({buildCallId:built.callId,treeDigest:built.afterDigest});
    expect(JSON.stringify(denial)).toContain('ARTIFACT_REJECTED');
    await expect(page.locator('#revision')).toHaveText(/^r0\b/);
    await expect(page.locator('[data-ai-proposal]')).toBeHidden();
  } finally { await runner.close(); }
});

test('Stop closes an actually running source workspace without a late form handoff',async({page,baseURL,browserName},info)=> {
  test.skip(browserName !== 'chromium','the local companion profile is exercised with Chromium');
  test.setTimeout(150_000);
  const origin = new URL(baseURL).origin;
  const runner = createCodingServer({origin,port:Number(new URL(SOURCE_RUNNER_URL).port),image:process.env.PF_CODING_IMAGE || 'printform-coding-runner:local'});
  const transport = observeStopTransport(page,runner.server);
  let providerRequests = 0;
  page.on('request',request=> { if (new URL(request.url()).origin === 'https://gpt.yapweijun1996.com') providerRequests++; });
  try {
    const identity = await runner.listen();
    await useFictionalProvider(page,{commandToStop:stopCommand});
    await enableFictionalSource(page);
    const opened = page.waitForResponse(response=>response.request().method() === 'POST' && response.url() === `${SOURCE_RUNNER_URL}/v1/workspaces`);
    await page.locator('#ai-prompt').fill('Run the fictional local source process until I choose Stop.');
    await page.locator('[data-ai-send]').click();
    const workspace = await (await opened).json();
    expect(workspace.id).toMatch(/^[a-f0-9-]{36}$/);
    const ownerFilter = `label=io.printform.coding.workspace=${workspace.id}`;
    await expect.poll(async()=> {
      const {stdout} = await docker('docker',['container','ls','--quiet','--no-trunc','--filter',ownerFilter,'--filter','name=pf-run-']);
      const id = stdout.trim();
      if (!/^[a-f0-9]{64}$/.test(id)) return false;
      const logs = await docker('docker',['container','logs',id]);
      return logs.stdout.includes(startedMarker);
    },{timeout:35_000}).toBe(true);

    const closed = page.waitForResponse(response=>response.request().method() === 'POST' && response.url() === `${SOURCE_RUNNER_URL}/v1/workspaces/${workspace.id}/close`);
    const beforeStop = performance.now();
    await page.getByRole('button',{name:'Stop request'}).click();
    const response = await closed;
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({id:workspace.id,closed:true});
    const acknowledged = performance.now();
    await expect(page.locator('[data-source-status]')).toContainText('Isolated workspace closed');
    const shown = performance.now();
    await expect(page.locator('#revision')).toHaveText(/^r0\b/);
    await expect(page.locator('[data-ai-proposal]')).toBeHidden();
    await expect(page.locator('#ai-source-enabled')).not.toBeChecked();
    const [containers,volumes] = await Promise.all([
      docker('docker',['container','ls','--all','--quiet','--filter',ownerFilter]),
      docker('docker',['volume','ls','--quiet','--filter',ownerFilter]),
    ]);
    expect(containers.stdout.trim()).toBe('');
    expect(volumes.stdout.trim()).toBe('');
    expect(providerRequests).toBe(0);
    await info.attach('browser-stop-timing',{contentType:'application/json',body:JSON.stringify({
      runnerSourceHash:identity.runnerSourceHash,imageDigest:identity.imageDigest,endpoint:'/close',
      clickToAcknowledgedMs:Math.round(acknowledged-beforeStop),clickToNoticeMs:Math.round(shown-beforeStop),
    })});
  } finally {
    try { await runner.close(); }
    finally { await info.attach('browser-stop-transport',{contentType:'application/json',body:JSON.stringify(transport)}); }
  }
});
