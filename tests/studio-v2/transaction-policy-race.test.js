import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifyRealDocument, classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
}

describe("Agent commit policy race", () => {
  it("checks policy at the actual CAS boundary while a commit is delayed", async () => {
    const synthetic = classifySyntheticDocument("commit-policy-doc");
    const real = classifyRealDocument("commit-policy-doc");
    let currentPolicy = synthetic;
    const bus = new CommandBus(createSalesInvoiceProject(), { transactionStorage: memoryStorage(), dataPolicy: synthetic });
    const context = {
      agent: true, legacy: false, dataPolicy: synthetic, currentPolicy: () => currentPolicy,
      scope: { kind: "document" }, applyMode: "auto", humanApproval: true, sessionId: "commit-race-session",
      isCurrent: () => true
    };
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] }, context);
    const transactionId = preview.result.transactionId;
    const transaction = bus.transactionStore.getTransaction(transactionId);
    await bus.execute("approve_transaction", { expectedRevision: 0, transactionId, expectedCandidateHash: transaction.preview_hash }, context);

    let release;
    let markCommitStarted;
    const started = new Promise((resolve) => { release = resolve; });
    const commitStarted = new Promise((resolve) => { markCommitStarted = resolve; });
    const originalCommit = bus.commit.bind(bus);
    bus.commit = async (...args) => { markCommitStarted(); await started; return originalCommit(...args); };
    const pending = bus.execute("apply_changes", { expectedRevision: 0, transactionId, expectedCandidateHash: transaction.preview_hash }, context);
    await commitStarted;
    currentPolicy = real;
    release();
    const result = await pending;

    expect(result.error).toMatchObject({ code: "STALE_POLICY_CONTEXT", transactionId });
    expect(bus.revision).toBe(0);
    expect(bus.transactionStore.getHeadRevision()).toBe(0);
    expect(bus.transactionStore.getTransaction(transactionId).status).toBe("committing");
  });
});
