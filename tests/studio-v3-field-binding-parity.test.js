import {describe,expect,it} from 'vitest';
import {compileProject,designOf,newProject,selectionField} from '../studio-v3/model.js';
import {createBus,designOperations,editProject,formDesign} from '../studio-v3/controller.js';
import {rightView} from '../studio-v3/workspace-views.js';
import {createDraft} from '../studio-v3/agent-draft.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {bindTemplate} from '../document-core/core/binding.js';
import {saveProject,readProject} from '../studio-v3/file-io.js';

const sourceTarget = 'header-number';
const asset = {id:'mark',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',alt:'Fictional mark'};
const barcode = {format:'EAN13',moduleWidth:3,height:51,displayValue:true};
const invoiceCode = '0123456789012';
function projectFixture(type='invoice') {
  const project = newProject(type);
  project.sampleData.document.reference = invoiceCode;
  const design = designOf(project);
  design.assets = [asset];
  return compileProject(project,design);
}
function inspector(project,target,values) {
  const host = document.createElement('div');
  host.innerHTML = rightView(project,{mode:'design',selected:target,tab:'binding'});
  const form = host.querySelector('form[data-form=binding]');
  for (const [name,value] of Object.entries(values)) {
    const control = form.elements.namedItem(name);
    if (typeof value === 'boolean') control.checked = value;
    else control.value = value;
  }
  return formDesign(project,target,form,'binding');
}
const operation=(target,patch)=>({type:'set_field',target,patch});
const text='  literal <b>childcare</b> & 茶  ';
const cases=[
  ['bound',{bindingMode:'bound',pointer:'/document/reference'},{pointer:'/document/reference'},field=>({pointer:'/document/reference',lastPointer:'/document/reference',format:field.format})],
  ['static',{bindingMode:'static',text},{kind:'static',text},field=>({kind:'static',pointer:'',lastPointer:field.pointer,text})],
  ['image',{bindingMode:'image',assetId:'mark',imageWidth:'65.25',imageHeight:'32.5'},
    {kind:'image',assetId:'mark',width:65.25,height:32.5,fit:'contain',text:'',format:''},
    field=>({kind:'image',assetId:'mark',width:65.25,height:32.5,fit:'contain',pointer:'',lastPointer:field.pointer,text:'',format:''})],
  ['barcode',{bindingMode:'barcode',pointer:'/document/reference',barcodeFormat:'EAN13',barcodeModuleWidth:'3',barcodeHeight:'51',barcodeDisplayValue:true},
    {kind:'barcode',pointer:'/document/reference',barcode,text:'',format:''},
    ()=>({kind:'barcode',pointer:'/document/reference',lastPointer:'/document/reference',text:'',format:'',barcode})]
];

describe('shared binding modes through the real Inspector and Pi draft',()=> {
  it.each(cases)('field %s inspector and operation produce equivalent candidates',async(mode,values,patch,expected)=> {
    const project = projectFixture(), before = structuredClone(project), current = selectionField(designOf(project),sourceTarget).field;
    const ui = inspector(project,sourceTarget,values), candidate = compileProject(project,ui);
    const draft = createDraft(project,{scope:{mode:'selected',id:sourceTarget}});
    const pi = draft.apply('Change field value source',[operation(sourceTarget,patch)]);
    expect(selectionField(ui,sourceTarget).field).toMatchObject(expected(current));
    expect(pi.candidate).toEqual(candidate);
    expect(bindingValidation(pi.candidate)).toEqual(bindingValidation(candidate));
    const template = document.createElement('template');
    template.innerHTML = candidate.templateHtml;
    const rendered = bindTemplate(template,candidate.sampleData,candidate.manifest);
    expect(rendered.report.errors).toEqual([]);
    const node = rendered.fragment.querySelector(`[data-v3-id="${sourceTarget}"]`);
    if (mode === 'image') expect(node.style.objectFit).toBe('contain');
    if (mode === 'barcode') expect(node.querySelector('svg text')?.textContent).toBe(invoiceCode);
    if (mode === 'static') {
      expect(node.textContent).toBe(text);
      expect(node.querySelector('b')).toBeNull();
    }
    if (mode === 'bound') expect(node.textContent).toBe(invoiceCode);
    const bus = createBus(project);
    await editProject(bus,designOperations(bus.project,ui),'Inspector binding');
    expect(designOf(readProject(saveProject(bus.project)))).toEqual(ui);
    await bus.navigateHistory('undo',bus.revision);
    expect(designOf(bus.project)).toEqual(designOf(before));
    expect(draft.project.sampleData).toEqual(before.sampleData);
    expect(draft.project.schema).toEqual(before.schema);
    expect(project).toEqual(before);
  });

  it.each(['items','table-extra'])('renders literal text on %s without changing its column width', block=> {
    const project = projectFixture(), design = designOf(project), item = design.columns.find(field=>field.id==='description');
    if (block === 'table-extra') design.additionalTables = [{id:block,label:'Extra',collection:design.collection,columns:[structuredClone(item)],enabled:true,repeatHeader:true,breakBefore:false}];
    const fixture = compileProject(project,design), target = `${block}-description`;
    const ui = inspector(fixture,target,{bindingMode:'static',text});
    const pi = createDraft(fixture).apply('Use a literal',[operation(target,{kind:'static',text})]);
    expect(pi.candidate).toEqual(compileProject(fixture,ui));
    expect(selectionField(ui,target).field).toMatchObject({text,width:item.width,pointer:'',lastPointer:item.pointer});
  });

  it('switches away from an image without retaining dimensions and keeps the human fallback pointer',()=> {
    const project = projectFixture(), image = compileProject(project,inspector(project,sourceTarget,{bindingMode:'image',assetId:'mark'}));
    const ui = inspector(image,sourceTarget,{bindingMode:'bound'}), draft = createDraft(image);
    const pi = draft.apply('Rebind number',[operation(sourceTarget,{kind:'bound',pointer:'/document/number'})]);
    expect(pi.candidate).toEqual(compileProject(image,ui));
    const field = selectionField(ui,sourceTarget).field;
    for (const key of ['assetId','height','width','fit','barcode']) expect(field).not.toHaveProperty(key);
    expect(ui.assets).toEqual([asset]);
  });

  it.each([
    [{bindingMode:'bound',pointer:'/constructor/not-safe'},{pointer:'/constructor/not-safe'}],
    [{bindingMode:'image',assetId:'mark',imageWidth:'7'},{kind:'image',assetId:'mark',width:7,height:60}],
    [{bindingMode:'barcode',pointer:'/document/reference',barcodeModuleWidth:'1.5'},{kind:'barcode',pointer:'/document/reference',barcode:{...barcode,moduleWidth:1.5}}]
  ])('rejects invalid Inspector and Pi values without poisoning recovery', (values,patch)=> {
    const project = projectFixture(), draft = createDraft(project);
    expect(()=>designOperations(project,inspector(project,sourceTarget,values))).toThrow();
    expect(()=>draft.apply('Invalid',[operation(sourceTarget,patch)])).toThrow();
    expect(draft.project).toBe(project);
    expect(draft.version).toBe(0);
    expect(()=>draft.apply('Recovered',[operation(sourceTarget,{pointer:'/document/reference'})])).not.toThrow();
  });

  it('preserves Pi restrictions on duplicate writes, private binding paths and selected scope',()=> {
    const project = projectFixture();
    expect(()=>createDraft(project).apply('Duplicate',[operation(sourceTarget,{pointer:'/document/reference'}),operation(sourceTarget,{pointer:'/document/number'})])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>createDraft(project).apply('Unavailable',[operation(sourceTarget,{pointer:'/private'})])).toThrow('UNSAFE_PROPOSAL');
    expect(()=>createDraft(project,{scope:{mode:'selected',id:'header-company'}}).apply('Wrong field',[operation(sourceTarget,{pointer:'/document/reference'})])).toThrow('UNSAFE_SCOPE');
  });
});
