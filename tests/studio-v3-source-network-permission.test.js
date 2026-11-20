import { afterEach, expect, it, vi } from 'vitest';
import { pairSourceRunner } from '../studio-v3/source-workspace-client.js';
import { authorizeSourceWorkspace } from '../studio-v3/source-workspace-run.js';
import { errorMessage } from '../studio-v3/ai-messages.js';

const code = 'fictional-code-20261016';
const runnerSourceHash = 'a'.repeat(64);
const treeDigest = 'b'.repeat(64);
const imageDigest = 'sha256:'+'c'.repeat(64);
const identity = {release:'local',contractHash:'d',knowledgeHash:'e',packageHash:'f',sourceRunnerHash:runnerSourceHash};
const request = {identity,project:{manifest:{documentId:'fictional-network-test'}},baseRevision:0,runId:'network-test'};
const receipt = {callId:'call-1',status:'completed',beforeRevision:0,afterRevision:0,beforeDigest:treeDigest,afterDigest:treeDigest,imageDigest,changes:[]};
const json = value=>new Response(JSON.stringify(value));

function permission(query) {
  const listener = vi.fn(query);
  vi.stubGlobal('navigator',{permissions:{query:listener}});
  return listener;
}

function companion(onCall = ()=>{}) {
  const paths = [];
  const transport = vi.fn(async (url,{method})=> {
    const {pathname,search} = new URL(url);
    paths.push(`${method} ${pathname}${search}`);
    if (pathname === '/v1/pair') return json({protocol:'printform-coding-v1',profile:'local-docker-node24-source-json-v1',
      token:'fictional-source-token-for-permission-test',expiresAt:Date.now()+60_000,runnerSourceHash,responseBytes:1_048_576});
    if (pathname === '/v1/workspaces') return json({id:'workspace-1',revision:0,treeDigest,imageDigest});
    if (pathname.endsWith('/calls')) {
      onCall();
      return json({callId:'call-1',status:'running'});
    }
    if (pathname.endsWith('/calls/call-1')) return json(receipt);
    if (pathname.endsWith('/close')) return json({id:'workspace-1',closed:true});
    return json({});
  });
  return {paths,transport};
}

afterEach(()=>vi.unstubAllGlobals());

it('stops pairing before dispatch when loopback access is denied and gives a specific browser setting',async()=> {
  const query = permission(async ()=> ({state:'denied'}));
  const {transport} = companion();
  const denied = pairSourceRunner(code,{transport});
  await expect(denied).rejects.toMatchObject({code:'WORKSPACE_LOCAL_NETWORK_DENIED',admissionRejected:true});
  expect(errorMessage(await denied.catch(error=>error))).toMatch(/browser blocked loopback access.*site settings/i);
  expect(query.mock.calls).toEqual([[{name:'loopback-network'}]]);
  expect(transport).not.toHaveBeenCalled();
});

it.each(['prompt','granted'])('keeps the native request when the supported loopback descriptor reports %s',async state=> {
  const query = permission(async ({name})=> ({state:name === 'loopback-network' ? state : 'denied'}));
  const {paths,transport} = companion();
  await pairSourceRunner(code,{transport});
  expect(query.mock.calls).toEqual([[{name:'loopback-network'}]]);
  expect(paths).toEqual(['POST /v1/pair']);
});

it('checks the older descriptor when the loopback descriptor is unsupported',async()=> {
  const query = permission(async ({name})=> {
    if (name === 'loopback-network') throw new TypeError('Unsupported descriptor');
    return {state:'denied'};
  });
  const {transport} = companion();
  await expect(pairSourceRunner(code,{transport})).rejects.toMatchObject({code:'WORKSPACE_LOCAL_NETWORK_DENIED'});
  expect(query.mock.calls).toEqual([[{name:'loopback-network'}],[{name:'local-network-access'}]]);
  expect(transport).not.toHaveBeenCalled();
});

it.each(['missing API','unsupported descriptors','unexpected failure'])('uses native enforcement with %s',async mode=> {
  const query = mode === 'missing API' ? null : permission(async ()=> {
    if (mode === 'unexpected failure') throw new DOMException('Permissions unavailable','OperationError');
    throw new DOMException('Descriptor unavailable','NotSupportedError');
  });
  if (!query) vi.stubGlobal('navigator',{});
  const {paths,transport} = companion();
  await pairSourceRunner(code,{transport});
  expect(paths).toEqual(['POST /v1/pair']);
  if (query) expect(query.mock.calls).toEqual(mode === 'unexpected failure' ?
    [[{name:'loopback-network'}]] : [[{name:'loopback-network'}],[{name:'local-network-access'}]]);
});

