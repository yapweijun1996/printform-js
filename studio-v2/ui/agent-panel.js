import { ByokVault } from "./agent-vault.js";
import { AgentSessionManager } from "./agent-sessions.js";
import { DEFAULT_PROVIDER_PRESET, publicDefaultProviderProfile } from "./agent-provider.js";
import { populateProviderForm } from "./agent-settings-form.js";
import { createAgentPanelRuntime } from "./agent-panel-runtime.js";
import { panelMarkup, headerClusterMarkup } from "./agent-panel-view.js";
import { toneForStatusKey } from "./agent-status-tone.js";
import { createDocumentContextView } from "./agent-document-context.js";
import { renderChangeCardContent } from "./agent-change-cards.js";
import { bindAgentSettingsModal } from "./agent-settings-modal.js";
import { settingsModalMarkup } from "./agent-settings-view.js";
import { applyUiI18n, t } from "./ui-i18n.js";
import { agentErrorKey, translateAgentError } from "./agent-error-text.js";
import { bindAgentTrace } from "./agent-trace.js";
import { usageLabel } from "./agent-usage.js";
import { bindLayoutReviewView } from "./agent-review-view.js";
import { bindAgentHistoryControls } from "./agent-history-controls.js";
import { bindAgentPanelVault } from "./agent-panel-vault.js";
import { createAgentPanelEventObserver } from "./agent-panel-events.js";

const $ = (selector) => document.querySelector(selector);

