import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {globalStyleChange} from '../studio-v3/global-style.js';
import {pageSettings} from '../studio-v3/design-authoring.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';
import {bindingValidation} from '../studio-v3/validation.js';

const normalize = design => ({...design,page:pageSettings(design)});
function inspector(project,patch) {
  const selected = Object.hasOwn(patch,'repeatHeader') ? 'header' : Object.hasOwn(patch,'repeatTable') || Object.hasOwn(patch,'breakBefore') ? 'items' : 'global-style';
  const root = document.createElement('div');
  root.innerHTML = rightView(project,{mode:'design',selected,tab:'properties',report:null});
  const kind = selected === 'global-style' ? 'style' : 'block', form = root.querySelector(`form[data-form="${kind}"]`);
  for (const [key,value] of Object.entries(patch)) {
    const input = form.elements[key];
    if (input.type === 'checkbox') input.checked = value;
    else { input.type = 'text'; input.value = String(value); }
  }
  return ()=>formDesign(project,selected,form,kind);
}
const operation = patch => ({type:'set_style',patch});
const error = fn => { try { fn(); } catch (e) { return {code:e.code,message:e.message}; } throw Error('Expected rejection'); };

describe('shared global style service and real inspector/Pi adapters',()=> {
  it.each([{color:'#12aBcD'},{font:6},{font:14},{font:10.5},{padding:2},{padding:16},{padding:12.25},{striped:false},{borders:false},{pageNumbers:false},{repeatHeader:false},{repeatTable:false},{breakBefore:true}])('global-style inspector and operation produce equivalent candidates %j',async patch=> {
    for (const type of ['invoice','purchase','delivery']) {
      let project = newProject(type);
      // The header inspector materializes this existing false default, outside global style.
      if (Object.hasOwn(patch,'repeatHeader')) { const d = designOf(project); d.blocks.header.keepTogether = false; project = compileProject(project,d); }
      const before = structuredClone(project), initial = designOf(project);
      const ui = inspector(project,patch)(), pi = designOf(project);
      applyAuthoring(pi,[operation(patch)],project);
      const expected = {...initial,...patch}, shared = globalStyleChange(initial,patch);
      expect(normalize(ui)).toEqual(normalize(expected));
      expect(normalize(pi)).toEqual(normalize(expected));
      expect(shared.design).toEqual(expected); expect(shared.diagnostics).toEqual([]);
      const draft = createDraft(project), step = draft.apply('Style',[operation(patch)]);
      expect(normalize(step.design)).toEqual(normalize(expected));
      const candidate = compileProject(project,ui);
      expect(bindingValidation(step.candidate)).toEqual(bindingValidation(candidate));
      expect(candidate.sampleData).toEqual(before.sampleData);
      const bus = createBus(project);
      await editProject(bus,designOperations(bus.project,ui),'Style');
      expect(bus.revision).toBe(1); expect(normalize(designOf(bus.project))).toEqual(normalize(expected));
      await bus.navigateHistory('undo',bus.revision);
      expect(designOf(bus.project)).toEqual(initial); expect(project).toEqual(before);
    }
  });
  it.each([{color:'red'},{color:'#fff'},{color:'#ffffff;display:none'},{font:5.9},{font:14.1},{padding:1.9},{padding:16.1}])('common validation errors and recovery preserve the original %j',patch=> {
    const project = newProject(), before = structuredClone(project), pi = designOf(project), original = structuredClone(pi);
    const uiError = error(inspector(project,patch)), piError = error(()=>applyAuthoring(pi,[operation(patch)],project));
    expect(uiError).toEqual(piError); expect(uiError.code).toBe('UNSAFE_PROPOSAL'); expect(pi).toEqual(original);
    const draft = createDraft(project), candidate = draft.project;
    expect(()=>draft.apply('Invalid',[operation({striped:false}),operation(patch)])).toThrow('UNSAFE_PROPOSAL');
    expect(draft.project).toBe(candidate); expect(draft.count).toBe(0);
    draft.apply('Recover',[operation({color:'#123456'})]); expect(draft.version).toBe(1); expect(project).toEqual(before);
  });
  it.each([{font:NaN},{padding:Infinity},{striped:'false'},{borders:null},{pageNumbers:0},{repeatHeader:undefined},{css:'body{}'},null,[]])('rejects non-typed patches without mutation %j',patch=> {
    const design = designOf(newProject()), before = structuredClone(design);
    expect(()=>globalStyleChange(design,patch)).toThrow('UNSAFE_PROPOSAL'); expect(design).toEqual(before);
  });
  it('enforces registered types and read-only grant before shared transformations',async()=> {
    const project = newProject(), draft = createDraft(project);
    const tools = createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant('read-only')});
    const tool = tools.find(tool=>tool.name === 'apply_operations');
    const args = {summary:'Denied',operations:[operation({font:10})]};
    const call = async()=> { tool.prepareArguments(args); return tool.execute('global',args); };
    await expect(call()).rejects.toMatchObject({code:'GRANT_DENIED'});
    const writable = createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant('design')}).find(tool=>tool.name === 'apply_operations');
    expect(()=>writable.prepareArguments({summary:'Bad type',operations:[operation({font:'10'})]})).toThrow('AGENT_ARGUMENTS_INVALID');
    expect(draft.project).toBe(project); expect(draft.version).toBe(0);
  });
  it('preserves no-change, duplicate-property and selected-scope guards',()=> {
    const project = newProject(), initial = designOf(project);
    expect(globalStyleChange(initial,{}).design).toEqual(initial);
    const draft = createDraft(project);
    expect(()=>draft.apply('No change',[operation({font:initial.font})])).toThrow('NO_CHANGES');
    expect(()=>draft.apply('Duplicate',[operation({font:10}),operation({font:11})])).toThrow('UNSAFE_PROPOSAL');
    expect(draft.version).toBe(0); expect(draft.project).toBe(project);
    const selected = createDraft(project,{scope:{mode:'selected',id:'header-company'}});
    expect(()=>selected.apply('Escape',[operation({font:10})])).toThrow('UNSAFE_SCOPE');
    expect(selected.version).toBe(0); expect(selected.project).toBe(project);
  });
});
