import { describe, expect, it, vi } from "vitest";
import { createAgentPanelRuntime } from "../../studio-v2/ui/agent-panel-runtime.js";

function harness() {
  const oldProposal = { proposalId: "proposal-pass-1", diff: { changed: true } };
  const nextProposal = { proposalId: "proposal-pass-2" };
  const state = { proposal: oldProposal, controller: null, currentRecord: { id: "chat-1" }, sessionNeedsCreate: false };
  const nodes = new Map([
    ["#ai-apply-proposal", { disabled: false }],
    ["#ai-max-steps", { value: "100" }],
    ["#ai-prompt", { value: "make the form red" }],
    ["#ai-send", { disabled: false }],
    ["#ai-stop", { disabled: true }],
    ["#ai-review-layout", { disabled: false }]
  ]);
  const statuses = [];
  const renderProposal = vi.fn((proposal) => { state.proposal = proposal; });
  const runtime = createAgentPanelRuntime({
    state,
    vault: {}, sessions: { touch: vi.fn() }, get: (selector) => nodes.get(selector),
    getGateway: () => ({}), profile: () => ({ id: "profile", provider: "openai", model: "gpt-test", apiKey: "memory-only" }),
    status: (key) => statuses.push(key), addMessage: vi.fn(), renderProposal,
    renderSessions: vi.fn(), onCandidateState: vi.fn(), handleRuntimeEvent: vi.fn(),
    openProviderSettings: vi.fn()
  });
  return { state, runtime, oldProposal, nextProposal, statuses, renderProposal, nodes };
}

describe("AI panel automatic review proposal state", () => {
  it("keeps a fresh second-pass proposal created while applying the first repair", async () => {
    const test = harness();
    test.state.controller = {
      async applyApprovedProposal() {
        test.renderProposal(test.nextProposal);
        return { review: { readiness: null } };
      }
    };
    await test.runtime.resolveApproval("approve");
    expect(test.state.proposal).toEqual(test.nextProposal);
    expect(test.renderProposal).not.toHaveBeenCalledWith(null);
    expect(test.statuses.at(-1)).toBe("aiChat.status.approval");
  });

  it("clears the approved proposal when no next review proposal exists", async () => {
    const test = harness();
    test.state.controller = {
      async applyApprovedProposal() { return { review: { readiness: { ok: true, result: { ready: true } } } }; }
    };
    await test.runtime.resolveApproval("approve");
    expect(test.state.proposal).toBeNull();
    expect(test.statuses.at(-1)).toBe("aiChat.status.reviewReady");
  });

  it("automatically applies a validated proposal without a UI approval click", async () => {
    const test = harness();
    test.state.controller = {
      async applyProposal() { return { applied: { result: { revision: 1 } } }; }
    };
    const result = await test.runtime.autoApplyPending({ id: "profile" });
    expect(result.applied.result.revision).toBe(1);
    expect(test.state.proposal).toBeNull();
    expect(test.statuses.at(-1)).toBe("aiChat.status.applied");
  });

  it("automatically starts layout review after a changed design is applied", async () => {
    const test = harness();
    let reviewCalls = 0;
    test.state.controller = {
      async run() { return { completed: { terminalKind: "proposal_ready" } }; },
      async applyProposal() {
        test.renderProposal(null);
        return { applied: { result: { revision: 1 } } };
      },
      async reviewLayout() {
        reviewCalls += 1;
        return { readiness: { ok: true, result: { ready: true } } };
      }
    };

    await test.runtime.send();

    expect(reviewCalls).toBe(1);
    expect(test.statuses).toContain("aiChat.status.reviewing");
    expect(test.statuses.at(-1)).toBe("aiChat.status.reviewReady");
    expect(test.nodes.get("#ai-send").disabled).toBe(false);
    expect(test.nodes.get("#ai-stop").disabled).toBe(true);
  });

  it("does not auto-apply a preview-started proposal after switching to auto", async () => {
    const test = harness();
    test.state.applyMode = "preview";
    test.state.proposal = null;
    let release;
    let started;
    const startedPromise = new Promise((resolve) => { started = resolve; });
    const releasePromise = new Promise((resolve) => { release = resolve; });
    const applyProposal = vi.fn(async () => ({ applied: { result: { revision: 1 } } }));
    test.state.controller = {
      async run() {
        started();
        await releasePromise;
        test.renderProposal(test.oldProposal);
        return { completed: { terminalKind: "proposal_ready" } };
      },
      applyProposal
    };

    const pending = test.runtime.send();
    await startedPromise;
    test.state.applyMode = "auto";
    release();
    await pending;

    expect(applyProposal).not.toHaveBeenCalled();
    expect(test.state.proposal).toEqual(test.oldProposal);
    expect(test.statuses).toContain("aiChat.card.pending");
  });

  it("does not auto-apply an auto-started proposal after switching to preview", async () => {
    const test = harness();
    test.state.applyMode = "auto";
    test.state.proposal = null;
    let release;
    let started;
    const startedPromise = new Promise((resolve) => { started = resolve; });
    const releasePromise = new Promise((resolve) => { release = resolve; });
    const applyProposal = vi.fn(async () => ({ applied: { result: { revision: 1 } } }));
    test.state.controller = {
      async run() {
        started();
        await releasePromise;
        test.renderProposal(test.oldProposal);
        return { completed: { terminalKind: "proposal_ready" } };
      },
      applyProposal
    };

    const pending = test.runtime.send();
    await startedPromise;
    test.state.applyMode = "preview";
    release();
    await pending;

    expect(applyProposal).not.toHaveBeenCalled();
    expect(test.state.proposal).toEqual(test.oldProposal);
    expect(test.statuses).toContain("aiChat.card.pending");
  });

  it("reports an aborted layout review as stopped instead of applied", async () => {
    const test = harness();
    test.state.controller = {
      async reviewLayout() { return { completed: { terminalKind: "abort" } }; }
    };

    await test.runtime.reviewLayout();

    expect(test.statuses.at(-1)).toBe("aiChat.status.stopped");
    expect(test.nodes.get("#ai-review-layout").disabled).toBe(false);
    expect(test.nodes.get("#ai-stop").disabled).toBe(true);
  });
});
