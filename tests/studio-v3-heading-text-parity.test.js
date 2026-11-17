import {describe,it,expect} from 'vitest';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {createBus,formDesign,designOperations,editProject} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {applyAuthoring} from '../studio-v3/ai-authoring.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {headingTextChange} from '../studio-v3/heading-text.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {createAgentTools} from '../studio-v3/agent-tools.js';
import {createGrant} from '../studio-v3/agent-effects.js';
const operation = value => ({type:'set_heading',value});
const inspector = (project,value)=> {
  const root = document.createElement('div'); root.innerHTML = rightView(project,{mode:'design',selected:'header',tab:'properties',report:null});
  const form = root.querySelector('form[data-form=block]'); form.elements.title.value = value;
  return ()=>formDesign(project,'header',form,'block');
};
const error = fn => { try {fn();} catch(e) { return {code:e.code,message:e.message}; } throw Error('Expected rejection'); };
function fixture(type,blank) {
  const project = newProject(type,blank), design = designOf(project);
  // Match the header inspector's existing explicit false default, not a text change.
  design.blocks.header.keepTogether = false;
  return compileProject(project,design);
}
describe('shared heading text and actual inspector/Pi adapters',()=> {
  it.each(['Equipment handover','交付确认 / Delivery','', '  Untrimmed heading  ','X'.repeat(100),'<script>alert(1)</script>'])('heading inspector and operation produce equivalent candidates %s',async value=> {
    for (const type of ['invoice','purchase','delivery']) for (const blank of [false,true]) {
      const project = fixture(type,blank), before = structuredClone(project), initial = designOf(project);
      const ui = inspector(project,value)(), pi = designOf(project), expected = {...initial,title:value};
      applyAuthoring(pi,[operation(value)],project);
      expect(ui).toEqual(expected); expect(pi).toEqual(expected); expect(headingTextChange(initial,value).design).toEqual(expected);
      const draft = createDraft(project,{scope:{mode:'selected',id:'header-title'}}), step = draft.apply('Heading',[operation(value)]);
      expect(step.candidate).toEqual(compileProject(project,expected));
      expect(bindingValidation(step.candidate)).toEqual(bindingValidation(compileProject(project,ui)));
      expect(step.candidate.sampleData).toEqual(before.sampleData); expect(step.candidate.schema).toEqual(before.schema);
      expect(step.design.blocks.header.enabled).toBe(!blank);
      const bus = createBus(project); await editProject(bus,designOperations(bus.project,ui),'Heading');
      expect(bus.revision).toBe(1); expect(designOf(bus.project)).toEqual(expected);
      await bus.navigateHistory('undo',bus.revision); expect(designOf(bus.project)).toEqual(initial); expect(project).toEqual(before);
    }
  });
  it('rejects an oversized title identically and recovers without a partial draft',()=> {
    const project = fixture('invoice',false), before = structuredClone(project), value = 'X'.repeat(101), pi = designOf(project);
    expect(error(inspector(project,value))).toEqual(error(()=>applyAuthoring(pi,[operation(value)],project)));
    expect(pi).toEqual(designOf(project));
    const draft = createDraft(project);
    expect(()=>draft.apply('Invalid',[{type:'set_style',patch:{font:10}},operation(value)])).toThrow('UNSAFE_PROPOSAL');
    expect(draft.project).toBe(project); expect(draft.version).toBe(0);
    draft.apply('Recovery',[operation('Recovered')]); expect(draft.version).toBe(1); expect(project).toEqual(before);
  });
  it.each([null,undefined,4,false,{},[]])('rejects non-text values without mutating the input %j',value=> {
    const project = fixture('invoice',false), design = designOf(project), before = structuredClone(design);
    expect(()=>headingTextChange(design,value)).toThrow('UNSAFE_PROPOSAL');
    expect(()=>applyAuthoring(design,[operation(value)],project)).toThrow('UNSAFE_PROPOSAL'); expect(design).toEqual(before);
  });
  it('preserves no-op, duplicate, selected-scope and read-only rejection',async()=> {
    const project = fixture('invoice',false), draft = createDraft(project);
    expect(()=>draft.apply('Noop',[operation(project.manifest.studioV3.title)])).toThrow('NO_CHANGES');
    expect(()=>draft.apply('Duplicate',[operation('A'),operation('B')])).toThrow('UNSAFE_PROPOSAL');
    const scoped = createDraft(project,{scope:{mode:'selected',id:'items'}});
    expect(()=>scoped.apply('Escape',[operation('A')])).toThrow('UNSAFE_SCOPE');
    const tool = createAgentTools({draft,outcome:{},context:()=>'',signal:new AbortController().signal,limits:{maxTurns:100,maxRepeatedFailures:100},grant:createGrant('read-only')}).find(tool=>tool.name==='apply_operations');
    const args = {summary:'Denied',operations:[operation('A')]};
    await expect((async()=>{tool.prepareArguments(args);return tool.execute('heading',args);})()).rejects.toMatchObject({code:'GRANT_DENIED'});
    expect(draft.project).toBe(project); expect(scoped.project).toBe(project);
  });
});
