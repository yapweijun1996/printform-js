import { BACKGROUND_CONTEXT, MemorySessionRepo, StorageBackedSession } from "@earendil-works/pi-agent-core";
import { assertPolicyCurrent, classifyImportedDocument, isPolicyCurrent, policyError } from "../core/data-policy.js";
import { IndexedDbSessionStorage, PI_SESSION_SCHEMA_VERSION, openPiSessionDatabase, piSessionDatabaseName, runPiTransaction } from "./indexed-db-storage.js";

function sessionId() {
  return globalThis.crypto?.randomUUID?.() || `pi-session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function errorWithCode(code, message) { return Object.assign(new Error(message), { code }); }

function bindSession(raw, assertCurrent, onClose) {
  let closed = false;
  return new Proxy(raw, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (property === "metadata" || property === "idGenerator" || typeof value !== "function") return value;
      if (property === "close") return async (...args) => {
        if (closed) return;
        closed = true;
        try { return await value.apply(target, args); }
        finally { onClose(); }
      };
      return async (...args) => {
        assertCurrent();
        if (closed) throw errorWithCode("PI_SESSION_CLOSED", "PI session is closed.");
        const result = await value.apply(target, args);
        assertCurrent();
        return result;
      };
    }
  });
}

export class PolicySessionRepo {
  constructor({ dataPolicy = null, getDataPolicy = null, databaseName = null, openTimeoutMs = 5000 } = {}) {
    this.dataPolicy = dataPolicy || classifyImportedDocument();
    this.getDataPolicy = getDataPolicy || (() => this.dataPolicy);
    this.databaseName = databaseName || piSessionDatabaseName(this.dataPolicy.contextId);
    this.openTimeoutMs = openTimeoutMs;
    this.writerId = sessionId();
    this.memoryRepo = new MemorySessionRepo();
    this.db = null;
    this.dbOpening = null;
    this.sessions = new Map();
    this.retiredSessions = new Set();
    this.retiredDatabases = new Set();
    this.retiredSessionDatabases = new Map();
    this.pendingSessionDatabases = new Map();
    this.pendingSessionOpenings = new Set();
    this.closed = false;
  }

  policy() { return this.getDataPolicy() || this.dataPolicy; }

  assertCurrent(policy = this.dataPolicy) {
    if (this.closed) throw errorWithCode("PI_SESSION_REPO_CLOSED", "PI session repository is closed.");
    assertPolicyCurrent(policy, this.policy());
  }

  async database(policy = this.dataPolicy) {
    this.assertCurrent(policy);
    if (!policy.allowPersistentSessions) throw policyError("DATA_POLICY_STORAGE_BLOCKED");
    if (this.db) return this.db;
    if (!this.dbOpening) {
      const opening = openPiSessionDatabase(this.databaseName, () => this.assertCurrent(policy), this.openTimeoutMs);
      this.dbOpening = opening;
      void opening.then((db) => { if (this.dbOpening === opening) this.db = db; }, () => {}).finally(() => {
        if (this.dbOpening === opening) this.dbOpening = null;
      });
    }
    const db = await this.dbOpening;
    this.assertCurrent(policy);
    this.db = db;
    return db;
  }

  async create(options = {}, context) {
    const policy = this.dataPolicy;
    this.assertCurrent(policy);
    if (!policy.allowPersistentSessions) return this.track(await this.memoryRepo.create(options, context), policy, "memory");
    const db = await this.database(policy);
    const metadata = { id: options.id || sessionId(), createdAt: Date.now(), storageVersion: PI_SESSION_SCHEMA_VERSION,
      ...(options.parentSessionId === undefined ? {} : { parentSessionId: options.parentSessionId }) };
    await runPiTransaction(db, ["sessions", "state"], "readwrite", () => this.assertCurrent(policy), (transaction, request) => {
      request(transaction.objectStore("sessions").get(metadata.id), (existing) => {
        if (existing) throw errorWithCode("PI_SESSION_ID_EXISTS", "PI session id already exists.");
        transaction.objectStore("sessions").put(metadata);
        transaction.objectStore("state").put({ id: metadata.id, version: 0 });
      });
    });
    return this.openPersistent(metadata, policy);
  }

  async open(metadata, context) {
    const policy = this.dataPolicy;
    this.assertCurrent(policy);
    if (!policy.allowPersistentSessions) return this.track(await this.memoryRepo.open(metadata, context), policy, "memory");
    const db = await this.database(policy);
    const stored = await runPiTransaction(db, ["sessions"], "readonly", () => this.assertCurrent(policy), (transaction, request, setResult) => {
      request(transaction.objectStore("sessions").get(metadata?.id), setResult);
    });
    if (!stored) throw errorWithCode("PI_SESSION_NOT_FOUND", "PI session metadata was not found.");
    return this.openPersistent(stored, policy);
  }

  async openPersistent(metadata, policy) {
    if (this.sessions.has(metadata.id)) throw errorWithCode("PI_SESSION_ALREADY_OPEN", "PI session is already open in this repository.");
    const db = await this.database(policy);
    const opening = {};
    let finishOpening;
    const openingDone = new Promise((resolve) => { finishOpening = resolve; });
    this.pendingSessionDatabases.set(opening, db);
    this.pendingSessionOpenings.add(openingDone);
    let storage;
    try {
      this.assertCurrent(policy);
      storage = await IndexedDbSessionStorage.open({
        db, sessionId: metadata.id, writerId: this.writerId,
        assertCurrent: () => this.assertCurrent(policy)
      });
      this.assertCurrent(policy);
      const raw = new StorageBackedSession(metadata, storage);
      const session = bindSession(raw, () => this.assertCurrent(policy), () => this.releaseSession(raw));
      this.sessions.set(metadata.id, { raw, session, storage, policy });
      return session;
    } catch (error) {
      await storage?.close().catch(() => {});
      throw error;
    } finally {
      this.pendingSessionDatabases.delete(opening);
      this.pendingSessionOpenings.delete(openingDone);
      finishOpening();
      this.releaseRetiredDatabase(db);
    }
  }

  async list(_options, context) {
    const policy = this.dataPolicy;
    this.assertCurrent(policy);
    if (!policy.allowPersistentSessions) return this.memoryRepo.list(undefined, context);
    const records = await runPiTransaction(await this.database(policy), ["sessions"], "readonly", () => this.assertCurrent(policy), (transaction, request, setResult) => {
      request(transaction.objectStore("sessions").getAll(), setResult);
    });
    this.assertCurrent(policy);
    return records.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  async delete(metadata, context) {
    const policy = this.dataPolicy;
    this.assertCurrent(policy);
    if (!policy.allowPersistentSessions) return this.memoryRepo.delete(metadata, context);
    if (this.sessions.has(metadata?.id)) throw errorWithCode("PI_SESSION_OPEN", "Close the PI session before deleting it.");
    const db = await this.database(policy);
    await runPiTransaction(db, ["sessions", "state", "commits", "locks"], "readwrite", () => this.assertCurrent(policy), (transaction, request) => {
      const sessions = transaction.objectStore("sessions");
      request(sessions.get(metadata?.id), (stored) => {
        if (!stored) throw errorWithCode("PI_SESSION_NOT_FOUND", "PI session metadata was not found.");
        request(transaction.objectStore("locks").get(stored.id), (lock) => {
          if (lock) throw errorWithCode("PI_SESSION_WRITER_CONFLICT", "Another browser context owns this PI session.");
          request(transaction.objectStore("commits").index("sessionId").getAll(stored.id), (commits) => {
            commits.forEach((commit) => transaction.objectStore("commits").delete(commit.id));
            sessions.delete(stored.id);
            transaction.objectStore("state").delete(stored.id);
          });
        });
      });
    });
  }

  async fork(source, options, context) {
    const policy = this.dataPolicy;
    this.assertCurrent(policy);
    if (policy.allowPersistentSessions) throw errorWithCode("PI_SESSION_FORK_NOT_QUALIFIED", "Persistent PI session forking is not part of this qualification.");
    return this.track(await this.memoryRepo.fork(source, options, context), policy, "memory");
  }

  track(raw, policy, mode) {
    const session = bindSession(raw, () => this.assertCurrent(policy), () => this.releaseSession(raw));
    this.sessions.set(raw.metadata.id, { raw, session, storage: null, policy, mode });
    return session;
  }

  releaseSession(raw) {
    this.sessions.delete(raw.metadata.id);
    this.retiredSessions.delete(raw);
    const database = this.retiredSessionDatabases.get(raw);
    if (!database) return;
    this.retiredSessionDatabases.delete(raw);
    this.releaseRetiredDatabase(database);
  }

  releaseRetiredDatabase(database) {
    if (!this.retiredDatabases.has(database)) return;
    if ([...this.retiredSessionDatabases.values(), ...this.pendingSessionDatabases.values()].includes(database)) return;
    database.close();
    this.retiredDatabases.delete(database);
  }

  readLegacyHistory(records = []) {
    this.assertCurrent();
    return records.map((record) => Object.freeze({
      id: String(record.id), label: String(record.label || record.id), legacy: true, readOnly: true, source: "AGRUN"
    }));
  }

  async continueLegacy(record, context) {
    if (!record?.legacy || !record.readOnly) throw errorWithCode("LEGACY_RECORD_NOT_READ_ONLY", "Only labeled legacy records can start a new PI session.");
    return this.create({ parentSessionId: undefined }, context);
  }

  failNextCommit(id) {
    const item = this.sessions.get(id);
    if (!item?.storage) throw errorWithCode("PI_SESSION_NOT_OPEN", "Open the PI session before injecting a qualification failure.");
    item.storage.failNextCommit();
  }

  describe() {
    const policy = this.policy();
    return { mode: policy.allowPersistentSessions ? "indexeddb" : "memory", namespace: policy.allowPersistentSessions ? this.databaseName : null,
      classification: policy.classification, allowPersistentSessions: policy.allowPersistentSessions, legacyReplay: false, legacyWrite: false };
  }

  setDataPolicy(next) {
    const previous = this.dataPolicy;
    if (isPolicyCurrent(previous, next)) return;
    this.dataPolicy = next || classifyImportedDocument();
    const oldSessions = [...this.sessions.values()];
    const oldDb = this.db;
    this.sessions.clear();
    // Retire wrappers immediately, but keep their raw sessions alive until in-flight
    // Harness provider/tool delivery reaches the current-policy guard. This preserves
    // the stale-policy cause instead of turning the lifecycle race into a closed-session error.
    oldSessions.forEach((item) => {
      this.retiredSessions.add(item.raw);
      if (item.storage?.db) this.retiredSessionDatabases.set(item.raw, item.storage.db);
    });
    if (oldDb) {
      this.retiredDatabases.add(oldDb);
      this.releaseRetiredDatabase(oldDb);
    }
    this.db = null;
    this.dbOpening = null;
  }

  async close(context = BACKGROUND_CONTEXT) {
    if (this.closed) return;
    this.closed = true;
    await Promise.all([...this.pendingSessionOpenings]);
    const sessions = new Set([
      ...[...this.sessions.values()].map((item) => item.raw),
      ...this.retiredSessions,
    ]);
    await Promise.all([...sessions].map((session) => session.close(context).catch(() => {})));
    this.sessions.clear();
    this.retiredSessions.clear();
    this.retiredSessionDatabases.clear();
    await this.memoryRepo.close(context).catch(() => {});
    this.db?.close();
    for (const database of this.retiredDatabases) database.close();
    this.retiredDatabases.clear();
    this.db = null;
  }
}