export function initAgentPanel({
  realData = false,
  getGateway,
  getBaseProject = () => null,
  getHistoryState = () => ({}),
  onHistoryAction = async () => {},
  onCandidateState = () => {},
  onRealDataChange = () => {}
}) {
  const host = $("#ai-designer-tabpanel");
  host.innerHTML = panelMarkup();
  // Brand + primary actions live in the shared inspector header, not the
  // tabpanel; inject them into the static slots before applyUiI18n localizes.
  const cluster = headerClusterMarkup();
  const brandSlot = $('.inspector-header [data-slot="brand"]');
  const actionSlot = $('.inspector-header [data-slot="actions"]');
  if (brandSlot) brandSlot.innerHTML = cluster.brand;
  if (actionSlot) actionSlot.innerHTML = cluster.actions;
  $("#ai-provider-details")?.remove();
  document.body.insertAdjacentHTML("beforeend", settingsModalMarkup());
  applyUiI18n(document);
  // Seed the header status dot from the localized gateway line before the first
  // status() call fires.
  const bootDot = $("#ai-status-dot");
  if (bootDot) bootDot.title = $("#ai-status")?.textContent.trim() || "";

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
    applyMode: "auto",
    streamingNode: null,
    streamingText: "",
    usage: null,
    publicGatewayKey: "",
    statusKey: "aiChat.status.publicGateway",
    statusVariables: {},
    statusText: "",
    log: $("#ai-chat-log")
  };

  const docContext = createDocumentContextView({
    get: $,
    t,
    onScopeChange: (scope) => { state.activeScope = scope; }
  });

  function status(key, variables = {}) {
    const localized = key.startsWith("aiChat.") || key.startsWith("aiSettings.");
    const values = variables?.usage && typeof variables.usage === "object" ? { ...variables, usage: usageLabel(variables.usage) } : variables;
    const text = localized ? t(key, values) : key;
    state.statusKey = localized ? key : null;
    state.statusVariables = localized ? variables : {};
    state.statusText = text;
    const statusEl = $("#ai-status");
    if (statusEl) statusEl.textContent = text;
    // #ai-status is a hidden live region; the visible signal is the header dot.
    const dot = $("#ai-status-dot");
    if (dot) { dot.dataset.tone = toneForStatusKey(state.statusKey); dot.title = text; }
    const modalStatus = $("#ai-settings-status");
    if (modalStatus && !$("#ai-provider-details")?.hidden) modalStatus.textContent = text;
  }

  function addMessage(role, text) {
    state.log.querySelector(".ai-chat-welcome")?.remove();
    const node = document.createElement("div");
    node.className = `ai-message ${role}`;
    node.textContent = text;
    state.log.append(node);
    state.log.scrollTop = state.log.scrollHeight;
    return node;
  }

  const vaultBindings = bindAgentPanelVault({ $, vault, state, status, t });

  function renderSessions() {
    const select = $("#ai-session-select");
    if (!select) return;
    select.replaceChildren();
    if (!state.currentRecord) select.append(new Option(state.records.length ? t("aiChat.session.openPrevious") : t("aiChat.session.none"), ""));
    state.records.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.labelKey ? t(item.labelKey) : t({ "New design chat": "aiChat.session.new", "新建设计聊天": "aiChat.session.new", "Sembang reka bentuk baharu": "aiChat.session.new", "新しいデザインチャット": "aiChat.session.new", "Cuộc trò chuyện thiết kế mới": "aiChat.session.new" }[item.label], {}, item.label);
      select.append(option);
    });
    if (state.currentRecord) select.value = state.currentRecord.id;
    const delBtn = $("#ai-delete-session");
    if (delBtn) delBtn.disabled = !state.currentRecord;
  }

  function renderProposal(proposal, options = {}) {
    state.proposal = proposal;
    const card = $("#ai-proposal-card");
    if (!card) return;
    card.classList.toggle("hidden", !proposal);
    if (!proposal) {
      card.replaceChildren();
      if (!options.preserveCandidate) {
        onCandidateState(false);
        docContext.update({ stateMode: "committed" });
      }
      return;
    }
    const cardStatus = options.status || (state.applyMode === "preview" ? "pending" : "pending");
    const appliedRevision = options.appliedRevision ?? proposal.appliedRevision ?? null;
    const proposalData = appliedRevision !== null ? { ...proposal, appliedRevision } : proposal;

    renderChangeCardContent({
      container: card,
      proposal: proposalData,
      baseProject: getBaseProject(),
      applyMode: state.applyMode,
      status: cardStatus,
      t,
      onApply: () => runtime.resolveApproval("approve"),
      onDiscard: () => runtime.resolveApproval("deny"),
      onUndo: async (p) => {
        await onHistoryAction("undo_revision");
        renderProposal(p, { status: "reverted", preserveCandidate: false });
      },
      onRedo: async (p) => {
        await onHistoryAction("redo_revision");
        renderProposal(p, { status: "applied", appliedRevision: p.appliedRevision, preserveCandidate: false });
      }
    });

    const isPending = cardStatus === "pending";
    onCandidateState(isPending);
    docContext.update({
      stateMode: isPending ? "candidate" : "committed",
      candidateRevision: isPending ? (proposal.revision !== undefined ? proposal.revision + 1 : null) : null
    });
  }

  const reviewView = bindLayoutReviewView({ get: $, t, status });
  const settingsModal = bindAgentSettingsModal({ get: $, onSave: vaultBindings.saveProfile });
  const handleRuntimeEvent = createAgentPanelEventObserver({
    state, trace, reviewView, status, addMessage, renderProposal
  });

  const runtime = createAgentPanelRuntime({
    state,
    vault,
    sessions,
    get: $,
    getGateway,
    profile: vaultBindings.profile,
    status,
    addMessage,
    renderProposal,
    renderSessions,
    onCandidateState,
    handleRuntimeEvent,
    openProviderSettings: () => settingsModal.open({ section: "provider", focusSelector: "#ai-public-gateway-key", opener: $("#ai-settings-button") })
  });

  host.querySelectorAll("[data-ai-prompt-key]").forEach((button) => button.addEventListener("click", () => {
    $("#ai-prompt").value = t(button.dataset.aiPromptKey);
    $("#ai-prompt").focus();
  }));

  $("#ai-session-select")?.addEventListener("change", (event) => runtime.openSession(event.target.value));
  $("#ai-new-session")?.addEventListener("click", async () => {
    $("#ai-sessions-drawer")?.classList.remove("hidden");
    $("#ai-sessions-toggle")?.setAttribute("aria-expanded", "true");
    await runtime.newSession();
  });
  $("#ai-delete-session")?.addEventListener("click", async () => {
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
  $("#ai-send")?.addEventListener("click", runtime.send);
  $("#ai-prompt")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      runtime.send();
    }
  });
  $("#ai-stop")?.addEventListener("click", () => {
    state.controller?.stop();
    renderProposal(null);
    status("aiChat.status.stopped");
  });
  $("#ai-review-layout")?.addEventListener("click", runtime.reviewLayout);

  $("#ai-sessions-toggle")?.addEventListener("click", () => {
    const drawer = $("#ai-sessions-drawer");
    const open = drawer.classList.contains("hidden");
    drawer.classList.toggle("hidden", !open);
    $("#ai-sessions-toggle").setAttribute("aria-expanded", String(open));
    if (open) $("#ai-session-select")?.focus();
  });

  const autoModeBtn = $("#ai-mode-auto");
  const previewModeBtn = $("#ai-mode-preview");
  if (autoModeBtn && previewModeBtn) {
    autoModeBtn.addEventListener("click", () => {
      state.applyMode = "auto";
      autoModeBtn.classList.add("is-active");
      autoModeBtn.setAttribute("aria-checked", "true");
      previewModeBtn.classList.remove("is-active");
      previewModeBtn.setAttribute("aria-checked", "false");
      if (state.proposal) renderProposal(state.proposal);
    });
    previewModeBtn.addEventListener("click", () => {
      state.applyMode = "preview";
      previewModeBtn.classList.add("is-active");
      previewModeBtn.setAttribute("aria-checked", "true");
      autoModeBtn.classList.remove("is-active");
      autoModeBtn.setAttribute("aria-checked", "false");
      if (state.proposal) renderProposal(state.proposal);
    });
  }

  window.addEventListener("printform:ui-locale", () => {
    vaultBindings.renderProfiles();
    renderSessions();
    trace.render();
    docContext.render();
    status(state.statusKey || state.statusText, state.statusVariables);
  });

  populateProviderForm($, publicDefaultProviderProfile());
  historyControls.refresh(getHistoryState());
  vaultBindings.renderProfiles();
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
    onProjectChanged(nextProject = null) {
      state.controller?.stop();
      state.controller = null;
      renderProposal(null);
      if (nextProject) {
        docContext.update({
          documentTitle: nextProject.manifest?.title || "PrintForm Document",
          documentId: nextProject.manifest?.documentId || "",
          revision: nextProject.revision || 0
        });
      }
    },
    updateDocumentContext(docState) {
      docContext.update(docState);
    },
    refreshHistoryControls: historyControls.refresh,
    lock() {
      vault.lock();
      state.profileId = DEFAULT_PROVIDER_PRESET.id;
    }
  };
}