it('cancels a pending permission query without dispatching a pairing request',async()=> {
  permission(()=>new Promise(()=>{}));
  const {transport} = companion();
  const controller = new AbortController();
  const pairing = pairSourceRunner(code,{transport,signal:controller.signal});
  controller.abort();
  await expect(pairing).rejects.toMatchObject({code:'CANCELLED',admissionRejected:true});
  expect(transport).not.toHaveBeenCalled();
});

it('blocks new workspace effects and preserves already-admitted status, cancel, close and revoke',async()=> {
  let state = 'granted';
  const query = permission(async ()=> ({state}));
  const {paths,transport} = companion(()=> { state = 'denied'; });
  const signal = new AbortController().signal;
  const connection = await pairSourceRunner(code,{transport});
  state = 'denied';
  const refused = authorizeSourceWorkspace(connection,{fictionalSource:true});
  await expect(refused.open(request,signal)).rejects.toMatchObject({code:'WORKSPACE_LOCAL_NETWORK_DENIED',admissionRejected:true});
  await refused.close();
  expect(paths).toEqual(['POST /v1/pair']);
  expect(connection.available).toBe(true);

  state = 'granted';
  const admitted = authorizeSourceWorkspace(connection,{fictionalSource:true});
  await admitted.open(request,signal);
  await expect(admitted.action('list',{},signal)).resolves.toEqual(receipt);
  expect(state).toBe('denied');
  await expect(admitted.action('list',{},signal)).rejects.toMatchObject({code:'WORKSPACE_LOCAL_NETWORK_DENIED',admissionRejected:true});
  expect(admitted.active).toBe(true);
  await connection.cancel('workspace-1');
  await admitted.close();
  await connection.revoke();
  expect(query).toHaveBeenCalledTimes(5);
  expect(paths).toEqual(['POST /v1/pair','POST /v1/workspaces','POST /v1/workspaces/workspace-1/calls',
    'GET /v1/workspaces/workspace-1/calls/call-1?wait=1','POST /v1/workspaces/workspace-1/cancel',
    'POST /v1/workspaces/workspace-1/close','POST /v1/revoke']);
});

it('refuses new wire effects if the connection begins revocation while awaiting permission',async()=> {
  let releasePermission, releaseRevoke;
  const query = permission(async ()=> ({state:'granted'}));
  const {paths,transport} = companion();
  const connection = await pairSourceRunner(code,{transport:async (url,options)=> {
    const response = await transport(url,options);
    if (url.endsWith('/v1/revoke')) await new Promise(resolve=> { releaseRevoke = resolve; });
    return response;
  }});
  query.mockImplementationOnce(()=>new Promise(resolve=> { releasePermission = resolve; }));
  const pending = connection.create({},[]);
  const revoking = connection.revoke();
  await vi.waitFor(()=>expect(releaseRevoke).toBeTypeOf('function'));
  try {
    expect(connection.available).toBe(true);
    releasePermission({state:'granted'});
    await expect(pending).rejects.toMatchObject({code:'WORKSPACE_AUTH_EXPIRED',admissionRejected:true});
    expect(paths).toEqual(['POST /v1/pair','POST /v1/revoke']);
  } finally { releaseRevoke(); }
  await revoking;
  expect(connection.available).toBe(false);
});

const oldRunnerSourceHash = 'e'.repeat(64);
function pairingFixture({healthHash = runnerSourceHash,pairedHash = runnerSourceHash,revoke} = {}) {
  const wire = [];
  const transport = vi.fn(async (url,options)=> {
    const path = new URL(url).pathname;
    wire.push({path,...options});
    if (path === '/health') return json({runnerSourceHash:healthHash});
    if (path === '/v1/pair') return json({protocol:'printform-coding-v1',profile:'local-docker-node24-source-json-v1',
      token:'fictional-source-token-for-permission-test',expiresAt:Date.now()+60_000,runnerSourceHash:pairedHash,responseBytes:1_048_576});
    if (path === '/v1/revoke') return revoke ? revoke() : json({revoked:true,workspacesClosed:true});
    throw new Error('Unexpected workspace request');
  });
  return {wire,transport,expectedRunnerSourceHash:runnerSourceHash};
}

it('stops the exact-release health check and pair request when permission is denied',async()=> {
  permission(async ()=> ({state:'denied'}));
  const {wire,...options} = pairingFixture();
  await expect(pairSourceRunner(code,options)).rejects.toMatchObject({code:'WORKSPACE_LOCAL_NETWORK_DENIED'});
  expect(wire).toEqual([]);
});

