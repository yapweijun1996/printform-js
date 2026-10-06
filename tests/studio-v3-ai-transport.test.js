import { describe,it,expect,vi,beforeEach,afterEach } from 'vitest';
import { createDemoTransport } from '../studio-v3/ai-demo-transport.js';
import { errorMessage } from '../studio-v3/ai-messages.js';
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const models = {data:[{id:'demo-auto'},{id:'demo-fast'},{id:'private-model'}]};
const textReply = text => ({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:3,output_tokens:4,total_tokens:7}});
const reply = textReply('{}');
describe('v3 Demo wire contract',()=> {
  it('uses existing registration, discovers aliases and sends no native tools/private credentials',async()=> {
    const calls = []; const transport = createDemoTransport({fetchImpl:async(url,init)=> {
      calls.push({url,init}); return url.endsWith('/session') ? json({token:'dmo_synthetic1234',expires_in:900},201) : url.endsWith('/models') ? json(models) : json(reply);
    }});
    expect(await transport.discover()).toEqual(['demo-auto','demo-fast']); await transport.plan('demo-fast','fictional layout');
    expect(JSON.parse(calls[0].init.body)).toEqual({project_id:'github-pages'}); expect(calls[0].init.headers.authorization).toBeUndefined();
    expect(calls[2].url).toBe('https://gpt.yapweijun1996.com/demo/v1/responses'); expect(calls.some(c=>c.url.includes('chat/completions'))).toBe(false);
    const payload = JSON.parse(calls[2].init.body); expect(Object.keys(payload).sort()).toEqual(['input','model','stream']); expect(payload.stream).toBe(true);
    expect(payload.model).toBe('demo-fast'); expect(JSON.stringify(payload)).not.toContain('dmo_');
    expect(new Headers(calls[2].init.headers).get('authorization')).toBe('Bearer dmo_synthetic1234');
    expect(new Headers(calls[0].init.headers).has('origin')).toBe(false);
  });
  it('refreshes once after 401 and proactively after expiry; clear releases memory state',async()=> {
    let now = 0,sessions = 0, requests = 0;
    const transport = createDemoTransport({now:()=>now,fetchImpl:async(url)=> {
      if (url.endsWith('/session')) return json({token:`dmo_synthetic${++sessions}`,expires_in:60});
      return ++requests === 1 ? json({},401) : json(models);
    }});
    await transport.discover(); expect(sessions).toBe(2);
    now = 31000; await transport.discover(); expect(sessions).toBe(3);
    transport.clear(); await transport.discover(); expect(sessions).toBe(4);
  });
  it('fails closed for unregistered origin and repeated unauthorized token',async()=> {
    const denied = createDemoTransport({fetchImpl:async()=>json({},403)});
    await expect(denied.discover()).rejects.toThrow('DEMO_SESSION_FORBIDDEN');
    let sessions = 0;
    const expired = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? (sessions++,json({token:'dmo_synthetic123',expires_in:60})) : json({},401)});
    await expect(expired.discover()).rejects.toThrow('DEMO_SESSION_EXPIRED'); expect(sessions).toBe(2);
  });
  it('reports a rejected session during a 401 refresh without claiming the inference request was never sent',async()=> {
    let issued = 0,dispatched = 0;
    const transport = createDemoTransport({fetchImpl:async url=> {
      if (url.endsWith('/session')) return ++issued === 1 ? json({token:'dmo_synthetic123'}) : json({},403);
      dispatched++; return json({},401);
    }});
    await expect(transport.plan('demo-fast','fictional')).rejects.toThrow('DEMO_SESSION_FORBIDDEN');
    expect(dispatched).toBe(1);
  });
  it.each([429,500])('sanitizes HTTP %i error bodies',async status=> {
    const transport = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json({secret:'must never display'},status)});
    await expect(transport.discover()).rejects.toThrow(status===429?'DEMO_RATE_LIMIT':'DEMO_REQUEST_FAILED');
  });
  it('rejects absent aliases, native tool responses, truncation and oversized responses',async()=> {
    const message = {type:'message',content:[{type:'output_text',text:'{}'}]};
    for (const [bad,code] of [
      [{status:'incomplete',output:[message]},'MALFORMED_PROPOSAL'],
      [{status:'completed',output:[{type:'function_call',name:'run'},message]},'MALFORMED_PROPOSAL'],
      [{choices:[{finish_reason:'stop',message:{content:'{}'}}]},'MALFORMED_PROPOSAL'],
      [{padding:'x'.repeat(65000)},'DEMO_RESPONSE_LIMIT']
    ]) {
      const transport = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json(bad)});
      await expect(transport.plan('demo-fast','fake')).rejects.toMatchObject({code});
    }
    const missing = createDemoTransport({fetchImpl:async url=>url.endsWith('/session') ? json({token:'dmo_synthetic123'}) : json({data:[{id:'private'}]})});
    await expect(missing.discover()).rejects.toThrow('DEMO_MODEL_UNAVAILABLE');
  });
});

