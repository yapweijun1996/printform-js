const historyAvailable = (bus,direction) => direction === 'undo' ? bus.history.canUndo : bus.history.canRedo;

export async function navigateWorkspaceHistory(direction,{bus,database,state,changed}) {
  if (!historyAvailable(bus,direction) || !database.guardDraft()) return;
  const outcome = await bus.navigateHistory(direction,bus.revision);
  if (!outcome.changed) return;
  state.dataDraft = null;
  await changed();
}

export function setupWorkspaceShortcuts({getBus,action,drafts,queueEdit,status,blockedAction}) {
  document.addEventListener('keydown',event=> {
    const bus = getBus();
    if (!bus || !(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
    const key = event.key.toLowerCase();
    if (key === 'p' && blockedAction('print')) { event.preventDefault(); return; }
    const name = key === 's' ? 'save' : key === 'z' && !event.target.closest('input,textarea') ? event.shiftKey ? 'redo' : 'undo' : null;
    if (!name) return;
    event.preventDefault();
    if (blockedAction(name) || (name !== 'save' && !historyAvailable(bus,name))) return;
    drafts.guard(()=>queueEdit(()=>action(name))).catch(error=>status(error.message));
  });
}