it('checks the installed runner without sending the code or receiving a token on mismatch',async()=> {
  permission(async ()=> ({state:'granted'}));
  const {wire,...options} = pairingFixture({healthHash:oldRunnerSourceHash});
  await expect(pairSourceRunner(code,options)).rejects.toMatchObject({code:'WORKSPACE_RUNTIME_MISMATCH'});
  expect(wire).toEqual([expect.objectContaining({path:'/health',method:'GET',credentials:'omit',redirect:'error'})]);
  expect(wire[0]).not.toHaveProperty('body');
  expect(wire[0]).not.toHaveProperty('headers');
});

it('uses one deadline and checks permission again before posting the one-use code',async()=> {
  const query = permission(async ()=> ({state:'granted'}));
  const {wire,...options} = pairingFixture();
  const connection = await pairSourceRunner(code,options);
  expect(connection.available).toBe(true);
  expect(wire.map(({path,method})=>[method,path])).toEqual([['GET','/health'],['POST','/v1/pair']]);
  expect(wire[0].signal).toBe(wire[1].signal);
  expect(query).toHaveBeenCalledTimes(2);
  query.mockResolvedValueOnce({state:'granted'}).mockResolvedValueOnce({state:'denied'});
  await expect(pairSourceRunner(code,options)).rejects.toMatchObject({code:'WORKSPACE_LOCAL_NETWORK_DENIED'});
  expect(wire.slice(2).map(({path})=>path)).toEqual(['/health']);
});

it.each([oldRunnerSourceHash,'invalid-hash'])('revokes a provisional pairing when the POST identity changes to %s',async pairedHash=> {
  const query = permission(async ()=> ({state:'granted'}));
  const {wire,...options} = pairingFixture({pairedHash});
  await expect(pairSourceRunner(code,options)).rejects.toMatchObject({code:'WORKSPACE_RUNTIME_MISMATCH'});
  expect(wire.map(({path,method})=>[method,path])).toEqual([['GET','/health'],['POST','/v1/pair'],['POST','/v1/revoke']]);
  expect(wire[2].headers.Authorization).toBe('Bearer fictional-source-token-for-permission-test');
  expect(query).toHaveBeenCalledTimes(2);
});

it.each([false,true])('reports an unconfirmed temporary pairing when revocation has transport failure %s',async transportFailure=> {
  permission(async ()=> ({state:'granted'}));
  const {wire,...options} = pairingFixture({pairedHash:oldRunnerSourceHash,revoke:async()=> {
    if (transportFailure) throw new TypeError('Connection dropped');
    return json({revoked:false,workspacesClosed:false});
  }});
  const pending = await pairSourceRunner(code,options).catch(error=>error);
  expect(pending).toMatchObject({code:'WORKSPACE_PAIRING_REVOKE_UNCONFIRMED'});
  expect(errorMessage(pending)).toMatch(/temporary pairing is unconfirmed.*Ordinary form editing remains available/);
  expect(wire.map(({path})=>path)).toEqual(['/health','/v1/pair','/v1/revoke']);
});

it.each([{}, {id:'workspace-1',closed:false}, {id:'different-workspace',closed:true}])('rejects an unconfirmed owned close receipt %j',async response=> {
  const {transport} = companion();
  const connection = await pairSourceRunner(code,{transport:(url,options)=>url.endsWith('/close') ?
    Promise.resolve(json(response)) : transport(url,options)});
  await expect(connection.close('workspace-1')).rejects.toMatchObject({code:'WORKSPACE_CLEANUP_FAILED'});
});

it.each([{}, {revoked:true,workspacesClosed:true}])('requires acknowledged cleanup when workspace admission lost its receipt %j',async receipt=> {
  const revoke = vi.fn(async()=>receipt);
  const connection = {available:true,runnerSourceHash,create:async()=> { throw new Error('Workspace create response unavailable'); },revoke};
  const workspace = authorizeSourceWorkspace(connection,{fictionalSource:true});
  await expect(workspace.open(request,new AbortController().signal)).rejects.toThrow('Workspace create response unavailable');
  if (receipt.revoked) await expect(workspace.close()).resolves.toBeUndefined();
  else await expect(workspace.close()).rejects.toMatchObject({code:'WORKSPACE_CLEANUP_FAILED'});
  expect(revoke).toHaveBeenCalledOnce();
});
