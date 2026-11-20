import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { arch, platform } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { createCodingServer } from '../coding-runner/server.mjs';
import { DEFAULT_IMAGE, LIMITS } from '../coding-runner/policy.mjs';
import { sourceRunnerBrowser } from '../tests/support/source-runner-browser.mjs';

const runDocker = promisify(execFile);
const [output, rounds = '50'] = process.argv.slice(2);
const roundCount = Number(rounds);
if (!output || process.argv.length > 4 || !Number.isInteger(roundCount) || roundCount < 1 || roundCount > 50) {
  console.error('Usage: node scripts/studio-v3-coding-load.mjs <new-evidence.jsonl> [rounds:1..50]');
  process.exit(1);
}
await writeFile(output, '', { flag:'wx' });
let interrupted = false;
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=> { interrupted = true; });
const samples = [];
const usedIds = new Set();
const deaths = new Map();
const knownContainers = new Set();
const events = spawn('docker',['events','--filter','type=container','--filter','event=die','--format','{{.ID}} {{.TimeNano}}'],{stdio:['ignore','pipe','ignore']});
let eventError;
events.once('error',error=> { eventError = error; });
const lines = createInterface({input:events.stdout});
lines.on('line',line=> {
  const [id,time] = line.split(' ');
  if (knownContainers.has(id) && /^[0-9]+$/.test(time)) deaths.set(id,Number(BigInt(time)/1000000n));
});
const startedAt = new Date().toISOString();
const files = Array.from({length:LIMITS.files},(_,index)=>({
  path:`section-${String(index).padStart(3,'0')}/fixture.txt`,
  content:index < LIMITS.treeBytes/LIMITS.fileBytes ? 'x'.repeat(LIMITS.fileBytes) : ''
}));
const fixture = {files:files.length,directories:files.length,bytes:files.reduce((sum,file)=>sum+file.content.length,0)};
assert.deepEqual(fixture,{files:128,directories:128,bytes:4194304});
const command = `node -e "process.stdout.write('x'.repeat(${LIMITS.outputBytes}));setTimeout(()=>{},40000)"`;
const releaseIdentity = {release:'g6-load-synthetic',contractHash:'fixture',knowledgeHash:'fixture',packageHash:'fixture'};

