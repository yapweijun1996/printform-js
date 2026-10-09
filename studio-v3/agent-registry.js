import { Type } from '@earendil-works/pi-ai';
import { OPERATION_SCHEMAS } from './agent-operation-schemas.js';
import { MAX_AUTHORING_OPERATIONS } from './ai-authoring-contract.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { skillIndex } from './agent-knowledge.js';

const object = properties => Type.Object(properties,{additionalProperties:false});
const summary = Type.String({minLength:1,maxLength:500});
const definition = (name,description,parameters,effect,result) => Object.freeze({id:`printform.agent.${name}`,name,description,parameters,effect,result,skills:['form-authoring'],
  sources:['studio-v3/agent-tools.js','studio-v3/agent-registry.js'],evaluations:['tests/studio-v3-agent-registry.test.js','tests/studio-v3-agent-loop.test.js']});
export const AGENT_TOOL_DEFINITIONS = Object.freeze([
  definition('get_capabilities','Discover this release\'s tools, operation schemas, knowledge index and current run limits. Call this first.',object({}),'read','capability-catalog'),
  definition('read_skill','Read a bundled product guide by ID from the knowledge index before using its capabilities.',object({id:Type.String({minLength:1,maxLength:80})}),'read','skill-resource'),
  definition('get_context','Read the current form structure, binding catalog, authoring targets and request.',object({}),'read','semantic-context'),
  definition('apply_operations','Apply typed operations to the private draft. Combine all properties of one target in one patch.',object({summary,operations:Type.Array(Type.Union(Object.values(OPERATION_SCHEMAS)),{minItems:1,maxItems:MAX_AUTHORING_OPERATIONS})}),'draft','step-summary'),
  definition('inspect_draft','Render the draft in an isolated print preview; report pagination, overflow and quality issues.',object({}),'read','numeric-print-diagnostics'),
  definition('undo_step','Remove the last applied step from the private draft.',object({}),'draft','step-summary'),
  definition('take_notes','Replace your bounded run-local notes; they remain visible after older steps are folded.',object({notes:Type.String({minLength:1,maxLength:DEMO_CONFIG.agent.maxNoteChars})}),'memory','acknowledgment'),
  definition('finish','Hand an edited, currently inspected ready draft to the person for Preview and Apply.',object({summary}),'proposal','proposal-handoff'),
  definition('report_blocked','Stop with the specific missing capability or reason the request cannot be met.',object({reason:summary}),'stop','blocked-handoff')
]);
export const AGENT_TOOL_NAMES = Object.freeze(AGENT_TOOL_DEFINITIONS.map(tool=>tool.name));
export const OPERATION_CAPABILITIES = Object.freeze(Object.entries(OPERATION_SCHEMAS).map(([name,parameters])=>Object.freeze({id:`printform.authoring.${name}`,name,parameters,effect:'draft',result:'validated-design-diff',skills:['form-authoring'],
  sources:['studio-v3/ai-authoring.js','studio-v3/agent-operation-schemas.js','studio-v3/design-validation.js'],evaluations:['tests/studio-v3-ai-authoring.test.js','tests/studio-v3-agent-registry.test.js']})));
export function capabilityCatalog({identity={release:'development',verified:false},limits=DEMO_CONFIG.agent}={}) {
  return {version:1,identity,tools:AGENT_TOOL_DEFINITIONS,operations:OPERATION_CAPABILITIES,knowledge:skillIndex(),
    run:{mode:'steps',maxToolCalls:limits.maxTurns,maxRunMs:limits.maxRunMs,maxRunTokens:limits.maxRunTokens,maxRepeatedFailures:limits.maxRepeatedFailures,imageTurns:limits.imageTurns,maxNoteChars:limits.maxNoteChars},
    commit:'User Preview and Apply required',unsupported:['source/shell execution','new-project creation','asset import','dataset mutation','save/export/print','preview pixels']};
}
export function validateRegistry({tools=AGENT_TOOL_DEFINITIONS,operations=OPERATION_CAPABILITIES,skills=skillIndex()}={}) {
  const entries=[...tools,...operations], ids=new Set(), names=new Set(), skillIds=new Set(skills.map(s=>s.id));
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id) || !entry.name || names.has(entry.name) || !entry.description && tools.includes(entry) || !entry.parameters || !entry.effect || !entry.result || !entry.sources?.length || !entry.evaluations?.length || !entry.skills?.length || entry.skills.some(id=>!skillIds.has(id))) throw new Error('Invalid agent capability registry.');
    ids.add(entry.id); names.add(entry.name);
  }
  if (skillIds.size!==skills.length) throw new Error('Duplicate agent skill.');
  return entries;
}
