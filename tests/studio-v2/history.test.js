import { describe, it, expect } from "vitest";
import { RevisionHistory, revisionConflict } from "../../studio-v2/core/history.js";

describe("RevisionHistory monotonic revisions", () => {
  it("never reuses a revision number after undo + commit", () => {
    const history = new RevisionHistory({ a: 1 });
    expect(history.commit({ a: 2 }, "one")).toBe(1);
    expect(history.commit({ a: 3 }, "two")).toBe(2);
    history.undo(2);
    expect(history.revision).toBe(1);
    // Regression: deriving the next revision from `this.revision` (the
    // cursor) instead of a monotonic counter would produce 2 again here —
    // aliasing with the revision the human just undid past, which breaks
    // expectedRevision optimistic locking for anyone still holding it.
    const afterUndoCommit = history.commit({ a: 4 }, "three");
    expect(afterUndoCommit).toBe(3);
    expect(afterUndoCommit).toBeGreaterThan(2);
  });

  it("keeps every revision number unique across repeated undo/commit cycles", () => {
    const history = new RevisionHistory({ n: 0 });
    const seen = new Set([0]);
    for (let i = 0; i < 5; i += 1) {
      const revision = history.commit({ n: i + 1 }, `step-${i}`);
      expect(seen.has(revision)).toBe(false);
      seen.add(revision);
      if (i % 2 === 1) history.undo(revision);
    }
  });

  it("rejects undo against a stale expectedRevision", () => {
    const history = new RevisionHistory({ a: 1 });
    history.commit({ a: 2 }, "one");
    expect(() => history.undo(0)).toThrowError(revisionConflict(0, 1).message);
  });

  it("undo is a no-op at the root revision", () => {
    const history = new RevisionHistory({ a: 1 });
    const result = history.undo(0);
    expect(result).toEqual({ changed: false, revision: 0, project: { a: 1 } });
  });
});
