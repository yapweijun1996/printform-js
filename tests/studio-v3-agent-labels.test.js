import {afterEach,describe,expect,it} from 'vitest';
import {stepLabel} from '../studio-v3/agent-step-labels.js';
import {agentEnabled,setAgentEnabled,AGENT_KEY} from '../studio-v3/agent-preference.js';

afterEach(()=> localStorage.clear());
describe('step labels',()=> {
  it('say what a step did, with its detail',()=> {
    expect(stepLabel({name:'get_context',ok:true})).toBe('Read the form'); expect(stepLabel({name:'take_notes',ok:true})).toBe('Made a note');
    expect(stepLabel({name:'apply_operations',ok:true,detail:'4 changes'})).toBe('Changed the draft · 4 changes');
    expect(stepLabel({name:'inspect_draft',ok:true,detail:'ready'})).toBe('Checked the print preview · ready');
  });
  it('show a rejected step as rejected, without its internal code',()=> {
    const text = stepLabel({name:'apply_operations',ok:false,code:'UNSAFE_PROPOSAL'});
    expect(text).toBe('Changed the draft · rejected, trying again'); expect(text).not.toContain('UNSAFE');
  });
  it('do not break on a tool they do not know',()=> expect(stepLabel({name:'something_new',ok:true})).toBe('Worked on the draft'));
});
describe('the work-in-steps setting',()=> {
  it('is on by default and when storage cannot be read',()=> {
    expect(agentEnabled()).toBe(true);
    expect(agentEnabled({getItem(){ throw new Error('blocked'); }})).toBe(true);
  });
  it('remembers being turned off, and on again',()=> {
    setAgentEnabled(false); expect(localStorage.getItem(AGENT_KEY)).toBe('off'); expect(agentEnabled()).toBe(false);
    setAgentEnabled(true); expect(agentEnabled()).toBe(true);
  });
  it('does not throw when storage cannot be written',()=> expect(()=>setAgentEnabled(false,{setItem(){ throw new Error('blocked'); }})).not.toThrow());
});
