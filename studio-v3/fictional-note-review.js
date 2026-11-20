import { canStageFictionalNote, reviewFictionalDataDraft, revokeFictionalDataDraft, stageFictionalDataDraft } from './fictional-data-draft.js';
import { editProject } from './controller.js';
import { PaperPreview } from './preview.js';
import { inspectProject } from './validation.js';

const errors = {
  DATA_DRAFT_STALE:'The form or source changed. Close this review and start again.',
  DATA_DRAFT_SOURCE_DENIED:'This action requires a fresh fictional starter in an independent tab.',
  DATA_DRAFT_FIELD_DENIED:'Review requires a visible plain-text note binding in the footer.',
  DATA_DRAFT_NO_CHANGES:'Enter a different note before Preview.',
  DATA_DRAFT_VALUE_INVALID:'Enter a note of up to 10,000 characters.',
  DATA_DRAFT_VALIDATION_FAILED:'This edit does not pass the current source schema and bindings.'
};

export function setupFictionalNoteReview({getBus,state,database,drafts,ai,queueEdit,changed,status,isPrivateDraft,root=document}) {
  const dialog = root.querySelector('#fictional-note-dialog');
  const input = dialog.querySelector('#fictional-note-value'), scroll = dialog.querySelector('.new-form-paper');
  const frame = dialog.querySelector('iframe'), notice = dialog.querySelector('[data-note-status]');
  const preview = dialog.querySelector('[data-note-preview]'), apply = dialog.querySelector('[data-note-apply]');
  const cancel = dialog.querySelector('[data-note-cancel]');
  let baseline, ticket, checked, renderer, applying = false;

  const hasConflicts = () => Boolean(isPrivateDraft() || state.fileReads || state.running || state.dataDraft !== null ||
    database.busy || database.pending || database.draft || database.importReview ||
    drafts.drafts.size || drafts.applying.size || ai.busy || ai.viewing || ai.proposal);

  function resetPreview() {
    revokeFictionalDataDraft(ticket);
    ticket = checked = null;
    renderer?.cancel();
    frame.srcdoc = '';
    scroll.hidden = true;
    apply.disabled = true;
  }

  root.addEventListener('click',event=> {
    if (!event.target.closest('[data-review-fictional-note]') || dialog.open) return;
    const bus = getBus();
    if (hasConflicts() || !canStageFictionalNote(bus)) {
      status('Finish current edits and open a fresh fictional starter to review a note.');
      return;
    }
    baseline = {bus,documentId:bus.project.manifest.documentId,revision:bus.revision};
    resetPreview();
    input.value = bus.project.sampleData.notes;
    notice.textContent = '';
    dialog.showModal();
  });
  input.addEventListener('input',()=> {
    resetPreview();
    notice.textContent = '';
  });
  cancel.addEventListener('click',()=>{ if (!applying) dialog.close(); });
  dialog.addEventListener('cancel',event=>{ if (applying) event.preventDefault(); });
  dialog.addEventListener('close',()=> {
    if (dialog.open) return;
    resetPreview();
    baseline = null;
    input.value = '';
  });

  preview.addEventListener('click',async()=> {
    resetPreview();
    notice.textContent = '';
    let staged;
    try {
      const bus = getBus();
      if (!baseline || bus !== baseline.bus || hasConflicts()) throw new Error(errors.DATA_DRAFT_STALE);
      staged = stageFictionalDataDraft(bus,{...baseline,pointer:'/notes',value:input.value,confirmed:true});
      ticket = staged;
      renderer ||= new PaperPreview(frame,()=> {},()=> {});
      const candidate = reviewFictionalDataDraft(bus,staged);
      scroll.hidden = false;
      notice.textContent = 'Checking the note and paper layout…';
      const report = await renderer.render(candidate);
      if (staged !== ticket || !dialog.open) return;
      reviewFictionalDataDraft(getBus(),staged);
      const quality = inspectProject(candidate,report);
      if (!quality.ready) {
        notice.textContent = 'The note preview did not pass print validation. Edit the note and preview again.';
        return;
      }
      checked = staged;
      apply.disabled = false;
      notice.textContent = 'Note preview passed. Review the pages before applying.';
    } catch (error) {
      if (!dialog.open || staged && staged !== ticket) return;
      resetPreview();
      notice.textContent = errors[error.code] || error.message;
    }
  });

  apply.addEventListener('click',async()=> {
    if (!checked || applying) return;
    const approved = checked;
    applying = true;
    input.disabled = preview.disabled = apply.disabled = cancel.disabled = true;
    let committed = false;
    try {
      await queueEdit(async()=> {
        if (!dialog.open || checked !== approved || hasConflicts()) throw new Error(errors.DATA_DRAFT_STALE);
        const bus = getBus(), candidate = reviewFictionalDataDraft(bus,approved);
        await editProject(bus,[{type:'replace_sample_data',value:candidate.sampleData}],'Review fictional note',candidate.studioV3Session);
        committed = true;
        revokeFictionalDataDraft(approved);
        await changed();
      },false);
      dialog.close();
      status('Fictional note applied to this form. Undo restores the previous note.');
    } catch (error) {
      if (committed) {
        dialog.close();
        status('Fictional note applied. The paper preview could not refresh.');
      } else {
        resetPreview();
        notice.textContent = errors[error.code] || error.message;
      }
    } finally {
      applying = false;
      input.disabled = preview.disabled = cancel.disabled = false;
    }
  });
}
