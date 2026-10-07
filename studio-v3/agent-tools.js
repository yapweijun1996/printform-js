import { Type } from '@earendil-works/pi-ai';
import { safeRunDiagnostics } from './ai-inspection.js';

const reply = (value,extra = {}) => ({content:[{type:'text',text:typeof value === 'string' ? value : JSON.stringify(value)}],details:{},...extra});
const tool = (name,description,parameters,execute) => ({name,label:name,description,replay:'never',parameters,execute});
const SUMMARY = Type.String({minLength:1,maxLength:500});

// The tools of an authoring run. They work on the draft only. A tool that fails throws: the model then sees the error
// code and can repair the step. The run budget and the repeated-failure guard live here so no tool can bypass them.
export function createAgentTools({draft,context,inspect,signal,outcome,limits,onStep = () => {}}) {
  const run = {calls:0,failure:'',repeats:0};
  const guarded = (name,work) => async (_id,args) => {
    signal.throwIfAborted();
    outcome.turns = ++run.calls;
    if (run.calls > limits.maxTurns) { outcome.blocked = {code:'AGENT_BUDGET'}; onStep({name,ok:false,code:'AGENT_BUDGET'}); return reply('The step budget is used up. Stop.',{terminate:true}); }
    try {
      const result = await work(args || {});
      run.failure = ''; run.repeats = 0; onStep({name,ok:true});
      return result;
    } catch (error) {
      if (signal.aborted) throw error;
      const code = error.code || 'TOOL_FAILED', signature = `${name}:${code}:${JSON.stringify(args)}`;
      run.repeats = signature === run.failure ? run.repeats + 1 : 1; run.failure = signature;
      onStep({name,ok:false,code});
      if (run.repeats >= limits.maxRepeatedFailures) { outcome.blocked = {code:'AGENT_STALLED'}; return reply(`Stopped: ${code} keeps repeating.`,{terminate:true}); }
      throw Object.assign(new Error(`${code}. Correct the step and try again, or call undo_step.`),{code});
    }
  };
  return [
    tool('get_context','Read the form structure, binding catalog, authoring targets and the request. Call this first.',Type.Object({}),
      guarded('get_context',async () => reply(context(draft.project)))),
    tool('apply_operations','Apply typed operations to the draft. Combine all properties of one target in one patch.',
      Type.Object({summary:SUMMARY,operations:Type.Array(Type.Record(Type.String(),Type.Any()),{minItems:1,maxItems:24})}),
      guarded('apply_operations',async ({summary,operations}) => { const step = draft.apply(summary,operations); return reply(`Applied. ${step.diff.length} changes in this step, ${draft.count} steps in the draft.`); })),
    tool('inspect_draft','Render the draft in a real print preview and report pagination, overflow and quality issues.',Type.Object({}),
      guarded('inspect_draft',async () => {
        if (!inspect) return reply('Inspection is not available in this run.');
        const result = safeRunDiagnostics(await inspect({candidate:draft.project}),draft.project);
        signal.throwIfAborted();
        return reply(result);
      })),
    tool('undo_step','Remove the last applied step from the draft.',Type.Object({}),
      guarded('undo_step',async () => reply(draft.undo() ? `Removed. ${draft.count} steps remain.` : 'There is nothing to undo.'))),
    tool('finish','Hand the draft to the person for preview. Only when the request is met and the inspection is ready.',Type.Object({summary:SUMMARY}),
      guarded('finish',async ({summary}) => { outcome.proposal = draft.proposal(summary); return reply('Done. The person reviews and applies it.',{terminate:true}); })),
    tool('report_blocked','Stop because the request cannot be met with the supported operations. Say why.',Type.Object({reason:SUMMARY}),
      guarded('report_blocked',async ({reason}) => { outcome.blocked = {code:'AGENT_BLOCKED',reason}; return reply('Reported.',{terminate:true}); }))
  ];
}
export const AGENT_TOOL_NAMES = Object.freeze(['get_context','apply_operations','inspect_draft','undo_step','finish','report_blocked']);
