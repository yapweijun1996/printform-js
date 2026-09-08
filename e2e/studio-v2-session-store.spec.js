import { expect, test } from "@playwright/test";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("preserves the pinned runtime session schema and atomic version conflicts", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createPolicySessionStore } = await import("/studio-v2/ui/agent-session-store.js");
    const failures = [];
    const name = "SYNTHETIC-STORE-PARITY";
    const sessionId = "SYNTHETIC-SESSION";
    const old = window.Agrun.createIndexedDBSessionStore({ dbName: name });
    await old.createSession({ id: sessionId, version: 0, metadata: { canary: "SYNTHETIC-EXISTING" } });
    await old.appendMessage({ id: "message-1", sessionId, createdAt: 1, content: "SYNTHETIC-OLD-MESSAGE" });
    await old.writeSummary({ sessionId, content: "SYNTHETIC-OLD-SUMMARY", updatedAt: 1 });
    const store = createPolicySessionStore({ name, sessionId, assertCurrent() {}, onFailure: (error) => failures.push(error.name) });
    const original = await store.getSession(sessionId);
    const summary = await store.getSummary(sessionId);
    const record = structuredClone(original);
    await store.saveSession(record);
    const conflict = await store.saveSession(original).then(() => null, (error) => ({ name: error.name, storedVersion: error.storedVersion, incomingVersion: error.incomingVersion }));
    await store.updateMessage({ id: "message-1", sessionId, createdAt: 1, content: "SYNTHETIC-UPDATED-MESSAGE" });
    await store.appendMessage({ id: "message-2", sessionId, createdAt: 2, content: "SYNTHETIC-NEW-MESSAGE" });
    await store.writeSummary({ sessionId, threadId: " custom ", content: "SYNTHETIC-NEW-SUMMARY", updatedAt: 2 });
    const memory = { timestamp: "2026-01-01", metadata: { kind: "fact", slot: "test" }, content: "SYNTHETIC-OLD-MEMORY" };
    await old.appendMemory(sessionId, memory);
    await store.appendMemory(sessionId, { ...memory, content: "SYNTHETIC-NEW-MEMORY" });
    const stored = await old.getSession(sessionId);
    const messages = await old.readMessages(sessionId);
    const summaries = await old.listSummaries(sessionId);
    const memories = await old.readMemory(sessionId);
    const scoped = await store.getSession("SYNTHETIC-OTHER-SESSION").then(() => null, (error) => error.code);
    store.dispose();
    return { original, summary, conflict, version: record.version, stored, messages, summaries, memories, failures, scoped };
  });
  expect(result.original.version).toBe(0);
  expect(result.summary.content).toBe("SYNTHETIC-OLD-SUMMARY");
  expect(result.conflict).toEqual({ name: "SessionVersionConflictError", storedVersion: 1, incomingVersion: 0 });
  expect(result.version).toBe(1);
  expect(result.stored).toEqual({ ...result.original, version: 1 });
  expect(result.messages.map((row) => row.content)).toEqual(["SYNTHETIC-UPDATED-MESSAGE", "SYNTHETIC-NEW-MESSAGE"]);
  expect(result.summaries.map((row) => row.content)).toEqual(["SYNTHETIC-OLD-SUMMARY", "SYNTHETIC-NEW-SUMMARY"]);
  expect(result.memories.map((row) => row.content)).toEqual(["SYNTHETIC-NEW-MEMORY"]);
  expect(result.failures).toEqual([]);
  expect(result.scoped).toBe("SESSION_CONTEXT_MISMATCH");
  const persisted = JSON.stringify((await readClientStorage(page)).indexedDb);
  expect(persisted).toContain("SYNTHETIC-EXISTING");
  expect(persisted).toContain("SYNTHETIC-NEW-MESSAGE");
});

