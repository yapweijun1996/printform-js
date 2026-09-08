import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionDatabase } from "../../studio-v2/ui/agent-session-database.js";
import { bindSessionStore } from "../../studio-v2/ui/agent-session-store.js";

function fixture() {
  const pending = { result: "SYNTHETIC-CANARY" };
  const transaction = { objectStore: () => ({ put: () => pending }), abort: vi.fn() };
  const connection = { transaction: vi.fn(() => transaction), close: vi.fn() };
  const openRequest = { result: connection };
  const open = vi.fn(() => openRequest);
  vi.stubGlobal("indexedDB", { open });
  let current = true;
  const assertCurrent = () => { if (!current) throw Object.assign(new Error("Stale"), { code: "STALE_POLICY_CONTEXT" }); };
  const onFailure = vi.fn();
  const database = createSessionDatabase({ name: "SYNTHETIC-STORE", assertCurrent, onFailure, openTimeoutMs: 50 });
  return { database, transaction, pending, connection, openRequest, onFailure, expire() { current = false; database.close(); } };
}

describe("policy-bound session transactions", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("waits for transaction completion, not request success, before confirming persistence", async () => {
    const f = fixture();
    let settled = false;
    const write = f.database.run("messages", "readwrite", (store, request, done) => request(store.put({}), done));
    const result = write.then((value) => { settled = true; return value; });
    f.openRequest.onsuccess();
    await Promise.resolve();
    f.pending.onsuccess();
    await Promise.resolve();
    expect(settled).toBe(false);
    f.transaction.oncomplete();
    expect(await result).toBe("SYNTHETIC-CANARY");
    expect(f.onFailure).not.toHaveBeenCalled();
  });

  it("reports an abort after request success without retrying a write", async () => {
    const f = fixture();
    const write = f.database.run("messages", "readwrite", (store, request, done) => request(store.put({}), done));
    const result = expect(write).rejects.toThrow("transaction aborted");
    f.openRequest.onsuccess();
    await Promise.resolve();
    f.pending.onsuccess();
    f.transaction.onabort();
    await result;
    expect(f.onFailure).toHaveBeenCalledTimes(1);
    expect(f.connection.transaction).toHaveBeenCalledTimes(1);
  });

  it("aborts active work and rejects old completions without poisoning the new policy", async () => {
    const f = fixture();
    const write = f.database.run("messages", "readwrite", (store, request, done) => request(store.put({}), done));
    const result = expect(write).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    f.openRequest.onsuccess();
    await Promise.resolve();
    f.expire();
    f.transaction.onabort();
    await result;
    expect(f.transaction.abort).toHaveBeenCalledTimes(1);
    expect(f.onFailure).not.toHaveBeenCalled();
  });

  it.each(["blocked", "timeout"])("closes a late connection after %s without starting a transaction", async (reason) => {
    vi.useFakeTimers();
    const f = fixture();
    const result = expect(f.database.run("messages", "readwrite", () => {})).rejects.toThrow();
    if (reason === "blocked") f.openRequest.onblocked();
    else await vi.advanceTimersByTimeAsync(50);
    await result;
    f.openRequest.onsuccess();
    expect(f.connection.close).toHaveBeenCalledTimes(1);
    expect(f.connection.transaction).not.toHaveBeenCalled();
  });

  it("invalidates detached memory stores even when the policy itself has not changed", async () => {
    const appendMessage = vi.fn();
    const store = bindSessionStore({ appendMessage }, () => {});
    store.dispose();
    await expect(store.appendMessage({})).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    expect(appendMessage).not.toHaveBeenCalled();
  });
});
