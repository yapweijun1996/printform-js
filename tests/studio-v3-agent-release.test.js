import {describe,it,expect,vi} from 'vitest';
import {verifyAgentRelease} from '../studio-v3/agent-release.js';
import {runAgentLoop} from '../studio-v3/agent-loop.js';
import {newProject} from '../studio-v3/model.js';

const expected={release:'a'.repeat(40),contractHash:'b'.repeat(64),knowledgeHash:'c'.repeat(64),packageHash:'d'.repeat(64)};
const base=`./releases/${expected.release}/`;
const response = manifest=>({ok:true,text:async()=>JSON.stringify(manifest)});
describe('release identity handshake',()=> {
  it('pins one verified release and fetches only its immutable local manifest',async()=> {
    const fetcher=vi.fn(async()=>response({version:1,...expected}));
    const identity=await verifyAgentRelease({expected,base,fetcher});
    expect(identity).toEqual({...expected,verified:true});expect(Object.isFrozen(identity)).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe(`${base}agent/agent-manifest.json`);
  });
  it.each(['release','contractHash','knowledgeHash','packageHash'])('rejects %s drift',async key=> {
    await expect(verifyAgentRelease({expected,base,fetcher:async()=>response({version:1,...expected,[key]:'changed'})})).rejects.toMatchObject({code:'AGENT_RELEASE_MISMATCH'});
  });
  it('rejects mutable/latest or another release URL before fetching',async()=> {
    const fetcher=vi.fn();
    for(const prefix of ['../latest/','https://other.test/','./releases/local/'])await expect(verifyAgentRelease({expected,base:prefix,fetcher})).rejects.toMatchObject({code:'AGENT_RELEASE_MISMATCH'});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([()=>{throw new Error('offline');},()=>({ok:false}),()=>({ok:true,text:async()=>'{'}),()=>({ok:true,text:async()=>'x'.repeat(8193)})])('reports unavailable/malformed resources without returning an unverified fallback',async fetcher=> {
    await expect(verifyAgentRelease({expected,base,fetcher})).rejects.toMatchObject({code:'AGENT_KNOWLEDGE_UNAVAILABLE'});
  });
  it('preserves explicit cancellation',async()=> {
    const controller=new AbortController();controller.abort();const fetcher=vi.fn();
    await expect(verifyAgentRelease({expected,base,fetcher,signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(fetcher).not.toHaveBeenCalled();
  });
  it('blocks before creating a provider lane or changing source data on a failed handshake',async()=> {
    const project=newProject(),before=structuredClone(project),provider=vi.fn(),reason=Object.assign(new Error('mismatch'),{code:'AGENT_RELEASE_MISMATCH'});
    await expect(runAgentLoop({models:{getModel:provider},project,request:'Design',context:()=>'',signal:new AbortController().signal,verifyRelease:async()=>{throw reason;}})).rejects.toBe(reason);
    expect(provider).not.toHaveBeenCalled();expect(project).toEqual(before);
  });
});
