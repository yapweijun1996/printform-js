import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {BLOCKS} from '../studio-v3/design-authoring.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {sectionPropertiesChange} from '../studio-v3/section-properties.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';
const op=(target,patch)=>({type:'set_section',target,patch});
const error=fn=>{try{fn();}catch(e){return {code:e.code,message:e.message};}throw Error('Expected error');};
function fixture(type='invoice') {
  const project=newProject(type),d=designOf(project);
  for(const id of BLOCKS) {d.blocks[id].keepTogether=false;d.blocks[id].breakBefore=false;}
  return compileProject(project,d);
}
function inspector(project,target,patch) {
  const root=document.createElement('div');root.innerHTML=rightView(project,{mode:'design',selected:target,tab:'properties',report:null});
  const form=root.querySelector('form[data-form=block]');
  const set=(key,value)=>{const node=form.elements[key];if(node.type==='checkbox')node.checked=value;else{node.type='text';node.value=String(value);}};
  for(const [key,value] of Object.entries(patch)) {
    if(key==='layout') {set('layoutColumns',value?.columns??'');set('layoutGap',value?.gap??'');}
    else set(key==='breakBefore'?'sectionBreakBefore':key,value);
  }
  return ()=>formDesign(project,target,form,'block');
}
async function verify(target,patch,type='invoice') {
  const project=fixture(type),before=structuredClone(project),initial=designOf(project),expected=structuredClone(initial);
  Object.assign(expected.blocks[target],patch);
  const ui=inspector(project,target,patch)(),pi=designOf(project);
  applyAuthoring(pi,[op(target,patch)],project);
  expect(ui).toEqual(expected);expect(pi).toEqual(expected);expect(sectionPropertiesChange(initial,target,patch).design).toEqual(expected);
  const draft=createDraft(project,{scope:{mode:'selected',id:target}}),step=draft.apply('Section',[op(target,patch)]);
  expect(step.candidate).toEqual(compileProject(project,expected));
  expect(bindingValidation(step.candidate)).toEqual(bindingValidation(compileProject(project,ui)));
  expect(step.candidate.sampleData).toEqual(before.sampleData);expect(step.candidate.schema).toEqual(before.schema);
  const bus=createBus(project);await editProject(bus,designOperations(bus.project,ui),'Section');expect(bus.revision).toBe(1);
  await bus.navigateHistory('undo',bus.revision);expect(designOf(bus.project)).toEqual(initial);expect(project).toEqual(before);
}
describe('shared section properties and grid with real inspector/Pi adapters',()=> {
  it.each(BLOCKS)('section inspector and operation produce equivalent candidates: %s',async target=> {
    for(const type of ['invoice','purchase','delivery']) for(const patch of [{label:'交付 / Section'},{enabled:false}])await verify(target,patch,type);
    if(target!=='items')await verify(target,{keepTogether:true});
    if(!['header','items'].includes(target))await verify(target,{breakBefore:true});
  });
  it.each(['header','customer','totals','footer'])('section grid uses the same bounds and candidates: %s',async target=> {
    for(const layout of [{columns:1,gap:0},{columns:4,gap:48},{columns:3,gap:12.5}])await verify(target,{layout});
  });
  it.each([{layout:{columns:0,gap:0}},{layout:{columns:5,gap:0}},{layout:{columns:1.5,gap:0}},{layout:{columns:2,gap:-1}},{layout:{columns:2,gap:49}},{label:'X'.repeat(101)}])('rejects common bad input and recovers %j',patch=> {
    const project=fixture(),before=structuredClone(project),pi=designOf(project);
    expect(error(inspector(project,'customer',patch))).toEqual(error(()=>applyAuthoring(pi,[op('customer',patch)],project)));
    expect(pi).toEqual(designOf(project));const draft=createDraft(project);
    expect(()=>draft.apply('Invalid',[op('footer',{label:'Changed'}),op('customer',patch)])).toThrow('UNSAFE_PROPOSAL');
    expect(draft.project).toBe(project);expect(draft.version).toBe(0);
    draft.apply('Recover',[op('customer',{layout:{columns:2,gap:12}})]);expect(draft.version).toBe(1);expect(project).toEqual(before);
  });
  it('retains the human optional-grid reset without expanding JSON operation schemas',()=> {
    let project=fixture();const d=designOf(project);d.blocks.customer.layout={columns:3,gap:12};project=compileProject(project,d);
    const expected=structuredClone(d);delete expected.blocks.customer.layout;
    expect(inspector(project,'customer',{layout:undefined})()).toEqual(expected);
    expect(sectionPropertiesChange(d,'customer',{layout:undefined}).design).toEqual(expected);
  });
  it.each([{enabled:'false'},{keepTogether:null},{breakBefore:0},{layout:null},{layout:{columns:NaN}},{css:'body{}'}])('rejects raw invalid types without mutation %j',patch=> {
    const d=designOf(fixture()),before=structuredClone(d);
    expect(()=>sectionPropertiesChange(d,'customer',patch)).toThrow('UNSAFE_PROPOSAL');expect(d).toEqual(before);
  });
  it('preserves target, table-grid, no-change, duplicate, scope and grant boundaries',async()=> {
    const project=fixture(),d=designOf(project),draft=createDraft(project);
    expect(()=>sectionPropertiesChange(d,'table-other',{})).toThrow('UNSAFE_PROPOSAL');
    expect(()=>draft.apply('Table grid',[op('items',{layout:{columns:2}})])).toThrow('TABLE_SECTION_GRID_UNSUPPORTED');
    expect(()=>draft.apply('No change',[op('customer',{enabled:true})])).toThrow('NO_CHANGES');
    expect(()=>draft.apply('Duplicate',[op('customer',{label:'A'}),op('customer',{label:'B'})])).toThrow('UNSAFE_PROPOSAL');
    const scoped=createDraft(project,{scope:{mode:'selected',id:'header-company'}});
    expect(()=>scoped.apply('Escape',[op('customer',{label:'A'})])).toThrow('UNSAFE_SCOPE');
    const tool=createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant('read-only')}).find(tool=>tool.name==='apply_operations');
    const args={summary:'Denied',operations:[op('customer',{label:'A'})]};
    await expect((async()=>{tool.prepareArguments(args);return tool.execute('section',args);})()).rejects.toMatchObject({code:'GRANT_DENIED'});
    expect(draft.project).toBe(project);expect(scoped.project).toBe(project);
  });
});
