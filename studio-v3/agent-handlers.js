import { safeRunDiagnostics } from './ai-inspection.js';
import { fail } from './ai-edits.js';
import { capabilityCatalog } from './agent-registry.js';
import { readSkill } from './agent-knowledge.js';

export const reply = (value,extra = {}) => ({content:[{type:'text',text:typeof value === 'string' ? value : JSON.stringify(value)}],details:{},...extra});
// Trusted, compiled handlers keyed by tool name. A feature adds its handler here next to its registry descriptor;
// a descriptor alone never grants an effect. `run` is the per-run state built by createAgentTools.
export const TOOL_HANDLERS = Object.freeze({
  get_capabilities:async (_args,run) => reply(capabilityCatalog({identity:run.identity,limits:run.limits,tools:run.definitions})),
  read_skill:async ({id},run) => reply({...readSkill(id),identity:run.identity}),
  get_context:async (_args,run) => reply(run.context(run.draft.project,{identity:run.identity,limits:run.limits})),
  apply_operations:async ({summary,operations},run) => {
    const step = run.draft.apply(summary,operations), n = step.diff.length;
    run.memory.addStep(summary,n);
    return reply(`Applied. ${n} changes in this step, ${run.draft.count} steps in the draft.`,{details:{detail:`${n} change${n === 1 ? '' : 's'}`}});
  },
  inspect_draft:async (_args,run) => {
    if (!run.inspect) return reply('Inspection is not available in this run.');
    const result = safeRunDiagnostics(await run.inspect({candidate:run.draft.project}),run.draft.project);
    run.signal.throwIfAborted();
    run.inspected = {candidate:run.draft.project,diagnostics:result};
    return reply(result,{details:{detail:result.ready ? 'ready' : `${result.errors.length + result.issues.length} issues`}});
  },
  undo_step:async (_args,run) => {
    if (!run.draft.undo()) return reply('There is nothing to undo.');
    run.memory.dropStep(); return reply(`Removed. ${run.draft.count} steps remain.`);
  },
  take_notes:async ({notes},run) => { run.memory.note(notes); return reply('Noted.',{details:{detail:'saved'}}); },
  finish:async ({summary},run) => {
    const proposal = run.draft.proposal(summary);
    const inspection = run.inspected?.candidate === run.draft.project ? run.inspected.diagnostics : undefined;
    if (!inspection) throw fail('AGENT_INSPECTION_REQUIRED');
    if (!inspection.ready) throw fail('AGENT_INSPECTION_BLOCKED');
    run.outcome.proposal = {...proposal,inspection,identity:run.identity};
    return reply('Done. The person reviews and applies it.',{terminate:true});
  },
  report_blocked:async ({reason},run) => { run.outcome.blocked = {code:'AGENT_BLOCKED',reason}; return reply('Reported.',{terminate:true}); }
});
