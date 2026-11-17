import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {logoReferenceChange} from '../studio-v3/image-reference.js';
import {bindingValidation} from '../studio-v3/validation.js';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const op=value=>({type:'set_logo',value});
function fixture(type='invoice') {const p=newProject(type),d=designOf(p);d.assets=[{id:'brand',src:PNG,alt:'Fictional mark'}];return compileProject(p,d);}
function inspector(project,value) {
  const root=document.createElement('div');root.innerHTML=rightView(project,{mode:'design',selected:'header',tab:'properties',report:null});const form=root.querySelector('form[data-form=logo]');
  form.elements.removeLogo.checked=value===null;
  if(value!==null){form.elements.assetId.value=value.assetId;for(const [name,key] of [['imageWidth','width'],['imageHeight','height']]){form.elements[name].type='text';form.elements[name].value=String(value[key]);}form.elements.imageFit.value=value.fit;}
  return ()=>formDesign(project,'header',form,'logo');
}
const error=fn=>{try{fn();}catch(e){return {code:e.code,message:e.message};}throw Error('Expected rejection');};
describe('shared logo reference with real inspector/Pi adapters',()=> {
  it.each([null,{assetId:'brand',width:8,height:8,fit:'contain'},{assetId:'brand',width:400,height:200,fit:'cover'},{assetId:'brand',width:64.25,height:32.5,fit:'cover'}])('logo inspector and operation produce equivalent candidates %j',async value=> {
    for(const type of ['invoice','purchase','delivery']) {
      const project=fixture(type),before=structuredClone(project),initial=designOf(project),expected={...initial,logo:value},ui=inspector(project,value)(),pi=designOf(project);
      applyAuthoring(pi,[op(value)],project);expect(ui).toEqual(expected);expect(pi).toEqual(expected);expect(logoReferenceChange(initial,value).design).toEqual(expected);
      const draft=createDraft(project,{scope:{mode:'selected',id:'header-logo'}}),step=draft.apply('Logo',[op(value)]);expect(step.candidate).toEqual(compileProject(project,expected));
      expect(bindingValidation(step.candidate)).toEqual(bindingValidation(compileProject(project,ui)));expect(step.candidate.sampleData).toEqual(before.sampleData);expect(step.design.assets).toEqual(initial.assets);
      const bus=createBus(project);await editProject(bus,designOperations(bus.project,ui),'Logo');expect(bus.revision).toBe(1);
      await bus.navigateHistory('undo',bus.revision);expect(designOf(bus.project)).toEqual(initial);expect(project).toEqual(before);
    }
  });
  it.each([{width:7},{width:401},{height:7},{height:201},{fit:'stretch'},{assetId:'missing'}])('rejects invalid references/geometry and recovers %j',patch=> {
    const project=fixture(),before=structuredClone(project),value={assetId:'brand',width:52,height:52,fit:'contain',...patch},pi=designOf(project);
    expect(error(inspector(project,value))).toEqual(error(()=>applyAuthoring(pi,[op(value)],project)));expect(pi).toEqual(designOf(project));
    const draft=createDraft(project);expect(()=>draft.apply('Invalid',[{type:'set_style',patch:{font:10}},op(value)])).toThrow();expect(draft.project).toBe(project);expect(draft.version).toBe(0);
    draft.apply('Recovery',[op(null)]);expect(draft.version).toBe(1);expect(project).toEqual(before);
  });
  it('normalizes omitted fit to the same default visual result as explicit contain',()=> {
    const project=fixture(),value={assetId:'brand',width:52,height:52},ui=inspector(project,{...value,fit:'contain'})(),pi=designOf(project);
    applyAuthoring(pi,[op(value)],project);expect({...pi,logo:{...pi.logo,fit:pi.logo.fit || 'contain'}}).toEqual(ui);
    expect(compileProject(project,pi).templateHtml).toEqual(compileProject(project,ui).templateHtml);
    expect(compileProject(project,pi).themeCss).toEqual(compileProject(project,ui).themeCss);
  });
  it('preserves removed-logo no-op, scope, missing-asset and duplicate guards',()=> {
    const initial=fixture(),d=designOf(initial);d.logo=null;const project=compileProject(initial,d),draft=createDraft(project),logo={assetId:'brand',width:52,height:52,fit:'contain'};
    expect(()=>draft.apply('No change',[op(null)])).toThrow('NO_CHANGES');expect(()=>draft.apply('Duplicate',[op(logo),op(null)])).toThrow('UNSAFE_PROPOSAL');
    const scoped=createDraft(project,{scope:{mode:'selected',id:'header-title'}});expect(()=>scoped.apply('Escape',[op(logo)])).toThrow('UNSAFE_SCOPE');expect(scoped.project).toBe(project);
    expect(()=>logoReferenceChange(designOf(newProject()),logo)).toThrow('LOGO_ASSET_UNAVAILABLE');expect(draft.project).toBe(project);
  });
});
