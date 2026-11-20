import { describe, expect, it } from 'vitest';
import { bindTemplate } from '../document-core/core/binding.js';
import { createGrant } from '../studio-v3/agent-effects.js';
import { parseProposal } from '../studio-v3/ai-edits.js';
import { createBus, designOperations, editProject, replaceData } from '../studio-v3/controller.js';
import { dataSource } from '../studio-v3/data-provenance.js';
import { compileProject, designOf, newProject } from '../studio-v3/model.js';
import { reviewFictionalDataDraft, revokeFictionalDataDraft, stageFictionalDataDraft } from '../studio-v3/fictional-data-draft.js';
import { setupFictionalNoteReview } from '../studio-v3/fictional-note-review.js';
import { bindingValidation } from '../studio-v3/validation.js';

const replacement = 'Reviewed fictional note · 虚构备注';
function stage(bus,changes = {}) {
  return stageFictionalDataDraft(bus,{
    confirmed:true,
    documentId:bus.project.manifest.documentId,
    revision:bus.revision,
    pointer:'/notes',
    value:replacement,
    ...changes
  });
}

describe('private fictional data draft',()=> {
  it.each(['invoice','purchase','delivery'])('stages only one literal, type-preserving note in a %s starter',type=> {
    const bus = createBus(newProject(type));
    const baseline = structuredClone(bus.project);
    const expected = structuredClone(baseline);
    const value = `${replacement} <img src="data:,not-an-image"/>`;
    expected.sampleData.notes = value;
    expected.studioV3Session.erpData.notes = value;
    expected.studioV3Session.source = dataSource('imported-data','Manual note edit');
    expected.studioV3Session.erpSource = dataSource('imported-data','Manual note edit');
    const ticket = stage(bus,{value});
    expect(Object.isFrozen(ticket)).toBe(true);
    expect(JSON.stringify(ticket)).toBe('{"kind":"fictional-data-draft"}');
    const candidate = reviewFictionalDataDraft(bus,ticket);
    expect(candidate).toEqual(expected);
    expect(bindingValidation(candidate).valid).toBe(true);
    const template = document.createElement('template');
    template.innerHTML = candidate.templateHtml;
    const rendered = bindTemplate(template,candidate.sampleData,candidate.manifest);
    expect(rendered.report.errors).toEqual([]);
    expect(rendered.fragment.querySelector('[data-v3-id=footer-notes]').textContent).toBe(value);
    expect(rendered.fragment.querySelector('[data-v3-id=footer-notes] img')).toBeNull();
    candidate.sampleData.items[0].quantity = -100;
    candidate.studioV3Session.erpData.notes = 'Unreviewed';
    expect(reviewFictionalDataDraft(bus,ticket)).toEqual(expected);
    expect(bus.project).toEqual(baseline);
    expect(bus.revision).toBe(0);
    expect(bus.history.canUndo).toBe(false);
  });

  it.each([undefined,false,'true',1])('requires an explicit host confirmation (%s)',confirmed=> {
    expect(()=>stage(createBus(newProject()),{confirmed})).toThrow('DATA_DRAFT_APPROVAL_REQUIRED');
  });

  it('rejects stale document identity or revision before creating a ticket',()=> {
    const bus = createBus(newProject());
    expect(()=>stage(bus,{documentId:'different'})).toThrow('DATA_DRAFT_STALE');
    expect(()=>stage(bus,{revision:1})).toThrow('DATA_DRAFT_STALE');
    expect(()=>stage(bus,{revision:'0'})).toThrow('DATA_DRAFT_STALE');
    bus.deactivate();
    expect(()=>stage(bus)).toThrow('DATA_DRAFT_STALE');
  });

  it.each(['/company/name','/preparedBy','/summary/total','/items/length','/notes/~2','/notes/constructor','/unmapped',''])('denies the path %s',pointer=> {
    expect(()=>stage(createBus(newProject()),{pointer})).toThrow('DATA_DRAFT_FIELD_DENIED');
  });

  it.each([false,null,123,[],{},'x'.repeat(10001)])('denies a non-text or oversized replacement',value=> {
    expect(()=>stage(createBus(newProject()),{value})).toThrow('DATA_DRAFT_VALUE_INVALID');
  });

  it('keeps an empty string typed, and elides an unchanged note',()=> {
    const bus = createBus(newProject());
    expect(reviewFictionalDataDraft(bus,stage(bus,{value:''})).sampleData.notes).toBe('');
    expect(()=>stage(bus,{value:bus.project.sampleData.notes})).toThrow('DATA_DRAFT_NO_CHANGES');
  });

  it('denies a note that is also the pointer of a protected binding',()=> {
    const project = newProject(), design = designOf(project);
    design.footer[0].format = 'number';
    const bus = createBus(compileProject(project,design));
    expect(()=>stage(bus)).toThrow('DATA_DRAFT_FIELD_DENIED');
  });

  it('requires the plain-text note to be visible in its paper preview',()=> {
    const project = newProject(), design = designOf(project);
    design.blocks.footer.enabled = false;
    expect(()=>stage(createBus(compileProject(project,design)))).toThrow('DATA_DRAFT_FIELD_DENIED');
    design.blocks.footer.enabled = true;
    design.footer[0].pointer = '/preparedBy';
    expect(()=>stage(createBus(compileProject(project,design)))).toThrow('DATA_DRAFT_FIELD_DENIED');
  });

  it('runs source schema and binding validation on the candidate independently of the explicit command',()=> {
    const source = newProject();
    source.schema.properties = {notes:{type:'string',const:source.sampleData.notes}};
    expect(bindingValidation(source).valid).toBe(true);
    const bus = createBus(source);
    expect(()=>stage(bus)).toThrow('DATA_DRAFT_VALIDATION_FAILED');
    expect(bus.project.sampleData.notes).toBe(source.sampleData.notes);

    const other = newProject(), design = designOf(other);
    design.footer[1].pointer = '/missing';
    const invalid = createBus(compileProject(other,design));
    expect(()=>stage(invalid)).toThrow('DATA_DRAFT_VALIDATION_FAILED');
  });

  it('denies identical bytes from an imported source or any stored record, including IDs labeled as built-in',()=> {
    const source = newProject();
    const stored = {id:'starter:invoice',revision:1,title:'Stored invoice',type:'invoice',origin:'builtin-demo'};
    expect(()=>stage(createBus(source,null,'imported-data'))).toThrow('DATA_DRAFT_SOURCE_DENIED');
    expect(()=>stage(createBus(source,stored))).toThrow('DATA_DRAFT_SOURCE_DENIED');
    expect(()=>stage(createBus(source,null,'local-demo'))).toThrow('DATA_DRAFT_SOURCE_DENIED');
  });

  it('does not treat modified, canonical or receipt-bearing data as a fictional starter',()=> {
    const changed = newProject();
    changed.sampleData.notes = 'Incoming data with a demo label';
    expect(()=>stage(createBus(changed))).toThrow('DATA_DRAFT_SOURCE_DENIED');
    const canonical = newProject();
    canonical.sampleData.profile = 'canonical-profile/v1';
    expect(()=>stage(createBus(canonical))).toThrow('DATA_DRAFT_SOURCE_DENIED');
    const receipt = newProject();
    receipt.manifest.localImport = {sourceText:'imported data'};
    expect(()=>stage(createBus(receipt))).toThrow('DATA_DRAFT_SOURCE_DENIED');
    const schema = newProject();
    schema.manifest.datasetSchema = {datasetId:'stored',sourceId:'source',version:'1'};
    expect(()=>stage(createBus(schema))).toThrow('DATA_DRAFT_SOURCE_DENIED');
    const sparse = newProject();
    delete sparse.sampleData.items[0];
    expect(()=>stage(createBus(sparse))).toThrow('DATA_DRAFT_SOURCE_DENIED');
  });

  it('denies validation scenarios and host policies that explicitly classify the data as non-fictional',async()=> {
    const bus = createBus(newProject());
    bus.dataPolicy.classification = 'real';
    expect(()=>stage(bus)).toThrow('DATA_DRAFT_SOURCE_DENIED');
    bus.dataPolicy.classification = 'unknown';
    expect(()=>stage(bus)).toThrow('DATA_DRAFT_SOURCE_DENIED');
    delete bus.dataPolicy.classification;
    await replaceData(bus,bus.project.sampleData,'45');
    expect(()=>stage(bus)).toThrow('DATA_DRAFT_SOURCE_DENIED');
  });

  it('denies private human input while the host permits sending document values to the provider',()=> {
    const bus = createBus(newProject());
    Object.assign(bus.dataPolicy,{classification:'synthetic',allowProviderDocumentContext:true});
    expect(()=>stage(bus)).toThrow('DATA_DRAFT_SOURCE_DENIED');
    bus.dataPolicy.allowProviderDocumentContext = false;
    const candidate = reviewFictionalDataDraft(bus,stage(bus));
    expect(candidate.studioV3Session.source.kind).toBe('imported-data');
    expect(bus.dataPolicy.allowProviderDocumentContext).toBe(false);
  });

  it('binds tickets to the exact host bus, supports revocation and rejects copied or reconstructed tickets',()=> {
    const bus = createBus(newProject()), ticket = stage(bus);
    expect(()=>reviewFictionalDataDraft(createBus(bus.project),ticket)).toThrow('DATA_DRAFT_STALE');
    expect(()=>reviewFictionalDataDraft(bus,structuredClone(ticket))).toThrow('DATA_DRAFT_STALE');
    expect(()=>reviewFictionalDataDraft(bus,{kind:ticket.kind})).toThrow('DATA_DRAFT_STALE');
    expect(reviewFictionalDataDraft(bus,ticket).sampleData.notes).toBe(replacement);
    revokeFictionalDataDraft(ticket);
    expect(()=>reviewFictionalDataDraft(bus,ticket)).toThrow('DATA_DRAFT_STALE');
  });

  it('invalidates a staged candidate through actual edit and history revisions',async()=> {
    const bus = createBus(newProject()), ticket = stage(bus), design = designOf(bus.project);
    design.color = '#224466';
    await editProject(bus,designOperations(bus.project,design),'Design edit');
    expect(()=>reviewFictionalDataDraft(bus,ticket)).toThrow('DATA_DRAFT_STALE');
    await bus.navigateHistory('undo',bus.revision);
    expect(()=>reviewFictionalDataDraft(bus,ticket)).toThrow('DATA_DRAFT_STALE');
    expect(reviewFictionalDataDraft(bus,stage(bus)).sampleData.notes).toBe(replacement);
  });

  it.each([
    ['data',bus=>{bus.project.sampleData.items[0].quantity = 14;}],
    ['row removal',bus=>{delete bus.project.sampleData.items[0];}],
    ['source',bus=>{bus.project.studioV3Session.source = dataSource('imported-data');}],
    ['schema',bus=>{bus.project.schema.title = 'Changed schema';}],
    ['policy',bus=>{bus.dataPolicy.classification = 'real';}],
    ['dataset',bus=>{bus.project.studioV3Session.database = {id:'saved',revision:1};}]
  ])('detects unversioned %s changes and revokes the candidate permanently',(_kind,change)=> {
    const bus = createBus(newProject()), ticket = stage(bus);
    const project = structuredClone(bus.project), policy = structuredClone(bus.dataPolicy);
    change(bus);
    expect(bus.revision).toBe(0);
    expect(()=>reviewFictionalDataDraft(bus,ticket)).toThrow('DATA_DRAFT_STALE');
    bus.history.currentProject = project;
    bus.dataPolicy = policy;
    expect(()=>reviewFictionalDataDraft(bus,ticket)).toThrow('DATA_DRAFT_STALE');
  });

  it('does not grant a data profile or extend the design proposal envelope',()=> {
    const bus = createBus(newProject());
    const candidate = reviewFictionalDataDraft(bus,stage(bus));
    expect(()=>createGrant('data')).toThrow('GRANT_PROFILE_UNAVAILABLE');
    expect(()=>parseProposal(JSON.stringify({
      summary:'Edit a note',
      operations:[{type:'set_style',patch:{color:'#102030'}}],
      sampleData:candidate.sampleData
    }),bus.project)).toThrow('UNSAFE_PROPOSAL');
  });

  it('requires adoption even when the private starter draft has the exact fictional sample',()=> {
    const bus = createBus(newProject()), root = document.createElement('div');
    root.innerHTML = `<button data-review-fictional-note>Review</button><dialog id="fictional-note-dialog">
      <textarea id="fictional-note-value"></textarea><div class="new-form-paper"><iframe></iframe></div>
      <p data-note-status></p><button data-note-suggest></button><button data-note-preview></button><button data-note-apply></button><button data-note-cancel></button>
    </dialog>`;
    const review = root.querySelector('dialog');
    review.showModal = ()=>{ review.open = true; };
    let privateDraft = true, notice;
    setupFictionalNoteReview({root,getBus:()=>bus,state:{dataDraft:null},database:{},
      drafts:{drafts:new Map(),applying:new Set()},ai:{},status:text=>{notice=text;},isPrivateDraft:()=>privateDraft});
    root.querySelector('[data-review-fictional-note]').click();
    expect(review.open).toBe(false);
    expect(notice).toContain('Finish current edits');
    privateDraft = false;
    root.querySelector('[data-review-fictional-note]').click();
    expect(review.open).toBe(true);
    expect(root.querySelector('textarea').value).toBe(bus.project.sampleData.notes);
  });
});
