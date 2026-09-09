import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
}

describe("CommandBus lifecycle boundary", () => {
  it("rejects commands and direct commit writes after document replacement", async () => {
    const bus = new CommandBus(createSalesInvoiceProject(), {
      transactionStorage: memoryStorage(),
      dataPolicy: classifySyntheticDocument("lifecycle-doc")
    });
    bus.deactivate();

    const result = await bus.execute("set_locale", { expectedRevision: 0, locale: "zh-CN" });

    expect(result.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(bus.revision).toBe(0);
    expect(bus.transactionStore.listTransactions()).toEqual([]);
    expect(() => bus.commitNow(bus.project, "stale commit")).toThrowError(/no longer current/);
  });
});
