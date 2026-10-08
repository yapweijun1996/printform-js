import {describe,it,expect} from 'vitest';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {newProject} from '../studio-v3/model.js';

function setup() {
  const draft = createDraft(newProject()),outcome = {},steps = [];
  let ready = true;
  const tools = createAgentTools({draft,outcome,context:()=>'',inspect:async()=>({report:{status:ready ? 'ready' : 'blocked'}}),
    signal:new AbortController().signal,limits:{maxTurns:100,maxRepeatedFailures:5},onStep:step=>steps.push(step)});
  const execute = (name,args={})=>tools.find(tool=>tool.name === name).execute(name,args);
  const edit = color=>execute('apply_operations',{summary:'Recolour',operations:[{type:'set_style',patch:{color}}]});
  return {draft,outcome,steps,execute,edit,blocked:()=> { ready=false; },ready:()=> { ready=true; }};
}

describe('finish inspection gate',()=> {
  it.each(['missing','stale','blocked','undo'])('rejects a %s inspection, then allows a freshly inspected draft',async mode=> {
    const run = setup(); await run.edit('#163a65');
    if (mode === 'blocked') run.blocked();
    if (mode !== 'missing') await run.execute('inspect_draft');
    if (mode === 'stale') await run.edit('#a82938');
    if (mode === 'undo') { await run.edit('#a82938'); await run.execute('inspect_draft'); await run.execute('undo_step'); }
    await expect(run.execute('finish',{summary:'Done'})).rejects.toMatchObject({code:mode === 'blocked' ? 'AGENT_INSPECTION_BLOCKED' : 'AGENT_INSPECTION_REQUIRED'});
    expect(run.outcome.proposal).toBeUndefined(); expect(run.steps.at(-1).ok).toBe(false);
    run.ready(); await run.execute('inspect_draft');
    expect(await run.execute('finish',{summary:'Done'})).toMatchObject({terminate:true});
    expect(run.outcome.proposal.inspection.ready).toBe(true);
  });
});
