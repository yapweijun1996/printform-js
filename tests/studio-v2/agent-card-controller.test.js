import { describe, expect, it, vi } from "vitest";
import { createAgentCardController } from "../../studio-v2/ui/agent-card-controller.js";

function setup() {
  document.body.innerHTML = '<div id="ai-proposal-card"></div>';
  const state = { applyMode: "auto", proposal: null };
  const onHistoryAction = vi.fn(async (_name, input) => ({ ok: true, result: { changed: true, revision: input.expectedRevision - 1 } }));
  const controller = createAgentCardController({
    get: (selector) => document.querySelector(selector),
    state,
    getBaseProject: () => ({ themeCss: "" }),
    onHistoryAction,
    onCandidateState: vi.fn(),
    docContext: { update: vi.fn() },
    t: (key, variables, fallback) => fallback || key
  });
  return { controller, onHistoryAction };
}

describe("Agent applied card history", () => {
  it("requires the applied revision before marking a card reverted", async () => {
    const { controller, onHistoryAction } = setup();
    const proposal = { proposalId: "card-1", revision: 0, diff: { changed: true }, operations: [] };

    controller.showApplied(proposal, { applied: { result: { revision: 1 } } });
    document.querySelector(".ai-card-undo").click();
    await Promise.resolve();

    expect(onHistoryAction).toHaveBeenCalledWith("undo_revision", { expectedRevision: 1 });
    expect(document.querySelector(".ai-card-reverted")).not.toBeNull();
  });

  it("keeps the applied card when a stale undo is rejected", async () => {
    const { controller, onHistoryAction } = setup();
    onHistoryAction.mockResolvedValue({ ok: false, error: { code: "REVISION_CONFLICT" } });
    controller.showApplied({ proposalId: "card-2", revision: 0, diff: { changed: true }, operations: [] }, { applied: { result: { revision: 1 } } });

    document.querySelector(".ai-card-undo").click();
    await Promise.resolve();

    expect(document.querySelector(".ai-card-applied")).not.toBeNull();
    expect(document.querySelector(".ai-card-reverted")).toBeNull();
  });
});
