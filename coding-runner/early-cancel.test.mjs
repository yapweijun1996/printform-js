// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {expect,it,vi} from 'vitest';
import {DockerBroker} from './docker.mjs';
import {Workspaces} from './workspaces.mjs';
import {LABEL,LIMITS,sha,treeDigest} from './policy.mjs';

const fakeDocker = vi.hoisted(()=>({spawn:vi.fn()}));
vi.mock('node:child_process',()=>({spawn:fakeDocker.spawn}));

const image = `sha256:${'a'.repeat(64)}`;
const tree = content => {
  const entries = [{path:'notes.txt',type:'file',mode:0o644,bytes:Buffer.byteLength(content),digest:sha(content),content}];
  return {entries,treeDigest:treeDigest(entries)};
};
function createdOnlyFixture({removeFails=false}={}) {
  const create = Promise.withResolvers();
  fakeDocker.spawn.mockReset().mockImplementation((_binary,args)=> {
    const child = Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),stdin:new PassThrough(),kill:vi.fn()});
    const complete = (code,stdout='')=>queueMicrotask(()=> {
      child.stdout.write(stdout);
      child.emit('close',code,null);
    });
    const [kind,action] = args;
    if (kind === 'container' && action === 'create') {
      expect(args[args.indexOf('--name')+1]).toMatch(/^pf-run-/);
      void create.promise.then(()=>complete(0));
    } else if (kind === 'container' && action === 'inspect') {
      complete(0,JSON.stringify([{State:{Status:'created',Running:false},Config:{Labels:{
        [`${LABEL}.managed`]:'true', [`${LABEL}.owner`]:broker.owner
      }}}]));
    } else if (kind === 'container' && action === 'rm') {
      complete(removeFails ? 1 : 0);
    } else {
      throw new Error(`Unexpected Docker operation: ${kind} ${action}`);
    }
    return child;
  });
  const broker=new DockerBroker('fixture',LIMITS);
  broker.imageDigest=image;
  vi.spyOn(broker,'createWorkspace').mockResolvedValue(tree('before'));
  vi.spyOn(broker,'helper');
  return {broker,create};
}

it.each([false,true])('does not start a command or helper when Stop wins during Docker create, removeFails=%s',async(removeFails)=>{
  const {broker,create}=createdOnlyFixture({removeFails});
  const workspaces=new Workspaces(broker,LIMITS), owner=randomUUID();
  const workspace=await workspaces.create(owner,{
    files:[{path:'notes.txt',content:'before'}],
    releaseIdentity:{release:'fixture',contractHash:'fixture',knowledgeHash:'fixture',packageHash:'fixture'},
    documentId:'test-form',baseRevision:0,runId:randomUUID()
  });
  const admission=workspaces.accept(owner,workspace.id,{operation:'run',expectedRevision:0,args:{command:'printf example'}});
  await vi.waitFor(()=>expect(fakeDocker.spawn).toHaveBeenCalledOnce());
  const stopped=workspaces.cancel(owner,workspace.id);
  const checkStop=removeFails
    ? expect(stopped).rejects.toThrow('WORKSPACE_QUARANTINED')
    : expect(stopped).resolves.toMatchObject({cancelled:true,processesRemoved:true,revision:0,treeDigest:workspace.treeDigest});
  create.resolve();
  await checkStop;
  const receipt=await workspaces.status(owner,workspace.id,admission.callId,true);
  if(removeFails) {
    expect(receipt).toMatchObject({effectUnknown:true,afterRevision:null,afterDigest:null,error:{code:'DOCKER_OPERATION_FAILED'}});
  } else {
    expect(receipt).toMatchObject({started:false,afterRevision:0,afterDigest:workspace.treeDigest,changes:[],error:{code:'CANCELLED'}});
  }
  const actions=fakeDocker.spawn.mock.calls.map(([,args])=>args[1]);
  expect(actions).toEqual(['create','inspect','rm']);
  expect(broker.helper).not.toHaveBeenCalled();
});
