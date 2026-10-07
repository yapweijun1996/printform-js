import {describe,it,expect} from 'vitest';
import {Type} from '@earendil-works/pi-ai';
import {toolSpecs,inputItems,agentBody,agentOutput,assistantContent} from '../studio-v3/agent-wire.js';
import {DEMO_CONFIG} from '../studio-v3/ai-gateway-config.js';

const tools = [{name:'get_context',description:'Read it.',parameters:Type.Object({}),execute:()=>{}},{name:'finish',description:'Done.',parameters:Type.Object({summary:Type.String()}),execute:()=>{}}];
const reasoning = {id:'rs_1',type:'reasoning',content:[],encrypted_content:'enc-1',summary:[]};
const user = text => ({role:'user',content:text,timestamp:1});
const assistant = (content,responseId = 'resp_1') => ({role:'assistant',content,api:'x',provider:'x',model:'demo-fast',responseId,usage:{},stopReason:'toolUse',timestamp:2});
const call = (id,name,args = {}) => ({type:'toolCall',id,name,arguments:args});
const thinking = item => ({type:'thinking',thinking:'',thinkingSignature:JSON.stringify(item),redacted:true});
const result = (id,name,text,isError = false) => ({role:'toolResult',toolCallId:id,toolName:name,content:[{type:'text',text}],isError,timestamp:3});
const code = work => { try { work(); } catch (error) { return error.code; } return null; };

describe('agent wire: requests',()=> {
  it('describes the tools as function specs and nothing else',()=> {
    const specs = toolSpecs(tools);
    expect(specs.map(spec=>spec.name)).toEqual(['get_context','finish']);
    for (const spec of specs) expect(Object.keys(spec).sort()).toEqual(['description','name','parameters','type']);
    expect(specs[0].type).toBe('function'); expect(JSON.parse(JSON.stringify(specs[1].parameters)).properties.summary.type).toBe('string');
  });

  it('replays the conversation as Responses items, reasoning and calls included',()=> {
    const items = inputItems({systemPrompt:'SYSTEM',messages:[
      user('Tidy it'),
      assistant([thinking(reasoning),{type:'text',text:'Reading.'},call('call_1','get_context')]),
      result('call_1','get_context','{"layout":1}')
    ]});
    expect(items).toEqual([
      {role:'system',content:[{type:'input_text',text:'SYSTEM'}]},
      {role:'user',content:[{type:'input_text',text:'Tidy it'}]},
      {type:'reasoning',id:'rs_1',summary:[],encrypted_content:'enc-1'},
      {type:'message',role:'assistant',content:[{type:'output_text',text:'Reading.'}]},
      {type:'function_call',call_id:'call_1',name:'get_context',arguments:'{}'},
      {type:'function_call_output',call_id:'call_1',output:'{"layout":1}'}
    ]);
  });

  it('sends a failed tool result as text the model can read',()=> {
    const items = inputItems({messages:[user('x'),assistant([call('c','finish',{summary:'s'})]),result('c','finish','NO_CHANGES. Correct the step.',true)]});
    expect(items.at(-1)).toEqual({type:'function_call_output',call_id:'c',output:'NO_CHANGES. Correct the step.'});
  });

  it('refuses to replay a reasoning item that has lost its encrypted content',()=> {
    const damaged = {type:'thinking',thinking:'',thinkingSignature:JSON.stringify({type:'reasoning',id:'rs_1',summary:[]}),redacted:true};
    expect(code(()=>inputItems({messages:[user('go'),assistant([damaged,call('c','get_context')])]}))).toBe('MALFORMED_PROPOSAL');
  });

  it('folds older tool results so a long run does not resend everything',()=> {
    const messages = [user('go')];
    for (let i = 0; i < 10; i++) messages.push(assistant([call(`c${i}`,'get_context')],`r${i}`),result(`c${i}`,'get_context',`BIG-${i}`));
    const outputs = inputItems({messages}).filter(item=>item.type === 'function_call_output');
    expect(outputs).toHaveLength(10);
    const kept = DEMO_CONFIG.agent.keepToolResults;
    expect(outputs.slice(-kept).map(item=>item.output)).toEqual(Array.from({length:kept},(_,i)=>`BIG-${10 - kept + i}`));
    expect(outputs.slice(0,10 - kept).every(item=>!item.output.includes('BIG') && item.output.length < 80)).toBe(true);
  });

  it('builds a closed body: function tools, encrypted reasoning, and none of the fields the gateway refuses',()=> {
    const body = JSON.parse(agentBody({alias:'demo-fast',context:{systemPrompt:'S',messages:[user('go')],tools},stream:true}));
    expect(body).toMatchObject({model:'demo-fast',stream:true,tool_choice:'auto',include:['reasoning.encrypted_content']});
    expect(body.tools.map(spec=>spec.name)).toEqual(['get_context','finish']);
    for (const key of ['previous_response_id','store','max_output_tokens','background','metadata']) expect(body).not.toHaveProperty(key);
  });

  it('refuses a request that has grown past the gateway body limit',()=> {
    const huge = 'x'.repeat(DEMO_CONFIG.maxBodyBytes);
    expect(code(()=>agentBody({alias:'demo-fast',context:{messages:[user(huge)],tools},stream:true}))).toBe('AGENT_CONTEXT_LIMIT');
  });
});

describe('agent wire: answers',()=> {
  const message = text => ({id:'msg_1',type:'message',status:'completed',content:[{type:'output_text',annotations:[],text}],phase:'final_answer',role:'assistant'});
  const fnCall = (id,name,args) => ({id:`fc_${id}`,type:'function_call',status:'completed',call_id:id,name,arguments:args});

  it('turns a completed answer into reasoning, text and tool calls',()=> {
    const content = assistantContent(agentOutput({status:'completed',output:[reasoning,message('Looking.'),fnCall('call_9','apply_operations','{"summary":"s","operations":[]}')]}));
    expect(content).toEqual([
      {type:'thinking',thinking:'',thinkingSignature:JSON.stringify({type:'reasoning',id:'rs_1',summary:[],encrypted_content:'enc-1'}),redacted:true},
      {type:'text',text:'Looking.'},
      {type:'toolCall',id:'call_9',name:'apply_operations',arguments:{summary:'s',operations:[]}}
    ]);
  });

  it('rejects an answer that is not complete, has bad tool arguments, or uses a server-side tool',()=> {
    expect(code(()=>agentOutput({status:'incomplete',output:[]}))).toBe('MALFORMED_PROPOSAL');
    expect(code(()=>assistantContent(agentOutput({status:'completed',output:[fnCall('c','finish','{not json')]})))).toBe('MALFORMED_PROPOSAL');
    expect(code(()=>agentOutput({status:'completed',output:[{type:'web_search_call',id:'w'}]}))).toBe('MALFORMED_PROPOSAL');
    expect(code(()=>agentOutput({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}))).toBe('MALFORMED_PROPOSAL');
  });

  it('ignores benign unknown items',()=> {
    expect(assistantContent(agentOutput({status:'completed',output:[{type:'something_new',id:'z'},message('Hi')]}))).toEqual([{type:'text',text:'Hi'}]);
  });
});
