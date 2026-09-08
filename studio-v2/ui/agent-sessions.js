import { assertPolicyCurrent, classifyImportedDocument, classifyRealDocument, isPolicyCurrent, policyError } from "../core/data-policy.js";
import { bindSessionStore, createPolicySessionStore } from "./agent-session-store.js";

const INDEX_DB = "printform-agent-session-index-v1";
const INDEX_STORE = "sessions";
const SESSION_DB_PREFIX = "printform-agrun-session-";

function requestValue(request, transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error("Session index transaction aborted"));
    transaction.onerror = () => reject(transaction.error || new Error("Session index transaction failed"));
    request.onerror = () => reject(request.error || new Error("Session index request failed"));
  });
}

function openIndex(name, assertCurrent) {
  return new Promise((resolve, reject) => {
    assertCurrent();
    const request = indexedDB.open(name, 1);
    let settled = false;
    const fail = (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
    const timer = setTimeout(() => fail(new Error("Session index open timed out")), 5000);
    request.onupgradeneeded = () => {
      try {
        assertCurrent();
        if (settled) throw new Error("Session index open expired");
        request.result.createObjectStore(INDEX_STORE, { keyPath: "id" });
      } catch (error) {
        request.transaction?.abort();
        fail(error);
      }
    };
    request.onsuccess = () => {
      try {
        assertCurrent();
        if (settled) { request.result.close(); return; }
        settled = true;
        clearTimeout(timer);
        resolve(request.result);
      } catch (error) { request.result.close(); fail(error); }
    };
    request.onblocked = () => fail(new Error("Session index is blocked"));
    request.onerror = () => fail(request.error || new Error("Cannot open session index"));
  });
}

function sessionId() { return crypto.randomUUID(); }
export function sessionDatabaseName(id, contextId = "default") { return `${SESSION_DB_PREFIX}${contextId}-${id}`; }

export class AgentSessionManager {
  constructor({ realData = false, dataPolicy = null } = {}) {
    this.dataPolicy = dataPolicy || (realData ? classifyRealDocument() : classifyImportedDocument());
    this.realData = this.dataPolicy.classification !== "synthetic";
    this.contextId = this.dataPolicy.contextId || "legacy";
    this.indexName = `${INDEX_DB}-${this.contextId}`;
    this.memory = new Map();
    this.runtimeStores = new Map();
    this.indexDb = null;
    this.indexOpening = null;
    this.activeTransactions = new Set();
    this.persistenceError = null;
  }

  get persistenceState() {
    if (!this.dataPolicy.allowPersistentSessions) return "memory-only";
    return this.persistenceError ? "volatile-fallback" : "persistent";
  }

  markPersistenceFailure(error, policy = this.dataPolicy) {
    assertPolicyCurrent(policy, this.dataPolicy);
    this.persistenceError ||= error || new Error("Agent session persistence is unavailable");
    this.indexDb?.close?.();
    this.indexDb = null;
    return this.persistenceError;
  }

  setRealData(realData) {
    const policy = realData ? classifyRealDocument() : classifyImportedDocument();
    this.setDataPolicy(policy);
  }

  setDataPolicy(policy) {
    const next = policy || classifyImportedDocument();
    const nextContext = next.contextId || "legacy";
    if (!isPolicyCurrent(next, this.dataPolicy)) {
      for (const transaction of this.activeTransactions) {
        try { transaction.abort(); } catch { /* A completed transaction cannot be revoked. */ }
      }
      this.activeTransactions.clear();
      for (const store of this.runtimeStores.values()) store.dispose?.();
      this.runtimeStores.clear();
      this.memory.clear();
      this.indexDb?.close?.();
      this.indexDb = null;
      this.indexOpening = null;
      this.persistenceError = null;
    }
    this.dataPolicy = next;
    this.realData = next.classification !== "synthetic";
    this.contextId = nextContext;
    this.indexName = `${INDEX_DB}-${this.contextId}`;
  }

  async index(policy = this.dataPolicy) {
    assertPolicyCurrent(policy, this.dataPolicy);
    if (!policy.allowPersistentSessions) throw policyError("DATA_POLICY_STORAGE_BLOCKED");
    if (!this.indexDb) {
      const opening = this.indexOpening ||= openIndex(this.indexName, () => assertPolicyCurrent(policy, this.dataPolicy));
      const db = await opening;
      try { assertPolicyCurrent(policy, this.dataPolicy); }
      catch (error) { db.close(); throw error; }
      this.indexDb = db;
    }
    return this.indexDb;
  }

  async accessIndex(policy, mode, operation) {
    const db = await this.index(policy);
    assertPolicyCurrent(policy, this.dataPolicy);
    const transaction = db.transaction(INDEX_STORE, mode);
    this.activeTransactions.add(transaction);
    try {
      const result = await requestValue(operation(transaction.objectStore(INDEX_STORE)), transaction);
      assertPolicyCurrent(policy, this.dataPolicy);
      return result;
    } catch (error) {
      try { transaction.abort(); } catch { /* A completed transaction cannot be revoked. */ }
      throw error;
    } finally { this.activeTransactions.delete(transaction); }
  }

  async list() {
    const policy = this.dataPolicy;
    if (!this.dataPolicy.allowPersistentSessions || this.persistenceError) return Array.from(this.memory.values()).map((item) => ({ ...item }));
    try {
      const records = await this.accessIndex(policy, "readonly", (store) => store.getAll());
      assertPolicyCurrent(policy, this.dataPolicy);
      records.forEach((record) => this.memory.set(record.id, record));
      return records;
    } catch (error) {
      this.markPersistenceFailure(error, policy);
      return Array.from(this.memory.values()).map((item) => ({ ...item }));
    }
  }

  async create(label = "New design chat", labelKey = null) {
    const policy = this.dataPolicy;
    const record = { id: sessionId(), label: String(label || "New design chat").slice(0, 80), labelKey, createdAt: Date.now(), updatedAt: Date.now() };
    this.memory.set(record.id, record);
    if (this.dataPolicy.allowPersistentSessions && !this.persistenceError) {
      try {
        await this.accessIndex(policy, "readwrite", (store) => store.put(record));
      } catch (error) {
        this.markPersistenceFailure(error, policy);
      }
    }
    return { ...record };
  }

  async touch(id, patch = {}) {
    const policy = this.dataPolicy;
    const current = (await this.list()).find((item) => item.id === id);
    assertPolicyCurrent(policy, this.dataPolicy);
    if (!current) return null;
    const record = { ...current, ...patch, updatedAt: Date.now() };
    this.memory.set(id, record);
    if (this.dataPolicy.allowPersistentSessions && !this.persistenceError) {
      try {
        await this.accessIndex(policy, "readwrite", (store) => store.put(record));
      } catch (error) {
        this.markPersistenceFailure(error, policy);
      }
    }
    return { ...record };
  }

  async delete(id) {
    const policy = this.dataPolicy;
    const databaseName = sessionDatabaseName(id, this.contextId);
    this.runtimeStores.get(id)?.dispose?.();
    if (!policy.allowPersistentSessions || this.persistenceError) {
      this.memory.delete(id);
      this.runtimeStores.delete(id);
      return { persistent: false };
    }
    try {
      assertPolicyCurrent(policy, this.dataPolicy);
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve();
        request.onblocked = () => reject(new Error("Session database is still in use"));
        request.onerror = () => reject(request.error || new Error("Cannot delete session database"));
      });
      assertPolicyCurrent(policy, this.dataPolicy);
      await this.accessIndex(policy, "readwrite", (store) => store.delete(id));
      this.memory.delete(id);
      this.runtimeStores.delete(id);
      return { persistent: true };
    } catch (error) {
      this.markPersistenceFailure(error, policy);
      throw Object.assign(new Error("Session storage deletion could not be confirmed", { cause: error }), { code: "SESSION_STORAGE_DELETE_FAILED" });
    }
  }

  createStore(Agrun, id) {
    if (!this.runtimeStores.has(id)) {
      const policy = this.dataPolicy;
      const assertCurrent = () => assertPolicyCurrent(policy, this.dataPolicy);
      const store = !policy.allowPersistentSessions || this.persistenceError
        ? bindSessionStore(Agrun.createInMemorySessionStore(), assertCurrent)
        : createPolicySessionStore({ name: sessionDatabaseName(id, this.contextId), sessionId: id,
          assertCurrent, onFailure: (error) => this.markPersistenceFailure(error, policy) });
      this.runtimeStores.set(id, store);
    }
    return this.runtimeStores.get(id);
  }
}
