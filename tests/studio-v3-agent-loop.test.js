import {describe,it,expect} from 'vitest';
import {createModels,fauxProvider,fauxAssistantMessage,fauxToolCall} from '@earendil-works/pi-ai';
import {newProject,designOf} from '../studio-v3/model.js';
import {runAgentLoop,AGENT_PROMPT} from '../studio-v3/agent-loop.js';
import {createAgentMemory} from '../studio-v3/agent-memory.js';

const note = {type:'add_field',section:'footer',field:{id:'note-two',label:'Extra note',kind:'static',text:'Authored note'}};
const badStep = {type:'set_field',target:'nowhere',patch:{width:10}};
const call = (name,args,id) => fauxAssistantMessage([fauxToolCall(name,args,{id:id || `${name}-${Math.random()}`})],{stopReason:'toolUse'});
const ready = {report:{status:'ready',metrics:{logicalPages:1}}};
function setup(responses) {
  const faux = fauxProvider({provider:'agent-faux',models:[{id:'agent-faux'}],tokenSize:{min:3,max:3}});
  faux.setResponses(responses);
  const models = createModels(); models.setProvider(faux.provider);
  return {models,model:faux.getModel(),faux};
}
const run = (responses,over = {}) => {
  const {models,model,faux} = setup(responses), steps = [], project = over.project || newProject();
  const promise = runAgentLoop({models,model,project,request:'Tidy the footer of this form.',scope:{mode:'whole'},context:()=>'{"context":true}',inspect:async()=>ready,
    signal:over.signal || new AbortController().signal,onStep:step=>{steps.push(step); over.onStep?.(step);},limits:over.limits,...over.options});
  return {promise,steps,faux,project};
};
const reason = async promise => { try { await promise; } catch (error) { return error; } return null; };

describe('the agent loop',()=> {
  it('works in several steps, repairs a rejected step, inspects, and finishes with one proposal',async()=> {
    let seenError = '';
    const {promise,steps,faux,project} = run([
      call('get_context',{}),
      call('apply_operations',{summary:'Add a note',operations:[note]}),
      call('apply_operations',{summary:'Fix the heading',operations:[badStep]}),
      (context)=> {
        const last = context.messages.at(-1); seenError = JSON.stringify(last);
        return call('apply_operations',{summary:'Recolour',operations:[{type:'set_style',patch:{color:'#163a65'}}]});
      },
      call('inspect_draft',{}),
      call('finish',{summary:'Added a footer note and recoloured the form'})
    ]);
    const before = structuredClone(project), result = await promise;
    expect(result.kind).toBe('proposal'); expect(result.summary).toBe('Added a footer note and recoloured the form');
    expect(result.diff.length).toBeGreaterThan(0); expect(result.turns).toBe(6); expect(faux.state.callCount).toBe(6);
    expect(seenError).toContain('UNSAFE_PROPOSAL'); expect(seenError).toMatch(/isError|"isError":true/);
    expect(steps.map(step=>[step.name,step.ok])).toEqual([['get_context',true],['apply_operations',true],['apply_operations',false],['apply_operations',true],['inspect_draft',true],['finish',true]]);
    expect(project).toEqual(before); expect(designOf(result.candidate).footer.some(field=>field.id === 'note-two')).toBe(true);
  });

  it('stops when the turn budget is used up',async()=> {
    const {promise} = run(Array.from({length:10},()=>call('get_context',{})),{limits:{maxTurns:3,maxRepeatedFailures:5,maxRunMs:60000}});
    expect((await reason(promise)).code).toBe('AGENT_BUDGET');
  });

  it('stops when the same failure keeps coming back',async()=> {
    const {promise} = run(Array.from({length:10},()=>call('apply_operations',{summary:'Again',operations:[badStep]})),{limits:{maxTurns:100,maxRepeatedFailures:3,maxRunMs:60000}});
    expect((await reason(promise)).code).toBe('AGENT_STALLED');
  });

  it('stops at once when the caller stops it',async()=> {
    const controller = new AbortController();
    const {promise,faux,steps} = run(Array.from({length:10},()=>call("get_context",{})),{signal:controller.signal,onStep:()=>controller.abort()});
    expect((await reason(promise)).name).toBe('AbortError'); expect(faux.state.callCount).toBeLessThan(10); expect(steps).toHaveLength(1);
  });

  it('stops a run that takes too long, even while a slow inspection is under way',async()=> {
    const slow = () => new Promise(resolve=>setTimeout(()=>resolve(ready),300));
    const {promise} = run([call('inspect_draft',{}),call('get_context',{})],{limits:{maxTurns:100,maxRepeatedFailures:5,maxRunMs:40},options:{inspect:slow}});
    expect((await reason(promise)).code).toBe('AGENT_TIMEOUT');
  });

  it('refuses to finish without any change, and reports a block when the request cannot be met',async()=> {
    const {promise,steps} = run([call('finish',{summary:'Nothing'}),call('report_blocked',{reason:'The form has no such section.'})]);
    const error = await reason(promise);
    expect(error.code).toBe('AGENT_BLOCKED'); expect(error.reason).toBe('The form has no such section.');
    expect(steps[0]).toMatchObject({name:'finish',ok:false,code:'NO_CHANGES'});
  });

  it('fails when the model ends without a result',async()=> {
    const {promise} = run([fauxAssistantMessage('I am done.',{stopReason:'stop'})]);
    expect((await reason(promise)).code).toBe('AI_RUN_FAILED');
  });
});

