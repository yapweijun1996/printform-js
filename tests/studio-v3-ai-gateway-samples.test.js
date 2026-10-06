// Golden samples captured from the live Demo Gateway on 2026-10-06 (fictional prompts only).
// The opaque encrypted_content blobs are replaced by a placeholder; everything else keeps its shape.
import { describe,it,expect } from 'vitest';
import { createDemoTransport } from '../studio-v3/ai-demo-transport.js';
import { extractOutputText,responsesResult } from '../studio-v3/ai-responses-wire.js';
import { classifyFailure } from '../studio-v3/ai-gateway-errors.js';
import { errorMessage } from '../studio-v3/ai-messages.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const capabilities=multimodal=>({chat_completions:true,streaming:true,responses:true,multimodal,structured_output:true});
const liveModels={object:'list',data:['demo-fast','demo-auto','demo-openai-mini','demo-openai-quality','demo-groq','demo-gemini']
  .map(id=>({id,object:'model',owned_by:'openai-gateway-demo',capabilities:capabilities(id!=='demo-groq')}))};
// Short text request: synthesised by the gateway, no reasoning item, convenience output_text field.
const gatewayText={id:'resp_demo_3d580c94',object:'response',created_at:1791275023,status:'completed',model:'demo-auto',
  output:[{id:'resp_demo_3d580c94_msg',type:'message',role:'assistant',content:[{type:'output_text',text:'ok',annotations:[]}]}],
  output_text:'ok',usage:{input_tokens:29,output_tokens:2,total_tokens:31}};
// Provider response: an opaque reasoning item (content and summary empty) before the message.
const providerText={id:'resp_0f2a655c',object:'response',status:'completed',model:'demo-auto',billing:{payer:'openai'},
  output:[{id:'rs_0f2a655c',type:'reasoning',content:[],encrypted_content:'ENCRYPTED',summary:[]},
    {id:'msg_0f2a655c',type:'message',status:'completed',content:[{type:'output_text',annotations:[],logprobs:[],text:'391'}],phase:'final_answer',role:'assistant'}],
  reasoning:{context:'current_turn',effort:'low',mode:'standard',summary:null},
  usage:{input_tokens:20,input_tokens_details:{cache_write_tokens:0,cached_tokens:0},output_tokens:20,output_tokens_details:{reasoning_tokens:13},total_tokens:40}};
describe('live /models',()=> {
  const transport=()=>createDemoTransport({fetchImpl:async url=>url.endsWith('/session')?json({token:'dmo_synthetic1234',expires_in:900},201):json(liveModels)});
  it('lists all six aliases and tells vision-capable ones apart',async()=> {
    const t=transport();
    expect(await t.discover()).toEqual(['demo-fast','demo-auto','demo-openai-mini','demo-openai-quality','demo-groq','demo-gemini']);
    for(const alias of ['demo-fast','demo-auto','demo-openai-mini','demo-openai-quality','demo-gemini'])expect(t.supportsImages(alias)).toBe(true);
    expect(t.supportsImages('demo-groq')).toBe(false);
  });
  it('keeps the streaming and structured-output flags as diagnostics',async()=> {
    const t=transport();await t.discover();
    const facts=t.capabilityDiagnostics().find(d=>d.alias==='demo-auto').facts.map(f=>f.field);
    expect(facts).toEqual(expect.arrayContaining(['capabilities.responses','capabilities.multimodal','capabilities.streaming','capabilities.structured_output']));
  });
});
describe('live response shapes',()=> {
  it('reads the gateway-synthesised response',()=> expect(responsesResult(gatewayText)).toEqual({text:'ok',usage:{prompt_tokens:29,completion_tokens:2,total_tokens:31}}));
  it('skips the opaque reasoning item and reads the message',()=> {
    expect(extractOutputText(providerText)).toBe('391');
    expect(responsesResult(providerText).usage).toEqual({prompt_tokens:20,completion_tokens:20,total_tokens:40});
  });
  it('never surfaces reasoning content: it is empty or encrypted by the gateway',()=> {
    const item=providerText.output[0];expect(item.content).toEqual([]);expect(item.summary).toEqual([]);
    expect(responsesResult(providerText).text).not.toContain('ENCRYPTED');
  });
});
describe('live error bodies',()=> {
  const reply=(status,body)=>new Response(JSON.stringify(body),{status});
  it.each([
    [400,{error:{message:'demo model alias is not available',code:'DEMO_MODEL_NOT_ALLOWED',type:'invalid_request_error'}},'DEMO_MODEL_UNAVAILABLE'],
    [400,{error:{message:'input must contain 1-50 messages',code:'DEMO_INPUT_INVALID',type:'invalid_request_error'}},'DEMO_REQUEST_FAILED'],
    [400,{error:{message:'demo accepts text messages only',code:'DEMO_MEDIA_DISABLED',type:'invalid_request_error'}},'DEMO_MEDIA_ENDPOINT_BUG'],
    [401,{error:{message:'invalid or expired demo session'}},'DEMO_SESSION_EXPIRED']
  ])('HTTP %i %j -> %s',async(status,body,code)=> expect(await classifyFailure(reply(status,body))).toBe(code));
  it('tells the user to pick another model when the alias is not allowed',()=> expect(errorMessage({code:'DEMO_MODEL_UNAVAILABLE'})).toContain('no longer available'));
});
