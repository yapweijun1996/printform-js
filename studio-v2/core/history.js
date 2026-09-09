export class RevisionHistory {
  constructor(initialProject, limit = 50, initialRevision = 0) {
    this.limit = limit;
    const revision = Number.isInteger(initialRevision) && initialRevision >= 0 ? initialRevision : 0;
    this.entries = [{ revision, project: structuredClone(initialProject), reason: "initial", timestamp: Date.now() }];
    this.cursor = 0;
    this.currentRevision = revision;
    this.currentProject = structuredClone(initialProject);
    this.nextRevision = revision + 1;
  }

  get revision() { return this.currentRevision; }
  get project() { return this.currentProject; }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length - 1; }

  hydrate(entries) {
    const valid = Array.isArray(entries)
      ? entries.filter((entry) => Number.isInteger(entry?.revision) && entry.project).sort((a, b) => a.revision - b.revision)
      : [];
    if (!valid.length) return;
    this.entries = [];
    this.cursor = 0;
    this.currentRevision = valid[0].revision;
    this.currentProject = structuredClone(valid[0].project);
    for (const [index, entry] of valid.entries()) {
      const action = entry.history_action || (entry.reason === "history:undo" || entry.reason === "undo" ? "undo" : null)
        || (entry.reason === "history:redo" || entry.reason === "redo" ? "redo" : null);
      if (index === 0 || !action) {
        this.entries = this.entries.slice(0, this.cursor + 1);
        this.entries.push({
          revision: entry.revision,
          project: structuredClone(entry.project),
          reason: entry.reason || "recovered",
          timestamp: entry.timestamp || Date.now(),
        });
        if (this.entries.length > this.limit) {
          this.entries.shift();
          this.cursor = Math.max(0, this.cursor - 1);
        }
        this.cursor = this.entries.length - 1;
      } else if (action === "undo") {
        this.cursor = Math.max(0, this.cursor - 1);
      } else if (action === "redo") {
        this.cursor = Math.min(this.entries.length - 1, this.cursor + 1);
      }
      this.currentRevision = entry.revision;
      this.currentProject = structuredClone(this.entries[this.cursor]?.project || entry.project);
      this.currentProject.revision = entry.revision;
    }
    this.nextRevision = Math.max(...valid.map((entry) => entry.revision)) + 1;
  }

  commit(project, reason) {
    // Monotonic, never derived from the cursor: undo-then-commit must NOT
    // reuse an already-seen revision number, or expectedRevision optimistic
    // locking (and preview-report correlation) silently accepts stale writes.
    const revision = this.nextRevision;
    this.nextRevision += 1;
    this.entries = this.entries.slice(0, this.cursor + 1);
    const committedProject = structuredClone(project);
    committedProject.revision = revision;
    this.entries.push({ revision, project: committedProject, reason, timestamp: Date.now() });
    if (this.entries.length > this.limit) this.entries.shift();
    this.cursor = this.entries.length - 1;
    this.currentRevision = revision;
    this.currentProject = structuredClone(committedProject);
    return revision;
  }

  peekNavigation(direction, expectedRevision) {
    if (expectedRevision !== this.revision) throw revisionConflict(expectedRevision, this.revision);
    const step = direction === "undo" ? -1 : 1;
    const targetCursor = this.cursor + step;
    if (targetCursor < 0 || targetCursor >= this.entries.length) {
      return { changed: false, revision: this.revision, project: structuredClone(this.currentProject), targetCursor: this.cursor };
    }
    return {
      changed: true,
      revision: this.revision,
      project: structuredClone(this.entries[targetCursor].project),
      targetCursor,
      targetRevision: this.entries[targetCursor].revision,
    };
  }

  applyNavigation(targetCursor, revision) {
    const target = this.entries[targetCursor];
    if (!target) throw new Error("History navigation target is unavailable");
    this.cursor = targetCursor;
    this.currentRevision = revision;
    this.nextRevision = Math.max(this.nextRevision, revision + 1);
    this.currentProject = structuredClone(target.project);
    this.currentProject.revision = revision;
    return { changed: true, revision, project: structuredClone(this.currentProject) };
  }

  undo(expectedRevision, revision = null) {
    const navigation = this.peekNavigation("undo", expectedRevision);
    return navigation.changed
      ? this.applyNavigation(navigation.targetCursor, revision ?? navigation.targetRevision)
      : { changed: false, revision: navigation.revision, project: navigation.project };
  }

  redo(expectedRevision, revision = null) {
    const navigation = this.peekNavigation("redo", expectedRevision);
    return navigation.changed
      ? this.applyNavigation(navigation.targetCursor, revision ?? navigation.targetRevision)
      : { changed: false, revision: navigation.revision, project: navigation.project };
  }
}

export function revisionConflict(expected, actual) {
  const error = new Error(`Revision conflict: expected ${expected}, current ${actual}`);
  error.code = "REVISION_CONFLICT";
  error.expectedRevision = expected;
  error.actualRevision = actual;
  return error;
}
