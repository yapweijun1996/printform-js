import {beforeEach,it,expect,vi} from 'vitest';
import {html,setup,visualPanel} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
it.each(['image','pdf'])('keeps discovered image permission after token cleanup and sends a %s reference only after fresh discovery',async kind=>{
 const {panel,transport,calls}=visualPanel(kind);
 expect(panel.node('[data-ai-send]').disabled).toBe(true);await panel.discover();
 expect(transport.supportsImages('demo-fast')).toBe(true);expect(panel.node('[data-ai-send]').disabled).toBe(false);
 expect(panel.referenceFiles.capability.textContent).toContain('Images available');expect(panel.referenceFiles.diagnosticText.textContent).toContain('capabilities.multimodal');
 await panel.send();expect(calls.filter(c=>c.url.endsWith('/models'))).toHaveLength(2);expect(calls.filter(c=>c.url.endsWith('/responses'))).toHaveLength(1);
 expect(calls.filter(c=>c.url.endsWith('/session'))).toHaveLength(2);expect(panel.conversation.messages.at(-1).text).toBe('Fictional reference reviewed.');
 expect(panel.getBus().revision).toBe(0);expect(panel.proposal).toBeNull();expect(transport.supportsImages('demo-fast')).toBe(true);expect(panel.node('[data-ai-send]').disabled).toBe(false);
 panel.cancel();expect(transport.supportsImages('demo-fast')).toBe(false);expect(panel.referenceFiles.diagnosticText.textContent).not.toContain('capabilities.multimodal');expect(panel.node('[data-ai-send]').disabled).toBe(true);
});
it('fresh capability revocation blocks attached pixels before any inference request',async()=>{
 const {panel,calls,state}=visualPanel();await panel.discover();state.enabled=false;await panel.send();
 expect(calls.some(c=>c.url.endsWith('/responses') || c.url.endsWith('/chat/completions'))).toBe(false);
 expect(panel.node('[data-ai-send]').disabled).toBe(true);expect(panel.conversation.messages.at(-1).text).toContain('Image analysis is unavailable');expect(panel.getBus().revision).toBe(0);
});
it('failed rediscovery closes image Send until a later successful check',async()=>{
 const {panel,transport,state}=visualPanel();await panel.discover();state.status=500;await panel.discover();
 expect(transport.capabilityDiagnostics()).toEqual([]);expect(panel.node('[data-ai-send]').disabled).toBe(true);
 state.status=200;await panel.discover();expect(panel.node('[data-ai-send]').disabled).toBe(false);
});

it.each(['image','pdf'])('offers a metadata-only image support check beside a newly attached %s',async kind=>{
 const {panel,calls}=visualPanel(kind),button=panel.referenceFiles.checkSupport,send=vi.spyOn(panel,'send');
 expect(calls).toEqual([]);expect(button.textContent).toBe('Check image support');expect(button.type).toBe('button');expect(button.hidden).toBe(false);expect(button.disabled).toBe(false);expect(panel.referenceFiles.root.open).toBe(true);
 button.click();expect(button.disabled).toBe(true);expect(panel.referenceFiles.capability.textContent).toContain('Checking image support');
 await vi.waitFor(()=>expect(button.hidden).toBe(true));
 expect(send).not.toHaveBeenCalled();expect(calls.map(c=>new URL(c.url).pathname)).toEqual(['/demo/session','/demo/v1/models']);
 expect(calls[1].init.body).toBeUndefined();expect(JSON.stringify(calls)).not.toContain('data:image');expect(panel.node('[data-ai-send]').disabled).toBe(false);
 const before=calls.length;panel.contextChanged(true);expect(button.hidden).toBe(false);expect(panel.node('[data-ai-send]').disabled).toBe(true);expect(calls).toHaveLength(before);
 panel.referenceFiles.files=[];panel.referenceFiles.changed();expect(button.hidden).toBe(true);
});
it('keeps the support check disabled while reading or waiting for metadata, then offers retry after failure',async()=>{
 const {panel,calls,state}=visualPanel(),files=panel.referenceFiles,button=files.checkSupport;
 files.reading=true;panel.update();expect(button.disabled).toBe(true);button.click();expect(calls).toEqual([]);
 files.reading=false;panel.update();let release;state.hold=new Promise(resolve=>release=resolve);state.status=500;
 button.click();await vi.waitFor(()=>expect(calls.some(c=>c.url.endsWith('/models'))).toBe(true));
 expect(button.disabled).toBe(true);button.click();expect(calls).toHaveLength(2);release();
 await vi.waitFor(()=>expect(button.disabled).toBe(false));expect(button.hidden).toBe(false);expect(panel.node('[data-ai-send]').disabled).toBe(true);
 expect(files.capability.getAttribute('role')).toBe('status');expect(files.capability.textContent).toContain('check or retry');expect(panel.node('[data-ai-status]').textContent).toContain('Demo request failed');
 state.hold=null;state.status=200;button.click();await vi.waitFor(()=>expect(button.hidden).toBe(true));expect(panel.node('[data-ai-send]').disabled).toBe(false);
});
it('unknown support stays blocked after checking, and a revoked grant exposes the same check again',async()=>{
 const {panel,calls,state}=visualPanel(),button=panel.referenceFiles.checkSupport;state.enabled=undefined;
 button.click();await vi.waitFor(()=>expect(panel.busy).toBe(false));expect(button.hidden).toBe(false);expect(panel.node('[data-ai-send]').disabled).toBe(true);
 state.enabled=true;button.click();await vi.waitFor(()=>expect(button.hidden).toBe(true));state.enabled=false;await panel.send();
 expect(button.hidden).toBe(false);expect(button.disabled).toBe(false);expect(panel.node('[data-ai-send]').disabled).toBe(true);
 expect(panel.conversation.messages.at(-1).text).toContain('Check image support');expect(calls.every(c=>c.url.endsWith('/session') || c.url.endsWith('/models'))).toBe(true);
});
it('says what the image support check found when the model does not report it',async()=> {
  const {panel,state}=visualPanel('image'),files=panel.referenceFiles;state.enabled=false;
  expect(files.capability.textContent).toContain('Use Check image support');
  files.checkSupport.click();
  await vi.waitFor(()=>expect(files.capability.textContent).not.toContain('Checking'));
  expect(files.capability.textContent).toContain('did not report image support');
  expect(files.capability.textContent).not.toContain('to check or retry');
  expect(files.checkSupport.hidden).toBe(false);expect(panel.node('[data-ai-send]').disabled).toBe(true);
});
