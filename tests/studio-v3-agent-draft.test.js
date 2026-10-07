import {describe,it,expect} from 'vitest';
import {newProject,designOf} from '../studio-v3/model.js';
import {createDraft} from '../studio-v3/agent-draft.js';

const note = {type:'add_field',section:'footer',field:{id:'note-two',label:'Extra note',kind:'static',text:'Authored note'}};
const reorder = {type:'reorder_fields',section:'footer',order:['footer-note-two','footer-notes','footer-signature']};
const color = value => ({type:'set_style',patch:{color:value}});
const code = work => { try { work(); } catch (error) { return error.code; } return null; };

describe('the agent draft',()=> {
  it('starts as the live form and never changes it',()=> {
    const project = newProject(), before = structuredClone(project), draft = createDraft(project);
    expect(draft.project).toBe(project); expect(draft.count).toBe(0);
    draft.apply('Add a note',[note]);
    expect(project).toEqual(before); expect(draft.project).not.toBe(project);
  });

  it('builds each step on the previous one',()=> {
    const draft = createDraft(newProject());
    draft.apply('Add a note',[note]);
    draft.apply('Put it first',[reorder]); // only valid because step one added footer-note-two
    expect(designOf(draft.project).footer[0].id).toBe('note-two'); expect(draft.count).toBe(2);
  });

  it('rejects a bad step with its code and leaves no trace',()=> {
    const draft = createDraft(newProject());
    draft.apply('Add a note',[note]);
    const before = structuredClone(designOf(draft.project));
    expect(code(()=>draft.apply('Nothing there',[{type:'set_field',target:'nowhere',patch:{width:10}}]))).toBe('UNSAFE_PROPOSAL');
    expect(code(()=>draft.apply('Same again',[color(designOf(draft.project).color)]))).toBe('NO_CHANGES');
    expect(draft.count).toBe(1); expect(designOf(draft.project)).toEqual(before);
  });

  it('undoes the last step, and says so when there is nothing to undo',()=> {
    const project = newProject(), draft = createDraft(project);
    expect(draft.undo()).toBe(false);
    draft.apply('Add a note',[note]); draft.apply('Recolour',[color('#163a65')]);
    expect(draft.undo()).toBe(true); expect(draft.count).toBe(1); expect(designOf(draft.project).color).toBe(designOf(project).color);
    expect(draft.undo()).toBe(true); expect(draft.project).toBe(project); expect(draft.undo()).toBe(false);
  });

  it('keeps the selected scope on every step',()=> {
    const draft = createDraft(newProject(),{scope:{mode:'selected',id:'customer'}});
    expect(code(()=>draft.apply('Recolour everything',[color('#163a65')]))).toBe('UNSAFE_SCOPE');
    expect(draft.count).toBe(0);
  });

  it('turns many steps into one proposal against the original form',()=> {
    const project = newProject(), draft = createDraft(project);
    draft.apply('Add a note',[note]); draft.apply('Recolour',[color('#163a65')]); draft.apply('Recolour again',[color('#a82938')]);
    const proposal = draft.proposal('Tidy the form');
    expect(proposal.kind).toBe('proposal'); expect(proposal.summary).toBe('Tidy the form');
    const colours = proposal.diff.filter(entry=>entry.target === 'style' && entry.property === 'color');
    expect(colours).toEqual([{target:'style',property:'color',before:designOf(project).color,after:'#a82938'}]);
    expect(proposal.operations).toHaveLength(3); expect(proposal.design).toEqual(designOf(draft.project));
    expect(proposal.candidate).toBe(draft.project); expect(proposal.candidate.sampleData).toEqual(project.sampleData);
    expect(proposal.targets).toEqual(expect.arrayContaining(['style','footer-note-two']));
  });

  it('drops a change that was made and then reverted by a later step',()=> {
    const project = newProject(), draft = createDraft(project), original = designOf(project).color;
    draft.apply('Add a note',[note]); draft.apply('Recolour',[color('#163a65')]); draft.apply('Back again',[color(original)]);
    expect(draft.proposal('Only the note').diff.some(entry=>entry.target === 'style' && entry.property === 'color')).toBe(false);
  });

  it('has nothing to propose before any step',()=> {
    expect(code(()=>createDraft(newProject()).proposal('Nothing'))).toBe('NO_CHANGES');
  });
});
