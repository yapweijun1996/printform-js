import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { DurableTransactionStore, createMemoryDurableBackend } from "../../studio-v2/core/durable-transaction-store.js";
import { journalKey } from "../../studio-v2/core/transaction-journal.js";
import { createEvidencePack } from "../../studio-v2/core/evidence-pack.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function makeSession(project, backend, options = {}) {
  return new CommandBus(project, {
    ...options,
    transactionStore: new DurableTransactionStore({
      backend,
      key: DurableTransactionStore.keyFor(journalKey(project)),
      formId: DurableTransactionStore.formId(project),
      initialProject: project,
      clock: options.clock,
    }),
  });
}

async function previewAndApprove(bus, title = "changed") {
  const preview = await bus.execute("preview_changes", {
    expectedRevision: bus.revision,
    operations: [{ type: "set_manifest_value", path: "/title", value: title }],
  });
  expect(preview.ok).toBe(true);
  const approval = await bus.execute("approve_transaction", {
    expectedRevision: bus.revision,
    transactionId: preview.result.transactionId,
    expectedCandidateHash: preview.result.candidateHash,
  });
  expect(approval.ok).toBe(true);
  return { preview, approval };
}

describe("E13 durable transaction, concurrency and recovery", () => {
  it("persists the full transaction record, lease and append-only audit after restart", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    let current = new Date("2026-08-17T00:00:00.000Z");
    const clock = () => current;
    const first = makeSession(project, backend, { agentId: "agent-a", owner: "user-a", clock });
    const { preview } = await previewAndApprove(first, "durable invoice");
    const result = await first.execute("apply_changes", {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
    });
    expect(result.ok).toBe(true);
    const tx = result.result.transaction;
    expect(tx).toMatchObject({
      form_id: "sales-invoice-pilot",
      base_revision: 0,
      working_revision: 1,
      owner: "user-a",
      agent_id: "agent-a",
      status: "committed",
      patches: expect.any(Array),
      commit_result: expect.objectContaining({ status: "committed", revision: 1 }),
    });
    expect(tx.lease.lease_id).toEqual(expect.any(String));

    const reloaded = makeSession(project, backend, { agentId: "agent-a", owner: "user-a", clock });
    expect(reloaded.revision).toBe(1);
    expect(reloaded.project.manifest.title).toBe("durable invoice");
    const audit = await reloaded.execute("get_audit_events");
    expect(audit.result.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "transaction_started", "preview_created", "approved", "commit_started", "revision_committed",
    ]));
    current = new Date("2026-08-17T00:00:01.000Z");
    const renewed = await reloaded.execute("renew_lease", { transactionId: tx.transaction_id, leaseId: tx.lease.lease_id });
    expect(renewed.ok).toBe(false);
    expect(renewed.error.code).toBe("LEASE_NOT_RENEWABLE");
  });

  it("uses durable CAS and marks a stale parallel editor conflicted", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    const a = makeSession(project, backend, { agentId: "agent-a", owner: "user-a" });
    const b = makeSession(project, backend, { agentId: "agent-b", owner: "user-b" });
    const aFlow = await previewAndApprove(a, "from A");
    const bFlow = await previewAndApprove(b, "from B");
    expect((await b.execute("apply_changes", { expectedRevision: 0, transactionId: bFlow.preview.result.transactionId, expectedCandidateHash: bFlow.preview.result.candidateHash })).ok).toBe(true);

    const stale = await a.execute("apply_changes", { expectedRevision: 0, transactionId: aFlow.preview.result.transactionId, expectedCandidateHash: aFlow.preview.result.candidateHash });
    expect(stale.ok).toBe(false);
    expect(stale.error).toMatchObject({ code: "REVISION_CONFLICT", expectedRevision: 0, actualRevision: 1 });
    expect(a.transactionStore.getTransaction(aFlow.preview.result.transactionId).status).toBe("conflicted");
    expect(b.project.manifest.title).toBe("from B");
  });

  it("expires a stale lease and creates a new leased draft for takeover", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    let current = new Date("2026-08-17T00:00:00.000Z");
    const clock = () => current;
    const a = makeSession(project, backend, { agentId: "agent-a", owner: "user-a", clock, leaseDurationMs: 1000 });
    const started = await a.execute("begin_transaction", { baseRevision: 0 });
    const renewed = await a.execute("renew_lease", { transactionId: started.result.transaction_id, leaseId: started.result.lease.lease_id, durationMs: 1000 });
    expect(renewed.ok).toBe(true);
    current = new Date("2026-08-17T00:00:02.000Z");
    const b = makeSession(project, backend, { agentId: "agent-b", owner: "user-b", clock, leaseDurationMs: 1000 });
    const active = await b.execute("list_active_transactions");
    expect(active.result.transactions).toHaveLength(0);
    expect(b.transactionStore.getTransaction(started.result.transaction_id).status).toBe("expired");
    const takeover = await b.execute("takeover_transaction", { transactionId: started.result.transaction_id });
    expect(takeover.ok).toBe(true);
    expect(takeover.result).toMatchObject({ status: "draft", owner: "user-b", supersedes_transaction_id: started.result.transaction_id });
    expect(takeover.result.transaction_id).not.toBe(started.result.transaction_id);
  });

  it("expires a released lease and permits only an explicit takeover", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    const bus = makeSession(project, backend, { agentId: "agent-a", owner: "user-a" });
    const started = await bus.execute("begin_transaction", { baseRevision: 0 });
    const released = await bus.execute("release_lease", {
      transactionId: started.result.transaction_id,
      leaseId: started.result.lease.lease_id,
    });
    expect(released.result).toMatchObject({ status: "expired", lease: null });
    expect((await bus.execute("renew_lease", { transactionId: started.result.transaction_id })).error.code).toBe("LEASE_NOT_RENEWABLE");
    const takeover = await bus.execute("takeover_transaction", { transactionId: started.result.transaction_id, owner: "user-b" });
    expect(takeover.result).toMatchObject({ status: "draft", owner: "user-b" });
  });

  it("resolves a conflicted transaction only through explicit rollback", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    const a = makeSession(project, backend, { owner: "user-a" });
    const b = makeSession(project, backend, { owner: "user-b" });
    const aFlow = await previewAndApprove(a, "from A");
    const bFlow = await previewAndApprove(b, "from B");
    await b.execute("apply_changes", { expectedRevision: 0, transactionId: bFlow.preview.result.transactionId, expectedCandidateHash: bFlow.preview.result.candidateHash });
    await a.execute("apply_changes", { expectedRevision: 0, transactionId: aFlow.preview.result.transactionId, expectedCandidateHash: aFlow.preview.result.candidateHash });
    const resolved = await a.execute("resolve_conflict", { transactionId: aFlow.preview.result.transactionId, action: "rollback" });
    expect(resolved.result).toMatchObject({ status: "rolled_back", state: "ROLLED_BACK" });
  });

  it("rolls back an uncommitted transaction without changing the durable revision", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    const bus = makeSession(project, backend, { agentId: "agent-a", owner: "user-a" });
    const { preview } = await previewAndApprove(bus, "discarded");
    const rolledBack = await bus.execute("rollback_transaction", { transactionId: preview.result.transactionId });
    expect(rolledBack.result).toMatchObject({ status: "rolled_back", state: "ROLLED_BACK" });
    expect(bus.revision).toBe(0);
    expect(bus.transactionStore.getRevision().revision).toBe(0);
    expect((await bus.execute("get_audit_events")).result.events.at(-1).type).toBe("rolled_back");
  });

  it("recovers a crash after revision write as committed and preserves the evidence link", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    const crashing = makeSession(project, backend, { agentId: "agent-a", owner: "user-a", failureInjector: (phase) => phase === "after_revision_write" });
    const flow = await previewAndApprove(crashing, "crash-safe");
    const interrupted = await crashing.execute("apply_changes", { expectedRevision: 0, transactionId: flow.preview.result.transactionId, expectedCandidateHash: flow.preview.result.candidateHash });
    expect(interrupted.ok).toBe(false);
    expect(interrupted.error.code).toBe("INJECTED_CRASH");
    expect(crashing.transactionStore.getTransaction(flow.preview.result.transactionId).status).toBe("recovery_required");

    const recovered = makeSession(project, backend, { agentId: "recovery-agent", owner: "ops" });
    expect(recovered.revision).toBe(1);
    const outcome = await recovered.execute("recover_transaction", { transactionId: flow.preview.result.transactionId });
    expect(outcome.result).toMatchObject({ status: "committed", working_revision: 1 });
    const pack = await createEvidencePack({
      project: recovered.project,
      revision: recovered.revision,
      transactionId: flow.preview.result.transactionId,
      validation: { productionValid: true, errors: [], metrics: { logicalPages: 1 } },
      previewHash: flow.preview.result.candidateHash,
      security: { valid: true, externalNetwork: false, arbitraryJavascript: false },
    });
    recovered.recordEvidencePack(pack);
    const evidence = await recovered.execute("get_evidence_pack");
    expect(evidence.result.anchor).toMatchObject({
      transaction_id: flow.preview.result.transactionId,
      committed_revision: 1,
      evidence_pack_hash: pack.hash,
      form_spec_hash: pack.formSpecHash,
      preview_hash: pack.previewHash,
    });
    expect(evidence.result.evidencePack.hash).toBe(pack.hash);
  });

  it("recovers a crash before the revision CAS as rolled back and permits a new transaction", async () => {
    const project = createSalesInvoiceProject();
    const backend = createMemoryDurableBackend();
    const crashing = makeSession(project, backend, { failureInjector: (phase) => phase === "during_commit" });
    const flow = await previewAndApprove(crashing, "will rollback");
    const interrupted = await crashing.execute("apply_changes", { expectedRevision: 0, transactionId: flow.preview.result.transactionId, expectedCandidateHash: flow.preview.result.candidateHash });
    expect(interrupted.ok).toBe(false);
    const recovered = makeSession(project, backend);
    const outcome = await recovered.execute("recover_transaction", { transactionId: flow.preview.result.transactionId });
    expect(outcome.result.status).toBe("rolled_back");
    expect(recovered.revision).toBe(0);
    const retry = await previewAndApprove(recovered, "retry");
    expect((await recovered.execute("apply_changes", { expectedRevision: 0, transactionId: retry.preview.result.transactionId, expectedCandidateHash: retry.preview.result.candidateHash })).ok).toBe(true);
    expect(recovered.revision).toBe(1);
  });
});