describe('what a finished run reports',()=> {
  it('carries the inspection only when the final draft is the one that was inspected',async()=> {
    const inspected = await run([call('apply_operations',{summary:'Add a note',operations:[note]}),call('inspect_draft',{}),call('finish',{summary:'Added a note'})]).promise;
    expect(inspected.inspection).toMatchObject({ready:true}); expect(inspected.iterations).toBe(3);
    const stale = await run([call('inspect_draft',{}),call('apply_operations',{summary:'Add a note',operations:[note]}),call('finish',{summary:'Added a note'})]).promise;
    expect(stale.inspection).toBeUndefined();
    const undone = await run([call('apply_operations',{summary:'Add a note',operations:[note]}),call('inspect_draft',{}),call('undo_step',{}),call('apply_operations',{summary:'Add it again',operations:[note]}),call('finish',{summary:'Added a note'})]).promise;
    expect(undone.inspection).toBeUndefined();
  });

  it('tells each step what it did, so a timeline can show it',async()=> {
    const {promise,steps} = run([call('get_context',{}),call('apply_operations',{summary:'Add a note',operations:[note]}),call('inspect_draft',{}),call('finish',{summary:'Added a note'})]);
    await promise;
    expect(steps.map(step=>step.detail)).toEqual([undefined,expect.stringMatching(/^\d+ changes?$/),'ready',undefined]);
  });
});

describe('what the run remembers',()=> {
  it('keeps the latest notes and the steps still in the draft',async()=> {
    const memory = createAgentMemory();
    await run([call('take_notes',{notes:'Footer needs a note.'}),call('apply_operations',{summary:'Add a note',operations:[note]}),call('apply_operations',{summary:'Recolour',operations:[{type:'set_style',patch:{color:'#163a65'}}]}),call('undo_step',{}),call('finish',{summary:'Added a note'})],{options:{memory}}).promise;
    expect(memory.notes).toBe('Footer needs a note.'); expect(memory.steps).toEqual([{summary:'Add a note',changes:expect.any(Number)}]);
  });
});

describe('the agent prompt',()=> {
  it('keeps the printform.js authoring rules, and no longer asks for a JSON envelope',()=> {
    for (const needle of ['set_field','set_table_style','rowBackground','stable field ID','at most 24']) expect(AGENT_PROMPT).toContain(needle);
    expect(AGENT_PROMPT).not.toContain('Return ONE JSON object');
    for (const tool of ['get_context','apply_operations','inspect_draft','undo_step','take_notes','finish','report_blocked']) expect(AGENT_PROMPT).toContain(tool);
  });
});
