import { newProject } from './model.js';
import { PaperPreview } from './preview.js';
import { inspectProject } from './validation.js';
import { datasetTitleFor } from './database-model.js';

const STARTERS = Object.freeze({blank:'Blank form',invoice:'Invoice',purchase:'Purchase order',delivery:'Delivery note'});
const USAGE = 'Local commands: /new blank, /new invoice, /new purchase, or /new delivery.';
const DOCUMENT_ID = /^v3-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function readNewFormCommand(text) {
  const words = text.trim().toLowerCase().split(/\s+/);
  if (words[0] !== '/new') return null;
  return words.length === 2 && Object.hasOwn(STARTERS,words[1]) ? {kind:words[1]} : {error:USAGE};
}

export function readNewFormOpening(hash, build) {
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has('new-form')) return null;
  const kind = params.get('new-form'), id = params.get('document');
  if (!Object.hasOwn(STARTERS,kind) || !DOCUMENT_ID.test(id) || params.get('build') !== build) return {blocked:true};
  return {kind,id};
}

function createStarter(kind, id) {
  const project = newProject(kind === 'blank' ? 'invoice' : kind,kind === 'blank');
  if (id) project.manifest.documentId = id;
  project.manifest.sampleDataTitle = datasetTitleFor(project);
  return project;
}

export function setupNewFormWorkspace({getBus,pending,root=document,host=window}) {
  const dialog = root.querySelector('#local-new-form-dialog'), apply = dialog.querySelector('[data-new-form-apply]');
  const prompt = dialog.querySelector('[data-new-form-status]'), frame = dialog.querySelector('iframe');
  const build = root.querySelector('meta[name=printform-source-revision]').content;
  const stored = host.history.state?.studioNewForm;
  const prior = Object.hasOwn(STARTERS,stored?.kind) && DOCUMENT_ID.test(stored?.id) ? stored : null;
  const token = readNewFormOpening(host.location.hash,build), opening = prior || token;
  // Consume the launch fragment once. Only the fictional recipe lives in the
  // browser history entry so reload/update recovery stays scoped to this tab.
  if (token && !opening.blocked) {
    host.history.replaceState({...host.history.state,studioNewForm:opening},'',host.location.pathname+host.location.search);
  }
  const origin = root.querySelector('#local-new-form-origin'), notice = origin.querySelector('[data-new-form-return-status]');
  const back = origin.querySelector('[data-new-form-return]');
  let prepared, renderer;

  if (opening) origin.hidden = false;
  back.addEventListener('click',()=> {
    if (!opening?.blocked && pending()) {
      notice.textContent = 'Save or resolve unapplied work before closing, or switch browser tabs to keep both forms.';
      return;
    }
    host.close();
    notice.textContent = 'If this tab stays open, switch to the original Studio tab in your browser.';
  });

  dialog.querySelector('[data-new-form-cancel]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=> {
    prepared = null;
    renderer?.cancel();
    apply.hidden = true;
    frame.srcdoc = '';
  });
  apply.addEventListener('click',event=> {
    const context = getBus();
    if (!prepared?.accepted || context !== prepared.bus || context.revision !== prepared.revision) {
      event.preventDefault();
      apply.hidden = true;
      prompt.textContent = 'The original form changed. Cancel and prepare a fresh preview.';
      return;
    }
    dialog.close();
  });

  async function prepare(command) {
    if (dialog.open) return;
    const bus = getBus(), project = createStarter(command.kind);
    const ticket = {bus,revision:bus.revision,accepted:false};
    prepared = ticket;
    dialog.querySelector('h2').textContent = `Preview new ${STARTERS[command.kind].toLowerCase()}`;
    prompt.textContent = 'Checking the fictional starter…';
    apply.hidden = true;
    dialog.showModal();
    renderer ||= new PaperPreview(frame,()=> {},()=> {});
    const report = await renderer.render(project);
    if (ticket !== prepared || !dialog.open) return;
    const quality = inspectProject(project,report);
    if (!quality.ready) {
      prompt.textContent = quality.errors[0]?.message || 'The local preview did not pass. Cancel and try again.';
      return;
    }
    const url = new URL(host.location.href);
    url.hash = new URLSearchParams({'new-form':command.kind,document:project.manifest.documentId,build}).toString();
    apply.href = url.href;
    ticket.accepted = true;
    const {logicalPages,rows} = quality.metrics;
    prompt.textContent = `Preview passed · ${rows} printed rows · ${logicalPages} page(s).`;
    apply.hidden = false;
  }

  return {prepare,
    initial:opening && !opening.blocked ? ()=>({project:createStarter(opening.kind,opening.id),reference:null}) : null,
    recoveryKey:opening && !opening.blocked ? `printform-studio-v3:new-form-recovery:${opening.id}` : undefined,
    blocked:opening?.blocked === true,
    revealBlocked() {
      root.querySelectorAll('.app-header,.workspace-bar,.studio-grid,.status-bar').forEach(node=>node.hidden = true);
      notice.textContent = 'This preview link is invalid or the Studio build changed. Return to the original tab and prepare a new preview.';
      back.focus();
    }
  };
}
