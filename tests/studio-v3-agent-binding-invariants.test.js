import {describe,it,expect} from 'vitest';
import {newProject,designOf} from '../studio-v3/model.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {parseProposal} from '../studio-v3/ai-edits.js';

const field = (project,id='rate')=>structuredClone(designOf(project).columns.find(f=>f.id===id));
const remove = id=>({type:'remove_field',target:`items-${id}`});
const add = f=>({type:'add_field',section:'items',field:f});
describe('initial binding invariants across agent steps',()=> {
  it('rejects financial re-addition under another pointer and preserves the last valid draft',()=> {
    const project=newProject(),before=structuredClone(project),draft=createDraft(project),original=field(project);
    draft.apply('Remove the column',[remove('rate')]); const valid=draft.project;
    expect(()=>draft.apply('Re-add another value',[add({...original,pointer:'./quantity'})])).toThrow('UNSAFE_PROPOSAL');
    expect(draft.project).toBe(valid);expect(draft.count).toBe(1);expect(project).toEqual(before);
    draft.apply('Restore correct column',[add(original)]); expect(field(draft.project)).toEqual(original);
  });
  it.each([{kind:'static',pointer:'',text:'123',format:''},{format:'number'},{kind:'image',pointer:'',assetId:'missing',height:20}])('rejects replacement numeric semantics after removal: %o',patch=> {
    const project=newProject(),draft=createDraft(project),original=field(project);
    draft.apply('Remove rate',[remove('rate')]);
    expect(()=>draft.apply('Restore with changed semantics',[add({...original,...patch})])).toThrow('UNSAFE_PROPOSAL');
    expect(draft.count).toBe(1);
  });
  it('allows structural removal, correct re-addition with styling, and undo',()=> {
    const project=newProject(),draft=createDraft(project),original=field(project);
    draft.apply('Remove rate',[remove('rate')]);expect(draft.proposal('Removed column').design.columns.some(f=>f.id==='rate')).toBe(false);
    draft.apply('Restore with label styling',[add({...original,labelStyle:{bold:true}})]);
    expect(draft.proposal('Styled').design.columns.find(f=>f.id==='rate').pointer).toBe(original.pointer);
    expect(draft.undo()).toBe(true);expect(draft.undo()).toBe(true);expect(draft.project).toBe(project);
  });
  it('does not let a retained financial row read the same pointer from a different collection',()=> {
    const project=newProject();project.sampleData.more=structuredClone(project.sampleData.items);
    project.schema={type:'object',properties:{more:{type:'array',items:{type:'object',properties:{rate:{type:'number'}}}}}};
    expect(()=>parseProposal(JSON.stringify({summary:'Another collection',operations:[{type:'set_collection',value:'/more'}]}),project)).toThrow('UNSAFE_PROPOSAL');
  });
  it('preserves supported ordinary binding edits and nonfinancial structural fields',()=> {
    const project=newProject();
    expect(parseProposal(JSON.stringify({summary:'Known source',operations:[{type:'set_field',target:'items-description',patch:{pointer:'./sku'}}]}),project).design.columns.find(f=>f.id==='description').pointer).toBe('./sku');
  });
});
