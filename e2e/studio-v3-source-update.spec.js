import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { closeSettings, openSharing } from './ai-sharing.js';
import { clickHeaderAction } from './header-action.js';
import { NEXT, OLD, upgradeServer } from './studio-v3-upgrade-server.js';

const LOOPBACK = 'http://127.0.0.1:4317';
const DEMO = 'https://gpt.yapweijun1996.com';
const CODE = 'synthetic-update-pairing-code';
const TOKEN = 'synthetic-update-pairing-token';
const OWNED = 'synthetic-owned-workspace';
const CLOSE_PATH = `/v1/workspaces/${OWNED}/close`;
const PROMPT = 'Keep this fictional source request during the Studio update.';
const RECOVERY = 'printform-studio-v3:update-recovery';

async function companion(origin,runnerSourceHash) {
  let acknowledge;
  const heldClose = new Promise(resolve=> { acknowledge=resolve; });
  const calls = [], revokeIntents = [];
  const server = createServer(async (request,response)=> {
    const {method,url} = request;
    const json = (body,status=200)=> {
      if (!response.destroyed) response.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(body));
    };
    request.resume();
    if (request.headers.origin !== origin) { json({},403); return; }
    response.setHeader('Access-Control-Allow-Origin',origin);
    response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers','content-type, authorization, x-pf-intent');
    response.setHeader('Access-Control-Allow-Private-Network','true');
    if (method === 'OPTIONS') { response.writeHead(204).end(); return; }
    calls.push(`${method} ${url}`);
    if (method === 'GET' && url === '/health') { json({runnerSourceHash}); return; }
    if (method !== 'POST') { json({},405); return; }
    if (url === '/v1/pair') {
      json({protocol:'printform-coding-v1',profile:'local-docker-node24-source-json-v1',runnerSourceHash,
        token:TOKEN,expiresAt:Date.now()+60_000,responseBytes:1_048_576});
      return;
    }
    if (request.headers.authorization !== `Bearer ${TOKEN}`) { json({},401); return; }
    if (url === '/v1/workspaces') {
      json({id:OWNED,revision:0,treeDigest:'a'.repeat(64),imageDigest:'sha256:'+'b'.repeat(64)});
    } else if (url === CLOSE_PATH) {
      json(await heldClose);
    } else if (url === '/v1/revoke') {
      revokeIntents.push(request.headers['x-pf-intent']);
      json({revoked:true,workspacesClosed:revokeIntents.length > 1});
    } else json({},404);
  });
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return {url:`http://127.0.0.1:${server.address().port}`,calls,revokeIntents,acknowledge,close:async()=> {
    acknowledge({id:OWNED,closed:true});
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }};
}

