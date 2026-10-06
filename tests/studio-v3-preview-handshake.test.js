import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {newProject} from '../studio-v3/model.js';
import {createBus} from '../studio-v3/controller.js';
import {PREVIEW_TIMING} from '../studio-v3/preview-launch.js';

vi.mock('../studio-v3/runtime-assets.js',()=>({runtimeSources:async()=>({})}));
vi.mock('../studio-v2/core/exporter.js',()=>({createStandaloneHtml:async()=>({html:'<html><body></body></html>'})}));
const {PaperPreview}=await import('../studio-v3/preview.js');

const SOURCE='printform-studio-v3-preview';
let frame,reports,paper,writes;
const project=()=>createBus(newProject()).project;
const post=(type,token,payload={})=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{source:SOURCE,token,type,payload}}));
const rendered=(token,report={status:'ready',validation:{errors:[],warnings:[]}})=>post('rendered',token,{typography:[],report,pages:[],styles:'',height:1200});
const settle=async()=>{for(let i=0;i<5;i++) await Promise.resolve();};
beforeEach(()=> {
  vi.useFakeTimers();document.body.innerHTML='<iframe id="f"></iframe>';frame=document.querySelector('#f');
  writes=[];const set=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'srcdoc')?.set;
  Object.defineProperty(frame,'srcdoc',{configurable:true,set(value){writes.push(value);set?.call(frame,value);},get:()=>writes.at(-1)});
  reports=[];paper=new PaperPreview(frame,(report,view)=>reports.push({report,view}),()=>{});
});
afterEach(()=>vi.useRealTimers());

it('writes the document once and treats the bridge hello as proof the preview started',async()=> {
  const done=paper.render(project());await settle();
  expect(writes).toHaveLength(1);expect(writes[0]).not.toBe('');
  post('hello',paper.token);vi.advanceTimersByTime(PREVIEW_TIMING.helloMs*PREVIEW_TIMING.launches);
  expect(writes).toHaveLength(1);rendered(paper.token);
  expect((await done).status).toBe('ready');
});

it('reassigns the document when no hello arrives, then reports that the preview did not start',async()=> {
  const done=paper.render(project());await settle();
  vi.advanceTimersByTime(PREVIEW_TIMING.helloMs);expect(writes).toHaveLength(2);
  vi.advanceTimersByTime(PREVIEW_TIMING.helloMs);
  const result=await done;expect(result.status).toBe('blocked');expect(result.validation.errors[0].code).toBe('PREVIEW_NOT_STARTED');
});

it('recovers when the retried document starts and renders',async()=> {
  const done=paper.render(project());await settle();
  vi.advanceTimersByTime(PREVIEW_TIMING.helloMs);post('hello',paper.token);rendered(paper.token);
  expect((await done).status).toBe('ready');expect(reports).toHaveLength(1);
});

it('ignores a repeated rendered message for the same token instead of reporting twice',async()=> {
  const done=paper.render(project());await settle();post('hello',paper.token);rendered(paper.token);rendered(paper.token);await done;
  expect(reports).toHaveLength(1);
});

it('ignores hello and rendered from an older token after a newer render started',async()=> {
  const first=paper.render(project());await settle();const old=paper.token;
  const second=paper.render(project());await settle();
  expect((await first).status).toBe('superseded');post('hello',old);rendered(old);expect(reports).toHaveLength(0);
  post('hello',paper.token);rendered(paper.token);expect((await second).status).toBe('ready');
});

it('a render that said hello but never finishes still times out as a slow render',async()=> {
  const done=paper.render(project());await settle();post('hello',paper.token);vi.advanceTimersByTime(PREVIEW_TIMING.renderMs);
  expect((await done).validation.errors[0].code).toBe('RENDER_TIMEOUT');
});
