export class RevisionHistory {
  constructor(initialProject, limit = 50, initialRevision = 0) {
    this.limit = limit;
    const revision = Number.isInteger(initialRevision) && initialRevision >= 0 ? initialRevision : 0;
    this.entries = [{ revision, project: initialProject, reason: "initial", timestamp: Date.now() }];
    this.cursor = 0;
    this.nextRevision = revision + 1;
  }

  get revision() { return this.entries[this.cursor].revision; }
  get project() { return this.entries[this.cursor].project; }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length - 1; }

  hydrate(entries) {
    const valid = Array.isArray(entries) ? entries.filter((entry) => Number.isInteger(entry?.revision) && entry.project) : [];
    if (!valid.length) return;
    this.entries = valid.slice(-this.limit).map((entry) => ({
      revision: entry.revision,
      project: structuredClone(entry.project),
      reason: entry.reason || "recovered",
      timestamp: entry.timestamp || Date.now(),
    }));
    this.cursor = this.entries.length - 1;
    this.nextRevision = Math.max(...this.entries.map((entry) => entry.revision)) + 1;
  }

  commit(project, reason) {
    // Monotonic, never derived from the cursor: undo-then-commit must NOT
    // reuse an already-seen revision number, or expectedRevision optimistic
    // locking (and preview-report correlation) silently accepts stale writes.
    const revision = this.nextRevision;
    this.nextRevision += 1;
    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push({ revision, project, reason, timestamp: Date.now() });
    if (this.entries.length > this.limit) this.entries.shift();
    this.cursor = this.entries.length - 1;
    return revision;
  }

  undo(expectedRevision) {
    if (expectedRevision !== this.revision) throw revisionConflict(expectedRevision, this.revision);
    if (this.cursor === 0) return { changed: false, revision: this.revision, project: this.project };
    this.cursor -= 1;
    return { changed: true, revision: this.revision, project: this.project };
  }

  redo(expectedRevision) {
    if (expectedRevision !== this.revision) throw revisionConflict(expectedRevision, this.revision);
    if (this.cursor >= this.entries.length - 1) return { changed: false, revision: this.revision, project: this.project };
    this.cursor += 1;
    return { changed: true, revision: this.revision, project: this.project };
  }
}

export function revisionConflict(expected, actual) {
  const error = new Error(`Revision conflict: expected ${expected}, current ${actual}`);
  error.code = "REVISION_CONFLICT";
  error.expectedRevision = expected;
  error.actualRevision = actual;
  return error;
}
