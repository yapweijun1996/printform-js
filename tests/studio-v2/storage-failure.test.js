import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function quotaStorage() {
  return {
    getItem: () => null,
    setItem: () => { throw Object.assign(new Error("quota exceeded"), { name: "QuotaExceededError" }); },
    removeItem: () => {}
  };
}

describe("durable store failure boundary", () => {
  it("keeps edits usable in memory and reports that durable persistence is unavailable", async () => {
    const project = createSalesInvoiceProject();
    const bus = new CommandBus(project, {
      transactionStorage: quotaStorage(),
      dataPolicy: classifySyntheticDocument(project.manifest.documentId)
    });

    expect(bus.transactionStore.persistenceState).toBe("volatile-fallback");
    expect(bus.transactionStore.persistent).toBe(false);
    expect((await bus.execute("get_capabilities")).result.capabilities.durableTransactions).toBe(false);
    expect((await bus.execute("get_capabilities")).result.capabilities.atomicRevisionCas).toBe(false);

    const changed = await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "one" });

    expect(changed.ok).toBe(true);
    expect(bus.revision).toBe(1);
    expect(bus.transactionStore.head.revision).toBe(1);
    expect(bus.transactionStore.persistenceState).toBe("volatile-fallback");
  });
});