const media=[{type:'input_image',image_url:'data:image/jpeg;base64,/9j/AA=='}];
const visualModel=(id='demo-fast')=>({id,capabilities:{responses:true,multimodal:true}});
const visualReply={status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"kind":"answer","message":"Synthetic reference read"}'}]}],usage:{input_tokens:12,output_tokens:8,total_tokens:20}};
function visualTransport() {
 const calls=[],state={models:{data:[visualModel()]},status:200,reply:visualReply};
 const transport=createDemoTransport({fetchImpl:async(url,init)=>{
  calls.push({url,init});return url.endsWith('/session')?json({token:'dmo_synthetic123'}):url.endsWith('/models')?json(state.models,state.status):json(state.reply);
 }});
 return {transport,state,calls};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
describe('v3 reference media capability boundary',()=>{
 it('rejects unknown capability and other aliases before sending a reference',async()=>{
  const {transport,state,calls}=visualTransport();
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(calls).toEqual([]);
  state.models={data:[...models.data,visualModel('private-model')]};await transport.discover();
  expect(transport.supportsImages('private-model')).toBe(false);
  await expect(transport.plan('private-model','reference',undefined,media)).rejects.toThrow('DEMO_MODEL_UNAVAILABLE');
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(calls.some(c=>c.url.endsWith('/responses'))).toBe(false);
 });
 it.each(['demo-fast','demo-auto'])('uses verified inline images in bounded Responses requests for %s',async alias=>{
  const {transport,state,calls}=visualTransport();state.models={data:[visualModel(alias)]};
  expect(await transport.discover()).toEqual([alias]);expect(transport.supportsImages(alias)).toBe(true);
  const result=await transport.plan(alias,'reviewed fictional reference',undefined,media);expect(result.usage.total_tokens).toBe(20);
  const {url,init}=calls.at(-1),wire=JSON.parse(init.body);expect(url).toBe('https://gpt.yapweijun1996.com/demo/v1/responses');
  expect(Object.keys(wire).sort()).toEqual(['input','model','stream']);expect(wire.model).toBe(alias);expect(wire.stream).toBe(false);
  expect(wire.input[1].content).toEqual([{type:'input_text',text:'reviewed fictional reference'},...media]);expect(JSON.stringify(wire)).not.toContain('dmo_');
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer dmo_synthetic123');expect(Object.getOwnPropertySymbols(init)).toEqual([]);
  expect(transport.capabilityDiagnostics()).toEqual([{alias,facts:[{field:'capabilities.responses',value:true},{field:'capabilities.multimodal',value:true}]}]);
 });
 it('rejects external URLs, unsupported media and every existing request limit without dispatch',async()=>{
  const {transport,calls}=visualTransport();await transport.discover();const before=calls.length;
  const image=image_url=>({type:'input_image',image_url});
  for(const invalid of [
   [image('https://external.example/private.png')],[image('file:///private.png')],[image('data:image/svg+xml;base64,AAAA')],
   [{...media[0],detail:'high'}],[{type:'input_file',file_id:'private'}],Array(5).fill(media[0]),
   [image('data:image/png;base64,'+'A'.repeat(5592508))],Array(3).fill(image('data:image/png;base64,'+'A'.repeat(3*1024*1024)))
  ])await expect(transport.plan('demo-fast','bad',undefined,invalid)).rejects.toThrow('UNSAFE_PROPOSAL');
  await expect(transport.plan('demo-fast','界'.repeat(4*1024*1024),undefined,media)).rejects.toThrow('UNSAFE_PROPOSAL');
  expect(calls).toHaveLength(before);
 });
 it.each([
  {status:'incomplete',output:visualReply.output},
  {status:'completed',output:[{type:'function_call',name:'run_tool'}]},
  {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'},{type:'refusal',refusal:'blocked'}]}]},
  {status:'completed',output:[]},
  {padding:'x'.repeat(65000)}
 ])('rejects incomplete, native-tool or oversized Responses output %#',async reply=>{
  const {transport,state}=visualTransport();state.reply=reply;await transport.discover();await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow();
 });
});
describe('v3 capability revocation and session lifecycle',()=>{
 it.each([
  {data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]},
  {data:[{id:'demo-fast',capabilities:{responses:false,multimodal:true}}]},
  {data:[{id:'demo-fast'}]},
  {data:[{id:'demo-fast',input_modalities:['image']}]},
  {data:[visualModel(),{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]},
  {data:[visualModel('demo-auto')]}
 ])('closes a prior grant on removed, changed or contradictory metadata %#',async models=>{
  const {transport,state,calls}=visualTransport();await transport.discover();expect(transport.supportsImages('demo-fast')).toBe(true);
  state.models=models;await transport.discover();expect(transport.supportsImages('demo-fast')).toBe(false);
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(calls.some(c=>c.url.endsWith('/responses'))).toBe(false);
 });
 it.each([[null,200],[{},200],[{data:[null,{id:'private-model'}]},200],[{},500],[{},429]])('closes a prior grant when discovery fails %#',async(models,status)=>{
  const {transport,state}=visualTransport();await transport.discover();state.models=models;state.status=status;
  const pending=transport.discover();expect(transport.supportsImages('demo-fast')).toBe(false);expect(transport.capabilityDiagnostics()).toEqual([]);
  await expect(pending).rejects.toThrow();expect(transport.supportsImages('demo-fast')).toBe(false);
 });
 it('clears permissions and public facts together, while session-only cleanup preserves discovery',async()=>{
  const {transport,calls}=visualTransport();await transport.discover();const facts=transport.capabilityDiagnostics();facts[0].facts[0].value=false;
  expect(transport.capabilityDiagnostics()[0].facts[0].value).toBe(true);transport.clearSession();expect(transport.supportsImages('demo-fast')).toBe(true);
  await transport.plan('demo-fast','reference',undefined,media);expect(calls.filter(c=>c.url.endsWith('/session'))).toHaveLength(2);
  transport.clear();expect(transport.supportsImages('demo-fast')).toBe(false);expect(transport.capabilityDiagnostics()).toEqual([]);
  await expect(transport.plan('demo-fast','reference',undefined,media)).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');
 });
 it.each(['clear','abort'])('cannot restore permission from a late discovery after %s',async action=>{
  const held=deferred(),controller=new AbortController();let discovered=false;
  const transport=createDemoTransport({fetchImpl:async url=>url.endsWith('/session')?json({token:'dmo_synthetic123'}):(discovered=true,held.promise)});
  const pending=transport.discover(controller.signal),assertion=expect(pending).rejects.toThrow();await vi.waitFor(()=>expect(discovered).toBe(true));
  if(action==='clear')transport.clear();else controller.abort();held.resolve(json({data:[visualModel()]}));await assertion;
  expect(transport.supportsImages('demo-fast')).toBe(false);expect(transport.capabilityDiagnostics()).toEqual([]);
 });
 it('an older positive discovery cannot replace a newer revocation',async()=>{
  const held=deferred();let requests=0;
  const transport=createDemoTransport({fetchImpl:async url=>url.endsWith('/session')?json({token:'dmo_synthetic123'}):++requests===1?held.promise:json({data:[{id:'demo-fast'}]})});
  const old=transport.discover(),assertion=expect(old).rejects.toThrow('DEMO_MODEL_UNAVAILABLE');await vi.waitFor(()=>expect(requests).toBe(1));
  await transport.discover();held.resolve(json({data:[visualModel()]}));await assertion;expect(transport.supportsImages('demo-fast')).toBe(false);
  expect(transport.capabilityDiagnostics()).toEqual([{alias:'demo-fast',facts:[]}]);
 });
 it('rechecks image permission after awaiting a new session, before any Responses dispatch',async()=>{
  const held=deferred();let sessions=0,requests=0,inference=0;
  const transport=createDemoTransport({fetchImpl:async url=>{
   if(url.endsWith('/session'))return ++sessions===1?json({token:'dmo_synthetic123'}):held.promise;
   if(url.endsWith('/models'))return json({data:[++requests===1?visualModel():{id:'demo-fast'}]});
   inference++;return json(visualReply);
  }});
  await transport.discover();transport.clearSession();const pending=transport.plan('demo-fast','reference',undefined,media),assertion=expect(pending).rejects.toThrow('DEMO_IMAGE_CAPABILITY_UNVERIFIED');
  await vi.waitFor(()=>expect(sessions).toBe(2));const rediscovery=transport.discover();held.resolve(json({token:'dmo_synthetic456'}));await assertion;await rediscovery;
  expect(inference).toBe(0);expect(transport.supportsImages('demo-fast')).toBe(false);
 });
 it('blocks a revoked image retry after 401 without claiming the first dispatch never happened',async()=>{
  const held=deferred();let sessions=0,requests=0,inference=0;
  const transport=createDemoTransport({fetchImpl:async url=>{
   if(url.endsWith('/session'))return ++sessions===1?json({token:'dmo_synthetic123'}):held.promise;
   if(url.endsWith('/models'))return json({data:[++requests===1?visualModel():{id:'demo-fast'}]});
   inference++;return inference===1?json({},401):json(visualReply);
  }});
  await transport.discover();const pending=transport.plan('demo-fast','reference',undefined,media).catch(error=>error);
  await vi.waitFor(()=>expect(sessions).toBe(2));expect(inference).toBe(1);
  const rediscovery=transport.discover();held.resolve(json({token:'dmo_synthetic456'}));
  const error=await pending;await rediscovery;
  expect(error.code).toBe('DEMO_IMAGE_CAPABILITY_UNVERIFIED');expect(inference).toBe(1);expect(transport.supportsImages('demo-fast')).toBe(false);
  expect(errorMessage(error)).toContain('Image analysis is unavailable');expect(errorMessage(error).toLowerCase()).not.toContain('nothing was sent');
 });
});

describe('v3 Demo network failures',()=> {
  it('reports a CORS/offline TypeError as an actionable unreachable error, not the generic one',async()=> {
    const transport = createDemoTransport({fetchImpl:async()=> { throw new TypeError('Failed to fetch'); }});
    const error = await transport.discover().catch(e=>e);
    expect(error.code).toBe('DEMO_NETWORK_UNREACHABLE');
    expect(errorMessage(error)).toContain('Cannot reach the AI service');
    expect(errorMessage(error)).toContain('Nothing changed');
  });
  it('keeps user cancellation as a cancellation rather than a network error',async()=> {
    const transport = createDemoTransport({fetchImpl:async()=> { throw new DOMException('aborted','AbortError'); }});
    const error = await transport.discover().catch(e=>e);
    expect(error.name).toBe('AbortError');
    expect(errorMessage(error)).toBe('Cancelled. Nothing changed.');
  });
});
describe('v3 Demo HTTP failures are named, not generic',()=> {
  const token = json({token:'dmo_synthetic1234',expires_in:900},201);
  const api = (status,body,{session}={})=> createDemoTransport({fetchImpl:async url=> url.endsWith('/session') ? (session ? json(session.body,session.status) : token.clone()) : json(body,status)});
  it.each([
    [400,{code:'DEMO_MEDIA_DISABLED'},'DEMO_MEDIA_ENDPOINT_BUG'],
    [403,{error:'demo origin is not registered'},'DEMO_SESSION_FORBIDDEN'],
    [429,{},'DEMO_RATE_LIMIT'],
    [503,{code:'DEMO_ROUTER_DISABLED'},'DEMO_SERVICE_DISABLED'],
    [503,{code:'DEMO_ALL_ROUTES_EXHAUSTED'},'DEMO_ROUTES_EXHAUSTED'],
    [504,{},'DEMO_GATEWAY_TIMEOUT'],
    [500,{},'DEMO_REQUEST_FAILED']
  ])('model request HTTP %i -> %s',async(status,body,code)=> {
    await expect(api(status,body).discover()).rejects.toMatchObject({code});
  });
  it.each([
    [403,{error:'demo origin is not registered'},'DEMO_SESSION_FORBIDDEN'],
    [429,{},'DEMO_RATE_LIMIT'],
    [503,{code:'DEMO_ROUTER_DISABLED'},'DEMO_SERVICE_DISABLED'],
    [504,{},'DEMO_GATEWAY_TIMEOUT'],
    [500,{},'DEMO_SESSION_UNAVAILABLE']
  ])('session request HTTP %i -> %s',async(status,body,code)=> {
    await expect(api(200,{},{session:{status,body}}).discover()).rejects.toMatchObject({code});
  });
  it('refreshes the session once on 401 and recovers when the retry succeeds',async()=> {
    const urls=[];let modelCalls=0;
    const transport=createDemoTransport({fetchImpl:async url=> { urls.push(url);
      if(url.endsWith('/session'))return token.clone();
      return ++modelCalls===1 ? json({},401) : json(models); }});
    expect(await transport.discover()).toEqual(['demo-auto','demo-fast']);
    expect(urls.filter(u=>u.endsWith('/session'))).toHaveLength(2);
  });
  it('reports an expired session when the single refresh is rejected too',async()=> {
    const urls=[];
    const transport=createDemoTransport({fetchImpl:async url=> { urls.push(url); return url.endsWith('/session') ? token.clone() : json({},401); }});
    await expect(transport.discover()).rejects.toMatchObject({code:'DEMO_SESSION_EXPIRED'});
    expect(urls.filter(u=>u.endsWith('/session'))).toHaveLength(2);
  });
  it('separates a network failure from every HTTP failure',async()=> {
    const network=createDemoTransport({fetchImpl:async()=> { throw new TypeError('Failed to fetch'); }});
    const codes=new Set([(await network.discover().catch(e=>e)).code]);
    for(const [status,body] of [[403,{}],[429,{}],[503,{code:'DEMO_ROUTER_DISABLED'}],[504,{}],[500,{}]])codes.add((await api(status,body).discover().catch(e=>e)).code);
    expect(codes.has('DEMO_NETWORK_UNREACHABLE')).toBe(true);expect(codes.size).toBe(6);
  });
});
describe('v3 text requests use the Responses endpoint',()=> {
  const recorder=(payload=reply)=> { const calls=[];
    const transport=createDemoTransport({fetchImpl:async(url,init)=> { calls.push({url,init}); return url.endsWith('/session') ? json({token:'dmo_synthetic1234',expires_in:900},201) : json(payload); }});
    return {transport,calls}; };
  it('sends the closed text body to /responses and returns text plus mapped usage',async()=> {
    const {transport,calls}=recorder(textReply('{"kind":"answer","message":"hi"}'));
    const result=await transport.plan('demo-auto','current layout');
    const call=calls.find(c=>c.url.endsWith('/responses')),body=JSON.parse(call.init.body);
    expect(call.url).toBe('https://gpt.yapweijun1996.com/demo/v1/responses');
    expect(body.model).toBe('demo-auto');expect(body.stream).toBe(true);
    expect(body.input.map(item=>item.role)).toEqual(['system','user']);
    expect(body.input[1].content).toEqual([{type:'input_text',text:'current layout'}]);
    expect(JSON.stringify(body)).not.toMatch(/tools|tool_choice|messages|dmo_/);
    expect(calls.some(c=>c.url.includes('chat/completions'))).toBe(false);
    expect(result).toEqual({text:'{"kind":"answer","message":"hi"}',usage:{prompt_tokens:3,completion_tokens:4,total_tokens:7}});
  });
  it('keeps the gateway JSON size limit for text-only requests',async()=> {
    const {transport,calls}=recorder();
    await expect(transport.plan('demo-fast','界'.repeat(4*1024*1024))).rejects.toMatchObject({code:'UNSAFE_PROPOSAL'});
    expect(calls.some(c=>c.url.endsWith('/responses'))).toBe(false);
  });
  it('tolerates a response without status and with benign extra items',async()=> {
    const {transport}=recorder({output:[{type:'reasoning',summary:[]},{type:'future_item'},{type:'message',content:[{type:'output_text',text:'{}'}]}]});
    expect((await transport.plan('demo-fast','x')).text).toBe('{}');
  });
  it('still rejects an alias outside the allowed list before any request',async()=> {
    const {transport,calls}=recorder();
    await expect(transport.plan('private-model','x')).rejects.toMatchObject({code:'DEMO_MODEL_UNAVAILABLE'});expect(calls).toHaveLength(0);
  });
});
describe('v3 dynamic model aliases',()=> {
  const gateway=(modelList,calls=[])=>createDemoTransport({fetchImpl:async(url,init)=> { calls.push({url,init});
    return url.endsWith('/session') ? json({token:'dmo_synthetic1234',expires_in:900},201) : url.endsWith('/models') ? json({data:modelList}) : json(reply); }});
  it('returns the gateway aliases in order, without relying on demo-fast',async()=> {
    const transport=gateway(['demo-auto','demo-openai-mini','demo-groq','demo-gemini'].map(id=>({id})));
    expect(await transport.discover()).toEqual(['demo-auto','demo-openai-mini','demo-groq','demo-gemini']);
    expect(await gateway([{id:'demo-auto'}]).discover()).toEqual(['demo-auto']);
  });
  it('drops ids that are not safe demo aliases and duplicates',async()=> {
    const bad=['private-model','Demo-auto','demo-auto"}','demo-','gpt-5.4-mini',null,42,{},'demo-'+'a'.repeat(41)].map(id=>({id}));
    expect(await gateway([...bad,{id:'demo-groq'},{id:'demo-groq'},{id:'demo-auto'}]).discover()).toEqual(['demo-groq','demo-auto']);
    await expect(gateway(bad).discover()).rejects.toMatchObject({code:'DEMO_MODEL_UNAVAILABLE'});
  });
  it('caps the list and only keeps capability facts for kept aliases',async()=> {
    const many=Array.from({length:12},(_,i)=>({id:`demo-m${i}`,capabilities:{responses:true,multimodal:true}}));
    const transport=gateway(many);const aliases=await transport.discover();
    expect(aliases).toHaveLength(8);expect(aliases.at(-1)).toBe('demo-m7');
    expect(transport.capabilityDiagnostics().map(d=>d.alias)).toEqual(aliases);
    expect(transport.supportsImages('demo-m7')).toBe(true);expect(transport.supportsImages('demo-m8')).toBe(false);
  });
  it('judges image support per alias',async()=> {
    const transport=gateway([{id:'demo-gemini',capabilities:{responses:true,multimodal:true}},{id:'demo-groq',capabilities:{responses:true,multimodal:false}},{id:'demo-auto'}]);
    await transport.discover();
    expect(transport.supportsImages('demo-gemini')).toBe(true);expect(transport.supportsImages('demo-groq')).toBe(false);expect(transport.supportsImages('demo-auto')).toBe(false);
  });
  it('plans with any safe alias and puts exactly that alias in the model field',async()=> {
    const calls=[];const transport=gateway([{id:'demo-groq'}],calls);await transport.discover();await transport.plan('demo-groq','hello');
    expect(JSON.parse(calls.find(c=>c.url.endsWith('/responses')).init.body).model).toBe('demo-groq');
  });
  it('refuses an unsafe alias before any request',async()=> {
    const calls=[];const transport=gateway([{id:'demo-groq'}],calls);
    for(const alias of ['private-model','demo-groq"}','Demo-groq','','demo-',undefined])await expect(transport.plan(alias,'x')).rejects.toMatchObject({code:'DEMO_MODEL_UNAVAILABLE'});
    expect(calls).toHaveLength(0);
  });
});
describe('v3 per-request timeouts',()=> {
  beforeEach(()=> vi.useFakeTimers());
  afterEach(()=> vi.useRealTimers());
  const hang=(url,init)=> new Promise((_,reject)=> init.signal.addEventListener('abort',()=>reject(init.signal.reason ?? new DOMException('aborted','AbortError'))));
  const session=()=>json({token:'dmo_synthetic1234',expires_in:900},201);
  const gateway=(onApi,calls=[])=>createDemoTransport({fetchImpl:async(url,init)=> { calls.push(url);
    if(url.endsWith('/session'))return onApi.session ? onApi.session(url,init) : session();
    return url.endsWith('/models') ? (onApi.models ? onApi.models(url,init) : json(models)) : onApi.api(url,init); }});
  const settle=async promise=> { let state='pending',value;promise.then(v=> { state='resolved';value=v; },e=> { state='rejected';value=e; });await vi.advanceTimersByTimeAsync(0);return ()=>({state,value}); };
  it('fails a stalled model request exactly at its cap and does not retry',async()=> {
    const calls=[];const transport=gateway({api:hang},calls);
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(59_999);expect(outcome().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome().state).toBe('rejected');expect(outcome().value.code).toBe('AI_TIMEOUT');
    await vi.advanceTimersByTimeAsync(300_000);
    expect(calls.filter(u=>u.endsWith('/responses'))).toHaveLength(1);expect(calls.filter(u=>u.endsWith('/session'))).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('caps model discovery separately and sooner',async()=> {
    const transport=gateway({models:hang});
    const outcome=await settle(transport.discover());
    await vi.advanceTimersByTimeAsync(14_999);expect(outcome().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);expect(outcome().value.code).toBe('AI_TIMEOUT');
  });
  it('lets a slow answer succeed right up to the cap and leaves no timer behind',async()=> {
    const transport=gateway({api:()=>new Promise(resolve=>setTimeout(()=>resolve(json(reply)),59_000))});
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(59_000);
    expect(outcome().state).toBe('resolved');expect(outcome().value.text).toBe('{}');expect(vi.getTimerCount()).toBe(0);
  });
  it('counts session acquisition inside the same cap',async()=> {
    const calls=[];const transport=gateway({session:hang,api:()=>json(reply)},calls);
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(outcome().value.code).toBe('AI_TIMEOUT');expect(calls.some(u=>u.endsWith('/responses'))).toBe(false);
  });
  it('times out a response whose body never finishes',async()=> {
    const stalled=()=>new Response(new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('{"output":')); }}),{status:200});
    const transport=gateway({api:stalled});
    const outcome=await settle(transport.plan('demo-auto','x'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(outcome().state).toBe('rejected');expect(outcome().value.code).toBe('AI_TIMEOUT');
  });
  it('keeps the user\'s Stop a cancellation, not a timeout, and frees the timer',async()=> {
    const calls=[];const transport=gateway({api:hang},calls),stop=new AbortController();
    const outcome=await settle(transport.plan('demo-auto','x',stop.signal));
    await vi.advanceTimersByTimeAsync(10_000);stop.abort();await vi.advanceTimersByTimeAsync(0);
    expect(outcome().state).toBe('rejected');expect(outcome().value.name).toBe('AbortError');expect(outcome().value.code).not.toBe('AI_TIMEOUT');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls.filter(u=>u.endsWith('/responses'))).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);
  });
  it('still names a network failure as unreachable, not as a timeout',async()=> {
    const transport=gateway({api:async()=> { throw new TypeError('Failed to fetch'); }});
    const outcome=await settle(transport.plan('demo-auto','x'));expect(outcome().value.code).toBe('DEMO_NETWORK_UNREACHABLE');
  });
});
describe('v3 streamed text requests',()=> {
  beforeEach(()=> vi.useFakeTimers());
  afterEach(()=> vi.useRealTimers());
  const encoder=new TextEncoder();
  const frame=(name,data)=>`event: ${name}\ndata: ${JSON.stringify({type:name,...data})}\n\n`;
  const completedFrame=(text,extra=[])=>frame('response.completed',{response:{status:'completed',output:[...extra,{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:5,output_tokens:6,total_tokens:11}}});
  const eventStream=()=> { let controller;const stream=new ReadableStream({start(c) { controller=c; }});
    return {response:()=>new Response(stream,{status:200,headers:{'content-type':'text/event-stream'}}),send:text=>controller.enqueue(encoder.encode(text)),end:()=>controller.close()}; };
  const gateway=(onApi,calls=[])=>createDemoTransport({fetchImpl:async(url,init)=> { calls.push({url,init});
    if(url.endsWith('/session'))return json({token:'dmo_synthetic1234',expires_in:900},201);
    return url.endsWith('/models') ? json({data:[{id:'demo-auto',capabilities:{responses:true,multimodal:true}}]}) : onApi(url,init); }});
  const settle=async promise=> { let state='pending',value;promise.then(v=> { state='resolved';value=v; },e=> { state='rejected';value=e; });await vi.advanceTimersByTimeAsync(0);return ()=>({state,value}); };
  it('asks for a stream for text and not for images',async()=> {
    const calls=[];const transport=gateway(()=>json(reply),calls);await transport.discover();
    await transport.plan('demo-auto','text only');await transport.plan('demo-auto','with image',undefined,media);
    const bodies=calls.filter(c=>c.url.endsWith('/responses')).map(c=>JSON.parse(c.init.body));
    expect(bodies.map(b=>b.stream)).toEqual([true,false]);expect(bodies[1].input[1].content.some(part=>part.type==='input_image')).toBe(true);
  });
  it('returns the same text and usage from a stream as from a plain body',async()=> {
    const live=eventStream();const transport=gateway(()=>live.response());
    const outcome=await settle(transport.plan('demo-auto','x'));
    live.send(frame('response.created',{response:{status:'in_progress'}})+frame('response.output_text.delta',{delta:'{"kind"'})+frame('response.output_text.delta',{delta:':"answer"}'})+completedFrame('{"kind":"answer"}',[{type:'reasoning',content:[],encrypted_content:'ENCRYPTED',summary:[]}]));live.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome().state).toBe('resolved');expect(outcome().value).toEqual({text:'{"kind":"answer"}',usage:{prompt_tokens:5,completion_tokens:6,total_tokens:11}});expect(vi.getTimerCount()).toBe(0);
  });
  it('falls back to a plain body when the gateway answers a stream request with JSON',async()=> {
    const transport=gateway(()=>json(textReply('{"kind":"answer"}')));await transport.discover();
    expect((await transport.plan('demo-auto','x')).text).toBe('{"kind":"answer"}');
  });
  it('reports waiting, then received characters, and never goes back',async()=> {
    const live=eventStream(),seen=[];const transport=gateway(()=>live.response());
    const outcome=await settle(transport.plan('demo-auto','x',undefined,[],{onProgress:p=>seen.push(p)}));
    await vi.advanceTimersByTimeAsync(3_000);
    live.send(frame('response.output_text.delta',{delta:'a'.repeat(120)}));await vi.advanceTimersByTimeAsync(600);
    live.send(frame('response.output_text.delta',{delta:'b'.repeat(80)})+completedFrame('x'));live.end();await vi.advanceTimersByTimeAsync(600);
    expect(outcome().state).toBe('resolved');
    expect(seen[0]).toEqual({chars:0,elapsedMs:0});expect(seen.some(p=>p.chars===0&&p.elapsedMs>=2_500)).toBe(true);expect(seen.some(p=>p.chars===120)).toBe(true);expect(seen.at(-1).chars).toBeGreaterThanOrEqual(120);expect(seen.at(-1).chars).toBeLessThanOrEqual(200);
    for(let i=1;i<seen.length;i++)expect(seen[i].chars).toBeGreaterThanOrEqual(seen[i-1].chars);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a stream that stalls midway and does not retry',async()=> {
    const calls=[],live=eventStream();const transport=gateway(()=>live.response(),calls);
    const outcome=await settle(transport.plan('demo-auto','x'));
    live.send(frame('response.output_text.delta',{delta:'partial'}));await vi.advanceTimersByTimeAsync(59_999);expect(outcome().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome().value.code).toBe('AI_TIMEOUT');await vi.advanceTimersByTimeAsync(300_000);
    expect(calls.filter(c=>c.url.endsWith('/responses'))).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps Stop during a stream a cancellation',async()=> {
    const live=eventStream(),stop=new AbortController();const transport=gateway(()=>live.response());
    const outcome=await settle(transport.plan('demo-auto','x',stop.signal));
    live.send(frame('response.output_text.delta',{delta:'partial'}));await vi.advanceTimersByTimeAsync(5_000);stop.abort();await vi.advanceTimersByTimeAsync(0);
    expect(outcome().state).toBe('rejected');expect(outcome().value.name).toBe('AbortError');expect(outcome().value.code).not.toBe('AI_TIMEOUT');expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects a streamed tool call and a stream cut off before completion',async()=> {
    const toolCall=eventStream(),transport=gateway(()=>toolCall.response());
    const first=await settle(transport.plan('demo-auto','x'));
    toolCall.send(completedFrame('{}',[{type:'function_call',name:'run'}]));toolCall.end();await vi.advanceTimersByTimeAsync(0);
    expect(first().value.code).toBe('MALFORMED_PROPOSAL');
    const cut=eventStream(),second=await settle(gateway(()=>cut.response()).plan('demo-auto','x'));
    cut.send(frame('response.output_text.delta',{delta:'{'}));cut.end();await vi.advanceTimersByTimeAsync(0);
    expect(second().value.code).toBe('MALFORMED_PROPOSAL');
  });
});

