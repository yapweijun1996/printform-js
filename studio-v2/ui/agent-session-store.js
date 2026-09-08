import { policyError } from "../core/data-policy.js";
import { createSessionDatabase } from "./agent-session-database.js";

const clone = (value) => value == null ? null : structuredClone(value);
const order = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id || a.key || "").localeCompare(String(b.id || b.key || ""));
const thread = (value) => typeof value === "string" && value.trim() ? value.trim() : "default";
const slot = (value) => value?.metadata?.slot?.trim?.()
  ? `${value.metadata.kind?.trim?.() || ""}:${value.metadata.slot.trim()}` : null;

export function bindSessionStore(store, assertCurrent, dispose = () => {}) {
  let disposed = false;
  const check = () => { assertCurrent(); if (disposed) throw policyError("STALE_POLICY_CONTEXT"); };
  const bound = Object.fromEntries(Object.entries(store).map(([name, value]) => [name, typeof value !== "function" ? value : async (...args) => {
    check();
    const result = await value.apply(store, args);
    check();
    return result;
  }]));
  Object.defineProperty(bound, "dispose", { value: () => { disposed = true; dispose(); } });
  return bound;
}

export function createPolicySessionStore({ name, sessionId, assertCurrent, onFailure }) {
  const database = createSessionDatabase({ name, assertCurrent, onFailure });
  const scoped = (id) => { if (id !== sessionId) throw policyError("SESSION_CONTEXT_MISMATCH"); };
  const key = (id, threadId) => { scoped(id); return `${id}::${thread(threadId)}`; };
  const get = (table, id) => database.run(table, "readonly", (store, request, done) => request(store.get(id), (value) => done(clone(value))));
  const put = (table, value) => database.run(table, "readwrite", (store, request, done) => request(store.put(clone(value)), () => done(clone(value))));
  const list = (table, id) => {
    scoped(id);
    return database.run(table, "readonly", (store, request, done) => request(store.index("sessionId").getAll(id), (rows) => done(rows.sort(order).map(clone))));
  };
  const remove = (table, id) => database.run(table, "readwrite", (store, request) => request(store.delete(id), () => {}));
  const store = {
    createSession(record) { scoped(record.id); return put("sessions", record); },
    getSession(id) { scoped(id); return get("sessions", id); },
    async saveSession(record) {
      scoped(record.id);
      const saved = await database.run("sessions", "readwrite", (entries, request, done) => {
        request(entries.get(record.id), (current) => {
          const incoming = typeof record.version === "number" ? record.version : 0;
          const stored = typeof current?.version === "number" ? current.version : 0;
          if (current && incoming !== stored) {
            throw Object.assign(new Error("Session version conflict"), {
              name: "SessionVersionConflictError", storedVersion: stored, incomingVersion: incoming, storedRecord: clone(current)
            });
          }
          const updated = { ...clone(record), version: incoming + 1 };
          request(entries.put(updated), () => done(updated));
        });
      });
      assertCurrent();
      record.version = saved.version;
      return clone(saved);
    },
    appendMessage(record) { scoped(record.sessionId); return put("messages", record); },
    updateMessage(record) { scoped(record.sessionId); return put("messages", record); },
    readMessages(id) { return list("messages", id); },
    getSummary(id, threadId) { return get("summaries", key(id, threadId)); },
    writeSummary(record) {
      const threadId = thread(record.threadId);
      return put("summaries", { ...clone(record), id: key(record.sessionId, threadId), threadId });
    },
    async listSummaries(id) {
      return (await list("summaries", id)).sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    },
    appendMemory(id, record) {
      scoped(id);
      return database.run("memoryEntries", "readwrite", (entries, request, done) => {
        request(entries.index("sessionId").getAll(id), (current) => {
          const match = slot(record);
          for (const existing of current) if (match && slot(existing) === match) entries.delete(existing.key);
          const value = { ...clone(record), sessionId: id, key: `${id}:${record.timestamp || ""}:${crypto.randomUUID()}` };
          request(entries.put(value), () => done(clone(record)));
        });
      });
    },
    async readMemory(id) {
      return (await list("memoryEntries", id)).map(({ key: _key, sessionId: _sessionId, ...record }) => record);
    },
    appendGlobalMemory(record) {
      return put("globalMemory", { ...clone(record), id: record.id || crypto.randomUUID(), createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(), updatedAt: Date.now() });
    },
    readAllGlobalMemory() {
      return database.run("globalMemory", "readonly", (entries, request, done) => request(entries.getAll(), (records) => done(records.sort(order).map(clone))));
    },
    deleteGlobalMemory(id) { return remove("globalMemory", id); },
    updateGlobalMemory(id, patch) {
      return database.run("globalMemory", "readwrite", (entries, request, done) => request(entries.get(id), (current) => {
        if (!current) return done(null);
        const value = { ...current, ...clone(patch || {}), id: current.id, createdAt: current.createdAt ?? Date.now(), updatedAt: Date.now() };
        request(entries.put(value), () => done(clone(value)));
      }));
    },
    clearAllGlobalMemory() {
      return database.run("globalMemory", "readwrite", (entries, request) => request(entries.clear(), () => {}));
    }
  };
  return bindSessionStore(store, assertCurrent, database.close);
}
