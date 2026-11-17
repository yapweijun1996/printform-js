import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {pageGeometryChange} from '../studio-v3/page-geometry.js';
import {pageSettings,validatePageSettings} from '../studio-v3/paper-settings.js';
import {bindingValidation} from '../studio-v3/validation.js';
const op=patch=>({type:'set_page',patch});
const normalized=d=>({...d,page:pageSettings(d)});
function inspector(project,page) {
  const root=document.createElement('div');root.innerHTML=rightView(project,{mode:'design',selected:'global-style',tab:'properties',report:null});const form=root.querySelector('form[data-form=style]');
  for(const key of ['paper','orientation'])if(page[key]!==undefined)form.elements[key].value=page[key];
  for(const [key,value] of Object.entries(page.margins || {}))form.elements[`margin-${key}`].value=String(value);
  if(page.customSizeMm){form.elements['paper-width-mm'].value=String(page.customSizeMm.width);form.elements['paper-height-mm'].value=String(page.customSizeMm.height);}
  if(page.printerProfile===null)form.elements['printer-enabled'].checked=false;
  return formDesign(project,'global-style',form,'style');
}
describe('shared page geometry with actual inspector/Pi adapters',()=> {
  it.each(['A4','A5','LETTER','LEGAL','RECEIPT_80','LABEL_100_70','CONTINUOUS_210_140','FANFOLD_210_280','CUSTOM'])('page inspector and operation produce equivalent candidates: %s',async paper=> {
    const project=newProject(),before=structuredClone(project),initial=designOf(project);
    const page={paper,orientation:'landscape',margins:{top:4.25,right:8,bottom:4,left:8},...(paper==='CUSTOM'?{customSizeMm:{width:182.5,height:233.2}}:{})};
    const expected={...initial,page},ui=inspector(project,page),pi=designOf(project);applyAuthoring(pi,[op(page)],project);
    expect(normalized(ui)).toEqual(normalized(expected));expect(normalized(pi)).toEqual(normalized(expected));expect(pageGeometryChange(initial,page).design).toEqual(expected);
    const draft=createDraft(project),step=draft.apply('Paper',[op(page)]);expect(step.candidate).toEqual(compileProject(project,expected));
    expect(bindingValidation(step.candidate)).toEqual(bindingValidation(compileProject(project,ui)));expect(step.candidate.sampleData).toEqual(before.sampleData);expect(step.candidate.schema).toEqual(before.schema);
    const bus=createBus(project);await editProject(bus,designOperations(bus.project,ui),'Paper');expect(bus.revision).toBe(1);await bus.navigateHistory('undo',bus.revision);expect(designOf(bus.project)).toEqual(initial);expect(project).toEqual(before);
  });
  it('removes custom dimensions and unchecked local profile identically',()=> {
    const p=newProject(),d=designOf(p);d.page={paper:'CUSTOM',orientation:'portrait',customSizeMm:{width:180.5,height:240.5},margins:{top:0,right:0,bottom:0,left:0},printerProfile:{version:1,source:'user-supplied',name:'Fictional declarations'}};
    const project=compileProject(p,d),patch={paper:'A4',printerProfile:null},ui=inspector(project,patch),pi=designOf(project);applyAuthoring(pi,[op(patch)],project);
    expect(ui).toEqual(pi);expect(pi.page).not.toHaveProperty('customSizeMm');expect(pi.page).not.toHaveProperty('printerProfile');expect(project.manifest.studioV3.page).toEqual(d.page);
  });
  it('merges partial margins without mutating existing state and validates coupled changes only at batch completion',()=> {
    const p=newProject(),d=designOf(p);d.page={paper:'A4',orientation:'portrait',margins:{top:0,right:72,bottom:0,left:72}};const project=compileProject(p,d);
    const independent=pageGeometryChange(d,{orientation:'landscape'}).design;independent.page.margins.left=1;expect(d.page.margins.left).toBe(72);
    const operations=[op({paper:'CUSTOM',customSizeMm:{width:20,height:50}}),op({margins:{left:0,right:0}})],draft=createDraft(project);
    const step=draft.apply('Coupled repair',operations);expect(step.design.page).toEqual({paper:'CUSTOM',orientation:'portrait',customSizeMm:{width:20,height:50},margins:{top:0,right:0,bottom:0,left:0}});expect(project.manifest.studioV3.page).toEqual(d.page);
    expect(()=>createDraft(project).apply('Incomplete',[operations[0]])).toThrow('UNSAFE_PROPOSAL');
  });
  it.each([{margins:{left:73}},{paper:'CUSTOM',customSizeMm:{width:19.9,height:100}},{paper:'CUSTOM',customSizeMm:{width:1001,height:100}}])('both final adapters reject invalid geometry without committing %j',async patch=> {
    const project=newProject(),before=structuredClone(project),bus=createBus(project),draft=createDraft(project);
    const ui=inspector(project,patch);expect(()=>validatePageSettings(ui.page)).toThrow();
    await expect(async()=>editProject(bus,designOperations(bus.project,ui),'Invalid')).rejects.toThrow();expect(bus.revision).toBe(0);
    expect(()=>draft.apply('Invalid',[op(patch)])).toThrow('UNSAFE_PROPOSAL');expect(draft.project).toBe(project);expect(project).toEqual(before);
    draft.apply('Recovery',[op({paper:'LETTER'})]);expect(draft.version).toBe(1);
  });
  it('keeps unknown-patch, duplicate, no-change and selected-scope guards',()=> {
    const p=newProject(),d=designOf(p);d.page=pageSettings(d);const project=compileProject(p,d),draft=createDraft(project);
    expect(()=>pageGeometryChange(d,{css:'body{}'})).toThrow('UNSAFE_PROPOSAL');expect(()=>draft.apply('Noop',[op({paper:'A4'})])).toThrow('NO_CHANGES');
    expect(()=>draft.apply('Duplicate',[op({paper:'LETTER'}),op({paper:'LEGAL'})])).toThrow('UNSAFE_PROPOSAL');
    const scoped=createDraft(project,{scope:{mode:'selected',id:'items'}});expect(()=>scoped.apply('Escape',[op({paper:'LETTER'})])).toThrow('UNSAFE_SCOPE');expect(scoped.project).toBe(project);expect(draft.project).toBe(project);
  });
});
