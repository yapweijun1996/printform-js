import {afterEach,beforeEach,it,expect} from 'vitest';
import {html,setup,visualPanel} from './support/chat-panel.js';
import {setAgentEnabled} from '../studio-v3/agent-preference.js';
// The references area keeps one visible attach control, shows only choices that apply, and leaves developer
// diagnostics to the settings menu.
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;setAgentEnabled(false);});
afterEach(()=> localStorage.clear());

it('keeps the native file picker reachable by name but invisible and out of the tab order',()=> {
 const {panel}=setup(),input=panel.referenceFiles.input,label=input.closest('label');
 expect(label.textContent).toBe('Add reference PDF or image');expect(label.classList.contains('sr-only')).toBe(true);
 expect(input.tabIndex).toBe(-1);expect(panel.node('.ai-plus').getAttribute('aria-label')).toBe('Attach reference');
});

it('offers the PDF reading choice until only images are attached, and again once they are removed',()=> {
 const {panel}=setup(),files=panel.referenceFiles;
 expect(files.modeLabel.hidden).toBe(false);
 const image=visualPanel('image').panel.referenceFiles;expect(image.modeLabel.hidden).toBe(true);
 image.clear();expect(image.modeLabel.hidden).toBe(false);
 expect(visualPanel('pdf').panel.referenceFiles.modeLabel.hidden).toBe(false);
});

it('names a plain image by its file name alone, but keeps pages and the no-text note for a PDF',()=> {
 const image=visualPanel('image').panel.referenceFiles,pdf=visualPanel('pdf').panel.referenceFiles;
 expect(image.list.textContent).toContain('fictional.png');expect(image.list.textContent).not.toMatch(/page\(s\)|no extracted text/);
 expect(pdf.list.textContent).toContain('fictional.pdf · 1 page(s) · image-only, no extracted text');
});

it('keeps the capability diagnostic in the settings menu, not in the references area',()=> {
 const {panel}=setup(),files=panel.referenceFiles,body=panel.node('.ai-settings-body');
 expect(body.contains(files.diagnostics)).toBe(true);expect(files.root.contains(files.diagnostics)).toBe(false);
 expect(files.diagnostics.querySelector('summary').textContent).toBe('Observed model capabilities');
});
