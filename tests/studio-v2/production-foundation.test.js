import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createEvidencePack } from "../../studio-v2/core/evidence-pack.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { approveAndApply } from "./transaction-test-helpers.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe("Studio v2 production foundation", () => {
  it("persists auditable transactions and evidence across a new command bus", async () => {
    const storage = memoryStorage();
    const first = new CommandBus(createSalesInvoiceProject(), { transactionStorage: storage, agentId: "test-agent" });
    const preview = await first.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }],
    });
    const applied = await approveAndApply(first, preview);
    expect(applied.ok).toBe(true);

    const pack = await createEvidencePack({
      project: first.project,
      revision: first.revision,
      validation: { productionValid: true, errors: [], metrics: { logicalPages: 2 } },
      previewHash: applied.result.candidateHash,
      runtimeVersion: "test-runtime",
      runtimeHash: "runtime-hash",
      printformRuntimeHash: "printform-hash",
      security: { valid: true, externalNetwork: false, arbitraryJavascript: false },
    });
    first.recordEvidencePack(pack);

    const entries = (await first.execute("get_transaction_history")).result.entries;
    expect(entries.map((entry) => entry.type)).toEqual(expect.arrayContaining(["BEGIN_EDIT", "PREVIEW", "APPROVE", "REVISION_COMMIT", "COMMIT", "EVIDENCE_PACK"]));
    expect(pack).toMatchObject({ revision: 1, formSpecHash: expect.stringMatching(/^sha256:/), runtimeVersion: "test-runtime", exportHtmlHash: null, security: { status: "PASS" } });

    const reloaded = new CommandBus(first.project, { transactionStorage: storage, agentId: "test-agent" });
    expect(reloaded.revision).toBe(1);
    expect((await reloaded.execute("get_evidence_pack")).result.evidencePack).toMatchObject({ revision: 1, hash: pack.hash });
    expect((await reloaded.execute("get_capabilities")).result.capabilities.persistentAudit).toBe(true);
  });

  it("fails closed when the project changes after approval but before commit", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const preview = await bus.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }],
    });
    expect((await bus.execute("approve_transaction", {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
    })).ok).toBe(true);
    bus.project.manifest.title = "Mutated outside transaction";
    const applied = await bus.execute("apply_changes", {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
    });
    expect(applied.error.code).toBe("CANDIDATE_CONTENT_MISMATCH");
    expect(bus.revision).toBe(0);
  });

  it("creates one durable no-op transaction for a publish at the initial revision", async () => {
    const storage = memoryStorage();
    const bus = new CommandBus(createSalesInvoiceProject(), { transactionStorage: storage });
    const first = await bus.ensurePublishTransaction();
    const second = await bus.ensurePublishTransaction();

    expect(first).toBe(second);
    expect(bus.revision).toBe(0);
    expect(bus.transactionStore.getTransaction(first)).toMatchObject({
      status: "committed",
      working_revision: 0,
      evidence_pack_ref: null,
    });
  });
});
