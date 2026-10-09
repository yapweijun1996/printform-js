import { validateToolArguments } from '@earendil-works/pi-ai';
import { safeRunDiagnostics } from './ai-inspection.js';
import { createAgentMemory } from './agent-memory.js';
import { fail } from './ai-edits.js';
import { AGENT_TOOL_DEFINITIONS, capabilityCatalog } from './agent-registry.js';
import { readSkill } from './agent-knowledge.js';
export { AGENT_TOOL_NAMES } from './agent-registry.js';

const reply = (value,extra = {}) => ({content:[{type:'text',text:typeof value === 'string' ? value : JSON.stringify(value)}],details:{},...extra});
// Registry metadata owns the model-visible contract; these closures own runtime effects and validation.
export function createAgentTools({draft,context,inspect,signal,outcome,limits,identity,stopRun=()=>{},memory = createAgentMemory(),onStep = () => {}}) {
  const run = {calls:0,failure:'',repeats:0,inspected:null};
  const begin = name => {
    signal.throwIfAborted(); outcome.turns = ++run.calls;
    if (run.calls > limits.maxTurns) {
      outcome.blocked = {code:'AGENT_BUDGET'}; onStep({name,ok:false,code:'AGENT_BUDGET'}); stopRun(); throw fail('AGENT_BUDGET');
    }
  };
  const rejected = (name,args,error) => {
    if (signal.aborted) throw error;
    const code = error.code || 'TOOL_FAILED', signature = `${name}:${code}:${JSON.stringify(args)}`;
    run.repeats = signature === run.failure ? run.repeats + 1 : 1; run.failure = signature;
    onStep({name,ok:false,code});
    if (run.repeats >= limits.maxRepeatedFailures) { outcome.blocked = {code:'AGENT_STALLED'}; stopRun(); throw fail('AGENT_STALLED'); }
    throw Object.assign(new Error(`${code}. Correct the step and try again, or call undo_step.`),{code});
  };
  const handlers = {
    get_capabilities:async () => reply(capabilityCatalog({identity,limits})),
    read_skill:async ({id}) => reply({...readSkill(id),identity}),
    get_context:async () => reply(context(draft.project,{identity,limits})),
    apply_operations:async ({summary,operations}) => {
      const step = draft.apply(summary,operations), n = step.diff.length;
      memory.addStep(summary,n);
      return reply(`Applied. ${n} changes in this step, ${draft.count} steps in the draft.`,{details:{detail:`${n} change${n === 1 ? '' : 's'}`}});
    },
    inspect_draft:async () => {
      if (!inspect) return reply('Inspection is not available in this run.');
      const result = safeRunDiagnostics(await inspect({candidate:draft.project}),draft.project);
      signal.throwIfAborted();
      run.inspected = {candidate:draft.project,diagnostics:result};
      return reply(result,{details:{detail:result.ready ? 'ready' : `${result.errors.length + result.issues.length} issues`}});
    },
    undo_step:async () => {
      if (!draft.undo()) return reply('There is nothing to undo.');
      memory.dropStep(); return reply(`Removed. ${draft.count} steps remain.`);
    },
    take_notes:async ({notes}) => { memory.note(notes); return reply('Noted.',{details:{detail:'saved'}}); },
    finish:async ({summary}) => {
      const proposal = draft.proposal(summary);
      const inspection = run.inspected?.candidate === draft.project ? run.inspected.diagnostics : undefined;
      if (!inspection) throw fail('AGENT_INSPECTION_REQUIRED');
      if (!inspection.ready) throw fail('AGENT_INSPECTION_BLOCKED');
      outcome.proposal = {...proposal,inspection,identity};
      return reply('Done. The person reviews and applies it.',{terminate:true});
    },
    report_blocked:async ({reason}) => { outcome.blocked = {code:'AGENT_BLOCKED',reason}; return reply('Reported.',{terminate:true}); }
  };
  if (AGENT_TOOL_DEFINITIONS.length !== Object.keys(handlers).length || AGENT_TOOL_DEFINITIONS.some(({name})=>!handlers[name])) throw fail('AGENT_REGISTRY_INVALID');
  return AGENT_TOOL_DEFINITIONS.map(definition=> {
    const {name,description,parameters} = definition;
    let prepared = false;
    return {name,label:name,description,parameters,replay:'never',
      prepareArguments:args=> {
        prepared = false; begin(name);
        try {
          const validated = validateToolArguments(definition,{name,id:'schema-check',arguments:args});
          // Pi may coerce primitives or optional nulls; the product accepts only the raw declared types.
          if (JSON.stringify(validated) !== JSON.stringify(args)) throw new Error();
          prepared = true; return args;
        } catch { return rejected(name,args,fail('AGENT_ARGUMENTS_INVALID')); }
      },
      execute:async (_id,args) => {
        if (!prepared) begin(name); prepared = false;
        try {
          const result = await handlers[name](args || {});
          run.failure = ''; run.repeats = 0; onStep({name,ok:true,detail:result.details?.detail}); return result;
        } catch (error) { return rejected(name,args,error); }
      }
    };
  });
}
