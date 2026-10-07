import {beforeEach,it,expect,vi} from 'vitest';
import {AIPanel} from '../studio-v3/ai-panel.js';
import {PaperPreview} from '../studio-v3/preview.js';
import {AIElementTags} from '../studio-v3/ai-element-tags.js';
import {newProject} from '../studio-v3/model.js';
import {createBus,editProject,designOperations} from '../studio-v3/controller.js';
import {html,setup} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
it('requires renewed review if measured facts change after consent, before any gateway call',async()=> {
  let facts=[];const {panel,calls}=setup({facts:()=>facts});
  facts=[{id:'header',role:'title',pt:18}];await panel.send();expect(calls()).toBe(0);expect(panel.node('#ai-consent')).toBeNull();expect(panel.request()).toContain('18');expect(panel.node('[data-ai-status]').textContent).toContain('updated');
});
it('expires a response/card after selection moves away and back, preserving canonical revision',async()=> {
  const {panel,select}=setup();await panel.send();const bus=panel.getBus();expect(panel.proposal).toBeTruthy();select('customer');select('items');expect(panel.proposal).toBeNull();expect(bus.revision).toBe(0);expect(panel.conversation.messages.at(-1).status).toBe('expired');
});
it('keeps a completed edit attached to its captured bus when navigation replaces the document during render',async()=> {
  let release,started;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const {panel,changeBus}=setup({commit:async proposal=> {await editProject(proposal.bus,designOperations(proposal.bus.project,proposal.design),'AI');const result={bus:proposal.bus,revision:proposal.bus.revision};started();await held;return result;}});
  await panel.send();await panel.preview();const oldBus=panel.getBus(),running=panel.apply();await ready;const current=changeBus();release();await running;
  const card=panel.conversation.messages.find(m=>m.diff);expect(card.status).toBe('applied');expect(card.appliedBus).toBe(oldBus);expect(card.appliedRevision).toBe(1);expect(current.revision).toBe(0);expect(panel.canUndo(card)).toBe(false);expect(panel.node('[data-ai-status]').textContent).toContain('previous form');
});
it('binds typography to the committed document/revision, rejecting old, candidate and blocked contexts',()=> {
  const paper=new PaperPreview(document.querySelector('#preview-frame'),()=>{},()=>{}),project=createBus(newProject()).project;
  paper.committedFacts={documentId:project.manifest.documentId,revision:project.revision,design:JSON.stringify(project.manifest.studioV3),facts:[{id:'header',role:'title',pt:18}]};
  expect(paper.factsFor(project)).toHaveLength(1);expect(paper.factsFor({...project,revision:project.revision+1})).toEqual([]);
  const other=structuredClone(project);other.manifest.documentId='v3-other';expect(paper.factsFor(other)).toEqual([]);
  const candidate=structuredClone(project);candidate.manifest.studioV3.font=10;expect(paper.factsFor(candidate)).toEqual([]);
  paper.committedFacts=null;expect(paper.factsFor(project)).toEqual([]);
});

it('rejects a late provider reply when selection changes away and back during a request',async()=> {
  let release,started;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const {panel,select}=setup({plan:async()=> {started();return held;}}),running=panel.send();await ready;select('customer');select('items');release({text:JSON.stringify({kind:'proposal',summary:'Late',edits:[{target:'style',property:'color',value:'#163a65'}]})});await running;
  expect(panel.proposal).toBeNull();expect(panel.getBus().revision).toBe(0);expect(panel.conversation.messages.some(m=>m.diff)).toBe(false);expect(panel.busy).toBe(false);
});
it('rechecks scope/selection when an Apply waits in the command queue',async()=> {
  let release,started,panel,restores=0;const held=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const result=setup({restore:async()=> {restores++;},commit:async(proposal,generation)=> {started();await held;panel.assertCurrent(proposal,generation);throw new Error('must not reach commit');}});panel=result.panel;
  await panel.send();await panel.preview();const running=panel.apply();await ready;result.select('customer');expect(panel.viewing).toBe(true);expect(panel.node('#ai-prompt').disabled).toBe(true);release();await running;
  expect(panel.getBus().revision).toBe(0);expect(panel.proposal).toBeNull();expect(panel.node('[data-ai-status]').textContent).toContain('Nothing changed');expect(restores).toBe(1);expect(panel.viewing).toBe(false);
});

