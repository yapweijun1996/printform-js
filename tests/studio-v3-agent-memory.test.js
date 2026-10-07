import {describe,it,expect} from 'vitest';
import {createAgentMemory} from '../studio-v3/agent-memory.js';

describe('the agent memory',()=> {
  it('starts empty and says nothing about itself',()=> {
    const memory = createAgentMemory();
    expect(memory.notes).toBe(''); expect(memory.steps).toEqual([]); expect(memory.describe()).toBe('');
  });
  it('keeps the latest notes and the steps applied, and drops a step that was undone',()=> {
    const memory = createAgentMemory();
    memory.note('Invoice with two columns; totals bottom right.');
    memory.addStep('Add a footer note',2); memory.addStep('Recolour',1);
    expect(memory.describe()).toContain('Invoice with two columns'); expect(memory.describe()).toContain('1. Add a footer note (2 changes)'); expect(memory.describe()).toContain('2. Recolour (1 change)');
    memory.dropStep(); expect(memory.steps).toHaveLength(1); expect(memory.describe()).not.toContain('Recolour');
    memory.note('Replaced.'); expect(memory.notes).toBe('Replaced.');
  });
  it('limits a note, so the memory itself cannot grow without bound',()=> {
    const memory = createAgentMemory();
    memory.note('x'.repeat(5000)); expect(memory.notes.length).toBeLessThanOrEqual(2000);
  });
});