let browser, originHarness, companion, identity, token;
const api = (route,body)=>originHarness.request(identity.url,token,route,body);
const lease = workspace=>`/v1/workspaces/${workspace.id}`;
const record = async record=>appendFile(output,JSON.stringify(record)+'\n');
const hostMeasure = (key, call) => {
  const at = Date.now(), started = performance.now();
  return Promise.resolve(call()).then(result=>({[key]:Math.round((performance.now()-started)*100)/100,at,result}));
};
async function workspace() {
  const admission=await hostMeasure('createMs',()=>api('/v1/workspaces',{files,releaseIdentity,documentId:'fictional-load-document',baseRevision:0,runId:randomUUID()}));
  if (admission.result.body.id) usedIds.add(admission.result.body.id);
  await record({kind:'create',elapsedMs:admission.createMs,status:admission.result.status,error:admission.result.body.error?.code});
  assert.equal(admission.result.status,200,admission.result.body.error?.code);
  return admission.result.body;
}
async function actualRunning(id) {
  const stop=Date.now()+25_000;
  while (Date.now()<stop) {
    const {stdout}=await runDocker('docker',['container','ls','--quiet','--no-trunc','--filter',`label=io.printform.coding.workspace=${id}`,'--filter','name=pf-run-']);
    const found=stdout.trim();
    if (found) {
      knownContainers.add(found);
      return found;
    }
    await delay(80);
  }
  throw Error('actual command container did not enter running state');
}
async function stopSample(workspace,index) {
  const next = await api(lease(workspace)+'/calls',{operation:'run',expectedRevision:workspace.revision,args:{command,cwd:''}});
  assert.equal(next.status,202,next.body.error?.code);
  const receiptUrl=lease(workspace)+'/calls/'+next.body.callId;
  const container=await actualRunning(workspace.id);
  const status=await hostMeasure('statusMs',()=>api(receiptUrl));
  assert.equal(status.result.status,200,status.result.body.error?.code);
  assert.equal(status.result.body.status,'running');
  const stop=await hostMeasure('stopMs',()=>api(lease(workspace)+'/cancel',{}));
  const completed=await hostMeasure('completedStatusMs',()=>api(receiptUrl+'?wait=1'));
  const receipt=completed.result;
  const present=await runDocker('docker',['container','ls','--all','--quiet','--filter',`id=${container}`]);
  for(let count=0;count<10&&!deaths.has(container);count++) await delay(100);
  const sample={kind:'sample',index,statusMs:status.statusMs,stopMs:stop.stopMs,completedStatusMs:completed.completedStatusMs,processGoneMs:deaths.has(container)?deaths.get(container)-stop.at:null,
    statusCode:status.result.status,stopCode:stop.result.status,stopError:stop.result.body.error?.code,receiptCode:receipt.body.error?.code,
    receiptStatus:receipt.body.status,stdoutBytes:Buffer.byteLength(receipt.body.stdout||''),containerGone:present.stdout.trim()==='',
    activeTreePreserved:receipt.body.beforeDigest===receipt.body.afterDigest&&receipt.body.beforeRevision===receipt.body.afterRevision};
  await record(sample); samples.push(sample);
  assert.equal(stop.result.status,200,stop.result.body.error?.code);
  assert.equal(stop.result.body.processesRemoved,true);
  assert.equal(receipt.status,200);
  assert.equal(receipt.body.error?.code,'CANCELLED');
  assert(sample.containerGone);
  assert(sample.activeTreePreserved);
  workspace.revision=receipt.body.afterRevision;
  deaths.delete(container);
  knownContainers.delete(container);
}
async function stillHealthy(workspace) {
  const admitted=await api(lease(workspace)+'/calls',{operation:'run',expectedRevision:workspace.revision,args:{command:'printf recovered',cwd:''}});
  assert.equal(admitted.status,202,admitted.body.error?.code);
  const receipt=await api(lease(workspace)+'/calls/'+admitted.body.callId+'?wait=1');
  await record({kind:'recovery',status:receipt.status,exit:receipt.body.exitCode,outputMatches:receipt.body.stdout==='recovered'});
  assert.equal(receipt.body.exitCode,0,receipt.body.error?.code);
  assert.equal(receipt.body.stdout,'recovered');
}
function waitPair(...actions) {
  return Promise.allSettled(actions).then(results=> {
    const errors=results.filter(result=>result.status==='rejected');
    if(errors.length)throw new AggregateError(errors.map(result=>result.reason),'Concurrent fixture failed');
    return results.map(result=>result.value);
  });
}
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1] ?? null;
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true});
  if (eventError) throw eventError;
  originHarness=await sourceRunnerBrowser(browser);
  companion=createCodingServer({origin:originHarness.origin,port:0,image:process.env.PF_CODING_IMAGE || DEFAULT_IMAGE});
  identity=await companion.listen();
  token=(await originHarness.pair(identity.url)).token;
  await record({kind:'configuration',roundCount,startedAt,platform:platform(),arch:arch(),node:process.version,concurrency:2,fixture,outputTarget:LIMITS.outputBytes,image:identity.imageDigest,source:identity.runnerSourceHash});
  for(let offset=0;offset<roundCount;offset+=25){
    const active=await waitPair(workspace(),workspace());
    for(let index=offset;index<Math.min(roundCount,offset+25);index++){
      assert(!interrupted, 'Interrupted before starting another sample pair');
      await waitPair(...active.map((entry,slot)=>stopSample(entry,index*2+slot)));
      if((index+1)%5===0) console.log(`Completed ${samples.length}/${roundCount*2} samples`);
    }
    await waitPair(...active.map(stillHealthy));
    const closed=await waitPair(...active.map(entry=>api(lease(entry)+'/close',{})));
    assert(closed.every(response=>response.status===200&&response.body.closed));
  }
} catch(error) {
  await record({kind:'error',message:error.message,cases:error.errors?.map(value=>value.message)});
  process.exitCode=1;
} finally {
  try {
    await companion?.close();
    for(const id of usedIds) {
      for(const kind of ['container','volume']){
        const {stdout}=await runDocker('docker',[kind,'ls',...(kind==='container'?['--all']:[]),'--quiet','--filter',`label=io.printform.coding.workspace=${id}`]);
        assert.equal(stdout.trim(),'');
      }
    }
    await record({kind:'cleanup',ownedWorkspaces:usedIds.size,remainingResources:0});
  } catch(error) {
    await record({kind:'cleanup-error',message:error.message});
    process.exitCode=1;
  } finally {
    await originHarness?.close();
    await browser?.close();
    lines.close();
    events.kill();
  }
  const processTimes = samples.map(sample=>sample.processGoneMs).filter(Number.isFinite);
  const summary = {
    kind:'summary',completed:samples.length,expected:roundCount*2,
    statusP95Ms:p95(samples.map(sample=>sample.statusMs)),
    completedStatusP95Ms:p95(samples.map(sample=>sample.completedStatusMs)),
    stopP95Ms:p95(samples.map(sample=>sample.stopMs)),
    processP95Ms:p95(processTimes),processMaxMs:processTimes.length ? Math.max(...processTimes) : null,
    missingDeath:samples.length-processTimes.length
  };
  await record(summary);
  console.log(JSON.stringify(summary));
}
