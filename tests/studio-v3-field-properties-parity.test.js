import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject,selectionField} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {fieldPropertiesChange} from '../studio-v3/field-properties.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';
import {operationAutoApplicable} from '../studio-v3/ai-auto-apply-policy.js';

const operation = (target,patch) => ({type:'set_field',target,patch});
const labelStyle = {fontSize:12.25,bold:false,color:'#163a65',align:'left'};
const valueStyle = {fontSize:10.75,bold:true,align:'right'};
function fixture(type='invoice',target='customer-bill') {
  const project = newProject(type), design = designOf(project);
  design.additionalTables = [{id:'table-aux',label:'Other lines',collection:design.collection,
    columns:[{...design.columns[1],width:50}],enabled:false,repeatHeader:true,breakBefore:false}];
  const {field} = selectionField(design,target);
  field.showLabel = true;
  field.labelStyle = {bold:true};
  return compileProject(project,design);
}
function inspector(project,target,patch) {
  const root = document.createElement('div'); root.innerHTML = rightView(project,{mode:'design',selected:target,tab:'properties',report:null});
  const form = root.querySelector('form[data-form=field]');
  for (const [key,value] of Object.entries(patch)) {
    if (key === 'showLabel') form.elements[key].checked = value;
    else if (key === 'labelStyle' || key === 'valueStyle') for (const property of ['fontSize','bold','color','align']) form.elements[`${key}.${property}`].value = value[property] ?? '';
    else form.elements[key].value = value;
  }
  return ()=>formDesign(project,target,form,'field');
}
function rejection(fn) {
  try { fn(); } catch (error) { return {code:error.code,message:error.message}; }
  throw new Error('Expected rejection');
}

describe('shared field properties and actual inspector/Pi adapters',()=> {
  it.each([['invoice','customer-bill'],['purchase','customer-bill'],['delivery','customer-bill'],['invoice','items-sku'],['invoice','table-aux-sku']])(
    'field properties inspector and operation produce equivalent candidates: %s %s',async(type,target)=> {
      const project = fixture(type,target), before = structuredClone(project), initial = designOf(project);
      const patch = {label:'<b>配送 / Delivery</b>',showLabel:false,labelStyle,valueStyle};
      const ui = inspector(project,target,patch)(), pi = designOf(project), expected = designOf(project);
      Object.assign(selectionField(expected,target).field,patch);
      applyAuthoring(pi,[operation(target,patch)],project);
      expect(ui).toEqual(expected); expect(pi).toEqual(expected);
      const draft = createDraft(project,{scope:{mode:'selected',id:target}}), step = draft.apply('Properties',[operation(target,patch)]);
      const compiled = compileProject(project,ui);
      expect(step.candidate).toEqual(compiled);
      expect(bindingValidation(step.candidate)).toEqual(bindingValidation(compiled));
      expect(step.candidate.sampleData).toEqual(before.sampleData); expect(step.candidate.schema).toEqual(before.schema);
      const bus = createBus(project);
      await editProject(bus,designOperations(bus.project,ui),'Properties');
      expect(bus.revision).toBe(1);
      await bus.navigateHistory('undo',bus.revision); expect(designOf(bus.project)).toEqual(initial);
      expect(project).toEqual(before);
    }
  );
  it('clears an override through blank inspector controls or an empty Pi style patch',()=> {
    const target = 'label-customer-bill', project = fixture('invoice',target);
    const patch = {labelStyle:{}}, ui = inspector(project,target,patch)(), pi = designOf(project);
    applyAuthoring(pi,[operation(target,patch)],project);
    expect(selectionField(ui,target).field).not.toHaveProperty('labelStyle'); expect(pi).toEqual(ui);
    const draft = createDraft(project,{scope:{mode:'selected',id:target}});
    expect(draft.apply('Inherit',[operation(target,patch)]).candidate).toEqual(compileProject(project,ui));
    expect(()=>draft.apply('Noop',[operation(target,patch)])).toThrow('NO_CHANGES');
  });
  it.each([{label:'X'.repeat(101)},{labelStyle:{fontSize:5}},{valueStyle:{fontSize:72.25}},{valueStyle:{color:'red;display:none'}}])(
    'rejects invalid properties identically without changing the project: %j',patch=> {
      const target = 'customer-bill', project = fixture('invoice',target), before = structuredClone(project), pi = designOf(project);
      expect(rejection(inspector(project,target,patch))).toEqual(rejection(()=>applyAuthoring(pi,[operation(target,patch)],project)));
      expect(pi).toEqual(designOf(project)); expect(project).toEqual(before);
      const draft = createDraft(project);
      expect(()=>draft.apply('Invalid',[operation(target,patch)])).toThrow('UNSAFE_PROPOSAL');
      expect(draft.project).toBe(project); expect(draft.version).toBe(0);
      draft.apply('Recovery',[operation(target,{label:'Recovered'})]); expect(draft.version).toBe(1);
    }
  );
  it('keeps human display formatting and Pi manual approval while protecting supplied number formats',()=> {
    const target = 'items-sku', project = fixture('invoice',target), patch = {format:'number'};
    const ui = inspector(project,target,patch)(), pi = designOf(project);
    applyAuthoring(pi,[operation(target,patch)],project);
    expect(pi).toEqual(ui);
    expect(operationAutoApplicable(operation(target,patch))).toBe(false);
    const guarded = fixture('invoice','items-amount');
    expect(()=>createDraft(guarded).apply('Protected',[operation('items-amount',{format:''})])).toThrow('UNSAFE_PROPOSAL');
  });
  it('handles impossible form values without accepting malformed Pi property types',()=> {
    const field = designOf(fixture()).customer[0], before = structuredClone(field);
    for (const patch of [{label:null},{showLabel:'true'},{valueStyle:null},{labelStyle:{fontSize:Infinity}},{labelStyle:{css:'position:fixed'}}]) {
      expect(()=>fieldPropertiesChange(field,patch)).toThrow('UNSAFE_PROPOSAL');
      expect(field).toEqual(before);
    }
  });
  it('treats reordered typography keys as no change',()=> {
    const project = fixture(), design = designOf(project), target = 'label-customer-bill';
    selectionField(design,target).field.labelStyle = {fontSize:12.25,bold:true};
    const styled = compileProject(project,design), draft = createDraft(styled,{scope:{mode:'selected',id:target}});
    expect(()=>draft.apply('Noop',[operation(target,{labelStyle:{bold:true,fontSize:12.25}})])).toThrow('NO_CHANGES');
    expect(draft.project).toBe(styled);
  });
  it('preserves scope, duplicate, label-only and read-only grant guards',async()=> {
    const target = 'customer-bill', project = fixture('invoice',target), draft = createDraft(project);
    expect(()=>draft.apply('Duplicate',[operation(target,{label:'One'}),operation(`label-${target}`,{label:'Two'})])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>draft.apply('Label',[operation(`label-${target}`,{valueStyle})])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>createDraft(project,{scope:{mode:'selected',id:'header-company'}}).apply('Escape',[operation(target,{label:'Denied'})])).toThrow('UNSAFE_SCOPE');
    const tool = createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant('read-only')}).find(tool=>tool.name==='apply_operations');
    const args = {summary:'Denied',operations:[operation(target,{label:'Denied'})]};
    await expect((async()=>{tool.prepareArguments(args); return tool.execute('properties',args);})()).rejects.toMatchObject({code:'GRANT_DENIED'});
    expect(draft.project).toBe(project);
  });
});
