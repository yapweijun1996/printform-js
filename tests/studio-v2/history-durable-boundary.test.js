import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function createBus(storage, project = createSalesInvoiceProject()) {
  return new CommandBus(project, {
    transactionStorage: storage,
    dataPolicy: classifySyntheticDocument(project.manifest.documentId),
  });
}

describe("Studio v2 canonical undo/redo boundary", () => {
  it("keeps durable head, metadata and logical redo aligned with monotonic revisions", async () => {
    const storage = memoryStorage();
    const bus = createBus(storage);
    const changed = await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "one" });
    expect(changed.result.revision).toBe(1);

    const undone = await bus.execute("undo_revision", { expectedRevision: 1 });
    expect(undone).toMatchObject({ ok: true, result: { changed: true, revision: 2 } });
    expect(bus.project.sampleData.items).toHaveLength(45);
    expect(bus.project.revision).toBe(2);
    expect(bus.transactionStore.getHeadRevision()).toBe(2);
    expect((await bus.execute("get_revision")).result).toMatchObject({ revision: 2, transactionId: null });
    expect((await bus.execute("compare_revision", { fromRevision: 1, toRevision: 2 })).result.diff.changed).toBe(true);
    expect(bus.historyState()).toEqual({ revision: 2, canUndo: false, canRedo: true });

    const redone = await bus.execute("redo_revision", { expectedRevision: 2 });
    expect(redone).toMatchObject({ ok: true, result: { changed: true, revision: 3 } });
    expect(bus.project.sampleData.items).toHaveLength(1);
    expect(bus.transactionStore.getHeadRevision()).toBe(3);
    expect(bus.historyState()).toEqual({ revision: 3, canUndo: true, canRedo: false });
  });

  it("reconstructs the logical cursor after reload and allows a new branch commit", async () => {
    const storage = memoryStorage();
    const first = createBus(storage);
    await first.execute("set_sample_scenario", { expectedRevision: 0, scenario: "one" });
    await first.execute("undo_revision", { expectedRevision: 1 });

    const reloaded = createBus(storage, first.project);
    expect(reloaded.revision).toBe(2);
    expect(reloaded.project.sampleData.items).toHaveLength(45);
    expect(reloaded.historyState()).toEqual({ revision: 2, canUndo: false, canRedo: true });

    const branch = await reloaded.execute("set_locale", { expectedRevision: 2, locale: "zh-CN" });
    expect(branch.result.revision).toBe(3);
    expect(reloaded.historyState()).toEqual({ revision: 3, canUndo: true, canRedo: false });
    const redo = await reloaded.execute("redo_revision", { expectedRevision: 3 });
    expect(redo).toMatchObject({ ok: true, result: { changed: false, revision: 3 } });
  });

  it("rejects a stale Agent context before durable history navigation", async () => {
    const storage = memoryStorage();
    const policy = classifySyntheticDocument("history-policy-doc");
    const bus = new CommandBus(createSalesInvoiceProject(), { transactionStorage: storage, dataPolicy: policy });
    await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "one" });
    let checks = 0;
    const context = {
      agent: true,
      legacy: false,
      dataPolicy: policy,
      currentPolicy: () => policy,
      scope: { kind: "document" },
      applyMode: "preview",
      humanApproval: true,
      isCurrent: () => ++checks < 3,
    };

    const result = await bus.execute("undo_revision", { expectedRevision: 1 }, context);

    expect(result.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(bus.revision).toBe(1);
    expect(bus.transactionStore.getHeadRevision()).toBe(1);
    expect(bus.historyState()).toEqual({ revision: 1, canUndo: true, canRedo: false });
  });
});
