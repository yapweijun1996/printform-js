import { createPanelSessions } from "./agent-panel-sessions.js";
import { validateProviderProfile } from "./agent-provider.js";
import { translateAgentError } from "./agent-error-text.js";
import { t } from "./ui-i18n.js";
import { isAutoApplyEligible } from "../core/agent-boundary.js";

export function runtimeFailed(outcome) {
  if (outcome?.errorReported) return null;
  const error = outcome?.result?.error || outcome?.completed?.error;
  return error ? Object.assign(new Error(error.message || t("aiChat.errors.providerTurn")), { code: error.code }) : null;
}

export function createAgentPanelRuntime({
  state,
  vault,
  sessions,
  get,
  getGateway,
  profile,
  status,
  addMessage,
  renderProposal,
  renderSessions,
  onCandidateState,
  handleRuntimeEvent,
  onApplied = () => {},
  openProviderSettings
}) {
  const sessionOwner = createPanelSessions({ state, sessions, get, getGateway, profile, status, addMessage, renderProposal, renderSessions, onCandidateState, handleRuntimeEvent });
  const { captureContext, ensureController, reportSessionPersistence } = sessionOwner;
  let approvalInFlight = false;
  function isAutoMode() {
    return (state.applyMode || "auto") === "auto";
  }

  async function autoApplyPending(item, { modeAtStart = state.applyMode || "auto" } = {}) {
    const context = captureContext();
    const controller = state.controller;
    if (modeAtStart !== "auto" || !isAutoMode() || !isAutoApplyEligible(state.proposal)) {
      status("aiChat.card.pending");
      return null;
    }
    let lastResult = null;
    let changed = false;
    for (let pass = 0; pass < 4 && state.proposal; pass += 1) {
      if (!isAutoMode()) {
        status("aiChat.card.pending");
        return null;
      }
      const pendingProposal = state.proposal;
      const proposalId = pendingProposal.proposalId;
      changed = changed || pendingProposal.diff?.changed === true;
      status("aiChat.status.autoApplying");
      try {
        context.assertCurrent();
        const apply = controller.applyProposal || controller.applyApprovedProposal;
        lastResult = await apply.call(controller, proposalId, item);
        context.assertCurrent();
        const canShowApplied = !state.proposal || state.proposal.proposalId === proposalId;
        if (canShowApplied) { renderProposal(null); if (pendingProposal.diff?.changed !== false) onApplied(pendingProposal, lastResult); }
        const revision = lastResult?.applied?.result?.revision;
        const validationUnavailable = lastResult?.validationUnavailable === true;
        addMessage("system", t(validationUnavailable ? "aiChat.message.autoAppliedValidationUnavailable" : "aiChat.message.autoApplied", { revision: revision ?? "?" }));
      } catch (error) {
        if (!context.isCurrent()) return null;
        addMessage("system", translateAgentError(error, "aiChat.errors.autoApply"));
        if (error.code !== "RECOVERY_REQUIRED") renderProposal(null);
        status(error.code === "RECOVERY_REQUIRED" ? "aiChat.status.recoveryRequired" : "aiChat.status.applyFailed");
        return null;
      }
    }
    if (state.proposal && state.proposalStatus !== "applied") {
      addMessage("system", t("aiChat.message.autoApplyStopped"));
      status("aiChat.status.applyFailed");
      return null;
    }
    if (lastResult) status(lastResult.validationUnavailable ? "aiChat.status.validationUnavailable" : "aiChat.status.applied");
    return lastResult ? { ...lastResult, changed } : null;
  }

  async function runLayoutReview(item, { announce = true } = {}) {
    const context = captureContext();
    const controller = state.controller;
    const modeAtStart = state.applyMode || "auto";
    if (announce) addMessage("user", t("aiChat.review.request"));
    status("aiChat.status.reviewing");
    try {
      const outcome = await controller.reviewLayout(item);
      context.assertCurrent();
      const failed = runtimeFailed(outcome);
      if (failed) throw failed;
      if (outcome?.stopped || outcome?.completed?.terminalKind === "abort") {
        status("aiChat.status.stopped");
        return outcome;
      }
      if (outcome?.errorReported) {
        status("aiChat.status.failed");
        return outcome;
      }
      if (state.proposal) {
        const applied = modeAtStart === "auto" && isAutoMode() && isAutoApplyEligible(state.proposal)
          ? await autoApplyPending(item, { modeAtStart })
          : null;
        context.assertCurrent();
        if (state.proposal && !applied) {
          status("aiChat.card.pending");
          return { ...outcome, proposalPending: true };
        }
        if (applied) {
          const readiness = applied.review?.readiness;
          if (readiness) {
            const ready = readiness.ok && readiness.result?.ready;
            status(ready ? "aiChat.status.reviewReady" : "aiChat.status.reviewBlocked");
          } else if (applied.review?.blocked) status("aiChat.status.reviewBlocked");
          return applied;
        }
      }
      if (outcome.blocked) status("aiChat.status.reviewBlocked");
      else if (outcome.readiness) {
        const ready = outcome.readiness.ok && outcome.readiness.result?.ready;
        status(ready ? "aiChat.status.reviewReady" : "aiChat.status.reviewBlocked");
      } else status("aiChat.status.applied");
      return outcome;
    } catch (error) {
      if (!context.isCurrent()) return null;
      addMessage("system", translateAgentError(error, "aiChat.errors.review"));
      status("aiChat.status.failed");
      return null;
    }
  }

  async function send() {
    if (state.activePanelTurn) return;
    const prompt = get("#ai-prompt").value.trim();
    if (!prompt) return;
    const modeAtStart = state.applyMode || "auto";
    const item = profile();
    if (!item) return addMessage("system", t("aiChat.errors.profileRequired"));
    const error = validateProviderProfile(item);
    if (error) return addMessage("system", translateAgentError(error));
    const preparation = ensureController();
    let context = captureContext(false);
    const turn = state.activePanelTurn = Symbol("design-turn");
    get("#ai-send").disabled = true;
    get("#ai-stop").disabled = false;
    status("aiChat.status.thinking");
    try {
      context = await preparation;
      context.assertCurrent();
      get("#ai-prompt").value = "";
      addMessage("user", prompt);
      state.streamingNode = null;
      state.streamingText = "";
      state.usage = null;
      handleRuntimeEvent({ type: "turn_start" });
      const outcome = await context.controller.run(prompt, item);
      context.assertCurrent();
      const failed = runtimeFailed(outcome);
      if (failed) throw failed;
      let applied = null;
      if (state.proposal) {
        if (modeAtStart !== "auto") {
          status("aiChat.card.pending");
        } else {
          applied = await autoApplyPending(item, { modeAtStart });
          context.assertCurrent();
        }
      }
      const appliedChanged = applied?.changed || applied?.applied?.result?.diff?.changed;
      if (appliedChanged && !applied.review) await runLayoutReview(item, { announce: false });
      context.assertCurrent();
      await sessions.touch(context.record.id);
      context.assertCurrent();
    } catch (caught) {
      if (context.isCurrent()) addMessage("system", translateAgentError(caught, "aiChat.errors.providerTurnStart"));
    } finally {
      if (state.activePanelTurn === turn) {
        state.activePanelTurn = null;
        get("#ai-send").disabled = false;
        get("#ai-stop").disabled = true;
        if (context.isCurrent()) reportSessionPersistence();
      }
    }
  }

  async function resolveApproval(decision) {
    const context = captureContext();
    const controller = state.controller;
    const item = profile();
    const proposal = state.proposal;
    if (approvalInFlight || !state.controller || !proposal) return;
    approvalInFlight = true;
    status(decision === "approve" ? "aiChat.status.applying" : "aiChat.status.rejecting");
    try {
      if (decision === "deny") {
        controller.rejectProposal(proposal.proposalId);
        renderProposal(null);
        status("aiChat.status.rejected");
        return;
      }

      const proposalId = proposal.proposalId;
      const result = await controller.applyApprovedProposal(proposalId, item, { humanApproval: true });
      context.assertCurrent();
      if (result?.validationUnavailable) addMessage("system", t("aiChat.message.autoAppliedValidationUnavailable", { revision: result.applied?.result?.revision ?? "?" }));
      const canShowApplied = !state.proposal || state.proposal.proposalId === proposalId;
      if (canShowApplied) { renderProposal(null); if (proposal.diff?.changed !== false) onApplied(proposal, result); }
      if (state.proposal) status("aiChat.status.approval");
      else if (result?.review?.readiness) status(result.review.readiness.ok && result.review.readiness.result?.ready ? "aiChat.status.reviewReady" : "aiChat.status.reviewBlocked");
      else if (result?.review?.blocked) status("aiChat.status.reviewBlocked");
      else if (result?.validationUnavailable) status("aiChat.status.validationUnavailable");
      else status("aiChat.status.applied");
    } catch (error) {
      if (!context.isCurrent()) return;
      addMessage("system", translateAgentError(error, "aiChat.errors.approvalResolution"));
      if (error.code !== "RECOVERY_REQUIRED") renderProposal(null);
      status(error.code === "RECOVERY_REQUIRED" ? "aiChat.status.recoveryRequired" : "aiChat.status.applyFailed");
    } finally {
      approvalInFlight = false;
    }
  }

  async function reviewLayout() {
    if (state.activePanelTurn) return;
    const item = profile();
    if (!item) return addMessage("system", t("aiChat.errors.profileRequired"));
    const preparation = ensureController();
    let context = captureContext(false);
    const turn = state.activePanelTurn = Symbol("review-turn");
    get("#ai-review-layout").disabled = true;
    get("#ai-stop").disabled = false;
    try {
      context = await preparation;
      context.assertCurrent();
      addMessage("user", t("aiChat.review.request"));
      await runLayoutReview(item, { announce: false });
    } catch (error) {
      if (context.isCurrent()) addMessage("system", translateAgentError(error, "aiChat.errors.startSession"));
    }
    finally {
      if (state.activePanelTurn === turn) {
        state.activePanelTurn = null;
        get("#ai-review-layout").disabled = false;
        get("#ai-stop").disabled = true;
        if (context.isCurrent()) reportSessionPersistence();
      }
    }
  }

  return { ...sessionOwner, send, resolveApproval, reviewLayout, autoApplyPending };
}
