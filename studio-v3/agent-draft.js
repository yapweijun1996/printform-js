import { parseProposal, fail } from './ai-edits.js';
import { assertScope } from './ai-chat-protocol.js';
import { explicitBindingPointers } from './ai-authoring.js';
import { missesTableBackgroundIntent } from './table-background-intent.js';

const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
// One entry per changed property: the value it had at the start and the value it has now. A change that a later
// step reverted disappears, so the human reviewing the result sees the net change only.
function mergeDiff(entries) {
  const merged = new Map();
  for (const entry of entries) {
    const key = `${entry.target}\u0000${entry.property}`, first = merged.get(key);
    merged.set(key,first ? {...first,after:entry.after} : {...entry});
  }
  return [...merged.values()].filter(entry=>!same(entry.before,entry.after));
}
// The agent's working copy. Every step is checked by the same parser and scope rules as a single proposal, against
// the previous step's result, and the live form is never touched: only a human Apply of the final proposal changes it.
export function createDraft(project,{scope = {mode:'whole'},request = '',references = []} = {}) {
  const steps = [], explicit = explicitBindingPointers(request,references);
  let current = project;
  return {
    get project() { return current; },
    get count() { return steps.length; },
    apply(summary,operations) {
      const step = parseProposal(JSON.stringify({summary,operations}),current,explicit);
      assertScope(step,scope);
      steps.push({before:current,...step}); current = step.candidate;
      return step;
    },
    undo() {
      const last = steps.pop();
      if (!last) return false;
      current = last.before;
      return true;
    },
    // The whole run as one proposal for the existing Preview / Apply / Undo flow.
    proposal(summary) {
      const diff = mergeDiff(steps.flatMap(step=>step.diff)), last = steps.at(-1);
      if (!last || !diff.length) throw fail('NO_CHANGES');
      // Judged once on the net result: a single step is not expected to satisfy the whole request.
      if (missesTableBackgroundIntent(request,last.design,diff,references)) throw fail('TABLE_BACKGROUND_INTENT');
      return {
        kind:'proposal',summary,diff,targets:[...new Set(steps.flatMap(step=>step.targets))],
        ownership:Object.assign({},...steps.map(step=>step.ownership)),operations:steps.flatMap(step=>step.operations),
        design:last.design,candidate:last.candidate
      };
    }
  };
}
