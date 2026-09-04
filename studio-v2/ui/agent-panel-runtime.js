import { DesignerRuntimeController } from "./agent-runtime.js";
import { isCredentialFreeDefaultGatewayProfile, validateProviderProfile } from "./agent-provider.js";
import { translateAgentError } from "./agent-error-text.js";
import { t } from "./ui-i18n.js";
import { TURN_ACTION_LIMIT, TURN_TOKEN_LIMIT } from "./agent-budget.js";
import { AGRUN_VENDOR_PROVENANCE } from "../vendor/agrun.provenance.js";

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
  openProviderSettings
}) {
  function requireGatewayToken(item) {
    if (!isCredentialFreeDefaultGatewayProfile(item)) return false;
    addMessage("system", t("aiChat.errors.gatewayTokenRequired"));
    status("aiChat.status.gatewayTokenRequired");
    openProviderSettings();
    return true;
  }

  async function controllerFor(record, existing = false) {
    const item = profile();
    if (!item) throw new Error(t("aiChat.errors.profileRequired"));
    const requestedSteps = Number(get("#ai-max-steps")?.value || 100);
    const maxSteps = Number.isInteger(requestedSteps) && requestedSteps >= 4 && requestedSteps <= 100 ? requestedSteps : 100;
    handleRuntimeEvent({
      type: "runtime_config",
      detail: {
        provider: item.provider, model: item.model, maxSteps,
        actionLimit: Math.min(maxSteps, TURN_ACTION_LIMIT), tokenLimit: TURN_TOKEN_LIMIT,
        agrunCommit: AGRUN_VENDOR_PROVENANCE.commit, agrunSha256: AGRUN_VENDOR_PROVENANCE.sha256
      }
    });
    state.controller = await DesignerRuntimeController.create({
      Agrun: window.Agrun,
      gateway: getGateway(),
      sessionManager: sessions,
      sessionId: record.id,
      profile: item,
      maxSteps,
      realData: state.realData,
      onCandidateState,
      onProposal: renderProposal,
      onEvent: handleRuntimeEvent,
      existing
    });
    return state.controller;
  }

  async function refreshSessions() {
    state.records = await sessions.list();
    renderSessions();
  }

  async function newSession() {
    const record = await sessions.create(t("aiChat.session.new"), "aiChat.session.new");
    state.currentRecord = record;
    state.sessionNeedsCreate = true;
    state.controller?.stop();
    state.controller = null;
    renderProposal(null);
    state.log.replaceChildren();
    addMessage("system", t("aiChat.session.newMessage"));
    await refreshSessions();
  }

  async function openSession(id, existing = true) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    state.currentRecord = record;
    state.sessionNeedsCreate = false;
    state.controller?.stop();
    state.controller = null;
    renderProposal(null);
    state.log.replaceChildren();
    addMessage("system", t("aiChat.session.opened", { label: record.label }));
    renderSessions();
    if (!profile()) return;
    try {
      await controllerFor(record, existing);
    } catch (error) {
      addMessage("system", translateAgentError(error, "aiChat.errors.openSession"));
    }
  }

  async function autoApplyPending(item) {
    let lastResult = null;
    let changed = false;
    for (let pass = 0; pass < 4 && state.proposal; pass += 1) {
      const pendingProposal = state.proposal;
      const proposalId = pendingProposal.proposalId;
      changed = changed || pendingProposal.diff?.changed === true;
      status("aiChat.status.autoApplying");
      try {
        const apply = state.controller.applyProposal || state.controller.applyApprovedProposal;
        lastResult = await apply.call(state.controller, proposalId, item);
        if (!state.proposal || state.proposal.proposalId === proposalId) renderProposal(null);
        const revision = lastResult?.applied?.result?.revision;
        addMessage("system", t("aiChat.message.autoApplied", { revision: revision ?? "?" }));
      } catch (error) {
        addMessage("system", translateAgentError(error, "aiChat.errors.autoApply"));
        renderProposal(null);
        status("aiChat.status.applyFailed");
        return null;
      }
    }
    if (state.proposal && state.proposalStatus !== "applied") {
      addMessage("system", t("aiChat.message.autoApplyStopped"));
      status("aiChat.status.applyFailed");
      return null;
    }
    if (lastResult) status("aiChat.status.applied");
    return lastResult ? { ...lastResult, changed } : null;
  }

  async function runLayoutReview(item, { announce = true } = {}) {
    if (announce) addMessage("user", t("aiChat.review.request"));
    status("aiChat.status.reviewing");
    try {
      const outcome = await state.controller.reviewLayout(item);
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
        const applied = await autoApplyPending(item);
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
      addMessage("system", translateAgentError(error, "aiChat.errors.review"));
      status("aiChat.status.failed");
      return null;
    }
  }

  async function send() {
    const prompt = get("#ai-prompt").value.trim();
    if (!prompt) return;
    const item = profile();
    if (!item) return addMessage("system", t("aiChat.errors.profileRequired"));
    if (requireGatewayToken(item)) return;
    const error = validateProviderProfile(item);
    if (error) return addMessage("system", translateAgentError(error));
    if (!state.currentRecord) await newSession();
    if (!state.controller) {
      try {
        await controllerFor(state.currentRecord, !state.sessionNeedsCreate);
        state.sessionNeedsCreate = false;
      } catch (caught) {
        addMessage("system", translateAgentError(caught, "aiChat.errors.startSession"));
        return;
      }
    }
    get("#ai-prompt").value = "";
    addMessage("user", prompt);
    state.streamingNode = null;
    state.streamingText = "";
    state.usage = null;
    get("#ai-send").disabled = true;
    get("#ai-stop").disabled = false;
    status("aiChat.status.thinking");
    try {
      handleRuntimeEvent({ type: "turn_start" });
      const outcome = await state.controller.run(prompt, item);
      const failed = runtimeFailed(outcome);
      if (failed) throw failed;
      let applied = null;
      if (state.proposal) {
        if (state.applyMode === "preview") {
          status("aiChat.card.pending");
        } else {
          applied = await autoApplyPending(item);
        }
      }
      const appliedChanged = applied?.changed || applied?.applied?.result?.diff?.changed;
      if (appliedChanged && !applied.review) await runLayoutReview(item, { announce: false });
      await sessions.touch(state.currentRecord.id);
    } catch (caught) {
      addMessage("system", translateAgentError(caught, "aiChat.errors.providerTurnStart"));
    } finally {
      get("#ai-send").disabled = false;
      get("#ai-stop").disabled = true;
    }
  }

  async function resolveApproval(decision) {
    const item = profile();
    const proposal = state.proposal;
    if (!state.controller || !proposal) return;
    status(decision === "approve" ? "aiChat.status.applying" : "aiChat.status.rejecting");
    try {
      if (decision === "deny") {
        state.controller.rejectProposal(proposal.proposalId);
        renderProposal(null);
        status("aiChat.status.rejected");
        return;
      }

      const proposalId = proposal.proposalId;
      const result = await state.controller.applyApprovedProposal(proposalId, item);
      if (!state.proposal || state.proposal.proposalId === proposalId) renderProposal(null);
      if (state.proposal) status("aiChat.status.approval");
      else if (result?.review?.readiness) status(result.review.readiness.ok && result.review.readiness.result?.ready ? "aiChat.status.reviewReady" : "aiChat.status.reviewBlocked");
      else if (result?.review?.blocked) status("aiChat.status.reviewBlocked");
      else status("aiChat.status.applied");
    } catch (error) {
      addMessage("system", translateAgentError(error, "aiChat.errors.approvalResolution"));
      renderProposal(null);
      status("aiChat.status.applyFailed");
    }
  }

  async function reviewLayout() {
    const item = profile();
    if (!item) return addMessage("system", t("aiChat.errors.profileRequired"));
    if (requireGatewayToken(item)) return;
    if (!state.currentRecord) await newSession();
    if (!state.controller) {
      try {
        await controllerFor(state.currentRecord, !state.sessionNeedsCreate);
        state.sessionNeedsCreate = false;
      } catch (error) {
        addMessage("system", translateAgentError(error, "aiChat.errors.startSession"));
        return;
      }
    }
    get("#ai-review-layout").disabled = true;
    get("#ai-stop").disabled = false;
    addMessage("user", t("aiChat.review.request"));
    try { await runLayoutReview(item, { announce: false }); }
    finally {
      get("#ai-review-layout").disabled = false;
      get("#ai-stop").disabled = true;
    }
  }

  return { controllerFor, refreshSessions, newSession, openSession, send, resolveApproval, reviewLayout, autoApplyPending };
}