async function startSource(page,site,local,build=OLD) {
  await page.addInitScript(({demo,loopback,target})=> {
    if (window !== window.top) return;
    const native = window.fetch.bind(window);
    window.fetch = async (input,options)=> {
      const url = new URL(typeof input === 'string' ? input : input.url ?? input.href,location.href);
      // Use an isolated port while preserving the browser's native HTTP and CORS.
      if (url.origin === loopback) return native(target+url.pathname+url.search,options);
      if (url.origin !== demo) return native(input,options);
      const reply = (value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
      if (url.pathname === '/demo/session') return reply({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return reply({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      options.signal.throwIfAborted();
      window.sourceUpdateWaitingForModel = true;
      return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
    };
  },{demo:DEMO,loopback:LOOPBACK,target:local.url});
  await page.goto(site.url);
  await expect(page.locator('[data-action=export]')).toBeEnabled();
  await expectBuild(page,build);
  await page.locator('[data-ai-toggle]').click();
  await page.locator('.ai-settings > summary').click();
  await page.locator('.ai-source-setup > summary').click();
  await page.locator('#ai-source-code').fill(CODE);
  await page.locator('[data-source-pair]').click();
  await expect(page.locator('[data-source-status]')).toContainText('Paired locally');
  await openSharing(page);
  await page.locator('#ai-source-enabled').check();
  await closeSettings(page);
  await page.locator('#ai-prompt').fill(PROMPT);
  await page.locator('[data-ai-send]').click();
  // The coding run opens its workspace before asking the model for a turn.
  await page.waitForFunction(()=>window.sourceUpdateWaitingForModel === true);
  expect(local.calls).toContain('POST /v1/workspaces');
}

async function expectBuild(page,build) {
  await expect(page.locator('meta[name=printform-source-revision]')).toHaveAttribute('content',build);
  await expect.poll(()=>page.evaluate(()=>new Promise(resolve=> {
    const controller = navigator.serviceWorker.controller;
    if (!controller) { resolve(null); return; }
    const channel = new MessageChannel();
    const timeout = setTimeout(()=> { channel.port1.close(); resolve(null); },1000);
    channel.port1.onmessage = event=> { clearTimeout(timeout); channel.port1.close(); resolve(event.data?.build); };
    controller.postMessage({type:'VERSION'},[channel.port2]);
  }))).toBe(build);
}

async function chooseUpdate(page,choice) {
  const dialog = page.locator('#update-dialog');
  if (!await dialog.isVisible()) await clickHeaderAction(page,'update');
  await expect(dialog).toBeVisible();
  await dialog.locator(`[data-update-choice=${choice}]`).click();
}

function savedPrompt(page) {
  return page.evaluate(key=>JSON.parse(sessionStorage.getItem(key) || 'null')?.ai?.prompt,RECOVERY);
}

test.use({viewport:{width:1440,height:900},launchOptions:{chromiumSandbox:true}});

for (const wrongId of [false,true]) {
  test(`Studio update with owned source cleanup ${wrongId ? 'rejects an unrelated receipt and supports retry' : 'waits for confirmation and preserves Stay'}`,async({page,browserName})=> {
    test.skip(browserName !== 'chromium','Native source-companion transport is exercised with Chromium.');
    test.setTimeout(90000);
    const site = await upgradeServer();
    let local;
    try {
      const manifest = await fetch(new URL(`releases/${OLD}/agent/agent-manifest.json`,site.url)).then(response=>response.json());
      local = await companion(new URL(site.url).origin,manifest.sourceRunnerHash);
      const providerRequests = [];
      page.on('request',request=> { if (new URL(request.url()).origin === DEMO) providerRequests.push(request.method()); });
      await startSource(page,site,local);
      const status = page.locator('#update-status'), closeCall = `POST ${CLOSE_PATH}`;
      site.publish();
      if (!wrongId) {
        await chooseUpdate(page,'stay');
        await expect(page.locator('#update-button')).toBeEnabled();
        await expectBuild(page,OLD);
        expect(local.calls).not.toContain(closeCall);
      }
      await chooseUpdate(page,'keep');
      await expect.poll(()=>local.calls).toContain(closeCall);
      await expect(status).toContainText('Waiting for the local source workspace to close');
      await expectBuild(page,OLD);
      await expect.poll(()=>savedPrompt(page)).toBe(PROMPT);
      local.acknowledge({id:wrongId ? 'synthetic-other-workspace' : OWNED,closed:true});
      if (wrongId) {
        await expect(status).toContainText('Local source cleanup was not acknowledged');
        await expectBuild(page,OLD);
        await expect(page.locator('body')).not.toHaveAttribute('inert','');
        await expect(page.locator('#ai-prompt')).toHaveValue(PROMPT);
        expect(await savedPrompt(page)).toBe(PROMPT);
        await page.locator('.ai-settings > summary').click();
        const disconnect = page.locator('[data-source-disconnect]');
        await disconnect.click();
        await expect(page.locator('[data-source-status]')).toContainText('Revocation/cleanup was not acknowledged');
        await expect(page.locator('[data-ai-send]')).toBeDisabled();
        await expectBuild(page,OLD);
        expect(await savedPrompt(page)).toBe(PROMPT);
        await disconnect.click();
        await expect(page.locator('[data-source-status]')).toContainText('Pairing revoked and owned workspaces closed');
        expect(local.revokeIntents[0]).toMatch(/^[\da-f-]{36}$/);
        expect(local.revokeIntents).toEqual([local.revokeIntents[0],local.revokeIntents[0]]);
        await closeSettings(page);
        await chooseUpdate(page,'keep');
      }
      await expectBuild(page,NEXT);
      await expect(page.locator('#ai-prompt')).toHaveValue(PROMPT);
      expect(await page.evaluate(key=>sessionStorage.getItem(key),RECOVERY)).toBeNull();
      expect(local.calls.filter(call=>call === closeCall)).toHaveLength(1);
      expect(providerRequests).toEqual([]);
    } finally {
      await local?.close();
      await site.close();
    }
  });
}

test('model Send stays blocked after failed cleanup while the local new-form preview remains available',async({page,baseURL,browserName})=> {
  test.skip(browserName !== 'chromium','Native source-companion transport is exercised with Chromium.');
  const site = {url:new URL('/studio-v3/',baseURL).href};
  const manifest = await fetch(new URL('agent/agent-manifest.json',site.url)).then(response=>response.json());
  const local = await companion(new URL(site.url).origin,manifest.sourceRunnerHash);
  const modelRequests = [];
  page.on('request',request=> { if (new URL(request.url()).origin === DEMO) modelRequests.push(request.method()); });
  try {
    await startSource(page,site,local,manifest.release);
    await page.getByRole('button',{name:'Stop request'}).click();
    await expect.poll(()=>local.calls).toContain(`POST ${CLOSE_PATH}`);
    const input = page.locator('#ai-prompt'), send = page.locator('[data-ai-send]');
    await input.fill('Edit the heading in this form.');
    await expect(send).toBeDisabled();
    await expect(page.locator('[data-ai-send-reason]')).toContainText('Model requests are paused');
    local.acknowledge({id:'synthetic-other-workspace',closed:true});
    await expect(page.locator('[data-source-status]')).toContainText('Local cleanup was not acknowledged');
    await input.fill('Edit the title instead.');
    await expect(send).toBeDisabled();
    const afterStop = [...local.calls];
    await input.fill('/new blank');
    await expect(send).toBeEnabled();
    await page.getByRole('button',{name:'Edit & resend'}).click();
    await expect(input).toHaveValue(PROMPT);
    await expect(send).toBeDisabled();
    await input.fill('/new blank');
    await page.locator('[data-ai=close]').click();
    await page.locator('[data-ai-toggle]').click();
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.locator('#local-new-form-dialog')).toContainText('Preview passed');
    expect(local.calls).toEqual(afterStop);
    expect(modelRequests).toEqual([]);
    await expect(page.locator('#revision')).toHaveText(/^r0\b/);
  } finally { await local.close(); }
});
