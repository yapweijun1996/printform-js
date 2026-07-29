export class RevisionHistory {
  constructor(initialProject, limit = 50) {
    this.limit = limit;
    this.entries = [{ revision: 0, project: initialProject, reason: "initial", timestamp: Date.now() }];
    this.cursor = 0;
  }

  get revision() { return this.entries[this.cursor].revision; }
  get project() { return this.entries[this.cursor].project; }

  commit(project, reason) {
    const revision = this.revision + 1;
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
}

export function revisionConflict(expected, actual) {
  const error = new Error(`Revision conflict: expected ${expected}, current ${actual}`);
  error.code = "REVISION_CONFLICT";
  error.expectedRevision = expected;
  error.actualRevision = actual;
  return error;
}
