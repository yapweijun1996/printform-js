import { DEMO_CONFIG } from './ai-gateway-config.js';
import { assistantContent } from './agent-wire.js';

// A tiny diagnostic of what the real Demo gateway does with the tool loop's wire format: one call, one replay,
// fictional text only, three requests in all. It reports codes and counts, never request or response bodies.
const SKILL = {name:'read_skill',description:'Read the instructions of a named skill.',parameters:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false}};
const ASK = 'Fictional probe. Use the read_skill tool to read the skill named "layout", then answer with one short sentence.';
const RESULT = 'Fictional skill text: keep the footer under the totals.';
const codeOf = error => error?.code || error?.name || 'UNKNOWN';

export async function runGatewayProbe({transport,signal,alias}) {
  const checks = [], add = (id,ok,detail) => { checks.push({id,ok,detail}); return ok; };
  let aliases;
  try { aliases = await transport.discover(signal); } catch (error) { add('models',false,codeOf(error)); return {checks}; }
  const model = alias || (aliases.includes(DEMO_CONFIG.defaultAlias) ? DEMO_CONFIG.defaultAlias : aliases[0]);
  add('models',true,`${aliases.length} alias(es); using ${model}`);

  const messages = [{role:'user',content:ASK,timestamp:0}];
  const context = () => ({systemPrompt:'You are a diagnostic. Follow the instruction exactly.',messages,tools:[SKILL]});
  let first;
  try { first = await transport.agentTurn(model,context(),signal); } catch (error) { add('tool-call',false,codeOf(error)); return {checks}; }
  const call = first.output.find(item=>item.type === 'function_call');
  if (!call) { add('tool-call',false,`no function call; output items: ${first.output.map(item=>item.type).join(', ') || 'none'}`); return {checks}; }
  let args;
  try { args = JSON.parse(call.arguments || '{}'); } catch { args = null; }
  const reasoning = first.output.some(item=>item.type === 'reasoning' && item.encrypted_content);
  const right = call.name === SKILL.name && args?.name === 'layout';
  if (!add('tool-call',right,`${call.name}(${args ? Object.keys(args).join(',') : 'unparseable'}); reasoning item: ${reasoning ? 'yes' : 'no'}`)) return {checks};

  messages.push({role:'assistant',content:assistantContent(first.output),timestamp:1},
    {role:'toolResult',toolCallId:call.call_id,toolName:call.name,content:[{type:'text',text:RESULT}],isError:false,timestamp:2});
  try {
    const second = await transport.agentTurn(model,context(),signal);
    const text = second.output.some(item=>item.type === 'message');
    add('replay',text,text ? 'accepted; the model answered' : `accepted but no answer; output items: ${second.output.map(item=>item.type).join(', ') || 'none'}`);
  } catch (error) { add('replay',false,codeOf(error)); }
  return {checks};
}
