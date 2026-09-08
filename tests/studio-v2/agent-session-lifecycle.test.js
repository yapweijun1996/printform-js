import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyRealDocument, classifySyntheticDocument, createDataPolicy } from "../../studio-v2/core/data-policy.js";
import { AgentSessionManager } from "../../studio-v2/ui/agent-sessions.js";

function deferredIndex() {
  const writes = [];
  const opens = [];
  const db = {
    close: vi.fn(),
    transaction: vi.fn(() => {
      const transaction = { abort: vi.fn() };
      transaction.objectStore = () => ({
        put(record) {
          writes.push(record);
          const request = { result: record.id };
          queueMicrotask(() => {
            request.onsuccess?.();
            transaction.oncomplete?.();
          });
          return request;
        }
      });
      return transaction;
    })
  };
  vi.stubGlobal("indexedDB", { open: vi.fn(() => { const request = {}; opens.push(request); return request; }) });
  return { writes, db, finish() { const request = opens.shift(); request.result = db; request.onsuccess(); } };
}

describe("Agent session policy lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults an unconfigured session owner to Unknown without opening storage", async () => {
    const open = vi.fn(() => { throw new Error("Forbidden storage"); });
    vi.stubGlobal("indexedDB", { open });
    const manager = new AgentSessionManager();
    expect(manager.dataPolicy.classification).toBe("unknown");
    await manager.create("SYNTHETIC-UNCLASSIFIED-CANARY");
    expect(open).not.toHaveBeenCalled();
    expect(manager.persistenceState).toBe("memory-only");
  });

  it.each(["mode", "document", "generation"])("rejects a delayed index open after a %s change without writing", async (change) => {
    const fixture = deferredIndex();
    const original = classifySyntheticDocument("SYNTHETIC-DOCUMENT-A");
    const manager = new AgentSessionManager({ dataPolicy: original });
    const pending = manager.create("SYNTHETIC-DELAYED-LABEL-CANARY");
    const rejection = expect(pending).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    const next = change === "mode" ? classifyRealDocument(original.documentId)
      : change === "document" ? classifySyntheticDocument("SYNTHETIC-DOCUMENT-B")
        : createDataPolicy({ ...original, context: original.contextId, generation: original.generation + 1 });
    manager.setDataPolicy(next);
    fixture.finish();
    await rejection;
    expect(fixture.writes).toEqual([]);
    expect(fixture.db.transaction).not.toHaveBeenCalled();
    expect(fixture.db.close).toHaveBeenCalled();
    expect(manager.memory.size).toBe(0);
    expect(manager.persistenceError).toBeNull();
  });

  it("retains the explicit Synthetic session persistence control", async () => {
    const fixture = deferredIndex();
    const manager = new AgentSessionManager({ dataPolicy: classifySyntheticDocument("SYNTHETIC-CONTROL") });
    const pending = manager.create("SYNTHETIC-PERSISTED-LABEL");
    fixture.finish();
    const record = await pending;
    expect(fixture.writes).toEqual([expect.objectContaining({ id: record.id })]);
    expect(manager.persistenceState).toBe("persistent");
  });
});
