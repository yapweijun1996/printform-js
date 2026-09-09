import { PiMemoryStorage } from "./session-memory.js";

export const PI_SESSION_SCHEMA_VERSION = 1;
export const PI_SESSION_DB_PREFIX = "printform-pi-session-v1-";

const STORES = Object.freeze({
  sessions: "id", state: "id", locks: "id", commits: "id"
});

function errorWithCode(code, message, cause) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), { code });
}

function safeContext(contextId) {
  const value = String(contextId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  return value || "default";
}

export function piSessionDatabaseName(contextId) {
  return `${PI_SESSION_DB_PREFIX}${safeContext(contextId)}`;
}

export function openPiSessionDatabase(name, assertCurrent, openTimeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    assertCurrent();
    const request = indexedDB.open(name, PI_SESSION_SCHEMA_VERSION);
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => fail(errorWithCode("PI_SESSION_OPEN_TIMEOUT", "PI session storage open timed out.")), openTimeoutMs);
    request.onupgradeneeded = () => {
      try {
        assertCurrent();
        const db = request.result;
        for (const [store, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath });
        }
        const commits = request.transaction.objectStore("commits");
        if (!commits.indexNames.contains("sessionId")) commits.createIndex("sessionId", "sessionId", { unique: false });
      } catch (error) {
        request.transaction?.abort();
        fail(error);
      }
    };
    request.onsuccess = () => {
      try {
        assertCurrent();
        if (settled) return request.result.close();
        settled = true;
        clearTimeout(timer);
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      } catch (error) {
        request.result.close();
        fail(error);
      }
    };
    request.onerror = () => fail(request.error || errorWithCode("PI_SESSION_OPEN_FAILED", "PI session storage could not be opened."));
    request.onblocked = () => fail(errorWithCode("PI_SESSION_OPEN_BLOCKED", "PI session storage open was blocked."));
  });
}

export function runPiTransaction(db, stores, mode, assertCurrent, work) {
  return new Promise((resolve, reject) => {
    let result;
    let failed = false;
    const transaction = db.transaction(stores, mode);
    const fail = (error) => {
      if (failed) return;
      failed = true;
      try { transaction.abort(); } catch { /* Preserve the first failure. */ }
      reject(error);
    };
    const request = (pending, onSuccess) => {
      pending.onsuccess = () => {
        try { assertCurrent(); onSuccess(pending.result); }
        catch (error) { fail(error); }
      };
      pending.onerror = () => fail(pending.error || errorWithCode("PI_SESSION_REQUEST_FAILED", "PI session storage request failed."));
      return pending;
    };
    transaction.oncomplete = () => {
      try { assertCurrent(); if (!failed) resolve(result); }
      catch (error) { reject(error); }
    };
    transaction.onabort = transaction.onerror = () => {
      if (!failed) reject(transaction.error || errorWithCode("PI_SESSION_TRANSACTION_ABORTED", "PI session storage transaction aborted."));
    };
    try { work(transaction, request, (value) => { result = value; }); }
    catch (error) { fail(error); }
  });
}

function clone(value) { return structuredClone(value); }

export class IndexedDbSessionStorage {
  constructor({ db, sessionId, writerId, assertCurrent }) {
    this.db = db;
    this.sessionId = sessionId;
    this.writerId = writerId;
    this.assertCurrent = assertCurrent;
    this.memory = null;
    this.commits = [];
    this.version = 0;
    this.closed = false;
    this.released = false;
    this.commitTail = Promise.resolve();
    this.closePromise = null;
    this.failNext = false;
  }

  static async open(options) {
    const storage = new IndexedDbSessionStorage(options);
    try {
      await storage.initialize();
      return storage;
    } catch (error) {
      await storage.close().catch(() => {});
      throw error;
    }
  }

