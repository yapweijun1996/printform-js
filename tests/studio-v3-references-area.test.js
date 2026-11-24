import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {html,setup,visualPanel} from './support/chat-panel.js';
import {setAgentEnabled} from '../studio-v3/agent-preference.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;setAgentEnabled(false);});
afterEach(()=> localStorage.clear());


it('does not expose PDF visual mode and directs visual work to bounded raster files',()=> {
 const {panel}=setup(),files=panel.referenceFiles;vi.spyOn(files.input,'click').mockImplementation(()=>{});
 expect(files.root.hidden).toBe(true);files.pick();expect(files.root.hidden).toBe(false);
 expect(files.root.querySelector('[aria-label="PDF reading for new attachments"]')).toBeNull();
 expect(files.notice.textContent).toContain('Export PDF pages as PNG/JPEG/WebP');
 const image=visualPanel('image').panel.referenceFiles;image.clear();expect(image.root.hidden).toBe(true);
});


it('removes a reference explicitly without retaining its shared context',()=> {
 const {panel}=visualPanel('image'),files=panel.referenceFiles;
 files.list.querySelector('button').click();
 expect(files.files).toEqual([]);expect(files.projection().references).toEqual([]);expect(files.root.hidden).toBe(true);
});


it('prevents removing an attachment during a run and permits it after the run',()=> {
 const {panel}=visualPanel('image'),files=panel.referenceFiles;
 files.setBusy(true);files.list.querySelector('button').click();
 expect(files.files).toHaveLength(1);expect(files.list.querySelector('button').disabled).toBe(true);
 files.setBusy(false);files.list.querySelector('button').click();
 expect(files.files).toEqual([]);expect(files.root.hidden).toBe(true);
});
