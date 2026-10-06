import { describe,it,expect,vi,beforeEach,afterEach } from 'vitest';
import { createProgress,progressText,readEventStream,readJsonBody } from '../studio-v3/ai-response-reader.js';
import { responsesResult } from '../studio-v3/ai-responses-wire.js';
// Frames follow the live capture of 2026-10-06; the opaque encrypted_content is a placeholder.
const frame = (name,data) => `event: ${name}\ndata: ${JSON.stringify({type:name,...data})}\n\n`;
const message = text => ({id:'msg_1',type:'message',status:'completed',content:[{type:'output_text',annotations:[],logprobs:[],text}],phase:'final_answer',role:'assistant'});
const reasoning = {id:'rs_1',type:'reasoning',content:[],encrypted_content:'ENCRYPTED',summary:[]};
const finalResponse = (text,extra={}) => ({id:'resp_1',object:'response',status:'completed',model:'demo-auto',output:[reasoning,message(text)],usage:{input_tokens:22,output_tokens:20,output_tokens_details:{reasoning_tokens:13},total_tokens:42},...extra});
const liveStream = (text='ok',deltas=[text]) => [
  frame('response.created',{response:{status:'in_progress',output:[]}}),
  frame('response.in_progress',{response:{status:'in_progress',output:[]}}),
  frame('response.output_item.added',{item:reasoning,output_index:0}),
  frame('response.output_item.done',{item:reasoning,output_index:0}),
  frame('response.output_item.added',{item:{id:'msg_1',type:'message',status:'in_progress',content:[]},output_index:1}),
  frame('response.content_part.added',{part:{type:'output_text',text:''}}),
  ...deltas.map(delta=>frame('response.output_text.delta',{delta,item_id:'msg_1',obfuscation:'xx'})),
  frame('response.output_text.done',{text}),
  frame('response.content_part.done',{part:{type:'output_text',text}}),
  frame('response.output_item.done',{item:message(text),output_index:1}),
  frame('response.completed',{response:finalResponse(text)})
].join('');
const readerOf = (text,{bytes=false,chunk=0}={}) => {
  const data=new TextEncoder().encode(text),chunks=[];
  if(bytes)for(const byte of data)chunks.push(Uint8Array.of(byte));
  else if(chunk)for(let i=0;i<data.length;i+=chunk)chunks.push(data.slice(i,i+chunk));
  else chunks.push(data);
  return new ReadableStream({start(controller) { for(const part of chunks)controller.enqueue(part);controller.close(); }}).getReader();
};
const quiet = {addChars() {},stop() {}};
const signal = () => new AbortController().signal;
describe('event stream reader',()=> {
  it('returns the completed response of a real stream, judged by the usual rules',async()=> {
    const response=await readEventStream(readerOf(liveStream('ok')),signal(),quiet);
    expect(responsesResult(response)).toEqual({text:'ok',usage:{prompt_tokens:22,completion_tokens:20,total_tokens:42}});
  });
  it('counts delta characters for progress without using them as the answer',async()=> {
    const counts=[];await readEventStream(readerOf(liveStream('{"a":1}',['{"a"',':1}'])),signal(),{addChars:n=>counts.push(n),stop() {}});
    expect(counts).toEqual([4,3]);
  });
  it('reads the same result however the bytes are cut, even inside a multi-byte character',async()=> {
    const text='{"message":"界面设置"}',whole=await readEventStream(readerOf(liveStream(text,[text])),signal(),quiet);
    for(const options of [{bytes:true},{chunk:7},{chunk:64}])expect(await readEventStream(readerOf(liveStream(text,[text.slice(0,12),text.slice(12)]),options),signal(),quiet)).toEqual(whole);
    expect(responsesResult(whole).text).toBe(text);
  });
  it('rejects a tool call inside a completed stream exactly like a plain body',async()=> {
    const bad=finalResponse('x');bad.output.unshift({type:'function_call',name:'run'});
    const response=await readEventStream(readerOf(frame('response.completed',{response:bad})),signal(),quiet);
    expect(()=>responsesResult(response)).toThrow('MALFORMED_PROPOSAL');
  });
  it.each([
    ['ends without completed',liveStream('ok').split('event: response.completed')[0],'MALFORMED_PROPOSAL'],
    ['is incomplete',frame('response.created',{})+frame('response.incomplete',{response:{status:'incomplete'}}),'MALFORMED_PROPOSAL'],
    ['fails with an unusable model',frame('response.failed',{response:{error:{code:'DEMO_MODEL_NOT_ALLOWED',message:'x'}}}),'DEMO_MODEL_UNAVAILABLE'],
    ['fails for another reason',frame('response.failed',{response:{error:{code:'SERVER_ERROR',message:'x'}}}),'DEMO_REQUEST_FAILED'],
    ['reports an error event',frame('error',{error:{code:'x',message:'boom'}}),'DEMO_REQUEST_FAILED'],
    ['is empty','', 'MALFORMED_PROPOSAL']
  ])('a stream that %s is %s',async(_,text,code)=> {
    await expect(readEventStream(readerOf(text),signal(),quiet)).rejects.toMatchObject({code});
  });
  it('ignores frames that are not JSON and unknown events',async()=> {
    const text='event: ping\ndata: not json\n\n'+frame('response.mystery',{x:1})+liveStream('ok');
    expect(responsesResult(await readEventStream(readerOf(text),signal(),quiet)).text).toBe('ok');
  });
  it('stops a stream that grows past the limit',async()=> {
    await expect(readEventStream(readerOf(frame('response.output_text.delta',{delta:'x'.repeat(260_000)})),signal(),quiet)).rejects.toMatchObject({code:'DEMO_RESPONSE_LIMIT'});
  });
  it('reports a cancelled read as the caller\'s abort, not as a malformed stream',async()=> {
    const stop=new AbortController();stop.abort();
    await expect(readEventStream(readerOf(liveStream('ok').split('event: response.completed')[0]),stop.signal,quiet)).rejects.toMatchObject({name:'AbortError'});
  });
});
describe('json body reader',()=> {
  it('parses a plain body and enforces the plain limit',async()=> {
    expect(await readJsonBody(readerOf('{"a":1}'),signal())).toEqual({a:1});
    await expect(readJsonBody(readerOf('x'.repeat(65_000)),signal())).rejects.toMatchObject({code:'DEMO_RESPONSE_LIMIT'});
  });
});
describe('progress',()=> {
  beforeEach(()=> vi.useFakeTimers());
  afterEach(()=> vi.useRealTimers());
  it('keeps elapsed time moving while the gateway is silent',async()=> {
    let clock=0;const seen=[];const progress=createProgress(p=>seen.push(p),()=>clock);
    for(const t of [500,1000,1500]) { clock=t;await vi.advanceTimersByTimeAsync(500); }
    progress.stop();expect(seen.map(p=>p.elapsedMs)).toEqual([0,500,1000,1500]);expect(seen.every(p=>p.chars===0)).toBe(true);
  });
  it('is throttled and never goes backwards',()=> {
    let clock=0;const seen=[];const progress=createProgress(p=>seen.push(p),()=>clock);
    for(let i=1;i<=20;i++) { clock=i*100;progress.addChars(10); }
    progress.stop();
    expect(seen.length).toBeLessThanOrEqual(5);
    for(let i=1;i<seen.length;i++) { expect(seen[i].chars).toBeGreaterThanOrEqual(seen[i-1].chars);expect(seen[i].elapsedMs).toBeGreaterThan(seen[i-1].elapsedMs); }
  });
  it('leaves no timer behind and costs nothing without a listener',()=> {
    const progress=createProgress(()=> {});expect(vi.getTimerCount()).toBe(1);progress.stop();expect(vi.getTimerCount()).toBe(0);
    createProgress().stop();expect(vi.getTimerCount()).toBe(0);
  });
  it('words the status by what has arrived',()=> {
    expect(progressText({chars:0,elapsedMs:12_400})).toBe('Waiting for the AI service · 12 s');
    expect(progressText({chars:1204,elapsedMs:6_900})).toBe('Receiving response · 1,204 characters · 6 s');
  });
});
