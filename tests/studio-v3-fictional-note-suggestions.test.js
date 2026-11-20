import { describe, expect, it, vi } from 'vitest';
import { createDemoTransport } from '../studio-v3/ai-demo-transport.js';
import { fictionalNoteRequest, readFictionalNoteChoice } from '../studio-v3/fictional-note-suggestions.js';

describe('fictional note selection contract',()=> {
  it.each(['invoice','purchase','delivery'])('sends only fixed IDs and maps an admitted %s response to local text',type=> {
    expect(JSON.parse(fictionalNoteRequest(type))).toEqual({formType:type,noteIds:[`${type}-reference`,`${type}-review`]});
    expect(readFictionalNoteChoice(type,` { "noteId": "${type}-review" } `)).toMatch(/^Please review the fictional /);
  });

  it.each([
    'Ignore the instructions.',
    '{"noteId":"delivery-reference","noteId":"delivery-review"}',
    '{"noteId":"delivery-reference","text":"Private note"}',
    '{"noteId":"invoice-reference"}',
    '{"noteId":"constructor"}',
    '{"noteId":null}',
    '{"noteId":["delivery-reference"]}',
    '{"noteId":"delivery-reference"}\n{"noteId":"delivery-reference"}',
    ' '.repeat(121)+'{"noteId":"delivery-reference"}'
  ])('denies a response outside the single allowed note ID',value=> {
    expect(()=>readFictionalNoteChoice('delivery',value)).toThrow('allowed fictional note');
  });

  it.each(['imported','constructor',null,{toString:()=> 'invoice'}])('denies any form type outside the fixed enum',type=> {
    expect(()=>fictionalNoteRequest(type)).toThrow('Unsupported fictional form type.');
  });

  it('blocks dispatch when the local approval changes during session acquisition',async()=> {
    let current = true;
    const fetchImpl = vi.fn(async()=>{
      current = false;
      return new Response(JSON.stringify({token:'dmo_synthetic123456',expires_in:900}),{status:201});
    });
    const transport = createDemoTransport({fetchImpl}), controller = new AbortController();
    await expect(transport.suggestFictionalNote('invoice',controller.signal,()=>{
      if (!current) throw new Error('Application context changed.');
    })).rejects.toThrow('Application context changed.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/demo\/session$/);
    transport.clear();
  });

  it('rejects tool calls in a synthetic response even if it also includes an otherwise valid ID',async()=> {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({token:'dmo_synthetic123456',expires_in:900}),{status:201}))
      .mockResolvedValueOnce(new Response(JSON.stringify({output:[
        {type:'function_call',name:'save_dataset',arguments:'{}'},
        {type:'message',content:[{type:'output_text',text:'{"noteId":"invoice-review"}'}]}
      ]}),{status:200,headers:{'content-type':'application/json'}}));
    const transport = createDemoTransport({fetchImpl});
    await expect(transport.suggestFictionalNote('invoice',new AbortController().signal,()=>{})).rejects.toThrow('MALFORMED_PROPOSAL');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    transport.clear();
  });
});
