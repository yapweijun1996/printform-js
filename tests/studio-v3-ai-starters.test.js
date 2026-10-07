import {describe,it,expect} from 'vitest';
import {STARTERS} from '../studio-v3/ai-welcome.js';
import {readOnlyRequest} from '../studio-v3/ai-chat-protocol.js';

// A starter fills the message box with ready wording. If the wording reads like a question, the request is judged
// read-only and every proposal the model returns is rejected, so each starter must be an edit request.
describe('starting actions',()=> {
  it.each(STARTERS.map(([,label,prompt])=>[label,prompt]))('%s is judged an edit request, not a question',(label,prompt)=> {
    expect(readOnlyRequest(prompt)).toBe(false);
  });
  it('still treats a genuine font question as read-only',()=> {
    expect(readOnlyRequest('What are the current font sizes?')).toBe(true);
  });
  it.each(['Improve the font sizes','Tighten the table spacing','Enhance the title font','Can you improve the font sizes?'])('%s is an edit',request=> {
    expect(readOnlyRequest(request)).toBe(false);
  });
});
