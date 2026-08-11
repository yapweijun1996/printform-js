const INDEX_DB = "printform-agent-session-index-v1";
const INDEX_STORE = "sessions";
const SESSION_DB_PREFIX = "printform-agrun-session-";

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Session index request failed"));
  });
}

function openIndex() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEX_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(INDEX_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Cannot open session index"));
  });
}

function sessionId() { return crypto.randomUUID(); }

export function sessionDatabaseName(id) { return `${SESSION_DB_PREFIX}${id}`; }

export class AgentSessionManager {
  constructor({ realData = false } = {}) {
    this.realData = realData;
    this.memory = new Map();
    this.runtimeStores = new Map();
    this.indexDb = null;
  }

  setRealData(realData) {
    const next = Boolean(realData);
    if (next !== this.realData) {
      this.runtimeStores.clear();
      this.memory.clear();
    }
    this.realData = next;
  }

  async index() {
    if (!this.indexDb) this.indexDb = await openIndex();
    return this.indexDb;
  }

  async list() {
    if (this.realData) return Array.from(this.memory.values()).map((item) => ({ ...item }));
    const db = await this.index();
    return requestValue(db.transaction(INDEX_STORE, "readonly").objectStore(INDEX_STORE).getAll());
  }

  async create(label = "New design chat", labelKey = null) {
    const record = { id: sessionId(), label: String(label || "New design chat").slice(0, 80), labelKey, createdAt: Date.now(), updatedAt: Date.now() };
    this.memory.set(record.id, record);
    if (!this.realData) {
      const db = await this.index();
      await requestValue(db.transaction(INDEX_STORE, "readwrite").objectStore(INDEX_STORE).put(record));
    }
    return { ...record };
  }

  async touch(id, patch = {}) {
    const current = (await this.list()).find((item) => item.id === id);
    if (!current) return null;
    const record = { ...current, ...patch, updatedAt: Date.now() };
    this.memory.set(id, record);
    if (!this.realData) {
      const db = await this.index();
      await requestValue(db.transaction(INDEX_STORE, "readwrite").objectStore(INDEX_STORE).put(record));
    }
    return { ...record };
  }

  async delete(id) {
    this.memory.delete(id);
    this.runtimeStores.delete(id);
    if (!this.realData) {
      const db = await this.index();
      await requestValue(db.transaction(INDEX_STORE, "readwrite").objectStore(INDEX_STORE).delete(id));
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(sessionDatabaseName(id));
        request.onsuccess = () => resolve();
        request.onblocked = () => reject(new Error("Session database is still in use"));
        request.onerror = () => reject(request.error || new Error("Cannot delete session database"));
      });
    }
  }

  createStore(Agrun, id) {
    if (this.realData) {
      if (!this.runtimeStores.has(id)) this.runtimeStores.set(id, Agrun.createInMemorySessionStore());
      return this.runtimeStores.get(id);
    }
    return Agrun.createIndexedDBSessionStore({ dbName: sessionDatabaseName(id) });
  }
}
