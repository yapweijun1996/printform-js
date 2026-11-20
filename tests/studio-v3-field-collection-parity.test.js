import { describe, expect, it } from 'vitest';
import { alterFields, createBus, designOperations, editProject, formDesign } from '../studio-v3/controller.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { applyAuthoring } from '../studio-v3/ai-authoring.js';
import { compileProject, designOf, newProject } from '../studio-v3/model.js';
import { rightView } from '../studio-v3/workspace-views.js';
import { bindingValidation } from '../studio-v3/validation.js';
import { alterTables } from '../studio-v3/additional-table-controls.js';

function proposal(project,operations,options) {
  return createDraft(project,options).apply('Edit form',operations);
}

function collectionForm(project,target,pointer,tab='binding') {
  const root = document.createElement('div');
  root.innerHTML = rightView(project,{mode:'design',selected:target,tab,report:null});
  const form = root.querySelector('form[data-form=collection],form[data-form=additional-table]');
  form.elements.collection.value = pointer;
  return formDesign(project,target,form,form.dataset.form);
}

async function equivalent(project,expected,ui,step) {
  const before = structuredClone(project);
  expect(ui).toEqual(expected);
  expect(step.design).toEqual(expected);
  const candidate = compileProject(project,expected);
  expect(step.candidate).toEqual(candidate);
  expect(step.candidate.sampleData).toEqual(project.sampleData);
  expect(step.candidate.schema).toEqual(project.schema);
  const bus = createBus(project);
  await editProject(bus,designOperations(bus.project,ui),'Edit form');
  expect(designOf(bus.project)).toEqual(expected);
  expect(bindingValidation(bus.project)).toEqual(bindingValidation(candidate));
  await bus.navigateHistory('undo',bus.revision);
  expect(designOf(bus.project)).toEqual(designOf(project));
  expect(project).toEqual(before);
}

function delivery() {
  const project = newProject('delivery');
  project.sampleData.lines = structuredClone(project.sampleData.items);
  project.sampleData.lines[0].description = 'Alternate supplied delivery record';
  return project;
}

