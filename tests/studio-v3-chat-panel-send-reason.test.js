import {beforeEach,describe,it,expect} from 'vitest';
import {html,setup,visualPanel} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});

// When Send is off for a reason the user cannot see in the conversation, the reason sits right under the message box.
const reason=panel=>panel.node('[data-ai-send-reason]');
describe('why Send is off',()=> {
  it('is silent while Send works',()=> {
    const {panel}=setup();panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(false);expect(reason(panel).textContent).toBe('');expect(reason(panel).hidden).toBe(true);
  });
  it('names the missing image support and what to do about it, tied to the Send button',()=> {
    const {panel}=visualPanel('image');panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(true);
    expect(reason(panel).hidden).toBe(false);expect(reason(panel).textContent).toContain('image support is not confirmed');expect(reason(panel).textContent).toContain('Check image support');
    expect(panel.node('[data-ai-send]').getAttribute('aria-describedby')).toBe(reason(panel).id);
  });
  it('goes away once image support is confirmed',async()=> {
    const {panel}=visualPanel('image');panel.update();
    await panel.referenceFiles.checkImageSupport();panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(false);expect(reason(panel).hidden).toBe(true);
  });
  it('says references are still being read',()=> {
    const {panel}=setup();panel.referenceFiles.reading=true;panel.update();
    expect(panel.node('[data-ai-send]').disabled).toBe(true);expect(reason(panel).textContent).toContain('Reading references');
  });
});
