import { policyError } from "../core/data-policy.js";

const STORES = {
  sessions: ["id", []], messages: ["id", ["sessionId"]],
  summaries: ["id", ["sessionId"]], memoryEntries: ["key", ["sessionId"]],
  globalMemory: ["id", ["category"]]
};

export function createSessionDatabase({ name, assertCurrent, onFailure, openTimeoutMs = 5000 }) {
  let connection = null;
  let opening = null;
  let disposed = false;
  const active = new Set();
  const check = () => { assertCurrent(); if (disposed) throw policyError("STALE_POLICY_CONTEXT"); };

  function close() {
    disposed = true;
    for (const transaction of active) {
      try { transaction.abort(); } catch { /* Completed writes cannot be revoked. */ }
    }
    active.clear();
    connection?.close();
    connection = null;
  }

  function open() {
    check();
    if (connection) return Promise.resolve(connection);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 4);
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error("Session database open timed out")), openTimeoutMs);
      request.onupgradeneeded = () => {
        const transaction = request.transaction;
        try {
          check();
          if (settled) throw new Error("Session database open expired");
          active.add(transaction);
          transaction.addEventListener("complete", () => active.delete(transaction));
          transaction.addEventListener("abort", () => active.delete(transaction));
          for (const [storeName, [keyPath, indexes]] of Object.entries(STORES)) {
            const store = request.result.objectStoreNames.contains(storeName)
              ? transaction.objectStore(storeName) : request.result.createObjectStore(storeName, { keyPath });
            if (store.keyPath !== keyPath) throw policyError("SESSION_SCHEMA_INCOMPATIBLE");
            for (const index of indexes) if (!store.indexNames.contains(index)) store.createIndex(index, index, { unique: false });
          }
        } catch (error) { transaction.abort(); fail(error); }
      };
      request.onsuccess = () => {
        try {
          check();
          if (settled) { request.result.close(); return; }
          settled = true;
          clearTimeout(timer);
          connection = request.result;
          const opened = connection;
          const forget = () => { if (connection === opened) { connection = null; opening = null; } };
          opened.onversionchange = () => { opened.close(); forget(); };
          opened.onclose = forget;
          resolve(connection);
        } catch (error) { request.result.close(); fail(error); }
      };
      request.onerror = () => fail(request.error || new Error("Session database open failed"));
      request.onblocked = () => fail(new Error("Session database open blocked"));
    });
    return opening;
  }

  async function run(storeName, mode, work) {
    try {
      const db = await open();
      check();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        active.add(transaction);
        let result;
        let failure;
        const fail = (error) => {
          failure ||= error;
          try { transaction.abort(); } catch { /* Preserve the known transaction result. */ }
          active.delete(transaction);
          reject(failure);
        };
        const request = (pending, success) => {
          pending.onsuccess = () => {
            try { check(); success(pending.result); } catch (error) { fail(error); }
          };
          pending.onerror = () => fail(pending.error || new Error("Session storage request failed"));
        };
        transaction.oncomplete = () => {
          active.delete(transaction);
          try { check(); resolve(result); } catch (error) { reject(error); }
        };
        transaction.onabort = transaction.onerror = () => {
          active.delete(transaction);
          try { check(); reject(failure || transaction.error || new Error("Session storage transaction aborted")); }
          catch (error) { reject(error); }
        };
        try { check(); work(transaction.objectStore(storeName), request, (value) => { result = value; }); }
        catch (error) { fail(error); }
      });
    } catch (error) {
      check();
      if (error.name !== "SessionVersionConflictError") onFailure(error);
      throw error;
    }
  }

  return { run, close };
}