describe('shared field collection through the Inspector and Pi',()=> {
  it.each(['invoice','purchase','delivery'])('field addition and removal produce equivalent candidates: %s',async type=> {
    const project = newProject(type), ui = alterFields(project,'footer','add-field');
    const id = ui.selected.slice('footer-'.length);
    expect(id).toMatch(/^field-[a-f0-9]{8}$/);
    const field = {id,label:'New field',pointer:'',format:'',text:'New text'};
    const expected = designOf(project);
    expected.footer.push(field);
    const step = proposal(project,[{type:'add_field',section:'footer',field:{id,label:'New field',text:'New text'}}]);
    expect(step.diff).toContainEqual({target:ui.selected,property:'add_field',before:'null',after:ui.selected});
    await equivalent(project,expected,ui.design,step);

    const after = step.candidate;
    const removed = alterFields(after,ui.selected,'remove-field');
    expect(removed.selected).toBe('footer');
    const removal = proposal(after,[{type:'remove_field',target:ui.selected}]);
    expect(removal.diff).toContainEqual({target:ui.selected,property:'remove_field',before:ui.selected,after:'null'});
    await equivalent(after,designOf(project),removed.design,removal);
  });

  it('retains Inspector width allocation while a Pi batch with explicit widths produces the same columns',async()=> {
    const project = newProject(), ui = alterFields(project,'items-header','add-field'), expected = designOf(project);
    const widths = [5.4,13.5,33.3,9,13.5,15.3];
    const operations = expected.columns.map((column,index)=>({type:'set_field',target:`items-${column.id}`,patch:{width:widths[index]}}));
    const field = {id:ui.selected.slice('items-'.length),label:'New field',pointer:'./no',format:'',text:'',width:10};
    expected.columns.forEach((column,index)=>{column.width=widths[index];});
    expected.columns.push(field);
    const step = proposal(project,[...operations,{type:'add_field',section:'items',field}]);
    await equivalent(project,expected,ui.design,step);
  });

  it('field reorder produces equivalent candidates in the primary table and preserves a boundary no-op',async()=> {
    const project = newProject(), expected = designOf(project);
    const [first,second,...rest] = expected.columns;
    expected.columns = [second,first,...rest];
    const ui = alterFields(project,'items-sku','move-up');
    expect(ui.selected).toBe('items-sku');
    const order = expected.columns.map(column=>`items-${column.id}`);
    const step = proposal(project,[{type:'reorder_fields',section:'items',order}]);
    expect(step.diff).toContainEqual({target:'items',property:'field_order',before:JSON.stringify(designOf(project).columns.map(column=>`items-${column.id}`)),after:JSON.stringify(order)});
    await equivalent(project,expected,ui.design,step);
    expect(alterFields(project,'items-no','move-up').design).toEqual(designOf(project));
  });

  it('retains adapter-specific enable behavior and human-only additional-table add/reorder',()=> {
    const blank = newProject('invoice',true), added = alterFields(blank,'footer','add-field');
    const field = added.design.footer[0];
    expect(added.design.blocks.footer.enabled).toBe(true);
    expect(proposal(blank,[{type:'add_field',section:'footer',field}]).design.blocks.footer.enabled).toBe(false);
    const project = delivery();
    const {design,selected} = alterTables(project,'items','add-table');
    const extra = compileProject(project,design);
    expect(alterFields(extra,selected,'add-field').design.additionalTables[0].columns).toHaveLength(design.additionalTables[0].columns.length+1);
    const [first,second] = design.additionalTables[0].columns;
    const extraOrder = alterFields(extra,`${selected}-${second.id}`,'move-up').design.additionalTables[0].columns;
    expect(extraOrder.slice(0,2).map(column=>column.id)).toEqual([second.id,first.id]);
    expect(()=>proposal(extra,[{type:'add_field',section:selected,field:{id:'new',width:10}}])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>proposal(extra,[{type:'reorder_fields',section:selected,order:extraOrder.map(column=>`${selected}-${column.id}`)}])).toThrow('UNSAFE_PROPOSAL');
  });

  it('keeps rejection and recovery atomic for invalid ids, permutations, and scope',()=> {
    const project = newProject(), draft = createDraft(project,{scope:{mode:'selected',id:'footer'}});
    const add = {type:'add_field',section:'footer',field:{id:'new',text:'New text'}};
    for (const operation of [
      {...add,field:{id:'notes'}},
      {type:'remove_field',target:'label-footer-notes'},
      {type:'remove_field',target:'footer-missing'},
      {type:'reorder_fields',section:'footer',order:['footer-notes','footer-notes']},
      {type:'reorder_fields',section:'footer',order:['footer-notes','customer-bill']}
    ]) expect(()=>draft.apply('Invalid',[operation])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>draft.apply('Scope escape',[{...add,section:'customer'}])).toThrow('UNSAFE_SCOPE');
    expect(draft.project).toBe(project);
    expect(draft.version).toBe(0);
    draft.apply('Recovery',[add]); expect(draft.project.manifest.studioV3.footer.at(-1).id).toBe('new');
    expect(draft.undo()).toBe(true); expect(draft.project).toBe(project);
  });

  it('retains additional-table removal and prevents an invalid zero-column result',()=> {
    const project = delivery(), {design,selected} = alterTables(project,'items','add-table');
    const table = design.additionalTables[0];
    const target = `${selected}-${table.columns[0].id}`, extra = compileProject(project,design);
    const ui = alterFields(extra,target,'remove-field');
    expect(ui.design).toEqual(proposal(extra,[{type:'remove_field',target}]).design);
    table.columns = table.columns.slice(0,1);
    const single = compileProject(project,design);
    expect(()=>designOperations(single,alterFields(single,target,'remove-field').design)).toThrow('one to thirty columns');
    expect(()=>proposal(single,[{type:'remove_field',target}])).toThrow('UNSAFE_PROPOSAL');
  });
});

describe('shared collection pointer through the Inspector and Pi',()=> {
  const set = value => ({type:'set_collection',value});

  it('table collection edit produces equivalent candidates without changing supplied rows',async()=> {
    const project = delivery(), expected = designOf(project);
    expected.collection = '/lines';
    const design = collectionForm(project,'items','/lines');
    const step = proposal(project,[set('/lines')],{request:'Use the /lines array'});
    await equivalent(project,expected,design,step);
    expect(step.diff).toEqual([{target:'items',property:'collection',before:'/items',after:'/lines'}]);
  });

  it.each(['./relative','/rows/*','/rows/~2','/rows/constructor'])('rejects invalid collection %s without mutating the design',pointer=> {
    const project = delivery(), design = designOf(project);
    expect(()=>collectionForm(project,'items',pointer)).toThrow('absolute JSON pointer');
    expect(()=>applyAuthoring(design,[set(pointer)],project)).toThrow('UNSAFE_PROPOSAL');
    expect(design).toEqual(designOf(project));
  });

  it('preserves human repair of unresolved pointers and Pi scope and binding authority',()=> {
    const project = delivery(), draft = createDraft(project);
    expect(collectionForm(project,'items-header','/future').collection).toBe('/future');
    expect(()=>draft.apply('Missing',[set('/future')])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>draft.apply('No change',[set('/items')])).toThrow('NO_CHANGES');
    expect(()=>proposal(project,[set('/lines')],{request:'Use /lines',scope:{mode:'selected',id:'footer'}})).toThrow('UNSAFE_SCOPE');
    expect(draft.version).toBe(0);
    expect(proposal(project,[set('/lines')],{request:'Use /lines'}).design.collection).toBe('/lines');
    const {design,selected} = alterTables(project,'items','add-table');
    const extra = compileProject(project,design);
    const edited = collectionForm(extra,selected,'/items','properties');
    expect(edited.additionalTables[0].collection).toBe('/items');
    expect(edited.collection).toBe('/items');
  });
});
