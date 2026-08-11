import { ByokVault } from "./agent-vault.js";
import { AgentSessionManager } from "./agent-sessions.js";
import { DEFAULT_PROVIDER_PRESET, publicDefaultProviderProfile, validateProviderProfile } from "./agent-provider.js";
import { gatewayBadgeKey, gatewayOptionLabel, gatewayProfileFromForm, gatewayStatusKey } from "./agent-public-gateway.js";
import { populateProviderForm } from "./agent-settings-form.js";
import { createAgentPanelRuntime } from "./agent-panel-runtime.js";
import { panelMarkup, renderSafeText } from "./agent-panel-view.js";
import { bindAgentSettingsModal } from "./agent-settings-modal.js";
import { settingsModalMarkup } from "./agent-settings-view.js";
import { applyUiI18n, t } from "./ui-i18n.js";
import { agentErrorKey, translateAgentError } from "./agent-error-text.js";
import { bindAgentTrace, traceActionLabel } from "./agent-trace.js";
import { usageLabel } from "./agent-usage.js";
import { bindLayoutReviewView } from "./agent-review-view.js";
import { bindAgentHistoryControls } from "./agent-history-controls.js";
const $ = (selector) => document.querySelector(selector);
export function initAgentPanel({ realData = false, getGateway, getHistoryState = () => ({}), onHistoryAction = async () => {}, onCandidateState = () => {}, onRealDataChange = () => {} }) {
  const host = $("#ai-designer-tabpanel");
  host.innerHTML = panelMarkup();
  $("#ai-provider-details")?.remove();
  document.body.insertAdjacentHTML("beforeend", settingsModalMarkup());
  applyUiI18n(document);
  const trace = bindAgentTrace({ get: $ });
  const vault = new ByokVault();
  const sessions = new AgentSessionManager({ realData });
  const historyControls = bindAgentHistoryControls({ get: $, onAction: onHistoryAction });
  const state = {
    realData,
    records: [],
    currentRecord: null,
    sessionNeedsCreate: false,
    controller: null,
    profileId: DEFAULT_PROVIDER_PRESET.id,
    proposal: null,
    streamingNode: null,
    streamingText: "",
    usage: null, publicGatewayKey: "", statusKey: "aiChat.status.publicGateway", statusVariables: {}, statusText: "",
    log: $("#ai-chat-log")
  };
  function status(key, variables = {}) {
    const localized = key.startsWith("aiChat.") || key.startsWith("aiSettings."), values = variables?.usage && typeof variables.usage === "object" ? { ...variables, usage: usageLabel(variables.usage) } : variables, text = localized ? t(key, values) : key;
    state.statusKey = localized ? key : null; state.statusVariables = localized ? variables : {}; state.statusText = text;
    $("#ai-status").textContent = text;
    const modalStatus = $("#ai-settings-status"); if (modalStatus && !$("#ai-provider-details")?.hidden) modalStatus.textContent = text;
  }
  function addMessage(role, text) {
    state.log.querySelector(".ai-chat-welcome")?.remove();
    const node = document.createElement("div");
    node.className = `ai-message ${role}`;
    renderSafeText(node, text);
    state.log.append(node);
    state.log.scrollTop = state.log.scrollHeight;
    return node;
  }
  function profile() { return state.profileId === DEFAULT_PROVIDER_PRESET.id ? publicDefaultProviderProfile(state.publicGatewayKey) : state.profileId ? vault.getProfile(state.profileId) : null; }
  function renderProfiles() {
    const select = $("#ai-profile-select");
    select.replaceChildren();
    const profiles = vault.listProfiles().filter((item) => item.id !== DEFAULT_PROVIDER_PRESET.id);
    select.append(new Option(gatewayOptionLabel(t, Boolean(state.publicGatewayKey)), DEFAULT_PROVIDER_PRESET.id));
    profiles.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      const providerKey = { openai: "aiSettings.providerOpenai", gemini: "aiSettings.providerGemini", custom: "aiSettings.providerCustom" }[item.provider];
      option.textContent = t("aiSettings.runtime.profileOption", { provider: t(providerKey, {}, item.provider), model: item.model });
      select.append(option);
    });
    if (state.profileId) select.value = state.profileId;
    $("#ai-settings-badge").textContent = t(state.profileId === DEFAULT_PROVIDER_PRESET.id ? gatewayBadgeKey(Boolean(state.publicGatewayKey)) : "aiSettings.encryptedByok");
  }
  function loadProfile(id) {
    state.profileId = id;
    const item = vault.getProfile(id) || (id === DEFAULT_PROVIDER_PRESET.id ? publicDefaultProviderProfile(state.publicGatewayKey) : null);
    if (!item) return;
    populateProviderForm($, item);
  }
  function renderSessions() {
    const select = $("#ai-session-select");
    select.replaceChildren();
    if (!state.currentRecord) select.append(new Option(state.records.length ? t("aiChat.session.openPrevious") : t("aiChat.session.none"), ""));
    state.records.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.labelKey ? t(item.labelKey) : t({ "New design chat": "aiChat.session.new", "新建设计聊天": "aiChat.session.new", "Sembang reka bentuk baharu": "aiChat.session.new", "新しいデザインチャット": "aiChat.session.new", "Cuộc trò chuyện thiết kế mới": "aiChat.session.new" }[item.label], {}, item.label);
      select.append(option);
    });
    if (state.currentRecord) select.value = state.currentRecord.id;
    $("#ai-delete-session").disabled = !state.currentRecord;
  }
  function renderProposal(proposal, { preserveCandidate = false } = {}) {
    state.proposal = proposal;
    const card = $("#ai-proposal-card");
    card.classList.toggle("hidden", !proposal);
    if (!proposal) {
      if (!preserveCandidate) onCandidateState(false);
      return;
    }
    $("#ai-proposal-diff").textContent = JSON.stringify({
      proposalId: proposal.proposalId,
      revision: proposal.revision,
      candidateHash: proposal.candidateHash,
      diff: proposal.diff
    }, null, 2);
    $("#ai-proposal-validation").textContent = JSON.stringify(proposal.validation, null, 2);
    onCandidateState(true);
  }
  function handleRuntimeEvent(event) {
    reviewView.observe(event);
    const record = trace.observe(event);
    if (event.type === "token") {
      if (!state.streamingNode) state.streamingNode = addMessage("assistant", "");
      state.streamingText += event.text || "";
      state.streamingNode.textContent = state.streamingText;
    }
    if (record?.type === "phase" && record.phase === "decide" && record.action) status("aiChat.status.actionSelected", { action: traceActionLabel(record.action), step: record.step || "?" });
    if (record?.type === "phase" && record.phase === "act" && record.action) status("aiChat.status.actionRunning", { action: traceActionLabel(record.action), step: record.step || "?" });
    if (record?.type === "tool_start" && record.action) status("aiChat.status.running", { action: traceActionLabel(record.action) });
    if (event.type === "usage") {
      state.usage = event.usage;
      status("aiChat.status.usage", { usage: state.usage });
    }
    if (event.type === "approval_required") status("aiChat.status.autoApplying");
    if (event.type === "proposal_ready") status("aiChat.status.autoApplying");
    if (event.type === "terminal_state") {
      const terminalState = event.detail?.state;
      if (terminalState === "pending_approval") status("aiChat.status.approval");
      if (terminalState === "blocked") status("aiChat.status.failed");
    }
    if (event.type === "layout_readiness") {
      const ready = event.detail?.ok && event.detail.result?.ready;
      status(ready ? "aiChat.status.reviewReady" : "aiChat.status.reviewBlocked");
    }
    if (record?.type === "completed") {
      if (record.terminalKind === "done") status("aiChat.status.ready", { usage: state.usage });
      else if (record.terminalKind === "abort") status("aiChat.status.stopped");
      else if (record.terminalKind === "error") status("aiChat.status.failed");
    }
    if (event.type === "runtime_error") {
      addMessage("system", translateAgentError({ code: event.detail?.code, message: event.detail?.message }, "aiChat.errors.providerTurn"));
      renderProposal(null);
      status("aiChat.status.failed");
    }
    if (event.type === "circuit_breaker_tripped") {
      status("aiChat.status.safetyStopped");
    }
    if (event.type === "stopped") {
      renderProposal(null);
      status("aiChat.status.stopped");
    }
    if (event.type === "assistant_text") {
      if (!state.streamingNode) addMessage("assistant", event.text);
      else renderSafeText(state.streamingNode, event.text);
      state.streamingNode = null;
      state.streamingText = "";
      status("aiChat.status.ready", { usage: state.usage });
    }
  }
  const reviewView = bindLayoutReviewView({ get: $, t, status });
  const settingsModal = bindAgentSettingsModal({ get: $, onSave: saveProfile });
  const runtime = createAgentPanelRuntime({
    state,
    vault,
    sessions,
    get: $,
    getGateway,
    profile,
    status,
    addMessage,
    renderProposal,
    renderSessions,
    onCandidateState,
    handleRuntimeEvent,
    openProviderSettings: () => settingsModal.open({ section: "provider", focusSelector: "#ai-public-gateway-key", opener: $("#ai-settings-button") })
  });
  async function unlock() {
    try {
      await vault.unlock($("#ai-vault-passphrase").value);
      $("#ai-vault-passphrase").value = "";
      state.profileId = DEFAULT_PROVIDER_PRESET.id;
      populateProviderForm($, publicDefaultProviderProfile(state.publicGatewayKey));
      renderProfiles();
      status("aiSettings.runtime.unlocked");
    } catch (error) {
      status(agentErrorKey(error) || translateAgentError(error));
    }
  }
  async function saveProfile() {
    try {
      const draft = gatewayProfileFromForm($);
      if (!draft.isDefaultGateway && !vault.unlocked) throw new Error("Unlock the provider vault first");
      const error = validateProviderProfile(draft.profile);
      if (error) throw new Error(error);
      if (draft.isDefaultGateway) {
        state.publicGatewayKey = draft.gatewayKey;
        state.profileId = DEFAULT_PROVIDER_PRESET.id;
        populateProviderForm($, draft.profile);
        renderProfiles();
        status(gatewayStatusKey(Boolean(draft.gatewayKey)));
        return true;
      }
      await vault.saveProfile(draft.item);
      state.profileId = draft.item.id;
      renderProfiles();
      status("aiSettings.runtime.profileSaved");
      return true;
    } catch (error) {
      status(agentErrorKey(error) || translateAgentError(error));
      return false;
    }
  }
  async function clearVault() {
    if (!window.confirm(t("aiSettings.runtime.clearConfirm"))) return;
    try {
      state.controller?.stop();
      state.controller = null;
      state.profileId = DEFAULT_PROVIDER_PRESET.id;
      await vault.clear();
      $("#ai-api-key").value = "";
      $("#ai-input-price").value = "";
      $("#ai-output-price").value = "";
      $("#ai-max-cost").value = "";
      renderProfiles();
      populateProviderForm($, publicDefaultProviderProfile(state.publicGatewayKey));
      status(gatewayStatusKey(Boolean(state.publicGatewayKey)));
    } catch (error) {
      status(agentErrorKey(error) || translateAgentError(error));
    }
  }
  $("#ai-unlock-vault").addEventListener("click", unlock);
  host.querySelectorAll("[data-ai-prompt-key]").forEach((button) => button.addEventListener("click", () => {
    $("#ai-prompt").value = t(button.dataset.aiPromptKey);
    $("#ai-prompt").focus();
  }));
  $("#ai-clear-vault").addEventListener("click", clearVault);
  $("#ai-lock-vault").addEventListener("click", () => {
    state.controller?.stop();
    state.controller = null;
    vault.lock();
    state.profileId = DEFAULT_PROVIDER_PRESET.id;
    populateProviderForm($, publicDefaultProviderProfile(state.publicGatewayKey));
    renderProfiles();
    status(gatewayStatusKey(Boolean(state.publicGatewayKey)));
  });
  $("#ai-profile-select").addEventListener("change", (event) => loadProfile(event.target.value));
  $("#ai-session-select").addEventListener("change", (event) => runtime.openSession(event.target.value));
  $("#ai-new-session").addEventListener("click", runtime.newSession);
  $("#ai-delete-session").addEventListener("click", async () => {
    if (!state.currentRecord) return;
    state.controller?.stop();
    state.controller = null;
    await sessions.delete(state.currentRecord.id);
    state.currentRecord = null;
    renderProposal(null);
    await runtime.refreshSessions();
    state.log.replaceChildren();
    addMessage("system", t("aiChat.session.deleted"));
  });
  $("#ai-send").addEventListener("click", runtime.send);
  $("#ai-prompt").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      runtime.send();
    }
  });
  $("#ai-stop").addEventListener("click", () => {
    state.controller?.stop();
    renderProposal(null);
    status("aiChat.status.stopped");
  });
  $("#ai-review-layout").addEventListener("click", runtime.reviewLayout);
  window.addEventListener("printform:ui-locale", () => { renderProfiles(); renderSessions(); trace.render(); status(state.statusKey || state.statusText, state.statusVariables); });
  populateProviderForm($, publicDefaultProviderProfile());
  historyControls.refresh(getHistoryState());
  renderProfiles();
  runtime.refreshSessions().catch((error) => status(agentErrorKey(error) || translateAgentError(error)));
  return {
    async setRealData(value) {
      state.realData = Boolean(value);
      sessions.setRealData(state.realData);
      state.controller?.stop();
      state.controller = null;
      state.currentRecord = null;
      renderProposal(null);
      state.log.replaceChildren();
      addMessage("system", state.realData ? t("aiChat.mode.realData") : t("aiChat.mode.syntheticData"));
      await runtime.refreshSessions();
      onRealDataChange(state.realData);
    },
    onProjectChanged() {
      state.controller?.stop();
      state.controller = null;
      renderProposal(null);
    },
    refreshHistoryControls: historyControls.refresh,
    lock() { vault.lock(); state.profileId = DEFAULT_PROVIDER_PRESET.id; } };
}
