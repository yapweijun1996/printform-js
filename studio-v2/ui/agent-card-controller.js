import { renderChangeCardContent } from "./agent-change-cards.js";

export function createAgentCardController({ get, state, getBaseProject, onHistoryAction, onCandidateState, docContext, t }) {
  let runtime = null;

  function setRuntime(nextRuntime) {
    runtime = nextRuntime;
  }

  function renderCard(proposal, status = "pending") {
    const card = get("#ai-proposal-card");
    if (!card) return;
    card.classList.toggle("hidden", !proposal);
    if (!proposal) {
      card.replaceChildren();
      onCandidateState(false);
      docContext.update({ stateMode: "committed" });
      return;
    }
    renderChangeCardContent({
      container: card,
      proposal,
      baseProject: getBaseProject(),
      applyMode: state.applyMode,
      status,
      t,
      onApply: () => runtime?.resolveApproval("approve"),
      onDiscard: () => runtime?.resolveApproval("deny"),
      onUndo: async (item) => {
        if (!Number.isInteger(item.appliedRevision)) return;
        const result = await onHistoryAction("undo_revision", { expectedRevision: item.appliedRevision });
        if (!result?.ok || !result.result?.changed) return;
        state.appliedCard = { ...item, revertedRevision: result.result.revision };
        renderCard(state.appliedCard, "reverted");
      },
      onRedo: async (item) => {
        const expectedRevision = item.revertedRevision ?? (Number(item.appliedRevision) - 1);
        if (!Number.isInteger(expectedRevision)) return;
        const result = await onHistoryAction("redo_revision", { expectedRevision });
        if (!result?.ok || !result.result?.changed) return;
        state.appliedCard = { ...item, appliedRevision: result.result.revision };
        renderCard(state.appliedCard, "applied");
      }
    });
  }

  function renderProposal(proposal, options = {}) {
    state.proposal = proposal;
    if (!proposal) {
      const card = get("#ai-proposal-card");
      card?.classList.add("hidden");
      card?.replaceChildren();
      if (!options.preserveCandidate) {
        onCandidateState(false);
        docContext.update({ stateMode: "committed" });
      }
      return;
    }
    const status = options.status || "pending";
    const proposalData = options.appliedRevision === undefined
      ? proposal
      : { ...proposal, appliedRevision: options.appliedRevision };
    renderCard(proposalData, status);
    onCandidateState(status === "pending");
    docContext.update({
      stateMode: status === "pending" ? "candidate" : "committed",
      candidateRevision: status === "pending" ? (proposal.revision !== undefined ? proposal.revision + 1 : null) : null
    });
  }

  function showApplied(proposal, result) {
    const appliedRevision = result?.applied?.result?.revision ?? result?.result?.revision ?? null;
    state.appliedCard = { ...proposal, appliedRevision };
    renderCard(state.appliedCard, "applied");
  }

  function clear() {
    state.appliedCard = null;
  }

  return { renderProposal, showApplied, setRuntime, clear };
}
