import { AgentHarness, MemorySessionRepo, BACKGROUND_CONTEXT, withAbortSignal } from '@earendil-works/pi-agent-core';
import { CHAT_PROMPT } from './ai-chat-protocol.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { createDraft } from './agent-draft.js';
import { createAgentTools, AGENT_TOOL_NAMES } from './agent-tools.js';
import { fail } from './ai-edits.js';

// The printform.js authoring rules are the ones the single-step flow already sends; only the output format differs.
const RULES = CHAT_PROMPT.slice(CHAT_PROMPT.indexOf('The global color is the brand accent'));
export const AGENT_PROMPT = `You are a Printform framework-native authoring agent working on a private DRAFT copy of the form, using tools instead of a JSON reply. Nothing you do reaches the live form: a person previews and applies what you finish.
Start with get_context. Change the draft with apply_operations (at most 24 typed operations per call; it takes the operations described below, not an envelope). After structural changes call inspect_draft and fix what it reports. Retract a step with undo_step. When the request is met and the inspection is ready, call finish with a short summary. If the request cannot be met with the supported operations, call report_blocked and say why. Follow the printform.js standard below exactly; never emit HTML, CSS or script. Tools: ${AGENT_TOOL_NAMES.join(', ')}.
${RULES}`;

// Runs one authoring task as a tool loop on a draft. Resolves to a proposal shaped like the single-step flow's, so
// the existing Preview / Apply / Undo takes it unchanged; rejects with a coded error otherwise.
export async function runAgentLoop({models,model,project,request,scope = {mode:'whole'},references = [],context,inspect,signal,failure = () => null,onStep = () => {},limits = DEMO_CONFIG.agent,systemPrompt = AGENT_PROMPT}) {
  signal.throwIfAborted();
  const draft = createDraft(project,{scope,request,references}), outcome = {}, deadline = AbortSignal.timeout(limits.maxRunMs), stop = AbortSignal.any([signal,deadline]);
  const tools = createAgentTools({draft,context:current=>context(current),inspect,signal:stop,outcome,limits,onStep});
  const ctx = withAbortSignal(stop,BACKGROUND_CONTEXT);
  const session = await new MemorySessionRepo().create({},ctx);
  const {harness} = await AgentHarness.create({session,models,model,tools,activeToolNames:tools.map(item=>item.name),systemPrompt,toolExecution:'sequential',retry:{enabled:false,maxRetries:0,baseDelayMs:0}},ctx);
  try {
    const lane = await harness.lane('agent',ctx), onAbort = () => { void lane.abort(BACKGROUND_CONTEXT); };
    stop.addEventListener('abort',onAbort,{once:true});
    try { await lane.prompt(request,ctx); }
    catch (error) { if (deadline.aborted && !signal.aborted) throw fail('AGENT_TIMEOUT'); throw error; }
    finally { stop.removeEventListener('abort',onAbort); }
    signal.throwIfAborted();
    if (deadline.aborted) throw fail('AGENT_TIMEOUT');
    if (failure()) throw failure();
    if (outcome.proposal) return {...outcome.proposal,turns:outcome.turns,iterations:outcome.turns,steps:draft.count};
    if (outcome.blocked) throw Object.assign(fail(outcome.blocked.code),outcome.blocked.reason ? {reason:outcome.blocked.reason} : {});
    throw fail('AI_RUN_FAILED');
  } finally { await harness.close(BACKGROUND_CONTEXT); }
}
