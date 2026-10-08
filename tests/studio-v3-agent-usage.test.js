import {describe,it,expect} from 'vitest';
import {createGatewayModel} from '../studio-v3/agent-provider.js';
import {runAgentLoop} from '../studio-v3/agent-loop.js';
import {newProject} from '../studio-v3/model.js';

async function run(usages,maxTokens=1) {
  let calls = 0;
  const signal = new AbortController().signal;
  const provider = createGatewayModel({alias:'demo-fast',signal,maxTokens,transport:{async agentTurn() {
    const usage = usages[calls++];
    return {usage,output:[{type:'function_call',call_id:`call-${calls}`,name:'get_context',arguments:'{}'}]};
  }}});
  let error;
  try { await runAgentLoop({...provider,project:newProject(),request:'Use navy',context:()=>'',signal,limits:{maxTurns:3,maxRepeatedFailures:5,maxRunMs:5000}}); }
  catch (failure) { error = failure; }
  return {calls,error,usage:provider.usage()};
}

describe('agent usage admission',()=> {
  it('derives a missing total and stops before the next request',async()=> {
    const result = await run([{prompt_tokens:100,completion_tokens:100}]);
    expect(result.calls).toBe(1); expect(result.error.code).toBe('AGENT_TOKEN_BUDGET');
    expect(result.usage).toEqual({input:100,output:100,total:200});
  });

  it('uses a valid total even when the individual counts are unavailable',async()=> {
    const result = await run([{total_tokens:100}]);
    expect(result.calls).toBe(1); expect(result.error.code).toBe('AGENT_TOKEN_BUDGET');
    expect(result.usage).toEqual({input:null,output:null,total:100});
  });

  it.each([undefined,{}, {prompt_tokens:10}, {prompt_tokens:-1,completion_tokens:1,total_tokens:0},
    {prompt_tokens:'10',completion_tokens:1,total_tokens:11}, {total_tokens:null}, {total_tokens:1.5},
    {prompt_tokens:10,completion_tokens:1,total_tokens:2}, {prompt_tokens:10,completion_tokens:1,total_tokens:20},
    {prompt_tokens:10,total_tokens:2}, {total_tokens:Infinity}, {total_tokens:Number.MAX_SAFE_INTEGER+1},
    {prompt_tokens:Number.MAX_SAFE_INTEGER,completion_tokens:1,total_tokens:Number.MAX_SAFE_INTEGER}])('stops on unavailable or inconsistent usage %j',async usage=> {
    const result = await run([usage],1000);
    expect(result.calls).toBe(1); expect(result.error.code).toBe('AGENT_USAGE_UNAVAILABLE');
    expect(result.usage.total).toBeNull();
  });

  it('marks cumulative usage unavailable when a later response omits it',async()=> {
    const result = await run([{prompt_tokens:10,completion_tokens:1,total_tokens:11},{}],1000);
    expect(result.calls).toBe(2); expect(result.error.code).toBe('AGENT_USAGE_UNAVAILABLE');
    expect(result.usage).toEqual({input:null,output:null,total:null});
  });
});
