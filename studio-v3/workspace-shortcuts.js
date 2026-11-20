export function setupWorkspaceShortcuts({getBus,action,drafts,queueEdit,status,blockedAction}) {
  document.addEventListener('keydown',event=> {
    if (!getBus() || !(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
    const key = event.key.toLowerCase();
    if (key === 'p' && blockedAction('print')) { event.preventDefault(); return; }
    const name = key === 's' ? 'save' : key === 'z' && !event.target.closest('input,textarea') ? event.shiftKey ? 'redo' : 'undo' : null;
    if (!name) return;
    event.preventDefault();
    if (blockedAction(name)) return;
    drafts.guard(()=>queueEdit(()=>action(name))).catch(error=>status(error.message));
  });
}
