const LABELS = {get_capabilities:'Read available capabilities',read_skill:'Read a product guide',get_context:'Read the form',apply_operations:'Changed the draft',inspect_draft:'Checked the print preview',undo_step:'Undid a step',take_notes:'Made a note',finish:'Handed over the result',report_blocked:'Reported a block'};
// One line of the run's timeline. A rejected step is shown as such; its code stays in the tooltip, not the line.
export function stepLabel({name,ok,detail}) {
  const label = LABELS[name] || 'Worked on the draft';
  return ok ? `${label}${detail ? ` · ${detail}` : ''}` : `${label} · rejected, trying again`;
}