it('keeps the unapplied banner/print protection if canonical restoration itself fails',async()=> {
  const {panel}=setup({commit:async()=> {throw new Error('blocked');},restore:async()=> {throw new Error('restore failed');}});
  await panel.send();await panel.preview();await panel.apply();expect(panel.viewing).toBe(true);expect(document.querySelector('#ai-preview-banner').hidden).toBe(false);expect(panel.node('[data-ai-status]').textContent).toContain('restore the form before printing');expect(panel.getBus().revision).toBe(0);
});
it('keeps candidate print protection when a new Send or Discard cannot restore canonical paper',async()=> {
  const {panel,calls}=setup({restore:async()=>{throw new Error('restore failed');}});
  await panel.send();expect(panel.viewing).toBe(true);panel.node('#ai-prompt').value='Another request';panel.share();await panel.send();
  expect(calls()).toBe(1);expect(panel.viewing).toBe(true);expect(document.querySelector('#ai-preview-banner').hidden).toBe(false);
  await panel.discard();expect(panel.viewing).toBe(true);expect(panel.node('[data-ai-status]').textContent).toContain('before printing');expect(panel.getBus().revision).toBe(0);
});
it('an older restoration cannot unlock Send while a newer selection restoration is still pending',async()=> {
  let release1,release2,calls=0;const one=new Promise(r=>release1=r),two=new Promise(r=>release2=r);
  const {panel,select}=setup({restore:()=>++calls===1 ? one : two});await panel.send();const stopped=panel.stop();select('customer');
  release1();await stopped;expect(panel.restoring).toBe(true);expect(panel.node('[data-ai-send]').disabled).toBe(true);
  release2();await new Promise(r=>setTimeout(r,0));expect(panel.restoring).toBe(false);expect(panel.viewing).toBe(false);
});
it('Clear keeps candidate print protection and does not reject if canonical restoration fails',async()=> {
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
  try {const {panel}=setup({restore:async()=>{throw new Error('restore failed');}});await panel.send();await expect(panel.clear()).resolves.toBeUndefined();expect(panel.viewing).toBe(true);expect(document.querySelector('#ai-preview-banner').hidden).toBe(false);expect(panel.conversation.messages).toHaveLength(0);expect(panel.node('[data-ai-status]').textContent).toContain('before printing');}
  finally {confirm.mockRestore();}
});

it('changing reference choices restores canonical paper and never unlocks candidate printing early',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);const restore=vi.fn(()=>wait);const {panel}=setup({restore});
 await panel.send();expect(panel.viewing).toBe(true);panel.referenceFiles.changed();
 expect(panel.proposal).toBeNull();expect(panel.restoring).toBe(true);expect(panel.viewing).toBe(true);expect(restore).toHaveBeenCalledTimes(1);
 release();await vi.waitFor(()=>expect(panel.restoring).toBe(false));expect(panel.viewing).toBe(false);
});
it('reference files never enter recovery snapshots and are removed when the form changes',()=>{
 const {panel,changeBus}=setup();panel.referenceFiles.files=[{id:'reference-test',name:'fictional.pdf',kind:'pdf',mime:'application/pdf',pageCount:1,text:'fictional',pages:[{number:1,width:10,height:10,text:'fictional',textItems:[],preview:{dataUrl:'data:image/jpeg;base64,/9j/2Q=='}}],warnings:[]}];
 panel.referenceFiles.render();expect(JSON.stringify(panel.snapshot())).not.toContain('fictional.pdf');expect(JSON.stringify(panel.snapshot())).not.toContain('base64');changeBus();expect(panel.referenceFiles.files).toEqual([]);expect(panel.root.querySelectorAll('.ai-reference-card')).toHaveLength(0);
});

it('gives the PDF reading selector a stable accessible name independent of its option text',()=>{
 const {panel}=setup(),select=panel.referenceFiles.pdfMode;
 expect(select.getAttribute('aria-label')).toBe('PDF reading for new attachments');expect([...select.options].map(option=>option.value)).toEqual(['text','visual']);expect(select.value).toBe('text');
});