  async initialize() {
    this.assertCurrent();
    await runPiTransaction(this.db, ["locks"], "readwrite", this.assertCurrent, (transaction, request) => {
      request(transaction.objectStore("locks").get(this.sessionId), (lock) => {
        if (lock && lock.owner !== this.writerId) throw errorWithCode("PI_SESSION_WRITER_CONFLICT", "Another browser context owns this PI session.");
        transaction.objectStore("locks").put({ id: this.sessionId, owner: this.writerId, acquiredAt: Date.now() });
      });
    });
    const loaded = await runPiTransaction(this.db, ["state", "commits"], "readonly", this.assertCurrent, (transaction, request, setResult) => {
      request(transaction.objectStore("state").get(this.sessionId), (state) => {
        request(transaction.objectStore("commits").index("sessionId").getAll(this.sessionId), (commits) => {
          setResult({ state, commits });
        });
      });
    });
    if (!loaded.state || !Number.isSafeInteger(loaded.state.version)) throw errorWithCode("PI_SESSION_STATE_MISSING", "PI session state is incomplete.");
    this.version = loaded.state.version;
    this.commits = loaded.commits.sort((a, b) => a.commitIndex - b.commitIndex);
    if (this.commits.some((item, index) => item.commitIndex !== index || item.sessionId !== this.sessionId)) {
      throw errorWithCode("PI_SESSION_LOG_INVALID", "PI session commit log is not contiguous.");
    }
    if (this.version !== this.commits.length) throw errorWithCode("PI_SESSION_STATE_INVALID", "PI session state does not match its commit log.");
    this.memory = await this.rebuild(this.commits);
  }

  async rebuild(commits, nextTimestamp = null) {
    let index = 0;
    const memory = new PiMemoryStorage({ now: () => commits[index++]?.timestamp ?? nextTimestamp ?? Date.now() });
    for (const record of commits) await memory.commit(clone(record.writes), { kind: "pi-03-replay" });
    return memory;
  }

  assertOpen() {
    this.assertCurrent();
    if (this.closed) throw errorWithCode("PI_SESSION_CLOSED", "PI session storage is closed.");
  }

  commit(writes, context) {
    const next = this.commitTail.then(() => this.commitOne(writes, context));
    this.commitTail = next.then(() => undefined, () => undefined);
    return next;
  }

  async commitOne(writes, context) {
    this.assertOpen();
    if (this.failNext) { this.failNext = false; throw errorWithCode("PI_SESSION_COMMIT_FAILED", "Synthetic PI storage failure."); }
    const timestamp = Date.now();
    const record = { id: `${this.sessionId}:${this.version}`, sessionId: this.sessionId, commitIndex: this.version, timestamp, writes: clone(writes) };
    const candidate = await this.rebuild(this.commits, timestamp);
    const result = await candidate.commit(clone(writes), context);
    this.assertCurrent();
    await runPiTransaction(this.db, ["state", "commits"], "readwrite", this.assertCurrent, (transaction, request) => {
      request(transaction.objectStore("state").get(this.sessionId), (state) => {
        if (!state || state.version !== this.version) throw errorWithCode("PI_SESSION_VERSION_CONFLICT", "PI session version changed; reopen before writing.");
        transaction.objectStore("commits").add(record);
        transaction.objectStore("state").put({ id: this.sessionId, version: this.version + 1 });
      });
    });
    this.commits.push(record);
    this.version += 1;
    this.memory = candidate;
    return result;
  }

  async read(name, args, context) {
    this.assertOpen();
    const result = await this.memory[name](...args, context);
    this.assertCurrent();
    return result;
  }

  getEntries(ids, context) { return this.read("getEntries", [ids], context); }
  getValue(address, context) { return this.read("getValue", [address], context); }
  scanValues(prefix, context) { return this.read("scanValues", [prefix], context); }
  readList(address, options, context) { return this.read("readList", [address, options], context); }
  scanBranch(query, context) { return this.read("scanBranch", [query], context); }
  scanBranchStructure(query, context) { return this.read("scanBranchStructure", [query], context); }
  scanEntries(query, context) { return this.read("scanEntries", [query], context); }
  scanUsage(query, context) { return this.read("scanUsage", [query], context); }
  getStats(context) { return this.read("getStats", [], context); }

  failNextCommit() { this.failNext = true; }

  async releaseLock() {
    if (this.released) return;
    this.released = true;
    try {
      await runPiTransaction(this.db, ["locks"], "readwrite", () => {}, (transaction, request) => {
        request(transaction.objectStore("locks").get(this.sessionId), (lock) => {
          if (lock?.owner === this.writerId) transaction.objectStore("locks").delete(this.sessionId);
        });
      });
    } catch { /* The connection is closing; the browser owns final cleanup. */ }
  }

  close(context) {
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.closePromise = this.commitTail.catch(() => {}).then(async () => {
      await this.releaseLock();
      await this.memory?.close(context);
    });
    return this.closePromise;
  }
}
