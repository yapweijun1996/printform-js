import { describe,it,expect } from 'vitest';
import { assertImageParts,buildResponsesBody,extractOutputText,responsesResult,responsesUsage } from '../studio-v3/ai-responses-wire.js';
const png={type:'input_image',image_url:'data:image/png;base64,iVBORw0KGgo='};
const message=(...parts)=>({type:'message',content:parts});
const text=value=>({type:'output_text',text:value});
describe('Responses request body',()=> {
  it('builds the closed text body: alias, no streaming, system then user input_text',()=> {
    expect(JSON.parse(buildResponsesBody({alias:'demo-auto',system:'SYS',request:'hello'}))).toEqual({
      model:'demo-auto',stream:false,input:[
        {role:'system',content:[{type:'input_text',text:'SYS'}]},
        {role:'user',content:[{type:'input_text',text:'hello'}]}]});
  });
  it('appends images after the user text and adds nothing else',()=> {
    const body=JSON.parse(buildResponsesBody({alias:'demo-auto',system:'S',request:'r',media:[png]}));
    expect(body.input[1].content).toEqual([{type:'input_text',text:'r'},png]);
    expect(Object.keys(body).sort()).toEqual(['input','model','stream']);
    expect(JSON.stringify(body)).not.toMatch(/tools|tool_choice|instructions|Origin|Authorization/);
  });
  it('refuses a body above the gateway JSON limit',()=> expect(()=>buildResponsesBody({alias:'demo-auto',system:'S',request:'界'.repeat(4*1024*1024)})).toThrow('UNSAFE_PROPOSAL'));
});
describe('image parts',()=> {
  it('accepts png, jpeg and webp base64 data URLs up to four images',()=> {
    expect(()=>assertImageParts([png])).not.toThrow();
    for(const kind of ['jpeg','webp'])expect(()=>assertImageParts([{type:'input_image',image_url:`data:image/${kind};base64,AAAA`}])).not.toThrow();
    expect(()=>assertImageParts(Array(4).fill(png))).not.toThrow();
  });
  it.each([
    ['http link',[{type:'input_image',image_url:'https://example.test/a.png'}]],
    ['svg',[{type:'input_image',image_url:'data:image/svg+xml;base64,AAAA'}]],
    ['detail override',[{...png,detail:'high'}]],
    ['file part',[{type:'input_file',file_id:'x'}]],
    ['five images',Array(5).fill(png)],
    ['oversized url',[{type:'input_image',image_url:'data:image/png;base64,'+'A'.repeat(5592508)}]],
    ['over total',Array(3).fill({type:'input_image',image_url:'data:image/png;base64,'+'A'.repeat(3*1024*1024)})]
  ])('rejects %s',(_,media)=> expect(()=>assertImageParts(media)).toThrow('UNSAFE_PROPOSAL'));
});
describe('output text extraction',()=> {
  it('joins every output_text across message items',()=> expect(extractOutputText({status:'completed',output:[message(text('{"a":'),text('1}')),message(text(' '))]})).toBe('{"a":1} '));
  it('accepts a response without a status field',()=> expect(extractOutputText({output:[message(text('ok'))]})).toBe('ok'));
  it('ignores reasoning and benign unknown items or content parts',()=> {
    const payload={status:'completed',output:[{type:'reasoning',summary:[]},{type:'future_item',x:1},message({type:'annotation_note',x:1},text('ok'))]};
    expect(extractOutputText(payload)).toBe('ok');
  });
  it.each([
    ['truncated',{status:'incomplete',output:[message(text('{'))]}],
    ['function call',{status:'completed',output:[{type:'function_call',name:'run'},message(text('{}'))]}],
    ['other tool call',{output:[{type:'web_search_call'},message(text('{}'))]}],
    ['refusal',{status:'completed',output:[message(text('{}'),{type:'refusal',refusal:'no'})]}],
    ['empty output',{status:'completed',output:[]}],
    ['no text part',{status:'completed',output:[message({type:'output_image'})]}],
    ['not an array',{status:'completed',output:'text'}],
    ['missing',{}],['null',null]
  ])('rejects %s',(_,payload)=> expect(()=>extractOutputText(payload)).toThrow('MALFORMED_PROPOSAL'));
});
describe('usage mapping',()=> {
  it('maps Responses token names to the names the harness reads',()=> expect(responsesUsage({usage:{input_tokens:3,output_tokens:4,total_tokens:7}})).toEqual({prompt_tokens:3,completion_tokens:4,total_tokens:7}));
  it('leaves tokens unknown when usage is absent',()=> expect(responsesUsage({})).toEqual({prompt_tokens:undefined,completion_tokens:undefined,total_tokens:undefined}));
  it('returns text and usage together',()=> expect(responsesResult({output:[message(text('x'))],usage:{total_tokens:2}})).toEqual({text:'x',usage:{prompt_tokens:undefined,completion_tokens:undefined,total_tokens:2}}));
});
