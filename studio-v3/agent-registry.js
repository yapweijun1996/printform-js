import { Type, validateToolArguments } from '@earendil-works/pi-ai';
import { OPERATION_SCHEMAS } from './agent-operation-schemas.js';
import { MAX_AUTHORING_OPERATIONS } from './ai-authoring-contract.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { skillIndex } from './agent-knowledge.js';
import { CONTRACT_VERSION, TOOL_CONTRACTS, OPERATION_CONTRACTS } from './agent-contracts.js';
import { ERROR_CONTRACTS } from './agent-errors.js';

const object = properties => Type.Object(properties,{additionalProperties:false});
const summary = Type.String({minLength:1,maxLength:500});
const definition = (name,description,parameters,effect,result) => Object.freeze({id:`printform.agent.${name}`,name,description,parameters,effect,result,contractVersion:CONTRACT_VERSION,...TOOL_CONTRACTS[name],skills:['form-authoring'],
  sources:['studio-v3/agent-tools.js','studio-v3/agent-registry.js','studio-v3/agent-contracts.js','studio-v3/agent-errors.js'],evaluations:['tests/studio-v3-agent-registry.test.js','tests/studio-v3-agent-loop.test.js','tests/studio-v3-agent-contracts.test.js']});
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
export const OPERATION_CAPABILITIES = Object.freeze(Object.entries(OPERATION_SCHEMAS).map(([name,parameters])=>Object.freeze({id:`printform.authoring.${name}`,name,parameters,effect:'draft',result:'validated-design-diff',
  contractVersion:CONTRACT_VERSION,errors:TOOL_CONTRACTS.apply_operations.errors,...OPERATION_CONTRACTS[name],skills:['form-authoring'],
  sources:['studio-v3/ai-authoring.js','studio-v3/agent-operation-schemas.js','studio-v3/design-validation.js','studio-v3/agent-contracts.js','studio-v3/agent-errors.js'],evaluations:['tests/studio-v3-ai-authoring.test.js','tests/studio-v3-agent-registry.test.js','tests/studio-v3-agent-contracts.test.js']})));
// The model sees example inputs and error advice; output schemas and rejection fixtures stay host-side for conformance.
// Operation errors are those of apply_operations, so they are listed once on that tool.
const modelView = ({outputSchema,invalid,examples,...entry}) => ({...entry,examples:examples.map(example=>example.args ?? example.operation)});
export function capabilityCatalog({identity={release:'development',verified:false},limits=DEMO_CONFIG.agent}={}) {
  return {version:1,identity,tools:AGENT_TOOL_DEFINITIONS.map(modelView),operations:OPERATION_CAPABILITIES.map(({errors,...entry})=>modelView(entry)),knowledge:skillIndex(),
    run:{mode:'steps',maxToolCalls:limits.maxTurns,maxRunMs:limits.maxRunMs,maxRunTokens:limits.maxRunTokens,maxRepeatedFailures:limits.maxRepeatedFailures,imageTurns:limits.imageTurns,maxNoteChars:limits.maxNoteChars},
    errors:ERROR_CONTRACTS,commit:'User Preview and Apply required',unsupported:['source/shell execution','new-project creation','asset import','dataset mutation','save/export/print','preview pixels']};
}
export function validateRegistry({tools=AGENT_TOOL_DEFINITIONS,operations=OPERATION_CAPABILITIES,skills=skillIndex()}={}) {
  const entries=[...tools,...operations], ids=new Set(), names=new Set(), skillIds=new Set(skills.map(s=>s.id));
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id) || !entry.name || names.has(entry.name) || !entry.description && tools.includes(entry) || !entry.parameters || !entry.effect || !entry.result || !entry.sources?.length || !entry.evaluations?.length || !entry.skills?.length || entry.skills.some(id=>!skillIds.has(id))) throw new Error('Invalid agent capability registry.');
    ids.add(entry.id); names.add(entry.name);
    validateContract(entry,tools.includes(entry));
  }
  if (skillIds.size!==skills.length) throw new Error('Duplicate agent skill.');
  return entries;
}
// Static contract checks; scripts/studio-v3-agent-conformance.mjs also executes every example through the real handler.
const conforms = (parameters,value) => {
  try { return JSON.stringify(validateToolArguments({name:'contract',parameters},{name:'contract',id:'contract',arguments:value})) === JSON.stringify(value); } catch { return false; }
};
function validateContract(entry,isTool) {
  const bad = () => { throw new Error(`Invalid agent capability contract: ${entry.id}.`); };
  const input = example => isTool ? example.args : example.operation;
  if (!/^\d+\.\d+\.\d+$/.test(entry.contractVersion || '') || (isTool && !entry.outputSchema)) bad();
  if (!entry.errors?.length || entry.errors.some(code=>!ERROR_CONTRACTS[code])) bad();
  if (!entry.examples?.length || !entry.invalid?.length) bad();
  for (const example of entry.examples) if (!conforms(entry.parameters,input(example))) bad();
  for (const example of entry.invalid) {
    if (!entry.errors.includes(example.error)) bad();
    // A schema rejection must be declared as such; a handler rejection must pass the schema first.
    if ((example.error === 'AGENT_ARGUMENTS_INVALID') === conforms(entry.parameters,input(example))) bad();
  }
}
