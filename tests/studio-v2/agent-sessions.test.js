import { afterEach, describe, expect, it, vi } from "vitest";
import { classifySampleDocument } from "../../studio-v2/core/data-policy.js";
import { AgentSessionManager } from "../../studio-v2/ui/agent-sessions.js";

function failingIndexedDb() {
  return {
    open() {
      const request = {};
      queueMicrotask(() => request.onerror?.({ target: { error: new Error("IndexedDB denied") } }));
      return request;
    },
    deleteDatabase() { throw new Error("IndexedDB denied"); }
  };
}

describe("Agent session persistence boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to memory without losing a synthetic session when IndexedDB is denied", async () => {
    vi.stubGlobal("indexedDB", failingIndexedDb());
    const manager = new AgentSessionManager({ dataPolicy: classifySampleDocument("session-failure") });

    expect(await manager.list()).toEqual([]);
    expect(manager.persistenceState).toBe("volatile-fallback");

    const record = await manager.create("Memory fallback chat");
    expect((await manager.list()).map((item) => item.id)).toEqual([record.id]);
    expect(manager.createStore({ createInMemorySessionStore: () => ({ kind: "memory" }) }, record.id)).toEqual({ kind: "memory" });
  });
});
