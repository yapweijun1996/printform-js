import { describe,it,expect } from 'vitest';
import { createSseParser,parseFrame } from '../studio-v3/ai-sse.js';
const wire = [
  'event: response.created\ndata: {"type":"response.created","n":0}\n\n',
  ': keep-alive comment\n\n',
  'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"391"}\n\n',
  'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\n'
].join('');
const names = frames => frames.map(f=>f.event);
const feed = chunks => { const parser=createSseParser(); return chunks.flatMap(chunk=>parser.push(chunk)); };
describe('SSE parser',()=> {
  it('parses frames, skipping comments',()=> {
    const frames=feed([wire]);expect(names(frames)).toEqual(['response.created','response.output_text.delta','response.completed']);
    expect(JSON.parse(frames[1].data).delta).toBe('391');
  });
  it('gives the same frames however the stream is cut',()=> {
    const expected=feed([wire]);
    for(let cut=0;cut<=wire.length;cut++)expect(feed([wire.slice(0,cut),wire.slice(cut)])).toEqual(expected);
    expect(feed([...wire])).toEqual(expected);
  });
  it('keeps CRLF framing even when the pair is split between chunks',()=> {
    const crlf=wire.replace(/\n/g,'\r\n'),expected=feed([wire]);
    expect(feed([crlf])).toEqual(expected);
    for(let cut=0;cut<=crlf.length;cut++)expect(feed([crlf.slice(0,cut),crlf.slice(cut)])).toEqual(expected);
  });
  it('joins multi-line data and accepts a field without the optional space',()=> {
    expect(parseFrame('event: x\ndata: a\ndata:b')).toEqual({event:'x',data:'a\nb'});
    expect(parseFrame('data:{"k":1}')).toEqual({event:'',data:'{"k":1}'});
  });
  it('ignores comments, unknown fields, ids and retry hints',()=> {
    expect(parseFrame(': hi\nid: 7\nretry: 100\nfoo: bar')).toBeNull();
    expect(parseFrame('id: 7\nevent: y\ndata: z')).toEqual({event:'y',data:'z'});
  });
  it('never emits a frame cut off by the end of the stream',()=> {
    expect(names(feed(['event: a\ndata: 1\n\nevent: b\ndata: 2']))).toEqual(['a']);
    expect(feed(['event: a\ndata: 1\n'])).toEqual([]);
  });
  it('keeps an empty data field as an empty string',()=> expect(parseFrame('event: ping\ndata:')).toEqual({event:'ping',data:''}));
  it('handles many frames in one chunk and ignores stray blank lines',()=> {
    const many=Array.from({length:500},(_,i)=>`event: e${i}\ndata: ${i}\n\n`).join('')+'\n\n\n';
    expect(feed([many])).toHaveLength(500);
  });
});
