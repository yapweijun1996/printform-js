export function bindAgentHistoryControls({ get, onAction }) {
  const undo = get("#ai-undo-revision");
  const redo = get("#ai-redo-revision");
  const refresh = ({ canUndo = false, canRedo = false } = {}) => {
    if (undo) undo.disabled = !canUndo;
    if (redo) redo.disabled = !canRedo;
  };
  undo?.addEventListener("click", () => onAction("undo_revision"));
  redo?.addEventListener("click", () => onAction("redo_revision"));
  refresh();
  return { refresh };
}
