import { DesignerRuntimeController } from "./agent-runtime.js";
import { policyError } from "../core/data-policy.js";
import { translateAgentError } from "./agent-error-text.js";
import { TURN_ACTION_LIMIT, TURN_TOKEN_LIMIT } from "./agent-budget.js";
import { AGRUN_VENDOR_PROVENANCE } from "../vendor/agrun.provenance.js";
import { t } from "./ui-i18n.js";
import { captureProviderRecipient, isProviderRecipientCurrent } from "./agent-provider.js";

export function createPanelSessions({ state, sessions, get, getGateway, profile, status, addMessage, renderProposal, renderSessions, onCandidateState, handleRuntimeEvent }) {
  let opening = null;
  let recipient = captureProviderRecipient(profile());

  function captureContext(includeRecord = true) {
    const policy = state.dataPolicy;
    const epoch = state.sessionEpoch || 0;
    const record = state.currentRecord;
    const destination = captureProviderRecipient(profile());
    const isCurrent = () => policy === state.dataPolicy && epoch === (state.sessionEpoch || 0)
      && (!includeRecord || record === state.currentRecord) && isProviderRecipientCurrent(destination, profile());
    return { isCurrent, assertCurrent() { if (!isCurrent()) throw policyError("STALE_POLICY_CONTEXT"); } };
  }

  function stopTurn() {
    state.sessionEpoch = (state.sessionEpoch || 0) + 1;
    if (opening) { state.currentRecord = null; state.sessionNeedsCreate = true; }
    opening = null;
    state.controller?.stop();
    state.controller = null;
    state.activePanelTurn = null;
    renderProposal(null);
    for (const selector of ["#ai-send", "#ai-review-layout"]) if (get(selector)) get(selector).disabled = false;
    if (get("#ai-stop")) get("#ai-stop").disabled = true;
  }

  function invalidateSession() {
    stopTurn();
    state.currentRecord = null;
    state.sessionNeedsCreate = true;
    if (typeof state.log?.querySelectorAll === "function") {
      state.log.querySelectorAll(".ai-message").forEach((node) => node.remove());
    } else {
      state.log.replaceChildren();
    }
    state.streamingNode = null;
    state.streamingText = "";
  }

  function onRecipientChange() {
    const next = profile();
    if (isProviderRecipientCurrent(recipient, next)) return;
    recipient = captureProviderRecipient(next);
    invalidateSession();
    state.records = [];
    renderSessions();
    addMessage("system", t("aiChat.session.recipientChanged"));
  }

  function reportSessionPersistence() {
    if (sessions.persistenceState !== "volatile-fallback" || state.sessionPersistenceAnnounced) return;
    state.sessionPersistenceAnnounced = true;
    addMessage("system", t("aiChat.status.sessionPersistenceUnavailable"));
    status("aiChat.status.sessionPersistenceUnavailable");
  }

  async function refreshSessions() {
    const context = captureContext(false);
    const records = await sessions.list();
    context.assertCurrent();
    state.records = records;
    reportSessionPersistence();
    renderSessions();
  }

  async function controllerFor(record, existing = false) {
    const context = captureContext();
    if (!record || record !== state.currentRecord) throw policyError("STALE_POLICY_CONTEXT");
    if (opening?.record === record) return opening.promise;
    const item = profile();
    if (!item) throw new Error(t("aiChat.errors.profileRequired"));
    const requestedSteps = Number(get("#ai-max-steps")?.value || 100);
    const maxSteps = Number.isInteger(requestedSteps) && requestedSteps >= 4 && requestedSteps <= 100 ? requestedSteps : 100;
    handleRuntimeEvent({ type: "runtime_config", detail: {
      provider: item.provider, model: item.model, maxSteps,
      actionLimit: Math.min(maxSteps, TURN_ACTION_LIMIT), tokenLimit: TURN_TOKEN_LIMIT,
      agrunCommit: AGRUN_VENDOR_PROVENANCE.commit, agrunSha256: AGRUN_VENDOR_PROVENANCE.sha256
    } });
    const guarded = (callback) => (...args) => { if (context.isCurrent()) callback(...args); };
    const flight = { record };
    flight.promise = (async () => {
      let controller;
      try {
        controller = await DesignerRuntimeController.create({
          Agrun: window.Agrun, gateway: getGateway(record.id), sessionManager: sessions, sessionId: record.id,
          profile: item, maxSteps, realData: state.realData, dataPolicy: state.dataPolicy,
          getDataPolicy: () => state.dataPolicy, assertCurrentContext: context.assertCurrent,
          onCandidateState: guarded(onCandidateState), onProposal: guarded(renderProposal),
          onEvent: guarded(handleRuntimeEvent), existing
        });
        await controller.session();
        context.assertCurrent();
        state.controller = controller;
        return controller;
      } catch (error) {
        controller?.stop();
        throw error;
      } finally {
        if (opening === flight) opening = null;
        if (context.isCurrent()) reportSessionPersistence();
      }
    })();
    opening = flight;
    return flight.promise;
  }

  async function newSession() {
    invalidateSession();
    const context = captureContext(false);
    const record = await sessions.create(t("aiChat.session.new"), "aiChat.session.new");
    context.assertCurrent();
    state.currentRecord = record;
    addMessage("system", t("aiChat.session.newMessage"));
    await refreshSessions();
    context.assertCurrent();
    return record;
  }

  async function ensureController() {
    onRecipientChange();
    const record = state.currentRecord || await newSession();
    if (record !== state.currentRecord) throw policyError("STALE_POLICY_CONTEXT");
    const context = captureContext();
    const controller = state.controller || await controllerFor(record, !state.sessionNeedsCreate);
    context.assertCurrent();
    state.sessionNeedsCreate = false;
    return { ...context, controller, record };
  }

  async function openSession(id, existing = true) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    invalidateSession();
    state.currentRecord = record;
    state.sessionNeedsCreate = false;
    const context = captureContext();
    addMessage("system", t("aiChat.session.opened", { label: record.label }));
    renderSessions();
    if (!profile()) return;
    try { await controllerFor(record, existing); }
    catch (error) { if (context.isCurrent()) addMessage("system", translateAgentError(error, "aiChat.errors.openSession")); }
  }

  return { captureContext, stopTurn, invalidateSession, onRecipientChange, controllerFor, ensureController, reportSessionPersistence, refreshSessions, newSession, openSession };
}
