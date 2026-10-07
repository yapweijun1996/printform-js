import {describe,it,expect} from 'vitest';
import {runGatewayProbe} from '../studio-v3/gateway-probe.js';
import {scriptedGateway,turn,fn,reasoning,message,json} from './support/agent-gateway.js';

const run = gateway => runGatewayProbe({transport:gateway.transport,signal:new AbortController().signal});
const byId = (report,id) => report.checks.find(check=>check.id === id);

describe('the gateway probe',()=> {
  it('passes when the gateway calls the right tool and accepts the replay',async()=> {
    const gateway = scriptedGateway({agent:[turn([reasoning(1),fn(1,'read_skill',{name:'layout'})]),turn([message('Done.')])]});
    const report = await run(gateway);
    expect(report.checks.map(check=>[check.id,check.ok])).toEqual([['models',true],['tool-call',true],['replay',true]]);
    expect(byId(report,'tool-call').detail).toMatch(/reasoning item: yes/);
    // The second request replays the call, its result and the encrypted reasoning, like a real run.
    const types = gateway.bodies[1].input.map(item=>item.type || item.role);
    expect(types).toEqual(expect.arrayContaining(['reasoning','function_call','function_call_output']));
    expect(JSON.stringify(gateway.bodies)).not.toMatch(/ACME|Sterling/);
  });
  it('fails the tool check, and stops, when the model answers without calling a tool',async()=> {
    const report = await run(scriptedGateway({agent:[turn([message('I will not call it.')])]}));
    expect(byId(report,'tool-call')).toMatchObject({ok:false});
    expect(byId(report,'replay')).toBeUndefined();
  });
  it('names a refusal of tools by its code and never reports a body',async()=> {
    const report = await run(scriptedGateway({agent:[json({error:{code:'DEMO_TOOLS_UNAVAILABLE',message:'secret-ish text'}},400)]}));
    const check = byId(report,'tool-call');
    expect(check.ok).toBe(false);
    expect(check.detail).toMatch(/DEMO_TOOLS_UNAVAILABLE/);
    expect(JSON.stringify(report)).not.toMatch(/secret-ish/);
  });
  it('fails the replay check when the gateway rejects the replayed conversation',async()=> {
    const report = await run(scriptedGateway({agent:[turn([reasoning(1),fn(1,'read_skill',{name:'layout'})]),json({error:{code:'bad'}},400)]}));
    expect(byId(report,'tool-call').ok).toBe(true);
    expect(byId(report,'replay')).toMatchObject({ok:false});
  });
});