test("reports an asynchronous runtime write failure and keeps the next chat volatile without replay", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { AgentSessionManager } = await import("/studio-v2/ui/agent-sessions.js");
    const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
    const manager = new AgentSessionManager({ dataPolicy: classifySyntheticDocument("SYNTHETIC-FAILURE-DOC") });
    const record = await manager.create("SYNTHETIC-SAVED-INDEX");
    const store = manager.createStore(window.Agrun, record.id);
    await store.createSession({ id: record.id, version: 0, canary: "SYNTHETIC-CONFIRMED-SESSION" });
    const originalPut = IDBObjectStore.prototype.put;
    let attempts = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "messages") { attempts += 1; throw new DOMException("Quota exceeded", "QuotaExceededError"); }
      return originalPut.apply(this, args);
    };
    let failed;
    try {
      failed = await store.appendMessage({ id: "SYNTHETIC-FAILED", sessionId: record.id, content: "SYNTHETIC-FAILED-WRITE-CANARY" }).then(() => false, () => true);
    } finally { IDBObjectStore.prototype.put = originalPut; }
    const next = await manager.create("SYNTHETIC-VOLATILE-INDEX-CANARY");
    const volatile = manager.createStore(window.Agrun, next.id);
    await volatile.createSession({ id: next.id, version: 0 });
    await volatile.appendMessage({ id: "SYNTHETIC-VOLATILE", sessionId: next.id, content: "SYNTHETIC-VOLATILE-RUNTIME-CANARY" });
    const messages = await volatile.readMessages(next.id);
    const stored = await store.getSession(record.id);
    return { failed, attempts, state: manager.persistenceState, messages, stored };
  });
  expect(result.failed).toBe(true);
  expect(result.attempts).toBe(1);
  expect(result.state).toBe("volatile-fallback");
  expect(result.messages[0].content).toBe("SYNTHETIC-VOLATILE-RUNTIME-CANARY");
  expect(result.stored.canary).toBe("SYNTHETIC-CONFIRMED-SESSION");
  const persisted = JSON.stringify(await readClientStorage(page));
  expect(persisted).toContain("SYNTHETIC-CONFIRMED-SESSION");
  for (const canary of ["SYNTHETIC-FAILED-WRITE-CANARY", "SYNTHETIC-VOLATILE-INDEX-CANARY", "SYNTHETIC-VOLATILE-RUNTIME-CANARY"]) expect(persisted).not.toContain(canary);
});

for (const change of ["mode", "document", "generation"]) {
  test(`rejects a delayed runtime database open after a ${change} change`, async ({ page }) => {
    const result = await page.evaluate(async (change) => {
      const { AgentSessionManager } = await import("/studio-v2/ui/agent-sessions.js");
      const { classifyRealDocument, classifySyntheticDocument, createDataPolicy } = await import("/studio-v2/core/data-policy.js");
      const policy = classifySyntheticDocument("SYNTHETIC-DOCUMENT-A");
      const manager = new AgentSessionManager({ dataPolicy: policy });
      const record = await manager.create("SYNTHETIC-INDEX-CONTROL");
      const store = manager.createStore(window.Agrun, record.id);
      const open = indexedDB.open.bind(indexedDB);
      let release;
      const ready = new Promise((resolve) => {
        indexedDB.open = (...args) => {
          const actual = open(...args);
          const held = {};
          actual.onupgradeneeded = () => { held.result = actual.result; held.transaction = actual.transaction; held.onupgradeneeded?.(); };
          actual.onerror = () => { held.error = actual.error; held.onerror?.(); };
          actual.onsuccess = () => { held.result = actual.result; release = () => held.onsuccess(); resolve(); };
          return held;
        };
      });
      try {
        const pending = store.createSession({ id: record.id, canary: "SYNTHETIC-DELAYED-RUNTIME-CANARY" }).then(() => null, (error) => error.code);
        await ready;
        manager.setDataPolicy(change === "mode" ? classifyRealDocument(policy.documentId)
          : change === "document" ? classifySyntheticDocument("SYNTHETIC-DOCUMENT-B")
            : createDataPolicy({ ...policy, context: policy.contextId, generation: policy.generation + 1 }));
        release();
        const code = await pending;
        const late = await store.appendMessage({ id: "message-1", sessionId: record.id, content: "SYNTHETIC-STALE-MESSAGE" }).then(() => null, (error) => error.code);
        return { code, late, error: manager.persistenceError, records: manager.memory.size };
      } finally { indexedDB.open = open; }
    }, change);
    expect(result).toEqual({ code: "STALE_POLICY_CONTEXT", late: "STALE_POLICY_CONTEXT", error: null, records: 0 });
    const persisted = JSON.stringify((await readClientStorage(page)).indexedDb);
    expect(persisted).toContain("SYNTHETIC-INDEX-CONTROL");
    expect(persisted).not.toContain("SYNTHETIC-DELAYED-RUNTIME-CANARY");
    expect(persisted).not.toContain("SYNTHETIC-STALE-MESSAGE");
  });
}
