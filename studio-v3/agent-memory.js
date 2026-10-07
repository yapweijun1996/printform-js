import { DEMO_CONFIG } from './ai-gateway-config.js';

// What the run keeps on purpose. The conversation is resent every turn and old turns are folded or dropped, so the
// model's own notes and the steps it has applied live here and are shown to it afresh on every turn.
export function createAgentMemory({maxNoteChars = DEMO_CONFIG.agent.maxNoteChars} = {}) {
  const memory = {
    notes: '',
    steps: [],
    note(text) { memory.notes = String(text).slice(0,maxNoteChars); },
    addStep(summary,changes) { memory.steps.push({summary,changes}); },
    dropStep() { memory.steps.pop(); },
    describe() {
      const lines = [];
      if (memory.notes) lines.push(`Your notes:\n${memory.notes}`);
      if (memory.steps.length) lines.push(`Steps applied to the draft so far:\n${memory.steps.map((step,index)=>`${index + 1}. ${step.summary} (${step.changes} change${step.changes === 1 ? '' : 's'})`).join('\n')}`);
      return lines.join('\n\n');
    }
  };
  return memory;
}
