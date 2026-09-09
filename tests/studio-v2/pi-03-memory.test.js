import { describe, expect, it } from "vitest";
import { appendList, list, setValue, value } from "@earendil-works/pi-agent-core";
import { PiMemoryStorage } from "../../studio-v2/pi-03/session-memory.js";

const context = { kind: "pi-03-test" };

function message(id, parentId, role = "user") {
  return { kind: "entry", entry: { id, parentId, type: "message", message: { role, content: `${role}-${id}` } } };
}

describe("PI-03 public Storage materializer", () => {
  it("preserves entry sequence, values, lists and usage totals", async () => {
    const storage = new PiMemoryStorage({ now: () => 101 });
    const setting = value("pi", "setting");
    const events = list("pi", "events");
    await storage.commit([
      message("entry-1", null),
      { kind: "usage", row: { id: "usage-1", usage: { input: 2, output: 3, totalTokens: 5, cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 } }, adjustment: false } },
      setValue(setting, "safe"), appendList(events, { code: "READY" })
    ], context);
    expect((await storage.scanEntries({ order: "asc" }, context)).map((entry) => entry.seq)).toEqual([1]);
    expect((await storage.getValue(setting, context)).value).toBe("safe");
    expect((await storage.readList(events, {}, context))[0].value).toEqual({ code: "READY" });
    expect((await storage.getStats(context)).usage.totalTokens).toBe(5);
  });

  it("scans the actual parent chain and keeps invalid batches atomic", async () => {
    const storage = new PiMemoryStorage({ now: () => 202 });
    await storage.commit([message("root", null), message("child", "root", "assistant")], context);
    expect((await storage.scanBranch({ start: "child", order: "oldestFirst" }, context)).map((entry) => entry.id)).toEqual(["root", "child"]);
    await expect(storage.commit([message("duplicate", "child"), message("duplicate", "child")], context)).rejects.toThrow("Duplicate PI session entry");
    expect((await storage.scanEntries({ order: "asc" }, context)).map((entry) => entry.id)).toEqual(["root", "child"]);
  });

  it("rejects writes after close", async () => {
    const storage = new PiMemoryStorage();
    await storage.close(context);
    await expect(storage.commit([], context)).rejects.toThrow("closed");
  });
});
