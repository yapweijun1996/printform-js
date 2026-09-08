import { AGENT_CONTRACT_VERSION, STUDIO_VERSION } from "../core/constants.js";
import { CommandBus } from "../core/command-bus.js";
import { createSampleDocument, sampleDocumentKey } from "../samples/catalog.js";
import { classifyImportedDocument, classifyRealDocument, classifySampleDocument, nextDataPolicy } from "../core/data-policy.js";
import { installAgentGateway } from "../adapters/gateway.js";
import { installWebMcpAdapter } from "../adapters/webmcp.js";
import { clearRecoveryDraft, loadRecoveryDraft, peekRecoveryDraft, saveRecoveryDraft } from "./draft-cache.js";
import { initUiI18n, currentUiLocale, setUiLocale, t } from "./ui-i18n.js";
import { renderContractVersion, renderDataPolicy, renderQualityView, renderWebMcpStatus, refreshStatusText } from "./status-view.js";
import { createEditorPanel } from "./editor-panel.js";
import { createRenderController } from "./render-controller.js";
import { createStudioActions } from "./studio-actions.js";
import { initAgentPanel } from "./agent-panel.js";
import { bindAppUi } from "./app-bindings.js";
import { setupServiceWorkerUpgrade } from "./service-worker-upgrade.js";
import { analyzeMigration } from "../core/migrations.js";
import { parseProjectHtml, verifyImportedProject } from "../core/project-model.js";

const $ = (selector) => document.querySelector(selector);
let bus; let webMcp; let uiSessionFactory; let dirty = false; let saveState = "saved"; let activeSampleKey = sampleDocumentKey();
const initialProject = createSampleDocument(activeSampleKey);
let fingerprint = initialProject.manifest.documentId;
let dataPolicy = classifySampleDocument(fingerprint);
let scopeContext = { kind: "document" };
let lastValidation; let editor; let renderer; let actions; let agentPanel; let editorToggle;

function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.remove("hidden"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.add("hidden"), 3500); }
function renderSaveState() { const node = $("#save-state"); if (!node) return; const keys = { saved: "actions.saveStateSaved", unsaved: "actions.saveStateUnsaved", saving: "actions.saveStateSaving", "download-started": "actions.saveStateDownloadStarted", cancelled: "actions.saveStateCancelled", failed: "actions.saveStateFailed", unconfirmed: "actions.saveStateUnconfirmed" }; const classes = { saved: "ready", unsaved: "pending", saving: "pending", "download-started": "pending", cancelled: "blocked", failed: "blocked", unconfirmed: "blocked" }; const key = keys[saveState] || keys.unsaved; node.className = `status ${classes[saveState] || "pending"}`; node.dataset.uiI18n = key; node.textContent = t(key); }
function setSaveState(next) { saveState = next; renderSaveState(); }
function renderQuality(validation) { lastValidation = validation; renderQualityView(validation, bus.project.trust, dataPolicy); }
function setDirty(value) { dirty = Boolean(value); setSaveState(dirty ? "unsaved" : "saved"); }
function getEditor(key) { if (key === "sourceOperations") return editor.sourceOperations; if (key === "dataContractOperations") return editor.dataContractOperations; return editor.editors[key]; }
function refreshHistoryControls() { const state = bus?.historyState?.() || { canUndo: false, canRedo: false }; $("#undo-button").disabled = !state.canUndo; $("#redo-button").disabled = !state.canRedo; agentPanel?.refreshHistoryControls?.(state); }

async function performHistoryAction(name, { expectedRevision = null } = {}) {
  if (!bus) return;
  const result = await bus.execute(name, { expectedRevision: expectedRevision ?? bus.revision });
  if (!result.ok) toast(result.error.message);
  if (result.ok && result.result?.changed) agentPanel?.onProjectChanged();
  refreshHistoryControls();
  return result;
}

function installBus(project, reason = "load", policy = dataPolicy) {
  dataPolicy = policy;
  if (reason === "import") { activeSampleKey = null; $("#document-select").value = ""; }
  const dataMode = $("#real-data-mode");
  if (dataMode) dataMode.checked = dataPolicy.classification === "real";
  webMcp?.dispose(); renderer?.replaceProject();
  bus = new CommandBus(project, {
    renderCandidate: (...args) => renderer.renderCandidate(...args),
    transactionStorage: dataPolicy.allowDurable ? window.localStorage : null,
    transactionNamespace: dataPolicy.generation > 1 ? dataPolicy.contextId : null,
    hydrateDurable: dataPolicy.allowDurable,
    dataPolicy,
    agentId: "studio-ui",
  });
  const gatewayOptions = {
    getDataPolicy: () => dataPolicy,
    getScopeContext: () => scopeContext,
    getApplyMode: () => agentPanel?.getApplyMode?.() || "preview",
    onUiSessionFactory: (factory) => { uiSessionFactory = factory; },
  };
  installAgentGateway(bus, window, gatewayOptions);
  webMcp = installWebMcpAdapter(bus, null, { ...gatewayOptions, isRealData: () => dataPolicy.classification === "real" });
  renderWebMcpStatus(webMcp); agentPanel?.onProjectChanged(project, dataPolicy);
  bus.addEventListener("change", (event) => {
    dirty = true; editor.setEditors(event.detail.project); renderQuality(bus.validation()); renderer.restoreCommitted(); refreshHistoryControls();
    agentPanel?.updateDocumentContext({ documentTitle: event.detail.project.manifest?.title || "PrintForm Document", documentId: event.detail.project.manifest?.documentId || "", revision: bus.revision, errorCount: bus.validation()?.errors?.length || 0, warningCount: bus.validation()?.warnings?.length || 0, stateMode: "committed", renderStatus: "waiting" });
    saveRecoveryDraft(event.detail.project, fingerprint, { policy: dataPolicy });
  });
  bus.addEventListener("review", () => { renderQuality(bus.readiness()); agentPanel?.updateDocumentContext({ errorCount: bus.validation()?.errors?.length || 0, warningCount: bus.validation()?.warnings?.length || 0 }); });
  editor.setEditors(project); renderQuality(bus.readiness()); renderer.schedulePreview(); refreshHistoryControls();
  agentPanel?.updateDocumentContext({ documentTitle: project.manifest?.title || "PrintForm Document", documentId: project.manifest?.documentId || "", revision: bus.revision, errorCount: bus.validation()?.errors?.length || 0, warningCount: bus.validation()?.warnings?.length || 0, stateMode: "committed", renderStatus: "waiting", selection: "Entire document" });
  renderDataPolicy(dataPolicy, bus.transactionStore);
  if (reason !== "initial") toast(t("toast.loaded", { title: project.manifest.title || "PrintForm" }));
}

