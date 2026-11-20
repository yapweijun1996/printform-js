import { SCENARIO_IDS } from './scenario-matrix.js';

const restrictedActions = new Set(['new','open','save','share','save-share','export-share','print','export','go-data']);
const restrictedControls = 'input[type=file],[data-mode=data],[data-db-action],[data-db-select],[data-db-group],[data-sample],[data-template],[data-demo-template],[data-ai=attach],.ai-sharing,.ai-source-setup';

export function setupNewFormDraft({root,host,current,adopt,verify}) {
  const button = root.querySelector('[data-new-form-adopt]'), notice = root.querySelector('[data-new-form-return-status]');
  let adopting = false;
  const active = ()=>current()?.draft === true;
  const blockedAction = name=>active() && restrictedActions.has(name);
  function sync() {
    const privateDraft = active();
    root.body.toggleAttribute('data-private-new-form',privateDraft);
    button.hidden = !privateDraft;
    if (privateDraft) notice.textContent = 'Private draft · Use fictional text only. Send shares your request with Demo AI. Apply edits, pass the synthetic scenarios, then adopt.';
  }

  const stopRestricted = event => {
    if (!active()) return;
    const target = event.target.closest?.('[data-action]');
    if (event.type === 'drop' || event.target.closest?.(restrictedControls) || blockedAction(target?.dataset.action)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  for (const type of ['click','change','drop']) root.addEventListener(type,stopRestricted,true);
  button.addEventListener('click',async()=> {
    if (!active() || adopting) return;
    adopting = true; button.disabled = true;
    try {
      const opening = current();
      await adopt({verify,scenarioIds:SCENARIO_IDS,accept:()=> {
        const updated = {...opening,draft:false};
        host.history.replaceState({...host.history.state,studioNewForm:updated},'');
        notice.textContent = 'Adopted. This independent form is ready for ordinary editing and saving.';
        return updated;
      }});
    } catch (error) { notice.textContent = error.message; }
    finally { adopting = false; button.disabled = false; (active() ? button : root.querySelector('#document-name')).focus(); }
  });
  return {active,sync,blockedAction,verify};
}

export async function adoptPrivateDraft({verify,scenarioIds,accept},{getBus,state,drafts,ai,initialize,settle,ready,sync}) {
  await settle();
  const check = () => {
    if (ai.busy || ai.applying || ai.viewing || ai.proposal || drafts.drafts.size || drafts.applying.size || state.running) {
      throw new Error('Resolve pending draft edits or previews before adopting.');
    }
    const bus = getBus();
    verify(bus.project);
    if (!scenarioIds.every(id=>state.matrix[id]?.ready) || !ready()) throw new Error('Run all synthetic samples successfully for the current draft before adopting.');
    return {bus,revision:bus.revision};
  };
  const reviewed = check();
  document.body.inert = true;
  try {
    await initialize();
    const live = check();
    if (live.bus !== reviewed.bus || live.revision !== reviewed.revision) throw new Error('The draft changed. Check the current version before adopting.');
    accept(); sync();
  } finally { document.body.inert = false; }
}