it('reveals the complete input group on prompt or Send focus without sending or moving other controls',()=>{
 const {panel,calls}=setup(),input=panel.node('.ai-input');input.scrollIntoView=vi.fn();panel.node('.ai-composer').getBoundingClientRect=()=>({top:100,bottom:300});
 for(const selector of ['#ai-prompt','[data-ai-send]'])panel.node(selector).getBoundingClientRect=()=>({top:280,bottom:350});
 panel.node('#ai-prompt').dispatchEvent(new FocusEvent('focusin',{bubbles:true}));panel.node('[data-ai-send]').dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
 expect(input.scrollIntoView).toHaveBeenCalledTimes(2);expect(input.scrollIntoView).toHaveBeenLastCalledWith({block:'nearest',inline:'nearest'});
 panel.node('[data-prompt]').dispatchEvent(new FocusEvent('focusin',{bubbles:true}));panel.node('[data-ai-send]').getBoundingClientRect=()=>({top:200,bottom:240});panel.node('[data-ai-send]').dispatchEvent(new FocusEvent('focusin',{bubbles:true}));expect(input.scrollIntoView).toHaveBeenCalledTimes(2);expect(calls()).toBe(0);
});
it('previews the unapplied candidate automatically on wide screens, leaving Apply explicit',async()=> {
  const {panel}=setup();await panel.send();
  expect(panel.proposal).toBeTruthy();expect(panel.checked).toBe(true);expect(panel.viewing).toBe(true);
  expect(panel.node('[data-ai=apply]').disabled).toBe(false);
  expect(panel.node('[data-ai-status]').textContent).toContain('Review the paper preview, then Apply.');
  expect(panel.getBus().revision).toBe(0);
});
it('keeps Preview manual on narrow screens where it reveals the full-screen paper',async()=> {
  const width=window.innerWidth;
  try {
    window.innerWidth=600;const {panel}=setup();await panel.send();
    expect(panel.checked).toBe(false);expect(panel.node('[data-ai=apply]').disabled).toBe(true);
    expect(panel.node('[data-ai-status]').textContent).toContain('Preview before Apply.');
    await panel.preview();expect(panel.checked).toBe(true);expect(panel.getBus().revision).toBe(0);
  } finally { window.innerWidth=width; }
});
const gatewayWith=(aliases,planned=[])=>({clear:()=>{},clearSession:()=>{},discover:async()=>aliases,plan:async alias=> {planned.push(alias);return {text:JSON.stringify({kind:'answer',message:'ok'})};}});
const chooseModel=(panel,alias)=> {const select=panel.node('#ai-model');panel.setModels(['demo-auto',alias]);select.value=alias;select.dispatchEvent(new Event('input',{bubbles:true}));};
const askAgain=panel=> {panel.node('#ai-prompt').value='Use navy accents.';panel.share();};
it('adapts an untouched default model to what the gateway offers',async()=> {
  const planned=[];const {panel}=setup({transport:gatewayWith(['demo-openai-mini','demo-groq'],planned)});
  expect(panel.node('#ai-model').value).toBe('demo-auto');
  await panel.send();
  expect(planned).toEqual(['demo-openai-mini']);expect(panel.node('#ai-model').value).toBe('demo-openai-mini');
  expect([...panel.node('#ai-model').options].map(o=>o.value)).toEqual(['demo-openai-mini','demo-groq']);
  expect(panel.node('[data-ai-status]').textContent).toContain('demo-openai-mini');
});
it('keeps the routing alias and lists it first when the gateway offers it',async()=> {
  const planned=[];const {panel}=setup({transport:gatewayWith(['demo-groq','demo-auto'],planned)});
  await panel.send();expect(planned).toEqual(['demo-auto']);expect([...panel.node('#ai-model').options].map(o=>o.value)).toEqual(['demo-auto','demo-groq']);
});
it('never replaces a model the user chose: it stops, refreshes the list, and sends only after a new Send',async()=> {
  const planned=[],offered=['demo-auto'];const {panel}=setup({transport:{...gatewayWith(offered,planned),discover:async()=>offered}});
  chooseModel(panel,'demo-groq');expect(panel.modelChosen).toBe(true);
  await panel.send();
  expect(planned).toEqual([]);
  expect(panel.conversation.messages.at(-1).text).toContain('no longer available');
  expect(panel.node('#ai-model').value).toBe('demo-auto');
  askAgain(panel);await panel.send();
  expect(planned).toEqual(['demo-auto']);
});
it('treats a restored non-default model as a deliberate choice and never trusts an unsafe one',()=> {
  const {panel}=setup();const select=panel.node('#ai-model');
  panel.restoreSnapshot({prompt:'',alias:'demo-groq',messages:[],references:[],open:false});
  expect(select.value).toBe('demo-groq');expect(panel.modelChosen).toBe(true);
  panel.restoreSnapshot({prompt:'',alias:'demo-auto',messages:[],references:[],open:false});
  expect(select.value).toBe('demo-auto');expect(panel.modelChosen).toBe(false);
  for(const alias of ['private-model','<script>','demo-x"}',undefined,42]) {
    panel.restoreSnapshot({prompt:'',alias,messages:[],references:[],open:false});
    expect(select.value).toBe('demo-auto');expect(panel.modelChosen).toBe(false);
    expect([...select.options].every(o=>/^demo-[a-z0-9-]+$/.test(o.value))).toBe(true);
  }
});
it('keeps progress ticks silent for screen readers but announces phase changes',async()=> {
  const status=()=>panel.node('[data-ai-status]');
  const {panel}=setup({transport:{clear:()=>{},clearSession:()=>{},discover:async()=>['demo-auto'],plan:async(alias,request,signal,media,{onProgress})=> {
    onProgress({chars:0,elapsedMs:0});expect(status().getAttribute('aria-live')).toBe('off');expect(status().textContent).toContain('Waiting for the AI service');
    onProgress({chars:1204,elapsedMs:6900});expect(status().textContent).toContain('Receiving response · 1,204 characters · 6 s');expect(status().getAttribute('aria-live')).toBe('off');
    return {text:JSON.stringify({kind:'answer',message:'ok'})}; }}});
  await panel.send();
  expect(status().getAttribute('aria-live')).toBe('polite');expect(status().textContent).toContain('Read-only answer');
});
it('derives scope from referenced elements instead of a selector',()=>{
 const {panel}=setup();expect(panel.node('#ai-scope')).toBeNull();
 expect(panel.scope()).toEqual({mode:'whole'});expect(panel.scopeHint()).toContain('whole form');
 const original=panel.elementTags;
 panel.elementTags={snapshot:()=>[{id:'label-customer-bill'}]};
 expect(panel.scope()).toEqual({mode:'selected',id:'label-customer-bill',ids:['label-customer-bill']});expect(panel.scopeHint()).toContain('1 selected element.');
 panel.elementTags={snapshot:()=>[{id:'label-customer-bill'},{id:'items-description'}]};
 expect(panel.scope().ids).toEqual(['label-customer-bill','items-description']);expect(panel.scopeHint()).toContain('2 selected elements.');
 panel.elementTags=original;
});
it('shows the wait inside the conversation, mirrors progress there, and removes it when done',async()=> {
  const pending=()=>document.querySelector('[data-ai-log] .ai-pending-text');let during;
  const {panel}=setup({transport:{clear:()=>{},clearSession:()=>{},discover:async()=>['demo-auto'],plan:async(alias,request,signal,media,{onProgress})=> {
    onProgress({chars:0,elapsedMs:0});const first=pending()?.textContent;
    onProgress({chars:1204,elapsedMs:6900});during={first,later:pending()?.textContent,hidden:pending()?.closest('article').getAttribute('aria-hidden')};
    return {text:JSON.stringify({kind:'answer',message:'ok'})}; }}});
  await panel.send();
  expect(during.first).toContain('Waiting for the AI service');expect(during.later).toContain('Receiving response · 1,204 characters');
  expect(during.hidden).toBe('true');expect(pending()).toBeNull();
});
it('words the card by what was done: previewed on paper once the preview passed',async()=> {
  const {panel}=setup();await panel.send();
  expect(panel.checked).toBe(true);
  expect(panel.node('.ai-card-state').textContent).toContain('Previewed on paper');expect(panel.node('.ai-card-state').textContent).not.toContain('preview first');
  expect(panel.node('[data-ai=preview]').textContent).toBe('Preview again');
  const width=window.innerWidth;
  try {
    window.innerWidth=600;const narrow=setup();await narrow.panel.send();
    expect(narrow.panel.node('.ai-card-state').textContent).toContain('preview first');expect(narrow.panel.node('[data-ai=preview]').textContent).toBe('Preview');
  } finally { window.innerWidth=width; }
});
it('leads the status with the next step and keeps technical details in parentheses',async()=> {
  const {panel}=setup();await panel.send();
  const text=panel.node('[data-ai-status]').textContent;
  expect(text.startsWith('Local checks passed. Review the paper preview, then Apply.')).toBe(true);
  expect(text).toMatch(/\(demo-fast · r0 · 1 inspection round\(s\) · Tokens: [^)]+\)$/);
});
it('clears element references once their own Apply succeeds, so the next Send is not blocked as outdated',async()=> {
  const label={kind:'proposal',summary:'Label',operations:[{type:'set_field',target:'label-customer-ship',patch:{labelStyle:{fontSize:12,bold:true}}}]};
  // Like the app, the commit announces the changed document (refreshing the hint) while the references still exist.
  let holder;const {panel}=setup({reply:label,commit:async()=> {holder.contextChanged();return {bus:holder.getBus(),revision:1};}});holder=panel;
  panel.elementTags=new AIElementTags({bus:()=>panel.getBus(),selection:()=>'label-customer-ship',onChange:()=>panel.share()});
  panel.elementTags.add('label-customer-ship');expect(panel.scope().mode).toBe('selected');
  await panel.send();expect(panel.checked).toBe(true);
  await panel.apply();
  expect(panel.elementTags.snapshot()).toEqual([]);expect(panel.scope()).toEqual({mode:'whole'});
  expect(panel.node('[data-ai-scope]').textContent).toMatch(/^Editing the whole form/);
});
it('keeps element references when the Apply fails',async()=> {
  const label={kind:'proposal',summary:'Label',operations:[{type:'set_field',target:'label-customer-ship',patch:{labelStyle:{fontSize:12,bold:true}}}]};
  const {panel}=setup({reply:label,commit:async()=> {throw new Error('commit failed');}});
  panel.elementTags=new AIElementTags({bus:()=>panel.getBus(),selection:()=>'label-customer-ship',onChange:()=>panel.share()});
  panel.elementTags.add('label-customer-ship');
  await panel.send();await panel.apply();
  expect(panel.elementTags.snapshot().map(r=>r.id)).toEqual(['label-customer-ship']);
});
it('shows object values in the change table as readable text instead of raw JSON',async()=> {
  const label={kind:'proposal',summary:'Label',operations:[{type:'set_field',target:'label-customer-ship',patch:{labelStyle:{fontSize:12,bold:true}}}]};
  const {panel}=setup({reply:label});
  panel.elementTags=new AIElementTags({bus:()=>panel.getBus(),selection:()=>'label-customer-ship',onChange:()=>panel.share()});
  panel.elementTags.add('label-customer-ship');
  await panel.send();
  const cells=[...document.querySelectorAll('.ai-diff tbody td')].map(td=>td.textContent);
  expect(cells).toContain('fontSize 12 · bold');expect(cells.some(text=>text.includes('{')||text.includes('"'))).toBe(false);
});
it('offers Edit & resend only on the newest failed request, not on history',async()=> {
  let fail=true;const retries=()=>document.querySelectorAll('[data-ai=retry]').length;
  const {panel}=setup({plan:async()=> { if(fail)throw new Error('boom');return {text:JSON.stringify({kind:'answer',message:'ok'})}; }});
  await panel.send();expect(retries()).toBe(1);
  fail=false;panel.node('#ai-prompt').value='Try again.';panel.share();await panel.send();
  expect(retries()).toBe(0);
});
