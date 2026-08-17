import { stableStringify } from "./json.js";

export const DURABLE_TRANSACTION_STORE_VERSION = 1;
const MAX_AUDIT_EVENTS = 2000;
const MAX_TRANSACTIONS = 300;
const MAX_REVISIONS = 50;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function isoNow(clock) {
  const value = typeof clock === "function" ? clock() : clock;
  return value instanceof Date ? value.toISOString() : new Date(value || Date.now()).toISOString();
}

function projectId(project) {
  return String(
    project?.manifest?.documentId
      || project?.manifest?.documentType
      || project?.manifest?.title
      || "untitled",
  );
}

function error(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function defaultState(formId, project, clock) {
  const revision = Number.isInteger(project?.revision)
    ? project.revision
    : (Number.isInteger(project?.attestation?.evidence?.revision) ? project.attestation.evidence.revision : 0);
  return {
    store_version: DURABLE_TRANSACTION_STORE_VERSION,
    version: 0,
    form_id: formId,
    head: {
      revision,
      project: clone(project),
      project_hash: null,
      transaction_id: null,
      committed_at: null,
    },
    revisions: [{ revision, project: clone(project), project_hash: null, transaction_id: null, reason: "initial", committed_at: null }],
    transactions: [],
    audit_events: [],
    evidence_packs: [],
    evidence_anchors: [],
    updated_at: isoNow(clock),
  };
}

function normalizeState(value, formId, project, clock) {
  if (!value || typeof value !== "object") return defaultState(formId, project, clock);
  const base = defaultState(formId, project, clock);
  return {
    ...base,
    ...clone(value),
    store_version: DURABLE_TRANSACTION_STORE_VERSION,
    form_id: value.form_id || formId,
    head: { ...base.head, ...(value.head || {}) },
    revisions: Array.isArray(value.revisions) && value.revisions.length ? value.revisions : base.revisions,
    transactions: Array.isArray(value.transactions) ? value.transactions : [],
    audit_events: Array.isArray(value.audit_events) ? value.audit_events : [],
    evidence_packs: Array.isArray(value.evidence_packs) ? value.evidence_packs : [],
    evidence_anchors: Array.isArray(value.evidence_anchors) ? value.evidence_anchors : [],
  };
}

function eventId() {
  return globalThis.crypto?.randomUUID?.()
    || `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A synchronous store boundary used by the browser CommandBus and by the
 * deterministic test server. A production server adapter can implement
 * read/write/compareAndSwap with one database transaction; the CommandBus
 * never receives arbitrary database handles.
 */
export class DurableTransactionStore {
  constructor({ storage = null, backend = null, key, formId, initialProject = null, clock = () => new Date() } = {}) {
    this.storage = storage;
    this.backend = backend;
    this.key = key || `printform:studio-v2:durable:${formId || projectId(initialProject)}`;
    this.formId = formId || projectId(initialProject);
    this.clock = clock;
    this.memoryState = null;
    if (!this._readRaw()) this._writeRaw(defaultState(this.formId, initialProject, this.clock));
  }

  get persistent() {
    return Boolean(this.backend?.read || this.storage?.getItem);
  }

  get atomic() {
    return Boolean(this.backend?.compareAndSwap);
  }

  _readRaw() {
    if (this.backend?.read) return this.backend.read(this.key);
    if (this.storage?.getItem) {
      try { return JSON.parse(this.storage.getItem(this.key) || "null"); } catch { return null; }
    }
    return clone(this.memoryState);
  }

  _writeRaw(state, expectedVersion = null) {
    if (this.backend?.compareAndSwap && expectedVersion !== null) {
      if (!this.backend.compareAndSwap(this.key, expectedVersion, clone(state))) {
        throw error("STORE_CONFLICT", "Durable transaction store compare-and-swap failed");
      }
      return;
    }
    if (this.backend?.write) return this.backend.write(this.key, clone(state));
    if (this.storage?.setItem) return this.storage.setItem(this.key, JSON.stringify(state));
    this.memoryState = clone(state);
  }

  readState() {
    return normalizeState(this._readRaw(), this.formId, null, this.clock);
  }

  snapshot() { return clone(this.readState()); }

  _mutate(mutator) {
    const current = this.readState();
    const next = clone(current);
    const result = mutator(next, current);
    if (result === null) return null;
    next.version = Number(current.version || 0) + 1;
    next.updated_at = isoNow(this.clock);
    next.transactions = next.transactions.slice(-MAX_TRANSACTIONS);
    next.audit_events = next.audit_events.slice(-MAX_AUDIT_EVENTS);
    this._writeRaw(next, current.version);
    return result;
  }

  get head() { return clone(this.readState().head); }
  getHeadRevision() { return this.readState().head.revision; }
  getHeadProject() { return clone(this.readState().head.project); }

  compareAndSwapHead({ expectedRevision, expectedProjectHash = null, nextProject, nextProjectHash, transactionId = null, reason = "transaction commit" } = {}) {
    const current = this.readState();
    const actualRevision = current.head.revision;
    const hashMismatch = expectedProjectHash && current.head.project_hash && expectedProjectHash !== current.head.project_hash;
    if (actualRevision !== expectedRevision || hashMismatch) {
      return { ok: false, expectedRevision, actualRevision, expectedProjectHash, actualProjectHash: current.head.project_hash };
    }
    const result = this._mutate((state) => {
      const head = state.head;
      if (head.revision !== expectedRevision || (expectedProjectHash && head.project_hash && expectedProjectHash !== head.project_hash)) return null;
      const revision = expectedRevision + 1;
      state.head = {
        revision,
        project: clone(nextProject),
        project_hash: nextProjectHash || null,
        transaction_id: transactionId,
        committed_at: isoNow(this.clock),
        reason,
      };
      state.revisions = [
        ...state.revisions.filter((entry) => entry.revision !== revision),
        { revision, project: clone(nextProject), project_hash: state.head.project_hash, transaction_id: transactionId, reason, committed_at: state.head.committed_at },
      ].sort((a, b) => a.revision - b.revision).slice(-MAX_REVISIONS);
      return { ok: true, revision, projectHash: state.head.project_hash };
    });
    return result || { ok: false, expectedRevision, actualRevision: this.getHeadRevision(), actualProjectHash: this.head.project_hash };
  }

  saveTransaction(transaction, expectedRecordVersion = transaction.record_version ?? null) {
    let saved;
    this._mutate((state) => {
      const index = state.transactions.findIndex((item) => item.transaction_id === transaction.transaction_id);
      const previous = index >= 0 ? state.transactions[index] : null;
      if (previous && expectedRecordVersion !== previous.record_version) {
        throw error("TRANSACTION_RECORD_CONFLICT", "Transaction was changed by another session", { transactionId: transaction.transaction_id });
      }
      if (!previous && expectedRecordVersion !== null) {
        throw error("TRANSACTION_RECORD_CONFLICT", "Transaction record does not exist", { transactionId: transaction.transaction_id });
      }
      saved = { ...clone(transaction), record_version: (previous?.record_version || 0) + 1, updated_at: isoNow(this.clock) };
      if (index >= 0) state.transactions[index] = saved;
      else state.transactions.push(saved);
      return saved;
    });
    return clone(saved);
  }

  getTransaction(transactionId) {
    return clone(this.readState().transactions.find((item) => item.transaction_id === transactionId) || null);
  }

  listTransactions() { return clone(this.readState().transactions); }

  listActiveTransactions() {
    return this.listTransactions().filter((item) => !["committed", "rolled_back", "expired", "conflicted"].includes(item.status));
  }

  appendAudit(event) {
    let saved;
    this._mutate((state) => {
      saved = { event_id: event.event_id || eventId(), timestamp: isoNow(this.clock), ...clone(event) };
      state.audit_events.push(saved);
      return saved;
    });
    return clone(saved);
  }

  listAuditEvents() { return clone(this.readState().audit_events); }

  listRevisions() { return clone(this.readState().revisions); }

  getRevision(revision = null) {
    if (Number.isInteger(revision)) return clone(this.readState().revisions.find((entry) => entry.revision === revision) || null);
    const head = this.head;
    return { revision: head.revision, projectHash: head.project_hash, transactionId: head.transaction_id, committedAt: head.committed_at };
  }

  anchorEvidence({ transactionId, pack, artifactHash = null, actor = null } = {}) {
    if (!pack?.hash || !Number.isInteger(pack.revision)) throw error("EVIDENCE_ANCHOR_INVALID", "Evidence pack hash and revision are required");
    const existing = this.getEvidenceAnchor(pack.revision);
    if (existing) {
      if (existing.evidence_pack_hash === pack.hash && (!transactionId || existing.transaction_id === transactionId)) return existing;
      throw error("EVIDENCE_ANCHOR_CONFLICT", "A different Evidence Pack is already anchored for this revision", {
        revision: pack.revision,
        existingEvidencePackHash: existing.evidence_pack_hash,
      });
    }
    let anchor;
    this._mutate((state) => {
      const transaction = state.transactions.find((item) => item.transaction_id === transactionId)
        || state.transactions.find((item) => item.working_revision === pack.revision && item.status === "committed");
      if (!transaction) throw error("TRANSACTION_NOT_FOUND", "No committed transaction can own this evidence pack");
      if (state.head.revision !== pack.revision) throw error("EVIDENCE_REVISION_MISMATCH", "Evidence revision is not the durable head revision");
      anchor = {
        artifact_hash: artifactHash || pack.exportHtmlHash || null,
        evidence_pack_hash: pack.hash,
        committed_revision: pack.revision,
        transaction_id: transaction.transaction_id,
        form_spec_hash: pack.formSpecHash || null,
        preview_hash: pack.previewHash || null,
        runtime_hash: pack.runtimeHash || null,
        validation: clone(pack.validation),
        security: clone(pack.security),
        anchored_at: isoNow(this.clock),
      };
      const txIndex = state.transactions.findIndex((item) => item.transaction_id === transaction.transaction_id);
      state.transactions[txIndex] = {
        ...transaction,
        evidence_pack_ref: clone(anchor),
        record_version: (transaction.record_version || 0) + 1,
        updated_at: isoNow(this.clock),
      };
      state.evidence_packs = [...state.evidence_packs.filter((item) => item.revision !== pack.revision), { ...clone(pack), transactionId: transaction.transaction_id }];
      state.evidence_anchors = [...state.evidence_anchors.filter((item) => item.committed_revision !== pack.revision), anchor];
      state.audit_events.push({ event_id: eventId(), type: "evidence_anchored", timestamp: isoNow(this.clock), actor, form_id: this.formId, transaction_id: transaction.transaction_id, revision: pack.revision, evidence_pack_hash: pack.hash, artifact_hash: anchor.artifact_hash, form_spec_hash: anchor.form_spec_hash, preview_hash: anchor.preview_hash });
      return anchor;
    });
    return clone(anchor);
  }

  getEvidencePack(revision = this.getHeadRevision()) {
    const pack = this.readState().evidence_packs.find((item) => item.revision === revision);
    return clone(pack || null);
  }

  getEvidenceAnchor(revision = this.getHeadRevision()) {
    const anchor = this.readState().evidence_anchors.find((item) => item.committed_revision === revision);
    return clone(anchor || null);
  }

  static formId(project) { return projectId(project); }
  static keyFor(journalKeyValue) { return `${journalKeyValue}:durable-v1`; }
  static fingerprint(value) { return stableStringify(value); }
}

export function createMemoryDurableBackend() {
  const values = new Map();
  return {
    read(key) { return clone(values.get(key) || null); },
    write(key, value) { values.set(key, clone(value)); },
    compareAndSwap(key, expectedVersion, value) {
      const current = values.get(key);
      if (Number(current?.version || 0) !== Number(expectedVersion || 0)) return false;
      values.set(key, clone(value));
      return true;
    },
  };
}
