import { describe, expect, it } from "vitest";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { DesignerRuntimeController } from "../../studio-v2/ui/agent-runtime.js";

const operation = { type: "set_brand_color", hex: "#854d0e" };
const profile = { id: "commit-boundary", provider: "openai", model: "gpt-test", apiKey: "memory-only" };

function gatewayFor(bus, { loseApplyResponse = false, calls = [] } = {}) {
  let lost = false;
  return {
    async execute(name, input = {}) {
      const response = await executeAgentCommand(bus, name, input);
      calls.push({ name, input, response });
      if (name === "apply_changes" && loseApplyResponse && !lost) {
        lost = true;
        throw Object.assign(new Error("Synthetic commit response loss"), { code: "COMMIT_RESPONSE_LOST" });
      }
      return response;
    }
  };
}

function fakeAgrun() {
  const session = { runStream: async function* () {} };
  return {
    defineAction: (definition) => definition,
    createRuntime: () => ({ createSession: async () => session, openSession: async () => session }),
    openaiBrowserSkill: {},
    geminiBrowserSkill: {},
  };
}

async function previewAndApprove(bus) {
  const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [operation] });
  const approved = await bus.execute("approve_transaction", {
    expectedRevision: 0,
    transactionId: preview.result.transactionId,
    expectedCandidateHash: preview.result.candidateHash,
    requireValid: true,
  });
  expect(approved.ok).toBe(true);
  return preview.result;
}

describe("Studio commit outcome boundary", () => {
  it("returns an idempotent committed result for duplicate Apply without a second revision", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const preview = await previewAndApprove(bus);
    const input = { expectedRevision: 0, transactionId: preview.transactionId, expectedCandidateHash: preview.candidateHash, requireValid: true };

    const first = await bus.execute("apply_changes", input);
    const duplicate = await bus.execute("apply_changes", input);

    expect(first.ok).toBe(true);
    expect(duplicate).toMatchObject({ ok: true, result: { already_committed: true, committed_revision: 1, revision: 1, transaction: { status: "committed" } } });
    expect(bus.revision).toBe(1);
  });

  it("queries the transaction after a lost Apply response and preserves the committed result", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const calls = [];
    const gateway = gatewayFor(bus, { loseApplyResponse: true, calls });
    const proposals = [];
    const controller = await DesignerRuntimeController.create({
      Agrun: fakeAgrun(), gateway, sessionManager: { createStore: () => ({}) }, sessionId: "lost-commit", profile,
      onProposal: (proposal, options) => proposals.push({ proposal, options })
    });
    const preview = await previewAndApprove(bus);
    const proposal = await controller.createProposal({
      proposalId: "proposal-lost-commit", revision: preview.revision, transactionId: preview.transactionId,
      operations: [operation], candidateHash: preview.candidateHash, diff: preview.diff, validation: preview.validation
    });

    const result = await controller.applyApprovedProposal(proposal.proposalId, profile);

    expect(result.applied.result).toMatchObject({ already_committed: true, committed_revision: 1, revision: 1 });
    expect(bus.revision).toBe(1);
    expect(calls.map((call) => call.name)).toEqual(["approve_transaction", "apply_changes", "get_transaction", "validate_project"]);
    expect(controller.pendingProposal).toBeNull();
    expect(proposals.at(-1).proposal).toBeNull();
  });

  it("marks an unresolved commit for recovery instead of retrying or claiming failure", async () => {
    const bus = new CommandBus(createSalesInvoiceProject(), { failureInjector: (phase) => phase === "after_revision_write" });
    const calls = [];
    const gateway = gatewayFor(bus, { calls });
    const proposals = [];
    const controller = await DesignerRuntimeController.create({
      Agrun: fakeAgrun(), gateway, sessionManager: { createStore: () => ({}) }, sessionId: "unknown-commit", profile,
      onProposal: (proposal, options) => proposals.push({ proposal, options })
    });
    const preview = await previewAndApprove(bus);
    const proposal = await controller.createProposal({
      proposalId: "proposal-unknown-commit", revision: preview.revision, transactionId: preview.transactionId,
      operations: [operation], candidateHash: preview.candidateHash, diff: preview.diff, validation: preview.validation
    });
    await expect(controller.applyApprovedProposal(proposal.proposalId, profile)).rejects.toMatchObject({ code: "RECOVERY_REQUIRED" });

    expect(bus.revision).toBe(1);
    expect(calls.map((call) => call.name)).toEqual(["approve_transaction", "apply_changes", "get_transaction"]);
    expect(controller.pendingProposal).not.toBeNull();
    expect(proposals.at(-1).options).toMatchObject({ status: "recovery" });
  });
});
