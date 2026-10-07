import { chatRequest } from './ai-chat-protocol.js';
import { createGatewayModel } from './agent-provider.js';
import { runAgentLoop } from './agent-loop.js';

// One authoring run for the panel: the tool loop over the Demo gateway, on a copy of the form. The result has the
// shape of a single-step proposal, so Preview / Apply / Undo take it unchanged.
export async function runPanelAgent({transport,alias,payload,project,signal,assertContext,inspectCandidate,onPhase,onStep}) {
  const provider = createGatewayModel({transport,alias,signal,assertContext,onPhase});
  const result = await runAgentLoop({...provider,project,request:payload.request,scope:payload.scope,references:payload.references,
    context:current=>chatRequest(current,payload),inspect:inspectCandidate,signal,onStep});
  return {...result,mode:'steps',usage:provider.usage()};
}
