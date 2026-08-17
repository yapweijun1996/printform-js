import { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 1;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function parse(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function transactionError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

/**
 * SQLite-backed implementation of DurableTransactionStore's synchronous
 * backend contract. The form envelope remains the canonical state; the
 * projection tables make transactions, revisions, audit and evidence queryable
 * and durable without changing the browser store contract.
 */
export class SqliteDurableBackend {
  constructor({ filename, busyTimeoutMs = 5000 } = {}) {
    if (!filename) throw new TypeError("SqliteDurableBackend requires filename");
    this.filename = filename;
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = FULL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(`PRAGMA busy_timeout = ${Math.max(100, Number(busyTimeoutMs) || 5000)};`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS durable_form_state (
        form_key TEXT PRIMARY KEY,
        form_id TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS durable_transactions (
        form_key TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        record_version INTEGER NOT NULL,
        status TEXT NOT NULL,
        base_revision INTEGER,
        working_revision INTEGER,
        owner TEXT,
        agent_id TEXT,
        lease_expires_at TEXT,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (form_key, transaction_id)
      );
      CREATE TABLE IF NOT EXISTS durable_revisions (
        form_key TEXT NOT NULL,
        revision INTEGER NOT NULL,
        project_hash TEXT,
        transaction_id TEXT,
        project_json TEXT NOT NULL,
        reason TEXT,
        committed_at TEXT,
        PRIMARY KEY (form_key, revision)
      );
      CREATE TABLE IF NOT EXISTS durable_audit_events (
        form_key TEXT NOT NULL,
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        type TEXT NOT NULL,
        transaction_id TEXT,
        revision INTEGER,
        actor TEXT,
        timestamp TEXT NOT NULL,
        event_json TEXT NOT NULL,
        UNIQUE (form_key, event_id)
      );
      CREATE TABLE IF NOT EXISTS durable_evidence_anchors (
        form_key TEXT NOT NULL,
        committed_revision INTEGER NOT NULL,
        transaction_id TEXT NOT NULL,
        evidence_pack_hash TEXT NOT NULL,
        artifact_hash TEXT,
        anchored_at TEXT NOT NULL,
        anchor_json TEXT NOT NULL,
        PRIMARY KEY (form_key, committed_revision)
      );
      CREATE INDEX IF NOT EXISTS durable_audit_lookup
        ON durable_audit_events(form_key, sequence);
      CREATE INDEX IF NOT EXISTS durable_transaction_status
        ON durable_transactions(form_key, status);
    `);
  }

  get persistent() { return true; }
  get atomic() { return true; }

  read(key) {
    const row = this.db.prepare(
      "SELECT state_json FROM durable_form_state WHERE form_key = ?",
    ).get(key);
    return row ? parse(row.state_json) : null;
  }

  write(key, value) {
    this.#transaction(() => {
      this.#writeEnvelope(key, value, false, null);
      this.#syncProjections(key, value);
    });
  }

  compareAndSwap(key, expectedVersion, value) {
    let changed = false;
    this.#transaction(() => {
      const row = this.db.prepare(
        "SELECT version FROM durable_form_state WHERE form_key = ?",
      ).get(key);
      const actualVersion = Number(row?.version ?? 0);
      if (actualVersion !== Number(expectedVersion ?? 0)) return;
      this.#writeEnvelope(key, value, true, actualVersion);
      this.#syncProjections(key, value);
      changed = true;
    });
    return changed;
  }

  serverNow() {
    const row = this.db.prepare(
      "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS server_time",
    ).get();
    return new Date(row.server_time);
  }

  summary() {
    const count = (table) => Number(this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
    const journal = this.db.prepare("PRAGMA journal_mode").get();
    return {
      filename: this.filename,
      sqlite_version: this.db.prepare("SELECT sqlite_version() AS version").get().version,
      journal_mode: journal.journal_mode,
      schema_version: SCHEMA_VERSION,
      transactions: count("durable_transactions"),
      revisions: count("durable_revisions"),
      audit_events: count("durable_audit_events"),
      evidence_anchors: count("durable_evidence_anchors"),
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  #transaction(work) {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      work();
      this.db.exec("COMMIT;");
    } catch (error) {
      try { this.db.exec("ROLLBACK;"); } catch { /* preserve original error */ }
      throw error;
    }
  }

  #writeEnvelope(key, value, compare, expectedVersion) {
    const payload = json(value);
    const updatedAt = value.updated_at || this.serverNow().toISOString();
    if (compare) {
      const result = this.db.prepare(`
        UPDATE durable_form_state
        SET schema_version = ?, version = ?, state_json = ?, updated_at = ?
        WHERE form_key = ? AND version = ?
      `).run(SCHEMA_VERSION, value.version, payload, updatedAt, key, expectedVersion);
      if (Number(result.changes) !== 1) throw transactionError("STORE_CONFLICT", "SQLite compare-and-swap failed");
      return;
    }
    this.db.prepare(`
      INSERT INTO durable_form_state(form_key, form_id, schema_version, version, state_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(form_key) DO UPDATE SET
        form_id = excluded.form_id,
        schema_version = excluded.schema_version,
        version = excluded.version,
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run(key, value.form_id || key, SCHEMA_VERSION, value.version || 0, payload, updatedAt);
  }

  #syncProjections(key, state) {
    const upsertTransaction = this.db.prepare(`
      INSERT INTO durable_transactions(
        form_key, transaction_id, record_version, status, base_revision,
        working_revision, owner, agent_id, lease_expires_at, state_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(form_key, transaction_id) DO UPDATE SET
        record_version = excluded.record_version,
        status = excluded.status,
        base_revision = excluded.base_revision,
        working_revision = excluded.working_revision,
        owner = excluded.owner,
        agent_id = excluded.agent_id,
        lease_expires_at = excluded.lease_expires_at,
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `);
    for (const item of state.transactions || []) {
      upsertTransaction.run(
        key, item.transaction_id, item.record_version || 0, item.status || "draft",
        item.base_revision ?? null, item.working_revision ?? null, item.owner || null,
        item.agent_id || null, item.lease?.lease_expires_at || null, json(item),
        item.updated_at || state.updated_at,
      );
    }

    const upsertRevision = this.db.prepare(`
      INSERT INTO durable_revisions(
        form_key, revision, project_hash, transaction_id, project_json, reason, committed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(form_key, revision) DO UPDATE SET
        project_hash = excluded.project_hash,
        transaction_id = excluded.transaction_id,
        project_json = excluded.project_json,
        reason = excluded.reason,
        committed_at = excluded.committed_at
    `);
    for (const item of state.revisions || []) {
      upsertRevision.run(
        key, item.revision, item.project_hash || null, item.transaction_id || null,
        json(item.project), item.reason || null, item.committed_at || null,
      );
    }

    const insertAudit = this.db.prepare(`
      INSERT INTO durable_audit_events(
        form_key, event_id, type, transaction_id, revision, actor, timestamp, event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(form_key, event_id) DO NOTHING
    `);
    for (const event of state.audit_events || []) {
      if (!event.event_id) continue;
      insertAudit.run(
        key, event.event_id, event.type || "unknown", event.transaction_id || null,
        event.revision ?? null, event.actor || null, event.timestamp || state.updated_at,
        json(event),
      );
    }

    const upsertAnchor = this.db.prepare(`
      INSERT INTO durable_evidence_anchors(
        form_key, committed_revision, transaction_id, evidence_pack_hash,
        artifact_hash, anchored_at, anchor_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(form_key, committed_revision) DO UPDATE SET
        transaction_id = excluded.transaction_id,
        evidence_pack_hash = excluded.evidence_pack_hash,
        artifact_hash = excluded.artifact_hash,
        anchored_at = excluded.anchored_at,
        anchor_json = excluded.anchor_json
    `);
    for (const anchor of state.evidence_anchors || []) {
      upsertAnchor.run(
        key, anchor.committed_revision, anchor.transaction_id, anchor.evidence_pack_hash,
        anchor.artifact_hash || null, anchor.anchored_at || state.updated_at, json(anchor),
      );
    }
  }
}

export function databaseErrorIsBusy(error) {
  return /busy|locked/i.test(String(error?.message || ""));
}
