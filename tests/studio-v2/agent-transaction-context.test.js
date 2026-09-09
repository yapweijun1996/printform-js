import { describe, expect, it } from "vitest";
import { bindAgentSession, installAgentGateway } from "../../studio-v2/adapters/gateway.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function createSessions() {
  const policy = classifySyntheticDocument("transaction-context-doc");
  const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy });
  const gateway = installAgentGateway(bus, {}, { getDataPolicy: () => policy, sessionId: "host-session" });
  return { bus, first: bindAgentSession(gateway, "agent-session-a"), second: bindAgentSession(gateway, "agent-session-b") };
}

describe("Agent transaction context boundary", () => {
  it("binds new transactions and filters cross-session records", async () => {
    const { bus, first, second } = createSessions();
    const started = await first.execute("begin_transaction", { baseRevision: 0, agentId: "caller-agent", owner: "caller-owner" });
    const rawId = bus.transactionStore.listTransactions()[0].transaction_id;

    expect(started.ok).toBe(true);
    expect((await first.execute("get_transaction", { transactionId: rawId })).ok).toBe(true);
    expect((await second.execute("get_transaction", { transactionId: rawId })).error.code).toBe("STALE_POLICY_CONTEXT");
    expect((await second.execute("list_active_transactions", {})).result.transactions).toEqual([]);
    expect((await second.execute("get_transaction_history", {})).result.transactions).toEqual([]);
  });

  it("does not rebind an existing transaction during preview", async () => {
    const { bus, first, second } = createSessions();
    await first.execute("begin_transaction", { baseRevision: 0 });
    const rawId = bus.transactionStore.listTransactions()[0].transaction_id;
    const result = await second.execute("preview_changes", {
      expectedRevision: 0,
      transactionId: rawId,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });

    expect(result.error.code).toBe("STALE_POLICY_CONTEXT");
    expect(bus.transactionStore.getTransaction(rawId).agent_context.sessionId).toBe("agent-session-a");
  });

  it("fails closed for legacy transactions without trusted Agent context", async () => {
    const { bus, first } = createSessions();
    const legacy = bus.beginTransaction();
    const result = await first.execute("get_transaction", { transactionId: legacy.transaction_id });

    expect(result.error.code).toBe("STALE_POLICY_CONTEXT");
  });
});
