import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {BLOCKS} from '../studio-v3/design-authoring.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {sectionOrderChange} from '../studio-v3/section-order.js';
import {bindingValidation} from '../studio-v3/validation.js';
const op=order=>({type:'reorder_sections',order});
function fixture(type='invoice') {const p=newProject(type),d=designOf(p);for(const id of BLOCKS){d.blocks[id].keepTogether=false;d.blocks[id].breakBefore=false;}return compileProject(p,d);}
function inspector(project,target,position,repeatHeader) {
  const root=document.createElement('div');root.innerHTML=rightView(project,{mode:'design',selected:target,tab:'properties',report:null});
  const form=root.querySelector('form[data-form=block]');form.elements.sectionPosition.value=String(position);
  if(repeatHeader!==undefined)form.elements.repeatHeader.checked=repeatHeader;
  return formDesign(project,target,form,'block');
}
describe('shared section ordering with real inspector/Pi adapters',()=> {
  it.each(['invoice','purchase','delivery'])('section ordering inspector and operation produce equivalent candidates: %s',async type=> {
    for(const [target,position] of [['footer',1],['totals',2],['items',4]]) {
      const project=fixture(type),before=structuredClone(project),initial=designOf(project),order=BLOCKS.filter(id=>id!==target);order.splice(position,0,target);
      const expected={...initial,sectionOrder:order},ui=inspector(project,target,position),pi=designOf(project);
      applyAuthoring(pi,[op(order)],project);expect(ui).toEqual(expected);expect(pi).toEqual(expected);expect(sectionOrderChange(initial,order).design).toEqual(expected);
      const draft=createDraft(project),step=draft.apply('Order',[op(order)]);expect(step.candidate).toEqual(compileProject(project,expected));
      expect(bindingValidation(step.candidate)).toEqual(bindingValidation(compileProject(project,ui)));expect(step.candidate.sampleData).toEqual(before.sampleData);expect(step.candidate.schema).toEqual(before.schema);
      const bus=createBus(project);await editProject(bus,designOperations(bus.project,ui),'Order');expect(bus.revision).toBe(1);
      await bus.navigateHistory('undo',bus.revision);expect(designOf(bus.project)).toEqual(initial);expect(project).toEqual(before);
    }
  });
  it('retains repeating-header rejection and allows a complete atomic repair in either operation order',async()=> {
    const project=fixture(),before=structuredClone(project),order=['customer','header','items','totals','footer'],draft=createDraft(project),bus=createBus(project);
    expect(()=>draft.apply('Invalid',[op(order)])).toThrow('UNSAFE_PROPOSAL');
    await expect(async()=>editProject(bus,designOperations(bus.project,inspector(bus.project,'header',1)),'Invalid')).rejects.toThrow('repeating document header');
    expect(draft.project).toBe(project);expect(bus.revision).toBe(0);
    const expected=inspector(project,'header',1,false);
    for(const operations of [[op(order),{type:'set_style',patch:{repeatHeader:false}}],[{type:'set_style',patch:{repeatHeader:false}},op(order)]]) {
      const recovered=createDraft(project);expect(recovered.apply('Repair',operations).design).toEqual(expected);
    }
    expect(project).toEqual(before);
  });
  it.each([null,{},[],['header'],['header','customer','items','totals','totals'],['header','customer','items','totals','unknown']])('rejects invalid permutations without mutation %j',order=> {
    const project=fixture(),d=designOf(project),before=structuredClone(d);
    expect(()=>sectionOrderChange(d,order)).toThrow('UNSAFE_PROPOSAL');expect(()=>applyAuthoring(d,[op(order)],project)).toThrow('UNSAFE_PROPOSAL');expect(d).toEqual(before);
  });
  it('moves an existing explicit order back to default and Undo restores it',async()=> {
    const initial=fixture(),d=designOf(initial);d.sectionOrder=['header','footer','customer','items','totals'];const project=compileProject(initial,d);
    const ui=inspector(project,'footer',4),draft=createDraft(project),pi=draft.apply('Restore default',[op([...BLOCKS])]).design;expect(ui).toEqual(pi);expect(ui.sectionOrder).toEqual(BLOCKS);
    const bus=createBus(project);await editProject(bus,designOperations(bus.project,ui),'Restore default');await bus.navigateHistory('undo',bus.revision);expect(designOf(bus.project)).toEqual(d);
  });
  it('rejects no-change, duplicate ordering and selected-scope escape with fresh recovery',()=> {
    const project=fixture(),draft=createDraft(project),order=['header','footer','customer','items','totals'];
    expect(()=>draft.apply('Noop',[op([...BLOCKS])])).toThrow('NO_CHANGES');
    expect(()=>draft.apply('Duplicate',[op(order),op([...BLOCKS])])).toThrow('UNSAFE_PROPOSAL');
    const scoped=createDraft(project,{scope:{mode:'selected',id:'footer'}});
    expect(()=>scoped.apply('Escape',[op(order)])).toThrow('UNSAFE_SCOPE');expect(scoped.project).toBe(project);
    draft.apply('Recovery',[op(order)]);expect(draft.version).toBe(1);
  });
});