function selectSample(key) {
  if (dirty && !window.confirm(t("confirm.discardSample"))) { $("#document-select").value = activeSampleKey; return; }
  activeSampleKey = key; const project = createSampleDocument(key); fingerprint = project.manifest.documentId; dirty = false; history.replaceState(null, "", `${location.pathname}?sample=${encodeURIComponent(key)}`); installBus(project, "sample", classifySampleDocument(fingerprint));
}

async function changeUiLocale(event) { const previous = currentUiLocale(); try { await setUiLocale(event.target.value); } catch { event.target.value = previous; toast(t("toast.languageFailed")); } }
function refreshLocalizedUi() { if (!bus) return; renderQuality(lastValidation || bus.readiness()); renderWebMcpStatus(webMcp); renderDataPolicy(dataPolicy, bus.transactionStore); refreshStatusText(); $("#revision-label").textContent = t("editor.revision", { revision: bus.revision }); editor.refresh(); editorToggle?.refresh(); }

function setupRecovery() {
  const metadata = peekRecoveryDraft(); if (!metadata) return;
  $("#restore-banner").classList.remove("hidden");
  $("#restore-button").addEventListener("click", () => {
    const policy = metadata.classification === "real"
      ? classifyRealDocument(metadata.fingerprint)
      : metadata.classification === "synthetic"
        ? classifySampleDocument(metadata.fingerprint)
        : classifyImportedDocument(metadata.fingerprint);
    const draft = loadRecoveryDraft({ policy, explicit: true });
    if (!draft?.project) { $("#restore-banner").classList.add("hidden"); return; }
    fingerprint = draft.fingerprint; activeSampleKey = null;
    installBus(draft.project, "recovery", policy);
    $("#real-data-mode").checked = false; $("#restore-banner").classList.add("hidden");
  });
  $("#discard-restore-button").addEventListener("click", () => { clearRecoveryDraft(); $("#restore-banner").classList.add("hidden"); });
}

async function onDataPolicyToggle(real) {
  if (!bus) return;
  if (!real && dataPolicy.classification !== "synthetic" && !window.confirm(t("confirm.syntheticClassification"))) {
    $("#real-data-mode").checked = dataPolicy.classification === "real";
    return;
  }
  const next = nextDataPolicy(dataPolicy, real ? "real" : "synthetic");
  installBus(bus.project, "policy", next);
}

await initUiI18n();
editor = createEditorPanel({ getBus: () => bus, onApplyColumnWidths: (...args) => actions.applyColumnWidths(...args), onApplyDataContract: () => actions.applyDataContract() });
renderer = createRenderController({ getBus: () => bus, getOverlayEnabled: () => $("#overlay-toggle")?.checked !== false, getDataPolicy: () => dataPolicy, toast, onCandidateState: () => {}, onRenderState: (state) => agentPanel?.updateDocumentContext(state) });
actions = createStudioActions({ getBus: () => bus, getFingerprint: () => fingerprint, setFingerprint: (value) => { fingerprint = value; }, getDirty: () => dirty, setDirty, setSaveState, getEditor, getDataPolicy: () => dataPolicy, installBus, toast });
agentPanel = initAgentPanel({ dataPolicy, getGateway: (sessionId) => uiSessionFactory?.(sessionId) || window.PrintFormStudioAgent, getBaseProject: () => bus?.project, getHistoryState: () => bus?.historyState?.() || {}, onHistoryAction: performHistoryAction, onCandidateState: (active) => active ? renderer.setCandidateState(true) : renderer.restoreCommitted(), onScopeChange: (scope) => { scopeContext = scope; }, onRealDataChange: onDataPolicyToggle, onDataPolicyChange: (policy) => installBus(bus.project, "policy", policy) });
renderContractVersion();
editorToggle = bindAppUi({ $, actions, getBus: () => bus, renderer, renderQuality, toast, t, onLocaleChange: changeUiLocale, refreshLocalizedUi, onDataPolicyChange: onDataPolicyToggle, onSample: selectSample, onHistoryAction: performHistoryAction, getLastValidation: () => lastValidation, isDirty: () => dirty, versions: { studio: STUDIO_VERSION, agent: AGENT_CONTRACT_VERSION } });
renderer.listen(); $("#document-select").value = activeSampleKey; installBus(initialProject, "initial", dataPolicy); setupRecovery(); setupServiceWorkerUpgrade({ isDirty: () => dirty, toast, translateMessage: t, onSaveDraft: () => actions.saveDraft() });
if (!window.Agrun) toast("AI Designer runtime did not load; existing Studio tools remain available.");
