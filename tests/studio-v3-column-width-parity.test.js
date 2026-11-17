import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject,selectionField} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {columnWidthChange} from '../studio-v3/column-width.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';
const op=(target,width)=>({type:'set_field',target,patch:{width}});
function fixture(additional=false) {
  const p=newProject(),d=designOf(p),column={...d.columns[1],width:50,showLabel:true};
  d.columns=[column];
  if(additional)d.additionalTables=[{id:'table-copy',label:'Copy',collection:d.collection,columns:[structuredClone(column)],enabled:true,repeatHeader:true,breakBefore:false}];
  return {project:compileProject(p,d),target:`${additional?'table-copy':'items'}-${column.id}`};
}
function inspector(project,target,width) {
  const root=document.createElement('div');root.innerHTML=rightView(project,{mode:'design',selected:target,tab:'properties',report:null});
  const form=root.querySelector('form[data-form=field]');form.elements.width.value=String(width);
  return formDesign(project,target,form,'field');
}
describe('shared column percentages and actual inspector/Pi adapters',()=> {
  it.each([1,12.25,100])('column-width inspector and operation produce equivalent candidates: %s',async width=> {
    for(const additional of [false,true]) {
      const {project,target}=fixture(additional),before=structuredClone(project),initial=designOf(project),expected=designOf(project);selectionField(expected,target).field.width=width;
      const ui=inspector(project,target,width),pi=designOf(project);applyAuthoring(pi,[op(target,width)],project);
      expect(ui).toEqual(expected);expect(pi).toEqual(expected);
      const step=createDraft(project,{scope:{mode:'selected',id:target}}).apply('Width',[op(target,width)]);
      expect(step.candidate).toEqual(compileProject(project,expected));expect(bindingValidation(step.candidate)).toEqual(bindingValidation(compileProject(project,ui)));
      expect(step.candidate.sampleData).toEqual(before.sampleData);expect(step.candidate.schema).toEqual(before.schema);
      const bus=createBus(project);await editProject(bus,designOperations(bus.project,ui),'Width');expect(bus.revision).toBe(1);await bus.navigateHistory('undo',bus.revision);expect(designOf(bus.project)).toEqual(initial);expect(project).toEqual(before);
    }
  });
  it.each([0,100.01,NaN,Infinity,'12',null,undefined])('rejects malformed percentages and preserves source %j',width=> {
    const {project,target}=fixture(),d=designOf(project),column=selectionField(d,target).field,before=structuredClone(column);
    expect(()=>columnWidthChange(column,width)).toThrow('UNSAFE_PROPOSAL');expect(column).toEqual(before);
    const draft=createDraft(project);expect(()=>draft.apply('Invalid',[op(target,width)])).toThrow();expect(draft.project).toBe(project);expect(draft.version).toBe(0);
    draft.apply('Recovery',[op(target,12.25)]);expect(draft.version).toBe(1);
  });
  it.each([0,100.01])('real inspector and Pi reject out-of-range %s',width=> {
    const {project,target}=fixture();expect(()=>inspector(project,target,width)).toThrow('UNSAFE_PROPOSAL');expect(()=>applyAuthoring(designOf(project),[op(target,width)],project)).toThrow('UNSAFE_PROPOSAL');
  });
  it.each([false,true])('keeps aggregate validation after complete atomic batch: additional=%s',additional=> {
    const {project,target}=fixture(additional),d=designOf(project),list=additional?d.additionalTables[0].columns:d.columns;
    list.push({...list[0],id:'second',width:50});const p=compileProject(project,d),second=target.replace(/-[^-]+$/,'-second');
    const operations=[op(target,75),op(second,25)];
    for(const batch of [operations,[...operations].reverse()])expect(createDraft(p).apply('Repair',batch).design).toMatchObject(additional?{additionalTables:[{columns:[{width:75},{width:25}]}]}:{columns:[{width:75},{width:25}]});
    const draft=createDraft(p);expect(()=>draft.apply('Overflow',[operations[0]])).toThrow();expect(draft.project).toBe(p);expect(draft.version).toBe(0);
  });
  it('preserves duplicate, no-op, label target, scope, read-only and document-field width guards',async()=> {
    const {project,target}=fixture(),draft=createDraft(project);
    expect(()=>draft.apply('Noop',[op(target,50)])).toThrow('NO_CHANGES');expect(()=>draft.apply('Duplicate',[op(target,20),op(target,30)])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>draft.apply('Label',[op(`label-${target}`,20)])).toThrow('UNSAFE_PROPOSAL');expect(()=>draft.apply('Document',[op('header-company',20)])).toThrow('FIELD_WIDTH_UNSUPPORTED');
    expect(()=>createDraft(project,{scope:{mode:'selected',id:'header-company'}}).apply('Escape',[op(target,20)])).toThrow('UNSAFE_SCOPE');
    const tool=createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant('read-only')}).find(t=>t.name==='apply_operations');
    const args={summary:'Denied',operations:[op(target,20)]};await expect((async()=>{tool.prepareArguments(args);return tool.execute('width',args);})()).rejects.toMatchObject({code:'GRANT_DENIED'});expect(draft.project).toBe(project);
  });
});
